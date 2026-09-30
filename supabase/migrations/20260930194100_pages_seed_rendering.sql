-- X7 (2026-09-30): the Session page's row carries rendering 'cached', as its route file declares since 1.0.224: the
-- session pages edge-cache like the weekend page (revalidate 300 and an empty generateStaticParams; the force-dynamic of
-- 0.334.18 rested on a misread of the build summary and on a route the prerender manifest never listed). The seed of
-- 2026-09-08 entered the row 'dynamic'. A code page's row says what the App Builder shows; the route file decides how the
-- page is rendered, so readers see no change from this row. Applied to production on the operator's "apply" (rehearsed
-- inside begin…rollback first); here for every other environment and for the record. lib/design/page-registry.test.ts
-- reads this correction as the last word on the row's rendering.
begin;

update page
   set rendering = 'cached', updated_at = now()
 where application_key = 'paddock'
   and path in ('/series/[slug]/weekend/[round]/[session]');

commit;
