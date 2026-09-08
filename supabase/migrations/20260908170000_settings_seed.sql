-- Phase 2, step 5 of the designer plan: the first Application Settings as rows
-- (APEX: Application Settings). Seeds exactly the values the code ships today,
-- so the home page and the What's New notice read the same from rows as they
-- did from constants; lib/design/settings.ts is the reader and keeps the shipped
-- value as the fallback for every failure.
--
-- The `setting` table exists since 20260908090000 and carries its application
-- since 20260908110000, so this file only seeds. A setting is one row and its
-- write path is a single conditional update through the API (updated_at
-- equality, the 1.0.25 pattern), refused before the database when the value
-- breaks the key's rule. Seeded only when the key is absent, so re-applying
-- never overwrites an edit.
begin;

insert into setting (application_key, key, value, type, description) values
  ('paddock', 'home.lead_series',          'f1',                                     'text',   'The championship that always leads the live band on the home page when it is running.'),
  ('paddock', 'home.major_series',         '["motogp","wec","indycar","nascar-cup"]', 'json',   'The other championships that earn their own box on the home page when running; everything else shares one row.'),
  ('paddock', 'home.wire_count',           '5',                                      'number', 'How many headlines the home page wire band shows, 1 to 15.'),
  ('paddock', 'home.blog_suggested_count', '3',                                      'number', 'How many further posts are listed beside the lead post on the home page, 0 to 6.'),
  ('paddock', 'announcement.active_id',    'v1.0',                                   'text',   'Which What''s New notice readers see; empty hides it. The notice names the running version, so arm one only when that version is live.')
on conflict (application_key, key) do nothing;

commit;
