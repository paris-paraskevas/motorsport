-- Phase 2, step 1 of the designer plan: the four navigation lists as ROWS, and the
-- one way to save one.
--
-- SEEDS. Exactly what components/AppShell.tsx (the doors), components/BottomBar.tsx
-- (the phone bar) and components/Footer.tsx (Site and Legal) render today, so the
-- site reads the same navigation from rows as it did from code. `dest_key` names
-- an entry of the catalogue in lib/design/destinations.ts, never a URL (the field
-- guide's first rail). Entries are seeded only when a list has none, so
-- re-applying never duplicates a row or overwrites an edit.
--
-- design_save_list(): THE write path for a list's entries (field guide §03, one
-- enforced write path per table). It checks the version the caller loaded
-- (`updated_at` equality, the 1.0.25 studio pattern), replaces the entries and
-- returns the new stamp, all in one transaction, because PostgREST offers none
-- across requests: a save lands whole or raises `stale` and changes nothing.
-- Callers hand `updated_at` back exactly as they received it: the value carries
-- microseconds, and a JavaScript Date would round them away and never match.
begin;

insert into list (application_key, key, role, label) values
  ('paddock', 'doors',        'menu',   'Header doors'),
  ('paddock', 'bar',          'bar',    'Phone bar'),
  ('paddock', 'footer-site',  'footer', 'Footer: Site'),
  ('paddock', 'footer-legal', 'footer', 'Footer: Legal')
on conflict (application_key, key) do nothing;

insert into list_entry (application_key, list_key, seq, label, dest_key, icon)
select 'paddock', 'doors', v.seq, v.label, v.dest, null
from (values (10, 'Calendar', 'calendar'), (20, 'Learn', 'learn'), (30, 'Series', 'series'), (40, 'Blog', 'blog'))
  as v(seq, label, dest)
where not exists (select 1 from list_entry where application_key = 'paddock' and list_key = 'doors');

insert into list_entry (application_key, list_key, seq, label, dest_key, icon)
select 'paddock', 'bar', v.seq, v.label, v.dest, v.icon
from (values
  (10, 'Home', 'home', 'house'),
  (20, 'Calendar', 'calendar', 'calendar-days'),
  (30, 'Learn', 'learn', 'compass'),
  (40, 'Account', 'account', 'circle-user')
) as v(seq, label, dest, icon)
where not exists (select 1 from list_entry where application_key = 'paddock' and list_key = 'bar');

insert into list_entry (application_key, list_key, seq, label, dest_key, icon)
select 'paddock', 'footer-site', v.seq, v.label, v.dest, null
from (values
  (10, 'Home', 'home'), (20, 'About', 'about'), (30, 'Learn', 'learn'), (40, 'News', 'news'),
  (50, 'Blog', 'blog'), (60, 'Write for Paddock', 'write-for-us'), (70, 'Threads', 'threads'),
  (80, 'Release notes', 'changelog'), (90, 'Season archive', 'archive'), (100, 'Account', 'account'),
  (110, 'Contact', 'action:contact'), (120, 'Buy me a coffee', 'external:support'), (130, 'Manage cookies', 'action:cookies')
) as v(seq, label, dest)
where not exists (select 1 from list_entry where application_key = 'paddock' and list_key = 'footer-site');

insert into list_entry (application_key, list_key, seq, label, dest_key, icon)
select 'paddock', 'footer-legal', v.seq, v.label, v.dest, null
from (values
  (10, 'Privacy', 'privacy'), (20, 'Terms', 'terms'), (30, 'Cookies', 'cookies'),
  (40, 'Accessibility', 'accessibility'), (50, 'Do Not Sell or Share', 'do-not-sell'), (60, 'Imprint', 'imprint')
) as v(seq, label, dest)
where not exists (select 1 from list_entry where application_key = 'paddock' and list_key = 'footer-legal');

create or replace function design_save_list(
  p_application text,
  p_key text,
  p_expected timestamptz,
  p_entries jsonb,
  p_actor text
) returns timestamptz
language plpgsql as $$
declare
  v_touched int;
  v_stamp timestamptz;
begin
  -- The version check. The update fires design_set_updated_at, so the row's stamp
  -- moves to now(); a caller holding an older stamp, or naming a list that does
  -- not exist, touches nothing.
  update list
     set updated_by = p_actor
   where application_key = p_application and key = p_key and updated_at = p_expected;
  get diagnostics v_touched = row_count;
  if v_touched = 0 then
    raise exception 'stale' using errcode = 'P0001',
      hint = 'The list changed since it was loaded, or does not exist.';
  end if;

  delete from list_entry where application_key = p_application and list_key = p_key;

  insert into list_entry (application_key, list_key, seq, label, dest_key, icon, authz_key, condition, updated_by)
  select p_application, p_key, (e.ord * 10)::int,
         e.value ->> 'label', e.value ->> 'dest_key',
         nullif(e.value ->> 'icon', ''), nullif(e.value ->> 'authz_key', ''),
         e.value -> 'condition', p_actor
    from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) with ordinality as e(value, ord);

  select updated_at into v_stamp from list where application_key = p_application and key = p_key;
  return v_stamp;
end $$;

-- Service role only, like the tables it writes.
revoke all on function design_save_list(text, text, timestamptz, jsonb, text) from public, anon, authenticated;
grant execute on function design_save_list(text, text, timestamptz, jsonb, text) to service_role;

commit;
