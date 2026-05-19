# Session audit — Tue 2026-05-19

Senior-developer audit per operator directive: "audit and ESPA everything you've done. all must be robust and mistake free."

Seven PRs touched today, versions 0.10.35 → 0.10.40. Six merged at audit time; one open (#58).

## At-a-glance

| PR | Version | Title | Status |
|---|---|---|---|
| #53 | 0.10.35 | docs(perf): baseline snapshot + Wed work queue | merged |
| #54 | 0.10.36 | fix(scrape): strip Wikipedia `<style>` + `.legend` blocks | merged |
| #55 | 0.10.37 | feat(content): IndyCar 2026 drivers.json | merged |
| #56 | 0.10.38 | chore: rename "Paddock" → "Paddock Tracker" | merged |
| #57 | 0.10.39 | feat(standings): live IndyCar standings | merged |
| #58 | 0.10.40 | feat(content): F1 2026 drivers.json | open |
| #59 | 0.10.41 | docs: session audit + Wed–Sun blitz plan | this PR |

---

## Per-PR audit

### PR #53 · 0.10.35 — Perf baseline doc + Wed work queue

**Scope:** New `docs/perf-baselines.md` (time-series, append-only by date). First row captured Vercel SI desktop RES 95 / mobile RES 76 + PSI desktop LCP critical path 2,037 ms + 616 KiB unused JS broken down + 7 long main-thread tasks. Plus SCHEDULE.md Wed stub → concrete 4-PR B-perf sequence, HANDOFF cross-refs, IDEAS.md Now triage, memory pointer added, expired pre-Fotis cutoff memory removed.

**Robustness check:** ✓
- Append-only schema documented; measurement protocol defined for repeatability across snapshots.
- CWV target table set (LCP ≤ 2.5 s, INP < 200 ms, CLS < 0.1, TTFB < 800 ms).
- Zero code changed; docs-only PR. No runtime regression possible.

**ESPA:** Presented plan with file shapes + question on internal-docs scope; operator approved + answered.

**Known risk carried forward:** the Wed plan in SCHEDULE.md was version-numbered 0.10.36→0.10.39 for B-perf. Today's events consumed those numbers for unrelated PRs (CSS leak, IndyCar drivers, rename, IndyCar standings, F1 drivers). **The version-number references inside the Wed entry are now stale.** Fixed in this PR's SCHEDULE update.

---

### PR #54 · 0.10.36 — Wikipedia CSS leak fix

**Scope:** `lib/wikipedia-season.ts` — both `cellText` and `extractDrivers` now clone, strip `<style>` + `.legend` / `.legend-color` / `.legend-text`, then extract text. Closes the IndyCar Drivers tab rendering bug where Wikipedia's inline CSS rules + `<span class="legend-text">R</span>` rookie marker leaked into the driver name string at A.J. Foyt Enterprises.

**Robustness check:** ✓
- New vitest case `LEGEND_STYLE_LEAK_HTML` reproduces the exact IndyCar scenario; 12/12 tests pass.
- Fix applied at **both** entry points (team cell + driver cell) — not just where the bug surfaced.
- Defensive: removes the full `.legend` decoration family (`.legend`, `.legend-color`, `.legend-text`), not just the leaked CSS itself.
- Affects every series using the live Wikipedia driver-list fallback — every series currently, until per-series `drivers.json` lands.

**ESPA:** First dispatched 7 drivers.json research agents in parallel before validating any end-to-end. **Operator caught this via "espa and senior dev audit" prompt.** I stopped, presented a revised plan (Phase 0 validate-first on one series before bulk-processing), operator approved, resumed. **Discipline recovered after operator intervention.**

**Known risk:** the fix handles the `.legend` family specifically. Other Wikipedia decoration patterns (`.mw-parser-output .mbox`, `.tmulti`, table-helper template styles) could leak via the same mechanism. The current `<style>` strip is broader and catches most CSS noise, but the `.legend` removal is targeted. **Recommendation:** if a similar leak surfaces in another decoration class, broaden the selector to `.mw-parser-output [class*="legend"]` or add a catch-all `style[data-mw-deduplicate]` pattern. Not blocking.

---

### PR #55 · 0.10.37 — IndyCar drivers.json

**Scope:** `content/series/indycar/drivers.json` — 10 teams × 26 drivers. Source: research agent synthesizing Wikipedia 2026 IndyCar season page + motorsport-press cross-references. Operator-verified team naming ("A.J. Foyt Racing" — agent was right; the prior "Enterprises" rendering was the broken Wikipedia scrape). PREMA Racing intentionally excluded per operator decision (2026 full-season status uncertain at curation time).

**Robustness check:** ✓
- Schema matches `CuratedDriversFile` type in `lib/types.ts`.
- Pretty-printed JSON for git-diff readability (consistent with `champions.json` convention).
- DriversTab dispatch via `lib/people.ts` `loadAllDrivers()` confirmed before commit — schema is exactly what the routes consume.
- Activates `/drivers/<slug>` + `/teams/<slug>` for all 26 + 10 entries via slug-generated URLs.
- Sitemap inclusion deliberately deferred (consolidate when more series have drivers.json instead of piecemeal sitemap growth).

**ESPA:** Pivoted from Bing-fixes-first to IndyCar-end-to-end after operator spotted the CSS leak. Operator's "stop worrying" directive overrode my proposed Phase 0 → Phase 5 sequencing. Presented pivot plan; operator approved.

**Known risk:** driver data captured at time of curation; mid-season changes (injury substitutes, mid-season seat swaps, late additions like PREMA when confirmed) won't reflect without a manual `drivers.json` edit. **Recommendation:** consider a verifier cron that compares curated drivers.json to a live Wikipedia season-page scrape and flags discrepancies. Not for this week.

---

### PR #56 · 0.10.38 — Sitewide rename "Paddock" → "Paddock Tracker"

**Scope:** 35 files renamed across user-facing surfaces. Internal docs preserved per operator decision. JSON-LD `Organization.name` + `WebSite.name` cascade to "Paddock Tracker" via `SITE_TITLE` import; `alternateName` flipped to `"Paddock"`. `public/manifest.json` `name` updated; `short_name` preserved at "Paddock" (homescreen icons need ≤12 chars). UA strings `Paddock-PWA` → `PaddockTracker-PWA` (no space inside identifier per HTTP-UA convention).

**Robustness check:** ✓
- All 90 vitest tests still pass.
- `tsc --noEmit` clean.
- Verified no `"Paddock Tracker Tracker"` double-replacement.
- Comprehensive grep audit pre-merge confirmed every user-facing surface touched + every intentional exclusion justified.
- `lib/json-ld.ts` `alternateName` correctly flipped (was `Paddock Tracker`, now `Paddock`).
- Imprint pages (`app/imprint/page.tsx`, `app/impressum/page.tsx`, `content/legal/imprint.md`) verified — no brand strings; reference domain only.
- Technical identifiers preserved: `paddock:consent`, `paddock:followed-series`, `paddock:theme` (localStorage); `paddock:contact:*`, `paddock:user:*`, `paddock:news:lastLink:*` (KV); `paddock-test`, `paddock-news-${slug}`, `paddock-${session.uid}`, `paddock-race-week-${...}` (push tags); `paddock:push-sound` (postMessage type); `[paddock]` (console error tag); `paddock-live-pulse` (CSS keyframe).
- Internal docs untouched per operator rule: CHANGELOG, CLAUDE, AGENTS, IDEAS, SCHEDULE, docs/HANDOFF, docs/perf-baselines, docs/seo-geo-playbook, audit + content-authoring + research, memory/*.
- ADAC sessions.json "Paddock Scrutineering building" Nürburgring venue name preserved.
- `app/globals.css` design-token comments reference the versioned "Paddock 1.0" design system identifier — internal.

**ESPA:** Pre-merge senior-dev audit delivered per operator request; operator merged.

**Known risk (operator action items):**
- **OG image cache:** Twitter / Facebook / LinkedIn cache OG images ~7 days. Operator should force re-scrape via Twitter Card Validator / Facebook Sharing Debugger / LinkedIn Post Inspector after deploy.
- **SERP title refresh:** ~1-2 weeks Google, ~1-3 days Bing. URL Inspection in GSC + Bing Webmaster Tools URL Submission already done by operator. IndexNow pushed by Claude.
- **ISR cache:** home page may serve old title up to 5 min post-deploy. Acceptable.
- **Service worker upgrade:** installed PWAs pick up new push fallback titles on next visit when SW activates. Acceptable.

---

### PR #57 · 0.10.39 — IndyCar live standings

**Scope:** `lib/standings/indycar.ts` scrapes `https://www.indycar.com/Standings` SSR'd HTML and parses `<button data-driver-data='{...}'>` JSON attributes per row. Maps `rank` → `position`, `firstName + lastName` → `driverName`, `wins`/`points` direct. Team name from sibling cell's `<img alt="<TEAM> Logo ">` (trailing space is IndyCar's CMS quirk). `StandingsTab.tsx` slug dispatch extended.

**Robustness check:** ✓
- **Sanity floor ≥ 10 drivers** — real grids are 25+; below floor fails closed and surfaces the existing "temporarily unavailable" `EmptyState`.
- Returns `null` on any error (network, parse, structural) — no exceptions escape the function.
- **ISR cache `revalidate: 3600`** — hourly refresh; IndyCar updates the page within minutes of session end so this is well within the right lag.
- **Reuses `applyDriverOverrides`** — drop `content/series/indycar/standings-overrides.json` for DSQ / penalty corrections, **no code changes needed**.
- **Chromium User-Agent** prevents bot-mitigation SPA-shell return; documented in inline comment.
- 7 vitest cases: full grid happy path, out-of-order resort, partial-response floor, no-data, malformed-JSON-only, 500, network failure. All pass.

**ESPA:** I had earlier (today, this session) **wrongly concluded indycar.com was fully SPA-rendered**. The probe hit the lowercase `/stats/standings/drivers` SPA route, not the canonical `/Standings` (capital S — the URL in `meta.json:officialStandingsUrl`). **Operator caught the gap by asking "indycar.com? espn.com? foxsports.com?"** Re-probed; found `/Standings` is SSR'd with structured `data-driver-data` JSON; corrected. **Self-correction triggered by operator's question.** Documented the mistake in the PR description.

**Known risk:**
- **Single source of failure:** if indycar.com goes down or restructures HTML, the page surfaces "Standings temporarily unavailable". No automatic fallback to Wikipedia or alternative source. **Recommendation:** wire Wikipedia 2026 IndyCar standings table as a secondary source (defense-in-depth). ~30 min. Could land Wed alongside other infrastructure.
- **Silent breakage on structural drift:** if `data-driver-data` attribute name changes or `.data-table-team-img-container` class is renamed, parser returns < floor → EmptyState. **No alerting.** **Recommendation:** health-check cron that fires alert if parser returns < floor for > 24h. ~1h. Could land Wed.
- **No Constructors' / Teams' / Manufacturers' table** in this PR — those aren't on `/Standings`. Add via separate URL probe later.

---

### PR #58 · 0.10.40 — F1 drivers.json (open at audit time)

**Scope:** `content/series/f1/drivers.json` — 11 teams × 2 drivers = 22-car 2026 F1 grid. Source: research agent synthesizing Wikipedia 2026 F1 article + F1.com cross-references. Includes Cadillac as 11th team debuting 2026 with Pérez #11 + Bottas #77; Norris #1 as defending champion; Antonelli #12 at Mercedes; Audi rename of Sauber with Bortoleto #5 + Hülkenberg #27; Hadjar #6 at Red Bull; Lawson + Lindblad #41 at Racing Bulls; Bearman #87 at Haas; Colapinto #43 at Alpine.

**Robustness check:** ✓
- Schema matches `CuratedDriversFile`.
- Every driver has 3-letter `code` + permanent `number` (F1 broadcast convention).
- Team colors set to canonical 2026 livery primary colors.
- Activates `/drivers/<slug>` + `/teams/<slug>` for all 22 + 11 entries.
- Sitemap inclusion deferred (consolidation with future drivers.json batch).

**ESPA:** Operator's directive ("in parallel do the same for f1 drivers"); agent dispatched in background while finishing IndyCar standings; processed when agent returned; shipped without re-asking for approval (scope was explicit).

**Known risk:** agent-sourced data. Real-world 2026 F1 lineups are well-documented so confidence is high, but operator's pre-merge review at PR is the final verification gate. If any driver/team mismatch surfaces, hot-patch via direct edit.

---

## ESPA discipline retrospective

**Successes:**
- Pre-merge audit on rename PR (#56) caught nothing missed but proved the discipline.
- Pushback on operator's "standings/results is easy" framing earlier in the day surfaced reality of S7 dependencies; pivoted appropriately.
- Self-correction on indycar.com SPA assumption when operator probed alternatives.
- Pivot from Wikipedia-scrape recommendation to official-source scrape when the better path opened up.

**Failures (caught + corrected):**
- Dispatched 7 drivers.json agents before validating one end-to-end. Caught by operator's "espa and senior dev audit" prompt.
- Initially recommended Wikipedia scrape for IndyCar standings when the official source was scrape-friendly. Caught by operator's "indycar.com? espn.com? foxsports.com?" question.
- Initially treated "indycar.com is SPA" as final after one wrong-URL probe. Should have tried URL variants before concluding.

**Where ESPA was lighter than ideal:**
- Operator's pace today was fast — multiple directive stacks per turn. Some plan-presentation steps were abbreviated to keep momentum. Acceptable when scope is explicit and decisions are reversible (e.g. F1 drivers.json after pattern was validated on IndyCar).

---

## Drivers.json gap audit (added post-initial-write per operator directive)

Operator stated at session close: "we have drivers for formula 3 (we NEED drivers for formula 2 they are missing), we are missing formula e drivers too and in fact we are missing drivers in all categories other than f1 f3 and indycar."

**Glob-verified state on `main` at session close (post PR #58 merge):**

| Series | `content/series/<slug>/drivers.json` on main | Routes activated |
|---|---|---|
| indycar | ✓ (PR #55, merged 0.10.37) | `/drivers/<slug>` + `/teams/<slug>` for 26 + 10 entries |
| f1 | ✓ (PR #58, merged 0.10.40) | `/drivers/<slug>` + `/teams/<slug>` for 22 + 11 entries |
| **f3** | ❌ NO — operator's mental model said yes; reality is no | live-Wikipedia fallback via `lib/wikipedia-season.ts` renders driver names on `/series/f3?tab=drivers`, so the tab LOOKS populated, but **the curated file does not exist**. `/drivers/<slug>` for F3 drivers still 404s. |
| f2, motogp, wsbk, formula-e, dtm | ❌ no | Wikipedia fallback if `seasonPage` is in `meta.json`, else placeholder |
| wec, imsa, gt-world, nls, wrc, nascar-cup, adac-ravenol-24h | ❌ no | same |

**Net gap: 13 series need curated `drivers.json`** (12 truly missing + F3 which the operator believed was already covered).

**Agent outputs already in conversation context (6 of 13):** motogp, wsbk, f2, f3, formula-e, dtm — dispatched earlier today as the Tier-1 batch; only IndyCar shipped. The 6 outputs are ready to validate + commit.

**Still to dispatch (7 of 13):** wec, imsa, gt-world, nls, wrc, nascar-cup, adac-ravenol-24h. Tier-2 series — endurance / rally complexity (multi-car teams, rotating crews, rally co-drivers) needs careful prompting.

**Recommended sequence (added to Wed-Sat plan in `SCHEDULE.md`):**
- **Wed AM** — dispatch 7 Tier-2 agents in background while doing IndyCar results + F1 sprint/points work in foreground.
- **Wed PM** — web-search-verify the 6 Tier-1 outputs in hand per `feedback-paddock-search-for-missing-data` rule; bulk-commit as one PR.
- **Thu AM** — process the 7 Tier-2 agent returns; bulk-commit as a second PR.
- **Sat** — sitemap inclusion of `/drivers/<slug>` + `/teams/<slug>` once all 15 series have drivers.json — sitemap grows once across ~400 new URLs instead of piecemeal. IndexNow push afterwards.

**Why Playwright is NOT needed for drivers.json work:** Wikipedia season pages are SSR'd; agents WebFetch directly. Playwright is reserved for SPA-rendered live-data sources (MotoGP results on motogp.com, WEC results on fiawec.com, FE results on fiaformulae.com) per Thu-Fri's blitz plan — those need browser execution to hit the JSON XHRs.

**Risk:** F3 operator-confidence mismatch was a useful flag. **Recommend a smoke audit early Wed (~10 min):** click into every `/series/<slug>?tab=drivers` tab and read the footer label. "Source: curated" = `drivers.json` fired; "Source: Wikipedia →" = live scrape fallback. The footer label disambiguates which path fired, so we know exactly which series the Wikipedia fallback is masking.

## Open risks at session close

1. **F1 Sprint races missing from `/series/f1?tab=results`** (operator-reported). Check `lib/results/f1.ts` Jolpica payload structure; sprints may need separate query (`/sprint/{season}`) or schema extension. Wed work.
2. **F1 results points wrong** (operator-reported). Bug in `lib/results/f1.ts` or display layer. Wed work, paired with Sprint fix.
3. **Driver / team page enrichment** — current pages show driver-name + team affiliation only. Should show: current standings position + points + wins (lookup via series standings fetcher), country flag (extend drivers.json schema or scrape), headshot (extend schema or use IndyCar's `driverPortraitImg` for that series). Wed-Thu work.
4. **Every-session-URL architecture** — new route `/series/[slug]/weekend/[round]/session/[id]/page.tsx`; ~2,100 new URLs (15 series × ~20 rounds × ~7 sessions); per-session result-data sourcing required. Multi-day, likely Thu-Sat.
5. **Sitemap doesn't include `/drivers/*` + `/teams/*`** — deferred to drivers.json batch consolidation. Should land Sat after all 15 series have drivers.json.
6. **B-perf entirely deferred for this week.** Mobile RES 76 / LCP 3.67 s / TTFB 3.17 s still in production. Mobile-first indexing dampens every SEO signal shipped this week (rename, drivers.json activation, standings) until perf improves. **Recommendation:** single B-perf burst (~4h) on Mon 5/25 immediately after this week's data blitz closes.
7. **Bing scan fixes still pending** — 8 weekend 404s, 11 title-too-long, 1 multi-h1. 45 min total. Should land Wed AM before deeper work.
8. **IndyCar standings has no Teams' / Manufacturers' championship table.** Secondary IndyCar title; add via separate scrape path. Defer.

---

## Tomorrow's queue (operator-set this-week blitz)

See `SCHEDULE.md` Wed–Sun 2026-05-20 → 2026-05-24 entries for the day-by-day plan. Aggressive but achievable if execution stays pure and history drafting (operator-paced) runs in parallel.

---

## Recommendations

1. **Defense-in-depth for live data sources** — wire Wikipedia as fallback for IndyCar standings; cron-driven health check for any scraper returning null for > 24h. ~1.5h combined; could ride Wed cron-infra PR.
2. **Verifier cron for drivers.json** — compares curated to live Wikipedia season-page scrape; flags discrepancies (injury substitutes, mid-season seat swaps not yet reflected). ~2h; land late this week.
3. **Browser-verify deploys with Playwright MCP before merge** — establish as a session-end habit. ~5 min per PR. Worth the discipline given the data-pipeline ramp this week.
4. **Don't fully drop B-perf** — schedule a dedicated burst for Mon 5/25 to recover the mobile signal. Compounds with every day deferred.
5. **`/changelog` rendering** — when this PR's `# Session audit` heading lands on the changelog page (if RELEASES is updated), it could re-introduce a multi-h1 issue Bing flagged on Tue. Verify rendering before merge; this audit lives under `docs/audits/` not in RELEASES so it shouldn't surface, but worth a sanity check.
