-- Monthly credit grant — idempotent per calendar month per user.
-- The app cron calls this for each active user; the "once per month" guarantee
-- lives here (atomic) so two concurrent calls can never double-grant.
--
-- Idempotency key: a partial unique index on (user_id, ref_id) for grant rows,
-- where monthly grants carry ref_id = 'monthly:YYYY-MM'. ON CONFLICT DO NOTHING
-- makes a repeat call this month a no-op. (Manual/ad-hoc grants use a null
-- ref_id and are unconstrained — multiple nulls are distinct.)

create unique index if not exists credit_ledger_monthly_grant_uniq
  on credit_ledger (user_id, ref_id)
  where reason = 'grant';

create or replace function grant_monthly(p_user_id text, p_amount bigint)
returns bigint language plpgsql as $$
declare
  v_id bigint;
begin
  insert into credit_ledger (user_id, delta, reason, source, ref_id)
  values (p_user_id, p_amount, 'grant', 'free', 'monthly:' || to_char(now(), 'YYYY-MM'))
  on conflict (user_id, ref_id) where reason = 'grant'
  do nothing
  returning id into v_id;
  return v_id;  -- null when already granted this month
end;
$$;
comment on function grant_monthly is 'Idempotent monthly free-credit grant; returns ledger id, or null if already granted this calendar month.';
