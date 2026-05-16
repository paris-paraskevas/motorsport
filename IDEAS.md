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

1. Curate `sessions.json` real session hours for the most-followed non-F1 series (start with MotoGP + WEC + IMSA + Formula E rounds beyond Monaco), so the "3 am" placeholder disappears across the calendar.
2. Investigate residual `00:00` string on /series/f1/weekend/5 to confirm it's a legit session time vs leftover fake — visually verify in a real browser once Playwright is unlocked.
3. Scope the Supabase + scheduled-scrape initiative (decide table shapes, scraper boundaries, what stays as files) before starting any code.

## Next (≤ 5, queued — start within ~1–2 weeks)

1. Supabase migration: provision via Vercel Marketplace, draft schema for sessions / standings / results / news / weather snapshots, draft per-series scrape jobs (Vercel Cron + Sandbox/Playwright for JS-rendered sites). Reframe of S4.
2. Research existing public motorsport data sources (Ergast/jolpica for F1, MotoGP web API, FIA feeds, third-party aggregators) before building scrapers from scratch — could be a write-up doc rather than code.
3. Curate `rounds.json` for the rest of the non-F1 series so FIA-canonical round numbers replace array-index fallback.
4. Audit endurance-series weekend grouping (WEC / IMSA / NLS / ADAC 24h races + multi-day tests) for `groupByWeekend` mis-splits — pairs with the curation pass.
5. SEO baseline (S5): `app/sitemap.ts`, `app/robots.ts`, JSON-LD (SportsEvent / Organization / Person / BreadcrumbList), per-page `generateMetadata`, OG image generators, canonicals.

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

## Parked (might do, with a revisit trigger)

- **GitHub Actions CI workflow (typecheck + vitest on PRs).** Why parked: prior CI attempts on other repos always failed on the first PR. The shape is ~20 lines and unambiguous, but the user has zero tolerance for noisy red checks. Revisit when we can pair-debug a known-green workflow on a throwaway branch first, *then* merge it. Likely root causes when we get to it: action-version drift, `npm ci` vs `npm install` on lockfile mismatch, GITHUB_TOKEN scope, or branch-trigger mismatches.
- **Paddock-coins ledger + leaderboard.** Why parked: depends on Supabase + comments. Revisit after S9 (race-weekend Part 2) lands.
- **Public README with screenshots + Mermaid architecture diagram.** Why parked: post-v1.0 polish, has zero user-facing impact today. Revisit when prepping for LinkedIn showcase.
- **Write first 2–3 MDX blog posts.** Why parked: blog scaffolding is shipped (0.8.0) but no content yet. Needs an editorial direction first. Revisit when user has time for writing.
- **Another "Claude design" depth pass** for background warmth and global theming. Why parked: site already looks decent. Revisit after the next user-research pass surfaces specific complaints.
- **Era markers / sparklines on Champions tab.** Why parked: relies on having clean curated champions data per series; current scrape is fragile. Revisit after the Champions JSON cleanup.

## Killed (won't do — with one-line why)

_(empty — promote items here when we explicitly decide to drop them so they don't relitigate)_
