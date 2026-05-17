# Supabase schema draft for Paddock

> Draft DDL + design decisions for the Postgres / Supabase migration. Ready for the Tuesday 2026-05-19 Fotis sit-down. Builds on `docs/research/db-best-practices.md` (the patterns) and `docs/research/per-series-source-audit.md` (the inbound feeds).

## Scope

This document is **a complete v1 schema we can `psql -f` into a fresh Supabase project** plus the design rationale for each non-obvious decision. Goals:

- **Replace `content/series/<slug>/*.json` as the source of truth** for sessions / rounds / results / standings / drivers / teams / venues, while preserving the conversational authoring model (curated overrides flagged + protected from cron overwrite).
- **Make every scrape diffable + auditable.** Every cron pull writes provenance (`fetched_at`, `verified_at`, `content_hash`) and every material change writes an audit row.
- **Keep the door open for** comments, predictions, paddock-coins ledger, push-device list, per-user preferences — without bloating the canonical tables.
- **Public read, authenticated write** by default. RLS configured from day one.

Out of scope for v1 (logged in section 13):
- Live in-race telemetry (sector splits, lap-by-lap) — separate sink, probably TimescaleDB hypertable later.
- Real-time row sync via Supabase Realtime — schema-neutral, can layer in after.
- Migration script from the current JSON files to the new tables — that's a v1.5 doc.

## 1. Core entity hierarchy

```
series ── season ── round ── session ── result
                                 │
                                 └── venue ── circuit_layout
                                 
driver ── season_entry ── team   ── season ── round
                              
status  (lookup, FK from round + session)
source  (lookup, FK from round + session + audit)
```

8 canonical tables: `series`, `season`, `round`, `session`, `result`, `venue`, `driver`, `team`. Plus 4 supporting: `status`, `source`, `season_entry`, `circuit_layout`. Plus 1 audit: `schedule_change_log`.

## 2. Extensions + database-level setup

```sql
-- Run once per project. Most are Supabase defaults.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";      -- case-insensitive lookups on slugs

-- All app code assumes the pool runs in UTC. Render in venue-local at the edge.
ALTER DATABASE postgres SET timezone = 'UTC';
```

UUID v7 is the long-term aim per the research doc (k-sortable, better index locality on high-write tables), but Postgres doesn't ship a v7 generator yet. `gen_random_uuid()` (v4) is fine for v1; swap to a v7 helper when one lands in Supabase or via `uuid-ossp`.

## 3. Status lookup

Chosen over ENUM so we can add `live` / `red_flagged` / `awaiting_confirmation` without DDL pain, and so display metadata (badge colour, sort order) lives next to the code.

```sql
CREATE TABLE status (
  code             TEXT PRIMARY KEY,
  display_label    TEXT NOT NULL,
  badge_colour     TEXT NOT NULL,                  -- hex without '#'
  sort_order       SMALLINT NOT NULL,
  is_terminal      BOOLEAN NOT NULL DEFAULT FALSE, -- 'completed' / 'cancelled' don't transition
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO status (code, display_label, badge_colour, sort_order, is_terminal) VALUES
  ('tbc',            'TBC',            '6b7280',  10, FALSE),
  ('scheduled',      'Scheduled',      '3b82f6',  20, FALSE),
  ('live',           'Live',           'ef4444',  30, FALSE),
  ('postponed',      'Postponed',      'f59e0b',  40, FALSE),
  ('rescheduled',    'Rescheduled',    'f59e0b',  50, FALSE),
  ('moved_online',   'Moved online',   '8b5cf6',  60, FALSE),
  ('cancelled',      'Cancelled',      'dc2626',  70, TRUE),
  ('completed',      'Completed',      '10b981',  80, TRUE),
  ('red_flagged',    'Red flagged',    'dc2626',  35, FALSE);
```

**Why `code` is the PK, not an `id`:** the code is stable, human-readable, exported into URLs / JSON-LD / Schema.org mappings. Using a surrogate `id` here would force every consumer to join. The downside (renaming a code) is rare and addressable via an UPDATE … CASCADE alternative pattern.

**Schema.org alignment:** `scheduled` → `EventScheduled`, `cancelled` → `EventCancelled`, `postponed` → `EventPostponed`, `rescheduled` → `EventRescheduled`, `moved_online` → `EventMovedOnline`.

## 4. Source lookup

```sql
CREATE TABLE source (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                CITEXT UNIQUE NOT NULL,           -- 'fia-formula1-ics', 'jolpica-f1-api', 'motogp-pulselive'
  series_slug         CITEXT,                            -- optional scoping; NULL = multi-series source
  kind                TEXT NOT NULL
    CHECK (kind IN ('ics', 'json_api', 'html_scrape', 'spa_scrape', 'curated_json', 'manual')),
  label               TEXT NOT NULL,
  url                 TEXT,                              -- canonical URL (per-fetch URLs live on the row using the source)
  parser              TEXT,                              -- which lib/ingest/<parser>.ts handles it
  schedule_cron       TEXT,                              -- crontab expression for the cron pulling this source
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  last_success_at     TIMESTAMPTZ,
  last_failure_at     TIMESTAMPTZ,
  failure_count       INTEGER NOT NULL DEFAULT 0,
  last_failure_error  TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_source_active ON source (is_active, slug) WHERE is_active = TRUE;
```

