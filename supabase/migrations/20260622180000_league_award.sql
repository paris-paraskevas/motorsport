-- Paddock — leagues P4: period prizes (titles/badges for the top 3 by win-rate).
-- NO credits (locked decision) — an award is purely a title + a medal rank, a
-- point-in-time snapshot of a completed period (a calendar month or season/year).
-- Awarded by the daily award-prizes cron at the period boundary; rendered as
-- badges on the league page. Service-role-only (alter default privileges in
-- 094000 grants future tables/functions to service_role; RLS-on/no-policies).

create table league_award (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references league (id) on delete cascade,
  period      text not null,                         -- '2026-06' (month) | '2026-season' (year)
  rank        int  not null check (rank between 1 and 3),
  user_id     text not null references app_user (clerk_user_id),
  title       text not null,                         -- e.g. 'June 2026 Champion'
  wins        int  not null,                         -- period-scoped, snapshotted at award time
  placed      int  not null,
  awarded_at  timestamptz not null default now(),
  unique (league_id, period, rank)                   -- one winner per rank per period (idempotency)
);
create index league_award_user_idx on league_award (user_id);
create index league_award_league_idx on league_award (league_id, period);

alter table league_award enable row level security;

-- Award the top-`p_min_placed`-or-more bettors of a league over a period window,
-- ranked by win-rate then wins. A bet counts toward the period when its market's
-- locks_at (the betting deadline ≈ race weekend, stable & set at creation) falls
-- in [p_start, p_end); only league (peer-pool) bets and only settled outcomes
-- (won/lost) count — void/pending don't, matching league_leaderboard semantics.
-- Idempotent per (league, period): a league that already has any award row for
-- the period is skipped, so the daily cron re-running is a no-op between boundaries.
create or replace function award_league_prizes(
  p_period     text,
  p_label      text,
  p_start      timestamptz,
  p_end        timestamptz,
  p_min_placed int default 3
) returns jsonb language plpgsql as $$
declare
  v_awarded int;
begin
  with stats as (
    select b.league_id,
           b.user_id,
           count(*) filter (where b.outcome = 'won')            as wins,
           count(*) filter (where b.outcome in ('won', 'lost')) as placed
    from bet b
    join market m on m.id = b.market_id
    where b.league_id is not null
      and m.locks_at >= p_start
      and m.locks_at <  p_end
    group by b.league_id, b.user_id
  ),
  ranked as (
    select league_id, user_id, wins, placed,
           row_number() over (
             partition by league_id
             order by (wins::numeric / placed) desc, wins desc, user_id
           ) as rnk
    from stats
    where placed >= greatest(p_min_placed, 1)        -- floor at 1 → no div-by-zero
  )
  insert into league_award (league_id, period, rank, user_id, title, wins, placed)
  select r.league_id, p_period, r.rnk, r.user_id,
         p_label || ' ' || case r.rnk when 1 then 'Champion' when 2 then 'Runner-up' else 'Third' end,
         r.wins, r.placed
  from ranked r
  where r.rnk <= 3
    and not exists (
      select 1 from league_award a
      where a.league_id = r.league_id and a.period = p_period
    )
  on conflict (league_id, period, rank) do nothing;

  get diagnostics v_awarded = row_count;
  return jsonb_build_object('period', p_period, 'awarded', v_awarded);
end;
$$;
