# Pull requests

One entry per pull request, newest first: the place to see exactly what a PR changed and how it was verified, without reopening the diff or the ledger.

The rule from 24 September 2026: every PR adds its own entry here before it merges.

A records PR (a `docs(handoff)` merge) carries the entries of the merges it records, rather than a code change of its own.

How to read an entry: **Readers see** is what a visitor of paddock-tracker.com can notice, or "nothing" when every control ships off.

**Editors get** is what changed in the designer or the admin, or "nothing".

**Files** lists every file the merge commit touched, one line each, in plain words: what changed there, from the PR body, the CHANGELOG entry, or the file's own diff when neither says.

Back-filled 24 September 2026 for #1029 to #1053 (23 and 24 September 2026), from `gh pr view`, each merge commit's `git show --stat`, and `CHANGELOG.md`.

## #1072 · 1.0.191 · P2.5 PR B · merged Fri 25 Sep 21:15 (18:15Z) under the standing word
**The calendar page on the Filters region.** The live /calendar rebuilt on the Filters box (the operator's "swap the pages"): the series and the sessions as facets of the calendar's own model, the picks from the address, the old links kept, the filter box gone.
- **Readers see:** two chips (Series, Sessions) with counts above the calendar instead of the filter box; a pick reloads the page under a shareable address; old links with ?s= or ?races= still narrow.
- **Editors get:** a Filters region may name the calendar as its filtered region; the calendar's facets in the Facets group.
- **Files (16):**
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the facets field, CALENDAR_FACETS, the calendar's recipe with its Filters region.
  - `lib/design/component-render.tsx`, `lib/design/component-render.test.tsx` · the calendar's picks from the address; a component with facets as a Filters target; the rows from the calendar model.
  - `lib/design/view-state.ts`, `lib/design/view-state.test.ts` · calendarLegacySearch; bindViewState over any column list.
  - `middleware.ts`, `middleware.test.ts` · the shim for /calendar's old addresses.
  - `lib/design/page-document.ts`, `lib/design/page-document.test.ts` · a Filters region may name a component with facets.
  - `components/designer/PageDesignerProperties.tsx` · the Filtered region select offers such a component; its facets in the facet selects.
  - `components/calendar/CalendarView.tsx` · the picks as props; the local state, the memory and the mirroring gone.
  - `components/calendar/CalendarFilters.tsx` · removed (123 lines: the box's markup and handlers).
  - `components/designer/page-designer-model.test.ts`, `lib/design/composed-page.test.ts` · the compositions with the extra region.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md`, `IDEAS.md`, `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · the records and the trio, 1.0.191.
- **Verified:** tests first (five cases red across five files), then green; tsc 0; lint 0 errors (the two known warnings); vitest 248 files, 2422 tests; cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39513.89 KiB (39423.21 before); in the browser on the local server: the Filters region added to the calendar page in the designer (the Filtered region select offering the calendar, its two facets), Save and Run Page: the Series chip (MotoGP (179) first) and the Sessions chip (practice, race, qualifying, other), Formula 1 tapped narrowing the months to Formula 1 under filter=seriesName.in:Formula 1, the old link /calendar?s=motogp&races=1 narrowing to MotoGP races with both chips marked (screenshots .playwright-mcp/p25b-01..02; the review page as an artifact); the parity of prod's /calendar before and after the deploy pasted in the ledger.
- **Review:** a fresh-context Sonnet (~250k said, 199,495 measured, 69 tool uses): BLOCKING on one decision, the Sessions chip's four kinds against the plan's two, taken to the operator, who chose four; the non-blocking items folded in fe63c269 (the refusal names the calendar, the shim states its limit, the designer test for the calendar as a filtered region); left with the reason: the shim drops a list of names over VALUE_MAX (the vocabulary's rule, stated in its comment; the series pages write one slug), and no call-count test for loadCalendarModel (the dedupe is React's cache, which the test's mock cannot show).

## #1071 · 1.0.190 · P2.5 PR A · merged Fri 25 Sep 20:45 (17:45Z) under the standing word
**Filters as a layer, PR A: a Filters region over another Data region's rows.** APEX's Smart Filters as a component of its own; the calendar and news pages follow in PR B and PR C.
- **Readers see:** nothing until an editor places a Filters region on a page.
- **Editors get:** a Filters component in the Gallery: a Filtered region, three facets over its columns with a label, Depending On and a picks-several switch; on the page, chips whose values narrow the table at a tap, one facet waiting on another, a search box inside a chip, "and N more" past forty values, Reset.
- **Files (14):**
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the data.filters definition, the facets option kind, the parser's rule for Depending On, the summary's silence on what is not set.
  - `lib/design/presets.ts`, `lib/design/presets.test.ts` · facetValues and FACET_VALUES_MAX.
  - `lib/design/page-document.ts`, `lib/design/page-document.test.ts` · the Filters checks; a Filters panel never takes the h1.
  - `lib/design/component-render.tsx`, `lib/design/component-render.test.tsx` · the target reads its keys, one shared read per request, the data.filters renderer, READS.
  - `components/data/DataRegionFilters.tsx`, `components/data/DataRegionFilters.test.tsx` · the chips, the links, the picks-several form, the constant script, Reset; the hrefs, the hidden inputs and the escaping asserted.
  - `components/designer/PageDesignerProperties.tsx`, `components/designer/PageDesigner.test.tsx` · the Facets group's selects over the filtered region's columns and the other facets.
  - `components/designer/PluginsEditor.test.tsx` · six definitions listed.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.5 started on the revised plan; PR A's evidence.
  - `IDEAS.md` · the hydration warning seen on the run page too.
  - `docs/pull-requests.md`, `CHANGELOG.md`, `RELEASES.md`, `package.json` · this entry and the trio, 1.0.190.
- **Verified:** tests first (seven cases red across six files and one new), then green; tsc 0; lint 0 errors (the two known warnings); vitest 248 files, 2415 tests; cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39423.21 KiB (39351.47 before); in the browser on the local server: the Gallery's Filters entry, the Facets group on the Monza page over its Session results region (Team, then Driver depending on Team), Save and Run Page: the Team chip with counts, Ferrari picked narrowing the table to Leclerc and Hamilton and opening the Driver chip with those two, Reset back to twenty-two rows (screenshots .playwright-mcp/p25a-01..02).
- **Review:** a fresh-context Sonnet (~250k said, 228,850 measured, 29 tool uses): SOUND WITH FIXES, none blocking; the five folded in 8b381088 (a cleared facet clears its dependents, a comma value picked alone as eq, READS equal for both Data regions, the 80-character note in the help, the script bound once per region and tested in jsdom); the gates re-run after: vitest 248 files, 2418 tests, cf:build clean, the dry run 39423.21 KiB.

## #1070 · 1.0.189 · records · opened Fri 25 Sep 17:05 (14:05Z); the merge on the word
**P2.25 done on prod; the session-57 handoff.** Records only: the merge, the migration and the backfill on prod, and where session 58 starts.
- **Readers see:** nothing.
- **Editors get:** nothing new; the Session results source holds the season since the backfill.
- **Files (7):**
  - `docs/plan/ledger.json` · P2.25 DONE with the merge, the apply and the backfill's counts; the dated line.
  - `docs/plan/components-programme.md` · re-rendered (57 slots, 37 done).
  - `docs/HANDOFF.md` · the LATEST block: P2.5 next with "swap the pages", the known facts of the day (the local key override, the helper's captcha token, OpenF1's lockout and 429s).
  - `SCHEDULE.md` · the session-57 block to ~14:00Z.
  - `docs/pull-requests.md` · #1069 merged; this entry.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio, 1.0.189.
- **Verified:** node docs/plan/render-ledger.mjs → 57 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed; the counts read from prod through the Management API (session_result_current: 1175 rows, 54 sessions).
- **Review:** none; records.

## #1069 · 1.0.188 · P2.25 · merged Fri 25 Sep 16:42 (13:42Z), prod 1.0.188 at 16:47
**Session results: practice and qualifying classifications as rows, a Session preset, the cron writing beside its KV write, a backfill.** The operator's ask of the day: the Results source carries races alone, so a Data region could not show a practice or a qualifying.
- **Readers see:** nothing until an editor places a Session region on a page.
- **Editors get:** a fifteenth source, Session results (F1), with Series, Season, Round ("Latest captured" or one of 24) and Session (the three practices, qualifying, sprint qualifying); a Session preset (Table, thirty rows) with the driver linked, code, team, laps, time, gap, interval, Q1 to Q3, the tyre of the best lap and status.
- **Files (28):**
  - `supabase/migrations/20260925130000_session_result.sql` · the session_result table and its session_result_current view, the Phase 0 pattern; on prod on "apply 20260925130000".
  - `lib/session-result-rows.ts`, `lib/session-result-rows.test.ts` · the writer (a run per capture, ok last, failed on error), the readers (a numbered round or the latest, bounded), the backfill's skip check; the compound helper's test beside them.
  - `app/api/cron/warm-sessions/route.ts`, `app/api/cron/warm-sessions/route.test.ts` · the rows written beside the KV write under the hasResolvedDrivers guard; the report's db note; the cases: written, neither on a nameless or empty classification, a failed row write never blocking the KV write.
  - `lib/results/openf1.ts` · the compound of each driver's best lap from /laps and /stints (bestLapCompounds), two more fail-soft calls per capture.
  - `lib/design/sources.ts`, `lib/design/sources.test.ts` · the session-results source (SESSION_KINDS, the round options); the fifteen.
  - `lib/design/presets.ts`, `lib/design/presets.test.ts` · the session-rows shape, the Session group and preset; thirty-nine presets, twenty-one groups.
  - `lib/design/components.ts`, `lib/design/components.test.ts` · the Data region reads the sixth source; the preset option sets thirty rows.
  - `lib/design/source-read.ts`, `lib/design/source-read.test.ts` · the reader over the view: the latest round by default, the driver's page through the rosters, the weekend link; every column answered.
  - `lib/design/page-document.test.ts`, `app/api/admin/design/data/sources/route.test.ts`, `components/designer/DataSourcesEditor.test.tsx`, `components/designer/DataWorkspace.test.tsx`, `components/designer/PluginsEditor.test.tsx` · the counts and names that list the sources, now fifteen.
  - `scripts/backfill-session-results.mts`, `scripts/backfill-session-results.test.ts` · the season's finished sessions not yet captured; a dry run by default; --write, --season, --round; runBackfill and the cron's matcher tested without a network.
  - `docs/plan/ledger.json`, `docs/plan/components-programme.md` · P2.25 started on the plan, its evidence; P2.5's decision of the day (the two live pages rebuilt on the Filters box); the dated lines.
  - `IDEAS.md` · two Inbox lines: OpenF1's 429s under the paced client during the backfill; the designer's hydration warning seen in the proof.
  - `docs/pull-requests.md` · this entry.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio, 1.0.188.
- **Verified:** tests first, twelve files red, then green; tsc 0; lint 0 errors (the two known warnings); vitest 247 files, 2405 tests; cf:build clean; `npx wrangler deploy --dry-run` Total Upload 39351.47 KiB (39314.62 before); the migration applied locally (`supabase migration up --local`); the backfill's dry run then `--round 14 --write` locally (86 rows across Monza's four sessions); the cron run locally against Baku's finished sessions (two warmed, each `db: written`); in the browser on the local server: the Data Sources list, the Property Editor's Source group, the Session table on the run page with the driver linked and the tyre column (screenshots .playwright-mcp/p225-01..03; the review page as an artifact).
- **Review:** a fresh-context Sonnet, SOUND WITH FIXES, none blocking; the three folded in c35a921d.

## #1068 · 1.0.187 · records · opened Fri 25 Sep 14:55 (11:55Z); the merge on the word
**PA A3 done on the next-day check; the operator's sign-in asks recorded.** Records only: the check that closes the accounts move, and the six asks the operator made while doing it.
- **Readers see:** nothing.
- **Editors get:** nothing.
- **Files (8):**
  - `docs/plan/ledger.json` · A3 DONE: the next-day check's evidence (the Management API reads, the prod probes, the operator's dashboard reads and words, what could not be read) and the dated line.
  - `docs/plan/components-programme.md` · re-rendered (56 slots, 36 done).
  - `IDEAS.md` · six Inbox lines: the header's signed-out flash, the code and forgot links without an email, the "was it you?" email, the view-password toggle, the password rules with a strength line, the honeypot question answered.
  - `docs/HANDOFF.md` · the LATEST block: A3 DONE; the sign-in asks as the next slot proposal; the agenda.
  - `SCHEDULE.md` · the session-57 block: the intent, the check, the close, the won't-touch line.
  - `docs/pull-requests.md` · this entry.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio, 1.0.187.
- **Verified:** node docs/plan/render-ledger.mjs → 56 slots; npx vitest run lib/design/plan-ledger.test.ts → 6 passed.
- **Review:** none; records.

## #1067 · 1.0.186 · chore · opened Fri 25 Sep 13:55 (10:55Z); the merge on the word
**The server-only package declared; the writing scripts run with the react-server condition; R10’s merge and the session’s close in the records.** Found by the blog writer: scripts/draft-post.mts had failed since PA A1a.
- **Readers see:** nothing.
- **Editors get:** the blog draft script working again.
- **Files (10):**
  - `package.json`, `package-lock.json` · server-only ^0.0.1 declared; the lockfile regenerated with npm 10 (the nested @swc/helpers pin kept); the trio’s version 1.0.186.
  - `scripts/draft-post.mts` · the usage with --conditions=react-server and why.
  - `IDEAS.md` · the two Inbox lines of the day (session results in regions; the weekend articles), the newsletter decided.
  - `docs/plan/ledger.json` · R10’s merge, review and probe; the dated line; the session’s evidence.
  - `docs/plan/components-programme.md` · re-rendered (56 slots).
  - `docs/HANDOFF.md` · the LATEST block for session 57: the next-day check, then the session-results slot from its brief, then Phase 2 in order.
  - `SCHEDULE.md` · step 29; the day’s active time.
  - `docs/pull-requests.md` · #1066 merged; this entry.
  - `CHANGELOG.md`, `RELEASES.md` · the trio.
- **Verified:** npx tsx --conditions=react-server --env-file=.env.blog scripts/draft-post.mts drafts/f1-baku-2026-practice.md --dry → DRY RUN parsed; npm run lockfile:check clean; the plan-ledger test 6 passed.
- **Review:** none; a dependency and records.

## #1066 · 1.0.185 · R10 · merged Fri 25 Sep 13:39 (10:39Z), prod 1.0.185 at 13:43
**The dev host lets the sign-in routes and the account routes through; the lock redirected the sign-in itself.** A quick fix on the operator’s critical report: on dev.paddock-tracker.com every sign-in method failed because the dev host’s lock exempted the two sign-in pages alone, and since A3 the sign-in posts to /api/auth/* on the same host.
- **Readers see:** nothing on the site; the admin host signs in again.
- **Editors get:** the designer reachable again after a sign-in on the dev host.
- **Files (7):**
  - `middleware.ts` · one condition: /sign-in, /sign-up, /api/auth/* and /api/account* skip the dev host’s lock.
  - `middleware.test.ts` · the case: a signed-out sign-in passes, a reader signs out, the account read passes, the rest keeps its lock.
  - `docs/plan/ledger.json` · R10 STARTED with the cause and the fix; the dated line on the report.
  - `docs/plan/components-programme.md` · re-rendered (56 slots).
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio at 1.0.185.
- **Verified:** middleware.test.ts 6 tests green; tsc 0; lint 0 errors; the cause probed on prod (a signed-out POST /api/auth/password on the dev host answered 307, on the main host the route’s 400).
- **Review:** a fresh-context Sonnet reviewer (10 tool uses): SOUND WITH FIXES; folded: /api/account matched on a path boundary. Probed after the deploy: a signed-out POST /api/auth/password on the dev host answers the route.

## #1065 · 1.0.184 · records · opened Fri 25 Sep 12:45 (09:45Z), merged under the same word
**The switch to Supabase Auth on prod (PA A3), the session-57 handoff.** Records only.
- **Readers see:** nothing.
- **Editors get:** nothing.
- **Files (8):**
  - `docs/plan/ledger.json` · A3’s evidence: the switch’s steps, the merge, the prod probes, the Turnstile finding; two dated lines on the operator’s words; A3 STARTED until the sign-ins and the next-day check.
  - `docs/plan/components-programme.md` · re-rendered from the ledger (55 slots).
  - `docs/pull-requests.md` · #1064’s entry updated with the merge and the review; #1063 noted as closed; this entry.
  - `docs/HANDOFF.md` · the LATEST block: close A3 (the sign-ins, the next-day check), then E1’s plan, A4 on 2026-10-25; the State paragraph for prod’s auth configuration and the Worker secrets.
  - `SCHEDULE.md` · step 28; the day’s active time.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio at 1.0.184.
- **Verified:** node docs/plan/render-ledger.mjs → 55 slots; npx vitest run lib/design/plan-ledger.test.ts → 1 file, 6 tests passed.
- **Review:** none; records only.

## #1064 · 1.0.183 · PA A3 · merged Fri 25 Sep 12:28 (09:28Z), prod 1.0.183 at 12:32
**Supabase Auth inside the seam: sessions on the Worker, the site’s own sign-in, sign-up and Account pages, Clerk’s SDK gone.** The switch of phase PA: the seam over @supabase/ssr, the middleware refreshing sessions, the routes under /api/auth and /api/account, the site’s own screens, the templates, the Clerk webhook deleted.
- **Readers see:** after the merge, the site’s own sign-in page (email and password, a code by email, Google), an Account details page under Settings, initials in the header without a photo, and no sign-out after a week. Until the merge, nothing.
- **Editors get:** the Data workspace’s accounts card over Supabase Auth; the tree’s Authentication label.
- **Files (64):**
  - `.gitignore` · supabase/signing_keys.json (the local JWT signing key) ignored.
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.183).
  - `RELEASES.md` · the release trio: the public note (1.0.183).
  - `SCHEDULE.md` · records: step 27.
  - `app/(admin)/layout.tsx` · AuthProvider without a look; the comment.
  - `app/(app)/layout.tsx` · AuthProvider without a look; the Clerk preconnect gone; the toolbar comment.
  - `app/(app)/settings/account/page.tsx` · new: the Account details page (name, photo, email, password, providers, every device, deletion); ?reset=1 opens the password row.
  - `app/(app)/settings/page.tsx` · the Account details row (signed in).
  - `app/(app)/sign-in/[[...sign-in]]/page.tsx` · the site’s own sign-in page (next or redirect_url; a signed-in person goes on).
  - `app/(app)/sign-up/[[...sign-up]]/page.tsx` · the site’s own sign-up page.
  - `app/api/account/photo/route.test.ts` · new: its tests.
  - `app/api/account/photo/route.ts` · new: POST a PNG/JPEG/WebP of 2 MB at most into the avatars bucket; DELETE.
  - `app/api/account/route.test.ts` · new: its tests.
  - `app/api/account/route.ts` · new: GET the account, its flags and providers; PATCH name, email, password, flags; DELETE on the session’s sub after the words.
  - `app/api/auth/[action]/route.test.ts` · new: its tests.
  - `app/api/auth/[action]/route.ts` · new: password, code, verify, sign-up, reset, google, sign-out.
  - `app/api/webhooks/clerk/route.ts` · deleted: the welcome moved to verify (lib/email.ts sendWelcomeEmail).
  - `components/AccountIdentity.tsx` · the strip’s line about the avatar.
  - `components/AppShell.tsx` · initials in the header when there is no photo.
  - `components/auth/AccountForm.test.tsx` · new: its tests.
  - `components/auth/AccountForm.tsx` · new: the Account page’s rows.
  - `components/auth/GoogleButton.tsx` · new: Google’s button with a browser-made nonce.
  - `components/auth/SignInForm.test.tsx` · new: its tests.
  - `components/auth/SignInForm.tsx` · new: password, code, reset, the notice.
  - `components/auth/SignUpForm.tsx` · new: name, address, password, the code step.
  - `components/auth/Turnstile.tsx` · new: the widget.
  - `components/auth/fields.tsx` · new: the forms’ pieces (Field, inputs, Problem, Note, call, go).
  - `components/designer/PageDesignerTree.tsx` · the tree’s Authentication label.
  - `components/page/DeveloperToolbar.tsx` · the Session entry’s title.
  - `docs/HANDOFF.md` · records: the LATEST block for the switch.
  - `docs/plan/components-programme.md` · records: re-rendered.
  - `docs/plan/ledger.json` · records: A3 STARTED with the evidence and the dated line.
  - `docs/pull-requests.md` · records: this entry.
  - `lib/auth/boundary.test.ts` · no @clerk/ import anywhere; the session library in the seam alone.
  - `lib/auth/client-pieces.tsx` · the site’s own SignInLink, SignOutButton, AccountButton.
  - `lib/auth/client-provider.tsx` · AuthProvider over GET /api/account.
  - `lib/auth/client.test.tsx` · rewritten for the routes.
  - `lib/auth/client.tsx` · the context, useAccount, useAccountFlags, hasSignedInCookie, initialsOf.
  - `lib/auth/directory.test.ts` · new: its tests.
  - `lib/auth/directory.ts` · over the three service-role functions.
  - `lib/auth/server.test.ts` · rewritten for the claims.
  - `lib/auth/server.ts` · over getClaims: legacy_id before sub; flagsFromClaims.
  - `lib/auth/supabase.test.ts` · new: its tests.
  - `lib/auth/supabase.ts` · new: the client factory, the cookie rules, the request jar, the request checks.
  - `lib/design/data-services.test.ts` · its key.
  - `lib/design/data-services.ts` · the Clerk service becomes Supabase Auth.
  - `lib/design/data.test.ts` · the env names.
  - `lib/design/data.ts` · the reader auth(); the comment.
  - `lib/design/page-registry.ts` · /settings/account; the sign-in pages’ descriptions.
  - `lib/email.ts` · sendWelcomeEmail (from the webhook).
  - `middleware.test.ts` · new: its tests.
  - `middleware.ts` · the session first; the cookies on every response; the dev host failing closed; the user-scoped APIs 404 anonymous.
  - `next.config.ts` · the CSP: Turnstile and Google’s button in, Clerk out.
  - `package-lock.json` · regenerated with npm 10 (the nested @swc/helpers pin kept for CI’s npm ci).
  - `package.json` · the trio’s version bump; @clerk/nextjs removed; @clerk/backend a devDependency for the import script; @supabase/ssr added; supabase-js raised to ^2.117.1.
  - `scripts/sync-worker-secrets.mts` · SUPABASE_SECRET_KEY in the preview set.
  - `supabase/config.toml` · the local stack: the mail viewer, confirmations, codes, the captcha, Google (off), the templates, the signing key.
  - `supabase/migrations/20260924234000_pages_seed_account.sql` · new: the page row for /settings/account (prod on “apply 20260924234000”).
  - `supabase/templates/confirmation.html` · new: the sign-up code email.
  - `supabase/templates/email_change.html` · new: the new-address code email.
  - `supabase/templates/magic_link.html` · new: the sign-in code email.
  - `supabase/templates/recovery.html` · new: the reset code email.
  - `vitest.config.ts` · middleware.test.ts included.
  - `docs/pull-requests.md` · records: this entry.
- **Verified:** tests first (twelve files); tsc 0 · lint 0 errors · vitest 242 files, 2379 tests green (three designer tests time out at their 5 s limit only under load) · wrangler deploy --dry-run Total Upload 39314.62 KiB (41151.04 KiB before: Clerk’s SDK gone) · the local stack’s secret key proven to drive a sign-in first · every flow in the browser on the local stack (the sign-in page, the helper’s sign-in, Settings, the Account page’s rows, sign-up with the emailed code, sign in by code, the reset, the deletion), the dev host’s lock by curl. Not proven locally: Google’s button, the platform’s User-Agent rule and IP forwarding, an hour-old session’s headers on Workers, Home a cache HIT (testing.paddock-tracker.com before the merge).
- **Review:** a fresh-context Sonnet reviewer (about 150k said, 387,410 measured, 113 tool uses): SOUND WITH FIXES; folded: the Google nonce minted by the route into an httpOnly cookie (the blocking finding), tests for GoogleButton and SignUpForm, the Clerk publishable key out of the preview secrets; left with the reason: no KV cache on the one-function admin list, the provider’s mount effect as its own promise chain, a failed sign-out still reloads, the flags’ last-write-wins. After the review, two more commits: the Worker checks the Turnstile token with Cloudflare’s siteverify itself (Supabase Auth skips the captcha for secret-key requests, proven against prod) and the two public vars in the Worker configs. The switch: the two applies on prod, the secrets, testing deployed and probed, the operator’s word “straight to prod”, the import run again after the deploy (unchanged 18), prod probed (Home a HIT, the sign-in page, the captcha gate, the dev host’s lock).

## #1063 · 1.0.182 · records · opened Fri 25 Sep 01:35 (24 Sep 22:35Z); closed Fri 25 Sep 12:33 as shipped inside #1064’s squash (its two commits were the base of A3’s branch)
**Session 56: PA A2 DONE, the accounts imported; the session-57 handoff with A3 first.** Records only.
- **Readers see:** nothing.
- **Editors get:** nothing.
- **Files (7):**
  - `docs/plan/ledger.json` · A2 DONE: the import run from the session on the operator’s word (18 created on prod’s Supabase Auth, 13 without a password; the rerun unchanged 18; the directory answering BLOG_AUTHOR_ID; account_stats() 18, account_admins() 1); the dated line.
  - `docs/plan/components-programme.md` · re-rendered from the ledger (54 slots).
  - `docs/HANDOFF.md` · the LATEST block: PA A3 first with its decision scan; the State paragraph for A2’s run.
  - `SCHEDULE.md` · step 26; the day’s active time.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio at 1.0.182.
- **Verified:** node docs/plan/render-ledger.mjs → 54 slots; npx vitest run lib/design/plan-ledger.test.ts → 1 file, 6 tests passed.
- **Review:** none; records only.

## #1062 · 1.0.181 · records · opened Fri 25 Sep 00:33 (24 Sep 21:33Z), merged by the operator’s hand
**Session 56: PA A2 on prod and its migration applied, the session-57 handoff with the operator’s import run first.** Records only.
- **Readers see:** nothing.
- **Editors get:** nothing.
- **Files (8):**
  - `docs/plan/ledger.json` · A2’s evidence: the merge of #1061 (21:20:46Z as f79e6330; prod 1.0.180 at 21:24:46Z) and the prod apply of 20260924200000 (rehearsed, applied 21:21:09Z, read back, rerun, account_stats() 0 accounts); the dated line on “merge, apply 20260924200000”; A2 STARTED until the operator’s run.
  - `docs/plan/components-programme.md` · re-rendered from the ledger (54 slots).
  - `docs/pull-requests.md` · #1061’s entry and this one.
  - `docs/HANDOFF.md` · the LATEST block: the operator’s run first (the export, the dry run, --write, the counts), then the directory check for BLOG_AUTHOR_ID, then PA A3; the State paragraph for A2.
  - `SCHEDULE.md` · step 25; the day’s active time.
  - `CHANGELOG.md`, `RELEASES.md`, `package.json` · the trio at 1.0.181.
- **Verified:** node docs/plan/render-ledger.mjs → 54 slots; npx vitest run lib/design/plan-ledger.test.ts → 1 file, 6 tests passed.
- **Review:** none; records only.

## #1061 · 1.0.180 · PA A2 · merged Fri 25 Sep 00:20 (24 Sep 21:20Z)
**The import of Clerk’s accounts into Supabase Auth, ids unchanged; the accounts migration.** The third PR of phase PA: the script the operator runs by hand with their Clerk export, and the migration that gives photos a bucket and the site three functions over auth.users.
- **Readers see:** nothing; nothing runs until the operator runs it.
- **Editors get:** nothing.
- **Files (10):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.180).
  - `RELEASES.md` · the release trio: the public note (1.0.180).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: A2 STARTED with the build’s evidence and the dated line.
  - `package.json` · the release trio: the version bump (1.0.180).
  - `scripts/import-clerk-users.mts` · new: the import (the export parsed by column name, the plan by legacy id then address, the writer through the admin API, counts alone in the output).
  - `scripts/import-clerk-users.test.ts` · new: seven tests (the export, the mapping, the plan, the rerun, the matching, the writer, a redacted failure).
  - `supabase/config.toml` · the local auth and storage services on (the migration needs both).
  - `supabase/migrations/20260924200000_accounts.sql` · new: the avatars bucket and the three service-role functions over auth.users, search_path pinned; on prod 2026-09-24 21:21Z.
  - `vitest.config.ts` · includes scripts/**/*.test.ts.
- **Verified:** seven tests (written before the code; their first run came after it, since vitest did not include scripts/ until this PR). The migration on the local database: the bucket as declared, the functions answering the service role and refusing anon and authenticated, applied twice without error. Gates: tsc 0 · lint 0 errors · vitest 234 files, 2349 tests · wrangler deploy --dry-run Total Upload 41151.04 KiB (the Worker’s code untouched). On prod, on the word "apply 20260924200000": rehearsed inside begin…rollback through the Management API, applied 2026-09-24 21:21:09Z, read back (the bucket, the three functions with search_path pinned, execute for service_role alone), rerun without change, account_stats() answering 0 accounts.
- **Review:** SOUND WITH FIXES, nothing blocking (~150k tokens said, 228,844 measured, 41 tool uses). Folded: the primary address alone (the plan’s pre-mortem), Supabase ids redacted in failures with a test, the revokes in the repo’s form, the parser’s doubled quote tested, the wording of the dry run. Left with the reason: @clerk/backend stays transitive; declaring it re-resolved the lockfile and dropped the @swc/helpers pin of 4 September.

## #1060 · 1.0.179 · records · merged Thu 24 Sep 19:29 (19:29Z)
Records PA A1b's merge (#1059, squash-merged 19:19:09Z as 4ec78ab1): A1 DONE with its evidence, the operator's word to leave the two slow designer tests' limit, the session-57 handoff with A2 first, and the schedule's step 24.
- **Files (8):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.179).
  - `RELEASES.md` · the release trio: the public note (1.0.179).
  - `SCHEDULE.md` · records: step 24.
  - `docs/HANDOFF.md` · records: the LATEST block for session 57 (PA A2 first, its decision scan).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: A1 DONE with A1b's evidence, the dated line with the two words.
  - `docs/pull-requests.md` · records: #1059's entry and this PR's.
  - `package.json` · the release trio: the version bump (1.0.179).