`kind = 'manual'` covers a row that was entered by hand without a feed — the equivalent of today's curated JSON files when the upstream feed is too thin.

## 5. Provenance columns (reused on multiple tables)

These six columns appear on every table that holds scraped or curated content. Rationale in `db-best-practices.md` §3 + §6.

```sql
-- Conceptual column-set; written per table below
source_id          UUID REFERENCES source(id) ON DELETE SET NULL,
source_url         TEXT,                             -- the URL fetched for this specific row
source_etag        TEXT,                             -- HTTP ETag if available
content_hash       TEXT,                             -- SHA-256 of normalised payload (lowercase, sorted keys, trimmed)
fetched_at         TIMESTAMPTZ,                      -- last time we pulled the source
verified_at        TIMESTAMPTZ,                      -- last time we confirmed unchanged
manual_override    BOOLEAN NOT NULL DEFAULT FALSE,   -- curator beats feed
```

**Why `manual_override` is mandatory on day one:** Paddock's `feedback-paddock-search-for-missing-data` workflow has Claude curating sidecar JSON whenever the upstream is thin. Without this flag, the next cron silently re-overwrites every fix. The flag tells the diff worker "even if the upstream payload changes, do not touch this row."

## 6. Series, season, venue, driver, team

```sql
CREATE TABLE series (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT UNIQUE NOT NULL,             -- 'f1', 'motogp', 'wec', ...
  name            TEXT NOT NULL,                      -- 'Formula 1', 'FIA WEC'
  governing_body  TEXT,                               -- 'FIA', 'IndyCar Series', 'NASCAR'
  color_hex       TEXT NOT NULL,                      -- '#e10600' — series accent (matches meta.json)
  category        TEXT NOT NULL
    CHECK (category IN ('formula', 'motorcycle', 'endurance', 'rally', 'gt', 'stock_car', 'oval')),
  wikipedia_page  TEXT,
  official_site   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE season (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id     UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  year          SMALLINT NOT NULL,
  start_date    DATE,
  end_date      DATE,
  season_page   TEXT,                               -- Wikipedia "2026 FIA F1 Championship" URL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (series_id, year)
);

CREATE TABLE venue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT UNIQUE NOT NULL,           -- 'spa-francorchamps', 'circuit-de-monaco'
  name            TEXT NOT NULL,                    -- 'Circuit de Spa-Francorchamps'
  country         TEXT,                             -- ISO 3166-1 alpha-2 (BE, MC, etc.)
  city            TEXT,
  lat             NUMERIC(8, 5) NOT NULL,
  lon             NUMERIC(8, 5) NOT NULL,
  iana_tz         TEXT NOT NULL,                    -- 'Europe/Brussels' — authoritative source for session.time_zone defaults
  wikipedia_page  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN venue.iana_tz IS
  'Always IANA name (Europe/Monaco, never CET). session.time_zone inherits this by default; explicit override only when an event runs in a different TZ.';

CREATE TABLE circuit_layout (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        UUID NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  name            TEXT,                             -- 'Grand Prix Circuit', 'Indianapolis Road Course'
  length_km       NUMERIC(5, 3),
  turns           SMALLINT,
  effective_from  DATE NOT NULL,
  effective_to    DATE,                             -- NULL = current
  notes           TEXT
);
CREATE INDEX idx_circuit_layout_active ON circuit_layout (venue_id, effective_to);

CREATE TABLE driver (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT UNIQUE NOT NULL,           -- 'max-verstappen'
  full_name       TEXT NOT NULL,
  short_name      TEXT,                             -- 'VER'
  nationality     TEXT,                             -- ISO 3166-1 alpha-2
  date_of_birth   DATE,
  wikipedia_page  TEXT,
  photo_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT UNIQUE NOT NULL,           -- 'red-bull-racing'
  name            TEXT NOT NULL,                    -- 'Red Bull Racing'
  short_name      TEXT,                             -- 'RBR'
  base_country    TEXT,                             -- ISO 3166-1 alpha-2
  principal       TEXT,
  wikipedia_page  TEXT,
  logo_url        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE season_entry (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     UUID NOT NULL REFERENCES season(id) ON DELETE CASCADE,
  driver_id     UUID NOT NULL REFERENCES driver(id),
  team_id       UUID NOT NULL REFERENCES team(id),
  car_number    SMALLINT,
  role          TEXT
    CHECK (role IN ('race', 'reserve', 'test', 'one_off')),
  valid_from    DATE NOT NULL,                      -- typically season.start_date for full-season seats
  valid_to      DATE,                               -- NULL = still active; set when seat changes mid-season
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_season_entry_season ON season_entry (season_id, valid_from);
CREATE INDEX idx_season_entry_driver ON season_entry (driver_id, valid_from);
```

