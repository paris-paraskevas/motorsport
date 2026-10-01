# Paddock — performance baselines

Time-series perf snapshot. **Append-only by date** — never overwrite prior rows; the trend is the point.

**Sources:**
- **Vercel Speed Insights** (field / Real Experience Score): `vercel.com/<org>/motorsport/speed-insights`
- **PageSpeed Insights** (lab / Lighthouse): `pagespeed.web.dev/?url=https://paddock-tracker.com/`

---

## 2026-10-01 — X6: page weight, three PRs (1.0.226, 1.0.227, 1.0.228)

Seobility's "Big HTML pages": `/changelog` 2.1 MB, the results tabs 1.1–2.4 MB, `/calendar` 532 kB. The App Router ships every server-rendered element twice, as HTML and again inside the inline flight payload, so a page weighs about twice its markup and folds hide but do not lighten; the lever was how much markup a page carries.

**Method:** `curl -s -o /dev/null -w '%{size_download}'` plain (the HTML), `--compressed` (the wire) and with `RSC: 1` (the flight payload), from Greece; the testing Worker on the PR's build before the merge, prod at 1.0.225 before and after each deploy.

**A — the changelog on pages of its own releases (#1108):** `/changelog` lists the releases with the newest release's 30 newest updates inline; every release has a page of its own (`/changelog/<label slug>`, prerendered at build, listed in the sitemap from a bundled release index).

| page | before (html · gzip · flight) | after, testing | after, prod |
|---|---|---|---|
| /changelog | 2,127,898 · 172,469 · 1,089,877 | 163,003 · 17,652 · 81,179 | 163,229 · 17,576 · 81,292 |
| /changelog/lights-out | 404 | 456,152 · 35,102 · 233,853 | 459,681 · 35,308 · 235,689 |
| /changelog/the-finishing-pass | 404 | 381,498 · 36,765 · 193,082 | 381,498 · 36,739 · 193,082 |
| /changelog/first-light | 404 | 49,925 · 11,206 · 22,475 | 49,925 · 11,193 · 22,475 |
| /changelog/no-such-release | 404 | 404 · 23,492 | 23,535 · 6,482 · 17,993 (404) |

**B — the results tabs: the latest round open, the earlier rounds one line each (#1109):** the latest round keeps its accordion, open; every earlier round is one line with "Classification →" to the race session page where that page can answer (F1, the class series, the series of `RACE_SESSION_SERIES`); a round without such a page keeps its closed accordion.

| tab | before | after, testing | after, prod |
|---|---|---|---|
| /series/nascar-cup/results | 2,383,067 · 59,230 · 1,276,083 | 2,162,042 · 56,515 · 1,157,139 | 2,161,913 · 55,964 · 1,157,139 |
| /series/motogp/results | 1,262,093 · 43,522 · 676,610 | 190,816 · 17,181 · 96,536 | 191,547 · 17,048 · 96,536 |
| /series/f1/results | 756,661 · 29,954 · 401,266 | 146,401 · 16,593 · 73,185 | 146,831 · 16,502 · 73,185 |
| /series/wec/results | 530,384 · 25,878 · 277,386 | 161,970 · 18,096 · 81,137 | 162,228 · 18,002 · 81,137 |
| /series/imsa/results | 481,653 · 28,475 · 249,709 (testing) | 145,095 · 17,275 · 71,892 | 145,482 · 17,233 · 71,892 |
| /series/gt-world/results | 1,146,361 · 46,684 · 600,214 (testing) | 282,585 · 20,990 · 143,538 | 283,574 · 20,590 · 143,538 |
| /series/f2/results | 1,173,920 · 39,360 · 625,210 (testing) | 219,925 · 18,355 · 112,229 | 220,570 · 18,245 · 112,229 |
| /series/indycar/results | 867,764 · 30,072 · 464,564 | 826,895 · 29,795 · 442,454 | 826,895 · 29,417 · 442,454 |
| /series/dtm/results | 590,622 · 27,357 · 313,405 | 590,982 · 27,954 · 313,680 | 590,939 · 27,564 · 313,680 |
| /series/wrc/results | 351,617 · 21,157 · 182,961 | 351,864 · 21,502 · 183,176 | 351,864 · 21,199 · 183,176 |

NASCAR, IndyCar and WRC name their race sessions by event and DTM's session page has no per-race source, so their rounds keep the accordion and their tabs their weight: a follow-up (B2, the weekend's main session as the race for NASCAR and IndyCar in the session page's classification rule) awaits the operator's word.

**C — the calendar's payload (#1110):** each entry carries its round and a short key; the round map keyed by the feed's ids and the ICS uids left the flight payload.

| page | before | after, testing | after, prod |
|---|---|---|---|
| /calendar | 544,891 · 54,510 · 454,014 | 442,552 · 43,456 · 352,739 | the cache’s previous entry still served at 06:30Z (544,934; the ISR window was counting down, the new Worker renders it next); measure again next session |

The plan's estimate for the calendar (a flight under 300 kB, the HTML under 400 kB) was optimistic by about 50 kB: the uids ran shorter than assumed and the rest is the sessions' own fields, which the views read. A further cut, not built: a table of the fifteen series referenced by index from each entry, about 60 kB more.

**The deploy window on prod:** the first request of /changelog after the deploy answered with the release list (the populate had landed before the switch); the measurement above is the request that followed.

**PSI:** the API's daily quota was spent on the anonymous key during the build; the operator's pagespeed.web.dev runs on mobile for `/changelog`, `/series/nascar-cup/results` and `/calendar` are the before-and-after Lighthouse record (the operator's home runs of 2026-10-01 00:11 local: 68 on mobile, 89 on desktop, the gap the emulated phone on slow 4G and the lead image).

---

## 2026-09-30 — X7: the session pages and the designer-made pages join the edge cache (1.0.224)

Two route families had never been in the cache: every session page (`/series/<slug>/weekend/<round>/<session>`) and every page the catch-all serves (`/calendar`, `/news`, a row page made in the designer). Both answered `Cache-Control: private, no-cache, no-store` and rendered per visitor. The cause was not a hidden request API but a missing export: a route without `generateStaticParams` is rendered dynamically whatever the page does, and the prerender manifest that OpenNext's cache interception keys on listed neither route. 1.0.224 adds `revalidate = 300` and an empty `generateStaticParams` to both (the drivers' and weekend pages' model) and drops the session route's `force-dynamic`.

**Method:** `curl -s -o /dev/null -D - -w '%{time_starttransfer}'`, twice per page in a row, from Greece; the first request the render (or a cold cache), the second the cache hit; the headers quoted are `cache-control` and `x-opennext-cache`. The testing Worker ran the PR's build before the merge; prod was measured at 1.0.223 just before the merge and at 1.0.224 right after the deploy (20:35Z, the first visit of each page on the new Worker).

**Testing Worker (testing.paddock-tracker.com), before → after:**

| page | before: cache-control · #1 → #2 | after: cache-control · #1 (cold, the populate running) → #2 | steady state, both HIT |
|---|---|---|---|
| /series/f1/weekend/15/qualifying | private, no-cache, no-store · 4.87 s → 2.28 s | s-maxage=300 · 12.10 s → HIT 0.25 s | 1.21 s → 0.19 s |
| /series/wec/weekend/6/6-hours-of-fuji-race | private, no-cache, no-store · 0.48 s → 0.27 s | s-maxage=300 · 3.57 s → HIT 1.41 s | 0.24 s → 0.22 s |
| /series/dtm/weekend/6/race-1 | private, no-cache, no-store · 0.54 s → 0.40 s | s-maxage=300 · 2.72 s → HIT 0.96 s | 0.18 s → 0.20 s |
| /calendar | private, no-cache, no-store · 3.06 s → 1.48 s | s-maxage=300 · 4.16 s → HIT 0.46 s | 0.29 s → 0.58 s |
| /news | private, no-cache, no-store · 0.71 s → 1.23 s | s-maxage=300 · 3.18 s → HIT 0.22 s | 0.43 s → 0.67 s |
| /history/monza (a 404 on the testing host) | private, no-cache, no-store · 0.26 s → 0.26 s | private (the 404's first render) 0.76 s → HIT 0.20 s | 0.22 s → 0.21 s |

**Prod (paddock-tracker.com), before (1.0.223, ~20:20Z) → after (1.0.224, ~20:35Z):**

| page | before: cache-control · #1 → #2 | after: cache-control · #1 (the first render on the new Worker) → #2 |
|---|---|---|
| /series/f1/weekend/15/qualifying | private, no-cache, no-store · 4.03 s → 0.54 s | s-maxage=300 · 3.28 s → HIT 0.33 s |
| /series/wec/weekend/6/6-hours-of-fuji-race | private, no-cache, no-store · 0.66 s → 0.53 s | s-maxage=300 · 5.29 s → HIT 0.36 s |
| /series/dtm/weekend/6/race-1 | private, no-cache, no-store · 0.69 s → 0.53 s | s-maxage=300 · 2.87 s → HIT 0.38 s |
| /calendar | private, no-cache, no-store · 4.05 s → 2.97 s | s-maxage=300 · 3.94 s → HIT 0.40 s |
| /news | private, no-cache, no-store · 1.07 s → 1.05 s | s-maxage=300 · 1.87 s → HIT 0.42 s |
| /history/monza (a 404 on prod too: the row page lives in the local design store alone) | private, no-cache, no-store · 0.26 s → 0.24 s | private (the 404's first render) 0.79 s → HIT 0.36 s |

**What to expect over time:** each of the ~1,800 session pages and every designer-made page renders once per five-minute window while visited, instead of once per visitor; the first visitor of a window pays the render (the OpenF1 analyses on an F1 page: 1–4 s, the first render on a fresh Worker slower still), everyone else in the window gets the edge answer (0.2–0.6 s). A not-found address under the catch-all is cached for the window as the drivers' are. Seobility's 1,813 medium-response pages and its 88 crawl errors (the per-request renders under its load) are the numbers to re-read on the operator's next crawl.

**Known and accepted (the plan's defaults, recorded in the ledger's X7 slot):** the five-minute window for sessions, no per-request exception for a running session; a single-page publish does not revalidate that page's `/__view/<state>/<path>` variants (up to 300 s stale); the FIA WEC `no-store` POST is reached only on an unseeded `results:wec` snapshot key, so that one render stays dynamic until the loader seeds the key.

---

## 2026-09-28 — R13 PR C2 measured on the testing Worker: OpenNext's cache interception

The Worker's answer, the second lever of the plan of 2026-09-28. `enableCacheInterception: true` in open-next.config.ts, built here with `DATA_SOURCE=db npm run cf:build` (without the variable in the build's environment the home's loaders fetch upstreams with no-store and `/` leaves the prerender manifest as a dynamic route, which the interceptor never touches; prod's build carries it, so `/` is ISR there: its prefetch payload is the full page, 125,921 bytes) and deployed to testing.paddock-tracker.com at 14:34Z (version f555ad91; the populate wrote 11,755 entries by 14:47Z under the testing prefix). The interceptor answers a page the prerender manifest knows (`/`, `/blog`, `/series/<slug>`, `/drivers/<slug>`, the archive and information pages) from the incremental cache in the routing layer, after the middleware and before Next's server; its answers carry `x-opennext-cache: HIT|STALE` and no `x-nextjs-cache`.

Twenty interleaved fetches from here, one second apart, testing against prod (curl, TTFB in seconds):

| Page | Testing (intercepted) p50 / p90 / max | Prod p50 / p90 / max | Prod's cache header |
|---|---|---|---|
| `/` (20 each) | 0.194 / 0.317 / 1.540 | 0.222 / 1.705 / 1.899 | 19 HIT, 1 STALE |
| `/series/f1` (10) | 0.212 / 2.546 / 2.546 (the first a MISS) | 0.390 / 0.871 / 0.871 | 8 HIT, 2 STALE |
| `/blog` (10) | 0.211 / 0.380 / 0.380 | 0.348 / 0.407 / 0.407 | 9 HIT, 1 STALE |
| `/calendar` (5, not interceptable) | 1.762 / 2.139 / 2.139 | 2.427 / 2.480 / 2.480 | none; `private, no-cache, no-store` |

The cold answer (the first request after the isolate went idle): 2.96 s at 14:48Z (13 minutes idle after the populate, `x-opennext-cache: HIT`) and 3.52 s at 15:03Z (11 minutes idle, STALE); the next request to `/calendar` 2.22 s and to `/` again 1.57 s (the queued revalidation of `/` in flight). The cold cost is the isolate's start of a 39 MB Worker and the first read of the cache, not Next's render: interception does not move it, and it is the cost Seobility met after a deploy (2.17 s).

The middleware on an intercepted page, checked on testing: `/calendar?series=f1` answers the filtered page through the `/__view` rewrite (200, 549,132 bytes against the plain page's 549,084); an `RSC: 1` request of `/` gets the RSC payload from the interceptor (`text/x-component`, 125,921 bytes, `x-nextjs-prerender: 1`); the router's prefetch of `/blog` is the same 95,202 bytes as prod's; a request with a bogus session cookie answers 200 with no Set-Cookie (the middleware ignores it either way); plain http on the testing host answers 200 as before (the R13 redirects name the apex only). The middleware's headers ride on an intercepted answer by the routing handler's own code (`applyMiddlewareHeaders` before the early return, @opennextjs/aws 4.1.0 routingHandler.js).

**What this says:** the cached pages answer a little sooner and far steadier (the home's p90 from 1.7 s to 0.3 s: a stale entry is served at once and revalidated behind, where Next's own path waited); the cold start stays; the `/calendar` control, which neither Worker can intercept, answers about 27% faster on testing than on prod at every percentile (p50 1.76 against 2.43), so part of the home, series and blog gap is a testing-versus-prod offset (the isolate's warmth, the path) rather than interception alone, and the real read is prod's own before and after once switched; the catch-all's pages (`/calendar`, `/news`) render per request at 1.5–2.5 s with `no-store`, although their rows say `cached` and the registry does too: the next lever, and a Debug-trace question of its own (in IDEAS). The prod switch is the operator's word; the dry run stood at 39235.19 KiB (gzip 8533.75).

**On prod (1.0.203, merged 18:26:52Z, live by 18:31Z; twenty fetches of the home and ten of three pages at 18:32–18:36Z):** the home answers `x-opennext-cache: HIT` with no `x-nextjs-cache`; `/` p50 0.215 s, p90 0.365, max 0.378 (the same afternoon before the switch: 0.222 / 1.705 / 1.899); `/series/f1` p50 0.355 (the first fetch a MISS at 2.4 s, the deploy's fresh cache); `/blog` p50 0.340; `/calendar`, not interceptable, p50 2.51 and p90 4.10 either way. The tail is what interception removed; the median was never the problem. The catch-all's per-request pages stay the next lever (IDEAS).

Raw: the session's scratchpad, `c2-ttfb-*.txt`, `c2-prod-after.txt`, `c2-deploy-testing.txt` (not committed).

## 2026-09-28 — the home on 1.0.201, after R13's PR C1 (the covers at the size their boxes need)

Run here at ~14:09Z, four minutes after the 1.0.201 deploy (#1083, merged 14:01Z), the same `npx lighthouse@12` through Playwright's Chromium as the baseline below, mobile and desktop, performance only. The page cache was warm (this machine's curl checks of the deploy came first), so the server-response row is the warm case, not the baseline's cold one; the cold case is C2's measurement.

| Metric | Mobile (Moto G Power, slow 4G sim) | Desktop |
|---|---|---|
| **Performance** | **68** (was 56) | **82** (was 74) |
| FCP | 2.0 s | 1.0 s |
| LCP | 11.7 s (was 13.6 s) | 2.8 s (was 3.7 s) |
| TBT | 95 ms (was 290 ms) | 0 ms |
| CLS | 0.124 | 0.004 |
| Speed Index | 3.2 s (was 6.5 s) | 1.3 s (was 2.4 s) |
| Server response (root document, warm cache) | 344 ms | 345 ms |
| Requests / total transfer | 62 / 2,183 KiB (was 75 / 19,419 KiB) | 73 / 2,599 KiB (was 85 / 20,112 KiB) |
| Images / transfer | 2 / 897 KiB | 6 / 1,306 KiB |
| JavaScript files / transfer | 21 / 734 KiB | 22 / 718 KiB |
| Unused JavaScript | 314 KiB | 315 KiB |
| Main-thread work / bootup | 2.1 s / 0.8 s | 0.5 s / 0.1 s |

**The LCP element, both runs:** the lead story's cover again, now `…/commons/thumb/7/76/Baku-F1-Street-Circuit-Openstreetmaps-rev1.png/960px-…png` at 896 KiB: the newest post's cover is a PNG map (a 1.1 MB original), and a PNG stays a PNG at Wikimedia's thumbnail service (252 KiB at 500, 896 KiB at 960). The mobile LCP's phases: TTFB 0.6 s, load delay 4.1 s, load time 6.5 s (the 896 KiB on the simulated 1.6 Mbps), render 0.5 s. A JPEG of the same map would be about a tenth; the cover's file is an editor's choice (in IDEAS), not this slot's.

**Seen in the desktop run's requests:** three 500 px covers the home never draws (the Baku map, the SkySat and the Tsolov covers, 372 KiB): the router prefetches /blog from the header's link, and React's Flight payload carries a preload hint for every eager `<img>` (the blog list's lead and its two eager rows), which the client preloads. Before this PR the same prefetch preloaded the originals. In IDEAS: the rows lazy from the second when a lead cover exists, or the link's prefetch on hover.

**What C1 changed, in the numbers:** the transfer 19.4 MB → 2.2 MB on mobile and 20.1 → 2.6 MB on desktop; "Properly size images" from the top opportunity to 424 KiB (the PNG); the Speed Index halved; the mobile LCP 13.6 → 11.7 s only, the PNG holding it; TBT 290 → 95 ms. **Next, C2:** the Worker's answer (OpenNext's cache interception on the testing Worker first), then the cold-cache server response measured again.

Raw reports: the session's scratchpad, `lh-c1-mobile.json` and `lh-c1-desktop.json` (not committed).

## 2026-09-28 — the home on 1.0.199, a Lighthouse 12 baseline for R13's PR C (the SEO check's response time)

Run here at ~09:24Z, four minutes after the 1.0.199 deploy, with `npx lighthouse@12` against `https://paddock-tracker.com/` through Playwright's Chromium (the PageSpeed API's keyless daily quota was spent by then; the operator's pagespeed.web.dev run stays the better lab number and belongs in this file when they paste one). The first request after a deploy meets a cold page cache (`s-maxage=300, must-revalidate`, no stale-while-revalidate), so the server-response numbers below are the cold case, the one Seobility met (2.17 s); warm hits from the same machine by curl measured 0.20–0.48 s an hour earlier.

| Metric | Mobile (Moto G Power, slow 4G sim) | Desktop |
|---|---|---|
| **Performance** | **56** | **74** |
| FCP | 2.2 s | 0.9 s |
| LCP | 13.6 s | 3.7 s |
| TBT | 290 ms | 0 ms |
| CLS | 0.125 | 0.004 |
| Speed Index | 6.5 s | 2.4 s |
| Server response (root document) | 2,150 ms | 1,640 ms |
| Requests / total transfer | 75 / 19,419 KiB | 85 / 20,112 KiB |
| JavaScript files / transfer | 20 / 734 KiB | 21 / 751 KiB |
| Unused JavaScript | 316 KiB | 315 KiB |
| Main-thread work / bootup | 4.1 s / 1.2 s | 0.9 s / 0.2 s |

**The LCP element, both runs:** the lead story's cover, `https://upload.wikimedia.org/wikipedia/commons/7/76/Baku-F1-Street-Circuit….jpg`, the original upload, not a thumbnail. Lighthouse's opportunities in order: "Serve images in next-gen formats" (4,860 ms mobile / 1,020 ms desktop), "Properly size images" (3,320 / 1,120 ms), "Reduce initial server response time" (2,151 / 1,641 ms), "Reduce unused JavaScript" (710 ms mobile). Nineteen to twenty megabytes of transfer for the home is the covers: the posts' hero images are Wikimedia originals (several megabytes each) drawn at 1200 px wide at most.

**The levers for PR C, in the order of the numbers:**
1. The covers' size: a Wikimedia original (`/wikipedia/commons/<a>/<ab>/<File>`) drawn through Wikimedia's own thumbnail service (`/wikipedia/commons/thumb/<a>/<ab>/<File>/1200px-<File>`, the width the layout needs; JPG and PNG), at the one place the posts' hero URL is read for the lead, the thumbnails and the cards; the same for the blog pages. No dependency, no proxy; a fallback to the original when a URL is not a Commons original. Expected: the transfer from ~20 MB to under 2 MB and the LCP from 13.6 s toward the 2.5 s target on mobile.
2. The server response on a cold cache: Next 16's `expireTime` (a stale-while-revalidate on ISR answers, Next core's `getCacheControlHeader`) so a visitor at expiry gets the stale page while the Worker revalidates; its effect on OpenNext's R2/regional cache to be tested on the testing Worker before prod, never assumed; then the home's own cold render cost (its source reads, timed with the Debug trace).
3. Unused JavaScript, 316 KiB: the home's client chunks (the Live band's countdown, the consent and analytics scripts, the developer toolbar's chunk for a signed-out reader?) listed from the report's `unused-javascript` items before any is touched.
4. CLS 0.125 on mobile: the cover's reserved box or a late font; from the report's `layout-shift-elements` before any change.

Raw reports: the session's scratchpad, `lh-home-mobile.json` and `lh-home-desktop.json` (not committed; 1.5 MB each).


## 2026-05-19

First baseline capture. Site is 4–5 days from public launch; Track A + 11 of ~18 Track B bundles shipped today (versions 0.10.23 → 0.10.34, 14 PRs). B-perf hasn't started yet — these are pre-work numbers.

### Vercel Speed Insights — Real Experience Score, last 7 days (May 13–19)

| Metric | Desktop | Mobile |
|---|---|---|
| **RES** | **95** (Great) | **76** (Needs Improvement) |
| FCP | 2.2 s | 3.67 s |
| LCP | 2.34 s | 3.67 s |
| INP | 48 ms | 80 ms |
| CLS | 0.06 | 0.11 |
| FID | 2 ms | 28 ms |
| TTFB | 1.63 s | 3.17 s |

**Routes — desktop, by RES bucket:**
- Great (≥ 90): `/series/[slug]` 100 (192 visits), `/changelog` 99 (31), `/impressum` 100 (25), `/series/[slug]/weekend/[round]` 100 (23), `/imprint` 100 (16), `/calendar` 97 (16), `/about` 99 (8).
- Needs Improvement (50–90): `/` **73** (211 visits) ← desktop offender.

**Routes — mobile:**
- Great: `/series/[slug]` 99 (41 visits), `/settings` 97 (18), `/calendar` 95 (4).
- Needs Improvement: `/` **67** (159 visits) ← mobile offender (same route on both platforms).

**Countries — desktop poor (RES < 50):**
- USA — 43 (91 visits)
- France — 36 (11)
- Germany — 35 (9)

**Countries — mobile poor:**
- France — 33 (3 visits)
- Philippines — 34 (3)

### PageSpeed Insights — desktop lab

**LCP critical path:** max 2,037 ms. Two CSS bundles block render to ~1.9–2.0 s:
- `paddock-tracker.com` — 1,187 ms (41.98 KiB)
- `css/d397e6bd08c1deec.css` — 2,037 ms (19.77 KiB)
- `css/9dae90f238ec9279.css` — 1,913 ms (1.63 KiB)

**Preconnect:** zero origins preconnected. Candidate: `clerk.paddock-tracker.com` → est. 90 ms LCP saving.

**Reduce unused JavaScript — total est. savings 616 KiB:**

| Bucket | Transfer | Unused | % of budget |
|---|---|---|---|
| Clerk SDK (1st-party via subdomain) | 288.4 KiB | 224.4 KiB | 36% |
| Other 1st-party chunks (`1270` / `4bd1` / `5838`) | 160.3 KiB | 72.6 KiB | 12% |
| AdSense (`show_ads_impl` + `adsbygoogle`) | 226.5 KiB | 157.2 KiB | 26% |
| Google FundingChoices (CMP) | 137.4 KiB | 97.8 KiB | 16% |
| Google Tag Manager | 154.3 KiB | 64.1 KiB | 10% |

Three Google scripts together = **52% of the unused-JS budget**. Clerk alone = **36%**.

**Long main-thread tasks:** 7 found (cut off at bottom of PSI screenshot — re-capture for full list next snapshot).

**Performance score:** not captured in screenshots this session — recapture.

### PageSpeed Insights — mobile lab

- **Best Practices:** 81
  - Failing: AdSense `lidar.js` uses deprecated `unload` event listeners (3rd-party — no action available).
  - Failing: Touch targets too small — footer links Release notes / Cookies / About / Accessibility / Imprint (`<a class="hover:text-text transition-colors duration-(--duration-fast)">`).
- **Accessibility:** 90
  - Failing: button without accessible name — mobile-header Coffee button (`<button class="inline-flex items-center gap-1.5 ..." >`). Needs `aria-label="Buy me a coffee"`.
- **Performance:** **not captured this snapshot.** Audit-doc pre-A4b values: Perf 39 / LCP 5.2 s / TBT 5340 ms / 661 KiB unused JS. Treat as stale until re-measured post-`0.10.27` ISR.

---

## 2026-06-21 — `/app` restored to static/ISR (0.37.1)

Lab / curl evidence; **field numbers pending** (capture PSI + Vercel SI ≥24–72 h post-deploy and append).

- **Build:** `/app` was `ƒ` (Dynamic) → now `○` (Static, 5 m ISR). Root cause: slice-2's JUST MISSED WEC podium triggered a `no-store` live-component fetch in the page render, forcing the whole route dynamic (`Cache-Control: private, no-store`, `X-Vercel-Cache: MISS`).
- **Prod TTFB before fix:** cold **~19.7 s**, warm ~1.0 s (vs `/calendar` 0.79 s — both ISR; `/calendar` + marketing edge-cache as `STALE`/`HIT`). After: `/app` should serve from edge cache like they do.
- **Fix:** JUST MISSED → CDN-cached route handler (`/api/just-missed`, `s-maxage=300`), client-fetched; the WEC live fetch + podium fan-out run off the static page path.
- **Still open:** content pages (`series/[slug]`, `weekend`, `[session]`, `drivers`, `teams`) remain `force-dynamic` — next caching PR. JS levers (Clerk ~224 KB for anon, AdSense/GTM `afterInteractive`) unaddressed.

## 2026-06-21 — pre-launch audit verification (prod 0.38.3)

Read-only prod verification of last session's PRs #145–#153 (caching / home-v3 / WeekendMedia / JS-defer). **All four areas pass.** Field RES re-baseline still **pending** — Vercel SI lags 24–72 h behind the #148/#150/#153 deploys; capture + append per the protocol below once settled.

**Edge-cache, verified on prod (`curl`, 2 passes each):** `/app`, `/series/f1/weekend/7`, `/drivers/*`, `/teams/*` all return `X-Vercel-Cache: STALE`/`HIT`/`MISS→HIT` with ISR headers (`public, max-age=0, must-revalidate`). **None are `no-store`/dynamic** — the #148 `/app` un-regression and #150 weekend/driver/team ISR are live and holding. Warm TTFB 0.21–0.32 s.

**`/api/just-missed` cold-start tail:** warm `HIT` 0.44 s, but **cold-on-cold MISS = 13.8 s** (vs the `/app` page itself now fast + static). Cause: the route fans out to full season-results fetchers (WEC live-component + MotoGP "re-fetches every round, no parser-level cache") whenever *both* its edge cache and the per-series `paddock:home:podium:*` KV cache are cold. Already mitigated for the common case (static page + lazy client-fetch + `s-maxage=300, swr=600` + KV podium cache) so the tail is rare; logged to IDEAS Inbox (fix candidates: cache-warm cron, or MotoGP parser-level cache).

**`/app` lab warm-load (Chrome PerformanceAPI, desktop 1440, reload):** TTFB 104 ms · FCP 312 ms · DCL 199 ms · load 326 ms · 76 requests (35 JS). `transferSize`/LCP not reliable from this capture (disk-cache + cross-origin TAO zero out bytes; LCP buffer empty) — byte/LCP numbers must come from PSI.

**GA4 after #153 `lazyOnload` (the key risk):** `googletagmanager.com/gtag/js?id=G-DDMJ2NMBWC` → 200; `window.gtag` is a function with a populated `dataLayer`; two `POST region1.google-analytics.com/g/collect …en=page_view` → **204** hits fired. Fresh visitor is in consent-**denied** mode (`gcs=G100`, `npa=1`, cookieless ping, no `_ga`) — correct Consent Mode v2 behavior. **`lazyOnload` did not break GA** (loads later, still fires). Custom CookieConsent modal is the active CMP (footer "Manage cookies" present; no Funding Choices UI). Consent-grant flip is unchanged by #153 (last verified 0.12.7).

**Console:** 0 errors on `/app` at both 390 and 1440 (1–2 benign warnings).

## 2026-06-23 — weekend page tabbed, heavy content deferred (0.61.0)

The race-weekend page (`/series/[slug]/weekend/[round]`, `● ISR`) was server-rendering everything on every cold render: schedule + weather + the standings **season-results fan-out** + the news feed. Now split into client tabs (Schedule | Bets | News | Sessions) — only Schedule (+ weather) renders with the page; the rest mount + fetch on first tab-open from cached route handlers (`/api/weekend/{news,standings}`, `s-maxage=300`).

**Local dev, F1 R8 (compiled, single render — dev has no ISR cache, so this is the raw per-render server cost):**
- **Page render: 0.66 s** (previously also paid standings + news inline).
- Deferred `/api/weekend/standings` cold: **3.1 s** (the season-results fan-out) — now only paid when the Sessions tab is opened.
- Deferred `/api/weekend/news` cold: 0.74 s — only on the News tab.
- Page HTML no longer contains the standings table (`"Standings at this round"` 0×) — deferral confirmed; page stayed `●` (ISR), not dynamic.

Net: a cold weekend page sheds ~**3–4 s** of upstream fan-out off its render path; the page stays ISR-cacheable and the deferred APIs are independently CDN-cached. **Field numbers pending** — capture PSI + Vercel SI ≥24 h post-deploy and append.

## 2026-07-09 — field re-baseline (Vercel Speed Insights, last 7 days Jul 2–9)

First field snapshot since the caching + defer work landed. **Both platforms improved on RES and TTFB vs the 2026-05-19 baseline, but CLS regressed on both and is now the primary systemic issue.**

| Metric | Desktop | Mobile | vs 2026-05-19 |
|---|---|---|---|
| **RES** | **98** (Great) | **81** (Needs Improvement) | ↑ from 95 / 76 |
| FCP | 1.35 s | 2.22 s | ↑ both |
| LCP | 1.91 s | 3.58 s | mobile still > 2.5 s target |
| INP | 40 ms | 72 ms | passing |
| **CLS** | **0.12** | **0.16** | ↓ **regressed** (was 0.06 / 0.11) — both now > 0.1 |
| FID | 3 ms | 31 ms | passing |
| TTFB | 0.59 s | 1.55 s | ↑↑ big win (was 1.63 / 3.17 s) |

**Headline:** the mobile TTFB collapse (3.17 → 1.55 s) validates the ISR/caching work. **CLS is the new offender — 0.12 desktop / 0.16 mobile, both above the 0.1 threshold and both worse than May.** It is the single systemic Core Web Vital to attack next.

**Routes — desktop:** Great: `/` 100 (141), `/blog` 100 (44), `/changelog` 100 (34), `/app` 94 (126), `/settings` 99 (15), `/series/[slug]/weekend/[round]` 96 (11), `/about` 100 (7). Needs Improvement: `/series/[slug]` 88 (21), `/calendar` 84 (6), `/settings/customize` 79 (9), `/settings/series` 75 (5), `/series/[slug]/[tab]` 55 (12). Poor: `/blog/[slug]` 48 (16), `/series/[slug]/weekend/[round]/[session]` 38 (8), `/social` 30 (10), `/sign-in` 30 (8), `/settings/notifications` 25 (3), `/drivers/[slug]` **1** (3 visits — outlier).

**Routes — mobile:** Great: `/changelog` 100 (25), `/` 97 (17), `/blog/[slug]` 100 (6), `/series/[slug]` 100 (4). Needs Improvement: `/app` 85 (56), `/drivers/[slug]` 88 (11), `/play` 78 (9), `/blog` 75 (8), `/series/[slug]/[tab]` 64 (14), `/series/[slug]/weekend/[round]` 55 (18), `.../[session]` 70 (7). Poor: `/feedback` 40 (7).

**Countries:** desktop — China 80 (3). Mobile — China 48 (6, Poor).

**Sample-size caveat:** the scary desktop "Poor" routes all have 3–16 visits, so one slow load skews them (`/drivers/[slug]` = 1 from 3 visits, yet mobile is 88). Reliable systemic signals: **CLS (both)** and secondarily **mobile LCP 3.58 s / TTFB 1.55 s**.

**→ NEXT-SESSION CLS hunt (queued).** CLS regressed since May. Suspects: (a) images/embeds without reserved `width`/`height` (May plan already flagged the Wikipedia History-tab `<img>`, rank 5); (b) late-injected UI shifting content — the Race Engineer chat launcher, banners; (c) web-font swap; (d) recently-added on-page bylines / enriched blocks. **PSI lab not captured this snapshot** — grab PSI desktop+mobile at the start of the CLS session for layout-shift attribution.

## 2026-08-03 — post-Cloudflare re-baseline (0.252.1 live during capture; first row of the Workers era)

First snapshot since the Vercel → Cloudflare migration (07-26/27). **Field source is GONE** (Vercel Speed Insights dep removed 0.245.1) — PSI reported "Discover what your real users are experiencing: No Data". **Replacement decision: Cloudflare Web Analytics RUM is ALREADY collecting** (this very report shows `static.cloudflareinsights.com/beacon.min.js` on the page), so the CF dashboard becomes the field source going forward; GSC CWV as the slow-moving cross-check.

### PSI lab — `/` (operator-run, pagespeed.web.dev, Lighthouse 13.4.1)

| Metric | Mobile | Desktop |
|---|---|---|
| **Performance** | **71** | **78** |
| FCP | 1.7 s | 0.5 s |
| **LCP** | **15.3 s** | 3.3 s |
| TBT | 60 ms | 20 ms |
| CLS | **0** | **0** |
| Speed Index | 4.9 s | 2.0 s |
| Accessibility | 96 | 100 |
| Best Practices | 96 | 96 |
| SEO | 100 | 100 |

**The May CLS problem is GONE (0 on both)** and TBT/unused-JS collapsed vs the May row (mobile TBT 60 ms; unused JS 616 KiB → 164 KiB — AdSense/GTM lazyOnload + the Cloudflare stack did their job; the only 3rd party left on the critical path is the 11 KiB CF beacon).

**The whole story is now ONE problem: the landing carousel images.** LCP breakdown (mobile): TTFB 10 ms · resource load 100 ms · **resource load delay 1,510 ms + element render delay 5,650 ms**. Causes, all in the landing hero/marquee carousel:
1. `/landing/circuits/*.jpg` are raw JPEGs totalling **4,112 KiB** (monaco 979 KiB, nordschleife 743, rally-finland 638…) served via `images: unoptimized` at ~1900px for ~500-700px slots. PSI est. savings **3,684-3,925 KiB** (WebP/AVIF + responsive sizes).
2. The LCP image is **`loading="lazy"`** and mounts at **`opacity-0`** with a 700 ms fade (`transition-opacity duration-700 … opacity-0`) — LCP counts the paint at full visibility, so the fade + lazy discovery alone add ~5.6 s of render delay.
3. No `fetchpriority="high"` / preload on the first slide; zero preconnects (fine — everything is 1st-party now).

**Queued fix bundle (one PR, est. mobile LCP 15.3 s → ~2.5-3 s):** convert the seven circuit JPEGs to properly-sized WebP (~150-250 KiB each), eager-load + `fetchpriority="high"` the first visible slide only, start slide 1 at full opacity (keep the fade for subsequent slides), add `sizes`. Cosmetic extras from the report: carousel dot touch-targets (a11y 96 mobile), the two non-composited `width` dot animations, `Array.prototype.at`-class polyfills (13 KiB legacy JS).

**Security headers flagged by PSI** (Best Practices 96): CSP is still report-only (by design — the promote-to-enforcing plan lives in `next.config.ts`), no COOP header. Unchanged since the audit; listed here so the trend row exists.

Context for trend readers: this row is NOT comparable to Vercel-era rows for TTFB/route-level RES (different platform, different field source, R2 ISR cache since 0.241.0). Treat 2026-08-03 as the new epoch line.

## 2026-08-06 — the landing-LCP delta row (0.267.1 live; 3 days after the 0.254.0 image bundle)

Operator-run PSI (pagespeed.web.dev, Lighthouse 13.4.1, Moto G Power / slow-4G mobile, captured 10:52 GMT+3). Field data still "No Data" (CrUX threshold — traffic, not tooling; CF RUM keeps collecting).

| Metric | Mobile | Desktop | vs 08-03 |
|---|---|---|---|
| **Performance** | **81** | **96** | 71 / 78 |
| FCP | 1.7 s | 0.5 s | 1.7 / 0.5 |
| **LCP** | **4.9 s** | **1.3 s** | **15.3 / 3.3** |
| TBT | 30 ms | 90 ms | 60 / 20 |
| CLS | 0 | 0 | 0 / 0 |
| Speed Index | 3.3 s | 1.2 s | 4.9 / 2.0 |
| Accessibility | 96 | 96 | 96 / 100 |
| Best Practices / SEO | 96 / 100 | 96 / 100 | unchanged |

**The 0.254.0 bundle worked: mobile LCP 15.3 s → 4.9 s (−68%), desktop 3.3 → 1.3 s** — short of the ~2.5-3 s estimate, and the report says exactly why the tail remains:

1. **The first-slide `opacity-0` fade still gates paint.** The LCP img in the report carries `fetchpriority="high"` AND `class="… opacity-0"` — the "start slide 1 at full opacity" part of the queued bundle didn't make it. Element render delay: 1,750 ms mobile / 5,480 ms desktop (desktop's number is inconsistent with its 1.3 s LCP metric — likely the fade-completion pass; recorded as reported). On mobile the LCP element is now the hero TEXT ("TRACKING 15 SERIES…"), i.e. the image has been demoted — good.
2. **`lemans.webp` is oversized for its slot**: 188.9 KiB at 1128-1275×853 for ~939×501 (mobile) / 596×318 (desktop) display. Est. savings 112 KiB mobile / 294 KiB desktop (incl. spa.webp 149 KiB → responsive `sizes`/srcset + a notch more compression).
3. Render-blocking CSS 23 KiB (820 ms on slow-4G mobile), 13 KiB legacy polyfills (`Array.prototype.at` class), 165 KiB unused JS in the shared chunks — all known shapes, smaller than before.

**Next lever bundle (small):** first-slide fade skip + `sizes` on the carousel images. Cosmetics re-flagged: carousel dot touch-targets (a11y 96), two non-composited `width` dot animations, CSP report-only / no COOP (unchanged, by design/backlog).

## 2026-08-24 — the admin clean-up bought back 653 KiB (0.334.27)

Deleting two read-only console pages moved the Worker from **19.35 KiB of headroom to 672.31 KiB** — 35× more room, and the single largest bundle change ever recorded here.

| | Gzipped | Spare against 10240 KiB |
|---|---:|---:|
| 0.334.24 (composer shipped) | 10220.65 KiB | 19.35 KiB |
| **0.334.27 (clean-up)** | **9567.69 KiB** | **672.31 KiB** |
| **Saved** | **652.96 KiB** | |

Removed: `/admin/traffic`, `/admin/search`, `/admin/tools`, `lib/analytics/{ga4,gsc,bing}.ts`, `scripts/verify-analytics.mts`, four dead `AdminUI` exports, and the `@google-analytics/data` + `@googleapis/searchconsole` dependencies.

**The saving is nearly double the 352 KiB estimated from chunk analysis**, because measuring the built chunks only counted what was attributed to those two routes — it missed the transitive `google-gax` / `@grpc` / `google-auth-library` trees that went with them. Worth remembering the next time a chunk measurement is used to size a removal: **it is a floor, not the answer.**

Why it was so expensive in the first place: both packages are **server** imports inside **server** components, so they land in the Worker script. Contrast `three` (25 MB installed), `recharts` (8.3 MB) and `leaflet` — all client-side behind `next/dynamic`, none of which touch the Worker at all.

## 2026-08-24 — Worker bundle ceiling, and how fast a published home layout goes live (0.334.24)

Two numbers this file did not previously carry. Both are operational ceilings rather than page metrics, and both were measured rather than assumed.

**Worker bundle — 19.35 KiB of headroom left.** `wrangler deploy --dry-run`, after the home composer:

| When | Gzipped | Spare against 10 MiB (10240 KiB) |
|---|---:|---:|
| 2026-08-21 (0.330.0) | 10176.64 KiB | 63.4 KiB |
| 2026-08-22 (0.333.1, session-32 close) | 10186.22 KiB | 53.8 KiB |
| **2026-08-24 (0.334.24)** | **10220.65 KiB** | **19.35 KiB (0.19%)** |

The jump is mostly `@dnd-kit`: it had been a dependency with **zero importers** since the 2026-08-18 orphan sweep deleted the home editor, so it was in `package.json` but never in the bundle. The composer's drag-to-reorder is its first real consumer. Operator decision to ship it with the number recorded (2026-08-24). **Measure before adding anything else** — `npm run deploy:testing` rejects harmlessly.

**Publishing a home layout appears within the ISR window, not the regional-cache window.** The open question was whether `withRegionalCache(..., { mode: "long-lived" })` in `open-next.config.ts:36` — which re-uses an ISR entry up to 30 minutes per region — would swamp `/app`'s 5-minute `revalidate`. It does not. Measured on prod by writing a published revision straight to `page_layout` and polling `/app` for the change:

| Change | Time to appear |
|---|---:|
| Pin a different lead post | 48 s |
| Revert to automatic | ~4 m 45 s |

Both **without** `revalidatePath`, so this is the natural ISR pickup and the honest worst case. The Publish button calls `revalidatePath('/app')` and should therefore be at or under these, but that path is unmeasured — it needs an admin session. The `revalidate = 60` fallback the plan held in reserve is **not needed**.

## 2026-08-20 — the PSI sweep: every major page (operator-run pagespeed.web.dev, Lighthouse 13.4.1; prod = 0.322.3 during capture)

First per-page lab baseline. Mobile = Moto G Power / slow-4G sim. The morning's landing-stream fix (0.321.2) had already landed; the sweep drove four fix packages: **#1 fonts 19→5 preloads + Redis-SDK-out-of-browser (0.322.4)** · **#2 tap targets + gtag/Clerk dispositions (0.322.5)** · **#3 standings chart CLS/defer + info-hub heading order (queued)** · **#4 LCP image pass + Serwist DataCloneError (queued)**. Re-measure the trio root/standings/weekend after #4 merges.

| Page | Perf M/D | LCP M/D | SI M/D | TBT M/D | CLS M/D | Page-specific finding → package |
|---|---|---|---|---|---|---|
| `/` | 76 / 94 | 6.3* / 1.2 s | 3.7 / 2.0 | 40 / 60 ms | 0 / 0 | Font over-preloading (19/660 KiB) → #1 SHIPPED |
| `/app` | 63 / 88 | 9.7* / 1.4 | 7.3 / 2.1 | 170 / 150 | 0 / 0 | Shared 3rd-party shell; footer targets → #2 SHIPPED |
| `/series/f1` | 59 / 94 | 9.8* / 1.4 | 8.1 / 1.5 | 190 / 50 | 0 / 0 | Shell only |
| `/series/f1/standings` | 41 / 84 | 10.4* / 1.4 | 7.8 / 2.5 | 650 / 200 | 0.134 / 0.011 | Trend chart mounts unreserved + 96 KiB chunk → #3 |
| `/series/f1/weekend/12` | 49 / 89 | 8.2* / 1.5 | 6.9 / 2.5 | 650 / 90 | 0.002 / 0.001 | Track-map SVG lazy LCP → #4 |
| `/series/f1/weekend/11/race` | 65 / 78 | 7.7* / 1.4 | 7.4 / 2.9 | 70 / 270 | 0.006 / 0.019 | force-dynamic TTFB 665 ms → unpark ISR with the AdSense enrichment |
| `/drivers/kimi-antonelli` | 67 / 91 | 8.5* / 1.5 | 6.9 / 2.1 | 90 / 0 | 0 / 0 | Wikimedia portrait lazy LCP + 171 KiB oversize → #4 |
| `/calendar` | 64 / 89 | 8.3* / 1.4 | 7.3 / 2.4 | 130 / 110 | 0.036 / 0 | Serwist DataCloneError → #4; contrast + grid targets = operator calls |
| `/blog/<post>` | 63 / 94 | 8.1* / 1.5 | 7.5 / 1.4 | 150 / 0 | 0 / 0 | Clean; shell only |
| `/information/formula-1` | 66 / 95 | 8.1* / 1.4 | 4.4 / 1.2 | 210 / 30 | 0 / 0 | Heading order → #3; still pre-Paper register |

*Mobile LCP metrics were inflated sitewide by the font-preload contention (each report's own breakdown summed far lower); 0.322.4 removes the cause. Constant across pages: ~615 KiB unused 3rd-party JS (Clerk-anon NO-GO documented in #745; AdSense kept pending re-approval; gtag already lazyOnload), CSP/COOP report-only by design, desktop Best-Practices 77s = Google's own lidar.js deprecation. Root same-day delta vs pre-0.321.2: mobile 69→76, desktop 88→94, SI 10.8→3.7 / 4.6→2.0, doc stream 7.1 s→1.96 s.

## Targets

| Metric | Field target (CWV pass) | Lab target (PSI green) |
|---|---|---|
| LCP | ≤ 2.5 s | ≤ 2.5 s |
| INP | < 200 ms | < 200 ms |
| CLS | < 0.1 | < 0.1 |
| TTFB | < 800 ms | < 800 ms |
| PSI Performance score | — | ≥ 90 |

### 2026-05-19 gap analysis

| Metric | Current (mobile) | Target | Gap |
|---|---|---|---|
| RES | 76 | 90 | 14 pts |
| LCP | 3.67 s | 2.5 s | 1.17 s |
| **TTFB** | **3.17 s** | **0.8 s** | **2.37 s** ← biggest lever |
| CLS | 0.11 | 0.1 | marginal |
| INP | 80 ms | <200 ms | passing |

Desktop is already green-ish (RES 95). Mobile `/` (RES 67) is the offender on both platforms. **Mobile TTFB 3.17 s is the biggest single number to attack** — points at server-rendering work + edge-cache hit rate + JS hydration cost on the home shell.

---

## Workstream priorities derived from these numbers

Cross-ref: `docs/HANDOFF.md` → Active workstream → Next-session pickup → B-perf. Sequenced plan: `SCHEDULE.md` Wed 2026-05-20 entry.

| Rank | Lever | Est. recovery |
|---|---|---|
| 1 | **Clerk lazy-load** on non-auth surfaces (keep `<ClerkProvider>` synchronous at root; `<UserButton>` + widgets via `next/dynamic`) | ~225 KiB unused JS |
| 2 | **Defer AdSense + GTM** via `next/script strategy="lazyOnload"`. Verify FundingChoices CMP runs first (consent gate). Optionally Partytown for GTM. | ~319 KiB unused JS, big TBT relief |
| 3 | **Preconnect `clerk.paddock-tracker.com`** | 90 ms LCP |
| 4 | **CSS critical-path** investigation (two CSS bundles blocking render to 2 s) | LCP down to <2.5 s target |
| 5 | **Wikipedia History tab `<img>`** — strip or lazy + width/height | CLS prevention |
| 6 | **B9 server-render** `<HomeContent>` / `<FilteredSessions>` / `<MonthScopedWeekends>` (separate bundle in HANDOFF) | Biggest LCP lever on `/` (RES 67/73) |

---

## Measurement protocol

When capturing a new snapshot:

1. **Vercel Speed Insights:** open `vercel.com/<org>/motorsport/speed-insights`, flip Desktop / Mobile, set range "Last 7 Days", screenshot. Capture RES + FCP / LCP / INP / CLS / FID / TTFB + per-route breakdown (Great + Needs Improvement) + per-country poor list.
2. **PSI desktop + mobile:** open `pagespeed.web.dev/?url=https://paddock-tracker.com/`. Capture Performance / Accessibility / Best Practices / SEO scores + the top 3 entries from Opportunities and Diagnostics. For Performance specifically capture LCP / INP / CLS / TBT + the LCP critical path + the unused-JS breakdown (1st-party + 3rd-party).
3. **Append a new dated subsection** to this file. Never overwrite prior rows. The trend matters more than the most recent number.
4. **Re-measure ≥ 24 h after a perf-relevant deploy** so Vercel SI field data has time to refresh. Lab numbers (PSI) are immediate; field numbers (Vercel SI / GSC CWV) lag by ~24–72 h.

When two rows diverge unexpectedly, suspect: (a) AdSense / GTM script-injection variance, (b) CDN cold-cache vs. warm-cache, (c) field-vs.-lab divergence is normal (different cohort, different network conditions).
