# Code audit — June 2026

Operator-ordered full-codebase audit at v0.36.0 (post-WEC-results merge, PR #140).
Method: staged line-level coverage by fresh agents — 5 sequential waves
(lib parsers → lib rest → components → app+api → config/infra), each reading
100% of its module's source lines, findings verified in-context against
consumers; then a cross-pass for application-level contradictions. Tests were
read on suspicion, not exhaustively. Judgment lenses per the auditor prompt:
(a) over-complexity · (b) code fighting code · (c) simpler-same-result ·
(d) faster · (e) AI mistakes.

Severity calibration: HIGH = wrong data shown to users / silent failure /
real perf cliff. MED = will bite maintenance or users eventually. LOW =
worth a line, no urgency. Fix-highs-same-session rule applies.

---

# The report (read this part)

Four waves, ~26k source lines, every line read. 60 findings: **7 HIGH, 23 MED,
30 LOW.** The headline isn't any single bug — it's that the same three habits
produced almost all of them. The six claims driving the HIGH fixes were
re-verified first-hand (prod probes + source greps) before anything below was
written down.

## What's actually wrong, in one paragraph

Paddock's correctness is mostly held by comments — and the comments keep
losing. The chart-vs-standings invariant, the "points are exact" snapshot
claim, round-number provenance, the date-only rule, even CLAUDE.md's own
landmine #6 (it describes fail-open crons; the code fails closed — the DOC is
the bug): every HIGH in this audit is a place where a written promise and the
running code quietly diverged, and nothing — no type, no runtime check, no
test — was positioned to notice. The second habit is copy-paste siblings
drifting (three accordion families, three timezone regimes, three "find
wikitable" walkers, three cron gating blocks — each fixed once, not N times).
The third is dead code with tests: ~15 exports/components/modules nothing
calls, several pinned by passing tests that certify the artifact rather than
the product.

## The seven HIGHs (all verified, all fixable this session)

1. **MotoGP weekend URLs serve pre-season tests as Rounds 1–3** (1b-1) —
   /series/motogp/weekend/1 is the Sepang shakedown, not the Thai GP; the
   real first three GPs are unreachable at any URL. Index-fallback round
   numbers collide with the curated number space.
2. **Six Formula E rounds 404 — including the season finale** (1b-2) — the
   4-day weekend merge swallows doubleheader race 2s; the sitemap advertises
   all six dead URLs. ~35% of the FE season has no page.
3. **F2 points are recomputed from hardcoded tables** (1a-2) while the
   already-fetched FIA payload carries canonical RacePoints — the exact bug
   class that bit F3 (25-vs-26) is live in F2 every feature race with a
   pole/FL bonus.
4. **"Standings at this round" sums points the parsers themselves document
   as incomplete** (1a-1) for F2/FE/IndyCar — a table that can flip adjacent
   ranks vs the Standings tab one click away, under a comment claiming
   "points are exact."
5. **Most clock times on the site are Europe/Athens for everyone, unlabeled**
   (2-1/1b-9) — while meta descriptions and landing copy promise "your local
   time." Only the home page actually upgrades to device-local.
6. **The home page ships the entire remaining season (~hundreds of KB) to
   every client to render 7 days and one integer** (2-2/3-2).
7. **scaffold-series.mjs says "Safe to re-run" and isn't** (4-1) — a rerun
   reverts curated meta.json fixes to a stale registry and ships in 90s.

## Two-sources-of-truth inventory (the cross-pass)

The application-level contradictions, ranked by user damage:

- **Which weekends exist**: sitemap derives from rounds.json; pages derive
  from groupByWeekend — they disagree today (FE 404s, MotoGP tests) and the
  ±365/+540-day grouping window means the gap widens every season (3-6).
- **Championship state**: standings tab (official scrape), trend chart
  (summed results), frozen snapshot (summed results, different inclusion
  rules for sprint extras — 1b-4), WRC accordion (per-rally tables that
  disagree ±3-6pts with the chart's source by design, 1a-7). Four paths, no
  reconciliation anywhere at runtime (1a-3: `totalsByDriver` is computed and
  never compared, with both operands in scope).
- **What time it is**: Athens-fixed (`formatLocal` default) vs device-local
  (HomeContent only) vs UTC day-bucketing under local times (1b-11, 2-1).
- **What gets notified**: notify cron skips date-only sessions; race-week
  cron doesn't (3-4 — fabricates "02:00" times in pushes); sprints never
  match the race regex (1b-15); UTC-midnight-crossing races can silently
  no-op results-ready (3-5); legacy subscriptions get everything from two
  crons and nothing from the third (3-16).
- **Series registry**: scaffold script registry vs meta.json (4-1); CLAUDE.md
  landmine #6 vs lib/cron-auth.ts (doc inverted); globals.css --s-* palette
  vs meta.json colors (4-7, 7 values disagree).

## What's GOOD (credit where due)

The parser fleet's fail-closed discipline is real (WEC standings is the one
fail-open exception, 1a-8). The security posture held a fresh adversarial
read: proxy auth matrix, cron fail-closed, push ownership, contact
rate-limit, XSS inventory — all clean, zero new HIGH security findings. The
0.36.0 WEC module came through its first audit clean. imsa.ts, openf1.ts,
and most of lib/'s small modules are exactly the right size. The house
"fail-closed + curated sidecar" architecture is sound — it's the enforcement
that's missing, not the design.

## Recommended fix order

- **PR-1 (tonight, fix-highs rule): data-wrong-on-prod.** 1b-1 + 1b-2 (round
  assignment: unmatched weekends leave the curated number space; merged
  weekends split by rounds.json overlap) → un-404s FE, fixes MotoGP URLs,
  heals the sitemap via 3-6's shared-source fix. 1a-2 (F2 → RacePoints,
  port the F3 pattern). 1a-1 (drop FE/IndyCar from the snapshot adapter
  until reconciled; F2 becomes exact via 1a-2). 4-1 (write-if-missing).
  One-line ride-alongs: 2-5 (delete the double legend), 3-4 (race-week
  date-only filter), 4-3 (two eslint ignore strings), 1a-9 (MotoGP sort).
- **PR-2 (next): honest times + light home.** 2-1 minimal (tz label on every
  Athens-rendered time; full device-local upgrade rides the home-v3 wave,
  which rebuilds those surfaces anyway), 2-2 (weekItems + counts payload).
- **Then home v3** on clean plumbing, folding the W5 information-budget pass.
- **MED/LOW cleanup batches** (dead kit + 9 packages, dead exports, crons
  gating helper, copy-paste extractions, blog SEO trio, about-page copy)
  are inventoried above and can ride future PRs — none gate launch except
  arguably 3-8 (blog sitemap/canonical, minutes of work).

## Process notes (for the honesty contract)

