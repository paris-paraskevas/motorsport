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
