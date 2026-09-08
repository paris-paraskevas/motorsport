-- Phase 3, step 6 of the designer plan: Save and Run. The preview route
-- (/preview/<revision id>) shows an administrator any revision of a row page,
-- draft or published, wearing the runtime developer toolbar. It is a page the
-- code serves, so it joins the registry like the fifty-seven before it
-- (20260908233000): a row page can never take its path, and the
-- route-collision test fails the build when the registry and the route files
-- disagree. Seeded only where the path is absent.
begin;

insert into page (application_key, path, name, kind, group_key, template, authz_key, rendering, indexable, comments) values
  ('paddock', '/preview/[rev]',                             'Revision preview',        'code', 'site',      'paddock-standard', 'administrator', 'dynamic', false, 'Save and Run: any revision of a row page, for administrators, never indexed')
on conflict (application_key, path) do nothing;

commit;
