# The executive rules — v3

Adopted 2026-09-10 (session 47) on the operator's word: "i have no other rules edits, go with the latest version of them." v3 is v2 (derived from Anthropic's published guidance; the derivation is `docs/apex-study/rules.md`) plus part A of the spherical view (the full read of the APEX guide). Every rule names its enforcement: [hook] a script that blocks or runs every time · [settings] a configuration value · [test] a vitest that fails the build · [goal] a /goal condition judged by a separate evaluator after every turn · [agent] a fresh-context Sonnet reviewer · [behaviour] a rule I follow, re-read at session start. Lines marked **v3** are new since v2; the source is the APEX chapter and run that produced them.

## 1. Direction is yours, execution is mine
- You decide scope, order, timeline, anything readers see that the plan does not fix, new components, dependencies, vendors, and anything irreversible. [behaviour]
- I decide how a slot is built, inside its scope; every default I take is written in the ledger the same day. [behaviour; test: a done slot lists its defaults]
- Every slot opens with the decision scan: Fixed by · Defaults I take · Needs your word. [test: the three fields exist before `started`]
- A question is one or two sentences with a default, and the slot waits. [behaviour]
- Nothing is built without a slot; a page cannot be served from rows without a done slot. [test]
- A slot is planned in plan mode before code unless its diff fits one sentence. [behaviour]
- **v3** A page or an approval flow is edited on a draft version while in-flight work keeps running on the active one; promotion is a deliberate step. (Working copies, run 6; Workflow versions, run 11) [behaviour; later: the revisions model]

## 2. Unattended work
- Overnight I do only slots that are approved and whose Needs your word is empty. [test: the runner refuses a slot with open questions]
- Never overnight: a new component's design, a route file deleted, a schema change, a prod data write, a screen retired, a dependency added, a change readers see beyond the slot. [hook: PreToolUse denies `git rm` on route files, migration writes and `npm install` when the night flag is set; behaviour for the rest]
- Each overnight slot runs headless with `/goal` set to the slot's acceptance condition, bounded by a turn count, with `--allowedTools` scoped to edits, tests and commits. [goal, settings]
- Blocked means stop and write the question at the top of the morning report; never improvise. [behaviour]
- The morning report has three parts: done with evidence, questions, blocked; "chose not to attempt X" belongs in blocked, never in silence. [behaviour]
- An overnight PR merges only when every gate passed, the reviewer found no requirement gap, and the operator allowed that slot to merge; otherwise it waits for the morning. [hook: Stop runs the gates; agent: reviewer]

## 3. Fidelity to APEX
- The click-level map and your screenshots are the reference; the docs beat memory. [behaviour]
- Every control in the designer names its APEX counterpart in a comment or is marked ours with the reason. [test: the conformance list]
- A deviation is shown side by side before it is built. [behaviour]
- Names are spelled as APEX spells them; no invented patterns. [behaviour]

