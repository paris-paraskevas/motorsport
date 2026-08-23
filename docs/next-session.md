# The execution queue

Rewritten 2026-08-23 as an **ordered, one-item-per-PR backlog**, so work can be picked off the top without re-deciding anything. `main` = **0.334.12**, prod verified, tree clean, zero open PRs.

**Done since this list was written:** items 1 (`DataCloneError`), 3 (HANDOFF trim), 4 (`/api/push/history`), 5 (ChartEmbed), 9 (stub copy), 10 (news-tab noindex). Items **7 and 11b closed by measurement**, no code changed. Three Dutch GP blog drafts are in the `/blog` queue awaiting approval.

Every item states: **what**, **why it matters**, **where**, and **how prod is audited afterwards**. The ritual is the same for each one: branch → implement → `tsc` / `lint` / `vitest` / `build` → browser-verify → the trio → PR with a real body → squash-merge → poll `/changelog` until the version flips → **audit on prod**.

---

## TIER 1 — executable now, nothing waiting on a decision

Take these in order. Each is self-contained and each has a settled answer already.

### 1. ~~The `/calendar` `DataCloneError`~~ — DONE 0.334.5
Fixed with `cacheOnNavigation={false}`. **The recorded recommendation would have been a no-op**: the prop defaults to `true` inside `@serwist/turbopack`, so deleting the line leaves the behaviour on. Audited on prod: `/calendar` console clean, `/serwist/sw.js` still 200.

### 1b. A Dutch GP race recap
The three session recaps are queued; the race itself is the missing fourth. `drafts/f1-dutch-grand-prix-2026-*-recap.md` are the shape and voice to copy (results table beside the prose, nine outbound links, verdict and "For the books" sections, italic photo credit). The classification will be on `/series/f1/weekend/12/race` and on formula1.com; cross-check both, and remember the Zandvoort farewell angle is the story rather than the points.

### 2. AdSense enrichment wave 3 — F1 pre-1996 champion notes
- **What**: 46 seasons into `content/series/f1/champion-notes.json`. **Data only, no code.**
- **Why**: completing one family reads better to a reviewer than half-finishing several, and the AdSense verdict is still outstanding. `lib/champion-notes-integrity.test.ts` now guards every note (names its own champion, carries its season, agrees with the points pair, cites two sources), so a wave cannot land malformed.
- **How**: the proven two-source pipeline. RULE #1 on every clinch. Small waves, not a fan-out.
- **Audit**: an enriched year shows the clinch on `/information/formula-1/who-won-the-1976-formula-1-championship`; an un-enriched one is untouched.

### 3. ~~`docs/HANDOFF.md` trim~~ — DONE 0.334.9
**532 KB → 36 KB** (3,466 → 247 lines). Sessions 29 and earlier moved verbatim to `docs/handoff-archive.md`; sessions 30-33 stayed.

The trim also **deleted the stale reference tail rather than archiving it**. "Quick context", "Critical landmines" and "Where things live" had rotted into a second, wrong copy of `CLAUDE.md` — naming Vercel as host, `@serwist/next` as the PWA layer, "Vercel KV" as the store, and stating the `middleware.ts` / `proxy.ts` landmine **backwards**, which is the exact rename that breaks the deploy. `CLAUDE.md` and `CONTRIBUTING.md` are the authorities; the file now says so and tells future sessions not to reintroduce copies.

---

## TIER 2 — one operator decision each, then a small PR

These are written up with a recommendation. Say yes or no and they execute immediately.

### 4. ~~`/api/push/history`~~ — DONE 0.334.7
Deleted. It surfaced something bigger, now the item below.

### 4b. Push history is WRITE-ONLY — rebuild the bell, or stop writing it
**Four** writers call `recordSent` (`api/cron/notify`, `api/cron/betting-notify`, `lib/blog-notify`, `lib/notify-blog`) and, since `NotificationBell` was deleted in 0.332.2, **zero** readers. Every notification we send writes a per-user record to KV that nothing will ever display. The privacy wording was corrected in 0.334.7 to stop claiming the app shows it back to you, but the underlying choice stands: **rebuild the notification centre, or remove the writes and the module.** Not done unsupervised because the `recordSent` calls sit in the notification hot path, and breaking a cron stops notifications.