**Why `season_entry` is a junction table:** mid-season seat changes (Hülkenberg → Bottas, Pourchaire promotion, IndyCar substitutions) are routine. Time-bounded membership lets us answer "who was driving the #44 Mercedes on race weekend X" without rewriting prior rows. Pattern from F1DB + slowly-changing-dimension literature.

## 7. Round (the unit of identity)

```sql
CREATE TABLE round (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id             UUID NOT NULL REFERENCES season(id) ON DELETE CASCADE,
  round_number          SMALLINT NOT NULL,
  display_name          TEXT NOT NULL,                 -- 'Canadian Grand Prix', 'Lone Star Le Mans', '24 Hours of Le Mans'
  venue_id              UUID REFERENCES venue(id),
  circuit_layout_id     UUID REFERENCES circuit_layout(id),
  start_date            DATE NOT NULL,                 -- weekend's first session date (venue-local)
  end_date              DATE NOT NULL,                 -- weekend's last session date (venue-local)
  status_code           TEXT NOT NULL REFERENCES status(code) DEFAULT 'scheduled',

  -- Schedule history (when status moves to postponed/rescheduled)
  previous_start_date   DATE,
  previous_end_date     DATE,
  reschedule_note       TEXT,                          -- 'Middle East conflict', 'Qatar postponement cascade'
  cancellation_reason   TEXT,
  reschedule_status     TEXT,                          -- 'under discussion', 'new date confirmed', etc.

  -- Significance (carries forward from significance.json)
  significance_tier     TEXT
    CHECK (significance_tier IN ('marquee', 'finale', 'weighted', 'note')),
  significance_label    TEXT,                          -- 'MARQUEE', '24h', 'season opener'
  significance_note     TEXT,

  -- Provenance
  source_id             UUID REFERENCES source(id) ON DELETE SET NULL,
  source_url            TEXT,
  source_etag           TEXT,
  content_hash          TEXT,
  fetched_at            TIMESTAMPTZ,
  verified_at           TIMESTAMPTZ,
  manual_override       BOOLEAN NOT NULL DEFAULT FALSE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (season_id, round_number),
  CHECK (end_date >= start_date),
  CHECK (
    (previous_start_date IS NULL AND previous_end_date IS NULL) OR
    (previous_start_date IS NOT NULL AND previous_end_date IS NOT NULL AND previous_end_date >= previous_start_date)
  )
);

CREATE INDEX idx_round_season ON round (season_id, round_number);
CREATE INDEX idx_round_dates  ON round (start_date, end_date);
CREATE INDEX idx_round_status ON round (status_code) WHERE status_code IN ('scheduled', 'live', 'postponed');
```

**Why `round_number` is unique only within `(season_id, round_number)`:** F1 Round 5 in 2026 is Canada; in 2025 it's something else. The pair is canonical, the number alone is not.

**Why `previous_start_date` lives on the row, not the audit log:** users on `/series/f1/weekend/5` need to see "Rescheduled from 2026-03-15" in the hero. Reading the audit log every render would be wasteful. The audit log still records the change as the source of truth for "show me every reschedule ever."

## 8. Session (the unit of time)

This is the table where the time-handling research lands. Per `db-best-practices.md` §7:

```sql
CREATE TABLE session (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id            UUID NOT NULL REFERENCES round(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL
    CHECK (kind IN (
      'practice', 'qualifying', 'sprint_qualifying', 'sprint', 'race',
      'warmup', 'shakedown', 'test', 'prologue', 'hyperpole', 'top_qualifying',
      'super_pole', 'shootout', 'fan_event', 'other'
    )),
  label               TEXT NOT NULL,                    -- 'Practice 1', 'Qualifying (Hypercar)', '24 Hours of Le Mans (Race Start)'
  sequence_in_round   SMALLINT NOT NULL,                -- 1, 2, 3... for ordering when same kind appears twice

  -- Time triple — the load-bearing decision
  local_start         TIMESTAMP NOT NULL,               -- '2026-06-13 14:00' (no TZ; wall-clock at venue)
  time_zone           TEXT NOT NULL,                    -- 'Europe/Paris' — IANA; inherits venue.iana_tz by default
  instant_utc         TIMESTAMPTZ NOT NULL,             -- pre-computed via (local_start AT TIME ZONE time_zone)
  duration_minutes    SMALLINT,                         -- nullable for endurance races (24h, etc. — compute via end of race)
  end_instant_utc     TIMESTAMPTZ,                      -- explicit for endurance races where duration is impractical

  status_code         TEXT NOT NULL REFERENCES status(code) DEFAULT 'scheduled',
  date_only           BOOLEAN NOT NULL DEFAULT FALSE,   -- true when source only published a date (renders 'TBC')

  -- Significance
  significance_tier   TEXT
    CHECK (significance_tier IN ('marquee', 'finale', 'weighted', 'note')),
  significance_note   TEXT,

  -- Provenance
  source_id           UUID REFERENCES source(id) ON DELETE SET NULL,
  source_url          TEXT,
  source_etag         TEXT,
  content_hash        TEXT,
  fetched_at          TIMESTAMPTZ,
  verified_at         TIMESTAMPTZ,
  manual_override     BOOLEAN NOT NULL DEFAULT FALSE,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (instant_utc = (local_start AT TIME ZONE time_zone)),
  CHECK (end_instant_utc IS NULL OR end_instant_utc >= instant_utc),
  CHECK (duration_minutes IS NULL OR duration_minutes > 0)
);

CREATE INDEX idx_session_round    ON session (round_id, sequence_in_round);
CREATE INDEX idx_session_upcoming ON session (instant_utc) WHERE status_code IN ('scheduled', 'live');
CREATE INDEX idx_session_kind     ON session (round_id, kind);
COMMENT ON CONSTRAINT session_instant_utc_check ON session IS
  'instant_utc must equal (local_start AT TIME ZONE time_zone). Recompute on every UPDATE of local_start or time_zone.';
```

