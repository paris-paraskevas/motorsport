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

## The reframe (central insight)

The "other 400+ pages" **do not need verification** — every hub page is already verified. The 473 stubs are un-indexed **by design**: indexing hundreds of near-identical one-sentence pages is the textbook Google **"scaled content"** pattern the two-tier gate was built to prevent — and actively dangerous while the AdSense **"low value content"** review is open.

> The goal is not "verify them to unlock indexing." It is **"make them substantial enough to *deserve* indexing."** Depth, not a verification checkbox.

## Decision locked (2026-07-08)

**Index policy for the 473 who-won stubs: enrich-recent, hold-old.**
- **Enrich + index:** recent ~10 seasons per series **+ every title-decider season** (dramatic/searched years).
- **Hold `noindex` (but keep `verified` → searchable):** the deep-historical remainder, until/unless enriched.
- **Enrichment source priority:** our OWN results/standings pipelines first (factual, zero-fabrication, scalable); Wikipedia-backed batched research for seasons our data doesn't cover.
- Rationale: quality-first, AdSense-safe, still captures the high-value long-tail without flooding the index with stubs.

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
1. Run `npm run indexnow:submit` — ping search engines with the 221 live URLs (outward-facing; operator go).
2. Submit/refresh sitemap in Google Search Console; confirm the 221 register as indexed.
3. Record baseline: current Search Console coverage (indexed/excluded counts) as the before-snapshot.

### B. Policy & data audit (decided policy = enrich-recent, hold-old)
4. Per series, list the season set to enrich+index: last ~10 seasons + every title-decider year (define "decider" = title settled in the final ≤2 rounds, or by ≤X points).
5. Audit which series/seasons have usable data in our results (`lib/results/*`) + standings (`lib/standings/*`) pipelines → split "auto-enrich from our data" vs "needs research."

### C. Depth — enrich the who-won pages
6. Extend `lib/information/generated.ts` who-won builder to render season stats (margin, wins, poles, runner-up, decider round) where our data provides them.
7. Batched research (Wikipedia primary, fact-checked) to source the same fields for in-scope seasons our data doesn't cover.
8. Per series (F1, MotoGP, F2/F3, endurance/WEC, NASCAR, IndyCar, rally, +): enrich in-scope seasons, spot-verify, then `featured:true` on the enriched-and-worthy ones.
9. Raise `INFORMATION_MAX_INDEXED` to match the enriched count (staged, deliberate — never bulk-flip stubs).
10. Leave out-of-scope historical stubs `verified`+`noindex` (searchable, no banner) — do NOT feature.

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
- Never index a page that is still a stub — depth first, index second.
- Watch Search Console for "scaled content" / "crawled – not indexed" after each wave; back off if quality signals dip (AdSense review is the binding constraint).

## Open questions

- Do our results/standings pipelines hold enough *historical* season data to auto-enrich, or is enrichment mostly research for pre-~2015 seasons? (Task 5 resolves.)
- Exact "title-decider" definition per discipline (points systems differ).
- Target indexed-count ceiling for the AdSense re-review — how aggressive after the first enrichment wave settles.
