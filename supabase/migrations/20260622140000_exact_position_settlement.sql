-- Paddock Betting — exact-finishing-position settlement.
-- Extends settle_market to settle 'exact_position' markets alongside winner /
-- podium / top10. A bet's selection is {"driver":"<name>","position":<n>}; odds
-- are keyed "<driver>@<position>" on the market. It wins when the driver's
-- official finishing position equals the predicted one, passed as
-- p_result = {"positions":{"<driver>":<finishPos>, ...}}. Payout is stake × the
-- per-pair multiplier stored at creation (fixed odds), like the other types.
--
-- Pure CREATE OR REPLACE (additive): winner/podium/top10 branches are unchanged.
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
  v_won int := 0; v_lost int := 0; v_paid bigint := 0;
begin
  select type, status, odds_json into v_type, v_status, v_odds from market where id = p_market_id;
  if not found then raise exception 'market not found'; end if;
  if v_status = 'settled' then raise exception 'market already settled'; end if;

  for r in select * from bet where market_id = p_market_id and outcome = 'pending' loop
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
    else
      v_sel := null;
      v_win := false;
    end if;

    if v_win then
      v_mult := coalesce((v_odds->>v_sel)::numeric, 1);
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
