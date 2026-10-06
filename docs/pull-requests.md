# Pull requests

One entry per pull request, newest first: the place to see exactly what a PR changed and how it was verified, without reopening the diff or the ledger.

The rule from 24 September 2026: every PR adds its own entry here before it merges.

A records PR (a `docs(handoff)` merge) carries the entries of the merges it records, rather than a code change of its own.

How to read an entry: **Readers see** is what a visitor of paddock-tracker.com can notice, or "nothing" when every control ships off.

**Editors get** is what changed in the designer or the admin, or "nothing".

**Files** lists every file the merge commit touched, one line each, in plain words: what changed there, from the PR body, the CHANGELOG entry, or the file's own diff when neither says.

Back-filled 24 September 2026 for #1029 to #1053 (23 and 24 September 2026), from `gh pr view`, each merge commit's `git show --stat`, and `CHANGELOG.md`.

## #1138 · 1.0.254 · PF2 (PR C) · opened 2026-10-06 07:21:52Z on the word “front cache on prod” (~06:45Z); squash-merged 2026-10-06 08:26:52Z as 68e9e7b3 on the word “merge pf2 c”; prod carries it from 08:30:47Z
**The front cache on prod.** `"cache": { "enabled": true }` in `wrangler.jsonc`: Workers Cache keeps a copy of every cacheable response in front of the production Worker (the rules of #1136 are already on main). Every route that revalidates a page also purges the edge through `purgeEdgeAfterRevalidate` (`lib/cache-headers.ts`): now, and once more after the Worker’s five-second regional tag window, the purges inside a window sharing one second pass over the union of their tags; the Worker’s allowance is five purges a minute and a refusal is logged, never thrown. The designer’s saves purge everything (the `site` tag), the blog, author, Learn-topic and publish routes their pages, the loader’s revalidate route its paths; a scan test fails any file under app/ or lib/ that revalidates without purging.
- **Readers see:** the pages readers open most answered from Cloudflare’s cache in a fraction of the time (warm hits 0.13–1.16 s over 27 requests on the testing Worker, all but one under 0.4 s); the home, the series pages and the standings refreshed as soon as the loader lands new results; a design save visible at once.
- **Editors get:** nothing new; a save’s purge is logged, not shown (an Inbox line).
- **Files (29):**
  - `wrangler.jsonc` · the cache key with its reason and the rollback beside it.
  - `lib/cache-headers.ts`, `lib/cache-headers.test.ts` · `purgeEdgeTags`, `purgeEdgeAfterRevalidate` (the Worker context through a dynamic import, the second pass over the pending tags’ union), the helper’s tests (absent, refused, thrown, done; the second pass and the shared window; no waitUntil) and the scan of every revalidating file under app/ and lib/.
  - `app/api/cron/revalidate/route.ts` · uses the shared helper (its nine tests unchanged).
  - the 17 design routes under `app/api/admin/design/` · `purgeEdgeAfterRevalidate(['site'])` after each layout-wide revalidation; a concrete page path its own tag; a route pattern the site (pages, revisions, views).
  - `app/api/author/route.ts`, `app/api/blog/[id]/route.ts`, `app/api/cron/publish-posts/route.ts` · the author, Learn-topic and post paths purged.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · the trio, 1.0.254 (the footer seed, #1137, takes 1.0.255 behind it).
- **Verified:** lib/cache-headers.test.ts and app/api/cron/revalidate/route.test.ts 30 green together; `npx tsc --noEmit` → 0; eslint on the changed files clean; the full suite 275 files, 2,693 tests green (07:24Z); `npx wrangler deploy --dry-run -c wrangler.jsonc` → Total Upload 40,684.49 KiB (39.7 MiB, 62.1 % of the 64 MiB ceiling; gzip 8,882.91 KiB) on a db-mode build whose route table shows the home ○ 5m (08:16Z); Cloudflare’s own build of the branch, #7d0530d1, green. The two gates of the slot: the www 301 as the zone’s “Redirect from WWW to root” rule (the operator, ~06:50Z; `www.paddock-tracker.com/calendar?series=f1` answers Cloudflare’s own 301 with the query kept; http answers Always Use HTTPS at the edge) and the dev. lock kept (the operator’s “ok” on the default, ~07:00Z). The cache itself is proven only on prod, in the first minute after the merge: www and http 301 on a warm path, dev.’s lock on a cold path, a ?tab= 308 BYPASS with no-store, /api/cron/health BYPASS, a page MISS then HIT, the loader’s run logging the purge, a design save by the operator’s hand purging at once. Rollback: the line removed, one merge.
- **Review:** a fresh-context Sonnet reviewer read the diff from git refs (pf2c-review.md, 219,715 tokens): FIX FIRST, three Medium (a later narrower purge dropped an earlier broader second pass; this entry absent; the public note overclaimed), five Low (a saved view on a route pattern tagged with the pattern; the scan limited to app/api route files and per file; the fake-timer afterEach in the wrong describe and two cases untested; the design routes discarding the purge’s answer; the changelog’s latency range). Folded: the second pass over the union of the window’s pending tags (tested); a pattern path purges the site in the views routes; the scan over app/ and lib/ for revalidatePath, revalidateTag and updateTag; the afterEach at file level, the thrown and waitUntil-less cases; the note and the range corrected. Recorded instead of built: the design routes’ JSON gains an `edgePurged` flag in a later slot (an Inbox line).

- **Prod, the first minute (08:31–08:35Z):** www 301 answered by the zone in 0.12 s (no Worker header); http 301 no-store, BYPASS; dev. on a cold key 307 private, no-store, BYPASS; the ?tab= 308 no-store, BYPASS; /api/cron/health 401 no-store, BYPASS; /settings private, BYPASS; /calendar MISS in 6.1 s then HIT in 0.086 s; / HIT at 0.08 s (a reader had warmed it, Age 36); /calendar?series=f1 MISS 2.4 s then HIT 0.09 s; /series/f1/standings MISS 2.4 s then HIT 0.08 s. The purge end to end: the loader’s dispatched run (37436891471) logged `revalidate: HTTP 200 for 27 paths; edge purged` at 08:34:39Z, and /series/f1/standings, stored at 08:31:28Z with 1,164 s to live, answered MISS at 08:34:55Z and HIT with Age 0 after it. The census after the cache (run 37436895755, 08:33–08:42Z): 2,042 pages fetched, 0 contradict the sitemap. Rollback: the one line in `wrangler.jsonc` removed, one merge.
- **Finding, open (08:31:31Z):** the cache key carries no hostname, so `dev.paddock-tracker.com` answers a WARM public key from prod’s copy: dev./calendar HIT and dev./ HIT (the designer’s root shows the home) where the middleware would 307 or 404; cold keys and every /admin, /api and sign-in path still reach the lock, and nothing of dev.’s own is ever stored (private, no-store). The fix proposed: a zone Redirect Rule for the dev. host ahead of the Worker (dev. pages to /admin/designer), awaiting the word.

## #1140 · 1.0.257 · PF3 (PR D-1, stale answers served while refreshing) · opened 2026-10-06 ~12:20Z on the word “swr go” (~12:12Z); the merge on the word
**The first reader after a page’s window no longer pays the render.** Measured from Athens at 11:57Z on 1.0.255 with the front cache on: the home answered BYPASS in 1.8 s (Next served a stale copy and regenerated; the edge never stores a stale answer), then MISS in 0.5 s, then HIT in 0.11 s; a reader who visits once in a while is nearly always the first, which is what the operator’s phone saw while a desktop right after someone else saw 0.1 s. The Workers Cache honours `stale-while-revalidate` and `stale-if-error` and reads `cloudflare-cdn-cache-control` before `Cache-Control`; Next’s `must-revalidate` forbids serving stale. So every cacheable response now carries the edge’s own line, `max-age=<the page’s s-maxage, else its max-age>, stale-while-revalidate=86400, stale-if-error=86400`, and a STALE or regenerating answer carries `max-age=0` with the same allowances (an already-expired copy: every reader answered at once while the Worker keeps running behind, the revalidation HEAD included, until a fresh answer replaces it) while its Cache-Control stays `no-store` for browsers; private answers and bare redirects get no line; staleness stays bounded by the purges after every revalidation.
- **Readers see:** the pages they open answer at once even when the edge is refreshing them, and keep answering from the last good copy while the Worker fails; content still changes within one loader run or one design save, as before.
- **Editors get:** nothing new.
- **Files (2 code, 4 trio, 3 records):**
  - `lib/cache-headers.ts` · `edgeCacheRules` returns `cdnCacheControl` for a cacheable response (the window from its s-maxage, else its max-age) and the expired-copy line for a STALE or regenerating answer; `withEdgeCacheRules` sets `cloudflare-cdn-cache-control`; the comment block says why, with the two proofs’ numbers.
  - `lib/cache-headers.test.ts` · the cacheable cases carry the line (a page, a route handler, a media file, s-maxage over max-age); a STALE or regenerating answer carries the expired-copy line with no-store for browsers; a private page and a bare answer carry none; the wrapper sets it.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · the trio, 1.0.257 (1.0.256 is R19’s, on its branch).
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md`, `SCHEDULE.md` · PF3 started with its brief and the change line; this entry.
- **Verified:** `lib/cache-headers.test.ts` and `app/api/cron/revalidate/route.test.ts` 31 green, `lib/design/plan-ledger.test.ts` 6 green; `npx tsc --noEmit` → 0; eslint on the two files → 0; the full suite 275 files, 2,695 tests green on 32dced29 (12:47:22Z). The proof on testing (version aee3b340, the calendar page, its window 300 s): filled at 12:37:32Z (MISS 5.9 s, then HIT 0.10 s); after the window, six requests from 12:42:53Z answered 0.19, 0.14, 0.11, 0.10, 0.10 and 0.09 s: UPDATING twice on the old copy (age 315, 321), UPDATING twice on the stale answer stored as the expired copy (age 5, x-opennext-cache STALE), then HIT on the fresh copy (s-maxage=294). The first build without the second rule (version 72782fee, 12:23:59Z) had answered UPDATING 0.12 s, then BYPASS 2.7 s and 0.36 s on the stale answer the edge had dropped, then MISS 0.33 s. Testing is built from a scratch merge with R19’s branch so the bar’s device look stays valid; this PR’s diff is against main alone.
- **Review:** a fresh-context Sonnet reviewer reads the diff from git refs; its verdict here before the merge.

## #1137 · 1.0.255 · X13 (the footer seed) · opened 2026-10-06 ~07:12Z on the word “apply footer seed” (the 6th, ~06:45Z); the merge on the word
**The footer’s Series list seeded for the designer.** The migration `20261006070000_design_list_footer_series.sql` seeds the `footer-series` list, its fifteen entries (the same fifteen as `lib/design/lists.ts` DEFAULT_NAV.footerSeries, in the same order) and the heading’s text row `footer.series` (left out by the Text Messages seed of 20260908150000), insert where absent in the shape of the shell lists’ seed (20260908130000).
- **Readers see:** nothing new; the third column is the same fifteen before and after.
- **Editors get:** the footer’s Series list and its heading in the designer’s Lists and Text Messages, editable.
- **Files (5):** `supabase/migrations/20261006070000_design_list_footer_series.sql` · the seed. `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · the trio, 1.0.255.
- **Verified:** the statements mirror the applied seeds’ shape (list on conflict (application_key, key); list_entry where the list has no entries; text_message on conflict); rehearsed on prod inside begin…rollback through the Management API (0/0/0 → 1/1/15 → 0/0/0 at 07:59Z, after the database’s restart) and applied 2026-10-06 08:02:08Z on “apply footer seed”: 1 text row, 1 list, 15 entries in order (Formula 1 → NLS Nürburgring).
- **Review:** none; a seed in the shape of 20260908130000.

## #1136 · 1.0.253 · PF2 (PR B) · opened 2026-10-05 22:13:24Z; squash-merged 2026-10-06 06:58Z as 73d592ba on the word “merge pf2”; prod carries it from 08:11Z (the first build failed at the prerender during the database outage; the operator’s retry of 08:05Z passed); the prod checks at 08:11Z: the ?tab= 308 answers no-store, dev.’s lock 307 private, no-store, /api/cron/health 401 no-store, /settings private, a page keeps its s-maxage with no cache status (the cache is off there), www answers the zone rule’s 301
**Workers Cache on the testing Worker.** Phase 2 of the performance programme (docs/perf-handoff.md), design D picked by the operator on the 5th: the cache Cloudflare keeps in front of the Worker, keyed by path and query (not the hostname), governed by the response’s own Cache-Control; a hit runs no code and bills no CPU. Testing only; prod is PR C on the word.
- **Readers see:** nothing new on prod: the cache is off there until PR C, while the header rules run there from the merge (the redirects say no-store, the dev. host answers private, cacheable pages carry a Cache-Tag). On testing.paddock-tracker.com, cached pages answer from Cloudflare’s cache with `Cf-Cache-Status: HIT`.
- **Editors get:** nothing new.
- **Files (13):**
  - `wrangler.testing.jsonc` · `"cache": { "enabled": true }` with the reason beside it.
  - `lib/cache-headers.ts`, `lib/cache-headers.test.ts` · `edgeCacheRules` and `withEdgeCacheRules`: the dev. host private, no Cache-Control means no-store, a STALE answer no-store (its one-second copy would answer OpenNext’s revalidation HEAD through the self binding), every response with a positive window tagged `path:<pathname>,site`; eighteen tests.
  - `worker.ts` · the rules applied to every response after `withBrowserSafeCache`.
  - `app/api/cron/revalidate/route.ts`, `app/api/cron/revalidate/route.test.ts` · the loader’s revalidation purges the path tags through the Worker’s execution context, reads the purge’s `success`, logs a refusal and purges once more six seconds later (the regional tag answer’s window); seven tests (the purge reported, refused, absent, repeated).
  - `scripts/warm-live-data.mts` · the loader logs whether the edge was purged.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · the phase PF with PF0–PF6 and the dated change line; PF2 started; the rendered plan page.
  - `SCHEDULE.md`, `docs/HANDOFF.md`, `docs/pull-requests.md` · item 11; the LATEST; this entry.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · the trio, 1.0.253.
- **Verified:** tests first for the rules (13 green); `npx tsc --noEmit` → 0; eslint on the four code files clean; `npx wrangler deploy --dry-run -c wrangler.testing.jsonc` accepts the cache key (Total Upload 40,666.23 KiB, 39.7 MiB, 62.0 % of the 64 MiB ceiling). On the testing Worker, version 381f21ee (22:20Z): a session page’s first request MISS at 5.36 s (a render), the second and third HIT at 0.28 s and 0.15 s from Cloudflare’s cache with no Worker run; /calendar MISS 6.2 s then HIT 0.14 s and /calendar?series=f1 MISS 1.4 s then HIT 0.13 s, two entries; /settings BYPASS (private); the ?tab= 308 BYPASS with `Cache-Control: no-store` and /api/cron/health BYPASS with no-store (the edge rules); the RSC payload a variant of its own (MISS then HIT) and the HTML and RSC variants coexisting after a single miss when a new variant is first stored (H MISS·HIT, R MISS, H MISS, R HIT, H HIT·HIT; a prefetch variant the same); the loader’s purge: POST /api/cron/revalidate answered `edgePurged: true` and the page came back MISS once, then HIT. The Phase 0 script cold and warm: below, before the merge.
- **Verified, after the fold:** the two touched test files 26 green; the full suite 275 files, 2,687 of 2,690 green; the three at the 5 s timeout: lib/sitemap-data.test.ts’s two X13 cases (22 green alone) and lib/design/component-render.test.tsx’s Filters case, whose render reaches calendar.google.com and took 10.5 s on the night’s slow network (an Inbox line); `npx tsc --noEmit` → 0; eslint on the five files clean; the dry run 40,669.17 KiB (39.7 MiB, 62.1 % of the 64 MiB ceiling; gzip 8,882.24 KiB). The first test build had been made without `DATA_SOURCE=db` (the home and the series tabs dynamic, the home at 2.8–6.9 s on every request); rebuilt with it and redeployed as 83b8c266 at 2026-10-05 23:33:01Z (the home ○ 5m in the route table). On the corrected build: Pass A (the fill, 00:00:01Z): / BYPASS/STALE 0.35 s, /series/f1 BYPASS/STALE 0.30 s, /series/f1/standings MISS/HIT 0.51 s, /series/f1/weekend/17 BYPASS/STALE 0.27 s, /calendar BYPASS/STALE 1.49 s, /news BYPASS/STALE 0.97 s, /drivers/kimi-antonelli HIT 0.34 s, /information HIT 0.64 s, /blog BYPASS/STALE 0.68 s; a STALE answer now says no-store (BYPASS, not stored) and the very next request is a fresh HIT from the Worker, stored (the revalidation landed within the second). Pass B (warm, 00:00:48Z): every cacheable page HIT, 0.13 s–1.16 s over 27 hits (the article BYPASS, private: PF1). Pass C (cold, after fifteen idle minutes, 00:16:18Z): 2 pages still HIT (/series/f1/standings 0.19 s, /information 0.28 s); the pages whose window had ended: / BYPASS/STALE 5.64 s → BYPASS/STALE 0.69 s → BYPASS/STALE 0.64 s; /series/f1 BYPASS/STALE 2.22 s → BYPASS/STALE 0.35 s → BYPASS/STALE 0.32 s; /series/f1/weekend/17 BYPASS/STALE 1.70 s → BYPASS/STALE 0.38 s → BYPASS/STALE 0.81 s; /calendar BYPASS/STALE 1.42 s → BYPASS/STALE 0.72 s → BYPASS/STALE 0.33 s; /news BYPASS/STALE 1.62 s → BYPASS/STALE 0.37 s → BYPASS/STALE 0.67 s; /drivers/kimi-antonelli BYPASS/STALE 1.64 s → BYPASS/STALE 0.39 s → BYPASS/STALE 0.64 s; /blog MISS/HIT 4.42 s → HIT/HIT 0.23 s → HIT/HIT 0.19 s. The purge check on /series/f3 (00:00:05Z): fill MISS 2.95 s, warm HIT 0.15 s; POST /api/cron/revalidate answered edgePurged:true; the next request MISS at 1.35 s (a fresh render), then HIT 0.14 s; nine seconds later MISS 0.38 s with x-opennext-cache HIT (the second purge had removed the copy, the Worker answered from its fresh entry), then HIT 0.34 s and 0.34 s. The STALE rule seen on every short-window page of pass A (x-opennext-cache STALE, Cache-Control no-store, Cf-Cache-Status BYPASS, then a fresh HIT) and on the home at 23:46Z before the chain (STALE no-store three times in 30 s, then x-opennext-cache HIT with s-maxage=245 stored). The populate of the corrected build stopped at 29 % (R2 writes answered 500 fourteen times, a Cloudflare-side fault of the night) and was re-run after the measurements; the ten pages rendered on demand meanwhile.
- **Review:** a fresh-context Sonnet reviewer read the diff from git refs (pf2-review.md, 260,847 tokens): FIX FIRST, one High (a STALE answer, s-maxage=1, was stored, and OpenNext’s revalidation HEAD through the self binding, which the same cache answers, could be served that copy), five Medium (the purge’s success flag unread; the acceptance’s “API routes never cached” against the public API routes that declare s-maxage; the www and http 301 and the dev. lock behind a hostname-blind cache; the layout-wide revalidations of the design saves beyond a path tag; the purge inside the regional tag answer’s 5 s window), four Low (the untagged max-age responses of /media and /api/search; the records’ “prod untouched”; the loader’s log; two tests). Folded: a STALE or regenerating answer says no-store; the tag path:<pathname>,site on every positive window; the route reads success, logs a refusal and purges again after 6 s inside waitUntil; the loader logs the answer; the 301-through-the-wrapper and the three purge cases tested. Recorded instead of built: the two PR C gates (the www/http 301 as a zone Redirect Rule; the dev. lock) in the slot’s needsWord and acceptance; the API purge list in PF3; the wording in the trio and here.

## #1135 · 1.0.252 · X10 (the leftovers) · opened 2026-10-05 21:02:34Z; rebased onto main after X14’s squash (the two commits replayed; CHANGELOG, RELEASES, package.json and this file union-resolved, 1.0.252 over 1.0.251; the four files’ line endings restored to LF after the resolve wrote CRLF, b1ad7bbf), the tests, tsc and lint re-run green, `DATA_SOURCE=db npm run cf:build` clean and `npx wrangler deploy --dry-run` → Total Upload 40,665.17 KiB (39.7 MiB, 62.0 % of the 64 MiB ceiling; gzip 8,881.54 KiB); the merge on the word “merge leftovers”
**The titles and descriptions the crawl of the 5th still flagged.** Five pages after X10 and X10b (the operator’s “lets first complete all fixes”): the GT driver ratings question (615 px bare, its suffix already dropped) and Toyota Gazoo Racing’s endurance history (578 px) against 570 px, the up-and-coming drivers watchlist, the descriptions of /social/threads (1,148 px) and /f1/analysis (1,115 px) at 14 px against 985 px.
- **Readers see:** three shorter questions as the pages’ titles and headings (“What do GT driver ratings mean?”, “What is Toyota Gazoo Racing’s endurance history?”, “Which up-and-coming drivers should you watch?”) and two shorter descriptions in search results.
- **Editors get:** nothing new.
- **Files (9):** `content/information/answers/what-do-gt-driver-ratings-mean.md`, `content/information/team-histories.json`, `lib/information/curated.ts` · the three questions. `app/(app)/social/threads/page.tsx`, `app/(app)/f1/analysis/page.tsx` · the two descriptions, each with its measured width in a comment. `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · the trio, 1.0.252.
- **Verified:** each string measured with `textWidth` from lib/site.ts at the site’s sizes (the questions 296 and 456 px bare, the watchlist’s under 450; the descriptions 938 and 811 px at 14 px); `npx tsx scripts/bundle-content.mts` → 320 files; `npx vitest run lib/information lib/site.test.ts` → 38 green; `npx tsc --noEmit` → 0; eslint on the three code files clean. No route, slug or URL changes. The duplicate team title (Mercedes-AMG Team Verstappen Racing #3 in two series) stays for X17.
- **Review:** none; five strings measured by the site’s rule (a reviewer on the word).
## #1134 · 1.0.251 · X14 · opened 2026-10-05 20:22:22Z; squash-merged 2026-10-05 21:52:55Z as 46efb9bc on the word “merge x14”; prod carries it from 21:58:33Z (the footer 1.0.251): /series/indycar/weekend/11/indycar-final-practice 308 to round 12, /11/indycar-practice-1 200 (shared), /series/f2/weekend/12/feature-race 308 to feature-race-1, the Content-Security-Policy with `media-src 'self' https://livetiming.formula1.com`, the MotoGP hub without a weekend/0 link, the Bahrain race page’s audio elements without src, the post page’s share link on api.whatsapp.com. X14 stays started until the next Seobility crawl (its acceptance), which waits for the front cache by the operator’s word.
**Nothing broken.** The fourth of the seven Seobility slots (the plan page f4b91e27, every crawl fact re-checked on prod; the operator’s word of ~19:25Z, “lets first complete all fixes then make the worker”): the crawls of 1 and 5 October listed 259 then 214 unretrievable file sources, 45 then 9 pages with technical problems, seven canonical errors and 40 host changes; X13’s reviewer four dead links; B3 the old Baku address.
- **Readers see:** the team radio playing (it had been mute on prod: the Content Security Policy had no media-src for livetiming.formula1.com, found by the browser check), a test weekend’s row without a link to a missing page, IndyCar’s old addresses and Baku’s old feature-race address landing on the right pages, the F1 analysis page’s links reaching the right sessions, the WhatsApp share going straight to api.whatsapp.com.
- **Editors get:** nothing new.
- **Files (14):**
  - `components/f1/TeamRadioPlayer.tsx` · no `src` on the audio element; `preload="none"`; the address attached imperatively on the first play inside the click.
  - `next.config.ts` · `media-src 'self' https://livetiming.formula1.com` in the CSP (the Baku entry first added to `redirects()` was replaced by the data rule below).
  - `app/(app)/series/[slug]/page.tsx` · the season list’s round-0 row as a div; the Last round and Next round aside without Report, Preview or the podium line at round 0.
  - `app/(app)/drivers/[slug]/page.tsx` · the Next out block without “Round 0” and without a Preview link at round 0.
  - `app/(app)/archive/[season]/[slug]/page.tsx`, `app/(app)/archive/[season]/[slug]/weekend/[round]/page.tsx`, `lib/sitemap-data.ts` · round-0 weekends skipped in the archive’s season page and sitemap; the archive weekend page’s canonical its own address and no live link at round 0.
  - `lib/weekend.ts`, `lib/weekend.test.ts` · `RENUMBERED_ROUNDS` (indycar, season 2026, rounds 11–17 shifted by one), `renumberedSessionTarget`, `splitSessionTarget`; eight tests (the moved slug, the shared slug, the unknown slug and another series, the span’s end, the season guard, the split and its no-ops).
  - `app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx`, its `page.test.tsx` · the two permanent redirects in `resolve()` (before the weekend for the renumbering, after it for the split), from generateMetadata too; the source test anchors them.
  - `app/(app)/f1/analysis/page.tsx` · the qualifying and race links resolved from the weekend’s sessions through `sessionSlug`; none drawn when a session is missing.
  - `components/blog/BlogShare.tsx` · api.whatsapp.com.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · the trio, 1.0.251.
- **Verified:** tests first (red: the lookup missing, the redirect absent; one fixture slug corrected, IndyCar’s titles keep their series prefix) then green: 22 in the two files; `npx tsc --noEmit` → 0; `npm run lint` → 0 errors; the full suite → 275 files, 2,674 tests green before the fold (`npm test -- --maxWorkers=4`); the testing Worker 448c71cf (the first commit): /series/indycar/weekend/11/indycar-final-practice and /11/indycar-borchetta-bourbon-music-city-grand-prix 308 to round 12, /15/indycar-hy-vee-milwaukee-mile-race-1 308 to 16, /11/indycar-practice-1 200 (shared), /series/f2/weekend/12/feature-race 308 to feature-race-1, the Bahrain race page’s nine audio elements without src, the post page’s share link on api.whatsapp.com, the MotoGP hub without a weekend/0 link (the Sepang rows kept), the analysis page’s Bahrain links on bahrain-gp-qualifying and bahrain-gp-race, the archive’s MotoGP season page without a round-0 row; the fold on the local server: the split 308, the media-src header present, /archive/2026/f2/weekend/0 200 with its own canonical and no live link, and the Bahrain race page’s first radio clip playing to its end after a click in the browser (12 s, no media error; on the testing Worker before the CSP line the same click left the element paused with a CSP violation in the console). After the fold: the full suite → 275 files, 2,677 tests green (`npm test -- --maxWorkers=4`, 20:42Z); `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` → Total Upload 40,661.09 KiB (39.7 MiB, 62.0 % of the 64 MiB ceiling; gzip 8,881.49 KiB); the testing Worker redeployed as version 01cc91bd with its cache populated (21:27Z); on it: /series/f2/weekend/12/feature-race 308 to feature-race-1 by the data rule, the Content-Security-Policy header carrying `media-src 'self' https://livetiming.formula1.com`, the Bahrain race page’s first radio clip playing to its end after a click in the browser (12 s, no media error), /archive/2026/f2/weekend/0 200 with its own address as canonical and no live link, the archive’s MotoGP season page and the MotoGP hub without a weekend/0 link, the sitemap 2,042 URLs as before the slot.
- **Review:** a fresh-context Sonnet reviewer read the diff from git refs (x14-review.md, 209k tokens): FIX FIRST, nine findings, all folded in c2440f8a: the aside and driver-page links at round 0; the archive weekend page’s live link and the archive sitemap; `RENUMBERED_ROUNDS` without a season; the static Baku redirect wrong at the roll-over (replaced by `splitSessionTarget`); the two test files rewritten with CRLF (re-saved LF); the session test’s loose anchor; the CHANGELOG’s claim that the HTML carried no mp3 address (the moments’ props still carry them as text; reworded, the next crawl is the check); the missing span-end and season tests.

## #1133 · 1.0.250 · docs · opened 2026-10-05 19:30:32Z; the merge on the word of the evening (“place the per handoff in docs if its not there and start”)
**The performance programme’s file in the repo, and the Phase 2 pick recorded.** The operator’s file of 5 October placed verbatim at `docs/perf-handoff.md` (26,929 bytes, byte-identical to the Downloads copy); the ledger’s dated change line records the Phase 2 design D (Workers Cache: the experiment on the testing Worker first, C behind it, A the fallback) and the evening’s order (the fixes first, then the front cache for the new numbers, then the next step; the Seobility re-crawl after the front cache).
- **Readers see:** nothing; the release notes carry one line.
- **Editors get:** nothing.
- **Files (7):** `docs/perf-handoff.md` · new, the operator’s file verbatim. `docs/plan/ledger.json`, `docs/plan/components-programme.md` · the dated change line with the words; the rendered plan page. `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · the trio, 1.0.250.
- **Verified:** `cmp` of the two files → identical; `node docs/plan/render-ledger.mjs` → 79 slots; `npx vitest run lib/design/plan-ledger.test.ts` → 6 green; no code changed.
- **Review:** none; a verbatim document and a ledger line.

## #1132 · 1.0.249 · records · opened 2026-10-05 19:19:08Z; the merge on the standing word
**The crawl of the 5th read against the slots.** The operator’s export (2026-10-05_venture-full-export.pdf; the MCP still without credits) read slot by slot on the page c1eeffaf: Tech. & Meta 84 % (+17), Structure 54 % (+11), Content 57 % (+5); X10 (X10b folded into it) DONE on titles 982 → 3, descriptions 1,500 → 2, duplicate titles 31 → 2, the five leftovers and the duplicate team named for X17; X12 and X13 not judged (the crawl ran from about 08:30Z, before their deploys) with the next crawl as their acceptance; the baselines for X14 (seven archive round-0 canonical errors folded into its plan, the page f4b91e27 updated) and X16 (the response times during the flood).
- **Readers see:** nothing; the release notes carry one line.
- **Editors get:** nothing.
- **Files (9):** `docs/plan/ledger.json`, `docs/plan/components-programme.md` · X10 done with the crawl’s numbers; X12, X13, X14 and X16 evidence; the rendered plan page. `SCHEDULE.md` · item 8 of session 65. `docs/HANDOFF.md` · the words list (the next crawl by the operator’s hand) and the ledger line of the pickup prompt. `docs/pull-requests.md` · this entry. `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · the trio, 1.0.249.
- **Verified:** `node docs/plan/render-ledger.mjs` → 79 slots; `npx vitest run lib/design/plan-ledger.test.ts` → 6 green; no code changed.
- **Review:** none; records.

## #1131 · 1.0.248 · records · opened 2026-10-05 19:05:58Z; the merge on the standing word
**X14’s plan written.** The decision-free overnight task of the handoff: the crawl’s broken files, pages and links re-checked on prod, six changes with their files and tests, the acceptance, the pre-mortem and the decision scan, in x14-plan.md (the paddock-x10 scratch directory) and on the page f4b91e27; built on “x14 go” after Phase 2.
- **Readers see:** nothing; the release notes carry one line.
- **Editors get:** nothing.
- **Files (8):** `docs/plan/ledger.json` · X14’s evidence (status planned). `SCHEDULE.md` · item 7 of session 65. `docs/HANDOFF.md` · a sentence in the LATEST body and one in the pickup prompt. `docs/pull-requests.md` · this entry. `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · the trio, 1.0.248.
- **Verified:** `node docs/plan/render-ledger.mjs` → 79 slots; `npx vitest run lib/design/plan-ledger.test.ts` → 6 green; no code changed.
- **Review:** none; records.

## #1130 · 1.0.247 · records · opened 2026-10-05 18:53:45Z; the merge on the standing word
**The session-65 records.** B3 (#1128) merged and DONE on prod, X13 (#1129) rebased, re-gated and merged, the handoff’s session-65 LATEST with the evening’s two pages (Four Front Caches: the Phase 2 pick with Workers Cache as design D; The Two Bills: the Supabase and Cloudflare costs read against the logs), the schedule, the Inbox, the trio.
- **Readers see:** nothing; the release notes carry one line.
- **Editors get:** nothing.
- **Files (9):** `docs/plan/ledger.json`, `docs/plan/components-programme.md` · B3 done with its prod evidence, X13’s merge evidence; the rendered plan page. `SCHEDULE.md` · session 65. `docs/HANDOFF.md` · the LATEST section and the session-66 pickup prompt. `docs/pull-requests.md` · the #1128 and #1129 merge lines, this entry. `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · the trio, 1.0.247.
- **Verified:** `node docs/plan/render-ledger.mjs` → 79 slots; `npx vitest run lib/design/plan-ledger.test.ts` → 6 green; the handoff’s LATEST header at line 9; no code changed.
- **Review:** none; records.

## #1129 · 1.0.246 · X13 · opened 2026-10-05 16:14:47Z; rebased onto main after B3’s squash (the seven commits replayed clean onto c2e09e63 with `git rebase --onto`, the tree unchanged, 6a07044d), the PR retargeted to main ~17:38Z; the gates re-run on the rebased branch: the full suite → 275 files, 2,669 tests green (`npm test -- --maxWorkers=4`), `DATA_SOURCE=db npm run cf:build` clean, `npx wrangler deploy --dry-run` → Total Upload 40,361.10 KiB (39.4 MiB, 61.6 % of the 64 MiB ceiling; gzip 8,808.57 KiB); squash-merged 2026-10-05 18:34:11Z as 3050910c on the word “merge x13” of the 5th; prod carries it from 18:40:31Z (the footer 1.0.246); the checks on prod: the sitemap lists 2,028 URLs (976 session pages across thirteen series, DTM 55; the testing Worker’s count was 2,035, the difference not yet explained), a sample of three session pages per series (39) all 200 and index, follow, the footer’s Series column with its fifteen hub links photographed at 390 (two columns under the other two) and 1440 (the third column); the full census over the sitemap waits for the word after the cost reading of the same evening; X13 stays started until the Seobility re-crawl by the operator’s hand
**Three clicks to any session.** The third of the eight Seobility PRs (the plan page of the 5th; the operator’s word “x13 go”): 1,350 pages sat at click depth 4 and 47 at 5 because every session page was reached only through home → /series → hub → weekend.
- **Readers see:** a third footer column, Series, naming the fifteen championships on every page; DTM’s weekend schedules linking their session pages; the sitemap carrying every session page of the thirteen series whose schedules link them.
- **Editors get:** a fifth shell list, “Footer: Series”, in the designer’s catalogue, the row pages’ List region and the list editor (its footer preview draws the other columns as stored); the chrome text “Series” for its heading. The list’s row is not seeded by this PR (a migration on the word), so the editor lists it once the row exists.
- **Files (36):**
  - `lib/design/destinations.ts`, `lib/design/lists.ts`, `lib/design/text-defaults.ts`, `components/designer/catalogue.ts`, `components/page/RowPageView.tsx` · the fifth list: its key, its type field, its fifteen default entries, its role, its heading text, its catalogue copy, the region mapping.
  - `components/Footer.tsx`, `components/AppShell.tsx` · the third column (under the two on a phone); the shell passes it.
  - `components/designer/ListEditor.tsx`, `components/designer/Designer.tsx`, `components/designer/PageDesigner.tsx` · the footer preview’s columns by key; the list keys and roles; the footer’s link count.
  - `lib/weekend.ts`, `app/(app)/series/[slug]/weekend/[round]/page.tsx`, `lib/sitemap-data.ts` · `SESSION_PAGE_SERIES` with DTM; the weekend page reads it; the sitemap’s session URLs.
  - `lib/design/lists.test.ts`, `lib/sitemap-data.test.ts`, `components/NavGating.test.tsx`, `lib/design/page-frame.test.ts`, `app/(app)/[...catchall]/page.test.tsx` · the new tests; the fixtures naming the fifth list.
  - `IDEAS.md`, `components/designer/catalogue.test.ts`, `lib/design/text.test.ts`, `docs/plan/components-programme.md` · the inbox items; the catalogue and chrome-text counts; the rendered plan page.
  - `components/designer/ListsEditor.tsx`, `components/designer/page-designer-model.ts`, `lib/design/list-edit.ts`, `app/(admin)/admin/designer/page.tsx`, `app/api/admin/design/lists/route.ts`, `app/api/admin/design/lists/[key]/route.ts` · the reviewer’s fold: “five” where the shell’s lists are counted, the footer tile’s words.
  - `docs/plan/ledger.json`, `SCHEDULE.md`, `docs/HANDOFF.md`, `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · the X13 slot started; the day’s item; this entry and the trio, 1.0.246.
- **Verified:** tests first, then green; the full suite → 275 files, 2,666 tests green (`npx vitest run --maxWorkers=2`, after the last edit); `npx tsc --noEmit` → 0; `npm run lint` → 0 errors; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` → Total Upload 40,357.50 KiB (39.4 MiB, 61.6 % of the 64 MiB ceiling; gzip 8,806.82 KiB); the testing Worker: deployed as version 31a8dccb (a first deploy failed on a transient Cloudflare authentication error and the retry passed) and the cache populated with 11,889 entries; the home, the Formula 1 hub, DTM’s weekend 1 and its race-1 page 200, the footer’s Series column live (WorldSBK → /series/wsbk), DTM’s weekend page linking its seven sessions, the sitemap 2,035 URLs with 983 session URLs and the 12 weekend URLs as before; the click depth over the testing crawl: over a 3,213-page crawl of the testing Worker (3,200 answering 200), the click-depth distribution 0: 1 · 1: 93 · 2: 605 · 3: 2,244 · 4: 18 · 5: 211, against 1,410 at four clicks and 53 at five on the crawl before X13; of the 229 pages at four clicks or more, 226 are the noindex archive pages (211 at five, 15 at four) and 3 are team pages at four, so the indexable pages at four clicks or more are 3 (the acceptance asks for under 50); the footer photographed at 390 and 1440.
- **Review:** a fresh-context Sonnet reviewer read the diff (x13-review.md): FIX FIRST (small), no code defect in the list model, the Footer’s gating, the sitemap or DTM’s links; sixteen items, folded: the Series list in two columns on a phone as the plan page drew it; prefetch off for the fifteen hub links (the operator may flip it); the branch rebased onto B3’s fold with the suite and the dry run re-run (,); the file count; fourteen stale “four lists” and “two columns” comments; the Lists page’s and the footer tile’s words; the seed migration named with its `text_message` row; three records sentences; three assertions (the Series list in the partial-rows case, every listed F1 session URL resolved through the session route’s own lookup and distinct, one import); the heatmap rows, the F1 analysis page’s 404 session links and the accented slugs noted for X14. The reviewer’s hand-back also said the rebase gave docs/HANDOFF.md CRLF endings: it has them on main too (2,204 CR lines in both), so nothing changed. After the fold: the twelve files the change feeds → 201 tests green; `npx tsc --noEmit` → 0.

## #1128 · 1.0.245 · B3 · opened 2026-10-05 14:46:35Z; squash-merged 2026-10-05 17:34:49Z as c2e09e63 on the word of the 5th (“merge b2. merge x13.”, read as B3: no B2 PR open, X13 stacked on B3; the trend fold’s reach kept, the default); prod carries it from 17:38:49Z (the footer 1.0.245); the loader’s run dispatched 17:40:40Z (warm-live-data run 37350209256, success 17:42:38Z); the acceptance on prod: the F2 standings page rendered after the run (s-maxage=1200 at 17:47Z) with the season trend’s running totals CAM 207, TSO 200, DUN 189, MIN 163 equal to the table’s over twelve rounds (the legend reads lib/season-trend.ts’s running totals; photographed, b3-photo-f2-chart-prod.png), the F3 page UGO 159; /series/f2/results lists Baku’s Sprint Race, Feature Race 1 and Feature Race 2 (18:23Z) and /series/f3/results, re-rendered at 18:26Z, Spain’s Sprint Race, Feature Race 1 and Feature Race 2; /series/f2/weekend/12 links feature-race-1 and feature-race-2
**A round with three races, and Formula 3’s round numbers.** The operator’s word “fix f2” of the 5th on the ESPA page: the F2 trend chart stopped one race short because Baku ran three races and the FOM reader assumed two; reading the reader found Formula 3’s results one round low since its skipped round 2. The standings tables were right throughout.
- **Readers see:** the F2 and F3 season charts ending on the tables’ totals and the results tabs listing Baku’s and Madrid’s three races once the loader has run the reader (the warm workflow after the merge); Formula 3’s results under their right rounds with their links on the right weekend pages; Baku’s weekend page with its three races and their times, the second feature race with a page of its own (/series/f2/weekend/12/feature-race-2; the old /feature-race address goes, for X14’s redirects). Beyond the slot, named on the reviewer’s finding and asked at the merge: the season trend folds every round’s races into one point for every series the builder serves, so WorldSBK’s chart shows one tick a round instead of three and Formula 3’s one instead of two, and the home’s movers for Formula 3 compare round over round; the home card and the results tab’s opening row take the later race of a round when two share a date.
- **Editors get:** nothing new.
- **Files (19):**
  - `lib/results/fom-api.ts`, `lib/results/fom-api.test.ts` · every race session fetched, each race’s points at its own cell, the feed’s names, a feature win in any cell, `roundOfMeeting` by date overlap, the curated calendar through the content file system; the four B3 tests.
  - `lib/season-trend.ts`, `lib/season-trend.test.ts` · the races of one round fold into one point named after the round’s last race (the trend reader’s contract); the test.
  - `lib/design/source-read.ts` · the trend reader’s comment: the builder now hands one point per round.
  - `lib/home-results.ts`, `lib/home-results.test.ts`, `components/tabs/ResultsTab.tsx` · the later race of a round wins a date tie (the home card, the tab’s opening row); the test.
  - `lib/betting/series-sources.ts` · the settlement comment: a carried-over round settles on its first feature.
  - `content/series/f2/sessions.json` · Baku’s three races with the feed’s times.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · the B3 slot; X12’s merge and prod gate recorded (the records branch).
  - `SCHEDULE.md`, `docs/HANDOFF.md` · the day’s items; the late state (X12 on prod, the drafts, the plan pages).
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry, X12’s merge line, and the trio, 1.0.245.
- **Verified:** tests first (four red), then green: 90 tests across the eight files the reader feeds; the live probe against api.formula1.com (every F2 and F3 driver’s race points equal to the manifest’s totals: 0 of 23 and 0 of 34 off; Baku’s and Madrid’s three races under rounds 12 and 10); the full suite → 275 files, 2,664 tests green (`npx vitest run --maxWorkers=2` after the last edit; the chain’s first run had four red: three designer timeouts under the machine’s load and the trend reader’s test, answered by the last-race name); `npx tsc --noEmit` → 0; `npm run lint` → 0 errors; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` → Total Upload 40,373.03 KiB (39.4 MiB, 61.6 % of the 64 MiB ceiling; gzip 8,809 KiB); the testing Worker (the build, the deploy with wrangler.testing.jsonc, the cache populated): deployed as version cf1fc07c and the cache populated with 11,887 entries; /series/f2/weekend/12 lists sprint-race, feature-race-1 and feature-race-2 with practice and qualifying, the three race pages 200, the old /feature-race 404, the F2 and F3 standings and results tabs 200, a DTM practice page 200, the footer 1.0.245. After the reviewer’s fold: the nine files the fold feeds (`lib/results/fom-api.test.ts` with two new tests, `lib/season-trend.test.ts`, `lib/design/source-read.test.ts`, `lib/home-results.test.ts`, `components/tabs/ResultsTab.test.tsx`, the betting tests) → 108 tests green; `npx tsc --noEmit` → 0.
- **Review:** a fresh-context Sonnet reviewer read the diff (b3-review.md): FIX FIRST, the reader’s logic confirmed end to end against the live feed (F2 23 of 23 and F3 34 of 34 drivers reconciled to the totals, the three vitest files 50 of 50), eleven findings, every one folded: the KV key versioned so the post-merge loader run cannot re-persist the old bundle; the WorldSBK, Formula 3 and movers effects of the fold named (the operator’s nod asked at the merge); two tests for the untested paths; the files count and two sentences corrected; the dated change line; the orphaned docblock and four stale comments; `loadRounds` in place of a second reader; the date tie-breaks; the settlement comment; the constructors’ point named after the last race.

## #1127 · 1.0.244 · X12 · opened 2026-10-05 10:22:13Z; squash-merged 2026-10-05 11:52:02Z as 3497e914 on the word “merge x12” of the morning, the reviewer’s fold in (ea999451); the prod check and the gate on prod the prod check at 11:59Z (the footer 1.0.244; the rail’s hidden spans, “Back to the Formula 1 Azerbaijan Grand Prix weekend →”, the classification words, the Formula E round words all live); the gate on prod (x12-prod3-gate.log, the crawl of 3,190 pages at ~12:50Z): texts leading to two or more pages 234 → 10 (the nine blog posts’ editorial links, X15’s, and the archive pages’ round-0 row, X14’s), pages carrying one 2,372 → 24, targets reached 1,342 → 23, texts repeated within one page 37 → 0; with the blog posts’ source pages left out, one text, the round-0 row. X12 stays STARTED until the Seobility crawl that is its external check (the operator starts it by hand)
**Every link says where it goes.** The second of the eight Seobility PRs (the operator’s word of the 2nd on the plan page, its defaults). Seobility judges a link text site-wide, so “FP1” leading to 97 session pages was one fault on every page with the rail; a Sonnet critic replayed the rule over a 3,190-page crawl of prod (237 texts leading to two or more pages; the hidden spans read, `title` and `aria-label` not) and the plan’s second version folded its findings. No href changes.
- **Readers see:** the back links on a session page read “Back to the {series} {round} weekend →”; the calls to action on the weekend pages, the hubs and the tabs name their series (“Formula 1 standings →”, “Formula 1 news →”, “Formula 1 season results →”); the home’s “Also racing” row names each weekend beside its series; the changelog index names the release; the current session’s chip in the rail is no longer a link and the chips no longer show the session’s full title on hover (the hidden span carries those words now); the blog covers are no longer tab stops of their own; everything else is for screen readers and crawlers (a hidden identity after “FP1”, “Preview →”, “Report →”, “Classification →”, “Circuit guide →”, “.ics” and the rest).
- **Editors get:** nothing new.
- **Files (33):**
  - `lib/weekend.ts`, `lib/weekend.test.ts` · `weekendAnchorName` and `sessionAnchorName`; the unit cases and the injectivity over every curated weekend and session.
  - `app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx` · the rail’s hidden identities and its current chip as a span, the arrows, the back links, the season results link.
  - `app/(app)/series/[slug]/weekend/[round]/page.tsx`, `components/weekend/WeekendSchedule.tsx` · the schedule and result rows, the race page, the circuit guide, the preview, the news, standings, table and next-round links, the calendar link.
  - `app/(app)/series/[slug]/page.tsx`, `components/SeriesPageView.tsx`, `components/SeriesPageView.test.tsx` · the reference strip and the phone cards, the report and preview links, the standings block, the calendar link; the tab foot’s suffix, tested.
  - `components/HomeLead.tsx`, `app/(app)/blog/page.tsx`, `components/data/DataRegionViews.tsx`, `lib/design/component-render.test.tsx` · the “Also racing” row’s words, the blog covers’ hidden titles (the covers `aria-hidden`, out of the tab order), the weekend report links, the circuit view’s guide; the Podium and Circuit assertions re-pointed to the new words.
  - `content/information/answers/what-is-gt-world-challenge.md`, `content/information/answers/what-is-the-nascar-cup-series.md`, `content/information/answers/how-rally-racing-works.md` · the “how a race weekend works” links name their series; the second “World Rally Championship” link says what it leads to.
  - `app/(app)/information/page.tsx`, `app/(app)/information/series-guides/page.tsx`, `app/(app)/f1/analysis/page.tsx` · the weekend chips and the per-series guides, the four guide links per series, the qualifying and race-story links.
  - `components/tabs/ResultsTab.tsx`, `components/tabs/ResultsTab.test.tsx`, `components/tabs/DriversTab.tsx` · the classification links’ words through `RoundLinks.seriesName`, the race titles’ hidden words with the series and the round (Formula E’s doubleheaders share a name); the counts moved to the new words; the drivers tab’s standings link.
  - `app/(app)/drivers/[slug]/page.tsx`, `app/(app)/changelog/page.tsx`, `app/(app)/archive/[season]/[slug]/weekend/[round]/page.tsx` · the preview and compare links, the release link, the live-page link.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · X12 started; its scope, defaults and acceptance rewritten to the plan’s second version; the evidence.
  - `SCHEDULE.md`, `docs/HANDOFF.md` · the slot; the late state of the 2nd and the 5th (the schedule file’s line endings restored to CRLF after the rebase).
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry and the trio, 1.0.244.
- **Verified:** tests first (nine red across four files), then green (the helpers, the injectivity, the classification links, the Podium and Circuit views, the foot); the full suite → 275 files, 2,660 tests green after the last edit (two workers, 99 s); `npx tsc --noEmit` → 0; `npm run lint` → 0 errors; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` → Total Upload 40,230.55 KiB / gzip 8,778.38 KiB (1.0.243: 40,202.38 / 8,773.67; 61 % of the ceiling); the testing Worker through `npm run deploy:testing`: version c8de83bc with the prerender cache filled (11,880 entries; the gate numbers were first read on 86757a5f and held after the reviewer’s fold); the first gate on the testing Worker 237 → 53 texts before the follow-ups (the nofollow chips the critic’s crawler mis-read, the race titles, the covers, two content links); the gate after them → over 3,191 pages, texts leading to two or more pages 234 → 10 (the nine blog posts’ editorial links, X15’s, and the archive pages’ round-0 row, X14’s), pages carrying one 2,372 → 24, targets reached 1,342 → 23, texts repeated within one page 37 → 0, link texts over 120 characters 426 → 431 on the whole site (the reviewer counted +20 before its fold); with the blog posts’ source pages left out, one text left: the round-0 row (the baseline re-crawled with the repaired crawler: 234 texts leading to two or more pages (230 beyond the chrome), 2,372 pages carrying one, 1,342 targets reached, 37 texts repeated within one page on 417 page-text pairs (x12-prod2-gate.log, the night of the 2nd)); the 137-page title sweep unchanged (136 pages across every family: titles over 60 characters 0, repeating a word 1, duplicate titles 0, descriptions under 70 characters 1 and over 155 1, as before X12; /series/imsa/weekend/0 answers 404, X14’s); photographed at 390 and 1440 (x12-photo-session-390/1440, x12-photo-weekend-390/1440 and x12-photo-hub-390/1440.png in the paddock-x10 scratch directory: the rails unchanged to the eye, the current chip lit as before, the back links on two lines at 390 px, the calls to action reading as planned).
- **Review:** a fresh-context Sonnet reviewer (one agent, ~340,000 tokens, 25 min) read the diff once the PR was open: MERGEABLE AFTER FIXES; the helpers injective by its own probe over the curated files, no href changed, every hidden span inside its link after the label, every call site threaded, no test weakened, the gate numbers matching their logs. Its fixes, folded in the follow-up commit: the hidden weekend name pushed 20 links on 16 pages over Seobility’s 120-character length (the race rows that carry a winner now keep their winner and margin as their identity; a session named after its event says the weekend once), the one text the gate leaves is on the 2026 archive pages of NASCAR Cup and MotoGP (not the F2 and F3 hubs), a stray heading and a stale paragraph in the records, the file count, the entries’ dates, the schedule file’s line endings, the populate count, lint rerun after the last edit, two dated lines in the ledger’s changes for the X10 and X12 scope rewrites. Named and left: the class, cup and round words, the rail, the arrows and the rows are proven by the crawl, not by a unit test; components/data/DataRegionViews.tsx keeps a race title of its own without the series words (latent: no page renders it today).

## #1125 · 1.0.243 · X10b · opened 2026-10-02 18:43:05Z; squash-merged 2026-10-02 20:32:16Z as 512ac6dd on the word “restart x12, merge”; prod carries it from 20:38:18Z (the Carb Day Practice title without its stub, the footer 1.0.243)
**The reviewer’s findings on the titles and descriptions, folded.** #1124’s fresh-context reviewer reported after the merge (MERGEABLE AFTER FIXES; the width model measured against the Arial file, all 1,158 weekend and session pages crawled on the testing Worker). Two defects were live: 23 session titles ending in a dangling “·” and 16 event-named weekends sharing their title with their only session page.
- **Readers see:** no title ending in “·”; an IndyCar or NASCAR race page titled “… race” apart from its weekend page; long team and release names fitting the tab; the Greek headline cut a word earlier; the series-guides page’s title and snippet fitting; the news tab’s snippet naming its one source; nothing on the pages.
- **Editors get:** nothing new.
- **Files (24):**
  - `lib/site.ts`, `lib/site.test.ts` · the trailing separators and the “· round” stub (the second review), the parenthesis, the glyph widths and the capital default, the suffix from `SITE_TITLE`, the suffix’s words as repeats, the full-stop clause, the empty tail, `titleFits` inlined; the calibration and the array form tested.
  - `lib/weekend.ts`, `lib/weekend.test.ts` · the race kind for an event-named session, the session name’s prefix, the feed code as one word, the race keeping the series and the round number when even “… race” is too wide (“Race · IndyCar round 14”), the weekend page’s own title filtered out of the session’s variants; the pairs distinct.
  - `lib/tabs.ts`, `lib/tabs.test.ts` · the news source; the single-event hub’s description.
  - `components/SeriesPageView.tsx` · the hub’s kind passed; one import line for lib/tabs.
  - `app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx`, `app/(app)/series/[slug]/weekend/[round]/page.tsx` · the race kind passed; the descriptions through `fitDescription`.
  - `app/(app)/teams/[slug]/page.tsx`, `app/(app)/changelog/[release]/page.tsx`, `app/(app)/information/series-guides/page.tsx`, `app/(app)/information/[topic]/[slug]/page.tsx`, `app/(app)/blog/[slug]/page.tsx` · the titles fitted; the width check inlined; no tail on a short summary.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · X10 back to started until the crawl that is its acceptance; its scope, defaults and acceptance in pixels; the evidence.
  - `SCHEDULE.md`, `docs/HANDOFF.md`, `IDEAS.md` · the follow-up; the crawl to start by hand.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry, the corrections to #1124’s, and the trio, 1.0.243.
- **Verified:** tests first (six red across three files), then green (five files, 27 tests); the data probe over the curated files; the full suite → 275 files, 2,657 tests green (the default worker count, 4 GB free) after the second review’s fold (2,656 before it); `npx tsc --noEmit` → 0; `npm run lint` → 0 errors; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` → Total Upload 40,202.38 KiB / gzip 8,773.67 KiB (1.0.242: 40,177.09 / 8,764.16; 61 % of the ceiling); the testing Worker through `npm run deploy:testing`: version b75a8ecc with the prerender cache filled (11,870 entries); the 137-page sweep across every family measured in Arial: titles over 580 px 0, repeating a word 1 (the editorial question’s “the”), duplicate titles 0, descriptions over 1,000 px 0 and under 440 px 1 (/changelog/broadcast at 430 px, above Seobility’s 400), the widest title 567 px, the widest description 983 px; the reviewer’s crawl of every weekend and session page there → 1,158 pages (217 weekends, 941 sessions), 1,153 answering 200 and the five round-0 addresses 404 on both crawls (X14’s): titles ending in a separator 23 → 0, titles shared by two pages 16 → 0, descriptions over 1,000 px 3 → 0, no title over 580 px before or after, the widest title 570 → 569 px, the widest description 1,126 → 976 px; 80 titles changed in all (23 for the separator, 16 for the shared title, 41 for the corrected glyph widths and the feed-prefix rule).
- **Review:** a fresh-context Sonnet reviewer (one agent, ~380,000 tokens, ~20 min) read the diff once the PR was open: MERGEABLE AFTER FIXES; it re-measured the model in Arial over the 1,153 crawled pages and 2,038 curated rows (no separator, no shared title, none over 580 px) and gave three fixes, folded in the follow-up commit: the “· round” stub six live titles still ended in, the team titles’ middle variant (the Corvette pair apart; the Mercedes pair named), the social-cards sentence still wrong in the code comment, the ledger and 1.0.242’s entry; its nits named in the entry and left for the next pass.

## #1124 · 1.0.242 · X10 · opened 2026-10-02 15:20:30Z; squash-merged 15:24:05Z as 7a353666 on “merge” (~15:23Z); prod carries it from 15:32Z (checked on eight pages: “Formula 1 2026 standings”, “Who won the 2020 Formula 1 championship?” without the suffix, “Formula 1 2026 season” for the hub, “Norris takes the last Dutch Grand Prix” for a post, the descriptions 83–159 characters)
**Titles and descriptions, the first of the eight Seobility PRs.** The operator’s word of the 2nd (“merge pr e and go on the seven prs”) on the plan page https://claude.ai/code/artifact/20564572-68db-4f4e-ba6d-7e19ead87ef4. Every page’s `<title>` fits Seobility’s 580 px with the layout’s suffix (a width model of Arial, the crawl’s rows reproduced within one per cent), repeats no word and is never cut mid-word; every meta description sits between a 440 px floor and the 985 px ceiling. A Sonnet plan critic before code (its notes folded; the agent died on the session limit).
- **Readers see:** the browser tab’s title and the search snippet, nothing on the page: a session reads “Race, Azerbaijan Grand Prix — Formula 1”, a Formula 2 qualifying “Qualifying, Australian Grand Prix — F2”, a tab “Formula 1 2026 standings”, a hub “Formula 1 2026 season”, a post its headline’s first clause; the eight Indianapolis 500 sessions no longer share one title; an answer whose question does not fit beside “ — Paddock Tracker” keeps the question whole and drops the suffix (most “who won” questions): the operator’s call whether a shorter brand suffix should replace that.
- **Editors get:** nothing new.
- **Files (29):**
  - `lib/site.ts` · the width model and the three rules: fitTitle, shortTitle, fitDescription.
  - `lib/site.test.ts` (new) · the rules’ tests.
  - `lib/weekend.ts`, `lib/weekend.test.ts` · sessionPageTitle, weekendPageTitle, roundShortLabel and their cases (the crawl’s own titles).
  - `lib/tabs.ts`, `lib/tabs.test.ts` · describeTab through the rules with the single-event roll as past winners; describeHub; every series × tab × kind within the budgets.
  - `components/SeriesPageView.tsx` · the hub reads describeHub; the tabs pass the series’ kind.
  - `app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx`, `app/(app)/series/[slug]/weekend/[round]/page.tsx` · the two titles, the place and the feed’s code passed.
  - `app/(app)/drivers/[slug]/page.tsx`, `app/(app)/teams/[slug]/page.tsx` · the descriptions as variants.
  - `app/(app)/information/[topic]/[slug]/page.tsx`, `app/(app)/information/[topic]/page.tsx`, `app/(app)/information/page.tsx` · the question kept whole, without the suffix when it does not fit beside it; the topic index’s title fitted; the summaries, the indexes and the index through the rules (the social card keeps the whole summary).
  - `app/(app)/blog/[slug]/page.tsx` · the headline’s first clause and the summary’s first sentence for the tab and the snippet.
  - `app/(app)/series/page.tsx`, `app/(app)/write-for-us/page.tsx` · one clause shorter; the title “Write for us”.
  - `app/(app)/changelog/[release]/page.tsx`, `app/(app)/changelog/[release]/page.test.tsx` · a one-line story gets the release notes’ sentence; the test follows.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R18 DONE with PR D’s and PR E’s merges; the eight Seobility slots X10–X17 with the dated line of the word; X10’s evidence; 78 slots rehashed.
  - `SCHEDULE.md`, `docs/HANDOFF.md` · the merges, the plan’s word, X10.
  - `IDEAS.md` · three lines: the editor’s short title for posts, the suffix alternative, the testing deploy’s cache (listed late: the reviewer counted 29 files against 28 named).
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry, the merge lines of #1122 and #1123, and the trio, 1.0.242.
  - Corrected by #1125: the social cards carry the fitted strings (the sentence “nothing on the page” holds; the “social cards keep today’s full strings” claim did not); the topic indexes read “Formula 1 & Open-Wheel answers”; the testing Worker’s numbers describe a build before the last two folds.
- **Verified:** tests first (ten red across three files, then the changelog test on the new tail), then green: the four files → 21 tests; the data probe over the curated files (150 tab titles and descriptions, 15 hubs, 647 drivers, 252 teams, 10 topic indexes, 929 sessions, 199 weekends: nothing over a budget, no duplicate, no ellipsis, one inherent repeat); the full suite (npx vitest run) → 275 files, 2,654 tests green at the default timeouts with four workers (the machine had 2.9 GB of memory free with Docker and the browsers open; the default worker count swapped and timed out the heavy designer and calendar tests, which pass alone, 120 of 120); `npx tsc --noEmit` → 0; `npm run lint` → 0 errors (the two known warnings); `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` → Total Upload 40,177.09 KiB / gzip 8,764.16 KiB (1.0.241: 39,961.41 / 8,697.45; 61 % of the ceiling; the width table rides in every route chunk); the testing Worker: 137 pages across every family on version 82c62596 with the prerender cache filled: titles over 580 px 78 → 0, repeating a word 35 → 1 (an editorial question’s “the”), duplicate titles 3 → 0, descriptions over 1,000 px 66 → 1 (/series, trimmed in the last fold to 973 px) and under the floor 2 → 1 (/changelog/broadcast, its tail renamed in the last fold to 430 px, above Seobility’s 400); the four prerendered pages that answered 404 before the cache was filled answer 200; `npx tsx scripts/parity-page.mts` on three bodies → identical: 3 pages (a race session, a driver, an answer).
- **Review:** a fresh-context Sonnet reviewer was reading the diff when the operator’s word “merge” came (~15:23Z); the merge went first on the word, and the reviewer’s report, once in, is folded as a follow-up PR if it finds anything

## #1123 · 1.0.241 · R18 PR E · opened 2026-10-02 11:55:50Z; squash-merged 12:38:50Z as 907b1431 (rebased onto main after PR D’s squash, its five commits replayed clean, the PR retargeted to main), prod checked 12:43Z
**The search box, the champions’ links across every roster, the back-link strip, the desktop season strip.** The operator’s words of the 2nd: “search box next”, the two defaults let stand, and “D but the words points wins and margin should be above the value”. A Sonnet plan critic before code; its two blocking findings folded (the island’s root, the lookup’s fourteen). Stacked on #1122 (PR D): the branch is rebased onto main after D’s squash, the trio union-resolved. New files (the law): the island and its test, named in the plan; the merge word covers them.
- **Readers see:** a search box in the roll of honour’s bar (type a driver, a team or a year); on wide screens every season as a strip of its own with the cells aligned down the page; fourteen champions’ names linking to their driver pages; no stray “← Formula 2” under the tabs; nothing else (the parity below).
- **Editors get:** nothing new (the Roll of honour view carries the box and the strip for any series composed over the Champions source).
- **Files (20):**
  - `components/data/RollOfHonourSearch.tsx` (new) · the client island: the box, the match rule over the slugified haystack, the hiding and the counts.
  - `components/data/DataRegionViews.tsx` · the bar with its chip scroller and the box; the season wrappers with their haystacks; the strip from lg with its seven cells; the era row’s box everywhere; the empty line.
  - `lib/people.ts` · `driverAnywhere(series, name)`.
  - `lib/design/source-read.ts` · the champions reader links the champion through every roster.
  - `components/SeriesPageView.tsx` · no back link on the composed page; the stale banner’s strip only when it speaks.
  - `components/data/RollOfHonourSearch.test.tsx` (new) · the match rule; the box over the real view; two regions apart; hydration.
  - `lib/design/component-render.test.tsx`, `lib/people.test.ts`, `lib/design/source-read.test.ts`, `components/SeriesPageView.test.tsx` · the strip, the bar, the wrappers; the lookup; the links; the shell.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R18’s evidence with PR E, the needsWord line at PR E, the dated line of the 2nd’s words; `node docs/plan/render-ledger.mjs --rehash` → 70 slots rehashed.
  - `docs/HANDOFF.md` · the LATEST block at PR E and the crawl’s pickup.
  - `SCHEDULE.md`, `IDEAS.md` · the session-63 item 14; the search line closed into PR E; the stale banner’s words.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry and the trio, 1.0.241.
- **Verified:** tests first (five failing tests across four files, the island’s own test file not yet loading), then green; the full suite (npx vitest run) → 274 files, 2,642 tests green at the default timeouts; `npx tsc --noEmit` → 0; `npm run lint` → 0 errors (the two known warnings); the local server at 1440 (the strips, the box, a query typed and photographed) and 390 (the box under the chips, a chip tapped); `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` → Total Upload 39,954.88 KiB / gzip 8,694.32 KiB (1.0.240: 39,853.15 / 8,673.15; 61 % of the ceiling) (the island weighs 1,823 B minified, 965 B gzip, and rides inside the route chunks that already carry the frame’s client pieces (thirty chunks of 63–94 KB carry it in this build), no chunk of its own); the testing Worker: version 1920afd2: /series/f2/champions 368,148 · 27,700 · 194,125 bytes of HTML · wire · flight, the box, 21 strips, 14 driver links, no back link; `npx tsx scripts/parity-page.mts` on the fourteen other champions tabs → identical: 14 pages. After the review’s fold: the six files 104 green (5 files, 83 before the island’s own), `npx tsc --noEmit` 0, `npm run lint` 0 errors, the ledger test green after the rehash, the full suite (npx vitest run) → 274 files, 2,642 tests green in 53 s at the default timeouts.
- **Review:** a fresh-context Sonnet reviewer read the diff, read-only, ran the six files, tsc and lint, and worked the testing Worker in its own browser (real keystrokes, the chips tapped, the bar measured): MERGEABLE AFTER FIXES, no blocking finding; two should-fixes (this entry’s file count; the ledger’s needsWord line still naming the defaults PR, no dated line for the 2nd’s words) and six nits (the strip’s first cell showing square at the rounded corners; the box’s 13 px from 640 px, so an iPad zooms on focus; the root’s unused id; three cases unpinned: the decades’ scroll margins, the fault path’s back link, the unconfigured strip; the records’ precision: the red count, the critic’s should-fix count, a whitespace-only schedule line, two Inbox lines built but not closed, the stacked branch unnamed; the wrapper’s indentation). All folded: `overflow-hidden` on the strip, the 13 px from lg, the id dropped, the three asserts, the records corrected, the dated line in the ledger. Its final report added one should-fix, typing from inside the roll stranding the reader (the shorter roll carries the sticky bar out of view): folded, the island brings the roll’s top back under the header when the reader had scrolled in, and Enter closes the phone keyboard (a nit), each with a test; the testing Worker (the second deploy, Total Upload 39,961.41 KiB / gzip 8,697.45 KiB): typing “ga” and “hamilton” from inside the roll (scrolled 2,834 px at 1440, 5,198 px at 390) brings the roll’s top to 56 px under the header, the box at 65 px (1440) and 99 px (390), the first match at 182 and 220 px, the focus kept, Enter blurring the box; the parity on the fourteen other champions tabs → identical: 14 pages; the full suite after the fold → 274 files, 2,643 tests green. On phones the sticky bar is 88 px tall under the 51 px header for the length of the roll: named, the operator’s call. Its own full suite twice had one unrelated 5 s timeout (the calendar Filters case); my rerun after the fold: 274 files, 2,642 tests green in 53 s at the default timeouts.

## #1122 · 1.0.240 · R18 PR D · opened Fri 2 Oct 12:17 (09:17Z); squash-merged 12:37:31Z as b2679a30 on “merge pr e and go on the seven prs” (PR E carried PR D), prod checked 12:43Z
**Fornaroli’s photo beside the Reigning champion card; the phone card after the operator’s drawing.** Two words of the 2nd: “also upload it” (the photo went to prod by the build session’s hand: the file into the media bucket, the asset row through the Management API after a rehearsal) and the drawing of the roll of honour’s phone card (a season band with points and wins, the two champions side by side, the runner-up’s row with points and margin, every cell ruled).
- **Readers see:** the photo beside the reigning champion from lg (the halves stack below it); on phones every season’s card in the drawn shape, each its own box with space between, the season in bold capitals in the brand colour; nothing else (the parity below).
- **Editors get:** nothing new (the photo is an asset of the store like any other, with its caption, credit and licence).
- **Files (14):**
  - `lib/design/components.ts` · `F2_CHAMPION_PHOTO` the uploaded asset’s id (the comment states the invariant); `reigning` a half, the `photo` image half beside it.
  - `components/data/DataRegionViews.tsx` · the Roll of honour’s card below lg after the drawing, then the operator’s second look (each card its own rounded box with space between, the season band in red bold capitals, the points in red); the stat line gone; `CARD_LABEL`.
  - `lib/design/components.test.ts`, `lib/design/component-render.test.tsx` · the halves and the pinned id; the cards’ bands, champions, rookie lines and runner-up rows, the bare season.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R18’s evidence with PR D; needsWord; 70 slots rehashed.
  - `SCHEDULE.md`, `IDEAS.md` · the session-63 item 13; the phone card line closed into PR D with the data gap named and the search box proposed.
  - `docs/HANDOFF.md` · the session-64 pickup block at PR D.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry and the trio, 1.0.240.
- **Verified:** tests first (two red, then green); the full suite (npx vitest run) → 273 files, 2,637 tests green at the default timeouts; `npx tsc --noEmit` → 0; `npm run lint` → 0 errors (the two known warnings); the local server (the asset row mirrored into the local database): /series/f2/champions at 390 (the cards: the band, the two champions, the runner-up’s row, measured 346 px wide) and 1440 (the two halves, the figure with its caption; the image itself answers 404 locally, no bucket); the first commit’s build (the later commits change the card’s markup and classes alone): `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` → Total Upload 39,853.15 KiB / gzip 8,673.15 KiB (1.0.239: 39,849.49 / 8,672.57; 61% of the 64 MiB ceiling); the testing Worker: version 37803c92: /series/f2/champions 296,281 · 25,620 · 156,593 bytes of HTML · wire · flight, the photo drawn beside the Reigning champion card with its caption, credit and licence, the 21 phone cards in the drawn shape, a 200; `npx tsx scripts/parity-page.mts` on the fourteen other champions tabs → identical: 14 pages; the photo on prod: https://paddock-tracker.com/media/2026/10/4923cb28-fb30-4faf-8baf-1ef2f3862be1.jpg answers 200 image/jpeg, immutable; the asset row read back (id 56d86c87-b357-4355-a45f-80be810b7401, 1200 × 675, 175,571 bytes).
- **Review:** a fresh-context Sonnet reviewer (389,692 tokens, the four commits): MERGEABLE AFTER FIXES, no blocking finding; the should-fixes folded (a cell only with its value, since the Champions preset serves series whose files lack wins or the runner-up’s points: the band’s PTS and WINS cells and the runner-up row’s Points and Margin cells draw only with a number, the row’s columns sized to its cells, with tests; the entry’s file count and the handoff line; the gate lines named as the first commit’s; “red” as the brand colour put to the operator as a question, since the brand token is amber on the default dark theme and red on Paper) and the nits (a test for a card whose champion’s team differs from the teams’ champion, a decimal points figure, the era row’s box; the names wrap anywhere at 320 px; the photo constant’s comment states the invariant; the second look’s visible changes in the release line and the entry); not taken and named: the first image’s preload on phones (the stacked photo starts below the fold; the rule stands for the page’s first photo), the Commons file page link (the asset model has no field), Assets › Delete checking no recipe (rule 10’s gap, an Inbox line). The reviewer verified the photo on prod (200, image/jpeg, 175,571 bytes, 1200 × 675), the testing Worker’s halves and 21 cards with no overflowing cell at 390, the second look by an in-memory Tailwind compile and a class swap on the live page, the desktop rows byte-identical from lg, the F3 tab identical, tsc 0, lint 0 errors, the named tests green, no assertion weakened.

## #1121 · 1.0.239 · records · opened Fri 2 Oct 04:43 (01:43Z); the merge on the standing word
**The session-63 close: R18’s three PRs on prod, the operator’s six points of the 2nd.** Records only: the ledger’s evidence with the apply and PR C’s merge and prod check, the Inbox’s six lines, the schedule’s item 12, the handoff’s pickup block for session 64, the trio.
- **Readers see:** nothing.
- **Editors get:** nothing.
- **Files (10):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R18’s evidence (the apply at ~01:29Z with its counts, #1120 merged 01:31:08Z as b2b4ff27, prod checked ~01:42Z: 235,517 · 23,338 · 123,637 bytes of HTML · wire · flight, the two card rows, no mono foot, the fourteen tabs identical) and its needsWord (the phone card’s drawing, “upload it”, the trend chart slot’s place); 70 slots rehashed.
  - `IDEAS.md` · the six points of ~01:20Z on the 2nd, one line each, with the ESPA page.
  - `SCHEDULE.md` · the session-63 item 12.
  - `docs/HANDOFF.md` · the session-64 pickup block: R18’s three PRs on prod, the words the next steps wait for, the recipe of the photo’s upload by my hand, the defaults PR, the trend chart and driver database slots.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry and the trio, 1.0.239 (the lockfile’s two version fields).
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 70 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 green; prod’s /series/f2/champions fetched after the merge (the twelve cards with their sentences, the archive card’s new words, a cache HIT); scripts/parity-page.mts on the fourteen other champions tabs → identical: 14 pages.
- **Review:** none; records.

## #1120 · 1.0.238 · R18 PR C · opened Fri 2 Oct 00:56 (21:56Z on the 1st); the apply on “apply 20261001213000”, then the merge
**The doorways at the foot of the Formula 2 champions page.** The operator’s point of the 1st, drawn as three options and chosen as C: two card lists under their own headings, “More Formula 2” and “Around the site”, each card with a sentence written in the list editor; the shell’s mono foot leaves the composed page; the calendar box stays as the closing call. A sentence on a list entry is a new column, applied to prod before the merge.
- **Readers see:** the foot of /series/f2/champions as two rows of cards with a line each (the review page); nothing else (the parity below).
- **Editors get:** a Note on every entry of a list of their own (Shared Components › Lists), shown in the preview and drawn by the cards style.
- **Files (28):**
  - `supabase/migrations/20261001213000_list_entry_note.sql` (new) · the column with its cap; design_save_list re-created with it.
  - `lib/design/destinations.ts` · NavEntry.note.
  - `lib/design/list-edit.ts` · LIST_NOTE_MAX; the emptied note leaves; sameEntries compares it.
  - `lib/design/lists.ts` · parseEntries carries the note; the editor’s read and the pages’ lists select it; the shell’s loader does not.
  - `app/api/admin/design/lists/[key]/route.ts` · the note validated by role, trimmed, capped in words, sent only when present; a list a page’s recipe names cannot be deleted.
  - `components/designer/ListEditor.tsx`, `components/designer/ListsEditor.tsx` · the Note column, the preview, the sideways scroll; the help.
  - `components/page/RowPageView.tsx` · the card’s four parts; three columns from lg for a wide body list.
  - `lib/design/components.ts` · the recipe’s two doorway lists.
  - `components/SeriesPageView.tsx`, `components/tabs/ComposedTab.tsx` · no mono foot on the composed page; the node before alone.
  - `lib/design/lists.test.ts`, `lib/design/list-edit.test.ts`, `app/api/admin/design/lists/[key]/route.test.ts`, `components/designer/ListsEditor.test.tsx`, `components/page/RowPageView.test.tsx`, `lib/design/components.test.ts`, `components/SeriesPageView.test.tsx`, `components/tabs/ComposedTab.test.tsx` · the tests above, first red.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · PR B merged and checked on prod; R18’s scope with PR C, the dated line with the operator’s words, the evidence; 70 slots rehashed.
  - `SCHEDULE.md`, `IDEAS.md` · the session-63 item 11; the operator’s point closed into PR C.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry and the trio, 1.0.238.
- **Verified:** tests first (seven red across six files, then green); the full suite (npx vitest run) → 273 files, 2,637 tests green at the default timeouts (after the review’s fold); `npx tsc --noEmit` → 0; `npm run lint` → 0 errors (the two known warnings); the local server with the migration and the seed applied: /series/f2/champions at 1440 and 390 (the two card rows with their sentences, the call-out, no mono foot); the Note column stands on its test (the local designer needs the operator’s sign-in); `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` → Total Upload 39,849.49 KiB / gzip 8,672.57 KiB (1.0.237: 39,847.02 / 8,671.81; 61% of the 64 MiB ceiling); the testing Worker: /series/f2/champions 217,984 · 22,150 · 114,422 bytes of HTML · wire · flight (the two list regions present and empty, no mono foot, the call-out) (prod’s design rows, the lists absent until the apply); `npx tsx scripts/parity-page.mts` on the fourteen other champions tabs → identical: 14 pages (the release string masked); the prod rehearsal in begin…rollback: the column, two lists, twelve entries with twelve notes, nothing stuck after the rollback.
- **The seed (on “apply 20261001213000”, the operator’s to edit after):** More Formula 2 → The 2026 title race (series:f2:standings; “Drivers and teams, updated after every round.”), The 2026 grid (series:f2:drivers; “Every driver on this year’s grid, with a profile for each.”), Every race of 2026 (series:f2:results; “Sprint and feature, with the full classification.”), Formula 2 in 2026 (series:f2; “The rounds, the next weekend and what changed.”), Formula 2 pieces (series:f2:blog; “Our own writing on the championship, as it comes.”), The wire (series:f2:news; “Formula 2 headlines from the sources we read.”). Around the site → Every session, your time (calendar; “Every championship we follow in one calendar, in your own time zone.”), The sport, explained (learn; “Plain answers to the questions fans ask.”), This weekend (home; “What is on across every series we follow, and what just happened.”), World champions (series:f1:champions; “Every Formula 1 champion since 1950, year by year.”), Formula 3 champions (series:f3:champions; “The feeder series’ roll of honour.”), Season archive (archive; “Race weekends of every championship, captured as they were run.”).
- **Review:** a fresh-context Sonnet reviewer (437,080 tokens): MERGEABLE AFTER FIXES, then folded: one blocking finding in the seed (the archive card said “frozen as it ended” of an archive whose one season still runs: reworded in the archive’s own words), four should-fixes (the records called the Formula 2 blog tab empty: it holds one post, noindex by every blog tab’s rule; the deploy-order guard had no test: the fake records the select strings now; the two recipe lists could be deleted with nothing saying so: refused in words now; the apply’s proof step: the testing page re-fetched past its cache for the twelve cards) and the nits (the import’s shape, a comment’s wrap, the aside gate on the third column, the seed’s divergences from the mockup named, the twelve rows quoted here, the ledger’s word on one apply). The reviewer verified: the nine files 141 green, the full suite 273 files and 2,635 tests, tsc 0, lint 0 errors, the fourteen other champions tabs and Home identical between prod 1.0.237 and testing 1.0.238, the testing page as the PR says, no assertion weakened.

## #1119 · 1.0.237 · R18 PR B · opened Thu 1 Oct 22:35 (19:35Z); the merge on the word
**The Formula 2 champions page in the operator’s design.** The second of R18’s two PRs: `/series/f2/champions` takes the shape of the operator’s Claude Design page in the site’s faces with the Appearance corners (“B”): the masthead with its eyebrow and standfirst, the Reigning champion card the full width (its photo half follows the upload), the roll of honour by decade with the era row and the sticky Jump-to bar, the two title tallies, the Keep exploring list (absent until the operator authors it) and the calendar call-out. Every piece is general and in the catalogue; the page is a recipe keyed by its concrete address, drawn by the tab route through the frame’s own assembly; the fourteen other champions tabs are byte-identical. The review page: https://claude.ai/code/artifact/c439f1f5-371e-4262-8e93-c7a533ce8c09
- **Readers see:** the Formula 2 champions page in its new shape (the 1440, 800 and 390 px views on the review page); any list cut to its first rows says “+ n more”; nothing else changes (the parity below).
- **Editors get:** the Page heading’s Eyebrow and Standfirst; the Data region’s Reigning champion and Roll of honour views over the Champions source; the series tabs as destinations in the Page Designer’s Target, link and go selects (under Series) and in the list editor’s selects.
- **Files (37):**
  - `lib/design/components.ts` · the heading’s eyebrow and standfirst (summarised: false; the help says ours); the View options reigning and honours; RecipeEntry a union over every region kind; recipeRegions; the F2 recipe (the card the full width, no photo half yet).
  - `lib/design/presets.ts` · the Champions preset’s view honours; Preset['view'] knows the two.
  - `lib/design/component-render.tsx` · the heading draws its eyebrow and standfirst; the dispatch of the two views on the honour-rows shape; the List’s `more`.
  - `components/data/DataRegionViews.tsx` · DataRegionReigning (the strip sized to its tiles, dt before dd), DataRegionHonours (the table from lg, the cards below it, the nav, the era row clear of the bar, a card’s pair only with its value), MoreFoot.
  - `lib/design/destinations.ts` · series:<slug> and series:<slug>:<tab> by rule, own-key lookups; seriesDestinationOptions.
  - `components/designer/ListEditor.tsx` · the series tabs in the two selects, flat by label.
  - `components/designer/page-designer-model.ts` · goOptions’ Series group; splitRecipe names component entries only.
  - `components/designer/PageDesignerProperties.tsx` · DestinationOptions draws the Series group.
  - `lib/design/page-frame.tsx` · composedBody out of framed.
  - `components/tabs/ComposedTab.tsx` (new) · the composed tab between the shell’s nodes before and after; the children (the whole legacy layout) on the fault path.
  - `components/SeriesPageView.tsx` · the composed branch around the frame’s assembly; the legacy layout one node, handed to ComposedTab whole.
  - `components/page/RowPageView.tsx` · the first Body image’s priority.
  - `scripts/parity-page.mts` (new) · the served body of an address before and after, normalised and compared, the footer’s release string masked.
  - `components/SeriesPageView.test.tsx` (new) · the composed branch (the back link, one BreadcrumbList, the foot, no shell masthead), the fault path’s whole legacy layout with its h1, the F3 tab legacy.
  - `components/tabs/ComposedTab.test.tsx` (new) · the F2 address composed between the nodes, the F3 one the children alone, the fallback on a throw and without a row.
  - `lib/design/component-render.test.tsx` · the two views from a saved document; the List’s foot; the heading’s eyebrow and standfirst; the tiles’ order and count; the roll’s breakpoint, nav, era offset and the card’s pairs.
  - `lib/design/components.test.ts` · the View options; the recipe check kind-aware; the F2 recipe with every kind; the round trip; the heading’s tile summary.
  - `lib/design/destinations.test.ts` · the rule, the lists held equal to the catalogue’s and the content’s, every option a tab the series renders, own keys.
  - `lib/design/page-frame.test.ts` · composedBody; the body-once invariant.
  - `lib/design/presets.test.ts`, `lib/design/definitions.test.ts`, `lib/design/component-definitions.test.ts`, `app/api/admin/design/definitions/[key]/route.test.ts` · the Champions preset’s view; the heading’s pins move by two (named).
  - `components/designer/page-designer-model.test.ts` · goOptions’ Series group after the catalogue’s and before the pages.
  - `components/designer/PageDesigner.test.tsx` · the Target select’s Series group; the two greyed-option notes name the Champions views (a model change the review found).
  - `components/designer/ListsEditor.test.tsx` · the list editor’s select lists the series tabs flat.
  - `components/page/RowPageView.test.tsx` · the first Body image’s priority.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R18’s evidence with PR B’s gates and the review, corrected; 70 slots rehashed.
  - `SCHEDULE.md`, `IDEAS.md` · the session-63 items 4–5; the recipe refs gap, describeTab’s champions line, the pieces left out, the bar’s offset and the table’s roles, the operator’s point on the page’s bottom.
  - `docs/HANDOFF.md` · the mid-build pickup for the compaction and the review’s to-do.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry and the trio, 1.0.237.
- **Verified:** tests first (red, then green) for each piece and for each review finding; `npx tsc --noEmit` → 0; `npm run lint` → 0 errors (the two known warnings); `npx vitest run` → 273 files, 2,633 tests green at the default timeouts; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` → Total Upload 39,847.02 KiB / gzip 8,671.81 KiB (1.0.236: 39,523.55 / 8,586.69; 61% of the 64 MiB ceiling); the local server at 1440, 800 and 390 (the card the full width with its four tiles, the cards below lg with no name cut, one h1, one BreadcrumbList, the foot); the testing Worker: /series/f2/champions 219,849 · 22,369 · 115,363 bytes of HTML · wire · flight against 163,666 · 17,781 · 82,840 on prod 1.0.236; `npx tsx scripts/parity-page.mts` on the fourteen other champions tabs, prod before against the testing Worker after → identical: 14 pages; `scripts/parity-home.mts` → identical: 35 regions; a tab page’s client JS 834,012 → 835,025 bytes over 15 files. The prod-after check follows the deploy.
- **Review:** a fresh-context Sonnet reviewer (457,689 tokens): NOT MERGEABLE on one blocking finding, a correction of the author’s own (the two Page Designer cases failed on the greyed-option note’s new words, not at a timeout, and four records said otherwise); seven should-fixes (the photo half blank until the upload; the designer’s selects never drew the Series options; the table at md cut names; a hidden tile left a hole; the fallback lost the masthead; three tests missing) and the nits folded; two nits not taken and named (the bar’s offset and the table’s roles; the title-race link for a single-event series). The reviewer verified: tsc 0, lint 0, parity identical for the fourteen tabs and nine other tab kinds, Home identical, the testing page 200 with one h1 and one BreadcrumbList, every number equal to the content file, no test weakened.

## #1118 · 1.0.236 · R18 PR A · opened Thu 1 Oct 20:58 (17:58Z); the merge on the word
**The Formula 2 roll of honour: the facts and the Champions source.** The first of R18’s two PRs: the 21 seasons’ points, wins, podiums, runner-up and margin, nationality, era and rookie note, every row citing the archived official standings page and the season article it was read from; the Champions source, its shapes, presets and reader in the catalogue. One difference from the operator’s design: 2014’s runner-up points (229 against 204).
- **Readers see:** the Formula 2 champions tab’s depth line under each champion (“211 pts · 4 wins · beat Jak Crawford by 36”); the 21 Formula 2 “who won” Learn answers gaining “, clinching the title on N points”; the 2014 and 2017 answers’ notes reworded (the clinch totals were stated as the season’s).
- **Editors get:** the Champions source in the Data region’s Source picker with its three presets (Champions on the Table until PR B’s Roll of honour view; Drivers’ titles and Teams’ titles on the List).
- **Files (27):**
  - `content/series/f2/champions.json` · the 21 rows filled and cited (points, wins, podiums, runnerUp, runnerUpPoints, nationality, rookie where a page says so, era, sources).
  - `content/series/f2/champion-notes.json` · the 2014 and 2017 notes reworded, the official pages in their sources.
  - `lib/types.ts` · `Champion`: podiums, nationality, rookie, era, sources; the comments on wins and constructor.
  - `lib/nationalities.ts` (new) · the FIA codes and the countries; `countryName`.
  - `lib/design/sources.ts` · the eighteenth source, Champions: 27 columns; the count comment.
  - `lib/design/source-read.ts` · the reader: the derived columns, the suffix stripped, the roster links, every column on every row, the two tallies.
  - `lib/design/presets.ts` · the kinds, the source, the shapes honour-rows and title-rows, the group Champions, the three presets.
  - `lib/design/components.ts` · the Data region reads champions.
  - `lib/design/sources.test.ts`, `lib/design/presets.test.ts`, `lib/design/components.test.ts`, `lib/design/page-document.test.ts`, `lib/design/source-read.test.ts`, `components/designer/DataSourcesEditor.test.tsx`, `components/designer/DataWorkspace.test.tsx`, `components/designer/PluginsEditor.test.tsx`, `app/api/admin/design/data/sources/route.test.ts` · the counts and lists moved to eighteen sources, twenty-five groups and forty-six presets (each named as a model change); the reader’s two cases (a two-era fixture with a repeat champion and the roster’s names; the real Formula 2 file).
  - `lib/champions-integrity.test.ts` · nationality a code the site names, podiums hold the wins, an era on every row or none, sourced rows name https pages once each with an official host beside Wikipedia where they carry points, Formula 2’s eras split at 2017.
  - `lib/information/information.test.ts` · the Learn answers clinch a Formula 2 title on the curated points, in both eras.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R18 STARTED on the plan’s approval, the dated line with the eight words and the plan critic, the evidence with the gates and the review; 70 slots rehashed.
  - `SCHEDULE.md`, `IDEAS.md` · the session-63 items 3–4; the Seobility export of the 1st for its turn; the designer tests’ timeouts noted.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry and the trio, 1.0.236.
- **Verified:** tests first (12 red across nine files, then green); `npx tsx scripts/bundle-content.mts` then `npx vitest run` on the thirteen files → green; the full suite (npx vitest run) → 271 files, 2,618 tests green at the default timeouts; `npx tsc --noEmit` → 0; `npm run lint` → 0 errors (the two known warnings); the local server at `PADDOCK_ENV=production`: /series/f2/champions draws “211 pts · 4 wins · beat Jak Crawford by 36” and “beat Stoffel Vandoorne by 47”, /information/feeder-series/who-won-the-2025-formula-2-championship reads “clinching the title on **211** points”; every figure compared by script against the archived tables (the official surnames against the file’s and the article’s, the official points against the article’s) and by eye for 2005, 2014, 2017 and 2025. The Page Designer test file’s two heavy cases (P2.2, P2.24 A) pass only with time on this machine today, on main itself (4.1 s and 8.0 s on two runs of main’s own file), noted in the Inbox.
- **Review:** a fresh-context Sonnet reviewer (458,379 tokens): the 21 rows re-verified against their cited pages (0 differences, 21/21 archive URLs answering), no test weakened; two blocking findings (the public line said podiums, which PR B draws; the 2014 and 2017 notes stated the clinch totals as the season’s), five should-fixes (the fixture asserted no running count and no link; the official-source rule took any non-Wikipedia host; no pull-requests entry yet; the PR body’s placeholder and stale count) and the nits (the 2017 rookie citation, the type’s comments, the constructor-key guard, the Inbox path, the era-boundary test), all folded; MERGEABLE after the two text edits.
## #1117 · 1.0.235 · records · opened Thu 1 Oct 16:48 (13:48Z); the merge on the standing word
**R18, the champions page from the operator’s design, enters the ledger.** Records only: the slot with its decision scan (four questions for the word), the session-63 block in the schedule, the trio.
- **Readers see:** nothing.
- **Editors get:** nothing.
- **Files (8):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · the R18 slot (phase P2, planned) with its scan: the Formula 2 champions page in the shape of the operator’s Claude Design page, from general components over a Champions source, the 21 seasons’ facts curated first; the dated line with the operator’s word; 70 slots rehashed.
  - `SCHEDULE.md` · the session-63 block: the time plan, the won’t-touch line, the Active line.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry and the trio, 1.0.235 (the lockfile’s two version fields).
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 70 slots; npx vitest run lib/design/plan-ledger.test.ts → green; the design read after /design-login: get_project (F2 Champions Layout Design, PROJECT_TYPE_PROJECT, canEdit), list_files (five paths), get_file for the page, image-slot.js, support.js and .image-slots.state.json (the photo as a 67 KiB webp data URL with no credit).
- **Review:** none; records.
## #1116 · 1.0.234 · records · opened Thu 1 Oct 16:34 (13:34Z); the merge on the standing word
**B2 on prod and done with the check; the session-62 close.** Records only: the merge and prod measured, the slot closed; the baselines’ B2 section; the two follow-ups for the word in the Inbox; the handoff for session 63.
- **Readers see:** nothing (the classifications and the lighter tabs are 1.0.233’s).
- **Editors get:** nothing.
- **Files (11):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · B2 DONE with prod’s numbers; the dated line (B2 DONE, the two follow-ups for the word).
  - `docs/perf-baselines.md` · the B2 section: the method, the three tabs before, on the testing Worker and on prod, the race pages, the Worker, the review page.
  - `docs/HANDOFF.md` · the LATEST block: the session-63 build prompt (B2 done; the two follow-ups first for the word; X9’s idle count, the AdSense reading, P2.13 and the Phase 2 order; the state; the landmines with this session’s two new ones); the session-61 block demoted, its learning prompt kept there.
  - `SCHEDULE.md`, `IDEAS.md` · the session-61 items 17–18; the B2 Inbox line closed.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry and the trio, 1.0.234 (the lockfile’s two version fields).
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 69 slots; npx vitest run lib/design/plan-ledger.test.ts lib/record-notes-integrity.test.ts → green; prod 1.0.233 checked 2026-10-01T13:32:12Z (the tabs NASCAR 225,755 · 18,910 · 114,691, IndyCar 156,248 · 16,599 · 78,447, DTM 136,955 · 15,815 · 68,171; the Hollywood Casino 400 page 200 with its table, the Indianapolis 500 page 200 with its table, Mid-Ohio's race page 200 with its table and its weekend page 200 (“IndyCar · Honda Indy 200 at Mid-Ohio · Round 11”), round 18 200 (“IndyCar · WeatherTech Raceway Laguna Seca (Season Finale) ·…”), DTM's /series/dtm/weekend/1/race-2 200 with its table; the old Music City race address 404 (as named); the tabs' Classification occurrences 58 · 34 · 26 (two per earlier round), the IndyCar tab naming Mid-Ohio 3 times; every tab a cache HIT).
- **Review:** none; records.
## #1115 · 1.0.233 · B2 · opened Thu 1 Oct 15:12 (12:12Z); the merge on the word
**The event-named races: NASCAR, IndyCar and DTM get their classifications.** The three results tabs X6 B left heavy take its shape, and the race session pages of the three series show their tables; IndyCar’s results are keyed by date against the curated rounds (its rows from round 12 on linked the wrong pages), DTM’s pages read the per-race source its tab reads. The review page: https://claude.ai/code/artifact/75d8a7b2-0e2a-491d-8869-23f78265c7c4.
- **Readers see:** the NASCAR, IndyCar and DTM results tabs with the latest round open and every earlier round one line with Classification →; those series’ race session pages with the classification table (positions, drivers, teams, time or status, points) where they said practice and qualifying classifications are not published; the NASCAR and IndyCar weekend pages marking their race with the winner’s box; the DTM weekend page’s real race table in place of the chart-derived one; IndyCar’s calendar with the Honda Indy 200 at Mid-Ohio as round 11 (its weekend and race pages new, its row on the tab linking them) and the rounds from Music City on moved up one number, their addresses with them (/series/indycar/weekend/11–17 change meaning, /18 appears; the old race-page addresses of those rounds answer 404 with no redirect; the frozen 2026 archive keeps the old numbering until re-captured); every IndyCar row reaching the right page; MotoGP’s and Formula E’s race pages showing no number on a DNF row (the parsers’ 100) as DTM’s and IndyCar’s do.
- **Editors get:** nothing.
- **Files (22):**
  - `docs/HANDOFF.md` · the LATEST block: B2’s state at the close of session 61 first, the state line, the agenda; the word of ~12:24Z.
  - `content/series/indycar/rounds.json` · the Honda Indy 200 at Mid-Ohio as round 11 (3–5 July); the later rounds 12–18.
  - `content/series/indycar/sessions.json` · the Mid-Ohio block (five timed sessions: the starts from indycar.com and Fox, the ends from the track’s timetable, the race’s an estimate as the other blocks’ are); the three later blocks’ numbers.
  - `content/circuits.json` · the Mid-Ohio circuit (Wikipedia’s coordinates, America/New_York).
  - `lib/rounds-calendar.test.ts` · the IndyCar 2026 calendar’s guards (18 contiguous rounds, Mid-Ohio at 11, every override inside its round’s dates).
  - `lib/results/session-classification.ts` · `EVENT_NAMED_RACE_SERIES`, `mainRaceSession`, `isRaceSession`, `indycarRoundByDate`, `raceResultPool`, `raceFor`; `dtm` in `RACE_SESSION_SERIES`; `fetchRoundClassification` through them, with the null positions and the empty time column for a bare Finished.
  - `lib/results-cache.ts` · the session classification key at v3 for every series but F1 (v2 was written by the testing Worker’s first B2 build into the store prod shares; F1’s entries carry past sessions through OpenF1’s lockouts and keep their key).
  - `components/tabs/ResultsTab.tsx` · `raceSessionFor` through `isRaceSession` with the round’s dates; the IndyCar panel on `raceResultPool`; the comments corrected.
  - `app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx` · the race decided by `isRaceSession` for the video and the empty-state wording; the page-local flag renamed.
  - `app/(app)/series/[slug]/weekend/[round]/page.tsx` · the race session through `isRaceSession`; the race block through `raceResultPool` and `raceFor`; the decisive marking follows the race.
  - `lib/results/session-classification.test.ts`, `components/tabs/ResultsTab.test.tsx`, `lib/results-cache.test.ts` · nine new cases, the DTM case flipped, the key’s literal at v3.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · the B2 slot with its scan and evidence; R17 DONE on prod; the dated line; 69 slots rehashed.
  - `IDEAS.md`, `SCHEDULE.md` · Bing’s site scan mapped; the B2 line started; the session-61 items 13–16.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry and the trio, 1.0.233.
- **Verified:** the tests first red (nine cases), then green · `npx tsc --noEmit` 0 · `npm run lint` 0 errors (the two known warnings) · `npx vitest run` 271 files, 2,579 tests · `DATA_SOURCE=db npm run cf:build` clean · `npx wrangler deploy --dry-run` Total Upload 39572.66 KiB / gzip 8600.58 KiB on the final build (1.0.232: 39460.94 / 8574.37; 60% of the ceiling) · the testing Worker (deployed, populated): the tabs’ HTML · wire · flight NASCAR 225,024 · 19,000 · 114,691 (prod 2,161,913 · 55,964 · 1,157,139), IndyCar 152,539 · 16,695 · 76,728 (826,895 · 29,417 · 442,454), DTM 136,568 · 15,911 · 68,171 (590,939 · 27,564 · 313,680), with 58, 32 and 26 Classification → links and one open accordion each; IndyCar’s round 11 row linking Music City’s page and round 12 Portland’s, rounds 15 and 16 the two Milwaukee races (by computation on the keyed pool; the D.C. row and the IndyCar and DTM pages at 390 not opened) · the browser on the testing Worker at 1440: the Hollywood Casino 400 page with its 36 classified cars (Larson first, the points column), the 110th Indianapolis 500 page with its 33 (Rosenqvist first; the week’s Fast Six and Pit Stop Challenge not the race), Portland’s page as round 12, DTM’s Zandvoort Race 2 with real gaps; at 390: the NASCAR race page, the NASCAR weekend page with the race marked and “Kyle Larson (CC) wins”, the DTM weekend page with the real table and the winning margin · the session page’s time column empty for NASCAR’s and IndyCar’s bare Classified or Finished (the mapper; re-shot after the fix); the weekend page’s block and the tab show the parsers’ statuses as before (NOTED: the NASCAR parser’s “(CC)” suffix and the status words are a parser clean-up of their own) · THE CURATION (~12:25Z–12:40Z): `npx tsc --noEmit` 0 · `npm run lint` 0 errors (the two known) · `npx vitest run` 271 files, 2,583 tests (one designer test timed out at 5 s under the full run and passed alone, 57/57; unrelated) · the venue match probed (`matchCircuitEntry` on the location and on the title alone → mid-ohio, America/New_York) · the dry run 39523.55 KiB / gzip 8586.69 KiB · the testing Worker on the curated build: the IndyCar tab 155,861 · 16,791 · 78,447 bytes of HTML · wire · flight (from 152,539 · 16,695 · 76,728 with Mid-Ohio's row added), 34 Classification → links for the 17 earlier rounds, one open accordion; Mid-Ohio's row linking /series/indycar/weekend/11/indycar-honda-indy-200-at-mid-ohio, Music City's round 12, Portland's 13, Laguna Seca round 18; the browser at 1440: Mid-Ohio's weekend page (Round 11 · 3–5 Jul, “Pato O'Ward wins”, the classification block with 25 classified, the five sessions in the reader's zone, the venue Mid-Ohio Sports Car Course with its circuit guide, “Round 11 of the 2026 season”) and its race page (the table: O'Ward 51 first, Lundgaard, Kirkwood; “15 more classified · Show all 25”; the chips FP1 · FP2 · Quali · Warm-up · Honda Indy 200); at 390: the tab's top; rounds 12 and 18 answering as Music City and Laguna Seca (curl)
- **Review:** a fresh-context Sonnet reviewer (379,613 tokens, 117 reads and runs): one blocking finding, Mid-Ohio’s row leaving the IndyCar tab and the round chips following the curated numbers, unnamed in the records, taken to the operator (named above now); six should-fixes folded (F1’s cache key left unversioned through OpenF1’s lockouts; the end-date rule ranking a race by its words before a same-day session, tested on two race-like days, and DTM’s Race 2 picked when present; MotoGP’s and Formula E’s DNF rows named; the records’ v3, dry-run numbers, file count and stamps; RELEASES’ size claim and “from Music City on”; the weekend block’s raw positions added to the Inbox line); its nits taken or noted (the race-number guard on every series, recorded in the ledger; F3’s curated “Feature Race 1/2” against FOM’s unnumbered name gives null, no visible change today). Verified sound: the call sites, the IndyCar dates in their windows, the real weekends’ main races, the overrides on DTM’s pool, the shared key function, the trio, no secrets, no weakened check. The operator’s word on the blocking finding (~12:24Z, three options drawn as the tab’s rows): the round curated first, then the merge. A second fresh-context Sonnet reviewer on the curation delta (commit e7e45f0e; 360,137 tokens, 133 reads and runs; its notes in the scratchpad): MERGEABLE, no blocking finding. Verified sound: the four sources fetched (indycar.com’s event page, the Mid-Ohio track’s timetable, Fox’s schedule, Wikipedia’s infobox; OpenStreetMap 0.11 km from the circuit entry, Open-Meteo’s zone) and every date, time, the day of week and the coordinates checked by node; the real pipeline run in a scratchpad vitest (the live feed, the overrides, groupByWeekend, rounds.json: 18 weekends, round 11 Mid-Ohio with five sessions, with an empty feed too); all 18 pool dates in exactly one window with the column index + 1 equal to the round, the testing build’s winners for rounds 11–18 equal to Wikipedia’s; the 7 targeted test files (92) and the full suite (271 files, 2,583) green, tsc 0, nothing weakened; the entry’s 22 files equal to the diff; the programme md byte-identical to a fresh render; the KV keys carrying the session slug (no old and new pair collides), the OpenNext cache keys carrying the build id, the sitemap without IndyCar weekends. Its should-fixes folded: the two placeholders filled; the PR body’s first paragraph corrected; two consequences named in the records (the old race-page addresses of the renumbered rounds answer 404 with no redirect, the operator’s call in the handoff; the frozen 2026 archive keeps the old numbering until re-captured). Its nits folded: CHANGELOG’s earlier bullet, two stale comments (session-classification.ts, indycar.ts), the calendar guard’s title, the records’ wording on the race’s end (an estimate, as the other blocks’ are); the Music City Monday race confirmed right (indycar.com lists the race on Monday 20 July after a Sunday rainout), its Inbox line closed; the dry run 49 KiB below the previous build, unverified by the reviewer, harmless at 60%.

## #1114 · 1.0.232 · R17 · opened Thu 1 Oct 13:48 (10:48Z); the merge on the word
**The home’s weekend box times in the reader’s zone.** The This weekend boxes drew each session’s start in the server’s clock (UTC: “04:30” for a 07:30 Athens start); now the three times go through the LocalTime piece as every other session time on the site. The review page: https://claude.ai/code/artifact/1311f2a3-0012-4d55-a10e-5269a25bc678.
- **Readers see:** the home’s This weekend boxes with the session’s start in their own time zone and the weekday beside it (“Fri 07:30”), the server’s first paint carrying the Athens time with its zone label until the page is interactive.
- **Editors get:** nothing.
- **Files (13):**
  - `components/HomeLead.tsx` · `timeLabel` replaced by `localTime`, a node through LocalTime, at the three sites; the countdown’s label is the session’s name.
  - `components/NextRaceCountdown.tsx` · the optional `labelNode` drawn above the digits; `label` keeps the aria text.
  - `components/HomeLead.test.tsx` · the R17 case (the Athens-fixed strings on the server render, no bare clock, the aria names the session).
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · the R17 slot with its scan and evidence; the dated line with the operator’s numbered words of ~11:05Z; 68 slots rehashed.
  - `IDEAS.md`, `SCHEDULE.md`, `docs/HANDOFF.md` · the chrome’s chunk experiment’s result (the count stays at 14; no slot; the toolbar’s weight declined); the session-61 items 10–13; the handoff’s experiment paragraph, its R17 paragraph and its state line for session 62.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry and the trio, 1.0.232 (the lockfile’s own version field).
- **Verified:** the test first red (the Athens-fixed string absent), then green · `npx tsc --noEmit` 0 · `npm run lint` 0 errors (the two known warnings) · `npx vitest run` 270 files green and one designer test (components/designer/PageDesigner.test.tsx, the Appearance group’s dialog) timed out at 5 s once while the dev server compiled beside it, then green twice on its own (57 tests; a flake under load, unrelated to the change) · the local server at 390 and 1440 in an Athens browser: the box reads “Fri 07:30” above the digits for the 04:30Z start, the Also Friday row “Fri 11:00”, Also racing “Fri 10:00”, the aria “Time until F1 Bahrain GP - Practice 1” · `DATA_SOURCE=db npm run cf:build` clean · `npx wrangler deploy --dry-run` Total Upload 39460.94 KiB / gzip 8574.37 KiB (1.0.230: 39433.18 / 8564.55; +27.76 KiB: the LocalTime client reference joining the home’s server chunk and the day’s content bundle, not measured apart; 60% of the ceiling).
- **Review:** a fresh-context Sonnet reviewer (261,521 tokens, 65 reads and runs): one blocking finding folded (the new test read the real clock and would have gone red once the fixture’s session had passed; the clock is pinned as lib/home-model.test.ts does), three should-fixes folded (this entry’s file list and count, the stamps re-read from the real clock, the handoff’s lines that still said R17 was ahead), its nits taken (the unparsable-start claim reworded: unreachable, the loader’s toISOString throws first; the UTC-bucketed “Also <day>” heading beside a device weekday noted as a known edge west of UTC; the dry run’s growth explained). Verified sound: the six other countdown callers unchanged with their aria text, LocalTime’s hydration contract, the trio, the ledger’s hashes, no secrets, no weakened check.

## #1113 · 1.0.231 · records · opened Thu 1 Oct 13:35 (10:35Z); the merge on the standing word
**X9 on prod and done with the check; the learning track; the session-61 close.** Records only: the merge and prod measured, the slot closed; the baselines’ X9 section; the learning track decided and recorded; the handoff for session 62 and the learning session’s start prompt.
- **Readers see:** nothing (the lighter pages are 1.0.230’s).
- **Editors get:** nothing.
- **Files (11):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · X9 DONE with prod’s numbers and Seobility’s verdict; the dated lines for X9 on prod and for the learning track.
  - `docs/perf-baselines.md` · the X9 section: the method, the three pages before and after (testing and prod), the home’s files raw and wire, the Worker, Seobility’s verdict, the next lever.
  - `docs/HANDOFF.md` · the LATEST block: the session-62 build prompt and the learning session’s start prompt; the previous block demoted.
  - `SCHEDULE.md`, `IDEAS.md` · the session-61 items closed; the Inbox line for R17 (the home’s UTC times).
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json`, `package-lock.json` · this entry and the trio, 1.0.231 (the lockfile’s own version field).
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 67 slots; npx vitest run lib/design/plan-ledger.test.ts lib/record-notes-integrity.test.ts → green; prod 1.0.230 measured at 09:36Z (15 · 17 · 15 script files with the beacon; the home’s 14 files 811 KiB raw / 256 KiB wire); Seobility’s live seo_check of prod’s home at 09:38Z without the JavaScript-files hint; the worktree `C:\Dev\Personal\Motorsport-learn` on branch `learn` with `npm ci` done.
- **Review:** none; records.

## #1112 · 1.0.230 · X9 · opened Thu 1 Oct 12:10 (09:10Z); the merge on the word
**The JavaScript count: the no-op browser Sentry leaves, one error boundary fewer.** Seobility counted 16 script files on the home; two of ours did nothing for a reader (the Sentry browser SDK with no DSN, a no-op on every page; `app/error.tsx`, a boundary above both root layouts that could never render inside one). Both leave, and with the last `@sentry/nextjs` import the server SDK the 0.288.0 diet had missed leaves the Worker bundle too. The review page: https://claude.ai/code/artifact/b9be6dd9-cd2e-416f-ac42-889da9e0522c.
- **Readers see:** nothing on any page; one script file fewer and about 244 KiB less script (80 KiB on the wire) on every page. Only in a fault: a fault inside the chrome (the header, the consent modal, the toolbar) or on an admin screen now lands on the global error page's own styled document instead of a boundary that drew above the root layout without its stylesheet; page faults keep their in-layout boundary.
- **Editors get:** nothing.
- **Files (16):**
  - `package.json`, `package-lock.json` · `@sentry/nextjs` out (`npx --yes npm@10 uninstall`, 92 packages by npm's count, 122 lockfile entries); the version 1.0.230.
  - `instrumentation-client.ts`, `instrumentation.ts`, `app/error.tsx` · deleted (the operator’s `git rm`; the files pasted in the plan).
  - `app/global-error.tsx` · the Sentry import and `captureException` gone; the console line and one comment stay.
  - `next.config.ts`, `docs/launch-checklist.md`, `IDEAS.md` · the comments and lines that claimed browser reporting corrected; IDEAS gains three Inbox lines (the stale prefetch chunks that 404 after a deploy; `lib/version.ts` shipping `package.json` whole; the layout’s and the renderers’ chunking as weight).
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · X9 STARTED with its scan, defaults and evidence; R16 “the calendar on phones” planned at the end of the order (the operator’s word of ~07:00Z); the Seobility MCP’s two defaults on “ok”; the X6 calendar number measured on prod; three dated lines; the acceptance’s number named (the HTML’s script files with a browser user agent, by the plan’s approval); the ledger rehashed (R16’s hash new).
  - `docs/perf-baselines.md` · the X6 calendar row: 442,552 · 43,446 · 352,739 on prod at 06:45Z.
  - `SCHEDULE.md` · the session-61 entry.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md` · this entry and the trio.
- **Verified:** `npm run lockfile:check` green on main and on the branch · `npx tsc --noEmit` 0 · `npm run lint` 0 errors (the two known warnings) · `npx vitest run` 271 files, 2,569 tests · `DATA_SOURCE=db npm run cf:build` clean, rootMainFiles 6 → 5, no SDK left in the build output · `npx wrangler deploy --dry-run` Total Upload 39433.18 KiB / gzip 8564.55 KiB (main 41338.39 / 8982.35; 60% of the ceiling) · the testing Worker (deployed, populated), the HTML’s script files with a browser user agent: the home 15 against prod’s 16, the session page 17 (18), the calendar 15 (16); the home’s own script files 811 KiB raw / 256 KiB wire against prod’s 1,055 / 336; the browser after idle: the home 20 of ours with the router’s prefetches and 1 stale (prod this morning 14 and 12 stale 404s); Seobility’s live check of the testing home with no JavaScript-files hint · the local server: the three pages at 1440 and the home at 390, the phone bar’s Calendar tap, the toolbar for the admin, the designer; the consent modal on a fresh visit of the testing Worker at 390, Allow all closing it; a throwaway `throw` in AppShell and in DesignerLoader landing on the global error page, both reverted.
- **Review:** a fresh-context Sonnet reviewer (298,648 tokens, 73 reads and runs): one blocking finding (the programme page rendered before the last ledger edit) and five should-fixes, all folded (the acceptance’s number named by the plan’s approval in a dated line; the browser’s idle counts and the wire bytes on the review page and in the records; the consent modal proven on the testing Worker; every Sentry hit dispositioned; the baselines’ cell marked as the placeholder’s replacement); its nits taken (the package count by npm, the ceiling share, the comment’s wording, the IDEAS line). Verified sound: the sixteen files and nothing outside them, no SDK left anywhere, the lockfile self-consistent, the laws kept.

## #1111 · 1.0.229 · records · opened Thu 1 Oct 09:35 (06:35Z); the merge on the standing word
**X6 on prod and done with the check; the perf baselines; the session-60 close.** Records only: the three merges and the apply, prod measured, the slot closed; the baselines’ X6 section; the two Inbox follow-ups; the handoff for session 61; the board regenerated.
- **Readers see:** nothing (the lighter pages are 1.0.226–1.0.228’s).
- **Editors get:** the Release notes row in the App Builder (the correction applied on prod at 05:50:48Z).
- **Files (10):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · X6 DONE (the three PRs on prod, the apply, prod’s numbers); a dated line for the word.
  - `docs/perf-baselines.md` · the X6 section: the three PRs, the testing Worker and prod before and after.
  - `docs/HANDOFF.md`, `SCHEDULE.md`, `IDEAS.md` · the pickup for session 61 (X9 first in plan mode; B2 and the AdSense decisions pending), the minutes, the two Inbox lines.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.229.
- **Verified:** node docs/plan/render-ledger.mjs → 66 slots; npx vitest run lib/design/plan-ledger.test.ts lib/record-notes-integrity.test.ts → green; prod /changelog 1.0.228 by ~06:03Z (1.0.227); 1.0.228 built with success by ~06:15Z, its cached pages rolling over; the three families measured on prod (the tables in docs/perf-baselines.md); the board https://claude.ai/code/artifact/e48d9f01-f919-42c8-b726-3f413692f45e (53 of 66 done).
- **Review:** none; records.
## #1110 · 1.0.228 · X6 C · opened Thu 1 Oct 02:40 (23:40Z on the 30th); the merge on the word
**The calendar’s payload carries what the views read.** The round map keyed by the feed’s ids and each session’s ICS uid left the flight payload; each entry brings its round and a short key. PR C of three of X6 (page weight).
- **Readers see:** nothing new: the same calendar, lighter.
- **Editors get:** nothing.
- **Files (14):**
  - `components/calendar/types.ts` · `CalendarEntry.round?`.
  - `lib/design/families/calendar.tsx` · the round on each entry through `roundFor`, the short key, the map gone from the model.
  - `components/calendar/CalendarView.tsx`, `MonthView.tsx`, `WeekView.tsx`, `DayView.tsx`, `SeasonView.tsx` · `e.round` in place of the map lookups; the `roundByKey` prop gone; the FINALE badge’s last round from the entries.
  - `lib/design/component-render.tsx` · the calendar handed no map.
  - `components/calendar/MonthView.test.tsx`, `components/calendar/DayView.test.tsx` (NEW), `lib/design/component-render.test.tsx` · the cases.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · X6’s evidence: B on prod, C’s trio.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.228.
- **Verified:** the tests written before the code (three cases red), green after it; tsc 0; lint 0 errors (the two known warnings); vitest 268 files, 2547 tests; `DATA_SOURCE=db npm run cf:build` exit 0; `npx wrangler deploy --dry-run` Total Upload 41605.51 KiB / gzip 9057.54 KiB (X7’s figure; 63% of the ceiling). The local server at 1440 and 390: the month grid with its banners and This weekend cards, the week, the day with its cards, the season with the rounds, /calendar?m=2026-11 opening November; the review page https://claude.ai/code/artifact/c62e4fea-a017-4944-bce2-074713f54f28. The testing Worker (version 6419fe15), bytes, before → after: /calendar 544,934 · 54,468 · 454,014 → 442,552 · 43,456 · 352,739 (html · gzip · flight). curl -s -o /dev/null -w '%{size_download}': plain (the HTML), --compressed (the wire), with RSC: 1 (the flight payload); the testing Worker before (the previous build) and after (this PR’s build). The flight payload falls by 101 kB (a fifth): the round map and the ICS uids were what the plan named, and they weighed what they weighed (the uids run shorter than the plan assumed). What remains is the sessions themselves, about 230 bytes each for 1,500 sessions: two dates, a title, the series’ name, slug and colour, a location where the feed gives one; the views read every one of them. The plan’s estimate (a flight under 300 kB, the HTML under 400 kB) was optimistic by about 50 kB; the calendar is trimmed of what the client never read, which was the slot’s wording. One further cut is possible and not built: a table of the fifteen series (name, slug, colour) referenced by index from each entry would save about 60 kB more, at the price of every view’s reads changing; offered, not taken.
- **Review:** a fresh-context Sonnet reviewer (174,562 tokens, 44 reads and runs: the plan, every changed file in full, the round’s derivation traced to the same lookup before the key rewrite, every remaining uid read in the repo (React keys and the round lookups alone; the notification ledger and the .ics export read the series, never the calendar’s model), the Filters facets reader, the payload estimate, the three test files run green, tsc and eslint): SOUND WITH NITS, no blocking finding; it judged the nested session kept in place of the plan’s “flat” entry the right call (the same saving, a smaller diff, SessionCard and calendar-grid untouched); its should-fix folded (the plan’s named tests: a size bound on the serialised model per session in the real-loader case, and a DayView case that the cards draw the pin, the tier and the note from the entry; the calendar-grid case moot with the nested shape); its nits recorded (the pre-existing truthy checks on the round, out of scope; the trio following the merges as the build order says).
## #1109 · 1.0.227 · X6 B · opened Thu 1 Oct 02:05 (23:05Z on the 30th); the merge on the word
**The results tabs: the latest round open, the earlier rounds one line each.** A results tab carried every round’s full classification in the page, folded but shipped twice (NASCAR 2.38 MB); the latest round now opens with its classification and every earlier round is one line with “Classification →” to the race session page where that page can answer, the accordion kept where it cannot. PR B of three of X6 (page weight).
- **Readers see:** the results tab with the latest round open and the earlier rounds one line each (the round, the race to its weekend page, the date, the winner, “Classification →”); NASCAR, IndyCar, DTM and WRC as before (their rounds keep the accordion).
- **Editors get:** nothing.
- **Files (8):**
  - `components/tabs/ResultsTab.tsx` · `latestOf`, `raceSessionFor`, `roundLinks`, the mode on `RoundRow` and the two class cards, the link in `RowMeta`, the panels over one `links` object.
  - `components/tabs/ResultsTab.test.tsx` · NEW: nine cases from fixture seasons (F1, F2, WEC, GT World, DTM, NLS, WRC, the order, the picker).
  - `lib/results/session-classification.ts` · `RACE_SESSION_SERIES` exported (the set the link rule shares with the session page).
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · X6’s evidence: A on prod and its row applied, B’s trio.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.227.
- **Verified:** the tests written before the code (six cases red), green after it, the DTM case red before the reviewer’s fix and green after; tsc 0; lint 0 errors (the two known warnings); vitest 268 files, 2553 tests; `DATA_SOURCE=db npm run cf:build` exit 0 (twice, the second with the fix); `npx wrangler deploy --dry-run` Total Upload 41206.52 KiB / gzip 8954.77 KiB (the build’s own variation under X7’s figure; 63% of the ceiling). The local server at 1440 and 390: /series/f1/results (round 15 open, fourteen lines), /series/wec/results (the latest round’s classes open), /series/gt-world/results (the latest race’s cups open), /series/nascar-cup/results with its accordions; the review page https://claude.ai/code/artifact/41419d05-d1b2-4cf9-9bc4-933de9bccb3f. The testing Worker (version bf63dd38), bytes, before → after:

  | tab | before: html · gzip · flight | after: html · gzip · flight | why |
  |---|---|---|---|
  | /series/nascar-cup/results | 2,383,067 · 59,362 · 1,276,083 | 2,162,042 · 56,515 · 1,157,139 | the accordions stay: the rounds are named by event, no race session page shows their classification (the question above) |
  | /series/motogp/results | 1,262,093 · 43,555 · 676,610 | 190,816 · 17,181 · 96,536 |  |
  | /series/f1/results | 756,661 · 30,045 · 401,266 | 146,401 · 16,593 · 73,185 |  |
  | /series/wec/results | 530,430 · 26,136 · 277,389 | 161,970 · 18,096 · 81,137 | the latest round’s every class open |
  | /series/imsa/results | 481,653 · 28,475 · 249,709 | 145,095 · 17,275 · 71,892 |  |
  | /series/gt-world/results | 1,146,361 · 46,684 · 600,214 | 282,585 · 20,990 · 143,538 | the latest race’s cups open; the season listed oldest first as the feed does |
  | /series/f2/results | 1,173,920 · 39,360 · 625,210 | 219,925 · 18,355 · 112,229 | the feature and the sprint panels each open their latest |
  | /series/indycar/results | 867,764 · 30,072 · 464,564 | 826,895 · 29,795 · 442,454 | the accordions stay: the rounds are named by event (the question above) |
  | /series/dtm/results | 590,622 · 27,357 · 313,405 (prod) | 590,982 · 27,954 · 313,680 | the accordions stay: the session page has no per-race source for DTM (the reviewer’s finding; the question above) |
  | /series/wrc/results | 351,617 · 21,157 · 182,961 | 351,864 · 21,502 · 183,176 | rallies: the classification lives on the tab, under the bar already |

  curl -s -o /dev/null -w '%{size_download}': plain (the HTML), --compressed (the wire), with RSC: 1 (the flight payload). Before: the testing Worker on the previous build (the tabs as prod has them); after: the testing Worker on this PR’s build (version bf63dd38, the build with the reviewer’s fix), the tabs rendered on demand. Every tab whose rounds carry a race session falls under the slot’s 400 kB (F1 146 kB from 757, MotoGP 191 kB from 1.26 MB, F2 220 kB from 1.17 MB, GT World 283 kB from 1.15 MB, WEC 162 kB, IMSA 145 kB); NASCAR, IndyCar and DTM keep their accordions and their weight until the question above is answered; prod is measured the same way after the merge.
- **Review:** a fresh-context Sonnet reviewer (208,548 tokens, 35 reads and runs: the plan, the whole results tab and its test, the session page’s classification paths, the weekend grouping, the results feeds’ race names, the test file, tsc and eslint): REQUIREMENT GAP, one blocking finding folded: DTM’s earlier rounds linked a race session page that can never show a classification (DTM is outside RACE_SESSION_SERIES, “no per-race source yet”), a dead end where the accordion had the rows; the classification link is now given only where the session page answers (F1 through OpenF1, the class series per class, the RACE_SESSION_SERIES from their season feed), DTM keeps its accordions, a DTM case red before the fix and green after; its should-fix folded (an NLS case beside WRC’s); its scope check of the event-named series (no other series shares the NASCAR/IndyCar/WRC naming; a “Raceway” title reads as a race by accident but the session page it links answers with the round’s one race, no mislink found); its nit recorded (isRaceLikeTitle is a substring test, pre-existing).
## #1108 · 1.0.226 · X6 A · opened Thu 1 Oct 01:15 (22:15Z); the merge on the word
**The changelog on pages of its own releases.** /changelog carried all 1,014 updates twice (markup and flight payload), 2.1 MB; it now lists the releases with the newest release’s 30 newest updates inline, and every release has a page of its own with every update, prerendered at build and listed in the sitemap from a bundled release index (RELEASES.md stays out of the Worker). PR A of three of X6 (page weight).
- **Readers see:** the changelog’s releases as before, the newest release’s 30 newest updates inline and “All 226 updates →”, a page per release (`/changelog/lights-out`, `/changelog/the-finishing-pass`, …) with every update; an unknown address under /changelog answers the site’s 404.
- **Editors get:** the Release notes row in the App Builder once the seed is applied on prod (“apply”).
- **Files (21):**
  - `app/(app)/changelog/page.tsx` · the releases list with the newest 30 inline and the links; the heading and the list drawn by the shared components.
  - `app/(app)/changelog/[release]/page.tsx`, `app/(app)/changelog/[release]/page.test.tsx` · NEW: one release’s every update (force-static, dynamicParams false, the params from the bundled index, the metadata through the frame, the BreadcrumbList); its test.
  - `components/changelog/ReleaseEntries.tsx` · NEW: `ReleaseHeading`, `ReleaseUpdates`, `isRunningRelease`, moved from the page as they were.
  - `lib/release-index.ts`, `lib/release-index.test.ts` · NEW: the release headers to key, label and slug; the grammar shared with the parser; its test with the drift check against the bundled index.
  - `app/(app)/changelog/releases.ts`, `app/(app)/changelog/releases.test.ts` · the header grammar from the index module, `releaseSlug`, `findRelease`; their cases.
  - `scripts/bundle-content.mts` · `RELEASE_INDEX` emitted beside the content bundle; the comments on the file’s readers.
  - `lib/sitemap-data.ts`, `lib/sitemap-data.test.ts` · the release pages after /changelog from the bundled index; the case with RELEASES.md unreadable.
  - `lib/design/page-registry.ts`, `lib/design/page-registry.test.ts` · the row `/changelog/[release]`; the breadcrumb set and its size.
  - `supabase/migrations/20260930212400_pages_seed_changelog_release.sql` · NEW: the row’s seed insert (the preview route’s shape); prod on “apply”.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · X6 STARTED with the scan, the words and PR A’s evidence; a dated line.
  - `SCHEDULE.md` · the session-60 item.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.226.
- **Verified:** the tests written before the code (three files unresolved, one case red), green after it; tsc 0; lint 0 errors (the two known warnings); vitest 269 files, 2557 tests; `DATA_SOURCE=db npm run cf:build` exit 0; `.next/prerender-manifest.json` lists `/changelog/[release]` under `dynamicRoutes` and the sixteen release pages under `routes`; `npx wrangler deploy --dry-run` Total Upload 41738.08 KiB / gzip 9082.98 KiB (up 132.21 KiB on X7’s 41605.87: the new route’s manifests and chunks; 64% of the ceiling). The local server (PADDOCK_ENV=production npm run dev): /changelog at 1440 and 390 (the newest release open with its 30 updates and “All 226 updates →”, fifteen releases folded with “Every update in this release →”), /changelog/lights-out and /changelog/the-finishing-pass at 390 and 1440, /changelog/no-such-release the 404; the review page https://claude.ai/code/artifact/1a28c9a4-bec4-4411-89db-25d386bc6da6. The testing Worker (the same build): /changelog 163,003 bytes of HTML (17,652 on the wire, the flight 81,179), the page with the newest release’s 30 updates and “All 226 updates →” and fifteen folded releases; /changelog/lights-out 456,152 (35,102; 233,853) with its 226 updates as built (this PR’s own 1.0.226 note makes it 227 on prod), /changelog/the-finishing-pass 381,498 (36,765; 193,082), /changelog/first-light 49,925 (11,206; 22,475); /changelog/no-such-release a 404 (23,492); before: /changelog 2,125,983 bytes of HTML (171,961 on the wire, the flight 1,088,873); a release page a 404. PSI mobile and desktop: the operator’s pagespeed.web.dev runs before A and after C (the API’s daily quota was spent).
- **Review:** a fresh-context Sonnet reviewer (232,908 tokens, 68 reads and runs: the plan, every changed file in full against main, the installed docs for dynamicParams and generateStaticParams, Next’s page-export allow-list, the build chain from opennextjs-cloudflare build through npm run build and its prebuild to the regenerated bundle, the module resolution of the sitemap test’s mock, the full vitest, tsc and lint re-run): SOUND WITH NITS, no blocking finding and no requirement gap; its two should-fix items folded (the records counted the newest release’s updates as measured, 226, while this PR’s own release note makes it 227, now said so; the dry run’s share of the ceiling 64%, not 65%); its nits recorded (the release page draws its updates without the changelog list’s indent, on purpose, there being no fold to nest under; the Files count corrected to 21).
## #1107 · 1.0.225 · records · opened Thu 1 Oct 00:05 (21:05Z); the merge on the standing word
**X7 on prod and done with the check; the perf baselines; the session-60 close.** Records only: the merge, the apply, the deploy, prod measured before and after, the slot closed; the baselines appended; the handoff for session 61; the board regenerated.
- **Readers see:** nothing (the faster pages are 1.0.224’s).
- **Editors get:** the Session page’s row reads Cached in the App Builder (the correction applied on prod at 20:29:05Z).
- **Files (10):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · X7 DONE (#1106 on prod, the apply, prod’s numbers before and after); a dated line for the word.
  - `docs/perf-baselines.md` · the X7 section: the testing Worker and prod before and after, the method, what to expect.
  - `docs/HANDOFF.md`, `SCHEDULE.md`, `IDEAS.md` · the pickup for session 61 (X6 first in plan mode, then X9; the AdSense decisions pending), the minutes, the R13 C2 Inbox line closed by X7.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.225.
- **Verified:** node docs/plan/render-ledger.mjs → 66 slots; npx vitest run lib/design/plan-ledger.test.ts lib/record-notes-integrity.test.ts → green; prod /changelog 1.0.224 by 20:34:43Z; the six pages on prod `s-maxage=300` then `x-opennext-cache: HIT` (the table in `docs/perf-baselines.md`); the board https://claude.ai/code/artifact/e48d9f01-f919-42c8-b726-3f413692f45e (52 of 66 done).
- **Review:** none; records.
## #1106 · 1.0.224 · X7 · opened Wed 30 Sep 23:35 (20:35Z); the merge on the word
**Edge cache for the session pages and the designer-made pages.** Every session page and every page the catch-all serves (the calendar, the news, a row page) rendered per visitor behind `private, no-cache, no-store`; both routes now take the ISR model of the drivers and weekend pages (`revalidate = 300` and an empty `generateStaticParams`, the export that puts a route in the prerender manifest OpenNext’s cache interception keys on), so they answer `s-maxage` from the edge and, on the second request, `x-opennext-cache: HIT`. The first slot of phase X (Seobility’s findings).
- **Readers see:** the same pages, faster: on the testing Worker the F1 qualifying page of round 15 answers in 0.19–0.25 s to the first byte from the cache where it took 2.3–4.9 s, the calendar in 0.29–0.58 s where it took 1.5–3.1 s; a session’s result may show up to five minutes later than before; a designer publish still shows within seconds.
- **Editors get:** nothing new; the Session page’s row reads Cached in the App Builder once the seed correction is applied on prod (“apply 20260930194100”).
- **Files (14):**
  - `app/(app)/[...catchall]/page.tsx` · `generateStaticParams() { return []; }` beside `revalidate = 300`, with the reason; nothing else in the render path.
  - `app/(app)/[...catchall]/page.test.tsx` · the X7 case: `generateStaticParams()` answers `[]`.
  - `app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx` · `force-dynamic` and its comment out; `revalidate = 300` and `generateStaticParams` in; the comment rewritten to the measured truth (the ƒ misread, the missing export, the one no-store POST behind a stored snapshot).
  - `app/(app)/series/[slug]/weekend/[round]/[session]/page.test.tsx` · NEW (on the plan’s word): the route-scan test that reads the route file and holds the two exports and the absence of `dynamic`/`fetchCache`.
  - `lib/design/page-registry.ts` · the Session row’s rendering to `cached`.
  - `lib/design/page-registry.test.ts` · the seed case reads a rendering correction as it reads R14’s indexable one (the last word wins over the insert).
  - `supabase/migrations/20260930194100_pages_seed_rendering.sql` · NEW (a step the plan did not name; the R14 correction’s shape): the seed row to `cached`, because the registry test holds the seed migrations to the registry and an applied migration is never edited; a display value for a code page, readers see nothing; prod only on “apply 20260930194100”.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · phase X opened before phase O: X7 STARTED with the build’s evidence, X6 (page weight) and X9 (the JavaScript count) planned; a dated line for the start and the seed-row default.
  - `SCHEDULE.md` · the session-60 items.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.224.
- **Verified:** the tests written before the code (four red: the route-scan test’s three, the catch-all’s case), green after it; the registry test red on the row (dynamic against cached) until the row flipped, then red on the seed until the correction migration and its reading; tsc 0; lint 0 errors (the two known warnings); vitest 267 files, 2544 tests; `DATA_SOURCE=db npm run cf:build` exit 0 (eight information/tracks prerenders retried once past the 60 s timeout, then built); `.next/prerender-manifest.json` lists `/[...catchall]` (its routeRegex matching any one-or-more-segment path) and `/series/[slug]/weekend/[round]/[session]` under `dynamicRoutes` in the drivers’ shape (fallback null, a dataRoute, the bypass headers), where the build before the change listed neither; `npx wrangler deploy --dry-run` Total Upload 41605.87 KiB / gzip 9057.62 KiB (up 3.34 KiB on P2.15; 63% of the ceiling). The testing Worker (`wrangler deploy -c wrangler.testing.jsonc` of the same build, version 23484fc8, then `cf:populate:testing`), `curl -D -` twice per page, the time to first byte from Greece:

  | page | before: cache-control · #1 → #2 | after: cache-control · #1 (cold, the populate running) → #2 | steady state, both HIT |
  |---|---|---|---|
  | /series/f1/weekend/15/qualifying | private, no-cache, no-store · 4.87 s → 2.28 s | s-maxage=300 · 12.10 s → HIT 0.25 s | 1.21 s → 0.19 s |
  | /series/wec/weekend/6/6-hours-of-fuji-race | private, no-cache, no-store · 0.48 s → 0.27 s | s-maxage=300 · 3.57 s → HIT 1.41 s | 0.24 s → 0.22 s |
  | /series/dtm/weekend/6/race-1 | private, no-cache, no-store · 0.54 s → 0.40 s | s-maxage=300 · 2.72 s → HIT 0.96 s | 0.18 s → 0.20 s |
  | /calendar | private, no-cache, no-store · 3.06 s → 1.48 s | s-maxage=300 · 4.16 s → HIT 0.46 s | 0.29 s → 0.58 s |
  | /news | private, no-cache, no-store · 0.71 s → 1.23 s | s-maxage=300 · 3.18 s → HIT 0.22 s | 0.43 s → 0.67 s |
  | /history/monza (a 404 on the testing host) | private, no-cache, no-store · 0.26 s → 0.26 s | private (the 404’s first render) 0.76 s → HIT 0.20 s | 0.22 s → 0.21 s |

  At steady state every page answered `x-opennext-cache: HIT` with the window counting down (`s-maxage=6` … `21`), the proof that the entries live in the cache. Not done, on purpose: the plan’s “a designer publish on the testing host shows within seconds”; the testing Worker reads prod’s design rows, so a publish there is a prod write, which only an “apply” allows; the publish path is unchanged code (revalidatePath through the sharded tag cache, proven 2026-08-03), and the first publish after the merge is the check, on prod, by the operator’s hand. Prod is measured the same way after the merge and `docs/perf-baselines.md` appended.
- **Review:** a fresh-context Sonnet reviewer (211,486 tokens, 43 reads and runs: the plan whole, the diff against main, both route files, the registry test’s seed case against the seed rows, the migration against R14’s and the table’s check constraint, the WEC call chain down to the snapshot read, the model routes, the six test files run green): the code, the tests and the migration match the plan with no gap; REQUIREMENT GAP in the records alone: this entry’s Verified bullet had the file’s own header spliced into it (a `$` and backtick sequence read by a string replacement), rebuilt with a slice-and-join; its should-fix (a placeholder line in SCHEDULE.md) and its nit (no blank line before 1.0.223 in the CHANGELOG) fixed.
## #1105 · 1.0.223 · records · opened Wed 30 Sep 21:25 (18:25Z); the merge on the standing word
**X7 planned and approved; the session-59 close.** Records only: the X7 plan (approved ~18:35Z with the critic's two blocking fixes folded) carried in the handoff for session 60; the operator's search and analytics numbers answered; the minutes.
- **Readers see:** nothing.
- **Editors get:** nothing new.
- **Files (7):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · a dated line: X7 planned and approved, its build next session.
  - `docs/HANDOFF.md`, `SCHEDULE.md` · the session-60 pickup with the X7 plan verbatim and the pending AdSense decisions; the minutes.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.223.
- **Verified:** node docs/plan/render-ledger.mjs → 63 slots; npx vitest run lib/design/plan-ledger.test.ts lib/record-notes-integrity.test.ts → green.
- **Review:** none; records.

## #1104 · 1.0.222 · records · opened Wed 30 Sep 20:55 (17:55Z); the merge on the standing word
**P2.15 on prod and done; the AdSense reading; the order after the slot.** Records only: the merge, the deploy, the slot closed; the operator’s order for what follows (X7, X6, the JavaScript count, each in plan mode); the AdSense ESPA as an artifact; the board regenerated.
- **Readers see:** nothing.
- **Editors get:** nothing new (the Circuit of 1.0.221 stands).
- **Files (9):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.15 DONE (#1103 on prod); dated lines for the words of the 30th.
  - `docs/HANDOFF.md`, `SCHEDULE.md`, `IDEAS.md` · the pickup for session 60 (X7 first in plan mode; the AdSense decisions pending), the minutes, the reading’s pointer.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.222.
- **Verified:** node docs/plan/render-ledger.mjs → 63 slots; npx vitest run lib/design/plan-ledger.test.ts lib/record-notes-integrity.test.ts → green; prod /changelog 1.0.221 by 17:42:30Z; the board https://claude.ai/code/artifact/e48d9f01-f919-42c8-b726-3f413692f45e (51 of 63 done); the AdSense reading https://claude.ai/code/artifact/2e8db33a-ccdf-47df-b7bf-dac6a0536951; the Seobility triage https://claude.ai/code/artifact/4c2f6e9c-8fee-407d-accb-40c1cbdb90f5.
- **Review:** none; records.

## #1103 · 1.0.221 · P2.15 · opened Wed 30 Sep 20:35 (17:35Z); the merge on the word
**Circuit.** The round's venue as a Series-group component: the circuit's name and place, its facts from the Learn hub's circuit guide, its curated layout drawing with its credit, and its place on a map through the Map's frame on a named background; the page's weekend or a series' next, the curated venue first (the rule of 1.0.97: round 14 shows Madring, the Bahrain Grand Prix shows Sepang).
- **Readers see:** nothing until an editor places a Circuit region.
- **Editors get:** the Circuit in the gallery's Components with Series, Heading, Background and Height (while the map is on) and the Shows group (Layout drawing, Map, Facts, Circuit guide link); Map Backgrounds' Used on naming the pages with a Circuit's map.
- **Files (14):**
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the Circuit's definition; its case.
  - `lib/design/component-render.tsx`, `lib/design/component-render.test.tsx` · the two thunks, `weekendInContext` shared with the Weather, `countryName`, the renderer, READS; the render cases from saved documents (Madring by the title, Baku across the bridge, a circuit without a guide, the hub's next weekend, the switches, the one line).
  - `components/data/DataRegionViews.tsx` · `CircuitFact`, `CircuitData`, `DataRegionCircuit`.
  - `lib/design/definitions.ts`, `lib/design/definitions.test.ts` · the Utilization counts a Circuit region with its map on.
  - `lib/circuits.test.ts` · the acceptance over the real content: "Spanish Grand Prix (Madrid)" resolves to Madring, the Catalan circuit to Barcelona.
  - `components/designer/PluginsEditor.test.tsx` · eighteen definitions.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.15 started with the build's evidence; two dated lines (the X slots behind Phase 2 on the word; P2.15's start).
  - `SCHEDULE.md` · the session-59 item.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.221.
- **Verified:** the tests written before the code across five files (four red; the Madring case over the real content green at once), the first run after the code green; tsc 0; lint 0 errors (the two known warnings); vitest 266 files, 2540 tests; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` Total Upload 41602.53 KiB / gzip 9057.60 KiB (up 23 KiB on P2.12: one server renderer and one view, the map through the Map’s own chunks; 63% of the ceiling); the local designer (PADDOCK_ENV=production npm run dev): a Circuit region in the Body of the Race weekend page at its defaults, published 17:01Z: /series/f1/weekend/14 drew Madring by its title (the place line "Madring, Madrid", Spain · Street · 5.416 km · 22 · 2026, one marker on Esri's canvas, "Circuit guide →", no drawing), /series/f1/weekend/15 Baku with the f1db drawing and its CC BY 4.0 credit, the map, the facts and the guide to /information/tracks/baku-city-circuit; the dark set on Midnight through the picker; 390 px without sideways scroll (scrollWidth 380); a Circuit with Series Formula 1 on the Series hub drew the next weekend's venue, the Bahrain Grand Prix at Sepang with Country Malaysia from the code and no guide; Shared Components › Map Backgrounds listed the Race weekend and the Series hub pages under Used on; the screenshots on the review page https://claude.ai/code/artifact/f068e56e-585d-42c5-a2cb-b92cdcdadfe2.
- **Review:** a fresh-context Sonnet reviewer (192,356 tokens, 54 reads and runs: the plan, every diffed file in full, the helper’s extraction compared line by line with the Weather’s old block, the bridge and the candidate order traced, the two test groups run green), SOUND WITH NITS, no blocking finding and no requirement gap; its one should-fix folded (the place line drawn as the rail draws it, the undocumented same-as-name guard dropped); its nits recorded (the double circuit match the weekend page also makes; READS unpinned by a test as the Weather’s is).

## #1102 · 1.0.220 · records · opened Wed 30 Sep 11:35 (08:35Z); the merge on the standing word
**P2.12 on prod and done; the Seobility export read.** Records only: the merge, the deploy, the slot closed; the triage of Seobility’s full export as an artifact with eight proposed slots awaiting the word; the board regenerated.
- **Readers see:** nothing.
- **Editors get:** nothing new (the Map and Map Backgrounds of 1.0.219 stand).
- **Files (9):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.12 DONE (#1101 on prod); a dated line for the word.
  - `docs/HANDOFF.md`, `SCHEDULE.md`, `IDEAS.md` · the pickup for session 60 (the Seobility slots for the word, else P2.15 Circuit), the minutes, the triage’s pointer in the Inbox.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.220.
- **Verified:** node docs/plan/render-ledger.mjs → 63 slots; npx vitest run lib/design/plan-ledger.test.ts lib/record-notes-integrity.test.ts → green; prod /changelog 1.0.219 by 08:22:10Z; GET /api/admin/design/maps on prod answers 404 to an anonymous request (the admin gate); the board https://claude.ai/code/artifact/e48d9f01-f919-42c8-b726-3f413692f45e (50 of 63 done); the triage https://claude.ai/code/artifact/4c2f6e9c-8fee-407d-accb-40c1cbdb90f5.
- **Review:** none; records.

## #1101 · 1.0.219 · P2.12 · opened Tue 29 Sep 21:40 (18:40Z); the merge on the word
**Map and Map Backgrounds.** APEX's Map region as a component editors place: the markers of a preset's rows on a named background whose tiles follow the theme's family, the popup with the row's page; Map Backgrounds as the shared component behind it (one named background, Canvas, Esri's grey pair, key-less); the Circuit guides as the catalogue's seventeenth source, the Circuit Map's own markers as rows.
- **Readers see:** nothing until an editor places a Map region.
- **Editors get:** the Map in the gallery's Components with Preset, Background, Heading, Height, the Layer group (Latitude, Longitude, Title, Body, Link, Colour, Row rule, each opening on "Preset's own (<column>)"), Initial Position and Zoom (Type: Automatic · World) and Controls (Navigation Bar, Scale Bar, Mousewheel Zoom); Shared Components › Map Backgrounds with Canvas's tiles, key, zoom ceiling, Used on and History; the Circuit guides and the Circuits presets under Data Sources.
- **Files (44):**
  - `lib/design/map-backgrounds.ts`, `lib/design/map-backgrounds.test.ts` · the shared component's declarations (Canvas, `tilesFor`, `fillKey`), import-pure (both new, on the plan's word).
  - `components/data/MapFrame.tsx`, `components/data/MapCanvas.tsx` · the client frame (the box, the family from the root's class through a store and an observer, the gate, the hidden list) and the Leaflet canvas behind next/dynamic (both new, on the plan's word).
  - `components/data/MapFrame.test.tsx`, `components/data/MapCanvas.test.tsx` · their cases in jsdom (next/dynamic and the observer stubbed; react-leaflet stood in by components recording their props) (both new).
  - `components/designer/MapBackgroundsEditor.tsx`, `components/designer/MapBackgroundsEditor.test.tsx` · the Shared Components screen and its cases (both new).
  - `app/api/admin/design/maps/route.ts`, `app/api/admin/design/maps/route.test.ts` · the backgrounds' Utilization and key state, admin-only; a key's value never in the body (both new).
  - `lib/information/types.ts`, `components/information/TracksMapInner.tsx` · the category colours moved to the hub's types and imported back; the map unchanged in behaviour.
  - `lib/design/presets.ts`, `lib/design/presets.test.ts` · `PresetSource` and `ShapeKey` widened, `Shape.map`, the `track-rows` and `guide-rows` shapes, the Circuits and Circuit guides groups and presets; forty-three presets, twenty-four groups.
  - `lib/design/sources.ts`, `lib/design/sources.test.ts` · the Circuit guides source, the seventeenth.
  - `lib/design/source-read.ts`, `lib/design/source-read.test.ts` · the guides reader over the information registry (mocked in the tests), the every-source loop covering it.
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the Map's definition and its summary; the Data region and the Metric cards read the two sources too.
  - `lib/design/definitions.ts`, `lib/design/definitions.test.ts` · `mapBackgroundUsageFromRows` and `loadMapBackgroundUsage`.
  - `lib/design/component-render.tsx`, `lib/design/component-render.test.tsx` · the renderer (the mapping, the rule, the link, the markers, the filled tile sets, the one line), READS; the render cases from saved documents.
  - `components/data/DataRegionViews.tsx` · `DataRegionMap`.
  - `components/designer/PageDesignerProperties.tsx` · the Preset's own label for the Layer group and the Map's Link.
  - `components/designer/catalogue.ts`, `components/designer/catalogue.test.ts`, `components/designer/Designer.tsx`, `components/designer/Designer.test.tsx` · Map Backgrounds editable under User Interface (eighteen editors), mounted from `?sc=maps`.
  - `app/globals.css` · the accent marker's class.
  - `lib/design/page-document.test.ts` · a Map's mapping and link checked against its preset's shape, its preset against its Source; the Source list's new members.
  - `components/designer/PluginsEditor.test.tsx`, `components/designer/DataSourcesEditor.test.tsx`, `components/designer/DataWorkspace.test.tsx`, `app/api/admin/design/data/sources/route.test.ts` · seventeen definitions, seventeen sources.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.12 started with the build's evidence; a dated line.
  - `SCHEDULE.md` · the session-59 item.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.219.
- **Verified:** the tests written before the code across eighteen files (13 red and five unresolved modules), the first run after the code green with the counts aligned, the designer-flow case (PageDesigner.test.tsx) green first run; tsc 0; lint 0 errors (the two known warnings); vitest 266 files, 2536 tests; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` Total Upload 41579.43 KiB / gzip 9067.57 KiB (up 234 KiB on P2.11: the Map’s frame and canvas as chunks of their own, Leaflet riding in the canvas’s as the Circuit Map’s does, the guides reader behind the readers’ thunk; 63% of the ceiling); the local designer (PADDOCK_ENV=production npm run dev): a Map region in the Body of the /information/map page over Circuit guides, preset Circuit guides, background Canvas, published 18:06Z: 139 markers in their categories' colours on Esri's light canvas under Paper, the popup "South Garda Karting · Italy · Open" to /information/tracks/south-garda-karting, the foot "139 markers · Canvas", the 139 places as a hidden list of links, the zoom control and the attribution; the tiles swapped to World_Dark_Gray_Base without a reload on the picker's mutation of the root (data-theme midnight, the dark class), and Midnight chosen through the picker at /settings/theme opened the map dark from the first paint; at 390 px the page never scrolled sideways (scrollWidth 380); republished over Tracks with the Circuits preset and the Automatic view: 98 markers in the theme's accent without a link ("Lusail International Circuit · QA"), the foot "98 markers · Canvas"; Shared Components › Map Backgrounds listing Canvas (two Esri hosts, no key, max zoom 16) with Used on naming the Tracks map page (the button opened it in the App Builder); the screenshots on the review page https://claude.ai/code/artifact/229737c4-317b-4bbd-a6dc-e4b28f4332f2.
- **Review:** a fresh-context Sonnet reviewer (228,083 tokens, 92 reads and runs: the ten new files in full, every diff cross-checked, 18 test files run green), SOUND WITH NITS, no blocking finding and no requirement gap (the link resolution hand-traced through its three cases against the parser’s rowLinks check; the guides reader’s filter byte-equivalent to the Circuit Map page’s; Leaflet imported by the two canvases alone, both behind next/dynamic; the frame’s family read traced through hydration; the usage scan diffed against the sources’; the accent class against the cascade); its two should-fix items folded (a keyed test background beside the catalogue, so the route’s key state and secrecy and the editor’s Key cell are exercised for real) and its nit answered (a designer-flow case for the Map in PageDesigner.test.tsx: the Layer selects and the Link opening on the preset’s own, the Background and Type pills, Save).


**P2.11 on prod and done.** Records only: the merge, the deploy, the slot closed; the board at a new link.
- **Readers see:** nothing.
- **Editors get:** nothing new (the Chart of 1.0.217 stands).
- **Files (8):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.11 DONE (#1099 on prod); a dated line for the word.
  - `docs/HANDOFF.md`, `SCHEDULE.md` · the pickup (P2.12 Map and Map Backgrounds next), the minutes.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.218.
- **Verified:** node docs/plan/render-ledger.mjs → 63 slots; npx vitest run lib/design/plan-ledger.test.ts lib/record-notes-integrity.test.ts → green; prod /changelog 1.0.217 by 16:08:28Z; the board https://claude.ai/code/artifact/e48d9f01-f919-42c8-b726-3f413692f45e (49 of 63 done).
- **Review:** none; records.

## #1099 · 1.0.217 · P2.11 · opened Tue 29 Sep 18:55 (15:55Z); the merge on the word
**Chart.** APEX's Chart region as a component editors place: a line, bars or an area for a value column by a label column over a preset's rows, one series or one per distinct value of a column; the Season trend as the catalogue's sixteenth source, the standings tab's charts as rows; the page's own team drawn thick on its page.
- **Readers see:** nothing until an editor places a Chart region.
- **Editors get:** the Chart in the gallery's Components with Preset, Type, Heading, Height, the Series group (Label, Value, Series Name, Row rule), the Axes group (the titles, Start at zero) and the Legend group (Show Legend, Series shown at first, Emphasis); the Season trend under Shared Components › Data Sources with two presets; the mapping selects opening on "Preset's own (<column>)".
- **Files (27):**
  - `components/data/ChartFrame.tsx`, `components/data/ChartCanvas.tsx` · the client frame (the box, the chips, the gate, the hidden table) and the Recharts canvas behind next/dynamic (both new, on the plan's word).
  - `components/data/ChartFrame.test.tsx`, `components/data/ChartCanvas.test.tsx` · their cases in jsdom (the canvas mounted with render(), the critic's probe: renderToStaticMarkup draws Recharts' wrapper alone) (both new).
  - `lib/design/presets.ts`, `lib/design/presets.test.ts` · `PresetSource` widened, `Shape.chart` on six shapes, the `trend-rows` shape, the Season trend group and its two presets, `numeric` exported; forty-one presets, twenty-two groups.
  - `lib/design/sources.ts`, `lib/design/sources.test.ts` · `TREND_SERIES` and the Season trend source, the sixteenth.
  - `lib/design/source-read.ts`, `lib/design/source-read.test.ts` · the trend reader over the snapshot dispatch and lib/season-trend, one row per driver and round, MotoGP's split, the refusals.
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the Chart's definition and its summary; the Data region and the Metric cards read the trend too.
  - `lib/design/component-render.tsx`, `lib/design/component-render.test.tsx` · the renderer (the mapping, the rule, the ranking, the emphasis through the rosters, the one line), READS, the people thunk; the render cases from saved documents (Racing Bulls among them).
  - `components/data/DataRegionViews.tsx` · `DataRegionChart`.
  - `components/LazySeasonTrendChart.tsx` · `buildLineStyles` exported for the frame.
  - `components/designer/PageDesignerProperties.tsx`, `components/designer/PageDesigner.test.tsx` · the Preset's own label for the Chart's Series group; the designer case (Source Season trend, the mapping selects, the Type pills, Save).
  - `lib/design/page-document.test.ts` · a Chart's mapping and rule checked against its preset's shape, its preset against its Source.
  - `components/designer/PluginsEditor.test.tsx`, `components/designer/DataSourcesEditor.test.tsx`, `components/designer/DataWorkspace.test.tsx`, `app/api/admin/design/data/sources/route.test.ts` · sixteen definitions, sixteen sources.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.11 started with the build's evidence; a dated line.
  - `SCHEDULE.md` · the session-59 items.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.217.
- **Verified:** the tests written before the code across eleven files (17 red), the first run after the code green with the counts and labels aligned; tsc 0; lint 0 errors (the two known warnings); vitest 261 files, 2515 tests; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` Total Upload 41345.47 KiB / gzip 9022.83 KiB (up 392 KiB on P2.14: the Chart’s frame and canvas as chunks of their own, the trend reader behind the readers’ thunk; 63% of the ceiling); the local designer (PADDOCK_ENV=production npm run dev): a Chart region in the Body of the /teams/[slug] page over Season trend · Formula 1 · 2026, preset Constructors' season trend, Emphasis This page's driver or team, published 14:54Z: /teams/mclaren drew every constructor's line with McLaren's 3.5 px wide and always shown, the top six as chips, "+5 more", the foot "Points by Round · McLaren highlighted"; /teams/racing-bulls thickened "RB F1 Team" through Hadjar's and Lawson's rows; a Chart region on the /series/[slug]/[tab] page over the Drivers' season trend: /series/f1/standings drew the lines with the chips' totals equal to the drivers' table and the tab's own chart (302, 236, 199, 186, 179, 163), /series/motogp/standings one tick per round with the sprints folded (15, as the tab's), its totals the riders' table's (306, 294, 264), F3's and WorldSBK's totals the tab's own chart's (141/141, 602/469) once a round with several races answered one row; republished over Standings · Formula 1 (Drivers) the bars of points by driver in the championship's colour; over Session results the one line (the local Baku qualifying carries no gaps); at 1440 and 390 px; the screenshots on the review page https://claude.ai/code/artifact/0884fa7a-31c4-425b-9a94-af52292ba014.
- **Review:** a fresh-context Sonnet reviewer (242,026 tokens, 69 reads and runs), SOUND, no blocking finding and no requirement gap (the invariant traced through the eight series’ pointsExact flags and MotoGP’s split against the tab’s; the emphasis traced by hand for Racing Bulls; every Recharts prop checked against the installed types; the bundle rule: only lib/slug and a type join the frame’s chunk; every changed test raises a count or adds a case); its three nits folded (two stray blank lines, aria-expanded on the legend’s fold buttons).


**P2.14 on prod and done; the session-58 handoff.** Records only: the merge, the deploy, the Sepang check on prod, the slot closed; the handoff block for session 59.
- **Readers see:** nothing.
- **Editors get:** nothing new (the Weather of 1.0.215 stands).
- **Files (8):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.14 DONE (#1097 on prod); a dated line closing session 58.
  - `docs/HANDOFF.md`, `SCHEDULE.md` · the session-59 pickup block (the prompt, the state, the recipes, the landmines), the minutes.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.216.
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 63 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; prod /changelog 1.0.215 by 13:05:54Z; prod /series/f1/weekend/16 “Source: Open-Meteo · Petronas Sepang International Circuit”.
- **Review:** none; records.

## #1097 · 1.0.215 · P2.14 · opened Tue 29 Sep 15:56 (12:56Z); the merge on the word
**Weather.** The forecast at the track for a weekend as a component editors place, by venue-local time: hour by hour across each session, or day by day with the sessions; the site's one reader as the source; the weekend page's strip and the session page's forecast corrected to the round's curated venue.
- **Readers see:** Sepang's forecast on the Bahrain Grand Prix page (it read Sakhir's); nothing else until an editor places a Weather region.
- **Editors get:** the Weather in the gallery's Components with Series, View, Heading and Rows per session.
- **Files (17):**
  - `lib/weather.ts`, `lib/weather.test.ts` · `sessionTiles`, `dayTiles`, `dayLabel`, `hourLabel` (the strip’s builders, shared) and their cases; the stale SessionCard note corrected.
  - `lib/weekend.ts`, `lib/weekend.test.ts` · `nextWeekend`, `nextSessionAcross` on it.
  - `components/weekend/WeekendWeatherStrip.tsx`, `components/weekend/SessionForecast.tsx` · the shared builders; a `venue` prop resolved through `venueCandidates` (the fix on the word).
  - `app/(app)/series/[slug]/weekend/[round]/page.tsx`, `app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx` · the curated venue handed to the pieces.
  - `lib/design/build-option-defaults.ts` · the Weather option's words name the region.
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the definition and its catalogue test.
  - `components/data/DataRegionViews.tsx` · `DataRegionWeather`.
  - `lib/design/component-render.tsx`, `lib/design/component-render.test.tsx` · the renderer behind dynamic imports, the READS entry, the render test from a saved document.
  - `components/designer/PluginsEditor.test.tsx` · fifteen definitions listed (the Weather joins).
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.14 started with the build's evidence; a dated line.
  - `docs/HANDOFF.md`, `SCHEDULE.md` · the pickup, the minutes.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.215.
- **Verified:** the tests written before the code across five files, the first run after the code green; tsc 0; lint 0 errors (the two known warnings); vitest 259 files, 2500 tests; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` Total Upload 40953.14 KiB / gzip 8926.15 KiB (up 1.3 MiB on P2.10: the weather reader and its KV client as an on-demand chunk of their own; 62% of the ceiling); the local designer: a Weather region in the Page Header of the /series/[slug]/weekend/[round] page, published locally 12:37Z: /series/f1/weekend/16 (the Bahrain Grand Prix at Sepang, 2–4 October) drew FP1 · FP2 · FP3 · QUALI · RACE hour by hour in venue-local time with Source: Open-Meteo · Petronas Sepang International Circuit, and the page's own strip further down the identical tiles naming Sepang (by name alone it read Sakhir); the region republished as Day by day (12:39Z) drew a tile per venue-local day (2, 3, 4 October) with the sessions and their hour's reading under each; a Weather region with Series Formula 1 on /series/f1 (12:41Z) drew the same next weekend; at 1440 and 390 px; the screenshots p214-weekend-desktop, p214-weekend-strip, p214-weekend-phone, p214-daily-desktop, p214-hub-desktop; the review page https://claude.ai/code/artifact/109f380c-c13c-4dfb-ad27-ba4ac3c4d9a1.
- **Review:** a fresh-context Sonnet reviewer (166,827 tokens), SOUND, no blocking finding (the tile arithmetic hand-checked against the fixtures, the venue fix wired at both call sites, the bundle rule, the strip's markup byte-identical but for the prop); its notes taken (the build option checked before the views load; the day fallback's markup shared with the strip left for Phase 3; the drafts kept out of the commit)

## #1096 · 1.0.214 · records · opened Tue 29 Sep 15:05 (12:05Z); the merge on the standing word
**P2.10 on prod and done.** Records only: the merge, the deploy, the slot closed; the Bing slots behind Phase 2 on the word.
- **Readers see:** nothing.
- **Editors get:** nothing new (the Tabs of 1.0.213 stand).
- **Files (8):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.10 DONE (#1095 on prod); a dated line for the word.
  - `docs/HANDOFF.md`, `SCHEDULE.md` · the pickup (P2.14 Weather next), the minutes.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.214.
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 63 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; prod /changelog 1.0.213 by 12:04:55Z.
- **Review:** none; records.

## #1095 · 1.0.213 · P2.10 · opened Tue 29 Sep 14:44 (11:44Z); the merge on the word
**Tabs.** APEX's Region Display Selector as a component editors place: a tab strip over the page's regions that opt in (one at a time, or all with a scroll to each, the choice remembered, icons when asked), or a strip of links over the sibling pages.
- **Readers see:** nothing until an editor places a Tabs region; then the strip.
- **Editors get:** the Tabs in the gallery's Components with Over, Mode, Include Show All, Remember Last Selection and Display Region Icons; Region Display Selector (Advanced) and Icon (Appearance) on every region.
- **Files (25):**
  - `components/page/RegionTabs.tsx`, `components/page/RegionTabs.test.tsx` · the client strip and its cases in jsdom (both new, on the plan’s word).
  - `lib/design/destinations.ts`, `components/BottomBar.tsx` · `ICON_NAMES` as a plain list; the bar keyed by it, `BAR_ICON_NAMES` the alias, `BAR_ICONS` for the strip.
  - `lib/design/page-document.ts`, `lib/design/page-document.test.ts` · `selector` and `icon` on a region, the parser, `tabsOf`, `applyTabs`.
  - `components/page/RowPageView.tsx`, `components/page/RowPageView.test.tsx` · `applyTabs` before the regions are drawn, on a row page and around a code page.
  - `components/designer/PageDesignerProperties.tsx`, `components/designer/PageDesigner.test.tsx` · Region Display Selector (Advanced), Icon (Appearance), saved on the region.
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the definition and its catalogue test.
  - `lib/design/breadcrumb.ts`, `lib/design/breadcrumb.test.ts` · `siblingPages` from the address.
  - `components/data/DataRegionViews.tsx` · `DataRegionPageTabs`.
  - `lib/design/component-render.tsx`, `lib/design/component-render.test.tsx` · `RenderContext.tabs`, the renderer behind dynamic imports, the READS entry, the render test from a saved document.
  - `components/designer/PluginsEditor.test.tsx` · fourteen definitions listed (the Tabs join).
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.10 started with the build's evidence; a dated line.
  - `docs/HANDOFF.md`, `SCHEDULE.md` · the pickup (the board’s new link), the minutes.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.213.
- **Verified:** tests first (8 red across eight files), then green; tsc 0; lint 0 errors (the two known warnings); vitest 259 files, 2494 tests; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` Total Upload 39673.91 KiB / gzip 8688.42 KiB (measured before the reviewer’s one-line fold in page-document.ts); the local designer: on /history/imola a Tabs region from the gallery and a Preview and a Report region with Region Display Selector on, published locally 11:22Z: the strip Show all · Preview · Report, Preview shown and Report hidden in the page source, the Report tab switching and the choice kept across a reload (paddock:tabs:/history/imola:tabs = text-2), Show all showing both, Scroll Window (republished 11:28Z) hiding none and scrolling the page to the region; on /series/[slug]/[tab] a Tabs over Sibling pages in the Breadcrumb Bar (published 11:26Z): /series/f1/standings drew Calendar · Standings · Results · Rounds · Drivers · Champions · Blog · News with Standings current, /series/f1/drivers Drivers current; at 1440 and 390 px; the screenshots p210-single-desktop, p210-single-report, p210-single-phone, p210-pages-desktop, p210-pages-phone; the review page https://claude.ai/code/artifact/f48e0ca2-023c-4e11-866f-95437f5fa758.
- **Review:** a fresh-context Sonnet reviewer (185,293 tokens), SOUND WITH FIXES, one blocking finding folded with its test (applyTabs shows the first tab when it was stored Hidden at first, since the strip marks it selected); its notes taken (two Tabs regions over one position would share the tab set; the drafts stay out of the commit)

## #1094 · 1.0.212 · records · opened Tue 29 Sep 13:39 (10:39Z); the merge on the standing word
**P2.17 on prod and done.** Records only: the merge, the deploy, the slot closed.
- **Readers see:** nothing.
- **Editors get:** nothing new (the Breadcrumb of 1.0.211 stands).
- **Files (8):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.17 DONE (#1093 on prod); a dated line for the word.
  - `docs/HANDOFF.md`, `SCHEDULE.md` · the pickup (P2.10 Tabs next), the minutes.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.212.
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 63 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; prod /changelog 1.0.211 by 10:38:44Z.
- **Review:** none; records.

## #1093 · 1.0.211 · P2.17 · opened Tue 29 Sep 13:25 (10:25Z); the merge on the word
**Breadcrumb.** The page's place in the site from its address as a component editors place in the Breadcrumb Bar: Home, the pages above as links, the page itself, a separator; its BreadcrumbList where the page's code prints none.
- **Readers see:** nothing until an editor places a Breadcrumb; then the trail above the page.
- **Editors get:** the Breadcrumb in the gallery's Components with Show Home, Separator and This page; Create › Breadcrumb Region alive.
- **Files (23):**
  - `lib/design/breadcrumb.ts`, `lib/design/breadcrumb.test.ts` · the trail and its cases (both new, on the plan’s word).
  - `lib/design/composed-page.ts` · `matchCodePage` over every registry row; `matchComposedPage` on it.
  - `lib/design/page-registry.ts`, `lib/design/page-registry.test.ts` · `OWN_BREADCRUMB_LD` and the test holding it to the route files, their components and the families.
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the definition and its catalogue test.
  - `components/data/DataRegionViews.tsx` · `DataRegionBreadcrumb`.
  - `lib/design/component-render.tsx`, `lib/design/component-render.test.tsx` · the renderer behind a dynamic import, the READS entry, the render test from a saved document.
  - `lib/design/page-frame.tsx`, `lib/design/page-frame.test.ts` · the route's address parts into the components (`routeParams`).
  - `components/designer/PageDesigner.tsx`, `components/designer/PageDesigner.test.tsx` · Create › Breadcrumb Region alive; the entry and its placement tested.
  - `components/designer/PluginsEditor.test.tsx` · thirteen definitions listed (the Breadcrumb joins).
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.17 started with the build's evidence; the Phase 2 order and Phase O with O1 as dated lines.
  - `docs/HANDOFF.md`, `SCHEDULE.md` · the pickup, the minutes.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.211.
- **Verified:** tests first (4 red across four files, the catalogue's and the registry's tests red on the missing pieces), then green; tsc 0; lint 0 errors (the two known warnings); vitest 258 files, 2483 tests; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` Total Upload 39457.97 KiB / gzip 8630.07 KiB; the local designer: Create › Breadcrumb Region on the /series/[slug]/[tab] page, saved and published locally 10:08Z; /series/f1/standings drew HOME › SERIES › FORMULA 1 › STANDINGS above the tab's masthead at 1440 and 390 px, /series/f1/drivers … › DRIVERS, the page source carrying one BreadcrumbList (the page's own); the designer-made /history/monza (published 10:12Z): HOME › MONZA, A HISTORY under the title with the region's BreadcrumbList (the page's code prints none), one in the source; the screenshots p217-tab-desktop, p217-tab-phone, p217-row-desktop; the review page https://claude.ai/code/artifact/3b0bc458-72a2-4e7e-8180-a3c33e48a7ea.
- **Review:** a fresh-context Sonnet reviewer (163,866 tokens), SOUND, no blocking finding and no fix (the ownership set cross-checked against the call sites, the trail rules against the plan, the frame's params against every renderer, the escaping, the bundle rule); its notes taken (a part carrying a slash would desync the prefix walk, cosmetic; the /social pages carry no resolver by design)

## #1092 · 1.0.210 · records · opened Tue 29 Sep 11:51 (08:51Z); the merge on the standing word
**P2.8 on prod and done.** Records only: the merge, the deploy, the slot closed.
- **Readers see:** nothing.
- **Editors get:** nothing new (the Countdown of 1.0.209 stands).
- **Files (8):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.8 DONE (#1091 on prod); a dated line for the word.
  - `docs/HANDOFF.md`, `SCHEDULE.md` · the pickup (the Seobility export next), the minutes.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.210.
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 62 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; prod /changelog 1.0.209 by 08:50:02Z.
- **Review:** none; records.

## #1091 · 1.0.209 · P2.8 · opened Tue 29 Sep 11:35 (08:35Z); the merge on the word
**Countdown.** The next session of one series or the nearest across every series as a component editors place: its name, its weekend, the reader's time and the time at the track, the digits, LIVE while it runs.
- **Readers see:** nothing until an editor places a Countdown; then the box.
- **Editors get:** the Countdown in the gallery's Components with Series, Heading, Time at the track and Links.
- **Files (16):**
  - `lib/weekend.ts`, `lib/weekend.test.ts` · `nextSessionAcross` and its cases (new test file, on the plan’s word).
  - `lib/circuits.ts`, `lib/circuits.test.ts`, `content/circuits.json`, `scripts/fetch-circuit-timezones.mts` · the `tz` on every circuit, its check, the lookup script (new, on the plan’s word).
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the definition and its catalogue test.
  - `components/data/DataRegionViews.tsx` · `DataRegionCountdown`.
  - `lib/design/component-render.tsx`, `lib/design/component-render.test.tsx` · the renderer behind dynamic imports, the READS entry, the render test from a saved document.
  - `components/designer/PluginsEditor.test.tsx` · twelve definitions listed (the Countdown joins).
  - `eslint.config.mjs` · the crawlers’ output folders ignored.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.8 started with the build's evidence; a dated line.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.209.
- **Verified:** tests first (7 red across four files), then green; tsc 0; lint 0 errors (the two known warnings); vitest 257 files, 2468 tests; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` Total Upload 39352.23 KiB / gzip 8555.89 KiB; the local designer: the tile in the gallery, Add To → Body, Series Formula 1, saved and published locally, /series/f1 drawing the Bahrain Grand Prix's Practice 1 with the reader's time and Sepang's (GMT+8), the same weekend and session as the driver page's Next out; the review page https://claude.ai/code/artifact/3cdd1ce5-03ac-4d65-8739-1048fc2c4e42.
- **Review:** a fresh-context Sonnet reviewer (210k tokens), SOUND WITH FIXES, one blocking finding folded with its test (first in the Body without a heading, the empty state's line is the page's h1) and its notes taken (formatLocal for the track's time; the site's box outline and shadow with the series' colour as the eyebrow's bar; the weekend page's location rule; the tz script keeps the file's shape; the editor test's comment; the live tie-break noted)

## #1090 · 1.0.208 · records · opened Tue 29 Sep 10:00 (07:00Z); the merge on the standing word
**R15 on prod and done.** Records only: the merge, the deploy, prod's robots.txt, the census, the pickup for the Seobility crawl.
- **Readers see:** nothing.
- **Editors get:** nothing new.
- **Files (8):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R15 done with the checks; a dated line with the day's order.
  - `docs/HANDOFF.md`, `SCHEDULE.md` · the pickup (the Seobility export next), the minutes.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.208.
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 62 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; the prod checks and the census quoted in the ledger.

## #1089 · 1.0.207 · R15 · opened Tue 29 Sep 05:31 (02:31Z); the merge on the word
**Crawlers kept off the filter chips' combination URLs.** One robots.txt line, `Disallow: /*?*filter=`, with a test over Google's matching rules.
- **Readers see:** nothing.
- **Editors get:** nothing new.
- **Files (8):**
  - `app/robots.ts`, `app/robots.test.ts` · the line and its cases (a filtered calendar or news URL blocked, the plain pages, the sitemap, a series link with another query and every sitemap page allowed).
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R15's evidence; a dated line with the operator's order for the next day.
  - `docs/HANDOFF.md`, `SCHEDULE.md` · the pickup, the minutes.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.207.
- **Verified:** tests first (2 of 3 red), then green; tsc 0; lint 0 errors (the two known warnings); vitest 256 files, 2461 tests; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` Total Upload 39244.61 KiB / gzip 8536.74 KiB; the dev server's /robots.txt carries the line.
- **Review:** a fresh-context Sonnet reviewer (97k tokens), SOUND, 0 blocking; its two notes taken: the sort and view links are a handful per page, not a combination graph, and stay crawlable by design, and a test case pins that boundary

## #1088 · 1.0.206 · records · opened Tue 29 Sep 01:25 (28 Sep 22:25Z); the merge on the standing word
**R14 on prod and done; the crawlers’ reports; R15 proposed.** Records only: the merge, the deploy, the prod checks, the census and the workflow’s first run, the Ahrefs overview and the filter-combination finding, the pickup.
- **Readers see:** nothing.
- **Editors get:** nothing new.
- **Files (9):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R14 done with the checks; R15 planned with its decision scan; two dated lines.
  - `docs/HANDOFF.md`, `SCHEDULE.md`, `IDEAS.md` · the pickup (R15 on the word), the minutes, the Inbox lines.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.206.
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 62 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; the prod checks, the census and the workflow run quoted in the ledger.

## #1087 · 1.0.205 · R14 B · opened Mon 28 Sep 22:23 (19:23Z); the merge on the word
**The index's shape, the registry's three rows, and a census of every page.** The registry corrected with its seed migration and test; the weekend pages indexed only with a written note and the four table tabs out of the index and the sitemap, one predicate each for the page and the sitemap; the census script with its weekly workflow.
- **Readers see:** nothing; every page stays reachable. Search engines see the Learn and author pages, the noted weekends and the hubs; the data-only pages ask to stay out.
- **Editors get:** a weekend page back in the index by writing its note in `content/series/<slug>/weekend-notes.json`.
- **Files (17):**
  - `lib/design/page-registry.ts`, `lib/design/page-registry.test.ts`, `supabase/migrations/20260928190000_pages_seed_indexable.sql` · the three rows on, the seed correction, the last-word rule and the rows' test.
  - `lib/tabs.ts`, `lib/tabs.test.ts` · `NOINDEX_TABS` and `tabIsIndexed`.
  - `lib/series-content.ts`, `lib/series-content.test.ts` · `hasWeekendNote`.
  - `app/(app)/series/[slug]/weekend/[round]/page.tsx`, `components/SeriesPageView.tsx` · the robots rules.
  - `lib/sitemap-data.ts`, `lib/sitemap-data.test.ts` · a weekend only with a note, no tab of the list; the F1 count derived from the notes.
  - `scripts/seo-census.mts`, `scripts/seo-census.test.ts`, `.github/workflows/seo-census.yml`, `.gitignore` · the census, its checks over fixtures, the weekly run, the output ignored.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R14's evidence.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.205.
- **Verified:** tests first (4 red across two files), then green; tsc 0; lint 0 errors (the two known warnings); vitest 255 files, 2458 tests; `DATA_SOURCE=db npm run cf:build` clean; `npx wrangler deploy --dry-run` Total Upload 39248.85 KiB / gzip 8537.13 KiB; on the local server with the migration applied: weekend 1 index, weekend 18 noindex, the four tabs noindex, champions, the hub, a Learn answer, a topic and /authors index; the local sitemap 996 URLs (f1 weekends 12, no thin tab, champions 15); the census against prod 1,279 pages, 0 contradictions.
- **Review:** a fresh-context Sonnet reviewer (231k tokens), SOUND WITH FIXES, 0 blocking; its five fixes and its note folded before the PR (tabIsIndexed at both call sites; the migration wrapped in begin…commit like its siblings; the workflow closes its issue on the next green run; actions/upload-artifact@v7 confirmed as the latest release through the GitHub API; /information/series-guides and /information/map counted with the hub; one user agent)

## #1086 · 1.0.204 · records · opened Mon 28 Sep 21:36 (18:36Z; first written 18:50Z, corrected); the merge on the standing word
**R13 C2 on prod and done; the Learn pages back in the index; the SEO and AdSense report; R14 opened.** Records, plus the record of one production change made by hand on "apply".
- **Readers see:** nothing on the pages; search engines see the Learn and author pages again.
- **Editors get:** nothing new.
- **Files (10):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R13's C2 on prod with the checks and R13 done; R14 opened with its decision scan and the apply's evidence; two dated lines.
  - `docs/perf-baselines.md` · C2's prod numbers under the testing measurement.
  - `docs/HANDOFF.md`, `SCHEDULE.md`, `IDEAS.md` · the pickup (R14's build first, the report's later steps), the day's minutes, four Inbox lines.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.204.
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 61 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; the prod checks quoted in the ledger (curl, 18:31–18:36Z); the apply's three verify reads (HTTP 201) in the ledger.

## #1085 · 1.0.203 · R13 C2 · opened Mon 28 Sep 18:15 (15:15Z); the merge on the word
**The Worker answers a cached page from the routing layer.** OpenNext's cache interception on, measured on the testing Worker first; the prod switch is the operator's.
- **Readers see:** the same pages, a little sooner and steadier when cached; nothing else.
- **Editors get:** nothing new.
- **Files (11):**
  - `open-next.config.ts` · `enableCacheInterception: true` with the why.
  - `docs/perf-baselines.md` · the testing measurement, the cold samples, the middleware checks, the next lever.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R13's PR C2 evidence.
  - `docs/HANDOFF.md`, `SCHEDULE.md`, `IDEAS.md` · the pickup (the prod switch on the word, then the catch-all's pages), the minutes, one Inbox line.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.203.
- **Verified:** `DATA_SOURCE=db npm run cf:build` clean (the home ○ in the manifest, revalidate 300); deployed to testing (version f555ad91, 11,755 entries populated); twenty interleaved fetches against prod per page and two cold samples (the table in docs/perf-baselines.md); the middleware checks on testing; tsc 0; lint 0 errors (the two known warnings); vitest 252 files, 2447 tests; `npx wrangler deploy --dry-run` Total Upload 39235.19 KiB / gzip 8533.75 KiB.
- **Review:** a fresh-context Sonnet reviewer (239k tokens), SOUND WITH FIXES, 0 blocking; its two fixes folded before the word (this review line; a caveat in the perf section: the /calendar control answers about 27% faster on testing than on prod either way, so part of the home, series and blog gap is a testing-versus-prod offset and the real read is prod's own before and after once switched) and its notes taken (the measurement script reads x-opennext-cache too for the next run; the two cold samples' seconds stand in the record, their curl output was not kept; tsc and lint were run, their logs not kept)

## #1084 · 1.0.202 · records · opened Mon 28 Sep 17:18 (14:18Z; first written 14:40Z, corrected); the merge on the standing word
**R13 C1 on prod; the numbers after; the contact form connected; the session-58 pickup.** Records only: the merge, the deploy, the plan's prod checks, the Lighthouse run after, the contact form's connection, the pickup.
- **Readers see:** nothing.
- **Editors get:** nothing new.
- **Files (10):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R13's PR C1 on prod with the checks and the numbers; a dated line.
  - `docs/perf-baselines.md` · the Lighthouse run of the home on 1.0.201, mobile and desktop, beside the baseline.
  - `docs/HANDOFF.md`, `SCHEDULE.md`, `IDEAS.md` · the session-58 pickup (PR C2 first, the contact form's state), the day's minutes, two Inbox lines.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.202.
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 60 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; the prod checks quoted in the ledger (curl, 14:05–14:15Z); Lighthouse's JSON in the session's scratchpad.

## #1083 · 1.0.201 · R13 C1 · opened Mon 28 Sep 14:55 (11:55Z); the merge on the word
**The covers at the size their boxes need.** Every cover from Wikimedia Commons through the thumbnail service's bucketed widths, with a srcset on the lead covers and lazy loading below the fold; the drivers page on the shared rule.
- **Readers see:** the same pictures, a tenth of the bytes; the first picture sooner.
- **Editors get:** nothing new; a cover pasted as a Commons original or as any Commons thumb is drawn right either way.
- **Files (14):**
  - `lib/commons-thumb.ts`, `lib/commons-thumb.test.ts` · new (on the plan's word): the rule and its cases.
  - `components/data/DataRegionViews.tsx`, `components/HomeLead.tsx` · the lead cover (960, srcset, sizes), the thumbnails (250, lazy), the Cards media (120, lazy), the Table picture (250, lazy); the twins.
  - `app/(app)/blog/page.tsx` · the list's lead (960, srcset, its sizes the true box beside the rail with the 520 px cap from 1582 px) and the rows (500, lazy from the fourth), both with the post's title as alt.
  - `components/blog/PostHeader.tsx` · PostHero (960, srcset up to 1920, the high fetch priority, the article column's sizes).
  - `app/(app)/drivers/[slug]/page.tsx` · the private helper replaced by the import, the portrait at 500 as before.
  - `lib/design/component-render.test.tsx`, `components/HomeLead.test.tsx` · Commons-shaped fixtures; the rebucketed src, the srcset, the sizes and the lazy loading asserted.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · PR C1's evidence.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.201.
- **Verified:** tests first (three red across two files), then green; tsc 0; lint 0 errors (the two known warnings); vitest 252 files, 2447 tests; cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39226.12 KiB / gzip 8532.20 KiB; on the local server: the driver page's Commons portrait through the shared helper at 500 and the home's and the blog list's site-local covers drawn as they are (the local database holds no Commons cover: the Commons path is the unit tests' and, after the deploy, prod's HTML); after the deploy: Lighthouse against prod's home, appended to docs/perf-baselines.md.
- **Review:** a fresh-context Sonnet reviewer, SOUND WITH FIXES, 0 blocking; its three fixes folded before the PR (the thumbnails at 250 for their 104 px box, the blog list lead's sizes with the true box beside the rail, the high fetch priority on the post's cover); noted, not done: the Cards media and the Table pictures lazy wherever their region sits, a 36 or 64 px picture never a page's largest element

## #1082 · 1.0.200 · records · opened Mon 28 Sep 12:35 (09:35Z); the merge on the standing word
**R13 A and B on prod; the performance baseline; the session-57 handoff.** Records only: the two merges, the deploy, the plan's prod checks, a Lighthouse baseline for PR C, the pickup for session 58.
- **Readers see:** nothing.
- **Editors get:** nothing new.
- **Files (8):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R13's PR A and PR B on prod with the checks; a dated line.
  - `docs/perf-baselines.md` · the Lighthouse baseline of the home on 1.0.199, mobile and desktop (appended).
  - `docs/HANDOFF.md`, `SCHEDULE.md` · the session-57 close and the session-58 pickup.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.200.
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 60 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; the prod checks quoted in the ledger (curl, 09:21Z); Lighthouse's JSON in the session's scratchpad.
- **Review:** none; records.

## #1081 · 1.0.199 · R13 B · opened Mon 28 Sep 01:55 (27 Sep 22:55Z); the merge on the word
**The SEO check of 2026-09-27, PR B: the images' words.** Content images name their content; the look does not change.
- **Readers see:** nothing new on the page; a screen reader hears the story's title on a thumbnail beside its title (the cover's link stays hidden, a card's link names itself).
- **Editors get:** nothing new.
- **Files (9):**
  - `components/data/DataRegionViews.tsx` · the lead's cover and thumbnails, the Cards media, the Table picture.
  - `components/HomeLead.tsx` · the twins of the cover and the thumbnails.
  - `lib/design/component-render.test.tsx`, `components/HomeLead.test.tsx` · the assertions of the title as the alt, the Cards media case, the lead's twin.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · PR B's evidence.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.199.
- **Verified:** tests first (three red across two files), then green; tsc 0; lint 0 errors (the two known warnings); vitest 251 files, 2443 tests; cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39186.50 KiB / gzip: 8521.43 KiB; on prod after the deploy: every image on the home with a non-empty alt (pasted into the ledger).
- **Review:** a fresh-context Sonnet reviewer (154,652 tokens): SOUND, nothing to fix: every alt resolves to the content's words or stays empty where none exists, the cover's link hidden from a reader, the card's media inside its own aria-hidden span, the thumbnails and the Table picture heard twice beside their title (the plan's accepted trade); the two signed-in avatars stay decorative

## #1080 · 1.0.198 · R13 A · opened Mon 28 Sep 01:40 (27 Sep 22:40Z); the merge on the word
**The SEO check of 2026-09-27, PR A: the server and the head.** Every finding verified on prod first; the code fixes that need no look change.
- **Readers see:** a plain http or a www link lands on the apex over https (one 301); the home's title and description in search results are shorter; nothing on the pages changes.
- **Editors get:** nothing new; a Page heading region that is not first in the Body is an h2 of the same look.
- **Files (13):**
  - `middleware.ts`, `middleware.test.ts` · the two 301s before the session read, by exact host; three cases (http, www, the other hosts untouched).
  - `next.config.ts` · `poweredByHeader: false`.
  - `app/(app)/layout.tsx` · `icons.apple`; the Organization and WebSite JSON-LD on every page.
  - `app/(app)/page.tsx` · the title (53 characters) and the description (148).
  - `lib/design/component-render.tsx`, `lib/design/component-render.test.tsx` · page.heading an h1 only when first in the Body.
  - `IDEAS.md` · the anchors and the copy left by design.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R13 on the word; PR A's evidence.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.198.
- **Verified:** tests first (three red across two files), then green; tsc 0; lint 0 errors (the two known warnings); vitest 251 files, 2442 tests; cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39186.43 KiB / gzip: 8521.38 KiB; on the local server: the head carries the Apple icon link and two ld+json blocks, the title and the description as written; the redirects cannot fire locally by design (the unit tests carry them); on prod after the merge: the curl checks of the plan, pasted into the ledger.
- **Review:** a fresh-context Sonnet reviewer (207,798 tokens): SOUND WITH FIXES, none blocking; it traced the favicon suppression the local server had shown (an icons object in the metadata ends Next's file-based icon merge, resolve-metadata.js) and confirmed /icon.png as the favicon's route; the redirects' loop-safety traced to the Worker's own request scheme, OpenNext's Location normalisation, the header flag, the JSON-LD, the lengths and the heading level confirmed; its one gap, the records, closed in this commit

## #1079 · 1.0.197 · records · opened Sun 27 Sep 23:06 (20:06Z); the merge on the standing word
**P2.7 done on prod.** Records only: the merge, the deploy, the slot closed.
- **Readers see:** nothing.
- **Editors get:** nothing new (the Metric cards of 1.0.196 stand).
- **Files (6):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.7 DONE (#1078 on prod); a dated line for the word.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.197.
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 59 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; prod /about 1.0.196 by 20:03:21Z.
- **Review:** none; records.

## #1078 · 1.0.196 · P2.7 · opened Sun 27 Sep 17:01 (14:01Z); the merge on the word
**Metric cards.** APEX 26.1's Metric Card as a component over the catalogue's sources: a card per figure (a column of a row, or the count of rows), its label, description and trend; the Preset without the Data region's resets.
- **Readers see:** nothing until an editor places a Metric cards region on a page.
- **Editors get:** a Metric cards component in the Gallery: the Source and the Preset, a Heading, Columns per row, four cards each with a label, a figure (a column's value or the row count), a value, a description and a trend column and a row rule; the tile naming the preset, the columns and the cards; every column choice outside the Data region's Card slots starting at None.
- **Files (11):**
  - `lib/design/components.ts` · the `data.metrics` definition (the preset options without `sets`, the Heading, the Columns, four Card groups, the six sources); `settingsSummary`'s branch for it.
  - `lib/design/component-render.tsx` · the renderer (the Data region's read path, every row the preset keeps, a card per figure with its row rule bound to the shape), READS.
  - `components/data/DataRegionViews.tsx` · `MetricCard` and `DataRegionMetrics` (the figures through `cellValue`, a share as a percent, the dash, the trend for a reader, the site's box, the grid).
  - `components/designer/PageDesignerProperties.tsx` · the columns select's empty option: Preset's own for the Card slots alone, None elsewhere.
  - `lib/design/components.test.ts`, `lib/design/page-document.test.ts`, `lib/design/component-render.test.tsx`, `components/designer/PluginsEditor.test.tsx`, `components/designer/PageDesigner.test.tsx` · the tests, first red (six across five files).
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.7 started on the approved plan; the evidence; a dated line.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.196.
- **Verified:** tests first (six red across five files), then green; tsc 0; lint 0 errors (the two known warnings); vitest 251 files, 2439 tests; cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39316.01 KiB / gzip: 8556.29 KiB; in the browser on the local designer: a Metric cards region added to /series/f1 from the Gallery (Source Standings · Formula 1 · 2026, Preset Drivers, four cards: Leader = the name with the points beneath, Gap to second = the gap of position.eq:2 with the name beneath, Wins, Drivers classified as a count; Columns 4; the heading), saved and published locally, the hub at 1280px and 390px with the cards above its body (the screenshots in the review page).
- **Review:** a fresh-context Sonnet reviewer (220,242 tokens): BLOCKING on a link column drawing a live link inside the figure (the plan: no link on a card in this slot), fixed to the words alone; its four fixes taken (a name column's default label from the preset, a count card ignoring fields left from before, the heading as the page's h1 when first in the Body, stable keys), each with a test; the rest left as it was with its reasons

## #1077 · 1.0.195 · records · opened Sun 27 Sep 12:58 (09:58Z); the merge on the standing word
**R12 and P2.5 C done on prod.** Records only: the two merges, the deploys, the prod checks (the phone grid in the browser, the news parity by curl).
- **Readers see:** nothing.
- **Editors get:** nothing new.
- **Files (6):**
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R12 DONE (#1075 on prod, the 390px check); P2.5 DONE (PR C #1076 on prod, the parity of /news); a dated line for the word.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.195.
- **Verified:** node docs/plan/render-ledger.mjs --rehash → 59 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; prod /about 1.0.194 by 09:53:58Z; prod /calendar at 390px in the browser (the month grid with its bars and counts); prod /news against the capture of 01:37Z (the fields above).
- **Review:** none; records.

## #1076 · 1.0.194 · P2.5 C · opened Sat 27 Sep 05:20 (02:20Z); the merge on the word
**The news page on the Filters region and the Headlines view.** The last of P2.5's three PRs: `/news` off its route file, composed as the heading, a Filters region over the wire's series and the wire on the Headlines view, every row shown.
- **Readers see:** the same page (title, description, card, breadcrumb, the h1 "The wire", the same rows in the same order) with every headline at once in two columns instead of twenty and Load more; one Series chip (the Filters region, a pick in the address) instead of the thirteen series chips; Everything / Yours only as before for a reader who follows series (a pick in the address starts at Everything; an empty Yours only says so); the standfirst and the footer gone; the masthead at the site's page-heading size (34px, 40px from md) instead of the route's own 38px, 46px (the reviewer's finding, named as the operator's call).
- **Editors get:** the news page in the designer as a composed page (Quick Edit, Customize, the Filters region's facets); the Headlines view for a news region; a Filters region over a Headlines region; the Rows cap at 150.
- **Files (25):**
  - `app/(app)/news/page.tsx`, `app/(app)/news/NewsPageContent.tsx`, `app/(app)/news/loading.tsx` · deleted: the route file, its rows and chips, its skeleton.
  - `lib/design/families/news.tsx` · new: the metadata and the breadcrumb the route printed (the calendar family's shape).
  - `lib/design/page-registry.ts`, `lib/design/page-families.ts` · `/news` served from rows, its name News; the family mapped.
  - `lib/design/components.ts`, `lib/design/presets.ts` · the Headlines view option and the view union; the Rows cap 150; `SPLITS['/news']`.
  - `components/data/DataRegionViews.tsx`, `components/data/FollowedRows.tsx` · the Headlines view; FollowedScope (Everything / Yours only, the pick in the address winning, the empty note).
  - `lib/design/component-render.tsx`, `lib/design/page-document.ts` · the view dispatched; a Headlines region as a Filters target (FILTER_VIEWS; the parser's list and message).
  - `lib/design/page-registry.test.ts`, `lib/design/composed-page.test.ts`, `lib/design/components.test.ts`, `lib/design/component-render.test.tsx`, `components/data/FollowedRows.test.tsx`, `lib/design/page-document.test.ts`, `components/designer/PageDesigner.test.tsx` · the tests, first red (the designer's note names the Headlines view).
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.5 pages `/news`, done on the merge; the evidence; a dated line.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.194.
- **Verified:** tests first (eight red across six files), then green; tsc 0; lint 0 errors (the two known warnings); vitest full green (251 files, 2435 tests); cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39288.68 KiB / gzip: 8549.71 KiB; in the browser on the local designer: /news at 1280px (the heading, the Series chip, Everything / Yours only for the signed-in operator who follows Formula 1, the two columns), Everything showing every series, MotoGP picked through the chip narrowing the list by the address with Everything active, /news at 390px in one column (the four screenshots in the review page); PARITY of /news (prod's HTML before, 01:37Z, against the local page after): title, description, canonical, og:title, h1 and the breadcrumb identical, the same rows in the same order (the first three quoted in the PR), 130 rows at once against 20 and Load more, the thirteen series chips against one Series chip, the standfirst and the footer gone, the masthead at the site's heading size (34/40 against the route's 38/46), Yours only absent from the server HTML in both (the browser draws it for a reader with follows).
- **Review:** a fresh-context Sonnet reviewer: SOUND WITH FIXES, none blocking: the trio (in this records commit) and the masthead's size (the route's 38/46px against the site's page heading at 34/40px), named in the parity as the operator's call, the component not special-cased; its first-read gap (an empty Yours only) fixed during the review with a note and a test; the browser proof done here (four screenshots)

## #1075 · 1.0.193 · R12 · opened Sat 27 Sep 04:40 (01:40Z); the merge on the word
**The month grid on phones.** The operator's word for the desktop calendar on mobile: the seven-column grid at every width, the phone agenda gone, a day's sessions as series bars below md, a tap opening the day.
- **Readers see:** on a phone, the month as a grid (the date, the day's count, a bar per series) instead of the agenda list; a tap opens the day as before. The desktop as it was.
- **Editors get:** nothing new.
- **Files (8):**
  - `components/calendar/MonthView.tsx` · the grid at every width; the agenda, its comment and its day formatter removed; the bars below md sharing the cell's width; the cell's floor 52px below md, the desktop's 100px as it was; the day's name for a phone reader (visually hidden, below md only).
  - `components/calendar/MonthView.test.tsx` · the grid at every width, the bars and the lines, the one desktop floor, the reader's name, the tap, the three-bar cap (replacing R11's agenda case, whose gutter is gone with the agenda).
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R12 on the word; its evidence.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.193.
- **Verified:** tests first (the grid case red on the agenda), then green; tsc 0; lint 0 errors (the two known warnings); vitest full green (251 files, 2429 tests); cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39508.31 KiB / gzip: 8590.15 KiB; in the browser on the local server at 390px: the month grid with its bars and counts, a day tapped opening the Day view; at 1280px the desktop grid as it was (screenshots .playwright-mcp/r12-01..03; the review page as an artifact).
- **Review:** a fresh-context Sonnet reviewer: BLOCKING on a leftover desktop floor (a 72px md floor beside main's 100px on one cell, the winner undecidable from the source), fixed to main's floor alone; its two fixes taken (the bars sharing the cell's width, the day's name for a phone reader) and its cap test written; the empty month left as the desktop has it

## #1074 · 1.0.192 · R11 · merged Sat 27 Sep 04:00 (01:00Z) under the standing word
**The operator's phone report: the boxed result spilling past the screen, the Learn hint cut short, the calendar's floating date, the contact form's silent email.** Three of the four items fixed; the fourth, the calendar's mobile shape, is a question in the ledger's R11 slot.
- **Readers see:** on a phone the Podium box (Home's latest result, and any Podium region) stays inside the screen, its long names truncated as on desktop; the Learn field's hint reads whole ("Ask a question — try “what is DRS”"); the calendar agenda's date sits at the top of its day; the contact form says "message stored, a reply may take longer" when its email did not go, and "could not be delivered" when nothing kept the message.
- **Editors get:** nothing.
- **Files (19):**
  - `components/data/DataRegionViews.tsx` · min-w-0 on the Podium's classification column.
  - `components/HomeLead.tsx` · the same on Home's own Latest result, the verbatim twin.
  - `lib/design/component-render.test.tsx` · the Podium case asserts the column's class.
  - `components/information/AskField.tsx`, `components/information/AskField.test.tsx` · the hint at 34 characters; the test holds it under forty with its example.
  - `components/calendar/MonthView.tsx`, `components/calendar/MonthView.test.tsx` · self-start on the date gutter; the test finds it on a day of two sessions.
  - `app/api/contact/route.ts`, `app/api/contact/route.test.ts` · stored as the write's truth, the failures logged with a phase, 503 when nothing kept the message; three cases.
  - `components/ContactModal.tsx` · the honest line on emailed: false.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · R11 with its question and default, the dated line.
  - `IDEAS.md`, `docs/HANDOFF.md`, `SCHEDULE.md` · one Inbox line; the session block; the day.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.191.
- **Verified:** the other session's tests first (five red across four files) and its phone proof in Chromium and WebKit at 390px on prod's mirrored Home (the column's right edge 337 against the section's 357 after); here: tsc 0; lint 0 errors (the two known warnings); vitest full green; cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39514.40 KiB (39513.89 before; the edits after that build were tests alone).
- **Review:** a fresh-context Sonnet (~150k said, 162,962 measured, 50 tool uses): BLOCKING on one finding of the take itself, not of the fixes: the taken test file predated PR B and would have erased the calendar Filters tests; restored from main with the Podium's assertion re-applied (b8b660e2), the twin in HomeLead asserted too; the four fixes found correct, in scope and covered; the version collision named and redone at 1.0.192.

## #1073 · 1.0.191 · P2.5 PR B · merged Fri 25 Sep 21:15 (18:15Z) under the standing word
**The calendar page on the Filters region.** The live /calendar rebuilt on the Filters box (the operator's "swap the pages"): the series and the sessions as facets of the calendar's own model, the picks from the address, the old links kept, the filter box gone.
- **Readers see:** two chips (Series, Sessions) with counts above the calendar instead of the filter box; a pick reloads the page under a shareable address; old links with ?s= or ?races= still narrow.
- **Editors get:** a Filters region may name the calendar as its filtered region; the calendar's facets in the Facets group.
- **Files (16):**
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the facets field, CALENDAR_FACETS, the calendar's recipe with its Filters region.
  - `lib/design/component-render.tsx`, `lib/design/component-render.test.tsx` · the calendar's picks from the address; a component with facets as a Filters target; the rows from the calendar model.
  - `lib/design/view-state.ts`, `lib/design/view-state.test.ts` · calendarLegacySearch; bindViewState over any column list.
  - `middleware.ts`, `middleware.test.ts` · the shim for /calendar's old addresses.
  - `lib/design/page-document.ts`, `lib/design/page-document.test.ts` · a Filters region may name a component with facets.
  - `components/designer/PageDesignerProperties.tsx` · the Filtered region select offers such a component; its facets in the facet selects.
  - `components/calendar/CalendarView.tsx` · the picks as props; the local state, the memory and the mirroring gone.
  - `components/calendar/CalendarFilters.tsx` · removed (123 lines: the box's markup and handlers).
  - `components/designer/page-designer-model.test.ts`, `lib/design/composed-page.test.ts` · the compositions with the extra region.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md`, `IDEAS.md`, `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · the records and the trio, 1.0.191.
- **Verified:** tests first (five cases red across five files), then green; tsc 0; lint 0 errors (the two known warnings); vitest 248 files, 2422 tests; cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39513.89 KiB (39423.21 before); in the browser on the local server: the Filters region added to the calendar page in the designer (the Filtered region select offering the calendar, its two facets), Save and Run Page: the Series chip (MotoGP (179) first) and the Sessions chip (practice, race, qualifying, other), Formula 1 tapped narrowing the months to Formula 1 under filter=seriesName.in:Formula 1, the old link /calendar?s=motogp&races=1 narrowing to MotoGP races with both chips marked (screenshots .playwright-mcp/p25b-01..02; the review page as an artifact); the parity of prod's /calendar before and after the deploy pasted in the ledger.
- **Review:** a fresh-context Sonnet (~250k said, 199,495 measured, 69 tool uses): BLOCKING on one decision, the Sessions chip's four kinds against the plan's two, taken to the operator, who chose four; the non-blocking items folded in fe63c269 (the refusal names the calendar, the shim states its limit, the designer test for the calendar as a filtered region); left with the reason: the shim drops a list of names over VALUE_MAX (the vocabulary's rule, stated in its comment; the series pages write one slug), and no call-count test for loadCalendarModel (the dedupe is React's cache, which the test's mock cannot show).

## #1071 · 1.0.190 · P2.5 PR A · merged Fri 25 Sep 20:45 (17:45Z) under the standing word
**Filters as a layer, PR A: a Filters region over another Data region's rows.** APEX's Smart Filters as a component of its own; the calendar and news pages follow in PR B and PR C.
- **Readers see:** nothing until an editor places a Filters region on a page.
- **Editors get:** a Filters component in the Gallery: a Filtered region, three facets over its columns with a label, Depending On and a picks-several switch; on the page, chips whose values narrow the table at a tap, one facet waiting on another, a search box inside a chip, "and N more" past forty values, Reset.
- **Files (14):**
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the data.filters definition, the facets option kind, the parser's rule for Depending On, the summary's silence on what is not set.
  - `lib/design/presets.ts`, `lib/design/presets.test.ts` · facetValues and FACET_VALUES_MAX.
  - `lib/design/page-document.ts`, `lib/design/page-document.test.ts` · the Filters checks; a Filters panel never takes the h1.
  - `lib/design/component-render.tsx`, `lib/design/component-render.test.tsx` · the target reads its keys, one shared read per request, the data.filters renderer, READS.
  - `components/data/DataRegionFilters.tsx`, `components/data/DataRegionFilters.test.tsx` · the chips, the links, the picks-several form, the constant script, Reset; the hrefs, the hidden inputs and the escaping asserted.
  - `components/designer/PageDesignerProperties.tsx`, `components/designer/PageDesigner.test.tsx` · the Facets group's selects over the filtered region's columns and the other facets.
  - `components/designer/PluginsEditor.test.tsx` · six definitions listed.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.5 started on the revised plan; PR A's evidence.
  - `IDEAS.md` · the hydration warning seen on the run page too.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.190.
- **Verified:** tests first (seven cases red across six files and one new), then green; tsc 0; lint 0 errors (the two known warnings); vitest 248 files, 2415 tests; cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39423.21 KiB (39351.47 before); in the browser on the local server: the Gallery's Filters entry, the Facets group on the Monza page over its Session results region (Team, then Driver depending on Team), Save and Run Page: the Team chip with counts, Ferrari picked narrowing the table to Leclerc and Hamilton and opening the Driver chip with those two, Reset back to twenty-two rows (screenshots .playwright-mcp/p25a-01..02).
- **Review:** a fresh-context Sonnet (~250k said, 228,850 measured, 29 tool uses): SOUND WITH FIXES, none blocking; the five folded in 8b381088 (a cleared facet clears its dependents, a comma value picked alone as eq, READS equal for both Data regions, the 80-character note in the help, the script bound once per region and tested in jsdom); the gates re-run after: vitest 248 files, 2418 tests, cf:build clean, the dry run 39423.21 KiB.

## #1070 · 1.0.189 · records · opened Fri 25 Sep 17:05 (14:05Z); the merge on the word
**P2.25 done on prod; the session-57 handoff.** Records only: the merge, the migration and the backfill on prod, and where session 58 starts.
- **Readers see:** nothing.
- **Editors get:** nothing new; the Session results source holds the season since the backfill.
- **Files (7):**
  - `docs/plan/ledger.json` · P2.25 DONE with the merge, the apply and the backfill's counts; the dated line.
  - `docs/plan/components-programme.md` · re-rendered (57 slots, 37 done).
  - `docs/HANDOFF.md` · the LATEST block: P2.5 next with "swap the pages", the known facts of the day (the local key override, the helper's captcha token, OpenF1's lockout and 429s).
  - `SCHEDULE.md` · the session-57 block to ~14:00Z.
  - `docs/pull-requests.md` · #1069 merged; this entry.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio, 1.0.189.
- **Verified:** node docs/plan/render-ledger.mjs → 57 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; the counts read from prod through the Management API (session_result_current: 1175 rows, 54 sessions).
- **Review:** none; records.

## #1069 · 1.0.188 · P2.25 · merged Fri 25 Sep 16:42 (13:42Z), prod 1.0.188 at 16:47
**Session results: practice and qualifying classifications as rows, a Session preset, the cron writing beside its KV write, a backfill.** The operator's ask of the day: the Results source carries races alone, so a Data region could not show a practice or a qualifying.
- **Readers see:** nothing until an editor places a Session region on a page.
- **Editors get:** a fifteenth source, Session results (F1), with Series, Season, Round ("Latest captured" or one of 24) and Session (the three practices, qualifying, sprint qualifying); a Session preset (Table, thirty rows) with the driver linked, code, team, laps, time, gap, interval, Q1 to Q3, the tyre of the best lap and status.
- **Files (28):**
  - `supabase/migrations/20260925130000_session_result.sql` · the session_result table and its session_result_current view, the Phase 0 pattern; on prod on "apply 20260925130000".
  - `lib/session-result-rows.ts`, `lib/session-result-rows.test.ts` · the writer (a run per capture, ok last, failed on error), the readers (a numbered round or the latest, bounded), the backfill's skip check; the compound helper's test beside them.
  - `app/api/cron/warm-sessions/route.ts`, `app/api/cron/warm-sessions/route.test.ts` · the rows written beside the KV write under the hasResolvedDrivers guard; the report's db note; the cases: written, neither on a nameless or empty classification, a failed row write never blocking the KV write.
  - `lib/results/openf1.ts` · the compound of each driver's best lap from /laps and /stints (bestLapCompounds), two more fail-soft calls per capture.
  - `lib/design/sources.ts`, `lib/design/sources.test.ts` · the session-results source (SESSION_KINDS, the round options); the fifteen.
  - `lib/design/presets.ts`, `lib/design/presets.test.ts` · the session-rows shape, the Session group and preset; thirty-nine presets, twenty-one groups.
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the Data region reads the sixth source; the preset option sets thirty rows.
  - `lib/design/source-read.ts`, `lib/design/source-read.test.ts` · the reader over the view: the latest round by default, the driver's page through the rosters, the weekend link; every column answered.
  - `lib/design/page-document.test.ts`, `app/api/admin/design/data/sources/route.test.ts`, `components/designer/DataSourcesEditor.test.tsx`, `components/designer/DataWorkspace.test.tsx`, `components/designer/PluginsEditor.test.tsx` · the counts and names that list the sources, now fifteen.
  - `scripts/backfill-session-results.mts`, `scripts/backfill-session-results.test.ts` · the season's finished sessions not yet captured; a dry run by default; --write, --season, --round; runBackfill and the cron's matcher tested without a network.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.25 started on the plan, its evidence; P2.5's decision of the day (the two live pages rebuilt on the Filters box); the dated lines.
  - `IDEAS.md` · two Inbox lines: OpenF1's 429s under the paced client during the backfill; the designer's hydration warning seen in the proof.
  - `docs/pull-requests.md` · this entry.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio, 1.0.188.
- **Verified:** tests first, twelve files red, then green; tsc 0; lint 0 errors (the two known warnings); vitest 247 files, 2405 tests; cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39351.47 KiB (39314.62 before); the migration applied locally (`supabase migration up --local`); the backfill's dry run then `--round 14 --write` locally (86 rows across Monza's four sessions); the cron run locally against Baku's finished sessions (two warmed, each `db: written`); in the browser on the local server: the Data Sources list, the Property Editor's Source group, the Session table on the run page with the driver linked and the tyre column (screenshots .playwright-mcp/p225-01..03; the review page as an artifact).
- **Review:** a fresh-context Sonnet, SOUND WITH FIXES, none blocking; the three folded in c35a921d.

## #1068 · 1.0.187 · records · opened Fri 25 Sep 14:55 (11:55Z); the merge on the word
**PA A3 done on the next-day check; the operator's sign-in asks recorded.** Records only: the check that closes the accounts move, and the six asks the operator made while doing it.
- **Readers see:** nothing.
- **Editors get:** nothing.
- **Files (8):**
  - `docs/plan/ledger.json` · A3 DONE: the next-day check's evidence (the Management API reads, the prod probes, the operator's dashboard reads and words, what could not be read) and the dated line.
  - `docs/plan/components-programme.md` · re-rendered (56 slots, 36 done).
  - `IDEAS.md` · six Inbox lines: the header's signed-out flash, the code and forgot links without an email, the "was it you?" email, the view-password toggle, the password rules with a strength line, the honeypot question answered.
  - `docs/HANDOFF.md` · the LATEST block: A3 DONE; the sign-in asks as the next slot proposal; the agenda.
  - `SCHEDULE.md` · the session-57 block: the intent, the check, the close, the won't-touch line.
  - `docs/pull-requests.md` · this entry.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio, 1.0.187.
- **Verified:** node docs/plan/render-ledger.mjs → 56 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed.
- **Review:** none; records.

## #1067 · 1.0.186 · chore · opened Fri 25 Sep 13:55 (10:55Z); the merge on the word
**The server-only package declared; the writing scripts run with the react-server condition; R10’s merge and the session’s close in the records.** Found by the blog writer: scripts/draft-post.mts had failed since PA A1a.
- **Readers see:** nothing.
- **Editors get:** the blog draft script working again.
- **Files (10):**
  - `package.json`, `package-lock.json` · server-only ^0.0.1 declared; the lockfile regenerated with npm 10 (the nested @swc/helpers pin kept); the trio’s version 1.0.186.
  - `scripts/draft-post.mts` · the usage with --conditions=react-server and why.
  - `IDEAS.md` · the two Inbox lines of the day (session results in regions; the weekend articles), the newsletter decided.
  - `docs/plan/ledger.json` · R10’s merge, review and probe; the dated line; the session’s evidence.
  - `docs/plan/components-programme.md` · re-rendered (56 slots).
  - `docs/HANDOFF.md` · the LATEST block for session 57: the next-day check, then the session-results slot from its brief, then Phase 2 in order.
  - `SCHEDULE.md` · step 29; the day’s active time.
  - `docs/pull-requests.md` · #1066 merged; this entry.
  - `CHANGELOG.md`, `RELEASES.md` · the trio.
- **Verified:** npx tsx --conditions=react-server --env-file=.env.blog scripts/draft-post.mts drafts/f1-baku-2026-practice.md --dry → DRY RUN parsed; npm run lockfile:check clean; the plan-ledger test 6 passed.
- **Review:** none; a dependency and records.

## #1066 · 1.0.185 · R10 · merged Fri 25 Sep 13:39 (10:39Z), prod 1.0.185 at 13:43
**The dev host lets the sign-in routes and the account routes through; the lock redirected the sign-in itself.** A quick fix on the operator’s critical report: on dev.paddock-tracker.com every sign-in method failed because the dev host’s lock exempted the two sign-in pages alone, and since A3 the sign-in posts to /api/auth/* on the same host.
- **Readers see:** nothing on the site; the admin host signs in again.
- **Editors get:** the designer reachable again after a sign-in on the dev host.
- **Files (7):**
  - `middleware.ts` · one condition: /sign-in, /sign-up, /api/auth/* and /api/account* skip the dev host’s lock.
  - `middleware.test.ts` · the case: a signed-out sign-in passes, a reader signs out, the account read passes, the rest keeps its lock.
  - `docs/plan/ledger.json` · R10 STARTED with the cause and the fix; the dated line on the report.
  - `docs/plan/components-programme.md` · re-rendered (56 slots).
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio at 1.0.185.
- **Verified:** middleware.test.ts 6 tests green; tsc 0; lint 0 errors; the cause probed on prod (a signed-out POST /api/auth/password on the dev host answered 307, on the main host the route’s 400).
- **Review:** a fresh-context Sonnet reviewer (10 tool uses): SOUND WITH FIXES; folded: /api/account matched on a path boundary. Probed after the deploy: a signed-out POST /api/auth/password on the dev host answers the route.

## #1065 · 1.0.184 · records · opened Fri 25 Sep 12:45 (09:45Z), merged under the same word
**The switch to Supabase Auth on prod (PA A3), the session-57 handoff.** Records only.
- **Readers see:** nothing.
- **Editors get:** nothing.
- **Files (8):**
  - `docs/plan/ledger.json` · A3’s evidence: the switch’s steps, the merge, the prod probes, the Turnstile finding; two dated lines on the operator’s words; A3 STARTED until the sign-ins and the next-day check.
  - `docs/plan/components-programme.md` · re-rendered from the ledger (55 slots).
  - `docs/pull-requests.md` · #1064’s entry updated with the merge and the review; #1063 noted as closed; this entry.
  - `docs/HANDOFF.md` · the LATEST block: close A3 (the sign-ins, the next-day check), then E1’s plan, A4 on 2026-10-25; the State paragraph for prod’s auth configuration and the Worker secrets.
  - `SCHEDULE.md` · step 28; the day’s active time.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio at 1.0.184.
- **Verified:** node docs/plan/render-ledger.mjs → 55 slots; npx vitest run lib/design/plan-ledger.test.ts → 1 file, 6 tests passed.
- **Review:** none; records only.

## #1064 · 1.0.183 · PA A3 · merged Fri 25 Sep 12:28 (09:28Z), prod 1.0.183 at 12:32
**Supabase Auth inside the seam: sessions on the Worker, the site’s own sign-in, sign-up and Account pages, Clerk’s SDK gone.** The switch of phase PA: the seam over @supabase/ssr, the middleware refreshing sessions, the routes under /api/auth and /api/account, the site’s own screens, the templates, the Clerk webhook deleted.
- **Readers see:** after the merge, the site’s own sign-in page (email and password, a code by email, Google), an Account details page under Settings, initials in the header without a photo, and no sign-out after a week. Until the merge, nothing.
- **Editors get:** the Data workspace’s accounts card over Supabase Auth; the tree’s Authentication label.
- **Files (64):**
  - `.gitignore` · supabase/signing_keys.json (the local JWT signing key) ignored.
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.183).
  - `RELEASES.md` · the release trio: the public note (1.0.183).
  - `SCHEDULE.md` · records: step 27.
  - `app/(admin)/layout.tsx` · AuthProvider without a look; the comment.
  - `app/(app)/layout.tsx` · AuthProvider without a look; the Clerk preconnect gone; the toolbar comment.
  - `app/(app)/settings/account/page.tsx` · new: the Account details page (name, photo, email, password, providers, every device, deletion); ?reset=1 opens the password row.
  - `app/(app)/settings/page.tsx` · the Account details row (signed in).
  - `app/(app)/sign-in/[[...sign-in]]/page.tsx` · the site’s own sign-in page (next or redirect_url; a signed-in person goes on).
  - `app/(app)/sign-up/[[...sign-up]]/page.tsx` · the site’s own sign-up page.
  - `app/api/account/photo/route.test.ts` · new: its tests.
  - `app/api/account/photo/route.ts` · new: POST a PNG/JPEG/WebP of 2 MB at most into the avatars bucket; DELETE.
  - `app/api/account/route.test.ts` · new: its tests.
  - `app/api/account/route.ts` · new: GET the account, its flags and providers; PATCH name, email, password, flags; DELETE on the session’s sub after the words.
  - `app/api/auth/[action]/route.test.ts` · new: its tests.
  - `app/api/auth/[action]/route.ts` · new: password, code, verify, sign-up, reset, google, sign-out.
  - `app/api/webhooks/clerk/route.ts` · deleted: the welcome moved to verify (lib/email.ts sendWelcomeEmail).
  - `components/AccountIdentity.tsx` · the strip’s line about the avatar.
  - `components/AppShell.tsx` · initials in the header when there is no photo.
  - `components/auth/AccountForm.test.tsx` · new: its tests.
  - `components/auth/AccountForm.tsx` · new: the Account page’s rows.
  - `components/auth/GoogleButton.tsx` · new: Google’s button with a browser-made nonce.
  - `components/auth/SignInForm.test.tsx` · new: its tests.
  - `components/auth/SignInForm.tsx` · new: password, code, reset, the notice.
  - `components/auth/SignUpForm.tsx` · new: name, address, password, the code step.
  - `components/auth/Turnstile.tsx` · new: the widget.
  - `components/auth/fields.tsx` · new: the forms’ pieces (Field, inputs, Problem, Note, call, go).
  - `components/designer/PageDesignerTree.tsx` · the tree’s Authentication label.
  - `components/page/DeveloperToolbar.tsx` · the Session entry’s title.
  - `docs/HANDOFF.md` · records: the LATEST block for the switch.
  - `docs/plan/components-programme.md` · records: re-rendered.
  - `docs/plan/ledger.json` · records: A3 STARTED with the evidence and the dated line.
  - `docs/pull-requests.md` · records: this entry.
  - `lib/auth/boundary.test.ts` · no @clerk/ import anywhere; the session library in the seam alone.
  - `lib/auth/client-pieces.tsx` · the site’s own SignInLink, SignOutButton, AccountButton.
  - `lib/auth/client-provider.tsx` · AuthProvider over GET /api/account.
  - `lib/auth/client.test.tsx` · rewritten for the routes.
  - `lib/auth/client.tsx` · the context, useAccount, useAccountFlags, hasSignedInCookie, initialsOf.
  - `lib/auth/directory.test.ts` · new: its tests.
  - `lib/auth/directory.ts` · over the three service-role functions.
  - `lib/auth/server.test.ts` · rewritten for the claims.
  - `lib/auth/server.ts` · over getClaims: legacy_id before sub; flagsFromClaims.
  - `lib/auth/supabase.test.ts` · new: its tests.
  - `lib/auth/supabase.ts` · new: the client factory, the cookie rules, the request jar, the request checks.
  - `lib/design/data-services.test.ts` · its key.
  - `lib/design/data-services.ts` · the Clerk service becomes Supabase Auth.
  - `lib/design/data.test.ts` · the env names.
  - `lib/design/data.ts` · the reader auth(); the comment.
  - `lib/design/page-registry.ts` · /settings/account; the sign-in pages’ descriptions.
  - `lib/email.ts` · sendWelcomeEmail (from the webhook).
  - `middleware.test.ts` · new: its tests.
  - `middleware.ts` · the session first; the cookies on every response; the dev host failing closed; the user-scoped APIs 404 anonymous.
  - `next.config.ts` · the CSP: Turnstile and Google’s button in, Clerk out.
  - `package-lock.json` · regenerated with npm 10 (the nested @swc/helpers pin kept for CI’s npm ci).
  - `package.json` · the trio’s version bump; @clerk/nextjs removed; @clerk/backend a devDependency for the import script; @supabase/ssr added; supabase-js raised to ^2.117.1.
  - `scripts/sync-worker-secrets.mts` · SUPABASE_SECRET_KEY in the preview set.
  - `supabase/config.toml` · the local stack: the mail viewer, confirmations, codes, the captcha, Google (off), the templates, the signing key.
  - `supabase/migrations/20260924234000_pages_seed_account.sql` · new: the page row for /settings/account (prod on “apply 20260924234000”).
  - `supabase/templates/confirmation.html` · new: the sign-up code email.
  - `supabase/templates/email_change.html` · new: the new-address code email.
  - `supabase/templates/magic_link.html` · new: the sign-in code email.
  - `supabase/templates/recovery.html` · new: the reset code email.
  - `vitest.config.ts` · middleware.test.ts included.
  - `docs/pull-requests.md` · records: this entry.
- **Verified:** tests first (twelve files); tsc 0 · lint 0 errors · vitest 242 files, 2379 tests green (three designer tests time out at their 5 s limit only under load) · wrangler deploy --dry-run Total Upload 39314.62 KiB (41151.04 KiB before: Clerk’s SDK gone) · the local stack’s secret key proven to drive a sign-in first · every flow in the browser on the local stack (the sign-in page, the helper’s sign-in, Settings, the Account page’s rows, sign-up with the emailed code, sign in by code, the reset, the deletion), the dev host’s lock by curl. Not proven locally: Google’s button, the platform’s User-Agent rule and IP forwarding, an hour-old session’s headers on Workers, Home a cache HIT (testing.paddock-tracker.com before the merge).
- **Review:** a fresh-context Sonnet reviewer (about 150k said, 387,410 measured, 113 tool uses): SOUND WITH FIXES; folded: the Google nonce minted by the route into an httpOnly cookie (the blocking finding), tests for GoogleButton and SignUpForm, the Clerk publishable key out of the preview secrets; left with the reason: no KV cache on the one-function admin list, the provider’s mount effect as its own promise chain, a failed sign-out still reloads, the flags’ last-write-wins. After the review, two more commits: the Worker checks the Turnstile token with Cloudflare’s siteverify itself (Supabase Auth skips the captcha for secret-key requests, proven against prod) and the two public vars in the Worker configs. The switch: the two applies on prod, the secrets, testing deployed and probed, the operator’s word “straight to prod”, the import run again after the deploy (unchanged 18), prod probed (Home a HIT, the sign-in page, the captcha gate, the dev host’s lock).

## #1063 · 1.0.182 · records · opened Fri 25 Sep 01:35 (24 Sep 22:35Z); closed Fri 25 Sep 12:33 as shipped inside #1064’s squash (its two commits were the base of A3’s branch)
**Session 56: PA A2 DONE, the accounts imported; the session-57 handoff with A3 first.** Records only.
- **Readers see:** nothing.
- **Editors get:** nothing.
- **Files (7):**
  - `docs/plan/ledger.json` · A2 DONE: the import run from the session on the operator’s word (18 created on prod’s Supabase Auth, 13 without a password; the rerun unchanged 18; the directory answering BLOG_AUTHOR_ID; account_stats() 18, account_admins() 1); the dated line.
  - `docs/plan/components-programme.md` · re-rendered from the ledger (54 slots).
  - `docs/HANDOFF.md` · the LATEST block: PA A3 first with its decision scan; the State paragraph for A2’s run.
  - `SCHEDULE.md` · step 26; the day’s active time.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio at 1.0.182.
- **Verified:** node docs/plan/render-ledger.mjs → 54 slots; npx vitest run lib/design/plan-ledger.test.ts → 1 file, 6 tests passed.
- **Review:** none; records only.

## #1062 · 1.0.181 · records · opened Fri 25 Sep 00:33 (24 Sep 21:33Z), merged by the operator’s hand
**Session 56: PA A2 on prod and its migration applied, the session-57 handoff with the operator’s import run first.** Records only.
- **Readers see:** nothing.
- **Editors get:** nothing.
- **Files (8):**
  - `docs/plan/ledger.json` · A2’s evidence: the merge of #1061 (21:20:46Z as f79e6330; prod 1.0.180 at 21:24:46Z) and the prod apply of 20260924200000 (rehearsed, applied 21:21:09Z, read back, rerun, account_stats() 0 accounts); the dated line on “merge, apply 20260924200000”; A2 STARTED until the operator’s run.
  - `docs/plan/components-programme.md` · re-rendered from the ledger (54 slots).
  - `docs/pull-requests.md` · #1061’s entry and this one.
  - `docs/HANDOFF.md` · the LATEST block: the operator’s run first (the export, the dry run, --write, the counts), then the directory check for BLOG_AUTHOR_ID, then PA A3; the State paragraph for A2.
  - `SCHEDULE.md` · step 25; the day’s active time.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio at 1.0.181.
- **Verified:** node docs/plan/render-ledger.mjs → 54 slots; npx vitest run lib/design/plan-ledger.test.ts → 1 file, 6 tests passed.
- **Review:** none; records only.

## #1061 · 1.0.180 · PA A2 · merged Fri 25 Sep 00:20 (24 Sep 21:20Z)
**The import of Clerk’s accounts into Supabase Auth, ids unchanged; the accounts migration.** The third PR of phase PA: the script the operator runs by hand with their Clerk export, and the migration that gives photos a bucket and the site three functions over auth.users.
- **Readers see:** nothing; nothing runs until the operator runs it.
- **Editors get:** nothing.
- **Files (10):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.180).
  - `RELEASES.md` · the release trio: the public note (1.0.180).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: A2 STARTED with the build’s evidence and the dated line.
  - `package.json` · the release trio: the version bump (1.0.180).
  - `scripts/import-clerk-users.mts` · new: the import (the export parsed by column name, the plan by legacy id then address, the writer through the admin API, counts alone in the output).
  - `scripts/import-clerk-users.test.ts` · new: seven tests (the export, the mapping, the plan, the rerun, the matching, the writer, a redacted failure).
  - `supabase/config.toml` · the local auth and storage services on (the migration needs both).
  - `supabase/migrations/20260924200000_accounts.sql` · new: the avatars bucket and the three service-role functions over auth.users, search_path pinned; on prod 2026-09-24 21:21Z.
  - `vitest.config.ts` · includes scripts/**/*.test.ts.
- **Verified:** seven tests (written before the code; their first run came after it, since vitest did not include scripts/ until this PR). The migration on the local database: the bucket as declared, the functions answering the service role and refusing anon and authenticated, applied twice without error. Gates: tsc 0 · lint 0 errors · vitest 234 files, 2349 tests · wrangler deploy --dry-run Total Upload 41151.04 KiB (the Worker’s code untouched). On prod, on the word "apply 20260924200000": rehearsed inside begin…rollback through the Management API, applied 2026-09-24 21:21:09Z, read back (the bucket, the three functions with search_path pinned, execute for service_role alone), rerun without change, account_stats() answering 0 accounts.
- **Review:** SOUND WITH FIXES, nothing blocking (~150k tokens said, 228,844 measured, 41 tool uses). Folded: the primary address alone (the plan’s pre-mortem), Supabase ids redacted in failures with a test, the revokes in the repo’s form, the parser’s doubled quote tested, the wording of the dry run. Left with the reason: @clerk/backend stays transitive; declaring it re-resolved the lockfile and dropped the @swc/helpers pin of 4 September.

## #1060 · 1.0.179 · records · merged Thu 24 Sep 19:29 (19:29Z)
Records PA A1b's merge (#1059, squash-merged 19:19:09Z as 4ec78ab1): A1 DONE with its evidence, the operator's word to leave the two slow designer tests' limit, the session-57 handoff with A2 first, and the schedule's step 24.
- **Files (8):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.179).
  - `RELEASES.md` · the release trio: the public note (1.0.179).
  - `SCHEDULE.md` · records: step 24.
  - `docs/HANDOFF.md` · records: the LATEST block for session 57 (PA A2 first, its decision scan).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: A1 DONE with A1b's evidence, the dated line with the two words.
  - `docs/pull-requests.md` · records: #1059's entry and this PR's.
  - `package.json` · the release trio: the version bump (1.0.179).
- **Review:** none (records)

## #1059 · 1.0.178 · PA A1b · merged Thu 24 Sep 22:19 (19:19Z)
**The account seam, browser: every browser file reads the signed-in person through lib/auth/client.** The second PR of slot A1 (phase PA): the seam’s browser half in three modules, the 18 browser files and the two layouts moved onto it, so that the switch to Supabase Auth (A3) touches the seam alone.
- **Readers see:** nothing; Clerk stays the provider, and the pages answer as before signed out and signed in.
- **Editors get:** nothing.
- **Files (34):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.178), with the Worker’s growth measured against a clean build of main.
  - `IDEAS.md` · records: the 1571 KiB the seam’s browser half added to the Worker, to be measured again at A3.
  - `RELEASES.md` · the release trio: the public note (1.0.178).
  - `app/(admin)/layout.tsx` · renders `AuthProvider look="console"` where Clerk’s provider was.
  - `app/(app)/layout.tsx` · renders `AuthProvider look="site"` where Clerk’s provider was.
  - `components/AccountIdentity.tsx` · the identity strip and R9’s Sign out row read the seam: `useAccount`, `AccountButton`, `SignInLink`, `SignOutButton`.
  - `components/AccountStaffLinks.tsx` · the staff rows read `account.role`.
  - `components/AppShell.tsx` · the header’s account menu reads `useAccount` (the name, the address, the avatar the provider shows, the role) and the seam’s `SignOutButton`.
  - `components/BottomBar.tsx` · the Account cell’s avatar from `useAccount().avatarUrl`.
  - `components/ContactModal.tsx` · the prefilled address from `account.email`.
  - `components/EnableNotifications.tsx` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `components/NavGating.test.tsx` · the mocks moved to `@/lib/auth/client` and `client-pieces`, the fixtures to account shapes.
  - `components/NotifPrefsSection.tsx` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `components/OnboardingWizard.tsx` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `components/SettingsClient.tsx` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `components/SupportPrompt.tsx` · the opt-out flag read and written through `useAccountFlags`.
  - `components/YourDevices.tsx` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `components/assistant/AssistantWidget.tsx` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `components/authors/WriteForUsForm.tsx` · the application form reads `account.role` and opens sign-in through `SignInLink`.
  - `components/blog/StudioLink.tsx` · the Studio pill reads `canAuthor(account)`.
  - `components/designer/Designer.test.tsx` · the mock moved to `@/lib/auth/client`.
  - `components/page/DeveloperToolbar.test.tsx` · the mock moved to `@/lib/auth/client`, the fixture to an account shape.
  - `components/page/DeveloperToolbar.tsx` · the admin flag from `account.role`.
  - `components/useVisitor.ts` · the browser’s visitor from `visitorFromAccount(account)`.
  - `components/whats-new/WhatsNewModal.tsx` · the dismissed announcement read and written through `useAccountFlags`.
  - `lib/auth/boundary.test.ts` · the allow-list down to four files: the middleware, the sign-in and sign-up pages, the webhook.
  - `lib/auth/client-pieces.tsx` · new: `SignInLink`, `SignOutButton`, `AccountButton` over Clerk’s pieces; the strip, the header and the form import it.
  - `lib/auth/client-provider.tsx` · new: `AuthProvider` over Clerk’s provider with the two layouts’ props and looks; the layouts alone import it.
  - `lib/auth/client.test.tsx` · new: the tests for the mapping (equal to the server’s), the hook’s four states, the flags and the provider’s two looks, written first.
  - `lib/auth/client.tsx` · the hooks (`useAccount`, `useAccountFlags`) and the browser mapping `accountFromBrowserUser` beside the `Account` type; imports Clerk’s `useUser` alone.
  - `lib/design/authz-check.test.ts` · the removed function’s test leaves with it.
  - `lib/design/authz-check.ts` · `visitorFromClerkUser` and `ClerkUserLike` leave; both hosts read `visitorFromAccount`.
  - `lib/useFollowedSeries.ts` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `package.json` · the release trio: the version bump (1.0.178).
- **Verified:** tests first, seen red (the seam’s own test), then green; the three client tests re-pointed with account fixtures. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 233 files, 2340 of 2342 tests (the two longest designer tests time out at 5 s on the operator’s machine this evening, on main too; the limit untouched, the question asked) · cf:build exit 0 · wrangler deploy --dry-run Total Upload 41151.08 KiB / gzip 9087.62 KiB (+1571 KiB against a clean build of main, 63.0% of the ceiling: a one-module version cost 2012 KiB, the split into three took 441 KiB back, the rest is Turbopack’s cutting of the server’s shared chunks around a new module many client components import). Browser, local server: signed in, the Account page’s strip, the staff rows and Sign out, the header’s menu and Sign out through the seam (`.playwright-mcp/a1b-settings-signed-in.png`, `a1b-header-menu.png`); signed out, the page gate and Clerk’s modal through `SignInLink` (`a1b-sign-in-modal.png`).
- **Review:** SOUND WITH FIXES, no behaviour change found, nothing blocking (~250k tokens said, 200,689 measured, 34 tool uses). Folded: the count of moved files, a stray bold marker, the toolbar’s stale comment, a blank line. Left: two subscriptions to Clerk’s hook in the prompt and the announcement (negligible).
- **Corrections:** the edits began on `main` before a branch was made (nothing was pushed; moved onto the branch as found).

## #1058 · 1.0.177 · records · merged Thu 24 Sep 14:17 (14:17Z)
Records R9's merge (#1057, squash-merged 14:01:37Z as 64a5c6f5): R9 DONE with its evidence, the session-57 handoff with PA A1b first, and the schedule's step 23.
- **Files (8):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.177).
  - `RELEASES.md` · the release trio: the public note (1.0.177).
  - `SCHEDULE.md` · records: step 23.
  - `docs/HANDOFF.md` · records: the LATEST block for session 57 (PA A1b first, its decision scan and the lesson R9 leaves).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: R9 DONE with its evidence and the dated merge line.
  - `docs/pull-requests.md` · records: #1057's entry and this PR's.
  - `package.json` · the release trio: the version bump (1.0.177).
- **Review:** none (records)

## #1057 · 1.0.176 · R9 · merged Thu 24 Sep 17:01 (14:01Z)
**The Account page’s Sign out row is drawn in the browser; the page answered 500 when signed in.** Found by PA A1a’s signed-in browser run: the page, a Server Component, handed a `<button>` child to Clerk’s `<SignOutButton>`, a Client Component, whose single-child check refused what arrived across the boundary.
- **Readers see:** the Account page opens again when signed in, with its Sign out row at the end of the list.
- **Editors get:** nothing.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.176).
  - `RELEASES.md` · the release trio: the public note (1.0.176).
  - `app/(app)/settings/page.tsx` · renders `<SignOutRow />` inside `{userId && …}`; its Clerk import leaves.
  - `components/AccountIdentity.tsx` · `SignOutRow`: the row’s markup and heatmap id, created in the browser beside the identity strip.
  - `components/NavGating.test.tsx` · the test for the row (its mock renders SignOutButton as its child), written first.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: slot R9 opened and started, the dated line with the operator’s word.
  - `lib/auth/boundary.test.ts` · the allow-list loses the Account page (24 files).
  - `package.json` · the release trio: the version bump (1.0.176).
- **Verified:** tests first, seen red, then green. Gates: tsc 0 · eslint 0 on the changed files · vitest 232 files, 2339 tests · cf:build exit 0 · wrangler deploy --dry-run Total Upload 39579.74 KiB / gzip 8667.44 KiB. Browser, signed in through the helper: /settings 200 with the row (`.playwright-mcp/r9-settings-signed-in.png`); before the fix, 500 on main.
- **Review:** SOUND, nothing to fix (~80k tokens said, 129,313 measured, 37 tool uses): the mechanism traced to React’s and Clerk’s sources; the fix matches the header’s pattern; the markup byte-identical; the allow-list’s one removal load-bearing. Two nits left: the test file’s Clerk mock lacks SignInButton and UserButton (the row uses neither); the test guards the markup, the browser run the boundary.

## #1056 · 1.0.175 · records · merged Thu 24 Sep 13:34 (13:34Z)
Records PA A1a's merge (#1055, squash-merged 13:26:16Z as 21a5c518): A1 STARTED with its evidence, the signed-in run's finding (/settings 500 signed in, proposed as R9), the session-57 handoff and the schedule's step 22.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.175).
  - `RELEASES.md` · the release trio: the public note (1.0.175).
  - `SCHEDULE.md` · records: step 22.
  - `docs/HANDOFF.md` · records: the LATEST block for session 57 (R9 on the word, then A1b).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: A1 STARTED with A1a's evidence and the dated merge line.
  - `docs/pull-requests.md` · records: #1055's entry and this PR's.
  - `package.json` · the release trio: the version bump (1.0.175).
- **Review:** none (records)

## #1055 · 1.0.174 · PA A1a · merged Thu 24 Sep 16:26 (13:26Z)
**The account seam, server: every server file reads the signed-in person through lib/auth.** The first PR of phase PA (the accounts’ move from Clerk to Supabase Auth): a seam of our own in front of Clerk, so that the switch (A3) later touches the seam alone and no caller.
- **Readers see:** nothing; Clerk stays the provider, and the pages answer as before signed out and signed in.
- **Editors get:** nothing.
- **Files (134):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.174).
  - `IDEAS.md` · records: the 331.9 KiB the new shared import added to the Worker, noted not fought.
  - `RELEASES.md` · the release trio: the public note (1.0.174).
  - `app/(admin)/admin/designer/page.tsx` · the greeting takes the first word of the account’s name (Clerk’s first name before).
  - `app/(app)/api/home/bets/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/api/home/social/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/blog/[slug]/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/f1/compare/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/feedback/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/preview/[rev]/page.test.tsx` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/(app)/settings/assistant/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/settings/author/page.tsx` · the suggested author name from the account’s one name.
  - `app/(app)/settings/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/friends/add/[id]/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/friends/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/leagues/[id]/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/leagues/join/[token]/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/leagues/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/threads/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/users/[id]/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/threads/[id]/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/appearance/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/appearance/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/application/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/application/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/assets/[id]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/assets/[id]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/assets/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/assets/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/authz/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/authz/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/authz/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/authz/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/build-options/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/build-options/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/build-options/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/data/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/data/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/data/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/data/runs/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/data/sources/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/data/sources/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/data/sources/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/data/sources/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/debug/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/debug/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/definitions/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/definitions/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/definitions/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/definitions/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/lists/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/lists/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/lists/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/lists/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/pages/[id]/revisions/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/pages/[id]/revisions/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/pages/[id]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/pages/[id]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/pages/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/pages/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/search-hints/[id]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/search-hints/[id]/route.ts` · reads the seam; its local gate typed on the account’s role.
  - `app/api/admin/design/search-hints/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/search-hints/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/settings/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/settings/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/settings/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/shortcuts/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/shortcuts/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/shortcuts/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/shortcuts/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/text/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/text/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/text/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/themes/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/themes/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/themes/default/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/themes/default/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/themes/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/themes/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/views/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/views/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/views/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/views/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/assistant/feedback/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/assistant/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/author-request/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/author/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/bet/league/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/bet/market/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/bet/place/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/blog/[id]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/blog/format/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/blog/headings/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/blog/preview/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/blog/reactions/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/blog/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/contact/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/feedback/[id]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/feedback/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/friends/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/push/devices/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/push/inspect/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/push/subscribe/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/push/test/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/push/unsubscribe/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/threads/[id]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/threads/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/user/mute-series/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/user/notif-prefs/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/user/onboarded/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/user/prefs/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `components/blog/StudioLink.tsx` · maps Clerk’s browser user to the helper’s shape itself until A1b.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: the operator's order (A1a now, D1 after all phases), a dated line.
  - `lib/admin-guard.ts` · `requireAdmin` and `requireAuthor` read the account; `requireAuthor` returns it.
  - `lib/auth/boundary.test.ts` · the test that no file outside lib/auth and a 25-file allow-list imports @clerk/, and that every allow-listed file still does.
  - `lib/auth/client.tsx` · new: the `Account` type (id, email, name, username, imageUrl, role, donor); A1b adds the provider and the hooks.
  - `lib/auth/directory.ts` · new, server-only: `accountById`, `latestAccounts`, `accountCount`, `adminAccountIds` over Clerk’s Backend API, the id rule at its top.
  - `lib/auth/server.test.ts` · the tests for the mapping and the two reads, written first.
  - `lib/auth/server.ts` · new, server-only: `currentAccount()` and `accountId()` over Clerk, with the one mapping `accountFromClerkUser`.
  - `lib/author-identity.ts` · the byline from `accountById`; the photo gate now the seam’s.
  - `lib/betting/friends.ts` · `clerkDisplayName` became `accountDisplayName`: the name, the username, the address’s local part.
  - `lib/blog-notify.ts` · the admins from `adminAccountIds`, the author’s address from `accountById`; the fail-soft rules kept.
  - `lib/design/authz-check.test.ts` · the tests for `visitorFromAccount`.
  - `lib/design/authz-check.ts` · `visitorFromAccount` beside `visitorFromClerkUser` (the browser’s, until A1b); the ladder read from the role.
  - `lib/design/authz-evaluate.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `lib/design/authz-evaluate.ts` · `currentVisitor` reads the account through the seam.
  - `lib/design/data.test.ts` · the mock moved from clerkClient to the directory.
  - `lib/design/data.ts` · the accounts card from `accountCount` and `latestAccounts`.
  - `lib/design/page-frame.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `lib/threads.ts` · the four role helpers (isAdmin, isStaff, canAuthor, hasDonated) take an account’s role and donor.
  - `package.json` · the release trio: the version bump (1.0.174).
- **Verified:** tests first, seen red (the mapping; the boundary with 84 offenders before the move), then green. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 232 files, 2338 tests · cf:build exit 0 · wrangler deploy --dry-run Total Upload 39581.68 KiB / gzip 8667.89 KiB (+331.9 KiB over 1.0.172, the chunk groups re-cut; IDEAS). Signed out on the local server: the pages and the gated routes answer as before. Signed in through the helper, on the word "helper go": the header’s account menu, /studio and /admin/designer as before (`.playwright-mcp/a1a-header-menu.png`, `a1a-designer.png`).
- **Review:** SOUND WITH FIXES, nothing blocking (~250k tokens said, 222,762 measured, 65 tool uses). Its one should-fix, stated in the record: the server’s visitor carries the account’s one address where Clerk’s user carried every address (fail-closed; prod holds four schemes, none of type email_domain). Its nit, the greeting’s first word, disclosed.
- **Finding, outside the PR:** /settings answers 500 when signed in, on main as on the branch: the Server Component hands a `<button>` child to Clerk’s `<SignOutButton>` and Clerk’s single-child check refuses what arrives across the boundary; signed out 200. Proposed as R9.

## #1053 · 1.0.172 · P2.4 PR C · merged Thu 24 Sep 15:07 (12:07Z)
**Master-detail: a region's rows filter another region through the address.** The third of P2.4's three PRs: a Data region's rows can filter
another Data region of the page, each row carrying a Show link that writes its value into the paired region's filter in the address, so the
page stays a cached variant and the choice can be shared.
- **Readers see:** nothing until a designer sets a Master Detail region and key; where set, each row of the master carries a Show link that
  narrows the paired region, the choice riding in the page's address so it can be shared.
- **Editors get:** a Master Detail group (Detail region, Detail key) on Data regions, drawn while the View is Table, Cards or List; the
  Property Editor lists the page's other Data regions to pick as the detail, None first.
- **Files (15):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.172).
  - `IDEAS.md` · records: the branch-rename finding (the push guard refuses "master" as a branch-name word).
  - `RELEASES.md` · the release trio: the public note (1.0.172).
  - `components/data/DataRegionViews.tsx` · `MasterSelect` and `DetailShowing`: the Show link on each Table, Cards and List row, and the "Showing <value> · Show all" line above a detail's rows.
  - `components/designer/PageDesigner.test.tsx` · the tests for the designer's Detail region and Detail key selects and the tile's words.
  - `components/designer/PageDesignerProperties.tsx` · the Detail region select (the page's other Data regions, None first) and the Detail key select.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.4 PR C's evidence and the dated merge line.
  - `lib/design/component-render.test.tsx` · the tests for the master/detail pairing, the address filter and line, and the audit's template-pairing fix.
  - `lib/design/component-render.tsx` · `renderComponents` pairs each master with its detail, threading the address's filter while keeping the detail's own sort, columns and view.
  - `lib/design/components.test.ts` · the tests for the Master Detail group and its two attributes.
  - `lib/design/components.ts` · the group Master Detail (seq 50), `detailRegion` (the new `optionsFrom: 'regions'`) and `detailKey`.
  - `lib/design/page-document.test.ts` · the tests for the parser's refusals and the master's own column rule.
  - `lib/design/page-document.ts` · the document-wide check: a Detail region must be another Data region drawn as Table, Cards or List, its key a column both shapes carry.
  - `package.json` · the release trio: the version bump (1.0.172).
- **Verified:** tests first, 5 failed across 4 files, then passed. Gates after the fixes: tsc 0 · lint 0 errors (2 known warnings) · vitest 230
  files, 2333 tests · cf:build exit 0 · wrangler deploy --dry-run Total Upload 39249.78 KiB / gzip 8580.90 KiB. Browser, local server over the
  local database: two results regions added to the Monza fixture with psql (restored after); the season list draws 14 Show links, "Show 3"
  narrows the race table to round 3 under "Showing 3 · Show all", and Show all or the variant address loaded directly draw the same.
- **Review:** SOUND WITH FIXES, nothing blocking (~200k tokens said, 244,062 measured, 27 tool uses). Folded: a Show value over the
  vocabulary's 80-character cap gets no link instead of a silently dropped filter; a detail must be drawn as Table, Cards or List; two masters
  on one detail each keep their own Showing line; the chosen row's `aria-current` matches the detail's own column test. Its nit that a bad
  master key would report twice proved false. The day's audit afterward found one more gap (a master drawn as a template still keyed its
  detail), folded in a third commit.
- **Corrections:** the plan's browser run named a "Weekends (Season)" master, but the Weekends source reads coming weekends only; the season
  list is the results List's per-race folds instead, which meets the slot's acceptance.

## #1052 · 1.0.171 · records · merged Thu 24 Sep 13:39 (10:39Z)
Records P2.4 PR B's merge (#1051, squash-merged 10:32:22Z as 48b1f5cf): the ledger's evidence and dated line, the handoff's LATEST block and session-57 prompt putting PR C first, and the schedule's step 20.
- **Files (7):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.171).
  - `RELEASES.md` · the release trio: the public note (1.0.171).
  - `SCHEDULE.md` · records: step 20.
  - `docs/HANDOFF.md` · records: the LATEST block and the session-57 prompt, PR C first.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.4 PR B's evidence and the dated merge line.
  - `package.json` · the release trio: the version bump (1.0.171).
- **Review:** none (records)

## #1051 · 1.0.170 · P2.4 PR B · merged Thu 24 Sep 13:32 (10:32Z)
**Links from the readers: a driver's or a team's name opens its page.** The second of P2.4's three PRs: a driver's or a team's name in a Data
region now links to its page on the site, computed by the site's own resolver (an exact name first, else its drift rule), never a typed
pattern; a row without a page draws exactly as before.
- **Readers see:** a driver's or a team's name in a Table, Cards or List Data region now opens that driver's or team's page on Paddock; a
  downloaded CSV carries the page's address beside the name.
- **Editors get:** every standings and results row carries its driver's, team's or constructor's page (null for a co-driver, a manufacturer or
  a car's crew); the Cards' zones offer "Driver → its page" at once on the shapes that carry one.
- **Files (25):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.170).
  - `IDEAS.md` · records: a module of its own for the people index (proposed, not built), and one fix for the card-slot pickers' link-zone label.
  - `RELEASES.md` · the release trio: the public note (1.0.170).
  - `app/(app)/f1/compare/page.tsx` · imports `namesMatch` from its new home, `lib/slug.ts`, instead of `lib/profile-stats.ts`.
  - `app/(app)/teams/[slug]/page.tsx` · the same import update as the compare page.
  - `app/api/data/csv/route.test.ts` · the tests for the CSV's text and address columns.
  - `app/api/data/csv/route.ts` · a link column now writes its text and, beside it, a "<Label> address" column (before it wrote the address alone).
  - `components/data/DataRegionViews.tsx` · a results `driver` link keeps the cell's look as text (the plan's "a link keeps the name's class" held for `name` only).
  - `components/designer/DataSourcesEditor.test.tsx` · the test for the standings source's column count (thirteen, with `profile`).
  - `components/designer/PageDesigner.test.tsx` · the tests for a standings card following the driver's page and the zone select offering it.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.4 PR B's evidence and the dated merge line.
  - `lib/design/component-render.test.tsx` · the tests for the Table's name link and the results driver's cell.
  - `lib/design/page-document.test.ts` · the tests for the parser binding a link column.
  - `lib/design/presets.test.ts` · the tests for `driver-rows`/`team-rows`/`race-rows`/`podium-rows` naming `name` or `driver` a link, crews staying text.
  - `lib/design/presets.ts` · `name` (driver-rows, team-rows) and `driver` (race-rows, podium-rows) become links over `profile`; car and cup crews stay text.
  - `lib/design/source-read.test.ts` · the tests for `withProfiles` over F1's drivers and constructor, and null for WRC's co-driver and IMSA's crews.
  - `lib/design/source-read.ts` · `withProfiles` adds `profile` to every standings and results row, null where the rosters are never asked or cannot load.
  - `lib/design/sources.test.ts` · the tests for the standings and results sources' new `profile` column.
  - `lib/design/sources.ts` · the standings and results sources declare `profile` ("Page", link) and read `content:series`.
  - `lib/people.test.ts` · the tests for the index, over fixtures and the real rosters.
  - `lib/people.ts` · `buildPeopleIndex` and `peopleIndex()`: a driver's or team's page by the site's drift rule, built once per process.
  - `lib/profile-stats.ts` · `namesMatch` moves out to `lib/slug.ts` (importing it here pulled this module into every server chunk carrying `lib/people.ts`).
  - `lib/slug.ts` · `namesMatch` moved here verbatim from `lib/profile-stats.ts`.
  - `package.json` · the release trio: the version bump (1.0.170).
