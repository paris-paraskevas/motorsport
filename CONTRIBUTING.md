# Contributing to Paddock Tracker

Two-person codebase: Paris (paris-paraskevas) and Fotis. One rule is enforced, not trusted: only `next` merges into `main`, and only the operator merges it (a required check and the repository's ruleset on `main`, since 2026-10-08). The rest below is the social contract — break it rarely and explain why when you do.

## TL;DR

1. Never push or merge into `main` yourself. Branch from `next` → PR into `next` → review → merge into `next`. Once a day the operator merges `next` into `main`, and that merge is the only deploy.
2. Every PR needs an approving review before merge. (CI is intentionally not wired yet — see `IDEAS.md` Parked.)
3. Read `CLAUDE.md` — the operating manual that humans and Claude both follow.

## Where we work

Two branches, one Cloudflare Worker, one URL. Nothing else deploys anywhere.

| Branch | Worker | URL | Who merges into it | Deploys when |
|---|---|---|---|---|
| `main` | `motorsport` | paddock-tracker.com | the operator, from `next` only, once a day | that merge |
| `next` | none | none | anyone, through a reviewed PR | never |

There are no preview copies: `motorsport-testing`, `motorsport-paris` and `motorsport-panagiotis` were deleted on 2026-10-07, with their setups, because every deploy to them cost cache writes and they shared prod's data. A change is seen on `npm run dev` before the merge, and on the live site after the day's deploy. Each deploy fills the new build's cache first, then goes live, then marks the previous build's cache folder for deletion (`npm run deploy:cf`, `scripts/keep-live-cache.mts`).

## Branching

- Feature work for a PR branches from latest `next`: `git switch next && git pull && git switch -c <branch>`.
- Naming: `<initials>/<topic>` (`pp/weather-fix`, `fo/sitemap`) or conventional prefixes (`feat/...`, `fix/...`, `docs/...`).
- Short-lived. Merge within 48h. Long branches accumulate conflicts.

## Pull requests

- Title: conventional-commit style (`feat(weekend): X`, `fix(notify): Y`).
- Body: what + why + how to test. Link to the relevant `IDEAS.md` entry if applicable.
- Target `next`: `gh pr create --base next`. A PR into `main` from any other branch fails the `from-next` check and cannot merge.
- There is **no preview URL** (see "Where we work"). Review the diff, and check the change locally with `npm run dev`.
- Squash-merge into `next`. Delete the branch after. Merging into `next` deploys nothing; **the operator's daily merge of `next` into `main` deploys production**, and the only undo is a revert PR.

## Code review

- Required on every PR. No solo-merge.
- Turnaround norm: ~24h. Urgent → ping in chat.
- Depth: behavioural sanity, obvious bugs, does-the-preview-work. Bikeshedding parked, nits advisory.
- Explicit approvals only ("LGTM", "approved", "merge"). Comments alone don't unblock.

## Commits

- Conventional commits (see `git log --oneline` for prior style).
- Body explains *why*, not *what*.
- **No `Co-Authored-By`** or Claude attribution lines.
- Squash on merge keeps history clean.

## Hot-fixes

A hot-fix is a production-down incident, not "I want to ship faster". Process:
1. Branch `hotfix/<topic>` from `next`.
2. PR into `next` with `[hotfix]` in the title.
3. Reviewer turns it around in <15 min.
4. Merge into `next`; the operator merges `next` into `main`, which is that day's deploy.
5. Note in `memory/project-paddock-handoff.md`.

If the other dev is asleep, the on-call dev may self-approve a hot-fix with written justification in the PR body. Use sparingly — this is the single biggest erosion vector.

## Release notes

Every merged PR includes a `CHANGELOG.md` entry + matching `package.json` version bump. Patch / minor / major per change type. `/changelog` reads both live; a missing entry silently lies to users about what's running.

## Local dev

```
git clone https://github.com/paris-paraskevas/motorsport
cd motorsport
npm ci
# ask Paris for .env.local — there is no .env.example to copy
npm run dev                   # http://localhost:3000
```

### Where secrets actually live

| Location | Contents | Read by |
|---|---|---|
| `.env.local` | local-dev values. **Points at a LOCAL Supabase on 127.0.0.1**, not prod | `next dev` |
| `.env.production.local` | real prod values | `next build` automatically, and scripts via `node --env-file` |
| `.env.blog` | blog draft-script values | `scripts/draft-post.mts` |
| Cloudflare per-worker secrets | 23 on prod | the Worker at runtime |

Three traps, each of which has already cost a session:

1. **`.env.cloudflare.local` is a filename Next never reads.** Anything living only there is absent at build time, which is how the assistant and push subscriptions silently broke.
2. **Values in `.env.production.local` are quoted.** `node --env-file` strips the quotes; `gh secret set --body "$(grep|cut)"` does not, which fed Supabase a URL of `"https://…"` and failed every write for 20 hours while reporting success.
3. **`NEXT_PUBLIC_*` are inlined at build, not read at runtime.** A blank value is worse than a missing one: blank inlines `""` and overrides the Worker's real runtime secret.

Paris is the deploy steward. Never paste secrets in chat or PRs.

## Conflicts on shared files

`middleware.ts`, `app/layout.tsx`, `lib/types.ts`, `next.config.ts` are touched by both devs.
1. Rebase: `git fetch && git rebase origin/next`.
2. Resolve, test locally.
3. Force-push with `--force-with-lease`.
4. Tell the other dev so they pull before continuing.

Never force-push to `main`. Never `--force` without `-with-lease`.

## Coordination

Async + durable: `IDEAS.md`, `SCHEDULE.md`, GitHub PR comments.
Real-time: chat (tool TBD).
Architectural decisions: PR description or update the handoff memory.
