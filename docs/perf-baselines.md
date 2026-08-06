# Paddock — performance baselines

Time-series perf snapshot. **Append-only by date** — never overwrite prior rows; the trend is the point.

**Sources:**
- **Vercel Speed Insights** (field / Real Experience Score): `vercel.com/<org>/motorsport/speed-insights`
- **PageSpeed Insights** (lab / Lighthouse): `pagespeed.web.dev/?url=https://paddock-tracker.com/`

---

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