- **Verified:** tests first, 13 failed across 6 files, then passed (three older tests now assert the new behaviour, each keeping its refusal
  case). Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 230 files, 2328 tests · cf:build exit 0 · wrangler deploy --dry-run Total
  Upload 39226.67 KiB / gzip 8576.12 KiB (66.8 KiB over 1.0.168, the index riding in each of fifteen server chunks). Browser, local server over
  the local database: `/history/monza`'s Drivers table draws its ten names as links, Andrea Kimi Antonelli's opens `/drivers/kimi-antonelli`;
  switched to Cards with Full Card on "Driver → its page", George Russell's card opens his page; the CSV reads `Pos,Driver,Driver address,...`
  with the address beside Antonelli's name.
- **Review:** PASS WITH NOTES, nothing blocking and nothing to fix (~200k tokens said, 247,625 measured, 67 tool uses). It recounted the 19
  shared team slugs against the real content and traced every standings/results path through `withProfiles`, finding no address built from
  upstream text. Its one nit is left, with the reason: the Property Editor names a link zone by the shape's own label, as the card-slot
  pickers already do; one fix for both is proposed in IDEAS.
- **Corrections:** the plan said a link keeps the name's class; that held for `name` only, not the results `driver` cell, fixed in
  `DataRegionViews.tsx`.

