-- W1 of the workspaces plan (operator: "w1 go", 2026-09-09 ~09:20Z; the plan is
-- artifact a3bfb43e-a167-4634-80f1-fa5618481b64): the rows that let the designer
-- hold more than one application, in more than one workspace.
--
-- The shape. A `workspace` is who may build (in APEX's words, what you sign in
-- to). The plan's recommendation is that it mirrors a Clerk Organization, so
-- membership, invitations and roles live in Clerk and the row keeps only the
-- organization's id. `application` gains the workspace it belongs to, its
-- APEX-style number (Paddock is 100; the next application takes the next free
-- number) and the path its pages live under: '' for Paddock, whose pages sit at
-- the site's root, and '/a/<alias>' for every other application, on the same
-- site. The alias becomes unique because the path is made from it.
--
-- Nothing reads the new columns until the App Builder PR that follows, so
-- applying this file cannot change the site. Paddock's row is stamped by the
-- defaults and the backfill. One transaction: a failure applies nothing.
-- RLS-on / no-policies / service_role-only like the rest of the schema; the
-- default privileges from 20260622094000 cover the new table.
begin;

create table if not exists workspace (
  key          text primary key,
  name         text not null,
  -- The Clerk Organization this workspace mirrors; null until W3 turns
  -- Organizations on and links it. An id, never a secret.
  clerk_org_id text unique,
  created_at   timestamptz not null default now()
);
alter table workspace enable row level security;

insert into workspace (key, name) values ('paddock', 'Paddock') on conflict (key) do nothing;

alter table application add column if not exists workspace_key text not null default 'paddock' references workspace(key);

alter table application add column if not exists number int;
update application set number = 100 where key = 'paddock' and number is null;
alter table application alter column number set not null;
alter table application drop constraint if exists application_number_key;
alter table application add constraint application_number_key unique (number);

alter table application add column if not exists path_prefix text not null default '';
alter table application drop constraint if exists application_path_prefix_check;
alter table application add constraint application_path_prefix_check
  check (path_prefix = '' or path_prefix ~ '^/a/[a-z0-9][a-z0-9-]*$');
-- Only Paddock sits at the root; every other application lives under its path.
alter table application drop constraint if exists application_root_check;
alter table application add constraint application_root_check check (key = 'paddock' or path_prefix <> '');

alter table application drop constraint if exists application_alias_key;
alter table application add constraint application_alias_key unique (alias);

commit;