### 5. ~~`ChartEmbed`'s rounded corners~~ — DONE 0.334.7
Squared.

### 6. Promote the CSP from `report-only` to enforcing
Already written, already reporting, its stale `va.vercel-scripts.com` entry removed in 0.334.2, and `static.cloudflareinsights.com` added in 0.334.6 once the report stream showed it loading. **This is the real answer to the "show visitors we are legit" ask** — a genuine security upgrade rather than the Cloudflare challenge interstitial, which is friction, not a badge.

**One decision is baked into this and must be made deliberately.** The report stream shows `fundingchoicesmessages.google.com` loading, pulled in by `adsbygoogle.js` rather than by us. It is **deliberately not allow-listed**, so enforcing the policy as it stands would **block Google's Funding Choices consent UI**. That is arguably correct — our own modal has owned consent since 0.12.6 and a second consent UI from Google is not wanted — but it is a choice, not a side effect. Decide it before flipping the header.

Held otherwise because an enforced-but-slightly-wrong CSP **takes the site down** instead of logging a warning: it wants you watching.

### 7. ~~`/calendar` contrast on Paper~~ — CLOSED 0.334.8, premise was stale
**Measured on prod rather than nudged.** `--text-faint` against the page background: **paper 5.07:1** (5.25 against `--surface`), **newsprint 5.07:1**, **circuit 6.59:1**. All pass WCAG AA for normal text. The 0.311.0 legibility pass had already fixed it and the note went stale. **No token change made** — nudging `--text-faint` would have rippled across every surface that uses it, to fix nothing.

What the measurement *did* surface: those elements render at **9 px**. If the a11y complaint is real, it is size, not contrast, and that is a type-scale decision rather than a token one.

### 8. Month-grid tap targets
**Recommend ACCEPT as-is** and close the item — density is the point on desktop and the 0.313.0 mobile agenda already solves phones. One word from you retires it.

### 9. ~~The two indexed stub strings~~ — DONE 0.334.8, and the premise was wrong
`PlaceholderTab` is **not a stub**. It is the live empty state for **seven** real tabs — Standings, Results, Champions, Rounds, About, History and the series landing — rendered whenever a source has nothing for that series. So "Coming soon." was not placeholder text awaiting a feature; it was **wrong copy on a working feature**, promising a launch that already happened. Now "Nothing here yet for this series."

`StaleBanner`'s line lost its em dash and says what it means: "No live feed is configured for this series, so the schedule below is placeholder data."

### 10. ~~`noindex` the 15 news tabs~~ — DONE 0.334.8
**14, not 15** (one series has no news tab). `noindex, follow` via `seriesTabMetadata`, **and removed from the sitemap in the same change** — submitting a noindex URL earns Search Console's "Submitted URL marked noindex" rather than being quietly ignored, so the exclusion had to land in both places or they would contradict each other.

### 11. Race Story public on completed sessions
The **cheapest remaining AdSense win**: unique prose already exists on 600-900 session pages and is sign-in-walled. Needs the parked SEO-Phase-2b `force-dynamic` → ISR unpark, which the PSI sweep independently asked for (session-page TTFB 665 ms). Two decisions in one: unlock the perk, and unpark the ISR work.

---

### 11b. ~~Two useless preloads on `/calendar`~~ — CLOSED 0.334.8, accept with cause
Traced rather than patched. **Nothing in this repo emits those preloads**: both images are plain `<img fetchPriority="high">` (`components/HomeLead.tsx`, the weekend page's circuit SVG), and a grep for `rel="preload"` across `app`, `components` and `lib` finds only fonts and the GLTF model.

**CAUSE**: React 19 auto-emits a matching `<link rel="preload" as="image">` for an `<img fetchPriority="high">`, and Next prefetches linked routes — so prefetching `/app` (a nav link on *every* app page) and the weekend routes (calendar cells) hoists *their* preloads into the current document. Proven by loading `/privacy`, which has **zero** weekend links and **zero** `<img>` tags matching, and still carries the cover preload.

**Verdict: accept.** The two `fetchPriority` hints were added deliberately for LCP on the pages where those images *are* the LCP element (0.323.1, 0.330.0). Removing them to silence a console warning on other pages would trade a measured win for a cosmetic one, and the wasted bytes are a single cached download that also warms `/app`.

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
