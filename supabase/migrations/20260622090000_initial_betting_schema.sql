-- Paddock Betting — initial schema (S9 / Phase 1a)
-- Design: docs/research/predictions-design.md §6.
--
-- Access model: Clerk is the auth layer, NOT Supabase Auth. The Next.js API
-- routes talk to this DB with the service_role key (server-side only). So RLS
-- is enabled on every table with NO policies → anon/authenticated keys can
-- touch nothing; only service_role (our backend) can. All access is mediated
-- by our authenticated API routes.
--
-- Credits are integers (bigint) — the smallest indivisible unit — so the ledger
-- can never drift the way float money does. Pari-mutuel division rounds down;
-- the remainder is handled in settlement, never as a sub-credit fraction.

-- ---- enums -----------------------------------------------------------------
create type credit_reason as enum ('grant', 'purchase', 'stake', 'payout', 'refund', 'reversal');
create type credit_source as enum ('free', 'paid');
create type market_type   as enum ('winner', 'podium', 'top10', 'exact_position');
create type market_status as enum ('open', 'locked', 'settled', 'void');
create type bet_outcome   as enum ('pending', 'won', 'lost', 'void');
create type league_mode   as enum ('house', 'peer_pool');

-- ---- users (mirror of Clerk identity) --------------------------------------
create table app_user (
  clerk_user_id   text primary key,
  display_name    text,
  dob             date,
  age_verified_at timestamptz,
  created_at      timestamptz not null default now()
);
comment on table app_user is 'Mirror of Clerk identity. dob/age_verified_at gate paid + 18+ features.';

-- ---- credit ledger (APPEND-ONLY source of truth for balance) ---------------
create table credit_ledger (
  id          bigint generated always as identity primary key,
  user_id     text not null references app_user (clerk_user_id),
  delta       bigint not null,                    -- +grant/+payout/+refund, -stake
  reason      credit_reason not null,
  source      credit_source not null default 'free',
  ref_id      text,                               -- bet id / market id / purchase id
  created_at  timestamptz not null default now()
);
comment on table credit_ledger is 'APPEND-ONLY. Balance = SUM(delta). Mutation blocked by trigger below.';
create index credit_ledger_user_idx on credit_ledger (user_id);

-- Enforce append-only at the DB (belt-and-suspenders; blocks even service_role).
create or replace function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'credit_ledger is append-only (no UPDATE/DELETE)';
end;
$$;
create trigger credit_ledger_no_mutation
  before update or delete on credit_ledger
  for each row execute function forbid_mutation();

-- Spendable balance = SUM of a user's ledger deltas.
create view user_balance as
  select user_id, coalesce(sum(delta), 0)::bigint as balance
  from credit_ledger
  group by user_id;

-- ---- markets (a bettable event) --------------------------------------------
create table market (
  id           uuid primary key default gen_random_uuid(),
  series_slug  text not null,
  round        int  not null,
  session_uid  text,
  type         market_type not null,
  opens_at     timestamptz,
  locks_at     timestamptz not null,             -- bets reject after this (session start)
  status       market_status not null default 'open',
  result_json  jsonb,                            -- official final classification at settle
  settled_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (series_slug, round, session_uid, type)
);
create index market_series_round_idx on market (series_slug, round);
create index market_status_locks_idx on market (status, locks_at);

-- ---- leagues ---------------------------------------------------------------
create table league (
  id         uuid primary key default gen_random_uuid(),
  owner_id   text not null references app_user (clerk_user_id),
  name       text not null,
  join_code  text not null unique,
  mode       league_mode not null default 'house',
  created_at timestamptz not null default now()
);

create table league_member (
  league_id uuid not null references league (id) on delete cascade,
  user_id   text not null references app_user (clerk_user_id),
  joined_at timestamptz not null default now(),
  wins      int not null default 0,
  placed    int not null default 0,              -- settled bets; win-rate = wins/placed
  primary key (league_id, user_id)
);

-- ---- bets ------------------------------------------------------------------
create table bet (
  id             uuid primary key default gen_random_uuid(),
  market_id      uuid not null references market (id),
  user_id        text not null references app_user (clerk_user_id),
  league_id      uuid references league (id) on delete set null,  -- null = solo vs house
  selection_json jsonb not null,                 -- {winner:"VER"} / {podium:[...]} / ...
  stake          bigint not null check (stake > 0),
  source         credit_source not null default 'free',
  multiplier     numeric(10,4),                  -- set at settle (odds/model/pari-mutuel)
  outcome        bet_outcome not null default 'pending',
  created_at     timestamptz not null default now(),
  -- one active bet per (user, market, league context). PG15 NULLS NOT DISTINCT
  -- so a null league_id (solo) also collapses to a single bet.
  constraint bet_one_per_context unique nulls not distinct (market_id, user_id, league_id)
);
create index bet_market_idx on bet (market_id);
create index bet_user_idx on bet (user_id);

-- ---- settlement audit ------------------------------------------------------
create table settlement (
  id          uuid primary key default gen_random_uuid(),
  market_id   uuid not null references market (id),
  settled_at  timestamptz not null default now(),
  payout_json jsonb
);

-- ---- atomic credit write (building block for monthly grant + payouts) ------
-- The scheduler (who/when gets the monthly grant) is app-layer; this is the
-- single atomic ledger write everything else composes from.
create or replace function grant_credits(
  p_user_id text,
  p_amount  bigint,
  p_reason  credit_reason,
  p_source  credit_source default 'free',
  p_ref     text default null
) returns bigint language sql as $$
  insert into credit_ledger (user_id, delta, reason, source, ref_id)
  values (p_user_id, p_amount, p_reason, p_source, p_ref)
  returning id;
$$;

-- ---- RLS: enabled everywhere, NO policies → service_role only --------------
alter table app_user      enable row level security;
alter table credit_ledger enable row level security;
alter table market        enable row level security;
alter table league        enable row level security;
alter table league_member enable row level security;
alter table bet           enable row level security;
alter table settlement    enable row level security;
