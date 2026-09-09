-- Regions of the operator's own around a code page's body (the Page Designer
-- plan, PR 3). design_save_page_revision() refused every page that was not a
-- row page; a page the code serves may now carry revisions too. Its document
-- holds the regions the site renders around the code's body (Page Header and
-- Breadcrumb Bar above, Footer and Phone Bar below; the Body stays the code's
-- and the Right Side Column waits for its own decision). Everything else is
-- unchanged: the version check on publish, the refs projection, the page's
-- stamp moving with its newest revision, the grants. Idempotent: create or
-- replace.

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
    select 1 from page where page.application_key = p_application and page.id = p_page_id and page.kind in ('row', 'code')
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

-- Service role only, like the tables it writes.
revoke all on function design_save_page_revision(text, uuid, uuid, jsonb, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function design_save_page_revision(text, uuid, uuid, jsonb, jsonb, text, boolean) to service_role;
