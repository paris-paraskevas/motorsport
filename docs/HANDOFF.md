# Paddock — handoff

The running operational record. Read at session start. Update at session end.

This replaces the per-user memory handoff that lived at `~/.claude/projects/C--Dev-Personal-Motorsport/memory/project-paddock-handoff.md` until 2026-05-16. Memory file is now a redirect stub.

---

## Quick context

- **Repo:** `paris-paraskevas/motorsport` (private).
- **Live URL:** https://paddock-tracker.com. Vercel project name: `motorsport`.
- **Branch:** `main`. **Workflow:** branch → PR → review → squash-merge. See `CONTRIBUTING.md`.
- **Contributors:** Paris (paris-paraskevas) — deploy steward. Fotis — joining as contributor #2. Onboarding doc: `ONBOARDING.md`.
- **Stack:** Next.js 16 App Router (middleware in `proxy.ts`), React 19, Tailwind v4, `@serwist/next` PWA, Clerk Production auth, Vercel KV (Upstash Redis). Public-with-account auth model.
- **GitHub CLI authed** as `paris-paraskevas` with `repo` + `workflow` scopes. **Vercel CLI** previously installed; reinstall via `npm i -g vercel` if a session needs it.
- **Current version:** see `package.json`. Bump on every push (`feedback-paddock-release-notes` rule, `CONTRIBUTING.md` mandate).

## Critical landmines — do not break

Detailed in inline comments + memory rules. Quick reference:

1. `next.config.ts` keeps **both** `serverExternalPackages: ["node-ical"]` **and** `outputFileTracingIncludes` for node-ical transitive deps. Either one alone breaks production fetches. Memory: `feedback-vercel-node-ical`.
2. Middleware file is `proxy.ts` in Next 16, **not** `middleware.ts`. `clerkMiddleware()` itself unchanged.
3. KV env vars must be unprefixed: `KV_REST_API_URL`, `KV_REST_API_TOKEN`. Reject any "STORAGE" prefix from the Vercel Marketplace flow.
4. Clerk publishable key must keep `NEXT_PUBLIC_` prefix exactly. **Vercel Marketplace integration auto-creates env-var placeholders but leaves them EMPTY when promoted to Production.** Paste real `pk_live_*` / `sk_live_*` manually (Production scope), `pk_test_*` / `sk_test_*` for Preview + Development.
5. Notification badge must be monochrome (`public/icons/badge-96.png`). Regenerate via `scripts/gen-badge.py` if changed.
6. Crons accept missing `CRON_SECRET` as "allow" and require `Authorization: Bearer $CRON_SECRET` when set. Pattern in `app/api/cron/notify/route.ts`.
7. Open-Meteo lookups must use **venue-local** date, never UTC. Evening-session weather pulled the wrong day before the fix. Memory: `feedback-paddock-weather-venue-local`.
8. **Vercel CLI quirks:** `echo 'VALUE' | vercel env add NAME ENV` works for Production + Development. **Preview** needs `vercel env add NAME preview '' --value 'VALUE' --yes` — pass `''` as the git-branch positional. Single-quote values containing `$` (publishable keys end with `$`; bash will eat them).
9. **Date-only ICS entries** (`DTSTART;VALUE=DATE`) flow through `lib/ics.ts` with `Session.dateOnly: true`. UI must render "TBC", live-now must skip, notifications must never fire. Don't trust a Date that's anchored at UTC midnight.
10. **Round numbers are canonical, not array indices.** Source from `content/series/<slug>/rounds.json` via `lib/rounds.ts`. F1 is curated; other series fall back to array-index until curated.

## Authoring model — conversational, not admin UI

Every editable surface has a file home under `content/`. Renderers prefer curated/override files; external APIs are fallbacks. Edits to these are real commits that deploy to production (~90s).

| What to edit | File | Shape |
|---|---|---|
| Series metadata (color, URLs, season) | `content/series/<slug>/meta.json` | `SeriesMeta` in `lib/types.ts` |
| Drivers per series | `content/series/<slug>/drivers.json` | `CuratedDriversFile` |
| Champions per series | `content/series/<slug>/champions.json` | `Champion[]` |
| Significance flags (marquee / finale / weighted / note) | `content/series/<slug>/significance.json` | `SignificanceMap` |
| Series overview prose | `content/series/<slug>/overview.md` | plain markdown |
| Drivers prose (above the table) | `content/series/<slug>/drivers.md` | plain markdown |
| Significance prose | `content/series/<slug>/significance.md` | plain markdown |
| Standings corrections | `content/series/<slug>/standings-overrides.json` | `StandingsOverridesFile` |
| Race results corrections (DSQ / penalty) | `content/series/<slug>/results-overrides.json` | `ResultsOverridesFile` (keyed by round number) |
| **Timed-session overrides** (for date-only feeds) | `content/series/<slug>/sessions.json` | `SessionsOverridesFile` — replaces matching date-only entries with curated timed sessions |
| **Canonical FIA round numbers** | `content/series/<slug>/rounds.json` | `SeriesRoundsFile` — `{ season, rounds: [{ round, startDate, endDate, name }] }` |
| Calendar fallback (offline ICS) | `content/series/<slug>/fallback.ics` | iCalendar — used when live ICS fetch fails |
| Blog / news articles | `content/posts/<slug>.mdx` | gray-matter frontmatter: `title`, `summary`, `publishedAt`, `tags?`, `heroImage?`, `seriesSlug?`, `draft?` |

