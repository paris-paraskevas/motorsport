# Motorsport Information Hub — research, design & implementation (2026-07-07)

A new `/information` section: a "questions answered" + reference area (Q&A, per-series
records, team histories, a world tracks directory, and a feeder rising-stars watchlist).
Built in one overnight autonomous session. This doc is the research + plan + build record
(the "5 PRs" were delivered as one reviewable branch — see *Delivery* below).

## 1. Goal (operator brief)

Hundreds of original, SEO-indexed, sourced Q&A pages across motorsport (F1, feeders,
karting, MotoGP, endurance, rally, stock cars, dirt), plus per-country tracks with location,
team histories, year-by-year records, and up-and-coming feeder drivers — "500–1000 pages",
easily clickable, funnelling traffic into the rest of the site. **Explicit constraint from the
operator: be careful how many pages hit the sitemap so Google Search Console doesn't flag
spam.**

## 2. The governing tension (the key decision)

paddock-tracker.com has an **active AdSense "low value content" rejection** (IDEAS inbox,
2026-07-07) *because* the site is mostly aggregated third-party data. Mass-publishing
hundreds of auto-generated pages is exactly what triggers Google's **"scaled content abuse"**
spam policy and deepens the AdSense problem. Yet the operator wants hundreds of pages.

**Resolution — a two-tier trust model that lets us build at scale but publish conservatively:**

| Tier | Source | Rendered? | On-site search? | Indexed + in sitemap? |
|---|---|---|---|---|
| **verified + featured** | our fact-checked champions data / hand-written cited explainers | yes | yes | **yes** (capped) |
| **verified, not featured** | champions-derived long tail | yes | yes | no (`noindex`) |
| **unverified** | LLM/web-researched (tracks, team histories, rising stars) | yes (draft banner) | **no** | no (`noindex`) |

So the section can hold **577 pages** today while only **51** — all genuinely factual and
sourced — are indexable and in the sitemap. Nothing an LLM researched overnight is exposed
to Google or on-site search until an editor promotes it. This satisfies both the operator's
scale goal and the anti-spam / [RULE #1 fact-checking] constraint simultaneously.

Indexing knob: `INFORMATION_MAX_INDEXED` (150) in `lib/information/registry.ts`, plus the
per-entry `featured` flag. Raise these as content proves out and **after AdSense re-review**.

## 3. Data sources

- **Champions (`content/series/<slug>/champions.json`) — the verified backbone.** Every one
  of the 15 series has a curated, already-fact-checked champions file. `lib/information/generated.ts`
  turns these into Q&A: "Who won the {year} {series} championship?" for every season, plus
  per-series "most titles" record pages. ~526 verified entries, zero fabrication.
- **`content/circuits.json`** — 38 circuits with verified coordinates; used to seed the tracks
  directory and to override/verify a track's lat-lng (`coordsVerified`).
- **Agent-researched datasets (unverified):** team histories, feeder rising stars, and the
  broader tracks list — drafted by background research agents, sourced + confidence-flagged,
  shipped `noindex` until reviewed.
- **Question catalog** (`docs/research/2026-07-07-information-question-catalog.json`) — 278
  real FAQ-style questions across all topics, for future editorial work. Only 6 are answerable
  purely from our data (all already covered by the generator's record pages).

## 4. Architecture

```
lib/information/
  types.ts       InfoEntry / TrackFacts / InfoReview model + helpers
  topics.ts      10 topics + series→topic map
  generated.ts   verified Q&A from champions.json (the scale + accuracy backbone)
  curated.ts     editorial answers (md) + tracks.json + team-histories.json + rising-stars.json
  registry.ts    merge + dedupe + INDEXING GATE (verified && featured && cap) + memo
app/(app)/information/
  page.tsx                 hub (indexable)
  [topic]/page.tsx         topic index (indexable iff ≥1 verified entry; tracks = directory)
  [topic]/[slug]/page.tsx  entry (QAPage JSON-LD + noindex gate + track facts + sources + links)
components/information/InfoUi.tsx   TopicCard + EntryRow
content/information/
  answers/*.md             15 hand-written verified explainers (featured)
  tracks.json              38 venues (coords verified; facts unverified)
  team-histories.json      12 marquee teams (unverified)
  rising-stars.json        51 feeder drivers (unverified)
```

Integrations: `lib/sitemap-data.ts` (gated info URLs), `lib/search-index.ts` (`info` type,
verified-only), `lib/json-ld.ts` (`qaPageLd`), `components/AppShell.tsx` + `Footer.tsx` (nav).

Every entry deep-links back into the live site (series, champions tabs, drivers) — the
traffic-funnel requirement. Pages prerender only the indexed set (`generateStaticParams`);
the long tail renders on-demand + ISR (mirrors `/drivers/[slug]`).

## 5. Feeder rising-stars tracking

`content/information/rising-stars.json` → a single watchlist page at
`/information/feeder-series/up-and-coming-drivers-to-watch`, grouped by ladder (F2/F3/F4/
karting/F1 Academy/Indy NXT/NASCAR/Junior WRC). **Update cadence:** refresh after each F2/F3
title decider and at season start; prune graduates to F1, add new champions. Automating this
from live F2/F3 standings is a future enhancement.

## 6. Google Maps

Track pages link out to Google Maps via a plain query URL
(`google.com/maps/search/?api=1&query=lat,lng`) — **no API key, no billing, no cost**. An
embedded interactive Maps API (key + billing + domain restrictions) is deferred as an
operator decision.

## 7. Delivery vs the "5 PRs"

Delivered as **one branch** `feat/motorsport-information-hub` with logically separated commits
(research/data → infra → content → integration/tests). Rationale: (a) the pieces are tightly
coupled and share types; (b) I cannot push in an unsupervised run, so stacked remote PRs add
no value; (c) one branch is easier to review as a whole. It can be squash-merged as one PR or
split. **Nothing is pushed — publishing is the operator's call** (production event + the
sitemap/AdSense timing decision).

## 8. Verified vs needs-review (RULE #1)

- **Verified & safe to index:** champions-derived Q&A (from our data) + 15 editorial explainers
  (evergreen, cited — still worth a spot-check).
- **Drafts to fact-check before promoting:** 12 team histories (agent self-verified but not
  editor-checked), 38 tracks (coords verified; length/opening deliberately omitted, not
  guessed), 51 rising stars. All `noindex` until you set `review:"verified"` (+ `featured:true`).

## 9. Follow-ups

1. Retry the broad tracks dataset (agent stalled twice on large inline output — resume it to
   write straight to a file, or curate incrementally).
2. Fact-check + promote draft datasets to grow the indexed set.
3. Answer high-value catalog questions as editorial pages (278 queued).
4. Consider a mobile bottom-bar slot for the hub (left out to avoid an unverified layout change).
5. Automate rising-stars from live standings; automate "who won" freshness at season end.
