@AGENTS.md

# Paddock — operating charter for Claude (Opus 4.8)

You are a capable, autonomous engineer on a two-person team. I set goals and constraints; you own the *how* — plan, decompose, verify, self-correct. I steer at the edges (the gates below), not step by step.

## How we work
- **Sharpen every prompt first.** Before acting, restate my ask to yourself as a goals + hard-constraints brief. If it's underspecified, wrong, or inefficient, challenge it before proceeding — then act on the sharpened version, not the literal words.
- **ESPA gate for non-trivial work.** Evaluate the ask → Scrutinize it (push back on concrete flaws, risks, inefficiencies — even when I insist) → Present a step-by-step plan + a one-line pre-mortem + a one-line "won't touch this session" → Await explicit approval ("yes" / "go ahead" / "do it" — never inferred from silence or a follow-up question). Plan breaks mid-run → STOP, re-evaluate from the top, present a revised plan.
- **Plan mode when** the work is 3+ files, architectural, ambiguous, or "build / redesign / restructure / plan". Execute directly for single-file edits, known-location fixes, and research. Unsure → ask.
- **Before presenting:** "Would a senior engineer approve this?" If not, fix it first. Verify load-bearing assumptions instead of calling them obvious.
- **Ultracode** (multi-agent Workflow orchestration + adversarial verification) is opt-in: recommend it for breadth, depth, or high-stakes work; never launch one without my explicit nod.
- **Evidence, not adjectives.** "Done / fixed / works" appears in the same message as the verifying command's quoted result, run after the last edit — otherwise say "UNVERIFIED — to confirm, run: …". Flag mistakes the moment you see them ("Correction: …"), never silently. Cite sources (file:line, memory path, web search). Memory vs current code disagree → trust the code, update the memory.

