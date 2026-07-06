@AGENTS.md

# Paddock — operating manual for Claude

## Quick context
- Repo `paris-paraskevas/motorsport`, default branch `main`. Live: https://paddock-tracker.com (Vercel project `motorsport`). Vercel auto-deploys `main` in ~90s — treat every merge as a production event.
- Stack: Next.js 16 App Router (middleware lives in `proxy.ts`, NOT `middleware.ts`), React 19, Tailwind v4, `@serwist/next` PWA, Clerk Production auth, Vercel KV, Supabase. Public-with-account auth model.
- Conversational authoring IS the CMS: every editable surface has a file home under `content/`; renderers prefer curated/override files, external APIs are fallbacks. Edits to `content/**/*` are real commits that ship to production.
- Next.js 16 has breaking changes vs training data — check `node_modules/next/dist/docs/` for current API shapes before writing Next-specific code.

## Session start — read in order
1. This file. 2. `docs/HANDOFF.md` — running ops record (landmines, what shipped, infra ledger, open questions; `memory/project-paddock-handoff.md` is a redirect stub to it). 3. `IDEAS.md` — Now/Next queue. 4. `SCHEDULE.md` — today's plan. 5. Memory `feedback-paddock-*` files — every rule there is non-negotiable user-set behavior; the load-bearing ones are inlined below.

## ESPA — before every non-trivial action
Evaluate the ask → Scrutinize it (push back on concrete flaws, risks, inefficiencies — even when explicitly instructed) → Present a step-by-step plan with a one-line pre-mortem and a one-line "won't touch this session" → Await explicit approval ("yes" / "go ahead" / "do it" — never inferred from silence or a follow-up question).
- Plan fails mid-execution → STOP, re-evaluate from step 1 with what you now know, present a revised plan.
- Before presenting: "Would a senior engineer approve this?" If not, fix it first. Verify load-bearing assumptions instead of calling them obvious.
- Plan mode when: 3+ files, architecture, ambiguity, or "build / redesign / restructure / plan". Execute directly for single-file edits, clear instructions, known-location fixes, research. Unsure → ask.

## Time tracking
A `[+Nm]` prefix on a prompt = N active minutes the user spent since the previous prompt (reading, thinking, on-task AFK; not idle time). On seeing it: append to today's `Active:` line in `SCHEDULE.md`, keep a running total, then handle the prompt. A bare `[+12m]` message backfills the previous window. Daily total reported at session end.

## Session workflow
- Start: propose a time-plan for the session + an explicit "won't touch this session" line; add to `SCHEDULE.md`; create tasks for the in-scope work.
- New idea mid-session: acknowledge in one sentence, append one sentence to `IDEAS.md` Inbox, return to the active task. Never derail.
- End: triage the Inbox (promote to Now/Next, park, or kill with a one-line why); update the handoff; mark the day's plan done/partial/skipped in `SCHEDULE.md`.

## Working agreement — project-specific rules
- Browser-verify before "shipped": open the affected page in Chrome and click through the user flow. Typecheck + tests + curl prove compilation, not features.
- Any server-side outbound-network code (`lib/results/*`, `lib/standings/*` parsers): verify on a Vercel preview, not just localhost — datacenter IPs / restricted runtime / TLS fingerprints fail there first (the 0.12.12 NASCAR prod regression shipped exactly this way).
- Thin upstream data (ICS/scrape/API) is never a "documented limitation" — web-search the official source, curate a sidecar file under `content/series/<slug>/`, ship the patch.
- Open-Meteo weather lookups go by venue-local date, never UTC.
- Probing any new external source: fetch `robots.txt` + `sitemap.xml` first (skip if 404) — often surfaces structured endpoints or off-limits paths.
- Edit tool returns "file modified since read" → Read the file, THEN Edit. Never retry blind — the tool tracks a per-file read checksum; this is a repeated stumble here.
- No new abstractions without a real second consumer; three similar lines beat a premature helper.
- Never create new files without permission — state filename, format, purpose; await.
- Flag mistakes inline immediately ("Correction: …") — never silently fix. State your sources (file:line, memory path, web search).
- Memory vs current code disagree → trust the code, update the memory.

