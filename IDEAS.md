# Paddock — ideas ledger

This is the single source of truth for everything we might build. Triaged at the end of every session.

**Rules:**
1. Every new idea forces you to pick one to drop or park. There is no infinite capacity.
2. Inbox is append-only during a session. Triage at session end only — never mid-task.
3. Sections cap: Now ≤ 3, Next ≤ 5. Inbox uncapped. Parked + Killed unbounded — they're the ledger.
4. Inbox entries are one sentence, no formatting. Triaged entries get a one-line "why" appended.

Time-based scheduling lives in `SCHEDULE.md`.

---

## Now (≤ 3, in flight)

_Triage 2026-06-11 (operator 15-item batch organized into waves W1–W8; sequencing + details in `SCHEDULE.md` backlog stubs). Retired from the old list: Fotis Supabase sit-down + provisioning → coupled to W7 in the Inbox (the blog/UGC ask IS the S9 trigger); ADAC champions → done (0.24.1 curated 2026 winners); B-content → superseded (histories ×15 shipped 0.20.0, Rules retired 0.19.0; blog posts fold into W7/W8)._

1. **W1 — weekend page overhaul (in flight).** W1a retheme + back-arrow removal shipped (0.27.0). W1b: point-in-time standings — points as they stood at that GP, full driver + team tables; computable only for per-round-points series (F1/F2/F3/NASCAR/WRC/DTM/IndyCar/FE/MotoGP/WSBK), F1 first, IMSA/GTWC honestly excluded. W1c: per-session pages `/series/[slug]/weekend/[round]/[session]` with results — OpenF1 for F1 practice/quali (research done, redesign-doc session-5 log); other series race-session only.
2. **Security audit — next dedicated session.** Endpoints, headers, rate limits, auth surfaces; `/security-review` skill + API-route sweep (contact-form rate-limit is the known carry-over). Also a W8 launch gate.
3. **B-perf execution.** Carried since 2026-05-20 — top non-feature debt. Baselines in `docs/perf-baselines.md`; levers: Clerk lazy, 3rd-party deferral, CSS critical path. Re-baseline first — the redesign changed every page since capture.

## Next (≤ 5, queued — start within ~1–2 weeks)

1. **W5 — per-page layout spec, desktop + phone.** One design session documented in the redesign doc; feeds W1/W4. Operator: "plan out how the layout of each page will be like on desktop and then do the same for on phone."
2. **W3 — About/rules content ×15.** DECIDED (operator 2026-06-11): rules content lives inside About — tab label stays ABOUT, revisit only if the section grows. History-essay agent pattern, sequential agents. **v1.0 launch gate.**
3. **W4 — driver + team profile pages.** Photos/bios/stats, multi-session. Verify drivers.json coverage first (gap was 13 series in May — recheck before scoping). Absorbs the old S6 enrichment entry.
4. **W8 — v1.0 launch program.** SCOPE LOCKED (operator 2026-06-11): **W1 + security audit + W3 content + W4 profiles ALL gate the launch** — feature-complete day one. Remaining W8 work: "out of early access" banner, marketing channel plan (Instagram/Facebook/Reddit/X/YouTube), launch checklist.
5. **Weather + news coverage audit (15 series).** Carried. Open-Meteo (venue-local date) + news feed per next-weekend of every series; output = gap list + curation pass.

## Inbox (unfiltered, append-only)

- Onboarding tour overlay (operator 2026-06-11): spotlight tutorial, ≤5 stops, auto-show once, "don't show again" in localStorage (no account needed), replay from Account. RESEARCHED — rules/verdict/build plan in docs/research/onboarding-tour-2026-06.md (verdict: hand-roll ~200 lines; Shepherd/Intro.js are AGPL-blocked). One-PR build, ready to schedule.
- Driver headshots (operator 2026-06-11): driver pages have no images. Licensing-led problem, not code: Wikimedia-sourced portraits with per-image attribution (the landing circuit-photos pattern — license+artist per file, credits rendered) — F1's 22 first, then marquee series; 600-driver full coverage is a long-tail curation program. Pairs with the deferred 0.15.0 enrichment ambition.