**Why both `local_start` + `time_zone` + `instant_utc` and not just `instant_utc`:** if Australia changes its DST rules between now and Albert Park 2027, a session stored only as `instant_utc` cannot be recovered to "14:00 Melbourne wall-clock" — but that wall-clock is the canonical announcement. With the local wall-clock + IANA tz preserved, `instant_utc` is always recomputable. The CHECK constraint enforces that they don't drift.

**Why `end_instant_utc` is separate from `duration_minutes`:** Le Mans starts at 16:00 Saturday, ends at 16:00 Sunday — `duration_minutes = 1440`, but explicit `end_instant_utc` is clearer to read. Date-only entries can carry `end_instant_utc = NULL`.

**Why `date_only` boolean:** mirrors the current `Session.dateOnly` flag (`lib/ics.ts`). Renders "TBC" instead of inventing a time. Notify cron + live-now both skip these.

## 9. Result

```sql
CREATE TABLE result (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  driver_id           UUID REFERENCES driver(id) ON DELETE SET NULL,
  team_id             UUID REFERENCES team(id) ON DELETE SET NULL,
  car_number          SMALLINT,
  classified_position SMALLINT,                          -- NULL for DNF / DSQ
  finishing_status    TEXT NOT NULL                     -- 'classified' | 'dnf' | 'dsq' | 'dns' | 'dnq' | 'withdrew'
    DEFAULT 'classified',
  laps                SMALLINT,
  time_or_gap         TEXT,                              -- '+5.421' or '1:34:56.789' — kept as text so we can preserve source formatting
  fastest_lap_time    INTERVAL,
  fastest_lap_in_lap  SMALLINT,
  points              NUMERIC(5, 2) NOT NULL DEFAULT 0,  -- non-integer for half-points
  grid_position       SMALLINT,
  pit_stops           SMALLINT,
  dnf_reason          TEXT,
  raw_payload         JSONB,                             -- everything we couldn't model but want to keep

  source_id           UUID REFERENCES source(id) ON DELETE SET NULL,
  content_hash        TEXT,
  fetched_at          TIMESTAMPTZ,
  manual_override     BOOLEAN NOT NULL DEFAULT FALSE,    -- mirrors results-overrides.json

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (session_id, car_number),
  CHECK (classified_position IS NULL OR classified_position > 0),
  CHECK (points >= 0)
);

CREATE INDEX idx_result_session  ON result (session_id, classified_position);
CREATE INDEX idx_result_driver   ON result (driver_id);
CREATE INDEX idx_result_team     ON result (team_id);
CREATE INDEX idx_result_payload  ON result USING gin (raw_payload jsonb_path_ops);
```

**Why `raw_payload JSONB`:** results vary wildly across series (NASCAR has stage points + green-flag passes; WEC has classes; WRC has stage-by-stage); modelling every field as a column is hopeless. First-class columns for what every series shares (position, points, time, status); JSONB for the long tail. GIN index for occasional queries into the JSONB.

**Why `points NUMERIC(5,2)`:** F1 half-points (Spa 2021, Sao Paulo 2024 if it ever rains again), GTWCE class-bonus fractions.

**Why UNIQUE `(session_id, car_number)`:** in any one session a car number is unique. Stops duplicate inserts when a parser fires twice.

## 10. Audit log

The shadow table from `db-best-practices.md` §4.

