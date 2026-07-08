# SEO optimization plan — Information hub & site-wide

**Date:** 2026-07-08 · **Status:** plan / reference (execution phased, operator-approved per phase)
**Related:** [`2026-07-07-information-hub.md`](./2026-07-07-information-hub.md) (two-tier model rationale) · [`2026-07-07-information-question-catalog.json`](./2026-07-07-information-question-catalog.json) (278 questions) · [`content-gaps-2026-06-11.md`](./content-gaps-2026-06-11.md)
**Code homes:** `lib/information/{registry,generated,curated}.ts` · `lib/seo.ts` · `lib/sitemap-data.ts` · `lib/json-ld.ts`

---

## Current state (measured 2026-07-08, post-promotion / PR #442, v0.179.0)

- **696** information-hub pages total · **696 verified** · **0 unverified** · **221 indexed** (cap `INFORMATION_MAX_INDEXED=225`).
- Indexed 221 = 138 track profiles + 17 per-country + most-famous + 12 team histories + rising-stars watchlist + 36 champion/record + 16 editorial explainers.
- **Non-indexed 475**, of which:
  - **473 = "Who won the {year} {series} championship?" stubs** — avg body **192 chars** (~1 sentence), auto-generated from vetted `champions.json`; `verified` but `featured:false` → `noindex` by design.
  - 2 = F2/F3 predecessor-era record pages (held for name-stability).
- Non-indexed by topic: endurance 140, formula-1 114, motogp 113, rally 46, feeder-series 37, stock-cars 25.

### Indexed-quality audit (the bigger finding)

Of the **221 _indexed_ pages, 166 (75%) are under 300 characters** — only ~29 are genuinely substantial:

| Bucket | n | avg body | thin (<300) | verdict |
|---|---|---|---|---|
| editorial + team histories | 28 | 1,164 | 0 | strong — crown jewels |
| rising-stars watchlist | 1 | 14,423 | 0 | strong |
| record pages ("most X") | 22 | 704 | 16 | mixed (lists) |
| per-country ("tracks in X") | 17 | 675 | 4 | templated — liability |
| most-famous | 1 | — | 0 | ok (curated list) |
| track profiles | 138 | **192** | 131 | all stubs (facts-table + 1 sentence) |
| who-won (current champ) | 15 | 185 | 15 | stubs |

The aggressive 2026-07-08 promotion indexed **~190 thin, templated, batch-created pages while the AdSense "low value content" review is open** — the exact scaled-content fingerprint the 2024 core/spam updates target. The 138 track profiles are 1-sentence stubs leaning on a facts table, not the "crown jewels" first assumed.

## The reframe (central insight)

The "other 400+ pages" **do not need verification** — every hub page is already verified. The 473 stubs are un-indexed **by design**: indexing hundreds of near-identical one-sentence pages is the textbook Google **"scaled content"** pattern the two-tier gate was built to prevent — and actively dangerous while the AdSense **"low value content"** review is open.

> The goal is not "verify them to unlock indexing." It is **"make them substantial enough to *deserve* indexing."** Depth, not a verification checkbox.

**The sharper problem isn't the *non-indexed* stubs — it's that ~190 of the *already-indexed* 221 are themselves thin/templated** (see the audit above). The AdSense fight is about the quality of what Google *already sees*. The operator chose to address this by **enriching those pages in place** rather than de-indexing them (see Decision locked).

## Decision locked (2026-07-08)

**Index policy for the 473 who-won stubs: enrich-recent, hold-old.**
- **Enrich + index:** recent ~10 seasons per series **+ every title-decider season** (dramatic/searched years).
- **Hold `noindex` (but keep `verified` → searchable):** the deep-historical remainder, until/unless enriched.
- **Enrichment source priority:** our OWN results/standings pipelines first (factual, zero-fabrication, scalable); Wikipedia-backed batched research for seasons our data doesn't cover.
- Rationale: quality-first, AdSense-safe, still captures the high-value long-tail without flooding the index with stubs.

**AdSense-fight strategy: ENRICH-FIRST, do NOT de-index (operator decision, 2026-07-08).**
- De-indexing the ~190 thin indexed pages down to a ~40-page "strict quality core" was considered and **declined** — the operator prefers to enrich thin pages *in place* over walking back the promotion.
- **Binding consequence:** thin pages stay indexed while enrichment proceeds, so **do NOT re-request the AdSense review until enrichment has landed.** Enrichment velocity is what shrinks the risk window.
- Trade-off accepted: the current / near-term review reflects the thin content; the only mitigation is enriching fast. The 138 track stubs are the largest chunk and the top depth priority.

---

## Strategy — 7 levers (not just keywords)

**1. Indexation policy.** Raise the *bar a page must clear*, not just the cap. A thin stub in the index drags the whole domain's quality signal. Gate stays; new content still defaults `unverified`→`noindex`.

**2. Depth — enrich generated pages from our own data (the key play).** Deepen who-won stubs into real season summaries — points margin, wins, poles, runner-up, constructor battle, title-decider round — factually, at scale. Recent seasons from our parsers; historical from research. A 400-word sourced recap earns its index slot.

**3. New surface area.** "Weirdest regulations per series" (requested, unbuilt); driver-profile pages (topic `drivers` is nearly empty); the 278-question catalog → editorial pages; comparison / era / glossary pages.