## #1050 · 1.0.169 · records · merged Thu 24 Sep 12:32 (09:32Z)
Records P2.4 PR A's merge (#1049, squash-merged 09:23:44Z as 2daa14fc): the ledger's evidence and dated line, the handoff's LATEST block and session-57 prompt putting PR B first, and the schedule's step 19.
- **Files (7):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.169).
  - `RELEASES.md` · the release trio: the public note (1.0.169).
  - `SCHEDULE.md` · records: step 19.
  - `docs/HANDOFF.md` · records: the LATEST block and the session-57 prompt, PR B first.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.4 PR A's evidence and the dated merge line.
  - `package.json` · the release trio: the version bump (1.0.169).
- **Review:** none (records)

## #1049 · 1.0.168 · P2.4 PR A · merged Thu 24 Sep 12:23 (09:23Z)
**Highlight rules: three row conditions with a style each, the followed-series tint.** The first of P2.4's three PRs (APEX: an Interactive
Report's Highlight): a Data region gains a Highlight group of three condition-and-style rules plus a Followed series toggle that tints the
reader's own followed rows after the page loads.
- **Readers see:** nothing from this PR alone; every rule slot ships empty and the Followed series toggle off.
- **Editors get:** the Highlight group (`highlight1`-`highlight3`, a condition each in the address's vocabulary; a style each,
  Brand/Emphasis/Muted; Followed series) on Data regions, drawn while the View is Table, Cards or List; the Property Editor flags a rule that
  will not read as it is typed.
