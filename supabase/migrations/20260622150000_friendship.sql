-- Paddock — friends graph (global; foundation for league invites + social).
-- One row per unordered pair (the unique index on least/greatest blocks a
-- reciprocal duplicate). status: 'pending' (requester asked) -> 'accepted'
-- (friends). Declining deletes the row. RLS-on / no-policies / service_role-only,
-- matching the rest of the betting schema (all access via server-side lib).
create table friendship (
  id            uuid primary key default gen_random_uuid(),
  requester_id  text not null references app_user (clerk_user_id),
  addressee_id  text not null references app_user (clerk_user_id),
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint friendship_not_self check (requester_id <> addressee_id)
);

-- At most one friendship per unordered pair — blocks A->B and B->A both existing.
create unique index friendship_pair_idx
  on friendship (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendship_addressee_idx on friendship (addressee_id, status);
create index friendship_requester_idx on friendship (requester_id, status);

alter table friendship enable row level security;
