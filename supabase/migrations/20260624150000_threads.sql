-- Threads — community UGC (W7). Top-level posts submitted by signed-in users,
-- public only after an admin (Clerk publicMetadata.role 'admin', checked in the
-- API) approves: status pending -> approved / rejected. RLS-on / no-policies /
-- service_role-only, like the rest of the betting schema; the default privileges
-- from migration 094000 already grant service_role on new tables, so no explicit
-- grant is needed here (mirrors friendship / league_invite).
create table thread (
  id          uuid primary key default gen_random_uuid(),
  author_id   text not null references app_user (clerk_user_id),
  title       text not null,
  body        text not null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  text
);
-- The list queries filter by status, newest first.
create index thread_status_idx on thread (status, created_at desc);

alter table thread enable row level security;
