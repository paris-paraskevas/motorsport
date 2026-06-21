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