When a curated/override file is absent, renderers fall back to the live external source (jolpica, Wikipedia, scraped tables). Curation is fully opt-in.

## Where things live

- `app/` — Next.js App Router routes. `proxy.ts` is middleware.
- `components/` — React components. `components/weekend/*` is the race-weekend page.
- `lib/` — pure modules (parsing, grouping, types). Server-only helpers end in `*-loader.ts` to keep client bundles clean (the `lib/rounds.ts` + `lib/rounds-loader.ts` split is the canonical example — pure side imports from group.ts, loader side stays server-only).
- `content/series/<slug>/` — per-series curated data (see authoring-model table).
- `content/posts/*.mdx` — blog.
- `tests/fixtures/` — ICS + JSON test fixtures.
- `~/.claude/projects/C--Dev-Personal-Motorsport/memory/` — per-user memory (feedback rules + this file as a redirect stub).
- Root docs: `CLAUDE.md` (operating manual), `IDEAS.md` (idea ledger), `SCHEDULE.md` (time plan), `CONTRIBUTING.md` (PR rules), `ONBOARDING.md` (Fotis ramp), `CHANGELOG.md` (release notes), `docs/HANDOFF.md` (this file).

## Sessions roadmap

| ID  | Theme                                | What's in it                                                                                                                                                                                                                                                                            |
|-----|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| S4  | **Supabase data layer + scheduled scrapes** (reframed 2026-05-16) | The "every series, real session times" + "live race data" ambitions need a real DB. Provision Supabase via Vercel Marketplace; schema for sessions / standings / results / news / weather snapshots / live in-race data; per-series scrape jobs via Vercel Cron + Sandbox/Playwright for JS-rendered sites (fiaformulae.com, motogp.com); decide what stays as curated files vs moves to DB. Live-data ambition: "everything reachable per series" — sector times, gaps, weather radar, tyre choices. Multi-session build, replaces the KV-data-watch design originally planned. Research first (existing public sources — Ergast/jolpica, MotoGP web API, FIA feeds, aggregators), then schema, then scaffold. |
| S5  | SEO baseline                         | `app/sitemap.ts`, `app/robots.ts`, JSON-LD (`SportsEvent` per session, `Organization` per series, `Person` per driver, `BreadcrumbList` on detail pages), per-page `generateMetadata`, OG image generators, canonicals via `metadataBase` + `alternates.canonical`. Layer in fan-intent keywords (schedule / programme / where to watch / live stream / timetable). |
| S6  | Detail-page enrichment               | `/drivers/[slug]` + `/teams/[slug]` — Wikipedia bio summary, current standings position, last 5 results, news mentions. F1 History tab redesign OR curated `content/series/<slug>/history.md`. Rules tab "common topics" surface + FIA PDF link. |
| S7  | Native non-F1 results + standings    | Per-series ingestion in `lib/results/<slug>.ts` and `lib/standings/<slug>.ts`. Order: MotoGP → WEC → IndyCar → NASCAR. Includes endurance-series weekend-grouping audit (WEC / IMSA / NLS / ADAC have 24h races and multi-day tests; `groupByWeekend`'s 4-day gap may split them oddly). |
| S8  | Quality + monitoring + infra polish  | Custom `app/error.tsx`, Sentry, `/api/cron/health` summarising last-run timestamps, performance audit (Lighthouse + Speed Insights), zero lint errors + husky pre-commit hook, component tests (vitest + Testing Library), Playwright E2E on previews. |
| S9  | Race-weekend Part 2                  | Comments thread (Clerk + KV or Supabase) + predictions (open → locked-at-session-start → resolved-after-race) + paddock-coins ledger + leaderboard. Depends on S3 (shipped) and pairs with S4. |
| S10 | Showcase / content / polish          | Public README with screenshots + Mermaid architecture diagram, first 2–3 MDX blog posts, news-filter persistence (active series chip across reloads). |

## Loose items (not bound to a session)

- **UI/UX craft pass** — mobile-first audit, WCAG 2.2 AA pass, motion / micro-interactions, focus states, dark-mode contrast.
- **User research** — short survey, talk to F1-fan friends, mine subreddits for pain points.
- **SEO keyword strategy** — fan-intent queries across every series / weekend / driver / team page.
- **Notification expansion** (Phase 2) — per-event-type pushes (qualifying topper / race winner / championship-decider), click-handler deep-links to the specific session or article (currently always `/`), Settings "Your devices" list with per-device test + remove, hero images in `payload.image`.
- **Champions data fragility** — F1 wrong points column, F3 all zero, MotoGP brittle redirects. Long-term: curated `content/series/<slug>/champions.json` per series.
- **Cleanup** — delete `lib/onboarding.ts` (only wizard-reopen consumer), DRY `EnableNotifications` + `OnboardingWizard`, retheme Clerk sign-in / sign-up to Paddock dark.
- **Weekend page media embeds** (S3 follow-up, pre-S9) — `WeekendMedia` section fed by `content/series/<slug>/media.json` keyed by round (YouTube highlight reels, curated blog cross-links, optionally official onboard / pole-lap clips). `<YouTube id="..." />` MDX component already exists.
- **Smaller polish parking lot** — series Tracks/Circuits tab with map, home hero shows next 2–3 sessions when all imminent, session-card tap-to-expand (broadcast info / streaming / track), per-driver season-trend on `/drivers/[slug]`, Champions tab era markers / sparklines.

## Open design questions

1. **Sessions-override architecture (S4 input).** `sessions.json` exists per series (0.9.1). For Supabase, do overrides live in DB or stay as files? Files = git-reviewable, DB = admin-UI-editable.
2. **JS-rendered official sites.** fiaformulae.com / motogp.com / nascar.com — SPA-rendered, `fetch` returns nav HTML only. Sandbox/Playwright periodic scrape into Supabase, third-party feeds, or stay curation-first.
3. **Admin authoring UI vs conversational edits.** Current model (Claude edits files in `content/`) works. Admin UI is optional until S4. Decide during the Supabase initiative.
4. **Embedded video provider.** YouTube iframe (free, fast) vs Mux / Cloudflare Stream (paid, control). YouTube likely wins for v1.
5. **Driver lookup source for `/drivers/[slug]`.** Wikipedia REST API + parse, or curated `drivers.json` per series. Curated is reliable; Wikipedia is autofill.
6. **`sk_live_*` Clerk key rotation.** Deferred indefinitely; revisit if blast radius changes.

## Infra ledger

- ✅ Clerk Production — DONE 2026-05-14
- ✅ `paddock-tracker.com` custom domain + Vercel DNS + Let's Encrypt SSL — DONE 2026-05-14
- ✅ `CRON_SECRET` (Vercel all scopes + GitHub Actions) — DONE 2026-05-15
- ✅ Preview / Development Clerk env vars — DONE 2026-05-15
- ✅ Public-with-account auth model — DONE 2026-05-15
- ✅ VAPID + KV — push works end-to-end on properly-installed PWAs
- ✅ Vercel Analytics + Speed Insights wired — DONE 2026-05-15
- ✅ Race-weekend pages skeleton — DONE 2026-05-16 (`0.8.x` / `0.9.0`)
- ✅ Weekend correctness fixes (3 am bug + canonical round numbers + sessions.json + rounds.json infra) — DONE 2026-05-16 (`0.9.1`)
- ✅ Repo operating docs (`CLAUDE.md` + `IDEAS.md` + `SCHEDULE.md`) — DONE 2026-05-16 (`0.9.2`)
- ✅ ESPA + extensions + Mode awareness + communication discipline + commit-attribution reversed — DONE 2026-05-16 (`0.9.3`)
- ✅ Two-contributor workflow (`CONTRIBUTING.md` + `ONBOARDING.md` + CLAUDE.md push-to-main reversal) — DONE 2026-05-16 (`0.9.4`)
- ❌ `sk_live_*` rotation — deferred
- ❌ Contact-form email delivery — submissions stored in KV (`paddock:contact:*`); install Resend Marketplace + set `RESEND_API_KEY` + `CONTACT_TO_EMAIL` to actually email
- ❌ Sentry integration — pending
- ❌ GitHub Actions CI workflow — parked (`IDEAS.md` Parked section)
- ❌ Vercel Pro upgrade — not needed yet; Paris remains sole steward on Hobby, Fotis works via GitHub previews

## What shipped last session (2026-05-16)

Four versions across one session — coherent narrative: bug fixes → operating docs → process maturity → two-contributor scaffolding. Commit log: `48b7b29 → 52157da → 2da4aae`.

- **`0.9.1`** — `fix(weekend): real session hours + canonical FIA round numbers`. Phantom 3 am times fixed across 13 non-F1 series via `Session.dateOnly` propagation; canonical F1 round numbers via curated `content/series/f1/rounds.json` (Canada now shows Round 5, not Round 3); `sessions.json` override loader replaces matching date-only entries with curated timed sessions; FE Monaco 2026 (rounds 9 & 10 double-header) curated. `lib/rounds.ts` split into pure + fs-loader halves so `group.ts` doesn't drag fs into the client bundle.
- **`0.9.2`** — `docs: scaffold CLAUDE.md operating manual, IDEAS.md ledger, SCHEDULE.md`. Replaced the one-line `@AGENTS.md` shim with a real operating manual; established the Now / Next / Inbox / Parked / Killed triage discipline; day-by-day time plan format.
- **`0.9.3`** — `docs: mature CLAUDE.md — ESPA protocol + extensions + mode awareness`. Imported ESPA from sibling projects; added seven Paddock-specific extensions (mid-failure recovery, senior-engineer self-check, pre-mortem one-liner, verify-the-obvious, plan-level negative space, memory drift check, realistic-scope-with-single-plan-focus); Mode awareness section; four communication discipline rules; commit-attribution policy reversed (no more `Co-Authored-By`).
- **`0.9.4`** — `docs: two-contributor workflow`. `CONTRIBUTING.md` (branch / PR / review / hot-fix / conflict rules), `ONBOARDING.md` for Fotis, `CLAUDE.md` push-to-main rule reversed. Branch protection deliberately not enforced (no GitHub Pro on private repo). CI workflow parked (prior workflows always failed on first PR).
- **`0.9.5`** — `docs: triage + handoff move`. IDEAS.md triaged; SCHEDULE.md Saturday closed and Sunday sketched; this file (`docs/HANDOFF.md`) created from the memory copy. Memory copy replaced with a one-line redirect.

## How to use this file

- **Session start:** read this file first (after CLAUDE.md). Then `IDEAS.md` (Now / Next) and `SCHEDULE.md` (today's plan).
- **Mid-session:** don't edit. Use `IDEAS.md` Inbox for new ideas, `TaskList` for in-flight work.
- **Session end:** update the "what shipped last session" block + infra ledger. Bump the timestamp if you make non-trivial changes. Trim "loose items" or move them to `IDEAS.md` Inbox as they accumulate.
- **Never:** duplicate state across `IDEAS.md` and this file. IDEAS.md is the *queue*; this file is the *snapshot of where the project is now*.

---

## Appendix — flat open-items inventory (snapshot 2026-05-16)

Single flat enumeration of every open item known at the close of `0.9.5`. The sections above (Sessions roadmap / Loose items / Open design questions / Infra ledger) reorganise the same substance by lifecycle. The flat list exists so a contributor can scan the whole pile in one pass without jumping between sections.

Items marked **DONE** were shipped during the 2026-05-16 session and remain here for traceability — they will be pruned when the appendix is next refreshed.

1. Migrate sessions, standings, results, news, weather, drivers, and teams to a Supabase-backed data layer with scheduled scrapes per series.
2. Research existing public motorsport data sources (Ergast/jolpica for F1, MotoGP web API, FIA feeds, third-party aggregators) before building scrapers from scratch.
3. Curate `sessions.json` with real session hours for every non-F1 series (MotoGP, WEC, F2, F3, IndyCar, IMSA, WSBK, WRC, DTM, GT World, NASCAR Cup, NLS, ADAC Ravenol 24h).
4. Curate `rounds.json` per non-F1 series so FIA-canonical round numbers replace the array-index fallback.
5. Research and document live in-race data sources (sector times, leaderboard, gaps, tyre choices) for F1, MotoGP, WEC, FE, IndyCar.
6. Reverse-engineer fiaformulae.com, motogp.com, nascar.com XHR endpoints to see if unsigned JSON can substitute Playwright scraping.
7. Decide between Vercel Sandbox/Playwright, third-party aggregator, and curation-first for JS-rendered official sites.
8. Replace the planned KV data-watch framework with Supabase-backed watchers that drive an admin push channel and a Claude-curation queue.
9. Add `app/sitemap.ts`, `app/robots.ts`, JSON-LD (`SportsEvent`, `Organization`, `Person`, `BreadcrumbList`), per-page `generateMetadata`, OG image generators, and canonical URLs.
10. Implement a fan-intent keyword strategy across series, weekend, driver, and team pages (schedule, programme, where to watch, live stream, timetable).
11. Enrich `/drivers/[slug]` with Wikipedia bio, current standings position, last 5 results, and news mentions.
12. Enrich `/teams/[slug]` with the same shape.
13. Redesign F1 History tab or replace with curated `content/series/f1/history.md`.
14. Improve Rules tab with an FIA PDF link and a "common topics" surface.
15. Implement `lib/results/<slug>.ts` and `lib/standings/<slug>.ts` for MotoGP, WEC, IndyCar, NASCAR.
16. Audit endurance-series weekend grouping (WEC, IMSA, NLS, ADAC 24h, multi-day tests) for `groupByWeekend` mis-splits.
17. Add a custom `app/error.tsx` page.
18. Integrate Sentry for error monitoring.
19. Add `/api/cron/health` that summarises last-run timestamps for every cron job.
20. Run a Lighthouse and Speed Insights perf audit and act on findings.
21. Fix the nine legacy ESLint errors and add a husky pre-commit hook.
22. Add component tests with vitest + Testing Library.
23. Add Playwright E2E tests that run on Vercel preview deploys.
24. Build a comments thread (Clerk-gated) on race-weekend pages.
25. Build predictions with an open → locked-at-session-start → resolved-after-race state machine.
26. Build paddock-coins ledger and leaderboard.
27. Write a public README with screenshots and a Mermaid architecture diagram.
28. Write the first 2–3 MDX blog posts.
29. Persist active news-filter chip across page reloads.
30. Run a mobile-first UI/UX audit using the `tailwindcss-mobile-first` patterns.
31. Run a WCAG 2.2 AA accessibility audit and fix gaps.
32. Polish motion, focus states, and dark-mode contrast across the site.
33. Do another "Claude design" depth pass for background warmth and global theming.
34. Run user research via a site survey, conversations with fans, and subreddit pain-point mining.
35. Add per-event-type push notifications (qualifying topper via RSS filter, race winner, championship-deciding event).
36. Make the push click handler deep-link to a specific session or article instead of always opening `/`.
37. Build a Settings "Your devices" list with per-device test and remove buttons.
38. Send hero images in `payload.image`, sourced from curated circuit JPEGs or motorsport.com thumbnails.
39. Investigate per-series Champions JSON to fix the fragile parser (F1 wrong points column, F3 all zero, MotoGP brittle redirects).
40. Delete unused `lib/onboarding.ts` (only wizard-reopen consumer).
41. DRY the duplicated logic between `EnableNotifications` and `OnboardingWizard`.
42. Retheme the Clerk sign-in and sign-up pages to Paddock dark.
43. Add a `WeekendMedia` section to `/series/<slug>/weekend/<round>` fed by `content/series/<slug>/media.json` (YouTube highlight reels, blog cross-links, onboard clips).
44. Choose an embedded-video provider (YouTube iframe vs Mux vs Cloudflare Stream).
45. Add a Tracks/Circuits view per series with a map.
46. Make the home hero show the next 2–3 sessions when all are imminent.
47. Make session cards tap-to-expand to broadcast info, streaming, and track details.
48. Add a per-driver season-trend chart to `/drivers/[slug]`.
49. Add era markers and sparklines to the Champions tab.
50. Fold `overview.md` content fully into the F1 About tab.
51. Surface "common topics" on the Rules tab.
52. Install Resend Marketplace and wire `RESEND_API_KEY` + `CONTACT_TO_EMAIL` so contact-form submissions email out.
53. Rotate `sk_live_*` Clerk keys.
54. **DONE (`0.9.2` + `0.9.3`)** — Bootstrap a real `CLAUDE.md` operating manual.
55. **DONE (`0.9.2`)** — Scaffold `IDEAS.md` with Inbox / Now / Next / Parked / Killed sections seeded from this list.
56. **DONE (`0.9.3`)** — Encode the time-plan-at-start, capture-mid-session, triage-at-end workflow in `CLAUDE.md` as a best practice.
57. Investigate residual `00:00` string on `/series/f1/weekend/5` to confirm it is a legit time or remove a stale fake.
58. Visually verify the Canada round-5 page and FE Monaco weekend in a real browser (Playwright was locked during the 0.9.1 verification pass).
59. **DONE (`0.9.1`)** — Commit the bundled PR (3 am fix + sessions.json overrides + rounds.json infra + FE Monaco curation + F1 rounds curation + tests).
60. **DONE (`0.9.5`)** — Update the handoff with the Supabase initiative reframing S4 and the live-race-data ambition.
