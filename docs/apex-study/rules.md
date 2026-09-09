# The executive rules — draft v2 (2026-09-09 evening)

Scrutinised against Anthropic's published guidance: Best practices for Claude Code (code.claude.com/docs/en/best-practices), Effective harnesses for long-running agents (anthropic.com/engineering, 2025-11-26), Effective context engineering for AI agents (anthropic.com/engineering), and the hooks, subagents and /goal documentation. Each rule names how it is enforced: [hook] a script that blocks or runs every time · [settings] a configuration value · [test] a vitest that fails the build · [goal] a /goal condition checked by a separate evaluator after every turn · [agent] a fresh-context subagent · [behaviour] a rule I follow, re-read at session start.

## What the sources changed in v1

1. **The ledger becomes JSON, not Markdown.** Anthropic found models are "less likely to inappropriately change or overwrite JSON files compared to Markdown"; their harness lets the agent change only one field (`passes`). Ours: `docs/plan/ledger.json`, the agent may change only `evidence` and `done`; a rendered Markdown view is generated from it.
2. **Overnight runs get a machine evaluator, not my judgment.** A slot runs as `claude -p "/goal <the slot's acceptance condition> … or stop after N turns"` with `--allowedTools` scoped; a separate small model judges completion after every turn, and a Stop hook runs the gates before a turn may end.
3. **A fresh-context reviewer before merge.** The docs' Writer/Reviewer pattern and the adversarial review step: a subagent that sees only the diff and the slot, told to flag correctness and requirement gaps only.
4. **The token rule becomes a setting.** `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` with `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` in `.claude/settings.json` forces every subagent onto Sonnet regardless of what any prompt says; a hook is the belt to that brace.
5. **CLAUDE.md gets pruned.** The docs: "bloated CLAUDE.md files cause Claude to ignore your actual instructions"; "if Claude keeps doing something you don't want despite having a rule against it, the file is probably too long". Ours is long. The executive rules go in as a short list at the top; anything enforceable moves to a hook, a setting or a test; domain workflows move to skills.
6. **A session-start routine, as in the long-running harness:** read the ledger and the git log, pick the highest-priority undone slot, start the dev server, smoke-test, then work, one slot at a time; end by writing progress. Premature completion, over-ambition, poor testing and a degraded environment are the four failure modes the routine exists to prevent.
7. **After two corrections on the same thing, stop.** The docs: a third correction pollutes the context; rewrite the prompt or the rule instead, in a fresh session.
8. **Interview to spec before a phase.** For larger features the docs recommend an interview with AskUserQuestion that ends in a written spec, executed in a fresh session. Each phase's open questions become that interview.

## The rules

### 1. Direction is yours, execution is mine
- You decide scope, order, timeline, anything readers see that the plan does not fix, new components, dependencies, vendors, and anything irreversible. [behaviour]
- I decide how a slot is built, inside its scope; every default I take is written in the ledger the same day. [behaviour, test: a done slot must list its defaults]
- Every slot opens with the decision scan: Fixed by · Defaults I take · Needs your word. [test: the slot record has the three fields before `started`]
- A question is one or two sentences with a default, and the slot waits. [behaviour]
- Nothing is built without a slot; a page cannot be served from rows without a done slot. [test]
- A slot is planned in plan mode before code unless its diff fits one sentence. [behaviour]

### 2. Unattended work
- Overnight I do only slots that are approved and whose Needs your word is empty. [test: the runner refuses a slot with open questions]
- Never overnight: a new component's design, a route file deleted, a schema change, a prod data write, a screen retired, a dependency added, a change readers see beyond the slot. [hook: PreToolUse blocks `git rm`/`rm` on route files, `supabase` and migration writes, `npm install`; behaviour for the rest]
- Each overnight slot runs headless with `/goal` set to the slot's acceptance condition, bounded by a turn count, with `--allowedTools` scoped to edits, tests and commits. [goal, settings]
- Blocked means stop and write the question at the top of the morning report; never improvise. [behaviour]
- The morning report has three parts: done with evidence, questions, blocked. [behaviour]
- An overnight PR merges only when every gate passed, the reviewer agent found no requirement gap, and the slot was decision-free; otherwise it waits for you. [hook: Stop hook runs the gates; agent: reviewer]

### 3. Fidelity to APEX
- The click-level map and your screenshots are the reference; the docs beat memory. [behaviour]
- Every control in the designer names its APEX counterpart in a comment or is marked ours with the reason. [test: a designer conformance test lists controls against the map]
- A deviation is shown side by side before it is built. [behaviour]
- Names are spelled as APEX spells them; no invented patterns. [behaviour]

