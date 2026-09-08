-- Phase 3, step 1 of the designer plan: the page registry (APEX: the App
-- Builder's page list). Every route the site serves today becomes a `page` row
-- of kind `code`, in its group, with how it renders, whether its own metadata
-- lets search engines index it, and the access scheme it enforces in the code.
-- The App Builder lists these read-only; a row page (step 2) can never take a
-- path listed here, and lib/design/page-registry.test.ts fails the build when
-- this list and the route files disagree.
--
-- PATHS are written as Next names them in the file system (`/series/[slug]/[tab]`);
-- a library-owned optional catch-all (`/sign-in/[[...sign-in]]`) is registered
-- as its parent. Seeded only where the path is absent, so re-applying never
-- overwrites an edit. No function: nothing writes these rows yet.
begin;

insert into page (application_key, path, name, kind, group_key, template, authz_key, rendering, indexable, comments) values
  ('paddock', '/',                                          'Home',                    'code', 'home',      'paddock-standard', 'public',      'cached',  true,  null),

  ('paddock', '/calendar',                                  'Calendar',                'code', 'calendar',  'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/archive',                                   'Season archive',          'code', 'calendar',  'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/archive/[season]/[slug]',                   'Archived season',         'code', 'calendar',  'paddock-standard', 'public',      'cached',  false, null),
  ('paddock', '/archive/[season]/[slug]/weekend/[round]',   'Archived weekend',        'code', 'calendar',  'paddock-standard', 'public',      'cached',  false, null),

  ('paddock', '/series',                                    'Series',                  'code', 'series',    'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/series/[slug]',                             'Series hub',              'code', 'series',    'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/series/[slug]/[tab]',                       'Series tab',              'code', 'series',    'paddock-standard', 'public',      'cached',  true,  'standings, results, drivers, teams, champions and the rest; an empty tab says noindex on its own'),
  ('paddock', '/series/[slug]/weekend/[round]',             'Race weekend',            'code', 'series',    'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/series/[slug]/weekend/[round]/[session]',   'Session',                 'code', 'series',    'paddock-standard', 'public',      'dynamic', true,  null),
  ('paddock', '/drivers/[slug]',                            'Driver profile',          'code', 'series',    'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/teams/[slug]',                              'Team profile',            'code', 'series',    'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/f1/analysis',                               'F1 qualifying analysis',  'code', 'series',    'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/f1/compare',                                'F1 compare',              'code', 'series',    'paddock-standard', 'public',      'cached',  true,  null),

  ('paddock', '/blog',                                      'Blog',                    'code', 'editorial', 'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/blog/[slug]',                               'Blog post',               'code', 'editorial', 'paddock-standard', 'public',      'dynamic', true,  null),
  ('paddock', '/news',                                      'News wire',               'code', 'editorial', 'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/information',                               'Learn',                   'code', 'editorial', 'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/information/[topic]',                       'Learn topic',             'code', 'editorial', 'paddock-standard', 'public',      'cached',  false, null),
  ('paddock', '/information/[topic]/[slug]',                'Learn answer',            'code', 'editorial', 'paddock-standard', 'public',      'cached',  false, null),
  ('paddock', '/information/map',                           'Tracks map',              'code', 'editorial', 'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/information/series-guides',                 'Series guides',           'code', 'editorial', 'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/authors',                                   'Authors',                 'code', 'editorial', 'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/authors/[slug]',                            'Author profile',          'code', 'editorial', 'paddock-standard', 'public',      'cached',  false, null),
  ('paddock', '/changelog',                                 'Changelog',               'code', 'editorial', 'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/write-for-us',                              'Write for us',            'code', 'editorial', 'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/contribute',                                'Contribute',              'code', 'editorial', 'paddock-standard', 'public',      'cached',  false, null),
  ('paddock', '/studio',                                    'Studio',                  'code', 'editorial', 'paddock-standard', 'contributor', 'cached',  true,  'the code sets no robots rule on the studio pages; they are for approved writers'),
  ('paddock', '/studio/[id]',                               'Studio draft',            'code', 'editorial', 'paddock-standard', 'contributor', 'cached',  true,  null),
  ('paddock', '/studio/new',                                'Studio, new draft',       'code', 'editorial', 'paddock-standard', 'contributor', 'cached',  true,  null),

  ('paddock', '/settings',                                  'Settings',                'code', 'account',   'paddock-standard', 'signed_in',   'dynamic', false, null),
  ('paddock', '/settings/assistant',                        'Settings, assistant',     'code', 'account',   'paddock-standard', 'signed_in',   'dynamic', false, null),
  ('paddock', '/settings/author',                           'Settings, author',        'code', 'account',   'paddock-standard', 'signed_in',   'dynamic', false, null),
  ('paddock', '/settings/notifications',                    'Settings, notifications', 'code', 'account',   'paddock-standard', 'signed_in',   'dynamic', false, null),
  ('paddock', '/settings/series',                           'Settings, series',        'code', 'account',   'paddock-standard', 'signed_in',   'dynamic', false, null),
  ('paddock', '/settings/theme',                            'Settings, theme',         'code', 'account',   'paddock-standard', 'public',      'cached',  false, null),
  ('paddock', '/sign-in',                                   'Sign in',                 'code', 'account',   'paddock-standard', 'public',      'dynamic', false, 'Clerk''s optional catch-all, /sign-in/[[...sign-in]] in the code'),
  ('paddock', '/sign-up',                                   'Sign up',                 'code', 'account',   'paddock-standard', 'public',      'dynamic', false, 'Clerk''s optional catch-all, /sign-up/[[...sign-up]] in the code'),
  ('paddock', '/social',                                    'Social',                  'code', 'account',   'paddock-standard', 'public',      'dynamic', true,  null),
  ('paddock', '/social/friends',                            'Friends',                 'code', 'account',   'paddock-standard', 'signed_in',   'dynamic', false, null),
  ('paddock', '/social/friends/add/[id]',                   'Add a friend',            'code', 'account',   'paddock-standard', 'signed_in',   'dynamic', false, null),
  ('paddock', '/social/leagues',                            'Leagues',                 'code', 'account',   'paddock-standard', 'signed_in',   'dynamic', false, null),
  ('paddock', '/social/leagues/[id]',                       'League',                  'code', 'account',   'paddock-standard', 'signed_in',   'dynamic', false, null),
  ('paddock', '/social/leagues/join/[token]',               'Join a league',           'code', 'account',   'paddock-standard', 'signed_in',   'dynamic', false, null),
  ('paddock', '/social/threads',                            'Threads',                 'code', 'account',   'paddock-standard', 'public',      'dynamic', true,  null),
  ('paddock', '/social/users/[id]',                         'Member profile',          'code', 'account',   'paddock-standard', 'signed_in',   'dynamic', false, null),
  ('paddock', '/threads/[id]',                              'Thread',                  'code', 'account',   'paddock-standard', 'public',      'dynamic', false, 'reading is public; posting needs a sign-in'),
  ('paddock', '/feedback',                                  'Feedback',                'code', 'account',   'paddock-standard', 'public',      'dynamic', false, null),
  ('paddock', '/contact',                                   'Contact',                 'code', 'account',   'paddock-standard', 'public',      'cached',  true,  null),

  ('paddock', '/about',                                     'About',                   'code', 'site',      'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/accessibility',                             'Accessibility',           'code', 'site',      'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/privacy',                                   'Privacy',                 'code', 'site',      'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/terms',                                     'Terms',                   'code', 'site',      'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/cookies',                                   'Cookies',                 'code', 'site',      'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/do-not-sell',                               'Do not sell',             'code', 'site',      'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/impressum',                                 'Impressum',               'code', 'site',      'paddock-standard', 'public',      'cached',  true,  null),
  ('paddock', '/imprint',                                   'Imprint',                 'code', 'site',      'paddock-standard', 'public',      'cached',  true,  null)
on conflict (application_key, path) do nothing;

commit;
