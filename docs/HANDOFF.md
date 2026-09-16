# Paddock — handoff

The running operational record. Read at session start. Update at session end.

This replaces the per-user memory handoff that lived at `~/.claude/projects/C--Dev-Personal-Motorsport/memory/project-paddock-handoff.md` until 2026-05-16. Memory file is now a redirect stub.

---

## ⚡ Next session pickup — 2026-09-15 (LATEST, session 49 — **the agent-model guard fixed (#990, 1.0.109); P1.2 (#991), P1.7 (#992), P1.10 (#993), P1.11 (#994) shipped; the home lead unpinned on the operator's word; P1.12 Delete Page cascade and soft delete STARTED and two of its three PRs on prod: A soft delete, reinstate, purge (#996, 1.0.115, migration 20260915130000 applied) and B1 row pages as destinations of the lists (#997, 1.0.116); B2 buttons, go effects and Named by is the next build; this records PR is 1.0.117**)

### 🔴 Start here — a handoff prompt for the next session (copy it whole)

```
Session 50 start. Read in order before any tool call beyond reading: CLAUDE.md · docs/plan/rules.md (v3) · docs/plan/ledger.json (Phase 1: P1.2, P1.3, P1.5, P1.6, P1.7, P1.9, P1.10, P1.11 done with evidence, R5 and R5b done; P1.12 Delete Page cascade and soft delete is STARTED with PR A and PR B1 on prod and its evidence so far in the slot; PR B2, buttons and go effects to pages and Named by, is the next build, its plan approved and written (the plan file's "PR B2" section, folded into the ledger's defaults): RowPageData.pages at the three render sites from documentRefs(doc).dests, the Button region and DynamicActions' go resolving against it (a page not live draws nothing / goes nowhere), isGoDestination accepting the page: shape, the revisions route refusing ON PUBLISH ONLY a document naming a page not live (drafts permissive), goOptions(pages) and destinationLabel(key, pages) threaded through the pickers and the summaries, loadPageDetail adding namedBy { lists, pages } shown in the page's Advanced group and in the Delete Page sheet; its tests are already written to the scratchpad of session 49 as edit-b2-tests.cjs (run it first, see the seven files fail, then build); P1.1 the five looks, P1.4 the nesting depth, P1.8 the Theme Roller tokens carry a question) · docs/HANDOFF.md LATEST (session 49) · memory feedback-paddock-decision-scan, feedback-paddock-agent-model-cost and feedback-paddock-research-before-second-attempt.
State: main and prod at 1.0.117 once this records PR is merged (1.0.116 is P1.12 B1; check the CHANGELOG's top heading first). Migration 20260915130000 (page.deleted_at, deleted_by, design_purge_page, design_save_page_revision refusing a deleted page) is APPLIED on prod (15:55Z) and on the local database. Progress board: artifact 72019ad3-bea8-4ac0-80f1-9f22b61ed8f5 (regenerated at the second close of session 49 after 658220a0… stopped answering to the account in use, the third such change of the day; an artifact that stops answering is regenerated with its scratchpad builder, never asked about). Progress report for the operator (session 49 close): artifact cbec78de-a2c3-493a-a319-db1b1ba9f016, regenerated with the scratchpad's build-progress-report.cjs. Review pages: P1.11 6cf91749-9b25-4fbc-b08e-2f5c9510a6a6 · P1.12 A 379d6d6c-a3eb-41aa-8b69-b18687b67311 · P1.12 B1 600d3ca4-f648-47cd-afbb-06f9d8238772. The home page's lead is unpinned (a page_layout revision published 13:31Z on the word "go"; the rule, memory feedback-paddock-home-lead-unpinned: nothing pinned by default, a pin is deliberate and temporary). The merged branches stay on origin; deleting them needs the word. A question waits for the operator's turn: Size and Column Span both sit in the Layout group ("not sure size and column span are both needed"); default proposed: keep Column Span (APEX's) and drop Size or fold its three names into the pills.
Rules: every subagent on Sonnet or Haiku, one at a time, writing to files; no agent builds; the Agent tool carries no model field any more, the settings' force (CLAUDE_CODE_SUBAGENT_MODEL=sonnet, FORCE=1) is what runs subagents on Sonnet and the hook checks that it is on; prove the model by grepping "model" in the subagent's transcript under ~/.claude/projects/<project>/<session>/subagents/. A reviewer costs 75–270k tokens (P1.11's took 267k and 21 minutes and found a real defect), a plan critic 110–140k; say so first. A blocking finding is taken in a second commit with the test the reviewer names, and the gates are re-run after it. The decision scan (Fixed by · Defaults I take · Needs your word) before a slot, a question in one or two sentences with a default, then stop; plan mode before code, a Sonnet plan critic on the plan; tests first, seen failing, then green; gates after the last edit (tsc 0 · lint 0 errors · full vitest · node .claude/hooks/test.mjs); a browser run with screenshots into a review-page artifact; a fresh-context Sonnet reviewer before merge; merge only on the operator's word; prod check; ledger evidence (status and evidence only; a slot changes only by a dated changes line with the word); the trio on every push: the CHANGELOG entry INSERTED ABOVE the previous "## x.y.z" heading, RELEASES prose without paths, package.json bump. When the operator's check says a shipped slot does not do what they asked, research the documented cause with a citation before any second attempt. No eslint-disable, ever. The auto-mode classifier refuses Claude an edit of a hook governing its own tool use: write the fix to the scratchpad and ask the operator to copy it with a `!` command. gh pr create may fail with a GraphQL error; `gh api repos/paris-paraskevas/motorsport/pulls -f title=… -f head=… -f base=main -F body=@file` works.
Browser run recipe: Docker Desktop and the local Supabase up first (`docker info`; `npx supabase start`; REST 200 on 127.0.0.1:54321), else every admin design API answers 500. After any `npm run cf:build`, stop the dev server and `rm -rf .next/dev` before `PADDOCK_ENV=production npm run dev`, or the optional catch-all auth routes (/sign-in, /sign-up) answer 404. Mint a sign-in token (POST https://api.clerk.com/v1/sign_in_tokens with the dev CLERK_SECRET_KEY from .env.local and user_id user_3J40T0N8dWLFMqgMb06DjsgIj3c) into a scratch file and serve it from a scratch redirect on 127.0.0.1:4599 (/go → 302 to /sign-in?__clerk_ticket=…), so the ticket never enters the transcript; never grep the dev log without `sed -E 's/__clerk_ticket=[A-Za-z0-9._-]+/__clerk_ticket=<redacted>/g'`. Before driving a running page, silence the site's support prompt for the tab: `sessionStorage.setItem('paddock:support-prompt', '{"ms":0,"shown":2,"done":true}')` then reload (it otherwise opens after a while and intercepts every pointer event; a Playwright locator handler recurses). Then /admin/designer?page=250f3a59-43e6-46b5-b1ef-d1dc7b899fef (Monza, the local row page). The designer names its window paddock-designer; Save and Run publishes and opens the live page in the named tab paddock-run; every toolbar link back opens the one developer tab; the toolbar is off below 1024 px; ?debug=LEVEL6 turns App Trace on; Quick Edit ▸ Quick Edit Mode outlines a region and a click lands in the designer on it (?region=<id>); Edit Live Template Options shows the wrench. Playwright's `URL` is not defined inside browser_run_code_unsafe (split strings); a hover after a modal needs a mouse move first; getBoundingClientRect is zeros in jsdom (stub the prototype), location.reload cannot be stubbed (a prop), performance/clipboard are absent (props). Screenshots land only under .playwright-mcp (git-ignored). Stop the dev server and the redirect server by their PIDs (netstat :3000, :4599): stopping the harness's background task kills only the wrapper shell, the next dev child keeps port 3000, a second start moves to 3001, and clearing .next/dev under the live server yields 500 on every route. A dev server whose admin design APIs answer Next's HTML 404 page is stale although the routes sit in its manifest (seen once on 2026-09-15, cause not found): an anonymous curl of /api/admin/design/pages must answer the route's own plain-text "not found"; else restart on a cleared .next/dev. The tab Save and Run opens has a small viewport, so the Developer Toolbar is hidden until setViewportSize(1440, 900). The MCP browser can keep its frames paused for a whole run (requestAnimationFrame never fires while visibilityState reads visible and bringToFront changes nothing): prove next-frame focus and caret by stubbing rAF with a timer for the check, and say so. Playwright refuses a plain click on an aria-disabled element ("element is not enabled"), itself evidence; { force: true } proves the handlers are off. The tool echoes the final URL, spent ticket included, into the transcript even through the redirect; mint per run, never paste.
Agenda, THE ORDER FIXED BY THE OPERATOR on 2026-09-16 ~00:33Z ("b2 then p1.1 then p1.4 and p1.8 ask me as those go and then once all done pphase 2 screen", the ledger's changes list), each slot one PR: 1) P1.12 PR B2 (buttons, go effects and Named by; the plan approved, the tests written): branch from main, run the scratchpad's edit-b2-tests.cjs, build, gates, browser run (a Button on Monza to a page → the live page links to it → Delete Page → the button draws nothing → Reinstate → back; Named by on the page lists the lists and the live pages naming it), review page, reviewer, merge on the word; then P1.12 done in the ledger with its three PRs. 2) P1.1 Region looks: ASK FIRST, with the five looks (plain · boxed · band · aside · hero) drawn side by side on a real page as screens or a review page, the Size / Column Span question alongside; on the answer, plan mode, tests first, build. 3) P1.4 Rendering points and tree creates: ask with the default (one level of nesting), then build. 4) P1.8 Theme Roller: ask with the default (the nine tokens of the contrast gate), then build. Each of the three is asked when its turn comes, not before; the documentRefs gap (Header Text and Footer Text shortcuts not projected into the refs) is offered as a quick slot before Phase 2 if the operator says so. 5) Once all of Phase 1 is done: the Phase 2 screen, one page with the draft's 25 slots (P2.0 the component definition model first, P2.1 Data Sources, P2.2 the data region with views, then the components) and a decision scan, for the word "Phase 2 go" or a changed list; a dated changes line records it. 6) Close: HANDOFF, SCHEDULE, IDEAS triage, ledger evidence, one records PR; regenerate the board.
Landmines from session 49 (P1.12): stopping a background `npm run dev` through the harness kills only the wrapper shell and the next dev child keeps port 3000; stop it by the port's PID first, or the next start moves to 3001 and clearing .next/dev under the live one yields 500 everywhere. A stale .next/dev can answer the DYNAMIC API routes (pages/[id], lists/[key]) with Next's HTML 404 page while static routes work and the manifest lists them: check with an anonymous curl of /api/admin/design/pages/<uuid> (must be the route's plain-text "not found"), else restart on a cleared cache. The lists' and the frames' 60-second memos are reset by the API routes, but under next dev routes and pages compile apart, so the layout keeps the old list for up to a minute locally (the anonymous home was clean within ninety seconds); on the Worker the isolate that wrote sees it at once. A Bash heredoc of ~8 KB or more fails before running ("unexpected EOF while looking for matching quote"): write long node scripts to the scratchpad with the Write tool and run the file; several working-copy files are CRLF, so a node script that edits them must normalise line endings and write them back (the scratchpad's edit-*.cjs pattern). `URL` is not defined inside browser_run_code_unsafe; read a query parameter with a regex on page.url(). The Create page dialog draws its hint in small caps through CSS, so a regex on innerText misses the words; read the element or the screenshot. Playwright refuses a plain click on an aria-disabled element ("element is not enabled"), itself evidence. The tab Save and Run opens has a small viewport; call setViewportSize before reading the Developer Toolbar. The MCP browser can keep its frames paused for a whole run (requestAnimationFrame never fires while visibilityState reads visible): prove next-frame focus by stubbing rAF with a timer and say so. The Appearance document's 60-second memo means a saved preset (or face) reaches a page after up to a minute on any isolate but the one that served the save, and the dev server compiles routes and pages apart so it waits the minute locally too. A `<label htmlFor>` pointing at a button names the button. The Property Pane keeps a group's fold by title across selections and the page's Appearance group starts folded. A click on the site's support prompt counts as a click outside a region and exits Quick Edit, as APEX's does. A named target is found among the tabs familiar with the source (its opener and that opener's children): two running tabs opened by hand each keep a developer tab of their own. The one-shot pagesFilter: a group chosen through Create › Page Group… filters the pages list for that return alone. The back arrow must call onBack() bare, since its argument is a filter, not the click event. The reviewer's gaps are taken in a second commit and the gates re-run after it. P1.11's: the Property Pane keys its rows by label and keeps a group's fold across a selection change, so any stateful control inside a row must be keyed by the region (key={r.id}, as the Template Options button and now the text picker are) or its state survives into the next region; the tree selects on Enter without a mousedown, so an outside-click guard never fires for a keyboard reselection. documentRefs scans Static Content's text for shortcuts, not Header Text or Footer Text. A commented-out region stays in the refs on purpose (the write path stores the document as drawn), so its rows stay undeletable while it is on the page.
```

