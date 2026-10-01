-- X6 A (2026-09-30): the release page, /changelog/<release>, one release's every update, prerendered at build from
-- RELEASES.md (which stays out of the Worker bundle) for every release of the bundled index; the changelog lists the
-- releases and the newest one's newest updates. A page the code serves, so it joins the registry like the preview route
-- did (20260909030000): a row page can never take its path, and the route-collision test fails the build when the
-- registry and the route files disagree. Seeded only where the path is absent; prod on the operator's "apply".
begin;

insert into page (application_key, path, name, kind, group_key, template, authz_key, rendering, indexable, comments) values
  ('paddock', '/changelog/[release]',                        'Release notes',           'code', 'editorial', 'paddock-standard', 'public',        'cached',  true,  'One release''s every update, prerendered at build from RELEASES.md; the changelog lists the releases')
on conflict (application_key, path) do nothing;

commit;
