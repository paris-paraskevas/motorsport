-- Phase 2, step 7 of the designer plan: the six shipped themes as ROWS, room for
-- the operator's own, and the one way to change the default.
--
-- COLUMNS. `available` says whether a visitor may pick the theme; `base` names
-- the shipped theme a custom theme builds on (null for the six shipped ones,
-- whose colours stay in app/globals.css). A custom theme's nine colours live in
-- `tokens`; lib/design/theme-defaults.ts is the reader and generates the style
-- block that applies them.
--
-- SEEDS. Exactly the six themes the picker offers today, Paper the default
-- (operator, 2026-08-19). Seeded only when the key is absent, so re-applying
-- never overwrites an edit.
--
-- design_set_default_theme(): THE write path for the default (field guide §03,
-- one enforced write path per table). The table allows one default per
-- application (theme_one_default_idx), so clearing the old default and setting
-- the new one must happen in one transaction, which PostgREST cannot offer
-- across requests. It checks the version the caller loaded, the current
-- default's `updated_at` (the 1.0.25 pattern), and raises `stale` when it moved.
begin;

alter table theme add column if not exists available boolean not null default true;
alter table theme add column if not exists base text;

insert into theme (application_key, key, label, tokens, is_default) values
  ('paddock', 'midnight',  'Midnight',  '{}'::jsonb, false),
  ('paddock', 'carbon',    'Carbon',    '{}'::jsonb, false),
  ('paddock', 'ember',     'Ember',     '{}'::jsonb, false),
  ('paddock', 'newsprint', 'Newsprint', '{}'::jsonb, false),
  ('paddock', 'paper',     'Paper',     '{}'::jsonb, true),
  ('paddock', 'circuit',   'Circuit',   '{}'::jsonb, false)
on conflict (application_key, key) do nothing;

create or replace function design_set_default_theme(
  p_application text,
  p_key text,
  p_expected timestamptz,
  p_actor text
) returns timestamptz
language plpgsql as $$
declare
  v_current timestamptz;
  v_stamp timestamptz;
begin
  -- The version check: the stamp of the row that is the default right now.
  select updated_at into v_current
    from theme
   where application_key = p_application and is_default
   for update;
  if v_current is distinct from p_expected then
    raise exception 'stale' using errcode = 'P0001',
      hint = 'The default changed since it was loaded.';
  end if;
  if not exists (
    select 1 from theme where application_key = p_application and key = p_key and available
  ) then
    raise exception 'unknown or unavailable theme: %', p_key using errcode = 'P0002';
  end if;

  update theme set is_default = false, updated_by = p_actor
   where application_key = p_application and is_default;
  update theme set is_default = true, updated_by = p_actor
   where application_key = p_application and key = p_key
   returning updated_at into v_stamp;
  return v_stamp;
end $$;

-- Service role only, like the tables it writes.
revoke all on function design_set_default_theme(text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function design_set_default_theme(text, text, timestamptz, text) to service_role;

commit;
