-- Paddock — per-member league invite links. A member's stable token (one per
-- league per inviter) maps to /play/leagues/join/<token>. Joining via it adds the
-- member AND surfaces a friend request from the inviter (wired app-side).
-- RLS-on / no-policies / service_role-only, like the rest.
create table league_invite (
  token       text primary key,
  league_id   uuid not null references league (id) on delete cascade,
  inviter_id  text not null references app_user (clerk_user_id),
  created_at  timestamptz not null default now(),
  unique (league_id, inviter_id)
);
create index league_invite_league_idx on league_invite (league_id);
alter table league_invite enable row level security;
