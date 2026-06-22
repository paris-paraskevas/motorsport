-- Paddock Betting — Phase 1c: leagues + pari-mutuel peer pools.
-- A league bet sets bet.league_id; the pool is per (market, league). The
-- pari-mutuel MATH is computed in TS (lib/betting/pari-mutuel.ts, unit-tested)
-- and applied here atomically.

-- Recreate place_bet with an optional league context (default null = solo).
-- A league bet additionally requires the user to be a member of the league.
drop function if exists place_bet(text, uuid, jsonb, bigint);
create or replace function place_bet(
  p_user_id   text,
  p_market_id uuid,
  p_selection jsonb,
  p_stake     bigint,
  p_league_id uuid default null
) returns uuid language plpgsql as $$
declare
  v_status  market_status;
  v_locks   timestamptz;
  v_balance bigint;
  v_bet_id  uuid;
begin
  if p_stake <= 0 then raise exception 'stake must be positive'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id));

  select status, locks_at into v_status, v_locks from market where id = p_market_id;
  if not found then raise exception 'market not found'; end if;
  if v_status <> 'open' or now() >= v_locks then raise exception 'market not open'; end if;

  if p_league_id is not null and not exists (
    select 1 from league_member where league_id = p_league_id and user_id = p_user_id
  ) then
    raise exception 'not a member of this league';
  end if;

  select coalesce(sum(delta), 0) into v_balance from credit_ledger where user_id = p_user_id;
  if v_balance < p_stake then raise exception 'insufficient balance (% < %)', v_balance, p_stake; end if;

  insert into bet (market_id, user_id, league_id, selection_json, stake)
  values (p_market_id, p_user_id, p_league_id, p_selection, p_stake)
  returning id into v_bet_id;

  insert into credit_ledger (user_id, delta, reason, source, ref_id)
  values (p_user_id, -p_stake, 'stake', 'free', v_bet_id::text);

  return v_bet_id;
end;
$$;

-- Apply a pre-computed pari-mutuel settlement for one (market, league) pool,
-- atomically. p_payouts is [{bet_id, user_id, won, payout}, ...] from the TS
-- pool math. Idempotent: refuses to re-settle a pool whose bets aren't pending.
create or replace function apply_league_settlement(
  p_market_id uuid,
  p_league_id uuid,
  p_result    jsonb,
  p_payouts   jsonb
) returns jsonb language plpgsql as $$
declare
  rec jsonb;
  v_won int := 0; v_lost int := 0; v_paid bigint := 0;
begin
  if exists (
    select 1 from bet
    where market_id = p_market_id and league_id = p_league_id and outcome <> 'pending'
  ) then
    raise exception 'league pool already settled for this market';
  end if;

  for rec in select * from jsonb_array_elements(p_payouts) loop
    if (rec->>'payout')::bigint > 0 then
      insert into credit_ledger (user_id, delta, reason, source, ref_id)
      values (rec->>'user_id', (rec->>'payout')::bigint, 'payout', 'free', rec->>'bet_id');
      v_paid := v_paid + (rec->>'payout')::bigint;
    end if;
    update bet set outcome = (rec->>'outcome')::bet_outcome where id = (rec->>'bet_id')::uuid;
    if (rec->>'outcome') = 'won' then
      v_won := v_won + 1;
      update league_member set wins = wins + 1, placed = placed + 1
        where league_id = p_league_id and user_id = rec->>'user_id';
    elsif (rec->>'outcome') = 'lost' then
      v_lost := v_lost + 1;
      update league_member set placed = placed + 1
        where league_id = p_league_id and user_id = rec->>'user_id';
    end if;  -- 'void' (refund) counts toward neither wins nor placed
  end loop;

  insert into settlement (market_id, payout_json)
  values (p_market_id, jsonb_build_object(
    'league', p_league_id, 'won', v_won, 'lost', v_lost, 'paid', v_paid, 'result', p_result));

  return jsonb_build_object('won', v_won, 'lost', v_lost, 'paidCredits', v_paid);
end;
$$;

-- Win-rate leaderboard per league (wins / bets placed); ties broken by wins.
create or replace view league_leaderboard as
  select
    lm.league_id,
    lm.user_id,
    lm.wins,
    lm.placed,
    case when lm.placed > 0 then round(lm.wins::numeric / lm.placed, 4) else 0 end as win_rate
  from league_member lm;
