# Onboarding to Paddock Tracker — for Fotis

Welcome. Paddock Tracker is the motorsport-companion web app at [paddock-tracker.com](https://paddock-tracker.com). This doc gets you contributing in ~1 hour.

## What it is

Personal motorsport companion. Tracks F1 + MotoGP + WEC + Formula E + 9 other series. Calendar, weekend pages, weather, standings snapshots, news. Built as a single-author project; you're contributor #2.

## Stack

- Next.js 16 App Router. Middleware lives in **`middleware.ts`** — NOT `proxy.ts`. Next 16 prefers `proxy.ts` and warns about the deprecated convention on every build; that warning is expected. The Cloudflare migration renamed it back because OpenNext needs the Edge runtime, so renaming it breaks the deploy.
- React 19, Tailwind v4
- Clerk auth (Production), KV (Upstash Redis over REST: `KV_REST_API_URL` / `KV_REST_API_TOKEN`), `@serwist/next` PWA
- `node-ical` for calendar feeds, Open-Meteo for weather, motorsport.com RSS for news
- Hosted on a **Cloudflare Worker** (OpenNext build), custom domain `paddock-tracker.com`

## Read these first (in order)

1. `CLAUDE.md` — operating manual. ESPA loop, session workflow, working agreement, release-notes rule. Applies to both humans and Claude.
2. `CONTRIBUTING.md` — branch / PR / review rules.
3. `IDEAS.md` — every open idea (Now / Next / Inbox / Parked / Killed). Triaged at end of every session.
4. `SCHEDULE.md` — day-by-day plan.
5. `CHANGELOG.md` — what's shipped per version.

## Code layout

- `app/` — Next.js routes. `middleware.ts` at the repo root is the middleware.
- `components/` — React components. `components/weekend/*` is the race-weekend page.
- `lib/` — pure modules. Server-only helpers end in `*-loader.ts` to keep client bundles clean.
- `content/series/<slug>/` — per-series curated data: `meta.json`, `overview.md`, `drivers.md`, `champions.json`, `significance.json`, `sessions.json` (timed-session overrides), `rounds.json` (canonical FIA round numbers), `fallback.ics`. Edits here are real commits that deploy to production.
- `content/posts/*.mdx` — **legacy and empty (0 files). Do NOT add any.** An MDX post auto-publishes the moment it merges, with no approval step; that is how the 2026-07-03 British GP preview went live unsigned (reverted in #373). Blog posts are prod Supabase DB drafts — see the Blog SOP in `CLAUDE.md`.
- `tests/fixtures/` — ICS + JSON test fixtures.

## Non-obvious conventions

- **Conversational authoring is the CMS.** No admin UI — content edits are PRs.
- **`dateOnly` is a thing.** Many calendar feeds publish date-only events (no time). `Session.dateOnly: true` flows from `lib/ics.ts` through the UI; renders "TBC", live-now skips, notifications never fire.
- **Round numbers are canonical.** Sourced from `content/series/<slug>/rounds.json`. F1 is curated; others fall back to array-index until you curate them.
- **Browser-verify before "shipped".** Tests + typecheck prove the code compiles. Open the page in Chrome before saying done.
- **Search for missing data.** If upstream is thin, web-search the official source and curate a sidecar file. Don't shrug it off as a "documented limitation".

## Local setup

```
git clone https://github.com/paris-paraskevas/motorsport
cd motorsport
npm ci
cp .env.example .env.local   # then ping Paris for real values
npm run dev                   # http://localhost:3000
```

Run tests with `npx vitest run`. Typecheck with `npx tsc --noEmit`.

## First contributions — suggested ramp

Pick one off `IDEAS.md` Inbox. Good starters:
- Curate `sessions.json` for a non-F1 series with date-only events (FE rounds beyond Monaco, MotoGP, IMSA).
- Curate `rounds.json` for the same series.
- Draft a blog post the sanctioned way: a `.md` in `drafts/`, parsed with `npx tsx scripts/draft-post.mts <file> --dry`, then inserted as a prod DB draft for the operator to approve. Never as MDX.
- Investigate the residual `00:00` string on `/series/f1/weekend/5`.

Avoid for first contributions: `lib/types.ts`, `middleware.ts`, `next.config.ts` — shared core, conflict-prone.

## Deploy access

- GitHub: you're a collaborator. Push branches, open PRs, review Paris's PRs.
- Cloudflare: Paris is sole steward. There are no per-PR preview URLs; a testing Worker exists (`npm run deploy:testing`). Production logs / KV / env-vars: ask Paris.
- New env var needed: ask Paris — Worker secrets are pushed with `npm run secrets:sync` (`scripts/sync-worker-secrets.mts`).

## Asking questions

Ask freely. The cost of asking is 30 seconds; the cost of guessing wrong is hours.
