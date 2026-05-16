# Database Design Research for Paddock — Postgres/Supabase Migration

> Research as of 2026-05-16. Pragmatic brief on schema design for a multi-series motorsport scheduling app whose data is fetched periodically from heterogeneous sources, where mid-season cancellations and time edits are routine and must be auditable.

## 1. Core entity shape — Series / Season / Round / Session / Result

The dominant normalized pattern across sports-schedule schemas (F1DB, academic F1 projects, generic tournament models) flows hierarchically from competition → year → event → individual sessions, with orthogonal driver/team/venue tables joined via results.

**Recommended tables (illustrative DDL, not final):**

```sql
series       (id, slug UNIQUE, name, governing_body, official_url, ...)
season       (id, series_id FK, year, start_date, end_date, ...)
round        (id, season_id FK, round_number, name, venue_id FK,
              start_date, end_date, status, source_id FK, ...)
session      (id, round_id FK, kind, label,
              local_start TIMESTAMP, time_zone TEXT, instant_utc TIMESTAMPTZ,
              duration_minutes, status, ...)
result       (id, session_id FK, driver_id FK, team_id FK,
              position, points, time_or_gap, dnf_reason, ...)
venue        (id, slug, name, country, lat, lon, iana_tz, ...)
circuit_layout (id, venue_id FK, length_km, turns, effective_from, effective_to)
driver       (id, slug, full_name, dob, nationality, ...)
team         (id, slug, name, principal, base_country, ...)
season_entry (id, season_id FK, driver_id FK, team_id FK,
              car_number, valid_from, valid_to)   -- driver-team-season junction
```

Key shape decisions backed by sources:

- **`round` and `session` are separated** because schedules ship as a round (a weekend / event) with N sessions (FP1/FP2/FP3/Q/Sprint/Race). The session is the unit of time, the round is the unit of identity. ([F1DB schema](https://github.com/f1db/f1db), [F1 race inspired database project — Medium](https://mahirahamzah.medium.com/f1-race-inspired-database-project-2e3227bb92da))
- **`season_entry`** is a junction table for driver/team/season because mid-season seat changes happen and you want time-bounded membership without rewriting history. ([Wikipedia — Slowly Changing Dimension](https://en.wikipedia.org/wiki/Slowly_changing_dimension))
- **`circuit_layout`** is a child of `venue` because circuits get reconfigured (e.g. Silverstone, Spa). Use `effective_from / effective_to` on the layout rather than mutating the venue. ([F1DB recently added `circuitLayoutId` precisely for this](https://github.com/f1db/f1db))
- **Use `BIGINT`/`BIGSERIAL` or `UUID v7` for primary keys.** Supabase's default convention is `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` because it matches `auth.users.id`. For tables with high insert rates and time-ordering, **UUID v7** gives k-sortable identifiers that improve index locality. Avoid UUID v1 (MAC-address leakage). ([Supabase — Choosing a Postgres Primary Key](https://supabase.com/blog/choosing-a-postgres-primary-key), [Database ID Design — DEV](https://dev.to/pipipi-dev/database-id-design-choosing-id-methods-and-primary-key-strategies-49h4))
- **Use `TEXT` not `VARCHAR(n)`** — in Postgres they're stored identically and `TEXT` avoids gratuitous length-bump migrations. ([Tiger Data — Schema design](https://www.tigerdata.com/learn/postgresql-performance-tuning-designing-and-implementing-database-schema))
- **Add a `slug` column with `UNIQUE` on every entity surfaced in URLs** (series, venue, driver, team). Lets you keep your current `content/series/<slug>/` URL contract.

## 2. Status modelling — scheduled / cancelled / postponed / tbc

This is exactly the case the literature treats as "use a status column, not soft delete." Schema.org's `EventStatusType` defines `EventScheduled / EventCancelled / EventPostponed / EventRescheduled / EventMovedOnline`, and Google's recommendation is explicit: **do not delete the listing — update the status instead**, so users searching for a cancelled event find the cancellation notice rather than a 404. ([Google Search Central — Virtual/postponed/canceled events](https://developers.google.com/search/blog/2020/03/new-properties-virtual-or-canceled-events), [Yoast — Update events with schema](https://yoast.com/update-your-events-with-schema/))

**Subtle but important distinction:** `EventPostponed` means "delayed, no new date yet"; `EventRescheduled` means "new date confirmed." Use postponed first, transition to rescheduled when you have the new date. Keep `previous_start_date` on the row when rescheduling so you can render "originally 2026-03-15".

**Implementation: prefer a small lookup table over a Postgres ENUM here.** Trade-offs from [Cybertec](https://www.cybertec-postgresql.com/en/lookup-table-or-enum-type/) and [Crunchy Data](https://www.crunchydata.com/blog/enums-vs-check-constraints-in-postgres):

| | ENUM | Lookup table | CHECK constraint |
|---|---|---|---|
| Storage | 4 bytes | 2–4 bytes | full string |
| Add value | DDL | INSERT | DDL |
| Remove value | very hard (multi-step migration) | DELETE | easy ALTER |
| Metadata (label, color, sort order, i18n) | none | full | none |
| Query planner stats | good | can be poor | good |

The set of statuses *is* small and stable today, which favours ENUM. But you'll likely want display metadata (badge colour, sort order, future i18n labels), and you may add `live`, `red_flagged`, `awaiting_confirmation`, `event_moved_online` later — which lookup table handles via a single INSERT vs ENUM's painful "create new type → migrate columns → drop old" dance. **Recommendation: lookup table** with a stable `code` and `display_label`, FK from `round.status_id` and `session.status_id`. Pair it with separate `cancellation_reason TEXT` and `previous_start_date` columns on the row itself.

## 3. Source provenance — last verified, source URL, audit of changes

Two layers: per-row provenance, and a separate append-only change-log.

**Per-row provenance columns** (on `round` and `session`):

```sql
source_id            BIGINT REFERENCES source(id)   -- which feed produced this
source_url           TEXT                            -- the specific URL fetched
source_etag          TEXT                            -- HTTP ETag if available
source_last_modified TIMESTAMPTZ                     -- HTTP Last-Modified header
content_hash         TEXT                            -- SHA-256 of normalized payload
fetched_at           TIMESTAMPTZ                     -- when we last pulled it
verified_at          TIMESTAMPTZ                     -- when we last confirmed it
manual_override      BOOLEAN DEFAULT FALSE           -- "curator beats feed" flag
```

The `verified_at` / `fetched_at` distinction matters because most pulls match the existing hash — you re-verified but didn't ingest a new version. Update `verified_at` on every pull; update `fetched_at` plus `content_hash` only when content actually changes. This is the pattern recommended in scraping pipelines ([ScrapingAnt — Data Quality Layer](https://scrapingant.com/blog/building-a-web-data-quality-layer-deduping-canonicalization), [Tendem — Deduplication](https://tendem.ai/blog/deduplicating-scraped-data-guide)). It's also how AWS HealthOmics models content integrity via ETags ([AWS HealthOmics — ETags and provenance](https://docs.aws.amazon.com/omics/latest/dev/etags-and-provenance.html)).

**`manual_override` is critical for Paddock's "search for missing data" rule** — when you curate a sidecar JSON to compensate for a thin upstream feed, the next cron must not silently re-overwrite your curation. The override flag tells the diff worker "even if the upstream changes, do not touch this row."

A `source` table itself records the inbound feeds:

```sql
source (id, series_id, kind, label, url, parser, schedule_cron,
        is_active, last_success_at, last_failure_at, failure_count)
```

`kind` is one of `ics / json_api / html_scrape / spa_scrape / curated_json`. This becomes important when a feed format changes — you flag `is_active = false` and the cron stops slamming a 500.

## 4. Audit / delta log — "this round was scheduled until X when source Y reported cancellation"

The classic Postgres pattern is the **shadow table + trigger**. ([Cybertec — Row change auditing](https://www.cybertec-postgresql.com/en/row-change-auditing-options-for-postgresql/), [PostgreSQL wiki — Audit trigger](https://wiki.postgresql.org/wiki/Audit_trigger))

**Recommended audit table shape:**

```sql
schedule_change_log (
  id                BIGSERIAL PRIMARY KEY,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  table_name        TEXT NOT NULL,             -- 'round' | 'session'
  row_id            UUID NOT NULL,
  operation         TEXT NOT NULL,             -- 'INSERT' | 'UPDATE' | 'DELETE'
  changed_fields    TEXT[],                    -- which columns moved
  old_values        JSONB,
  new_values        JSONB,
  source_id         BIGINT REFERENCES source(id),
  detected_by       TEXT,                      -- 'cron:f1-ics' | 'manual:paris'
  material          BOOLEAN NOT NULL DEFAULT FALSE,  -- worth alerting?
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       TEXT,
  notes             TEXT
)
```

Notes:

- Store **old + new as `JSONB`**, not flat text. PG 9.2+ best practice — lets you `WHERE old_values->>'status' = 'scheduled' AND new_values->>'status' = 'cancelled'` to query "show me every cancellation in the last 90 days." ([Cybertec audit doc](https://www.cybertec-postgresql.com/en/row-change-auditing-options-for-postgresql/))
- **`clock_timestamp()`** captures the real instant the log row was inserted, not the transaction start — important when one transaction touches many rows.
- **`changed_fields TEXT[]`** lets you quickly answer "rounds whose start time moved" vs "rounds whose status changed."
- **`material` flag** is the human-review gate. The cron computes it from a small rule ("status changed", "start_time moved by >30min", "round added/removed"). Material changes get surfaced for human review before they go live — exactly the "review queue" pattern from CDC literature. ([Confluent — CDC](https://www.confluent.io/learn/change-data-capture/), [Redpanda — CDC fundamentals](https://www.redpanda.com/guides/fundamentals-of-data-engineering-cdc-change-data-capture))
- **Indexing:** `(table_name, row_id, occurred_at DESC)` for "history of one row" queries, plus `(occurred_at DESC) WHERE material = TRUE` partial index for the review dashboard.
- **Partition by `occurred_at` (monthly)** when the table crosses ~50M rows. Premature for Paddock today; revisit when crons run for two years.
- **Security:** Supabase RLS — the production app role should have INSERT-only on `schedule_change_log` and the audit table should be owned by a different role, so a compromised app role cannot rewrite history. ([Cybertec audit](https://www.cybertec-postgresql.com/en/row-change-auditing-options-for-postgresql/))

For the specific use case "this round was scheduled until 2026-03-15 when source X reported it cancelled", the query becomes:

```sql
SELECT occurred_at, old_values->>'status', new_values->>'status', source_id
FROM schedule_change_log
WHERE table_name = 'round' AND row_id = $1 AND 'status' = ANY(changed_fields)
ORDER BY occurred_at;
```

## 5. Schema evolution — keeping the door open for comments / predictions / paddock-coins

The consensus across [Medium — JSONB Secret Weapon](https://medium.com/@richardhightower/jsonb-postgresqls-secret-weapon-for-flexible-data-modeling-cf2f5087168f), [DanLevy.net — JSONB Seduction](https://danlevy.net/the-jsonb-seduction/), and [Tiger Data](https://www.tigerdata.com/learn/postgresql-performance-tuning-designing-and-implementing-database-schema) is a **hybrid model**:

- First-class columns for anything you'll filter / join / index — `status`, `start_time`, `series_id`, `driver_id`.
- `JSONB` only for genuinely variable or extensibility-focused data — per-source raw payload, marketing-flag bags, integration metadata. Add a GIN index if you actually query into it.
- **Decision rule:** if the business keeps asking relational questions about a JSONB key, that field is trying to become a column. Promote it with the **expand-and-contract** migration pattern (add new column, dual-write, backfill, switch reads, drop old).

For future features, plan **separate, additive tables** rather than wider rows:

```sql
comment            (id, user_id, round_id|session_id, body, created_at, ...)
prediction         (id, user_id, session_id, payload JSONB, scored_at, ...)
ledger_entry       (id, user_id, amount, kind, ref_type, ref_id, occurred_at)
push_subscription  (id, user_id, endpoint, keys JSONB, ...)
user_preferences   (user_id PK, prefs JSONB)   -- here JSONB is right
```

`user_preferences` is the textbook good-use of JSONB — fetched by key, application is the canonical interpreter, exact shape evolves. The ledger is the opposite — every column will be queried, none of it goes in JSONB.

## 6. Change-detection on scraped data — content hash + cron + diff

The standard pattern from [ScrapingAnt](https://scrapingant.com/blog/data-deduplication-and-canonicalization-in-scraped), [Tendem](https://tendem.ai/blog/deduplicating-scraped-data-guide), and [Wikipedia — data deduplication](https://en.wikipedia.org/wiki/Data_deduplication):

1. **Cron pulls** each `source` on its schedule.
2. **Normalize** payload before hashing (sort keys, strip whitespace, lowercase, drop volatile fields like server timestamps). Without normalization, identical content produces different hashes.
3. **SHA-256** the normalized payload. (MD5 is faster but collision-prone enough that SHA-256 is the safer default; the cost is negligible at Paddock's scale.)
4. **Compare** to last stored `content_hash` for that `(source_id, resource_key)` tuple.
5. **If unchanged**: update `verified_at`. Skip everything else.
6. **If changed**: parse the new payload, diff against the current canonical row, write a `schedule_change_log` entry per changed field, mark `material = TRUE` if the diff includes status/start_time/round-add-or-remove. Update `content_hash` and `fetched_at`. Do **not** auto-apply the new values to the canonical row when `manual_override = TRUE` or when the change is material and unreviewed.

Side benefit: the rate of "hash unchanged" is a free health signal — a sudden flip to "always changed" means the source restructured its HTML; a sudden flip to "never changed" for weeks means the scraper is silently failing.

## 7. Time handling — TIMESTAMPTZ vs local + IANA tz

The most consequential decision in this schema. Sources agree: TIMESTAMPTZ stores a UTC instant — "with time zone" means timezone-*aware*, not timezone-*stored*. ([Crunchy Data — Working with Time](https://www.crunchydata.com/blog/working-with-time-in-postgres), [DEV — Storing Time Without Lying](https://dev.to/bwi/postgresql-storing-time-without-lying-to-yourself-jb1))

**The decisive distinction is events vs schedules:**
- **Past events** (a race that already happened, a result, a log entry) → `TIMESTAMPTZ` is correct. You want a single unambiguous instant.
- **Future scheduled local times** (a session that's "2026-03-15 14:00 Melbourne") → store the local wall-clock + IANA timezone *separately*. If you only store TIMESTAMPTZ and Australia changes DST rules between now and the event, you cannot recover the original "14:00 Melbourne" intent.

Motorsport schedules cross every situation Paddock encounters: announced in venue-local time, sometimes shifted hours or days before the event, sometimes mid-event (red flags). The robust pattern from [DEV — Storing Time Without Lying](https://dev.to/bwi/postgresql-storing-time-without-lying-to-yourself-jb1) is:

```sql
session (
  ...
  local_start  TIMESTAMP NOT NULL,         -- "14:00 on 2026-03-15"
  time_zone    TEXT NOT NULL,              -- "Australia/Melbourne" (IANA)
  instant_utc  TIMESTAMPTZ NOT NULL,       -- pre-computed for queries
  CHECK (instant_utc = (local_start AT TIME ZONE time_zone))
)
```

Rules:

- **Always IANA names** (`Europe/Monaco`, `America/Sao_Paulo`), never abbreviations (`EST`, `CET`) — abbreviations are ambiguous: `IST` means Israel, Ireland, *and* India depending on who you ask. ([Cybertec — Time zone management](https://www.cybertec-postgresql.com/en/time-zone-management-in-postgresql/))
- **Index `instant_utc`** for "next 10 sessions globally" — the dominant home-page query. Pairs perfectly with `WHERE instant_utc > now() ORDER BY instant_utc LIMIT 10`.
- **Index `(time_zone, local_start)`** for "all sessions at Suzuka this weekend in local time" calendar queries.
- **Recompute `instant_utc`** if `local_start` or `time_zone` changes. Cheap (just an expression). Don't trust client/session timezone — be explicit on insert.
- **Connection setup:** `SET timezone = 'UTC'` at the pool. Don't let app servers in different regions render different values.
- **Pairs with `feedback-paddock-weather-venue-local`** — Open-Meteo queries already key on venue-local date. The `time_zone` column is the authoritative source for those lookups; today's curated JSON files imply it.

`venue` should carry `iana_tz` so sessions inherit it by default (the cron parser fills `session.time_zone = venue.iana_tz` unless the source explicitly overrides). Document this in a column comment.

## 8. Indexing + RLS recommendations for Supabase

Supabase's official guidance ([Supabase — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Makerkit — RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices), [DEV — RLS in production](https://dev.to/whoffagents/supabase-row-level-security-in-production-patterns-that-actually-work-2l78)):

- **Every column referenced in an RLS policy must have an index.** Supabase's own test: 450ms → 45ms with the index. For Paddock most data is publicly readable (`SELECT` policy = `true`), so RLS overhead is low; the discipline matters more for the future `comment`, `prediction`, `ledger` tables.
- **Wrap `auth.uid()` in `SELECT`:** `USING (user_id = (SELECT auth.uid()))` — lets Postgres cache the value via initPlan instead of re-evaluating per row.
- **Write four separate policies (SELECT/INSERT/UPDATE/DELETE), not `FOR ALL`.** Per-operation optimization.
- **Always pair UPDATE policies with SELECT policies** — Postgres reads the row first to evaluate USING.
- **Use `SECURITY DEFINER` functions for subqueries** in policies. Avoids per-row re-execution and prevents recursion errors.

**Indexes for Paddock's known access patterns:**

| Query | Index |
|---|---|
| "next N sessions globally" | `(instant_utc) WHERE status_id = 'scheduled'` partial |
| "next N sessions for series X" | `(series_id, instant_utc) WHERE status_id = 'scheduled'` |
| "current weekend rounds" | `(start_date, end_date)` plus partial `WHERE status_id IN ('scheduled','live')` |
| "championship standings" | `(season_id, points DESC)` covering on `result` |
| "history of one row" (audit) | `(table_name, row_id, occurred_at DESC)` |
| "recent material changes" | `(occurred_at DESC) WHERE material = TRUE` partial |
| FK joins (driver_id, team_id, etc.) | B-tree on each FK column — Postgres does **not** auto-create these |
| JSONB containment on payload | GIN |

Composite-index column ordering rule from [Stormatics](https://stormatics.tech/blogs/optimizing-postgresql-with-composite-and-partial-indexes): equality columns first, then range/sort columns. So `(series_id, instant_utc)` not `(instant_utc, series_id)`.

## 9. Anti-patterns to actively avoid given Paddock's goals

From the combined sources, in order of how badly they'd hurt this project:

1. **Storing only TIMESTAMPTZ for future sessions, dropping the local wall-clock.** You will lose "14:00 Melbourne" the first time Australia changes DST rules. ([DEV — Storing Time Without Lying](https://dev.to/bwi/postgresql-storing-time-without-lying-to-yourself-jb1))
2. **No status column — soft-deleting cancelled events.** Breaks Schema.org compliance, hides cancellations from users, and makes "show me everything that was cancelled this season" a near-impossible query. ([Google — Event status](https://developers.google.com/search/blog/2020/03/new-properties-virtual-or-canceled-events))
3. **No audit table — overwriting rows on every cron pull.** The whole "this round was scheduled until X" capability evaporates. The cron will silently rewrite history every time a source format changes.
4. **No `manual_override` flag.** The next cron blows away every curated sidecar fix. Pairs with the `feedback-paddock-search-for-missing-data` workflow rule.
5. **JSONB-only schema "for flexibility".** Loses query planner stats, makes indexes complicated, pushes validation into scattered application code. ([DanLevy.net](https://danlevy.net/the-jsonb-seduction/))
6. **ENUM for `status` then trying to remove a value later.** Postgres has no `ALTER TYPE DROP VALUE`; you'd run a multi-step migration that touches every row. Lookup table instead. ([Cybertec — Lookup vs enum](https://www.cybertec-postgresql.com/en/lookup-table-or-enum-type/))
7. **Timezone abbreviations** in any column. Use IANA names exclusively.
8. **`SERIAL` (4-byte) PK on the audit table.** Will exhaust in production. `BIGSERIAL` or UUID v7.
9. **`FOR ALL` RLS policies.** Worse query plans than four per-operation policies.
10. **Missing FK indexes.** Postgres does not create them automatically; missing them turns child-side joins into seq scans. ([Heroku — PG indexes](https://devcenter.heroku.com/articles/postgresql-indexes))

## 10. Recommended next step for Paddock

Actionable, in order, for the schema-draft session:

- **Draft the core 8 tables first** (`series`, `season`, `round`, `session`, `result`, `venue`, `driver`, `team`) with `slug` columns and FK relationships. Skip every nice-to-have (comments, predictions, ledger) until these compile.
- **Pick the time model now and write it in a column comment**: `session.local_start TIMESTAMP + time_zone TEXT + instant_utc TIMESTAMPTZ` (computed), with a `CHECK` constraint tying them together.
- **Use a `status` lookup table**, not an ENUM. Seed with `scheduled / cancelled / postponed / rescheduled / live / completed / tbc / moved_online`. Add `display_label`, `badge_colour`, `sort_order` columns now — you'll want them on day one.
- **Add the provenance column set** (`source_id`, `source_url`, `source_etag`, `content_hash`, `fetched_at`, `verified_at`, `manual_override`) to `round` and `session` in v1, not as a v2 retrofit. This is the column set that makes the diff worker possible.
- **Create the `schedule_change_log` audit table** alongside the canonical tables. Trigger-driven, JSONB old/new, `material` flag, no partitioning until you actually need it. Owned by a non-app role so the app cannot rewrite history.
- **Prototype one cron end-to-end** before draughting the rest of the schema — pick F1 ICS (already in tree) and walk it from fetch → hash → diff → audit-log → human-review surface. The schema for `source`, the diff worker, and the review queue will all need each other; build them together.
- **Index `instant_utc` (partial, status='scheduled')` first**. It's the home-page query. Add others only when EXPLAIN ANALYZE shows you need them.
- **Use UUID v7** (`gen_random_uuid()` for now, then migrate to a UUID v7 generator) for the high-write tables (`schedule_change_log`, `session`); UUID v4 is fine elsewhere. ([Supabase blog](https://supabase.com/blog/choosing-a-postgres-primary-key))
- **Plan RLS as "public read, authenticated write" from day one.** Even before write surfaces ship, set the default `USING (true)` for SELECT on schedule tables and lock down everything else. Easier than retrofitting.
- **Migration discipline:** numbered SQL files, `IF NOT EXISTS` everywhere, additive-only changes once a table has been seeded. Drop/rename via expand-and-contract.

## Sources

- [Designing a Sports Tournament Data Model for PostgreSQL — Datensen](https://www.datensen.com/blog/data-model/designing-a-sports-tournament-data-model/)
- [PostgreSQL Tuning: Database Schema Design — Tiger Data](https://www.tigerdata.com/learn/postgresql-performance-tuning-designing-and-implementing-database-schema)
- [F1DB — Open Source Formula 1 Database (GitHub)](https://github.com/f1db/f1db)
- [F1 race inspired database project — Medium](https://mahirahamzah.medium.com/f1-race-inspired-database-project-2e3227bb92da)
- [What is better: a lookup table or an enum type? — Cybertec](https://www.cybertec-postgresql.com/en/lookup-table-or-enum-type/)
- [Enums vs Check Constraints in Postgres — Crunchy Data](https://www.crunchydata.com/blog/enums-vs-check-constraints-in-postgres)
- [Managing Enums in Postgres — Supabase Docs](https://supabase.com/docs/guides/database/postgres/enums)
- [Row change auditing options for PostgreSQL — Cybertec](https://www.cybertec-postgresql.com/en/row-change-auditing-options-for-postgresql/)
- [Audit trigger — PostgreSQL wiki](https://wiki.postgresql.org/wiki/Audit_trigger)
- [What Is Audit Logging and How to Enable It in PostgreSQL — Tiger Data](https://www.tigerdata.com/learn/what-is-audit-logging-and-how-to-enable-it-in-postgresql)
- [The Ultimate Guide to PostgreSQL Data Change Tracking — Bemi](https://blog.bemi.io/the-ultimate-guide-to-postgresql-data-change-tracking/)
- [PostgreSQL — Storing Time Without Lying to Yourself (DEV)](https://dev.to/bwi/postgresql-storing-time-without-lying-to-yourself-jb1)
- [Working with Time in Postgres — Crunchy Data](https://www.crunchydata.com/blog/working-with-time-in-postgres)
- [Time zone management in PostgreSQL — Cybertec](https://www.cybertec-postgresql.com/en/time-zone-management-in-postgresql/)
- [Row Level Security — Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Row Level Security in Production: Patterns That Actually Work — DEV](https://dev.to/whoffagents/supabase-row-level-security-in-production-patterns-that-actually-work-2l78)
- [Supabase RLS Best Practices — Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [JSONB: PostgreSQL's Secret Weapon — Medium](https://medium.com/@richardhightower/jsonb-postgresqls-secret-weapon-for-flexible-data-modeling-cf2f5087168f)
- [JSONB: The Best Way to Ruin Your Database — DanLevy.net](https://danlevy.net/the-jsonb-seduction/)
- [Optimizing PostgreSQL with Composite and Partial Indexes — Stormatics](https://stormatics.tech/blogs/optimizing-postgresql-with-composite-and-partial-indexes)
- [Efficient Use of PostgreSQL Indexes — Heroku Dev Center](https://devcenter.heroku.com/articles/postgresql-indexes)
- [PostgreSQL Documentation: Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [Data Deduplication and Canonicalization in Scraped Knowledge Graphs — ScrapingAnt](https://scrapingant.com/blog/data-deduplication-and-canonicalization-in-scraped)
- [Building a Web Data Quality Layer — ScrapingAnt](https://scrapingant.com/blog/building-a-web-data-quality-layer-deduping-canonicalization)
- [Deduplicating Scraped Data: How to Find & Merge Duplicates — Tendem](https://tendem.ai/blog/deduplicating-scraped-data-guide)
- [Data deduplication — Wikipedia](https://en.wikipedia.org/wiki/Data_deduplication)
- [HealthOmics ETags and data provenance — AWS](https://docs.aws.amazon.com/omics/latest/dev/etags-and-provenance.html)
- [What is Data Provenance? — IBM](https://www.ibm.com/think/topics/data-provenance)
- [eventStatus Schema Field: Format and Examples — Karpi](https://www.karpi.studio/schema-glossary-terms/event-status)
- [New properties for virtual, postponed, and canceled events — Google Search Central](https://developers.google.com/search/blog/2020/03/new-properties-virtual-or-canceled-events)
- [Update your canceled or postponed events with Schema — Yoast](https://yoast.com/update-your-events-with-schema/)
- [Deleting data: soft, hard or audit? — Marty Friedel](https://www.martyfriedel.com/blog/deleting-data-soft-hard-or-audit)
- [Slowly Changing Dimensions in Postgres — Marc Linster (Medium)](https://marclinster.medium.com/slowly-changing-dimensions-in-postgres-7d0f4cac2191)
- [Slowly Changing Dimension — Wikipedia](https://en.wikipedia.org/wiki/Slowly_changing_dimension)
- [Choosing a Postgres Primary Key — Supabase blog](https://supabase.com/blog/choosing-a-postgres-primary-key)
- [Database ID Design — DEV](https://dev.to/pipipi-dev/database-id-design-choosing-id-methods-and-primary-key-strategies-49h4)
- [uuid-ossp: Unique Identifiers — Supabase Docs](https://supabase.com/docs/guides/database/extensions/uuid-ossp)
- [CDC (change data capture) — Redpanda](https://www.redpanda.com/guides/fundamentals-of-data-engineering-cdc-change-data-capture)
- [What Is Change Data Capture (CDC)? — Confluent](https://www.confluent.io/learn/change-data-capture/)
- [PostgreSQL Documentation: Range Types](https://www.postgresql.org/docs/current/rangetypes.html)
- [Temporal Constraints in PostgreSQL 18 — Better Stack](https://betterstack.com/community/guides/databases/postgres-temporal-constraints/)
- [SQL2011Temporal — PostgreSQL wiki](https://wiki.postgresql.org/wiki/SQL2011Temporal)