- **Review:** none (records)

## #1059 · 1.0.178 · PA A1b · merged Thu 24 Sep 22:19 (19:19Z)
**The account seam, browser: every browser file reads the signed-in person through lib/auth/client.** The second PR of slot A1 (phase PA): the seam’s browser half in three modules, the 18 browser files and the two layouts moved onto it, so that the switch to Supabase Auth (A3) touches the seam alone.
- **Readers see:** nothing; Clerk stays the provider, and the pages answer as before signed out and signed in.
- **Editors get:** nothing.
- **Files (34):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.178), with the Worker’s growth measured against a clean build of main.
  - `IDEAS.md` · records: the 1571 KiB the seam’s browser half added to the Worker, to be measured again at A3.
  - `RELEASES.md` · the release trio: the public note (1.0.178).
  - `app/(admin)/layout.tsx` · renders `AuthProvider look="console"` where Clerk’s provider was.
  - `app/(app)/layout.tsx` · renders `AuthProvider look="site"` where Clerk’s provider was.
  - `components/AccountIdentity.tsx` · the identity strip and R9’s Sign out row read the seam: `useAccount`, `AccountButton`, `SignInLink`, `SignOutButton`.
  - `components/AccountStaffLinks.tsx` · the staff rows read `account.role`.
  - `components/AppShell.tsx` · the header’s account menu reads `useAccount` (the name, the address, the avatar the provider shows, the role) and the seam’s `SignOutButton`.
  - `components/BottomBar.tsx` · the Account cell’s avatar from `useAccount().avatarUrl`.
  - `components/ContactModal.tsx` · the prefilled address from `account.email`.
  - `components/EnableNotifications.tsx` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `components/NavGating.test.tsx` · the mocks moved to `@/lib/auth/client` and `client-pieces`, the fixtures to account shapes.
  - `components/NotifPrefsSection.tsx` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `components/OnboardingWizard.tsx` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `components/SettingsClient.tsx` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `components/SupportPrompt.tsx` · the opt-out flag read and written through `useAccountFlags`.
  - `components/YourDevices.tsx` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `components/assistant/AssistantWidget.tsx` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `components/authors/WriteForUsForm.tsx` · the application form reads `account.role` and opens sign-in through `SignInLink`.
  - `components/blog/StudioLink.tsx` · the Studio pill reads `canAuthor(account)`.
  - `components/designer/Designer.test.tsx` · the mock moved to `@/lib/auth/client`.
  - `components/page/DeveloperToolbar.test.tsx` · the mock moved to `@/lib/auth/client`, the fixture to an account shape.
  - `components/page/DeveloperToolbar.tsx` · the admin flag from `account.role`.
  - `components/useVisitor.ts` · the browser’s visitor from `visitorFromAccount(account)`.
  - `components/whats-new/WhatsNewModal.tsx` · the dismissed announcement read and written through `useAccountFlags`.
  - `lib/auth/boundary.test.ts` · the allow-list down to four files: the middleware, the sign-in and sign-up pages, the webhook.
  - `lib/auth/client-pieces.tsx` · new: `SignInLink`, `SignOutButton`, `AccountButton` over Clerk’s pieces; the strip, the header and the form import it.
  - `lib/auth/client-provider.tsx` · new: `AuthProvider` over Clerk’s provider with the two layouts’ props and looks; the layouts alone import it.
  - `lib/auth/client.test.tsx` · new: the tests for the mapping (equal to the server’s), the hook’s four states, the flags and the provider’s two looks, written first.
  - `lib/auth/client.tsx` · the hooks (`useAccount`, `useAccountFlags`) and the browser mapping `accountFromBrowserUser` beside the `Account` type; imports Clerk’s `useUser` alone.
  - `lib/design/authz-check.test.ts` · the removed function’s test leaves with it.
  - `lib/design/authz-check.ts` · `visitorFromClerkUser` and `ClerkUserLike` leave; both hosts read `visitorFromAccount`.
  - `lib/useFollowedSeries.ts` · reads `useAccount()` for the two flags where Clerk’s `useAuth` was.
  - `package.json` · the release trio: the version bump (1.0.178).