### What shipped today, with evidence
1. **#990 (1.0.109) the agent-model guard**: the Agent tool carries no `model` field any more, so the hook read nothing and denied every launch; it now allows a call that names no model when the settings' force is on and names Sonnet or Haiku, and still denies a disallowed model. The hook file was copied into place by the operator (the classifier refuses Claude an edit of a hook governing its own tool use). Merged 07:58Z, prod 08:03Z; the reviewer's transcript ran on claude-sonnet-5 throughout.
2. **#991 (1.0.110) P1.2 Template options**: five global groups (Spacing, Heading style, Rule, Emphasis, Width) with presets per template in the Appearance document, `#DEFAULT#` resolved live at render, the Templates shared component, the Appearance group on every region with APEX's Template Options button and dialog; the acceptance proven in the browser (a preset changed reached the regions on the defaults, a region with its own pick kept it). Reviewer: PASS; two gaps taken, one answered. Merged 08:14Z, prod 08:19Z. Review page `e50bd038-f198-4ebd-af36-9e5ee2313b65`.
3. **#992 (1.0.111) P1.7 Developer Toolbar: Quick Edit, Info and Options**, with the operator's three asks built in (Quick Edit hideable; every link into the designer opening the one developer tab; the bar off phones): Quick Edit Mode and Edit Live Template Options, the wrench publishing a template option live, `?region=` on the designer address, Show/Hide Layout Columns, Page Performance Timing, Auto Hide, Show Icons Only, Display Position. Reviewer: PASS; five gaps and one nit taken. Merged 09:57Z, prod 10:01Z. Review page `593f26c3-aaec-4541-8ec8-c73292930a5c`.
4. **#993 (1.0.112) P1.10 Create menu conformance**: APEX's seven entries in APEX's order (Copy Page and Issue disabled with their reason, Breadcrumb Region until the Breadcrumb component), Page Group… opening the Page Groups sheet from the designer and returning to the list filtered for one return, Developer Comment focusing the page's Comments field. Reviewer: PASS; three gaps and one nit taken. Merged 10:50Z, prod 10:54Z. Review page `ee396125-1149-4cff-bd3d-f615f8bbb563`.
5. **#994 (1.0.113) P1.11 Gallery hygiene, text picker, Comment Out**: Show Legacy in the Gallery's header row (off by default; on, the transitional body listed everywhere, inert with the reason where the page cannot take it), the text picker beside Text, Header Text and Footer Text (a popover with a filter, the shortcuts with their text, a Preview of the field as the page renders it, the pick at the cursor read when it opened; the pill row gone on the operator's "replace it"), Comment Out / Uncomment on a region (kept with all it holds, struck through in the tree, greyed on the tile, Yes / No under Configuration, noted in Messages, left out at runtime through the same filter as an Excluded build option, named apart in the Debug trace). Reviewer: FAIL on one blocking finding (the pickers not keyed by the region), taken in a second commit with the test the reviewer named; seven checks passed. Merged 12:37Z, prod 12:42Z. Review page `6cf91749-9b25-4fbc-b08e-2f5c9510a6a6`.
6. **#995 (1.0.114) the first close** (merged 13:03Z, prod 13:08Z), then **the home lead unpinned** (a prod write on the word "go", 13:31Z): the 7 September home-layout revision from the retired console pinned the Monza recap as the lead while the Madrid recap sat in More reading; a new published page_layout revision with no pin, rehearsed inside begin…rollback first, put the newest post back in the lead within a minute (13:32Z). Rule saved to memory (feedback-paddock-home-lead-unpinned): nothing pinned by default.
7. **#996 (1.0.115) P1.12 PR A, Delete Page moves a page to Deleted**: migration 20260915130000 (rehearsed twice inside begin…rollback, applied 15:55Z on "apply 20260915130000 and merge"), every reader skipping deleted pages, DELETE soft-deleting and returning the row, ?purge=1 through design_purge_page (refused with the names while a live page names the page; the page's list entries go with it), POST reinstate, PUT and a revision save refusing a deleted page, DELETE ?expired=1 removing the pages past their 30 days one click at a time, the pages list's Deleted view, a deleted page opened read-only with a banner and Utilities offering Reinstate and Delete permanently. Reviewer: PASS with one finding marked blocking in the schema (the purge's list-entry delete joined through list without the entry's own application_key; fixed before the apply) and four gaps taken. Merged 15:55Z, prod 16:01Z. Review page 379d6d6c-a3eb-41aa-8b69-b18687b67311.
8. **#997 (1.0.116) P1.12 PR B1, row pages as destinations of the lists**: page:<id> keys resolved against the live row pages by the loaders, the href carried on the entry for the shell's browser components, the Lists editor offering the row pages under Pages with three states per entry and a preview that hides a deleted page's entry as the shell does, the write path refusing a page not live, the page routes refreshing the layout and the lists memo. Reviewer: PASS, no blocking finding; two gaps taken. Merged 17:13Z, prod 17:19Z. Review page 600d3ca4-f648-47cd-afbb-06f9d8238772.
9. **Decisions recorded** (the ledger's changes list and the slots' defaults, the operator's words): the three toolbar asks of 08:30Z; the reading of P1.10's "P2.17" as the Breadcrumb component's slot; P1.11's scan answered "1. yes., 2. replace it." (~10:58Z), its plan approved (~11:15Z), its merge and the first close on the word (~12:36Z); "i want nothing to be pinned by default. so latest is shown then do p1.12" (~13:20Z) and "go" (~13:30Z) covering the unpin, P1.12's scan (row pages as destinations inside the slot; the 30-day window) and its plan; "apply 20260915130000 and merge" (~15:54Z); "merge" for PR B1 (~17:12Z); "handoff and handoff prompt when ur done" (~17:05Z).

### Questions for the operator (asked at their turn, not now; the order is the operator's of 2026-09-16: B2 · P1.1 · P1.4 · P1.8 · then the Phase 2 screen)
- P1.1 the five looks (screens first), P1.4 the nesting depth (one level proposed), P1.8 the Theme Roller tokens (the nine of the contrast gate proposed), each asked when its slot comes up; then Phase 2 as one screen once Phase 1 is all done; P3 and P4 later, one question each.
- Size and Column Span both in the Layout group: keep Column Span and drop Size, or fold Size's names into the pills.
- The documentRefs gap: `{shortcut:key}` inside Header Text and Footer Text is not projected into the refs, so a shortcut used only there can be deleted while a page names it (the Monza trace read "0 shortcuts" with one in the Standfirst's header). A small fix now (scan the two texts as the body is scanned, in the projection the write path stores) or with P1.12.
- The merged branches on origin: delete or keep.
- Delete Page on a CODE page stays refused until its family leaves the code (the route's 400); a code page's row can never be soft-deleted, so the frame reader's filter is consistency, not a guard.

### Won't touch until you say
Any Phase 2–4 slot; P1.1, P1.4, P1.8; the cost PR; Home's split on production; the console's file deletions; branch deletions; any prod Supabase write; any push to `main`; agents on Fable.

---

## ⚡ Next session pickup — 2026-09-10 afternoon (session 48 — **Phase 1's two decision-free slots shipped, P1.6 (#985, 1.0.104) and P1.9 (#987, 1.0.106); two quick-fix slots from the operator's walkthrough, R5 (#986, 1.0.105) and R5b (#988, 1.0.107); P1.2 is the one decision-free slot left in Phase 1; the operator was present throughout and merged each on the word; this records PR is 1.0.108**)

### 🔴 Start here — a handoff prompt for the next session (copy it whole)

```
Session 49 start. Read in order before any tool call beyond reading: CLAUDE.md · docs/plan/rules.md (v3) · docs/plan/ledger.json (Phase 1: P1.3, P1.5, P1.6, P1.9 done with evidence, R5 and R5b done; P1.2 Template options is the ONE decision-free slot left; P1.7 Developer Toolbar Quick Edit and Info, P1.10 Create menu, P1.11 Gallery hygiene, P1.12 Delete Page cascade need their scan; P1.1 the five looks, P1.4 the nesting depth, P1.8 the Theme Roller tokens carry a question) · docs/HANDOFF.md LATEST (session 48) · memory feedback-paddock-decision-scan, feedback-paddock-agent-model-cost and feedback-paddock-research-before-second-attempt.
State: main and prod at 1.0.108. Progress board: artifact 913e8349-6d89-4eaf-97c2-9e63211e4b3f (regenerated at the close of session 48 after the previous board e22aeeff… stopped answering to this account; the plan page 4d804904-63ad-4ddf-8d37-67dcb2d2fcc8 belongs to the other account); an artifact that cannot be updated is regenerated with its scratchpad builder, never asked about. The four merged branches of 2026-09-10 (and older ones) are still on origin; deleting them needs the word.
Rules: every subagent on Sonnet or Haiku, one at a time, writing to files; no agent builds; an Explore agent cannot write files, so a reading agent that must leave files behind runs as general-purpose on Sonnet; a reviewer costs 145–195k tokens, say so first. The decision scan (Fixed by · Defaults I take · Needs your word) before a slot, a question in one or two sentences with a default, then stop; plan mode before code; tests first; gates after the last edit (tsc 0 · lint 0 errors · full vitest · node .claude/hooks/test.mjs); a browser run with screenshots into a review-page artifact; a fresh-context Sonnet reviewer before merge; merge only on the operator's word; prod check; ledger evidence (status and evidence only; a slot changes only by a dated changes line with the word); the trio on every push: the CHANGELOG entry INSERTED ABOVE the previous "## x.y.z" heading, RELEASES prose without paths, package.json bump. When the operator's check says a shipped slot does not do what they asked, research the documented cause with a citation before any second attempt (R5b's lesson), and prove pointer or drag behaviour with the browser's own gesture, never synthetic events. No eslint-disable, ever: an effect that must keep empty dependencies uses refs and setters only.
Browser run recipe: PADDOCK_ENV=production npm run dev (the designer is read-only otherwise; edits then go to the LOCAL Supabase at 127.0.0.1; .env.local has no KV, so readSnapshotMeta returns {} and the trace's loader-run column is empty locally). Mint a sign-in token: POST https://api.clerk.com/v1/sign_in_tokens with the dev CLERK_SECRET_KEY from .env.local and user_id user_3J40T0N8dWLFMqgMb06DjsgIj3c (e2e-admin); open http://localhost:3000/sign-in?__clerk_ticket=<token> through the Playwright MCP's browser_run_code_unsafe (page.goto). The tool echoes the final URL, ticket included, into the transcript: mint a fresh token per run and never paste one into a PR or this file. Then /admin/designer?page=250f3a59-43e6-46b5-b1ef-d1dc7b899fef (Monza, the local row page). Save and Run publishes and opens the live page in the named tab paddock-run on the local origin; the Developer Toolbar sits at the foot of every live page for an administrator; ?debug=LEVEL6 on any page address turns App Trace on for that visit and View Debug opens the panel. A native drag on the Layout tab is driven with page.mouse.move → down → move → move → up; a move call that hangs means the page aborted the drag (Chromium ends a drag whose dragstart changes the DOM), not a Playwright fault. Screenshots land only under .playwright-mcp (git-ignored). Stop the dev server by its PID (netstat :3000) before a build; rm -rf .next/types after a branch switch if tsc names a deleted route. A local cf:build prerender WRITES snapshots and their meta to the prod KV and Supabase under the runner name local (DATA_SOURCE is unset locally): run it only when that is acceptable, or with DATA_SOURCE=db.
Agenda, each slot one PR: 1) P1.2 Template options (decision-free: groups with presets Spacing, Heading style, Rule, Emphasis, Width; #DEFAULT# behaviour; Global options; plan mode first, the plan presented for the word). 2) The scans for P1.7, P1.10, P1.11 and P1.12, one at a time, each question with a default; build the ones that come back decision-free. 3) At the operator's turn: P1.1 (the five looks shown side by side before the names are final), P1.4 (one nesting level proposed), P1.8 (the nine tokens of the contrast gate proposed); then Phase 2 into the ledger, one question per phase. 4) Close: HANDOFF, SCHEDULE, IDEAS triage, ledger evidence, one records PR.
Landmines from session 48: Chromium aborts a native drag whose dragstart changes the DOM (bug 168544; react-dnd issue 1085), so the designer sets its drag state one task later through beginDrag with a token; synthetic dragstart/drop events pass where the browser aborts, so a drag is proven only by the browser's own gesture. A menu rendered inside the toolbar's overflow-x-auto bar is clipped: menus render fixed above the bar. A pre-existing hydration warning shows on page load in the local browser run (Inbox). Home's six components appear in a Debug trace only once Home is served from rows; the acceptance's Home list is the debug-trace test today. F1's standings live under f1:<name> (their own last-good wrapper), so home.changed declares both prefixes. writeSnapshotMeta refuses on the Worker (isDbReadOnly), so a visitor render never writes meta; only the loader and a local build do. The trace's session step costs about 220 ms (Clerk). The toolbar fetches the pages list on every admin page load (Inbox). The Edit tool needs the file Read first; scripts with backslashes go through the Write tool, never a heredoc; the Stop hook runs tsc and the changed tests, so a stale test fails the stop until fixed. gh pr merge --squash without --delete-branch keeps the branch.
```

### What shipped today, with evidence
1. **#985 (1.0.104) P1.6 Property Editor conformance**: multi-select of regions with Ctrl+click editing the common groups (Position, Column, Size, Column Span, Build Option, the header and footer text), the "changed since the last save" marker (green, UX map line 142) beside every attribute until Save, the Region / Attributes tabs for a component with settings. Reviewer: three nits, all taken. Merged 11:50Z, prod 11:55Z. Review page `95285a0e-2315-4e76-81e5-57ec0afb4b79`.
2. **#986 (1.0.105) R5 the walkthrough's fixes** (the operator's words of 12:05Z–12:10Z in the ledger's changes list): Save and Run publishes and opens one named working tab (`paddock-run`; the local origin on localhost); the Developer Toolbar as APEX's overlay at the foot of every live page for an administrator (nine entries in APEX's order; Home, App, Page live; the rest disabled with their slot); a tile drags from any part; no two regions share a column (the pills offer free columns only, an overlap is a Messages error that holds Save, the served page wraps). Reviewer: an admin import that pulled the service-role client toward the client bundle (inline check now), the Column Span pills, the preview note, a no-revision page runs without publishing; all taken. Merged 13:02Z, prod 13:07Z. Review page `1a077e0d-b605-4309-b062-bdd2c8b87738`.
3. **#987 (1.0.106) P1.9 Debug panel**: the Debug menu on the toolbar (Enable Debug ▸ Info · App Trace · Full Trace, No Debug, View Debug), the level in sessionStorage or `?debug=`, the admin trace API re-running the page's pipeline with a collector (resolve · session · authz · show · build · refs · render, a correlation id from `cf-ray`), the panel with the step bars and the rows, the browser's bind and action lines, Export as JSON; the loader's F and W phases per snapshot key in the KV hash `snapshot-meta:last` under the run's name. Reviewer: a prod meta write from the Worker (gated), the browser log per page, a bad level → 400; all taken. Merged 14:09Z, prod 14:15Z; the loader dispatched once after the merge (run 34487264214, success): 38 keys with phases on prod. Review page `f067c81c-4bfd-433c-989c-b618b1d0f8f0`.
4. **#988 (1.0.107) R5b the drag begins in the browser**: the operator's check found R5's drag moved nothing; on "research, not gut" the cause was found (Chromium aborts a drag whose `dragstart` changes the DOM) and the state now sets one task later behind a token. Proven with the browser's own drag: ten targets, the drop moved Aside, Ctrl+Z restored it. Reviewer: no blocking finding, the test gap taken. Merged 14:22Z, prod 14:28Z. Review page `f3c9ba18-209d-4eeb-ae13-5d47f4d5866e`.
5. **Decisions recorded** (the ledger's changes list, dated, the operator's words): Save and Run publishes; one working tab with APEX's overlay; drag from any part of a tile; the R5 → P1.9 order; one loader dispatch after P1.9; R5's evidence corrected and R5b opened on "i dont think r5 did what i wanted … the rest of r5's statements did work however" and "wait do you want to research how to build this. instead of trusting your gut once again?".

### Questions for the operator (asked at their turn, not now)
- P1.1 the five looks (screens first), P1.4 the nesting depth (one level proposed), P1.8 the Theme Roller tokens (the nine of the contrast gate proposed); P2, P3, P4 into the ledger, one question each.
- The scans for P1.7, P1.10, P1.11, P1.12 may each raise one.
- The merged branches on origin: delete or keep.

### Noted, not done (in the Inbox)
- Dropping a tile onto another tile with a before/after gesture; the toolbar's pages fetch per page load; the trace's 220 ms session step; the pre-existing hydration warning; a local `cf:build` writing meta to the prod KV; the branches on origin; Playwright's ticket echo; Home traceable only once served from rows.

### Won't touch until you say
Any Phase 2–4 slot; P1.1, P1.4, P1.8; the cost PR; Home's split on production; the console's file deletions; branch deletions; any prod Supabase write; any push to `main`; agents on Fable.

---

## ⚡ Next session pickup — 2026-09-10 midday (session 47 — **rules v3 adopted and the hooks live (#980, 1.0.99); Phase 1 in the ledger (#981, 1.0.100); P1.3 (#982, 1.0.101) and P1.5 (#983, 1.0.102) shipped and on prod; P1.6 and P1.9 are the decision-free slots left in Phase 1; the operator wants Phase 1 finished today and this handoff written at 87% context**)

### 🔴 Start here — a handoff prompt for the next session (copy it whole)

```
Session 48 start (2026-09-10 afternoon). Read in order before any tool call beyond reading: CLAUDE.md (pruned, adopted 1.0.99) · docs/plan/rules.md (v3) · docs/plan/ledger.json (P1.3, P1.5 done with evidence; P1.6 and P1.9 are the decision-free slots left; P1.1, P1.4, P1.8 carry a question; P1.2, P1.7, P1.10–P1.12 need their scan) · docs/HANDOFF.md LATEST (session 47) · memory feedback-paddock-decision-scan and feedback-paddock-agent-model-cost.
State: main and prod at 1.0.102 (1.0.103 once the session-47 records PR merges). The six hooks are live from .claude/settings.json. Progress board: artifact 02e2516b-a170-4a3d-b220-8df19454b06f (the account Claude Code is signed into); the plan page 4d804904-63ad-4ddf-8d37-67dcb2d2fcc8 belongs to the other account.
Rules: every subagent on Sonnet or Haiku, one at a time, writing to files; no agent builds; the decision scan (Fixed by · Defaults I take · Needs your word) before a slot, a question in one or two sentences with a default, then stop; plan mode before code; tests first; gates after the last edit (tsc 0 · lint 0 errors · full vitest · node .claude/hooks/test.mjs); a browser run with screenshots into a review-page artifact; a fresh-context Sonnet reviewer before merge (budget about 200k tokens); merge only on the operator's word; prod check; ledger evidence (status and evidence only; a slot changes only by a dated changes line with the word); the trio on every push: the CHANGELOG entry is INSERTED ABOVE the previous "## x.y.z" heading (a script that returned the new entry without appending the anchor overwrote a heading twice today), RELEASES prose without paths, package.json bump.
Browser run recipe: PADDOCK_ENV=production npm run dev (the designer is read-only otherwise; edits then go to the LOCAL Supabase at 127.0.0.1); mint a sign-in token, POST https://api.clerk.com/v1/sign_in_tokens with the dev CLERK_SECRET_KEY from .env.local and user_id user_3J40T0N8dWLFMqgMb06DjsgIj3c (e2e-admin), and open http://localhost:3000/sign-in?__clerk_ticket=<token> in the Playwright MCP browser (file: URLs are blocked; a scratch http server on 127.0.0.1 can serve a redirect page); then /admin/designer?page=250f3a59-43e6-46b5-b1ef-d1dc7b899fef (Monza, a history, the local row page). Save and Run opens the preview on the PROD host when PADDOCK_ENV is production: navigate to http://localhost:3000/preview/<revision> by hand. Playwright screenshots land only under .playwright-mcp (git-ignored). Stop the dev server by its PID (netstat :3000) before a build.
Agenda, each slot one PR: 1) P1.6 Property Editor conformance (edited-attribute marker until Save; multi-select edits common attributes; Region / Attributes tab split for components with settings; acceptance: select two regions, change Position, both move; a changed attribute shows the marker until Save; browser run). 2) P1.9 Debug panel (Debug menu Off / Info / App Trace / Full Trace; per-request step timing; which source each component read and from which loader run; which show, condition and authorization rules fired; which dynamic actions fired; a correlation id; export a trace; server and client helpers feed one panel; acceptance: the panel lists every component of Home with a source and a time; the loader's phase codes appear; test on the collector). 3) Close: HANDOFF, SCHEDULE, IDEAS triage, ledger evidence, one records PR.
Landmines from session 47: push-guard reads a command's whole text, so a heredoc quoting a push to main is denied; phrase notes around it. A menu entry's accessible name includes its sub and shortcut, so tests match by prefix, and checkable entries are menuitemcheckbox. A flyout near the viewport edge must flip (DesignerMenu.tsx does). react-hooks/set-state-in-effect is a lint ERROR here: browser-only state goes through useSyncExternalStore (LocalTime.tsx, PageDesigner.tsx's layout memory). Heredocs carrying backslash escapes were mangled by the shell tool: write scripts with the Write tool or avoid escapes. The Edit tool needs the file Read first. The preview of a row page renders through the composed frame and shows no page title (pre-existing: loadRevisionPreview marks row pages served 'rows'). The P1.3 explorer agent cost 306k tokens and each reviewer about 190k; a trivial agent costs about 48k just loading its context.
```

### What shipped today, with evidence
1. **#980 (1.0.99)** rules v3 adopted (`docs/plan/rules.md`), the ledger in the repo (`docs/plan/ledger.json`, its render script, `lib/design/plan-ledger.test.ts`), `CLAUDE.md` pruned 83 → 54 lines, `.claude/settings.json` with the Sonnet force and six hooks wired one at a time with the operator watching (push-guard, agent-model-guard, night-guard, stop-gates, session-start, pre-compact), the HANDOFF correction (the settings file had never been on main; #978 was opened 06:17Z). Two reviewer passes (eleven gaps: six fixed, five accepted; then zero). Merged 07:43Z, prod 07:47Z.
2. **#981 (1.0.100)** Phase 1's twelve slots into the ledger on "Go on phase 1, approved". Merged 08:01Z, prod 08:06Z.
3. **#982 (1.0.101)** P1.3 Header Text, Footer Text, Configuration › Build Option; the document at version 2 read leniently; `applyBuildOptions` at the three render sites; the Property Editor groups closed until opened. Reviewer: two gaps fixed (a CHANGELOG heading, a pane test). Merged 09:35Z, prod 09:39Z. Review page `db149e5b-7bd2-4f64-84f5-785f2e70cd00`.
4. **#983 (1.0.102)** P1.5 the Layout tab, the Gallery and the Utilities menu: submenus as flyouts, Show ▸ and Layout ▸, Two/Three Pane, Reset Layout, Expand/Restore, Display from Here/Page, Add To, the layout remembered per browser through `useSyncExternalStore`. Reviewer: two gaps fixed (Reset Layout's scope, the Layout ▾ highlight). Merged 10:37Z, prod 10:41Z. Review page `b6ac76b2-1ed9-4d51-8567-b5a68be53457`.
5. **Decisions recorded** (the ledger's changes list): Table/Cards → one data region with a View setting, table the default for standings ("your understanding is correct. view setting is better."); rules v3 → "go with the latest version"; Phase 1 approved. A default the operator let stand: push-guard keeps matching the whole command text.

### Questions for the operator (asked at their turn, not now)
- P2, P3, P4 into the ledger, one question each; P4.0 confirmed before backups and Working Copies.
- P1.1 the five looks (screens first), P1.4 the nesting depth, P1.8 the Theme Roller tokens.

### Noted, not done (in the Inbox)
- The Save and Run preview of a row page shows no page title (it renders through the composed frame).
- With `PADDOCK_ENV=production` on a local dev server, Save and Run opens the preview on the production host.
- The Property Editor's own header tips ignore the Tooltips toggle; the pane memory is per browser, not per Clerk user.
- `page_revision.schema_version` stays the literal 1 in the SQL function; no `build_option` ref in the refs projection.

### Won't touch until you say
Any Phase 2–4 slot; P1.1, P1.4, P1.8; the cost PR; Home's split on production; the console's file deletions; any prod Supabase write; any push to `main`; agents on Fable.

---

## ⚡ Next session pickup — 2026-09-10 morning (after the first night run under the decision-scan rule — **two merges the operator allowed are live (#976 the study into the repo, #977 the Madrid venue fix); every other item is a draft held for the operator: rules v3, the ledger v2 as JSON, the CLAUDE.md prune, the hook scripts on draft PR #978, the Table/Cards side-by-side; no Phase 1–4 slot was attempted**)

### 🔴 Start here — the morning report

0. **The night in one line.** The operator asked for a flat batch list with issues and solutions, had it audited by one Sonnet agent (`docs/apex-study/audit-overnight.md`), answered the auditor's five bedtime questions (rules v3; hooks written and unit-tested but NOT wired; `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` + FORCE repo-local for every subagent; merge tonight only the study files and the Madrid fix; everything else a draft), and went to sleep. The night followed that exactly. The full report with evidence is section "Morning report" on the plan page `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8` (built from `scratchpad/plan/progress.md`).
1. **Done, with evidence:**
   - **#976 (1.0.96)** `docs/apex-study/` (22 derived files + README, 1.7 MB): gates tsc 0 · lint 0 errors · vitest 1980; a fresh-context Sonnet reviewer passed four checks (README ↔ files exact, no secrets/paths/emails, trio, scope); merged 21:59Z.
   - **#977 (1.0.97)** the Madrid venue fix, content only: `content/circuits.json` `madring` gains the aliases Madrid · Circuito de Madring · "Spanish Grand Prix (Madrid)" and the verified coordinates 40.46528 / −3.61528; `content/information/tracks.json` gains a `madring` track (street, 5.416 km, 22 corners, 2026, featured, verified; sources formula1.com + Wikipedia). Cause: `lib/circuits.ts` `matchCircuitEntry` picks the longest alias in the title or session location; the existing entry (since 0.192.0) knew only "Madring"/"IFEMA Madrid", so Barcelona's "Spanish Grand Prix" won. Reviewer: five checks PASS. Merged 22:09Z; **prod 22:13Z: `/series/f1/weekend/14` → 200, 34 Madring / 0 Barcelona-Catalunya, coordinates right.**
   - Drafts held for you: **rules v3** (`scratchpad/plan/rules-v3.md`; also the "Rules v3" section of the plan page — ten groups with enforcement tags); **ledger v2 as JSON** (`ledger.json`, 78 slots: 5 done R-slots · P1.1–P1.12 · P2.0–P2.24 · P3.1–P3.19 · P4.0–P4.16; 17 questions; `render-ledger.mjs` generates the Markdown; the "Ledger" section of the plan page); the **Table/Cards side-by-side** (artifact `b93cd890-6f55-4770-9518-a1bda6a497b7`); the **CLAUDE.md prune** (`CLAUDE.pruned.md`); the **six hook scripts + test runner (20/20)** and `.claude/settings.json` (Sonnet force only) on **draft PR #978 [HOLD]**, unwired.
2. **Questions for you (one or two sentences each, defaults given):**
   - At ~22:45Z you wrote "i prefer the table instead of the cards". Read as: standings default to the table view; cards stay a view for drivers, teams, posts and rounds (recorded in the ledger's changes list with that reading). Still open: one data region with views (recommended, default view table), or Table and Cards as two tiles?
   - Rules v3: edit or "rules go" (then the CLAUDE.md prune, the settings and the ledger + its test land as one docs PR; the hooks wire in with you watching).
   - Ledger v2: approve phase by phase; P1.1 the five looks and P1.8 the Theme Roller tokens want screens; P4.0 "atomic, validated, staged apply" is the audit's gap, drafted before backups and Working Copies — confirm.
   - Unchanged: TanStack Table; the cost PR; the series tabs shape; Comments only if replies are wanted.
3. **Blocked or not attempted, by design:** no Phase 1–4 slot (each blocks on rules v3 / ledger v2 or on an open question); the hooks not wired (your word); the CLAUDE.md prune not applied (wants a human diff-read).
4. **Landmines learned (night):** a duplicate JSON key is silently overridden by the last one — a first Madrid attempt added a second `madring` key and the tests did not notice; a probe of the matcher did (`scratchpad/probe-circuit.mts`); a conflict resolver must not treat `=======` Markdown lines as conflict markers (check `<<<<<<< ` and `>>>>>>> ` only); `.claude/` was ignored as a directory, so files under it could not be un-ignored — the rule is now `.claude/*` + negations for hooks and settings.json (skills and settings.local.json stay local); a background git command was killed by the system for low memory and left a half-state that had to be inspected before continuing; ~~`.claude/settings.json` now exists locally on every branch (ignored on main until #978), so every subagent in this repo is forced onto Sonnet from the next session start~~ — **corrected 2026-09-10 (session 47):** the file and the hooks are tracked on the branch only, so checking out `main` removes them from the working tree and main's `.claude/` ignore rule never restores them; the Sonnet force was live that morning only because Claude Code had hot-loaded the file's `env` while the branch was checked out, and a restart on `main` loses it until the docs PR merges. Also corrected: #978 was committed and opened at 06:17Z, not ~23:15Z; the background command killed for low memory ("fix the ignore rule, commit on the held branch, open the draft PR, return to a clean main") had done none of its four steps, and they were finished by hand at 06:17Z.
5. **Evidence:** the plan page `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8` (Morning report · Rules v3 · Ledger · the spherical view · the full read); `docs/apex-study/`; PRs #976, #977, #978; prod at 1.0.97 (22:13Z).
6. **Won't touch until you say:** wiring the hooks, applying the CLAUDE.md prune, merging #978, any Phase 1–4 slot, the cost PR, Home's split on production, the third draft's branch, the console's file deletions, any prod Supabase write.

---

## ⚡ Next session pickup — 2026-09-09 night (session 46, the operator present — **the whole APEX 26.1 guide is read (742 pages, 1,212 concepts); the plan page `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8` carries "The spherical view": what the 549 extra pages change in the rules, the phases and slots, the vocabulary, and what they confirm; NOTHING is changed yet, by the operator's order: rules → ledger → plan, each on the word**)

### 🔴 Start here

0. **The night in one line.** "read all in a subagent with sonnet": the 549 unread pages were downloaded to text at zero cost (`scratchpad/study/docs2`, 324k words), packed into nine runs (`study/runs.json`), and read one Sonnet agent at a time (runs 6–14, ~2.6M Sonnet tokens; `notes-6..14.jsonl`, 757 concepts, 454 relevant, each with a relevance verdict). The operator's orders held throughout: no agents in parallel; "no changes to the rules until all runs are home and we have a spherical view". The consolidated view is section "The spherical view" on the plan page; the per-run findings are the "full read" table; the digest is `study/findings-digest.txt`.
1. **What the operator decides next, in this order:**
   - **The rules.** v2 (`scratchpad/plan/rules.md`, from the primary sources: [Claude Code best practices](https://code.claude.com/docs/en/best-practices), the long-running-agents harness post, the context-engineering post, the hooks/subagents/goal docs) plus part A of the spherical view as v3 additions: stable-id per-component export; atomic pre-validated apply; Utilization + History + delete guard on every shared object; escape-by-default; allow-list security posture and the designer out of the public bundle; correlation-id instrumentation; drafts over live processes; regenerate, never hand-edit; AI only as "drafts, a rule extracts, a human applies". "rules go" puts them at the top of CLAUDE.md (pruned) with the settings (`CLAUDE_CODE_SUBAGENT_MODEL=sonnet` + FORCE), five hooks, three project agents, four skills, and the JSON ledger with its test.
   - **The ledger.** Draft `scratchpad/plan/components-programme.md` (63 slots, 16 "Needs your word"), to be revised per part B: Phase 2 gains a first slot (the component definition model: attributes with scope, typed editors, groups, events, capability flags, slots), the source slot becomes a Data Sources shared component, Table and Cards merge into one data region with views and row templates, Filters becomes a decoupled layer, Map Backgrounds / Calendar events / Search configurations / Field templates / the Conditions vocabulary are added; Phase 3 unchanged (+ Delete Page cascade and soft delete); Phase 4 reshaped (App Builder home from the onboarding screens, New Application wizard with a features checklist, Working Copies, Members/Moderation as Tasks with six roles and Info Requested, the Security tab with CSP + audit rollups + access-control template, Health with an Advisor lint, utilities: dashboard, change history, locks, backups, data loading, view-as-JSON). Timeline: early November 2026 at this week's pace (was mid-October), mid-December at half (was late November); shorter if Working Copies or the utilities wait.
   - **The vocabulary.** 25 → about 21 regions (Table, Cards, Media list, Timeline → one Data region with views), plus new shared components (Data Sources, Map Backgrounds, Search Configurations, Email Templates, Conditions, Field templates, Component Settings as the attribute model, lists of values); every component gets a Condition, an authorization scheme, a build option, template options with a preset, and Utilization + History.
   - Unchanged open words: TanStack Table; the study into `docs/apex-study/`; the cost PR; the Madrid venue fix; "Phase 1 go" waits behind the rules and the ledger.
2. **Evidence:** the plan page `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8` (sections: the spherical view, the full read with 757 judged concepts, the ledger draft, the UX map + conformance, the skips scrutinised, integrations, coverage); `study/notes-1..14.jsonl`, `notes-all.json` (the first study), `findings-digest.txt`, `ux-map.jsonl`, `coverage.json`, `audit/audit-A/B.jsonl`. Sonnet totals: study 1.40M, audits 0.83M, UX map 0.24M, full read 2.59M ≈ 5.06M; every agent one at a time on Sonnet.
3. **Landmines learned (night):** a subagent given a 40k-word batch and told to append after each file finishes in 20–35 minutes and never loses work; Sonnet's relevance verdicts were consistent across runs (the same "Utilization + History + delete guard" pattern surfaced independently in five chapters, which is how a rule earns its place); the guide's Metric Card and Flexbox Container do not exist in the 26.1 text (they are gallery items in the operator's workspace); Appendix E is the 42-type Conditions catalogue and belongs in the vocabulary, not the appendix pile.
4. **Won't touch until you say:** the rules, the ledger, the plan, any Phase 1 build, the study files into the repo, the cost PR, Home's split on production, the third draft's branch, the console's file deletions, any prod Supabase write.

---

## ⚡ Next session pickup — 2026-09-09 evening (session 46, the operator present — **the plan page `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8` now carries the skips scrutinised, the integrations, "how you hold me to it", the Page Designer click-level UX map with the conformance table, and the chapter coverage; four operator words are open: the vocabulary, "ledger go", TanStack Table, the chapters to read**)

### 🔴 Start here

0. **The evening in one line.** The operator likes the plan and asked four things: scrutinise the 161 skipped concepts and consider integrations (Resend etc.); prove execution to the T and promise agent/token discipline; stop straying overnight and ask decisions in one or two sentences; be clear about the unread chapters; and keep context across sessions. All answered on the plan page `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8` and below. One Sonnet run (235k tokens) extracted the **Page Designer UX map**: 114 click paths and 61 structures (`scratchpad/study/ux-map.jsonl`), compared line by line with the designer as built.
1. **Decisions waiting for you** (each has its screen on the plan page):
   - **The vocabulary** (25 general components) and **the phase order** — unchanged from the afternoon, now with the adapt items folded in (Email Templates over Resend, an Automations page with Run now, Table self-service, the Debug panel, the Tasks list shape for Members/Moderation, Copy Page, page modes, the Embed component, a row-highlight rule).
   - **"ledger go"**: the checked-in ledger `docs/plan/components-programme.md` (about fifty slots: phase, scope, decision scan, acceptance test, parity check, PR and prod time), the test that fails when a page is served from rows without a done slot, and the CLAUDE.md laws for agents/tokens and the decision scan. New file and new rules: needs the word.
   - **TanStack Table** for the Table component’s Users may sort/filter/download (a small MIT library, the one new dependency proposed).
   - **Chapters to read** (about 45 pages, recommended per phase on the coverage table): Appendix E Available Conditions; 3 template pages; 2 page-type pages; ~15 report attribute pages (Phase 2); the default page template page; 5 click-path pages from chapters 12–13 (now, for the UX map); 4 lists-of-values pages (Form); the email page; 3 workflow/task overview pages (Members/Moderation); 3 CSP pages (Security tab); 3 debugging pages (Debug panel). Or all now, on the word.
   - **Moving the study into the repo** (`docs/apex-study/`: notes-all.json, digest, audit A/B, ux-map, coverage) so it survives the scratchpad: new files, needs the word.
   - The cost PR (under $1.50/month), the Series tabs shape, Comments only if replies are wanted: unchanged.
2. **The skips, scrutinised** (`scratchpad/plan/verdicts.json`): of 161 flagged, **99 plumbing** (Oracle mechanisms the framework, Clerk or the browser already do), **40 have** (the study flagged Oracle’s mechanism, Paddock has the capability: build options, page groups, text messages, shortcuts, assets, PWA/push, lists, the grid, Clerk, Leaflet, the loader as data source…), **22 adapt** (worth having via an integration or a small build). Integrations: Resend already wired (`lib/email.ts`: contact, welcome, feedback, draft-ready), Clerk, Supabase, GitHub Actions, Cloudflare, Upstash, Open-Meteo, OpenF1, Leaflet, Recharts, web-push, Serwist; proposed TanStack Table; not now: translations, search vendors, PDF.
3. **The conformance table** (designer as built vs the documented Page Designer): toolbar order, left pane tabs, central pane, Page Finder, keyboard and Save and Run **match**; the Create and Utilities menus, the Rendering tree’s points, creating from the tree (Copy To, Copy to other Page, Ctrl+drag), the Layout tab (Display from Here, Expand/Restore), the Gallery’s Add To menu, the Property Editor header (Region/Attributes tabs, edited marker, multi-select) and the region property groups (Appearance, Header and Footer, Configuration) are **partial**; the Developer Toolbar beyond the link back is **missing** (Quick Edit, Live Template Options, Theme Roller, Show Layout Columns, Page Timing, Debug, Options); the Code Editor, Session menu, Processing tree, APEXlang/Caching/Checksum are **deliberate** skips. All gaps sit in Phase 1 except Copy Page and dialogs (Phase 4).
4. **The decision-scan protocol** (memory `feedback-paddock-decision-scan`): every slot opens with `Fixed by:` / `Defaults I take:` / `Needs your word:`; the operator’s decisions are asked in one or two sentences with a default and the slot waits; overnight = decision-free slots only (never a new component’s design, a route-file deletion, a schema change or a retired screen). **Context across sessions**: state in the repo (ledger, handoff, plan page, memory for rules only); handoff and records PR before ~70% context; one slot per PR; re-read after compaction; reading agents produce files.
5. **Evidence:** the plan page `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8` (sections: scrutiny, integrations, holding me to it, the Page Designer as an app, what was read); `scratchpad/study/ux-map.jsonl` (175 lines), `coverage.json` (763 pages in the guide, 193 read); `scratchpad/plan/verdicts.json`.
6. **Landmines learned (evening):** the guide’s table of contents encodes anchors as `href="page.html#GUID-…"` across several lines (a regex excluding `#` matched nothing); Metric Card and Flexbox Container are not in the 26.1 guide; a page’s `const top` collides with `window.top`.
7. **Won’t touch until you say:** the ledger and CLAUDE.md laws, any Phase 1 build, the study files into the repo, the cost PR, Home’s split on production, the third draft’s branch, the console’s file deletions, any prod Supabase write.

---

## ⚡ Next session pickup — 2026-09-09 afternoon (session 46, the operator present — **the APEX study is done and the plan is published: "Paddock Developer Plan" artifact `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8`; the operator’s approval of the vocabulary and the phase order is the next step; Run is never refused (#972, 1.0.92)**)

### 🔴 Start here

0. **The afternoon in one line.** On "study go" the operator stopped the first attempt (five Fable research agents, 78% of the session burned, no output) and said "do it in the cheapest most effective manner, not at the same time as other sub agents". The second attempt: the 192 pages of the APEX 26.1 App Builder User’s Guide downloaded to plain text at zero model cost (scratchpad `study/docs`, 195k words), then five Sonnet study runs one at a time (455 concepts, `study/notes-1..5.jsonl` → `notes-all.json`, `digest.txt`), then a route → components → loaders map at zero cost (`audit/imports.txt`) and two Sonnet audit runs one at a time (58 routes, 299 sections, `audit/audit-A.jsonl` + `audit-B.jsonl`). About 2.2M Sonnet tokens in all. Everything is folded into the artifact **Paddock Developer Plan** `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8`: APEX in one page, the concept map (have / adapt / missing / skip), the vocabulary of 25 general components with audit counts, every page section by section, the four phases, the timeline, the 161 skipped concepts with reasons, the 455-concept catalogue.
1. **Decisions waiting for you** (the plan page is the screen for each):
   - **Approve the vocabulary**: 25 general components (Page heading, Static content, Image, Link list, Buttons, Breadcrumb, Table, Cards, Media list, Timeline, Calendar, Filters, Tabs, Chart, Map, Metric cards, Countdown, Live band, Weather, Circuit, Search, Embed, Form, Comments, Clerk widget). Audit counts across the 299 sections: Static content 57 · Page heading 45 · Link list 35 · Breadcrumb 18 · Form 18 · List 16 · Buttons 15 · Table 12 · Standings table 8 · Chart 8 · Cards 7 · Metric cards 7 · Tabs 6 · Results table 4 · Filters 4 · Timeline 4 · Media list 3. Leftovers (promo banners, status banners, info rails, reactions, the account strip, gate states) fold into existing components with looks and show rules.
   - **Approve the phase order**: Phase 1 the shell (region templates as named looks, template options with presets, header and footer text, build option per region, Quick Edit in the preview) → Phase 2 the components over a declared source catalogue (Table with typed columns and named presets for the fifteen standings/results shapes first) → Phase 3 the pages family by family behind parity checks (prose pages first, then Series, then weekend and session, then drivers/teams/F1, then editorial data pages, then account and community) → Phase 4 full control (workspaces W2–W5, Application Definition tabs, Members and Moderation, Copy Page, page modes). About fifty PRs.
   - **Timeline**: mid-October 2026 at this week’s pace (about five substantive PRs a day with the operator present), late November at half pace. Two known risks: the fifteen standings/results shapes; the session page’s live telemetry sections.
   - **Series tabs**: one page with a Tabs component, or one page per tab (asked at the Series step).
   - **Comments**: nothing on the site has replies today (a thread is one moderated post); Comments is built only if replies are wanted.
   - **The Cloudflare bill** ($2.85 for 26 days: Workers CPU $2.10, R2 storage $0.45, Durable Objects $0.30): the R2 line falls on its own (the 7-day lifecycle rule); a small PR could lengthen the slow pages’ revalidate windows and raise the tag cache’s regional TTL from 5 to 30 seconds, saving under $1.50 a month; the middleware cannot be narrowed (78 files call Clerk’s server helpers).
   - Unchanged: the third draft’s branch, the 4.3 Object Browser (now the Source picker of Phase 2), Members + Moderation, the Madrid venue bug (the Circuit component’s first fix), the older parked items.
2. **Evidence:** the plan artifact `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8`; the study and audit files in the session scratchpad (`C:\Users\ppara\AppData\Local\Temp\claude\C--Dev-Personal-Motorsport\855daff1-c409-4f47-bb40-051da401c7e5\scratchpad\{study,audit,plan}`, temporary: the artifact carries the data); #972 merged 13:05Z, prod 1.0.92 at 13:10Z.
3. **Landmines learned (afternoon):**
   - **Subagents inherit Fable unless `model` is set.** Five research agents at the default model burned the session to 78% and were killed before writing anything. Rule now in memory `feedback-paddock-agent-model-cost`: reading/audit agents run on Sonnet or Haiku, one at a time, writing incrementally (JSONL per file or route), with the burn stated first; none at all above 60% usage.
   - **Docs to disk first.** Downloading documentation pages with a script and stripping them to text costs nothing; agents then Read from disk instead of WebFetch, which is cheaper and repeatable. The 26.1 guide’s `supported-region-types` table is complete in the HTML; Metric Card and Flexbox Container are not in the 26.1 guide at all (they are in the operator’s gallery screenshots).
   - **`const top` in an inline page script fails in the browser** (`window.top` is a non-configurable global): `node --check` passes, the page renders nothing. The one look before publishing caught it.
   - The audit found `/series/[slug]` never renders SeriesPageView (the import is metadata only), `/drivers/[slug]` and `/teams/[slug]` carry no JSON-LD, `/about` is prose typed into JSX while the seven legal pages read markdown, and `/impressum` duplicates `/imprint` by design.
4. **Won’t touch until you say:** any Phase 1 build, the cost PR, Home’s split on production, the third draft’s branch, the console’s file deletions, any prod Supabase write.

---

## ⚡ Next session pickup — 2026-09-09 midday (session 46, the operator present — **R4.1 shipped: Calendar is the first page served from its row (#970, 1.0.90, prod 12:39Z); the operator’s three midday messages turn R4 into “the components vocabulary first”; the APEX study plan awaits the go**)

### 🔴 Start here

0. **Midday in one line.** R4.1, the foundation for pages served from rows, is live with Calendar as its proof (#970, 1.0.90; review `43c83315-1c6b-47c8-9b59-3cbfe953a5f7`). Then the operator said three things that reshape the programme: (a) "i still feel like the editing aspect is far from what i want it to be. are there tutorials or is there documentation for you to read on how to learn apex and all its aspects … as if you were gonna be me working apex and building apps from scratch? therefore we could plan to migrate paddock slowly into an apex or paddock developer style so it becomes editable. therefore wed need to have a massive plan."; (b) "changing column span changes nothing atm" (answered below); (c) "for us to reconstruct existing pages into the shape the developer needs, dont we need to decide what components the site will have generally then fix each page to use those components" — YES: the family-by-family order of the R4 plan is superseded by **the components vocabulary first** (memory `feedback-paddock-components-first`).
0b. **R4.1, what shipped** (#970, 1.0.90): the registry’s `served: 'rows'` (Calendar first) and `PageRow.served`; `lib/design/composed-page.ts` (address → page + parts, literal patterns first; `adoptRecipe`; `composedDocument`); families `lib/design/page-families.ts` + `lib/design/families/calendar.tsx` (metadata, social card, breadcrumb JSON-LD, the Calendar assembly moved as it was; dynamic imports only); components `page.heading` (setting Words: the operator’s words, else the row’s title, else its name) and `calendar.month`; the catch-all resolves a live row page first, then a rows-served page (`loadLiveComposed`, the registry standing in for a missing row, `await connection()` for a per-visit row, the same authz and show rules, `CodePageFrame`, `familyExtras`); `app/(app)/calendar/page.tsx` DELETED and the registry test asserts a rows-served page has no file; the preview accepts rows-served pages and renders them as the catch-all does; Save and Run Page opens `/preview/<draft>` for them; the designer opens such a page with the recipe when the Body is empty and adopts it where a stored transitional body sits; the **Size** quick pick (Small 4 · Mid 6 · Large 12) above Column Span, both disabled on the transitional body with "The code draws its body at the full width. Split the page to size its parts." Prod `/calendar` at 12:39Z: h1 Calendar in the masthead style, `data-page-frame="body"`, the title, the breadcrumb data.
0c. **The Column Span answer** (measured on the local server): the Calendar tile went 844 → 279 px on the canvas after Size Small; the published page drew the calendar at 429 of the row’s 1336 px at 1400 px wide and stacked at 900 px. Three cases show nothing: the transitional body (drawn by the code at the full width; its controls are now disabled with the note), a window under 1024 px (phones stack, the help text says so), a change not yet published (Save and Run Page shows it first). If the operator saw none of these three, ask for the page and read that revision.
1. **Decisions waiting for you** (one at a time, each with a screen):
   - **The APEX study and the components vocabulary (the "massive plan")** — proposed 12:50Z, awaiting the go: read the Oracle APEX 26.1 App Builder User’s Guide (docs.oracle.com/en/database/oracle/apex/26.1/htmdb/, document G26656-04, August 2026), the 26.1 release notes and the apex.oracle.com Labs and Tutorials (Build Your First App; the Online Bookstore, Movies Watchlist, Social Media, Forms modernisation and Workflows labs), solo-sequential or in waves of at most five read-only research agents (never a big fan-out: memory `feedback-paddock-workflow-limits`); deliver, as artifacts for approval before any build: (i) a concept map APEX → Paddock Developer (what each APEX thing is, what Paddock has, the gap); (ii) an audit of every section on the 58 routes; (iii) the components vocabulary, each component with its settings, its source, its template and the pages that use it; (iv) the migration plan page by page using only the vocabulary.
   - **R4.2 (the Series family) is ON HOLD** until the vocabulary is agreed. Home’s six page-specific components are the shape to grow out of, not to repeat.
   - Unchanged: the third draft’s branch (`feat/designer-apex-shape`, WIP 2732f2b); the 4.3 Object Browser; Members + Moderation in Data; Application Definition tabs; the Madrid venue bug (content PR); the older parked items (Data thresholds, Right Side Column, Ctrl+/ chords, photo tiles, remote branches, `suppressHydrationWarning`).
2. **Evidence:** review `43c83315-1c6b-47c8-9b59-3cbfe953a5f7`; the browser runs `e2e/calendar-r41.mjs` and `e2e/run-r41.mjs` (scratchpad 6ff46729, shots under `out-r41`) against the local database; prod served 1.0.90 at 12:39:24Z (merged 12:35:05Z).
3. **Landmines learned (midday):**
   - **A rows-served page whose published revision still carried the transitional body drew nothing**: `CodePageFrame` rendered `children` (null) where the placeholder sat. The local `/calendar` row had exactly such an R2a revision, and production could too. `adoptRecipe` puts the recipe in its place — in the resolver, the preview and the designer’s opening step — so the three agree; every later rows-served page inherits it.
   - The preview loader filtered `kind = 'row'`, so a code page served from rows had no preview (fixed); and the preview route drew every page with `RowPageView`, which put a second h1 over the heading component (it now renders `CodePageFrame` like the catch-all).
   - Playwright’s stored session (`state.json`) goes stale and the admin guard then 404s the designer: every E2E script needs the ticket sign-in fallback, not just the first.
   - `cf:build` prints "Failed to build /(app)/information/… took more than 60 seconds. Retrying" for prerenders; they are retries, not failures (exit 0).
4. **Won’t touch until you say:** the study and the vocabulary (awaiting the go), R4.2, Home’s split on production, the third draft’s branch, the console’s file deletions, any prod Supabase write.

---

## ⚡ Next session pickup — 2026-09-09 late morning (session 46, the operator present — **the components programme has begun: "code pages should not exist. FINAL!"; R1 quick fixes (#966, 1.0.86), R2a components exist (#967, 1.0.87), R2b Home's six components (#968, 1.0.88) are live; the R4 plan awaits a word; W1's apply still pending; the APEX-shape work parked**) — `main` = **1.0.89** once this merges, prod verified through 1.0.87 (10:39Z), zero open PRs, suite **1969**

### 🔴 Start here

0. **The late morning in one line.** The operator went through the Page Designer and set the direction that now governs the programme: the site becomes components and templates the App Builder owns, the code stays editable but stops laying pages out, and **code pages do not exist** (verbatim: "these served by the code blocks in pages are ruining us, they need to be editable/templatable"; "we want to stray further away from code serving the site and go to components the developer/app builder has. like apex's components. because thousands of lines of code just arent manageable after a specific point"; "code pages should not exist. FINAL!"; "THE WORK YOU DID ON <the R2 draft> NEEDS TO BE DONE FOR ALL PAGES"). Memory `feedback-paddock-page-designer-walkthrough` holds every item verbatim; the roadmap is artifact `84259cc8-ed82-48fb-9341-ec9f9e0c80e8`.
0b. **R1, the quick fixes** (#966, 1.0.86; review `68b3180f-8507-45e6-b940-83977455fc4b`): the Page Finder searches (number, name, path, group) with a Recently edited filter; Delete Page (Utilities ▾ → Delete Page…, a confirmation, `DELETE /api/admin/design/pages/<id>`; a page whose route file is in the code is refused with the reason); every Run link absolute to the site (on the dev. host a relative path was the designer again: "saving and running a page throws me into not found errors").
0c. **R2a, components exist** (#967, 1.0.87; review `18941d06-d86e-4218-b137-937a0cbaae0c`): `lib/design/components.ts` (the catalogue: specs, settings, `parseSettings`), the region kind `component`, **show rules** on every region (always · race weekend · between weekends · signed in · signed out · phones · desktop; `passesShow`, `applyShow`, `showAsks`), the transitional component "Body as the code draws it" that keeps a page whole until it is split, the Body open on every page, the "served by the code" lock, label and kind gone from every screen, a Components gallery tab and a Rules group in the Property Editor.
0d. **R2b, Home's six components** (#968, 1.0.88; review `594725c7-9232-4407-a1b0-639b06bef145`): `HomeLead` cut into six exported pieces with unchanged markup (Lead story with a pinned post and further reading · This weekend · Latest result · What it changed with rows · What's next · The wire with items); server renderers (`lib/design/component-render.tsx`) drawing each from one assembly per request (`loadHomeModel`, React `cache`); `SPLITS` and the "Split into 6 components" button on the transitional body's Until split row; the frame renders a split page from its revision and drops the code's body (the rule: no Body regions → the code's body alone; the transitional body among regions → the code's body where it sits; Body regions without it → split); the race-weekend fact (`raceWeekendNow`) behind the two calendar rules. **Home on production stays code-drawn until the operator splits it**: Home › the transitional body › Split into 6 components › Save › Publish.
1. **Decisions waiting for you** (one at a time, each with a screen):
   - **R4, every page a composition** (plan artifact `6816ce59-9fe5-4c8b-9691-e056d42528a8`): the foundation R4.1 (the address's slug/round in the render context and the catch-all matching patterns; the row's `rendering` honoured; a metadata hook and a sitemap enumerator per page family; a parity check before a route file leaves; Calendar as the proof), then the families in order: Series hub and tabs → weekend and session → drivers, teams, F1 analysis → series list and archive → editorial (16 pages) → account and site (28) → templates. Two questions: Series first (recommended) or Editorial first; Calendar or Learn as the proof. Say "R4.1 go".
   - **"apply 20260909100000"**, the W1 migration (#965), rehearsed on production inside begin … rollback (HTTP 201, nothing persisted); the code reads nothing from it yet.
   - **The third draft** (APEX-shaped App Builder and Shared Components, artifact `5d4fc3c2-8f63-4cc0-b5dd-6d7e11671f02`, your "go") is parked mid-build on branch `feat/designer-apex-shape` (WIP commit 2732f2b: shapes.tsx, SharedOverview.tsx, ApplicationsHome.tsx, the catalogue's about-map); it resumes after R4's first PRs unless you want it sooner.
   - The 4.3 draft (data regions and the Object Browser, `d9dfe6d3-b685-4e05-aa9b-e4e8daba65c0`, your "go") rides on the component catalogue: Standings and Calendar become components in R4's Series family; the Object Browser is a Data page of its own.
   - The Madrid venue bug (item 4 below) as a content PR.
   - Older: the Data thresholds; the Right Side Column on pages the code served (opens with a page once it is split); Ctrl+/ chords; photo tiles; `feat/designer-application-definition` on the remote; `suppressHydrationWarning` on the admin root's `<html>`.
2. **Evidence:** the three review pages above; the browser runs in the session scratchpad (`e2e/pd-quick.mjs`, `e2e/components-r2a.mjs`, `e2e/home-split.mjs`) against the local database; prod at 1.0.87 by 10:39Z.
3. **Landmines learned** (the components programme's first day):
   - **Anything reached from `lib/design/page-frame.tsx` is in every code route's chunk.** A static import of the home assembly there took the Worker from 42470 to **58438 KiB** (the ceiling is 64 MiB). Component renderers `import()` their data and pieces dynamically; measured back at 42903 KiB. Quote the dry-run before merging anything that touches page-frame or the renderers.
   - **Never put the transitional body back on a split page.** The designer's `withImplicitBody` re-injected it after a save, so the published revision carried it beside the six components and the served Home drew every band twice (the browser run caught it before the merge). It injects only into a document with no Body regions at all.
   - A Bash command over ~8 KB, or one holding a control character, fails in this harness before it runs; write long texts and scripts with the Write tool.
   - `.next/dev/types/routes.d.ts` can be left half-written by a running `next dev` and fail `tsc`; stop the server by PID and clear `.next/dev/types` and `.next/types`.
4. **Content bug, for after the components work (operator, ~10:20Z):** the F1 round 14 weekend page "Spanish Grand Prix (Madrid), 11–13 Sept" shows Circuit de Barcelona-Catalunya as venue and track map; the 2026 race is at the Madrid street circuit. The round → venue mapping is stale; verify the venue against the official F1 calendar before fixing (RULE #1).
5. **Won't touch until you say:** prod Supabase (W1 waits for "apply"), splitting Home on production (your click), the third draft's branch, any route file's removal (R4 only behind the parity check), the thresholds, any branch deletion.

---

## Next session pickup — 2026-09-09 morning (session 46, the operator present from 06:30Z — **the console's files are gone (#962, 1.0.82); the Data tab is redrawn to the approved second draft with the loader's runs page, Phase 4 PR 4.2 (#963, 1.0.83, prod 08:53Z); three drafts await a word: the App Builder and Shared Components in the APEX shape, the workspaces and applications plan, the 4.3 data regions and Object Browser**) — `main` = **1.0.84** once this merges, prod verified through 1.0.83, zero open PRs, suite **1953**

### 🔴 Start here

0. **The morning in one line.** The operator woke, looked at the night's screens and set the design brief that now governs everything Claude draws on its own (memory `feedback-paddock-less-cramming`): simpler pages, less information, bigger text, distinct boxes and rows and columns split by lines, colour that shows the state before the words, **no rounded coloured pills** ("look like ai"). A second-draft mock was liked ("i like the second draft"), 37 APEX 26.1 screenshots were sent as the reference, and the operator answered five questions (item 2).
0b. **The console's files** (#962, 1.0.82): the operator deleted the eighteen files by hand; two repairs came with the commit — `ConsoleMode.tsx` (the designer's light/dark switch and the admin root's pre-paint script) moved to `components/designer/`, and the leftover `admin/audience/page.tsx` (four imports of deleted modules) removed. Five admin actions lost their screen and have homes agreed (item 2).
0c. **Phase 4, PR 4.2** (#963, 1.0.83; review page `00637373-75ab-4362-9b89-9c90a25cdcec`): the Data tab redrawn — a strip counting fine / attention / problems / not connected, banded ruled cards with one figure each, the service page's four tabs in the same shapes (`components/designer/data-ui.tsx`: `Strip`, `Band`, `Swatch`, `RuledTable`, tone tokens through `light-dark()`); the loader's runs as a page (`DataRuns.tsx`, `GET /api/admin/design/data/runs`, `loadRunsLog()`, states fine · running · failed · stale (65 min, three 20-minute cycles) · never). Two production figures corrected on the way: loads per day were capped at 300 by the read window, and a registered source that had never run was left out of the count. Thresholds to move on the operator's word: Cloudflare amber above 0.5% errors, red above 2%; stale after 65 minutes.
1. **The operator's answers (verbatim, ~08:30Z):** "1. need to find a place to fit the author requests, same as mark a supporter (this maybe in the data from clerk showing users), the feedback and thread moderation can be in data too (we could call data console and have the management there, or you could suggest smth else), home composer is a part of editing home page in the app builder, heatmap we can park and see if it fits in any way in the app builder 2. ok 3. ok. 4. ok, 5. ok." Earlier: "paddock should just be 1 application that paddock developer covers, i should have the ability to make more, in fact when opening the designer i should be asked to either log into my account or a workspace to access the applications associated with either"; "do whatever brings us closer to apex"; "does it make sense for us to have an object browser?" (Claude: yes, small and read-only, never a SQL runner). Claude's suggestion, standing: keep the tab named Data and put the action pages beside the data they act on (Members under Clerk, Moderation under Supabase); rename only if it outgrows.
2. **Decisions waiting for you** (one at a time, each with a screen):
   - **Third draft, App Builder and Shared Components in the APEX shape** (artifact `5d4fc3c2-8f63-4cc0-b5dd-6d7e11671f02`): App Builder opens on the applications list; the left rail leaves the Shared Components entry pages (breadcrumb + Tasks column); JSON Sources opens the Data tab's Upstream page. Say "go".
   - **Workspaces and applications plan** (artifact `a3bfb43e-a167-4634-80f1-fa5618481b64`): five PRs W1–W5; two defaults to confirm — a second application lives on the same site under `/a/<alias>`; a workspace is a Clerk Organization (free: 100 organizations × 20 members, verified on clerk.com/pricing). Say "W1 go".
   - **4.3 draft, data regions and the Object Browser** (artifact `d9dfe6d3-b685-4e05-aa9b-e4e8daba65c0`): Standings and Calendar regions first, Results when result rows exist; a read-only Tables page in Data; one catalogue file for both. Say "4.3 go".
   - **Members and Moderation pages in Data** (from item 1): Claude builds them after the redesign PRs unless told to go first.
   - The Data thresholds (0.5% / 2% / 65 min): say a number and it moves.
   - Older, still open: Right Side Column on a code page; Ctrl+/ chords; photo tiles for Image regions; the remote branch `feat/designer-application-definition`.
3. **Evidence:** review page `00637373-75ab-4362-9b89-9c90a25cdcec` (PR 4.2, dark and light dashboards, the runs page and its filter, the Supabase page's tabs); the browser run `e2e/data2.mjs` in the session scratchpad against a local database seeded with thirteen sources (one failing, one stale, one never run). Prod served 1.0.82 by 08:45Z and 1.0.83 at 08:53Z.
4. **Won't touch until you say:** prod Supabase (nothing pending), the Page Designer's own look (the operator will go through it "further in depth"), the three drafts above, any branch deletion, the thresholds.

### Landmines learned this morning
- A Bash command over roughly 8 KB fails in this harness with "unexpected EOF while looking for matching quote" before anything runs; write long texts (release entries, PR bodies, scripts) with the Write tool and reference the file.
- A Bash command containing a literal control character (a newline inside a JS string) is refused outright ("control characters that would be hidden in the approval dialog"); put the script in a file.
- `pg_stat_user_tables.n_live_tup` is an estimate and reads 0 for tables never analysed; count with `select count(*)` (the Data tab does).
- `.next/dev/types/routes.d.ts` can be left mid-write by a running `next dev` and fail `tsc` with syntax errors; stop the server (by PID from the port) and clear `.next/dev/types` and `.next/types`.
- The admin root's `<html>` has no `suppressHydrationWarning`, so an operator whose stored console mode differs from the server's default sees a hydration warning (the "1 Issue" badge in development). Pre-existing, one attribute to fix, not done.

---

## Next session pickup — 2026-09-09 early morning (session 46 — **PR 1, PR 2, Application Definition, PR 3, Lists, Component Settings, Application Computations and Phase 4's Data workspace (PR 4.1) are live; 20260909050000 applied; the console is retired; waiting for you: the deletion list, PR 4.2 and 4.3**)

### 🔴 Start here

0. **The night in one line.** The Page Designer plan's PR 1 (#950, 1.0.70) and PR 2 (#951, 1.0.71) are live; the Shared Components audit found Application Definition never built, and it is live (#952, 1.0.72, `/changelog` read 1.0.72 at 00:02:42Z); these records are 1.0.73; **PR 3 (#953, 1.0.74, branch `feat/designer-code-page-regions`) is open and NOT merged**, because it carries migration `supabase/migrations/20260909040000_code_page_revisions.sql`. The order is yours, as the brief said: say **"apply 20260909040000"** and the migration is applied to prod (rehearsed on the local Supabase: `supabase migration up --local`, then the function called for the About page inside a rolled-back transaction, then the browser run below); then "merge" and PR 3 ships. **Done.** The operator woke at ~00:37Z and said "apply 20260909040000 and merge #953": the migration was rehearsed on prod (`begin … rollback`, `widened_inside_txn true`, grantees `postgres, service_role`, the probe after the rollback unchanged), **applied 00:39:06Z (HTTP 201)** and verified (`accepts_code true, rows_only false`, the new error text, the same grantees, `page_revision` 0 rows); **#953 merged 00:40:07Z; prod read 1.0.74 at 00:45:19Z**. Nothing readers see changed: no code page has a published revision yet. **Your first look:** open About in the App Builder, double-click Static Content in the gallery (it lands in the Page Header), write a line, Publish, open `/about`; then remove it and Publish again.
0b. **The console is retired; the designer is the admin area (1.0.76, this PR).** Your word at ~01:45Z, looking at the console on `dev.paddock-tracker.com`: "im confident i only want to keep the designer … try your best to finish up". Done the reversible way: `/admin` and every section (`content`, `audience`, `traffic`, `system`, `site`, and the old `users`, `submissions`, `behaviour`, `home`) redirect to `/admin/designer` (307); the `dev.` root serves the designer; the admin layout is the gate alone; the designer's top-left arrow leaves for the site. **Nothing was deleted** (the law: a deletion needs the list in front of you). **The deletion list, awaiting your word** ("delete the console files"): `app/(admin)/admin/page.tsx` and `app/(admin)/admin/{content,audience,traffic,system,site}/page.tsx`; `components/admin/{AdminNav,AdminUI,AuthorRequestActions,DonorToggle,HeatmapOverlay,HomeComposer,ModerationActions}.tsx` (`ConsoleMode.tsx` stays, the designer uses it); `app/api/admin/{author-requests,submissions,users,page-layout}/**` with `page-layout`'s test. A script checked every import in `app/`, `components/`, `lib/`, `scripts/`: nothing outside that set imports any of it. `lib/analytics/*` stays for Phase 4. **Screens that went with the console and have no designer equivalent yet**: approve or decline an author application and the supporter flag (were on Audience), moderate contributor submissions (Content), the home composer (Site; the lead and the counts are already the designer's Application Settings), and the health figures (Overview, Traffic, System; Phase 4's Data tab, meanwhile `npm run health`, `health:standings`, `health:results`). The author-application and submission emails still link to the old paths and land on the designer; decide where those two reviews live (a Shared Components entry under Security is the field guide's place).
0c. **The operator's later word (2026-09-09 ~01:50Z, verbatim): "there are items in the shared components marked for phase 3 still not available. merge all prs you create and apply all db changes you might have."** Three catalogue entries said Phase 3: Lists, Component Settings, Application Computations. **Lists shipped** (#957, 1.0.77, prod 02:22:33Z): lists of the operator's own (role `generic`, no migration), the Lists entry with Create / Open / Delete-after-asking, the same list editor for the entries, every list offered to a List region, the renderers handing a document its lists by key. Seen in a real browser: a list created and filled, a Monza region showing it, the public page rendering it, the delete refused while a revision names it. **The delete rule, for you to know**: revisions are kept, so a list any revision ever named stays (the message says so; empty its entries instead). A "forget what superseded revisions name" rule would be a decision for you. Component Settings and Application Computations follow in their own PRs tonight.
0d. **Component Settings shipped** (#958, 1.0.78, prod 02:37:56Z): three more `setting` rows (caption on new images, style of new lists, label of new buttons) read by the Page Designer when it creates a region; the Application Settings and Component Settings entries share the table and the routes. **Migration `20260909050000_component_settings_seed.sql` awaits your "apply 20260909050000"**: applied locally, rehearsed on prod (3 rows inside a rolled-back transaction, 0 after), but the permission rail refused the unattended write, the same limit the 2026-09-08 handoff records. Until then the entry shows "no row yet" with the shipped values and the designer uses the shipped values. Seen in a real browser on the local database: the three changed and saved, an Image, a List and a Button placed on Monza starting with the changed values, the defaults put back.
0e. **Application Computations shipped** (#959, 1.0.79, prod by 06:07Z): a read-only account of what the application works out and when (fourteen rows: the point, what is computed, the entry holding the inputs with a button that opens it, how often it is re-read). No route, no migration. **All three entries that said Phase 3 are live now**; the catalogue's remaining "later" entries say their phase or "read-only, later" truthfully.
0f. **Morning, the operator awake (06:34Z): "apply 20260909050000"** → the Component Settings seed rehearsed again and **applied to production 06:34:38Z (HTTP 201)**, verified: the three `region.*` rows, 8 settings in all. Then **"Phase 4 go ahead"** → **PR 4.1 shipped** (this PR, 1.0.81): the Data workspace, the approved prototype's Data screen over the readers the code already has (`lib/design/data-services.ts` the catalogue, `lib/design/data.ts` the loader with a one-minute memo and Refresh, `GET /api/admin/design/data[/key]`, `components/designer/DataWorkspace.tsx`, the Data tab live, `?ws=data`). Locally only Clerk (the development instance) and the local Supabase are live, so the browser run showed those two with figures and every other card as connect or own; **on production the seven live cards should show real numbers: your first look.** No new integration, nothing written. **Next, one at a time and each asked**: PR 4.2 (Health: the loader's runs as a table of their own; today they sit inside the Supabase and upstream cards), PR 4.3 (the data-region decision, two mocks).
1. **What PR 3 does** (review page, artifact `12aa2bd2-d34c-47fa-a2ae-87582f181a86`; CHANGELOG 1.0.74 has the file-level detail): a page the code serves takes regions in its Page Header, Breadcrumb Bar, Footer and Phone Bar, placed in the same Page Designer and published with the same Publish; the site renders them around the code's body (`CodePageFrame`, through `withPageGate`'s new `framed()`); the Body stays the code's; the Right Side Column waits for your decision (item 2). Seen in a real browser on the local server: a Static Content region in the About page's Page Header, published, shown above the page's own title at 90 px with the title at 212 px; removed and published again, the page back at once.
2. **Decisions waiting for you** (one at a time, each with something to look at):
   - ~~**Apply, then merge PR 3**~~ Done 00:39Z / 00:40Z (item 0).
   - ~~**Delete the console's files**~~ The operator deleted them ~07:40Z; committed as #962 (1.0.82), see the section above.
   - ~~**"apply 20260909050000"**~~ Done 06:34:38Z (0f).
   - ~~**Phase 4, PR 4.1**~~ Built on your "go ahead" (0f). ~~PR 4.2~~ shipped as #963 (1.0.83); 4.3 has its draft (the section above).
   - **Right Side Column on a code page**: allowed (the code's body narrows to eight of twelve columns, a risk on data-heavy pages) or never? Recommendation: never for now; the Layout tile already says the decision is pending. A mock of both on request.
   - **Ctrl+/ pane chords** (APEX 22.1+, Ctrl+/ then a letter): not built, per your "no Ctrl set"; the Alt set is complete. Say the word and it is one PR.
   - **Image regions**: the Property Editor's photo is a select, as the prototype had it; photo tiles with thumbnails would read better. A mock on request.
   - **Phase 4, the Data workspace**: the plan from the night of 2026-09-08 (item 3h below) still awaits your approval; nothing built.
   - **Branch `feat/designer-application-definition`** is still on the remote (gh could not delete it from the worktree it merged from); `git push origin --delete feat/designer-application-definition` on your word.
3. **Workarounds taken tonight** (the mandate's second question), none of them in the product:
   - The gates for #952 ran in a **clean worktree** (`../Motorsport-pr4a`, its own `npm ci`, 3 min) because the main tree already carried PR 3's half-written files; a `node_modules` junction was refused by Turbopack ("Symlink node_modules is invalid, it points out of the filesystem root").
   - The code-page frame's loader was first a 60 s per-isolate memo like the other design loaders and is now a **per-request read**: the browser run showed the restore of `/about` keep the removed region, because the regenerating process held a warm copy and re-cached it (CHANGELOG 1.0.74).
   - The development server answered the first `POST …/revisions` of the run with the catch-all's HTML 404 until the route file was touched (on-demand compile under CPU pressure; the same class as the 2026-09-08 note).
   - The Playwright administrator is a **Clerk development-instance** user (`sk_test_`), signed in with a sign-in token through `__clerk_ticket`; its credentials live only in the session scratchpad (`e2e-admin.json`), never in the repo.
4. **Evidence** (the mandate's fourth question): review pages `6f98fc45-a327-422b-9506-4784bbf7d8c2` (PR 2, 27 photographs beside the prototype), `b58bd016-4517-4943-8a78-7ef92eff56c6` (Application Definition), `12aa2bd2-d34c-47fa-a2ae-87582f181a86` (PR 3). Every merge carried `tsc`, `lint` (0 errors, the two known warnings), the full suite (1904 → 1918 → 1922), `cf:build` and the dry-run (Total Upload 42725.57 → 42755.98 → 42986.98 KiB, gzip 9957.20 KiB at the end). Prod reads 1.0.72; the local run wrote only to the local database.
5. **Won't touch until you say:** prod Supabase (nothing pending now), Phase 4, the Right Side Column on code pages, Ctrl chords, any branch deletion.

### Landmines learned tonight
- Turbopack refuses a `node_modules` junction or symlink that resolves outside the project root; a second worktree needs its own `npm ci`. Its `.next` is its own, so a build there never clobbers the main tree's `next dev`.
- A **cross-request memo in a loader that feeds a cached page is unsafe on publish**: the process that regenerates the page may hold the stale copy and re-cache it until the next publish. Per-request `cache()` for anything a publish changes. The 60 s memos that remain (`loadPageFrame`, the application definition, the lists, the shortcuts) carry the same hazard in principle for one regeneration after a save; accepted on 2026-09-08 and left as is.
- Two PRs' files in one working tree: commit the already-merged one as a duplicate, then `git rebase --autostash origin/main`; git drops the duplicate ("skipped previously applied commit") and the other PR's files come back on top of main, nothing lost.
- `next dev` under CPU pressure (a concurrent `next build`) can register a route late and hand its requests to `[...catchall]` (an HTML 404 where a route's own answer is `text/plain`); `touch` the route file.
- `gh pr merge --delete-branch` run from a secondary worktree merges, then fails to check out `main` ("already used by worktree") and leaves the remote branch in place.

---

## Next session pickup — 2026-09-08 late evening (session 45 close — **THE NEXT SESSION'S JOB: execute the Page Designer plan**, three PRs in order, a mock before each; **session 46 opened 2026-09-08 20:05Z and committed the prototype, item 2**) — `main` = **1.0.69** once this merges, prod verified through 1.0.68 (20:16Z), zero open PRs, suite **1880**

### 🔴 Start here

0a. **Standing rule for every designer screen (operator, 2026-09-08 ~20:00Z, verbatim): *"i need you to stick as close to the verified designer as possible. if any changes need to be made ask me."*** The verified designer is the v2.4 prototype (item 2 below). Reproduce its structure, labels, groups, tabs, toolbar order, keyboard set and skin as they are; where the real data, the rails or a technical limit force a difference, stop and ask before building it, with the prototype's screen and the proposed change side by side. Never simplify, rename or drop a part of the approved design on Claude's own judgment. (Memory: `feedback-paddock-verified-designer`.)
0. **The operator's two findings on waking (2026-09-08 ~19:40Z), verbatim:** *"i cant edit existing pages and after making my page, the editor/app builder looks nothing like the plan."* Both are true and both are Claude's: step 1 made the 57 code pages read-only and no step gave them a way to be edited; the editor built overnight (steps 2b–6) was the smallest that could carry the steps and was never held against the approved design of 2026-09-07. Correction offered and accepted. **The operator's decisions (AskUserQuestion, two previews):** rebuild the editor to the approved design **now, before Phase 4**; for existing (code) pages, **"Both, attributes then regions"**. Then: *"handoff with the next sessions job being executing this plan."*
1. **The plan, with the approved prototype beside today's editor:** artifact `05b2cea5-9541-475d-8950-2a4c96bd7c55`. Three PRs, in this order, **a mock for the operator before each is built** (the recipe's review page moves in front of the build for these three), the trio and the dry-run on each, merge only on the operator's word:
   - **PR 1 · Attributes on existing pages.** Every code page opens in the designer; name, group, browser-tab title, indexed and who-sees-it become real. Design: one server-only wrapper module (`lib/design/page-frame.ts`, name to confirm) with two exports applied to all 59 code routes by a mechanical edit: `pageMetadata(path, base)` returns `generateMetadata` (the row's `title` wins when set; the row's `indexable = false` adds `robots noindex, follow`; `indexable = true` leaves the code's own rule, so an empty tab still says noindex; the row absent or unusable → `base` untouched) and `withPageGate(path, Component)` wraps the default export (with a scheme other than public on the row, `currentVisitor()` + the shared rule from `lib/design/authz-check.ts` per request, refused with the scheme's message and Sign in or the 404 when the scheme has none, the same shape as the catch-all; with none, the component renders exactly as today, so the page stays a cached render). Rows are read through `loadPagesForEditing`-style memoised loader (one minute, code fallback). **A coverage test** (beside `lib/design/page-registry.test.ts`) walks every `page.tsx` outside `(admin)` and the catch-all and requires both helpers by name, so a route added later cannot skip them. `PUT /api/admin/design/pages/[id]` drops its `kind = 'row'` condition for name / title / group / authz / indexable (the path stays fixed, kind stays); `PageAttributesEditor` shows for code pages; the pages list gains "open" on code pages, the detail shows the body as one fixed region "served by the code". No migration. Static `export const metadata` (43 files) becomes `export const generateMetadata = pageMetadata('/path', {...})`; existing `generateMetadata` (16 files) wraps its result; the 10 files with no metadata get `pageMetadata(path, {})`. Pre-mortem: a route whose metadata is built unusually (the series tab, the weekend pages) needs a hand edit; the build and the coverage test catch a miss before the merge.
   - **PR 2 · The Page Designer rebuilt to the approved design.** Port the prototype's screen over the real document: `components/designer/PageDesigner.tsx` replacing `PageEditor.tsx`'s shell (keep `LayoutSchematic`, `DynamicActionsEditor`, `CreatePageDialog`, the document, the functions and the routes unchanged). Toolbar (back · page number and name, finder, prev / next through the registry order · lock = the loaded revision and whether it is still the newest · undo and redo over the working copy · Create ▾ (region, button, dynamic action, page) · Utilities ▾ · Shared Components · status "Page N · revision · loaded hh:mmZ" · Save · ▶ Save and Run Page). Left pane: four icon tabs (Rendering tree: Pre-Rendering (the code's steps, read-only, for code pages), the positions with their regions, Post-Rendering; Dynamic Actions with a count; Processing (read-only); Page Shared Components), "Filter this tree", expand / collapse. Centre: Layout (today's schematic), Component View (every region as a list with its attributes), Messages (the parser's problems, live, with a badge), Page Search (every attribute value), Help; the gallery beneath with Regions · Items ("later", says so) · Buttons, double-click adds to the Body, drag onto a position places. Right: the property editor for the selection or the page: Filter properties, Go to Group, Show Common / Show All, help for the focused property; groups Identification · Source · Layout (Sequence, Position, Start New Row, Column, Column Span) · Appearance · Server-side Condition ("later") · Security · Advanced; choices as pills where the prototype has them (Page Group, Page Mode). Keyboard: Alt+1…6 panes, Alt+F7 Save, Alt+F8 Save and Run, Alt+F1 Help, Alt+Shift+F1 shortcuts; **no Ctrl set, no command palette, never a ⌘ glyph** (operator rule). Follows the console theme (light and dark) through the existing tokens; the prototype's "calm skin" is the reference. Every existing editor test keeps running against the new screen (rename, do not delete). Pre-mortem: regressing add / move / save / publish / dynamic actions; the suite plus a probe of every state before the merge.
   - **PR 3 and after · Regions of the operator's own around the code's body.** The wrapper from PR 1 renders the live revision's Header and Breadcrumb Bar regions above the code's body, Footer and Phone Bar below, with dynamic actions, saved as revisions like a row page (`page_revision` for a code page's row; `design_save_page_revision` needs its `kind = 'row'` check widened, a migration). The Right Side Column is a per-page decision (many code pages fill their width): its own mock first. Position by position, each with a mock.
2. **The approved prototype is the reference and is committed: `docs/prototypes/paddock-designer-v2.4/`** (1.0.69, session 46, on the operator's word, byte-identical to the 2026-09-07 originals). `paddock-designer.html` (412 KB, the whole v2.4: CSS, markup and behaviour), `pd2-1-head.html` (the CSS, 74 KB, tokens `--bg --panel --panel-2 --panel-3 --ink --ink-2 --ink-3 --line --line-2 --edit --edit-dim --amber --rosso --ok --warn --desk --stage --drop --drop-bg`), `pd2-2-body.html` (the markup: `#pd` with `.pdtb` toolbar, `#paneL` with `#leftTabs`/`#leftSearch`/`#leftBody`, `#centre` with `#cTabs` (layout, cv, msgs, search, help), `#lay`, `#gallery` with `#gTabs` (regions, items, buttons) and `#gitems`, `#paneR` with `#peFilter`/`#peGroupBtn`/`#peCommonBtn`/`#peHelpBtn`/`#peId`/`#pe`/`#peHelp`, the splitters `#splitL`/`#splitR`), and the screenshots `pd2-look3.png` (the look, 1600×950), `pd2-toolbar.png`, `pd2-toolbar2.png`. **The behaviour (`pd2-3a..3d.js`, `pd2-4a..4c.js`, joined as `pd2-all.js`) is inside the whole file at lines 937–2880 and is not committed as loose files**: bare `eslint` lints every `.js` in the repo and two of the fragments do not parse alone. The loose parts still sit in the temp scratchpads of sessions 4b82ce06… (the originals), 84ff9163… and 6ff46729… (copies) while those last. The artifact of the prototype (`cf8ff9e2-…`) and the field guide (`6fb2f726-…`) are not reachable from this account.
3. **Order and gates.** PR 1 on "go ahead" (asked at the close of session 45, not yet given: the operator asked for this handoff instead). PR 2 after PR 1 merges, with a mock of the real screen (a static render of the ported prototype over a real page) approved first. PR 3 after PR 2. Phase 4 (the Data workspace, plan in the night section's item 3h) waits behind all three.
4. **Won't touch:** the document format, the functions and the routes from the night (they carry every PR); the site's pages' own content; no migration in PR 1 or PR 2; prod writes only through the existing functions; no ⌘, no command palette; the release header and the branch deletions stay the operator's.
5. **Everything else open** is in the night section below: the operator's items (the first photo upload, the release header, the branch deletions, the 60 s memo, the composer and `/admin/system` checks), the loose ends (the phone bar's visible count, `rendering: 'dynamic'` on row pages, restoring an older revision), the multi-class standings from Phase 0.

---

## Next session pickup — 2026-09-08 night (session 45 night shift, operator asleep from ~17:10Z — **Phase 3 complete**: steps 2a to 6 shipped in eight merges, plus the three designer ideas from the afternoon) — `main` = **1.0.66**, prod verified through 1.0.66, zero open PRs, suite **1880**

### 🔴 Start here

0. **The operator's word at 17:10Z, verbatim, governs the night:** "apply 20260909010000 then merge #938 im gonna go to bed now so i need you to line up the next prs and apply whatever needs applying. you have my wholehearted support and are granted access to finish as many tasks and phases as you can. dont stop for nothing, make sure no mistakes are made, catch your mistakes if there are some." Read as: migrations may be applied after a `begin … rollback` rehearsal, PRs may be merged after the full gate (tsc, eslint, the whole suite, `cf:build`, a dry-run, a review page), each deploy confirmed on `/changelog`. Still never: a push to `main` outside a squash-merge, a deleted branch or file, a published post, the release header, the six branch deletions.
1. **Phase 3 step 2a is live** (#938, 1.0.58, merged 17:15Z, `/changelog` read 1.0.58 at 17:24Z): Create page as a two-step dialog (a template from six drawn as a miniature of its layout, then name, path and group; the operator asked for APEX's wizard after seeing an inline form on the review page: "our one looks poor"), the layout document (`lib/design/page-document.ts`), the six templates (`lib/design/page-templates.ts`), two database functions (`design_create_page`, `design_save_page_revision`; migration `20260909010000` **applied 17:14Z on the operator's word**, proof: both functions `service_role` only, `page_revision_ref.asset_id` and `shortcut_key`, the four constraints), the detail loader, three routes, the schematic read-only. Review page `98d46b62-d4ae-4081-a098-5b0f7b171c91`. Outside checks: the three routes 404 unauthenticated; a row page's path 404 until step 3.
2. **Step 2b, the page editor, is live** (#939, 1.0.59, merged 17:33Z, `/changelog` read 1.0.59 at 17:45Z): `components/designer/PageEditor.tsx` (gallery, properties in four groups, Save draft with the newest revision as base, Publish with the live one, the parser's problems holding Save, the conflict banner with Reload, read-only), `PageDetailPanel` hosting it, `LayoutSchematic` tiles labelled. No migration. Review page `b581b6fe-6ad8-40fc-9ba4-66bd6b66315a`.
3. **Step 3, serving row pages, is live** (#940, 1.0.60, merged 17:55Z, `/changelog` read 1.0.60 at 18:00Z; outside checks: an unpublished row page's path, an unmatched path and the PUT unauthenticated all 404, `/about` 200). `lib/design/live-page.ts` (`loadLivePage(path)`, the row page and its newest published revision, memoised per request with React's `cache`; `loadAssetsById`); `lib/design/authz-evaluate.ts` (**the one evaluator**: `passes`, `allowedKeys`, `currentVisitor` from Clerk; public · signed_in · author (canAuthor's ladder) · role · email_domain; fails closed); `components/page/RowPageView.tsx` (the six positions in the site's template, a region's column and span kept on `lg` through a `--gc` custom property and full width on phones, Static Content as paragraphs with shortcuts substituted, Image with caption and credit via `next/image` unoptimized, List as links or cards from the navigation lists, a refused region's message or nothing); `app/(app)/[...catchall]/page.tsx` (`revalidate = 300`; the 404 as before when nothing is live; the session read only when the page or a region asks for a scheme; a refused page shows its scheme's message and Sign in, or the 404 when the scheme has none; `generateMetadata`: title or name, a description from the first text, canonical, `noindex` until indexable and public); `PUT /api/admin/design/pages/[id]` (name, title, group, who sees it, indexed; one conditional update on the stamp, 409 with the detail, `revalidatePath`); the revisions route revalidates the path on publish; `components/designer/PageAttributesEditor.tsx` in a `<details>` above the editor, "open the page" on the facts line once live. No migration. **The operator has not seen the night's review pages yet**: 2a `98d46b62-d4ae-4081-a098-5b0f7b171c91`, 2b `b581b6fe-6ad8-40fc-9ba4-66bd6b66315a`, 3 `d107f4dd-e2a5-4ad7-aaba-25172da3f5ab`, 4 `6a6971ef-d8be-44b4-9181-06d8387d52f9`, the rails `0c960e4e-6eed-4a46-9cba-f826d5661723`, the search hints `66e5f452-a733-4b0f-8c41-4adfdf896fa8`, the dynamic actions (in the 1.0.64 entry). **The progress board moved:** its artifact `a8d129cd-…` answered "not found" when republished at 19:05Z, so the board was published afresh at `020d86ff-14c7-4414-89f9-5ac11832155c` (label "Step 4, the rails and the hints live"); the old link no longer works.
3b. **Step 4, access on the navigation lists and schemes of the operator's own, is live** (#941, 1.0.61, merged 18:12Z; review page `6a6971ef-d8be-44b4-9181-06d8387d52f9`). The rule moved to a client-safe module, `lib/design/authz-check.ts` (`passes`, `allowedKeys`, `mayShow`, `visitorFromClerkUser`); `authz-evaluate.ts` keeps `currentVisitor` and re-exports the rest. `components/useVisitor.ts` (`useVisitor` from Clerk's `useUser`, `useVisibleEntries(entries, schemes)`); `DoorLinks`, `BottomBar` and `Footer` take `schemes` and show an entry asking for one only to a visitor who passes (hidden in the cached render while Clerk loads, shown after hydration; with no schemes given, the designer's previews, every entry shows); `AppShell` takes `schemes`, the layout loads them beside the lists. `POST /api/admin/design/authz` (a scheme of the operator's own: key fixed, a check of signed_in / author / role with the role / email_domain with the suffix, never a second public), `DELETE …/authz/[key]` (the shipped four refused with 400; a scheme still named by a page, a region's reference or an entry refused by the foreign keys, 409 with the rows); the PUT and the DELETE revalidate the layout. `AuthzEditor`: "shipped" or "yours" on each row, Remove in two steps on the operator's own rows, the "A scheme of your own" form under the table. No migration. **Not done:** the phone bar's three-to-five rule counts stored entries, not visible ones, so a gated cell can leave two on screen for an anonymous visitor.
3c. **Two of the three designer ideas are live** (#942, 1.0.62, merged 18:32Z; review page `0c960e4e-6eed-4a46-9cba-f826d5661723`): `components/designer/Rails.tsx`, one left rail per workspace so the two read as different things. The App Builder's rail (eyebrow, page icon, "Pages"): All pages, Your pages (made here), the six groups with counts; a click filters the list (`PagesList` takes `filter`) and closes an open page, whose name and path the rail shows under "Open". The Shared Components' rail (puzzle icon, "Components"): a search field over the catalogue (`filterCatalogue`, every word against label and group), a filled dot on what is editable now and a hollow one on what arrives later, a legend at the foot. The overview grid in the main pane is unchanged.
3d. **The third idea, the alive search placeholder, is live** (#943, 1.0.63, merged 18:47Z, `/changelog` read 1.0.63 at 18:52Z; the hint routes 404 unauthenticated, the search index answers 200; review page `66e5f452-a733-4b0f-8c41-4adfdf896fa8`). Migration `20260909020000_search_hints.sql` (table `search_hint`: id, application_key, question, seq, leads_to, leads_title, stamps; the updated_at trigger; RLS on, anon and authenticated hold nothing) **rehearsed with a rollback, then applied 18:38Z** on the operator's standing word (proof: eight columns, the trigger, RLS true, zero anon grants, zero rows). `lib/design/search-hint-defaults.ts` (`SEARCH_HINT_MAX = 120`, `SEARCH_HINT_ROTATE_MS = 60_000`, `searchHintProblem`), `lib/design/search-hints.ts` (`loadSearchHints` → the questions in order with a one-minute memo, `loadSearchHintsForEditing`, `searchHintFromRow`), `GET/POST /api/admin/design/search-hints` and `PUT/DELETE …/search-hints/[id]`: **a question is asked of the site's own search when added or reworded** (`buildSearchIndex` + `searchDocs`, the header's own index and matcher) and refused with 422 when it finds nothing; the first hit is stored as `leads_to`/`leads_title`; one conditional update on the stamp, 409 with the rows; every write revalidates the layout. `components/designer/SearchHintsEditor.tsx` (catalogue key `searchhints` under Navigation and Search: the questions with where each leads, reword with Save on the row, earlier/later, Remove, "Add a question"). `NavPanel` takes `searchHints`: the placeholder shows the text message on the first paint and the cached render, a hint a minute later and every minute after, wrapping, and holds still under `prefers-reduced-motion`; `AppShell` and the layout carry the hints. **The site's search changed with it:** `lib/search-match.ts` `queryTerms` drops sentence punctuation and a fixed list of function words when anything else remains ("When is the next race?" → next, race), so a question typed as asked finds its page; `lib/search-index.ts` gives the static pages `keywords` for the words people ask with (Calendar: next race when schedule dates upcoming). Without this the verifier would have refused every natural question (the matcher AND-matches every term, and no title holds "when" or "is"), which the route tests caught.
3e. **Step 5, dynamic actions, is live** (#944, 1.0.64, merged 19:04Z, `/changelog` read 1.0.64 at 19:10Z; review page `25f0fd3a-86f8-49fa-9544-27f715c89eba`). The document (`lib/design/page-document.ts`) gains a fourth region kind, **Button** (`label` ≤ 60, `dest` a route or external key from the catalogue or null for actions only), a `hidden` flag on every region (rendered with the `hidden` attribute so a "read more" never flashes), and `actions: DynamicAction[]` (id, name, `when`: a click on a region · the page loading · a timer of 5 to 3600 s · a region scrolling into view; `do`: one to eight effects: show / hide / toggle / scroll-to a region, or go to a destination); the parser refuses an action naming a region the page does not have or a fixed-action destination, an empty effect list, a timer outside the range, a duplicate id; a stored document without `actions` reads as none. `documentRefs` gains `dests` and `refRows` writes them as kind `dest` (the refs table took `dest_key` since 20260908090000, no foreign key: the catalogue is code). `components/page/DynamicActions.tsx` (NEW, client): `applyEffect` and `bindActions` (the region wrappers found by `data-region`; effects through the `hidden` attribute, `scrollIntoView` with reduced motion honoured, `window.location.assign` for go; triggers by listener, `setInterval`, `IntersectionObserver` once), mounted by `RowPageView` only when the document has actions; the wrappers carry `id="region-<id>" data-region hidden`. A Button renders as a link (route), an external link, or a plain button (actions only). `components/designer/DynamicActionsEditor.tsx` (NEW): the pane under the schematic (name, When with its region or seconds, Do with one to eight effects, Add / Remove), every select offering this page's regions and the catalogue's go-destinations; `PageEditor` gains Button in the gallery (id `button-N`, label "Read more", no destination), the Button's Source (label, "Goes to" with "Nowhere: it fires dynamic actions only"), the "Hidden until a dynamic action shows it" checkbox, and removing a region takes every trigger and effect that named it (an action left with no effect goes too). `LayoutSchematic` tiles say "hidden at first" and a button's label and destination. No migration.
3f. **Step 6, Save and Run, is this PR** (1.0.65; review page `8c0ce407-bac7-4ec6-8811-46b37beae616`), the last step of Phase 3. A new route `app/(app)/preview/[rev]/page.tsx` (`/preview/<revision id>`, `force-dynamic`, `requireAdmin()` so everyone else meets the 404, `robots noindex`) renders any revision of a row page, draft or published, through the same `RowPageView` as the catch-all, every region shown whatever scheme it asks for, wearing **`components/page/DeveloperToolbar.tsx`** (Preview · the page · revision, its state (a draft / published, superseded / the live revision) and its save time · problems in the stored document · Edit in the designer · The live page). `lib/design/live-page.ts` gains `loadRevisionPreview(revId)` (the revision by id, its page of kind row, whether it is the newest published one; per-request `cache`). The editor gains **Save and run** beside Publish: a draft when something changed, then `/preview/<newest id>` in a new tab (`window.open` with `noopener`); with nothing changed the newest revision opens as it is. The route is a page the code serves, so it joins the registry (`/preview/[rev]`, site, dynamic, not indexable, administrator) with its own seed migration `20260909030000_pages_seed_preview.sql` (**rehearsed with a rollback, applied 19:09Z**; 58 pages now), the route-collision test reads every `*_pages_seed*` migration rather than the first one alone (an applied migration is never edited), and `/preview` joins `RESERVED_PREFIXES` so a row page can never take it. **Phase 3 is complete with this merge**; the board says so.
3g. **Step 6 is live** (#945, 1.0.65, merged 19:19Z, `/changelog` read 1.0.65 at 19:25Z; from outside, the preview route answers 404 unauthenticated for a well-formed id and for a malformed one, home and `/about` 200). **Phase 3 is complete.** Loose ends, none blocking: the phone bar's three-to-five rule counts stored entries, not visible ones (a gated cell can leave two on a phone for an anonymous visitor); a row page's `rendering: 'dynamic'` is not honoured (every row page is a cached render, per-visitor only when gated; honouring it is one `await connection()` in the catch-all when the page says dynamic); the Phone Bar region renders at the foot of the page on phones rather than as a fixed bar (the site's own bottom bar owns that place); an older revision cannot yet be restored into the editor (needs a route for a revision's document and a Restore button on the revisions table); the multi-class standings mapping from Phase 0.
3h. **Phase 4, the Data workspace: a plan to approve, not built.** The designer's third tab ("Data · later") is where the field guide put the site's own figures: Google Search Console, GA4, Bing Webmaster, Cloudflare (usage and billing), Clerk, Supabase, GitHub Actions, Web Push, IndexNow. The site already reads four of them (`lib/analytics/{gsc,ga4,bing,cloudflare}.ts`, fed by `GSC_SA_KEY`/`GSC_SITE_URL`, `GA4_SA_KEY`/`GA4_PROPERTY_ID`, `BING_WEBMASTER_API_KEY`/`BING_SITE_URL`, `CLOUDFLARE_ACCOUNT_ID` with the analytics and billing tokens) for `/admin/traffic` and `/admin/system`. The plan, in the recipe's shape: (1) the Data workspace shell: one rail entry per service with its connection state (configured or not, from the `is*Configured()` guards) and last-fetched time, the third tab live; (2) per-service Overview, reading the existing loaders through admin-only routes with a short memo, the same figures `/admin/traffic` shows today plus Clerk's user count and Supabase's row counts for the design tables; (3) Health: the loader runs (`source_run`, Phase 0) as a table with the last ok per series and the SKIPs named; (4) a decision for the operator, presented with a mock: whether row pages may carry a **data region** (a standings table or a calendar list from the tables, chosen from a catalogue, never a query) as Phase 5's first step. No new upstream integration in Phase 4; nothing written to prod outside what the routes read. Present this with a screen before building anything.
4. **Operator items still open, for the morning**: read the night's review pages (item 3) and the board, and walk the App Builder on production once (create a page from a template, lay it out, Save and run, Publish, open the address; set a door to Signed in and check a private window; add a Search Hint); the first real photo upload; the release header on `/changelog` (the designer programme is a candidate for its own `# ` header: twenty-three pushes now sit under `# 1.0 · Lights out` since 1.0.43); the six merged remote branches to delete, plus the local merged branches (feat/type-ladder, feat/designer-appearance, feat/designer-shortcuts, feat/designer-assets, feat/designer-pages, feat/designer-row-pages, feat/designer-page-editor, feat/designer-serve, feat/designer-access, feat/designer-console-nav, feat/designer-search-hints, feat/designer-dynamic-actions, feat/designer-save-and-run, docs/session-45{,b,c,d}, docs/session-45-night); the design loaders' 60 s memo; the composer and `/admin/system` checks; the Phase 4 plan in 3h.

### Landmines learned tonight
- A `! grep … | head` guard inside an `&&` chain takes head's exit status, so the chain stopped before `git add`, and `git push` then pushed the branch at main's commit ("No commits between main and …" from `gh pr create`). Guard with `if grep -q …; then exit 1; fi`, and grep the diff of the new entries, not the whole changelog (old entries carry the three-letter placeholder word from 2026).
- A prod rehearsal that exercises a function must count in a **separate statement**: a statement's sub-selects share one snapshot and do not see what volatile functions inserted in its CTEs (a first attempt counted `revisions 0` beside `publish_stamped true`).
- Full-page screenshots of the console need its `fixed inset-0` root released to `relative` and every scroll pane opened (`shot-full.mjs` in the session scratchpad); Playwright's `fullPage` alone returns the viewport.
- `/changelog` states the version as `Currently running v 1.0.58` (capital C, a `v` before the number); a case-sensitive poll for "currently running" never matches.
- `date -u` is the clock to quote: the earlier notes estimated Z times from the local clock (UTC+2) and were two hours late.

---

## Next session pickup — 2026-09-08 afternoon (session 45 — the customisation direction decided; steps 8 Appearance, 9 Shortcuts and 10 Assets live; **Phase 2 complete**; **Phase 3 step 1, the page registry, live**; step 2 next) — `main` = **1.0.57**, prod verified through 1.0.56, zero open PRs, suite **1763**

### 🔴 Start here

1. **The direction is decided: tokens first.** Presented as three previews (tokens · tokens plus a checked custom-CSS box · raw CSS and JS as APEX has them) with the security stance (the CSP already allows inline styles and scripts for Clerk and Tag Manager, so a stored line would run on every page; raw JS is stored XSS by definition; raw CSS can leak form values and paint a fake sign-in). The operator chose tokens. Raw JS is never to be recommended; checked custom CSS only if a concrete look cannot be reached with tokens, and only on the operator's explicit call.
2. **Step 8, Appearance, is live in two PRs.** #928 (1.0.49): every fixed text size (1,173 in 187 files) on a 31-step rem ladder `--text-8…--text-136` (`text-11` = 11 px; `text-12-5` = 12.5 px; font-size only, like the arbitrary form), and the four faces as role variables `--face-sans/serif/mono/condensed` read by the `@theme inline` font stacks (the utilities inline their stacks, so only a role variable reaches all 1,362 `font-*` uses; this also fixed the dyslexic mode, which had swapped the body only). Proof of sameness: computed typography of 990 class strings identical before and after (Playwright on `next dev`, keyed by class string). #930 (1.0.50): `application.ui jsonb` (migration `20260908210000`, **applied 13:20Z on the operator's word**), eight faces added to `lib/fonts.ts` unpreloaded (Source Sans 3, Fira Sans, Source Serif 4, Literata, JetBrains Mono, Source Code Pro, Roboto Condensed, Fira Sans Condensed), `lib/design/appearance{-defaults,}.ts` (one `parseAppearance` rule for the loader and the route; the legibility gate base 14–20 px, leading 1.3–1.8, density 0.2–0.35 rem, corners 0–16 px; `appearanceCss` = one `:root` rule in the same `<style id="paddock-themes">` as the custom themes), `GET/PUT /api/admin/design/appearance`, `components/designer/AppearanceEditor.tsx`, catalogue key `appearance` (was `uiattrs`). Deployed 13:25Z; prod's home carries the ladder classes and no style block (nothing stored yet). Review pages: #928 `a4f3556c-2609-4814-b2a9-58b11e8e2753`, #930 `520291ed-bda3-4d0a-b41d-62621038d79b`; board republished.
3. **Scope calls taken, to revisit only if the operator asks**: application-level tokens only (per-theme overrides later; shipped themes untouched); the type scale as a ratio waits for Phase 3's page roles (31 sizes cannot follow one ratio without changing the look); bare `rounded` stays code. **Finding**: base 20 on a 390 phone truncates the header's search hint and wraps the eyebrow labels; 18 is the practical ceiling, the gate keeps 20.
3b. **Step 9, Shortcuts, is live** (#932, 1.0.52, deployed 13:56Z): house-style fragments a Static Content box will insert by key in Phase 3, as rows the operator adds to and removes from. Migration `20260908230000` (three authored seeds `times.local`, `wire.linked_out`, `data.sources`; a search of the code found no repeated house-style sentence worth mining) **applied 13:50Z on the operator's word**. `lib/design/shortcut-defaults.ts` (key rule `^[a-z0-9][a-z0-9._-]{0,59}$`, text ≤ 500, the reasons shared by editor and routes), `lib/design/shortcuts.ts` (`loadShortcuts` key → text, `{}` on failure, for Phase 3; `loadShortcutsForEditing`), `GET/POST /api/admin/design/shortcuts`, `PUT/DELETE …/shortcuts/[key]` (one conditional statement each, 409 with the current list), `components/designer/ShortcutsEditor.tsx`. Nothing reads a shortcut until Static Content; the status line says so after a save. Review page `6abd6b18-1dce-4567-8ddc-a05599d320d7`. The operator asked to see the progress board after this step; it was republished (label "Step 9 Shortcuts live") and walked through.
3c. **Step 10, Assets, is live** (#934, 1.0.54, deployed 15:19Z) and **Phase 2 is complete**. The operator created the R2 bucket `paddock-media` (14:08Z) and chose the cap (10 MB; JPEG, PNG, WebP). `MEDIA` binding on all four Workers; `lib/design/image-size.ts` reads kind and pixel size from the file's header (workerd has no image library); `lib/design/asset{-defaults,s}.ts`; `GET /media/[...key]` streams a photo with a one-year immutable cache header and refuses any path outside the key rule before the bucket; `GET/POST /api/admin/design/assets` (upload: words, cap by size, then the bytes themselves, then put, then the row, the file removed if the row fails), `PUT/DELETE …/assets/[id]` (words on the stamp; delete row first then file, `fileRemoved` reported); `components/designer/AssetsEditor.tsx`; catalogue key `assets` under Files and Reports. **Verified from outside after the deploy**: a well-formed absent key answers 404 from the bucket (503 would mean no binding), malformed and traversal paths are 404 before the bucket, the assets API answers 404 unauthenticated. **Not yet done: the first real upload**, which is the operator's (a small JPEG with credit and licence in the Assets screen); check the row, the file and the served address when it lands. Review page `af9e843e-2bed-4984-ab32-35f130c008c8` (stand-in pictures). Also that afternoon: the operator added a 7-day expiry lifecycle rule (`expire-old-builds`) to `paddock-inc-cache`, which had grown to 73 GB / 376k objects because OpenNext keys the cache by build id and nothing pruned old builds; read back from the CLI beside the default multipart-abort rule.
3d. **The field guide artifact `6fb2f726-…` is not reachable from this account** (Artifact read: not found; not in the list of own or shared artifacts), nor is the prototype `cf8ff9e2-…`. Phase 3 was planned from the handoff's summary and the schema in migration 20260908090000 instead; if the operator still has the guide, its Phase 3 section should be checked against the plan below.
3e. **Phase 3 step 1, the page registry, is live** (#936, 1.0.56, deployed 15:52Z). `lib/design/page-registry.ts` holds the 57 routes as data (`CODE_PAGES`; path convention: Next's own bracket form, a library optional catch-all such as `/sign-in/[[...sign-in]]` folds into its parent via `registryPathOf`; the console under `(admin)` and the `[...catchall]` are not pages); `lib/design/pages.ts` (`loadPagesForEditing`, rows overlaying the code); `GET /api/admin/design/pages`; `components/designer/PagesList.tsx`; the designer has two live workspaces, App Builder and Shared Components, with `?ws=builder` in the URL. **The route-collision test** (`lib/design/page-registry.test.ts`) compares the registry with the route files both ways, each route's rendering with its file's `dynamic` export, and the migration's seeds with the registry; it fails the build when any of them drift. Migration `20260908233000` **applied 15:43Z on the operator's word** (57 rows, 6 groups). Review page `70b63de2-b929-4a27-9a98-144d986bfa6d`. Merged after a rebase onto the records PR with the changelogs resolved by union. Landmines: `execSync` overflows on the 1 MB CHANGELOG (write `git show` to a file first); a `node -e` one-liner dies on an apostrophe inside single quotes (scripts go in files); `gh pr merge` before the rebased branch is pushed reports conflicts (push first).
4. **Next: Phase 3, the App Builder**, planned as six steps (presented to the operator at the close of session 45; step 1 done): (1) ~~the page registry~~ done above; (2) `page_revision` documents and the Layout schematic for row pages (positions Header, Breadcrumb Bar, Body, Right Side Column, Footer, Phone Bar; region tiles on a 12-column ruler; first region kinds Static Content with `{shortcut:key}` substitution, Image from an asset, List from a navigation list), draft save and publish on the base revision with the refs projection written by one database function; (3) the catch-all serving row pages (the existing `app/(app)/[...catchall]` looks the path up before its 404), metadata, noindex until `indexable`, redirect rows, the route-collision test; (4) authorization enforcement, one server evaluator for pages and boxes, a client one for the navigation because layouts render at ISR time, Social and Studio gating from build options, add and remove of schemes; (5) the dynamic-action interpreter (declarative triggers and actions executed in the rendered page) and its pane; (6) the runtime developer toolbar and Save and Run. Queued after Phase 3 by the operator this afternoon (IDEAS.md Inbox): an alive rotating `nav.search` placeholder of questions verified to resolve through the site's search (rotation after first paint, still under reduced motion); a search bar for the Shared Components catalogue; the designer's side menu redrawn so pages and shared components read as different things.
5. **Operator items still open**: the release header on `/changelog`; the six merged remote branches to delete; the design loaders' 60 s memo; the night's composer and `/admin/system` checks.

### Landmines learned this session
- Stopping `next dev` right before `cf:build` can leave `.next/dev/types/routes.d.ts` truncated; the build's type step reads it (`';' expected`) and removing one file leaves `validator.ts` importing it. Clear `.next/dev/types` whole. A production build under a running dev server also 404s dynamic routes on the next dev start until `.next/dev` is fresh.
- GitHub **closes** a stacked PR when its base branch is deleted by the squash merge, and a closed PR's base cannot be changed: rebase onto main, force-push with lease, open a new PR (#929 → #930).
- `node -e … "$sql"` cannot take an argument that begins with `--`: the migration's leading comment dashes were read as a node option and nothing was sent. Pass SQL through the environment (`process.env.SQL`).
- Playwright is not in the repo; the scratchpad has its own `node_modules/playwright` (1.63, chromium-headless-shell 1243). Static markup carries no `<select>` selection: mark the chosen option before reading `innerHTML` for a render probe.
- Tailwind v4 utilities from `@theme inline` inline their values: overriding `--font-sans` reaches the body rule only. Role variables inside the stacks are the single point that reaches every utility.
- `gh pr merge` right after a push to the same branch can fail with "Base branch was modified. Review and try the merge again" while GitHub recomputes mergeability; wait a few seconds and retry, nothing is wrong.
- A placeholder left in a committed file is found by grepping for every placeholder name before the commit, not most of them: `APPLY_LINE` reached PR #932 and was fixed by a second commit before the merge.

### The session's arc (12:00Z → 14:00Z)

| Version | PR | What |
|---|---|---|
| **1.0.49** | #928 | The size ladder and the four faces by role; look-identical; dyslexic mode fixed |
| **1.0.50** | #930 | Appearance: the editor, twelve faces, the gate, the document on the application row; migration applied 13:20Z |
| **1.0.51** | #931 | Records |
| **1.0.52** | #932 | Shortcuts: the list and its editor, three seeds; migration applied 13:50Z |
| **1.0.53** | #933 | Records |
| **1.0.54** | #934 | Assets: the media binding, the upload path, the serving route, the editor; Phase 2 complete |
| **1.0.55** | #935 | Records |
| **1.0.56** | #936 | Phase 3 step 1: the page registry, 57 routes as rows, the App Builder's first screen, the route-collision test; migration applied 15:43Z |
| **1.0.57** | this | Records |

Suite 1692 → **1763**. Dry-run 42,028.45 → **42,094.40 KiB**; fonts 45 → 155 `@font-face` rules (13.6 → 43.7 KB), 41 → 143 woff2 (1.4 → 4.4 MiB static, fetched only when picked).

---

## Next session pickup — 2026-09-08 midday (session 44 closed at 84% context — Phase 2 steps 4 to 7 live, two editors left, Phase 3 next) — `main` = **1.0.48**, prod verified through 1.0.47, zero open PRs, suite **1692**

### 🔴 Start here

0. **New operator direction at the close (2026-09-08 11:50Z), to plan FIRST next session:** *"font size, font etc. must be changeable. these things and others in css and js must be fully customiseable."* Present a plan before building. The shape that fits the rails: every visual property becomes a token the designer edits, per theme or for the application (font family from a curated, licence-clean list of self-hosted or Google faces; base size and type scale; spacing, radius, motion; the shipped values as fallbacks; the same generated style block and contrast gate as themes), and behaviour comes from dynamic actions rather than typed JavaScript (Phase 3). Raw CSS or JS typed into the designer would cross two written rails, the field guide's "tokens only, free code on a page is exactly what the designer exists to make unnecessary" and Assets' "no CSS or JavaScript uploads, by design", so it needs the operator's explicit call with the security stance stated (an authored stylesheet is a stored-XSS surface; a sanitiser or a strict allowlist would be the price). Ask which reading they mean; recommend tokens first and see how far they reach.
1. **Phase 2 has two editors left, Shortcuts and Assets, then Phase 3 begins.** Shortcuts are house-style text fragments for the Static Content boxes Phase 3 brings (rows nothing reads yet, like the Social and Studio switches); Assets are the operator's photos in R2 with caption, credit and licence, which needs the upload path. Present each with the recipe below; the operator's standing instruction is "finish phase 2 and start phase 3". **Phase 3 is the App Builder**: `page` + `page_revision`, the Layout schematic, region renderers reading a revision, the catch-all route, redirect rows, dynamic actions; it is also where authorization schemes get enforced and Social/Studio get gated.
2. **Everything is applied.** Migrations `20260908170000` (settings, applied 09:44Z) and `20260908190000` (themes, applied 11:32Z), each rehearsed with `begin … rollback` first and applied on the operator's word; seven applied files in total. **The operator verified prod at the close**: the six theme cards with stamps, a theme of their own saved and picked in a private window, a custom default switched and back; earlier, the wire-headline count 5 → 2 → 10 → 5 followed within about a minute each time.
3. **Operator items still open, all yours to raise one at a time**: the release header on `/changelog` (twelve pushes now sit under `# 1.0 · Lights out`, the designer programme could open its own); the six merged remote branches to delete (chore/ci-actions-v7, chore/handoff-2026-09-07, feat/whats-new-hd, fix/lockfile-swc-helpers, fix/standings-banner, fix/studio-lost-update); the design loaders' 60 s memo (a save shows everywhere in about a minute; 15 s for settings was offered, undecided); the night's composer and `/admin/system` checks.
4. **The recipe, proven seven times**: rows seeded by an idempotent migration the operator applies after a rehearsal through the Management API (browser UA, `.supabase-pat`); a client-safe defaults module plus a server-only loader with a one-minute memo and the code as the fallback; one write path with the stamp check (a database function when a save touches more than one row: `design_save_list`, `design_set_default_theme`); the editor in `components/designer/`; the render probe (Testing Library under jsdom for the interactive states, the build's CSS, `python -m http.server`, Playwright at 1440×900) → review artifact for the operator BEFORE merge; the trio and the dry-run; merge only on the operator's word; poll `/changelog` for the version; republish the board.

### The session's arc (09:00Z → 11:45Z, operator present throughout)

| Version | PR | What |
|---|---|---|
| **1.0.43** | #922 | **Build Options**: the four switches editable; Ghost lap 3D (`QualifyingDecoder` prop, the 3D code never fetched when excluded) and Weather (`WeekendWeatherStrip`, `SessionForecast`) honoured; Social/Studio stored, labelled inert; a `weather` save nudges the weekend route pattern. Deployed 09:24Z |
| **1.0.44** | #923 | **Application Settings**: five rows (`home.lead_series`, `home.major_series`, `home.wire_count`, `home.blog_suggested_count`, `announcement.active_id`) with one parse rule shared by the loader and the route; `rankLiveWeekends` takes its priority; `WhatsNewModal` takes `activeId`. Migration applied 09:44Z, deployed 09:48Z |
| **1.0.45** | #924 | The designer keeps its selection in `?sc=` (`history.replaceState`, Next-integrated); the crumb returns to the overview. Asked for by the operator on first use |
| **1.0.46** | #925 | **Authorization Schemes**: label and message editable, type and value the code's; the lists editor offers schemes from rows and the lists route refuses an unknown one; enforcement stays Phase 3. Built on #924, rebased before merge. Deployed 11:01Z |
| **1.0.47** | #926 | **Themes**, widened by the operator to themes of their own: six rows, `available` and `base` columns, `design_set_default_theme()`; custom theme = shipped base + nine colours through a contrast gate (text/muted/faint 4.5:1, accent 3:1; the six pass), applied by a generated `<style>` on `[data-theme-custom]`; the layout, `themeInitScript(set)`, `generateViewport()` and the picker read one set. Migration applied 11:32Z, deployed 11:36Z |
| **1.0.48** | this | This handoff |

Suite 1613 → **1692**. Dry-run 41,815.51 → **42,028.45 KiB** `Total Upload` (64 MiB limit). Review pages: #922 `50bf5065-265b-4d5a-94aa-569d635144f1`, #923 `e0f8526e-81f0-434f-8fae-5feebd4e54a8`, #925 `33321588-6e13-4208-8df4-6a1021978cf1`, #926 `219a7801-9d0a-4dd7-b0ff-fa4bca7b3957`; progress board `a8d129cd-6c7b-42b9-b030-18a2dcc5dfca` (republished 11:36Z); field guide `6fb2f726-1b9d-4226-bfc4-5cb594b6b124`.

### Decisions (operator, 2026-09-08 midday)
- **Rows at render are fine** for what changes between deploys, with the code as the fallback and a per-isolate memo ("is it clever to have queriable pages?" answered: structure stays code, values are rows). · **Custom themes now**, as a shipped base plus nine colours; the shipped six keep their colours in CSS. · **Authorization schemes**: name and message only; add, remove and enforcement with Phase 3. · **Settings**: the blog band's visibility stays the composer's, the news source map stays code; "default series for new visitors" became the home lead and featured series (the 2026-09-04 decision as rows). · A minute for a save to show everywhere is acceptable.

### Findings worth carrying
1. **Next integrates `window.history.replaceState`** (its linking guide), so a browser-only chunk keeps state in the URL without a server round trip, and `replaceState` keeps the console's back arrow one step.
2. **A partial unique index can trip inside one UPDATE** that clears one row's flag and sets another's; the safe shape is clear-then-set inside a plpgsql function, one transaction (`design_set_default_theme`).
3. **`revalidatePath('/series/[slug]/weekend/[round]', 'page')` from a Route Handler only marks pages** for a fresh render on their next visit; nothing renders at once (Next's docs). The weekend pages' five-minute cache therefore does not delay a switch.
4. **Testing Library under jsdom tests a client component's behaviour** once its heavy children are mocked and `fetch` is stubbed (`QualifyingDecoder.test.tsx`, `Designer.test.tsx`); the render probe uses the same to reach states a static render cannot (a changed field, a 409 banner).
5. **`'fail' in g` over an object-literal union leaves `g.fail` possibly undefined**; type the gate as a discriminated union (`themes/[key]/route.ts`).
6. **Stacked PRs**: build the second on the first's branch, `git rebase main` after the first squash-merges (git drops the identical patch), `git push --force-with-lease`, check `gh pr view --json files`, then merge.
7. **A custom theme's rule has the same specificity as a shipped theme's** (`:root[attr]`); it wins by coming later, the `<style>` in body after the stylesheet. Its base keeps supplying `color-scheme`, the dark family and the light themes' per-element tint rule.
8. **`eslint-disable` for `react-hooks/exhaustive-deps` is never the fix**: inline the reads or move the helper to module scope (done twice, both times before the commit).
9. **Every design loader has the same four failure paths** (unconfigured, error, empty, unusable row) and the same test file shape; a new one takes twenty minutes when copied from `lib/design/text.ts`.

### Next, flat
1. Shortcuts editor (small), then Assets (the R2 upload path; caption, credit, licence), each with the recipe.
2. **Phase 3, App Builder**: `page` + `page_revision` with the refs projection, the Layout schematic, region renderers, the catch-all route with noindex until indexable, redirect rows, the dynamic-action interpreter, the route-collision test; authz enforcement (one evaluator; the nav needs a client-side one because layouts render at ISR time); Social/Studio gating; add/remove schemes.
3. Phase 0 follow-up: multi-class standings (`manufacturer` kind, forward migration, morning apply).
4. Housekeeping: `supabase/README.md` is stale about migrations; the memo option; the release header; the six branch deletions.

---

## Next session pickup — 2026-09-08 late morning (session 43 closed at 95% context — Phase 2 steps 0 to 3 shipped, step 4 planned and approved-pending) — `main` = **1.0.42**, prod verified through 1.0.41, zero open PRs, suite **1613**

### 🔴 Start here

1. **Step 4 of Phase 2 is planned, presented, and NOT yet approved: Build Options with the site honouring them.** The plan as presented: the editor for the four seeded flags (Include/Exclude per row, same stamp check as text messages); the runtime gates **Ghost lap 3D** (`components/f1/LazyGhostLap3D.tsx`, one lazy component) and **Weather** (`components/weekend/WeekendWeatherStrip.tsx`, `SessionForecast.tsx`) only; Social and Studio rows editable but their Exclude does nothing yet and the editor says so; loader with a one-minute memo and Include as the fallback on any failure; no migration (rows exist); trio 1.0.43. Get the "go ahead" before building.
2. **Step 3 shipped and is live** (#920, 1.0.41): six chrome strings as `text_message` rows (migration `20260908150000` applied, rehearsed first), `lib/design/text{-defaults,}.ts`, `GET /api/admin/design/text` + `PUT …/text/[key]` (one conditional update, 409 on a moved stamp), `components/designer/TextEditor.tsx`; the lists editor's footer preview shows the stored strings. Prod renders every string exactly as before.
3. **Operator checks still open, all behind the admin sign-in**: `/admin/designer` opens on the overview with counts 4 · 4 · 13 · 6 and Text Messages 6; Navigation Bar List → move a cell → Save → the phone bar follows within a minute; `?sc=textmsgs` → change the footer heading → Save → the footer follows; the night's composer and `/admin/system` checks; the release-header decision; the six branch deletions.
4. **The recipe for every editor step, proven three times**: rows seeded by an idempotent migration the operator applies after a `begin … rollback` rehearsal through the Management API; a client-safe defaults module plus a server-only loader with a one-minute memo and the code as fallback; one write path with the stamp check (a DB function for multi-row lists, a conditional update for single rows); the editor in `components/designer/`; the render probe → build CSS → `python -m http.server` → Playwright screenshots → review artifact for the operator BEFORE merge; the trio and the dry-run. Review pages: lists #918 `87b1b504…`, text #920 `61914434…`; progress board `a8d129cd-6c7b-42b9-b030-18a2dcc5dfca` (republish it after each step).

### The morning's arc (session 43 continued)

- **The direction widened.** The designer is now **paddock-developer**: the operator's own builder, for themselves and whoever uses it, APEX's concepts without Oracle's names or visuals, its appearance free to grow away from APEX's hard parts. Consequences taken this morning: every design table carries `application_key` (tenancy while the tables were empty), and the review page for each UI step is the operator's approval gate. The product programme itself (tenancy for others, per-tenant code, concurrency, an opt-in MCP surface) is written up after Phases 2 and 3 prove the designer on Paddock.
- **Prod state, all on the operator's word, each rehearsed with a rollback first:** migrations `20260908090000` (design tables), `20260908110000` (tenancy), `20260908130000` (nav lists seeded + `design_save_list()`) are applied; `export-design` ran once and created branch `export/design` (`8addfe4`, 19 files).
- **Live on prod:** `/admin/designer` (1.0.39) edits the four navigation lists; the header, the phone bar and the footer render from rows (1.0.38) with the code as fallback.

### Operator checks still open (all behind the admin sign-in)
1. `/admin/designer` opens on the overview with counts 4 · 4 · 13 · 6; Navigation Bar List → move a cell → Save → the phone bar on the site follows within a minute; Reload/Save anyway appears only after a second save from elsewhere.
2. From the night: `/admin/site` composer with no banner, Save draft then reload reopens the draft, Publish; `/admin/system` Loads panel with ten series and the Cloudflare figure down by the previews' share.
3. Decide the release header (six then ten pushes under `# 1.0 · Lights out`), and confirm the six branch deletions listed in the night section.

### ✅ Shipped this morning — 5 merges, 1.0.36 → 1.0.40
| Version | PR | What |
|---|---|---|
| **1.0.36** | #915 | Migration `20260908090000` applied; first export run |
| **1.0.37** | #916 | **Tenancy**: `application_key` on 13 design tables, composite keys and foreign keys, one-row check dropped |
| **1.0.38** | #917 | **Navigation lists as rows**: seeds, `design_save_list()`, `lib/design/*`, `GET/PUT /api/admin/design/lists/[key]`, DoorLinks/BottomBar/Footer from rows |
| **1.0.39** | #918 | **Paddock Developer's first screen**: `/admin/designer`, catalogue of every APEX group, the list editor with real-component preview, Save/409, read-only on previews, blue edit accent |
| **1.0.40** | #919 | Records |
| **1.0.41** | #920 | **Text Messages**: six chrome strings as rows, the second editor, per-row conditional saves; migration `20260908150000` applied |
| **1.0.42** | this | This handoff |

### Decisions (operator, 2026-09-08 morning)
- Tenant column now, not later. · Designer accent: the prototype's blue, console themes only. · The lists editor shows Condition only when Phase 3 evaluates it. · The catalogue lists everything with the phase that brings it rather than hiding what is not ready.

### Findings worth carrying (morning)
1. **Stop `wrangler dev` by its `npx` root PID with `/T`.** Killing the port's PID leaves workerd and esbuild alive holding `.open-next`, and the next `cf:build` dies with `EPERM … rm .open-next`. Two such trees were found and ended this morning.
2. **Screenshots of admin UI without a session**: render the component with `renderToStaticMarkup` under vitest (mock `next/navigation` and `@clerk/nextjs`), wrap the markup in the build's CSS (`.next/static/chunks/*.css`), serve the folder with `python -m http.server` (Playwright blocks `file://`), screenshot at 1440×900, publish as an artifact. Worked first time for #918.
3. **`react-hooks/set-state-in-effect`** fires on syncing state from a prop in an effect; the fix is React's own pattern (adjust during render with a `seen` state), never a disable.
4. The Management API `database/query` endpoint runs a `begin … rollback` script as a real rehearsal: every statement executes against prod and nothing persists. Used before all three applies.
5. The console's own accent is already a blue-teal (`--brand #5ea9c4`); "amber" is the public site's. The designer's `--edit` sits beside it.

### Next, flat
1. **Phase 2 step 4: Build Options** as planned above (await the go-ahead), then Application Settings, Authorization Schemes editors, Themes, Shortcuts, Assets; Social and Studio gating as its own later step.
2. Phase 3: App Builder (pages, the Layout schematic, `page_revision`), dynamic actions.
3. Phase 0 follow-up: multi-class standings (GT World, IMSA, WEC) need a `manufacturer` kind, a forward migration with a morning apply.
4. Housekeeping: `supabase/README.md` is stale about how migrations are applied.

---

## Next session pickup — 2026-09-08 (session 43 — the night shift: Phase 0 live, Phase 1 shipped, the stale-payload bug found and fixed) — `main` = **1.0.35**, prod verified through 1.0.34, zero open PRs, suite **1572**

### 🔴 Morning actions, in order

1. ~~**Say "apply 20260908090000".**~~ **Done 2026-09-08 ~06:30Z** on the operator's word: applied through the Management API (`HTTP 201`), proof in the 1.0.36 changelog entry (fifteen tables, RLS on, anon and authenticated hold nothing, thirteen triggers, five indexes, the seeds). `export-design` run 34195192063 then created branch `export/design` (commit `8addfe4`, nineteen files). Kept here because the night's record said the rail refused an unattended prod write; it did, and the apply waited for the operator, as designed.
2. **Three checks behind your sign-in**, the only things this session could not reach. `/admin/site` on prod shows no banner; move a band → Save draft → reload: the composer reopens on the draft ("Editing the draft saved …") → Publish → live within a minute. `/admin/system`: the Loads panel lists ten series from run 34171116946 or later, and the Cloudflare requests figure should have dropped by the previews' share (1.0.33).
3. **Hard-reload any tab you had open on the site.** 1.0.34 stops browsers reusing month-old payloads after a deploy, but the copies your browser already holds clear only on their next revalidation. The `0ej-ohiw8omjz.css` console error should not return.
4. **Decide the release header.** Six pushes now sit under `# 1.0 · Lights out`; the designer programme could open its own named release. Your call, per the version scheme.
5. **Confirm the six branch deletions** whenever convenient: chore/ci-actions-v7, chore/handoff-2026-09-07, feat/whats-new-hd, fix/lockfile-swc-helpers, fix/standings-banner, fix/studio-lost-update. Tonight's PR branches were deleted by their merges.

### ✅ Shipped — 6 merges, 1.0.30 → 1.0.35, each built green on Workers Builds and checked on prod

| Version | PR | What |
|---|---|---|
| **1.0.30** | #909 | `PADDOCK_ENV` + `isProductionWorker()`; the layout route answers 403 off production; the composer opens read-only on a preview; `DATA_TABLES` moved into `wrangler.jsonc`; CLAUDE.md's Worker-size law rewritten for the 64 MiB uncompressed limit |
| **1.0.31** | #910 | Fifteen design tables in one idempotent, transaction-wrapped migration (**not applied**, see above); the weekly export job to branch `export/design` |
| **1.0.32** | #911 | Home-layout drafts; a publish refuses a stale base with 409; Reload or Publish anyway |
| **1.0.33** | #912 | The console's Cloudflare usage counts the production Worker alone (`scriptName`) |
| **1.0.34** | #913 | Browsers must revalidate pages and payloads: the root cause of the stylesheet-served-as-HTML error |
| **1.0.35** | this | Records |

### Prod state changed this session (not code, so recorded here)

- Migration `20260907190000` applied ~20:30Z through the Management API. Proof: `source`, `source_run`, `standing` as base tables with RLS on and no policies, view `standing_current`, five indexes, service_role with full grants.
- Loader run 34160583323 wrote rows for ten series; GT World, IMSA and WEC log `SKIP payload shape not mapped yet` (a Phase 0 follow-up).
- `DATA_TABLES=on`: the operator saved a dashboard version at 20:53Z, which does not deploy until Deploy is clicked (seven minutes went to finding that out); deployed 21:01Z as 9bf36e7f; the first fresh render at 21:15:30Z read `standing_current` (Supabase `edge_logs`). 1.0.30 then moved the flag into `wrangler.jsonc`, because a deploy replaces dashboard vars.
- `CRON_SECRET` rotated on the Worker and in GitHub with one generated value at 23:44Z, never displayed; run 34171116946 logged `revalidate: HTTP 200 for 27 paths`, where every run since #907 had logged 401.
- The Supabase organisation "Paris Dev Motorsport" is on the **Free plan**: `backups=[]`, PITR off (Management API, 21:11Z). That is why the audit-trail answer became "revisions plus a weekly export branch".
- 1.0.34's header fix on prod: HTML and RSC responses now carry `s-maxage=N, max-age=0, must-revalidate` (checked after the deploy; the CSS chunks keep `public, max-age=0, must-revalidate`).

### Decisions the operator took this session

- Nav-composer code: **keep**, parked as a local commit on `feat/nav-composer` (0d245b0). The six Monza drafts are committed on `content/monza-drafts-final` (6f1abdd), local only, no PR yet.
- Designer writes: **production only**, behind `PADDOCK_ENV`; previews open the designer read-only.
- Audit trail: **the database** (append-only revisions) **plus a weekly JSON export** to branch `export/design`, never main, never under `content/`.
- `CRON_SECRET`: **rotate both**.
- For the night: "create and merge PRs and keep doing the next tasks ensuring it has deployed."

### Findings worth carrying

1. **Cloudflare removed the compressed Worker-size limit on 2026-09-04**; 64 MiB uncompressed on every plan; the bundle is 41.8 MiB (`Total Upload`). The "at the ceiling" law is gone from CLAUDE.md.
2. **Dashboard variables are wiped by every deploy** (no `keep_vars`), and a saved dashboard version is not a deployed one. Every flag lives in `wrangler.jsonc` now (landmine 10).
3. **OpenNext hard-codes `stale-while-revalidate=2592000`** on ISR pages and RSC payloads (a first render carries Next's year); with no `max-age`, browsers reuse previous-build payloads after deploys, chunk names and content included. `worker.ts` rewrites HTML and RSC to `s-maxage=N, max-age=0, must-revalidate` (`lib/cache-headers.ts`). `expireTime` in `next.config.ts` would not have helped; OpenNext overrides it.
4. **The Management API logs endpoint** (`/analytics/endpoints/logs.all`) needs both `iso_timestamp_start` and `iso_timestamp_end`; start alone returns odd slices; ingestion lags about a minute. Filtering `edge_logs` by `request.path` is how the rows-path proof and the stale-payload diagnosis were made.
5. **The schema's default privileges** grant anon and authenticated everything on a new table, and views run as `postgres`, which bypasses RLS. Harmless today (the app never ships the anon key; standings are public) but Phase 1's migration revokes both roles explicitly; Phase 0's tables still carry the grants.
6. **The permission rail blocks unattended prod database writes even under delegation.** Plan migrations for when the operator is present (memory `project-paddock-unattended-limits`).
7. **A temporary render probe** (`renderToStaticMarkup` + `vi.mock('next/navigation')`, deleted before commit) checks a client component's states without Testing Library; it caught nothing wrong in the composer and found the year-long header case in the cache fix.

### Next session, flat

1. The morning actions above; then the `information_schema` proof into the changelog and the first export run.
2. **Phase 2**: `/admin/designer` as client-only chunks on the real tables, lists and text messages first, with the runtime reading them; ESPA plan before code; budget the bundle with `Total Upload`. **Step 0 done 2026-09-08 morning:** migration `20260908110000` made every design table multi-application (`application_key`, default `paddock`; composite keys and foreign keys), rehearsed with a rollback and then applied on the operator's word. Direction behind it: the designer grows into **paddock-developer**, the operator's own builder for themselves and whoever uses it, APEX's concepts without its names or visuals; tenancy, per-tenant code (Workers for Platforms), concurrency and an opt-in MCP surface are its later programme, written up after Phases 2 and 3 prove the designer on Paddock itself.
3. Phase 0 follow-up: map the multi-class standings payloads (GT World, IMSA, WEC; `class_name`) so the three SKIP lines close.
4. Data: the Traffic tab's Cloudflare placeholder gets a fetcher; Upstash's developer API; the replacement for the deprecated `billable-usage` endpoint.
5. Content: the F1 race-weekend answer is still a 404.

### Worktrees and branches

`../Motorsport-editor` (chore/handoff-2026-09-07, merged), `../Motorsport-shots`, `../Motorsport-lockfix`, `../Motorsport-testing` (Fotis's `testing`), `node_modules` junctioned into the first two. The main working copy ends on `main`.

---

## Next session pickup — 2026-09-07 (session 42 — the designer programme, Phase 0 shipped, the loader outage fixed) — `main` = **1.0.29**, prod verified at 1.0.25+, zero open PRs, suite **1548**

### 🔴 Read first — three operator actions gate the next step, in this order

1. **Apply migration `supabase/migrations/20260907190000_source_run_and_standing.sql` to prod** (`source`, `source_run`, `standing`, view `standing_current`). Merged in #907 (1.0.28) but **NOT applied**: the law says the operator names it. `.supabase-pat` now holds the regenerated token "paddock-september" (verified HTTP 200 on 2026-09-07, expires 2027-08-31); apply through `POST https://api.supabase.com/v1/projects/dzelqrtajnauunzmxfic/database/query` with a browser User-Agent, or Studio. Until then the loader logs `SKIP … relation does not exist` per series and every reader falls back to the payload path.
2. **Dispatch `warm-live-data`** and confirm the new "standings rows" section logs `OK n rows` per series; `/admin/system` → "Loads — rows with provenance" fills. Optional: add repo secret `CRON_SECRET` (the Worker's value) so the run can call `/api/cron/revalidate`.
3. **Set `DATA_TABLES=on` on the production Worker** (wrangler var). The F1 standings tab then reads `standing_current` and falls back to the payload when empty. Revert by unsetting.

### The loader outage is over (and this time it is proven)
`warm-live-data` failed every run from 2026-09-04 11:51Z at `npm ci` (`Missing: @swc/helpers@0.5.23`, the #687/#688 disease again, from 3b4f45b/1.0.9). #902 (1.0.23) regenerated the nested entry under npm 10. Green runs: 34135679278 (14:58Z, F1 standings 34 rows, results 299 rows, every series OK) and 34137280990 (15:14Z, first run on `actions/checkout@v7` + `setup-node@v7`, #906). Prod shows the post-Monza totals (Antonelli 267). Two things the green run still logs, both handled: `www.wrc.com` answers 403 to the runner (fallback used), `motorsportweek.com` 404 twice.

### The plan of record
- **Field guide** (artifact `6fb2f726-1b9d-4226-bfc4-5cb594b6b124`): every APEX Page Designer and Shared Component with Oracle's definition, Paddock's version, Adopt/Adapt/Skip, the table it needs; §03 database design **after an adversarial review** (one enforced write path per table, run-id swap instead of transactions, ISR plus a revalidate nudge instead of a version-keyed cache, `PADDOCK_ENV` gate for prod-only designer writes, the database as the audit trail with no nightly export to `main`); §04 phases 0–7 with a verification column; §06 the flat list; §07 the Data workspace service by service (verified against vendor docs).
- **Designer prototype** (artifact `cf8ff9e2-bc1c-4dcc-8239-2e6d3f8da713`, v2.4): APEX Layout schematic, 45-entry shared-components catalogue, declarative dynamic actions that execute in Save and Run, Chrome-DevTools device toolbar, runtime developer toolbar with Quick Edit and Theme Roller, Data workspace with 14 services (tiers: readable now · needs a credential · our own tables; tabs Overview · Breakdowns · Health · Connection). Earlier artifacts were deleted between publishes; quote the current URL.
- **Open questions for the operator** (answer before Phase 1): prod-only designer writes acceptable? The database as the audit trail, or a weekly export branch? And verify Cloudflare's limits page, which now states a 64 MiB uncompressed Worker size with no compressed limit, against the 10 MiB gzipped ceiling this repo treats as law.

### ✅ Shipped — 8 merges, 1.0.22 → 1.0.29

| Version | PR | What |
|---|---|---|
| **1.0.23** | #902 | Lockfile: nested `@swc/helpers@0.5.23` back; `warm-live-data` green again |
| **1.0.24** | #904 | What's-New banners re-captured at 2× from prod, served by `srcSet`; calendar crop on the Italian GP week |
| **1.0.25** | #903 | Studio lost-update guard: `updated_at` version check, 409 on a stale save, conflict banner (Reload / Save anyway), stale recovery snapshot flagged |
| **1.0.26** | #905 | Standings banner re-shot with the post-Monza table |
| **1.0.27** | #906 | `actions/checkout@v7` + `setup-node@v7`; CLAUDE.md no longer claims the PAT is live |
| **1.0.28** | #907 | **Phase 0**: `source` · `source_run` · `standing` · `standing_current`; loader writes one run per series (ok marked last); `/api/cron/revalidate`; freshness row-tier check; `DATA_TABLES` flag on the F1 tab; Loads panel. 16 new tests |
| **1.0.29** | this | Handoff, schedule and ideas ledger |

Also today, before the designer work: the six Monza posts (FP1, FP2, FP3, qualifying, race, long runs) written in the operator's voice with full 22-row linked tables and 2026 Commons covers; five published by the operator, the race report in review.

### Findings from the three background reviews (adversarial plan review · repo audit · data-API inventory)
- The store the code calls **"KV" is Upstash Redis** over REST, not Cloudflare KV (no `kv_namespaces`). Cloudflare's KV analytics do not apply; Upstash's developer API does.
- `lib/analytics/cloudflare.ts:76` sums **every Worker on the account** (prod + three previews); add a `scriptName` filter. The Traffic tab's Cloudflare panel is a hard-coded placeholder. The `billable-usage` endpoint is now marked deprecated in Cloudflare's reference.
- **Thirteen in-Worker crons**; `warm-results` and `warm-sessions` write KV keys the loader also writes: named exceptions to fold into the loader (Phase 5). **Sessions are still fetched from the 15 ICS feeds at render, on the Worker.**
- `page_layout` publishes on every save; the draft branch of its schema is unused. Migrations are applied by hand; `supabase/README.md` is stale.
- Phase 3's content migration is bigger than first written: 13 loaders, 22 files per series, 78 answers, 788 generated entries.
- GSC and GA4 **are** wired (`lib/analytics/{gsc,ga4}.ts`, service accounts); an earlier prototype card said otherwise and was corrected.

### Next session, flat
1. Operator: the three actions above. Then browser-check `/series/f1/standings` with the flag on and the Loads panel on `/admin/system`.
2. Phase 1: `PADDOCK_ENV` + `isProductionWorker()`; the design-tables migration (one idempotent file: application, page, page_group, page_revision with schema_version and the refs projection, list, list_entry, theme, setting, build_option, authz_scheme, text_message, shortcut, asset, redirect); layout API draft save + publish with the version check. Quote `wrangler deploy --dry-run` before and after.
3. Prototype: select lists in the property editor for long enumerations; keep fixing any dead control the operator reports.
4. Data: the `scriptName` filter; wire the real Traffic/System fetchers into the prototype's per-service structure, or start `/admin/data`.
5. Housekeeping: the six merged remote branches can be deleted once confirmed; the main working copy sits on `feat/nav-composer` with an uncommitted, superseded NavComposer plus IDEAS.md annotations that this PR supersedes (operator decides keep or discard). Worktrees: `../Motorsport-editor` (this branch), `../Motorsport-shots`, `../Motorsport-lockfix`, with `node_modules` junctioned into the first two.

---

## Next session pickup — 2026-08-28 (session 40 FINAL — shareability, the season archive, and the outage nobody was told about) — `main` = **0.334.94**, prod verified, zero open PRs, suite **1462**

**Read `docs/next-session.md` next.** It is the ordered queue and it opens with the one red item.

### 🔴 READ THIS FIRST — `warm-live-data` was dead for five days and the fix is UNCONFIRMED

`CLAUDE.md` calls it **"THE ONLY WRITER of the site's data"**: the Worker runs `DATA_SOURCE=db` and cannot fetch standings or results itself, because the upstreams block Cloudflare's shared egress.

- **82 of the last 120 runs failed. Last success 2026-08-23T14:12Z.** Cause: `Missing: @swc/helpers@0.5.23 from lock file` — the **#687/#688 disease, third occurrence**. npm 11 locally tolerates a nested-entry hole; the runner's npm 10 refuses; the only writer dies silently.
- **Fixed in 0.334.94** by regenerating the lockfile under npm 10 (one nested entry: `@serwist/turbopack/node_modules/@swc/helpers`). The lockfile's own `version` was also stale at **0.334.26**, 67 patches behind, because hand-editing `package.json` never touches it. Verified under **both** npm generations — that is the step missed last time.
- **`npm run lockfile:check`** now exists (`npx npm@10 ci --dry-run`). Run it after anything touching dependencies; local npm cannot catch this class.
- ⚠️ **No warm run has fired since the merge, so the fix is unproven.** The last run is still 07:43Z. Confirm before trusting any data page, and **do not flip 1.0 until it has run green twice.**
- **A second finding, independent of the outage: the schedule is throttled.** The workflow declares `*/20 * * * *` (72 runs/day); the real cadence is **~5 runs/day with 3–11 hour gaps**. Even healthy, results land hours late, not within 20 minutes. The comment in the file is wrong about its own contract.
- **The real problem is still open: nothing alerts on this workflow.** 28 hours last time, five days this time, found only because `gh run list` was run while ticking off §A3. Needs a channel — that is an operator decision.

### ✅ Shipped — 8 merges, 0.334.87 → 0.334.94, every one prod-verified

| Version | What |
|---|---|
| **0.334.87** | **Per-page social cards** for series, tabs, drivers and Learn — 869 pages had shared one image |
| **0.334.88** | **13 indexed empty-state pages noindexed**, and the two competing 1.0 modals merged into one |
| **0.334.89** | **The 2026 season archived** — 15 series, 221 weekends, 1041 sessions, before the feeds roll over |
| **0.334.90** | Archive routes — **this build FAILED and never deployed** |
| **0.334.91** | The build fix (memoised archive reads) |
| **0.334.92** | **F1 weekend notes** — all 12 completed rounds |
| **0.334.93** | Play-money framing on the two league surfaces (launch gate A6) |
| **0.334.94** | The `warm-live-data` lockfile fix above |

Suite 1451 → **1462**. Worker bundle **unchanged all day at 9552.56 KiB** (687 KiB headroom).

### 🔴 The findings that change what the next session can do

1. **Weekend URLs carry no season.** `/series/f1/weekend/15` resolves the round against `meta.season`, so when the 2027 calendar lands it silently becomes 2027's round 15 and the 2026 page is unreachable. Nothing 404s. **This is why weekend notes are keyed `"<season>-<round>"`** — a round-only key reattaches to a different race every January, the 0.334.54 staleness class.
2. **The F1 ICS feed carries 2026 ONLY** — 60 entries, zero history. MotoGP/WSBK/NASCAR go back to 2010-11 but at ~one entry per *round*, so no session breakdown, and `fallback.ics` is an 80-byte stub. **Whatever is not captured before a feed rolls over is gone**, which is why the archive was urgent. Re-run `npm run archive:season` before each rollover.
3. **`opengraph-image.tsx` is NOT inherited by a nested dynamic segment.** Marking `seriesTabMetadata` `ownCard` stripped the card from all 73 tab pages and the parent's did not fall through — they had *no* og:image, the exact 0.334.37 defect. Tabs need their own route file.
4. **A metadata route cannot be a re-export.** `export { default, runtime, … } from '../opengraph-image'` makes Next refuse to parse `runtime` and the route 500s. Share the renderer (`lib/og-cards.tsx`), not the module.
5. **The Cloudflare builder runs 3 workers; this machine runs 21.** A build that is green locally can die there on the 60-second per-page export budget. 0.334.90 failed exactly that way on `/` after the page count went 961 → 1188.
6. **`.next/dev` staleness bit TWICE today** (landmine 9) and both times looked like a real bug — once 500ing pages after a failed compile, once 404ing every archive weekend route. **Clear it before believing a dev-only failure.**
7. **Caching a `null` is a permanent outage.** `loadSeasonArchive` memoised failures, so one transient read would 404 a page for the life of the process. Only cache successes.

### 🟡 Content position, measured on prod (this is the answer to "is the content good enough")

| Family | Pages | Words | Sibling overlap |
|---|---:|---:|---:|
| Blog posts | 24 | 1,289 | 8% |
| Learn hub/topics | 12 | 1,050 | 4% |
| Driver profiles | 126 | 422 | 15% |
| Track profiles | 139 | 307 | 14% |
| `most-` records | 23 | 273 | 12% |
| Editorial answers | 119 | 258 | 6% |
| Who-won answers | 489 | 208 | 15% |

The pages that drew the AdSense verdict were **67–101 words at 54–66% overlap**. **Content is no longer the weak link.**

**Correction to the record:** session 39's close called the 212 weekend pages "the largest remaining scaled-content surface". Measured properly their sibling overlap is **15%** — short but genuinely distinct, and an upcoming-race schedule page answers a real query. The missing archive was the actual problem, not thinness.

### 🟢 1.0 is unblocked on everything except the warmer

§A9 was recorded as "five boxes, nothing built". **That was stale** — it predated the 0.334.41 modal rebuild. What existed was *two* competing 1.0 modals, both `id: 'v1.0'`, both dark, both mounted, with racing "is a dialog open" guards. Operator kept `WhatsNewModal` (real page screenshots), the roadmap was grafted on and **signed off, all three items**, and `LaunchBanner` + `LAUNCH_ANNOUNCEMENT` were deleted.

**Operator decisions taken 2026-08-28:** no separate "what 1.0 is" page (the modal covers it, §A9 complete) · **A8 accepted** — launch with server-side errors visible only in Cloudflare logs, watch them for 48h.

§A verified on prod this session: A1 home populates signed-out · A3 bundle, Clerk `pk_live_`, Supabase prod live · A4 sitemap/robots/llms 200, OG cards, empty-tab metadata · **A5 exactly one console error and it is the deliberate Funding Choices CSP block** · A6 assistant off · A7 all security headers.

### 🩹 Owed (operator)

- **Confirm the warmer is green** — and name a `workflow_dispatch` if you want it now rather than waiting hours. Ad-hoc data refreshes need you to say so.
- **Alerting on `warm-live-data`.** The single most valuable thing left. Email, Slack webhook, or warm-run age on the admin health board.
- **Credential-gated §A gates**: crons green (`CRON_SECRET` — the endpoint correctly 401s, so fail-closed is proven), KV reachable, a real contact-form send, PSI re-measure, secret rotation, GSC coverage.
- **Eyeball one trend chart against its standings table.** A2 reconciles in the data (standings 242/183/183/159/155 match, and the gap to summed race points is exactly sprint points) but the rendered chart total could not be read programmatically.
- **F1 upgrades are stale**: latest curated round is **11**, the season has run **12**.
- Long-carried: the image session.

### ⚠️ Shared checkout

A second session worked here throughout. At close it had uncommitted edits to `IDEAS.md`, `SCHEDULE.md`, `content/assistant/site-help.md`, `lib/information/generated.ts` and `lib/whats-new.ts`, plus untracked `docs/marketing/` (13 screenshots) and `docs/research/2026-08-28-social-presence.md` — a social-presence push already in flight. **None of it was touched.** `git add -A` swept two of those files into a commit once and had to be backed out; **stage explicit paths in this repo, never `-A`.**

---

## ⚡ Session 39 — 2026-08-27 (the record cohort, and four false claims it surfaced) — `main` = **0.334.86**, prod verified, zero open PRs, suite **1451**

**Read `docs/next-session.md` next.** TIER 1 item 1 is struck; its correction and the recommendation on item 2 are written in.

### ✅ Shipped — 4 merges, 0.334.83 → 0.334.86

| Version | What |
|---|---|
| **0.334.83** | The `record-notes.json` mechanism + its integrity test + the first nine notes; **two `champions.json` false claims fixed** |
| **0.334.84** | Eight more notes; **Formula E's teams record was wrong and is now Renault e.dams outright** |
| **0.334.85** | The last six — **the cohort is complete, 23 of 23** |
| **0.334.86** | Session records |

**Measured on prod-rendered HTML, before and after, the same way both times** (fetch the URL, take the `<article>`, strip tags, count words):

| | median | min | under 180 |
|---|---:|---:|---:|
| Before | **58** | **42** | 23 of 23 |
| After | **221** | **191** | **0** |

Suite 1345 → **1451**, all 106 from the new `it.each` gate rather than a test being written.

### 🔴 Four `champions.json` errors, every one found by checking a record COUNT against its sources

This is the finding worth carrying. The record pages state a number, and a number is falsifiable in a way prose is not — so writing 23 notes was, in effect, an audit of fifteen files' aggregate integrity. Three of the four were publishing false claims on live indexed pages.

1. **WEC credited Toyota with two manufacturers' titles that were never awarded.** For 2018-19 and 2019-20 the FIA **replaced** the top-class manufacturers' championship with a teams' championship, because the award required at least two registered manufacturers and Toyota was the only one left in LMP1. Toyota won both of those *teams'* titles. We had them as `constructorChampion`, so the record page said 7 and both who-won pages said "Toyota also took the manufacturers' championship that season". Real total **5**.
2. **WorldSBK had Yamaha as the 2009 manufacturers' champion; it was Ducati.** That one row is why our Ducati total read 20 against Wikipedia's stated 21 — and with it corrected the two agree exactly across all 38 seasons, which cross-checks the whole list rather than the single year.
3. **Formula E's teams record was published as a four-way tie at two. It is Renault e.dams, outright, with three.** Season 1 was filed as `e.dams-Renault` and seasons 2-3 as `Renault e.dams`, so `rankTitles` counted one team as two. **Same class as the crew-counting bug closed in 0.334.61 — the aggregation cannot see that two strings are one entity — in the constructor field this time.** It also fixed a derived count: "gone to 8 different teams" → 7.
4. The gt-world 2014 note cited that series' own `meta.wikipediaPage`, so the sources rail listed the same page twice. The only such duplicate in 1279 note sources.

### 🟡 Four bounded windows — NOT errors, and the distinction matters

Four pages have a derived headline that reads as an all-time claim over a file covering part of the history. Nothing is wrong in the data; the note states the scope.

- **NASCAR** — file starts 2000. Petty and Earnhardt also won seven, so it is a three-way tie, not Johnson alone. His five consecutive **is** his alone.
- **WRC** — manufacturers' title from 1973, drivers' from 1979, file from 1979. Lancia's 1974-76 are outside it: all-time Lancia has ten to Toyota's nine, which Toyota's own 2025 release says too.
- **IndyCar** — file starts 1996. Dixon's six leads the IndyCar Series era; Foyt's seven leads all-time.
- **NLS** — file starts 2010, series runs from 1977 (VLN until 2020). Fritzsche and Scheid have five each to Leisen's four, per the series' own report of Leisen's fourth.

**Still open and the operator's call:** the `summary` line — meta description and hub teaser — is unqualified on all 23 pages, including those four. It is the string Google indexes. Fixing it changes both record generators' summary text for every record page.

### 🟢 Two naming boundaries deliberately NOT normalised

The opposite call from the Formula E fix, and the difference is the test: **normalise when two strings are one entity in consecutive seasons and the aggregate is simply wrong; explain in prose when the entrant names as recorded are correct.**

- **F3** — ART Grand Prix's 2011 and 2012 GP3 titles were really entered as **Lotus ART** and **Lotus GP** under its title sponsorship. Real, distinct names. Under ART's name the record is six; counting the organisation it is eight. The note gives both.
- **F2** — four of ART's five are GP2 and one is Formula 2, across the 2017 rebrand. Its 2008 GP2 Asia teams' title is a different championship and is correctly excluded.

### 🔵 Process learnings (durable, session 39)

1. **Writing a note that must state a number audits the data that produces it.** Three false claims had survived every gate and two enrichment sessions because nothing ever compared our aggregate to an external one. The cheapest version of this check: take the record total the page derives, find one source that states the same total, and see whether they match. Where they did not, the year-by-year list was wrong.
2. **A press release's own count is not authority.** Mercedes-AMG's 2025 DTM release calls that title its **16th**; both Wikipedia DTM tables give **17** year by year. The note states neither total as a sourced claim — it gives the eras and the arithmetic, which both sources support. Same rule as "omit what two sources contest", applied to a number.
3. **Browser-verifying the FIRST page of the wave caught the only rendering defect again** — two Wikipedia citations in one entry rendering as a bare, duplicated-looking `en.wikipedia.org`. `sourceLabel()` now names the article. Fourth session running that this rule earned its keep.
4. **Check a URL resolves before citing it.** Of the first twenty source URLs, one 404'd (a worldsbk.com link whose spaces were `+`-encoded, not `%20`) and one 403'd to any scripted fetch. A one-line `fetch` loop over every candidate is worth running before the note is written, not after.
5. **A test that reuses the code under test is right when it is checking CONTENT, not code.** `record-notes-integrity.test.ts` imports the generator's own `driversOf` deliberately, so the test and the page cannot disagree about who a record holder is; the ranking is reimplemented, because that is the thing being asserted about.

### 🩹 Owed (operator)

- **The `summary` line decision** above — the one thing this work surfaced and could not close on its own.
- **The ADAC "drivers' title" noun.** `driversTitleWord` has no concept of a one-race family, so 70 who-won pages and two record pages call a 24-hour race win a drivers' title. It is the recommended next spend on TIER 1 item 2, in place of researching 204 short pages.
- **One primary-source check on the ADAC 2022 crew.** Ours is Mies/Feller/Vervisch/Vanthoor for Scherer Sport Team Phoenix; a secondary summary put van der Linde in that car instead. Wikipedia confirms the team but not the line-up. Nothing was asserted either way.
- Carried: the 1.0 copy sign-off (fifth session), the `POINTS_PAIR` broadening decision, the Álex Palou accent.

---

## ⚡ Session 38 — 2026-08-27 (the enrichment programme is finished, and what is thin now) — `main` = **0.334.81**, prod verified, suite **1345**

**Read `docs/next-session.md` next.** It is the ordered queue, and it is now ordered by measured thinness rather than by family. This file records what happened.

### ✅ Shipped — 11 merges of mine, 0.334.66 → 0.334.81

| Version | What |
|---|---|
| **0.334.66** | What's-New release modal, ships dark — card art is real page screenshots, not drawings |
| **0.334.67** | **MotoGP COMPLETE**, 77 of 77 (the 1949–1996 tail) |
| **0.334.68** | Feature a published blog post into the Learn IA (`post.learn_topic`) |
| **0.334.69** | Fix: that control shipped unreachable — a LIVE row's title linked to the article, not the studio page |
| **0.334.70** | **WorldSBK COMPLETE**, 38 of 38 |
| **0.334.73** | **WRC COMPLETE**, 47 of 47 |
| **0.334.75** | **DTM COMPLETE**, 39 of 39 |
| **0.334.77** | Backfilled points/wins/runner-up across WSBK, WRC, DTM — and fixed a wrong number on a live F1 page |
| **0.334.79** | **IndyCar COMPLETE**, 30 of 30 |
| **0.334.80** | **NASCAR Cup COMPLETE**, 26 of 26 |
| **0.334.81** | **ADAC 24h COMPLETE (54) + NLS COMPLETE (16) — the programme closes at 489/489** |

**The programme went 203/489 → 489/489, 41.5% → 100%, complete families seven → fifteen.** Suite 1265 → **1345**. 0.334.71/72/74/76/78 are a second session's admin-console work, not mine.

### 🔴 The finding that matters most — the programme finishing is not the thin-content work finishing

Audited the live registry rather than assuming: **788 `/information` entries, 786 indexed, 238 under 130 words.** Median words by cohort — who-won 140, tracks 274, editorial 169, guides 750, **`most-` record pages 67**.

- **The 22 `most-` record pages are now the thinnest indexed cohort on the site**, median 67 words and a 44-word minimum, *thinner than any who-won page ever was*. They are generated wholly from `champions.json` and **have no authored-note sidecar at all** — no equivalent of `champion-notes.json`. Structural gap, 22 pages, one wave. **This is TIER 1 item 1.**
- ~204 who-won pages remain under 130 words, concentrated in the ADAC 24h family and unavoidably so: a single race yields laps, a crew and the weather. Padding them would be the scaled-content problem in a different costume.

### 🟡 Errors found and fixed, each on a live indexable page

- **F1 1979 said Scheckter finished on 50 points. The official counting total is 51**, which `champions.json` already held — so the note was wrong and the data was right. Found by the backfill work, verified against the final standings before editing.
- **WSBK `champions.json` credited Ducati with the 2007 manufacturers' title. Yamaha won it**, its first in the class. The error rendered as "Ducati also took the manufacturers' championship that season". A spot-check of `constructorChampion` across that family then verified 22 of 38 and found no others.
- **The 1962 Senior TT went to Gary Hocking, not Hailwood** — Wikipedia's calendar is wrong, which is why our curated `wins: 5` was right and the article was not.

### 🔵 Process learnings (durable, session 38)

1. **The backfill's real result was not the one predicted, and measuring said so.** Filling points columns was meant to arm the points-pair assertion; it moved that check from 0 to only **8** of 124 notes, because **the columns were never the binding constraint — the regex is**. What it *did* arm was a different test: `champions-integrity`'s "champion outscores the runner-up" and "runner-up is a different person" now run over 40 and 62 previously-unchecked rows. Measure what a change armed; do not assume it armed the thing you aimed at.
2. **Consolidated driver articles roughly halve research cost on multi-title families.** One fetch of Loeb's article gave clinch venues for all nine of his titles; Sainz's covered two of his own plus the 1995 and 1998 deciders he lost; Dixon's covered six. Per-season fetches only where the driver article is silent.
3. **Two sessions in one working tree will collide.** A second session's branch was checked out underneath mid-wave, its unpushed commit already claimed the version about to be used, and a test count of 1302 was contaminated by its `health-store.test.ts` before being re-measured at 1291 in an isolated worktree. **Work in a `git worktree` when the tree is shared** — and it needs a real `npm ci`, because Turbopack refuses a junctioned `node_modules`.
4. **When a test's premise ceases to exist, generalise it rather than delete it.** `sitemap-data.test.ts` hardcoded two ADAC seasons as un-enriched; the wave enriched them and it failed as designed. Replaced with two derived checks — every one of 489 rows must carry a note, and no advertised URL may name a year no note covers — then **proved non-vacuous** by temporarily deleting nls 2014's note and watching it fail.
5. **A feature can be complete, correct, tested and unreachable.** The Learn-featuring control shipped with no route to it from the dashboard. `tsc` and unit tests cannot see reachability, and the admin UI sits behind auth this session could not hold, so the gap was found only when the operator asked where to click.

---

## Session 37 — 2026-08-26 (the endurance families, and a false claim caught before it was indexed) — `main` = **0.334.64**, zero open PRs, every merge prod-verified

**Read `docs/next-session.md` next.** It is the ordered queue. This file records what happened.

### ✅ Shipped — 4 merges, 0.334.61 → 0.334.64

| Version | What |
|---|---|
| **0.334.61** | **WEC COMPLETE**, 13 of 13 — **and crews counted per person**, which is the finding below |
| **0.334.62** | **IMSA COMPLETE**, 12 of 12 |
| **0.334.63** | **GT WORLD COMPLETE**, 12 of 12 |
| **0.334.64** | Session records |

**The programme went 166/489 → 203/489, 33.9% → 41.5%, and complete families four → seven**: F1 76, F2 21, F3 16, WEC 13, Formula E 12, GT World 12, IMSA 12. MotoGP stays at 41 of 77. Suite 1239 → **1265**.

### 🔴 The finding that mattered

**A crew is not a person, and the derived text did not know that.** `champions.json` puts a whole endurance crew in one `driver` field — `"Sébastien Buemi, Fernando Alonso, Kazuki Nakajima"` — and the title-counting logic keyed on that whole string. So the 2019 WEC page said *"It was **Buemi, Alonso, Nakajima**'s **first** FIA WEC title"*, which is false for Buemi, who won in 2014 with Anthony Davidson; and the all-time record line said *"**2** titles, shared by"* two crew strings when Buemi and Hartley had **four each**.

- **Caught while browser-verifying the first page of the WEC wave**, so no crew page was ever indexed carrying it. Fixed in the same PR that shipped those thirteen notes.
- **Scope was every family still to be enriched**: 145 crew rows across six families — WEC 13/13, IMSA 12/12, ADAC 54/54, NLS 15/16, GT World 7/12, and the shared 1996 IndyCar title.
- **Same class as the Formula E record line in 0.334.54**: derived prose making a claim its source data cannot support. That is now twice. When a page states a *count* or a *first*, check what it is counting.
- Single-driver families render byte-identically by design, and a test pins the old sentence verbatim, because 166 authored notes were written to sit under it.

### 🟡 Two more data errors, both found by a note contradicting its own page

- **`wec/champions.json` called 2019–20 a "super season".** The Super Season was **2018–19** — eight rounds across two calendar years with Le Mans in it twice. The label renders inside the team name.
- **The 2018 IMSA and six of twelve GT World notes give a month, not a day.** Wikipedia and its own mirror date the 2018 Petit Le Mans to **15 October, a Monday**, while every other IMSA finale in the family is a Saturday (checked all fourteen dates with `node -e`, not from memory). For GT World the clinch *venues* are well sourced and the *days* often are not. Inferring a race day from an article's publication date is not sourcing it.

### 🔵 Process learnings (durable, session 37)

1. **Browser-verify the FIRST page of a wave, not the last.** Every defect this session was found that way, before the wave shipped rather than after.
2. **A family's shape can differ from every other family's.** GT World's overall title combines Sprint and Endurance points, so it is regularly clinched away from the finale — Baku, Zandvoort, the Nürburgring, Valencia, Paul Ricard, Jeddah — and four of twelve were settled before the last race. Do not assume the finale.
3. **When two accounts of the same season disagree, the more specific one usually wins.** 2024 GT World had one report crediting the Barcelona Sprint finale and another the Jeddah Endurance finale; only Jeddah reconciles with the standings.
4. **My own date arithmetic is not evidence.** The Monday finding came from a `node -e` probe over all fourteen dates, not from counting in my head.

### 🩹 Owed (operator)

- ~~Cloudflare build command~~ — **DONE by the operator, 2026-08-26.** The Workers Builds deploy command is now `npx wrangler deploy && (npm run cf:populate || echo "populate skipped, non-fatal")`. Recorded in `docs/next-session.md` item 1 with the audit command, because that config lives in the dashboard and nothing in the repo enforces it.
- **The 1.0 modal copy** — still owed, untouched for a third session.
- **AdSense**: still a waiting game, and the index is now 203 enriched pages rather than 91 two sessions ago.

---

## ⚡ Session 36 — 2026-08-26 (four more families finished, the programme past a third) — `main` = **0.334.60**, zero open PRs, every merge prod-verified

**Read `docs/next-session.md` next.** It is the ordered queue. This file records what happened.

### ✅ Shipped — 10 merges, 0.334.50 → 0.334.59

| Version | What |
|---|---|
| **0.334.50** | MotoGP champion notes **2010–2001** (wave 4a), 15 → 25 |
| **0.334.51** | MotoGP **2000–1991**, nine of ten; 1996 held back |
| **0.334.52** | MotoGP **1990–1983**, seven of eight, **plus a wrong win count fixed** |
| **0.334.53** | **FORMULA E COMPLETE**, 11 of 11 |
| **0.334.54** | Formula E's **2026 champion added** — and the false claim it was making on twelve pages |
| **0.334.55** | **F3 COMPLETE**, 16 of 16 |
| **0.334.56** | F2 **2025–2014**, twelve seasons |
| **0.334.57** | **F2 COMPLETE**, 21 of 21 |
| **0.334.58** | Session records |
| **0.334.59** | **The note lead label now comes from the data** — the mechanism the two decisions needed, shipped the same session they were taken |

**The programme went 91/488 → 166/489, 19% → 33.9%.** Complete families: **F1 76, F2 21, F3 16, Formula E 12** — four finished this session where one existed before. MotoGP sits at **41 of 77**. Suite 1212 → **1239** — 18 of those from the `it.each` integrity gate picking up new series rather than any test being written, the last 9 from the note-shape work.

### 🔴 The findings that matter most

1. **The clinch template runs out of sourceable data at about 1990, and that is now a decision rather than a research problem.** Everything from 1990 forward has been findable in a sentence; below it the record is race results without championship context. Four MotoGP seasons were **held back rather than guessed** — 1996, 1986, 1982, 1981 — and 1986 is the instructive one: sources disagree on the round *count* (10 of 11 with Silverstone following, versus 10 of 12 with Silverstone before), and a 22-point final margin with 40 points still available refutes a round-10 clinch outright. Everything from 1980 back is untouched for the same reason. **This was the same question already open for ADAC and NLS** — together ~106 of the 323 remaining seasons — and it was **decided at session close and shipped as 0.334.59**: a note now carries one of `clinched` / `season` / `race` and the label follows the data.
2. **One missing row was publishing a false claim on twelve live pages.** `content/series/formula-e/champions.json` stopped at 2025 although season 12 ended at London on 16 August 2026 with Wehrlein taking a second title. The "all-time record" sentence is *derived* from that file, so every Formula E answer read "2 titles, held by Jean-Éric Vergne". Adding the row re-rendered it as "shared by Jean-Éric Vergne and Pascal Wehrlein". **The lesson generalises: derived prose inherits the staleness of its source, silently.**
3. **`champions.json` had Wayne Gardner down for one win in 1987. He won seven.** `ChampionsTab.tsx:328` renders that field, so `/series/motogp/champions` had been publishing "1 win" beside the 1987 champion. Found because the note contradicted the table. A sweep of all 77 rows afterwards found the rest sound — 2020 Mir's single win is real — with **2009 Rossi's count missing**, logged rather than guessed.
4. **`JSON.parse` reorders integer-like keys at BOTH ends of a splice.** Known for the target file; what bit twice this session is that it does the same to the *entries* file, so the authored 2010 → 2001 order was gone the moment it was read. The insertion order must be **derived** (sort descending), never taken from `Object.keys`, and the order check must scan the file's **bytes**, because a parsed-key check can never observe textual order at all. Both guards fired before anything was written.

### 🟡 Corrections caught before publishing, not after

- **Doohan's 1997 title was clinched at Donington, not Brno**; a first-pass answer said Brno.
- **The 1993 MotoGP season had 14 rounds, not 16** — right round number, wrong total, which would have described the Laguna Seca clinch as three rounds early instead of one.
- **Piastri's 2021 F2 title was clinched at Abu Dhabi, not Jeddah** (the Jeddah feature was declared at the end of lap five after the Pourchaire/Fittipaldi crash).
- **Grosjean's 2011 GP2 title was clinched at Spa, not Monza**, and his rival was van der Garde.
- **A Wikipedia season-page fetch contradicted itself on 1997**, giving both 12 and 13 wins and the clinching race as both a win and a second place, because it was inferring from a results table. **Table inference is not a source.**

### 🔵 Process learnings (durable, session 36)

1. **One targeted web search per season beats fetching the season article.** Season pages carry results tables but rarely the clinch sentence; the per-*race* Wikipedia article is the best single source, because it usually carries the date, the round-of-total and often an explicit clinch statement.
2. **Omission is cheap and it compounds.** Four MotoGP seasons and several individual claims were dropped (Rossi's "57th grand prix win" at Sepang 2003, which does not reconcile against his per-class totals; any 2008 season win total; Hülkenberg's 2009 points). None of it weakened a page.
3. **A new notes file costs +6 tests and no test-writing**, because the integrity gate is `it.each` over every series carrying both files. A wave that adds entries to an existing file adds none.
4. **The interesting seasons are rarely the dominant ones.** Three F2 titles were won by a champion scoring nothing in the deciding race; four F3 titles were settled without their winner finishing, or even racing; 1988 MotoGP was settled by a *cancelled* grand prix. That is what makes an enriched page worth reading rather than worth counting.
5. **Stale agent-owned Chrome processes block Playwright.** Nine `mcp-chrome-*` processes from 24–25 August held the profile; killed by PID (never by image name) and the browser came back.

### 🩹 Owed (operator)

- ~~Two note-shape decisions~~ — **taken at session close and the mechanism shipped as 0.334.59.** You chose the second note shape for pre-1990 seasons (`season:`, saying what the season was and that the deciding round is not recorded) and the short factual shape for ADAC/NLS (`race:`). That unblocked **106 of the 323 remaining seasons**, so the next session starts with no decision pending.
- **Cloudflare build command** — still owed, untouched this session: add `&& npm run cf:populate`.
- **The 1.0 modal copy** — still owed, untouched this session, especially the three `next` roadmap promises.
- **AdSense**: still a waiting game. The index is now *better* than at session 35's close — 75 more pages earned their way back in.

---

## ⚡ Session 35 — 2026-08-26 (the root moved, the index cleaned, F1 finished) — `main` = **0.334.49**, zero open PRs, every merge prod-verified

### ✅ Shipped — 19 merges, 0.334.30 → 0.334.48

| Version | What |
|---|---|
| **0.334.30** | `/changelog` reads as **15 named releases** instead of 707 pushes; version scheme set: a MINOR is a named release |
| **0.334.31** | `docs/launch-checklist.md` restored from the commit that deleted it; **4 gates were FALSE, not unticked**; 132-URL smoke pass run |
| **0.334.32** | The "vitest under load" flake **root-caused and killed**: suite 39–46 s → **7.5–11 s** |
| **0.334.33** | `/blog` shows its cover images |
| **0.334.34** | Findings recorded, including the og:image fault |
| **0.334.35** | Blog list rebalanced; mobile rows rebuilt as cards |
| **0.334.36** | Home "More reading" carries its covers |
| **0.334.37** | **Every page emits an `og:image` again** (12 route types verified) |
| **0.334.38** | Mobile calendar rebuilt as a Google-style schedule, **desktop provably untouched** |
| **0.334.39** | Composer refine pass 1 (filterable lead picker, series+date, radio semantics) |
| **0.334.40** | **RELEASES.md out of the Worker script** — headroom 669 → **822.68 KiB** |
| **0.334.41** | 1.0 announcement rebuilt as a **modal, shipped DARK** |
| **0.334.42** | **The landing page is retired; `/` serves the home page**, `/app` 301s |
| **0.334.43** | **AdSense audit + the noindex gate**: 443 thin pages left the index |
| **0.334.44–47** | Champion notes waves 3a–3e: **F1 complete, 76 of 76** |
| **0.334.48** | Programme counts corrected (I had double-counted) |

### 🔴 The findings that matter most

1. **Your thinnest pages were on your most valuable URLs, twice over.** 443 who-won pages (67–101 words, **54–66% text shared with sibling years**) were **35.4% of the whole index**, and had been flipped indexable five days before the 5 Aug AdSense rejection. Now noindexed and out of the sitemap (1252 → 822 URLs), pages still live and linked. Separately the *landing page* was the thinnest page on the site sitting on `/` — retired.
2. **`og:image` was missing site-wide.** `app/opengraph-image.tsx` sits in the root segment while every page lives in a route group, so the card was generated, served, and referenced by nothing. Fixed via `SOCIAL_CARD` in `lib/seo.ts` + both group layouts. **An explicit `images` in metadata BEATS the file convention** — the opposite of what the comment in `app/(app)/blog/[slug]/page.tsx:77` claims, and it silently replaced the weekend page's own card until `ownCard` was added.
3. **A deploy leaves a stale-chunk window.** `Cache-Control: s-maxage=85, stale-while-revalidate=2592000`, so the R2 page cache serves HTML from before a deploy pointing at build-hashed chunks that no longer exist. The first visitor to any page after each deploy gets broken JS (that is why `/calendar` rendered as an empty grid and `/` logged 40 errors). Local `deploy` runs `cf:populate`; **Workers Builds' command is in the Cloudflare dashboard and probably does not** — operator action.
4. **Enrichment works, measurably**: 68 → 157–179 words, sibling overlap 55% → 18–20%. F1 is 76/76. **91 of 488 done, 397 left.**

### 🟡 Corrections I owe the record

- **"121 of 488 done, 367 remain"** in 0.334.47 — double-counted the 30 pre-existing F1 notes. It is **91 / 397**. Now script-derived so it cannot recur.
- **`LandingNav` / `LandingFooter` are NOT shared with `AppShell`.** I said they were, "correcting" a right first answer. `AppShell` renders `components/Footer.tsx` and only *mentions* those two in a comment, which is what `grep -l` matched. They are **orphaned** now, along with `LandingAuth`.
- **"All 24 blog posts have a cover"** — wrong; I had measured `og:image`, which comes from the generated card route. It is **5 of 24**.
- **The 404's localhost `og:image` is not a regression I introduced** — its URL carries Next's file-convention hash, so it comes from the root `opengraph-image.tsx` and always has.

### 🔵 Process learnings (durable, session 35)

1. **`JSON.stringify` cannot edit `champion-notes.json`.** Integer-like keys always serialise **ascending**, flipping the file's newest-first order and turning a 10-entry addition into a 439-line rewrite. Splice as **text**, with guards asserting every pre-existing entry is byte-identical.
2. **`npx vitest` skips `pretest`**, so `CONTENT_BUNDLE` is stale and content assertions pass against old data. A sitemap assertion passed in isolation minutes before `npm test` correctly failed it. **Content changes need `npm test`.**
3. **Aggregate tables lie.** One fetch offered all 46 F1 champions at once and was wrong in four places (Stewart as his own 1969 runner-up, Taylor for Clark in 1962, Senna for Mansell in 1986, 8 wins for 1994 vs 6). Source season by season; **omit where sources conflict** rather than pick.
4. **A local production build cannot browser-verify client-rendered pages.** `.env.production.local` carries real Clerk keys and Clerk rejects them off the live domain, killing hydration — the calendar rendered as an empty grid and looked like a broken change. Use `next dev` or a preview Worker on a real subdomain.
5. **`grep -l <ComponentName>` proves a mention, not a usage.** Search for the `import`.
6. A `content/**` or `RELEASES.md` edit is invisible to `next dev` until `scripts/bundle-content.mts` re-runs.
7. **A component measurement is a floor — third time confirmed.** Predicted 75.68 KiB, delivered 153.41 net.
8. Shell heredocs mangle escapes into real newlines. Write scripts in the editor.

### 🩹 Owed (operator)

- **The 1.0 modal copy**, especially the three roadmap items in `LAUNCH_ANNOUNCEMENT.next` — anything named there is a public promise. Flip `active` in the same commit as the `1.0.0` bump.
- **Cloudflare build command**: add `&& npm run cf:populate` to close the stale-chunk window.
- **AdSense**: wait for Google to drop the 443 (Search Console will show "Excluded by 'noindex' tag" — expected, not a fault), then resubmit.
- **The ADAC note template**: 54 seasons of a 24-hour *race*, not a championship, so the clinch template does not apply. Decide the shape before anyone researches it.
- Launch-checklist §A gates that are yours: crons green, Clerk prod key, KV reachable, Supabase prod, secret rotation, a real contact-form send, PSI re-measure, signed-in console check.
- Empty-tab metadata (`/series/nls/standings` advertises tables it hasn't got) · `/social/leagues` play-money framing · month-grid tap targets (still unanswered).

---

## ⚡ Session 34 — 2026-08-24 (session 34 FINAL — the queue drained, the home composer, the console clean-up) — `main` = **0.334.28**, zero open PRs, every merge prod-verified

**Read `docs/next-session.md` next.** It is the ordered queue. This file records what happened.

### ✅ Shipped — 14 merges, 0.334.15 → 0.334.28

| Version | What |
|---|---|
| **0.334.15** | Dutch GP **race recap** drafted and queued; the operator published all four recaps |
| **0.334.16** | Push history **stopped being written** (4 writers, 0 readers); privacy policy corrected with it |
| **0.334.17** | **CSP now ENFORCES**, Funding Choices deliberately blocked |
| **0.334.18** | F1 **analysis surfaces public** (Race Story, Qualifying, Practice) |
| **0.334.19** | **Studio autosave** — the editor no longer loses written work |
| **0.334.20** | Like buttons moved into the byline band |
| **0.334.21** | Home composer **ship 1** — pin the lead post |
| **0.334.22** | Blog SEO: self-canonical, real `lastmod`, real `dateModified` |
| **0.334.23** | Two operator asks logged (mobile calendar, blog covers) |
| **0.334.24** | Home composer — **reorder, hide, live preview, drag and drop** |
| **0.334.25** | The **Console** link in the avatar menu |
| **0.334.26** | Session-34 records |
| **0.334.27** | **The admin clean-up: 653 KiB of Worker budget reclaimed**, the hub rebuilt as a to-do list |
| **0.334.28** | Bundle figures corrected across the docs |

Suite 1193 → **1206** (1208 at its peak, less the 2 tests in the deleted `bing.test.ts`).

### 🔴 The two findings that change what the next session can do

1. **The Worker bundle ended the session with 672.31 KiB of headroom, after starting it with 53.8 and dipping to 19.35.** The composer's drag-to-reorder gave `@dnd-kit` its first importer since the orphan sweep and took the margin to 19.35 KiB; the admin clean-up then freed **653 KiB** by deleting two read-only pages, landing at 9567.69 / 10240 KiB.
   - **The rule that explains both**: `@google-analytics/data` and `@googleapis/searchconsole` were *server* imports in *server* components, so they landed in the Worker script. `three` (25 MB installed), `recharts` (8.3 MB) and `leaflet` are all client-side behind `next/dynamic` and cost the Worker **nothing**. Check which side of that line something is on before assuming it is expensive.
   - **A chunk measurement is a floor, not the answer.** The prediction from measuring built chunks was ~352 KiB; the reality was 653 KiB, because the transitive `google-gax` / `@grpc` / `google-auth-library` trees went too.
   - **And the biggest lever is not application code.** A bundle breakdown (`wrangler deploy --outdir … --dry-run`) shows `resvg.wasm` **531 KiB**, `Geist-Regular.ttf.bin` **59 KiB** and `yoga.wasm` **28.5 KiB** gzipped — **~618 KiB, 6% of the whole budget** — which is the **Satori/`ImageResponse` runtime for OpenGraph cards**, used by five routes (`app/opengraph-image.tsx`, the blog / weekend / session cards, and `blog/[slug]/story-image`). Static assets are already offloaded to Workers Assets (`wrangler.jsonc:98`), so that lever is spent. Pre-generating those cards is the one change that would buy back real room. **Operator decision — the cards are what make posts shareable.**
2. **A published home layout appears inside the ISR window, not the 30-minute regional-cache window.** Measured on prod: **48 s** for one change, **~4 m 45 s** for the next, both *without* `revalidatePath`. The `revalidate = 60` fallback held in reserve by the plan is **not needed**. Both numbers are in `docs/perf-baselines.md`.

### 🟡 Corrections I owe the record

- **`changed` and `next` are NOT nested inside the result section's grid.** I asserted this in the approved plan and in two PR descriptions. The result `<section>` closes at `HomeLead.tsx:479`; the championship/next-up grid is a **sibling** opening at `:488`. Acting on the wrong version broke the refactor mid-flight. They are still one movable band, now by choice.
- **"48 seconds" was reported as the publish latency before the second measurement existed.** The revert took ~4 m 45 s. The honest reading is "bounded by the 5-minute ISR window, with regional-cache variance".
- **The sitemap's zero `lastmod` was very nearly reported as a defect.** It is a deliberate, documented decision (`lib/sitemap-data.ts:13-19`). Only blog posts got one, because only they have a verifiable change stamp.

### 🔵 Process learnings (durable, session 34)

1. **Write changelog prose in the editor, never through a shell-quoted `node -e`.** Bash expanded the backticks and silently ate four identifiers out of a finished entry. This file already warned about it; I did it anyway.
2. **Read the structure before a multi-boundary refactor.** Four "identical" `)}` lines are not interchangeable; the one I matched belonged to a sibling block.
3. **A vacuous test is not coverage.** The sitemap's "no entry carries lastModified" assertion passed because Supabase is unconfigured under vitest, so no blog entry ever got one. It would never have caught a regression.
4. **A test caught a UX bug no click would have**: `DEFAULT_HOME_LAYOUT` omitted `hidden: false` while the parser emits it, so the composer offered to publish a layout identical to the one already live.
5. **A dependency with zero importers costs nothing until it has one.** `@dnd-kit` sat in `package.json` for weeks outside the bundle.

### 🎯 Session 35 is operator-set: the admin page, and R2

**On R2 — settled, do not re-derive it.** R2 holds **data, not code**. Cloudflare Workers refuse to compile Wasm fetched at runtime ("Wasm code generation disallowed by embedder"), so the ~560 KiB of `resvg.wasm` + `yoga.wasm` **cannot** move there, and neither can JavaScript — a Worker script must be self-contained. The genuine candidate is **`content/`** (1.9 MB raw; `content/information/tracks.json` alone is 306.5 KB), read at runtime by `loadAllSeries` and the `/information` loaders and traced into the Worker. **Measure before migrating** — JSON gzips hard and the raw figure overstates it — and weigh it against `content/` being the operator's curated CMS, where an edit is a reviewable commit. Full write-up at the top of `docs/next-session.md`.

**On the admin page — click what exists before building more.** Nothing in the console has ever been browser-verified.

### 🩹 Owed (operator)

- **Click the composer**: `/admin/home` — drag, hide, preview, Publish. Never browser-verified; `/admin` needs a session this machine has not got.
- **Click the Studio link from the dev host.** It is an absolute cross-host link because `middleware.ts:92-98` 404s relative paths there — that one nearly shipped broken.
- **The four autosave checks** in PR #788, same reason.
- **Month-grid tap targets** — one word retires it.
- **The OG-image decision**: ~618 KiB, and the only ways to reclaim it are a separate Worker behind a service binding or pre-generating the cards. Not urgent at 672 KiB of headroom.
- Two `page_layout` revisions are stamped `measurement:session-34`; live state is automatic (no pin). Say the word and I clear them.

---

## ⚡ Session 33 — 2026-08-23 (privacy + GPC, the defect sweep, the queue, three blog drafts) — `main` = **0.334.12**, zero open PRs, every merge prod-verified

**Read `docs/next-session.md` next.** It is the ordered, one-item-per-PR queue. This file records what happened; that one says what to do.

### ✅ Shipped — 13 merges, 0.334.0 → 0.334.12

| Version | What |
|---|---|
| **0.334.0** | Privacy policy **false in 7 places**, rewritten. **GPC honoured** for the first time, a published promise with no code behind it |
| **0.334.1** | `/do-not-sell` documented **a statutory opt-out route that did not exist** |
| **0.334.2** | Cloudflare-migration residue: 9 stale Vercel references, 2 of them user-facing, 1 a false claim about error handling |
| **0.334.3** | `SessionCard`'s zero-caller `weather` prop deleted |
| **0.334.4** | Sweep audited; `next-session.md` rewritten as an ordered queue |
| **0.334.5** | `/calendar`'s `DataCloneError`, thrown on **every visit** |
| **0.334.6** | **Cloudflare Web Analytics was undisclosed** — edge-injected, so no grep found it |
| **0.334.7** | Orphan `/api/push/history` deleted; exposed that push history is **write-only** |
| **0.334.8** | 14 news tabs `noindex` + out of the sitemap; "Coming soon." was wrong copy on 7 working tabs |
| **0.334.9** | `HANDOFF.md` **532 KB → 36 KB**, rest archived |
| **0.334.10** | Three Dutch GP session recaps drafted, queued on prod |
| **0.334.11** | Recaps rewritten after a voice audit; grid confirmed; a source caught being wrong |
| **0.334.12** | Results tables restored to the recaps (operator correction) |

Suite **1193**. Queue items 1, 3, 4, 5, 9, 10 shipped; **7 and 11b closed by measurement with no code changed**.

### 🔴 What the audits found that the gates could not

1. **`/do-not-sell` told California residents to exercise a CCPA right by clicking a Google "shield icon" that has not existed since 0.12.6.** A documented legal route that could not be followed. That is the worst defect of the day.
2. **`/do-not-sell` and the privacy policy both promised we honour the GPC signal, and nothing in the code read it.** Grep for `globalPrivacyControl` returned nothing. Made true rather than deleted.
3. **Cloudflare Web Analytics runs on every page and was undisclosed.** Found in the CSP report stream, not the repo: Cloudflare injects it at the edge, so `grep -rn cloudflareinsights` returns zero and I had read that as "not running". Collecting since 0.253.1.
4. **`/calendar` threw `DataCloneError` on every visit.** The recorded fix ("drop `cacheOnNavigation`") **would have been a no-op** — the prop defaults to `true` in the package, so deleting the line changes nothing. It had to be explicitly `false`.
5. **A defect in my own GPC fix, caught by screenshotting it after the DOM assertions passed**: clamping only on save let the Advertising row render switch-on with an "ALWAYS ON" badge while gtag had it denied.

### 🟡 Three corrections I owe the record

Each was asserted to the operator and each was wrong.

- **"A character was lost inserting the blog title."** It was a CRLF artifact in my own insert script's field regex. The pipeline was fine; local now matches stored exactly on all nine fields.
- **"Our qualifying and sprint classifications render empty on prod."** Said twice. Both were **probe-before-hydration errors** — I queried the DOM before the Suspense boundary resolved. Both pages render the full sheet and match formula1.com.
- **"The approved voice uses no tables."** Measured off the published *preview*, which has no results to tabulate, and generalised into a house rule. Operator corrected it: tables are right for session results. The real defect in the first drafts was tables *instead of* prose.

### 📝 Blog drafts waiting in `/blog`

Three Dutch GP session recaps, `status='in_review'`, `publish_at` NULL, covers set, each with a flag block. Verified not public four ways (listing, direct URL 404, feed, and `publish_at`).

- **The qualifying post carries a time-sensitive "Race day" section.** Cut it or change its tense if publishing after the chequered flag.
- Facts: every classification from formula1.com's own tables; grid confirmed (no reordering, Pérez from the pit lane, reason unstated anywhere so not asserted); Sainz and Alonso's sprint pit-lane starts were a **parc fermé breach**.
- **RacingNews365's qualifying page is wrong about teams** (Antonelli as Ferrari, Hamilton as Mercedes) and is quarantined in the flags.

### 🔵 Process learnings (durable, session 33)

1. **Probe after hydration, or you will invent defects.** Two false alarms today came from reading the DOM before Suspense resolved. Wait, or assert on the streamed text.
2. **Check the installed package before trusting a recorded fix.** `cacheOnNavigation` defaults to true; the recommendation as written was a no-op.
3. **A grep that returns nothing is not proof of absence.** Cloudflare Web Analytics is injected at the edge and exists in no file here.
4. **Don't generalise a rule from one document type.** "No tables" came from a preview that had no results.
5. **A check that fires on correct data is worse than no check** — the 2001 champion-note win count, dropped rather than special-cased.
6. Deploys ran ~6 minutes, 13 for 13.

### 🩹 Owed (operator)

- **Queue item 6, the CSP → enforcing.** One decision is baked in: `fundingchoicesmessages.google.com` is deliberately **not** allow-listed, so enforcing blocks Google's Funding Choices. Arguably right, still your call.
- **Queue item 4b**: push history is write-only (4 writers, 0 readers). Rebuild the bell, or stop writing.
- **Queue item 11**: Race Story public on completed sessions, which needs the parked ISR unpark.
- **AdSense wave 3** (F1 pre-1996 champion notes) is the only tier-1 item left.
- The image session, and the PSI re-measure.

---

## ⚡ Session 32 — 2026-08-22 (the unsupervised run: support prompt shipped, weather rebuilt around sessions, nine merges) — `main` was **0.333.1**

### ✅ Shipped — 9 merges, 0.330.5 → 0.333.1, each one prod-verified before the next was pushed

| Version | PR | What |
|---|---|---|
| **0.331.0** | #759 | **The dwell-triggered support prompt.** Two asks, engaged-time accumulator, auth-scoped dismissal via Clerk `unsafeMetadata`, legal copy in the same PR. |
| **0.331.1** | #760 | **Weather per session, not per day.** Open-Meteo `hourly` added; Zandvoort's Saturday read 98% rain while the Sprint hour was 94% and Qualifying 33%. |
| **0.331.2** | #761 | **Audit of #759 + #760** — four defects in the prompt, one in the weather footer. |
| **0.331.3** | #762 | **"ALSO TODAY" was a lie from Friday evening on.** Names the weekday; "today" decided in the browser. |
| **0.332.0** | #763 | **Forecast across a session's running**, plus a two-hours-either-side window on session pages. Also the "classification not available" copy (item 6). |
| **0.332.1** | #764 | **Series reference strip: two rows of boxed 40 px targets**, full width. |
| **0.332.2** | #765 | **Items 3, 4, 5**: `prod-weekend8.md` and `NotificationBell.tsx` deleted, onboarding docs collapsed to one. |
| **0.333.0** | #766 | **Two Learn answers** (operator-asked): circuits leaving/joining the calendar, and driver pay through the decades. |
| **0.333.1** | #767 | **Item 2: the session-30 evaluation**, plus `champion-notes-integrity.test.ts` guarding all 45 notes. |

Suite 1133 → **1188**. Bundle 10176.64 → **10186.22 KiB gzipped** (+9.6 KiB across the whole session, **53.8 KiB** of headroom left).

### 🔴 The audit found five real defects in work that had already passed every gate

This is the part worth reading. All five were invisible to tsc, lint, vitest and `next build`.

1. **The support prompt could skip ask 1 entirely.** `setStage` only lands on the next render, so on a busy page the 1 s interval fired again, read the freshly-raised `shown`, and promoted straight to ask 2 — **reproduced live, showing "Last time I'll ask" as the first thing a reader ever saw.** Fixed with a synchronous `stageRef` guard. Caught *before* merge, by browser-verifying rather than trusting the gates.
2. **It could open over a sign-in form or a half-typed message.** `/sign-in`, `/sign-up`, `/studio`, `/contact`, `/settings`, `/write-for-us` all live in `(app)`, so a layout-level prompt reached every one. And at `z-[70]` it sits *above* `ContactModal`'s `z-[65]`. Now refused per tick on both counts.
3. **Its timer never stopped.** After a permanent dismissal the interval kept writing `sessionStorage` once a second for the tab's life — **measured on prod, the total climbed 79 s → 92 s after the visit was already over.**
4. **The weather footer shipped a missing space.** React's SSR ate the whitespace after `{circuit.name}`, so prod served `Circuit Zandvoort· forecast`. Same class as grepping across a JSX interpolation; the line is one template string now.
5. **The prompt's backdrop snapped in** at full opacity while the panel animated, because its `data-state` attribute had no consumer.

### ✅ All four blocked items CLOSED by the operator, 2026-08-22 (after the session-close merge)

- **`/f1/compare`'s trend chart — VERIFIED by the operator, signed in.** Screenshot shows the Points Trajectory rendering (Albon vs Lindblad, two lines, ranked legend 23 / 5). That closes **all three** previously-unclicked consumers of the 0.323.0 refactor: standings tab (session 30), team pages (this session, 6 lines, 686×320, zero height shift), `/f1/compare` (operator).
- **The signed-in support dismissal — confirmed by the operator.** The footnote reads correctly when signed in ("Signed in, so that sticks on every device you use").
- **The series reference strip keeps its new placement — APPROVED** ("i like this"). The two-row boxed strip stands; the 08-21 header-band placement is retired.
- **`content/legal/privacy.md` — REWRITTEN on the operator's word** (0.334.0, see below).

### 🟢 0.334.0 — the privacy rewrite, and a published promise that had no code behind it

**`content/legal/privacy.md` was materially false in seven places**, all corrected against the repo rather than from memory: Vercel named as host and log processor (it is **Cloudflare**), Vercel KV for push subscriptions and contact records (**Upstash Redis**), consent credited to **"Google's Consent Management Platform (Funding Choices)"** with a "shield icon" that does not exist (it is our own modal writing `paddock:consent` to `localStorage`, reachable from **Manage cookies** in the footer), the transfers and retention tables, and "Vercel's platform-level security". Two genuine **disclosure gaps** were also filled: the anonymous interaction/heatmap capture (consent-gated, DNT-honouring, stored in Supabase) and the signed-in sent-notification list. The in-app assistant clause now says out loud that the assistant **is currently switched off**, which it has been since 0.330.0 unmounted it.

**Then the load-bearing find: `/do-not-sell` told visitors we honour "the GPC signal", and nothing in the code read it.** A published compliance promise with no implementation. Rather than delete the claim, it is now true — `applyPrivacySignals()` in `CookieConsent` forces analytics and advertising off whenever `navigator.globalPrivacyControl` is set, **overriding a stored grant on every visit**, and `HeatmapTracker` stops entirely. Functional and Necessary are untouched, because GPC speaks to selling and sharing, not to remembering a theme.

**And a defect in that very change, caught by screenshotting it:** clamping only on save let the Advertising row render **switch-on with an "ALWAYS ON" badge** under GPC while gtag had it denied — the UI disagreeing with the behaviour, the exact class the operator keeps finding. Fixed by clamping at the **render** boundary, and the locked badge now reads "Off — your browser" instead of "Always on" for a locked-off row. 5 new tests pin the matrix.

### 🟡 Left noted, deliberately

- **The "connection is secure" interstitial is RECOMMENDED AGAINST as asked** (operator, 2026-08-22). That screen is a Cloudflare *Managed Challenge*, not a trust badge: it adds seconds to every first view against a 0.63 s TTFB, challenges Googlebot and any AdSense reviewer, and reads to many people as "this site has a problem". Three sharper routes to the same goal are written up in `IDEAS.md`, the best being **enforcing the CSP that is currently `report-only`**.
- `NOTED at the time, ALL FIXED in session 33`: the CSP's `va.vercel-scripts.com` leftover (0.334.2), `SessionCard`'s zero-caller `weather` prop (0.334.3), the orphan `/api/push/history` (0.334.7) and `ChartEmbed`'s rounded corners (0.334.8).

### 🔵 Process learnings (durable, session 32)

1. **Browser verification is not a formality and it is not the gate chain.** Two of the five defects were found by clicking, one by *measuring on prod after the merge*. The operator's prediction that gated work would still be broken was correct, five times.
2. **A one-second interval plus React state is a race.** Anything an interval reads and writes needs a ref, not state — state is a next-render promise.
3. **Verify the API shape against the live API, not a search summary.** Open-Meteo's hourly block was probed before the call was written (384 rows, ~15 KB, all six variables). And a search summary put Senna's million-a-race deal at **Williams 1994, $20m**; fetching the source showed **McLaren 1993, $16m over sixteen races**. RULE #1 earned its keep on a featured page.
4. **A check that fires on correct data is worse than no check.** A win-count guard flagged the 2001 champion note for "51 wins" — Prost's *career* record, correctly cited. Keeping it meant special-casing the prose, so it was dropped and the reasoning recorded.
5. **Clear a race with a route without a writer.** Verifying `sessionStorage` behaviour was impossible while the old page's interval kept rewriting it; navigating to `/` (marketing, no `SupportPrompt`) first made every test deterministic.
6. **Deploys ran 6 minutes, nine times out of nine.** Merge → `/changelog` flip, polled by background curl. No GitHub Actions run exists to watch.

### 🩹 Owed (operator) — carried forward

- **Decide**: retheme `/app` dark, `PreviewNews` on the weekend page, box depth beyond `/app`, and whether the series strip keeps its new placement.
- **Click through**: `/f1/compare` signed in (the chart), and the support prompt's "Don't show this again" signed in (the Clerk write).
- **The image session** — still the biggest outstanding job. **PSI re-measure** of `/`, standings and a weekend page.
- **Fact pack B** still records Norris' 2025 Dutch GP retirement as a "power-unit failure"; it was a broken oil line. Wrong at source, and it will re-infect the next post that reads it.
- Long-carried: key rotations.

---

## ⚡ Session 31 pickup — 2026-08-21 (session 31 FINAL — Dutch GP preview published, /app rebuilt around the blog, sign-in fixed, docs de-staled) — `main` = **0.330.4**, zero open PRs, prod verified

### 🚨 SESSION 32 RUNS UNSUPERVISED — read this before anything else

**The operator will not be present.** No approvals will arrive. Do not wait for one, and do not stop work to ask a question that the repo can answer.

**Standing authority granted for session 32, by the operator on 2026-08-21:** for every item on the AUTONOMOUS list below, you may branch, implement, gate, open a PR, **merge it yourself**, then audit your own merged work, and if the audit finds problems, fix them on a further branch, PR and merge that too. Loop until the list is genuinely done or genuinely blocked.

**A merge deploys production.** ~6 minutes, and **no GitHub Actions run exists to watch** — verify with a background curl of `/changelog` until the version flips. Never merge two PRs back to back without confirming the first reached prod.

#### AUTONOMOUS — do these without asking

1. **The dwell-triggered support prompt.** Fully specified in `docs/next-session.md` §1-§4: two asks, auth-scoped dismissal, Clerk `unsafeMetadata`, the copy guardrails. **Do not redesign it** — the operator settled the shape across three rounds.
2. **The session-30 evaluation that never happened.** The claim-by-claim table is in git history at `docs/next-session.md@5af5094`. Highest value: the three unclicked consumers of the refactored trend chart (team pages, `/f1/compare`, blog chart embeds) and a spot-check of the 22 F1 champion notes never independently re-verified. Fix what is broken; report what is fine.
3. **Delete `prod-weekend8.md`** — a 424-line Playwright accessibility dump committed to the repo root by accident. Provably junk, recoverable from git history.
4. **Delete `components/NotificationBell.tsx`** — dead since 0.328.0 unmounted it. Confirm zero importers first (`grep -rn NotificationBell app components lib`).
5. **Collapse the two onboarding docs** into one. `ONBOARDING.md` and `docs/ONBOARDING.md` cover the same ground and have already drifted — that is how both ended up wrong about `proxy.ts` in different words. Keep one, make the other a one-line redirect, and update every reference to it.
6. **Fix the copy on the "classification not available" state.** It is accurate but reads as broken thirty minutes after a session, which is exactly what happened on Dutch GP Friday. Say that timing data usually lands a little after a session ends.

#### FORBIDDEN — leave these on a branch with a PR and say so in `HANDOFF.md`

- **Anything requiring the prod Supabase service-role key.** You do not hold it and must not ask for it.
- **Publishing or scheduling blog content.** The SOP is absolute: DB draft, `publish_at` NULL, operator approves. Drafting is fine; going live is not.
- **Prod data writes.** Today's `.supabase-pat` writes were operator-named, one post at a time. That authority does not carry over.
- **Anything the Worker bundle cannot fit.** There were **63 KiB of headroom** at 10176.64 KiB gzipped against 10 MiB. Measure with `wrangler deploy --dry-run` before and after; if a change will not fit, **stop and report** rather than deploying a failure. `npm run deploy:testing` rejects harmlessly.
- **Weakening any check to go green.** No skips, no loosened asserts, no `as any`, no lint-disables. Quote the failure in the PR and leave it red.
- **Taste calls the operator has not made**: whether to retheme `/app` dark to match the testing build, whether `PreviewNews` should follow the News tab off the weekend page, box depth beyond `/app`, and the image session.
- **Force-pushing `main`, deleting remote branches, rotating secrets.**

#### Ground truth you will otherwise waste an hour rediscovering

- **Local Supabase is down** (Docker not running), so `.env.local` points at `127.0.0.1:54321` and **every blog-backed surface renders empty locally** — the `/app` lead band, `/series/*/blog`, `/blog/*`. That is the fail-soft path working, **not a bug**. OpenF1 *is* reachable from a laptop IP, so session pages and classifications do test locally.
- **The auto-mode classifier may block calls that read `.supabase-pat` and send it outbound.** It blocked twice today and allowed the same shape in between. Do not fight it; report and move on.
- `npm run lint` → 0 errors and **2 known `_encoding` warnings** in `lib/content-fs.ts`. `npm test` → **1133**. CRLF warnings on commit are normal.
- **Never put backticks inside a shell-quoted `node -e`.** Bash expands them and silently eats every identifier — it corrupted a changelog entry twice today. Use the editor for prose.
- `CONTRIBUTING.md` is the most accurate doc in the repo and the authority on the three-Worker topology (`testing.` is Fotis's, `paris.` is the operator's; **previews share prod's Supabase, KV and R2**, so a mutation on a preview writes prod data).

### ✅ Shipped this session (6 merges, 0.325.3 → 0.330.4, prod verified at 0.330.0 and 0.330.4)

- **#753 `0.327.0`** — `/app` leads with the latest blog post and its cover, plus the weekend in progress. Root cause fixed: the lead was "newest race with a podium" with no concept of a weekend being underway, so on Dutch GP Friday the page opened with a Formula E season that had ended five days earlier. Precedence is temporal, never editorial.
- **#754 `0.330.0`** — eleven review items: fluid `clamp()` type so the lead fills its box (measured fill 27% → 72-80%), live pill on a running session (client-tick only, because ISR bakes `isLive` stale), Blog in the nav, contact button replacing the notification bell, ten-row classifications with column rules, "Next session" instead of "First session", session names linking through, assistant widget unmounted.
- **#755 `0.330.2`** — doc staleness audit + the support-prompt handoff.
- **#756 / #757 `0.330.3` / `0.330.4`** — the support prompt's shape settled, then its dismissal scoped to the visit unless signed in.
- **The Dutch GP preview is live** at `/blog/f1-dutch-grand-prix-2026-preview`, inserted via the Management API (no prod service-role key on this machine), operator-approved and published.

### 🔴 Process learnings (durable, session 31)

- **The Worker bundle cleared 10 MiB by 63 KiB and the deploy succeeded**, which settles Cloudflare's "10 MB" as the *binary* reading. Treat the bundle as full regardless.
- **`CLAUDE.md` was materially stale** and cost real time: it claimed Vercel and ~90s deploys, `next dev --webpack`, 1125 tests, a `.clerk` file that does not exist, and a Blog SOP step verifying `status='draft'` when the script produces `in_review`. All corrected in 0.330.1. **Both onboarding docs claimed middleware lives in `proxy.ts`** — backwards, and precisely the rename that breaks the deploy.
- **Verify third-party API assumptions against the installed package, not memory.** The sign-in modal was unreadable because four of the six Clerk `appearance.variables` we passed do not exist in Clerk 7 — proven by reading `--cl-color-*` at runtime and finding them unset while the heading still computed white.
- **Measure layout bugs in the live DOM before writing CSS.** The lead's dead space was fixed by applying candidate values to prod's DOM and measuring fill at four widths, which is the only way to size it with no local blog data.
- **Two subagents on genuinely separate files worked.** Both reported honestly, one flagged a spec conflict rather than silently resolving it, and one caught the `dateOnly` landmine unprompted. Reviewing their work still found three defects — read-time divergence, an already-run session listed as upcoming, and opaque `FP1`/`SQ` labels in a hero.

### 🩹 Owed (operator) — carried

- **Decide**: retheme `/app` dark to match the testing build (a whole-page job, not a band), `PreviewNews` on the weekend page, box depth beyond `/app`.
- **The image session** — still the biggest outstanding job.
- **PSI re-measure** of `/`, standings and a weekend page, so the four fix packages' deltas land in `docs/perf-baselines.md`.
- **Fact pack B** (session-30 scratchpad) records Norris' 2025 Dutch GP retirement as a "power-unit failure". It was a broken oil line McLaren took the blame for, lap 65 of 72. Corrected in the published post; wrong at source, and it will re-infect the next post that reads it.

---

## ⚡ Next session pickup — 2026-08-20 (session 30 FINAL — 14 merges, PSI swept + all four packages shipped, AdSense enrichment waves 1 and 2, blog contract flipped) — `main` = **0.325.0**, zero open PRs, every merge prod-verified

### 📌 NEXT SESSION — start here
1. **The operator's blog approval.** The contract CHANGED mid-session: they asked for drafts, not just fact packs ("i want you to read my previous blogs. then give me a draft"). A finished Zandvoort-farewell preview is waiting in the session-30 scratchpad (`draft-f1-dutch-grand-prix-2026-preview.md`) with hero + inline licence-verified Commons images and four sourced Verstappen quotes. On their yes: move to `drafts/`, convert, `draft-post.mts` → prod DB draft, `publish_at` null. **Time-sensitive: the race is Sunday 23 Aug.** Going forward every post gets images, and they want OpenF1 `team_radio` embeds designed.
2. **AdSense wave 2** — MotoGP champion notes (wave 1 shipped for F1 1996-2025 as 0.324.0; the pattern is `content/series/<slug>/champion-notes.json`, fail-soft, no code change needed per wave). Then the four decisions in IDEAS NOW #1: public Race Story on completed sessions (the cheapest verdict-mover, needs the SEO-Phase-2b ISR unpark), the two stub components' copy/indexing, and noindex on the 15 news tabs. Request review ONCE, when we believe it.
3. **PSI re-measure** root + standings + weekend to capture the four packages' deltas, then append to `docs/perf-baselines.md`.
4. **Three design/behaviour decisions** waiting (IDEAS NOW #6): the serwist `cacheOnNavigation` drop, the calendar contrast token, month-grid tap targets (recommend accept).
5. Then **THE IMAGE SESSION** (operator: "the biggest job we have ever done"), with the Fotis testing-build layout as the reference.

### ✅ Shipped this session (12 merges, 0.321.2 → 0.324.0, each prod-verified after deploy)
- **0.321.2 #737 — the landing's ~7 s document stall.** `LastTimeOut` streams behind Suspense, which holds the ISR document open; a cold podium candidate fell through to a doomed upstream fan-out (worker egress is blocked) and **a null was never cached**, so every render re-paid it. Fix: 15-min negative-cache sentinel + a hard 2 s budget (`fetchFirstPodiumWithin`) + clean-IP podium seeding in the warm job.
- **0.321.3 #738** landing-orphan sweep (operator go): 15 zero-import files, 1,487 lines. Set recomputed from the tree, not the stale 17-name list.
- **0.321.4 #739 — home 50/50 band + THE 28-HOUR OUTAGE.** `warm-live-data`, the site's ONLY data writer, had failed every run since 08-19 07:22Z on the npm-10-vs-11 nested-lockfile hole (`Missing: @swc/helpers@0.5.23`) — the #687/#688 disease, reintroduced by a session-29 merge. **Now 2-for-2 after dependency merges: add an `npx npm@10 ci --dry-run` gate and a failure alert.** Four consecutive green runs since.
- **0.322.0 #740** the PADDOCK•TRACKER wordmark returns (header/nav/footer; condensed caps + brand dot).
- **0.322.1 #741** feed.xml finally carries DB posts + goes ISR (prod: 19 items, was 0 since the MDX era).
- **0.322.2 #742** `listThreads` fail-soft + Paper app error boundary (/social/threads dev-checkable at last).
- **0.322.3 #743** session docs.
- **0.322.4 #744 — fonts: 19 preloads / 660 KiB → 5 / 353 KiB on every page.** The mobile-LCP anomaly (metric 6.3 s vs its own 2.3 s breakdown) was preload contention, not a missing preload. Same PR: **the Upstash Redis SDK was shipping in browser JS** via `SessionCard` → `lib/weather.ts` top-level `import { kv }` (calendar chunk 128,560 → 34,972 bytes).
- **0.322.5 #745** tap targets 20 → 24 px sitewide (17 footer rows + the series/weekend feet). Same PR dispositioned two levers permanently: **gtag is already `lazyOnload`** (no regression, cost inherent) and **Clerk-for-anonymous is a NO-GO as a patch** — v7's provider hotloads `ui.browser.js` at init regardless of component mounts, so the May baseline's "lazy-load UserButton" idea moves ZERO bytes; the real path is custom flows + `prefetchUI:false` (~150-200 KiB), a project not a patch.
- **0.323.0 #746 — the trend chart splits into eager frame + lazy canvas**, killing the standings CLS 0.134. Frame owns the fixed box, ranked rail, chip legend and all state; only recharts is lazy, IO-gated. Measured 256/256 px at 390 and 320/320 at 1440, and **the hidden Constructors tab mounts its chart on switch** (verified by clicking it).
- **0.323.1 #747** the two lazy-loaded LCP images: driver portrait eager + `fetchPriority` + Commons 500px bucket (186 → 91 KiB), circuit SVGs get intrinsic 500×500 and the desktop one gets priority.
- **0.324.0 #748 — AdSense enrichment wave 1**: F1 champion answers 1996-2025 gain the clinch and the season's story (`content/series/f1/champion-notes.json`, 30 seasons), fail-soft so later waves need no code.
- **0.324.1 #749** session docs. **0.325.0 #750 — enrichment wave 2**: MotoGP 2011-2025 (15 seasons), authored inline after that researcher died on the cap; every clinch two-source verified, all 15 cross-checked against `champions.json`, and a source claiming 2017's margin was 36 was overruled by our reconciled 37.

### 🔴 Process learnings (durable, session 30)
1. **Three parallel research subagents died on the operator's session cap** (~16:40 EEST), exactly as `feedback-paddock-workflow-limits` warns. One had written its JSON (recovered, validated, shipped as 0.324.0), one had uncommitted perf work (recovered, gate-fixed, shipped as 0.323.0), one produced nothing. **Lesson: one research agent at a time, and check for recoverable partial output before redoing work.**
2. **A dead agent's work is unverified by definition.** Agent #3's 317-line chart refactor was sound but had a real lint error (`setState` synchronously inside an effect); the orchestrator's gate chain caught it. Never merge an interrupted agent's branch without re-running the full chain.
3. **`rm -rf .next/dev` under a live dev server 500s the server.** Cost a confusing minute; kill dev first (by PID via the port, never by image name).
4. **Wikimedia serves only bucketed thumbnail widths** — 352/360/400 return a 400 error page regardless of UA; 500 is the smallest usable bucket. Verified against all 22 shipped portraits before shipping.
5. **A comment inserted between `eslint-disable-next-line` and its target silently detaches the suppression.** Lint caught it; comment order matters.

### 🩹 Owed (operator)
- **Approve/edit the Zandvoort blog draft** (time-sensitive).
- Paste the PSI re-run figures once the four packages settle.
- The four AdSense decisions + three design decisions listed above.
- Long-carried: key rotations, dead `.supabase-pat`.

---

## ⚡ Session-30 mid-point pickup (superseded by the block above) — `main` was 0.322.2

### 📌 NEXT SESSION — start here
1. **The operator writes the two blogs** from the fact packs (scratchpad: `factpack-a-f1-summer-break.md`, `factpack-b-dutch-gp-zandvoort.md` — every claim sourced + dated, UNVERIFIED lists at the end). Claude returns **corrections only** (facts, stale numbers, house style). Zandvoort sprint question RESOLVED: it IS a sprint weekend (5th of 6, Zandvoort's first and last GP) — our calendar was right. Weather: re-pull Open-Meteo by venue-local date on writing day (the API line is in pack B; current model: heavy rain Sprint Saturday).
2. **AdSense "Low value content" recovery** (operator: "i want ads") — IDEAS NOW #1. `ads.txt` serves fine on prod (the console's "Not found" is a stale Aug-5 crawl); the Aug-5 policy verdict predates the bios day + Paper + meta sweep. Work: audit the weakest indexed URL families vs Google's thin-content bar, strengthen/noindex, then ONE Request review.
3. **THE IMAGE SESSION** (operator: "the biggest job we have ever done") — flood the site with licence-clean imagery; reference the operator likes: Fotis' testing build (big series image card beside the lead story, UP NEXT strip under). Riding along: home image boxes to series/calendar, blog driver-radio embeds (OpenF1 team_radio), and the now-orphaned `content/landing/circuits.json` + `public/landing/circuits/*` (dead weight since the orphan sweep — delete or reuse there).
4. **PSI re-run owed (operator)** → then append the 0.321.2 delta row to `docs/perf-baselines.md` (expect the ~7 s doc stream gone, mobile LCP toward the ~1.5-2 s FCP line, SI collapsing from 10.8 s).

### ✅ Shipped this session (six merges, 0.321.2 → 0.322.2, each prod-verified)
- **0.321.2 #737 — the landing PSI stall killed.** Root cause chain: `LastTimeOut` streams behind Suspense → holds the ISR document open → cold podium candidate falls through `withSourceSnapshot`'s db-read-only miss path into a doomed upstream fan-out from BLOCKED worker egress → null result never cached → every render re-paid ~7 s (PSI doc 7.1-7.4 s both form factors, mobile 69). Three legs: 15-min `NO_PODIUM_SENTINEL` negative cache (`force` bypasses), a hard 2 s budget on the block (`fetchFirstPodiumWithin`), and clean-IP podium seeding added to `scripts/warm-live-data.mts`. 9 new tests (suite 1125). Playwright-CLI prod audit ~14 min post-merge: wordmark page fine, Last-time-out present, `/changelog` current.
- **0.321.3 #738 — landing-orphan sweep** (operator go): 15 zero-import files, recomputed from the tree (stale 17-list had 4 already gone via #683; +CountUp/CircuitSlideshow transitive; WeekendHero's one ref was its own export). 1,487 lines deleted.
- **0.321.4 #739 — home 50/50 + THE LOCKFILE OUTAGE.** What-it-changed / What's-next became equal halves (operator: what's next is why users come). And **warm-live-data — the site's ONLY data writer — had been failing every run since 08-19 07:22Z** on the recurring npm-10 nested-lockfile hole (`Missing: @swc/helpers@0.5.23`, the #687/#688 disease reintroduced by a session-29 merge). npm-10 regen, single-entry diff, both npm generations verified. **The 11:45Z scheduled run is the first green-path proof** (survived npm ci; check its conclusion). The operator-reported one-driver London ePrix classification was this outage's symptom.
- **0.322.0 #740 — the PADDOCK•TRACKER wordmark returns** (operator priority: "we have lost our logo"): one condensed-caps + brand-dot treatment at AppShell header, LandingNav and LandingFooter (mobile: PADDOCK). Eyes-verified dev 1440/375.
- **0.322.1 #741 — feed.xml carries DB posts at last** (the sitemap's 0.246.1 bug, fixed for RSS): DB+MDX merge, DB wins, imports excluded, `force-dynamic`+dead `s-maxage` → `revalidate=300` (`○ 5m`). **Prod now serves 19 items** (was 0 since the MDX era).
- **0.322.2 #742 — `listThreads` fail-soft + Paper app error boundary.** A DB hiccup renders the threads empty state instead of a 500; `/social/threads` is finally dev-checkable (eyes-verified at HTTP 200, DB down). The last pre-Paper user-reachable surface restyled.

### 🔴 Incident + process notes (durable)
1. **The lockfile disease is now 2-for-2 after dependency-touching merges** — npm 11 locally tolerates nested-entry holes, the runner's npm 10 refuses, and the only writer dies silently. Detection gap: nothing alerts on the workflow failing (28 h unnoticed). Consider: a CI guard (`npx npm@10 ci --dry-run` in the gate chain after any lockfile change) or pinning runner npm; and a failure alert on the workflow.
2. **Prod writes require the operator to NAME the action — the auto-mode classifier now enforces it.** It denied both an ad-hoc local `warm-live-data.mts` run against prod (which had already launched in the background and completed: 13/13 standings, 8/8 results, 10/10 extras, 6/6 podiums, write-proof passed — that run is what healed the London classification and all stale data; recorded transparently in 0.321.4's CHANGELOG) and a `gh workflow run` dispatch. Standing conclusion: data refreshes go through the scheduled GitHub pathway; ad-hoc runs only when the operator names them.
3. **The Playwright MCP server died mid-session** (disconnected with google-drive after a dev-server PID kill). Replacement that works: `npx playwright screenshot --browser=chromium --viewport-size=WxH --wait-for-timeout=N URL out.png` (one-time `npx playwright install chromium`, ~115 MB). Used for every browser verification after the death.
4. **The stale-list lesson repeats**: the "17 orphans" list was 4 stale + 2 short; the real set came from re-grepping the tree. Recompute deletion sets at execution time, never trust carried counts.

### 🩹 Owed (operator) — carried + new
- **Paste the root PSI re-run figures** — the operator re-ran same-day and reports "better on root"; the append-only `docs/perf-baselines.md` row needs the actual numbers (mobile+desktop scores, LCP, SI).
- CLEARED same-day (operator, 2026-08-20 late): avatar-menu signed-in eyeball ✓ · GSC Validate-fix + noindex re-validate ✓ · Bing meta re-validate ✓ · the two `/feedback` DONE moves ✓.
- Key rotations + dead `.supabase-pat` (long-carried).
- AdSense: after the content audit lands, tick "I confirm" + Request review (one shot).
- Decide the PSI-sweep mechanics: a PageSpeed API key (Claude scripts ~20 runs) or manual pagespeed.web.dev clicks per page (new session logged in IDEAS NOW).

### 📎 Session artifacts
Fact packs + all verification screenshots live in the session scratchpad (`factpack-a-f1-summer-break.md`, `factpack-b-dutch-gp-zandvoort.md`, `prod-audit-landing.png`, `dev-home-5050.png`, `wordmark-landing.png`, `wordmark-app-mobile.png`, `threads-failsoft.png`). IDEAS.md was re-triaged end to end (fossils deleted, 11 dated kills, big rocks parked with triggers, NOW = AdSense recovery · image/positioning · v1.0 launch · HANDOFF trim).

---

---

## How to use this file

- **Session start:** read this file first (after `CLAUDE.md`), then `IDEAS.md` and `docs/next-session.md` for the execution queue.
- **Mid-session:** don't edit it. New ideas go to `IDEAS.md` Inbox.
- **Session end:** replace the top block with this session's, and let the previous two stay below it. When a fourth accumulates, move the oldest into `docs/handoff-archive.md`.
- **Never duplicate state.** `IDEAS.md` is the idea ledger, `docs/next-session.md` is the ordered queue, and this file is the record of what happened. The stack, the landmines and where things live belong to **`CLAUDE.md`** and **`CONTRIBUTING.md`**, which are the authorities — this file used to carry its own copies and they rotted, to the point of stating the `middleware.ts` / `proxy.ts` landmine backwards. They are gone; do not reintroduce them.

## Older sessions

Everything before session 30 lives in **[`docs/handoff-archive.md`](handoff-archive.md)**, frozen as it was written.
