-- Per-league bet limit: an owner-set maximum STAKE per bet (null = no limit).
-- Enforced in TS (lib/betting/bets.ts placeBet) before the atomic place_bet RPC
-- — a per-bet ceiling is a league house-rule, not a balance-integrity invariant,
-- so it doesn't need to live in the locked SQL transaction. Owner-only writes go
-- through setBetLimit (owner_id check).
alter table league
  add column if not exists bet_limit bigint
  check (bet_limit is null or bet_limit > 0);