```sql
CREATE TABLE schedule_change_log (
  id                BIGSERIAL PRIMARY KEY,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  table_name        TEXT NOT NULL,                          -- 'round' | 'session' | 'result'
  row_id            UUID NOT NULL,
  operation         TEXT NOT NULL
    CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_fields    TEXT[] NOT NULL DEFAULT '{}',
  old_values        JSONB,
  new_values        JSONB,
  source_id         UUID REFERENCES source(id),
  detected_by       TEXT NOT NULL,                          -- 'cron:f1-ics' | 'manual:paris' | 'manual:fotis'
  material          BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       TEXT,
  notes             TEXT
);

CREATE INDEX idx_audit_row      ON schedule_change_log (table_name, row_id, occurred_at DESC);
CREATE INDEX idx_audit_material ON schedule_change_log (occurred_at DESC) WHERE material = TRUE AND reviewed_at IS NULL;
CREATE INDEX idx_audit_recent   ON schedule_change_log (occurred_at DESC);
```

**Material-flag rules** (computed by the diff worker, not enforced in DB):

- `status_code` changed (any direction) → material
- `start_date` / `end_date` / `local_start` / `instant_utc` moved by > 30 minutes → material
- Round added / removed → material
- `manual_override` flipped → material
- Driver / team rows on a result swapped → material
- Anything else → not material, log silently

**Trigger pattern** (one trigger per audited table; show `round` here; sessions + results follow the same shape):

```sql
CREATE OR REPLACE FUNCTION audit_round_changes()
RETURNS TRIGGER AS $$
DECLARE
  changed TEXT[] := '{}';
  old_j   JSONB;
  new_j   JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO schedule_change_log
      (table_name, row_id, operation, old_values, detected_by)
    VALUES
      ('round', OLD.id, 'DELETE', to_jsonb(OLD),
       current_setting('app.detected_by', true));
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO schedule_change_log
      (table_name, row_id, operation, new_values, detected_by)
    VALUES
      ('round', NEW.id, 'INSERT', to_jsonb(NEW),
       current_setting('app.detected_by', true));
    RETURN NEW;
  END IF;

  -- UPDATE: diff column-by-column for changed_fields
  old_j := to_jsonb(OLD);
  new_j := to_jsonb(NEW);
  IF OLD.status_code IS DISTINCT FROM NEW.status_code THEN changed := changed || 'status_code'; END IF;
  IF OLD.start_date  IS DISTINCT FROM NEW.start_date  THEN changed := changed || 'start_date';  END IF;
  IF OLD.end_date    IS DISTINCT FROM NEW.end_date    THEN changed := changed || 'end_date';    END IF;
  IF OLD.display_name IS DISTINCT FROM NEW.display_name THEN changed := changed || 'display_name'; END IF;
  -- ... continue for every column that matters

  IF array_length(changed, 1) IS NULL THEN
    RETURN NEW;  -- nothing meaningful changed
  END IF;

  INSERT INTO schedule_change_log
    (table_name, row_id, operation, changed_fields, old_values, new_values, detected_by, material)
  VALUES
    ('round', NEW.id, 'UPDATE', changed, old_j, new_j,
     current_setting('app.detected_by', true),
     'status_code' = ANY(changed) OR 'start_date' = ANY(changed));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_round
AFTER INSERT OR UPDATE OR DELETE ON round
FOR EACH ROW EXECUTE FUNCTION audit_round_changes();
```

The `current_setting('app.detected_by', true)` reads a session-level GUC that the cron worker sets before each batch (`SET LOCAL app.detected_by = 'cron:f1-ics'`). When manual edits run from the admin path, the same hook fires with `'manual:paris'` etc.

**Security:** `schedule_change_log` is owned by a `paddock_audit` role; the `paddock_app` role has `INSERT` only (no `UPDATE` / `DELETE`). A compromised app role cannot rewrite history.

## 11. Standings + overrides

Native non-F1 standings (S7 work) lands here. For v1, the F1 jolpica fetch + Wikipedia scrapes feed this same table.

```sql
CREATE TABLE standings_snapshot (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id           UUID NOT NULL REFERENCES season(id) ON DELETE CASCADE,
  after_round_id      UUID NOT NULL REFERENCES round(id),     -- 'as of round N'
  scope               TEXT NOT NULL
    CHECK (scope IN ('drivers', 'constructors', 'teams', 'manufacturers')),
  position            SMALLINT NOT NULL,
  driver_id           UUID REFERENCES driver(id),
  team_id             UUID REFERENCES team(id),
  points              NUMERIC(6, 2) NOT NULL,
  wins                SMALLINT,
  podiums             SMALLINT,
  is_override         BOOLEAN NOT NULL DEFAULT FALSE,         -- standings-overrides.json equivalent
  source_id           UUID REFERENCES source(id),
  fetched_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, after_round_id, scope, position)
);

CREATE INDEX idx_standings_lookup ON standings_snapshot (season_id, after_round_id, scope);
```

The override flag mirrors today's `standings-overrides.json` — corrections (DSQ retroactively applied, points reallocation) that beat any future scrape.

## 12. User-facing tables (additive, future-proof)

