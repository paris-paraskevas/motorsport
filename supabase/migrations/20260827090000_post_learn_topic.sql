-- Feature a published post inside the Learn IA (/information) — the operator's
-- "let writers write for Learn too" ask, solved by REFERENCE rather than by
-- authoring.
--
-- Learn is a BUILD-TIME registry: derived entries from content/series/** plus
-- editorial answers read off disk from content/information/answers/*.md, bundled
-- at build because workerd has no fs (lib/content-fs.ts). /information/[topic]/[slug]
-- is SSG with dynamicParams = false, so a database row can never mint a Learn
-- slug. This column does not try to. It makes a published post appear in a Learn
-- LIST; the post keeps rendering at /blog/<slug> and that stays its canonical.
-- Nothing new enters the sitemap and nothing counts against
-- INFORMATION_MAX_INDEXED.
--
-- NULL = not featured, which is every existing row, so nothing changes for them.
--
-- ONE nullable column rather than a boolean + a topic: two columns can drift into
-- `featured = true, topic = null`, a row that is flagged but unplaceable. Here the
-- invalid state is unrepresentable. The admin UI is still toggle-then-pick; the
-- storage shape and the UI shape need not match.
--
-- REJECTED: a CHECK constraint listing the topic ids. The list lives in
-- lib/information/topics.ts (INFO_TOPICS / isTopicId) and is enforced there, so a
-- SQL copy would duplicate the source of truth and force a migration to add a
-- topic. Same call migration 20260803130000 made for original_url: the DB stays
-- dumb about the value's grammar. Readers filter through isTopicId too, so a
-- hand-written bad value renders nothing rather than an orphan section.
alter table post add column if not exists learn_topic text;

-- Partial: the only query is "published posts that ARE featured", optionally for
-- one topic. Every other row is NULL and would be dead weight in a full index.
create index if not exists post_learn_topic_idx
  on post (learn_topic) where learn_topic is not null;