### 4. Components
- General components only; a section that fits none is a question, not a component. [behaviour]
- A component reads a source from the catalogue, never a query. [test: documents carry no query text]
- Every component ships with spec, settings, defaults, template options, renderer, and a test that renders it from a saved document. [test]
- Code stays editable and general; page-shaped code leaves. [test: the registry test]

### 5. Pages
- A route file leaves only behind a parity check pasted in the PR. [skill: /parity produces the output; test: served-from-rows needs a done slot]
- One family per slot, one slot per PR, one slot per session where possible. [behaviour]
- What readers see does not change in a migration slot; look changes are their own slots. [behaviour, parity]

### 6. Evidence
- Every slot has a check that returns pass or fail; "looks done" is never the signal. [goal, test]
- Done, fixed and works appear beside the command's result, run after the last edit; otherwise the word is UNVERIFIED. [behaviour; Stop hook runs tsc and the changed tests before a turn ends when files changed]
- UI is proven in a browser on the local server as a user would use it, before a PR; a review page shows you what changed. [skill: /e2e recipe; behaviour]
- Every PR states the bundle size from the dry run. [skill: /gates]
- A fresh-context reviewer checks the diff against the slot before merge and reports requirement gaps only. [agent]

### 7. Agents and tokens
- Every subagent runs on Sonnet; Haiku for pure extraction; Fable never inherits. [settings: CLAUDE_CODE_SUBAGENT_MODEL + FORCE; hook: PreToolUse on Agent denies a missing or non-sonnet/haiku model]
- Reading and auditing agents run one at a time and write to files as they go; a killed agent keeps its partial output. [behaviour; agent definitions with maxTurns]
- Building is done by me directly; the only agents on a build PR are the reviewer and a reader. [behaviour]
- Before a fan-out I state count, model and expected tokens; after it, the actual figure. [behaviour]
- Above 60 percent session usage, no agents. [behaviour]
- Documentation goes to disk first at zero cost, then gets read. [behaviour]

### 8. Context and records
- State lives in the repo: the ledger, the handoff, the plan page; memory holds rules only. [behaviour]
- Session start: read the rules, the ledger and the git log; name the next slot; start the dev server; smoke-test the site and the designer; then work. [hook: SessionStart prints the next slot and the smoke result]
- Session end, and before context passes 70 percent: update the ledger's evidence and the handoff. [hook: PreCompact writes the handoff draft; behaviour]
- After compaction, re-read the slot's files and run git status before an edit. [behaviour; CLAUDE.md compaction instruction preserves modified files and test commands]
- After two corrections on the same behaviour, stop: rewrite the rule or the prompt in a fresh session. [behaviour]
- Side questions use /btw; unrelated work gets a new session. [behaviour]

### 9. Changing the rules and the plan
- A rule or a slot changes only by a dated line in the ledger's changes list with your word. [test: slot scopes are hashed; a changed hash without a changes entry fails]
- A second correction of the same behaviour rewrites the rule, not just my memory of it. [behaviour]
- The rules are re-read at every session start, before the ledger. [hook: SessionStart]
- CLAUDE.md stays short: rules at the top, enforceable things in hooks, settings and tests, workflows in skills; pruned when a rule is ignored. [behaviour; /doctor]

## What this adds to the repo on "rules go"
- `.claude/settings.json`: `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`, `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`; hooks: PreToolUse (Agent without an allowed model → deny; `git push` outside a PR branch → deny; route-file `git rm`, migration and `npm install` overnight → deny), Stop (run `tsc` and the changed tests when files changed), SessionStart (print the next slot, smoke the dev server), PreCompact (write the handoff draft).
- `.claude/agents/`: `apex-reader` (sonnet, Read/Grep/Bash-append, maxTurns), `page-auditor` (sonnet, read-only), `diff-reviewer` (sonnet, read-only, fresh context).
- `.claude/skills/`: `/gates` (tsc, lint, vitest, cf:build, dry-run size), `/parity` (before/after of a route), `/e2e` (the Playwright recipe), `/records` (handoff, schedule, ideas, trio).
- `docs/plan/ledger.json` + generated `components-programme.md`; `lib/design/plan-ledger.test.ts`.
- `CLAUDE.md`: the nine groups at the top as one screen; the rest pruned to what cannot be derived from code, hooks or tests.