```sql
-- Comments thread on a weekend / session — gated by Clerk user_id at the app layer.
CREATE TABLE comment (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,                      -- Clerk user_id (TEXT, not FK; auth lives outside DB)
  parent_kind  TEXT NOT NULL
    CHECK (parent_kind IN ('round', 'session', 'post')),
  parent_id    UUID NOT NULL,                      -- polymorphic — round.id | session.id | post slug hash
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at    TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX idx_comment_parent ON comment (parent_kind, parent_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_comment_user   ON comment (user_id, created_at DESC);

CREATE TABLE prediction (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  session_id      UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  state           TEXT NOT NULL
    CHECK (state IN ('open', 'locked', 'resolved'))
    DEFAULT 'open',
  payload         JSONB NOT NULL,                  -- {winner: driver_id, podium: [...], ...}
  scored_points   NUMERIC(5, 2),
  scored_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);
CREATE INDEX idx_prediction_session ON prediction (session_id, state);
CREATE INDEX idx_prediction_user    ON prediction (user_id, created_at DESC);

CREATE TABLE ledger_entry (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  amount       INTEGER NOT NULL,                   -- positive credit, negative debit; integer = "paddock coins"
  kind         TEXT NOT NULL
    CHECK (kind IN ('signup_bonus', 'prediction_correct', 'streak_bonus', 'comment_reward',
                    'spent_avatar', 'spent_badge', 'admin_grant', 'admin_revoke')),
  ref_kind     TEXT,                                -- 'prediction' | 'comment' | NULL for admin moves
  ref_id       UUID,
  note         TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_user ON ledger_entry (user_id, occurred_at DESC);

CREATE TABLE push_subscription (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT,                              -- may be NULL for pre-auth subscriptions
  endpoint      TEXT UNIQUE NOT NULL,
  keys          JSONB NOT NULL,                    -- {p256dh, auth}
  user_agent    TEXT,
  device_label  TEXT,                              -- user-set "Pixel 8 Pro at work"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ
);
CREATE INDEX idx_push_user ON push_subscription (user_id);

CREATE TABLE user_preferences (
  user_id           TEXT PRIMARY KEY,
  followed_series   TEXT[] NOT NULL DEFAULT '{}',  -- series slugs the user follows
  muted_series      TEXT[] NOT NULL DEFAULT '{}',
  notif_sessions    BOOLEAN NOT NULL DEFAULT TRUE,
  notif_news        BOOLEAN NOT NULL DEFAULT TRUE,
  notif_race_week   BOOLEAN NOT NULL DEFAULT TRUE,
  notif_sound       BOOLEAN NOT NULL DEFAULT TRUE,
  onboarded_at      TIMESTAMPTZ,
  raw_prefs         JSONB,                          -- extensibility for future preference keys
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contact_submission (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email   TEXT NOT NULL,
  body         TEXT NOT NULL,
  user_id      TEXT,                                -- if signed in
  emailed      BOOLEAN NOT NULL DEFAULT FALSE,      -- did Resend accept
  email_error  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

These tables replace the corresponding KV namespaces (`paddock:contact:*`, `paddock:userprefs:*`, `paddock:push:*`) when we're ready to migrate. v1 schema includes them so we don't need a second migration in three weeks.

## 13. RLS policies (Supabase-flavoured)

Public read for canonical schedule tables, authenticated write for user tables, audit table is read-only to the app role.

```sql
-- Canonical schedule data: public can read everything, only service role writes.
ALTER TABLE series              ENABLE ROW LEVEL SECURITY;
ALTER TABLE season              ENABLE ROW LEVEL SECURITY;
ALTER TABLE round               ENABLE ROW LEVEL SECURITY;
ALTER TABLE session             ENABLE ROW LEVEL SECURITY;
ALTER TABLE result              ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue               ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver              ENABLE ROW LEVEL SECURITY;
ALTER TABLE team                ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_entry        ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuit_layout      ENABLE ROW LEVEL SECURITY;
ALTER TABLE status              ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings_snapshot  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON series             FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON season             FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON round              FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON session            FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON result             FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON venue              FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON driver             FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON team               FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON season_entry       FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON circuit_layout     FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON status             FOR SELECT USING (TRUE);
CREATE POLICY "public_read" ON standings_snapshot FOR SELECT USING (TRUE);
-- INSERT/UPDATE/DELETE: no policies → only service role (cron worker) can write.

-- User tables: per-user read + write.
ALTER TABLE comment              ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entry         ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscription    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submission   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_read_visible" ON comment
  FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "comment_write_own" ON comment
  FOR INSERT WITH CHECK ((SELECT auth.uid()::TEXT) = user_id);
CREATE POLICY "comment_update_own" ON comment
  FOR UPDATE USING ((SELECT auth.uid()::TEXT) = user_id);

CREATE POLICY "prediction_read_own" ON prediction
  FOR SELECT USING ((SELECT auth.uid()::TEXT) = user_id);
CREATE POLICY "prediction_write_own" ON prediction
  FOR INSERT WITH CHECK ((SELECT auth.uid()::TEXT) = user_id);
