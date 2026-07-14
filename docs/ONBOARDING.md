# Paddock, contributor onboarding

Welcome, Fotis. This is the short version: enough to run Paddock, understand its shape, and start shipping. The full contribution rules are in `CONTRIBUTING.md`; the AI-assist context lives in `CLAUDE.md` / `AGENTS.md`. If anything here disagrees with the code, trust the code and flag it.

## The stack
- Next.js 16 (App Router, forced onto webpack) + React 19 + TypeScript.
- Tailwind CSS v4 for styling; all design tokens live in `app/globals.css`.
- PWA via `@serwist/next`. Auth via Clerk (production). App data in Supabase; expensive fetches cached in Vercel KV.
- Hosted on Vercel (project `motorsport`). Live at paddock-tracker.com; `main` auto-deploys to prod in about 90 seconds.

## Run it locally
1. Clone, `npm install`, `npm run dev` (serves http://localhost:3000).
2. You need the gitignored env files: `.env.local`, `.clerk`, `.supabase-pat` (Paris will share). Note: `.env.local` points at a LOCAL Supabase (127.0.0.1), not prod.
3. Gotchas worth knowing early: `next build` clobbers a running `next dev` (shared `.next`, so restart dev after a build), and the dev server can go stale after a branch switch or a new-module import, so restart it for a clean compile before you trust what you see.
- Useful scripts: `dev`, `build`, `lint`, `test` (vitest), `health` (data-source checks).

## Environments
- **Local** (localhost:3000): your machine.
- **testing.paddock-tracker.com**: a long-lived `testing` branch deployed separately from prod. Push here to try things without touching `main` or prod. This is the shared sandbox.
- **PR previews**: every pull request gets its own Vercel preview URL (behind the SSO wall; your Vercel access opens them).
- **Prod** (paddock-tracker.com): `main`. Never push to `main` directly.

## Three route groups (`app/`)
- `(marketing)`: the public landing at `/`. Signed-in visitors are redirected to `/app`.
- `(app)`: the whole product (series pages, calendar, blog, the information hub, race-weekend and session pages, account), wrapped in the shared chrome from `AppShell` (header, footer, mobile bottom bar).
- `(admin)`: the operator-only admin dashboard at `/admin`. Its own minimal, chrome-free root layout, gated to admins, also served at dev.paddock-tracker.com.

## App map (what each surface shows, and where its data comes from)
| Surface | Shows | Data source |
|---|---|---|
| `/` (landing) | Marketing intro | Static + `content/landing/*` |
| `/app` | Personal home: followed series, next sessions, news | Curated + live feeds; follows are device-local |
| `/series/<slug>` + tabs | Per-series calendar, standings, results, tracks, champions, drivers, news | `content/series/<slug>/*` (curated), with `lib/results` + `lib/standings` + ICS feeds as live fallbacks |
| `/series/<slug>/weekend/<round>` + `/<session>` | A race weekend and per-session times/results | Curated `sessions.json` / `rounds.json` + `lib/results/*`; F1 telemetry from OpenF1 |
| `/calendar` | Multi-series month/week/day calendar | Aggregated series sessions |
| `/blog` | Editorial posts | Supabase (drafts + published posts) |
| `/information` | Reference and explainer pages | Curated markdown under `content/` |
| `/admin` | Traffic, search, behaviour (click heatmap), users, submissions, tools | GA4 / GSC / Bing, Clerk, Supabase, KV |

## Where data comes from (the rule)
Curated files under `content/series/<slug>/*` (meta, rounds, sessions, drivers, champions, media, and more) are the CMS and are preferred. Everything else is a fallback or live layer: `lib/results/*` and `lib/standings/*` (per-series scrapers and parsers), `lib/openf1/*` (F1 live telemetry), ICS calendar feeds, RSS news. Supabase holds the blog, feeder submissions, social/betting, and push data; Vercel KV caches expensive upstream fetches. A renderer prefers the curated override, then falls back to the live source. Content facts get triple-checked against primary sources before they ship (our RULE #1).

## The design language (your starting lane)
Paddock is deliberately editorial "2.0": flat, near-black surfaces with no gradient washes; amber (`#ffb400`) as the one accent, living in rules and type more than in fills; a per-series accent color driving each series page; hairline "telemetry-grid" panels with sharp corners (no rounded, gradient, drop-shadow cards); and a display/mono type pairing (Saira Condensed for display, Geist Mono for labels, Geist Sans for body). The north star is distinctive and editorial, never templated or AI-generated. Tokens all live in `app/globals.css`. Build mobile-first and verify every change at 390px and on desktop.

## Where things live
- `app/` routes (the groups above); `app/api/*` for API routes, crons, and the calendar ICS feed.
- `components/*` React components: `components/weekend/*` is the race-weekend page, `components/tabs/*` the series tabs, `components/admin/*` the admin UI.
- `lib/*` pure modules; subfolders include `results/`, `standings/`, `openf1/`, `analytics/`, `betting/`, `assistant/`, `information/`. Server-only helpers end in `*-loader.ts` to keep client bundles clean.
- `content/series/<slug>/*` curated per-series data; also `content/circuits.json`, `content/landing/*`, and `content/posts/*` (legacy blog, do not add new ones).
- `proxy.ts` is the middleware (auth, redirects, dev/admin gating); `next.config.ts` is the build config.

## How we ship
- Branch off the latest `main`, open a PR, review it on the Vercel preview, then squash-merge. Never edit `main` directly.
- Conventional commits (`feat(scope):`, `fix`, `docs`, `chore`); the body explains the why.
- Every merge to `main` ships to prod, so it must update `CHANGELOG.md` (engineering log), `RELEASES.md` (public notes), and bump the `package.json` version.
- Browser-verify at 390px and on desktop before calling a change done.

## Do not touch without asking
`next.config.ts` (misconfigure it and prod data fetching breaks), `proxy.ts` (auth and routing), Clerk keys and env values, Vercel KV env variable names, the cron auth in `lib/cron-auth.ts` (fails closed by design), and any prod Supabase or infra write. When unsure, branch and ask.

## First files to open for UI/UX work
- `app/globals.css` (tokens), `components/AppShell.tsx` (global chrome), `components/SeriesPageView.tsx` + `components/tabs/*` (series pages), `components/weekend/*` (the marquee weekend page).
- To see your work: local dev, then a branch for a PR preview, or the `testing` branch for the shared sandbox.
- Likely first passes (agree the list with Paris): a mobile-first audit at 390px, an information-density review (what does each page answer in five seconds?), and tightening design-token consistency.

Keep changes small, verify in the browser, match the editorial feel, and ask Paris when in doubt.
