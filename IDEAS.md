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

1. **Curate `rounds.json` for the bottom 8 series** — DTM, GTWCE, NLS, NASCAR Cup, WRC, plus IndyCar R11–R14 + R17 (Mid-Ohio / Music City / Portland / Markham / Laguna Seca), MotoGP postponement-cascade consistency check, ADAC 24h, Formula E (R11 Sanya gap + venue-named rounds.json). After this lands, every series has canonical round numbers — array-index fallback is fully retired.
2. **Wire weather + news for every series.** For each of 15 series, click into next upcoming weekend, confirm Open-Meteo weather (venue-local date per `feedback-paddock-weather-venue-local`) and news feed populate. Output: gap list + curation pass. Sunday's calendar-correctness work was about *correctness* of round numbering; this is the still-pending *coverage* audit.
3. **IMSA P1 + FE Sanya R11 + F1 Azerbaijan `endDate` curation patches.** Three small gaps surfaced in Sunday's audit. IMSA R6–R11 missing Practice 1, FE Sanya R11 (Jun 20) missing session times, F1 Azerbaijan `rounds.json` says `endDate: 2026-09-27` but actual race is Saturday Sep 26.

## Next (≤ 5, queued — start within ~1–2 weeks)

1. **Provision Supabase + run 001_extensions → 008_rls migrations** following `docs/research/supabase-schema-draft.md`. Comes after Tuesday Fotis sit-down where we close the 10 open questions in the doc.
2. **Endurance-series weekend grouping audit.** WEC / IMSA / NLS / ADAC 24h races + multi-day tests can split weirdly via `groupByWeekend`'s 4-day gap heuristic. Re-verify after the rounds.json curation wave.
3. **SEO baseline (S5).** `app/sitemap.ts`, `app/robots.ts`, JSON-LD (`SportsEvent` / `Organization` / `Person` / `BreadcrumbList`), per-page `generateMetadata`, OG image generators, canonicals.
4. **GDPR / cookie-consent banner for Google Analytics 4.** Revisit trigger: ~500 visitors/day or a real legal complaint. Today's GA wiring (PR #7) ships cookies without consent — fine for a 30-visitors/day personal project, not fine at scale.
5. **Native non-F1 results + standings (S7).** Implement `lib/results/<slug>.ts` + `lib/standings/<slug>.ts` for MotoGP → WEC → IndyCar → NASCAR. Comes after Supabase tables land — those are the storage backing.

## Inbox (unfiltered, append-only)