- **Verified:** tests first, seen red (the seam’s own test), then green; the three client tests re-pointed with account fixtures. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 233 files, 2340 of 2342 tests (the two longest designer tests time out at 5 s on the operator’s machine this evening, on main too; the limit untouched, the question asked) · cf:build exit 0 · wrangler deploy --dry-run Total Upload 41151.08 KiB / gzip 9087.62 KiB (+1571 KiB against a clean build of main, 63.0% of the ceiling: a one-module version cost 2012 KiB, the split into three took 441 KiB back, the rest is Turbopack’s cutting of the server’s shared chunks around a new module many client components import). Browser, local server: signed in, the Account page’s strip, the staff rows and Sign out, the header’s menu and Sign out through the seam (`.playwright-mcp/a1b-settings-signed-in.png`, `a1b-header-menu.png`); signed out, the page gate and Clerk’s modal through `SignInLink` (`a1b-sign-in-modal.png`).
- **Review:** SOUND WITH FIXES, no behaviour change found, nothing blocking (~250k tokens said, 200,689 measured, 34 tool uses). Folded: the count of moved files, a stray bold marker, the toolbar’s stale comment, a blank line. Left: two subscriptions to Clerk’s hook in the prompt and the announcement (negligible).
- **Corrections:** the edits began on `main` before a branch was made (nothing was pushed; moved onto the branch as found).

## #1058 · 1.0.177 · records · merged Thu 24 Sep 14:17 (14:17Z)
Records R9's merge (#1057, squash-merged 14:01:37Z as 64a5c6f5): R9 DONE with its evidence, the session-57 handoff with PA A1b first, and the schedule's step 23.
- **Files (8):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.177).
  - `RELEASES.md` · the release trio: the public note (1.0.177).
  - `SCHEDULE.md` · records: step 23.
  - `docs/HANDOFF.md` · records: the LATEST block for session 57 (PA A1b first, its decision scan and the lesson R9 leaves).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: R9 DONE with its evidence and the dated merge line.
  - `docs/pull-requests.md` · records: #1057's entry and this PR's.
  - `package.json` · the release trio: the version bump (1.0.177).
- **Review:** none (records)

## #1057 · 1.0.176 · R9 · merged Thu 24 Sep 17:01 (14:01Z)
**The Account page’s Sign out row is drawn in the browser; the page answered 500 when signed in.** Found by PA A1a’s signed-in browser run: the page, a Server Component, handed a `<button>` child to Clerk’s `<SignOutButton>`, a Client Component, whose single-child check refused what arrived across the boundary.
- **Readers see:** the Account page opens again when signed in, with its Sign out row at the end of the list.
- **Editors get:** nothing.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.176).
  - `RELEASES.md` · the release trio: the public note (1.0.176).
  - `app/(app)/settings/page.tsx` · renders `<SignOutRow />` inside `{userId && …}`; its Clerk import leaves.
  - `components/AccountIdentity.tsx` · `SignOutRow`: the row’s markup and heatmap id, created in the browser beside the identity strip.
  - `components/NavGating.test.tsx` · the test for the row (its mock renders SignOutButton as its child), written first.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: slot R9 opened and started, the dated line with the operator’s word.
  - `lib/auth/boundary.test.ts` · the allow-list loses the Account page (24 files).
  - `package.json` · the release trio: the version bump (1.0.176).
- **Verified:** tests first, seen red, then green. Gates: tsc 0 · eslint 0 on the changed files · vitest 232 files, 2339 tests · cf:build exit 0 · wrangler deploy --dry-run Total Upload 39579.74 KiB / gzip 8667.44 KiB. Browser, signed in through the helper: /settings 200 with the row (`.playwright-mcp/r9-settings-signed-in.png`); before the fix, 500 on main.
- **Review:** SOUND, nothing to fix (~80k tokens said, 129,313 measured, 37 tool uses): the mechanism traced to React’s and Clerk’s sources; the fix matches the header’s pattern; the markup byte-identical; the allow-list’s one removal load-bearing. Two nits left: the test file’s Clerk mock lacks SignInButton and UserButton (the row uses neither); the test guards the markup, the browser run the boundary.

## #1056 · 1.0.175 · records · merged Thu 24 Sep 13:34 (13:34Z)
Records PA A1a's merge (#1055, squash-merged 13:26:16Z as 21a5c518): A1 STARTED with its evidence, the signed-in run's finding (/settings 500 signed in, proposed as R9), the session-57 handoff and the schedule's step 22.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.175).
  - `RELEASES.md` · the release trio: the public note (1.0.175).
  - `SCHEDULE.md` · records: step 22.
  - `docs/HANDOFF.md` · records: the LATEST block for session 57 (R9 on the word, then A1b).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: A1 STARTED with A1a's evidence and the dated merge line.
  - `docs/pull-requests.md` · records: #1055's entry and this PR's.
  - `package.json` · the release trio: the version bump (1.0.175).
