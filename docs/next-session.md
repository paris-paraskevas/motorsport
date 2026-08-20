# Next session — two blogs, operator's voice, Claude supplies data only

Written at the 2026-08-20 wrap. The reimagining queue that filled this file before is **complete** (Round 1 jobs ①–⑨, Round 2 ①–⑩, Round 3 ①–⑦ — all shipped, 0.289.0 → 0.321.0; the full ledger lives in `docs/HANDOFF.md` and `CHANGELOG.md`).

## The contract — read this before doing anything

Operator, 2026-08-20: **"ill need the information, ill write the blogs, you simply give me data and suggest corrections."**

- **Claude does NOT write the posts.** No drafts, no outlines-that-are-really-drafts, no prose in the operator's voice, no DB draft rows.
- **Claude produces a fact pack** per blog: verified figures, each with its source URL and retrieval date.
- **Then Claude reviews.** When the operator shares their draft, return corrections only — factual errors, stale numbers, house-style breaches (no em dashes, no AI phrases, always link out — memory `feedback-paddock-blog-house-style`).
- **RULE #1 governs every number.** Triple-check against primary sources. Never infer current-season specifics from training knowledge. Anything that cannot be confirmed goes in an explicit **UNVERIFIED** list rather than being smoothed over.
- Fact packs live in the **session scratchpad**, not `content/` — nothing in `content/posts/*.mdx` (that auto-publishes on merge; the 2026-07-03 British GP preview went live unsigned that way).

## Blog A — F1 summer break

Gather:
- The exact 2026 break window: last race before it, first race after, and the dates.
- The **mandatory factory-shutdown rule** — its length and the FIA Sporting Regulations article that sets it. Cite the article number.
- **Championship state at the break**, drivers' and constructors' top five with points and gaps. Our own data says: Antonelli 219, Hamilton 169, Russell 160, Leclerc 138, Norris 128; Mercedes 379, Ferrari 307, McLaren 220. **Verify against formula1.com before any of it reaches the operator.**
- The season in numbers: wins per driver and per team, rounds run (our data: 11 of 23), notable retirements, any mid-season seat changes.
- What resumes, when, and what is at stake in the run-in.

## Blog B — Dutch GP preview (Zandvoort)

Gather:
- Round number and dates. Our data says **R12, 21–23 Aug 2026**.
- The session schedule — and specifically **whether this is a SPRINT weekend**. Our own calendar renders Sprint Qualifying on the Friday and a Sprint on the Saturday, which is unusual for Zandvoort. **Confirm against the official F1 calendar before the operator writes a word about the format**; if our data is wrong, that is also a `content/series/f1/` correction worth raising.
- Circuit facts: length, corner count, DRS zones, the banked Turns 3 and 14, lap record with holder and year.
- Last year's winner and pole-sitter.
- Zandvoort's F1 history: the year it returned, past winners since.
- **Weather by venue-local date** via Open-Meteo — never UTC (memory `feedback-paddock-weather-venue-local`).
- Tyre and strategy notes only where a primary source carries them.

## Delivery shape

One markdown fact pack per blog in the scratchpad, every claim carrying its source URL, each closing with a **"could not verify"** section. Then stop and wait for the operator's draft.

## Standing queue (not blog work — pick up only if the operator asks)

- **What's-New modal** — the operator's Gantt-app reference: a version-gated dialog (hero card, feature cards, "Got it") on first visit after a release, sourced from `RELEASES.md`. Needs a seen-version localStorage gate and a card-worthy marker in the release format. Logged in `IDEAS.md`.
- **Results / standings / rounds body rework** — 0.314.0 gave them new Paper shells and landing access; their table bodies were deliberately kept. A deeper rework is a fresh ask.
- **App error boundary is pre-Paper**, and `lib/threads.ts` `listThreads` has no fail-soft (a DB hiccup 500s the whole threads page — it is why `/social/threads` cannot be checked on local dev). Both in `IDEAS.md`.
- **Landing-orphan deletion** — 13 zero-import components awaiting one approval PR.

## Ritual per PR (unchanged, hard-won)

`git checkout -b <branch> main` as the **literal first action after every merge** (two slips came from `gh pr merge`'s auto-checkout) → edits → `rm -rf .next/dev` → `npx tsc --noEmit` → `npm run lint` → `npm test` (1116; a lone red under load is the documented flake — rerun, never weaken) → `npm run build` and CHECK the exit → dev browser verify (stop dev before any build — landmine 9) → trio (`package.json` + `CHANGELOG.md` engineering + `RELEASES.md` public prose) → commit, no Claude attribution → push → `gh pr create` with what/why/verified → `gh pr merge --squash --delete-branch` → verify prod ~9 min later with a **background `Bash` curl check**, not a sentry agent (they die on model usage limits).
