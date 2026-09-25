-- PA A3 (2026-09-24): the Account details page (/settings/account: name, photo, email, password; the provider's
-- Manage account before) is a page the code serves, so it joins the registry like the pages before it
-- (20260908233000, 20260909030000): a row page can never take its path, and the route-collision test fails the build
-- when the registry and the route files disagree. Seeded only where the path is absent.
begin;

insert into page (application_key, path, name, kind, group_key, template, authz_key, rendering, indexable, comments) values
  ('paddock', '/settings/account', 'Settings, account details', 'code', 'account', 'paddock-standard', 'signed_in', 'dynamic', false, 'The Account details page under Settings (PA A3): name, photo, email, password, where the person signs in from, every device signed out, the account deleted.')
on conflict (application_key, path) do nothing;

commit;
