-- Paddock Betting — forecast settlement.
-- A 'forecast' bet selects ≥2 legs: selection_json = {"legs":[{"driver":"<name>",
-- "position":<n>}, ...]}. It's ALL-OR-NOTHING: every leg's driver must finish in
-- its exact position (p_result = {"positions":{"<driver>":<finishPos>, ...}}, same
-- shape as exact_position). The payout multiplier is the PRODUCT of the legs'
-- stored per-pair odds (odds_json keyed "<driver>@<position>", from
-- exactPositionMultipliers), clamped to 500 — that `least(..., 500)` is the
-- no-900× guarantee for combined longshots.
--
-- Pure CREATE OR REPLACE (additive): winner/podium/top10/exact_position branches
-- are byte-for-byte unchanged; only the `forecast` branch + its multiplier are new.
create or replace function settle_market(p_market_id uuid, p_result jsonb)
returns jsonb language plpgsql as $$
declare
  v_type   market_type;
  v_status market_status;
  v_odds   jsonb;
  r        record;
  v_sel    text;
  v_win    boolean;
  v_mult   numeric;
  v_payout bigint;
  v_fmult  numeric;   -- forecast: clamped product of the legs' per-pair odds
  v_prod   numeric;   -- forecast: running product
  v_all    boolean;   -- forecast: every leg correct so far
  leg      jsonb;     -- forecast: current leg
  v_legs   jsonb;     -- forecast: the legs array
  v_won int := 0; v_lost int := 0; v_paid bigint := 0;
begin
  select type, status, odds_json into v_type, v_status, v_odds from market where id = p_market_id;
  if not found then raise exception 'market not found'; end if;
  if v_status = 'settled' then raise exception 'market already settled'; end if;

  for r in select * from bet where market_id = p_market_id and outcome = 'pending' loop
    v_fmult := null;
    if v_type = 'winner' then
      v_sel := r.selection_json->>'winner';
      v_win := v_sel is not distinct from (p_result->>'winner');
    elsif v_type = 'podium' then
      v_sel := r.selection_json->>'driver';
      v_win := v_sel is not null
               and exists (
                 select 1 from jsonb_array_elements_text(coalesce(p_result->'podium', '[]'::jsonb)) t(name)
                 where t.name = v_sel
               );
    elsif v_type = 'top10' then
      v_sel := r.selection_json->>'driver';
      v_win := v_sel is not null
               and exists (
                 select 1 from jsonb_array_elements_text(coalesce(p_result->'top10', '[]'::jsonb)) t(name)
                 where t.name = v_sel
               );
    elsif v_type = 'exact_position' then
      v_sel := (r.selection_json->>'driver') || '@' || (r.selection_json->>'position');
      v_win := (r.selection_json->>'driver') is not null
               and (p_result->'positions'->>(r.selection_json->>'driver'))::int
                   is not distinct from (r.selection_json->>'position')::int;
    elsif v_type = 'forecast' then
      v_legs := coalesce(r.selection_json->'legs', '[]'::jsonb);
      v_sel := null;
      if jsonb_array_length(v_legs) < 2 then
        v_win := false;          -- a <2-leg / malformed selection can never win
        v_fmult := 1;
      else
        v_all := true;
        v_prod := 1;
        for leg in select * from jsonb_array_elements(v_legs) loop
          -- A leg not priced on this market can never win (defence-in-depth;
          -- selectionForMarket already rejects unpriced legs at placement, so
          -- this is unreachable today — but settlement must never pay an
          -- unpriced leg as ×1 if that guard ever regresses).
          if (v_odds->>((leg->>'driver') || '@' || (leg->>'position'))) is null then
            v_all := false;
          end if;
          if (p_result->'positions'->>(leg->>'driver'))::int
               is distinct from (leg->>'position')::int then
            v_all := false;       -- this leg missed → the whole forecast loses
          end if;
          v_prod := v_prod * coalesce((v_odds->>((leg->>'driver') || '@' || (leg->>'position')))::numeric, 1);
        end loop;
        v_win := v_all;
        v_fmult := least(v_prod, 500);   -- THE no-900× clamp
      end if;
    else
      v_sel := null;
      v_win := false;
    end if;

    if v_win then
      v_mult := case when v_type = 'forecast' then v_fmult else coalesce((v_odds->>v_sel)::numeric, 1) end;
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
