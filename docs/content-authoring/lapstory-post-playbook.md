# Lap-by-lap playbook — F1 race-chronology analysis

The routine behind the **lap-by-lap analysis** blog: a post-race read of *how* an
F1 race unfolded, front to back and lap by lap (lead changes, the safety cars and
VSCs, pit windows, tyre calls, the recovery drives, the retirements). A companion
to the weekend preview/digest (`weekend-post-playbook.md`), not a replacement.

**F1-only.** OpenF1 is the only per-lap source we have, so this variant does not
exist for other series.

**Voice: analyst.** Straighter and more granular than the digest — the edge is
dialled back, the detail dialled up. House rules still apply (`blog-authoring`
skill): no em dashes, no AI-tell phrases, British English, internal links.

**Non-negotiable:** STOPS at a reviewed draft. Never writes to the DB, approves,
or publishes. A human approves + schedules in `/blog`.

---

## Step 1 — Ground the chronology (deterministic, run first)

```
npx tsx scripts/lapstory-context.mts [--round <n>] [--now <ISO>]
```

No `--round` → the latest completed F1 race. Prints a JSON pack to stdout, a
summary to stderr. It resolves the OpenF1 race session for the weekend and pulls:

- `classification` / `podium` / `dnfs` (with the lap each retirement stopped)
- `stops` (lap + duration), `strategy` (per-driver tyre stints), `neutralisations`
  (safety car / VSC / red-flag laps), `penalties`
- `overtakes` — the **full field**, lap-anchored, each flagged `likelyPitCycle`

If it **exits non-zero** (no OpenF1 race session for the round) → STOP, no post:
the race isn't in OpenF1 yet, or the dates don't overlap. Never draft without a
pack. If stderr warns a dataset is EMPTY (`⚠ … EMPTY for a completed race`), it
hit an OpenF1 throttle through all retries — **re-run** before trusting it.

## Step 2 — Tier the facts (the RULE #1 spine)

The pack's `factTiers` says it, enforce it:

- **Authoritative — use verbatim:** classification, DNFs, stints, pit laps +
  durations, neutralisations, penalties. These drive the site's own tabs.
- **OpenF1-timed — handle with care:** `overtakes`.
  - **Drop every `likelyPitCycle: true` row** — a place gained because the other
    car pitted, not an on-track pass.
  - **Cross-check every DECISIVE pass** (lead / podium / points-deciding) against
    a primary race report (F1.com, Sky, The Race, Motorsport Week) before
    asserting the move or its lap. Lap numbers are clock-inferred (±1).
  - **Midfield / back-of-grid passes** may be named from the feed as-is, but the
    post MUST carry the OpenF1 attribution line (Step 3) — coverage is not
    exhaustive, so present them as timing-derived, not as a complete account.
- Never invent a pass, a lap, a quote or a link.

## Step 3 — Draft the ledger (analyst voice)

Chronological ledger, grouped by lap phase. The shape that shipped for Spa 2026
(prod draft `f1-belgian-grand-prix-2026-lap-by-lap`):

- One-line intro: the result + what the race ran through (neutralisations,
  retirements, lead changes, notable recovery).
- Phase blocks in order: **Lap 1** · **Laps a-b: safety car** · **green-flag
  phases** · **the VSC / strategy swing** (bullet the lead changes) · **the
  decisive lap** · **run to the flag**.
- **Name passes across the whole field with their laps**, not just the front —
  a recovery drive as a named sequence ("X on lap 5, Y on lap 10…"), the midfield
  scraps, not only the podium fight.
- Fixed closing blocks: **Pit log** (stop count + notable stops) · **Retirements**
  (driver, lap, cause) · **Where it leaves the title** (championship from the
  digest's grounded standings, or link the Standings tab) · next round.
- Internal links throughout (drivers / teams / `/series/f1/standings` /
  `/series/f1/results` / `/series/f1/weekend/<round>`), slugs via `slugify`.
- **End with the attribution line:**
  `_Lap-by-lap movements are from OpenF1 timing; overtake coverage is not exhaustive._`
  (mirrors the site's `OpenF1Attribution`; OpenF1 is CC BY-NC-SA, unofficial.)

## Step 4 — Emit the draft

Write `drafts/<slug>.md` in the standard format: a leading `<!-- -->` metadata
block (`slug` = `suggested.slug` = `f1-<round>-<season>-lap-by-lap`, `title` ≤140,
`summary` ≤300, `series: f1`; omit `publishAt`/`heroImage` → null), then the
article. Body reads cleanly without its `# H1` (dropped at conversion). ≤50000 chars.
Verify the parse: `npx tsx scripts/draft-post.mts drafts/<slug>.md --dry`.

## Step 5 — Handoff (approval-gated — NOT part of this routine)

Same as every post: a human runs the insert (`draft-post.mts` with PROD env),
then approves + schedules in `/blog`. This routine never holds the service-role key.

## Automation (planned — not yet wired)

"Automatic" splits in two:
- **Auto-grounding** (deterministic) can run on a post-race cron. ⚠ A Vercel cron
  hitting OpenF1 is outbound/datacenter code → verify on a Vercel **preview**
  before prod (the `lib/openf1/client` datacenter-egress rule; the 0.12.12 NASCAR
  precedent). Operator-gated.
- **Auto-draft** needs a model in the loop (the narrative + the fact-tiering), so
  it rides the **same headless-`claude -p` trigger the weekend-post cadence is
  queued on** (IDEAS B3; metered GH Actions since the repo went private), not a
  second bespoke trigger. Drafts stay approval-gated regardless.

---

## Hard guardrails

1. Draft only. Never approve, publish, or write to the DB from here.
2. F1-only. No pack → no post.
3. Authoritative tier verbatim; `likelyPitCycle` rows dropped; decisive passes
   cross-checked; midfield passes attributed to OpenF1.
4. Re-run on any EMPTY-dataset warning — a throttled pack is not a quiet race.
5. `DraftInput` limits: title 140 / summary 300 / body 50000.