## Release notes — mandatory on every push to main
1. `CHANGELOG.md` — engineering log (file paths, function names, root causes belong here).
2. `RELEASES.md` — public, rendered at `/changelog`: user-facing prose ONLY — no file paths, no library names, no SHAs; 1–3 sentences per bullet; internal-only changes get one acknowledging line.
3. `package.json` version bump — patch/minor/major.
The `/changelog` page shows `package.json` version as "currently running" — skipping this lies to users. Forgot and already pushed → immediate follow-up commit with both files.

## Blog publishing SOP — drafts only, operator approves
Every post is a DB draft on PROD Supabase; NEVER public MDX (`content/posts/*.mdx` auto-publishes on merge — the 2026-07-03 British GP preview went live unsigned that way; reverted in #373). MDX only when the operator explicitly asks.
1. Create via `scripts/draft-post.mts` with PROD `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `BLOG_AUTHOR_ID` (or Management API SQL insert via `.supabase-pat`). ⚠ `.env.local` points at LOCAL Supabase (127.0.0.1) — a draft created with default env never reaches prod.
2. Leave `publish_at` null — the operator approves + schedules in the `/blog` admin queue (`lib/blog.ts` `createDraft` contract); the publish cron takes it live and fires the push.
3. Verify: row exists with `status='draft'` on prod AND the post does NOT appear on public `/blog`.
4. Triple-check content facts against primary sources before queueing.

## Critical landmines
1. `next.config.ts` needs BOTH `serverExternalPackages: ["node-ical"]` AND `outputFileTracingIncludes`. Removing either breaks production fetches.
2. Middleware file is `proxy.ts` in Next 16, not `middleware.ts`; `clerkMiddleware()` itself unchanged.
3. KV env vars are unprefixed (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) — reject the Vercel Marketplace "STORAGE" prefix.
4. Clerk publishable key keeps the `NEXT_PUBLIC_` prefix exactly; the Marketplace integration creates empty Production placeholders — paste real values manually.
5. Notification badge must be monochrome (`public/icons/badge-96.png`; regenerate via `scripts/gen-badge.py`).
6. Crons fail CLOSED (`lib/cron-auth.ts`): missing `CRON_SECRET` → 503, wrong → 401, `Authorization: Bearer $CRON_SECRET` → run. Never "restore" fail-open — that was the pre-0.9.17 vulnerability (audited 2026-06).

## Where things live
| Path | Purpose |
|---|---|
| `app/` | App Router routes (route-groups `(app)` / `(marketing)`); `proxy.ts` is middleware |
| `components/` | React components; `components/weekend/*` = race-weekend page |
| `lib/` | Pure modules; server-only helpers end in `*-loader.ts` to keep client bundles clean |
| `content/series/<slug>/` | Per-series curated data (meta, drivers, champions, rounds, session overrides, fallback ICS) |
| `content/posts/*.mdx` | Legacy blog posts — do NOT add new ones (see Blog SOP) |
| `tests/fixtures/` | ICS + JSON fixtures |
| `IDEAS.md`, `SCHEDULE.md` | Idea ledger + time plan — session-start reads |
| `CHANGELOG.md` / `RELEASES.md` | Engineering log / public notes at `/changelog` |

## Commands
`npm run dev` (`next dev --webpack` — webpack forced over Turbopack) · `build` · `lint` · `test` (vitest, `--passWithNoTests`) · `health` / `health:standings` / `health:results` · `indexnow:submit`. Requires `.env.local` / `.clerk` / `.supabase-pat` (present, gitignored).

## Commit & branch conventions
- Two-person project — read `CONTRIBUTING.md`. Branch from latest `main` → PR → preview review → squash-merge. Never push directly to `main`.
- Conventional commits (`feat(scope):`, `fix(scope):`, `docs:`, `chore:`); body explains the why. Bundle fixes sharing a root cause.
- Never include `Co-Authored-By` or any Claude attribution in commit messages.