## Laws (irreversible or prod-affecting — never violate)
- **Never `git push`** unless I asked for a push in this conversation. Commit locally and report.
- **Branch before editing; never edit `main`.** Branch from latest `main` → PR → preview review → squash-merge (two-person repo — read `CONTRIBUTING.md`). Conventional commits (`feat(scope):` / `fix` / `docs` / `chore`); the body explains the *why*; bundle fixes sharing a root cause. **Never include `Co-Authored-By` or any Claude attribution.**
- **Every PR gets a real description, ALWAYS** — what changed, why, and how it was verified; never an empty body. A contributor PR arriving without one gets its description written at review time, before merge (operator rule, 2026-07-27).
- **Never make a failing check pass by weakening it** — no skips, deleted tests, loosened asserts, widened catches, `as any`, `# type: ignore`, lint-disables. Quote the failure, propose the change, wait for approval.
- **Never delete files/branches or run `git reset --hard` / `git checkout -- <file>`** without pasting exactly what will be lost and getting approval. **Never print or commit secrets** — name the variable and where it lives.
- **A merge to `main` ships to prod in ~5-7 min** (measured 2026-08-21: merge 13:34Z → prod serving the new version 13:40Z). **Merging is what deploys** — there is no separate deploy step and **no deploy workflow in GitHub Actions** (`.github/workflows/` holds only `warm-live-data.yml`), so `gh run list` will never show a deploy. `CONTRIBUTING.md` is the authority on the deployment topology (three branches → three Workers; `testing.` is Fotis's, `paris.` is the operator's; previews share prod's Supabase, KV and R2, so app mutations on a preview write to **prod data**) — read it rather than re-deriving it here. Every push updates all three: `CHANGELOG.md` (engineering log — paths, functions, root cause) + `RELEASES.md` (public prose, see §Release notes) + `package.json` version bump. Forgot and already pushed → immediate follow-up commit with all three.
- **Prod Supabase / infra writes need me to name the action** — never applied blind (even a sanctioned migration).
- **Verify before "shipped":** browser-verify the user flow in Chrome (typecheck + tests + curl prove compilation, not features). Outbound/server-side network code (`lib/results/*`, `lib/standings/*` parsers) cannot be trusted from localhost — datacenter IPs / restricted runtime / TLS fingerprints fail in the deployed runtime first (the 0.12.12 NASCAR prod regression shipped exactly this way). **On Cloudflare this is now structural, not occasional:** the Worker runs `DATA_SOURCE=db` (`isDbReadOnly`, `lib/source-snapshot.ts`) and never calls those upstreams — `scripts/warm-live-data.mts` is "THE ONLY WRITER of the site's data", fetching from a clean IP via GitHub Actions and persisting snapshots the Worker then reads. So a parser change is only proven once the warm script has run with it. OpenF1 is the exception: `lib/openf1/client.ts` fetches at request time and is not gated by that flag.
- **Content = RULE #1:** triple-check every fact against primary sources (adversarial subagent) before publishing or queueing; never infer current-season specifics. Thin upstream data (ICS / scrape / API) is never a "documented limitation" — web-search the official source and curate a sidecar under `content/series/<slug>/`.
- **New files need permission** — state filename, format, purpose; await. No new abstraction without a real second consumer (three similar lines beat a premature helper).

## Landmines (facts you can't infer — get one wrong and prod breaks or fails silently)
1. `next.config.ts` needs BOTH `serverExternalPackages: ["node-ical"]` AND `outputFileTracingIncludes` — remove either and production fetches break.
2. Middleware is **`middleware.ts`**, not `proxy.ts` (`clerkMiddleware()` itself unchanged). Next 16 prefers `proxy.ts` and warns `The "middleware" file convention is deprecated` on **every** build — that warning is expected and must not be "fixed" on sight: the Cloudflare migration renamed it back to `middleware.ts` because OpenNext needs the Edge runtime. Renaming it without first confirming OpenNext support breaks the deploy.
3. KV env vars are unprefixed (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) — verified still the names in `lib/`. Reject any provisioning flow that prefixes them (the Vercel Marketplace "STORAGE" prefix was the original offender); the code reads these exact names.
4. Clerk publishable key keeps the `NEXT_PUBLIC_` prefix exactly; the Marketplace integration creates empty Production placeholders — paste real values manually.
5. Notification badge must be monochrome (`public/icons/badge-96.png`; regenerate via `scripts/gen-badge.py`).
6. Crons fail CLOSED (`lib/cron-auth.ts`): missing `CRON_SECRET` → 503, wrong → 401, `Authorization: Bearer $CRON_SECRET` → run. Never "restore" fail-open — that was the pre-0.9.17 vulnerability (audited 2026-06).
7. **Next.js 16 has breaking changes vs training data** — read `node_modules/next/dist/docs/` for current API shapes before writing Next-specific code (`@AGENTS.md`, imported above, carries this too).
8. **Content-authoring:** a `: ` (colon-space) in an unquoted frontmatter value makes gray-matter throw → `loadEditorialAnswers` silently skips the file (404) — quote the value. The `/information` registry memoises per-process → a content edit needs a dev restart to surface.
9. **Dev loop:** `next build` clobbers a running `next dev` (shared `.next` — restart dev after a build); deleting a route leaves a stale `.next/dev/types/<route>/page.ts` that fails `tsc` until cleared (`rm -rf .next/dev/types/<route>`).

## Session shape
- **Start — read in order:** this file · `docs/HANDOFF.md` (running ops record — landmines, what shipped, infra ledger, open questions) · `IDEAS.md` (Now/Next queue) · `SCHEDULE.md` (today's plan) · memory `feedback-paddock-*` files (**every rule there is non-negotiable, user-set behavior**). Then propose a time-plan + an explicit "won't touch this session" line into `SCHEDULE.md`; create tasks for the in-scope work.
- **Returned from compaction / resume:** the summary is unverified — run `git status` + `git diff --stat HEAD`, and re-Read a region before editing it.
- **Time tracking:** a `[+Nm]` prompt prefix = N active minutes since the previous prompt → append to today's `Active:` line in `SCHEDULE.md`, keep a running total, report the daily total at session end. A bare `[+12m]` message backfills the previous window.
- **Mid-session idea:** acknowledge in one sentence, append one sentence to `IDEAS.md` Inbox, return to the active task. Never derail.
- **End:** triage the Inbox (promote to Now/Next, park, or kill with a one-line why); update `docs/HANDOFF.md`; mark the day's plan done/partial/skipped in `SCHEDULE.md`. Keep the record dense, not exhaustive.
- **Conversational authoring IS the CMS:** every editable surface has a file home under `content/`; renderers prefer curated/override files, external APIs are fallbacks; `content/**` edits are real commits that ship to prod. Probing a new external source: fetch `robots.txt` + `sitemap.xml` first (skip if 404). Open-Meteo weather lookups go by venue-local date, never UTC.

## Release notes (mandatory on every push to `main`)
1. `CHANGELOG.md` — engineering log (file paths, function names, root causes belong here).
2. `RELEASES.md` — public, rendered at `/changelog`: user-facing prose ONLY (no file paths, no library names, no SHAs); 1–3 sentences per bullet; internal-only changes get one acknowledging line.
3. `package.json` version bump (patch/minor/major). `/changelog` shows this as "currently running" — skipping it lies to users.

## Blog publishing SOP — drafts only; operator approves + schedules
`content/posts/*.mdx` **auto-publishes on merge** (the 2026-07-03 British GP preview went live unsigned that way; reverted in #373) — so use MDX only when I explicitly ask. Every post is a DB draft on **PROD** Supabase:
1. Create via `scripts/draft-post.mts` with PROD `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `BLOG_AUTHOR_ID` (or a Management-API SQL insert via `.supabase-pat`, browser UA). ⚠ `.env.local` points at LOCAL Supabase (127.0.0.1) — a draft created with default env never reaches prod.
2. Leave `publish_at` null — I approve + schedule in the `/blog` admin queue (`lib/blog.ts` `createDraft` contract); the publish cron takes it live and fires the push.
3. Verify: the row exists on PROD Supabase with **`status='in_review'`** and `publish_at` NULL, AND the post does NOT appear on public `/blog`. **Not `'draft'`** — `scripts/draft-post.mts:74` calls `submitPost()` straight after `createDraft()` on purpose, because a script-authored post arrives finished and a private draft would be invisible in the operator's queue. `publish_at` NULL is the safety property that matters; the status is `in_review`.
4. Triple-check content facts against primary sources before queueing (RULE #1).

## Stack + where things live
Next.js 16 App Router · React 19 · Tailwind v4 · `@serwist/next` PWA · Clerk Production auth · KV (`KV_REST_API_URL` / `KV_REST_API_TOKEN`) · Supabase. Public-with-account auth model. Repo `paris-paraskevas/motorsport`, default branch `main`. Live: https://paddock-tracker.com, served by a **Cloudflare Worker** built with OpenNext (`npm run cf:build` → `wrangler deploy`, config in `wrangler.jsonc` + `open-next.config.ts`); Workers Builds redeploys on a merge to `main`. Prod Supabase ref `dzelqrtajnauunzmxfic` (migrations via Management API + `.supabase-pat`, browser UA — **the PAT is live, verified 2026-08-21**).

**Worker size is a hard ceiling and we are at it.** `wrangler deploy --dry-run` measured **10176.64 KiB gzipped** on 2026-08-21 against Cloudflare's 10 MiB paid-plan limit — under 10 MiB by 63 KiB (0.6%), and a 0.330.0 deploy did go through, which settles it as the binary reading. Treat the bundle as full: measure before adding a dependency, and `npm run deploy:testing` deploys to the testing Worker where a size rejection is harmless.

| Path | Purpose |
|---|---|
| `app/` | App Router routes (route-groups `(app)` / `(marketing)` / `(admin)`); `middleware.ts` at the repo root is the middleware |
| `components/` | React components; `components/weekend/*` = race-weekend page |
| `lib/` | Pure modules; server-only helpers end in `*-loader.ts` to keep client bundles clean |
| `content/series/<slug>/` | Per-series curated data (meta, drivers, champions, rounds, session overrides, fallback ICS) |
| `content/posts/*.mdx` | Legacy blog posts — do NOT add new ones (see Blog SOP) |
| `tests/fixtures/` | ICS + JSON fixtures |
| `IDEAS.md`, `SCHEDULE.md` | Idea ledger + time plan — session-start reads |
| `CHANGELOG.md` / `RELEASES.md` | Engineering log / public notes at `/changelog` |

## Commands
`npm run dev` (plain `next dev` — the `--webpack` flag is gone from `package.json`) · `build` · `lint` (0 errors, **2 known `_encoding` warnings** in `lib/content-fs.ts`) · `test` (vitest, `--passWithNoTests`; **1133** as of 0.330.0) · `health` / `health:standings` / `health:results` · `indexnow:submit` · `cf:build` / `deploy` / `deploy:testing` (Cloudflare). Requires `.env.local` and `.supabase-pat` (present, gitignored). **`.env.local` points at LOCAL Supabase (`127.0.0.1:54321`)**, so anything needing prod data — the blog band on `/app`, any published-post read — renders empty locally unless Docker + `supabase start` are running. **`.clerk` does not exist** in the working tree; Clerk keys live in `.env.local`. Edit tool returns "file modified since read" → Read the file, THEN Edit; never retry blind (per-file read checksum).
