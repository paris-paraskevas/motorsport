@AGENTS.md

# Paddock — operating manual for Claude

Read this whole file at the start of every session. Then read `IDEAS.md` + `SCHEDULE.md` to know what we're working on this week.

## Quick context

- **Repo:** `paris-paraskevas/motorsport`, default branch `main`. Vercel auto-deploys every push to main; no PR review gate.
- **Live URL:** https://paddock-tracker.com. Vercel project name: `motorsport`.
- **Stack:** Next.js 16 App Router (middleware lives in `proxy.ts`, not `middleware.ts`), React 19, Tailwind v4, `@serwist/next` PWA, Clerk Production auth, Vercel KV. Public-with-account auth model.
- **Authoring model is conversational, not an admin UI.** Edits to `content/**/*` are real commits that ship to production within ~90s.

## Read these before doing anything

**Required at every session start, in this order:**

1. This file (`CLAUDE.md`) — operating manual, ESPA loop, working agreement.
2. **`docs/HANDOFF.md`** — running operational record: critical landmines, what shipped last session, infra ledger, open design questions. **Always read at session start.** The per-user memory file at `memory/project-paddock-handoff.md` is now a redirect stub pointing here.
3. `IDEAS.md` — Now / Next queue; what we're working on this week.
4. `SCHEDULE.md` — today's plan.
5. `AGENTS.md` (embedded above) — Next.js 16 has breaking changes from training data. Check `node_modules/next/dist/docs/` for current API shapes before writing Next-specific code.
6. Memory feedback files — every rule there is non-negotiable user-set behaviour. The current set:
   - `feedback-paddock-debug-with-own-eyes` — visually verify UI in a browser before saying "shipped". Typecheck + curl miss user-facing bugs.
   - `feedback-paddock-search-for-missing-data` — when upstream feeds are thin, web-search the official source and curate. Don't shrug it off as a "documented limitation".
   - `feedback-paddock-weather-venue-local` — Open-Meteo lookups go by venue-local date, never UTC.
   - `feedback-vercel-node-ical` — keep BOTH `serverExternalPackages` AND `outputFileTracingIncludes` in `next.config.ts`.
   - `feedback-paddock-session-workflow` — the time-plan-at-start / capture-mid-session / triage-at-end loop described below.
   - `feedback-paddock-release-notes` — every push must update `CHANGELOG.md` + bump `package.json` version. Hard rule.
   - `feedback-paddock-espa` — Evaluate / Scrutinize / Present / Await before every non-trivial action. Imported from `eshp`. Approvals must be explicit; commits never include Claude attribution.
   - `feedback-paddock-time-tracking` — per-prompt `[+Nm]` prefix logs active minutes to `SCHEDULE.md`. See the Time tracking section below.

## ESPA — before every non-trivial action

Non-negotiable. Apply this loop to any change that isn't an obviously trivial edit (typo fix, version bump, accepting a previously-agreed plan).

1. **E — Evaluate** what is being asked — understand intent and context.
2. **S — Scrutinize** the request — assess whether it's the best approach, even if explicitly instructed. Push back if you see a concrete flaw, risk, or inefficiency.
3. **P — Present** your opinion as a step-by-step plan the user can analyze.
4. **A — Await** confirmation before executing.

Approvals are explicit ("yes", "go ahead", "approved", "do it"). Do not infer approval from silence or from a follow-up question.