- Research live in-race data feeds (sector times, leaderboard, gaps, tyre choices) for F1, MotoGP, WEC, FE, IndyCar.
- Reverse-engineer fiaformulae.com / motogp.com / nascar.com XHR endpoints to see if unsigned JSON can replace Playwright.
- Decide Sandbox/Playwright vs third-party aggregator vs curation-first for JS-rendered official sites.
- Enrich /drivers/[slug] with Wikipedia bio, current standings position, last 5 results, news mentions.
- Enrich /teams/[slug] with the same shape.
- Redesign F1 History tab or replace with curated content/series/f1/history.md.
- Improve Rules tab with FIA PDF link and a "common topics" surface.
- Implement lib/results/<slug>.ts and lib/standings/<slug>.ts for MotoGP, WEC, IndyCar, NASCAR.
- Add a custom app/error.tsx page.
- Integrate Sentry for error monitoring.
- Add /api/cron/health summarising last-run timestamps for every cron job.
- Run a Lighthouse and Speed Insights perf audit and act on findings.
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
- Add per-event-type push notifications (qualifying topper via RSS filter, race winner, championship-deciding event).
- Make the push click handler deep-link to a specific session or article instead of always opening /.
- Build a Settings "Your devices" list with per-device test and remove buttons.
- Send hero images in push payload.image, sourced from curated circuit JPEGs or motorsport.com thumbnails.
- Investigate per-series Champions JSON to fix fragile parser (F1 wrong points column, F3 all zero, MotoGP brittle redirects).
- Delete unused lib/onboarding.ts (only wizard-reopen consumer).
- DRY the duplicated logic between EnableNotifications and OnboardingWizard.
- Retheme the Clerk sign-in and sign-up pages to Paddock dark.
- Add a WeekendMedia section to /series/<slug>/weekend/<round> fed by content/series/<slug>/media.json (YouTube highlight reels, blog cross-links, onboard clips).
- Choose an embedded-video provider (YouTube iframe vs Mux vs Cloudflare Stream).
- Add a Tracks/Circuits view per series with a map.
- Make the home hero show the next 2–3 sessions when all are imminent.
- Make session cards tap-to-expand to broadcast info, streaming, and track details.
- Add per-driver season-trend chart on /drivers/[slug].
- Add era markers and sparklines to the Champions tab.
- Fold overview.md content fully into the F1 About tab.
- Surface "common topics" on the Rules tab.
- Install Resend Marketplace and wire RESEND_API_KEY + CONTACT_TO_EMAIL so contact-form submissions email out.
- Rotate sk_live_* Clerk keys.
- Surface per-weekend car upgrades on the F1 weekend page — what each team brought to this round, sourced from the FIA Car Presentation Document or scraped from F1.com / motorsport.com. Implementation hint: RapidAPI's "Formula 1 Technical Upgrades" by SebastianL documents the data shape (stale repo but useful schema reference).
- Live in-race data feed (lap-by-lap, telemetry, sector splits) for the live-now view on race day. Implementation hint: RapidAPI's "F1 Live Timing - Telemetry and GPS" (recently updated) is one candidate; the canonical long-term path is the Pulselive backend for MotoGP/WSBK and Jolpica live extensions for F1.
- Embed YouTube highlights + extended-highlight videos on past weekend pages, and add dedicated season / month recap pages when a period wraps with embedded season-highlight videos + written blog text on how it went + standings snapshots at that point.
- Distinct session pages with results / gaps / stints / pit stops once a session has finished — one page each for FP1 / FP2 / FP3 / Qualifying / Sprint / Race rather than today's roll-up. Surfaces session-level data we'll have once the S7 results work lands.
- NASCAR practice + qualifying coverage — source publishes race-week, requires a per-week curation cron rather than annual upload like F1.
- GTWCE deep audit — R12 (24h Spa), R13 (Magny-Cours Sprint), R16 (Barcelona Endurance) thin session data; revisit when those events get closer to confirm we've matched the FIA-published timetable.
- Husky pre-commit hook to enforce CHANGELOG.md + RELEASES.md + package.json updated together — catches "forgot to bump version" or "engineering log updated but public-facing notes drifted" before push.
- Reviewer's info-disclosure cleanup pass — KV key patterns (`paddock:contact:*`) and internal endpoint enumeration in old CHANGELOG entries help attackers target the surface even though no secrets leaked. Strip these from public-facing copies (RELEASES.md should be clean; CHANGELOG.md can keep them since it's git-only now).
- UUID v7 generator helper for Supabase — drop-in when a Postgres-native v7 lands or via a `uuid_v7_generate()` plpgsql function for the high-write tables (audit log, session). Defer per `docs/research/supabase-schema-draft.md` §17 Q1.
- Migration script `migrate_from_json.ts` — walks `content/series/**/*.json` and emits INSERT statements with `manual_override = TRUE` against the Supabase schema. v1.5 work after the schema actually exists.
- WEC R3 Le Mans is intentionally 2-day (Jun 13–14) per FIA — already handled in `rounds.json`, but verify nothing in the endurance-grouping audit breaks on it.
- DTM Norisring R4 sessions — awaits ADAC official schedule publication; unique split-quali format means template projection would produce wrong session titles.
- WRC mid-season stages for Sweden, Safari Kenya, Japan, Greece, Estonia, Paraguay, Chile, Italy Sardegna, Saudi Arabia — official itineraries publish 4–6 weeks pre-rally.
- Head-to-head comparison for drivers — pick two, see season stats, qualifying / race deltas, fastest lap, points trajectory. Possibly delivered as a magazine-style page.
- Head-to-head comparison for constructors — same shape but team-vs-team.
- Calendar UI — month-tabbed / swipeable view instead of one massive scroll per series. Pairs with mobile-first audit.
- Notification badge icon refresh — try a chequered-flag motif on `public/icons/badge-96.png`. Current monochrome is functional but generic.
- Contact form categories — dropdown for "Bug report" / "Feature request" / "Suggested change" / "General" so submissions self-triage. Today the form is plain email + body.
- Admin UI for adding pages + content — lightweight authoring interface beyond the conversational "Claude edits files + commits" flow. Useful when Claude isn't available or for Fotis-driven content updates.
- IA / navigation restructure pass — easier mental model. May follow user research. Suspect candidates: nest some tabs, surface "current weekend" at top of home, regroup series by category (formula / motorcycle / endurance / oval / rally).
- "Live Now" section improvements — currently a thin pinned strip. Expand to show current session / lap / leader / gaps when live, not just "Live now: F1 Practice 2".
- Champions tab visual redesign — better card layout, era groupings, image avatars. Pairs with the Champions JSON cleanup.
- Notification sound refinement — per-series default sound, per-type variants, optional pre-race chime vs news ping.
- News articles content pipeline — beyond MDX blog scaffolding (already shipped 0.8.0), set editorial direction + draft first posts. Tied to existing Parked item "Write first 2–3 MDX blog posts".
- Make it faster — explicit performance pass beyond the audit (which is measurement only). Image optimisation, bundle size, hydration cost, route-segment caching, Suspense boundaries.
- App best-practices pass — error boundaries on every route segment, loading states, Next.js 16 idiomatic patterns (cache directives, segment configs), proper `Suspense` boundaries with sensible fallbacks.
- Per-session results-fetch lifecycle — when a session ends, fire Phase 1 (positions, times, basic video/news to the `result` table); fire Phase 2 a few hours / 1-2 days later (interviews, race reports, highlight videos appended to weekend news + media). Uses `session.end_instant_utc` as the trigger boundary. Implementation: Vercel cron sweep + `results_fetched_at` dedupe; not literal per-session timers. Formula E is the first concrete target — no results coverage today. Depends on Supabase tables landing + per-series fetchers (Inbox #16) + distinct session pages (Inbox #53) for full effect, but Phase 1 alone is shippable against the existing weekend page.
- ADAC Ravenol 24h Nürburgring — special-case as a single-event series (Option B from Sunday's triage). Add a `singleEvent: true` flag to `meta.json` (or a new category `endurance_oneshot`). `app/series/[slug]/page.tsx` renders a slimmer tab set for single-event series: Calendar + About + Past Winners (rename of Champions) + officialSite link. Hide Standings / Results / Drivers-as-season-roster tabs via category check. Preserves the 0.8.0 + 0.9.10 work and represents the event honestly instead of pretending it's a multi-round championship. NLS Nürburgring is unaffected — it's a real 10-round series.

## Parked (might do, with a revisit trigger)

- **GitHub Actions CI workflow (typecheck + vitest on PRs).** Why parked: prior CI attempts on other repos always failed on the first PR. The shape is ~20 lines and unambiguous, but the user has zero tolerance for noisy red checks. Revisit when we can pair-debug a known-green workflow on a throwaway branch first, *then* merge it. Likely root causes when we get to it: action-version drift, `npm ci` vs `npm install` on lockfile mismatch, GITHUB_TOKEN scope, or branch-trigger mismatches.
- **Paddock-coins ledger + leaderboard.** Why parked: depends on Supabase + comments. Revisit after S9 (race-weekend Part 2) lands.
- **Public README with screenshots + Mermaid architecture diagram.** Why parked: post-v1.0 polish, has zero user-facing impact today. Revisit when prepping for LinkedIn showcase.
- **Write first 2–3 MDX blog posts.** Why parked: blog scaffolding is shipped (0.8.0) but no content yet. Needs an editorial direction first. Revisit when user has time for writing.
- **Another "Claude design" depth pass** for background warmth and global theming. Why parked: site already looks decent. Revisit after the next user-research pass surfaces specific complaints.
- **Era markers / sparklines on Champions tab.** Why parked: relies on having clean curated champions data per series; current scrape is fragile. Revisit after the Champions JSON cleanup.

## Killed (won't do — with one-line why)

_(empty — promote items here when we explicitly decide to drop them so they don't relitigate)_
