# The batch list as proposed by Claude on 2026-09-10 (to be scrutinised)

Estimate: early November 2026 at this week's pace (about five substantive PRs a day with the operator present for approvals and prod applies), mid-December at half pace; shorter if Working Copies or the utilities wait.

## Batch 0 · Decide, with the operator, before anything is built (one session)
1. Rules v3 (v2 in rules.md plus part A of the spherical view). Issue: CLAUDE.md is long and Anthropic's docs say long files get ignored. Solution: the nine groups as one screen at the top, everything enforceable moved to hooks, settings and tests, the rest pruned; behaviour observed to test the change.
2. The ledger revised per part B, as JSON with a generated Markdown view. Issue: sixty-plus slots is too much to approve at once. Solution: approve phase by phase; each slot's decision scan asks its question only when its turn comes.
3. The vocabulary v2 (about 21 regions plus shared components). Issue: merging Table and Cards into one data region can read as losing the Small/Mid/Large simplicity. Solution: sizes and views are settings on the same region; two screens side by side before the merge.
4. Housekeeping words: TanStack Table; the study files into docs/apex-study; the Cloudflare cost PR; the Madrid venue fix.

## Batch 1 · The harness, so the rules enforce themselves (one to two days)
5. Settings: every subagent forced to Sonnet (CLAUDE_CODE_SUBAGENT_MODEL + FORCE). Issue: also applies to built-in Explore/Plan agents. Solution: accepted; forks keep the main model only when context must be inherited.
6. Hooks: PreToolUse deny an Agent launch without an allowed model; deny git push outside a PR branch; deny overnight deletions of route files, migrations and npm installs; Stop hook runs the gates when files changed; SessionStart prints the next slot; PreCompact writes the handoff draft. Issue: Windows Git Bash, jq not guaranteed, latency, a Stop hook fighting a legitimate turn (8-block cap). Solution: hooks in Node, narrow matchers, a marker file so the gates run once per change set, a dry session to test each hook.
7. Project agents (.claude/agents: apex-reader, page-auditor, diff-reviewer; Sonnet; maxTurns). Issue: a read-only tool list cannot append the notes file. Solution: Bash allowed only for the append pattern.
8. Skills (/gates, /parity, /e2e, /records). Issue: a heavy skill triggered by the model at the wrong time. Solution: disable-model-invocation on the heavy ones.
9. The JSON ledger (docs/plan/ledger.json) + lib/design/plan-ledger.test.ts + generated components-programme.md. Issue: the test fails today because Calendar is already served from rows. Solution: seed the done slots (R1, R2a, R2b, R4.1, Run fix) first.
10. The CLAUDE.md prune. Issue: losing landmines. Solution: landmines live in docs/HANDOFF.md and are pointed to.
11. The weekly design export keyed by stable id, one file per component, structure only. Issue: today's export may name files by slug. Solution: check first; switch the key before any rename.

## Batch 2 · Phase 1, the shell (about a week; decision-free slots first)
12. P1.3 Header and Footer text, build option per region. Issue: new document fields. Solution: document version 2, lenient parser, tests on old documents.
13. P1.5 Layout/Gallery/Utilities conformance (Display from Here, Expand/Restore, Gallery Add To, Two/Three Pane, Reset Layout). Issue: pane state persistence. Solution: per-user localStorage.
14. P1.6 Property Editor conformance (edited marker, multi-select common attributes, Region/Attributes tabs).
15. P1.9 Debug panel (sources, loader runs, timings, rules fired, dynamic actions fired; correlation id; phase codes).
16. P1.4 Rendering points (Before/After Regions, Before/After Footer) and tree creates (Create Region/Sub Region/Page Item/Button, Copy To, Duplicate, Delete, Ctrl+drag).
17. P1.1 The five looks (plain, boxed, band, aside, hero) — NEEDS the operator's word on the screens.
18. P1.2 Template options with presets (Spacing, Heading style, Rule, Emphasis, Width).
19. P1.7 Developer toolbar: Quick Edit, Live Template Options, Show Layout Columns, Page Timing, Options.
20. P1.8 Theme Roller from the toolbar — NEEDS the operator's word on which tokens.
21. P1.10 Create menu conformance (Page Group, Developer Comment, Breadcrumb Region).

## Batch 3 · Phase 2 foundations and components (about two weeks)
22. P2.0 The component definition model (attributes with scope, typed editors, groups, events, capability flags, slots); Component Settings migrates into it. Seed migration on the operator's word.
23. P2.1 Data Sources as a shared component + the Source picker + loader vocabulary (append/merge/replace, steps, run log). One migration (operator applies).
24. P2.x The Conditions vocabulary replacing show rules (both readable for one release).
25. P2.2 The data region: views (table, cards, list, timeline, detail), row templates, column types, named presets for the fifteen standings/results shapes.
26. P2.3 Saved views, sort options, URL filter vocabulary — TanStack Table on the operator's word.
27. P2.12 Filters as a layer (cascading facets, chip preview, facet search, size guardrail).
28. P2.13/14 Chart, Map + Map Backgrounds shared component.
29. Metric cards, Countdown, Live band, Tabs, Embed, Weather, Circuit (+ the Madrid venue fix verified against the official 2026 calendar), Search (results + configurations), Breadcrumb.
30. P2.20 Form + field templates + lists of values + validations + success step (Resend / push).
31. Email Templates editor; Automations page with Run now.
32. P2.25 Home's six become instances (parity, the operator publishes).

## Batch 4 · Phase 3, the pages (about two weeks; parity before every deletion)
33. Prose pages (about moves to a content file first), then the Learn hub.
34. Series directory and hub; the tabs (NEEDS the word: one page with Tabs or one per tab); the archive.
35. Weekend; the session page (per-visit; parity on a past weekend; the bets tab as Form or code component on the word).
36. Drivers and teams (+ missing JSON-LD); F1 analysis and compare.
37. Blog, news, authors; the studio (the editor as a code component, on the word).
38. Settings, contact and feedback, social, threads, sign-in/sign-up (Clerk widget), Home, the last file.

## Batch 5 · Phase 4, full control (two to three weeks)
39. W2 application key from the request; W3 the sign-in step (Organizations on in Clerk: the operator's action).
40. W4 App Builder home from the onboarding screens; the New Application wizard (features checklist, page-type picker).
41. W5 serving a second application (NEEDS the word: path prefix or domain).
42. Application Definition tabs, Security first (CSP rollout report-only → enforce; audit rollups; access-control template).
43. Members and Moderation as Tasks (six roles, Info Requested, expire/renew, vacation rule, state-gated actions, unified list) — one migration on the word.
44. Health: Advisor lint, activity sections, a durable activity table (sampled writes).
45. Utilities: dashboard, change history, recently updated, code-snippet inventory, page/application locks, backups with restore (needs atomic apply), data loading, view/edit as JSON.
46. Copy Page + Duplicate (share or fork); page modes + Dialogs node; the Object Browser data view.
47. Working Copies (compare, merge, refresh, badge) on the revisions model.

## Batch 6 · Continuous
Records at every session end; the weekly export; Health thresholds; the timeline re-estimated in the ledger after each batch, every change dated.
