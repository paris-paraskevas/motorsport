@AGENTS.md

# Paddock — the executive rules and the laws

Adopted 2026-09-10 (session 47) on the operator's word "rules go". Anthropic's guidance: keep this file short; put what must happen every time into hooks, settings and tests; put workflows into skills; test a change by watching behaviour. Everything cut from the previous file is enforced elsewhere (named below), derivable from the code, or recorded in `docs/HANDOFF.md`, which is read at session start.

## The rules (v3, one screen; the full text with enforcement tags is `docs/plan/rules.md`)
1. **Direction is yours, execution is mine.** You decide scope, order, timeline, anything readers see that the plan does not fix, components, dependencies, vendors, irreversible actions. Every slot opens with the decision scan: Fixed by · Defaults I take · Needs your word; a non-empty third line stops the slot; a question is one or two sentences with a default. Nothing is built without a ledger slot; a slot is planned in plan mode before code unless its diff fits one sentence. Work outside a slot goes through the same gate: evaluate, scrutinise, present the plan with a pre-mortem and a won't-touch line, await the word.
2. **Unattended work.** Overnight, decision-free slots only; never a new component's design, a route file deleted, a schema change, a prod write, a screen retired, a dependency added, a reader-visible change beyond the slot. Blocked means stop and write the question. The morning report: done with evidence · questions · blocked.
3. **Fidelity to APEX.** The click-level map and the operator's screenshots are the reference; every designer control names its APEX counterpart or is marked ours with the reason; deviations are shown side by side first; APEX's names, no invented patterns.
4. **Components.** General components only; a section that fits none is a question. Sources from the catalogue, never a query. Every component ships with spec, settings, defaults, template options, renderer and a test from a saved document, and carries a Condition, an authorization scheme, a build option, template options with a preset, Utilization and History. Text escaped by default. Generated pages regenerated, never hand-edited.
5. **Pages.** A route file leaves only behind a parity check pasted in the PR; one family per slot, one slot per PR; readers see no change in a migration slot; Delete Page cascades and soft-deletes.
6. **Evidence.** Every slot has a pass-or-fail check. "Done", "fixed", "works" appear beside the command's result run after the last edit, or the word is UNVERIFIED. UI is proven in a browser on the local server; a review page shows the change; the dry run's size is quoted (alarm at 80% of 64 MiB); a fresh-context Sonnet reviewer reads the diff before merge; renders and loader steps log with a correlation id and a phase code. Mistakes are flagged the moment they are seen ("Correction: …"); sources are cited (file:line, memory path, URL); when memory and code disagree, the code wins and the memory is updated.
7. **Agents and tokens.** Every subagent on Sonnet (Haiku for extraction); never Fable. One reading agent at a time, writing to files as it goes; no agent builds; a fan-out is announced (count × model × tokens) and reported after; none above 60% session usage; documentation to disk first.
8. **Context and records.** State lives in the repo: `docs/plan/ledger.json`, `docs/HANDOFF.md`, the plan page; memory holds rules only. Session start: rules, ledger, git log, next slot, dev server, smoke test. Before 70% context: ledger evidence and handoff. After compaction: re-read the slot's files and `git status` before an edit. After two corrections on one behaviour, stop and rewrite the rule.
9. **Changing the rules and the plan.** Only by a dated line in the ledger's changes list with your word; a second correction rewrites the rule; the rules are re-read at session start; this file stays short.
10. **Shared objects and security.** Every shared object shows where it is used and its history and cannot be deleted while referenced. The API surface is an allow-list; admin-typed URLs are checked against a host allow-list; designer code stays out of the public bundle; secrets are named, never printed or stored in rows. AI drafts, a rule extracts, a human applies, behind consent and a budget.

