# Paddock, contributor onboarding

Welcome, Fotis. This is the short version: enough to run Paddock, understand its shape, and start shipping. **This is the only onboarding doc** — the copy that used to live at the repo root is now a redirect, because two of these drifted apart and both ended up wrong about the same landmine in different words.

The full contribution rules are in `CONTRIBUTING.md`, which is the most accurate document in the repo and the authority on branches and deployment. The AI-assist context lives in `CLAUDE.md` / `AGENTS.md`. **If anything here disagrees with the code, trust the code and flag it.**

## Read these first, in order
1. `CLAUDE.md` — the operating manual: working agreement, the laws, the landmines, the release-notes rule. Applies to humans and to Claude.
2. `CONTRIBUTING.md` — branch / PR / review rules, and where secrets actually live.
3. `IDEAS.md` — every open idea (Now / Inbox / Parked / Killed), re-triaged at the end of each session.
4. `SCHEDULE.md` — the day-by-day plan.
5. `CHANGELOG.md` — what shipped, per version, with root causes.

## The stack
- Next.js 16 (App Router) + React 19 + TypeScript. **Builds run Turbopack**; the `webpack()` block in `next.config.ts` is dev-only and exists to keep the watcher off `.open-next`.
- Tailwind CSS v4 for styling; all design tokens live in `app/globals.css`.
- PWA via `@serwist/turbopack`. Auth via Clerk (production). App data in Supabase; expensive fetches cached in KV (Upstash over REST, env vars **unprefixed**: `KV_REST_API_URL` / `KV_REST_API_TOKEN`).
- `node-ical` for calendar feeds, Open-Meteo for weather, motorsport.com RSS for news.
- Hosted on a **Cloudflare Worker** built with OpenNext. Live at paddock-tracker.com; Workers Builds redeploys on a merge to `main`, live in about 6 minutes. There is **no deploy workflow in GitHub Actions**, so there is no run to watch — poll `/changelog` for the version instead.