CREATE POLICY "prediction_update_open" ON prediction
  FOR UPDATE USING ((SELECT auth.uid()::TEXT) = user_id AND state = 'open');

CREATE POLICY "ledger_read_own" ON ledger_entry
  FOR SELECT USING ((SELECT auth.uid()::TEXT) = user_id);
-- INSERT/UPDATE: service role only — ledger entries are never written by users directly.

CREATE POLICY "push_write_own" ON push_subscription
  FOR ALL USING ((SELECT auth.uid()::TEXT) = user_id OR user_id IS NULL);

CREATE POLICY "user_prefs_own" ON user_preferences
  FOR ALL USING ((SELECT auth.uid()::TEXT) = user_id);

-- Audit table: app role can INSERT (via trigger), cannot SELECT / UPDATE / DELETE.
ALTER TABLE schedule_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_no_app_read" ON schedule_change_log FOR SELECT USING (FALSE);
-- Service role bypasses RLS entirely.
```

**Wrap `auth.uid()` in `SELECT`** for the cached initPlan optimization. Indexes on `user_id` everywhere it's referenced in a policy.

## 14. Indexes — the canonical set

Most are already declared inline above. Consolidated:

```sql
-- Schedule (hottest queries)
CREATE INDEX idx_session_upcoming ON session (instant_utc) WHERE status_code IN ('scheduled', 'live');
CREATE INDEX idx_session_round    ON session (round_id, sequence_in_round);
CREATE INDEX idx_session_kind     ON session (round_id, kind);
CREATE INDEX idx_round_season     ON round (season_id, round_number);
CREATE INDEX idx_round_dates      ON round (start_date, end_date);
CREATE INDEX idx_round_status     ON round (status_code) WHERE status_code IN ('scheduled', 'live', 'postponed');
CREATE INDEX idx_result_session   ON result (session_id, classified_position);
CREATE INDEX idx_result_driver    ON result (driver_id);
CREATE INDEX idx_result_team      ON result (team_id);
CREATE INDEX idx_result_payload   ON result USING gin (raw_payload jsonb_path_ops);

-- Standings
CREATE INDEX idx_standings_lookup ON standings_snapshot (season_id, after_round_id, scope);

-- Audit
CREATE INDEX idx_audit_row        ON schedule_change_log (table_name, row_id, occurred_at DESC);
CREATE INDEX idx_audit_material   ON schedule_change_log (occurred_at DESC) WHERE material = TRUE AND reviewed_at IS NULL;
CREATE INDEX idx_audit_recent     ON schedule_change_log (occurred_at DESC);

-- Source
CREATE INDEX idx_source_active    ON source (is_active, slug) WHERE is_active = TRUE;