## Laws (irreversible or prod-affecting; hooks enforce the first three)
- **Never `git push` to main, and never merge into it.** Branch from latest `next` → PR into `next` → review → squash-merge into `next`; only the operator merges `next` into main, once a day, with a merge commit (never a squash), and that merge is the only deploy. Conventional commits; the body explains the why; no `Co-Authored-By` or Claude attribution. [hook: push-guard; check: from-next, required by the ruleset on main]
- **Every subagent names an allowed model.** [settings: CLAUDE_CODE_SUBAGENT_MODEL=sonnet + FORCE; hook: agent-model-guard]
- **Night mode:** while `.claude/night-mode` exists, no route file deleted, no migration written, no dependency installed, no prod Supabase write. [hook: night-guard]
- **Every PR gets a real description** (what, why, how verified) and carries the trio: `CHANGELOG.md` (engineering), `RELEASES.md` (public prose, no paths, no libraries, no SHAs; `# ` opens a release, `## <version> — <date>` is a push; opening a release is the operator's call), `package.json` version bump, and its entry in `docs/pull-requests.md` (what readers see, what editors get, every file with a line, the verification, the review). Forgot and pushed → immediate follow-up.
- **Never weaken a failing check** (no skips, deleted tests, loosened asserts, widened catches, `as any`, lint-disables): quote the failure, propose, wait. [Stop hook runs tsc and the changed tests: stop-gates]
- **Never delete files or branches, `git reset --hard`, or `git checkout -- <file>`** without pasting what is lost and getting the word. **Never print or commit secrets**; name the variable and where it lives.
- **The operator's merge of `next` into `main` deploys to prod in about six minutes; there is no other deploy step and no preview copy.** Each deploy fills the new cache, goes live, then marks the previous build's cache folder for deletion (`npm run deploy:cf`). `PADDOCK_ENV=production` lives in `wrangler.jsonc` only; `isProductionWorker()` gates design writes.
- **Prod Supabase writes only on an explicit "apply <id>"**, rehearsed first inside begin…rollback through the Management API.
- **Content is rule one:** every fact checked against primary sources before it ships; thin upstream data is curated under `content/series/<slug>/`, never called a limitation. Conversational authoring is the CMS: every editable surface has a file home under `content/`, and a `content/**` edit is a real commit that ships. A new external source is probed through its `robots.txt` and `sitemap.xml` first.
- **New files need the word** (name, format, purpose). No new abstraction without a second consumer.

## Landmines (the facts you cannot infer; details and history in `docs/HANDOFF.md`)
- Next.js 16 differs from training data: read `node_modules/next/dist/docs/` first. The middleware file is `middleware.ts` (OpenNext needs it); the deprecation warning is expected.
- A `content/**` or `RELEASES.md` edit is invisible to `next dev` until `npx tsx scripts/bundle-content.mts` runs; `next build` clobbers a running `next dev`; a deleted route leaves stale `.next/dev/types` (clear them).
- KV env vars are unprefixed (`KV_REST_API_URL`, `KV_REST_API_TOKEN`); the Clerk publishable key keeps `NEXT_PUBLIC_`; crons fail closed (`lib/cron-auth.ts`).
- The Worker never fetches upstreams (`DATA_SOURCE=db`); `scripts/warm-live-data.mts` is the only writer; a parser change is proven only once the loader has run with it. OpenF1 is the exception.
- Anything reached from `lib/design/page-frame.tsx` lands in every route's chunk: renderers import their data dynamically. Worker ceiling 64 MiB uncompressed; quote `wrangler deploy --dry-run` Total Upload.
- A `: ` in an unquoted frontmatter value silently drops the file; the notification badge must be monochrome; Open-Meteo lookups go by venue-local date.
- `.env.local` points at LOCAL Supabase; prod reads need Docker + `supabase start` or the Management API with `.supabase-pat` (browser UA). The Supabase organisation is on the Free plan: no backups.
- Blog posts never ship as MDX; they are prod DB drafts with `publish_at` null (`scripts/draft-post.mts` sets `in_review` on purpose).

## Stack and commands
Next.js 16 App Router · React 19 · Tailwind v4 · Serwist PWA · Clerk · Upstash KV · Supabase · Cloudflare Worker (OpenNext; `wrangler.jsonc`). Repo `paris-paraskevas/motorsport`, live at https://paddock-tracker.com. Prod Supabase ref `dzelqrtajnauunzmxfic`.
`npm run dev` · `build` · `lint` (0 errors, 2 known `_encoding` warnings) · `test` (vitest) · `health*` · `cf:build`.

| Path | Purpose |
|---|---|
| `app/` | routes (`(app)` / `(marketing)` / `(admin)`); `middleware.ts` at the root |
| `components/`, `lib/` | React components; pure modules (`*-loader.ts` server-only) |
| `content/series/<slug>/` | curated per-series data; `content/posts/*.mdx` legacy, do not add |
| `docs/plan/` | the ledger and the rules; `docs/HANDOFF.md` the running record; `docs/apex-study/` the research |
| `CHANGELOG.md` / `RELEASES.md` | engineering log / public notes at `/changelog` |

## Session shape
Start: this file → `docs/plan/ledger.json` (the next slot) → `docs/HANDOFF.md` LATEST → `IDEAS.md` → `SCHEDULE.md` → the memory `feedback-paddock-*` files (every rule there is non-negotiable, operator-set); then a time plan and a "won't touch this session" line. `[+Nm]` prefixes log active minutes. Mid-session ideas go to `IDEAS.md` Inbox in one sentence. End: sort the Inbox (first / next / parked / dropped, the operator chooses; the order and what may go first are `docs/plan/rules.md` § 11), update the ledger's evidence and the handoff, mark the day's plan. When compacting, preserve the list of modified files, the gate commands, the current slot id and its decision scan, and every open question.