- Security audit (operator 2026-06-11) → PROMOTED to Now slot 2.
- Series tab switch keeps scroll depth (operator 2026-06-11) → SHIPPED PR #120 (0.24.2); Next 16's default Link scroll couldn't fix it, SeriesTabs owns the scroll.
- Drivers tab spacing (operator 2026-06-11) → SHIPPED PR #120 (0.24.2).
- Results layout v2 + weekend integration (operator 2026-06-11) → rows + clickable races SHIPPED PR #122 (0.25.0); per-session weekend results = W1c in Now slot 1.
- Results must show ALL drivers' positions (operator 2026-06-11) → SHIPPED PR #120 (0.24.2); 2-col field layout followed in PR #123 (0.26.0).
- UI/CSS inspiration pass (operator 2026-06-11, "for a little later"): review 5 reference component libraries as design-direction input — styleui.dev, cult-ui.com/docs, skiper-ui.com/components, aliimam.in/docs/components, ui.watermelon.sh. Approach: mine each for type/motion/density patterns that transfer onto the Paddock 2.0 language (not a reskin); shortlist concrete component upgrades (tables, tabs, countdown, chips) with the anti-AI principles as the filter.
- W6 — Android app via TWA wrapper (operator 2026-06-11): PWABuilder/Bubblewrap → Play Store ($25 one-time), Digital Asset Links + store assets; NOT a native rebuild. TIMING DECIDED 2026-06-11: after v1.0. iOS/App Store = separate, harder, parked.
- W7 — blog threads + UGC entries with admin approval (operator 2026-06-11): Clerk roles via publicMetadata (admin check in API routes — no Organizations product needed); submissions/drafts/approval queue/threads = relational user-writes → **the Supabase trigger (S9 fires)**. Design doc before code; absorbs the old "Fotis sit-down + provisioning + migrations" entries; don't block v1.0 launch on it.
- Historic-constructor color map (follow-up to 0.26.0 champions colors): curated per-series color file for pre-current-grid champion teams (Brabham, Lotus, Tyrrell…) so historic rows color too; 5-source rule; agent curation task.
- GTWC results round numbers: parser emits raceId/eventName but no canonical round — blocks weekend links on GT World results rows (noted in 0.25.0). Align with rounds.json.
- FE doubleheader second races have no weekend URLs (R8/R10-style rounds share the weekend page of the first race) — modeling gap surfaced by 0.25.0 link gating; 8/10 FE races link today.
- Endurance-series weekend grouping audit (demoted from Next by the wave triage): WEC / IMSA / NLS / ADAC 24h races + multi-day tests vs `groupByWeekend`'s 4-day gap heuristic.
- Curation patches when timetables drop (demoted from Next): IMSA Practice 1 on R6–R11, FE Sanya R11 session times.
- Track B leftovers (demoted from Next): B11 path-based tab routes `/series/[slug]/[tab]` (1–2 days), B12 Greek `/el/` route tree via next-intl (3–5 days).
- Research live in-race data feeds (sector times, leaderboard, gaps, tyre choices) for F1, MotoGP, WEC, FE, IndyCar.
- Reverse-engineer fiaformulae.com / motogp.com / nascar.com XHR endpoints to see if unsigned JSON can replace Playwright.
- Decide Sandbox/Playwright vs third-party aggregator vs curation-first for JS-rendered official sites.
- Enrich /drivers/[slug] with Wikipedia bio, current standings position, last 5 results, news mentions.
- Enrich /teams/[slug] with the same shape.
- Redesign F1 History tab or replace with curated content/series/f1/history.md.
- Improve Rules tab with FIA PDF link and a "common topics" surface.
- Implement lib/results/<slug>.ts and lib/standings/<slug>.ts for MotoGP, WEC, IndyCar, NASCAR.
- NASCAR trend chart polish — 47-driver legend cluttering, leader-vs-tail spread crushes the bottom cluster, Y-axis only labels 150 and 600. Fix candidates: cap legend to top-N drivers, drop "(i)" / "(R)" suffix from labels, more Y-axis ticks, optional log scale or zoom-to-leaders default. Operator-flagged on /series/nascar-cup?tab=results 2026-05-22.
- TheSportsDB free tier evaluation done 2026-05-22 — skip, doesn't cover NASCAR/WRC/DTM/F1/MotoGP/IMSA/WEC/IndyCar/FE on free key, only V8/BTCC/British GT/WorldRX/WorldSSP. Paid Patreon (~$10/mo) might unlock more but data is schedule-only on free tier. Do not re-evaluate.
- Sportmonks F1 API — only commercial source with lap/pit/stint/livescore data for F1. F1-only and ~€19+/mo. Park until Paddock builds a live-timing roadmap; revisit then.
- API-Sports F1 v1 — alternative to Jolpica if Jolpica becomes unreliable. F1-only, 100 req/day free tier. **Docs page 403s datacenter IPs** (same CF failure mode as racing-reference); MUST be tested from a Vercel preview before any adoption attempt.
- Add a custom app/error.tsx page.
- Integrate Sentry for error monitoring.
- Add /api/cron/health summarising last-run timestamps for every cron job.
- Run a Lighthouse and Speed Insights perf audit and act on findings.
- Make it faster — explicit performance pass beyond the audit (image optimisation, bundle size, hydration cost, route-segment caching, Suspense boundaries).
- App best-practices pass — error boundaries on every route segment, loading states, Next.js 16 idiomatic patterns (cache directives, segment configs), proper Suspense boundaries with sensible fallbacks.
- Fix the nine legacy ESLint errors and add a husky pre-commit hook.
- Add component tests with vitest + Testing Library.
- Add Playwright E2E tests that run on Vercel preview deploys.
- Build a comments thread (Clerk-gated) on race-weekend pages.
- Build predictions with an open → locked-at-session-start → resolved-after-race state machine.
- Persist active news-filter chip across page reloads.
- Run a mobile-first UI/UX audit using the tailwindcss-mobile-first patterns.
- Run a WCAG 2.2 AA accessibility audit and fix gaps.
- Polish motion, focus states, and dark-mode contrast across the site.
- Run user research via a site survey, conversations with fans, and subreddit pain-point mining.
- Research about consumer mindset and psychology to inform what we're building and how it's framed.
- Add per-event-type push notifications (qualifying topper via RSS filter, race winner, championship-deciding event).
- Custom notifications — per-user rules (e.g. only notify for F1 + MotoGP race day, skip practice).
- Notification sound refinement — per-series default sound, per-type variants, optional pre-race chime vs news ping.
- Notification badge icon refresh — chequered-flag motif on `public/icons/badge-96.png`. Current monochrome is functional but generic.
- Make the push click handler deep-link to a specific session or article instead of always opening /.
- Build a Settings "Your devices" list with per-device test and remove buttons.
- Send hero images in push payload.image, sourced from curated circuit JPEGs or motorsport.com thumbnails.
- Investigate per-series Champions JSON to fix fragile parser (F1 wrong points column, F3 all zero, MotoGP brittle redirects).
- Delete unused lib/onboarding.ts (only wizard-reopen consumer).
- DRY the duplicated logic between EnableNotifications and OnboardingWizard.
- Retheme the Clerk sign-in/sign-up pages + UserButton to Paddock 1.0 light + dark.
- Migrate the remaining PWA-only modals (OnboardingWizard, EnableNotifications, PWAInstallPrompt, NotifPrefsSection, SettingsClient) to Paddock 1.0 tokens.
- Migrate `components/mdx/mdx-components.tsx` to Paddock 1.0 tokens.
- Add a WeekendMedia section to /series/<slug>/weekend/<round> fed by content/series/<slug>/media.json (YouTube highlight reels, blog cross-links, onboard clips).
- Choose an embedded-video provider (YouTube iframe vs Mux vs Cloudflare Stream).
- Embed YouTube highlights + extended-highlight videos on past weekend pages, and add dedicated season / month recap pages with embedded season-highlight videos + written blog text + standings snapshots at that point.
- Add a Tracks/Circuits view per series with a map.
- Make the home hero show the next 2–3 sessions when all are imminent.
- Make session cards tap-to-expand to broadcast info, streaming, and track details.
- Add per-driver season-trend chart on /drivers/[slug].
- Add era markers and sparklines to the Champions tab.
- Fold overview.md content fully into the F1 About tab.
- Surface "common topics" on the Rules tab.
- Rotate sk_live_* Clerk keys.
- Surface per-weekend car upgrades on the F1 weekend page — what each team brought to this round, sourced from the FIA Car Presentation Document or scraped from F1.com / motorsport.com. RapidAPI's "Formula 1 Technical Upgrades" by SebastianL documents the data shape.
- Live in-race data feed (lap-by-lap, telemetry, sector splits) for the live-now view on race day. Implementation hint: RapidAPI's "F1 Live Timing - Telemetry and GPS" is one candidate; canonical long-term path is Pulselive backend for MotoGP/WSBK + Jolpica live extensions for F1.
- Per-session results-fetch lifecycle — when a session ends, fire Phase 1 (positions, times, basic video/news → `result` table); fire Phase 2 hours-to-days later (interviews, race reports, highlight videos appended to weekend news + media). Uses `session.end_instant_utc` as the trigger boundary. Implementation: Vercel cron sweep + `results_fetched_at` dedupe; not literal per-session timers. Formula E is the first concrete target — no results coverage today.
- Head-to-head comparison for drivers — pick two, see season stats, qualifying / race deltas, fastest lap, points trajectory. Possibly delivered as a magazine-style page or article.
- Head-to-head comparison for constructors — same shape but team-vs-team.
- Calendar UI — month-tabbed / swipeable view instead of one massive scroll per series. Pairs with mobile-first audit.
- Contact form categories — dropdown for "Bug report" / "Feature request" / "Suggested change" / "General" so submissions self-triage. Today the form is plain email + body.
- Admin UI for adding pages + content — lightweight authoring interface beyond the conversational "Claude edits files + commits" flow. Useful when Claude isn't available or for Fotis-driven content updates.
- IA / navigation restructure pass — easier mental model. May follow user research. Suspect candidates: nest some tabs, surface "current weekend" at top of home, regroup series by category (formula / motorcycle / endurance / oval / rally).
- "Live Now" section improvements — currently a thin pinned strip. Expand to show current session / lap / leader / gaps when live, not just "Live now: F1 Practice 2".
- Champions tab visual redesign — better card layout, era groupings, image avatars. Pairs with the Champions JSON cleanup.
- News articles content pipeline — beyond MDX blog scaffolding (shipped 0.8.0), set editorial direction + draft first posts. Tied to Parked item "Write first 2–3 MDX blog posts".
- Offline mode — service worker caching of the next 7 days of weekend data so the PWA still renders on the underground or at a circuit with no signal. Pairs with the existing serwist setup.
- Split Web app from a real Play Store / App Store wrapper — defer until there's profit motive. Currently the PWA installs as a homescreen app on both platforms which is good enough for v1.
- Lift `--tint` to `<html>` so the sidebar drawer's active series link picks up the series accent on /series/<slug> routes — currently it stays global signal-amber because the sidebar is outside the page-wrapper scope.
- Sidebar `--tint` follow-up — requires a server-side route lookup per request to determine the active series.
- Champions tab label for singleEvent series — rename "Champions" → "Past Winners" since it's functionally a list of 24h winners rather than season champions.
- WeekendMedia content seed — `content/series/<slug>/media.json` with YouTube highlight IDs + circuit imagery for the next 4 race weekends.
- User-authored blogs + threads with review-then-publish moderation flow; likely needs Supabase auth + role-based privileges; research existing UGC blog platforms (Substack, Ghost, Discourse threads) for prior art before designing.
- Per-series calendar feeds — webcal/ICS endpoint (e.g. /api/calendar/<slug>.ics) proxying curated session data so fans subscribe in Apple/Google Calendar; unlocks the mockup's "Sync your calendar" perk card on the landing (cut from 0.13.1 for honesty).
- Results re-check lifecycle (operator 2026-06-12): re-verify session results at +1w / +1m / season-end because penalties get overturned late — Gasly's Monaco podium reinstated ~a week after the race and Jolpica was still pre-correction on Jun 12; shape = KV results snapshot + scheduled diff cron + curation alert, pairs with results-overrides.json.
- OpenF1 anonymous lockout during live F1 sessions (found 2026-06-12): API 401s ALL endpoints incl. historical whenever a session is live, so F1 per-session classifications break exactly on race weekends; fix = persist-once to KV (+ optional €9.90/mo sponsor key as belt-and-suspenders). → PARTIALLY ADDRESSED 0.39.1 (PR #159): captured session classifications now KV-persist (7-day TTL) and render through the lockout; residual = a cold/expired entry first opened *during* a lockout still can't fetch.
- Pre-warm cron for weekend session pages (follow-up to 0.39.1): ping past-session classification pages (or write directly to the session-class KV) so cold/expired entries are already cached before any live OpenF1 lockout — closes the residual gap above; pairs with the /api/just-missed cache-warm cron candidate.
- Information-density pass (operator 2026-06-12, "serious discussion"): multiple users report pages show too much — needs a per-page information-budget review (what question does each page answer in 5 seconds; rest behind disclosure); pairs with W5 per-page layout spec.
- Home v3 (operator 2026-06-12, direction agreed): two-block home — "Just missed" (results + article link + later media) and "Up next" (countdown + official stream link) with ranking/caps (followed-first, hard cap ~3, hero + quiet rows); news demoted to secondary strip; spec to be written as the W5 design session AFTER audit highs land (MotoGP/FE weekend-URL fixes + device-local times gate it).
- Landing scroll-driven animation set-piece (operator 2026-06-12): "as you scroll an F1 car comes near the screen" — draft-form prototype first; candidate tech: CSS scroll-driven animations (animation-timeline: scroll) or canvas image-sequence scrub; landing-only, prefers-reduced-motion static fallback, perf budget (no jank on mid phones); sequence after home v3.
- Android app dedicated discussion (operator 2026-06-21): revisit TWA/Play Store status — closed test, Play App Signing fingerprint to append after the .aab upload, branded offline route + serwist fallbacks, manifest id/scope/shortcuts.
- Minigames (operator 2026-06-21): "guess the driver" and "guess the track" from photos of top drivers per category, "guess next turn" (show one corner of a circuit, user guesses if the next corner is left or right), and more — engagement/retention feature.
- Re-look into the curated PRs for post-session blog posts (operator 2026-06-21).
- Copyright-free photos of ALL drivers + ALL team logos (operator 2026-06-21) — licensing-led curation program (Wikimedia + per-image attribution, the landing circuit-photo pattern); feeds driver/team pages, the JUST MISSED block, and the minigames.
- Race-weekend track-map photo showing sectors/corners (operator 2026-06-21) — per-circuit sector diagram on the weekend page.
- /api/just-missed cold-on-cold TTFB ~13.8s (audit 2026-06-21): warm HIT 0.44s but full season-results fan-out (WEC live-component + MotoGP no parser cache) runs when edge + KV podium caches both cold; fix candidates = cache-warm cron pinging the route, or add parser-level KV cache to lib/results/motogp.ts.
- Geo-restricted highlight clips (operator 2026-06-21): some curated WeekendMedia highlights in content/series/<slug>/media.json point to unofficial/random YouTube channels whose uploads are region-locked (won't play outside their country); audit every curated clip's global availability and replace with official-channel uploads (FIA WEC / F1 / etc.) per the search-official-source rule.
- Paddock Betting game (S9 trigger, operator 2026-06-22): virtual-credit betting (NO cashout — the anchor), free + optional paid IAP, win-rate leaderboard, persistent deliberately-lean bankroll, pari-mutuel + model + odds-API hybrid pricing; full spec + locked decisions in `docs/research/predictions-design.md`; gated on Supabase provisioning + legal review (paid path = simulated-casino category, geo/age gated).
- Native Android rebuild spike (operator 2026-06-22): built + flashed to Pixel 9 (`C:\Dev\Personal\paddock-android`, Compose + /api/just-missed); Android toolchain installed cold; polish parked (chequered-flag icon + Paddock theme); proves on-device feasibility, NOT that the full 15-series/auth/push/content rewrite is cheap — detail still punts to web.
- MotoGP standings chart under-count (0.41.0 follow-up): chart sums 132 vs standings 157 (Di Giannantonio) — a round/session dropped under the finisher floor in `fetchMotoGPSeasonResults`; fix → MotoGP joins the F2/F3/WSBK chart set.
- Standings last-good resilience (operator's "both #2", owed): KV fallback so a transient motorsport.com/datacenter failure can't blank standings; also softens cold-load delays across motorsport.com-sourced series.
- NLS Nürburgring results (operator 2026-06-21): no results today; Phase-1 source = teilnehmer.vln.de PDF; new scraper, DTM-shaped, datacenter-verify required.
- Session-page → series-tab navigation (operator 2026-06-22): from a weekend/session page, reaching a series' Standings is "too far back"; breadcrumb isn't an obvious back-path — IA polish, pairs with path-based tabs (B11).
- Remaining standings charts FE/IndyCar/GT-World/IMSA/WEC (after MotoGP): data-gated — winners-only / no per-position points; GT-World/IMSA/WEC need a per-series points-scale module before a chart can reconcile.
- Standings charts = ranked name + points list (operator 2026-06-22): each chart should show driver name + points sorted descending (most points at top → least at bottom), not only a points-over-time trend; refines the MotoGP + remaining-series standings-chart items above.
- Betting — open more markets across more SERIES (operator 2026-06-22): lead-time shipped 0.48.0 (next 3 F1 weekends open at once); remaining = non-F1 series, gated on per-series winner-race disambiguation (F2/F3/MotoGP/WSBK have sprint+feature) + standings↔results driver-name verification + datacenter check (blockers in HANDOFF).
- Betting — new market types (operator 2026-06-22): PODIUM + TOP-10 + EXACT-POSITION engines shipped dormant (0.49.0–0.51.0) + multi-market UI (0.50.0) — pricing + settle migrations + verify scripts done, not auto-opened (go-live steps in HANDOFF); exact-position is engine-done but UI-blocked (2-field driver+position pick needs a bespoke selector); remaining = grid/qualifying-position (quali-pace model + a `market_type` enum addition).

- Betting — odds from real betting apps, not the standings model (operator 2026-06-22): bet multipliers should come from a real bookmaker odds API, not the championship-points model. Hybrid — books price F1 race winner (+ maybe podium/points-finish) but NOT exact-position/grid, so the model stays the fallback for those; still clamp API odds through the house band (MIN 1.3 / MAX 30 + margin) so the no-900× economy holds. Needs a provider + paid-key decision + provider↔standings driver-name matching. This is the long-planned "odds-API adapter" (predictions-design.md); pricing.ts already has a clean seam (winMultipliers etc. feed createMarket).

- Leagues overhaul (operator 2026-06-22, APPROVED + building): dedicated league page, per-league settings, per-member nicknames + colours (anyone can set for anyone), invite LINKS (not just code) that prompt account-create + join + a friend request to the inviter (prompted accept, not auto), month/season prizes = titles/badges for top 3. Needs a global friends graph (in-league you can friend non-friends). Phased: **P1 friends DONE 0.55.0** (`friendship` table + `/api/friends` + `/play` Friends section + verify), **P2 invite links + join-&-befriend DONE 0.56.0**, **P3 league page + nicknames/colours/settings + owner disband/kick DONE 0.57.0**, P4 prizes. Friends global; leagues invite-only.
- Dedicated Social area (operator 2026-06-22, IA locked): friends + leagues are NOT children of /play; play stays /play. Group them under a new `social` area — `/social/friends` + `/social/leagues` (+ a `/social` index), relocate league detail to `/social/leagues/[id]`. Post-P4.
- Landing-page marketing for the betting/leagues/social game (operator 2026-06-22): the predictions + friend-leagues feature needs a marketing section on the landing page to drive sign-ups — plan a solution (honest no-cashout social-game framing).
- Richer league leaderboard (operator 2026-06-23, brainstorm later): the leaderboard should surface more than name + W/L + win-rate — candidate columns to brainstorm: total staked/returned (net credits), biggest single win, current win/loss streak, last-N form, podium/title (honours) count, member colour dot, # bets this period; needs a design pass + which are cheap from existing data vs need new aggregation.

## Parked (might do, with a revisit trigger)

- **GitHub Actions CI workflow (typecheck + vitest on PRs).** Why parked: prior CI attempts on other repos always failed on the first PR. The shape is ~20 lines and unambiguous, but the user has zero tolerance for noisy red checks. Revisit when we can pair-debug a known-green workflow on a throwaway branch first, *then* merge it. Likely root causes when we get to it: action-version drift, `npm ci` vs `npm install` on lockfile mismatch, GITHUB_TOKEN scope, or branch-trigger mismatches.
- **Paddock-coins ledger + leaderboard.** Why parked: depends on Supabase + comments. Revisit after S9 (race-weekend Part 2) lands.
- **Public README with screenshots + Mermaid architecture diagram.** Why parked: post-v1.0 polish, has zero user-facing impact today. Revisit when prepping for LinkedIn showcase.
- **Write first 2–3 MDX blog posts.** Why parked: blog scaffolding is shipped (0.8.0) but no content yet. Needs an editorial direction first. Revisit when user has time for writing.
- **Another "Claude design" depth pass** for background warmth and global theming. Why parked: Paddock 1.0 restyle just shipped (0.10.0). Revisit after the next user-research pass surfaces specific complaints.
- **Era markers / sparklines on Champions tab.** Why parked: relies on having clean curated champions data per series; current scrape is fragile. Revisit after the Champions JSON cleanup.
- **GDPR / cookie-consent banner for Google Analytics 4.** Why parked: shipped 0.9.15 GA4 sets cookies without consent — fine for ~30 visitors/day, not fine at scale. Revisit at ~500 visitors/day or a real legal complaint.
- **B8b — SoftwareApplication JSON-LD on `/`.** Why parked: per `docs/seo-geo-playbook.md` Part 4, semantic fit is perfect (`WebApplication` + `applicationCategory: "SportsApplication"`) but the schema's `aggregateRating` / `review` requirement is a hard blocker. Emitting without yields invalid markup + zero rich-result eligibility. Revisit when Paddock has either real user-review infrastructure or at least one editorial review to cite. Annual re-evaluation.

## Killed (won't do — with one-line why)

_(empty — promote items here when we explicitly decide to drop them so they don't relitigate)_
