# Content authoring — Paddock literacy tabs

Working space for the prose content rendered in the per-series literacy tabs (History, Rules, Champions narrative, About, etc.). Finalised content moves from `drafts/<file>.md` here to its production home under `content/series/<slug>/<file>.md`. Working drafts stay in `drafts/` with the full iteration history.

## Why this exists

- Drafts go through multiple iterations before lock. Keeping the iteration history visible is the point.
- Sources are shared across series. Centralising them in `SOURCES.md` lets every draft point at the same canonical list rather than each draft re-citing.
- The drafting protocol — voice, structure, sources, principles — gets reused across 15 series. Documenting it once prevents drift.
- Author attribution is operator-side; no Claude attribution lands in production content. (See the `feedback-paddock-espa` memory rule.)

## File layout

```
docs/content-authoring/
├── README.md                 (this file — drafting protocol + 12 principles)
├── SOURCES.md                (canonical tiered source list, shared across drafts)
└── drafts/
    ├── f1-history.md         (working draft + iteration log + alternates)
    ├── f1-rules.md           (later)
    ├── motogp-history.md     (after F1 history locks)
    ├── wec-history.md        (after MotoGP history locks)
    └── ...
```

## Frontmatter pattern

**Working drafts in `drafts/`:**

```yaml
---
target-path: content/series/<slug>/<tab>.md
status: draft-N
author: Paris Paraskevas
last-updated: YYYY-MM-DD
sources: ../SOURCES.md
---
```

**Locked production files (after move to `content/series/<slug>/`):**

```yaml
---
title: History
author: Paris Paraskevas
last-updated: YYYY-MM-DD
---
```

The tab React component reads `author` + `last-updated` from frontmatter and renders a small byline at the bottom of the tab:

> *Authored by Paris Paraskevas. Last updated DD Month YYYY.*

Frontmatter never contains a Claude / co-author / contributor field for AI assistance. Operator attribution only.

## Drafting protocol

1. **Pick the structure.** History tabs follow the three-section template: **Origin / Turning points / Today's shape**. Turning points subdivides into H3 (Technical revolutions / Safety reform / Contested championships, or series-equivalent) when total length passes ~200 words.
2. **Voice is encyclopedic neutral.** Third person, past tense for historical facts, present tense for current state. No marketese, no second-person, no teaser language.
3. **Source every load-bearing claim.** Prefer Tier 0 / 1 / 3 / 4 from `SOURCES.md`. Wikipedia is acceptable as a last resort; flag for replacement in subsequent source-refinement passes.
4. **Iterate in the working draft file.** Each draft gets a labelled section in the iteration log. Discarded alternates are preserved at the bottom for potential reuse.
5. **Lock = move.** When the operator approves a draft, the locked prose moves to `content/series/<slug>/<tab>.md` with trimmed frontmatter. The working draft in `drafts/` keeps the full iteration history.
6. **Author attribution.** Every locked file carries `author: Paris Paraskevas` in frontmatter. The tab React component renders the byline. Never Claude.

## 12 article-authoring principles

The literature comes from the Wikipedia Manual of Style, the Nielsen Norman Group's web-readability research (since 1997), GOV.UK content design, and WCAG 2.2 § 3.1.5 (reading level).

### Non-negotiable

1. **Inverted pyramid.** Most important information first. The first paragraph must answer "what is this and where does it come from?" in a tweetable form.
2. **Front-load each paragraph.** The first sentence of every paragraph carries the new key fact. Don't make readers wait for the point.
3. **Neutral register.** No marketese, no hype. Kill *iconic, legendary, historic, ultimate, passionate fans, the sport we love*. Wikipedia MoS.
4. **Sentence-case H2/H3, front-loaded.** Headings omit initial *the / a* and avoid repeating the article title. Sections start at H2; subsections H3.
5. **Scannable structure.** H3 every 100–150 words. Short paragraphs (≤3 sentences ideal). Eye-tracking research is unambiguous: 79 % of users scan, only 16 % read word-by-word.
6. **Reading level around grade 9.** WCAG 2.2 § 3.1.5 (AAA) target. Sentences ≤20–25 words; paragraphs ≤3 sentences ideal. Proper nouns (FIA, FISA-FOCA, Concorde Agreement, MGU-K) don't count against the score.

### Follow with judgement

7. **Active voice by default.** Passive only when the patient is the load-bearing subject ("ground-effect aerodynamics were banned in 1983"; "Senna was disqualified for missing a chicane").
8. **No *you / we / I*, no *of course / in fact / obviously*.** Third person throughout. Wikipedia MoS.
9. **No teaser / invitational language.** No "read on to discover…", "what makes F1 truly unique…", "let's dive into…". Every sentence delivers a fact or anchors the next one.
10. **One direct quote per source max, under 15 words.** Quote only when wording is the point.
11. **Internal cross-references over expanded explanations.** If History mentions hybrid power units, link to Rules where the spec is explained rather than re-explaining.

### Override

12. **Prose over bullets.** Paddock literacy content is already terse; the "lists over prose" NN/G rule conflicts with operator preference. Use prose, just keep it tight. Lists are appropriate for Rules tabs and tabulated comparison data.

## What "lock" looks like

1. Operator approves the working draft in `drafts/<slug>-<tab>.md`.
2. The prose block (without iteration log / alternates) gets copied to `content/series/<slug>/<tab>.md` with trimmed frontmatter.
3. The React component for the tab (e.g. `components/tabs/HistoryTab.tsx`) reads the markdown via `loadMarkdownAsHtml` and renders. The component reads frontmatter `author` + `last-updated` and emits the byline at the bottom.
4. A commit lands the new file + any component refactor. Conventional-commits prefix `feat(content):` for content-only, `feat(series):` for component + content together.
5. Working draft stays in `drafts/` for future reference and revision.

## When NOT to use this directory

- Single-file content updates that don't need iteration (typo fixes, date bumps, factual corrections the operator authors directly).
- Per-round / per-session content (`sessions.json`, `rounds.json`, etc.) — those have their own home under `content/series/<slug>/`.
- Champions JSON data — already authored via `content/series/<slug>/champions.json`.
- Blog posts — `content/posts/*.mdx`, different shape entirely.
- Legal pages — `content/legal/*.md`, different audience and structure.
