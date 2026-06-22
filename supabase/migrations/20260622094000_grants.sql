-- Grant table/function privileges to service_role (our server-side client).
-- RLS stays ON with no policies; service_role has BYPASSRLS, so these grants +
-- RLS-on means: only the backend (service_role) can touch the betting tables,
-- anon/authenticated get nothing. Granting service_role only (not anon/
-- authenticated) keeps the surface tight even at the table-privilege level.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Same for objects created later (future migrations).
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