-- User tables
CREATE INDEX idx_comment_parent   ON comment (parent_kind, parent_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_comment_user     ON comment (user_id, created_at DESC);
CREATE INDEX idx_prediction_session ON prediction (session_id, state);
CREATE INDEX idx_prediction_user  ON prediction (user_id, created_at DESC);
CREATE INDEX idx_ledger_user      ON ledger_entry (user_id, occurred_at DESC);
CREATE INDEX idx_push_user        ON push_subscription (user_id);
```

Add others only when `EXPLAIN ANALYZE` shows you need them. Composite-index column order rule: equality first, then range / sort.

## 15. Migration strategy from current JSON files

Each curated file maps to one or more tables. v1.5 will do this for real; flagging the mapping now so the schema doesn't paint us into a corner:

| Current file | Target table(s) | Notes |
|---|---|---|
| `content/series/<slug>/meta.json` | `series` + `season` | One row per series; one row per season. |
| `content/series/<slug>/rounds.json` | `round` | `cancelled` rounds get `status_code = 'cancelled'`, no separate table. `cancelledRounds[]` migrates with `original_round_number` preserved in `notes`. |
| `content/series/<slug>/sessions.json` | `session` | Each `overrides[].sessions[]` becomes a `session` row with `manual_override = TRUE`. |
| `content/series/<slug>/drivers.json` | `driver` + `season_entry` | Drivers global; entries are scoped to a season. |
| `content/series/<slug>/champions.json` | `standings_snapshot` (final, scope=drivers) | Each champion is the position-1 row of the season-end standings snapshot. |
| `content/series/<slug>/results-overrides.json` | `result` (with `manual_override = TRUE`) | Same pattern as sessions overrides. |
| `content/series/<slug>/standings-overrides.json` | `standings_snapshot` (with `is_override = TRUE`) | |
| `content/series/<slug>/significance.json` | `round.significance_*` columns | |
| `content/series/<slug>/overview.md` / `drivers.md` / etc. | **Stay as MDX** | These are prose, not structured data. No DB benefit. |
| `content/posts/*.mdx` | **Stay as MDX** | Same. |

The migration tool reads the JSON files and emits INSERT statements with `manual_override = TRUE` and `source_id = (the 'curated_json' source row)`. The cron worker then runs and tries to UPDATE — every UPDATE is no-op'd because of the `manual_override` flag, but every UPDATE produces a `schedule_change_log` row with `material = FALSE` — giving us a free dataset for "how often does the upstream feed agree with our curation?"

## 16. Out of scope for v1

- **Live in-race data** (sector splits, lap-by-lap telemetry) — separate `live_session_data` table, partitioned by date, written by a different worker. Probably TimescaleDB hypertable.
- **Mobile push delivery receipts** — track delivered / clicked / muted per push; v1 sticks with the current "best effort" model.
- **Federated identity beyond Clerk** — the schema uses `user_id TEXT` to keep the door open for switching auth providers, but no specific accommodation.
- **Multi-tenant series ownership** — every series is "owned by Paddock"; v1 doesn't model "series scoped to one organisation".
- **Translations / i18n** — `display_label` and prose columns are English-only for v1. The status table has the right shape to add a `display_label_es` etc. but no plan to.
- **Full row-history TIMERANGE pattern (SQL:2011 temporal)** — `previous_start_date` columns + audit log cover the cases we care about. Bemi or DBchange could add full temporal later if needed.

## 17. Open questions for the Fotis sit-down

1. **UUID v7 timing.** Wait for a stable generator, or write a `uuid_v7_generate()` plpgsql helper today? The performance delta probably doesn't matter until `schedule_change_log` crosses 10M rows. Vote: defer, use `gen_random_uuid()` everywhere, swap later.
2. **Service role split.** Do we want `paddock_cron`, `paddock_admin`, `paddock_app` as three distinct roles, or fold `paddock_admin` and `paddock_cron` into one for simplicity? Affects RLS bypass + audit ownership.
3. **`status_code` as TEXT PK vs surrogate UUID.** Trade-off: human-readable status codes leak into URLs and JSON-LD nicely (`status: 'scheduled'`), but renaming a code requires a manual cascade. Vote: keep TEXT PK, rename via a one-off migration if ever needed.
4. **JSONB vs first-class columns for `result.raw_payload`.** Are NASCAR stage points first-class or JSONB? IndyCar grid penalties? Decide *after* importing actual data and seeing what we keep filtering on.
5. **Where Schema.org JSON-LD generation lives.** Database view (`v_schema_org_round`) or app-layer mapper? Vote: app layer, but the schema is shaped to make the view easy if we change our minds.
6. **Audit retention.** `schedule_change_log` will grow indefinitely. Soft cap at 1 year of detail + permanent retention of `material = TRUE` rows? Or partition by month and prune cold partitions?
7. **Backfill content_hash on import.** The first cron run after migration will see every row's hash change from `NULL` to a SHA-256 — that fires a non-material audit entry per row. Acceptable noise on day one or worth pre-computing during migration?
8. **Naming convention.** `snake_case` is the Postgres / Supabase default and we're using it everywhere — confirm Fotis agrees before drift sets in.
9. **Comments + predictions launch order.** Both share the same auth + RLS scaffolding; ship together or stage-gate?
10. **Realtime subscriptions.** Supabase Realtime can broadcast row changes. Worth wiring for the `live-now` band on home? Or keep current polling pattern for v1?

## 18. Implementation order (for the build session after Fotis)

1. Provision Supabase project, link to Vercel Marketplace, write env vars.
2. Run migration `001_extensions.sql` (extensions only).
3. Run `002_status_lookup.sql` (status + source tables seeded).
4. Run `003_core_schedule.sql` (series, season, venue, circuit_layout, driver, team, season_entry).
5. Run `004_round_session_result.sql` (round, session, result + their indexes).
6. Run `005_audit.sql` (schedule_change_log + triggers).
7. Run `006_standings.sql` (standings_snapshot).
8. Run `007_user.sql` (comment, prediction, ledger_entry, push_subscription, user_preferences, contact_submission).
9. Run `008_rls.sql` (all policies, in one file for review).
10. Write a one-off `migrate_from_json.ts` script that walks `content/series/**/*.json` and emits INSERT statements with `manual_override = TRUE` + `source_id = (curated_json)`. Run against the new project.
11. Wire one cron (F1 ICS) end-to-end: fetch → hash → diff → audit-log → review queue UI. Validate the diff worker before fanning out to the other 13 series.
12. Migrate one read path at a time: `/series/[slug]` first (just reads round + session). Confirm parity with the current JSON-backed render. Then migrate write paths (curator UI), then crons, then user tables.

Total estimated effort: **4-5 build sessions + 1 review session** for the canonical schedule tables. User tables can land in a follow-up.

## Sources

- `docs/research/db-best-practices.md` — patterns + rationale, 30+ external sources synthesised.
- `docs/research/per-series-source-audit.md` — inbound feed shape per series.
- `docs/HANDOFF.md` — authoring model, landmines, existing JSON contract.
- `lib/types.ts`, `lib/sessions-overrides.ts`, `lib/rounds.ts` — the current TypeScript model the schema must replace without losing capability.
