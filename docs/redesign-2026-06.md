# Redesign 2026-06 — landing + workstation, Paddock 2.0 design language

Operator-directed UI/UX overhaul. Source of truth for scope, decisions, and per-session progress.
Read this at the start of every redesign session, update the Session log at the end of every one.

## North star

Replace the AI-generic design language with the operator's own: the rendered mockup at
`C:\Users\ppara\Downloads\Paddock Tracker (2).html` (May 21 artifact, dark racing-broadcast
aesthetic). Two-surface architecture: a marketing **landing** at `/` and the **workstation**
(the application) at `/app`. PWA users never see the landing.

## Decisions locked (2026-06-10, via AskUserQuestion)

1. **Routing:** landing at `/`, dashboard moves to `/app`. All other URLs unchanged
   (`/series/*`, `/calendar`, `/drivers/*`, `/teams/*`, blog, legal).
2. **Theme:** dark-only everywhere. Light mode + toggle retired (PR 2). Light revisited only as
   a future deliberate project.
3. **PR 1 scope:** landing + route-group split + tokens v2 + PWA routing + countdown hydration
   fix. Workstation retheme is PR 2. Multi-session is expected — track here.
4. **Hero right side:** live next-sessions widget (real data), not the mockup's static photo.

## Design tokens v2 (extracted from the mockup)

- Fonts: `--font-sans` Geist · `--font-mono` Geist Mono · `--font-display` **Saira Condensed**
  (self-host via next/font — no runtime Google request).
- Core: `--bg #07070a` · `--surface #14141a` · `--border #2a2a35` · `--text #f5f5f7`
- Brand: `--brand #FFB400` · `--brand-deep #B87A00`
- Accents: `--plasma #FF5A1F` · `--acid #C6FF3D` (`-deep #8FB42A`) · `--cyan #00E5FF`
  · `--live #FF2030` (`-deep #B81020`)
- Per-series: `--s-f1 #e10600`, `--s-motogp #ff0033`, `--s-wec #00a0e9`, `--s-indy #FFD100`,
  `--s-nascar #f5b800`, `--s-wrc #d92626`, `--s-fe #06b6d4`, `--s-imsa #2dd4bf`,
  `--s-gtworld #a855f7`, `--s-dtm #10b981`, `--s-nls #f97316`, `--s-wsbk #0066b3`,
  `--s-adac #fbbf24` (f2/f3 reuse meta.json colors).
- Motion: `--dur-fast 180ms` · `--dur-base 280ms` · `--dur-slow 520ms`
  · `--ease cubic-bezier(0.16,1,0.3,1)` · `--ease-in cubic-bezier(0.5,0,0.75,0)`
- Harvested runtime CSS reference (30 KB, keyframes for marquee/count-up/flicker/pulse/glow):
  `.playwright-mcp/mock-design.css` (gitignored scratch — re-harvest from the HTML if lost:
  serve it locally, concat all `<style>` textContent).

## Landing structure (from the mockup, top→bottom)

1. Ticker bar — broadcast-style marquee of real data (next sessions, weather, local times).
2. Nav — PADDOCK•TRACKER, anchor links, Sign in, OPEN APP pill.
3. Hero — "EVERY SESSION. / EVERY SERIES. / ONE PADDOCK." display type, subcopy,
   OPEN THE PADDOCK + WHAT'S INSIDE CTAs, live next-sessions widget right.
4. Next-up countdown strip (marquee event, e.g. Indy 500 "110°" treatment).
5. 15-series strip in series colors.
6. Acid stats band — diagonal hatch, count-up-on-scroll, REAL numbers from the data layer.
7. "A WHOLE COMPANION, NOT JUST A CALENDAR." — numbered features 01 Calendar / 02 Weekend /
   03 News-by-series / 04 Push, each with a simplified product mock.
8. Disciplines grid (Formula / Motorcycle / Endurance / Stock & Touring / Rally).
9. Perks + CTA — Follow / Push / («Sync calendar» CUT — unbuilt feature), OPEN THE PADDOCK +
   CREATE FREE ACCOUNT.
10. Footer — columns + version badge + BUILT IN GREECE. («No ads» claim CUT — AdSense planned;
    «ALL FEEDS GREEN» status line CUT until a health endpoint exists.)

Copy deviations from mockup (honesty pass) are flagged in the PR description for operator sign-off.

## PR sequence

