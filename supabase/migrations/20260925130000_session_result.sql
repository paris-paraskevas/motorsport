-- P2.25 (Session results): one F1 session's classification as ROWS with
-- provenance, the Phase 0 pattern of 20260907190000_source_run_and_standing.sql
-- applied to sessions, as that file's own note said would follow. Practice and
-- qualifying first (the Results source carries races); the table is general,
-- so a sprint or a race the cron captures is stored too.
--
-- THE RUN ID IS THE TRANSACTION, as for `standing`: the cron inserts a
-- session's rows under a fresh `source_run` (one `source` per session, keyed
-- session-result:<series>:<season>:<round>:<session>) and marks the run `ok`
-- LAST. Readers go through `session_result_current`, the newest ok run per
-- source, so a half-written capture is invisible and a recapture replaces the
-- rows whole.
--
-- No check on `session`: a session's slug is whatever the series' own titles
-- produce (lib/weekend.ts sessionSlug), not a fixed set; the catalogue's
-- parameter is where the offered values live. `position` is null for a
-- DNF/DNS/DSQ row (data, not an error); `time` is the best lap for practice
-- and qualifying, pre-formatted as the classification carries it; `compound`
-- is the tyre of the driver's best lap.
--
-- RLS-on / no-policies / service_role-only like the rest of the schema; the
-- default privileges from 20260622094000 cover the table and the view.
create table if not exists session_result (
  id            bigint generated always as identity primary key,
  source_run_id uuid not null references source_run(id) on delete cascade,
  series        text not null,
  season        int not null,
  round         int not null,
  session       text not null,
  position      int,
  driver_name   text not null,
  driver_code   text,
  car_number    text,
  team          text,
  laps          int,
  time          text,
  gap           text,
  interval      text,
  q1            text,
  q2            text,
  q3            text,
  compound      text,
  points        numeric,
  status        text
);

create index if not exists session_result_run_idx on session_result (source_run_id);
create index if not exists session_result_series_idx on session_result (series, season, round, session, position);

-- What readers see: the rows of the newest ok run for each source.
create or replace view session_result_current as
  select s.*
  from session_result s
  join (
    select distinct on (source_key) id
    from source_run
    where status = 'ok'
    order by source_key, finished_at desc
  ) latest on latest.id = s.source_run_id;

alter table session_result enable row level security;
