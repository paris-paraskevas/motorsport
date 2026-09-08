-- Phase 2, step 3 of the designer plan: the chrome's fixed strings as rows
-- (APEX: Text Messages). Seeds exactly what the components ship today, so the
-- site reads the same words from rows as it did from code; lib/design/text.ts is
-- the reader and keeps the shipped text as the fallback for every failure.
--
-- No function this time: a message is one row, and its write path is a single
-- conditional update through the API (updated_at equality, the 1.0.25 pattern),
-- which is atomic on its own. Seeded only when the key is absent, so re-applying
-- never overwrites an edit.
begin;

insert into text_message (application_key, key, text, where_shown) values
  ('paddock', 'a11y.skip',      'Skip to content',                'The first link on every page, visible to keyboard users'),
  ('paddock', 'nav.search',     'Browse the site, or search it',  'The header search field on desktop, and its spoken label everywhere'),
  ('paddock', 'footer.site',    'Site',                           'Footer · heading of the first column'),
  ('paddock', 'footer.legal',   'Legal',                          'Footer · heading of the second column'),
  ('paddock', 'footer.blurb',   'Independent motorsport companion, built in the open. Fifteen championships, every session in your own time zone. No account needed to browse.', 'Footer · the one paragraph saying what the site is'),
  ('paddock', 'footer.install', 'Install as an app',              'Footer · the install button')
on conflict (application_key, key) do nothing;

commit;
