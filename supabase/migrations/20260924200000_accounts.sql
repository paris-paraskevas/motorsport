-- PA A2 (2026-09-24): the accounts' home on Supabase Auth, before the switch (A3).
--
-- 1. A public bucket for the photos people upload: 2 MB, png, jpeg or webp. Writes go through the service role alone,
--    and no policy is added on storage.objects, so nobody can list the bucket; a public bucket serves a path one knows.
-- 2. Three functions over auth.users, the repo's first `security definer` ones, each with `set search_path = ''` and every
--    table named in full (Supabase's linter rule 0011, function_search_path_mutable). Execute is revoked from public
--    (Postgres grants it to everyone by default), anon and authenticated, and granted to service_role alone, as the
--    design tables revoke their rows (20260908090000_design_tables.sql).
--
-- The app's id for a person is its legacy id (Clerk's user id, kept in app_metadata.legacy_id by the import) when the
-- account was imported, else the Supabase id: coalesce(raw_app_meta_data->>'legacy_id', id::text) everywhere below.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- The people behind app ids: a byline, a notification's address, the accounts card (lib/auth/directory.ts, A3).
create or replace function public.account_directory(p_ids text[])
returns table (id text, name text, username text, image text, email text, role text, donor boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(u.raw_app_meta_data->>'legacy_id', u.id::text) as id,
         nullif(u.raw_user_meta_data->>'full_name', '') as name,
         nullif(u.raw_user_meta_data->>'username', '') as username,
         nullif(u.raw_user_meta_data->>'avatar_url', '') as image,
         u.email::text as email,
         nullif(u.raw_app_meta_data->>'role', '') as role,
         coalesce((u.raw_app_meta_data->>'donor')::boolean, false) as donor
  from auth.users u
  where u.deleted_at is null
    and (u.raw_app_meta_data->>'legacy_id' = any(p_ids) or u.id::text = any(p_ids));
$$;

-- The app ids whose role is admin: the draft-ready push (lib/blog-notify.ts adminUserIds).
create or replace function public.account_admins()
returns setof text
language sql stable security definer set search_path = '' as $$
  select coalesce(u.raw_app_meta_data->>'legacy_id', u.id::text)
  from auth.users u
  where u.deleted_at is null and u.raw_app_meta_data->>'role' = 'admin';
$$;

-- The count and the newest 25 accounts (the app id, the role, when created): the Data workspace's accounts card.
create or replace function public.account_stats()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', (select count(*) from auth.users u where u.deleted_at is null),
    'newest', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', coalesce(n.raw_app_meta_data->>'legacy_id', n.id::text),
        'role', nullif(n.raw_app_meta_data->>'role', ''),
        'created_at', n.created_at))
      from (select * from auth.users u where u.deleted_at is null order by u.created_at desc limit 25) n
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.account_directory(text[]) from public, anon, authenticated;
revoke execute on function public.account_admins() from public, anon, authenticated;
revoke execute on function public.account_stats() from public, anon, authenticated;
grant execute on function public.account_directory(text[]) to service_role;
grant execute on function public.account_admins() to service_role;
grant execute on function public.account_stats() to service_role;

commit;
