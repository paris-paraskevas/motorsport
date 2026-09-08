-- Phase 2, step 9 of the designer plan: Shortcuts (APEX: Shortcuts), house-style
-- fragments a Static Content box will insert by key in Phase 3, so one edit
-- changes every page that uses one. Nothing on the site reads them yet; this
-- seeds three examples the operator may edit or delete, each written from a
-- phrase the site already uses in some form. The list is the operator's: unlike
-- text messages, shortcuts are added and removed in the designer.
--
-- No function: a shortcut is one row, and its write path is a single
-- conditional statement through the API (updated_at equality, the 1.0.25
-- pattern). Seeded only when the key is absent, so re-applying never overwrites
-- an edit; it would re-insert a seed the operator deleted, which is why the
-- migration is applied once and the seeds are examples, not values the site
-- depends on.
begin;

insert into shortcut (application_key, key, text) values
  ('paddock', 'times.local',     'All times are shown in your local time zone.'),
  ('paddock', 'wire.linked_out', 'Reported elsewhere. Every headline links out to its source.'),
  ('paddock', 'data.sources',    'Results and standings follow the official timing and the stewards'' documents; we correct them when they do.')
on conflict (application_key, key) do nothing;

commit;
