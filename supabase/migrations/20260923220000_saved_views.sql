-- Saved views (P2.3 PR B; APEX: an Interactive Report's saved reports, the designer-authored tiers alone): one row per named
-- Alternative of a Data region on one page — its key (the share link's ?view=<key>), its name, the page and region it belongs
-- to, and its definition (the URL vocabulary's parameters as JSON: sort, cols, filters). Primary is the region as designed and
-- has no row. The shape of the other design tables: tenancy by application, row level security with nothing granted to the
-- API roles (the service role writes), the stamp trigger the conditional updates rely on. A page's deletion takes its views
-- with it (on delete cascade), as it takes the page's revisions. Writes go through app/api/admin/design/views/* only.
begin;

create table if not exists saved_view (
  application_key text not null default 'paddock' references application(key),
  key             text not null,
  page_id         uuid not null references page(id) on delete cascade,
  region_id       text not null,
  name            text not null,
  definition      jsonb not null default '{}'::jsonb,
  seq             int not null default 10,
  updated_at      timestamptz not null default now(),
  updated_by      text,
  primary key (application_key, key)
);

create index if not exists saved_view_page_region on saved_view (page_id, region_id);

alter table saved_view enable row level security;
revoke all on table saved_view from anon, authenticated;

create or replace trigger saved_view_updated_at before update on saved_view
  for each row execute function design_set_updated_at();

commit;
