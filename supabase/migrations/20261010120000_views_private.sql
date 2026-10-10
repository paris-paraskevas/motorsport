-- O5 (2026-10-10; prod on the operator's "apply o5-views", 12:53:32Z): the four views in `public` ran with their
-- owner's rights (Postgres' default, SECURITY DEFINER) and granted every privilege to `anon` and `authenticated`, so
-- anyone holding the project's public key could read them through the Data API, the betting balances included (the
-- Security Advisor's lint 0010, security_definer_view). The site reads them only on the server through the service
-- role (lib/betting/client.ts betDb: credits, standings, session results), which bypasses row-level security and
-- keeps its grants, so readers see no change. Rehearsed inside begin…rollback first: as the service role the four
-- views returned the same row counts after the change (14, 344, 1,373, 5), and `anon` and `authenticated` read none.
begin;

alter view public.user_balance set (security_invoker = on);
alter view public.standing_current set (security_invoker = on);
alter view public.session_result_current set (security_invoker = on);
alter view public.league_leaderboard set (security_invoker = on);

revoke all on public.user_balance, public.standing_current, public.session_result_current, public.league_leaderboard
  from anon, authenticated;

commit;
