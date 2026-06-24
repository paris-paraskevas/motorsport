-- Generalised durable last-good cache + health record for upstream feeds — the
-- "store every API result so the site serves from our DB and survives outages"
-- the operator asked for. One row per source key: the last successful payload, a
-- timestamp, and ok/status so the table doubles as a per-source health record.
-- RLS-on / no-policies / service_role-only like the rest of the schema; the default
-- privileges from migration 20260622094000 already grant service_role on new
-- tables (mirrors thread / friendship), so no explicit grant is needed here.
create table if not exists source_snapshot (
  source_key   text primary key,
  payload      jsonb not null,
  fetched_at   timestamptz not null default now(),
  ok           boolean not null default true,
  http_status  int,
  error        text
);
-- Health endpoint scans by freshness (newest first).
create index if not exists source_snapshot_fetched_idx on source_snapshot (fetched_at desc);

alter table source_snapshot enable row level security;
