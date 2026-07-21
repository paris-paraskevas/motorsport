# Weekend-post playbook — marquee-event preview / digest

The repeatable drafting routine behind the weekly blog cadence: a **preview**
(pre-weekend, targets Thursday 15:00 Athens) and a **digest / race report**
(post-race, targets Monday 15:00 Athens) for the *marquee event of the week*.

Design: `docs/research/2026-07-07-blog-cadence-automation.md`. General authoring
principles: `./README.md`. This file is the source of truth for the routine —
the local `/weekend-post` skill and any headless run both execute these steps.

**The non-negotiable:** this routine STOPS at a reviewed draft. It never writes
to the DB, never approves, never publishes. A human approves + schedules in
`/blog`; the `publish-posts` cron ships it at the set time.

---

## Inputs

- **mode** — `preview` or `digest` (default `preview`).
- **series** *(optional)* — a series slug to force; otherwise the marquee event
  is auto-picked.

## Step 1 — Ground the facts (deterministic, run first)

```
npx tsx scripts/weekend-post-context.mts --mode <preview|digest> [--series <slug>] [--now <ISO>]
```

Read the **JSON pack** it prints to stdout (the stderr line is just a summary).

- If `marquee: null` → there is no event in the window this cycle. **STOP — no
  post.** Report the reason.
- The pack's `standings` and `latestResult` numbers come from Paddock's OWN
  reconciled loaders — the same source the Standings/Results tabs render. They
  are **authoritative: use them verbatim.** Do not re-derive them, and do not
  overwrite them with figures from the web.
- `suggested.slug`, `suggested.publishAtUtc`, `event.seriesSlug` feed the output
  in Step 4. `groundingNotes` and the weekend deep-link are there too.

## Step 2 — Research the narrative (primary sources, fact-checked)

WebSearch / WebFetch the event and gather what the loaders don't have:
storylines, key moments, penalties, driver quotes, historical context,
championship implications.

- **RULE #1** (`feedback-paddock-scrutinise-drafts`): triple-check every fact
  against official / primary sources (Formula1.com and the series' official
  site first, then The Race, Autosport, Motorsport.com, Sky, etc.). Keep a
  source list in the draft's metadata block.
- **Cross-check against the grounded pack.** For a digest, the winner/podium you
  research MUST match the pack's `latestResult`. If a primary source disagrees
  with the pack on a hard number (winner, points, standings order), **STOP and
  flag the conflict** — our data may be mid-update, or the source is provisional.
  Do not silently pick one.
- Never invent facts, quotes, or links. If you can't verify it, omit it or flag
  it. A wrong published fact is the failure this whole cadence guards against.

## Step 3 — Draft in the house voice

Match the exemplar: `drafts/2026-british-gp-report.md`.

- A narrative, evocative **headline** — never "British GP report".
- Opening paragraph: the single biggest storyline + one **bolded** landmark fact.
- 4–6 **themed** section headers ("A pole that turned to heartbreak"), not
  "Results" / "Standings".
- Weave in quotes, penalties, championship math, and history. **Bold** standout
  facts. British English. ~500–800 words.
- **Digest** also gets: a `**Top ten:**` classification line (verify against the
  Results tab), and a "Where it leaves us" closer — championship state (from the
  pack's `standings`) + the next round.
- **Preview** covers: what's at stake, the key battles, form + championship
  context (from `standings`), the session highlights, and where to watch. Do NOT
  state session times or predicted results as fact — link the weekend page; times
  render device-local there.

## Step 4 — Emit the draft

Write **`drafts/<slug>.md`** in the exemplar format (`drafts/2026-british-gp-report.md`):
a leading HTML comment block holding the metadata + sources for the reviewer,
then the article. `.md` is the human-review format — the Phase-1 insert converts
it to `createDraft`'s `DraftInput` deterministically (Step 5).

Record in the comment block (these feed the insert):

- `slug` — `suggested.slug` (unique, kebab-case).
- `title` — the headline, **≤140 chars**.
- `summary` — the excerpt, **≤300 chars**.
- `series` — `event.seriesSlug`.
- `publishAt` — `suggested.publishAtUtc`.
- `sources` — the primary sources you fact-checked against (RULE #1).

The article body (after `-->`) is the post; the leading `# H1` is dropped at
conversion (the title lives in its own field), so the body must read cleanly
without it. Keep it **≤50000 chars**. `heroImage`: a licence-verified cover URL
for the top of the post page (sourcing SOP in the `blog-authoring` skill §4 —
Commons/Flickr-CC with credit, or Unsplash/Pexels), else omit the key — never
invent a URL, never use an unverified-licence image. The reviewer can also set
it later in the `/blog` editor. Shares always use the branded card
(`app/(app)/blog/[slug]/opengraph-image.tsx`), cover or no cover.

## Step 5 — Handoff (approval-gated — NOT part of this routine)

A human reviews `drafts/<slug>.md`, then the **separate deterministic insert**
creates the prod draft (Supabase-gated — the deferred issue): convert the `.md`
to `drafts/<slug>.json` (a committed `scripts/` converter — pull metadata from
the comment block, drop the leading `# H1`, enforce the caps), then:

```
SUPABASE_URL=<prod> SUPABASE_SERVICE_ROLE_KEY=<prod> BLOG_AUTHOR_ID=<id> \
  npx tsx scripts/draft-post.mts drafts/<slug>.json
```

That lands a `status='draft'` on prod + pushes admins. The operator approves +
sets/confirms `publish_at` in `/blog`; the `publish-posts` cron publishes at the
target time. **This routine never runs that insert itself** — the model never
holds the service-role key.

---

## Hard guardrails

1. Draft only. Never approve, never publish, never write to the DB from here.
2. Hard numbers come from the context pack (our loaders); narrative from verified
   primary sources. Pack vs source conflict on a hard fact → **STOP and flag.**
3. No invented facts, quotes, or links. Flag results that can still change on
   appeal as **provisional** (penalties are sometimes overturned days later).
4. `marquee: null` → no event this cycle → no post.
5. Stay within `DraftInput` limits (title 140 / summary 300 / body 50000).
