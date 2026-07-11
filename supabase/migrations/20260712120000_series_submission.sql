-- Feeder-series self-serve data intake (design: docs/research/2026-07-06-feeder-series-intake.md).
-- Public, ANONYMOUS submissions: a feeder championship hands us their schedule/
-- results data (a small file stored inline as base64 for the MVP, and/or a link),
-- landing in staging for the operator to review + curate into content/series/<slug>.
-- RLS-on / no-policies / service_role-only like the rest of the schema (default
-- privileges from 20260622094000 grant service_role on new tables — no explicit
-- grant needed). Unlike `feedback`, there is NO app_user FK: submitters have no
-- account, they arrive via an emailed link.
create table if not exists series_submission (
  id            uuid primary key default gen_random_uuid(),
  series_name   text not null,
  contact_email text not null,
  season        text,
  note          text,
  data_url      text,          -- optional link to a Sheet / Drive / results page
  file_name     text,          -- original filename, when a file was attached
  file_type     text,          -- MIME type of the attached file
  file_size     integer,       -- decoded file size in bytes
  file_data     text,          -- base64 of the attached file (MVP; Supabase Storage in Phase 2)
  ref_token     text,          -- opaque attribution token from the emailed ?ref= link
  status        text not null default 'new' check (status in ('new', 'reviewing', 'ingested', 'rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- The admin review list orders by status, newest first.
create index if not exists series_submission_status_created_idx on series_submission (status, created_at desc);

alter table series_submission enable row level security;
