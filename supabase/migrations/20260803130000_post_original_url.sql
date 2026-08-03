-- Article imports (item 13): a post republished from elsewhere stores where it
-- came from. Set once at creation (the composer's import field); when present,
-- the post page emits rel=canonical POINTING AT this URL and the sitemap skips
-- the post, so an import adds no indexable page — the original keeps the search
-- equity, we show provenance to readers. NULL = an original Paddock article
-- (every existing row), so nothing changes for them.
--
-- Plain text with the shape enforced in lib/blog.ts (https:// only, <= 2048),
-- matching how hero_image is handled — the DB stays dumb about URL grammar.
alter table post add column if not exists original_url text;
