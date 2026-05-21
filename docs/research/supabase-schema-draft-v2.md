# Supabase schema — v2 (the "don't migrate yet" review)

**Date:** 2026-05-21
**Status:** review memo on top of `supabase-schema-draft.md` (v1, 2026-05-18, 774 lines)
**Author:** Claude (after the external SEO + DB brief landed)

## Why this doc exists

The v1 draft is a full replacement of the `content/series/<slug>/*.json` authoring model with ~20 Postgres tables, written pre-Fotis sit-down. It's a competent schema. The reason it hasn't been executed yet isn't that it's wrong — it's that **the case for migrating right now hasn't been made**, and an external AI brief just reactivated the conversation under the framing "app is slow → I want Supabase". That framing is the wrong causal chain. This memo lays out the case for **doing less, later, and additively** instead.

The recommendation up front:

1. Don't execute the v1 schema as written. It's a full replacement, not an additive layer.
2. Don't add Supabase at all until at least one of three triggers fires (§4).
3. When the triggers do fire, add **a lean 5-7 table user-data schema** (§5) that sits alongside the existing JSON authoring model, not in place of it.
4. Keep v1 as the reference for the eventual full-migration session — its session/round/result modelling is good, just not load-bearing today.

## 1. The "app is slow" diagnosis

Per `docs/perf-baselines.md` (captured 2026-05-19, snapshot of pre-B-perf state):

| Metric | Mobile current | Target | Gap |
|---|---|---|---|
| RES (field) | 76 | 90 | 14 pts |
| LCP (field) | 3.67 s | 2.5 s | 1.17 s |
| **TTFB (field)** | **3.17 s** | **0.8 s** | **2.37 s — biggest lever** |
| CLS (field) | 0.11 | 0.1 | marginal |
| INP (field) | 80 ms | <200 ms | passing |

Unused JS breakdown from the same snapshot — **616 KiB** total:

- Clerk SDK: 224 KiB (36%)
- AdSense: 157 KiB (26%)
- Funding Choices (CMP — now removed since 0.12.6): 98 KiB (16%)
- Google Tag Manager: 64 KiB (10%)
- Other 1st-party chunks: 73 KiB (12%)

**Three Google scripts + Clerk together account for 88% of the unused-JS budget.** Adding a database doesn't reduce any of that. The mobile TTFB 3.17 s — biggest single number to attack — points at server-rendering cost on the home shell + JS hydration cost, not at data-layer fan-out.

Cross-ref `IDEAS.md` Now #1: **"B-perf execution (Wed 2026-05-20). Multi-PR mobile-perf push."** Already scoped to 4 PRs targeting Clerk lazy-load + 3rd-party deferral + preconnect Clerk subdomain + CSS critical-path. That's the answer to "app is slow", not a DB migration.

If after B-perf the perf baseline still shows poor mobile numbers, the next investigation is the **per-request live-API fan-out** (calendar page calls jolpica for F1, Pulselive for MotoGP, fiawec.com SSR scrape for WEC, racing-reference for NASCAR, etc — and the synchronous render path means slow on a cold cache). The fix for that is **expand Vercel KV caching to wrap every external fetch**, not migrate to Postgres. KV is already in use (per `CHANGELOG.md` 0.11.7 — F2/F3 results KV cache + parallel fan-out), and the pattern is well-trodden.

Postgres caching of API responses would technically work but adds: schema + migrations + provenance columns + idempotency keys + a cron worker + RLS policies. KV adds: one wrapper function. Pick KV.

## 2. What Supabase actually unlocks for Paddock

Strip away the framing and the real value of Supabase is in three things:

1. **Relational queries that KV can't do.** "All drivers who finished P1 in 2025 across every series I follow" — KV can't JOIN. Postgres can.
2. **Persistent user state with auth.** Followed series, followed drivers, comment threads, prediction state, paddock-coins ledger. KV could do this but writes scale per-key not per-user, and concurrency models around comments + predictions are easier in Postgres.
3. **An admin UI surface.** The current model is "Claude edits files in `content/`, commits, deploys" (per `CLAUDE.md`). When Fotis is contributing — or when you want to grant any future contributor write access without giving them git push — Supabase + a tiny admin UI replaces the conversational-authoring flow with a proper UI.

