-- Staff feedback board. Bugs / feature requests / comments posted + read by
-- staff only (Clerk publicMetadata.role in {admin, moderator}); everyday users
-- can't reach the page or its API. RLS-on / no-policies / service_role-only like
-- the rest of the schema (default privileges from 20260622094000 grant
-- service_role on new tables — no explicit grant needed).
create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  author_id   text not null references app_user (clerk_user_id),
  kind        text not null default 'comment' check (kind in ('bug', 'feature', 'comment')),
  title       text not null,
  body        text not null,
  status      text not null default 'open' check (status in ('open', 'considered', 'done', 'closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- The board lists by status, newest first.
create index if not exists feedback_status_created_idx on feedback (status, created_at desc);

alter table feedback enable row level security;