- **Files (24):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.168).
  - `IDEAS.md` · records: proposes a backup job and marks an old "not in the plan" note as history (phase PA's plan, folded into this branch).
  - `RELEASES.md` · the release trio: the public note (1.0.168).
  - `SCHEDULE.md` · records: steps 17 and 18 (this slot and phase PA's planning, both folded into this branch).
  - `app/globals.css` · the `data-followed` tint (the brand paint at low alpha; adds, never removes).
  - `components/data/DataRegionViews.tsx` · styles the first rule a row meets on the Table's row, the Cards' card and both List paths, joining classes without a trailing space; today's markup byte for byte with no rule.
  - `components/data/FollowedRows.test.tsx` · the tests for marking the reader's followed rows, and nothing for "follow everything".
  - `components/data/FollowedRows.tsx` · new, client: after the page loads, reads the reader's followed series and marks the matching rows `data-followed`.
  - `components/designer/PageDesigner.test.tsx` · the tests for the Property Editor's live rule note and the tile.
  - `components/designer/PageDesignerProperties.tsx` · a rule that will not read gets a live note as it is typed.
  - `docs/HANDOFF.md` · records: the handoff's agenda names phase PA's order (folded into this branch).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger, plus phase PA's four new slots.
  - `docs/plan/ledger.json` · records: P2.4 PR A's evidence and dated line, plus the operator's approved plan for phase PA (Clerk to Supabase Auth, slots A1 to A4).
  - `lib/design/component-render.test.tsx` · the tests for the round-grouped results' own highlight case and the resolved rules on the view props.
  - `lib/design/component-render.tsx` · resolves the region's rules once per render onto `highlight` on the view props.
  - `lib/design/components.test.ts` · the tests for the Highlight group and its seven attributes.
  - `lib/design/components.ts` · the group Highlight (seq 40): three rule/style pairs and Followed series.
  - `lib/design/page-document.test.ts` · the tests for a rule bound to the preset's shape.
  - `lib/design/page-document.ts` · binds a rule to the preset's shape as it binds a filter, refusing a column the shape lacks.
  - `lib/design/presets.test.ts` · the tests for `rowPasses`, the typed row test the filters already used.
  - `lib/design/presets.ts` · exports `rowPasses`.
  - `lib/design/view-state.test.ts` · the tests for `parseRule`.
  - `lib/design/view-state.ts` · exports `parseRule` (the vocabulary's one-condition reader, private until now).
  - `package.json` · the release trio: the version bump (1.0.168).
- **Verified:** tests first, seen red: 7 across 7 files, then green. Gates after the reviewer's fixes: tsc 0 · lint 0 errors (2 known
  warnings) · vitest 230 files, 2323 tests · cf:build exit 0 · wrangler deploy --dry-run Total Upload 39159.86 KiB / gzip 8557.34 KiB. Browser,
  local server over the local database (rules set on the Monza fixture with psql): `/history/monza` draws the leader row in the brand tint
  and rows 2-3 raised; with Formula 1 followed in the browser and the page reloaded, the three rows are marked `data-followed` and tinted
  (`.playwright-mcp/p24a-monza-highlight.png`).
- **Review:** SOUND WITH FIXES, nothing blocking (~120k tokens said, 227,972 measured, 55 tool uses). Folded: the results' round groups gained
  their own highlight test, proven non-vacuous by removing the highlight on purpose; the browser line now says how Formula 1 came to be
  followed (a leftover local Clerk session; nothing written to any KV); the Property Editor's rule note moved below the imports and names the
  preset's columns; the Followed series help says rows without a series stay as they are. Left, with the reason: a rule's 120-character cap
  sits well under the vocabulary's longest possible condition.

## #1048 · 1.0.167 · records · merged Thu 24 Sep 09:29 (06:29Z)
Records P2.3 DONE (the saved_view migration applied on prod) and P2.4's decision scan answered.
- **Files (7):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.167).
  - `RELEASES.md` · the release trio: the public note (1.0.167).
  - `SCHEDULE.md` · records: step 16.
  - `docs/HANDOFF.md` · records: the session-57 prompt, P2.4's plan in plan mode with a Sonnet critic as the first task.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: **P2.3 DONE** (the `saved_view` migration applied on prod 2026-09-24T06:25:34Z on the word
    "apply 20260923220000", rehearsed first inside begin...rollback), and P2.4's decision scan answered (master-detail through the address;
    leader and podium highlight rules on the server, followed series as a client repaint; driver and team links from the readers).
  - `package.json` · the release trio: the version bump (1.0.167).
