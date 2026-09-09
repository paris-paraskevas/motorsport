-- Component Settings (APEX: Component Settings), the Phase 3 entry of the
-- designer plan: what a region of each kind starts with when it is placed on a
-- page. Three more rows of `setting`, read by the Page Designer when it creates
-- a region (lib/design/setting-defaults.ts holds the same shipped values as the
-- fallback); a region carries its own values from then on, so a default changes
-- no existing page. Seeded only when the key is absent, so re-applying never
-- overwrites an edit. The table exists since 20260908090000 and carries its
-- application since 20260908110000.
begin;

insert into setting (application_key, key, value, type, description) values
  ('paddock', 'region.image.show_caption', 'true',      'boolean', 'Whether a photo placed on a page starts with its caption, credit and licence shown. Each region can still be changed on its page.'),
  ('paddock', 'region.list.style',         'links',     'text',    'How a list placed on a page starts: as plain links, or as cards. Each region can still be changed on its page.'),
  ('paddock', 'region.button.label',       'Read more', 'text',    'The words a button placed on a page starts with, up to 40 characters. Each region can still be changed on its page.')
on conflict (application_key, key) do nothing;

commit;
