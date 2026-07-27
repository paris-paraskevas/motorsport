-- Blog post reactions (like / dislike). One reaction per identity per post:
-- signed-in readers dedup by Clerk user id, anonymous readers by a salted hash
-- of their IP (HMAC-SHA256 keyed on CRON_SECRET, computed in the API route — the
-- raw IP is never stored here, so no PII lands in the table). Keyed by post SLUG,
-- which is immutable and also covers the legacy file-based MDX posts that have no
-- DB row. RLS-on / no-policies / service_role-only like the rest of the schema;
-- the default privileges from 20260622094000 already grant service_role on new
-- tables (mirrors post / feedback), so no explicit grant is needed here.
create table if not exists post_reaction (
  id          uuid primary key default gen_random_uuid(),
  post_slug   text not null,
  reaction    text not null check (reaction in ('like', 'dislike')),
  user_id     text,        -- Clerk user id when signed in; null for anonymous
  ip_hash     text,        -- HMAC(CRON_SECRET, client-ip) when anonymous; null when signed in
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- exactly one identity present (signed-in XOR anonymous)
  constraint post_reaction_identity check ((user_id is not null) <> (ip_hash is not null))
);
-- One reaction per identity per post. Partial uniques (only the present identity
-- is keyed) guard integrity against races; the API select-then-write rather than
-- ON CONFLICT, since Postgres can't infer a partial index from a plain upsert.
create unique index if not exists post_reaction_user_uq on post_reaction (post_slug, user_id) where user_id is not null;
create unique index if not exists post_reaction_ip_uq on post_reaction (post_slug, ip_hash) where ip_hash is not null;
-- Count likes/dislikes per post.
create index if not exists post_reaction_slug_idx on post_reaction (post_slug, reaction);

alter table post_reaction enable row level security;
