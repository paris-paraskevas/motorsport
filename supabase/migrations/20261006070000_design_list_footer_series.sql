-- X13 (2026-10-05; prod on the operator's "apply footer seed", 2026-10-06): the footer's third column, the Series list,
-- seeded so the designer lists and edits it; readers see the same fifteen from lib/design/lists.ts DEFAULT_NAV.footerSeries
-- until the rows exist, and the reader keeps that shipped list as its fallback. The shape is 20260908130000's (the shell
-- lists' seed): insert where absent, nothing on conflict. The heading's text_message row rides with it (footer.series,
-- lib/design/text-defaults.ts): the Text Messages editor saves a heading only where its row exists, and 20260908150000
-- seeded the other footer headings without this one.
begin;

insert into text_message (application_key, key, text, where_shown) values
  ('paddock', 'footer.series', 'Series', 'Footer · heading of the third column')
on conflict (application_key, key) do nothing;

insert into list (application_key, key, role, label) values
  ('paddock', 'footer-series', 'footer', 'Footer: Series')
on conflict (application_key, key) do nothing;

insert into list_entry (application_key, list_key, seq, label, dest_key, icon)
select 'paddock', 'footer-series', v.seq, v.label, v.dest, null
from (values
  (10, 'Formula 1', 'series:f1'), (20, 'Formula 2', 'series:f2'), (30, 'Formula 3', 'series:f3'),
  (40, 'Formula E', 'series:formula-e'), (50, 'MotoGP', 'series:motogp'), (60, 'FIA WEC', 'series:wec'),
  (70, 'IMSA', 'series:imsa'), (80, 'GT World Challenge', 'series:gt-world'), (90, 'DTM', 'series:dtm'),
  (100, 'IndyCar', 'series:indycar'), (110, 'NASCAR Cup', 'series:nascar-cup'), (120, 'WorldSBK', 'series:wsbk'),
  (130, 'WRC', 'series:wrc'), (140, 'ADAC Ravenol 24h Nürburgring', 'series:adac-ravenol-24h'), (150, 'NLS Nürburgring', 'series:nls')
) as v(seq, label, dest)
where not exists (select 1 from list_entry where application_key = 'paddock' and list_key = 'footer-series');

commit;
