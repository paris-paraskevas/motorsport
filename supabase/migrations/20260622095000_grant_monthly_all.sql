-- Set-based monthly grant for every user in ONE statement (the cron entrypoint).
-- ON CONFLICT skips anyone already granted this calendar month, so running it
-- daily is safe — only the first run of the month grants. Returns the number of
-- users granted this run.
create or replace function grant_monthly_all(p_amount bigint)
returns integer language plpgsql as $$
declare n integer;
begin
  insert into credit_ledger (user_id, delta, reason, source, ref_id)
  select clerk_user_id, p_amount, 'grant', 'free', 'monthly:' || to_char(now(), 'YYYY-MM')
  from app_user
  on conflict (user_id, ref_id) where reason = 'grant' do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
comment on function grant_monthly_all is 'Grant the monthly free allowance to every user lacking it this month, in one statement; returns count granted.';