- **Review:** none (records)

## #1047 · 1.0.166 · records · merged Thu 24 Sep 01:25 (22:25Z)
Records P2.3 PR B's merge (#1046, squash-merged 22:17:00Z as f2f2fe79): the ledger's evidence, the slot staying STARTED until the migration
is applied on prod, and the session-57 handoff prompt.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.166).
  - `IDEAS.md` · records: three Inbox lines from PR B's run.
  - `RELEASES.md` · the release trio: the public note (1.0.166).
  - `SCHEDULE.md` · records: step 15.
  - `docs/HANDOFF.md` · records: the session-57 prompt (the prod migration apply first, then P2.4's decision scan and plan).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.3 PR B's evidence and the dated merge line; the slot stays STARTED until the migration applies on prod.
  - `package.json` · the release trio: the version bump (1.0.166).
- **Review:** none (records)

## #1046 · 1.0.165 · P2.3 PR B · merged Thu 24 Sep 01:17 (22:17Z)
**Saved views, the Views menu and Download CSV.** The second half of P2.3 (APEX: the Interactive Report's saved reports and Download): a
saved view is a named Alternative of one Data region's state (sort, columns, filter); readers pick one from a Views menu and share it by
link, and Download CSV gives the rows as shown.
- **Readers see:** nothing from this PR alone; the two toggles (Saved views, Download CSV) are off by default, and no view exists until a
  designer saves one.
- **Editors get:** a Views menu and a Download CSV link under Actions Menu, off by default; a new Shared Components › Saved Views editor
  (create, edit and delete named views, each with its own History and Utilization by page and region).
- **Files (30):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.165).
  - `RELEASES.md` · the release trio: the public note (1.0.165).
  - `app/api/admin/design/views/[key]/route.test.ts` · the tests for the one-view route (GET/PUT/DELETE, the shortcuts' refusal pattern).
  - `app/api/admin/design/views/[key]/route.ts` · new: PUT and DELETE for one saved view, bound to the page's live region.
  - `app/api/admin/design/views/route.test.ts` · the tests for the views-and-targets list route.
  - `app/api/admin/design/views/route.ts` · new: GET (the views and their targets) and POST (create), the shortcuts' pattern.
  - `app/api/data/csv/route.test.ts` · the tests for the CSV route's 404s, text and headers, a saved view applied, the row cap, the scheme refusal.
  - `app/api/data/csv/route.ts` · new, public GET: the rows as shown, from the source, RFC 4180 with a byte-order mark and CRLF, at most 5000
    rows, `no-store`.
  - `components/data/DataRegionControls.tsx` · the Views menu and the Download CSV link added to the Actions menu control built in PR A.
  - `components/data/DataRegionViews.tsx` · wires the Views menu and Download CSV control into the region views.
  - `components/designer/Designer.tsx` · fetches the saved views and their targets when the designer opens, and wires the new Saved Views
    editor into Shared Components.
  - `components/designer/PageDesigner.test.tsx` · the test for the Actions Menu group's new Saved Views row.
  - `components/designer/PageDesignerProperties.tsx` · a Data region's Actions Menu group gains a "Saved views" row pointing to Shared Components.
  - `components/designer/ViewsEditor.test.tsx` · the tests for the Saved Views editor.
  - `components/designer/ViewsEditor.tsx` · new: the Saved Views table (key, name, page, region, the definition validated live), History and
    Utilization per row.
  - `components/designer/catalogue.test.ts` · the test for seventeen shared-component editors.
  - `components/designer/catalogue.ts` · the catalogue entry `views`.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.3 PR B's evidence and the dated merge line.
  - `lib/design/component-render.test.tsx` · the tests for `?view=` resolution and override, the Views menu, the Download link, nothing read while off.
  - `lib/design/component-render.tsx` · resolves `?view=<key>` under the address's own parameters, draws the Views menu and Download link.
  - `lib/design/components.test.ts` · the tests for the two new Actions Menu attributes.
  - `lib/design/components.ts` · *Saved views* and *Download CSV* added under Actions Menu, off by default.
  - `lib/design/definitions.ts` · `PageLatest`, `latestRevisions` and `readUsageRows` exported (were private) so `views.ts` can reuse the
    Utilization scan.
  - `lib/design/view-state.test.ts` · the tests for the key and name rules, the stored definition, the override.
  - `lib/design/view-state.ts` · the key/name rules, `parseViewDefinition`, `definitionOf`, `applySavedView`.
  - `lib/design/views.test.ts` · the tests for the rows, the memo, the targets scan, the shape.
  - `lib/design/views.ts` · new: the loaders, the targets scan (pages with Data regions), the live region's shape a definition binds to.
  - `package.json` · the release trio: the version bump (1.0.165).
  - `supabase/migrations/20260923220000_saved_views.sql` · new: the `saved_view` table, in the shape of the other design tables, applied
    locally; prod waits for an explicit "apply".
- **Verified:** tests first across nine files, then green. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 229 files, 2315 tests
  (2316 after the reviewer's fixes) · wrangler deploy --dry-run Total Upload 39160.25 KiB / gzip 8561.04 KiB (PR A: 39442.76 KiB). Browser,
  local server over the local database: the view "top-five" seeded and Monza Drivers' two toggles turned on with psql; the Monza page with
  `?view=top-five` draws the Views menu with "Top five" marked, the table sorted by points with the view's two columns, and the Download CSV
  link; the CSV route answers `text/csv`, `no-store`, with a byte-order mark and the sorted rows (`.playwright-mcp/p23b-monza-view-top-five.png`).
- **Review:** SOUND WITH FIXES, no blockers (~120k tokens said, 262,957 measured). Three should-fix items taken in a second commit: the CSV
  route now applies the page's conditions and Build Options as the served page does; a region with only Saved views or only Download CSV on
  counts as a region with controls; the migration wrapped in begin/commit as the other design-table migrations are. Two nits taken: the row
  route reads the region's shape once and DELETE refuses an unknown key; the Actions menu help no longer says the download comes later. Two
  declined, with the reason: no spreadsheet-formula prefixing on CSV cells (the site's own data, never a reader's); `seq` has no editor
  control yet (a default for a later slot).

## #1045 · 1.0.164 · records · merged Thu 24 Sep 00:11 (21:11Z)
Records P2.3 PR A's merge (#1044, squash-merged 20:59:37Z as a42c6dd1): the ledger's evidence, two honestly-recorded gaps (Home's parity void
by the operator's own publishes; the cached-variant check unverified on prod), and the session-57 handoff prompt.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.164).
  - `IDEAS.md` · records: three Inbox lines (prod's Calendar renders per request; the preview draws no controls; the reviewer's two nits).
  - `RELEASES.md` · the release trio: the public note (1.0.164).
  - `SCHEDULE.md` · records: step 14.
  - `docs/HANDOFF.md` · records: the session-57 prompt (PR B on the approved plan; two landmines: the catch-all's percent-encoded segment, a
    build beside the dev server corrupting `.next/dev/types`).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.3's evidence so far and the merge's dated line; the slot stays STARTED until PR B.
  - `package.json` · the release trio: the version bump (1.0.164).
- **Review:** none (records)

## #1044 · 1.0.163 · P2.3 PR A · merged Wed 23 Sep 23:59 (20:59Z)
**The URL vocabulary, the cached variant and the table's controls.** The first half of P2.3 (APEX: the Interactive Report): a
sort/columns/filter/view vocabulary in the query string, served from a cached variant address so the plain page stays shareable and
cacheable, plus sortable column headings and an Actions menu on Data regions.
- **Readers see:** nothing from this PR alone; every control is off until a designer turns it on.
- **Editors get:** an Actions Menu group (Sortable headings, Actions menu) on Data regions, drawn while the View is Table or Cards.
- **Files (20):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.163).
  - `RELEASES.md` · the release trio: the public note (1.0.163).
  - `app/(app)/[...catchall]/page.test.tsx` · the tests for the variant decode, the canonical and noindex, a junk segment.
  - `app/(app)/[...catchall]/page.tsx` · `addressOf` splits and decodes the `__view` segment, serving the plain address's page with the
    state; a variant is `noindex, follow` with the plain path as its canonical.
  - `components/data/DataRegionControls.tsx` · new: sortable headings as links with `aria-sort`; the Actions menu as a `<details>` (Select
    Columns, Sort by, Reset), no client JavaScript.
  - `components/data/DataRegionViews.tsx` · draws the sortable headings and the Actions menu control on the Table and Cards views.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.3 PR A's evidence and the dated line; the slot STARTED (PR B follows).
  - `lib/design/component-render.test.tsx` · the tests for `href`/`view`/`controlsKey`, byte parity with the toggles off, the sorted table,
    Select Columns, two regions under `r.<id>.`.
  - `lib/design/component-render.tsx` · `RenderPage` gains `href`, `view` and a per-region `controlsKey` (null where no state can arrive, for
    instance a framed code route).
  - `lib/design/components.test.ts` · the tests for the Actions Menu group and its two attributes.
  - `lib/design/components.ts` · the group Actions Menu (Sortable headings, Actions menu), booleans off by default.
  - `lib/design/page-document.test.ts` · the test for the reserved `/__view` prefix.
  - `lib/design/page-document.ts` · `/__view` joins `RESERVED_PREFIXES`.
  - `lib/design/presets.test.ts` · the tests for the typed filters, the sort with ties, the count, the results-shape flat sort.
  - `lib/design/presets.ts` · `presetRows(rows, preset, count, state?)` applies the filters and the sort (nulls last, ties in the preset's
    order) before the count.
  - `lib/design/view-state.test.ts` · the tests for the vocabulary's parse, bind, canonical encode, hrefs, the rewrite rule, the segment's
    round trip.
  - `lib/design/view-state.ts` · new: the vocabulary (`sort`, `cols`, `filter`, `view`), `parseViewState`, `bindViewState`,
    `encodeViewState`, `viewStateHref`/`sortHref`, and the middleware's `rewriteTarget`.
  - `middleware.ts` · after the dev-host block, a page carrying a state is rewritten to its cached variant `/__view/<segment>/<path>`; the
    address bar keeps the plain form.
  - `package.json` · the release trio: the version bump (1.0.163).
- **Verified:** tests first, seen red: 8 across 6 files plus the missing module, then green; byte parity with the toggles off asserted
  against today's markup. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 224 files, 2292 tests · the ledger test 6/6 · cf:build exit
  0, 1189 pages · wrangler deploy --dry-run Total Upload 39442.76 KiB / gzip 8656.59 KiB (R7: 39411.02 KiB). Browser, local designer and
  served page (`PADDOCK_ENV=production`): the Actions Menu group turned on for a Monza Drivers table; `/history/monza` draws every heading
  as a link, Pts → `?sort=points` sorts the table with `aria-sort`; the Actions menu's Select Columns applies `?sort=-points&cols=...` with
  six columns (`.playwright-mcp/p23a-monza-sorted-actions.png`, `p23a-monza-cols.png`); `/?sort=points` (Home, a code route) untouched.
- **Review:** SOUND WITH FIXES, no blockers (~100k tokens said, 236,555 measured). Two should-fix items taken in a second commit: `cols` is
  written in one order whatever the address said (the shape's order, so two orders were two cache variants for one table); a cap on what one
  address may mint into the cache (at most 24 columns, 6 regions, a 1024-character canonical string, else the plain page serves). Two nits
  left as they are: the filter loop parses past the fourth before dropping; no integration test proves the segment survives the Worker's
  routing (the browser run and the deploy check stand for it).
- **Corrections:** the variant segment is base64url, not the plan's percent-escaped form: Next 16 hands a catch-all segment
  percent-encoded (a literal "=" arrived as "%3D"), so no escaped form could be decoded safely; an alphabet no router touches is.

## #1043 · 1.0.162 · records · merged Wed 23 Sep 21:01 (18:01Z)
Records R8's merge (#1042, squash-merged 17:50:58Z as 20b1eae7) and a correction to 1.0.161's release note.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.162).
  - `IDEAS.md` · records: four Inbox lines.
  - `RELEASES.md` · the release trio: the public note (1.0.162), correcting 1.0.161's "nothing changes on the pages you read today".
  - `SCHEDULE.md` · records: step 13.
  - `docs/HANDOFF.md` · records: the session-57 prompt (PR A on `feat/p2.3-a-view-state`; two landmines: corrupted `.next/dev/types`, the
    Bash tool's ~8 KB command cap).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: R8 DONE with its evidence and the merge's dated line.
  - `package.json` · the release trio: the version bump (1.0.162).
- **Review:** none (records)

## #1042 · 1.0.161 · R8 · merged Wed 23 Sep 20:50 (17:50Z)
**A Data region follows its Source's series: the Latest result box leads, What's next names the series.** Two quick fixes on the operator's
reports: the Latest result preset moves to the head of the results presets, so a Data region switched to Results draws that championship's
last-result box by itself instead of landing on a season list; the Coming weekends template now names the Source's series in its corner
instead of always reading "All series".
- **Readers see:** yes, on Home: the two What's next boxes set to Formula 1 and Formula 2 now name them in the corner instead of "All series".
- **Editors get:** a Data region whose Type becomes Results opens on the Latest result preset by default; the Coming weekends template reads
  the Source's own series name.
- **Files (12):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.161).
  - `RELEASES.md` · the release trio: the public note (1.0.161).
  - `components/data/DataRegionViews.tsx` · the Coming weekends rule reads the series' name from the rows a named Source read, "All series"
    only for a Source across every series.
  - `components/designer/PageDesigner.test.tsx` · the tests for the Type change to Results and the Coming weekends render naming its series.
  - `components/designer/page-designer-model.test.ts` · the test for `withSourceChanged` landing on latest-result/podium/rows 3.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: slot R8's evidence and the dated line with the operator's words.
  - `lib/design/component-render.test.tsx` · the test for the Coming weekends render over a named Source.
  - `lib/design/component-render.tsx` · `DataRegionViewProps` gains `series` (the Source's `series` parameter, handed to the view).
  - `lib/design/presets.test.ts` · the test for the catalogue's preset order (f1/f2/wec/nls).
  - `lib/design/presets.ts` · the Latest result preset moves to the head of the results presets.
  - `package.json` · the release trio: the version bump (1.0.161).
- **Verified:** tests first, seen red: 4 across 4 files, then green (two order-dependent assertions followed). Gates: tsc 0 · lint 0 errors
  (2 known warnings) · vitest 223 files, 2279 tests · the ledger test 6/6. Browser, local designer on Monza (`PADDOCK_ENV=production`): Type
  → Results + Series Formula 2 reads "Results · Formula 2 · 2026 · Preset Latest result · View Latest result · Rows 3", Messages 0; a
  Weekends region + Series Formula 1 reads "... Preset What's next · View What's next ..."; the saved draft's preview drew the F2 box (round
  11, the Spain Feature Race) and the What's next rule reading "Formula 1".
- **Review:** SOUND, nothing blocking (~60k tokens said, 195,217 measured); its one nit, the slug fallback on the Coming weekends rule being unreachable while the weekends reader names every row, left as is. Recorded in 1.0.162 and the ledger, not in the PR body.

## #1041 · 1.0.160 · records · merged Wed 23 Sep 20:02 (17:02Z)
Records R7's merge (#1040, squash-merged 16:53:19Z as 57b9d3d2) and P2.3's decision scan and plan approval.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.160).
  - `IDEAS.md` · records: four Inbox lines.
  - `RELEASES.md` · the release trio: the public note (1.0.160).
  - `SCHEDULE.md` · records: the afternoon's steps.
  - `docs/HANDOFF.md` · records: the LATEST header and the session-57 prompt (PR A on the approved P2.3 plan), the state and two landmines.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: R7 DONE with its evidence and the dated merge line; P2.3's decision scan (four words) and plan approval.
  - `package.json` · the release trio: the version bump (1.0.160).
- **Review:** none (records)

## #1040 · 1.0.159 · R7 · merged Wed 23 Sep 19:53 (16:53Z)
**A change of Source picks the first preset it offers.** A quick fix: changing a Data region's Source (its Type or Series) now moves a
preset or template view the new Source does not offer to the first it does, with what that pick brings (view, rows, card slots and zones),
exactly as picking it by hand does, instead of blocking Save with a refused-binding message.
- **Readers see:** nothing (a designer-only fix).
- **Editors get:** `withSourceChanged` runs on every Type or Series change in the Property Editor; the parser's binding-refusal messages now
  name the setting ("Preset X is for a Y source; this region reads Z").
- **Files (11):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.159).
  - `RELEASES.md` · the release trio: the public note (1.0.159).
  - `components/designer/PageDesigner.test.tsx` · the tests for the Type change to Results and to Posts picking the first preset with no
    Messages.
  - `components/designer/PageDesignerProperties.tsx` · `setSource` now calls `withSourceChanged` for the Type select and every parameter's change.
  - `components/designer/page-designer-model.test.ts` · the tests for `withSourceChanged`'s rule across Standings, Results and the Live band.
  - `components/designer/page-designer-model.ts` · `withSourceChanged(region, next, spec)`, pure: moves an unsupported preset or view to
    the new Source's first offering.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: slot R7's evidence and the dated line with the operator's word.
  - `lib/design/page-document.test.ts` · the tests for the parser's thirteen message strings naming the setting.
  - `lib/design/page-document.ts` · the two binding-refusal messages now name the setting ("Preset ... is for a ... source").
  - `package.json` · the release trio: the version bump (1.0.159).
- **Verified:** tests first, seen red: 6 across 3 files, then green (the P2.2 designer test's "stored preset stays visible" step changes on
  purpose: the Source change now picks for you). Gates after the reviewer's fixes: tsc 0 · lint 0 errors (2 known warnings) · vitest 223
  files, 2279 tests (a first run beside the foreground build timed one test out at 5s) · hooks 31/31 · cf:build exit 0, 1189 pages (439s
  beside the suite) · wrangler deploy --dry-run Total Upload 39411.02 KiB / gzip 8625.26 KiB (PR C: 39409.56 KiB).
- **Review:** PASS WITH NOTES, nothing blocking (~120k tokens said, 202,161 measured, 38 tool uses). Its two notes taken in the second
  commit: a DOM-level test for a Series change with a preset the new series does not offer; the redundant manual pick removed from the Posts
  step, and a no-op `?? null` dropped. Two nits noted, not taken: the "later" refusal message stays unprefixed, unreachable today; the
  Attributes tab's own note keeps its per-option words.

## #1039 · 1.0.158 · records · merged Wed 23 Sep 17:53 (14:53Z)
Records P2.24 PR C's merge (#1038, squash-merged 14:38:30Z as d340c4c1), P2.24 DONE, and the parity script's two normaliser rules learned
from the deploy.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.158).
  - `IDEAS.md` · records: ten Inbox lines.
  - `RELEASES.md` · the release trio: the public note (1.0.158, internal only).
  - `SCHEDULE.md` · records: the session block.
  - `docs/HANDOFF.md` · records: the LATEST header and the session-57 prompt (P2.3 first, then P2.4), the state, this run's landmines.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24 DONE with PR C's evidence and the dated merge line.
  - `package.json` · the release trio: the version bump (1.0.158).
  - `scripts/parity-home.mts` · two normaliser rules learned from the deploy (the countdowns' big clock by its own typography, an empty
    class attribute); prod's before/after captures now read `identical: 7 regions`.