- **Review:** none (records)

## #1055 · 1.0.174 · PA A1a · merged Thu 24 Sep 16:26 (13:26Z)
**The account seam, server: every server file reads the signed-in person through lib/auth.** The first PR of phase PA (the accounts’ move from Clerk to Supabase Auth): a seam of our own in front of Clerk, so that the switch (A3) later touches the seam alone and no caller.
- **Readers see:** nothing; Clerk stays the provider, and the pages answer as before signed out and signed in.
- **Editors get:** nothing.
- **Files (134):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.174).
  - `IDEAS.md` · records: the 331.9 KiB the new shared import added to the Worker, noted not fought.
  - `RELEASES.md` · the release trio: the public note (1.0.174).
  - `app/(admin)/admin/designer/page.tsx` · the greeting takes the first word of the account’s name (Clerk’s first name before).
  - `app/(app)/api/home/bets/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/api/home/social/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/blog/[slug]/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/f1/compare/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/feedback/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/preview/[rev]/page.test.tsx` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/(app)/settings/assistant/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/settings/author/page.tsx` · the suggested author name from the account’s one name.
  - `app/(app)/settings/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/friends/add/[id]/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/friends/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/leagues/[id]/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/leagues/join/[token]/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/leagues/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/threads/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/social/users/[id]/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/(app)/threads/[id]/page.tsx` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/appearance/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/appearance/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/application/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/application/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/assets/[id]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/assets/[id]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/assets/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/assets/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/authz/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/authz/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/authz/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/authz/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/build-options/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/build-options/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/build-options/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/data/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/data/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/data/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/data/runs/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/data/sources/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/data/sources/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/data/sources/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/data/sources/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/debug/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/debug/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/definitions/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/definitions/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/definitions/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/definitions/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/lists/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/lists/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/lists/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/lists/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/pages/[id]/revisions/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/pages/[id]/revisions/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/pages/[id]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/pages/[id]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/pages/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/pages/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/search-hints/[id]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/search-hints/[id]/route.ts` · reads the seam; its local gate typed on the account’s role.
  - `app/api/admin/design/search-hints/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/search-hints/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/settings/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/settings/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/settings/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/shortcuts/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/shortcuts/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/shortcuts/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/shortcuts/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/text/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/text/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/text/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/themes/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/themes/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/themes/default/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/themes/default/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/themes/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/themes/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/views/[key]/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/views/[key]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/admin/design/views/route.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `app/api/admin/design/views/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/assistant/feedback/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/assistant/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/author-request/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/author/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/bet/league/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/bet/market/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/bet/place/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/blog/[id]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/blog/format/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/blog/headings/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/blog/preview/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/blog/reactions/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/blog/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/contact/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/feedback/[id]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/feedback/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/friends/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/push/devices/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/push/inspect/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/push/subscribe/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/push/test/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/push/unsubscribe/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/threads/[id]/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/threads/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/user/mute-series/route.ts` · reads the session’s id through `accountId()` where `const a = await auth()` was.
  - `app/api/user/notif-prefs/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/user/onboarded/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `app/api/user/prefs/route.ts` · reads the seam: `currentAccount()` and `accountId()` where Clerk’s calls were.
  - `components/blog/StudioLink.tsx` · maps Clerk’s browser user to the helper’s shape itself until A1b.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: the operator's order (A1a now, D1 after all phases), a dated line.
  - `lib/admin-guard.ts` · `requireAdmin` and `requireAuthor` read the account; `requireAuthor` returns it.
  - `lib/auth/boundary.test.ts` · the test that no file outside lib/auth and a 25-file allow-list imports @clerk/, and that every allow-listed file still does.
  - `lib/auth/client.tsx` · new: the `Account` type (id, email, name, username, imageUrl, role, donor); A1b adds the provider and the hooks.
  - `lib/auth/directory.ts` · new, server-only: `accountById`, `latestAccounts`, `accountCount`, `adminAccountIds` over Clerk’s Backend API, the id rule at its top.
  - `lib/auth/server.test.ts` · the tests for the mapping and the two reads, written first.
  - `lib/auth/server.ts` · new, server-only: `currentAccount()` and `accountId()` over Clerk, with the one mapping `accountFromClerkUser`.
  - `lib/author-identity.ts` · the byline from `accountById`; the photo gate now the seam’s.
  - `lib/betting/friends.ts` · `clerkDisplayName` became `accountDisplayName`: the name, the username, the address’s local part.
  - `lib/blog-notify.ts` · the admins from `adminAccountIds`, the author’s address from `accountById`; the fail-soft rules kept.
  - `lib/design/authz-check.test.ts` · the tests for `visitorFromAccount`.
  - `lib/design/authz-check.ts` · `visitorFromAccount` beside `visitorFromClerkUser` (the browser’s, until A1b); the ladder read from the role.
  - `lib/design/authz-evaluate.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `lib/design/authz-evaluate.ts` · `currentVisitor` reads the account through the seam.
  - `lib/design/data.test.ts` · the mock moved from clerkClient to the directory.
  - `lib/design/data.ts` · the accounts card from `accountCount` and `latestAccounts`.
  - `lib/design/page-frame.test.ts` · the mock moved to `@/lib/auth/server`, the fixtures to account shapes; no assertion changed.
  - `lib/threads.ts` · the four role helpers (isAdmin, isStaff, canAuthor, hasDonated) take an account’s role and donor.
  - `package.json` · the release trio: the version bump (1.0.174).
- **Verified:** tests first, seen red (the mapping; the boundary with 84 offenders before the move), then green. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 232 files, 2338 tests · cf:build exit 0 · wrangler deploy --dry-run Total Upload 39581.68 KiB / gzip 8667.89 KiB (+331.9 KiB over 1.0.172, the chunk groups re-cut; IDEAS). Signed out on the local server: the pages and the gated routes answer as before. Signed in through the helper, on the word "helper go": the header’s account menu, /studio and /admin/designer as before (`.playwright-mcp/a1a-header-menu.png`, `a1a-designer.png`).
- **Review:** SOUND WITH FIXES, nothing blocking (~250k tokens said, 222,762 measured, 65 tool uses). Its one should-fix, stated in the record: the server’s visitor carries the account’s one address where Clerk’s user carried every address (fail-closed; prod holds four schemes, none of type email_domain). Its nit, the greeting’s first word, disclosed.
- **Finding, outside the PR:** /settings answers 500 when signed in, on main as on the branch: the Server Component hands a `<button>` child to Clerk’s `<SignOutButton>` and Clerk’s single-child check refuses what arrives across the boundary; signed out 200. Proposed as R9.

## #1053 · 1.0.172 · P2.4 PR C · merged Thu 24 Sep 15:07 (12:07Z)
**Master-detail: a region's rows filter another region through the address.** The third of P2.4's three PRs: a Data region's rows can filter
another Data region of the page, each row carrying a Show link that writes its value into the paired region's filter in the address, so the
page stays a cached variant and the choice can be shared.
- **Readers see:** nothing until a designer sets a Master Detail region and key; where set, each row of the master carries a Show link that
  narrows the paired region, the choice riding in the page's address so it can be shared.
- **Editors get:** a Master Detail group (Detail region, Detail key) on Data regions, drawn while the View is Table, Cards or List; the
  Property Editor lists the page's other Data regions to pick as the detail, None first.
- **Files (15):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.172).
  - `IDEAS.md` · records: the branch-rename finding (the push guard refuses "master" as a branch-name word).
  - `RELEASES.md` · the release trio: the public note (1.0.172).
  - `components/data/DataRegionViews.tsx` · `MasterSelect` and `DetailShowing`: the Show link on each Table, Cards and List row, and the "Showing <value> · Show all" line above a detail's rows.
  - `components/designer/PageDesigner.test.tsx` · the tests for the designer's Detail region and Detail key selects and the tile's words.
  - `components/designer/PageDesignerProperties.tsx` · the Detail region select (the page's other Data regions, None first) and the Detail key select.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.4 PR C's evidence and the dated merge line.
  - `lib/design/component-render.test.tsx` · the tests for the master/detail pairing, the address filter and line, and the audit's template-pairing fix.
  - `lib/design/component-render.tsx` · `renderComponents` pairs each master with its detail, threading the address's filter while keeping the detail's own sort, columns and view.
  - `lib/design/components.test.ts` · the tests for the Master Detail group and its two attributes.
  - `lib/design/components.ts` · the group Master Detail (seq 50), `detailRegion` (the new `optionsFrom: 'regions'`) and `detailKey`.
  - `lib/design/page-document.test.ts` · the tests for the parser's refusals and the master's own column rule.
  - `lib/design/page-document.ts` · the document-wide check: a Detail region must be another Data region drawn as Table, Cards or List, its key a column both shapes carry.
  - `package.json` · the release trio: the version bump (1.0.172).
- **Verified:** tests first, 5 failed across 4 files, then passed. Gates after the fixes: tsc 0 · lint 0 errors (2 known warnings) · vitest 230
  files, 2333 tests · cf:build exit 0 · wrangler deploy --dry-run Total Upload 39249.78 KiB / gzip 8580.90 KiB. Browser, local server over the
  local database: two results regions added to the Monza fixture with psql (restored after); the season list draws 14 Show links, "Show 3"
  narrows the race table to round 3 under "Showing 3 · Show all", and Show all or the variant address loaded directly draw the same.
- **Review:** SOUND WITH FIXES, nothing blocking (~200k tokens said, 244,062 measured, 27 tool uses). Folded: a Show value over the
  vocabulary's 80-character cap gets no link instead of a silently dropped filter; a detail must be drawn as Table, Cards or List; two masters
  on one detail each keep their own Showing line; the chosen row's `aria-current` matches the detail's own column test. Its nit that a bad
  master key would report twice proved false. The day's audit afterward found one more gap (a master drawn as a template still keyed its
  detail), folded in a third commit.
- **Corrections:** the plan's browser run named a "Weekends (Season)" master, but the Weekends source reads coming weekends only; the season
  list is the results List's per-race folds instead, which meets the slot's acceptance.

## #1052 · 1.0.171 · records · merged Thu 24 Sep 13:39 (10:39Z)
Records P2.4 PR B's merge (#1051, squash-merged 10:32:22Z as 48b1f5cf): the ledger's evidence and dated line, the handoff's LATEST block and session-57 prompt putting PR C first, and the schedule's step 20.
- **Files (7):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.171).
  - `RELEASES.md` · the release trio: the public note (1.0.171).
  - `SCHEDULE.md` · records: step 20.
  - `docs/HANDOFF.md` · records: the LATEST block and the session-57 prompt, PR C first.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.4 PR B's evidence and the dated merge line.
  - `package.json` · the release trio: the version bump (1.0.171).
- **Review:** none (records)

## #1051 · 1.0.170 · P2.4 PR B · merged Thu 24 Sep 13:32 (10:32Z)
**Links from the readers: a driver's or a team's name opens its page.** The second of P2.4's three PRs: a driver's or a team's name in a Data
region now links to its page on the site, computed by the site's own resolver (an exact name first, else its drift rule), never a typed
pattern; a row without a page draws exactly as before.
- **Readers see:** a driver's or a team's name in a Table, Cards or List Data region now opens that driver's or team's page on Paddock; a
  downloaded CSV carries the page's address beside the name.
- **Editors get:** every standings and results row carries its driver's, team's or constructor's page (null for a co-driver, a manufacturer or
  a car's crew); the Cards' zones offer "Driver → its page" at once on the shapes that carry one.
- **Files (25):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.170).
  - `IDEAS.md` · records: a module of its own for the people index (proposed, not built), and one fix for the card-slot pickers' link-zone label.
  - `RELEASES.md` · the release trio: the public note (1.0.170).
  - `app/(app)/f1/compare/page.tsx` · imports `namesMatch` from its new home, `lib/slug.ts`, instead of `lib/profile-stats.ts`.
  - `app/(app)/teams/[slug]/page.tsx` · the same import update as the compare page.
  - `app/api/data/csv/route.test.ts` · the tests for the CSV's text and address columns.
  - `app/api/data/csv/route.ts` · a link column now writes its text and, beside it, a "<Label> address" column (before it wrote the address alone).
  - `components/data/DataRegionViews.tsx` · a results `driver` link keeps the cell's look as text (the plan's "a link keeps the name's class" held for `name` only).
  - `components/designer/DataSourcesEditor.test.tsx` · the test for the standings source's column count (thirteen, with `profile`).
  - `components/designer/PageDesigner.test.tsx` · the tests for a standings card following the driver's page and the zone select offering it.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.4 PR B's evidence and the dated merge line.
  - `lib/design/component-render.test.tsx` · the tests for the Table's name link and the results driver's cell.
  - `lib/design/page-document.test.ts` · the tests for the parser binding a link column.
  - `lib/design/presets.test.ts` · the tests for `driver-rows`/`team-rows`/`race-rows`/`podium-rows` naming `name` or `driver` a link, crews staying text.
  - `lib/design/presets.ts` · `name` (driver-rows, team-rows) and `driver` (race-rows, podium-rows) become links over `profile`; car and cup crews stay text.
  - `lib/design/source-read.test.ts` · the tests for `withProfiles` over F1's drivers and constructor, and null for WRC's co-driver and IMSA's crews.
  - `lib/design/source-read.ts` · `withProfiles` adds `profile` to every standings and results row, null where the rosters are never asked or cannot load.
  - `lib/design/sources.test.ts` · the tests for the standings and results sources' new `profile` column.
  - `lib/design/sources.ts` · the standings and results sources declare `profile` ("Page", link) and read `content:series`.
  - `lib/people.test.ts` · the tests for the index, over fixtures and the real rosters.
  - `lib/people.ts` · `buildPeopleIndex` and `peopleIndex()`: a driver's or team's page by the site's drift rule, built once per process.
  - `lib/profile-stats.ts` · `namesMatch` moves out to `lib/slug.ts` (importing it here pulled this module into every server chunk carrying `lib/people.ts`).
  - `lib/slug.ts` · `namesMatch` moved here verbatim from `lib/profile-stats.ts`.
  - `package.json` · the release trio: the version bump (1.0.170).
- **Verified:** tests first, 13 failed across 6 files, then passed (three older tests now assert the new behaviour, each keeping its refusal
  case). Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 230 files, 2328 tests · cf:build exit 0 · wrangler deploy --dry-run Total
  Upload 39226.67 KiB / gzip 8576.12 KiB (66.8 KiB over 1.0.168, the index riding in each of fifteen server chunks). Browser, local server over
  the local database: `/history/monza`'s Drivers table draws its ten names as links, Andrea Kimi Antonelli's opens `/drivers/kimi-antonelli`;
  switched to Cards with Full Card on "Driver → its page", George Russell's card opens his page; the CSV reads `Pos,Driver,Driver address,...`
  with the address beside Antonelli's name.
- **Review:** PASS WITH NOTES, nothing blocking and nothing to fix (~200k tokens said, 247,625 measured, 67 tool uses). It recounted the 19
  shared team slugs against the real content and traced every standings/results path through `withProfiles`, finding no address built from
  upstream text. Its one nit is left, with the reason: the Property Editor names a link zone by the shape's own label, as the card-slot
  pickers already do; one fix for both is proposed in IDEAS.
- **Corrections:** the plan said a link keeps the name's class; that held for `name` only, not the results `driver` cell, fixed in
  `DataRegionViews.tsx`.

## #1050 · 1.0.169 · records · merged Thu 24 Sep 12:32 (09:32Z)
Records P2.4 PR A's merge (#1049, squash-merged 09:23:44Z as 2daa14fc): the ledger's evidence and dated line, the handoff's LATEST block and session-57 prompt putting PR B first, and the schedule's step 19.
- **Files (7):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.169).
  - `RELEASES.md` · the release trio: the public note (1.0.169).
  - `SCHEDULE.md` · records: step 19.
  - `docs/HANDOFF.md` · records: the LATEST block and the session-57 prompt, PR B first.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.4 PR A's evidence and the dated merge line.
  - `package.json` · the release trio: the version bump (1.0.169).
- **Review:** none (records)

## #1049 · 1.0.168 · P2.4 PR A · merged Thu 24 Sep 12:23 (09:23Z)
**Highlight rules: three row conditions with a style each, the followed-series tint.** The first of P2.4's three PRs (APEX: an Interactive
Report's Highlight): a Data region gains a Highlight group of three condition-and-style rules plus a Followed series toggle that tints the
reader's own followed rows after the page loads.
- **Readers see:** nothing from this PR alone; every rule slot ships empty and the Followed series toggle off.
- **Editors get:** the Highlight group (`highlight1`-`highlight3`, a condition each in the address's vocabulary; a style each,
  Brand/Emphasis/Muted; Followed series) on Data regions, drawn while the View is Table, Cards or List; the Property Editor flags a rule that
  will not read as it is typed.
- **Files (24):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.168).
  - `IDEAS.md` · records: proposes a backup job and marks an old "not in the plan" note as history (phase PA's plan, folded into this branch).
  - `RELEASES.md` · the release trio: the public note (1.0.168).
  - `SCHEDULE.md` · records: steps 17 and 18 (this slot and phase PA's planning, both folded into this branch).
  - `app/globals.css` · the `data-followed` tint (the brand paint at low alpha; adds, never removes).
  - `components/data/DataRegionViews.tsx` · styles the first rule a row meets on the Table's row, the Cards' card and both List paths, joining classes without a trailing space; today's markup byte for byte with no rule.
  - `components/data/FollowedRows.test.tsx` · the tests for marking the reader's followed rows, and nothing for "follow everything".
  - `components/data/FollowedRows.tsx` · new, client: after the page loads, reads the reader's followed series and marks the matching rows `data-followed`.
  - `components/designer/PageDesigner.test.tsx` · the tests for the Property Editor's live rule note and the tile.
  - `components/designer/PageDesignerProperties.tsx` · a rule that will not read gets a live note as it is typed.
  - `docs/HANDOFF.md` · records: the handoff's agenda names phase PA's order (folded into this branch).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger, plus phase PA's four new slots.
  - `docs/plan/ledger.json` · records: P2.4 PR A's evidence and dated line, plus the operator's approved plan for phase PA (Clerk to Supabase Auth, slots A1 to A4).
  - `lib/design/component-render.test.tsx` · the tests for the round-grouped results' own highlight case and the resolved rules on the view props.
  - `lib/design/component-render.tsx` · resolves the region's rules once per render onto `highlight` on the view props.
  - `lib/design/components.test.ts` · the tests for the Highlight group and its seven attributes.
  - `lib/design/components.ts` · the group Highlight (seq 40): three rule/style pairs and Followed series.
  - `lib/design/page-document.test.ts` · the tests for a rule bound to the preset's shape.
  - `lib/design/page-document.ts` · binds a rule to the preset's shape as it binds a filter, refusing a column the shape lacks.
  - `lib/design/presets.test.ts` · the tests for `rowPasses`, the typed row test the filters already used.
  - `lib/design/presets.ts` · exports `rowPasses`.
  - `lib/design/view-state.test.ts` · the tests for `parseRule`.
  - `lib/design/view-state.ts` · exports `parseRule` (the vocabulary's one-condition reader, private until now).
  - `package.json` · the release trio: the version bump (1.0.168).
- **Verified:** tests first, seen red: 7 across 7 files, then green. Gates after the reviewer's fixes: tsc 0 · lint 0 errors (2 known
  warnings) · vitest 230 files, 2323 tests · cf:build exit 0 · wrangler deploy --dry-run Total Upload 39159.86 KiB / gzip 8557.34 KiB. Browser,
  local server over the local database (rules set on the Monza fixture with psql): `/history/monza` draws the leader row in the brand tint
  and rows 2-3 raised; with Formula 1 followed in the browser and the page reloaded, the three rows are marked `data-followed` and tinted
  (`.playwright-mcp/p24a-monza-highlight.png`).
- **Review:** SOUND WITH FIXES, nothing blocking (~120k tokens said, 227,972 measured, 55 tool uses). Folded: the results' round groups gained
  their own highlight test, proven non-vacuous by removing the highlight on purpose; the browser line now says how Formula 1 came to be
  followed (a leftover local Clerk session; nothing written to any KV); the Property Editor's rule note moved below the imports and names the
  preset's columns; the Followed series help says rows without a series stay as they are. Left, with the reason: a rule's 120-character cap
  sits well under the vocabulary's longest possible condition.

## #1048 · 1.0.167 · records · merged Thu 24 Sep 09:29 (06:29Z)
Records P2.3 DONE (the saved_view migration applied on prod) and P2.4's decision scan answered.
- **Files (7):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.167).
  - `RELEASES.md` · the release trio: the public note (1.0.167).
  - `SCHEDULE.md` · records: step 16.
  - `docs/HANDOFF.md` · records: the session-57 prompt, P2.4's plan in plan mode with a Sonnet critic as the first task.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: **P2.3 DONE** (the `saved_view` migration applied on prod 2026-09-24T06:25:34Z on the word
    "apply 20260923220000", rehearsed first inside begin...rollback), and P2.4's decision scan answered (master-detail through the address;
    leader and podium highlight rules on the server, followed series as a client repaint; driver and team links from the readers).
  - `package.json` · the release trio: the version bump (1.0.167).
- **Review:** none (records)

## #1047 · 1.0.166 · records · merged Thu 24 Sep 01:25 (22:25Z)
Records P2.3 PR B's merge (#1046, squash-merged 22:17:00Z as f2f2fe79): the ledger's evidence, the slot staying STARTED until the migration
is applied on prod, and the session-57 handoff prompt.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.166).
  - `IDEAS.md` · records: three Inbox lines from PR B's run.
  - `RELEASES.md` · the release trio: the public note (1.0.166).
  - `SCHEDULE.md` · records: step 15.
  - `docs/HANDOFF.md` · records: the session-57 prompt (the prod migration apply first, then P2.4's decision scan and plan).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.3 PR B's evidence and the dated merge line; the slot stays STARTED until the migration applies on prod.
  - `package.json` · the release trio: the version bump (1.0.166).
- **Review:** none (records)

## #1046 · 1.0.165 · P2.3 PR B · merged Thu 24 Sep 01:17 (22:17Z)
**Saved views, the Views menu and Download CSV.** The second half of P2.3 (APEX: the Interactive Report's saved reports and Download): a
saved view is a named Alternative of one Data region's state (sort, columns, filter); readers pick one from a Views menu and share it by
link, and Download CSV gives the rows as shown.
- **Readers see:** nothing from this PR alone; the two toggles (Saved views, Download CSV) are off by default, and no view exists until a
  designer saves one.
- **Editors get:** a Views menu and a Download CSV link under Actions Menu, off by default; a new Shared Components › Saved Views editor
  (create, edit and delete named views, each with its own History and Utilization by page and region).
- **Files (30):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.165).
  - `RELEASES.md` · the release trio: the public note (1.0.165).
  - `app/api/admin/design/views/[key]/route.test.ts` · the tests for the one-view route (GET/PUT/DELETE, the shortcuts' refusal pattern).
  - `app/api/admin/design/views/[key]/route.ts` · new: PUT and DELETE for one saved view, bound to the page's live region.
  - `app/api/admin/design/views/route.test.ts` · the tests for the views-and-targets list route.
  - `app/api/admin/design/views/route.ts` · new: GET (the views and their targets) and POST (create), the shortcuts' pattern.
  - `app/api/data/csv/route.test.ts` · the tests for the CSV route's 404s, text and headers, a saved view applied, the row cap, the scheme refusal.
  - `app/api/data/csv/route.ts` · new, public GET: the rows as shown, from the source, RFC 4180 with a byte-order mark and CRLF, at most 5000
    rows, `no-store`.
  - `components/data/DataRegionControls.tsx` · the Views menu and the Download CSV link added to the Actions menu control built in PR A.
  - `components/data/DataRegionViews.tsx` · wires the Views menu and Download CSV control into the region views.
  - `components/designer/Designer.tsx` · fetches the saved views and their targets when the designer opens, and wires the new Saved Views
    editor into Shared Components.
  - `components/designer/PageDesigner.test.tsx` · the test for the Actions Menu group's new Saved Views row.
  - `components/designer/PageDesignerProperties.tsx` · a Data region's Actions Menu group gains a "Saved views" row pointing to Shared Components.
  - `components/designer/ViewsEditor.test.tsx` · the tests for the Saved Views editor.
  - `components/designer/ViewsEditor.tsx` · new: the Saved Views table (key, name, page, region, the definition validated live), History and
    Utilization per row.
  - `components/designer/catalogue.test.ts` · the test for seventeen shared-component editors.
  - `components/designer/catalogue.ts` · the catalogue entry `views`.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.3 PR B's evidence and the dated merge line.
  - `lib/design/component-render.test.tsx` · the tests for `?view=` resolution and override, the Views menu, the Download link, nothing read while off.
  - `lib/design/component-render.tsx` · resolves `?view=<key>` under the address's own parameters, draws the Views menu and Download link.
  - `lib/design/components.test.ts` · the tests for the two new Actions Menu attributes.
  - `lib/design/components.ts` · *Saved views* and *Download CSV* added under Actions Menu, off by default.
  - `lib/design/definitions.ts` · `PageLatest`, `latestRevisions` and `readUsageRows` exported (were private) so `views.ts` can reuse the
    Utilization scan.
  - `lib/design/view-state.test.ts` · the tests for the key and name rules, the stored definition, the override.
  - `lib/design/view-state.ts` · the key/name rules, `parseViewDefinition`, `definitionOf`, `applySavedView`.
  - `lib/design/views.test.ts` · the tests for the rows, the memo, the targets scan, the shape.
  - `lib/design/views.ts` · new: the loaders, the targets scan (pages with Data regions), the live region's shape a definition binds to.
  - `package.json` · the release trio: the version bump (1.0.165).
  - `supabase/migrations/20260923220000_saved_views.sql` · new: the `saved_view` table, in the shape of the other design tables, applied
    locally; prod waits for an explicit "apply".
- **Verified:** tests first across nine files, then green. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 229 files, 2315 tests
  (2316 after the reviewer's fixes) · wrangler deploy --dry-run Total Upload 39160.25 KiB / gzip 8561.04 KiB (PR A: 39442.76 KiB). Browser,
  local server over the local database: the view "top-five" seeded and Monza Drivers' two toggles turned on with psql; the Monza page with
  `?view=top-five` draws the Views menu with "Top five" marked, the table sorted by points with the view's two columns, and the Download CSV
  link; the CSV route answers `text/csv`, `no-store`, with a byte-order mark and the sorted rows (`.playwright-mcp/p23b-monza-view-top-five.png`).
- **Review:** SOUND WITH FIXES, no blockers (~120k tokens said, 262,957 measured). Three should-fix items taken in a second commit: the CSV
  route now applies the page's conditions and Build Options as the served page does; a region with only Saved views or only Download CSV on
  counts as a region with controls; the migration wrapped in begin/commit as the other design-table migrations are. Two nits taken: the row
  route reads the region's shape once and DELETE refuses an unknown key; the Actions menu help no longer says the download comes later. Two
  declined, with the reason: no spreadsheet-formula prefixing on CSV cells (the site's own data, never a reader's); `seq` has no editor
  control yet (a default for a later slot).

## #1045 · 1.0.164 · records · merged Thu 24 Sep 00:11 (21:11Z)
Records P2.3 PR A's merge (#1044, squash-merged 20:59:37Z as a42c6dd1): the ledger's evidence, two honestly-recorded gaps (Home's parity void
by the operator's own publishes; the cached-variant check unverified on prod), and the session-57 handoff prompt.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.164).
  - `IDEAS.md` · records: three Inbox lines (prod's Calendar renders per request; the preview draws no controls; the reviewer's two nits).
  - `RELEASES.md` · the release trio: the public note (1.0.164).
  - `SCHEDULE.md` · records: step 14.
  - `docs/HANDOFF.md` · records: the session-57 prompt (PR B on the approved plan; two landmines: the catch-all's percent-encoded segment, a
    build beside the dev server corrupting `.next/dev/types`).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.3's evidence so far and the merge's dated line; the slot stays STARTED until PR B.
  - `package.json` · the release trio: the version bump (1.0.164).
- **Review:** none (records)

## #1044 · 1.0.163 · P2.3 PR A · merged Wed 23 Sep 23:59 (20:59Z)
**The URL vocabulary, the cached variant and the table's controls.** The first half of P2.3 (APEX: the Interactive Report): a
sort/columns/filter/view vocabulary in the query string, served from a cached variant address so the plain page stays shareable and
cacheable, plus sortable column headings and an Actions menu on Data regions.
- **Readers see:** nothing from this PR alone; every control is off until a designer turns it on.
- **Editors get:** an Actions Menu group (Sortable headings, Actions menu) on Data regions, drawn while the View is Table or Cards.
- **Files (20):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.163).
  - `RELEASES.md` · the release trio: the public note (1.0.163).
  - `app/(app)/[...catchall]/page.test.tsx` · the tests for the variant decode, the canonical and noindex, a junk segment.
  - `app/(app)/[...catchall]/page.tsx` · `addressOf` splits and decodes the `__view` segment, serving the plain address's page with the
    state; a variant is `noindex, follow` with the plain path as its canonical.
  - `components/data/DataRegionControls.tsx` · new: sortable headings as links with `aria-sort`; the Actions menu as a `<details>` (Select
    Columns, Sort by, Reset), no client JavaScript.
  - `components/data/DataRegionViews.tsx` · draws the sortable headings and the Actions menu control on the Table and Cards views.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.3 PR A's evidence and the dated line; the slot STARTED (PR B follows).
  - `lib/design/component-render.test.tsx` · the tests for `href`/`view`/`controlsKey`, byte parity with the toggles off, the sorted table,
    Select Columns, two regions under `r.<id>.`.
  - `lib/design/component-render.tsx` · `RenderPage` gains `href`, `view` and a per-region `controlsKey` (null where no state can arrive, for
    instance a framed code route).
  - `lib/design/components.test.ts` · the tests for the Actions Menu group and its two attributes.
  - `lib/design/components.ts` · the group Actions Menu (Sortable headings, Actions menu), booleans off by default.
  - `lib/design/page-document.test.ts` · the test for the reserved `/__view` prefix.
  - `lib/design/page-document.ts` · `/__view` joins `RESERVED_PREFIXES`.
  - `lib/design/presets.test.ts` · the tests for the typed filters, the sort with ties, the count, the results-shape flat sort.
  - `lib/design/presets.ts` · `presetRows(rows, preset, count, state?)` applies the filters and the sort (nulls last, ties in the preset's
    order) before the count.
  - `lib/design/view-state.test.ts` · the tests for the vocabulary's parse, bind, canonical encode, hrefs, the rewrite rule, the segment's
    round trip.
  - `lib/design/view-state.ts` · new: the vocabulary (`sort`, `cols`, `filter`, `view`), `parseViewState`, `bindViewState`,
    `encodeViewState`, `viewStateHref`/`sortHref`, and the middleware's `rewriteTarget`.
  - `middleware.ts` · after the dev-host block, a page carrying a state is rewritten to its cached variant `/__view/<segment>/<path>`; the
    address bar keeps the plain form.
  - `package.json` · the release trio: the version bump (1.0.163).
- **Verified:** tests first, seen red: 8 across 6 files plus the missing module, then green; byte parity with the toggles off asserted
  against today's markup. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 224 files, 2292 tests · the ledger test 6/6 · cf:build exit
  0, 1189 pages · wrangler deploy --dry-run Total Upload 39442.76 KiB / gzip 8656.59 KiB (R7: 39411.02 KiB). Browser, local designer and
  served page (`PADDOCK_ENV=production`): the Actions Menu group turned on for a Monza Drivers table; `/history/monza` draws every heading
  as a link, Pts → `?sort=points` sorts the table with `aria-sort`; the Actions menu's Select Columns applies `?sort=-points&cols=...` with
  six columns (`.playwright-mcp/p23a-monza-sorted-actions.png`, `p23a-monza-cols.png`); `/?sort=points` (Home, a code route) untouched.
- **Review:** SOUND WITH FIXES, no blockers (~100k tokens said, 236,555 measured). Two should-fix items taken in a second commit: `cols` is
  written in one order whatever the address said (the shape's order, so two orders were two cache variants for one table); a cap on what one
  address may mint into the cache (at most 24 columns, 6 regions, a 1024-character canonical string, else the plain page serves). Two nits
  left as they are: the filter loop parses past the fourth before dropping; no integration test proves the segment survives the Worker's
  routing (the browser run and the deploy check stand for it).
- **Corrections:** the variant segment is base64url, not the plan's percent-escaped form: Next 16 hands a catch-all segment
  percent-encoded (a literal "=" arrived as "%3D"), so no escaped form could be decoded safely; an alphabet no router touches is.

## #1043 · 1.0.162 · records · merged Wed 23 Sep 21:01 (18:01Z)
Records R8's merge (#1042, squash-merged 17:50:58Z as 20b1eae7) and a correction to 1.0.161's release note.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.162).
  - `IDEAS.md` · records: four Inbox lines.
  - `RELEASES.md` · the release trio: the public note (1.0.162), correcting 1.0.161's "nothing changes on the pages you read today".
  - `SCHEDULE.md` · records: step 13.
  - `docs/HANDOFF.md` · records: the session-57 prompt (PR A on `feat/p2.3-a-view-state`; two landmines: corrupted `.next/dev/types`, the
    Bash tool's ~8 KB command cap).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: R8 DONE with its evidence and the merge's dated line.
  - `package.json` · the release trio: the version bump (1.0.162).
- **Review:** none (records)

## #1042 · 1.0.161 · R8 · merged Wed 23 Sep 20:50 (17:50Z)
**A Data region follows its Source's series: the Latest result box leads, What's next names the series.** Two quick fixes on the operator's
reports: the Latest result preset moves to the head of the results presets, so a Data region switched to Results draws that championship's
last-result box by itself instead of landing on a season list; the Coming weekends template now names the Source's series in its corner
instead of always reading "All series".
- **Readers see:** yes, on Home: the two What's next boxes set to Formula 1 and Formula 2 now name them in the corner instead of "All series".
- **Editors get:** a Data region whose Type becomes Results opens on the Latest result preset by default; the Coming weekends template reads
  the Source's own series name.
- **Files (12):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.161).
  - `RELEASES.md` · the release trio: the public note (1.0.161).
  - `components/data/DataRegionViews.tsx` · the Coming weekends rule reads the series' name from the rows a named Source read, "All series"
    only for a Source across every series.
  - `components/designer/PageDesigner.test.tsx` · the tests for the Type change to Results and the Coming weekends render naming its series.
  - `components/designer/page-designer-model.test.ts` · the test for `withSourceChanged` landing on latest-result/podium/rows 3.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: slot R8's evidence and the dated line with the operator's words.
  - `lib/design/component-render.test.tsx` · the test for the Coming weekends render over a named Source.
  - `lib/design/component-render.tsx` · `DataRegionViewProps` gains `series` (the Source's `series` parameter, handed to the view).
  - `lib/design/presets.test.ts` · the test for the catalogue's preset order (f1/f2/wec/nls).
  - `lib/design/presets.ts` · the Latest result preset moves to the head of the results presets.
  - `package.json` · the release trio: the version bump (1.0.161).
- **Verified:** tests first, seen red: 4 across 4 files, then green (two order-dependent assertions followed). Gates: tsc 0 · lint 0 errors
  (2 known warnings) · vitest 223 files, 2279 tests · the ledger test 6/6. Browser, local designer on Monza (`PADDOCK_ENV=production`): Type
  → Results + Series Formula 2 reads "Results · Formula 2 · 2026 · Preset Latest result · View Latest result · Rows 3", Messages 0; a
  Weekends region + Series Formula 1 reads "... Preset What's next · View What's next ..."; the saved draft's preview drew the F2 box (round
  11, the Spain Feature Race) and the What's next rule reading "Formula 1".
- **Review:** SOUND, nothing blocking (~60k tokens said, 195,217 measured); its one nit, the slug fallback on the Coming weekends rule being unreachable while the weekends reader names every row, left as is. Recorded in 1.0.162 and the ledger, not in the PR body.

## #1041 · 1.0.160 · records · merged Wed 23 Sep 20:02 (17:02Z)
Records R7's merge (#1040, squash-merged 16:53:19Z as 57b9d3d2) and P2.3's decision scan and plan approval.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.160).
  - `IDEAS.md` · records: four Inbox lines.
  - `RELEASES.md` · the release trio: the public note (1.0.160).
  - `SCHEDULE.md` · records: the afternoon's steps.
  - `docs/HANDOFF.md` · records: the LATEST header and the session-57 prompt (PR A on the approved P2.3 plan), the state and two landmines.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: R7 DONE with its evidence and the dated merge line; P2.3's decision scan (four words) and plan approval.
  - `package.json` · the release trio: the version bump (1.0.160).
- **Review:** none (records)

## #1040 · 1.0.159 · R7 · merged Wed 23 Sep 19:53 (16:53Z)
**A change of Source picks the first preset it offers.** A quick fix: changing a Data region's Source (its Type or Series) now moves a
preset or template view the new Source does not offer to the first it does, with what that pick brings (view, rows, card slots and zones),
exactly as picking it by hand does, instead of blocking Save with a refused-binding message.
- **Readers see:** nothing (a designer-only fix).
- **Editors get:** `withSourceChanged` runs on every Type or Series change in the Property Editor; the parser's binding-refusal messages now
  name the setting ("Preset X is for a Y source; this region reads Z").
- **Files (11):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.159).
  - `RELEASES.md` · the release trio: the public note (1.0.159).
  - `components/designer/PageDesigner.test.tsx` · the tests for the Type change to Results and to Posts picking the first preset with no
    Messages.
  - `components/designer/PageDesignerProperties.tsx` · `setSource` now calls `withSourceChanged` for the Type select and every parameter's change.
  - `components/designer/page-designer-model.test.ts` · the tests for `withSourceChanged`'s rule across Standings, Results and the Live band.
  - `components/designer/page-designer-model.ts` · `withSourceChanged(region, next, spec)`, pure: moves an unsupported preset or view to
    the new Source's first offering.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: slot R7's evidence and the dated line with the operator's word.
  - `lib/design/page-document.test.ts` · the tests for the parser's thirteen message strings naming the setting.
  - `lib/design/page-document.ts` · the two binding-refusal messages now name the setting ("Preset ... is for a ... source").
  - `package.json` · the release trio: the version bump (1.0.159).
- **Verified:** tests first, seen red: 6 across 3 files, then green (the P2.2 designer test's "stored preset stays visible" step changes on
  purpose: the Source change now picks for you). Gates after the reviewer's fixes: tsc 0 · lint 0 errors (2 known warnings) · vitest 223
  files, 2279 tests (a first run beside the foreground build timed one test out at 5s) · hooks 31/31 · cf:build exit 0, 1189 pages (439s
  beside the suite) · wrangler deploy --dry-run Total Upload 39411.02 KiB / gzip 8625.26 KiB (PR C: 39409.56 KiB).
- **Review:** PASS WITH NOTES, nothing blocking (~120k tokens said, 202,161 measured, 38 tool uses). Its two notes taken in the second
  commit: a DOM-level test for a Series change with a preset the new series does not offer; the redundant manual pick removed from the Posts
  step, and a no-op `?? null` dropped. Two nits noted, not taken: the "later" refusal message stays unprefixed, unreachable today; the
  Attributes tab's own note keeps its per-option words.

## #1039 · 1.0.158 · records · merged Wed 23 Sep 17:53 (14:53Z)
Records P2.24 PR C's merge (#1038, squash-merged 14:38:30Z as d340c4c1), P2.24 DONE, and the parity script's two normaliser rules learned
from the deploy.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.158).
  - `IDEAS.md` · records: ten Inbox lines.
  - `RELEASES.md` · the release trio: the public note (1.0.158, internal only).
  - `SCHEDULE.md` · records: the session block.
  - `docs/HANDOFF.md` · records: the LATEST header and the session-57 prompt (P2.3 first, then P2.4), the state, this run's landmines.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24 DONE with PR C's evidence and the dated merge line.
  - `package.json` · the release trio: the version bump (1.0.158).
  - `scripts/parity-home.mts` · two normaliser rules learned from the deploy (the countdowns' big clock by its own typography, an empty
    class attribute); prod's before/after captures now read `identical: 7 regions`.
- **Review:** none (records)

## #1038 · 1.0.157 · P2.24 C · merged Wed 23 Sep 17:38 (14:38Z)
**The flip: a stored Home component upgrades on read, the six retire.** The third of P2.24's PRs: prod's Home is served from the operator's
own split document naming six Home-only components (`home.lead`, `home.live`, `home.result`, `home.changed`, `home.next`, `home.wire`).
This PR retires the six from the catalogue without touching that document: the parser upgrades a stored region naming one to its Data-region
or Live-band equivalent the moment it is read, so the served page, the preview, the designer and the next Save all agree.
- **Readers see:** nothing; the parity script proved prod's Home identical across the deploy (7 regions).
- **Editors get:** Home's designer view now shows 5 Data regions and a Live band instead of six special-purpose pieces; the Gallery has no
  Home group; a Data region's Series select offers "Home's series" (Results) or "Latest result" (Standings) first.
- **Files (34):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.157).
  - `RELEASES.md` · the release trio: the public note (1.0.157).
  - `app/api/admin/design/data/sources/route.test.ts` · the test fixture's stored region updated from `home.changed` to its `data.region`
    upgrade form.
  - `app/api/admin/design/settings/[key]/route.test.ts` · the tests swap the retired `home.wire_count`/`home.blog_suggested_count` keys for
    surviving ones (`home.lead_series`, `region.button.label`).
  - `components/designer/PageDesigner.test.tsx` · the Home-component tests removed; the Card-slots test's fixed wait replaced by a poll.
  - `components/designer/PluginsEditor.test.tsx` · the What it changed row now asserted by its key, not its retired name; nine catalogue rows.
  - `components/designer/page-designer-model.test.ts` · the tests for `splitRecipe` returning component keys from the new `RecipeEntry` shape.
  - `components/designer/page-designer-model.ts` · `splitRecipe` maps `RecipeEntry` objects (or plain strings) to their component key.
  - `components/page/RowPageView.test.tsx` · the test for the frame's shared `splitsBody` rule.
  - `components/page/RowPageView.tsx` · `CodePageFrame` reuses the frame's shared `splitsBody` rule instead of its own inline check.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24 PR C's evidence and the dated lines (the flip's look, the upgrade-on-read correction, the plan
    approval).
  - `lib/design/component-definitions.test.ts` · the test for a definition without the six retired components.
  - `lib/design/component-render.test.tsx` · the tests for the renderer without the six, `LEGACY_UPGRADES` and the upgraded rendering.
  - `lib/design/component-render.tsx` · the six components' render branches leave; `renderComponents` reads every region through the
    parser's upgrade.
  - `lib/design/components.test.ts` · the tests for the catalogue without the six definitions.
  - `lib/design/components.ts` · the six definitions, renderers and READS leave the catalogue.
  - `lib/design/debug-trace.test.ts` · Home's fixture regions rewritten as Data-region/Live-band components; the trace assertions follow
    the new READS.
  - `lib/design/definitions.test.ts` · the tests for Utilization counting a stored old key under its upgrade.
  - `lib/design/definitions.ts` · `usageFromRows` counts a stored old key (`home.lead`, `home.wire`, etc.) under its Data-region upgrade.
  - `lib/design/page-document.test.ts` · the tests for the parser's upgrade table (each of the six, fields kept, a class-family Source refused).
  - `lib/design/page-document.ts` · `LEGACY_UPGRADES` and `upgradedKey`: a stored region naming an old key reads as its Data-region or
    Live-band template.
  - `lib/design/page-frame.test.ts` · the tests for the frame's memoised thunk (never for a split document, once otherwise, a rejection
    propagated once).
  - `lib/design/page-frame.tsx` · `framed` takes the code page's body as a memoised thunk, called at most once and never for a split document.
  - `lib/design/presets.ts` · a comment update: the two Application Settings that used to set the lead/wire counts retired here.
  - `lib/design/setting-defaults.ts` · `home.wire_count` and `home.blog_suggested_count` leave the settings catalogue; `SettingValue`
    widened to a plain union.
  - `lib/design/settings.test.ts` · the tests for the settings catalogue without the two retired keys.
  - `lib/home-layout.test.ts` · the tests for the layout without a pin.
  - `lib/home-layout.ts` · `pinnedSlug`/`pinnedLeadSlug` retire (a stored pin from the old console is ignored; the lead is the Lead story
    region's business now).
  - `lib/home-model.test.ts` · the tests for `liveStep`, `loadLiveModel` and the model without the retired pieces.
  - `lib/home-model.ts` · a pure `liveStep` and a cached `loadLiveModel` for the Live band and the race-weekend conditions;
    `changedFromStandings` and the pin retire.
  - `lib/series.ts` · `loadAllSeries`/`loadAllSeriesMeta` wrapped in React's `cache` (once per request).
  - `package.json` · the release trio: the version bump (1.0.157).
  - `scripts/parity-home.mts` · new: two captures of `/` compared region by region after normalising countdowns, ages, flight scripts,
    comments and whitespace.
- **Verified:** tests first, seen red: 17 failures across 10 files (plus the renderer test failing to load on the missing `loadLiveModel`),
  then green. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 223 files, 2278 tests · hooks 31/31 · cf:build exit 0 in 196s, 1189
  pages · wrangler deploy --dry-run Total Upload 39409.56 KiB / gzip 8625.22 KiB (60.1% of 64 MiB). Browser, local server against prod's live
  document inserted verbatim (review page `1ce6f9ab-24e0-48a6-8f00-ea8219a62fde`, 5 screenshots): the designer opens the seven regions as
  five Data regions and the Live band with sources, presets, rows, templates and places kept; Save stores the upgraded form; the local `/`
  serves the seven boxes through the upgrade; the Gallery has no Home group. Parity: `scripts/parity-home.mts` calibrated on prod (two
  captures 25s apart, identical); prod's before/after captures across the deploy are compared in the next records (#1039).
- **Review:** PASS WITH NOTES, nothing blocking (~250k tokens said, 386,082 measured, 41 tool uses). Six notes, most watched rather than
  fixed: the wire's fallback when a headline's series does not resolve; the Podium's report link only when the round resolves, and reading
  the latest race through the results snapshots rather than KV podiums; the Leader template's binding refusal for a class-family Source on
  an old What it changed (none in prod's history). One taken in the second commit: the parity script's depth counter now reads after the
  flight `<script>` tags are stripped.

## #1037 · 1.0.156 · records · merged Wed 23 Sep 15:34 (12:34Z)
Records R6's merge (#1036, squash-merged 12:27:31Z as 74fd112d) and PR C's decision-scan answer on the flip's look.
- **Files (7):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.156).
  - `RELEASES.md` · the release trio: the public note (1.0.156).
  - `SCHEDULE.md` · records: the step.
  - `docs/HANDOFF.md` · records: the LATEST header and session-57 prompt carrying R6 and PR C's answered scan (APEX margins, later
    superseded; the half kept when one half is empty).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: R6 DONE with its evidence and the dated merge line.
  - `package.json` · the release trio: the version bump (1.0.156).
- **Review:** none (records)

## #1036 · 1.0.155 · R6 · merged Wed 23 Sep 15:27 (12:27Z)
**The live band features the lead series once.** A quick fix: with every other region hidden, Home's live band boxed the same weekend
twice when the lead series was also listed among the featured series in Application Settings, because `rankLiveWeekends` built the featured
list as the lead then the majors with no exclusion. The lead is now excluded from the majors.
- **Readers see:** yes, the live band no longer boxes the lead series' weekend twice when it is also among the featured series.
- **Editors get:** nothing beyond the fixed ranking; the Application Setting `home.major_series` still lets an editor list the lead among
  the featured series (left valid, harmless).
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.155).
  - `IDEAS.md` · records: two Inbox lines (prod's prefetched routes referencing a previous build's chunks; the settings editor allowing
    the overlap).
  - `RELEASES.md` · the release trio: the public note (1.0.155).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: slot R6's evidence and the dated line with the operator's word.
  - `lib/home-model.test.ts` · the test for the overlap (lead f1, majors [f1, motogp] → featured f1 then motogp).
  - `lib/home-model.ts` · `rankLiveWeekends` excludes the lead series from the majors before ranking (one line).
  - `package.json` · the release trio: the version bump (1.0.155).
- **Verified:** tests first, seen red: the new home-model test failed before the change (1 of 14), passed after. Gates: tsc 0 · lint 0
  errors (2 known warnings) · vitest 223 files, 2280 tests · hooks 31/31 · cf:build exit 0, 1189 pages (52 first-attempt prerender retries,
  each passing) · wrangler deploy --dry-run Total Upload 39427.18 KiB / gzip 8630.11 KiB. Not proven in a browser: the duplicate needs the
  setting with the lead among the featured series; the unit test carries the case.
- **Review:** PASS WITH NOTES, nothing blocking (~60k tokens said, 116,961 measured). Its one note, the lead named among the majors while
  not racing, is asserted in the same test.

## #1035 · 1.0.154 · records · merged Wed 23 Sep 14:37 (11:37Z)
Records P2.24 PR B2's merge (#1034, squash-merged 11:27:37Z as dde6c4b6): the ledger's evidence, the slot staying started for PR C, and ten
Inbox lines.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.154).
  - `IDEAS.md` · records: ten Inbox lines.
  - `RELEASES.md` · the release trio: the public note (1.0.154).
  - `SCHEDULE.md` · records: the session-56 block.
  - `docs/HANDOFF.md` · records: the LATEST header with the session-57 prompt (PR C's decision scan first, then plan mode with a Sonnet
    critic, the parity script, the flip).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24's evidence carries B2's merge; the slot stays STARTED for PR C.
  - `package.json` · the release trio: the version bump (1.0.154).
- **Review:** none (records)

## #1034 · 1.0.153 · P2.24 B2 · merged Wed 23 Sep 14:27 (11:27Z)
**The Podium and Leader templates: Home's Latest result and What it changed as Data-region templates.** The third of P2.24's PRs (the
second half of B): Home's two remaining boxes become View templates of the general Data region, bound to the Results and Standings sources
through a cross-series resolution no source carried before, the newest finished race across the series Home ranks.
- **Readers see:** nothing; Home stays on its own six pieces until PR C.
- **Editors get:** a Results Data region's Series select offers "Home's series" first (the Latest result / Podium template); a Standings
  region's offers "Latest result" first (the Leader template, the winner's row marked).
- **Files (22):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.153).
  - `RELEASES.md` · the release trio: the public note (1.0.153).
  - `components/data/DataRegionViews.tsx` · `DataRegionPodium` and `DataRegionLeader`, Home's `HomeLatestResult` and `HomeWhatChanged`
    copied verbatim as templates.
  - `components/designer/DataSourcesEditor.test.tsx` · the test for the Data Sources editor's special-value series options.
  - `components/designer/DataSourcesEditor.tsx` · `seriesChoices` draws "Home's series"/"Latest result" first, by their label.
  - `components/designer/PageDesigner.test.tsx` · the tests for the Series select, the Latest result and What it changed presets and
    their pills.
  - `components/designer/PageDesignerProperties.tsx` · the Property Editor's Series select draws the special values first.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24's evidence carries B2's plan approval and merge.
  - `lib/design/component-render.test.tsx` · the tests for the Podium and Leader templates drawn from fixtures.
  - `lib/design/component-render.tsx` · dispatches Latest result and What it changed on their own shape alone (`podium-rows`, `driver-rows`).
  - `lib/design/components.test.ts` · the tests for the two new presets and their View options.
  - `lib/design/components.ts` · the View options "Latest result" and "What it changed" bound to their sources.
  - `lib/design/page-document.test.ts` · the test for the parser naming a value by its label in a refusal.
  - `lib/design/page-document.ts` · the preset-refusal message names the value by its label ("Drivers is not a preset of Latest result").
  - `lib/design/presets.test.ts` · the tests for the `podium-rows` shape and its date-ordered rule.
  - `lib/design/presets.ts` · new shape `podium-rows`; the presets Latest result (view `podium`, rows 3) and What it changed (view
    `leader`, rows 5).
  - `lib/design/source-read.test.ts` · the tests for `latestRaceAcross`, the "Home's series" join and the "Latest result" standings
    resolution.
  - `lib/design/source-read.ts` · `latestRaceAcross(slugs, season)`: the newest finished race across Home's series, once per request
    through React's `cache`; every row gains series facts, season-complete and champion/winner.
  - `lib/design/sources.test.ts` · the tests for the Results and Standings sources' special series values.
  - `lib/design/sources.ts` · the Results source's Series offers "Home's series" (key `home`) first; Standings' offers "Latest result"
    (key `latest`) first.
  - `package.json` · the release trio: the version bump (1.0.153).
- **Verified:** plan critic (Sonnet, said ~250k tokens, 293,409 measured): SOUND WITH FIXES, four blocking folded. Tests first, seen red:
  19 failures across 8 files (133 passing), then green. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 223 files, 2279 tests ·
  hooks 31/31 · cf:build exit 0, 1189 pages (55 first-attempt prerender timeouts, each passing on retry) · wrangler deploy --dry-run Total
  Upload 39427.05 KiB / gzip 8629.93 KiB (60.2% of 64 MiB; B1: 40356.01 KiB). Browser, local server with the production flag (review page
  `bb8c0ea0-002d-4502-917e-52a6bec1cfbc`, 8 screenshots): the Podium on the Monza preview drew the very text of Home's Latest result box at
  the same moment (MotoGP round 15, Pedro Acosta, margin +1.017); the Leader drew Home's first five standings rows with the winner marked;
  the trace showed both regions' sources ending at the same instant.
- **Review:** PASS WITH NOTES, nothing blocking (~250k tokens said, 305,410 measured). Three notes: a stale comment atop `PRESETS` still
  counting thirty-five presets, taken in the second commit; the plan's prose named a richer return shape for `latestRaceAcross` than the
  code's `{ slug, rows, winner }` (the round, race and date ride on the rows, which both call sites and templates read); the champion's
  eligibility gate confirmed as `fetchFullDriverStandings`'s own null for a series without a drivers' brief.

## #1033 · 1.0.152 · records · merged Wed 23 Sep 11:18 (08:18Z)
Records the operator's six answers to the Phase 2 progress report (~08:05Z): P2.24 B2's cross-series default and PR C's four defaults
stand; P2.3 and P2.10 settled without a further question.
- **Files (7):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.152).
  - `RELEASES.md` · the release trio: the public note (1.0.152).
  - `SCHEDULE.md` · records: the step.
  - `docs/HANDOFF.md` · records: the LATEST close with the session-56 prompt, P2.24 B2 first, then PR C's four defaults, then P2.3's answer.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: one dated line carrying the operator's six answers; P2.3 and P2.10 no longer carry a question.
  - `package.json` · the release trio: the version bump (1.0.152).
- **Review:** none (records)

## #1032 · 1.0.151 · records · merged Wed 23 Sep 10:49 (07:49Z)
Records P2.24 PR B1's merge (#1031, squash-merged 07:41:42Z as d7b5ba45) and publishes the Phase 2 progress report.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.151).
  - `IDEAS.md` · records: five Inbox lines.
  - `RELEASES.md` · the release trio: the public note (1.0.151).
  - `SCHEDULE.md` · records: the morning.
  - `docs/HANDOFF.md` · records: the LATEST close with the session-56 prompt (the operator's answers to the progress report's first group,
    then B2's decision scan and plan).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24's evidence carries B1's merge; the slot stays STARTED (B2, PR C).
  - `package.json` · the release trio: the version bump (1.0.151).
- **Review:** none (records)

## #1031 · 1.0.150 · P2.24 B1 · merged Wed 23 Sep 10:41 (07:41Z)
**The Weekends source and the Coming weekends template: Home's What's next as a Data region.** The second of P2.24's PRs (B split into B1
and B2 at the plan's approval): the fourteenth catalogue source, the coming weekends across every series or one, and a Coming weekends View
template copied verbatim from Home's `HomeWhatsNext`.
- **Readers see:** nothing; Home stays on its own pieces until PR C.
- **Editors get:** a fourteenth Data Source, Weekends (Series optional, Count 1-50); a Coming weekends View template on Data regions.
- **Files (23):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.150).
  - `RELEASES.md` · the release trio: the public note (1.0.150).
  - `app/api/admin/design/data/sources/route.test.ts` · one of the reviewer's five stale "thirteen" comment fixes, reworded to fourteen.
  - `app/api/admin/design/data/sources/route.ts` · the same stale-comment fix as its test.
  - `components/data/DataRegionViews.tsx` · `DataRegionComingWeekends`, Home's `HomeWhatsNext` copied verbatim as a template.
  - `components/designer/DataSourcesEditor.test.tsx` · one of the reviewer's five stale "thirteen" comment fixes.
  - `components/designer/DataSourcesEditor.tsx` · the same stale-comment fix.
  - `components/designer/DataWorkspace.test.tsx` · the same stale-comment fix.
  - `components/designer/PageDesigner.test.tsx` · the tests for the Weekends Source Type, the What's next preset's view and rows.
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24's evidence carries B1's plan approval and merge.
  - `lib/design/component-render.test.tsx` · the test for the Coming weekends template drawn from a fixture.
  - `lib/design/component-render.tsx` · dispatches the Weekends source's `weekend-rows` shape to its template.
  - `lib/design/components.test.ts` · the tests for the fifth source and the What's next View option.
  - `lib/design/components.ts` · the View option "What's next" bound to the weekends source.
  - `lib/design/page-document.test.ts` · the test for the What's next binding.
  - `lib/design/presets.test.ts` · the tests for the `weekend-rows` shape and the What's next preset.
  - `lib/design/presets.ts` · new shape `weekend-rows`; the preset What's next (view `coming-weekends`, rows 3, every series).
  - `lib/design/source-read.test.ts` · the tests for the reader's order, count, columns and a throwing series.
  - `lib/design/source-read.ts` · the Weekends reader: Home's What's next rule (every series' weekends not past, sorted by first
    session, cut to Count).
  - `lib/design/sources.test.ts` · the tests for the fourteenth source's columns, parse and label.
  - `lib/design/sources.ts` · the Weekends source: Series (optional), Count (1-50, default 10); nine columns; reads `content:series` and
    `live:ics`.
  - `package.json` · the release trio: the version bump (1.0.150).
- **Verified:** plan critic (Sonnet, said ~250k tokens, 297,236 measured): SOUND WITH FIXES, three blocking folded. Tests first, seen red:
  13 failures across 9 files, then green. Gates: tsc 0 · lint 0 errors (2 known warnings) · vitest 223 files, 2272 tests · hooks 31/31 ·
  cf:build exit 0, no prerender retries · wrangler deploy --dry-run Total Upload 40356.01 KiB / gzip 8877.77 KiB (61.6% of the ceiling,
  142.55 KiB over 1.0.148's 40213.46 KiB). Browser, local server (review page `435d574c-bfa9-4371-afca-2485e813744f`, 4 screenshots):
  Source Weekends (every series, Count 10), the What's next preset; the preview drew Home's box verbatim over ten live weekends, the
  nearest three (the F2/F1 Azerbaijan Grands Prix, 24-26 Sept, with its countdown; the 6 Hours of Fuji, 25-27 Sept); the local Home page
  drew the same three weekends in the same order at the same moment.
- **Review:** PASS WITH NOTES, nothing blocking (~250k tokens said, 237,688 measured). Four notes: five stale "thirteen" comments reworded
  to fourteen, taken in the second commit; the apostrophe regex tolerating a bare quote React never emits, left as is; the title label
  computed outside the per-series try exactly as Home's is, a faithful copy of an accepted risk; the dry run's growth explained.

## #1030 · 1.0.149 · records · merged Wed 23 Sep 09:10 (06:10Z)
Records P2.24 PR A's merge (#1029, squash-merged 06:01:25Z as 0b0f42a4) and opens the session-56 handoff with PR B first.
- **Files (9):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.149).
  - `IDEAS.md` · records: eight Inbox lines.
  - `RELEASES.md` · the release trio: the public note (1.0.149).
  - `SCHEDULE.md` · records: the session.
  - `docs/HANDOFF.md` · records: the LATEST close with the session-56 prompt (PR B first, its decision scan's three defaults stated).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24's evidence carries the merge; the slot stays STARTED (PR B, PR C).
  - `package.json` · the release trio: the version bump (1.0.149).
- **Review:** none (records)

## #1029 · 1.0.148 · P2.24 A · merged Wed 23 Sep 09:01 (06:01Z)
**Posts and news into the Data region: the Lead story and The wire as templates, the image column.** The first of P2.24's three PRs
("Home's six become instances"): the Data region reads two more catalogue sources, posts and news, and draws Home's Lead story and The
wire boxes over them as View templates, so PR C can later place Data regions where `home.lead` and `home.wire` stand and serve the same HTML.
- **Readers see:** nothing; Home stays on its own pieces until PR C.
- **Editors get:** Posts and News join the Data region's sources; Lead story and The wire join the View list as templates; a Pinned post
  attribute; a new image column type (a thumbnail in a table cell, a picture in a card's Media box).
- **Files (24):**
  - `CHANGELOG.md` · the release trio: the engineering note (1.0.148).
  - `RELEASES.md` · the release trio: the public note (1.0.148).
  - `components/data/DataRegionViews.tsx` · `DataRegionLeadStory` and `DataRegionWire`, Home's markup copied verbatim from
    `HomeLead.tsx`; the image column's thumbnail and Media box.
  - `components/designer/PageDesigner.test.tsx` · the tests for the Source types, the Preset group, Pinned post, the greyed pills and
    their note.
  - `components/designer/PageDesignerProperties.tsx` · `SLOT_OF` gains the media slot (`cardMedia` → `media`), the browser run's find
    (the Media slot read "(none)" over a picture column).
  - `docs/plan/components-programme.md` · records: the generated plan page, re-rendered from the ledger.
  - `docs/plan/ledger.json` · records: P2.24's evidence carries the merge; the slot STARTED (PR B, PR C).
  - `lib/blog.test.ts` · the test for `readMinutes`, exported from this module.
  - `lib/blog.ts` · `readMinutes(body)` exported (one divisor, 220 words a minute), used by the lead card too.
  - `lib/date.test.ts` · the test for `ageLabel`, moved into this module.
  - `lib/date.ts` · `ageLabel` moved here from `lib/home-model.ts`.
  - `lib/design/component-render.test.tsx` · the tests for the Lead story and The wire templates drawn from fixtures.
  - `lib/design/component-render.tsx` · `RenderPage` hands one `now` to every region; reads posts and news in `READS`.
  - `lib/design/components.test.ts` · the tests for the two new View options, the Pinned post attribute, the greyed pills.
  - `lib/design/components.ts` · the templates are View options (a correction to the scan's default of a separate Template attribute);
    the Pinned post attribute; the image column type declared on `Shape.card.media`.
  - `lib/design/page-document.test.ts` · the tests for the parser's bindings over the two new sources.
  - `lib/design/presets.test.ts` · the tests for `post-rows`/`news-rows` and the Lead story/The wire presets.
  - `lib/design/presets.ts` · two shapes (`post-rows`, `news-rows`) and two presets (Lead story, The wire, over every series).
  - `lib/design/source-read.test.ts` · the tests for the posts/news readers' order, stamps, read time and series facts.
  - `lib/design/source-read.ts` · the posts reader orders as `fetchHomeBlogLead` does; the news reader sorts newest first as
    `buildWire` does; both gain Series, Series colour.
  - `lib/design/sources.test.ts` · the tests for the two new sources' columns.
  - `lib/design/sources.ts` · Posts and News join the Data region's sources.
  - `lib/home-model.ts` · imports `ageLabel` from its new home, `lib/date.ts`, instead of defining it locally.
  - `package.json` · the release trio: the version bump (1.0.148).
- **Verified:** plan critic (Sonnet, said ~250k tokens, 343,043 measured): SOUND WITH FIXES, three blocking folded. Tests first, seen
  red: 15 failures across 9 files, then green. Gates (second commit): tsc 0 · lint 0 errors (2 known warnings) · vitest 223 files, 2268
  tests · hooks 31/31 · cf:build exit 0, no prerender retries · wrangler deploy --dry-run Total Upload 40213.46 KiB / gzip 8839.70 KiB
  (61.4% of the ceiling, 100.18 KiB over 1.0.146's 40113.28 KiB). Browser (review page
  `a4edd962-5678-40c3-8b06-048322339d20`, 7 screenshots; the local database seeded with an author row and three published posts): a
  Posts region's preview drew Home's lead box verbatim ("LEAD STORY · 2H AGO · | FORMULA 1 · 2 MIN READ", the title, summary, button,
  More reading); a News region's preview drew Home's wire verbatim over 39 rows, the newest five.
- **Review:** PASS WITH NOTES, nothing blocking (~250k tokens said, 262,171 measured). Six informational notes, none taken in the first
  commit (the `||` over `??` fallback, inert; the wire's dropped `className`; the test mock's own `readMinutes` copy; `slotText`
  formatting a hand-mapped date slot; the pinned lead's More reading from the reader's rows). The second commit is the browser run's own
  find: the Media slot's label read "(none)" over a picture column, fixed with its test.
