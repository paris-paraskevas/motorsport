# Contributing to Paddock Tracker

Two-person codebase: Paris (paris-paraskevas) and Fotis. Trust-based discipline replaces enforced branch protection. The rules below are the social contract — break them rarely and explain why when you do.

## TL;DR

1. Never push directly to `main`. Branch → PR → review → merge.
2. Every PR needs an approving review before merge. (CI is intentionally not wired yet — see `IDEAS.md` Parked.)
3. Read `CLAUDE.md` — the operating manual that humans and Claude both follow.

## Where we work

Three branches, three Cloudflare Workers, three URLs. Nothing else deploys anywhere.

| Branch | Worker | URL | Who | Deploys when |
|---|---|---|---|---|
| `main` | `motorsport` | paddock-tracker.com | nobody pushes directly | a PR is merged |
| `testing` | `motorsport-testing` | testing.paddock-tracker.com | Fotis | every push |
| `testing-paris` | `motorsport-paris` | paris.paddock-tracker.com | Paris | every push |
| `testing-panagiotis` | `motorsport-panagiotis` | panagiotis.paddock-tracker.com | Panagiotis | every push |

Adding a fifth is now two steps: copy a `wrangler.<name>.jsonc` (changing `name`, the route, the R2 prefix and `WORKER_SELF_REFERENCE`), then `npm run secrets:sync -- <name>`. Do **not** add a `triggers` block: the crons must fire exactly once, on prod.

Why three workers rather than a preview URL per branch: Cloudflare does not generate Preview URLs for a Worker that implements a Durable Object, and `worker.ts` exports three of them. A live URL therefore means a real Worker, and one Worker serves one deployment — so if both devs pushed to the same preview Worker, the later push would silently replace the earlier one.

What the previews share with production, and it is not nothing: the **same** Supabase database, the same Upstash KV store and the same R2 bucket (under separate cache prefixes, so page caches cannot collide). App mutations on a preview — placing a bet, posting a thread, saving an author profile, approving a draft — write to **prod data**. Reads are safe: every preview runs `DATA_SOURCE=db`, so it never fetches or writes upstream series data.

What previews deliberately cannot do, by omitting secrets rather than by hoping: send email (no `RESEND_API_KEY`), push to real subscribers (no `VAPID_PRIVATE_KEY`), or touch analytics (no GA4/GSC/Bing keys). They also carry **no cron triggers**, because the crons must fire exactly once and that once is production.

## Branching

- Feature work for a PR branches from latest `main`: `git checkout main && git pull && git checkout -b <branch>`.
- Naming: `<initials>/<topic>` (`pp/weather-fix`, `fo/sitemap`) or conventional prefixes (`feat/...`, `fix/...`, `docs/...`).
- Short-lived. Merge within 48h. Long branches accumulate conflicts.

### The long-lived working branches

`testing` and `testing-paris` are workshops, not PR sources. They run ahead of `main` on purpose and survive across sessions.

**A PR from a working branch brings the whole branch**, every commit on it, which is not what you want when half of it is experiments. So cut each PR from the work you actually want to ship:

```
git switch main && git pull
git switch -c feat/<thing>
git cherry-pick <sha> [<sha>...]     # only the commits that are ready
git push -u origin feat/<thing>      # PR this branch, never the workshop
```

**After that PR merges**, bring `main` back into the workshop, letting `main` win every conflict while keeping unmerged experiments on top:

```
git switch testing-paris
git fetch origin && git merge origin/main -X theirs
git push
```

Unmerged work survives that merge, so prune it yourself when it goes stale. `-X theirs` resolves conflicts in `main`'s favour; it does not delete your commits.

## Pull requests

- Title: conventional-commit style (`feat(weekend): X`, `fix(notify): Y`).
- Body: what + why + how to test. Link to the relevant `IDEAS.md` entry if applicable.
- There is **no per-PR preview URL** (see "Where we work"). Review the diff, and point the reviewer at whichever preview already carries the code: Fotis's work at testing.paddock-tracker.com, Paris's at paris.paddock-tracker.com. If the PR branch was cherry-picked and has never been pushed to a workshop branch, say so in the body so the reviewer knows the diff is all they get.
- Squash-merge to main. Delete the branch after. **Merging is what deploys production** — there is no separate deploy step and no undo beyond a revert PR.

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
1. Branch `hotfix/<topic>` from `main`.
2. PR with `[hotfix]` in the title.
3. Reviewer turns it around in <15 min.
4. Merge → auto-deploy.
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
| Cloudflare per-worker secrets | 23 on prod, 10 on each preview | the Worker at runtime |

Three traps, each of which has already cost a session:

1. **`.env.cloudflare.local` is a filename Next never reads.** Anything living only there is absent at build time, which is how the assistant and push subscriptions silently broke.
2. **Values in `.env.production.local` are quoted.** `node --env-file` strips the quotes; `gh secret set --body "$(grep|cut)"` does not, which fed Supabase a URL of `"https://…"` and failed every write for 20 hours while reporting success.
3. **`NEXT_PUBLIC_*` are inlined at build, not read at runtime.** A blank value is worse than a missing one: blank inlines `""` and overrides the Worker's real runtime secret.

Paris is the deploy steward. Never paste secrets in chat or PRs.

## Conflicts on shared files

`proxy.ts`, `app/layout.tsx`, `lib/types.ts`, `next.config.ts` are touched by both devs.
1. Rebase: `git fetch && git rebase origin/main`.
2. Resolve, test locally.
3. Force-push with `--force-with-lease`.
4. Tell the other dev so they pull before continuing.

Never force-push to `main`. Never `--force` without `-with-lease`.

## Coordination

Async + durable: `IDEAS.md`, `SCHEDULE.md`, GitHub PR comments.
Real-time: chat (tool TBD).
Architectural decisions: PR description or update the handoff memory.