- **Review:** none (records)

## #1038 · 1.0.157 · P2.24 C · merged Wed 23 Sep 17:38 (14:38Z)
**The flip: a stored Home component upgrades on read, the six retire.** The third of P2.24's PRs: prod's Home is served from the operator's
own split document naming six Home-only components (`home.lead`, `home.live`, `home.result`, `home.changed`, `home.next`, `home.wire`).
This PR retires the six from the catalogue without touching that document: the parser upgrades a stored region naming one to its Data-region
or Live-band equivalent the moment it is read, so the served page, the preview, the designer and the next Save all agree.
- **Readers see:** nothing; the parity script proved prod's Home identical across the deploy (7 regions).
- **Editors get:** Home's designer view now shows 5 Data regions and a Live band instead of six special-purpose pieces; the Gallery has no
  Home group; a Data region's Series select offers "Home's series" (Results) or "Latest result" (Standings) first.
- **Files (34):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.157).
  - `RELEASES.md` · the release trio: the public note (1.0.157).
  - `app/api/admin/design/data/sources/route.test.ts` · the test fixture's stored region updated from `home.changed` to its `data.region`
    upgrade form.
  - `app/api/admin/design/settings/[key]/route.test.ts` · the tests swap the retired `home.wire_count`/`home.blog_suggested_count` keys for
    surviving ones (`home.lead_series`, `region.button.label`).
  - `components/designer/PageDesigner.test.tsx` · the Home-component tests removed; the Card-slots test's fixed wait replaced by a poll.
  - `components/designer/PluginsEditor.test.tsx` · the What it changed row now asserted by its key, not its retired name; nine catalogue rows.
  - `components/designer/page-designer-model.test.ts` · the tests for `splitRecipe` returning component keys from the new `RecipeEntry` shape.
  - `components/designer/page-designer-model.ts` · `splitRecipe` maps `RecipeEntry` objects (or plain strings) to their component key.
  - `components/page/RowPageView.test.tsx` · the test for the frame's shared `splitsBody` rule.
  - `components/page/RowPageView.tsx` · `CodePageFrame` reuses the frame's shared `splitsBody` rule instead of its own inline check.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24 PR C's evidence and the dated lines (the flip's look, the upgrade-on-read correction, the plan
    approval).
  - `lib/design/component-definitions.test.ts` · the test for a definition without the six retired components.
  - `lib/design/component-render.test.tsx` · the tests for the renderer without the six, `LEGACY_UPGRADES` and the upgraded rendering.
  - `lib/design/component-render.tsx` · the six components' render branches leave; `renderComponents` reads every region through the
    parser's upgrade.
  - `lib/design/components.test.ts` · the tests for the catalogue without the six definitions.
  - `lib/design/components.ts` · the six definitions, renderers and READS leave the catalogue.
  - `lib/design/debug-trace.test.ts` · Home's fixture regions rewritten as Data-region/Live-band components; the trace assertions follow
    the new READS.
  - `lib/design/definitions.test.ts` · the tests for Utilization counting a stored old key under its upgrade.
  - `lib/design/definitions.ts` · `usageFromRows` counts a stored old key (`home.lead`, `home.wire`, etc.) under its Data-region upgrade.
  - `lib/design/page-document.test.ts` · the tests for the parser's upgrade table (each of the six, fields kept, a class-family Source refused).
  - `lib/design/page-document.ts` · `LEGACY_UPGRADES` and `upgradedKey`: a stored region naming an old key reads as its Data-region or
    Live-band template.
  - `lib/design/page-frame.test.ts` · the tests for the frame's memoised thunk (never for a split document, once otherwise, a rejection
    propagated once).
  - `lib/design/page-frame.tsx` · `framed` takes the code page's body as a memoised thunk, called at most once and never for a split document.
  - `lib/design/presets.ts` · a comment update: the two Application Settings that used to set the lead/wire counts retired here.
  - `lib/design/setting-defaults.ts` · `home.wire_count` and `home.blog_suggested_count` leave the settings catalogue; `SettingValue`
    widened to a plain union.
  - `lib/design/settings.test.ts` · the tests for the settings catalogue without the two retired keys.
  - `lib/home-layout.test.ts` · the tests for the layout without a pin.
  - `lib/home-layout.ts` · `pinnedSlug`/`pinnedLeadSlug` retire (a stored pin from the old console is ignored; the lead is the Lead story
    region's business now).
  - `lib/home-model.test.ts` · the tests for `liveStep`, `loadLiveModel` and the model without the retired pieces.
  - `lib/home-model.ts` · a pure `liveStep` and a cached `loadLiveModel` for the Live band and the race-weekend conditions;
    `changedFromStandings` and the pin retire.
  - `lib/series.ts` · `loadAllSeries`/`loadAllSeriesMeta` wrapped in React's `cache` (once per request).
  - `package.json` · the release trio: the version bump (1.0.157).
  - `scripts/parity-home.mts` · new: two captures of `/` compared region by region after normalising countdowns, ages, flight scripts,
    comments and whitespace.
- **Verified:** tests first, seen red: 17 failures across 10 files (plus the renderer test failing to load on the missing `loadLiveModel`),
  then green. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 223 files, 2278 tests · hooks 31/31 · cf:build exit 0 in 196s, 1189
  pages · wrangler deploy --dry-run Total Upload 39409.56 KiB / gzip 8625.22 KiB (60.1% of 64 MiB). Browser, local server against prod's live
  document inserted verbatim (review page `1ce6f9ab-24e0-48a6-8f00-ea8219a62fde`, 5 screenshots): the designer opens the seven regions as
  five Data regions and the Live band with sources, presets, rows, templates and places kept; Save stores the upgraded form; the local `/`
  serves the seven boxes through the upgrade; the Gallery has no Home group. Parity: `scripts/parity-home.mts` calibrated on prod (two
  captures 25s apart, identical); prod's before/after captures across the deploy are compared in the next records (#1039).
- **Review:** PASS WITH NOTES, nothing blocking (~250k tokens said, 386,082 measured, 41 tool uses). Six notes, most watched rather than
  fixed: the wire's fallback when a headline's series does not resolve; the Podium's report link only when the round resolves, and reading
  the latest race through the results snapshots rather than KV podiums; the Leader template's binding refusal for a class-family Source on
  an old What it changed (none in prod's history). One taken in the second commit: the parity script's depth counter now reads after the
  flight `<script>` tags are stripped.

## #1037 · 1.0.156 · records · merged Wed 23 Sep 15:34 (12:34Z)
Records R6's merge (#1036, squash-merged 12:27:31Z as 74fd112d) and PR C's decision-scan answer on the flip's look.
- **Files (7):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.156).
  - `RELEASES.md` · the release trio: the public note (1.0.156).
  - `SCHEDULE.md` · records: the step.
  - `docs/HANDOFF.md` · records: the LATEST header and session-57 prompt carrying R6 and PR C's answered scan (APEX margins, later
    superseded; the half kept when one half is empty).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: R6 DONE with its evidence and the dated merge line.
  - `package.json` · the release trio: the version bump (1.0.156).