**4. Internal linking & architecture.** Hub→spoke link equity: `/series/*` + home → hub entries; cross-link related entries; eliminate orphans; funnel authority inward.

**5. Technical SEO.** Unique meta titles/descriptions per page (`lib/seo.ts`); canonicals; QAPage/Article/Breadcrumb JSON-LD coverage (`lib/json-ld.ts`); Core Web Vitals (append `docs/perf-baselines.md`); sitemap freshness (`lib/sitemap-data.ts`) + IndexNow ping.

**6. Search-intent mapping.** Target real informational queries from the catalog — "who won…", "how does … work", "difference between…", "best circuits…", long-tail.

**7. Measurement loop.** Search Console coverage + queries → find pages earning impressions → double down; watch "crawled – currently not indexed" (Google's own thin-content tell).

---

## Flat task list

Copy-ready. Grouped for legibility; each numbered line is one task.

### A. Immediate (the already-live 221)
1. **HOLD the AdSense re-review request until enrichment lands** (enrich-first decision) — re-submitting now has the reviewer judge the ~190 thin pages.
2. Record baseline: current Search Console coverage (indexed / excluded / "crawled – currently not indexed") as the before-snapshot.
3. Submit/refresh sitemap in Google Search Console; monitor how the 221 register over the enrichment period.
4. `npm run indexnow:submit` — ping search engines with live URLs (outward-facing; low priority under enrich-first — Google crawls the sitemap regardless; optionally defer until pages are enriched).

### B. Policy & data audit (decided policy = enrich-recent, hold-old)
4. Per series, list the season set to enrich+index: last ~10 seasons + every title-decider year (define "decider" = title settled in the final ≤2 rounds, or by ≤X points).
5. Audit which series/seasons have usable data in our results (`lib/results/*`) + standings (`lib/standings/*`) pipelines → split "auto-enrich from our data" vs "needs research."

### C. Depth — enrich the thin INDEXED pages *in place* (top priority — this is what Google sees now)
6. **Track profiles (138 stubs, avg 192 chars — the biggest chunk).** Enrich each into a real 300–500-word circuit guide: history, layout/character, notable races, lap record, why it matters — keep the facts table + map. Batched, fact-checked (RULE #1). **The #1 depth task.**
7. **Per-country pages (17 templated lists).** Add a unique editorial intro per country (motorsport heritage, marquee events) so they aren't pure link lists; consolidate the thinnest.
8. **Record pages ("most X" — 16 of 22 are <300 chars).** Expand the short ones with context (era, notable holders, near-misses, streaks).
9. **Who-won pages (473 non-indexed stubs).** Extend `lib/information/generated.ts` to render season stats (margin, wins, poles, runner-up, decider round) from our own results/standings data; batched research for seasons our data lacks. Apply the enrich-recent/hold-old policy: enrich + `featured` recent + title-decider seasons; hold deep-historical `noindex`.
10. Raise `INFORMATION_MAX_INDEXED` as the who-won enrichment adds worthy pages (staged). Under enrich-first, the *already-indexed* set stays put while its quality rises to match.

### D. New content
11. Build "weirdest regulations per series" (research + fact-check per RULE #1).
12. Motorsport-101 editorial Q&A for `general` + `drivers` (the deferred Content step).
13. Triage the 278-question catalog → prioritize by search intent → editorial pages.
14. Driver-profile pages for the `drivers` topic (from our champions/data).

### E. Linking & technical
15. Internal-link audit: cross-link related info entries; link `/series/*` + home into the hub; find/fix orphans.
16. Verify every indexed page has a unique, keyword-considered `<title>` + meta description (`lib/seo.ts`).
17. Extend structured-data coverage; validate with Google Rich Results test.
18. Core Web Vitals pass on info routes; append to `docs/perf-baselines.md`.

### F. Measure & iterate
19. 2–4 weeks post-index: pull Search Console queries; identify winners/losers; iterate titles + depth.
20. Re-run the non-indexed breakdown (`scratchpad seo-breakdown` pattern) after each enrichment wave to track index growth vs quality.

---

## Execution method

**Ultracode recommended for phases C & D** — broad (hundreds of pages) *and* research + fact-check heavy: batched research agents (5–6 items/agent per budget guidance) + an adversarial verify pass, in operator-approved phases. Phases A, B, E are inline or small. Never bulk-flip `featured` — enrichment must land *before* indexing, page by page.

## Guardrails (carry from the two-tier model)

- New content defaults `unverified`→`noindex`; aggregate pages derive review from members.
- The ~190 already-indexed stubs stay indexed (enrich-first decision) — mitigate via enrichment velocity + **holding the AdSense re-review**; do NOT index any *new* stubs.
- Watch Search Console for "scaled content" / "crawled – currently not indexed" after each wave; back off if quality signals dip (the AdSense review is the binding constraint).

## Open questions

- Do our results/standings pipelines hold enough *historical* season data to auto-enrich, or is enrichment mostly research for pre-~2015 seasons? (Task 5 resolves.)
- Exact "title-decider" definition per discipline (points systems differ).
- Target indexed-count ceiling for the AdSense re-review — how aggressive after the first enrichment wave settles.
