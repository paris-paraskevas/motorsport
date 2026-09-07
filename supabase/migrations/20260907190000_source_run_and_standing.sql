-- Phase 0 of the designer plan (Paddock Designer Field Guide, 2026-09-07):
-- the site's data as ROWS with provenance, beside the JSON payloads that
-- `source_snapshot` keeps one-per-source. Standings first, because the F1 table
-- is the smallest surface with a real reader; results and sessions follow once
-- this pattern has run for a while.
--
-- THE RUN ID IS THE TRANSACTION. PostgREST offers no multi-request transaction,
-- so a load inserts its rows under a fresh `source_run` and marks that run `ok`
-- LAST. Readers go through `standing_current`, which shows only the newest ok
-- run per source, so a half-written load is invisible and a bad load is rolled
-- back by marking its run `failed`. Plain upsert-in-place was rejected: it
-- cannot remove a driver who dropped out or a classification that was corrected.
--
-- `source` is self-registering: the loader upserts its own row on every run, so
-- there is nothing to seed. `secret_name` holds the NAME of a credential, never
-- a value.
--
-- RLS-on / no-policies / service_role-only like the rest of the schema; the
-- default privileges from 20260622094000 cover new tables and the view.
create table if not exists source (
  key          text primary key,
  kind         text not null default 'rest',
  label        text not null,
  target_table text,
  secret_name  text,
  created_at   timestamptz not null default now()
);

create table if not exists source_run (
  id           uuid primary key default gen_random_uuid(),
  source_key   text not null references source(key),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running' check (status in ('running', 'ok', 'failed')),
  rows_written int not null default 0,
  error        text,
  runner       text
);

-- The only hot query: newest ok run per source (the view below, the freshness
-- check and the console's Loads panel).
create index if not exists source_run_latest_ok_idx
  on source_run (source_key, finished_at desc)
  where status = 'ok';

create table if not exists standing (
  id            bigint generated always as identity primary key,
  source_run_id uuid not null references source_run(id) on delete cascade,
  series        text not null,
  season        int not null,
  kind          text not null check (kind in ('driver', 'constructor')),
  class_name    text,
  position      int not null,
  name          text not null,
  code          text,
  team          text,
  points        numeric not null,
  wins          int
);

create index if not exists standing_run_idx on standing (source_run_id);
create index if not exists standing_series_idx on standing (series, season, kind, position);

-- What readers see: the rows of the newest ok run for each source.
create or replace view standing_current as
  select s.*
  from standing s
  join (
    select distinct on (source_key) id
    from source_run
    where status = 'ok'
    order by source_key, finished_at desc
  ) latest on latest.id = s.source_run_id;

alter table source enable row level security;
alter table source_run enable row level security;
alter table standing enable row level security;
