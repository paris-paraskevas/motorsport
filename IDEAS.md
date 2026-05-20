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

1. **B-perf execution (Wed 2026-05-20).** Multi-PR mobile-perf push. Baselines captured in `docs/perf-baselines.md`; 4-PR sequenced plan in `SCHEDULE.md` Wed entry. Biggest levers: Clerk lazy (~225 KiB unused JS), 3rd-party deferral of AdSense+GTM+FundingChoices (~319 KiB), preconnect `clerk.paddock-tracker.com` (90 ms LCP), CSS critical-path. Target mobile Perf ≥75 / LCP ≤2.5 s. B9 server-render stays as a separate session.
2. **Fotis Supabase sit-down.** Walk `docs/research/supabase-schema-draft.md` together, close the 10 open questions in §17. If shape holds → start the 12-step migration order in §18. Verify state at session start — per HANDOFF "may be in progress / done by next session".
3. **Weather + news coverage audit (15 series).** For each series, click into the next upcoming weekend and confirm Open-Meteo weather (venue-local date per `feedback-paddock-weather-venue-local`) + news feed populate. Output: per-series gap list + curation pass.

## Next (≤ 5, queued — start within ~1–2 weeks)

1. **Supabase provisioning + run migrations 001 → 008.** Post-Fotis sit-down. Provision via Vercel Marketplace, then execute the 12-step plan from §18 of the schema draft.
2. **Track B continuation — multi-day bundles.** **B-content** (fill 14 history tabs + 15 rules tabs + 3–5 blog posts, 80–130 h, multi-session, follow F1 history template), **B11** (path-based tab routes `/series/[slug]/[tab]`, 1–2 days), **B12** (Greek `/el/` route tree via `next-intl`, 3–5 days). All deferred from the 2026-05-19 push; see `docs/seo-geo-playbook.md` Part 4 for scope. Supersedes the old "SEO baseline (S5)" entry which is now executed in pieces under Track B.
3. **ADAC Champions tab → curated past winners.** With the singleEvent slim tab set live (0.10.1), the Champions tab is now a fan's main destination on `/series/adac-ravenol-24h`. Today's Wikipedia scrape may not produce a clean list — verify and curate `content/series/adac-ravenol-24h/champions.json` if needed.
4. **Endurance-series weekend grouping audit.** WEC / IMSA / NLS / ADAC 24h races + multi-day tests can split weirdly via `groupByWeekend`'s 4-day gap heuristic. Verify case-by-case now that rounds.json curation has landed across all 15 series.
5. **Curation patches deferred from 0.10.1.** IMSA Practice 1 on R6–R11 (per-race timetable lookups — publishes race-week), FE Sanya R11 session times (waiting on official Formula E timetable). Bundled PR when timetables drop.

_(Native non-F1 results + standings, S7 — depends on Supabase storage tables landing first. Stays queued behind item 1.)_

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