- **Review:** none (records)

## #1036 · 1.0.155 · R6 · merged Wed 23 Sep 15:27 (12:27Z)
**The live band features the lead series once.** A quick fix: with every other region hidden, Home's live band boxed the same weekend
twice when the lead series was also listed among the featured series in Application Settings, because `rankLiveWeekends` built the featured
list as the lead then the majors with no exclusion. The lead is now excluded from the majors.
- **Readers see:** yes, the live band no longer boxes the lead series' weekend twice when it is also among the featured series.
- **Editors get:** nothing beyond the fixed ranking; the Application Setting `home.major_series` still lets an editor list the lead among
  the featured series (left valid, harmless).
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.155).
  - `IDEAS.md` · records: two Inbox lines (prod's prefetched routes referencing a previous build's chunks; the settings editor allowing
    the overlap).
  - `RELEASES.md` · the release trio: the public note (1.0.155).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: slot R6's evidence and the dated line with the operator's word.
  - `lib/home-model.test.ts` · the test for the overlap (lead f1, majors [f1, motogp] → featured f1 then motogp).
  - `lib/home-model.ts` · `rankLiveWeekends` excludes the lead series from the majors before ranking (one line).
  - `package.json` · the release trio: the version bump (1.0.155).
- **Verified:** tests first, seen red: the new home-model test failed before the change (1 of 14), passed after. Gates: tsc 0 · lint 0
  errors (2 known warnings) · vitest 223 files, 2280 tests · hooks 31/31 · cf:build exit 0, 1189 pages (52 first-attempt prerender retries,
  each passing) · wrangler deploy --dry-run Total Upload 39427.18 KiB / gzip 8630.11 KiB. Not proven in a browser: the duplicate needs the
  setting with the lead among the featured series; the unit test carries the case.
