-- P1.12 Delete Page cascade and soft delete (the components programme; APEX:
-- Delete Page removes the page with its list and breadcrumb entries; the
-- recovery window is ours). A page made in the designer is no longer deleted
-- outright: `deleted_at` and `deleted_by` mark it Deleted, every reader skips
-- it, and it stays thirty days for Reinstate before it may be removed for good.
-- Its address stays its own meanwhile (the path is unique per application), so
-- no new page can take it until the purge.
--
-- design_save_page_revision() refuses a deleted page ('page deleted', P0003), so
-- no save lands on one whatever tried it. design_purge_page() is THE write path
-- for the removal (field guide §03, one enforced write path): refused while any
-- page's LIVE revision (the newest published one per page) names the page as a
-- destination (page_revision_ref kind 'dest', dest_key 'page:<id>'), because
-- revisions are forever and cannot be edited; it deletes the page's list
-- entries (APEX's rule: they go with the page) and then the page, whose
-- revisions and refs cascade. Idempotent: add column if not exists, create or
-- replace.

begin;

alter table page add column if not exists deleted_at timestamptz;
alter table page add column if not exists deleted_by text;

-- The Deleted view's read: the deleted rows of one application, newest first.
create index if not exists page_deleted_idx on page (application_key, deleted_at) where deleted_at is not null;

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
  -- A deleted page takes no save (P1.12): Reinstate it first.
  if exists (
    select 1 from page where page.application_key = p_application and page.id = p_page_id and page.deleted_at is not null
  ) then
    raise exception 'page deleted' using errcode = 'P0003', hint = 'Reinstate the page before saving it.';
  end if;
  if not exists (
    select 1 from page where page.application_key = p_application and page.id = p_page_id and page.kind in ('row', 'code') and page.deleted_at is null
  ) then
    raise exception 'no such page' using errcode = 'P0002';
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

revoke all on function design_save_page_revision(text, uuid, uuid, jsonb, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function design_save_page_revision(text, uuid, uuid, jsonb, jsonb, text, boolean) to service_role;

-- design_purge_page(): THE write path for removing a page for good. False when
-- the page is not there (already gone: a no-op, so a repeated click is safe).
-- Raises 'referenced: <names>' while a live page names the page (the names
-- joined by ' · ', since a page's name may hold a comma). Then the page's list
-- entries go, then the page; its revisions and their refs cascade.
create or replace function design_purge_page(p_application text, p_page_id uuid) returns boolean
language plpgsql as $$
declare
  v_names text;
begin
  if not exists (
    select 1 from page where page.application_key = p_application and page.id = p_page_id and page.kind = 'row'
  ) then
    return false;
  end if;

  -- The LIVE revision of every other page: the newest published one, of a page that is itself live.
  with live as (
    select distinct on (r.page_id) r.id, r.page_id
      from page_revision r
      join page p on p.id = r.page_id
     where p.application_key = p_application and p.deleted_at is null and r.published_at is not null
     order by r.page_id, r.published_at desc
  )
  select string_agg(p.name, ' · ' order by p.name) into v_names
    from live
    join page_revision_ref f on f.revision_id = live.id and f.kind = 'dest' and f.dest_key = 'page:' || p_page_id::text
    join page p on p.id = live.page_id;
  if v_names is not null then
    raise exception 'referenced: %', v_names using errcode = 'P0001',
      hint = 'A live page names this page as a destination; change that page first.';
  end if;

  -- APEX's rule: the page's list entries go with it. Inert until an entry may
  -- name a page (P1.12's PR B1 brings the page:<id> destinations).
  delete from list_entry using list
   where list.application_key = p_application
     and list.key = list_entry.list_key
     and list_entry.dest_key = 'page:' || p_page_id::text;

  delete from page where page.application_key = p_application and page.id = p_page_id;
  return true;
end $$;

revoke all on function design_purge_page(text, uuid) from public, anon, authenticated;
grant execute on function design_purge_page(text, uuid) to service_role;

commit;
