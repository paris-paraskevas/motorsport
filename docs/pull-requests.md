# Pull requests

One entry per pull request, newest first: the place to see exactly what a PR changed and how it was verified, without reopening the diff or the ledger.

The rule from 24 September 2026: every PR adds its own entry here before it merges.

A records PR (a `docs(handoff)` merge) carries the entries of the merges it records, rather than a code change of its own.

How to read an entry: **Readers see** is what a visitor of paddock-tracker.com can notice, or "nothing" when every control ships off.

**Editors get** is what changed in the designer or the admin, or "nothing".

**Files** lists every file the merge commit touched, one line each, in plain words: what changed there, from the PR body, the CHANGELOG entry, or the file's own diff when neither says.

Back-filled 24 September 2026 for #1029 to #1053 (23 and 24 September 2026), from `gh pr view`, each merge commit's `git show --stat`, and `CHANGELOG.md`.

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