- **Review:** PASS WITH NOTES, nothing blocking (~60k tokens said, 116,961 measured). Its one note, the lead named among the majors while
  not racing, is asserted in the same test.

## #1035 · 1.0.154 · records · merged Wed 23 Sep 14:37 (11:37Z)
Records P2.24 PR B2's merge (#1034, squash-merged 11:27:37Z as dde6c4b6): the ledger's evidence, the slot staying started for PR C, and ten
Inbox lines.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.154).
  - `IDEAS.md` · records: ten Inbox lines.
  - `RELEASES.md` · the release trio: the public note (1.0.154).
  - `SCHEDULE.md` · records: the session-56 block.
  - `docs/HANDOFF.md` · records: the LATEST header with the session-57 prompt (PR C's decision scan first, then plan mode with a Sonnet
    critic, the parity script, the flip).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24's evidence carries B2's merge; the slot stays STARTED for PR C.
  - `package.json` · the release trio: the version bump (1.0.154).
- **Review:** none (records)

## #1034 · 1.0.153 · P2.24 B2 · merged Wed 23 Sep 14:27 (11:27Z)
**The Podium and Leader templates: Home's Latest result and What it changed as Data-region templates.** The third of P2.24's PRs (the
second half of B): Home's two remaining boxes become View templates of the general Data region, bound to the Results and Standings sources
through a cross-series resolution no source carried before, the newest finished race across the series Home ranks.
- **Readers see:** nothing; Home stays on its own six pieces until PR C.
- **Editors get:** a Results Data region's Series select offers "Home's series" first (the Latest result / Podium template); a Standings
  region's offers "Latest result" first (the Leader template, the winner's row marked).
- **Files (22):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.153).
  - `RELEASES.md` · the release trio: the public note (1.0.153).
  - `components/data/DataRegionViews.tsx` · `DataRegionPodium` and `DataRegionLeader`, Home's `HomeLatestResult` and `HomeWhatChanged`
    copied verbatim as templates.
  - `components/designer/DataSourcesEditor.test.tsx` · the test for the Data Sources editor's special-value series options.
  - `components/designer/DataSourcesEditor.tsx` · `seriesChoices` draws "Home's series"/"Latest result" first, by their label.
  - `components/designer/PageDesigner.test.tsx` · the tests for the Series select, the Latest result and What it changed presets and
    their pills.
  - `components/designer/PageDesignerProperties.tsx` · the Property Editor's Series select draws the special values first.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24's evidence carries B2's plan approval and merge.
  - `lib/design/component-render.test.tsx` · the tests for the Podium and Leader templates drawn from fixtures.
  - `lib/design/component-render.tsx` · dispatches Latest result and What it changed on their own shape alone (`podium-rows`, `driver-rows`).
  - `lib/design/components.test.ts` · the tests for the two new presets and their View options.
  - `lib/design/components.ts` · the View options "Latest result" and "What it changed" bound to their sources.
  - `lib/design/page-document.test.ts` · the test for the parser naming a value by its label in a refusal.
  - `lib/design/page-document.ts` · the preset-refusal message names the value by its label ("Drivers is not a preset of Latest result").
  - `lib/design/presets.test.ts` · the tests for the `podium-rows` shape and its date-ordered rule.
  - `lib/design/presets.ts` · new shape `podium-rows`; the presets Latest result (view `podium`, rows 3) and What it changed (view
    `leader`, rows 5).
  - `lib/design/source-read.test.ts` · the tests for `latestRaceAcross`, the "Home's series" join and the "Latest result" standings
    resolution.
  - `lib/design/source-read.ts` · `latestRaceAcross(slugs, season)`: the newest finished race across Home's series, once per request
    through React's `cache`; every row gains series facts, season-complete and champion/winner.
  - `lib/design/sources.test.ts` · the tests for the Results and Standings sources' special series values.
  - `lib/design/sources.ts` · the Results source's Series offers "Home's series" (key `home`) first; Standings' offers "Latest result"
    (key `latest`) first.
  - `package.json` · the release trio: the version bump (1.0.153).
- **Verified:** plan critic (Sonnet, said ~250k tokens, 293,409 measured): SOUND WITH FIXES, four blocking folded. Tests first, seen red:
  19 failures across 8 files (133 passing), then green. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 223 files, 2279 tests ·
  hooks 31/31 · cf:build exit 0, 1189 pages (55 first-attempt prerender timeouts, each passing on retry) · wrangler deploy --dry-run Total
  Upload 39427.05 KiB / gzip 8629.93 KiB (60.2% of 64 MiB; B1: 40356.01 KiB). Browser, local server with the production flag (review page
  `bb8c0ea0-002d-4502-917e-52a6bec1cfbc`, 8 screenshots): the Podium on the Monza preview drew the very text of Home's Latest result box at
  the same moment (MotoGP round 15, Pedro Acosta, margin +1.017); the Leader drew Home's first five standings rows with the winner marked;
  the trace showed both regions' sources ending at the same instant.
- **Review:** PASS WITH NOTES, nothing blocking (~250k tokens said, 305,410 measured). Three notes: a stale comment atop `PRESETS` still
  counting thirty-five presets, taken in the second commit; the plan's prose named a richer return shape for `latestRaceAcross` than the
  code's `{ slug, rows, winner }` (the round, race and date ride on the rows, which both call sites and templates read); the champion's
  eligibility gate confirmed as `fetchFullDriverStandings`'s own null for a series without a drivers' brief.

## #1033 · 1.0.152 · records · merged Wed 23 Sep 11:18 (08:18Z)
Records the operator's six answers to the Phase 2 progress report (~08:05Z): P2.24 B2's cross-series default and PR C's four defaults
stand; P2.3 and P2.10 settled without a further question.
- **Files (7):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.152).
  - `RELEASES.md` · the release trio: the public note (1.0.152).
  - `SCHEDULE.md` · records: the step.
  - `docs/HANDOFF.md` · records: the LATEST close with the session-56 prompt, P2.24 B2 first, then PR C's four defaults, then P2.3's answer.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: one dated line carrying the operator's six answers; P2.3 and P2.10 no longer carry a question.
  - `package.json` · the release trio: the version bump (1.0.152).
- **Review:** none (records)

## #1032 · 1.0.151 · records · merged Wed 23 Sep 10:49 (07:49Z)
Records P2.24 PR B1's merge (#1031, squash-merged 07:41:42Z as d7b5ba45) and publishes the Phase 2 progress report.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.151).
  - `IDEAS.md` · records: five Inbox lines.
  - `RELEASES.md` · the release trio: the public note (1.0.151).
  - `SCHEDULE.md` · records: the morning.
  - `docs/HANDOFF.md` · records: the LATEST close with the session-56 prompt (the operator's answers to the progress report's first group,
    then B2's decision scan and plan).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24's evidence carries B1's merge; the slot stays STARTED (B2, PR C).
  - `package.json` · the release trio: the version bump (1.0.151).
- **Review:** none (records)

## #1031 · 1.0.150 · P2.24 B1 · merged Wed 23 Sep 10:41 (07:41Z)
**The Weekends source and the Coming weekends template: Home's What's next as a Data region.** The second of P2.24's PRs (B split into B1
and B2 at the plan's approval): the fourteenth catalogue source, the coming weekends across every series or one, and a Coming weekends View
template copied verbatim from Home's `HomeWhatsNext`.
- **Readers see:** nothing; Home stays on its own pieces until PR C.
- **Editors get:** a fourteenth Data Source, Weekends (Series optional, Count 1-50); a Coming weekends View template on Data regions.
- **Files (23):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.150).
  - `RELEASES.md` · the release trio: the public note (1.0.150).
  - `app/api/admin/design/data/sources/route.test.ts` · one of the reviewer's five stale "thirteen" comment fixes, reworded to fourteen.
  - `app/api/admin/design/data/sources/route.ts` · the same stale-comment fix as its test.
  - `components/data/DataRegionViews.tsx` · `DataRegionComingWeekends`, Home's `HomeWhatsNext` copied verbatim as a template.
  - `components/designer/DataSourcesEditor.test.tsx` · one of the reviewer's five stale "thirteen" comment fixes.
  - `components/designer/DataSourcesEditor.tsx` · the same stale-comment fix.
  - `components/designer/DataWorkspace.test.tsx` · the same stale-comment fix.
  - `components/designer/PageDesigner.test.tsx` · the tests for the Weekends Source Type, the What's next preset's view and rows.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24's evidence carries B1's plan approval and merge.
  - `lib/design/component-render.test.tsx` · the test for the Coming weekends template drawn from a fixture.
  - `lib/design/component-render.tsx` · dispatches the Weekends source's `weekend-rows` shape to its template.
  - `lib/design/components.test.ts` · the tests for the fifth source and the What's next View option.
  - `lib/design/components.ts` · the View option "What's next" bound to the weekends source.
  - `lib/design/page-document.test.ts` · the test for the What's next binding.
  - `lib/design/presets.test.ts` · the tests for the `weekend-rows` shape and the What's next preset.
  - `lib/design/presets.ts` · new shape `weekend-rows`; the preset What's next (view `coming-weekends`, rows 3, every series).
  - `lib/design/source-read.test.ts` · the tests for the reader's order, count, columns and a throwing series.
  - `lib/design/source-read.ts` · the Weekends reader: Home's What's next rule (every series' weekends not past, sorted by first
    session, cut to Count).
  - `lib/design/sources.test.ts` · the tests for the fourteenth source's columns, parse and label.
  - `lib/design/sources.ts` · the Weekends source: Series (optional), Count (1-50, default 10); nine columns; reads `content:series` and
    `live:ics`.
  - `package.json` · the release trio: the version bump (1.0.150).
- **Verified:** plan critic (Sonnet, said ~250k tokens, 297,236 measured): SOUND WITH FIXES, three blocking folded. Tests first, seen red:
  13 failures across 9 files, then green. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 223 files, 2272 tests · hooks 31/31 ·
  cf:build exit 0, no prerender retries · wrangler deploy --dry-run Total Upload 40356.01 KiB / gzip 8877.77 KiB (61.6% of the ceiling,
  142.55 KiB over 1.0.148's 40213.46 KiB). Browser, local server (review page `435d574c-bfa9-4371-afca-2485e813744f`, 4 screenshots):
  Source Weekends (every series, Count 10), the What's next preset; the preview drew Home's box verbatim over ten live weekends, the
  nearest three (the F2/F1 Azerbaijan Grands Prix, 24-26 Sept, with its countdown; the 6 Hours of Fuji, 25-27 Sept); the local Home page
  drew the same three weekends in the same order at the same moment.
- **Review:** PASS WITH NOTES, nothing blocking (~250k tokens said, 237,688 measured). Four notes: five stale "thirteen" comments reworded
  to fourteen, taken in the second commit; the apostrophe regex tolerating a bare quote React never emits, left as is; the title label
  computed outside the per-series try exactly as Home's is, a faithful copy of an accepted risk; the dry run's growth explained.

## #1030 · 1.0.149 · records · merged Wed 23 Sep 09:10 (06:10Z)
Records P2.24 PR A's merge (#1029, squash-merged 06:01:25Z as 0b0f42a4) and opens the session-56 handoff with PR B first.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.149).
  - `IDEAS.md` · records: eight Inbox lines.
  - `RELEASES.md` · the release trio: the public note (1.0.149).
  - `SCHEDULE.md` · records: the session.
  - `docs/HANDOFF.md` · records: the LATEST close with the session-56 prompt (PR B first, its decision scan's three defaults stated).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24's evidence carries the merge; the slot stays STARTED (PR B, PR C).
  - `package.json` · the release trio: the version bump (1.0.149).
- **Review:** none (records)

## #1029 · 1.0.148 · P2.24 A · merged Wed 23 Sep 09:01 (06:01Z)
**Posts and news into the Data region: the Lead story and The wire as templates, the image column.** The first of P2.24's three PRs
("Home's six become instances"): the Data region reads two more catalogue sources, posts and news, and draws Home's Lead story and The
wire boxes over them as View templates, so PR C can later place Data regions where `home.lead` and `home.wire` stand and serve the same HTML.
- **Readers see:** nothing; Home stays on its own pieces until PR C.
- **Editors get:** Posts and News join the Data region's sources; Lead story and The wire join the View list as templates; a Pinned post
  attribute; a new image column type (a thumbnail in a table cell, a picture in a card's Media box).
- **Files (24):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.148).
  - `RELEASES.md` · the release trio: the public note (1.0.148).
  - `components/data/DataRegionViews.tsx` · `DataRegionLeadStory` and `DataRegionWire`, Home's markup copied verbatim from
    `HomeLead.tsx`; the image column's thumbnail and Media box.
  - `components/designer/PageDesigner.test.tsx` · the tests for the Source types, the Preset group, Pinned post, the greyed pills and
    their note.
  - `components/designer/PageDesignerProperties.tsx` · `SLOT_OF` gains the media slot (`cardMedia` → `media`), the browser run's find
    (the Media slot read "(none)" over a picture column).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24's evidence carries the merge; the slot STARTED (PR B, PR C).
  - `lib/blog.test.ts` · the test for `readMinutes`, exported from this module.
  - `lib/blog.ts` · `readMinutes(body)` exported (one divisor, 220 words a minute), used by the lead card too.
  - `lib/date.test.ts` · the test for `ageLabel`, moved into this module.
  - `lib/date.ts` · `ageLabel` moved here from `lib/home-model.ts`.
  - `lib/design/component-render.test.tsx` · the tests for the Lead story and The wire templates drawn from fixtures.
  - `lib/design/component-render.tsx` · `RenderPage` hands one `now` to every region; reads posts and news in `READS`.
  - `lib/design/components.test.ts` · the tests for the two new View options, the Pinned post attribute, the greyed pills.
  - `lib/design/components.ts` · the templates are View options (a correction to the scan's default of a separate Template attribute);
    the Pinned post attribute; the image column type declared on `Shape.card.media`.
  - `lib/design/page-document.test.ts` · the tests for the parser's bindings over the two new sources.
  - `lib/design/presets.test.ts` · the tests for `post-rows`/`news-rows` and the Lead story/The wire presets.
  - `lib/design/presets.ts` · two shapes (`post-rows`, `news-rows`) and two presets (Lead story, The wire, over every series).
  - `lib/design/source-read.test.ts` · the tests for the posts/news readers' order, stamps, read time and series facts.
  - `lib/design/source-read.ts` · the posts reader orders as `fetchHomeBlogLead` does; the news reader sorts newest first as
    `buildWire` does; both gain Series, Series colour.
  - `lib/design/sources.test.ts` · the tests for the two new sources' columns.
  - `lib/design/sources.ts` · Posts and News join the Data region's sources.
  - `lib/home-model.ts` · imports `ageLabel` from its new home, `lib/date.ts`, instead of defining it locally.
  - `package.json` · the release trio: the version bump (1.0.148).
- **Verified:** plan critic (Sonnet, said ~250k tokens, 343,043 measured): SOUND WITH FIXES, three blocking folded. Tests first, seen
  red: 15 failures across 9 files, then green. Gates (second commit): tsc 0 · lint 0 errors (2 known warnings) · vitest 223 files, 2268
  tests · hooks 31/31 · cf:build exit 0, no prerender retries · wrangler deploy --dry-run Total Upload 40213.46 KiB / gzip 8839.70 KiB
  (61.4% of the ceiling, 100.18 KiB over 1.0.146's 40113.28 KiB). Browser (review page
  `a4edd962-5678-40c3-8b06-048322339d20`, 7 screenshots; the local database seeded with an author row and three published posts): a
  Posts region's preview drew Home's lead box verbatim ("LEAD STORY · 2H AGO · | FORMULA 1 · 2 MIN READ", the title, summary, button,
  More reading); a News region's preview drew Home's wire verbatim over 39 rows, the newest five.
- **Review:** PASS WITH NOTES, nothing blocking (~250k tokens said, 262,171 measured). Six informational notes, none taken in the first
  commit (the `||` over `??` fallback, inert; the wire's dropped `className`; the test mock's own `readMinutes` copy; `slotText`
  formatting a hand-mapped date slot; the pinned lead's More reading from the reader's rows). The second commit is the browser run's own
  find: the Media slot's label read "(none)" over a picture column, fixed with its test.
