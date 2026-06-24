-- Blog pipeline (W7 follow-on). DB-backed posts that complement the file-based
-- MDX blog (content/posts): a post is drafted (by the authoring script or an
-- admin), an admin approves it with a publish_at, and the publish-posts cron
-- flips it to 'published' at that time and notifies. RLS-on / no-policies /
-- service_role-only like the rest of the schema; the default privileges from
-- migration 20260622094000 already grant service_role on new tables (mirrors
-- thread / source_snapshot), so no explicit grant is needed here.
create table if not exists post (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  summary      text not null,
  body         text not null,                 -- plain markdown (rendered via lib/content renderMarkdown)
  series_slug  text,                          -- null = site-wide editorial; set = series-tagged
  status       text not null default 'draft'
                 check (status in ('draft', 'approved', 'published', 'rejected')),
  author_id    text not null references app_user (clerk_user_id),
  publish_at   timestamptz,                   -- when the cron should publish it (set on approval)
  approved_by  text,
  approved_at  timestamptz,
  published_at timestamptz,                   -- when it actually went live
  hero_image   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- Admin review / scheduled queues filter by status, newest first.
create index if not exists post_status_created_idx on post (status, created_at desc);
-- The publish cron scans approved posts whose publish_at has passed.
create index if not exists post_publish_due_idx on post (status, publish_at);
-- "series with a published post" aggregate + per-series feeds.
create index if not exists post_status_series_idx on post (status, series_slug);

alter table post enable row level security;
