-- Phase 1 of the designer plan (Paddock Designer Field Guide, 2026-09-07, §03):
-- the DESIGN tables, empty on arrival. Nothing reads them until the designer
-- routes land (Phase 2), so applying this file cannot change the site. The
-- operator applies it to prod BEFORE the code that reads it merges, and the
-- information_schema proof goes in the pull request.
--
-- The shape, as it survived the adversarial review:
--
--  * DESIGN ROWS (every table here except page_revision and page_revision_ref)
--    carry `updated_at`. A save from the designer sends the value it loaded and
--    the UPDATE filters on it, so a stale save changes nothing and the route says
--    so: the 1.0.25 studio pattern. The trigger below keeps `updated_at` honest
--    whatever wrote the row.
--  * page_revision is APPEND-ONLY: one row per save, `published_at` null = draft,
--    publishing sets it, rollback = publish an older row again (page_layout's
--    precedent, 20260824120000). `base_revision_id` records what the save was
--    built on, so the API can refuse a save whose base is not the newest.
--  * page_revision_ref PROJECTS what a revision points at (a list, a scheme, a
--    build option, a destination) with REAL foreign keys and no cascade, so a
--    list or a scheme cannot be deleted while any revision still names it.
--  * Catalogue keys are text primary keys (`doors`, `bar`, `public`,
--    `administrator`): they appear inside revisions and in code, so they must
--    never be renumbered.
--  * ACCESS: RLS on, no policies, service role only, like the rest of the schema.
--    Unlike the rest of the schema this file also REVOKES the anon and
--    authenticated grants that the default privileges (20260622094000) hand to
--    every new table. A design row is never read with anything but the service
--    role, and PostgREST must not be able to serve it to a holder of the anon key.
--
-- Whole file in one transaction: a typo applies nothing rather than half. Every
-- statement is idempotent, so re-applying is harmless.
begin;

-- Keeps `updated_at` honest on every design table, whatever wrote the row.
create or replace function design_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- catalogues

