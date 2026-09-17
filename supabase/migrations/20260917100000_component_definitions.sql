-- Component definitions (the components programme, P2.0, PR B; APEX: Plug-ins):
-- one row per definition the operator added attributes or groups to. The code
-- holds every definition (lib/design/component-definitions.ts); a row holds the
-- OVERLAY only, what was added on top, so a row can never change or remove
-- what a renderer reads. A definition with no row is the code's, unchanged;
-- the first Add Attribute inserts its row. The shape of the other design
-- tables: tenancy by application, row level security with nothing granted to
-- the API roles (the service role writes), the stamp trigger the conditional
-- updates rely on (0 rows on the caller's stamp → 409).
begin;

create table if not exists component_definition (
  application_key text not null default 'paddock' references application(key),
  key             text not null,                          -- a definition's key: region.image, page.heading, home.wire
  overlay         jsonb not null default '{}'::jsonb,     -- { attributes: [...], groups: [...] }, what the operator added
  updated_at      timestamptz not null default now(),
  updated_by      text,
  primary key (application_key, key)
);

alter table component_definition enable row level security;
revoke all on table component_definition from anon, authenticated;

create or replace trigger component_definition_updated_at before update on component_definition
  for each row execute function design_set_updated_at();

commit;
