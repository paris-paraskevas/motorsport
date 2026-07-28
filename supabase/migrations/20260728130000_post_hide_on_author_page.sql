-- Per-post visibility on the writer's own /authors/<slug> page. The author owns
-- this flag (they set it from /settings/author); it hides a published post from
-- their profile ONLY. The post stays live at its /blog/<slug> URL, stays in the
-- /blog feed, and stays in the sitemap — this is a curation control over the
-- author's own shelf, not an unpublish. Unpublishing already exists as a status.
--
-- Default false so every existing published post keeps showing, and so a writer
-- who never opens the setting has a complete profile by default.
alter table post add column if not exists hide_on_author_page boolean not null default false;