Coverage was staged: four fresh agents, each reading 100% of its module's
source lines (line counts in each wave's coverage table); tests read on
suspicion only. Six pivotal claims re-verified by the operator's session
directly (MotoGP/FE prod probes, F2 source, legend line, scaffold diff,
home payload). The 14 locked .claude/worktrees were inspected: the seven
scraper/* branches with one unmerged commit each are May-20 snapshots whose
features all shipped via later PRs — stale, safe to prune after a final
glance. Wikipedia-champions/season scrapers are unreachable behind 15/15
curated files (1b-8) — retirement decision is the operator's.

---

<!-- Wave 1a ledger — agent output verbatim; cross-pass annotations come later -->

# Wave 1a — lib/results + lib/standings (8,133 source lines, 27 files, all read)

## Coverage
| File | Lines read | Verdict |
|---|---|---|
| lib/results/dtm.ts | 81 (all) | 1a-14 |
| lib/results/f1.ts | 197 (all) | 1a-3, 1a-10 |
| lib/results/f2.ts | 326 (all) | 1a-1, 1a-2, 1a-11 |
| lib/results/f3.ts | 333 (all) | 1a-11 |
| lib/results/formula-e.ts | 1084 (all) | 1a-1, 1a-11, 1a-13 |
| lib/results/gt-world.ts | 349 (all) | 1a-6, 1a-10 |
| lib/results/imsa.ts | 221 (all) | clean |
| lib/results/indycar.ts | 431 (all) | 1a-1, 1a-12, 1a-13 |
| lib/results/motogp.ts | 238 (all) | 1a-5, 1a-9 |
| lib/results/nascar-cup.ts | 282 (all) | 1a-3, 1a-13, 1a-15 |
| lib/results/openf1.ts | 181 (all) | clean |
| lib/results/wec.ts | 429 (all) | clean |
| lib/results/wrc.ts | 776 (all) | 1a-7, 1a-10, 1a-12, 1a-13 |
| lib/results/wsbk.ts | 332 (all) | 1a-9, 1a-10 |
| lib/standings/dtm.ts | 267 (all) | clean |
| lib/standings/f1.ts | 106 (all) | clean |
| lib/standings/f2.ts | 163 (all) | 1a-4 |
| lib/standings/f3.ts | 154 (all) | 1a-4 |
| lib/standings/formula-e.ts | 371 (all) | 1a-11 |
| lib/standings/gt-world.ts | 259 (all) | clean |
| lib/standings/imsa.ts | 309 (all) | clean |
| lib/standings/indycar.ts | 108 (all) | clean |
| lib/standings/motogp.ts | 128 (all) | clean |
| lib/standings/nascar-cup.ts | 274 (all) | 1a-15 |
| lib/standings/wec.ts | 272 (all) | 1a-8 |
| lib/standings/wrc.ts | 285 (all) | 1a-12 |
| lib/standings/wsbk.ts | 178 (all) | 1a-11 |

Extra files read to confirm/refute suspicions: `lib/results-cache.ts` (reviver handles F2's nested shape — suspicion of stringified Dates in cache refuted), `lib/season-trend.ts`, `lib/results-ready.ts`, `components/weekend/WeekendStandingsSnapshot.tsx`, `components/tabs/ResultsTab.tsx` (lines 1–65, 600–941), `components/tabs/StandingsTab.tsx` (lines 195–757 + wins grep), consumer greps across `app/`, `components/`, `lib/`.

## Findings

### [1a-1] Frozen "Standings at this round" sums points the parsers themselves document as incomplete (F2, FE, IndyCar) — HIGH — lenses: (b)(e)
- Where: components/weekend/WeekendStandingsSnapshot.tsx:49-129 (adapters), :132-137 (doc-comment claims "points are exact"); lib/results/f2.ts:18-28 (admits FL/pole omitted); lib/results/formula-e.ts:40-48 (admits ±1-3pt bonus gap on motorsportweek-fallback rounds); lib/results/indycar.ts:39-47 + :305-308 (admits most-laps-led +2 and Indy 500 qualifying points are not computed). Rendered at app/(app)/series/[slug]/weekend/[round]/page.tsx:177 and the same `loadSnapshotSource` feeds app/(app)/drivers/[slug]/page.tsx and app/(app)/teams/[slug]/page.tsx.
- What: `buildStandingsAtRound` (lib/season-trend.ts:103-161) cumulates per-race `points` into a standings-shaped table. For F2 (hardcoded tables missing pole+2/FL+1 every round, plus red-flag truncation), FE (position-derived points on MW-fallback rounds, missing pole+3/FL+1), and IndyCar (missing +2 most-laps-led every race and Indy 500 quali points up to 12), the summed totals structurally cannot match the official standings shown one tab away. The only runtime guard, `hasWinnersOnly` (:28-32), catches the single-entry winners-only shape and nothing else. The snapshot comment "points are exact" is false for these three series.
- Why it matters: A table literally titled "Standings at this round", on four route families, shows totals that can disagree with the Standings tab by enough to flip adjacent ranks — the exact trust failure the CHANGELOG-locked chart invariant exists to prevent.
- Simpler/correct alternative: Apply the WRC adapter's own discipline (WeekendStandingsSnapshot.tsx:121-124 deliberately routes WRC through the reconciling chart-points table): drop F2/FE/IndyCar from the adapter map (they get the LinkOutFallback) until F2 reads canonical RacePoints (see 1a-2) and IndyCar/FE points are reconciled, or gate per-series with an explicit `pointsExact` flag instead of a comment.
- Confidence: high (code path verified end to end; magnitude estimates from the modules' own comments).

### [1a-2] F2 recomputes points from hardcoded tables while the page it already fetches carries canonical per-round points — the exact bug class fixed in F3 — HIGH — lenses: (b)(c)
- Where: lib/results/f2.ts:27-28 (SPRINT_POINTS/FEATURE_POINTS), :134-138 (pointsFor), :183 (points assignment); contrast lib/results/f3.ts:11-21 (rationale: red-flag Melbourne SR produced the operator-reported 25-vs-26 standings/results disagreement), :133-150 + :188-191 (reads `Standings[].RacePoints` — "already accounts for pole bonus, fastest-lap bonus, and red-flag-reduced scoring"). F2's manifest fetch is the same URL (`fiaformula2.com/Standings/Driver`, f2.ts:14) whose `Standings[].RacePoints` lib/standings/f2.ts:37 already types.
- What: F3 was migrated to canonical RacePoints after a real production discrepancy; F2 — same FIA template, same payload shape, same `[SR, FR]` pairs — still derives points from finishing position. Every F2 feature race is therefore short the FL (+1) and pole (+2) bonuses, and any red-flag-shortened race reproduces the F3 bug verbatim. The F2 header comment frames this as a deliberate fail-closed choice absorbed by `results-overrides.json`, but the F3 fix proves the zero-cost exact alternative exists in the already-fetched bytes.
- Why it matters: Wrong points in the F2 results accordion today, and the error feeds 1a-1's frozen standings. It also costs operator curation time per round that F3 no longer pays.
- Simpler/correct alternative: Port the F3 pattern: build `driverPoints` from the manifest page's `Standings[].RacePoints` and pass `pointsFor(driverId)` into `buildEntry`, deleting the two hardcoded tables. ~30 lines, already fixture-tested in the sibling (lib/results/f3.test.ts:318 pins exactly this behavior).
- Confidence: high.

### [1a-3] The chart-vs-standings invariant has no runtime enforcement — a silently dropped round understates the chart with both reconciliation operands in scope — MED — lenses: (b)(c)
- Where: lib/results/f1.ts:146-149 (one malformed entry ⇒ whole race returns null and vanishes from the season array); lib/results/nascar-cup.ts:225 (round dropped below MIN_ENTRIES_PER_RACE); components/tabs/StandingsTab.tsx:251-283 and :410-421 (chart built from those arrays and rendered next to the standings tables); lib/season-trend.ts:32-82 (`totalsByDriver` computed and returned but never compared to anything).
- What: For F1 and NASCAR the trend chart is summed from results feeds while the standings tables come from separate endpoints/tables. If any single round drops (page-boundary glitch, mid-edit Wikipedia article, one malformed row), the chart renders anyway with understated totals — the precise failure that forced the FE chart removal in 0.11.11 (ResultsTab.tsx:739-750 documents that incident). `buildSeasonTrendData` already returns `totalsByDriver`, and in both StandingsTab branches the official standings rows are in the same scope, yet no comparison happens.
- Why it matters: The project's highest-stated data invariant is enforced only by comments; its known historical failure mode (silent per-round drop) has no tripwire.
- Simpler/correct alternative: In `TrendSection` callers, suppress the chart when `max(|totalsByDriver[d] − standings.points[d]|)` over the top N drivers exceeds a small epsilon. ~10 lines, turns the invariant from discipline into code.
- Confidence: high (mechanism verified; probability of trigger is low per-round but the class has already shipped once).

### [1a-4] F2/F3 standings "wins" badge: equality-on-25 undercounts feature wins, and the same helper is copy-pasted onto team rows where it's meaningless — MED — lenses: (e)(b)
- Where: lib/standings/f2.ts:65-73 (`countFeatureWins`: `pair[1] === FR_WIN_POINTS`), :94 (drivers), :118 (constructors); lib/standings/f3.ts:57-65, :90, :114; rendered as "NW" badges at components/tabs/StandingsTab.tsx:141 and :179.
- What: Per the sibling module's documented finding (lib/results/f3.ts:188-190), `RacePoints` slots fold in pole and FL bonuses. A feature winner who also took pole/FL therefore carries 26-28 in the FR slot, not 25, and is not counted as a win — dominant weekends (the most win-like wins) are the ones missed. Worse, `parseConstructors` runs the same check on team-page rows where the FR slot is the two-car sum, so the constructor "wins" figure is noise (a win only registers when the team's second car scored exactly zero and the winner had no bonuses).
- Why it matters: A user-visible wins column that's systematically wrong in the direction of undercounting champions; the constructors variant is a copy-paste artifact that happens to type-check.
- Simpler/correct alternative: For drivers, count `pair[1] >= 25` (no non-win FR outcome can reach 25 given P2=18+2+1=21 max), or drop the wins badge for F2/F3; for constructors, stop passing RacePoints — omit `wins` entirely.
- Confidence: med (the folded-bonus model comes from the sibling's validated comment, not from a payload I could inspect; the constructors-sum critique holds under any model).

### [1a-5] MotoGP results: comment promises sequential politeness, code does a ~66-request parallel burst — MED — lenses: (e)(d)
- Where: lib/results/motogp.ts:198-203 ("sequentially per round for the classification fetches… keeps the burst polite") vs :203-225 (`Promise.all` over all ~22 events, each firing 1 sessions fetch + 2 parallel classification fetches).
- What: Nothing in the function is sequential: cross-round fan-out is `Promise.all`, and within a round RAC+SPR classifications are also `Promise.all`. Cold render = up to ~66 concurrent hits on the Pulselive CloudFront layer the comment says it's protecting. MotoGP is also the largest fan-out in the fleet yet has no KV layer (results-cache supports only f2/f3/wec, lib/results-cache.ts:90).
- Why it matters: The stated rate-politeness invariant is fiction; if Pulselive throttles bursts the way the F2 origin does (f2.ts:31-33), this fails on exactly the cold renders the comment claims to protect, and per-render latency is gated on the slowest of ~66 requests.
- Simpler/correct alternative: Reuse the F2/F3 `mapWithLimit` (limit ~5) over `ordered`, and/or extend `seasonCacheKey` to 'motogp'. The comment then becomes true instead of being edited.
- Confidence: high.

### [1a-6] GT World season results: 3-level uncapped fan-out per render, and the only fleet member with this shape that got no KV cache — MED — lenses: (d)(b)
- Where: lib/results/gt-world.ts:332-349 (`fetchAllGtWorldSeasonRaces`: listing → N event pages → M race pages, all `Promise.all`); consumed per-render at components/tabs/ResultsTab.tsx:801; contrast lib/results-cache.ts:4-16 (KV layer added for F2/F3 precisely because "N+1 fetch… is 2-3 seconds on every page render"), lib/results/wec.ts:378-418 (same medicine applied to WEC).
- What: A season is ~1 + 10 + 15-20 sequentially-dependent fetch waves against the SRO CMS with no concurrency cap and no cross-render cache beyond per-URL `revalidate: 3600`. The codebase already diagnosed this exact pattern as a 2-3s render cost and built the cure, then didn't apply it to the third consumer.
- Why it matters: Cold GT World results tab pays the full discovery chain on every ISR rebuild/instance; one slow CMS response stalls the whole tab.
- Simpler/correct alternative: Add `'gt-world'` to `seasonCacheKey` and wrap `fetchAllGtWorldSeasonRaces` in the same read/write-non-empty pattern as WEC; optionally cap the race-page wave with the existing `mapWithLimit`.
- Confidence: high.

### [1a-7] WRC ships two deliberately different per-round points truths on the same series page — held apart only by comments — MED — lenses: (b)
- Where: lib/results/wrc.ts:534-554 (chart source rationale: per-rally articles "occasionally disagree by ±3-6 points" with the championship table; "Callers should NOT render this in the per-rally accordion"); :367-477 (accordion entries carry per-rally "Total" points); components/tabs/ResultsTab.tsx:868-888 (accordion from `fetchWRCSeasonResults`) vs components/tabs/StandingsTab.tsx:424-453 (chart from `fetchWRCSeasonChartPoints`).
- What: This is seed claim #1 in miniature and confirmed: a user can expand round N in the Results accordion and read per-driver points that differ by ±3-6 from what the Standings-tab chart attributes to the same round. The split is the right engineering call (the championship table reconciles by construction), but nothing — no shared type, no provenance field on `RaceResult`, no render-time note — marks the accordion numbers as the non-authoritative set.
- Why it matters: The disagreement the module documents internally is user-observable across two tabs with no explanation; future maintainers can also wire the wrong feed into a new consumer (the snapshot adapter avoided it only via a comment).
- Simpler/correct alternative: Either overwrite accordion per-driver points from the championship-table cells (join on round+driver, keep classification order from the per-rally page), or add a one-line provenance caption on the WRC accordion. A `pointsAuthority: 'official' | 'derived'` field on the fetcher output would let consumers enforce the invariant instead of remembering it.
- Confidence: high (both code paths and both consumers verified; magnitude from the module's own comment).

### [1a-8] WEC standings parse fails open: a shifted/garbage trailing column yields a full table of zero-point rows — MED — lenses: (e)
- Where: lib/standings/wec.ts:92-99 (`parsePoints` returns 0 on unparseable input instead of failing the row), :108-116 (`lastCellText` anchors points on whatever the last `<td>` is).
- What: Every other parser in the fleet drops rows or fails the table when points don't parse (e.g. f1.ts:49, imsa.ts:171). Here, if fiawec appends any trailing column (a "Ref", a per-round cell, responsive chrome), every row still parses with `points: 0`, passes `MIN_ROWS_PER_TABLE`, and `foundAny` stays true — the standings tab renders a confident all-zeros championship instead of the "temporarily unavailable" placeholder the fail-closed convention promises.
- Why it matters: Silent wrong data in the exact scenario (CMS layout drift) the sanity floors elsewhere were built to catch.
- Simpler/correct alternative: Make `parsePoints` return `null` on non-numeric input and drop the row (keeping the legitimate `'-'`→0 case); zero-points-for-all could additionally fail the table.
- Confidence: high.

### [1a-9] MotoGP results tab renders oldest-round-first while WSBK (its cited precedent) and every other series render newest-first — MED — lenses: (b)(e)
- Where: lib/results/motogp.ts:227-235 (sorts ascending) + components/tabs/ResultsTab.tsx:903 (`preserveOrder` honors it); lib/results/wsbk.ts:305-309 (sorts descending, "most recent round first") + ResultsTab.tsx:925; ResultsTab.tsx:238-247 (default panel order is newest-first); motogp.ts:20-22 and :221-223 explicitly claim to mirror "the WSBK precedent".
- What: `preserveOrder` was copied from the WSBK call-site without copying WSBK's descending sort, so a 22-round MotoGP season opens on March's Thailand round and the user scrolls to find the latest race. Two sibling modules each cite the other as the convention while shipping opposite orders.
- Why it matters: User-visible inconsistency on a top-level tab; the latest race is the reason fans open Results.
- Simpler/correct alternative: Flip MotoGP's final sort to `b.round - a.round` (keeping GP-before-Sprint within a round), or drop `preserveOrder` and teach the panel's default comparator the Sprint/GP tiebreak.
- Confidence: high.

### [1a-10] Dead exports kept "for compatibility" with zero production consumers, pinned in place by tests — MED — lenses: (e)
- Where: lib/results/f1.ts:154-165 (`fetchF1LastRace` — only lib/results/f1.test.ts imports it); lib/results/wsbk.ts:318-332 (`fetchWsbkLastRace` — test-only, and internally refetches the entire season's ~37 requests to return one race); lib/results/wrc.ts:507-532 (`parseSeasonResultsFromHtml` — "Kept for backwards compatibility with anything that imports it"; grep shows nothing imports it outside its test; CHANGELOG.md:548's claim that `fetchWRCSeasonResults` uses it is stale — the fetcher calls `buildWinnerOnlyRace` directly); lib/results/gt-world.ts:235-241 + :304 (`GtWorldRaceOption.url` documented as a renderer fallback permalink but always set to `''`, and no consumer reads it).
- What: Four LLM-flavored "just in case" surfaces: two convenience fetchers nothing calls, one legacy function whose compatibility comment names no consumer, one struct field whose comment describes behavior that was never implemented. Each has tests asserting it, so the dead code reads as load-bearing and grows removal cost every season.
- Why it matters: Maintenance drag and a perf trap (anyone adopting `fetchWsbkLastRace` for a "last race" widget inherits a full-season fan-out); tests asserting dead code is exactly the (e) failure mode where coverage certifies the artifact rather than the product.
- Simpler/correct alternative: Delete all four plus their test blocks; if a "last race" view ever lands, derive it from the already-fetched season array at the call-site.
- Confidence: high (searched app/, components/, lib/).

### [1a-11] Copy-paste helper fleet: the same five concerns exist in 2-4 hand-rolled variants each — MED — lenses: (b)
- Where (seed claim #2 inventory, accidental-vs-load-bearing called out):
  - Wikipedia table machinery duplicated verbatim between lib/results/formula-e.ts:111-176 and lib/standings/formula-e.ts:38-178 (`cellText`, `BRACKET_ANNOTATION_RE`, `matchesHeader`, `findHeaderIndex`, `getColspan`, `logicalToDataIdx`, `rowText` — ~110 identical lines; the results copy even cites the standings file). Accidental duplication.
  - `extractNextData` ×4: lib/results/f2.ts:100-109, lib/results/f3.ts:100-109, lib/standings/f2.ts:50-63, lib/standings/f3.ts:46-55 — identical. Accidental.
  - `mapWithLimit` ×2: lib/results/f2.ts:235-253, lib/results/f3.ts:250-268 — identical 19 lines. Accidental.
  - JSON:API walkers ×2: lib/results/wsbk.ts:32-68 vs lib/standings/wsbk.ts:24-60 (`buildIncludedMap`, `asString`, `asNumber`) — identical; the singular-vs-plural `included` key handling (results/wsbk.ts:118-124) is the one load-bearing divergence and lives outside the helpers.
  - `MONTHS` maps ×3: lib/results/formula-e.ts:187-200 and lib/results/wrc.ts:87-100 identical; lib/standings/wec.ts:134-147's prefix-matching `monthIndex` is load-bearing (tolerates truncated/locale month strings from fiawec) and should stay distinct.
  - Two team-alias maps inside one file: lib/results/formula-e.ts:62-74 (`MW_TEAM_ALIASES`) and :100-105 (`TEAM_ALIASES`) overlap on Citroën→DS Penske with separate lookup functions.
- What: The house rule is "no new abstraction without a real second consumer" — these all have a real second (sometimes fourth) consumer already, and the copies are byte-identical, so the rule argues *for* extraction here. Divergences that matter (WSBK key shapes, WEC month prefixing) are not in the duplicated regions.
- Why it matters: The FE pair is the bite risk: a Wikipedia markup change gets fixed in one file and silently not the other (the two FE parsers feed different tabs of the same series).
- Simpler/correct alternative: One `lib/scrape/wikitable.ts` (cellText/header/colspan kit), one `lib/scrape/next-data.ts`, one `lib/map-with-limit.ts`, one `lib/scrape/jsonapi.ts`. No behavior change.
- Confidence: high.

### [1a-12] "Find wikitable after a heading" exists three times, each separately patched for the same 2024 mw-heading production bug — MED — lenses: (b)
- Where: lib/standings/wrc.ts:137-188 (`findTableAfterHeading`, h2/h3 stop logic; comment records the 0.11.9 prod failure), lib/results/wrc.ts:139-187 (`findFirstTableAfter`, h2/h3/h4 stop-level table), lib/results/indycar.ts:109-140 (`findDriverStandingsTable`, hardcoded id, cites "same fix that ships in lib/standings/wrc.ts").
- What: Three structurally different implementations of one Wikipedia-DOM concern, each independently carrying the `<div class="mw-heading">` wrapper workaround that already failed in production once. The variations (stop levels, id patterns) are parameters, not reasons for separate walkers.
- Why it matters: The next Wikipedia heading-markup change must be diagnosed and fixed three times; the 0.11.9 incident proves the failure mode is silent fail-closed (tab goes "temporarily unavailable" while data is live).
- Simpler/correct alternative: One `findTableAfterHeading($, idPatterns, {stopLevels})` in a shared scrape module; the IndyCar caller passes `[/^Driver_standings$/]`.
- Confidence: high.

### [1a-13] Comment-contradicts-code cluster (LLM authorship artifacts) — LOW — lenses: (e)
- Where/What:
  - lib/results/formula-e.ts:583-587 — comment: "Reject any external links defensively"; code: `if (href.startsWith('http')) return href;` — returns them. (Fail-closed downstream parsing limits damage to a wasted fetch.)
  - lib/results/formula-e.ts:678-707 — 30-line comment narrating a "+FL-bonus digit" parsing strategy the code never implements before concluding with the opposite (leading-integer-only) approach; the dead deliberation reads as spec.
  - lib/results/wrc.ts:362-366 vs :414-437 — doc-comment says retired rows get `points=0`; code correctly reads the Total cell (retirees can score Sunday/Power-Stage points under 2026 rules). The code is right; the comment teaches the wrong model.
  - lib/results/nascar-cup.ts:117-130 — the `text === 'Report' || (!url && /^2026_/...)` conditional is always true (`!url` is guaranteed by the early return; the selector already guarantees the `/^2026_/` prefix), so the documented "prefer Report link" logic is dead — the first `/wiki/2026_*` anchor wins regardless.
  - Dead-parameter/`void` residue: lib/results/indycar.ts:230+243 (`text` param computed by callers, voided), lib/results/nascar-cup.ts:199 (`void cells[COL_GRID]`), lib/results/wrc.ts:556+617-619 (`RALLY_HEADER_SLUGS` table and `headerLabel` computed then voided — 14-slug constant is entirely dead), wrc.ts:399-400 + :463 (`_carCell`, `coDriverName` parsed then voided), lib/standings/motogp.ts:87-88 (`MOTOGP_API_BASE = API_BASE` / `MOTOGP_CATEGORY_UUID_EXPORT` re-export shims).
- Why it matters: Individually harmless; collectively they erode trust in comments across a fleet where comments are the only thing enforcing the data invariants (see 1a-1/1a-7).
- Simpler/correct alternative: One sweep deleting dead constants/params and fixing the four lying comments.
- Confidence: high.

### [1a-14] Season-pinned constants with silent next-season behavior, worst in DTM's synthetic dates — LOW — lenses: (e)
- Where: lib/results/dtm.ts:66-70 (`Date.UTC(2026, 3, 1 + roundIdx * 30)` — year hardcoded, 30-day synthetic spacing) and :22-32 (9 hardcoded round labels); same pin pattern in lib/results/indycar.ts:55-74 (`INDYCAR_2026_SCHEDULE`), formula-e.ts:30 (`SEASON_PAGE`), wrc.ts:36-37, nascar-cup.ts:34-35, standings/imsa.ts:71-72, standings/gt-world.ts:38-42 (`SEASON_ID_BY_YEAR`, at least documented as a rollover chore).
- What: The DTM dates are sort-keys only today (chart/snapshot don't render them), so 2027 won't show wrong dates — but nothing marks them synthetic at the type level, and `results-ready.ts:18` already had to special-case "dtm (chart data carries synthetic dates)". The wider pattern means season rollover is an N-file manual sweep with no single checklist location.
- Why it matters: Maintenance trap, not a current bug. First missed file in the January sweep fails silently (stale 2026 data parsed as current).
- Simpler/correct alternative: Not worth machinery now (would violate the no-premature-abstraction rule); a one-line `// SEASON-PIN` grep marker on each constant makes the rollover sweep a grep instead of a memory exercise.
- Confidence: high.

### [1a-15] Two contradictory identification policies against the same Wikipedia upstream — LOW — lenses: (b)
- Where: lib/standings/nascar-cup.ts:250-251 and lib/results/nascar-cup.ts:38-41 send `PaddockTracker/1.0 (+https://paddock-tracker.com; contact: …)`; lib/standings/wrc.ts:34-36, lib/results/wrc.ts:40-42, lib/standings/imsa.ts:74-77, lib/standings/formula-e.ts:350-353, lib/results/formula-e.ts:82-83, lib/results/indycar.ts:24-26 all hit en.wikipedia.org masquerading as Chrome 130.
- What: The NASCAR modules adopted the Wikipedia-recommended identifying UA ("for log courtesy"); the five other Wikipedia consumers ship a spoofed browser UA, which Wikipedia's bot policy frowns on and which the NASCAR comment implicitly deprecates. Browser UAs are load-bearing for fiaformula2/3, indycar.com, gt-world (SPA-shell servers) — but not for Wikipedia.
- Why it matters: If Wikipedia ever rate-limits or blocks spoofed UAs from datacenter IPs, five series break while NASCAR survives, and the fleet's behavior under investigation looks inconsistent/evasive.
- Simpler/correct alternative: Use the PaddockTracker UA for all `en.wikipedia.org` fetches; keep browser UAs for the SPA-shell origins that require them.
- Confidence: high.

## Cross-wave handoff notes
- Round-number alignment is an unchecked join: `WeekendStandingsSnapshot` filters `r.round <= throughRound` where `round` comes from rounds.json grouping, but parser round numbers are synthesized differently per series (IndyCar = Wikipedia column index + 1, indycar.ts:412; MotoGP = date-sorted event index + 1, motogp.ts:204; WSBK = API `sequence_order`). App/components wave should verify rounds.json numbering matches each, especially IndyCar's MIL doubleheader (15/16) and any cancelled-round scenario.
- `loadSnapshotSource` is consumed by app/(app)/drivers/[slug]/page.tsx and app/(app)/teams/[slug]/page.tsx, not just weekend pages — finding 1a-1's blast radius and any fix must cover those pages' labeling too.
- `applyResultsOverrides` is a pure data function exported from components/tabs/ResultsTab.tsx and imported by WeekendStandingsSnapshot and StandingsTab — component-to-component import of lib-shaped code; consider relocating to lib/ (components wave).
- FE results' `'Race results — partial classification'` heading heuristic (ResultsTab.tsx:751-755) flips on `every(r => r.results.length > 1)` — check how it renders when exactly one round is winners-only.
- `fetchOpenF1WeekendSessions`/`fetchSessionClassification` consumers live in app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx — verify the ±36h overlap window against doubleheader weekends (two FE rounds inside one window) in the app wave.
- `lib/results-ready.ts` passes `new Date().getUTCFullYear()` as season for F3/MotoGP while tabs pass `series.meta.season` — fine for calendar-year series, but the cron wave should confirm no FE-style cross-year series is ever added to `RESULTS_DATE_SOURCES` without an adapter.
- Tests pin the dead exports listed in 1a-10 (f1.test.ts:90-141, wsbk.test.ts:325+, wrc.test.ts:163+, gt-world.test.ts asserting `url: ''` shape) — deleting the exports requires touching those test blocks; nothing else does.

---

# Wave 1b — lib/ core modules (3,612 source lines, 46 files, all read)

## Coverage
| File | Lines read | Verdict |
|---|---|---|
| lib/categories.ts | 28/28 | clean |
| lib/circuits.ts | 69/69 | 1b-5 |
| lib/content.ts | 56/56 | clean |
| lib/cron-auth.ts | 25/25 | clean |
| lib/date.ts | 46/46 | 1b-12, 1b-14 |
| lib/follow.ts | 37/37 | 1b-12 |
| lib/group.ts | 96/96 | 1b-2, 1b-10, 1b-11 |
| lib/ics.ts | 60/60 | 1b-6 |
| lib/indexnow.ts | 40/40 | 1b-12 |
| lib/json-ld.ts | 134/134 | clean |
| lib/months.ts | 32/32 | clean |
| lib/news.ts | 126/126 | clean |
| lib/notify-ledger.ts | 38/38 | clean (deliberate fail-soft, documented) |
| lib/onboarding.ts | 28/28 | 1b-12 |
| lib/people.ts | 109/109 | clean |
| lib/posts.ts | 70/70 | clean |
| lib/profile-stats.ts | 73/73 | clean (containment matching documented; risk noted in handoff) |
| lib/push-store.ts | 74/74 | 1b-7 |
| lib/push.ts | 64/64 | clean |
| lib/pushClient.ts | 81/81 | clean |
| lib/rate-limit.ts | 42/42 | clean |
| lib/results-cache.ts | 92/92 | 1b-14 |
| lib/results-ready.ts | 88/88 | 1b-15 |
| lib/rounds-loader.ts | 14/14 | clean |
| lib/rounds.ts | 39/39 | 1b-1, 1b-2 |
| lib/season-trend.ts | 161/161 | 1b-4 |
| lib/seo.ts | 43/43 | clean |
| lib/series-content.ts | 47/47 | clean |
| lib/series.ts | 122/122 | 1b-10 |
| lib/sessions-overrides.ts | 80/80 | 1b-6 |
| lib/significance.ts | 15/15 | clean |
| lib/site.ts | 15/15 | clean |
| lib/sitemap-data.ts | 56/56 | 1b-2 |
| lib/slug.ts | 12/12 | clean |
| lib/tabs.ts | 92/92 | 1b-9, 1b-14 |
| lib/tour.ts | 88/88 | 1b-13 |
| lib/types.ts | 269/269 | 1b-6, 1b-14 |
| lib/useFollowedSeries.ts | 107/107 | 1b-12 |
| lib/userPrefs.ts | 89/89 | clean |
| lib/utils.ts | 6/6 | clean |
| lib/version.ts | 3/3 | clean |
| lib/weather.ts | 179/179 | 1b-3 |
| lib/weekend.ts | 110/110 | 1b-12 |
| lib/wikipedia-champions.ts | 176/176 | 1b-8 |
| lib/wikipedia-season.ts | 341/341 | 1b-8 |
| lib/wikipedia.ts | 40/40 | clean (live via AboutTab) |

## Findings

### [1b-1] Unmatched weekends fall back to array index and collide with curated round numbers — MotoGP rounds 1–3 currently serve pre-season tests — HIGH — lenses: (b)(e)
- Where: lib/rounds.ts:25,29 (`return { ...w, round: i + 1 }`), lib/weekend.ts:31-35 (`weekendFor` find-first), confirmed via content/series/motogp/rounds.json + production probes
- What: When rounds.json exists but a weekend matches no entry (pre-season tests), `assignRoundsToWeekends` assigns `round = index + 1` — the same number space as curated rounds. MotoGP's Google-Calendar feed carries Feb test events inside `filterToSeason`'s window, so test weekends at indexes 0/1/2 get rounds 1/2/3, shadowing the real Thai/Brazilian/Americas GPs (which correctly match rounds.json 1/2/3 but sit later in the array; `weekendFor` returns the first hit). Production-verified: `/series/motogp/weekend/1` → "Sepang International Circuit · Round 1", `/weekend/2` → Sepang again, `/weekend/3` → Buriram test; rounds.json says R1=Thai GP (Buriram), R2=Brazil, R3=COTA. The real first three race weekends are unreachable at any URL, and the calendar tab shows duplicate round numbers.
- Why it matters: Canonical race-weekend URLs serve wrong events (tests instead of GPs) for a top-traffic series, silently — exactly the "wrong data on a stable URL" class. F1/WEC escape only because their feeds happen to omit tests.
- Simpler/correct alternative: When `rounds` is present, unmatched weekends should not enter the curated number space — assign `round: 0`/`undefined` (render "Testing", exclude from `weekendFor`/links), keeping `i + 1` fallback only when no rounds.json exists. ~5-line change in assignRoundsToWeekends plus a `round > 0` guard at render sites.
- Confidence: high (prod-confirmed three times over)

### [1b-2] 4-day gap merge + first-match round assignment swallows doubleheaders — six Formula E rounds (incl. season finale) 404 while the sitemap advertises them — HIGH — lenses: (b)(c)
- Where: lib/group.ts:53-63 (gap merge), lib/rounds.ts:26-28 (`rounds.rounds.find` first match), lib/sitemap-data.ts:43-52 (URLs from rounds.json), production probes
- What: `groupByWeekend` merges any sessions ≤4 days apart into one weekend; `assignRoundsToWeekends` then assigns the *first* overlapping rounds.json entry only. FE 2026 has six curated doubleheaders (R4/5 Jeddah, R7/8 Berlin, R9/10 Monaco, R12/13 Shanghai, R14/15 Tokyo, R16/17 London) whose race days are 1 day apart — each merges into one weekend carrying only the odd round. Production-verified: `/series/formula-e/weekend/5|8|17` → 404; the round-4 weekend's payload contains the "FE - Race (Jeddah R5)" session; the London round-16 weekend contains the R17 season-finale race. Meanwhile lib/sitemap-data.ts emits weekend URLs straight from rounds.json — all 17 FE rounds are in the live sitemap, so six advertised URLs 404. Two modules derive "which weekends exist" from different sources of truth. (Seed Q1 answer: pure endurance events are mostly *benign* — Le Mans test-day merge still matches its single round via interval overlap; the failure modes are multi-round windows and round-less test weekends, i.e. 1b-1 + this.)
- Why it matters: ~35% of the FE season has no reachable page, social/OG links to race 2s are dead, sitemap rot hurts crawl trust, and `WeekendStandingsSnapshot`'s `throughRound` for merged weekends under-counts by one round.
- Simpler/correct alternative: In assignRoundsToWeekends, when a weekend's range overlaps ≥2 non-cancelled round entries, split the group: bucket sessions by which round's [startDate, endDate] contains their date-key, emit one Weekend per round. Grouping stays heuristic; rounds.json becomes the splitting authority it already is everywhere else.
- Confidence: high (prod-confirmed)

### [1b-3] weather.ts is the only KV module whose reads/writes aren't error-guarded — a KV failure 500s the landing page — MED — lenses: (b)(e)
- Where: lib/weather.ts:107,122 (`kv.get`/`kv.set` bare), consumers app/(marketing)/page.tsx:109, components/weekend/WeekendWeatherStrip.tsx:20, app/(app)/app/page.tsx:33 (all call `fetchWeather` bare — verified)
- What: `fetchOpenMeteo` swallows network errors, but the KV cache read/write around it does not. rate-limit.ts and results-cache.ts wrap every KV op in try/catch with explicit "availability over strictness" comments; weather.ts skipped the pattern. All three consumers are page renders (marketing homepage, weekend page, /app) with no try at the callsite.
- Why it matters: An Upstash hiccup/auth rotation takes down the homepage render — the one KV consumer where the project's own fail-soft convention matters most.
- Simpler/correct alternative: Wrap the `kv.get` and `kv.set` in the same try/catch-return-null/void shape as results-cache.ts (6 lines).
- Confidence: high

### [1b-4] season-trend: sprint points for rounds missing a main race are silently dropped by the chart but counted by the standings snapshot — MED — lenses: (b)(e)
- Where: lib/season-trend.ts:66-81 (`extrasByRound.get(race.round)` only consumed for rounds present in `races`; `totalsByDriver` derives from the same loop) vs lib/season-trend.ts:109,132 (`buildStandingsAtRound` filters extras by round number independently)
- What: `buildSeasonTrendData` registers sprint-only drivers (lines 54-56) but never adds their points unless the round's main race exists in `races` — extras for an absent round vanish from both `data` and `totalsByDriver`. `buildStandingsAtRound` counts the same extras unconditionally. During every F1 sprint weekend's Saturday-evening-to-Sunday window (sprint published, GP not yet), the chart/legend totals and the weekend-snapshot/profile-stats totals disagree, and a sprint-only debutant appears in the chart legend with a flat 0 line.
- Why it matters: Two cumulators sharing one file and one data source implement different inclusion rules — recurring transient wrong-points on the project's flagship "data honesty" surfaces.
- Simpler/correct alternative: In buildSeasonTrendData, after the main loop, fold any unconsumed `extrasByRound` entries into a trailing synthetic point (or simply into `totalsByDriver` + last snapshot) so both functions agree; or document+test the discrepancy away by having StandingsTab drop extras whose round lacks a race before calling either.
- Confidence: high on mechanism, med on user-visible frequency (one window per sprint weekend)

### [1b-5] circuits.ts: the min-4-chars guard silently disables curated aliases — "Spa" and "IMS" in circuits.json can never match — MED — lenses: (e)(d)
- Where: lib/circuits.ts:65 (`if (alias.length < 4) continue;`), content/circuits.json (verified: `spa.aliases` includes "Spa", `indianapolis.aliases` includes "IMS")
- What: The guard exists to stop "spa" matching inside "spain", but it runs against curated aliases the operator deliberately added — they're loaded, sorted, then unconditionally skipped, with no warning. A session whose location/title only says "Spa" or "IMS" gets no circuit → no weather strip, silently. Sub-note (d): `matchCircuit` also rebuilds and re-sorts the full alias lookup on every call (homepage calls it in a loop of 4, /app up to 12) while caching only the raw JSON; the sorted lookup is as cacheable as the map.
- Why it matters: Violates the project's own authoring contract — curated data that ships but does nothing is worse than absent data, and the failure is invisible (weather just doesn't appear).
- Simpler/correct alternative: Replace the length guard with word-boundary matching for short aliases (`new RegExp(`\\b${alias}\\b`)` on the normalised haystack), or delete the dead aliases from circuits.json; cache the sorted lookup alongside `cache`.
- Confidence: high

### [1b-6] types.ts holds its critical invariants in comments, and two of them are already false at runtime — MED — lenses: (e)(a)
- Where: lib/types.ts:106-118 (Session), lib/types.ts:175-180 (SessionOverrideBlock), lib/types.ts:251-269 (Weekend), lib/ics.ts:37-38, lib/sessions-overrides.ts (whole file)
- What: Seed Q4 answer — the types are mostly honest records, but the load-bearing invariants are prose: (1) `Session.end: Date` is a lie — `ev.end` from node-ical can be undefined and lib/ics.ts:38 casts it straight through; consumers like `weekendStartEnd` return it as `Date`. (2) `dateOnly` ("UI must not display a clock time, notifications must not fire") is re-checked ad hoc at every consumer (SessionCard, HomeContent, Hero, weekend.ts, marketing page) with nothing forcing a new consumer to remember. (3) `SessionOverrideBlock.round` is a dead field — present in the type and in motogp/sessions.json (`"round": 1`), consumed by nothing (grep-verified in sessions-overrides.ts and repo-wide); curators are maintaining data the code ignores, which is extra ironic given 1b-1 — wiring this field into round assignment would have prevented the MotoGP shadowing. (4) `Weekend.round` provenance (curated vs index-fallback) is invisible to consumers, which is how 1b-1 stayed silent.
- Why it matters: Every wave-1 HIGH so far traces to an invariant that lived in a comment; the type system is available and unused for exactly the three fields that keep biting.
- Simpler/correct alternative: `end?: Date` (or `end: Date | undefined`) and fix the two call sites the compiler then flags; add `roundSource: 'curated' | 'fallback'` to Weekend (one line in rounds.ts); either consume or delete `SessionOverrideBlock.round`.
- Confidence: high

### [1b-7] push-store: 32-bit string hash as the subscription key — silent cross-user overwrite/delete on collision — MED — lenses: (e)
- Where: lib/push-store.ts:67-74 (`endpointHash`), used by save/delete/get at :25,:32,:40
- What: Subscription identity is a 32-bit FNV-style hash of the endpoint URL, base36. A collision means one user's subscription record overwrites another's (`saveSubscription` does a plain `kv.set`), and `deleteSubscription`/ownership checks operate on the wrong record. Probability is birthday-bounded (~1% at ~9k subscriptions, ~50% at ~77k) — small today, silent and undiagnosable when it happens, and this is the auth-adjacent store (`isSubscriptionOwner` trusts the stored record).
- Why it matters: Silent wrong-data class in the one KV namespace where records belong to different users.
- Simpler/correct alternative: `crypto.createHash('sha256').update(endpoint).digest('base64url').slice(0, 24)` — same call shape, collision risk gone; old keys age out naturally as subscriptions refresh (or accept dual-read during transition).
- Confidence: high on mechanism, low on near-term likelihood

### [1b-8] wikipedia-champions.ts + wikipedia-season.ts are now unreachable fallbacks behind 15/15 curated files — ~520 lines of scraper (+ ~440 test lines) kept warm — MED — lenses: (a)
- Where: lib/wikipedia-champions.ts (176), lib/wikipedia-season.ts (341); gates verified at components/tabs/ChampionsTab.tsx:368-386 (curated short-circuits `fetchChampions`) and components/tabs/DriversTab.tsx:61-67 (curated return before `fetchSeasonLineup`); content verified: all 15 series have champions.json AND drivers.json
- What: Seed Q3 answer — wikipedia.ts (summary) is live via AboutTab and clean. The other two only execute if a curated file is deleted or fails to parse (series-content.ts swallows JSON.parse errors to null, which would silently re-enable the scraper — a worse outcome than a build error under the conversational-authoring model). wikipedia-season.ts in particular is the most complex code in this wave (rowspan/colspan resolution, multi-row header flattening, credibility heuristics) and its `resolveRowspans` has a known-fragile colspan-overlapping-rowspan interaction — all maintained for a path that no longer runs.
- Why it matters: Highest complexity-to-value ratio in lib/; it also masks curated-file syntax errors by quietly substituting scraped (or empty) data.
- Simpler/correct alternative: Decide retirement: delete both modules + tests and make the tabs render the existing "no data" affordance when curated files are missing; or keep them but make series-content.ts log loudly (or fail build via the test suite) on malformed curated JSON so the fallback can't engage silently.
- Confidence: high on reachability facts; the keep/delete call is the operator's

### [1b-9] Two coexisting timezone regimes, and the SEO copy promises the one most pages don't implement — MED — lenses: (b)(e)
- Where: lib/date.ts:26 (`formatLocal(date, tz = 'Europe/Athens')`), callers components/SessionCard.tsx:71, components/weekend/WeekendSchedule.tsx:90, app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx:425 (all omit tz — server-rendered Athens for every visitor) vs components/HomeContent.tsx:40-76 (progressive GMT → device-local upgrade) vs lib/tabs.ts:54 ("session times in your local timezone" in every calendar tab's meta description)
- What: The about page admits "All times rendered in Europe/Athens", so the default isn't a bug per se — but the product now has two philosophies (HomeContent's hydration-safe device-local pattern vs fixed Athens everywhere else), and lib/tabs.ts ships a meta description on 15 series pages claiming local-timezone times that only the home page delivers.
- Why it matters: Every non-Athens visitor reads wrong session times on the highest-intent pages (weekend schedule, session page), and the SERP snippet promises otherwise — a trust hit for a "data honesty" product.
- Simpler/correct alternative: Short-term, fix the tabs.ts copy to match reality. Properly: reuse HomeContent's GMT→local upgrade for SessionCard/WeekendSchedule times (the pattern already exists in-repo; second consumer rule satisfied).
- Confidence: high

### [1b-10] group.ts past/future window duplicates series.ts season filtering — two filters own the same responsibility — LOW — lenses: (b)
- Where: lib/group.ts:31-48 (±365d/540d window, comment cites multi-year Formula E archives) vs lib/series.ts:16-23 (`filterToSeason`, Dec→Feb season window applied before any caller reaches groupByWeekend)
- What: Every groupByWeekend caller (weekend.ts, CalendarTab, ResultsTab, weekend page, marketing page — grep-verified) receives sessions already season-filtered by loadSeriesFromDir, so the group.ts window can only ever re-trim an already ≤15-month set. The comment describes the pre-filterToSeason world.
- Why it matters: Two date-windows fighting over one job is exactly how a future season-boundary bug becomes hard to localize (which filter ate the session?).
- Simpler/correct alternative: Delete the window from groupByWeekend (and its stale comment), keeping filterToSeason as the single owner; or move the comment to series.ts where the filtering actually happens.
- Confidence: high

### [1b-11] groupByDay buckets by UTC date while times render in Athens — "Sat · 02:00" rows for late-UTC sessions — LOW — lenses: (b)
- Where: lib/group.ts:83-96 (UTC `dateKey` buckets + UTC labels), rendered next to lib/date.ts `formatLocal` Athens times in components/weekend/WeekendSchedule.tsx:20,90 and HomeContent
- What: A session at 21:00–23:59 UTC (US evening races: NASCAR, IndyCar, COTA) lands in Saturday's UTC bucket but renders an Athens time of 00:00–02:59 — the row reads "Sat" with a time that is Sunday in the displayed timezone.
- Why it matters: Users planning around night races read an off-by-one day; it compounds 1b-9.
- Simpler/correct alternative: Bucket by the same timezone the times render in (pass the tz into groupByDay's dateKey); resolves itself if 1b-9's device-local upgrade lands.
- Confidence: high on mechanism, med on how often the affected hour band occurs

### [1b-12] Dead-code cluster: one dead module, five dead exports, one of them carrying a latent bug — LOW — lenses: (e)
- Where: lib/onboarding.ts (whole module — zero importers repo-wide, grep-verified; superseded by KV `isUserOnboarded` in userPrefs.ts + app/api/user/onboarded); lib/date.ts:14,21 (`isThisWeekend`, `isWithinNextNDays` — consumed only by date.test.ts); lib/weekend.ts:57 (`roundForSession` — zero consumers); lib/indexnow.ts:8 (`submitUrl` — zero consumers; `submitUrls` lives via scripts/submit-sitemap-to-indexnow.ts); lib/follow.ts:30 (`clearFollowedSeries` — zero consumers); lib/useFollowedSeries.ts:100-104 (`clearFollowed` — returned but no component destructures it)
- What: The IDEAS.md deletion flag on onboarding.ts is confirmed correct. The date.ts pair are dead exports whose tests give false coverage confidence. `clearFollowed` additionally has a latent bug for whoever wires it up: it writes `setLocalFollowed([])` (= "follow nothing" on next read) while setting state to `null` (= "follow everything"), and for signed-in users it never clears KV — so the UI shows everything until the next hydrate restores the old KV list.
- Why it matters: Dead code with tests and latent bugs is the most expensive kind to keep.
- Simpler/correct alternative: Delete onboarding.ts, the four dead exports, and their orphaned tests; if a clear affordance is ever wanted, implement it as `clearFollowedSeries()` + a KV DELETE.
- Confidence: high

### [1b-13] tour.ts: writeTourState's comment promises neverShow is "copied forward" before old keys are dropped — no caller does that — LOW — lenses: (e)
- Where: lib/tour.ts:52-58 (unconditional removal of all prior-version keys, comment claiming the opt-out is preserved), sole caller components/Tour.tsx:94-104 (writes `neverShow` from the current checkbox state only)
- What: `shouldShowTour` correctly honors an old version's `neverShow` — until the user replays the tour under a new version and dismisses with the box unticked, at which point writeTourState deletes the old key carrying the explicit opt-out. Harm only materializes at the *next* version bump (tour re-shows to someone who opted out), so it's latent, but the comment documents a guarantee the code doesn't implement.
- Why it matters: Comment-contradicts-code in persistence logic is how the guarantee silently dies in a future refactor.
- Simpler/correct alternative: In writeTourState, OR the incoming `neverShow` with any old key's `neverShow` before deleting (3 lines), making the comment true.
- Confidence: high

### [1b-14] Comment/copy drift cluster — LOW — lenses: (e)
- Where: lib/results-cache.ts:5 (docstring "F2 / F3 season-results fan-out" — `seasonCacheKey` typed and used for `'wec'` too, lib/results/wec.ts:380); lib/types.ts:21-23 (singleEvent "Calendar + About + Champions only" vs lib/tabs.ts:18's actual five keys incl. drivers + history); lib/tabs.ts:40 ("all 9 tabs" — TABS has 8); lib/date.ts:8-9 (duplicate `return 'tomorrow'` branches; the `diffDays === 1` arm also labels events 24–48h away "tomorrow" when they can be the day after)
- What: Four spots where prose and code disagree after later edits; none change behavior except the formatRelative mislabel, which is a one-word cosmetic inaccuracy on far-future-day boundaries.
- Why it matters: Each is trivial; together they're the exact pattern (stale doc-comments) that made 1b-10/1b-13 possible.
- Simpler/correct alternative: One-line comment fixes; for formatRelative, drop the `diffDays === 1` branch or gate it on calendar-day adjacency.
- Confidence: high

### [1b-15] results-ready: standalone "Sprint" titles never match `looksLikeRaceSession` — sprint "results are in" notifications can never fire — LOW — lenses: (e)
- Where: lib/results-ready.ts:60-65 (`RACE_TITLE` lacks sprint; "MotoGP - Sprint" / "F1 - Sprint" match neither alternation — `\bgp\b` does not fire inside "MotoGP"), comment at :59 claims race-deciders are "the only session type our results tabs render"
- What: F1 and MotoGP sprints are covered series whose sprint sessions are titled bare "Sprint"; the regex pair classifies them as non-races, so `resultsRenderedFor` is never even consulted for them. F1 sprint results *do* render on the results/standings surfaces (as extras), so the comment's premise is partially false. Also `rally` in RACE_TITLE is dead — wrc has no entry in `RESULTS_DATE_SOURCES`.
- Why it matters: A promised notification silently never sends for two flagship series' Saturday sessions.
- Simpler/correct alternative: If sprint notifications are wanted, add `sprint(?:\s+race)?` to RACE_TITLE (NON_RACE already excludes "sprint qualifying" via "qualifying"); if not wanted, fix the comment and drop `rally`.
- Confidence: high on regex behavior; med on whether the omission is intentional

## Cross-wave handoff notes

- **Components wave:** `WeekendStandingsSnapshot` (components/weekend/) inherits 1b-2 directly — a merged FE doubleheader weekend computes `throughRound` from the first round only while rendering the second round's race; check how `throughRound` is derived. Also check every `formatLocal`/time render site for the 1b-9 regime split, and whether anything besides Tour.tsx writes tour state.
- **App/config wave:** `app/sitemap.ts` (via lib/sitemap-data.ts) and the weekend page derive URL existence from different sources (rounds.json vs groupByWeekend) — after 1b-1/1b-2 land, add a build-time assertion that every sitemap weekend URL resolves. `dynamic = 'force-dynamic'` on the weekend page makes `generateStaticParams` mostly decorative — worth a look.
- **Config wave:** content sidecar JSON is parsed with silent-null fallbacks everywhere (series-content.ts, rounds-loader.ts, sessions-overrides.ts). Under "edits to content/** ship in 90s", a JSON syntax error silently degrades pages (and in champions/drivers re-enables the Wikipedia scraper per 1b-8). A `tests/` content-validation suite or pre-commit check would convert silent degradation into red CI.
- **Curated-data note for the operator:** sessions.json blocks carry a `round` field (motogp, likely others) that no code reads (1b-6) — it's the missing link that would fix 1b-1 cheaply; circuits.json carries aliases ("Spa", "IMS") that cannot match (1b-5).
- **Wave 1a cross-ref:** profile-stats.ts `namesMatch` slug-containment is fine for curated series but will false-positive on family-name pairs if ever applied to NASCAR/IndyCar-style feeds with Jr/Sr or shared surnames — worth remembering when results parsers expand coverage.
- **Perf (minor, no finding):** `/app` page does up to 12 sequential `matchCircuit`+`fetchWeather` awaits (app/(app)/app/page.tsx:27-39) and the marketing page 4 — venue dedupe + KV caching blunt it, but a `Promise.all` over unique venues would cut cold-render latency; pairs with the 1b-5 lookup-rebuild note.

---

<!-- Wave 2 ledger appended 2026-06-12; agent output verbatim. -->

# Wave 2 — components/ (9,557 lines, 75 files, all read)

(Coverage table omitted here for length — every file read in full; per-file verdicts live in the wave-2 agent transcript. Findings + dispositions below are complete.)

## Findings

### [2-1] Clock-time regime split: calendar and weekend schedules render fixed Europe/Athens, unlabeled, while the product promises "your local time" — HIGH — lenses: (b)(e)
- Where: lib/date.ts:26 (`formatLocal` defaults `tz='Europe/Athens'`); consumers SessionCard.tsx:71, WeekendBlock.tsx:114, weekend/WeekendSchedule.tsx:90; vs HomeContent.tsx:42-76 (the only surface with the GMT→device-local upgrade + tz label); copy at landing/Hero.tsx:54-56, landing/FeatureBlocks.tsx:5-7, calendar page header ("your local time"), /app metadata.
- What: HomeContent renders SSR GMT then upgrades to device-local with an explicit tz label. Every other clock-time surface — /calendar rows (FilteredSessions→SessionCard), series Calendar tab (WeekendBlock), weekend page Schedule (WeekendSchedule) — calls `formatLocal()` which hardcodes Europe/Athens and renders no timezone label at all. Marketing and page copy repeatedly claim times are "in your local time" / "converted automatically". Additionally, even on the upgraded home surface, day grouping and Today/Tomorrow tags use UTC dates (`groupByDay` keys on `toISOString()`, `sameUTCDay`), so a post-upgrade local time can sit under the wrong day header far from UTC.
- Why it matters: For any non-Athens user the two schedule-densest surfaces show wall-clock times offset by hours with nothing flagging the regime — a fan can miss a session, the product's core promise.
- Simpler/correct alternative: Thread HomeContent's `useNow`/`timeHM` pattern (serverNow prop + clock-gated upgrade + tz suffix) into SessionCard/WeekendSchedule/WeekendBlock, or at minimum append a "EEST"/"GMT+3" label to every `formatLocal` output until the upgrade lands.
- Confidence: high

### [2-2] Home page serializes the entire upcoming season into the client payload to render one week plus a count — HIGH — lenses: (d)
- Where: app/(app)/app/page.tsx:47-90 (`items={upcoming}` — all sessions with `end >= now`); HomeContent.tsx:151-174 (uses only `liveItems`, `next`, `weekItems` ≤7 days, and `beyondCount = upcomingItems.length - weekItems.length`).
- What: `upcoming` is every remaining session across all 15 series (~1,000 items × ~250-400 bytes serialized ≈ hundreds of KB, doubled across SSR HTML + RSC stream) passed as props to the `'use client'` HomeContent. Beyond the 7-day window, the full tail feeds only the "+N ahead" integer. The followed-series filter needs this week's items plus per-series ahead-counts (15 integers) to compute everything it renders.
- Why it matters: Primary PWA surface on mobile; parsed, hydrated, re-filtered client-side every visit for data that renders as one integer.
- Simpler/correct alternative: Pass `weekItems` (+ live items) and an `aheadCountBySeries: Record<string, number>`; HomeContent sums counts of followed slugs. Identical UI, payload shrinks by roughly the season.
- Confidence: med (mechanism certain; payload size estimated, not measured)

### [2-3] Per-series season-results plumbing is dispatched three times, and the shared pieces are lib-shaped functions exported from component files — MED — lenses: (b)(c)
- Where: tabs/ResultsTab.tsx:44-65 (`applyResultsOverrides` export, comment admits "Exported for StandingsTab"); weekend/WeekendStandingsSnapshot.tsx:49-130 (`loadSnapshotSource` export); importers: tabs/StandingsTab.tsx:34, weekend/WeekendStandingsSnapshot.tsx:13, app/(app)/drivers/[slug]/page.tsx:6, app/(app)/teams/[slug]/page.tsx:6, app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx:21.
- What: Three parallel slug-dispatch tables each re-implement "fetch this series' season races + apply overrides": ResultsTab's 12-branch if-chain, StandingsTab's 13-branch if-chain, loadSnapshotSource's 10-case switch. The NASCAR rounds-mapping block is copy-pasted verbatim in all three. Pages import a React component module to get a data loader, dragging ResultsTab's whole module graph (all 13 results parsers) into drivers/teams/session pages' server graphs. The if-chains themselves are honest dispatch with no client-bundle cost — the real cost is the triple-maintenance surface.
- Why it matters: A change to one series' source must be found and synced in up to three files; drift directly threatens the reconciliation invariant.
- Simpler/correct alternative: Move `applyResultsOverrides` and `loadSnapshotSource` to lib/ (lib/results-overrides.ts, lib/season-source.ts); make the tabs' generic branches consume the same adapters so slug→fetch exists once. Bespoke IMSA/WEC/GTW class-shaped branches stay.
- Confidence: high

### [2-4] Three near-identical accordion row/card/panel families in ResultsTab — MED — lenses: (b)(c)
- Where: tabs/ResultsTab.tsx — rows: ResultRow:92-119, ImsaResultRow:277-306, GtWorldResultRow:482-511; cards: RoundRow:175-219, ImsaRoundClassCard:358-404, GtWorldRoundClassCard:513-552; panels: SeasonResultsPanel:221-275, ImsaSeasonResultsPanel:308-356, WecSeasonResultsPanel:411-459, GtWorldSeasonResultsPanel:554-587.
- What: The `<details>/<summary>` card skeleton (RoundChip + RaceTitle + RowMeta + chevron + expanded-`<ul>` className) is duplicated byte-for-byte three times; the `<li>` row skeleton likewise; the section+h2 wrapper four times. WEC proves the parameterization works — it reuses the IMSA pair wholesale. Drift has already happened: GtWorldRoundClassCard lost weekendHref+date support; gap cell width w-24 vs w-20.
- Why it matters: Any accordion layout change must be applied in triplicate; the GTW card already silently lags.
- Simpler/correct alternative: One `ResultAccordionCard({chipLabel, title, href?, date?, winnerLabel, children})` + one `ResultEntryRow({position, primary, badge, secondary, right})`; keep the four panels as thin mappers. Three existing consumers satisfies the house abstraction rule.
- Confidence: high

### [2-5] SeasonTrendChart renders two legends — the built-in recharts Legend reintroduces the exact "legend soup" the custom chips fixed — MED — lenses: (b)(d)
- Where: SeasonTrendChart.tsx:160 (`<Legend ... />`) vs 84,118,184-227 (collapsed chip legend; comment "Legend soup fix").
- What: The recharts `<Legend>` lists every `<Line>` — including hidden ones — as full driver names above the chips. Visually confirmed (chart-mobile-390.png): 22 F1 names in the built-in legend immediately above the collapsed chips (ANT 156 / … / +10 more). On NASCAR that's 47 entries. The chip legend is the interactive one; the built-in one is non-collapsing noise duplicating it.
- Why it matters: Burns a phone-screen of vertical space on every charted standings tab; contradicts the documented intent in the same file.
- Simpler/correct alternative: Delete line 160.
- Confidence: high

### [2-6] WeekendStandingsSnapshot undercounts merged doubleheader weekends — MED — lenses: (e)
- Where: weekend/WeekendStandingsSnapshot.tsx:154 (`throughRound = isPast ? round : round - 1`); round from weekend/[round]/page.tsx:177; lib/rounds.ts:26-29 (first matching entry wins → merged weekend gets the lower round).
- What: A past FE doubleheader's snapshot freezes at the odd round, excluding the Sunday race the same page's schedule lists. Blast radius bounded: drivers/teams pages cumulate whole-season (no freeze); weekend + session pages affected.
- Why it matters: Post-weekend, "Standings at this round" silently omits half the weekend's points — the trust failure the winners-only guard exists to prevent.
- Simpler/correct alternative: Pass the weekend's max covered round (rounds.json ranges intersecting the weekend), or record `roundMax` in assignRoundsToWeekends and use `isPast ? roundMax : round - 1`.
- Confidence: high (mechanism)

### [2-7] components/ui is a dead vendored kit; the only two mounted pieces (Toaster, TooltipProvider) have zero consumers — MED — lenses: (e)(d)
- Where: components/ui/* (11 files, ~900 lines); AppShell.tsx:56,110.
- What: No app code imports ui/button, input, textarea, input-group, dialog, sheet, popover, command, skeleton, or tabs — they import only each other. Nothing calls `toast()`, so the mounted Toaster — and sonner + five lucide icons — hydrate on every page for a toast that can never fire (and `theme="system"` would render light toasts in a dark-only app). TooltipProvider provides context no Tooltip consumes (the chart's `<Tooltip>` is recharts'). Meanwhile CookieConsent/ContactModal hand-roll their own buttons/inputs/dialogs.
- Why it matters: Real per-page hydration weight for nothing; dead kit keeps @base-ui/react, cmdk, sonner, class-variance-authority in dependencies.
- Simpler/correct alternative: Remove Toaster + TooltipProvider from AppShell; delete components/ui/* (and lib/utils if orphaned). Config wave: confirm the packages drop from package.json.
- Confidence: high

### [2-8] SessionCard derives live/past/relative state from `new Date()` inside a hydrated client tree on an ISR page — the React #418 class this repo fixed twice — MED — lenses: (e)(b)
- Where: SessionCard.tsx:19-21,100; rendered via FilteredSessions ('use client') on /calendar (revalidate = 300).
- What: Server HTML bakes isLive/isPast/relative strings from render-time `now`; hydration recomputes against HTML up to 5 min stale → "in 3h"→"in 2h" mismatches, past-fade/live-badge flips. HomeContent documents this exact failure and solves it with `useNow(serverNow)`; NextRaceCountdown solves it with suppressHydrationWarning. SessionCard got neither.
- Why it matters: Recoverable hydration errors on every /calendar load crossing a label boundary within the ISR window; the repo's own comments classify this as a fixed bug regressing on a sibling surface.
- Simpler/correct alternative: Thread a `now: Date` prop from FilteredSessions (serverNow from the page, upgraded post-mount) into SessionCard, mirroring HomeContent's contract.
- Confidence: high

### [2-9] OnboardingWizard re-implements EnableNotifications' push state machine, and its reopen mechanism is dead — MED — lenses: (b)(e)
- Where: OnboardingWizard.tsx:25-114,138-158 vs EnableNotifications.tsx:13-103 (~70 duplicated lines, drifted status vocabularies); OnboardingWizard.tsx:49-56 (listener for `'paddock:reopen-onboarding'` — zero dispatchers repo-wide); Step `'done'` set immediately before close (never renders); lib/onboarding.ts dead.
- What: Tour state has exactly one writer (Tour.tsx) — clean. The wizard reopen event, its handler, and the `'done'` step are unreachable; the notifications step is a drifting fork of EnableNotifications.
- Why it matters: Push-subscription edge-case handling maintained twice will diverge; the dead reopen path implies a feature that doesn't exist.
- Simpler/correct alternative: Extract a `usePushSetup()` hook (two real consumers); delete the reopen listener, `'done'`, and lib/onboarding.ts.
- Confidence: high

### [2-10] Time-display micro-helpers forked 3-4 ways with behavioral drift — LOW — lenses: (b)(e)
- Where: countdowns ×3 (HomeContent Countdown / NextRaceCountdown / landing BigCountdown — two different hydration strategies); `relativeAgo` ×3 (HomeContent:84-92 UTC-anchored, WeekendNews:11-21 negative-diff guard, NewsTab:5-15 neither); EmptyState/SourceLink duplicated in ResultsTab+StandingsTab; hostnameOf triplicated.
- What: Three countdown tickers and three relativeAgo copies have already drifted on edge cases (future-dated posts: "1m ago" vs "just now").
- Why it matters: Each future hydration/formatting fix lands in one copy — exactly how 2-8 happened.
- Simpler/correct alternative: lib/relative-time.ts + one shared Countdown; fold EmptyState/SourceLink/hostnameOf into the 2-3 extraction.
- Confidence: high

### [2-11] CookieConsent is an off-design-system one-off whose copy overpromises what the code does — LOW — lenses: (a)(e)
- Where: CookieConsent.tsx:268-270 ("Toggle a category off and we won't load its scripts at all") vs app/(app)/layout.tsx:115-131 (gtag.js + adsbygoogle.js load unconditionally; consent only flips Consent Mode flags); :378-457 bespoke button/toggle kit + rounded-2xl/shadow styling vs the flat house language.
- What: The customize-layer copy claims script-loading gating; implementation is Consent Mode flags only. Ships its own 80-line component kit and generic-SaaS styling.
- Why it matters: Copy/code gap is a small compliance/credibility exposure; second parallel button system.
- Simpler/correct alternative: Reword to "we won't use them for analytics/advertising" (1 line), or actually gate the `<Script>` tags on stored consent; restyle when next touched.
- Confidence: high

### [2-12] FE "partial classification" heading: redundant clause + a second, disagreeing winners-only discriminator — LOW — lenses: (e)
- Where: tabs/ResultsTab.tsx:751-755 vs 184-185.
- What: Label is never wrong, but `some(...) && every(...)` reduces to `every(...)` (empty unreachable); and the heading defines winners-only as `length === 1` while RoundRow requires `length === 1 && status =~ winner` — two definitions 300 lines apart will drift on the next new status string.
- Simpler/correct alternative: One exported `isWinnersOnly(race)` predicate used by both.
- Confidence: high

### [2-13] ChampionsTab: pass-through wrapper + near-clone section component — LOW — lenses: (e)(c)
- Where: tabs/ChampionsTab.tsx:132-140 (TeamCell = rename of TeamLinkResolver); 142-209 vs 256-323 (DriversSection vs SecondarySection differ only in `c.constructor` vs `c.team`).
- Simpler/correct alternative: Delete TeamCell; pre-map rows so SecondarySection becomes a call site.
- Confidence: high

### [2-14] Dead components: SessionList and SeriesBadge — LOW — lenses: (e)
- Where: components/SessionList.tsx, components/SeriesBadge.tsx — zero importers (grep-verified).
- Simpler/correct alternative: Delete both.
- Confidence: high

### [2-15] SettingsClient offers "Follow all" and "Reset to default" as two buttons with identical behavior — LOW — lenses: (e)(a)
- Where: SettingsClient.tsx:30-32 (both = `setFollowed(seriesList.map(s => s.slug))`).
- Simpler/correct alternative: Drop Reset, or implement it as clearing the persisted preference.
- Confidence: high

### [2-16] GT World standings apply one un-scoped overrides file to three different championships — LOW — lenses: (e)
- Where: tabs/StandingsTab.tsx:483-488 — same overrides applied to overall, sprint, endurance tables.
- What: A curated fix for a GTW driver in one championship would patch the same name in all three. Latent (no gt-world overrides file exists today); same shape for IMSA/WEC per-class flatMaps.
- Simpler/correct alternative: Document "no GTW overrides" in-branch, or add an optional `scope` key to the schema.
- Confidence: high

### [2-17] Stale comments describe navigation deleted in 0.17.0 — LOW — lenses: (e)
- Where: BottomBar.tsx:6-10 (cites burger + sidebar), landing/DisciplinesGrid.tsx:4-5 (cites app sidebar taxonomy).
- Simpler/correct alternative: Two one-line comment edits.
- Confidence: high

## Seed-claim dispositions (wave 2)
- Seeds 1 (accordion triplication), 2 (lib-shaped exports from components), 4 (doubleheader throughRound), 6 (timezone split) — CONFIRMED → findings 2-4, 2-3, 2-6, 2-1.
- Seed 3 (if-chain dispatch) — partially refuted: honest dispatch, no client-bundle cost; real issue is the triple dispatch + boilerplate (2-3).
- Seed 5 (FE heading heuristic) — refuted on "label ever wrong" (never wrong); redundant/drifting predicates noted (2-12).
- Seed 7 — Tour has exactly one state writer; wizard reopen event has no dispatcher anywhere (2-9).

## Cross-wave handoff notes
- **app wave:** (1) 2-2's fix lands in app/(app)/app/page.tsx (payload shaping). (2) 2-6's fix is cleanest page-side (weekend/[round]/page.tsx:177 max-covered-round; also audit [session]/page.tsx:102 which calls loadSnapshotSource). (3) weekend/[round]/page.tsx declares `dynamic = 'force-dynamic'` AND `generateStaticParams` (16-32) — the latter is dead under force-dynamic; verify intent. (4) GA measurement ID hardcoded in app/(app)/layout.tsx:15; adsbygoogle + gtag load unconditionally (relates 2-11). (5) Every signed-in page load fires GET /api/user/onboarded (wizard mount in AppShell) — check cost/caching.
- **config wave:** If 2-7 accepted: @base-ui/react, cmdk, sonner, class-variance-authority (and possibly clsx/tailwind-merge via lib/utils) should drop from package.json — verify importers first; components.json may be removable.
- **lib follow-ups:** lib/rounds.ts `find()` first-match is the root of 2-6 — a `roundMax` there fixes all consumers; lib/onboarding.ts confirmed dead.

---

<!-- Wave 3 ledger appended 2026-06-12; agent output verbatim (coverage table in agent transcript — all 47 app files + proxy.ts read in full; vercel.json does not exist, crons are GitHub Actions). -->

# Wave 3 — app/ + API routes (4,250 lines + proxy.ts, all read)

## Findings

### [3-1] Five routes pair `dynamic = 'force-dynamic'` with `generateStaticParams` — params computed every build, zero pages prerendered — MED — lenses: (e)(d)
- Where: app/(app)/series/[slug]/page.tsx:25-30; .../weekend/[round]/page.tsx:16-32; app/(app)/blog/[slug]/page.tsx:12-17; app/(app)/drivers/[slug]/page.tsx:10-15; app/(app)/teams/[slug]/page.tsx:14-19
- What: Verified in next/dist/build/utils.js:676-705: with force-dynamic (no PPR) Next sets revalidate=0 but still calls buildAppStaticPaths — every generateStaticParams executes at every build and its output is discarded. The weekend one is the expensive case: loadSeries for all 15 series (ICS network fetch per series at build) for nothing.
- Why it matters: Wasted build time + build-time network flakiness; the code lies to readers about the rendering model.
- Simpler/correct alternative: Delete all five. Separately decide per route whether force-dynamic is even wanted (see 3-8 for blog).
- Confidence: high

### [3-2] /app serializes the entire remaining season into the client payload; only 7 days + a count render — HIGH (confirms 2-2) — lenses: (d)
- Where: app/(app)/app/page.tsx:58,84-90; components/HomeContent.tsx:151-174
- What: Confirmed: `items={upcoming}` is every not-yet-ended session × 15 series with repeated seriesName/slug/color per session. HomeContent renders ≤7 days; the tail feeds one integer (beyondCount), which must survive client-side followed-filtering — hence the full list ships. /calendar legitimately differs (client month switching uses the full set).
- Simpler/correct alternative: Ship weekItems + `upcomingCountBySeries: Record<slug, number>`; compute beyondCount client-side.
- Confidence: high

### [3-3] CookieConsent copy promises script gating the layout doesn't do — MED (upgrades 2-11) — lenses: (e)
- Where: components/CookieConsent.tsx:267-270; app/(app)/layout.tsx:118-133
- What: gtag.js + adsbygoogle.js load afterInteractive unconditionally; consent flips Consent Mode v2 signals only (advanced mode). Wiring order itself correct (beforeInteractive default-denied block precedes both). The customize-layer copy describes basic consent mode (no script load), which is false and network-tab-verifiable.
- Simpler/correct alternative: Reword ("we won't use them / they stay denied"), or actually gate the two Script tags on stored consent.
- Confidence: high

### [3-4] race-week cron has no date-only gate — fabricates clock times from synthetic midnights — MED — lenses: (e)
- Where: app/api/cron/race-week/route.ts:106 (window filter), 142-145 (payload body)
- What: notify cron skips s.dateOnly (notify/route.ts:107); race-week doesn't. Date-only sessions pass the window filter, count toward "N sessions this week", and pickMainSession can choose one — its midnight-UTC start renders via fmtTime(Europe/Athens) as a concrete "02:00"/"03:00" in a push notification. A series whose week is entirely date-only (rally itineraries) digests with a bogus time.
- Why it matters: Direct violation of "date-only sessions must never notify with a time"; weekly cron, real users.
- Simpler/correct alternative: Filter !s.dateOnly, or prefer timed sessions in pickMainSession and render "time TBC" otherwise.
- Confidence: high

### [3-5] Results-ready notifications silently no-op when race date and session start disagree across UTC midnight — MED — lenses: (e)
- Where: lib/results-ready.ts:67-88 (sameUTCDay), gate chain at app/api/cron/notify/route.ts:140-156
- What: Match requires the feed's race date and session start to share a UTC day. Evening races crossing UTC midnight (Vegas-pattern) mismatch when the feed dates by local day — the WEC adapter's multi-day expansion exists precisely for this class, but F1/F3/FE/IndyCar/MotoGP get single-day exact matching. Combined with 1b-15 (sprints never match), "Results are in" has two silent no-op gates.
- Simpler/correct alternative: Match ±1 UTC day (or day-range expansion for all sources); add sprint|feature to RACE_TITLE.
- Confidence: medium (per-feed date semantics not exhaustively checked)

### [3-6] Sitemap weekend URLs from rounds.json don't all exist; existence is also time-windowed — MED (mechanism for 1b-1/1b-2) — lenses: (e)
- Where: lib/sitemap-data.ts:43-53; lib/rounds.ts:25-28; lib/group.ts:31-47; weekend page resolution
- What: Sitemap emits every non-cancelled rounds.json round; pages resolve via groupByWeekend+assignRoundsToWeekends where (a) doubleheaders take only the first round (six FE 404s), (b) curated rounds with no sessions produce no weekend, (c) the ±365d/+540d window means currently-valid URLs start 404ing next season while rounds.json still lists them. Other families: static + /series/[slug] match; blog posts, drivers, teams, session pages simply absent from the sitemap (3-8).
- Simpler/correct alternative: Generate weekend sitemap entries from groupByWeekend per series — same source as the pages.
- Confidence: high

### [3-7] /about is a public page with pre-2.0 copy: "Personal-use PWA", "All times rendered in Europe/Athens" — MED — lenses: (e)
- Where: app/(app)/about/page.tsx:52-57; footer-linked
- What: Claims all times render in Athens (false — and 2-1 makes the true story nuanced), calls the product personal-use (it's launching public with accounts/AdSense/ToS), dumps raw upstream ICS URLs + fetch timestamps (no tokens — verified — but dependency-map exposure).
- Simpler/correct alternative: Rewrite the two Notes sentences; humanize source rows (hostname + freshness).
- Confidence: high

### [3-8] Blog posts: not in sitemap, no canonical, force-dynamic per-request MDX compilation — MED — lenses: (d)(e)
- Where: lib/sitemap-data.ts:22-37; app/(app)/blog/[slug]/page.tsx:12, 31-48, 122
- What: The seed posts (the deliberate SEO play) are absent from the sitemap; post pages set og.url but no canonical; force-dynamic recompiles MDX per view while posts only change at deploy.
- Simpler/correct alternative: Add loadAllPosts() URLs to the sitemap; add alternates.canonical; replace force-dynamic with revalidate=300 (generateStaticParams then actually works).
- Confidence: high

### [3-9] /impressum + /imprint: identical content, both sitemapped, no cross-canonical — LOW — lenses: (e)
- Simpler/correct alternative: Canonical both to /imprint; drop /impressum from the sitemap.

### [3-10] Force-dynamic pages pay loadSeries' eager 3× markdown render + full ICS parse per request — MED — lenses: (d)
- Where: lib/series.ts:45-61; consumers weekend/[round], [session], drivers/[slug], teams/[slug]
- What: Every loadSeries call remark-renders overview/drivers/significance markdown and re-parses the full ICS (MotoGP ~451 entries) — but these four page families never use the three HTML fields. ICS fetch is data-cached 6h; the per-request cost is pure CPU, per view, producing thrown-away fields.
- Simpler/correct alternative: Split a loadSeriesCore without markdown renders for these pages, or move the routes to revalidate=300 (they read no searchParams/cookies).
- Confidence: high

### [3-11] Server data-fetching helper lives in (and is imported from) component files — LOW (= 2-3's dependency-direction half) — lenses: (b)
- Simpler/correct alternative: lib/snapshot-source-loader.ts for loadSnapshotSource + applyResultsOverrides.

### [3-12] GET /api/user/onboarded fires on every document load with no client cache for a monotonic flag — LOW — lenses: (d)(c)
- What: Fires per hard load / auth flip (not per client nav). 1-2 KV reads each. Flag only transitions false→true.
- Simpler/correct alternative: localStorage marker after first true; clear on sign-out.

### [3-13] Session page strips title prefixes with two different regexes — metadata vs h1 drift — LOW — lenses: (e)
- Where: [session]/page.tsx:144 (`/^.*?-\s*/`) vs :328 (`/^.*?[-–—:]\s*/`)
- What: "MotoGP: Sprint" gets a clean h1 but an uncleaned <title>/og:title.
- Simpler/correct alternative: One cleanSessionName() in lib/weekend.ts used by both.

### [3-14] Seven copy-pasted markdown-shell pages with drifting prose-class strings — LOW — lenses: (c)(e)
- What: accessibility/cookies/do-not-sell/privacy/terms/impressum/imprint duplicate the same 40-line shell; table styles present in 4 of 7 — a table added to terms.md renders unstyled. Five+ consumers clears the abstraction bar.
- Simpler/correct alternative: One LegalPage({file, title, description}) component.

### [3-15] Comments asserting things the system doesn't do — LOW — lenses: (e)
- Where: app/(app)/error.tsx:14-16 ("Vercel Analytics + Speed Insights catching uncaught errors" — neither captures errors; user copy says "We've logged it" — only console.error happens); settings/page.tsx:14-15 (cites "sitemap" — /settings is noindexed + absent).
- Simpler/correct alternative: Fix both; soften "We've logged it" until an error sink exists.

### [3-16] Three crons re-implement the same per-user gating block with divergent anonymous-subscription policy — LOW — lenses: (c)(e)
- Where: notify:168-220, news:36-52+116-144, race-week:82-129
- What: getUserState cache + followed/muted/toggle gate pasted ×3. Policy drift: notify + news send legacy (userId-less) subscriptions everything; race-week skips them entirely — unowned behavior, not a decision.
- Simpler/correct alternative: One buildUserGate(prefKey) helper; pick one explicit legacy-sub policy.

### [3-17] OG image: brand wordmark rendered in Satori's default font, not Saira — LOW — lenses: (e)
- Where: app/opengraph-image.tsx:30,39-41
- Simpler/correct alternative: Load Saira via readFile into ImageResponse fonts (~6 lines).
- Confidence: medium

### [3-18] /blog/[slug] accepts unvalidated slugs into fs paths — LOW — lenses: (e)
- Where: lib/posts.ts:33-46
- What: URL-decoded slug interpolated into path.join with no validation. Exploitability ~nil on Vercel (only deployed .mdx with publishable frontmatter render — verified legal/*.md don't qualify), but it's the one user-supplied slug without the `/^[a-z0-9-]{1,64}$/` discipline used everywhere else.
- Simpler/correct alternative: Same regex at the top of loadPost (one line).

## Cross-wave handoff notes (wave 3 → 4)
- **vercel.json does not exist** — crons are GitHub Actions (.github/workflows/notify.yml every 15min → /api/cron/notify then news; race-week.yml Mon 08:00 UTC). GH schedules are best-effort: a skipped tick can miss both notify windows; notify step fails workflow on non-200 (good), news/race-week accept 503.
- next.config.ts must keep serverExternalPackages + outputFileTracingIncludes for node-ical (landmine #1); confirm content/** + RELEASES.md covered by output tracing for runtime-read markdown.
- Until 3-1 lands, every build executes weekend generateStaticParams → 15 ICS fetches; check build duration.
- public/ inventory checks out (manifest, ads.txt, llms.txt, IndexNow key — key public by design); scripts/submit-sitemap-to-indexnow.ts has no workflow reference — verify whether IndexNow ever runs post-launch pushes.
- sw.ts sound (skipWaiting+clientsClaim+navigationPreload+defaultCache); deliberate TS-gap casts in sw.ts:91 and --series-color styles are commented — don't flag.

---

<!-- Wave 4 ledger appended 2026-06-12; agent output verbatim (coverage table in agent transcript — all config/infra/scripts/styling files read in full; lint run empirically). -->

# Wave 4 — config / infra / scripts / styling

## Findings

### [4-1] scaffold-series.mjs registry is stale; documented "safe to re-run" rerun would clobber curated production content — HIGH — lenses: (e)(b)
- Where: scripts/scaffold-series.mjs (header + L204-212) vs content/series/*/meta.json.
- What: The script header declares the embedded registry "source of truth", "always rewrites meta.json", "Safe to re-run." Drift verified by diff: f1/meta.json has championsPage "List_of_Formula_One_World_Drivers'_Champions" (curated fix) vs registry "List_of_Formula_One_World_Champions"; wec/meta.json officialStandingsUrl ".../manufacturers-classification" vs registry ".../en/standings"; adac-ravenol-24h absent from the registry entirely.
- Why it matters: The natural first step of the next "add a series" session silently reverts two curated fields and re-breaks the F1 champions source, shipping to prod in ~90s.
- Simpler/correct alternative: Flip meta.json writes to write-if-missing (one line), or re-sync the registry; record meta.json as the truth.
- Confidence: high

### [4-2] Dead UI-kit dependency chain: nine droppable packages, two inert mounts — MED — lenses: (a)(c)
- Where: package.json; components/ui/* (12 files); AppShell.tsx:12-13; globals.css L2-3; lib/utils.ts.
- What: Import-graph verified: only live imports of components/ui are AppShell's TooltipProvider (zero Tooltip consumers) and Toaster (zero toast() calls) — both no-ops shipping sonner/base-ui JS to every visitor. Sole consumers per package: @base-ui/react (~14MB), cmdk, sonner, class-variance-authority, clsx+tailwind-merge (via lib/utils cn(), callers = the kit only), tw-animate-css, shadcn (6.2MB CLI as a RUNTIME dep, consumed only by a globals.css @import whose variants only the kit uses). next-themes has ZERO imports repo-wide (light mode deleted 0.14.0) — droppable today with no code change. framer-motion was never a dependency. Everything else has live consumers.
- Why it matters: 9 of 31 runtime deps support code with zero user-facing output; two mounts cost real bundle/hydration on every page.
- Simpler/correct alternative: Drop next-themes now; one PR deletes components/ui + the two mounts + globals.css import + lib/utils + the 8 packages.
- Confidence: high

### [4-3] `npm run lint` is red and ~96% of its errors are phantom duplicates from 14 stale agent worktrees + committed SW bundles — MED — lenses: (b)(e)(d)
- Where: eslint.config.mjs (globalIgnores covers only .next/out/build/next-env.d.ts); .claude/worktrees/* (14 locked worktrees, full repo copies); public/sw.js.
- What: Empirical run: 106 errors across 91 files — ~101 phantoms from .claude/worktrees copies (flat config skips neither dot-dirs nor .gitignore), 1 from the committed generated public/sw.js, only 4 real main-tree errors (react-hooks/set-state-in-effect ×3, prefer-const ×1). Seed Q6 answered: no-unused-vars is warn-only and nothing surfaces warnings — that's how the wave-1/2 dead params survived; tsconfig has no noUnusedLocals backstop.
- Why it matters: Lint exists but is unusable as a signal; real errors drown 25:1.
- Simpler/correct alternative: Add ".claude/**" and "public/sw*.js" to globalIgnores (two strings); fix/triage the 4 real errors; consider bumping no-unused-vars to error once green.
- Confidence: high

### [4-4] notify cron: 15-min windows with zero slack against GitHub Actions schedule jitter; news ingest silently skipped when notify step fails — MED — lenses: (e)(b)
- Where: .github/workflows/notify.yml; app/api/cron/notify/route.ts:17-27,119-135; race-week.yml.
- What: Windows are t30 = (20,35] and t10 = (0,15] — each exactly 15 min wide, equal to the nominal tick cadence, so guaranteed coverage requires zero scheduling slack; GH scheduled runs are routinely minutes late and occasionally dropped, and strict range predicates mean no catch-up — single-window misses are expected operating behavior, not rare. News is a second step in the same job: any notify failure skips news that tick. race-week.yml's "08:00 UTC = 11:00 Athens" comment is summer-only; its weekly tick has no retry.
- Why it matters: The headline feature degrades silently in the infrastructure's most common failure mode; the KV ledger already makes wider windows free.
- Simpler/correct alternative: Widen t30 to (15,40] (ledger dedupes) and/or schedule */10; split news into its own job or `if: always()`.
- Confidence: high on window math; medium on real-world miss frequency

### [4-5] Generated service-worker bundles are committed to git — MED-LOW — lenses: (b)(c)
- Where: public/sw.js, public/swe-worker-*.js (tracked since May 14); next.config.ts swDest; .gitignore (no rule).
- What: Serwist regenerates both per build; committed copies are a month stale, dirty the tree on any local build, hash-renamed corpses will accumulate, and sw.js is 4-3's lint error source.
- Simpler/correct alternative: git rm --cached + .gitignore "public/sw*.js" / "public/swe-worker-*.js" (serwist's own recommendation).
- Confidence: high

### [4-6] CONTRIBUTING.md onboarding references .env.example, which doesn't exist and can't be committed under `.env*` ignore — LOW — lenses: (e)
- Simpler/correct alternative: Commit a real .env.example + `!.env.example` negation, or change the doc.

### [4-7] globals.css carries a 13-token hand-maintained per-series palette: 10 dead, 4 slugs wrong, 7 values contradicting meta.json — LOW — lenses: (a)(e)
- Where: app/globals.css L104-117 + duplicate back-to-back :root blocks (L26-92, L94-121).
- What: Only --s-f1/--s-wec/--s-motogp are consumed (landing FeatureBlocks mock). Slug comment false ×4 (--s-fe vs formula-e etc.), no f2/f3 tokens, 7 values disagree with the real accent source (meta.json color via --tint). Otherwise the token home is clean: v2 values match the documented palette, no light-mode remnants, all keyframes consumed, the motion-safe composition bug class fully purged.
- Simpler/correct alternative: Delete the 10 dead tokens, mark the 3 survivors "landing mock palette" (or inline them), merge the :root blocks.
- Confidence: high

### [4-8] Runtime fs reads of content/** rely entirely on nft inference; only node-ical is explicitly traced — LOW — lenses: (e)(c)
- What: force-dynamic + ISR routes read content/** in Vercel functions at request time; it works because every reader uses the statically-traceable `path.join(process.cwd(), 'content', ...)` shape — nothing in config guarantees it. Same failure class as landmine #1 (localhost fine, Vercel-only 500s).
- Simpler/correct alternative: Add "./content/**/*" to outputFileTracingIncludes — one line of insurance.
- Confidence: medium-high

### [4-9] Dev runs --webpack although serwist (the reason for webpack) is disabled in development — LOW — lenses: (d)
- What: build --webpack is load-bearing; dev --webpack buys nothing and forfeits Turbopack dev speed. No comment records a parity decision.
- Simpler/correct alternative: Try `next dev` for a week; if parity was deliberate, record it in a comment.
- Confidence: medium

### [4-10] Repo root is an unguarded screenshot dump one `git add .` away from history — LOW — lenses: (b)
- What: ~50 untracked verification PNGs + fe-champ.html at root; no ignore rule, no directory convention.
- Simpler/correct alternative: Root-anchored `/*.png` ignore or a /.screenshots/ convention for the debug-with-own-eyes loop.
- Confidence: high

## Cross-wave handoff notes (wave 4 → cross-pass)
- **CLAUDE.md landmine #6 is stale and inverted**: says crons "accept missing CRON_SECRET as allow"; lib/cron-auth.ts deliberately fails closed (503) since 0.9.17. Code + HANDOFF right; CLAUDE.md wrong — an AI session trusting it would "restore" fail-open. Correct at next docs touch.
- Dead-kit verdict quantified: droppable = next-themes (today) + @base-ui/react, cmdk, sonner, class-variance-authority, clsx, tailwind-merge, tw-animate-css, shadcn (with the kit). lucide-react/geist live.
- 14 locked agent worktrees under .claude/worktrees (scraper/* batch + 3 named) poison lint and hold stale branches — operator `git worktree prune` + branch triage; cross-pass: check whether any scraper branch holds unmerged work main still wants.
- lib/indexnow.ts submitUrl: zero callers (matches 1b-12's list).
- components.json aliases hooks → @/hooks which doesn't exist (only relevant if the kit stays).
- No .gitattributes in a two-person mixed-OS repo — CRLF churn risk; one-line file if collaboration deepens. (Also the union-merge candidate for CHANGELOG/RELEASES per the program's rebase pain.)
- temporal-polyfill direct dep is deliberate (pins the traced package) — keep.
- IndexNow manual-only is documented design (README) — not a gap. globals.css seed Q4 clean apart from 4-7.
