-- Become-an-author applications from /write-for-us (item 14). A signed-in reader
-- pitches; the operator approves from /admin/users, which grants Clerk
-- publicMetadata.role = 'contributor' (the revocable stranger tier below
-- 'writer' — same authoring capabilities today, different trust standing).
--
-- One PENDING application per account, but a declined applicant may re-apply:
-- hence the partial unique index rather than a unique column. History rows stay
-- (status approved/declined + who/when) so the queue never re-litigates blind.
--
-- clerk_user_id is deliberately NOT an FK to app_user: an applicant is a reader,
-- not necessarily an onboarded betting-economy user, and the row must survive
-- either way. RLS-on / no-policies / service_role-only like the rest of the
-- schema (default privileges from 20260622094000 cover new tables).
create table if not exists author_request (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  display_name  text not null,
  pitch         text not null,
  links         text,
  sample        text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by    text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

create unique index if not exists author_request_one_pending
  on author_request (clerk_user_id) where status = 'pending';

alter table author_request enable row level security;