-- Authorization schemes (APEX: Authorization Schemes). Referenced by pages,
-- regions, buttons and list entries. `type` says how the check is made: public
-- (no check), signed_in (any Clerk session), role (Clerk publicMetadata.role
-- equals `value`), author (an approved writer, the `author` table), email_domain
-- (the session's email ends with `value`).
create table if not exists authz_scheme (
  key        text primary key,
  label      text not null,
  type       text not null check (type in ('public', 'signed_in', 'role', 'author', 'email_domain')),
  value      text,
  message    text,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Build options (APEX: Build Options) = feature flags. A component tied to an
-- excluded option is not rendered anywhere, without a deploy.
create table if not exists build_option (
  key        text primary key,
  label      text not null,
  status     text not null default 'include' check (status in ('include', 'exclude')),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Page groups (APEX: Page Groups). Organise the pages list and feed the breadcrumb.
create table if not exists page_group (
  key        text primary key,
  label      text not null,
  seq        int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Assets (APEX: Static Application Files, restricted to media). The file lives
-- in R2 under `r2_key`; this row carries what a page needs to show it honestly:
-- caption, credit and licence. No CSS or JavaScript uploads, by design.
create table if not exists asset (
  id           uuid primary key default gen_random_uuid(),
  r2_key       text not null unique,
  kind         text not null default 'image' check (kind in ('image', 'video', 'document', 'system')),
  caption      text,
  credit       text,
  licence      text,
  width        int,
  height       int,
  bytes        bigint,
  content_type text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   text
);

-- ---------------------------------------------------------------- application

-- One row (APEX: Application Definition + User Interface Attributes). The check
-- on `key` is what makes it one row.
create table if not exists application (
  key              text primary key default 'paddock' check (key = 'paddock'),
  name             text not null default 'Paddock Tracker',
  alias            text not null default 'paddock',
  availability     text not null default 'available' check (availability in ('available', 'maintenance')),
  home_path        text not null default '/',
  description      text,
  wordmark         text,
  tagline          text,
  date_chip        boolean not null default true,
  install_prompt   boolean not null default true,
  favicon_asset_id uuid references asset(id),
  updated_at       timestamptz not null default now(),
  updated_by       text
);

-- ---------------------------------------------------------------- pages

-- A page is a route the site serves (APEX: Page). `kind` = code for routes that
-- keep their code path and are registered here so the designer can see them;
-- row for pages served from a revision by the catch-all route (Phase 3).
-- `indexable` is false until the operator says otherwise: a new row page ships
-- noindex and outside the sitemap. `css` is the token-only replacement for
-- APEX's free-form page CSS; the allowed keys are validated by the API.
create table if not exists page (
  id         uuid primary key default gen_random_uuid(),
  path       text not null unique,
  name       text not null,
  kind       text not null default 'row' check (kind in ('code', 'row')),
  group_key  text references page_group(key),
  mode       text not null default 'normal' check (mode in ('normal')),
  template   text not null default 'paddock-standard',
  authz_key  text references authz_scheme(key),
  title      text,
  rendering  text not null default 'cached' check (rendering in ('dynamic', 'cached')),
  indexable  boolean not null default false,
  css        jsonb not null default '{}'::jsonb,
  comments   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- One JSON document per save (regions, items, buttons, dynamic actions), never
-- updated in place. `schema_version` lets a reader refuse or migrate a document
-- shape it does not know. `author` is a Clerk user id with no foreign key: users
-- live in Clerk, not here.
create table if not exists page_revision (
  id               uuid primary key default gen_random_uuid(),
  page_id          uuid not null references page(id) on delete cascade,
  schema_version   int not null default 1,
  document         jsonb not null,
  base_revision_id uuid references page_revision(id),
  author           text,
  created_at       timestamptz not null default now(),
  published_at     timestamptz
);

-- The live revision of a page: newest published. Partial, like page_layout's.
create index if not exists page_revision_live_idx
  on page_revision (page_id, published_at desc)
  where published_at is not null;

-- The newest revision of a page, published or not: the designer's "is my base
-- still the newest" check.
create index if not exists page_revision_newest_idx
  on page_revision (page_id, created_at desc);

-- ---------------------------------------------------------------- lists

-- A shared collection of links (APEX: Lists). `role` says where it renders: menu
-- = the header doors, bar = the phone bar (three to five entries, enforced by the
-- API on save), footer, reference = the reference cards, generic.
create table if not exists list (
  key        text primary key,
  role       text not null check (role in ('menu', 'bar', 'footer', 'reference', 'generic')),
  label      text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- `dest_key` names a destination from the catalogue the code exposes (a page, a
-- series hub, a tab), never a typed URL: the field guide's first rail.
-- `condition` is a server-side condition document evaluated at render.
create table if not exists list_entry (
  id         uuid primary key default gen_random_uuid(),
  list_key   text not null references list(key) on delete cascade,
  seq        int not null default 0,
  label      text not null,
  dest_key   text not null,
  icon       text,
  authz_key  text references authz_scheme(key),
  condition  jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists list_entry_order_idx on list_entry (list_key, seq);

-- ---------------------------------------------------------------- revision refs

-- What a revision points at, one row per reference, written by the API from the
-- document on every save. The foreign keys are the point: deleting a list, a
-- scheme or a build option that a revision still names fails here, in the
-- database, whatever tried it. Exactly one key column is set, matching `kind`.
create table if not exists page_revision_ref (
  id               bigint generated always as identity primary key,
  revision_id      uuid not null references page_revision(id) on delete cascade,
  kind             text not null check (kind in ('list', 'authz', 'build_option', 'dest')),
  list_key         text references list(key),
  authz_key        text references authz_scheme(key),
  build_option_key text references build_option(key),
  dest_key         text,
  constraint page_revision_ref_one_key check (
    (kind = 'list'         and list_key is not null         and authz_key is null and build_option_key is null and dest_key is null) or
    (kind = 'authz'        and authz_key is not null        and list_key is null  and build_option_key is null and dest_key is null) or
    (kind = 'build_option' and build_option_key is not null and list_key is null  and authz_key is null        and dest_key is null) or
    (kind = 'dest'         and dest_key is not null         and list_key is null  and authz_key is null        and build_option_key is null)
  )
);

create unique index if not exists page_revision_ref_uniq
  on page_revision_ref (revision_id, kind, coalesce(list_key, authz_key, build_option_key, dest_key));

-- ---------------------------------------------------------------- the rest of Shared Components

-- Themes as token sets (APEX: Themes). At most one default, enforced by the
-- partial unique index; a visitor's own choice still wins over the default.
create table if not exists theme (
  key        text primary key,
  label      text not null,
  tokens     jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);

create unique index if not exists theme_one_default_idx on theme ((is_default)) where is_default;

-- Named values read at render (APEX: Application Settings). `type` tells the
-- console which control to draw and how to parse `value`.
create table if not exists setting (
  key         text primary key,
  value       text,
  type        text not null default 'text' check (type in ('text', 'number', 'boolean', 'json')),
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- Every fixed string the pages show (APEX: Text Messages). `where_shown` is for
-- the person editing, so a key like `footer.legal` has a face.
create table if not exists text_message (
  key         text primary key,
  text        text not null,
  where_shown text,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- House-style fragments Static Content can reference (APEX: Shortcuts).
create table if not exists shortcut (
  key        text primary key,
  text       text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Redirect rules (APEX: Branches, the pre-rendering kind). Honoured by the
-- catch-all route in Phase 3, so matched routes pay nothing. `dest_key` is a
-- catalogue destination, never a URL.
create table if not exists redirect (
  from_path  text primary key,
  dest_key   text not null,
  status     int not null default 308 check (status in (301, 302, 307, 308)),
  condition  jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- ---------------------------------------------------------------- updated_at triggers

create or replace trigger authz_scheme_updated_at before update on authz_scheme for each row execute function design_set_updated_at();
create or replace trigger build_option_updated_at before update on build_option for each row execute function design_set_updated_at();
create or replace trigger page_group_updated_at   before update on page_group   for each row execute function design_set_updated_at();
create or replace trigger asset_updated_at        before update on asset        for each row execute function design_set_updated_at();
create or replace trigger application_updated_at  before update on application  for each row execute function design_set_updated_at();
create or replace trigger page_updated_at         before update on page         for each row execute function design_set_updated_at();
create or replace trigger list_updated_at         before update on list         for each row execute function design_set_updated_at();
create or replace trigger list_entry_updated_at   before update on list_entry   for each row execute function design_set_updated_at();
create or replace trigger theme_updated_at        before update on theme        for each row execute function design_set_updated_at();
create or replace trigger setting_updated_at      before update on setting      for each row execute function design_set_updated_at();
create or replace trigger text_message_updated_at before update on text_message for each row execute function design_set_updated_at();
create or replace trigger shortcut_updated_at     before update on shortcut     for each row execute function design_set_updated_at();
create or replace trigger redirect_updated_at     before update on redirect     for each row execute function design_set_updated_at();

-- ---------------------------------------------------------------- seeds: the fixed vocabulary

insert into application (key) values ('paddock') on conflict (key) do nothing;

insert into page_group (key, label, seq) values
  ('home', 'Home', 10), ('calendar', 'Calendar', 20), ('series', 'Series', 30),
  ('editorial', 'Editorial', 40), ('account', 'Account', 50), ('site', 'Site', 60)
on conflict (key) do nothing;

insert into authz_scheme (key, label, type, value, message) values
  ('public',        'Public',        'public',    null,    null),
  ('signed_in',     'Signed in',     'signed_in', null,    'Sign in to see this.'),
  ('contributor',   'Contributor',   'author',    null,    'For approved writers.'),
  ('administrator', 'Administrator', 'role',      'admin', null)
on conflict (key) do nothing;

insert into build_option (key, label, status) values
  ('social', 'Social', 'include'), ('studio', 'Studio', 'include'),
  ('ghost_lap_3d', 'Ghost lap 3D', 'include'), ('weather', 'Weather', 'include')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- access

alter table authz_scheme      enable row level security;
alter table build_option      enable row level security;
alter table page_group        enable row level security;
alter table asset             enable row level security;
alter table application       enable row level security;
alter table page              enable row level security;
alter table page_revision     enable row level security;
alter table list              enable row level security;
alter table list_entry        enable row level security;
alter table page_revision_ref enable row level security;
alter table theme             enable row level security;
alter table setting           enable row level security;
alter table text_message      enable row level security;
alter table shortcut          enable row level security;
alter table redirect          enable row level security;

revoke all on table
  authz_scheme, build_option, page_group, asset, application, page, page_revision,
  list, list_entry, page_revision_ref, theme, setting, text_message, shortcut, redirect
from anon, authenticated;
revoke all on sequence page_revision_ref_id_seq from anon, authenticated;

commit;