| PR | Scope | Status |
|---|---|---|
| 1 | Tokens v2 + (marketing)/(app) root-layout split + landing at `/` + dashboard → `/app` + PWA start_url/standalone guard + countdown hydration fix + SEO wiring | ✅ merged (PR #98, 0.13.0) |
| 1.1 | Landing parity with mockup: ticker v2 (GMT/weather/news, sticky), marquee-event big countdown, series marquee rows, circuit photo feed (Wikimedia, credited), disciplines cards v2, perks v2, vivid washes, burger menu | in PR (0.13.1) |
| 2 | **Dashboard/workstation COMPLETE UI/UX overhaul** (operator directive 2026-06-10, upgraded from "retheme"): tokens v2 dark-only across AppShell/header/sidebar/footer/cards/tabs; retire ThemeToggle + dual-theme CSS; fix zinc-hardcoded surfaces (settings/onboarding/PWA modals); Clerk appearance; PLUS UX restructure — mobile information density (9-tile tab grid eats first viewport), first-visit prompt stacking (install banner + consent), desktop wide-viewport density (single narrow column at 1920), news thumbnails, Saira display type on section headers. Treat as design-led, mockup-first if operator supplies one; otherwise derive from the landing's language. Multi-session. | 2a in PR #102 (0.14.0) · 2b in PR (0.15.0) |
| 3 | Surface polish: series pages, weekend page, standings/results tables, mobile chart fix (0-size recharts + legend soup), tab-grid density on mobile | queued |
| 4+ | Desktop density pass (wide-viewport layouts, news thumbnails), motion/micro-interactions, light mode as deliberate future project | parked |

PR 1 architecture notes:
- Two ROOT layouts via route groups: `app/(marketing)/layout.tsx` (no Clerk, no AdSense, no
  AppShell — static, fast) and `app/(app)/layout.tsx` (current root layout moved). Cross-group
  navigation is a full page load — acceptable and intended. Verify exact Next 16 semantics in
  `node_modules/next/dist/docs/` before moving files.
- `/app` keeps ISR 300 and the existing HomeContent dashboard unchanged (retheme is PR 2).
- Manifest `start_url: "/app"`; landing carries a standalone-display-mode client guard
  redirecting installed-PWA users to `/app` (covers stale cached manifests).
- Version: 0.13.0 (minor — new surface). The old "0.13.0 = drivers.json bulk" roadmap label was
  aspirational, not reserved; sequence continues from whatever ships next.

## PR 2 design brief — dashboard overhaul (locked 2026-06-10 with operator)

**Operator directive:** UX must make sense; UI must be the furthest thing from
AI-looking (fonts/colors/CSS); the LANDING THEME carries over; the logo stays;
the dashboard must link back to the landing (footer).

**Anti-AI design principles (what "not AI-looking" means here):**
- Identity from the landing: Saira Condensed display headers, Geist body,
  Geist Mono micro-labels/numerals, amber `--brand` on `#07070a`, series-color
  coding everywhere data appears.
- Editorial/timing-screen density, not SaaS card soup: hard 1px rules, flush
  left edges, mono tabular numerals, uppercase micro-labels — racing TV
  graphics, not dashboard-template aesthetics.
- Banned: purple/blue gradient washes, glassmorphism, rounded-3xl-everything,
  emoji as UI, centered-everything layouts, gray-on-gray soft cards.
- Real data is the decoration (countdowns, weather, series colors, live dots).

**Locked UX decisions (AskUserQuestion 2026-06-10):**
1. **Home = time-first**: pinned live/next chyron strip → THIS WEEK session
   cards → NEWS. Desktop: two columns (schedule | news), no tabs. Mobile:
   stacked, news after schedule. Operator note: must be designed for BOTH
   phone and desktop from the start — no desktop-as-afterthought.
2. **Series pages = sticky tab bar**: compact header (series dot + name +
   season + countdown) with a horizontally scrollable sticky tab strip;
   9-tile grid retired; content above the fold.
3. **Mobile nav = bottom bar + drawer**: fixed bottom bar Home / Calendar /
   Series / Settings (PWA thumb-reach); drawer keeps the full 15-series list;
   desktop sidebar stays (rethemed).
4. **Logo**: the landing's `PADDOCK•TRACKER` Saira wordmark (amber dot)
   replaces the plain text logo in app header + drawer.
5. **Dashboard → landing access**: "Landing" link in the app Footer (Site
   column). Dark-only everywhere; ThemeToggle + light CSS retired.

**Sequencing (one PR each, smallest blast radius first):**
- **2a — shell**: tokens v2 promoted to :root (delete light-mode blocks +
  ambient radial wash), wordmark, bottom bar, drawer/sidebar retheme, footer
  (+ Landing link), retire ThemeToggle, Clerk appearance to brand.
- **2b — home**: time-first layout (live/next strip, THIS WEEK cards, news
  column), desktop two-column, news thumbnails if feed offers images,
  first-visit prompt de-stacking (install banner must not fight consent).
- **2c — series + weekend**: sticky tab bar, content surfaces (standings/
  results tables, accordions) to the new language, mobile chart fix (hide or
  rebuild SeasonTrendChart below sm:, top-N legend), washed-amber significance
  notes re-toned (dark-only makes this trivial).
- **2d — settings/onboarding/PWA modals**: zinc → tokens, focus traps via the
  parked ui/dialog, NotifPrefs/EnableNotifications dedupe if cheap.

**Folded-in audit items:** prompt stacking, desktop density, thin light-mode
contrast bugs (mooted by dark-only), tab-grid density, chart-on-mobile.

## Home v3 (W5) — spec — drafted 2026-06-19, awaiting sign-off

**North star (operator):** a calm, time-symmetric home built around two blocks —
**JUST MISSED** (what just happened) and **UP NEXT** (what's coming) — with news
demoted. *"Simple, not another shitload of information… relaxing to the eye."*
Replaces today's forward-only home (chyron + 7-day schedule + news two-column,
0.15.0) with a past↔future pair. **Spec-first: build only after sign-off.**

### Evidence base
Read-only heuristic walk (NN/g + Hick's + Fitts's + WCAG 2.2, prod @390px, 2026-06).
Findings that shape this home:
- **Hick's** — the news filter is 14 equal-weight chips; choice cost is real →
  followed-first ordering, active chip dominant, collapse beyond ~6 behind "+N more".
- **Recall-not-recognition** — collapsed day-rows are dots + faint counts with no
  legend → keep the dot language but always name the series on the row; dots are an
  aid, not the only signal.
- **Fitts's / target size** — 24px minimum tap targets across the home (several <24px today).
- **Aesthetic-usability + Miller's** — the donation ("Coffee") button is currently the
  loudest element on every page; home v3 must let content outweigh utility (site-wide
  Coffee fix tracked separately; home v3 won't reintroduce the imbalance).
- Weekend-page priority inversion (lead with result) is a separate W1 finding, noted
  because JUST MISSED applies the same "who won first" principle on the home.

### Locked decisions (AskUserQuestion 2026-06-19)
1. **Where-to-watch = curated, one link per series.** New per-series official
   watch/stream link (F1 TV, MotoGP VideoPass, WRC+, …). UP NEXT renders "Watch on …".
   One global service link, **not** broadcast-by-country.
2. **Post-session video = curated now.** Per-round YouTube highlight IDs. Bounded by
   the block: JUST MISSED only shows the *latest finished* race per series, so
   steady-state curation is ~1 ID per series per weekend, **not** the full back-catalog
   (back-catalog is optional/lazy and seeds the long-parked WeekendMedia program for
   reuse on weekend pages later).
3. **"This week" = kept, demoted.** Two blocks are the hero; the 7-day list stays
   beneath, collapsed/slim; Paddock wire becomes a thin strip under that.

### Data availability (verified 2026-06-19)
| Element | Source | Status |
|---|---|---|
| UP NEXT countdown | `session.start` + existing `Countdown` | ✓ live |
| UP NEXT venue + weather | `matchCircuit` + `fetchWeather` | ✓ live |
| UP NEXT where-to-watch | **new** per-series curated link (decision 1) | curate |
| JUST MISSED winner/result | `results-ready.ts` fetchers — **f1, f3, formula-e, indycar, motogp, wec** | ✓ for 6; link-out for the other 9 |
| JUST MISSED article | `fetchAggregatedNews` (latest from that series) | ✓ live |
| JUST MISSED highlight | **new** per-round `media.json` (decision 2) | curate |

### Layout — phone (390, primary)
Single column, stacked:
1. **JUST MISSED** — hero card (most-recent finished race across followed series) +
   up to 2 quiet rows (cap 3, followed-first, most-recent-first). Hero: series dot +
   name, race name (Saira), winner + podium (covered series) **or** "See results →"
   (uncovered), one matched article link ("Latest from <series>"), highlight ▶ if
   curated. Quiet rows: series · race · winner one-liner.
2. **UP NEXT** — hero card (next session across followed series) + up to 2 quiet rows
   (cap 3). Hero: series, session title, ticking countdown (existing), venue + weather,
   "Watch on …" link. **Live takeover preserved**: a session on track turns the hero
   into today's live chyron.
3. **This week** — collapsed `<details>`, summary "This week · N sessions · TZ";
   expands to today's day-grouped list. Default collapsed (the demotion); the
   first-day-open behavior moves inside.
4. **Paddock wire** — thin strip (~5 items), Hick's chip fix.

### Layout — desktop (≥lg)
Two-column hero: **JUST MISSED | UP NEXT** side by side (left = past, right = future).
Below, full-width: **This week** (collapsed) then **Paddock wire** (thin). Max-width
unchanged (max-w-6xl/7xl). No tabs.

### Block detail
**JUST MISSED** — selection: across followed series, most-recent race whose
`end < now` and (covered series) results have rendered via `resultsRenderedFor`, else
the most-recent finished race. Cap 3, followed-first, most-recent-first; hero = #1.
Result line: covered → "P1 winner · P2 · P3" from `RaceResult[0..2]`; uncovered →
"See full results →" to the Results tab. **Never fabricate.** Article: most-recent
news item for that series (heuristic, not a guaranteed race report — labelled
honestly). Video: `media.json[round].highlight` → `<YouTube>` thumb; absent → no row
(no placeholder). Empty (pre-season, no finished races) → block hidden, UP NEXT leads.

**UP NEXT** — existing `upcomingItems[0]` per followed series; cap 3; live takeover
preserved. Countdown/venue/weather existing. Where-to-watch from the curated link.
dateOnly → "This weekend · time TBC", no countdown (existing rule).

**This week (demoted)** — today's `byDay` list inside a collapsed-by-default
`<details>`. Dots + counts retained; series named on rows.

**Paddock wire (demoted)** — `NEWS_LIMIT` ~5, dedupe-by-link (existing), chip row
followed-first + active-dominant + collapse beyond 6.

### New data models
- **Watch link** — add `watch?: { service: string; url: string }` to `SeriesMeta`
  (`content/series/<slug>/meta.json`). 15 curations, set once.
- **media.json** — `content/series/<slug>/media.json`:
  `{ [round: number]: { highlight?: string /* YouTube id */ } }`. Server loader
  `lib/media.ts`. Seeds WeekendMedia; weekend pages reuse later.

### Architecture / build plan
- `/app` gains a "latest finished race per followed series" fetch via `results-ready.ts`
  fetchers, **KV-cached** (reuse `results-cache.ts`; only fetch series with a race ended
  in the last ~7 days). Serialize winner+podium like the news payload — keep the payload
  diet (latest race per series only, never seasons).
- `HomeContent` restructured into `<JustMissed>`, `<UpNext>` (absorbs the chyron live
  takeover), `<ThisWeek>` (collapsed), `<PaddockWire>` (chip fix). Hydration-safe clock
  (`useNow`/serverNow) preserved; TZ labels on all times (audit 2-1); device-local
  upgrade extends to the new blocks.

### Sequencing (PRs, after #145 merges; one versioned PR at a time)
Refined 2026-06-19 from "all-data-then-all-UI" to **vertical slices** — each PR ships
a complete, consumed, browser-verifiable surface, so no PR lands an orphaned loader
(the audit's 1a-10 dead-code-with-tests anti-pattern). Same design, cleaner increments.
- **Slice 1 — watch links** ✅ (0.36.6): `meta.watch` schema + 15 curated watch links +
  "Watch on …" rendered on the UP NEXT chyron card AND the live-takeover card (where-to-
  watch matters most when a session is on). Verified 390 + 1440, live (DTM→YouTube) and
  next (F1→F1 TV) branches. imsa/nascar/indycar use official-site/how-to-watch fallbacks
  (region-fragmented) — flagged for operator refinement.
- **Slice 2 — JUST MISSED block**: `media.json` loader + curated highlights (latest race
  per series) + `lib/home-results.ts` latest-finished-race fetch (KV-cached, 6 covered
  series + link-out) + the block UI. Each piece consumed in the same PR.
- **Slice 3 — restructure**: demote "This week" (collapsed) + Paddock-wire chip fix
  (Hick's) + desktop two-column JUST MISSED | UP NEXT. Pure layout pass. Browser-verify
  390/820/1440 localhost + preview; motion + sticky probes per gates.
- Highlights back-catalog + weekend-page WeekendMedia reuse = follow-on, non-gating.

### Won't do in home v3
Driver/team enrichment, the landing scroll animation (sequenced after home v3), full
WeekendMedia back-catalog, broadcast-by-country data.

### Pre-mortem
Most likely failure: the latest-result fetch makes `/app` slow/flaky on cold ISR (up to
6 season fetchers). Mitigation: KV cache + only fetch series with a race ended in the
last ~7 days; fail-soft to the "See results →" link-out, never block the page render.

## Verification gates (every redesign PR)

- `npm test` + scoped lint + `tsc --noEmit` green.
- Browser pass at 390 / 820 / 1440 on localhost AND Vercel preview (CLAUDE.md rule).
- **Motion verified programmatically, not by screenshot** — computed `animationName`
  ≠ none + transform delta sampled over ~700ms for every animated element. (0.13.1
  shipped all marquees dead because `motion-safe:` variants don't compose with
  hand-written CSS classes and static screenshots can't show it.)
- PWA check on a real installed app (operator) before merge of PR 1.
- `prefers-reduced-motion`: ticker/counters/marquee get static variants.
- CHANGELOG.md + RELEASES.md + package.json bump on every merge.

## Session log

### 2026-06-11 — session 5: operator quick wins + burger hot-fix + results v2

(Session 4, earlier the same day in a separate chat, shipped PRs #108–#118 / 0.19.1 → 0.24.1 —
PWA nav fixes, histories ×14, mobile chart, notifications 0.22.0, calendar 2c-5, desktop 2c-6,
Account 2d, validation sweeps 1–3 — but never wrote a session-log entry here; its closeout is
the five operator notes in IDEAS (#119) and the per-PR CHANGELOG sections.)

- **PR #120 (0.24.2) — operator quick wins**: series tab switch lands at the top of the new
  tab (SeriesTabs owns the scroll — Next 16's default Link scroll *maintains* position while
  the page fills the viewport, confirmed in `node_modules/next/dist/docs`, so dropping
  `scroll={false}` alone could never fix it; first render exempt to keep back/forward
  restoration); the three `.slice(0, 10)` render caps removed — full classifications render
  (F1 22/22, IMSA Daytona GTD 21, GTWC Monza Bronze 16); drivers-tab color-bar `pl-3`.
- **PR #121 (0.24.3) — landing burger hot-fix** (operator interrupt, reproduced on prod):
  the nav header's `backdrop-blur-xl` makes it a *containing block for fixed descendants*
  (filter-effects spec, same trap as `transform`), so the menu's `fixed inset-0` overlay
  collapsed into the 56px header strip — open but invisible. Probe-confirmed (dialog rect ≡
  header rect). Fix = portal to `document.body`. Latent second bug en route: the scroll lock
  targeted `<body>` but the page scroller is `<html>` — lock moved to `documentElement`,
  which also removed the reserved scrollbar gutter sliver. **Rule of thumb baked in: no
  `position: fixed` element may render inside a blurred/filtered/transformed ancestor —
  portal modals to body.**
- **PR #122 (0.25.0) — results layout v2** (operator note (a) of the layout pair): race rows
  rebuilt on shared primitives — tint mono round chip, Saira title, amber `WIN` meta — and
  the title links through to `/series/<slug>/weekend/<round>`, gated by the `groupByWeekend`
  round set so unmapped rounds (FE doubleheader race 2s; all GTWC rows — no round numbers in
  `GtWorldRaceResult`) render unlinked rather than 404. Chevron keeps the accordion; a link
  inside `<summary>` activates without toggling (verified both ways programmatically). No
  default-open accordion — full fields made that unaffordable.
- **PR #123 (0.26.0) — W2 series-tab polish** (first wave of the operator's 15-item batch;
  W1–W8 roadmap captured in SCHEDULE.md backlog stubs, port to IDEAS.md after #119 merges):
  trend chart moved Results → Standings on F1/NASCAR/WRC/DTM (standings-shaped data,
  invariant co-location; DTM results → link-out), always-on chart dots + highlighted hover
  point, classifications 2-col from `sm:` (P1–11 / P12–22), WIN meta line wraps on phone,
  champions team names in team colors — drivers.json colors behind a luminance guard
  (`color-mix` lifts dark hues like Red Bull navy to readable steel blue on the near-black
  bg). Historic-constructor color map = follow-up curation; historic teams plain until then.

- **PR #124 (0.27.0) — W1a weekend retheme** (operator merged the full #119–#123 stack
  mid-session): weekend hero → flush border-y section, mono meta row, Saira title with
  series-color full stop; back-to-series arrow removed (series name in the meta row still
  links); Schedule/Weather/Standings/News converted from rounded cards to flat sections;
  page radial wash deleted. W1b (point-in-time standings) and W1c (per-session pages on the
  OpenF1 notes below) are the next slices of the wave.

- **PR #125 (0.28.0) — W1b point-in-time standings**: buildStandingsAtRound (lib/season-trend,
  5 tests) + weekend pages show the championship frozen at that round (verified ANT 156 @R6 vs
  72 @R3). Merge raced my final push — the multi-series + chart-top commit was recovered into:
- **PR #126 (0.29.0) — W1c per-session pages**: /series/[slug]/weekend/[round]/[session];
  F1 classifications via OpenF1 (lib/results/openf1.ts — date-window join, name-slug match +
  nearest-start fallback, Q1/Q2/Q3 arrays). Weekend schedule links through on F1; other
  series resolve with an honest note pending race-session adapters. Recovered commit rode
  along: frozen standings ×10 series (teams tables only where per-team sums ARE the
  championship), trend chart moved to the top of Standings (operator). **OpenF1 verified
  working from Vercel datacenter IPs on prod post-merge.**
- **PR #127 (0.29.1) — landing nav fixes** (operator interrupt): anchored sections gain
  scroll-mt-28 (sticky ticker+nav buried headings); burger rebuilt as a half-screen
  right-side drawer over a scrim (85% on phones), @starting-style entry, still portaled.
- **W1 wave complete.** Next: security audit (own session) → W3 → W4 → W8 per the locked
  v1.0 scope (operator 2026-06-11: all four gate launch).

**OpenF1 research (for the weekend per-session results follow-up — operator note (b)):**

- `api.openf1.org` — free community F1 API, no auth. 2026 fully live: `/v1/sessions?year=2026`
  → 126 sessions (24 GP weekends: P1×24, P2/P3×18, SQ+Sprint×6, Q×24, R×24 + 3 test days),
  with `circuit_short_name`, `date_start/end`, `meeting_key`, `session_key`.
- `/v1/session_result?session_key=K` → full per-session classification (22/22 verified on
  Monaco FP1/Q/R): `position`, `driver_number`, `number_of_laps`, `dnf/dns/dsq`, `duration`
  (practice/race: seconds; **quali: `[Q1,Q2,Q3]` arrays**, same for `gap_to_leader`), race
  rows carry `points`.
- `/v1/drivers?session_key=K` → join `driver_number` → `full_name` / `name_acronym` /
  `team_name` (22/22).
- Weekend mapping: match the weekend's date span to session `date_start` (or meeting_key) —
  no round numbers in OpenF1.
- Risks for the impl PR: community API (rate limits unspecified — cache aggressively via ISR),
  and **must verify from a Vercel preview/prod** before "shipped" (datacenter-IP rule; Jolpica
  precedent says fine, but verify). Jolpica remains the quali fallback (Q times only).
- Shape of the feature: `lib/results/openf1.ts` fetcher + `WeekendSessionResults` section on
  the weekend page, race first, then sprint/quali/practices, collapsed accordions in the v2
  row language. Non-F1 series can reuse the section with their round-keyed race results
  (adapter per series, results-ready-notification pattern).

### 2026-06-10 — session 3 (same day): PR 2a shell + PR 2b time-first home
- Recovery first: the PR-2-brief docs commit (`54a2d93`) had been pushed to the #101 branch
  AFTER that PR merged — never reached main. Cherry-picked onto the 2a branch.
- **PR 2a (#102, 0.14.0)**: tokens v2 promoted to :root, light mode + ambient wash +
  ThemeToggle + theme-bootstrap script deleted; dark-only via `class="dark"` on both root
  htmls (all existing `dark:` utilities incl. prose keep firing for light-OS users — verified
  by light-colorScheme emulation across /app /calendar /series/f1 /privacy); PADDOCK•TRACKER
  wordmark in app header + drawer (Saira loaded in (app) layout); mobile bottom bar
  (Home/Calendar/Series→drawer/Settings, safe-area, amber top-rule active marker); footer
  Landing link + landing-language headings; Clerk appearance → brand at provider, per-page
  zinc overrides removed; manifest/themeColor/OG bg → #07070a.
- **Mid-session operator directive** (screenshot + "take full control of the ui/ux
  structure... surprise me"): (1) install banner must GO — removed entirely (component
  deleted, audit's prompt-stacking item resolved by removal); (2) major UX change pulled
  PR 2b forward into the same session.
- **PR 2b (0.15.0)**: HomeContent rewritten — chyron strip (live takeover / next-session
  countdown ticking 1s), THIS WEEK 7-day timing rows (mono time column, series rules,
  TODAY/TOMORROW tags), PADDOCK WIRE news rows, desktop two-column (no tabs), xl:max-w-6xl.
  **Hydration #418 source 2 fixed structurally**: all time strings render from `now` state
  seeded by a `serverNow` prop → SSR == first client render at any ISR staleness; device
  clock + real timezone (GMT → e.g. EEST) swap in post-mount. NextSessionCard deleted.
  News thumbnails skipped honestly — feed parse exposes no image field.
- Verified (localhost): tsc + 350 tests green; zero console errors on /app (the #418 is
  gone); overflow probe 0 at 412px on both PRs (scroll-container-aware predicate); countdown
  tick verified programmatically (12:56→12:55); marquee motion re-verified after .theme-2
  removal; series --tint override intact. /settings 500s in dev on main too (Clerk keyless
  quirk) — check on preview.
- Open at session-3 close: Vercel preview verify both PRs + operator installed-PWA check
  → merge order #102 then 2b. Then 2c (series tab bar + surfaces + mobile chart), 2d
  (settings/onboarding modals — the remaining zinc surfaces).
- **Both merged by operator** (same day). Verdict on 2b: "spectacular... the theme you
  have chosen is amazing. this needs to be kept throughout the whole app" → 2c/2d carry
  the mandate. Two nav corrections: Series tab must NOT open the drawer; Settings → Account.
- **PR 2c-1 (0.16.0)**: `/series` hub page (first-ever series index — category-grouped
  timing rows, next session per series, day-level dates = zero hydration surface, ISR 300,
  sitemap entry) + BottomBar v2 (all four tabs are real destinations; Series → /series
  active across /series/*; Account label + CircleUser icon, URL stays /settings) + drawer
  Series link + SectionHead extracted (real second consumer). Verified: tsc/350 tests/lint,
  0 console errors, overflow 0 @390+412, two-col hub at 1440, aria-current on active tab.
- Discovered en route: Vercel previews are SSO-protected (401 anonymous) — Claude can't
  browser them; operator does preview passes (memory: project-paddock-preview-protection).
- **PR 2c-2 (0.17.0)** — one nav system (operator: "navigation menu and burger bar can
  go"): drawer/sidebar + burger + backdrop deleted; single fixed header on all viewports
  (wordmark + lg+ inline mono nav Home/Calendar/Series/Blog with amber active rule +
  utils); main loses lg:ml-72; footer gains Blog, Settings link relabeled Account. The
  drawer's set-state-in-effect was the lint-baseline error — baseline now clean. AppShell
  is ~60 lines lighter.
- **PR 2c-3 (0.18.0)** — series pages: 9-tile grid → sticky tab rail (mono labels,
  series-color underline, auto-scroll-into-view, sticks at top-14); compact Saira header
  + restyled mono countdown; radial wash deleted; significance chips/notes re-toned to
  brand across SessionCard/WeekendBlock/WeekendHero/WeekendSchedule; chart fix (desktop-
  only plot, legend capped at 12 + "+N more", "(i)/(R)" suffixes stripped). KEYSTONE:
  `overflow-x: hidden → clip` on html/body — hidden created a scroll container that
  killed every position:sticky descendant; clip doesn't. This fixed the operator's
  landing ticker/nav sticky bug for free (verified at 1200px scroll: ticker top 0, nav
  top 36). Sticky probes are now part of the verification battery.
- **PR 2c-4 + operator fix batch (#107, 0.19.0)** — tab surfaces flattened to the
  timing-screen language; **Rules retired** (About absorbed the official links;
  ?tab=rules → calendar); recharts ssr:false + Suspense-streamed tab bodies;
  **F1 chart-vs-standings ROOT CAUSE CLOSED**: Jolpica clamps limit to 100 →
  season feed lost every race past the 100-entry boundary (missing Monaco,
  12-car Canada, "points-only" tables, ANT 131 vs 156 — one bug, four symptoms);
  fixed via pagination + per-round merge in lib/results/f1.ts. Chart lines in
  2026 constructor colors (teammates dashed; Audi #F50537 / Cadillac white —
  no official hexes published, web-verified). OG share card rebuilt around the
  crossed-flags icon (Instagram showed the old red/white chequer). Header
  wordmark now links to the landing.
- **Blocked/carried**: 6-agent fleet (15-series data validation + 12 history
  essays in the F1 voice) died on the org spend limit; f2+f3 history.md written
  (untracked in worktree, hold for a content PR — review before commit).
  Relaunch the fleet next session.
- Operator batch queue (feasibility order): per-page desktop+mobile layout pass →
  notifications (30'/10' pre-session + results-rendered; extend the notify cron,
  needs per-offset dedupe keys) → session-level subpages with practice/quali
  classification (research OpenF1 api.openf1.org for FP/Q data; Jolpica has Q
  only) → driver/team enrichment pages (photos/bios/stats — multi-session, pairs
  with 0.15.0-enrichment). 2d account page still queued.

### 2026-06-10 — session 2 (same day): PR 1.1 landing parity
- Operator reviewed live 0.13.0 vs mockup with screenshots; gaps locked: richer moving
  ticker, big marquee-event countdown, moving series timetable, circuit photo feed,
  discipline cards v2, perks v2 with glow, vivid amber washes, burger menu.
- Photos: Wikimedia Commons, 10 candidates downloaded + visually reviewed, 7 selected
  (incl. Monaco hairpin CC0, Talladega "pack racing" matching the mockup caption).
  License + artist per file in `content/landing/circuits.json`; credits render on-page.
- "Sync your calendar" perk card NOT shipped (feature doesn't exist) — third card is
  the PWA. Add to IDEAS Inbox: per-series calendar feeds (ICS proxy endpoint) → when
  shipped, swap the perk card back to the mockup copy.
- All sections built + browser-verified (390/1440, menu focus behaviour, photos via
  next/image). 0.13.1 PR opened; preview verify pending before merge.

### 2026-06-10 — session 1
- Full-stack audit delivered (separate report; feeds PR 3+ backlog).
- Mockup rendered + mined: tokens, structure, 30 KB runtime CSS harvested.
- Decisions 1–4 locked with operator. Branch `feat/redesign-1-landing-2026-06-10` opened.
- Progress: **PR 1 built end-to-end this session** — route-group split (two root layouts),
  tokens v2 + Saira Condensed, dashboard → /app, PWA start_url + standalone guard,
  countdown hydration fix (root cause of the dark-mode reset), full landing (all 10
  sections, real data), SEO wiring, release notes, 0.13.0. tsc/vitest/lint green;
  browser-verified localhost 390+1440 (landing, /app, /series/f1 — zero hydration
  errors). PR opened; pending: Vercel preview verify + operator installed-PWA check
  before merge. Known dev-only artifact: lint baseline still carries the 8
  pre-existing errors from the audit (untouched by design).
- Next session (PR 2): workstation retheme to tokens v2 dark-only — AppShell chrome,
  cards, tabs, retire ThemeToggle + light mode, Clerk appearance, zinc-hardcoded
  surfaces (settings/onboarding/PWA modals). Then PR 3 surface polish per plan table.
- Post-merge outsider audit (same day, prod v0.13.0): landing live + fast (TTFB ~50ms,
  ~1 KB JS); dark-mode persistence CONFIRMED fixed prod-wide (backstop holds even on
  /app). Two carry-overs: (1) #418 hydration still fires on /app — SECOND source, the
  morning root-cause was incomplete: HomeContent's relative-time labels ("4h ago" /
  "in 5h") drift against up-to-5-min-stale ISR HTML; fix = suppressHydrationWarning on
  those spans or client-only relative labels. Series pages confirmed clean. (2) F1
  results tab shows 5 races / chart ANT 131 while standings show 7 rounds / ANT 156 —
  chart-vs-standings invariant violated in prod; investigate Jolpica race-feed lag vs
  standings endpoint + cache before PR 3.
