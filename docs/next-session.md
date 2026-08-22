# The execution queue

Rewritten 2026-08-23 as an **ordered, one-item-per-PR backlog**, so work can be picked off the top without re-deciding anything. `main` = **0.334.3**, prod verified, tree clean, zero open PRs.

Every item states: **what**, **why it matters**, **where**, and **how prod is audited afterwards**. The ritual is the same for each one: branch → implement → `tsc` / `lint` / `vitest` / `build` → browser-verify → the trio → PR with a real body → squash-merge → poll `/changelog` until the version flips → **audit on prod**.

---

## TIER 1 — executable now, nothing waiting on a decision

Take these in order. Each is self-contained and each has a settled answer already.

### 1. The `/calendar` `DataCloneError`, thrown on every visit
- **What**: drop `cacheOnNavigation` from `components/SerwistRegister.tsx`.
- **Why**: `@serwist/turbopack@9.5.12` forwards `history.pushState`'s third argument into `postMessage`, and Next's App Router sometimes passes a `URL`, which is not structured-cloneable. It throws **`DataCloneError: Failed to execute 'postMessage' on 'ServiceWorker'`** on `/calendar` — re-confirmed on prod 2026-08-23, 665 ms after load. It is the page's Best-Practices-92 finding in the PSI sweep. Offline was removed deliberately in 0.268.0, so navigation caching is **vestigial and currently throwing**. `IDEAS.md` recorded this with the recommendation already written; the alternative is waiting for upstream.
- **Audit**: load `/calendar` on prod and confirm the console is clean, then confirm the service worker still registers (`/serwist/sw.js` → 200).

### 2. AdSense enrichment wave 3 — F1 pre-1996 champion notes
- **What**: 46 seasons into `content/series/f1/champion-notes.json`. **Data only, no code.**
- **Why**: completing one family reads better to a reviewer than half-finishing several, and the AdSense verdict is still outstanding. `lib/champion-notes-integrity.test.ts` now guards every note (names its own champion, carries its season, agrees with the points pair, cites two sources), so a wave cannot land malformed.
- **How**: the proven two-source pipeline. RULE #1 on every clinch. Small waves, not a fan-out.
- **Audit**: an enriched year shows the clinch on `/information/formula-1/who-won-the-1976-formula-1-championship`; an un-enriched one is untouched.

### 3. `docs/HANDOFF.md` trim — overdue since 2026-08-06
- **What**: keep the last two or three sessions, move the rest to `docs/handoff-archive.md`.
- **Why**: it is over **500 KB** and no longer readable at session start, which is its only job. It already had to be read in slices this session.
- **Audit**: none needed on prod (docs only); confirm the archive file contains what left the main one.

---

## TIER 2 — one operator decision each, then a small PR

These are written up with a recommendation. Say yes or no and they execute immediately.

### 4. `/api/push/history` — delete the endpoint?
Reader with **no UI** since `NotificationBell` was deleted in 0.332.2. `lib/push-history.ts` is still written by the notify crons, so nothing else is orphaned. **Recommend delete** — it is a public endpoint serving data nothing consumes. Held because removing a public API surface is your call.

### 5. `ChartEmbed`'s rounded corners
`components/blog/embeds/ChartEmbed.tsx:50,65` use `rounded-xl` / `rounded-lg`, against the standing "hairline panels, sharp corners, never rounded cards" principle. **Recommend squaring them.** One class change; held because it is visual.

### 6. Promote the CSP from `report-only` to enforcing
Already written, already reporting, and its one stale entry (`va.vercel-scripts.com`) was removed in 0.334.2. **This is the real answer to the "show visitors we are legit" ask** — a genuine security upgrade rather than the Cloudflare challenge interstitial, which is friction, not a badge. Held because an enforced-but-slightly-wrong CSP **takes the site down** instead of logging a warning: it wants you watching, and it wants a look at the report-only violations first.

### 7. `/calendar` contrast on Paper
Mono `text-text-faint` agenda times fall under 4.5:1 (a11y 93/96 in the sweep). **Recommend a token nudge**, sibling of the 0.311.0 legibility pass. Your palette.

### 8. Month-grid tap targets
**Recommend ACCEPT as-is** and close the item — density is the point on desktop and the 0.313.0 mobile agenda already solves phones. One word from you retires it.

### 9. The two indexed stub strings
`components/StaleBanner.tsx:11` ("No feed configured — placeholder data only." — also carries a house-style em dash) and `components/tabs/PlaceholderTab.tsx:9` ("Coming soon."). Both are shared across several surfaces. The copy is a design call; the real fix is **keeping contentless tabs out of the index**, which is the same decision as item 10.

### 10. `noindex` the 15 news tabs
The one page family enrichment cannot fix, because it is motorsport.com aggregation by design. **Recommend noindex.** Directly relevant to the AdSense verdict.

### 11. Race Story public on completed sessions
The **cheapest remaining AdSense win**: unique prose already exists on 600-900 session pages and is sign-in-walled. Needs the parked SEO-Phase-2b `force-dynamic` → ISR unpark, which the PSI sweep independently asked for (session-page TTFB 665 ms). Two decisions in one: unlock the perk, and unpark the ISR work.

---

## TIER 3 — projects, not items. Each needs a session of its own

### 12. A day page between the weekend and the session
Friday / Saturday / Sunday: that day's forecast, the news that broke that day, blogs, the day's sessions. **Most natural next build** — `forecastWindow()` and `HourlyForecastRows` (0.332.0) drop straight in, and the weekend page already groups by day. Needs a layout decision, not research.

### 13. THE IMAGE SESSION
Your words: "the biggest job we have ever done". Licence-clean imagery at scale, Fotis' testing build as the layout reference, home refined with image boxes. Every source licence-checked (portraits ×14 and team logos both died on licensing before).

### 14. The image/positioning brief (GEO)
AI engines describe Paddock as web-only, 4-series, no journalism, no notifications — all wrong. `/about` + `llms.txt` as the canonical self-description, structured data, comparison-proof pages.

### 15. v1.0 launch program
The "out of early access" flip plus the marketing channel plan. The distribution half of 13 and 14.

### 16. Street View corner tours + layout history on `/tracks/<slug>`
Corner and straight names, why they are called that, what happened there, plus previous layouts and why each changed. Needs a coverage check per circuit and a rights stance on Street View embeds. Pairs with the paused `feat/tracks-map` branch (leaflet already on it; a blind conflict resolution there broke prod once, 2026-07-09).

### 17. Information hubs restyle
The last pre-Paper surface (`font-display` extrabold caps masthead). Queue with the image session.

---

## Standing facts, so nobody rediscovers them

- **Deploys are ~6 minutes** and there is **no GitHub Actions run to watch** — poll `/changelog` until the version flips.
- **Worker bundle is at the ceiling**: measure with `wrangler deploy --dry-run` before adding a dependency. ~53 KiB of headroom at 0.334.x.
- **Local Supabase is down**, so every blog-backed surface renders empty locally. That is the fail-soft path working.
- **Lint is 0 errors + 2 known `_encoding` warnings** in `lib/content-fs.ts`. Those parameters are **load-bearing** (callers pass `'utf-8'`); the only way to clear them is relaxing `no-unused-vars`, which is weakening a check. **Leave them.**
- **`npm test` is 1193.**
- **Browser verification is not the gate chain.** Seven real defects survived tsc, lint, 1193 tests and `next build` across sessions 32-33, one of them a defect in a fix I had just written. Click it, and screenshot it — DOM assertions passed on the one the screenshot caught.
