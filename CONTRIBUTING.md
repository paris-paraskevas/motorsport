# Contributing to Paddock Tracker

Two-person codebase: Paris (paris-paraskevas) and Fotis. Trust-based discipline replaces enforced branch protection. The rules below are the social contract — break them rarely and explain why when you do.

## TL;DR

1. Never push directly to `main`. Branch → PR → review → merge.
2. Every PR needs an approving review before merge. (CI is intentionally not wired yet — see `IDEAS.md` Parked.)
3. Read `CLAUDE.md` — the operating manual that humans and Claude both follow.

## Branching

- Branch from latest `main`: `git checkout main && git pull && git checkout -b <branch>`.
- Naming: `<initials>/<topic>` (`pp/weather-fix`, `fo/sitemap`) or conventional prefixes (`feat/...`, `fix/...`, `docs/...`).
- Short-lived. Merge within 48h. Long branches accumulate conflicts.

## Pull requests

- Title: conventional-commit style (`feat(weekend): X`, `fix(notify): Y`).
- Body: what + why + how to test. Link to the relevant `IDEAS.md` entry if applicable.
- Vercel auto-creates a preview deploy; the URL lands as a PR comment. Reviewer clicks it.
- Squash-merge to main. Delete the branch after.

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
cp .env.example .env.local   # then ask Paris for real values
npm run dev                   # http://localhost:3000
```

Paris is the deploy steward. Env vars get shared via Bitwarden/1Password — never paste secrets in chat or PRs.

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
