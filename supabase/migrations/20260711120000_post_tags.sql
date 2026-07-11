-- Blog post tags. Adds a free-form tag list so a post can surface on more than
-- one series page (and topical hubs) beyond its single series_slug. Backfills
-- each existing post's series_slug into tags so current series-associations keep
-- surfacing. The GIN index supports `tags @> array[...]` containment queries used
-- by the per-series post feed. RLS-on / service_role-only like the rest of the
-- schema (no policy needed — access is via lib/blog.ts through the service role).
alter table post add column if not exists tags text[] not null default '{}';

-- One-time backfill: seed tags from the existing single series tag so posts that
-- were already series-tagged remain discoverable on that series' page via tags.
update post
   set tags = array[series_slug]
 where series_slug is not null
   and cardinality(tags) = 0;

create index if not exists post_tags_idx on post using gin (tags);
