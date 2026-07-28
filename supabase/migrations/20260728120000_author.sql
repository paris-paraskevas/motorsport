-- Public author profiles (the /authors pages). Every DB post already carries a
-- Clerk user id in post.author_id; this table is the editorial layer on top of
-- it: the public page, the bio, and the outbound social links. Keyed on
-- clerk_user_id (unique) so it joins app_user for the account and
-- post.author_id for the posts without altering either table.
--
-- Deliberately NOT an FK target from post: a writer must be able to draft before
-- anyone writes their profile, and post.author_id is compared against the live
-- Clerk session id in canPreviewUnpublished — the Clerk id has to stay the join
-- key on both sides.
--
-- `bio` is not-null on purpose: no row means no page, so an author page can never
-- ship as an empty stub (the thin-content rule that governs every generated page
-- here). `slug` carries the public URL and is chosen per author rather than
-- derived — lib/slug.ts slugify() strips everything outside [a-z0-9], so a
-- non-Latin display name ("Παναγιώτης Λουτριώτης") would slugify to "".
--
-- Clerk stays authoritative for the rendered name + avatar (resolveAuthorIdentity,
-- KV-cached 1h); display_name here is the durable fallback used when Clerk is
-- unreachable, mirroring how post bylines already fail soft.
--
-- RLS-on / no-policies / service_role-only like the rest of the schema; the
-- default privileges from 20260622094000 already grant service_role on new
-- tables (mirrors post / post_reaction), so no explicit grant is needed here.
create table if not exists author (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique references app_user (clerk_user_id),
  slug          text not null unique,
  display_name  text not null,
  role_title    text,                                 -- "Founder & Editor" → Person.jobTitle
  bio           text not null,
  links         jsonb not null default '[]'::jsonb,   -- ordered [{label,url}] → rel="me" + sameAs
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Both lookups (page by slug, byline by Clerk id) ride the unique indexes the
-- constraints above already create, so no additional index is needed.

alter table author enable row level security;
