-- R14 (2026-09-28): the three pattern rows of the page registry carry Indexable on, so the page frame leaves the code
-- its own robots rule (a verified and featured Learn answer indexes; a topic index with one indexes; an author profile
-- indexes). The seed of 2026-09-08 entered them off, and from 1.0.70 (2026-09-09) every Learn answer, topic index and
-- author profile answered noindex: 801 of the 1,279 sitemap pages on 2026-09-28. Applied to production by hand at
-- 18:26:10Z that day (rehearsed inside begin…rollback first); here for every other environment and for the record.
-- lib/design/page-registry.test.ts reads this correction as the last word on the rows' indexable value.
begin;

update page
   set indexable = true, updated_at = now()
 where application_key = 'paddock'
   and path in ('/information/[topic]', '/information/[topic]/[slug]', '/authors/[slug]');

commit;