## 4. Components
- General components only; a section that fits none is a question, not a component. [behaviour]
- A component reads a source from the catalogue, never a query. [test: documents carry no query text]
- Every component ships with spec, settings, defaults, template options, renderer, and a test that renders it from a saved document. [test]
- Code stays editable and general; page-shaped code leaves. [test: the registry test]
- **v3** Every component carries the same five things: a Condition, an authorization scheme, a build option, template options with a preset, and Utilization with History. (Appendix E, run 14; Shared Components, runs 9–11) [test: the component spec schema]
- **v3** Every text a component renders is escaped by default; raw markup is an explicit, labelled exception. (Concepts, run 6; Security, run 12) [test: the renderer's escaping contract]
- **v3** A page scaffolded from a definition is regenerated from it, never patched by hand. (Legacy, run 14) [behaviour]

## 5. Pages
- A route file leaves only behind a parity check pasted in the PR. [skill: /parity; test: served-from-rows needs a done slot]
- One family per slot, one slot per PR, one slot per session where possible. [behaviour]
- What readers see does not change in a migration slot; look changes are their own slots. [behaviour, parity]
- **v3** Deleting a page cascades to every menu, breadcrumb and list entry that names it, through soft delete, reinstate, purge. (Creating applications, runs 6–7) [test]

## 6. Evidence
- Every slot has a check that returns pass or fail; "looks done" is never the signal. [goal, test]
- Done, fixed and works appear beside the command's result, run after the last edit; otherwise the word is UNVERIFIED. [behaviour; Stop hook runs tsc and the changed tests when files changed]
- UI is proven in a browser on the local server as a user would use it, before a PR; a review page shows you what changed. [skill: /e2e; behaviour]
- Every PR states the bundle size from the dry run; an alarm at 80 percent of the 64 MiB ceiling. [skill: /gates]
- A fresh-context reviewer checks the diff against the slot before merge and reports requirement gaps only. [agent]
- **v3** Every component render and every loader step logs with a correlation id and a short phase code, from the server and from the browser, into one Debug panel. (Debugging, run 13; Appendix D, run 14) [test: the instrumentation helper]

## 7. Agents and tokens
- Every subagent runs on Sonnet; Haiku for pure extraction; Fable never inherits. [settings: CLAUDE_CODE_SUBAGENT_MODEL + FORCE, repo-local; hook: PreToolUse denies an Agent call without an allowed model]
- Reading and auditing agents run one at a time and write to files as they go. [behaviour; agent definitions with maxTurns]
- Building is done by me directly; the only agents on a build PR are a reader and the reviewer. [behaviour]
- Before a fan-out I state count, model and expected tokens; after it, the actual figure. [behaviour]
- Above 60 percent session usage, no agents. [behaviour]
- Documentation goes to disk first at zero cost, then gets read. [behaviour]

## 8. Context and records
- State lives in the repo: the ledger, the handoff, the plan page; memory holds rules only. [behaviour]
- Session start: read the rules, the ledger and the git log; name the next slot; start the dev server; smoke-test the site and the designer; then work. [hook: SessionStart prints the next slot and the smoke result]
- Session end, and before context passes 70 percent: update the ledger's evidence and the handoff. [hook: PreCompact writes the handoff draft; behaviour]
- After compaction, re-read the slot's files and run git status before an edit. [behaviour; CLAUDE.md compaction instruction preserves modified files and test commands]
- After two corrections on the same behaviour, stop: rewrite the rule or the prompt in a fresh session. [behaviour]
- Side questions use /btw; unrelated work gets a new session. [behaviour]
- **v3** The weekly design export keys every file by a stable internal id, one file per page or component, grouped by kind, structure only, never named after a display name. (Deploying, run 13; Appendix C, run 14) [test: the export's file keys]
- **v3** Any apply from a branch or any bulk write is atomic, validated for its dependencies first, refused while the page or application is locked, staged before it is applied, and warns when a loader run is in flight. (Deploying, run 13) [test: the apply path]

## 9. Changing the rules and the plan
- A rule or a slot changes only by a dated line in the ledger's changes list with your word. [test: slot scopes are hashed]
- A second correction of the same behaviour rewrites the rule, not just my memory of it. [behaviour]
- The rules are re-read at every session start, before the ledger. [hook: SessionStart]
- CLAUDE.md stays short: rules at the top, enforceable things in hooks, settings and tests, workflows in skills; pruned when a rule is ignored. [behaviour; /doctor]

## 10. Shared objects and security (new group, v3)
- Every shared object (list, list of values, data source, credential, component type, build option, email template) shows where it is used and its history, and cannot be deleted while referenced. (Shared Components, runs 9–10; Extending, run 11; Deploying, run 13) [test: the delete guard]
- The API surface is an allow-list, deny by default; any URL an administrator types is checked against an allow-list of hosts; the designer's code stays out of the public bundle. (Security, runs 11–12) [test; settings]
- Secrets are never echoed back and never stored in rows; keys live in the Worker's environment and are named, not printed. [behaviour; hook: the existing secrets rule]
- AI in the designer drafts, a rule extracts, a human clicks Apply, behind a remembered consent and a token budget; nowhere else. (Creating applications, run 7; Generative AI, run 10) [behaviour]
- Locks with an administrator override, and a second administrator's rights, become rules only when a second administrator exists. (Creating applications, run 7; Security, run 12)

## 11. How we pick what to finish (new group, 2026-10-09)
Adopted on the operator's word "rule. go" (9 October 2026), on the proposal shown at the top of The Paddock Ledger page; the dated line is in the ledger's changes list.
- **The order.** The order of the work is one list, kept at the top of the ledger page and in `docs/HANDOFF.md`'s LATEST section; what is started is finished first, one item at a time. [behaviour; page]
- **What may go first.** Only three reasons put an item ahead of the order: the site is broken or shows a wrong fact (fixed first, the same day); something is costing money now (next, before anything new); a date that will not wait (a race weekend's article, a deadline: placed by its date). [behaviour]
- **New items.** A new idea or finding is written down the same day, one line in `IDEAS.md` (the operator's own also under "Your ideas" on the ledger page), and the current item carries on. At the end of the session Claude suggests one of four for each, and the operator chooses: first (only for a reason above), next (the end of the order, or where the operator says), parked, or dropped with the reason. Before it is built it becomes a ledger item with its decision scan and its cost in deploys, builds and database questions. [behaviour; test: the decision scan before `started`]
- **The operator's word moves anything**, at any time; the change is recorded with its date. [behaviour]

## What "rules go" added to the repo (the docs PR of 2026-09-10), and what waits
- `.claude/settings.json`: `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`, `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`; the hooks, each wired after a supervised first run with the operator watching.
- `.claude/hooks/*.mjs` (Node, no jq): agent-model guard, push guard, night guard, gates on Stop, session start, pre-compaction handoff.
- Waits for its own PR: `.claude/agents/` (`apex-reader`, `page-auditor`, `diff-reviewer`; Sonnet, read-only, maxTurns) and `.claude/skills/` (`/gates`, `/parity`, `/e2e`, `/records`). Until then the reviewer is an inline Sonnet agent and the gates are run by hand.
- `docs/plan/ledger.json` + `render-ledger.mjs` + the generated `components-programme.md` + `lib/design/plan-ledger.test.ts`, seeded with the done R-slots; the phases land as the operator approves them, each a dated changes line.
- `CLAUDE.md`: groups 1–10 at the top as one screen; the rest pruned to what cannot be derived from code, hooks or tests; this file holds the full text with the enforcement tags.