## Run it locally
1. Clone, `npm ci`, `npm run dev` (serves http://localhost:3000).
2. You need the gitignored env files: `.env.local` and `.supabase-pat`. **Ask Paris for them — there is no `.env.example` to copy.** There is no `.clerk` file either; Clerk keys live in `.env.local`.
3. **`.env.local` points at a LOCAL Supabase (`127.0.0.1:54321`), not prod.** With Docker down, every blog-backed surface renders empty — the `/app` lead band, `/series/*/blog`, `/blog/*`. That is the fail-soft path working, not a bug. Run `supabase start` if you need real posts.
4. Two dev-loop gotchas that have each cost a session: `next build` clobbers a running `next dev` (they share `.next`, so restart dev after a build), and deleting a route leaves a stale `.next/dev/types/<route>/page.ts` that fails `tsc` until it is cleared.
5. Scripts: `dev`, `build`, `lint` (0 errors, 2 known `_encoding` warnings in `lib/content-fs.ts`), `test` (vitest), `health` (data-source checks).

## Environments
Three branches, three Workers, three URLs — `CONTRIBUTING.md` has the table and is the authority.

- **Local** (localhost:3000): your machine.
- **testing.paddock-tracker.com**: the long-lived `testing` branch, yours. Every push deploys.
- **paris.paddock-tracker.com**: the `testing-paris` branch, the operator's. (There is a `testing-panagiotis` too.)
- **Prod** (paddock-tracker.com): `main`. Never push to it directly; merging a PR *is* the deploy.
- **PR previews: there are none.** Cloudflare will not generate a preview URL for a Worker that implements a Durable Object, and `worker.ts` exports three. Review the diff, or push to your testing Worker.

**The one thing to internalise about previews:** they share **prod's** Supabase, KV and R2. Reads are safe (`DATA_SOURCE=db`, so a preview never fetches upstream series data), but an app mutation on a preview — placing a bet, posting a thread, approving a draft — **writes prod data**.

## Three route groups (`app/`)
- `(marketing)`: the public landing at `/`.
- `(app)`: the whole product (series pages, calendar, blog, information hub, race-weekend and session pages, account), wrapped in the shared chrome from `AppShell`.
- `(admin)`: the operator-only dashboard at `/admin`, its own chrome-free root layout, gated to admins.

Each group has its own root layout with its own `<html>`, so navigating between groups is a full page load, not a client transition.

## App map (what each surface shows, and where its data comes from)
| Surface | Shows | Data source |
|---|---|---|
| `/` (landing) | Marketing intro | Static + `content/landing/*` |
| `/app` | Personal home: the lead story, the weekend in progress, next sessions, news | Curated + live feeds; follows are device-local |
| `/series/<slug>` + tabs | Per-series calendar, standings, results, tracks, champions, drivers, news, blog | `content/series/<slug>/*` (curated), with `lib/results` + `lib/standings` + ICS feeds as live fallbacks |
| `/series/<slug>/weekend/<round>` + `/<session>` | A race weekend and per-session times, weather and results | Curated `sessions.json` / `rounds.json` + `lib/results/*`; F1 telemetry from OpenF1 |
| `/calendar` | Multi-series month/week/day calendar | Aggregated series sessions |
| `/blog` | Editorial posts | Supabase (drafts + published posts) |
| `/information` | Reference and explainer pages | Curated markdown under `content/` |
| `/admin` | Traffic, search, behaviour (click heatmap), users, submissions, tools | GA4 / GSC / Bing, Clerk, Supabase, KV |

## Where data comes from (the rule)
Curated files under `content/series/<slug>/*` (meta, rounds, sessions, drivers, champions, media) are the CMS and are preferred. Everything else is a fallback or live layer: `lib/results/*` and `lib/standings/*` (per-series parsers), `lib/openf1/*` (F1 telemetry, fetched at request time), ICS feeds, RSS news. Supabase holds the blog, feeder submissions, social/betting and push data; KV caches expensive upstream fetches. A renderer prefers the curated override, then falls back to the live source.

**Two things follow from that, and both are load-bearing:**
- **Content facts get triple-checked against primary sources before they ship** (RULE #1). Thin upstream data is never a "documented limitation" — search for the official source and curate a sidecar.
- **The deployed Worker never calls those upstream parsers.** It runs `DATA_SOURCE=db` and reads snapshots. `scripts/warm-live-data.mts` is the *only* writer of the site's data, running from GitHub Actions on a clean IP. So **a parser change is only proven once the warm job has run with it** — localhost cannot prove it, and neither can the Worker.

## Non-obvious conventions
- **Conversational authoring is the CMS.** There is no admin UI for content; every editable surface has a file home under `content/`, and an edit is a real commit that ships to prod.
- **`dateOnly` is a thing.** Many feeds publish date-only events with no hour. `Session.dateOnly: true` flows from `lib/ics.ts` through the UI: it renders "TBC", live-now skips it, notifications never fire for it, and weather falls back to the day.
- **Round numbers are canonical**, from `content/series/<slug>/rounds.json`. F1 is curated; others fall back to array index until curated.
- **Weather is looked up by venue-local date and hour**, never UTC.
- **`content/posts/*.mdx` is legacy and empty. Do NOT add any.** An MDX post auto-publishes the moment it merges, with no approval step — that is how the 2026-07-03 British GP preview went live unsigned (reverted in #373). Blog posts are prod Supabase DB drafts with `publish_at` NULL; the operator approves and schedules them. The full SOP is in `CLAUDE.md`.
- **Browser-verify before "shipped".** Typecheck and tests prove the code compiles, not that the feature works. Open it in Chrome at 390 px and on desktop.

## How we ship
- Branch off the latest `main`, open a PR **with a real description** (what, why, how it was verified), review it, then squash-merge. Never edit `main` directly.
- Conventional commits (`feat(scope):`, `fix`, `docs`, `chore`); the body explains the *why*. No `Co-Authored-By` lines.
- Every merge to `main` ships to prod, so every push updates all three: `CHANGELOG.md` (engineering log — paths, functions, root causes), `RELEASES.md` (public prose, rendered at `/changelog`), and the `package.json` version.
- **Never make a failing check pass by weakening it.** No skips, loosened asserts, `as any`, or lint-disables. Quote the failure and ask.
- **Worker size is a hard ceiling and we are at it** — about 10.19 MB gzipped against a 10 MiB limit, with tens of KiB spare. Measure with `wrangler deploy --dry-run` before adding a dependency.

## The design language (your starting lane)
Paddock is deliberately editorial: flat, near-black surfaces on the dark themes and warm paper on the light ones, no gradient washes; one accent per theme, living in rules and type more than in fills; a per-series accent colour driving each series page; hairline "telemetry-grid" panels with sharp corners — no rounded, gradient, drop-shadow cards; a display/mono type pairing (Saira Condensed for display, Geist Mono for labels, Geist Sans for body). The north star is **distinctive and editorial, never templated or AI-generated.** Tokens all live in `app/globals.css`. Build mobile-first and verify at 390 px.

## Where things live
- `app/` routes (the groups above); `app/api/*` for API routes, crons, and the calendar ICS feed.
- `components/*`: `components/weekend/*` is the race-weekend page, `components/tabs/*` the series tabs, `components/admin/*` the admin UI.
- `lib/*` pure modules; subfolders `results/`, `standings/`, `openf1/`, `analytics/`, `betting/`, `assistant/`, `information/`. Server-only helpers end in `*-loader.ts` to keep client bundles clean.
- `content/series/<slug>/*` curated per-series data; also `content/circuits.json`, `content/legal/*`, `content/landing/*`.
- `middleware.ts` is the middleware; `next.config.ts` is the build config.

## Do not touch without asking
`next.config.ts` (misconfigure it and prod data fetching breaks), `middleware.ts` (auth and routing — and see the landmine below), Clerk keys and env values, the KV env variable names, the cron auth in `lib/cron-auth.ts` (fails closed by design — never "restore" fail-open), and any prod Supabase or infra write. For a first contribution also avoid `lib/types.ts`: shared core, conflict-prone.

**The landmine, stated once and precisely:** the middleware is **`middleware.ts`**, not `proxy.ts`. Next 16 prefers `proxy.ts` and prints `The "middleware" file convention is deprecated` on **every** build. That warning is expected and must not be "fixed" on sight — the Cloudflare migration renamed the file back because OpenNext needs the Edge runtime, and renaming it breaks the deploy.

## First contributions — suggested ramp
Pick one off `IDEAS.md`. Good starters:
- Curate `sessions.json` for a non-F1 series with date-only events (Formula E beyond Monaco, MotoGP, IMSA), then `rounds.json` for the same series.
- A mobile-first audit at 390 px, or an information-density review: what does each page answer in five seconds?
- Draft a blog post the sanctioned way: a `.md` in `drafts/`, checked with `npx tsx scripts/draft-post.mts <file> --dry`, then inserted as a prod DB draft for the operator to approve. Never as MDX.

First files to open for UI work: `app/globals.css` (tokens), `components/AppShell.tsx` (global chrome), `components/SeriesPageView.tsx` + `components/tabs/*`, `components/weekend/*`.

## Asking questions
Ask freely. The cost of asking is 30 seconds; the cost of guessing wrong is hours. Keep changes small, verify in the browser, match the editorial feel.