**Extensions:**
- **Mid-execution failure recovery.** If a plan fails mid-execution, STOP. Don't push through. Re-evaluate from step 1 with what you now know and present a revised plan.
- **Senior-engineer self-check.** Before presenting a plan, ask: *"Would a senior engineer approve this?"* If not, fix it first.
- **Pre-mortem one-liner.** Every plan also states its most likely failure mode in one sentence. Forces the **S** step to do real work instead of rubber-stamping.
- **Verify the obvious.** When a load-bearing assumption is unverified, verify it before relying on it. "Obviously works" is how silent bugs land (e.g. `lib/rounds.ts` importing `fs/promises` into a client-bundled module was "obviously fine" until the dev server 500'd).
- **Negative space at plan-time.** Every plan includes a one-line "won't touch this session" — the same scope-discipline rule used in `SCHEDULE.md`, lifted to per-plan scope.
- **Memory drift check.** Before recommending action based on a remembered fact, verify against current code or `git log`. Memory written last session may be stale; code is authoritative.
- **Realistic scope, single plan in mind.** Sandbox your ambition to what's actually achievable in the session. When running multiple workstreams in parallel, hold the active plan in mind so a new one doesn't quietly displace it — capture parallel ideas to `IDEAS.md` Inbox, don't context-switch.

## Mode awareness

- **Suggest plan mode** when: task touches 3+ files, involves architectural decisions, is ambiguous, has multiple valid approaches, or the user says "build / redesign / restructure / plan".
- **Stay in execute mode** when: single-file edit, clear and specific instruction, bug fix with known location, or read-only research.
- **When unsure:** ask. *"This looks like it needs a plan. Want me to enter plan mode?"*

## Time tracking

Realistic *active* time per session, not wall-clock between prompts. **Per-prompt prefix `[+Nm]`** at the start of a new prompt = `N` active minutes the user spent between the previous prompt and this one.

- Examples: `[+15m] curate IMSA sessions.json`, `[+5m] back, what was the diff?`.
- Counted: reading, thinking, coding, watching me work, on-task AFK (e.g. checking a real browser).
- Not counted: idle wall-clock time when the user was away from the project entirely.
- On seeing `[+Nm]`: append it to today's section in `SCHEDULE.md` under an `Active:` line, maintain a running total. Then respond to the rest of the prompt normally.
- Forgot the prefix? Reply with just `[+12m]` (no other text) and I'll backfill the previous window.
- Daily total appears at session end alongside the `→ done` outcomes.

## Session workflow

The bottleneck on this project is throughput — there are always more ideas than build hours. The workflow exists to make scope discipline explicit, not to make work feel structured.

**At session start:**
1. Read this file, `IDEAS.md`, and `SCHEDULE.md`.
2. Propose a time-plan: what we'll achieve this session + an explicit "won't touch this session" line. Add it to `SCHEDULE.md` under the current day.
3. Open `TaskList` and create concrete tasks for the in-scope work.

**Mid-session — when a new idea surfaces:**
1. Acknowledge in one sentence.
2. Append it to `IDEAS.md` Inbox as one sentence — no formatting, no commitment.
3. Continue the active task. Do not derail.

**At session end:**
1. Triage the Inbox — promote to Now / Next, move to Parked, or kill with a one-line "why".
2. Update `memory/project-paddock-handoff.md` with what shipped and what's open.
3. Update `SCHEDULE.md` — mark the day's plan as done / partial / skipped; sketch tomorrow if known.

## Working agreement

- **Browser-verify before "shipped".** Typecheck + tests + curl prove code compiles, not that features work. Open the affected page in Chrome and click through the user flow.
- **Search for missing data.** If the upstream ICS / scrape / API is thin, do not declare it a limitation — web-search the official source, curate a sidecar file under `content/series/<slug>/`, ship the patch.
- **Conversational authoring is the CMS.** Every editable surface has a file home under `content/`. Renderers prefer curated/override files; external APIs are fallbacks. See the handoff's "Authoring model" table for the mapping.
- **No new abstractions without a real second consumer.** Three similar lines beats a premature helper. No future-proofing for use cases that don't exist yet.
- **Push back when you see a concrete flaw, risk, or inefficiency.** This is expected and valued, not insubordination. Pairs with the **S** in ESPA above — Scrutinize even when explicitly instructed.
- **Flag mistakes inline immediately ("Correction: …"). Never silently fix.** If you spot a wrong claim — yours or in code — call it out in the same message; don't quietly rewrite history.
- **State your sources.** When making claims, name where you got it (memory file path, code line, web search, prior conversation). Lets the user verify.
- **Never create new files without permission.** State filename, format, and purpose; await before writing. Prefer editing existing files.
- **Format discipline.** Adapt verbosity to task complexity. Tables only when comparing 3+ items across 3+ attributes (otherwise prose). Code blocks always language-tagged. Heading depth H2/H3 only.
- **Ask `AskUserQuestion` when scope is unclear.** Better to lose 30s on a confirmation than ship the wrong thing.
- **Always re-Read a file immediately before each Edit call.** When the Edit tool returns "File has been modified since read, either by the user or by a linter", do NOT retry the Edit with the same precondition — Read the file first, THEN Edit. The tool tracks a per-file read-state checksum; long-lived in-context understanding of a file is not enough. This is a repeated stumble; treat the rule as load-bearing.
- **Check `robots.txt` + `sitemap.xml` first when probing any new external source.** One fetch each, cheap. Often surfaces structured endpoints or off-limits paths. Skip if 404 or empty. Applies to scrape work in `lib/results/*` and `lib/standings/*`.
- **Verify on Vercel preview, not just localhost, before declaring "shipped".** Especially for any code path that does outbound network from server-side (any new `lib/results/*` or `lib/standings/*` parser). Localhost runs on residential IP + full Node TLS; Vercel Functions run on datacenter IPs with a restricted runtime — WAF / TLS-fingerprint / runtime-restriction failures only show up on `*.vercel.app`. The 0.12.12 NASCAR prod regression shipped because this check was planned-but-skipped.

## Release notes are mandatory — two files, two audiences

**Every push to `main` must update three things:**

1. **`CHANGELOG.md` (engineering log, git-only).** New section at the top: `## X.Y.Z — YYYY-MM-DD` with `### Fixed` / `### Added` / `### Changed` subsections. This is the detailed record for contributors — file paths, function names, root-cause explanations are fine here.
2. **`RELEASES.md` (public-facing, rendered at `/changelog`).** Matching `## X.Y.Z — YYYY-MM-DD` section, but **user-facing prose only** — what changed for visitors, not where the diff landed. No file paths, no library names, no commit SHAs. 1–3 sentences per bullet. If a change has no user-visible impact, write one sentence acknowledging it (e.g. "Internal: hardened cron auth").
3. **`package.json` `"version"` bump.** Patch for bugfix, minor for feature, major for breaking changes.

The `/changelog` page reads `RELEASES.md` directly and shows `package.json.version` as "currently running". A push that skips this lies to users about what's live.

**Why split:** mixing the two leaks the implementation map for free and reads as an immaturity signal to anyone evaluating Paddock (sponsors, contributors, recruiters). Engineering detail belongs in commit messages + `CHANGELOG.md` + `docs/HANDOFF.md`. The public `/changelog` is fan-facing.

If you forget and code is already pushed, push a follow-up commit with both files updated immediately. Don't leave them stale.

## Critical landmines

Detailed rationale in the handoff. Quick-reference:

1. `next.config.ts` needs BOTH `serverExternalPackages: ["node-ical"]` AND `outputFileTracingIncludes` for node-ical. Removing either breaks production fetches.
2. Middleware file is `proxy.ts` in Next 16, not `middleware.ts`. `clerkMiddleware()` itself unchanged.
3. KV env vars are unprefixed (`KV_REST_API_URL`, `KV_REST_API_TOKEN`). Do not accept a "STORAGE" custom prefix from the Vercel Marketplace flow.
4. Clerk publishable key must keep `NEXT_PUBLIC_` prefix exactly. Vercel Marketplace integration auto-creates env-var placeholders but leaves them empty on Production promote — you must paste real values manually.
5. Notification badge must be monochrome (`public/icons/badge-96.png`). Regenerate via `scripts/gen-badge.py` if changed.
6. Crons **fail closed**: missing `CRON_SECRET` → 503, wrong secret → 401, correct `Authorization: Bearer $CRON_SECRET` → run. Reversed from fail-open in 0.9.17 (security review); pattern in `lib/cron-auth.ts`. (This line previously described the pre-0.9.17 fail-open behavior — trusting it would have reintroduced the vulnerability; audit 2026-06.)

## Where things live

| Path | Purpose |
|---|---|
| `app/` | Next.js App Router routes. `proxy.ts` is middleware. |
| `components/` | React components. `components/weekend/*` for the race-weekend page. |
| `lib/` | Pure modules (parsing, grouping, types). Server-only helpers end in `*-loader.ts` to keep client bundles clean. |
| `content/series/<slug>/` | Per-series curated data (meta, drivers, champions, rounds, sessions overrides, overview, significance, fallback ICS). |
| `content/posts/*.mdx` | Blog posts. |
| `tests/fixtures/` | ICS + JSON test fixtures. |
| `memory/` (per-user, not in repo) | `project-paddock-handoff.md` is the running ops record; `feedback-*` files are rules. |
| `IDEAS.md`, `SCHEDULE.md` | Idea ledger + time plan. Read at every session start. |
| `CHANGELOG.md` | Engineering release log (git-only). Updated on every push with file-path-level detail. |
| `RELEASES.md` | Public-facing release notes (rendered at `/changelog`). Updated on every push with user-facing prose only. |

## Commit & branch conventions

- Paddock is now a two-person project. **Read `CONTRIBUTING.md`** for the full workflow.
- Default flow: branch from latest `main` → PR → preview review → squash-merge.
- Never push directly to `main`. Hot-fix process documented in `CONTRIBUTING.md`.
- Conventional commits: `feat(scope):`, `fix(scope):`, `docs:`, `chore:`. See `git log --oneline` for prior style.
- Commit body explains the *why*, not the *what*.
- **Never include `Co-Authored-By` or any Claude attribution** in commit messages.
- Bundle related fixes; don't split a single user-facing bug across multiple commits if they share a root cause.

## When in doubt

- Use `AskUserQuestion` to confirm scope or design choice. The cost of asking is 30s; the cost of wrong work is hours.
- If a memory says one thing and the current code says another, trust the code and update the memory.
- If a TODO from the handoff is uncertain, check `git log` first — it may already be done.
