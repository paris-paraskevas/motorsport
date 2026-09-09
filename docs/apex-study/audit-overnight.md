# Overnight batch-list audit

## Verdict
Batch order 0-6 (decide, harness, shell, components, pages, platform) is dependency-correct — keep it.
It already self-flags real risk (ledger-test seeding, NEEDS-the-word tags, Windows/hook caution) but misses three: Phase 2's ledger rows go stale once Table/Cards merges; no slot owns the "atomic apply" primitive two Phase 4 items assume; the CSP rollout plan ignores an incident this repo already had.
Nothing in Batch 0/1 should merge overnight except two small items already pending in the handoff — the rest is draft work.
Hooks have zero track record here on Windows/Git-Bash: write and unit-test tonight, don't wire live unsupervised.
Biggest risk: forcing every subagent onto Sonnet is marked "accepted" with no clear operator yes, and the wrong settings file would tax every other project silently.

## Questions for the operator

Tonight, ranked by how soon they block:
1. Rules v2 or v3? Batch 1 is built against whichever is picked; redoing it later wastes the work. Default: v3 — that's why the full APEX read happened.
2. Hooks: write/unit-test only tonight, or wire live too? No hook has run in this repo; a bad Stop hook can eat the night silently. Default: write and test standalone; first live run happens supervised.
3. Confirm CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 goes in repo-local .claude/settings.json only, and that forcing Sonnet onto plain Explore/Plan lookups here, not just the programme's agents, is accepted, not an oversight. Default: yes.
4. The study-file move and the Madrid fix are small and pending — merge tonight? Default: yes for the file move; for Madrid, only if you name the source now, else it waits for a proper look-up (RULE #1).
5. Confirm tonight is otherwise draft-only, no Phase 1-4 slots attempted. Default: yes.

Morning, before Batch 1 continues:
- Table/Cards merge, from tonight's mockup — needs your side-by-side review, not a midnight call.
- P1.1's five looks, P1.8's Theme Roller tokens (already tagged NEEDS the word).
- Give "atomic, validated, staged apply" its own slot — two Phase 4 items assume it exists.

At the slot, already correctly deferred — don't let them creep earlier: series tabs shape, bets tab, studio editor, W5 path-vs-domain, Clerk Organizations, Comments, the Members/Moderation migration id, first dialog pages, first data catalogue, column-preset names, Form item set.

## Tonight's plan
Item, check, scope, merge or hold.
1. Draft rules v3 in scratchpad — 9 groups plus part A, each tagged with its enforcement. Scope: scratchpad. Hold.
2. Draft ledger v2: merge P2.2/P2.5/P2.6/P2.7 into one Data-region row, insert P2.0/P2.1, re-derive P2.25's Home mapping. Check: every P2.x id still resolves. Scope: scratchpad. Hold.
3. Table/Cards mockup — static screens, no live component code. Scope: artifact/scratchpad. Hold; it's the morning's decision aid.
4. Seed a draft ledger.json (R1/R2a/R2b/R4.1/Run-fix). Check: JSON parses, all ids present. Scope: scratchpad. Hold.
5. Write the 5 hook scripts in Node, unit-test via synthetic stdin, no settings.json wiring. Check: correct allow/deny per input. Scope: branch, unreferenced. Hold.
6. Move study files to docs/apex-study/ (git mv). Check: tsc/lint/vitest green, no reader change. Scope: docs/apex-study/* only. Merge if Q4 is yes.
7. Madrid fix, content-only. Check: round 14 shows Madrid against the named source; RULE #1 still applies. Scope: content/series/f1/*. Merge only if the source was named tonight.
8. CLAUDE.md prune draft — every landmine traced against today's file. Scope: scratchpad, not committed. Hold; wants a human diff-read first.
9. Progress file, one line per finished item; no Batch 2-6 slot attempted — each blocks on an open question or on rules v3/ledger v2 landing. Say so in the morning report.

## Corrected batch sequence
1. Rules v3 — unchanged.
2. Ledger revision — unchanged in content, resized: rewriting ~10 Phase 2 rows plus P2.25 is the biggest item in Batch 0, not a quarter of "one session."
3. Insert: that revision must touch P2.2, P2.5, P2.6, P2.7 and P2.25 together — the original wording underplays this, and P2.25 targets the old, unmerged vocabulary.
4. Insert: an owning slot for "atomic, validated, staged apply, refuse-while-locked, warn-on-in-flight-run," before Phase 4's backups-with-restore and Working Copies — both assume it, neither builds it.
5. Vocabulary v2 — unchanged, stays a live side-by-side session.
6. Housekeeping words — unchanged, but split: TanStack and the cost PR wait for a supervised slot regardless (both barred overnight by standing rules); the study-file move and Madrid fix can clear tonight once named.
7. Batch 1 — same content, staged: settings.json plus the JSON ledger plus seeded test first; the 5 hooks second, unit-tested before live wiring; agents and skills third. Don't gate Phase 1's start on hooks being live, only on the ledger/test existing.
8. Phase 1 — unchanged order.
9. Phase 2 — unchanged, contingent on step 3.
10. Phase 3 — unchanged.
11. Phase 4 — unchanged except step 4 moved ahead of backups/Working Copies.
12. Continuous — unchanged.

## Mechanisms and mistakes for unattended work
Mechanisms: a /goal condition per item once real Phase 1+ slots start (tonight's drafts don't need it). A Stop hook gating tsc and changed tests, wired live only after a supervised run. A fresh-context reviewer per PR seeing only the diff and the slot's acceptance line, told to flag correctness and requirement gaps only — the same shape as this audit itself (one read-only agent, one file, incremental appends); reuse it per PR instead of a big morning swarm. A progress file, one line per item. The morning report's three parts — done with evidence, questions, blocked — and "chose not to attempt X" belongs in blocked, not silence.

Mistakes to avoid: premature completion (label drafts as drafts); over-ambition (no Phase 1 slot tonight, none are decision-free); weak testing (quoted command results even for the two small PRs, browser-check Madrid if it renders); environmental degradation (restart next dev after any build); context pollution (one context per item); expensive-model leakage (not tonight's risk since no agents build, but any reviewer stays Sonnet, sequential).

Subagent auditing: yes — it's already rule 2/6's own design. Keep it cheap: one reviewer per PR, sequential, diff-only context, correctness-and-gaps-only instructions (open-ended "find problems" invents them, as this task's own framing warns), Sonnet never Fable, stated tokens before/after, and past 60 percent usage stop spawning reviewers and hold the rest rather than merging unreviewed.

## Risks the batch list underplays
1. Vocabulary merge vs stale ledger rows. Verified: lib/design/families/ has only calendar.tsx — Table/Cards aren't code yet, so this is a docs risk, not code churn. Left alone, Batch 3 builds them separately, then re-merges days later. Mitigation: sequence item 3.
2. Ledger test vs Calendar already served from rows. R4.1 has no P3.x id. Mitigation: confirm the test accepts the R-codes; run it on a branch before it gates anything.
3. Hooks on Windows, no precedent (verified: settings.local.json has none today). Node scripts run via `node file.js` sidestep the shebang problem already anticipated, but the first live Stop hook should still be watched — the 8-block cap limits damage, it doesn't prevent a wasted night.
4. CSP rollout ignores this repo's own history. Verified in next.config.ts:9-58: report-only since the 2026-06-11 audit, enforcing since 0.334.17 — and enforcing once broke AdSense's fraud script (ep2.adtrafficquality.google) because it sat in frame-src but not script-src. A real incident, already in code comments, that P4.5 must build from, not repeat.
5. CLAUDE_CODE_SUBAGENT_MODEL_FORCE's scope. Verified: .claude/settings.json doesn't exist yet. The wrong file — user-global instead of repo-local — taxes every other project silently.
6. No cumulative bundle budget. CLAUDE.md tracks a 64 MiB ceiling (~1/3 free as of 1.0.29); per-PR reporting exists but nothing tracks the running total across ~21 new components plus TanStack. Mitigation: an explicit alarm threshold, e.g. flag at 80 percent of the ceiling.

## What was verified and what was not
Verified: package.json at 1.0.95; #973-975 are docs-only commits, so the gap from 1.0.92 isn't hidden code. .claude/agents/ and .claude/settings.json don't exist; .claude/skills/ already exists (blog-authoring, clerk symlinks, lapstory-post, weekend-post) — precedent for new skills. docs/plan/ and docs/apex-study/ don't exist — nothing built yet. lib/design/families/ has only calendar.tsx; lib/design/plan-ledger.test.ts doesn't exist. .github/workflows/ has three files (data-freshness.yml, export-design.yml, warm-live-data.yml) — one more than CLAUDE.md's landmine names. No @tanstack/table or react-table package exists (only unrelated query-core) — TanStack Table would be genuinely new. settings.local.json has no hooks today. next.config.ts:9-58 confirms the CSP/AdSense incident above.

Not verified, out of scope: the plan-page artifact's content (not fetched); Anthropic's published guidance, taken as given per the brief since WebFetch/WebSearch were disallowed; Clerk's full origin list beyond next.config.ts.
