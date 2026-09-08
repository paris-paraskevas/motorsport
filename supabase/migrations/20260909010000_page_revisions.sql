-- Phase 3, step 2 of the designer plan: row pages get their revisions.
--
-- THE REFS PROJECTION grows two kinds. A page document (lib/design/page-document.ts)
-- names navigation lists, authorization schemes, the operator's photos and the
-- shortcuts its text inserts; the first two had columns since 20260908090000,
-- the last two did not. `asset_id` references the photo's row, `shortcut_key`
-- the shortcut within the application, so a row a published page depends on
-- cannot be deleted unnoticed: the database refuses.
--
-- design_save_page_revision(): THE write path for a revision (field guide §03,
-- one enforced write path per table). One transaction inserts the revision and
-- its references; a publish checks that the base the designer loaded is still
-- the live revision (`stale` otherwise, the 1.0.25 pattern); a draft records
-- its base and refuses nothing. Nothing is ever updated in place: every save is
-- a new row, so every version a page has had stays recoverable.
begin;

alter table page_revision_ref add column if not exists asset_id uuid references asset(id);
alter table page_revision_ref add column if not exists shortcut_key text;
alter table page_revision_ref drop constraint if exists page_revision_ref_shortcut_key_fkey;
alter table page_revision_ref add constraint page_revision_ref_shortcut_key_fkey
  foreign key (application_key, shortcut_key) references shortcut(application_key, key);

alter table page_revision_ref drop constraint if exists page_revision_ref_kind_check;
alter table page_revision_ref add constraint page_revision_ref_kind_check
  check (kind in ('list', 'authz', 'build_option', 'dest', 'asset', 'shortcut'));

alter table page_revision_ref drop constraint if exists page_revision_ref_one_key;
alter table page_revision_ref add constraint page_revision_ref_one_key check (
  (kind = 'list'         and list_key is not null         and authz_key is null and build_option_key is null and dest_key is null and asset_id is null and shortcut_key is null) or
  (kind = 'authz'        and authz_key is not null        and list_key is null  and build_option_key is null and dest_key is null and asset_id is null and shortcut_key is null) or
  (kind = 'build_option' and build_option_key is not null and list_key is null  and authz_key is null        and dest_key is null and asset_id is null and shortcut_key is null) or
  (kind = 'dest'         and dest_key is not null         and list_key is null  and authz_key is null        and build_option_key is null and asset_id is null and shortcut_key is null) or
  (kind = 'asset'        and asset_id is not null         and list_key is null  and authz_key is null        and build_option_key is null and dest_key is null and shortcut_key is null) or
  (kind = 'shortcut'     and shortcut_key is not null     and list_key is null  and authz_key is null        and build_option_key is null and dest_key is null and asset_id is null)
);

create or replace function design_save_page_revision(
  p_application text,
  p_page_id uuid,
  p_base uuid,
  p_document jsonb,
  p_refs jsonb,
  p_actor text,
  p_publish boolean
) returns table (id uuid, created_at timestamptz, published_at timestamptz)
language plpgsql as $$
declare
  v_live uuid;
  v_id uuid;
  v_created timestamptz;
  v_published timestamptz;
begin
  if not exists (
    select 1 from page where page.application_key = p_application and page.id = p_page_id and page.kind = 'row'
  ) then
    raise exception 'no such row page' using errcode = 'P0002';
  end if;

  if p_publish then
    -- The version check: the live revision must still be the one the designer loaded.
    select r.id into v_live
      from page_revision r
     where r.page_id = p_page_id and r.published_at is not null
     order by r.published_at desc
     limit 1;
    if v_live is distinct from p_base then
      raise exception 'stale' using errcode = 'P0001',
        hint = 'The page was published again since it was loaded.';
    end if;
  end if;

  insert into page_revision (page_id, schema_version, document, base_revision_id, author, published_at)
  values (p_page_id, 1, p_document, p_base, p_actor, case when p_publish then now() else null end)
  returning page_revision.id, page_revision.created_at, page_revision.published_at
    into v_id, v_created, v_published;

  insert into page_revision_ref (application_key, revision_id, kind, list_key, authz_key, asset_id, shortcut_key, dest_key)
  select p_application, v_id, r.value ->> 'kind',
         case when r.value ->> 'kind' = 'list'     then r.value ->> 'key' end,
         case when r.value ->> 'kind' = 'authz'    then r.value ->> 'key' end,
         case when r.value ->> 'kind' = 'asset'    then (r.value ->> 'key')::uuid end,
         case when r.value ->> 'kind' = 'shortcut' then r.value ->> 'key' end,
         case when r.value ->> 'kind' = 'dest'     then r.value ->> 'key' end
    from jsonb_array_elements(coalesce(p_refs, '[]'::jsonb)) as r(value);

  -- The page's stamp moves with its newest revision, so the App Builder's list shows it changed.
  update page set updated_by = p_actor where page.application_key = p_application and page.id = p_page_id;

  return query select v_id, v_created, v_published;
end $$;

-- Service role only, like the tables it writes.
revoke all on function design_save_page_revision(text, uuid, uuid, jsonb, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function design_save_page_revision(text, uuid, uuid, jsonb, jsonb, text, boolean) to service_role;

-- design_create_page(): THE write path for a row page. Inserts the page (kind
-- row, the standard template, for everyone, cached, unindexed) and, when the
-- chosen template gives it a first layout, its first draft revision through
-- design_save_page_revision(), in one transaction: a page never exists half
-- made, with a layout that failed to save. Returns the page row.
create or replace function design_create_page(
  p_application text,
  p_path text,
  p_name text,
  p_group text,
  p_actor text,
  p_document jsonb,
  p_refs jsonb
) returns page
language plpgsql as $$
declare
  v_page page;
begin
  insert into page (application_key, path, name, kind, group_key, template, authz_key, rendering, indexable, updated_by)
  values (p_application, p_path, p_name, 'row', p_group, 'paddock-standard', 'public', 'cached', false, p_actor)
  returning * into v_page;

  if p_document is not null then
    perform design_save_page_revision(p_application, v_page.id, null, p_document, p_refs, p_actor, false);
    select * into v_page from page where page.id = v_page.id;
  end if;

  return v_page;
end $$;

revoke all on function design_create_page(text, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function design_create_page(text, text, text, text, text, jsonb, jsonb) to service_role;

commit;
