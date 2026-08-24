-- Operator-composed page layout — the "I want to control what everyone sees on
-- the home page" ask. One row per REVISION, not one row per page: the live
-- layout is the newest row for a page_key with published_at set, a draft is the
-- newest with published_at null, and reverting is simply publishing an older
-- revision again.
--
-- REJECTED: a single editable row per page (`page_key` as primary key, updated
-- in place). It is smaller until the first time a bad layout reaches the front
-- page, at which point there is no undo and no record of what was live when.
-- The home page is the most-visited surface on the site and this table is edited
-- by hand, so history is not a luxury here. Append-only costs one index.
--
-- REJECTED: KV. Every existing key in the store is per-user, a cache, or
-- per-series (lib/kv.ts); this is durable editorial state closer to `post` than
-- to a cache, and the home page already reads Supabase at render for its blog
-- lead, so this adds no new dependency to the render path.
--
-- `blocks` is deliberately schemaless jsonb: the widget vocabulary will grow,
-- and every reader is required to fail soft to the automatic composition on
-- anything it does not recognise (lib/home-layout.ts). A layout must never be
-- able to take the home page down.
--
-- RLS-on / no-policies / service_role-only like the rest of the schema; the
-- default privileges from migration 20260622094000 already grant service_role on
-- new tables, so no explicit grant is needed here.
create table if not exists page_layout (
  id           uuid primary key default gen_random_uuid(),
  page_key     text not null,
  blocks       jsonb not null,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  created_by   text
);

-- The only hot query: newest published revision for one page. Partial, because
-- drafts are never read by the public page and there is no reason to index them
-- for it.
create index if not exists page_layout_live_idx
  on page_layout (page_key, published_at desc)
  where published_at is not null;

-- Draft lookup for the composer (newest unpublished revision per page).
create index if not exists page_layout_draft_idx
  on page_layout (page_key, created_at desc)
  where published_at is null;

alter table page_layout enable row level security;