None of these are blocking the next 2-3 months of work. Per `IDEAS.md` and `docs/HANDOFF.md`:

- **S9 race-weekend Part 2** (comments + predictions + leaderboard) — the one feature bundle where Supabase becomes load-bearing. Currently parked behind S4 (Supabase) but the dependency is actually backwards: S9 should kick off the lean schema, not the full v1.
- **0.13.0 drivers.json bulk** — pure content work, no DB needed.
- **0.14.0 histories + Moto2/3** — pure content work, no DB needed.
- **B-perf + B-content** — pure perf + content, no DB needed.

The first feature that genuinely cannot ship without Postgres is **comments** — KV-based comment threading is possible but ugly (you'd K/V each comment under `comment:<weekend>:<id>`, then maintain a sorted-set index `comment-index:<weekend>` with per-add ZADD, and pagination becomes painful). Predictions are similar but tractable; the leaderboard makes everything painful without `ORDER BY points DESC LIMIT 100`.

## 3. The case against migrating the JSON authoring model

The v1 schema replaces `content/series/<slug>/meta.json`, `rounds.json`, `sessions.json`, `drivers.json`, `champions.json`, etc with `series`, `season`, `round`, `session`, `driver`, `team`, `standings_snapshot`, plus a `schedule_change_log` audit trail. This is a **net loss** for Paddock as it stands today. Reasons:

**1. Git as the audit trail is already perfect.** Every `content/series/<slug>/sessions.json` edit is a real commit. `git log --follow content/series/f1/sessions.json` answers "what changed and when". The v1 design's `schedule_change_log` table re-implements this in Postgres, plus a UI to view it, plus a retention policy to manage, plus indexes to query it. The git version is free and already there.

**2. Conversational editing is the differentiator.** Per `CLAUDE.md`: "Authoring model is conversational, not an admin UI. Edits to `content/**/*` are real commits that ship to production within ~90s." Moving to DB tables loses this. You'd be back to "open Supabase Studio, navigate to the row, edit the field, click Save" — which is exactly the workflow that motorsport.com / raceweek.io / motorsportscalendar.com use, and exactly the workflow Paddock's authoring model is designed AS A DELIBERATE ALTERNATIVE TO.

**3. Reviewability collapses.** Today a curation patch is "this PR adds 2026 Bahrain back to F1 rounds.json with reschedule notes" — visible in a diff, code-reviewable, revertable. A DB-edit equivalent is "I clicked Save on a row in Supabase Studio" — no diff, no PR, no review. Single-contributor today, but the moment Fotis (or anyone else) is editing data, you want reviewability.

**4. The crons get harder, not easier.** v1 §15 proposes that crons UPDATE the same tables as the manual curation, gated by a `manual_override` flag, and emit a `schedule_change_log` row per attempted UPDATE. That's: race conditions, flag-bypass bugs, manual_override drift, and an audit table that fills with noise. The current pattern is simpler — crons write to KV with TTLs, curated JSON files are the source of truth, the rendering layer prefers curated over live.

**5. The schema's own §13 ("Out of scope") is a tell.** "Live in-race data — separate `live_session_data` table, partitioned by date, written by a different worker. Probably TimescaleDB hypertable." That's the case where you actually need a DB — high-frequency time-series writes. The static schedule data this v1 schema models isn't that case.

The v1 schema would be the right schema **if Paddock were going to grow into a multi-author SaaS with a real admin UI and Wikipedia-style edit history**. That's not what Paddock is. Paddock is "Claude + Paris + Fotis edit files; the rendering layer turns them into a site". Supabase doesn't fit that authoring model — and dressing up the conversational model in a DB-backed admin UI is solving a problem we don't have.

## 4. Concrete triggers for revisiting

Don't migrate until at least one of these fires:

1. **A second author needs write access who isn't on the git push allowlist.** Today Paris + Claude push directly; Fotis goes via PR (per `CONTRIBUTING.md`). If a third contributor lands who needs write access but not git push, that's a real trigger.
2. **S9 (race-weekend Part 2) starts.** Comments + predictions + paddock-coins ledger require a relational DB. That's the natural moment to provision Supabase — start with the user-data tables (§5 below), expand the schedule tables only when needed.
3. **B-perf shipped + measured + diagnosed live-API fan-out as the residual bottleneck.** Even then, KV-wrapping every fetch is the first intervention, and only if KV bumps into its own limits (cardinality, TTL bookkeeping, cross-key consistency) is Postgres the second one.
4. **Paddock data becomes a product asset others want.** If a third-party site / aggregator wants to consume `paddock-tracker.com/api/...`, a relational DB makes the API easier to scope, version, and rate-limit. Today nobody's asking.

None of these have fired. Don't fire them prematurely.

## 5. The lean schema (when one of §4's triggers fires)

When the first trigger fires — most likely S9 — provision Supabase and ship this lean shape, **not the v1 schema**. The principle is **additive, not replacement**: every existing JSON file stays the source of truth for its data; Postgres only holds data that has no current home.

### 5.1 Tables (7 total, ordered by ship-time)

```
-- Auth integration. Clerk owns identity; Paddock owns app-level user state.
-- No mirror of Clerk's user table — store the Clerk subject (user.id) directly
-- on every user-scoped row. Mirroring adds webhook complexity for marginal
-- query convenience; skip until a real admin view needs JOINs on email/name.

user_followed_series (
  user_id      TEXT NOT NULL,           -- Clerk user.id
  series_slug  TEXT NOT NULL,           -- 'f1', 'motogp', etc — matches content/series/<slug>/
  followed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, series_slug)
);

user_followed_drivers (
  user_id      TEXT NOT NULL,
  driver_slug  TEXT NOT NULL,           -- matches content/series/<slug>/drivers.json
  series_slug  TEXT NOT NULL,           -- denormalized for query convenience
  followed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, driver_slug)
);

user_preferences (
  user_id      TEXT PRIMARY KEY,
  timezone     TEXT,                    -- IANA, e.g. 'Europe/Athens' — overrides browser detection
  theme        TEXT,                    -- 'light' | 'dark' | NULL (system default)
  locale       TEXT,                    -- reserved for when /el ships
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- S9 tables: comments + predictions + paddock-coins.

comment (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      TEXT NOT NULL,           -- Clerk subject
  weekend_key  TEXT NOT NULL,           -- 'f1:2026:5' (series:season:round) — stable URL ref
  body         TEXT NOT NULL,
  parent_id    BIGINT REFERENCES comment(id) ON DELETE CASCADE,  -- threading
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at    TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ              -- soft delete, preserves thread shape
);

prediction (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      TEXT NOT NULL,
  session_key  TEXT NOT NULL,           -- 'f1:2026:5:race' — series:season:round:session
  payload      JSONB NOT NULL,          -- { p1: 'verstappen', p2: 'leclerc', p3: 'norris', fastest_lap: 'hamilton' }
  state        TEXT NOT NULL,           -- 'open' | 'locked' | 'resolved'
  resolved_payload JSONB,                -- the actual result + per-line scoring (only populated when state='resolved')
  score        INTEGER,                 -- aggregate points (computed at resolution)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

ledger_entry (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      TEXT NOT NULL,
  kind         TEXT NOT NULL,           -- 'prediction-correct' | 'comment-upvote' | 'manual-grant' | etc
  delta        INTEGER NOT NULL,        -- signed paddock-coin change
  ref_kind     TEXT,                    -- 'prediction' | 'comment' | NULL
  ref_id       BIGINT,                  -- foreign key to whichever table 'ref_kind' names
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

push_subscription (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      TEXT NOT NULL,
  endpoint     TEXT NOT NULL UNIQUE,    -- VAPID endpoint
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,                    -- for the Settings "Your devices" list
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
```

7 tables total. Compare to v1's ~20. The schedule (series / season / round / session / result / driver / team / venue) stays in the curated JSON files; Postgres only carries user-scoped state.

### 5.2 What I deliberately left out and why

- **No `series` / `season` / `round` / `session` / `result` tables.** These exist as JSON files today. The user-data tables reference them by string key (`series_slug`, `weekend_key`, `session_key`) — those keys are stable enough that no FK is needed. A migration runs as a one-time string update, not a schema change.
- **No `driver` / `team` table.** Same reasoning. `content/series/<slug>/drivers.json` is the source. The `user_followed_drivers` table stores `driver_slug` as a string reference.
- **No `schedule_change_log` audit table.** Git history already does this for the JSON files. For the user-data tables, Postgres temporal extensions (or a simple `_history` table per actor table) can be added if S9 raises a real audit requirement.
- **No `standings_snapshot` table.** Standings are computed at render time from the parsers in `lib/standings/<slug>.ts`. No DB cache needed.
- **No `data_sources` / `sync_runs` lookup tables.** Crons run today against KV; the metadata about "where did this come from" lives in code comments + the parser's source URL constant.
- **No status / source / circuit_layout lookup tables.** YAGNI until we know we need them.
- **No `contact_submission`.** Resend handles delivery; we already store contact submissions in KV with 12-month TTL (per `0.10.25`).

### 5.3 Clerk JWT integration

The pattern is well-trodden. Skip mirroring Clerk users into Postgres until you specifically need to JOIN on email/name. Until then:

```sql
-- Read the Clerk user.id directly from the JWT in RLS policies.
CREATE POLICY "users own their preferences"
ON user_preferences
FOR ALL
USING (user_id = auth.jwt() ->> 'sub')
WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "users see all comments, write their own"
ON comment
FOR SELECT
USING (deleted_at IS NULL);

CREATE POLICY "users insert their own comments"
ON comment
FOR INSERT
WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "users update / soft-delete only their own comments"
ON comment
FOR UPDATE
USING (user_id = auth.jwt() ->> 'sub')
WITH CHECK (user_id = auth.jwt() ->> 'sub');
```

`auth.jwt() ->> 'sub'` returns the Clerk user.id directly when Supabase's JWT secret is configured to match Clerk's JWT template. Standard Clerk + Supabase integration; no shim needed.

### 5.4 RLS posture

- **`user_preferences`, `user_followed_*`, `prediction`, `ledger_entry`, `push_subscription`** — strict per-user RLS (USING + WITH CHECK both gated on `user_id = auth.jwt() ->> 'sub'`).
- **`comment`** — read = public (excluding soft-deleted), insert/update = owner only.
- **`ledger_entry`** — read = owner only (privacy: paddock-coin balance is per-user, not public).
- **All tables RLS-enabled from day one.** Don't ship a table without an explicit policy; default-deny is the correct posture.

### 5.5 Indexes

Add only when `EXPLAIN ANALYZE` shows you need them. Pre-emptive bets:

```sql
CREATE INDEX idx_followed_series_user   ON user_followed_series (user_id);
CREATE INDEX idx_followed_drivers_user  ON user_followed_drivers (user_id);
CREATE INDEX idx_comment_weekend        ON comment (weekend_key, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_prediction_session     ON prediction (session_key, state);
CREATE INDEX idx_prediction_user        ON prediction (user_id, created_at DESC);
CREATE INDEX idx_ledger_user            ON ledger_entry (user_id, occurred_at DESC);
CREATE INDEX idx_push_user              ON push_subscription (user_id);
```

## 6. Three principles for whenever this lands

Lifted verbatim from v1 because they're correct and don't depend on table count:

1. **Time storage** — always `TIMESTAMP WITH TIME ZONE` in UTC, never local times. Render in venue-local at the edge.
2. **Stable slugs** — `series_slug`, `driver_slug`, `weekend_key`, `session_key` are public-facing strings that must never be renamed. If renaming is unavoidable, add a `slug_redirect` table (mapping old → new) before the rename, not after.
3. **Soft state, not soft delete** — `comment.deleted_at` and `prediction.state` enums beat row deletion. The data shapes are public enough that history matters.

## 7. Open questions before any code

These are the questions worth answering before a single migration runs — not the v1 doc's 10 questions, just the ones that matter for the lean shape:

1. **Cron-driven moderation of comments — needed at v1 or post-launch?** If you ship comments to authenticated-only users, the abuse surface is tiny (Clerk + email verification gate it). If anonymous, you need rate limiting + automated moderation + manual review queue, which dramatically inflates scope.
2. **Prediction scoring formula.** F1 podium-correct = X pts, exact-order = Y pts, fastest-lap-correct = Z pts. Locked rule at session-start; resolution at session-end. Not a schema concern but a "before-code" decision.
3. **Push subscription dedup by user_id or by endpoint?** Today KV stores one subscription per endpoint regardless of user (anonymous PWA installs). Migration to per-user storage requires a Clerk login wall on notifications — operator decision.
4. **Ledger immutability vs adjustments.** If a paddock-coin entry needs to be reversed (e.g. a prediction was scored against the wrong result), do we delete the row or add a compensating-entry row? Standard accounting answer: compensating entry, never delete. Confirms the design but worth saying out loud.
5. **Should `user_preferences` reach for application-level cache (KV) or always hit Postgres?** Reads-on-every-page-load × N concurrent users is real. Probably KV-cache the row keyed by user_id with a 5-minute TTL + invalidate on write.

## 8. What v1 still gets right (preserve for the eventual full-migration session)

If/when one of the §4 triggers other than S9 fires — specifically the multi-author-write-access trigger or the data-becomes-a-product-asset trigger — the v1 schema's modelling is largely correct and worth re-reading. In particular:

- §3 (status lookup table > ENUM) — correct.
- §5 (provenance columns: `fetched_at`, `verified_at`, `content_hash`, `source_id`, `manual_override`) — correct shape for any DB-backed scrape store.
- §7 (round as unit of identity, with `cancelled` as a status not a deletion) — correct.
- §8 (session as unit of time, kinds enumerated) — correct.
- §10 (`schedule_change_log` with `material BOOLEAN` flag) — overkill today, correct for a multi-author future.

The v1 doc isn't wrong; it's premature. Don't delete it.

## 9. Recommendation summary

| Decision | Recommendation |
|---|---|
| Migrate the schedule data (series/round/session/result) to Postgres now? | **No.** Stay on curated JSON + KV. |
| Add Supabase for user data when S9 starts? | **Yes.** §5 lean shape, 7 tables, additive only. |
| Use the v1 schema as the v1 ship? | **No.** Keep it as a reference for the eventual full-migration session, after the §4 triggers fire. |
| Will Supabase make the app faster? | **No.** B-perf (Clerk lazy + 3rd-party defer + preconnect + CSS critical-path) is the answer to slowness. KV-wrap external fetches if API fan-out is the residual bottleneck after that. |
| Switch Oracle → Supabase for Paddock? | **Yes if Supabase ships.** Postgres + Clerk + JWT + Next.js is the natural stack. Keep Oracle for the day job (Vehix / SKGT). |
| Mirror Clerk users into Postgres on day one? | **No.** Reference Clerk subject directly via `auth.jwt() ->> 'sub'`. Add a mirror table only when admin views need JOINs on email/name. |

## 10. Cross-refs

- `docs/research/supabase-schema-draft.md` — v1, 774 lines. The full-replacement schema. Reference, not roadmap.
- `docs/research/db-best-practices.md` — Postgres / Supabase patterns. Still applies; v2 builds on the same patterns just for fewer tables.
- `docs/research/per-series-source-audit.md` — inbound feeds + scrape strategies. Unchanged.
- `docs/perf-baselines.md` — the actual diagnosis of "app is slow". Read before any DB conversation.
- `CLAUDE.md` — authoring model rationale + landmines. The conversational-edits-as-source-of-truth model is the architectural choice this memo defends.
- `IDEAS.md` Now #1 (B-perf) and Now #2 (Fotis Supabase sit-down) — the active workstreams this memo recommends sequencing.
