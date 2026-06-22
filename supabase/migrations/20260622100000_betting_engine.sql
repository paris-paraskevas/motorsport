-- Paddock Betting — Phase 1b engine (solo vs house).
-- Odds are server-authoritative: priced once at market creation into
-- market.odds_json (a {selection -> multiplier} map), immutable for the window,
-- so a client can never inject its own multiplier and settlement is fixed-odds.

alter table market add column if not exists odds_json jsonb;

-- Place a bet: atomic validate (market open, sufficient balance) → insert bet →
-- deduct the stake from the ledger. A per-user advisory lock serialises a
-- single user's concurrent bets so they can't overspend across markets.
create or replace function place_bet(
  p_user_id   text,
  p_market_id uuid,
  p_selection jsonb,
  p_stake     bigint
) returns uuid language plpgsql as $$
declare
  v_status  market_status;
  v_locks   timestamptz;
  v_balance bigint;
  v_bet_id  uuid;
begin
  if p_stake <= 0 then raise exception 'stake must be positive'; end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id));  -- serialise this user's bets

  select status, locks_at into v_status, v_locks from market where id = p_market_id;
  if not found then raise exception 'market not found'; end if;
  if v_status <> 'open' or now() >= v_locks then raise exception 'market not open'; end if;

  select coalesce(sum(delta), 0) into v_balance from credit_ledger where user_id = p_user_id;
  if v_balance < p_stake then raise exception 'insufficient balance (% < %)', v_balance, p_stake; end if;

  insert into bet (market_id, user_id, league_id, selection_json, stake)
  values (p_market_id, p_user_id, null, p_selection, p_stake)
  returning id into v_bet_id;

  insert into credit_ledger (user_id, delta, reason, source, ref_id)
  values (p_user_id, -p_stake, 'stake', 'free', v_bet_id::text);

  return v_bet_id;
end;
$$;

-- Settle a 'winner' market once against the official result (provisional-is-final:
-- settles a market exactly once, no claw-back). Winning bets are paid
-- stake × the multiplier stored on the market at creation (fixed odds). Other
-- market types (podium/top10) are Phase 1c+ and currently mark bets lost.
create or replace function settle_market(p_market_id uuid, p_result jsonb)
returns jsonb language plpgsql as $$
declare
  v_type   market_type;
  v_status market_status;
  v_odds   jsonb;
  r        record;
  v_win    boolean;
  v_mult   numeric;
  v_payout bigint;
  v_won int := 0; v_lost int := 0; v_paid bigint := 0;
begin
  select type, status, odds_json into v_type, v_status, v_odds from market where id = p_market_id;
  if not found then raise exception 'market not found'; end if;
  if v_status = 'settled' then raise exception 'market already settled'; end if;

  for r in select * from bet where market_id = p_market_id and outcome = 'pending' loop
    if v_type = 'winner' then
      v_win := (r.selection_json->>'winner') is not distinct from (p_result->>'winner');
    else
      v_win := false;  -- podium/top10 settlement: Phase 1c+
    end if;

    if v_win then
      v_mult := coalesce((v_odds->>(r.selection_json->>'winner'))::numeric, 1);
      v_payout := floor(r.stake * v_mult)::bigint;
      insert into credit_ledger (user_id, delta, reason, source, ref_id)
      values (r.user_id, v_payout, 'payout', 'free', r.id::text);
      update bet set outcome = 'won', multiplier = v_mult where id = r.id;
      v_won := v_won + 1; v_paid := v_paid + v_payout;
      if r.league_id is not null then
        update league_member set wins = wins + 1, placed = placed + 1
         where league_id = r.league_id and user_id = r.user_id;
      end if;
    else
      update bet set outcome = 'lost' where id = r.id;
      v_lost := v_lost + 1;
      if r.league_id is not null then
        update league_member set placed = placed + 1
         where league_id = r.league_id and user_id = r.user_id;
      end if;
    end if;
  end loop;

  update market set status = 'settled', result_json = p_result, settled_at = now()
   where id = p_market_id;
  insert into settlement (market_id, payout_json)
  values (p_market_id, jsonb_build_object('won', v_won, 'lost', v_lost, 'paid', v_paid));

  return jsonb_build_object('won', v_won, 'lost', v_lost, 'paidCredits', v_paid);
end;
$$;
