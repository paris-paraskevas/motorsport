-- Phase 2, step 0 of the designer plan: the design tables become MULTI-APPLICATION
-- while they are still empty. Operator decision, 2026-09-08: the designer grows
-- into "paddock-developer", a workspace others can build applications in, so the
-- tenant column goes in now, while it costs nothing, rather than after Phase 2
-- has filled the tables (a backfill and a pass over every editor).
--
-- The shape. Every catalogue table gains `application_key` (default 'paddock',
-- foreign key to `application`), and its key becomes unique PER APPLICATION rather
-- than globally, so two applications can both own a list called `doors` and a
-- scheme called `administrator`. The child tables that name catalogue keys
-- (`list_entry`, `page_revision_ref`) carry the column too, so their references
-- become composite foreign keys: an entry cannot point at another application's
-- list. `page_revision` inherits tenancy through `page` and needs nothing.
-- `application` loses its one-row check. Paddock's rows are the seeds; the column
-- default stamps them 'paddock'.
--
-- Not enforced here, enforced by the API: `page_revision_ref.application_key`
-- equals the application of the revision's page. A trigger could do it; the API
-- writes both from the same row, and a check that reads through two joins is not
-- worth its cost on an insert path that runs on every save.
--
-- Order matters: the foreign keys that point at single-column keys are dropped
-- first (old and new names, so the file re-applies cleanly), the keys are rebuilt
-- as (application_key, key), then the foreign keys return as composites under the
-- names they had. One transaction: a failure applies nothing.
begin;

-- ---------------------------------------------------------------- application: many rows
alter table application drop constraint if exists application_key_check;

-- ---------------------------------------------------------------- the tenant column
alter table authz_scheme      add column if not exists application_key text not null default 'paddock' references application(key);
alter table build_option      add column if not exists application_key text not null default 'paddock' references application(key);
alter table page_group        add column if not exists application_key text not null default 'paddock' references application(key);
alter table asset             add column if not exists application_key text not null default 'paddock' references application(key);
alter table page              add column if not exists application_key text not null default 'paddock' references application(key);
alter table list              add column if not exists application_key text not null default 'paddock' references application(key);
alter table list_entry        add column if not exists application_key text not null default 'paddock' references application(key);
alter table page_revision_ref add column if not exists application_key text not null default 'paddock' references application(key);
alter table theme             add column if not exists application_key text not null default 'paddock' references application(key);
alter table setting           add column if not exists application_key text not null default 'paddock' references application(key);
alter table text_message      add column if not exists application_key text not null default 'paddock' references application(key);
alter table shortcut          add column if not exists application_key text not null default 'paddock' references application(key);
alter table redirect          add column if not exists application_key text not null default 'paddock' references application(key);

-- ---------------------------------------------------------------- references to single-column keys, out of the way
alter table page              drop constraint if exists page_group_key_fkey;
alter table page              drop constraint if exists page_authz_key_fkey;
alter table list_entry        drop constraint if exists list_entry_list_key_fkey;
alter table list_entry        drop constraint if exists list_entry_authz_key_fkey;
alter table page_revision_ref drop constraint if exists page_revision_ref_list_key_fkey;
alter table page_revision_ref drop constraint if exists page_revision_ref_authz_key_fkey;
alter table page_revision_ref drop constraint if exists page_revision_ref_build_option_key_fkey;

-- ---------------------------------------------------------------- keys become per application
alter table authz_scheme drop constraint if exists authz_scheme_pkey;
alter table authz_scheme add constraint authz_scheme_pkey primary key (application_key, key);
alter table build_option drop constraint if exists build_option_pkey;
alter table build_option add constraint build_option_pkey primary key (application_key, key);
alter table page_group   drop constraint if exists page_group_pkey;
alter table page_group   add constraint page_group_pkey primary key (application_key, key);
alter table list         drop constraint if exists list_pkey;
alter table list         add constraint list_pkey primary key (application_key, key);
alter table theme        drop constraint if exists theme_pkey;
alter table theme        add constraint theme_pkey primary key (application_key, key);
alter table setting      drop constraint if exists setting_pkey;
alter table setting      add constraint setting_pkey primary key (application_key, key);
alter table text_message drop constraint if exists text_message_pkey;
alter table text_message add constraint text_message_pkey primary key (application_key, key);
alter table shortcut     drop constraint if exists shortcut_pkey;
alter table shortcut     add constraint shortcut_pkey primary key (application_key, key);
alter table redirect     drop constraint if exists redirect_pkey;
alter table redirect     add constraint redirect_pkey primary key (application_key, from_path);
-- A path is unique within an application; `id` stays the page's identity.
alter table page         drop constraint if exists page_path_key;
alter table page         add constraint page_path_key unique (application_key, path);
-- `asset.r2_key` stays globally unique: it is a storage path, not a name.

-- ---------------------------------------------------------------- the references return, composite
-- MATCH SIMPLE (the default): a null group or scheme is still "none", not a violation.
alter table page add constraint page_group_key_fkey
  foreign key (application_key, group_key) references page_group(application_key, key);
alter table page add constraint page_authz_key_fkey
  foreign key (application_key, authz_key) references authz_scheme(application_key, key);
alter table list_entry add constraint list_entry_list_key_fkey
  foreign key (application_key, list_key) references list(application_key, key) on delete cascade;
alter table list_entry add constraint list_entry_authz_key_fkey
  foreign key (application_key, authz_key) references authz_scheme(application_key, key);
alter table page_revision_ref add constraint page_revision_ref_list_key_fkey
  foreign key (application_key, list_key) references list(application_key, key);
alter table page_revision_ref add constraint page_revision_ref_authz_key_fkey
  foreign key (application_key, authz_key) references authz_scheme(application_key, key);
alter table page_revision_ref add constraint page_revision_ref_build_option_key_fkey
  foreign key (application_key, build_option_key) references build_option(application_key, key);

-- ---------------------------------------------------------------- indexes that were per site are now per application
drop index if exists theme_one_default_idx;
create unique index theme_one_default_idx on theme (application_key) where is_default;
drop index if exists list_entry_order_idx;
create index list_entry_order_idx on list_entry (application_key, list_key, seq);

commit;
