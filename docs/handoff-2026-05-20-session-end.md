# Paddock — session handoff 2026-05-20

End-of-session snapshot. Covers 0.11.x continuation through 0.15.0+. Read at next session start alongside `docs/HANDOFF.md` (the running operational record).

This is a point-in-time snapshot. State will drift; verify against current `git log` + production before relying on specific facts.

---

## State at session end

### Versions shipped to main today (2026-05-20)

| Version | PR | Theme | Status |
|---|---|---|---|
| 0.10.42 | #60 | PR A quick-wins: countdown, WRC Japan R7, weekend title trim, RELEASES H1 strip | merged, prod-verified |
| 0.10.43 | #61 | PR A1: Champions clickability (the patch 0.10.42 announced but missed) | merged, prod-verified |
| 0.10.44 | #62 | PR A2: name normalize + team alias suffix-strip (Red Bull + Palou-1-4 fix) | merged, prod-verified |
| 0.11.0 | #63 | Live standings + results across 5 series (F2, F3, FE, NASCAR, WSBK) | merged, prod-verified |
| 0.11.1 | #64 | FE: REST API → /wiki/ URL (didn't fix it — colspan was the real bug) | merged, prod-verified (still broken) |
| 0.11.2 | #65 | FE: colspan-aware index translation — **THE ACTUAL FE FIX** | **OPEN, awaits merge** |

**Outstanding action**: merge PR #65, then Playwright-audit `paddock-tracker.com/series/formula-e?tab=standings` and `?tab=results` to verify the fix landed.

### Production state (pre-PR-#65)

Tested and confirmed in production at session close:
- `/series/f1` — countdown + standings + results + Champions clickability ALL working
- `/series/motogp` — countdown working; standings/results still falling through to LinkOutCard (not yet wired in main)
- `/series/wrc` — Japan R7 visible with correct dates; standings/results not yet wired
- `/series/indycar` — standings live, Palou (1-4) links work after 0.10.44
- `/series/formula-e` — **BROKEN**: "Standings/Results are temporarily unavailable" until #65 merges
- `/changelog` — single h1, no duplicate Releases heading

### Test suite

- 32 test files / 240 tests passing
- Baseline pre-session: 16 files / 97 tests
- All 5 new series (F2/F3/FE/NASCAR/WSBK) have fixture-driven coverage matching `lib/standings/indycar.test.ts` shape
- **Known gap**: FE fixtures don't exercise the colspan code path. Refresh from live HTML in a follow-up; PR #65's parser is more robust than its tests prove.

---

## Bug-list disposition (the original 47 items)

Mapped against the version-bump table agreed mid-session:

### Shipped this session

- **#1 F1 driver season-trend points** — Sprint races still missing; partial fix only. Deferred to 0.11.6.
- **#3 Champions clickability** — shipped 0.10.43 + refined 0.10.44.
- **#14 AJ Foyt Enterprises** — verified canonical, no patch needed (shipped 0.10.42 docs only).
- **#34 PWA name** — informational; `name: "Paddock Tracker"` / `short_name: "Paddock"`. No reinstall needed.
- **#38 WRC Japan R7** — added to `rounds.json` (0.10.42). Stage-level `sessions.json` pending official itinerary publication.
- **#44 Per-series countdown** — `NextRaceCountdown` component shipped 0.10.42, all 15 series.
- **#4 F2 standings/results** — shipped 0.11.0.
- **#7 F3 standings/results** — shipped 0.11.0.
- **#11 Formula E standings/results** — shipped 0.11.0, then bug-fix 0.11.1 (URL) + 0.11.2 (colspan).
- **#35 WORLDSBK standings/results** — shipped 0.11.0 via Pulselive API.
- **#45 NASCAR standings/results** — shipped 0.11.0 via Wikipedia.

### Pending — in worktrees, dispatch wiring next

- **#13 IndyCar results** — BLOCKED agent shipped impl in report (paste-from-report needed)
- **#17 IMSA standings/results** — worktree `scraper/imsa-standings-results` @ `5d701d8` (4-class GTP/LMP2/GTD-Pro/GTD multi-class)
- **#19 NLS standings/results** — BLOCKED agent (research only; needs writing from agent's source-tier doc)
- **#22 WEC standings/results** — landed directly in main during session (uncommitted); now in stash `agent-leakage-2026-05-20-defer`
- **#24 DTM standings/results** — BLOCKED agent (research only; impl needs writing)
- **#27 GTWC standings/results** — worktree `scraper/gt-world-standings-results` @ `632e309` (3-section Overall/Sprint/Endurance)
- **#31 MotoGP standings/results** — BLOCKED agent shipped full impl in its report (paste needed)
- **#40 WRC standings/results** — worktree `scraper/wrc-standings-results` @ `669c375`

### Pending — 0.12.0 (drivers.json across remaining 13 series)

- **#5 F2 drivers/teams clickability** — needs `content/series/f2/drivers.json` curation
- **#8 F3 drivers** — needs `content/series/f3/drivers.json` curation
- **#18 IMSA drivers** — Wikipedia source
- **#21 NLS drivers** — Wikipedia source, top GT3 class only for v1
- **#22 (b) WEC drivers** — Wikipedia source, multi-class
- **#25 DTM drivers** — Wikipedia source
- **#28 GTWC drivers** — SRO archives + Wikipedia
- **#33 MotoGP drivers** — official site + Wikipedia
- **#37 WORLDSBK drivers** — Pulselive available, fallback Wikipedia
- **#41 WRC drivers** — Wikipedia
- **#43 WRC champions** — Wikipedia past winners curation
- **#47 NASCAR drivers** — Wikipedia, 36 charter teams

### Pending — 0.13.0 IA redesign

- **#2 3-tab IA** — Calendar / Seasons / About restructure
- **#10 Year/season routing** — `/series/<slug>/seasons/<year>/<subtab>` paths

### Pending — 0.14.0 histories (user authors) + Moto2/3

- **#6 F2 history** — user authors using F1 precedent
- **#9 F3 history**
- **#12 FE history**
- **#15 IndyCar history**
- **#16 ADAC history**
- **#20 NLS history**
- **#23 WEC history**
- **#26 DTM history**
- **#29 GTWC history**
- **#30 Moto2 + Moto3 series provisioning** — new directories under `content/series/`, including `drivers.json`, `champions.json`, `rounds.json`, `sessions.json`
- **#32 MotoGP history**
- **#36 WORLDSBK history**
- **#42 WRC history**
- **#46 NASCAR history**

### Pending — 0.15.0 enrichment

- **Photos + bios + accolades** per driver and team
- **Past F1 champions** added to drivers.json (Senna, Schumacher, Vettel, Rosberg, Hill, Hakkinen, Räikkönen, Hamilton historical, Stewart, Lauda, Prost, Fangio, Clark, etc.) — become linkable from Champions tab
- Same for past IndyCar / MotoGP / WSBK / NASCAR champions
- `/drivers/[slug]` enrichment: current standings position, last 5 results, recent news (S6 from old roadmap)
- `/teams/[slug]` same shape

### Verification still pending

- **#39 Weather audit across 15 series** — manual click-through; verify Open-Meteo populates per series next-race weekend (venue-local date per `feedback-paddock-weather-venue-local`)

---

## 0.11.x remaining — detailed roadmap

Each bullet is a candidate PR. Mostly sequential; some can parallelize.

### 0.11.3 — WRC + GTWCE + IMSA dispatch wiring

**Scope**: integrate the three remaining worktree-shipped scrapers into the unified StandingsTab/ResultsTab dispatch.

**Mechanics**:
1. Cherry-pick lib files (already extracted into untracked tree from prior session — verify with `git status`):
   - `lib/standings/wrc.ts` + `.test.ts`
   - `lib/results/wrc.ts` + `.test.ts`
   - Same for gt-world and imsa
2. Compose dispatch cases. Each is more complex than the 5 simple-pattern series:
   - **WRC**: adds Drivers' + Co-Drivers' + Manufacturers' tables. Need new `CoDriversTable` component in `StandingsTab.tsx`. Per agent's report, uses Wikipedia 2026 WRC page (wrc.com is Akamai-blocked).
   - **GTWCE**: 3-section dispatch (Overall + Sprint Cup + Endurance Cup). Uses SRO endpoints + `gt-world-challenge-europe.com/results/<year>/<event>?filter_race_id=N` for per-race. Driver standings have no team column (multi-driver crews); `team: ''` is honest.
   - **IMSA**: 4-class layout (GTP / LMP2 / GTD Pro / GTD). New `MultiClassTable` component. Uses Wikipedia 2026 IMSA page (imsa.com is PDF-only behind reCAPTCHA).
3. Run tsc + tests. Each series's tests are independent from main dispatch but the dispatch changes need integration verification.
4. Browser-verify on preview deploy: `/series/wrc?tab=standings|results`, `/series/gt-world?tab=standings|results`, `/series/imsa?tab=standings|results`.

**Estimated effort**: 1.5–2.5 hours. Largest PR of the 0.11.x line by line count.

**Risk**: WRC + IMSA + GTWCE each have ~150–250 lines of dispatch additions. Composition can drift. Recommend a per-series sub-PR if any one is unstable.

### 0.11.4 — WEC recovery + F2 orphan test cleanup

**Scope**: pull the WEC code out of the stashed `agent-leakage-2026-05-20-defer` and ship it cleanly.

**Stash contents (per WEC agent's report)**:
- `lib/standings/wec.ts` (multi-class drivers + teams + manufacturers loader, Hypercar + LMGT3 — LMP2 was dropped from WEC 2026 championship)
- `lib/results/wec.ts` (per-event per-class final classification)
- `lib/standings/wec.test.ts` + `lib/results/wec.test.ts` (21 cases combined)
- `content/series/wec/race-ids.json` (round → fiawec.com race ID sidecar)
- `lib/types.ts` modifications adding `WecClass`, `WecDriverStanding`, `WecTeamStanding`, `WecManufacturerStanding`, `WecClassStandings`, `WecStandings`, `WecRaceEntry`, `WecRaceClassResult`, `WecRaceResult`
- `lib/series-content.ts` adds `loadWecRaceIds()` + `WecRaceIdsFile` type
- `components/tabs/StandingsTab.tsx` + `ResultsTab.tsx` WEC dispatch
- `CHANGELOG.md` + `RELEASES.md` + `package.json` bump (will need re-pegging to current main version)
- `docs/BLOCKED-wec-standings.md` — probe log + Playwright/Wikipedia fallback recommendation

**F2 orphan test**: WEC agent's report flagged `lib/standings/f2.test.ts` has an orphan import of removed `./f2`. Need to find + fix. Likely an early-session abandoned partial-write that landed mid-flight. Verify against current main — if the file exists and tests pass (it does in 0.11.0+), then either the orphan was cleaned up implicitly or the agent report was wrong. Investigate first.

**Mechanics**:
1. `git stash show -p stash@{0}` to see what's there
2. Cherry-pick the WEC-specific files (skip the f2/f3 leakage that's already in main)
3. Resolve any conflicts with current main (package.json version, CHANGELOG/RELEASES)
4. Drop the stash once shipped

**Estimated effort**: 1 hour.

**Risk**: stash has multi-agent state; need to be selective about what to pull. Use `git stash show stash@{0} -- <specific-files>` patterns.

### 0.11.5 — MotoGP + IndyCar results paste-from-BLOCKED-reports

**Scope**: the two BLOCKED agents that delivered full implementations in their reports but couldn't write files due to sandbox permissions.

**MotoGP**: Pulselive JSON API at `api.motogp.pulselive.com/motogp/v1`. Full impl in agent's report (see `tasks/a97aee87425809240.output` if still on disk, or scroll the session transcript). Endpoints:
- `/results/seasons` → `[{ id: string, year: int, current: bool }]`
- `/results/standings?seasonUuid=&categoryUuid=e8c110ad-64aa-4e8e-8a86-f2f152f6a942` (MotoGP-class UUID, stable)
- `/results/events?seasonUuid=&isFinished=true`
- `/results/sessions?eventUuid=&categoryUuid=`
- `/results/session/<id>/classification?test=false`
- Session type codes: `RAC` = race, `SPR` = sprint
- Manufacturers' Championship: intentional skip (FIM rule = each manufacturer scores best-placed-rider points per race; need per-race aggregation, not aggregated rider points)

**IndyCar results**: Wikipedia 2026 IndyCar Series season page. `indycar.com/Results` is SPA (the lowercase `/results` is SPA; standings shipped against capital `/Standings` SSR'd path). Full parser design in agent's report (`tasks/aac6ed1f18604b987.output`). Returns position + driver + team + status="Finished" + computed points. Does NOT populate car number / lap count / elapsed time (those are indycar.com-only and behind their SPA). Phase 2 = Playwright/Sandbox scrape for those fields.

**Estimated effort**: 1.5 hours (paste + adapt to current dispatch + tests + browser-verify).

### 0.11.6 — DTM + NLS write-from-research

**Scope**: the two BLOCKED agents that only completed research, no code.

**DTM**: primary source = `motorsport.com/dtm/standings/2026/` (SSR HTML, recommended by per-series source audit). Per-event results: `autosport.com/dtm/results/2026/<event-id>/`. 16 races across 8 weekends. RaceResult.round = race_index 1..16. raceName = `<Venue> Race 1` / `Race 2`. Sanity floors: drivers ≥ 8, teams ≥ 4.

**NLS**: the data ecosystem is unusually thin. Official site is PDF-only behind reCAPTCHA. Wikipedia `2026_Nürburgring_Langstrecken-Serie` has structured wikitables (Results section + Gesamtwertung + Klassensieger-Trophäe + KW-Team-Trophäe). Recommend curating into `content/series/nls/standings.json` + `content/series/nls/results.json` from Wikipedia + PDF cross-reference. Top SP9 (GT3) class only for v1.

**Estimated effort**: 2-3 hours (write from research + tests + integration).

### 0.11.7 — F1 Sprint races + season-trend points fix

**Scope**: bug #1 from the original list — F1 driver season trend has wrong points because Sprint race points aren't aggregated.

**Root cause** (diagnosed earlier this session):
- `lib/results/f1.ts` only fetches Jolpica's `/results.json` endpoint
- Sprint endpoint: `api.jolpi.ca/ergast/f1/current/sprint/results.json`
- Need to add `fetchF1SeasonSprints()` and merge sprint points into the season-trend accumulator

**Mechanics**:
1. Add sprint endpoint fetch (mirror existing F1 results pattern)
2. Schema decision: emit sprint as separate `RaceResult` entries (like WSBK R1/SP/R2) OR fold into the main race entry with a `sprintResult` field. Recommend separate entries for symmetry with F2/F3/WSBK and to keep the trend chart's per-race granularity.
3. Verify season-trend chart correctly sums driver points across both
4. Browser-verify the trend chart against current standings (should match)

**Estimated effort**: 1 hour.

---

## 0.12.0 — drivers.json bulk-commit (13 series)

The substantial product moment that unlocks `/drivers/<slug>` + `/teams/<slug>` for the remaining 13 series + Champions tab clickability across the board.

### Scope

Curate `content/series/<slug>/drivers.json` for: motogp, wsbk, f2, f3, formula-e, dtm, wec, imsa, gt-world, nls, wrc, nascar-cup, adac-ravenol-24h.

### Schema

Match the F1 + IndyCar precedent exactly (`content/series/f1/drivers.json`):

```json
{
  "teams": [
    {
      "name": "Team Name",
      "color": "#HEXCOLOR",
      "drivers": [
        { "name": "Driver Name", "code": "ABC", "number": 1 }
      ]
    }
  ]
}
```

NO top-level `"season"` (despite some prior agent reports suggesting it).
NO `"nationality"` field on driver entries (not in `lib/types.ts CuratedDriversFile` shape).

### Source-tier per series

| Series | Primary source | Notes |
|---|---|---|
| MotoGP | motogp.com 2026 entry list + Wikipedia 2026 MotoGP World Championship | 21 riders × ~11 teams |
| WSBK | worldsbk.com 2026 entry list + Wikipedia | ~25 riders, race-by-race entries vary |
| F2 | fiaformula2.com entry list + Wikipedia 2026 F2 | 22 drivers × 11 teams |
| F3 | fiaformula3.com entry list + Wikipedia 2026 F3 | 30 drivers × 10 teams |
| Formula E | fiaformulae.com season teams + Wikipedia 2025-26 FE | 22 drivers × 11 teams |
| DTM | dtm.com entry list + Wikipedia 2026 DTM | ~21 drivers |
| WEC | fiawec.com entries + Wikipedia 2026 WEC | Multi-class (Hypercar + LMGT3) — multi-driver per car |
| IMSA | imsa.com entries + Wikipedia 2026 IMSA | 4-class (GTP / LMP2 / GTD Pro / GTD) — multi-driver per car |
| GT World | gt-world-challenge-europe.com entries + Wikipedia | Sprint + Endurance Cup, multi-driver crews |
| NLS | nuerburgring-langstrecken-serie.de entries (PDF) + Wikipedia | Top GT3 class only for v1 |
| WRC | wrc.com entries + Wikipedia | Driver + Co-Driver pairs per crew |
| NASCAR | nascar.com + jayski.com + Wikipedia | 36 chartered teams |
| ADAC 24h | 24h-rennen.de + Wikipedia | Single-event; all entrants for the 2026 race |

### 5-source rule

Per `feedback-paddock-search-for-missing-data`: each driver/team must be cross-verified across at least 5 sources before committing.

### Risk

Multi-class series (WEC / IMSA / GTWCE) and multi-driver crews are awkward to fit into the flat `teams[].drivers[]` schema. Three options:
1. Treat each car as a "team" entry — closest to existing schema, may confuse the team page
2. Group by manufacturer team — clean teams view, drivers per car still ambiguous
3. Extend schema with optional `carNumber` per driver — most accurate, requires lib/types changes

Recommend Option 3 for WEC/IMSA/GTWCE specifically. NLS Top GT3 + WRC crews benefit from this too.

### Estimated effort

5–10 hours across multiple sessions. Could be one large PR or split per-series.

---

## 0.13.0 — IA redesign + path-based routing

### Scope (from item #2 + #10)

3-tab structure:
- **Calendar** — unchanged
- **Seasons** — year picker → drivers/teams/standings/results/news for that year
- **About** — history / rules / articles / champions (per the placement decision earlier)

Plus path-based routing (item #10):
- `/series/[slug]` → default Calendar
- `/series/[slug]/calendar`
- `/series/[slug]/seasons` → year list
- `/series/[slug]/seasons/[year]` → default drivers
- `/series/[slug]/seasons/[year]/{drivers,teams,standings,results,news}`
- `/series/[slug]/about` → default history
- `/series/[slug]/about/{history,rules,articles,champions}`

### Mechanics

Behind `?ia=v2` feature flag. Default off. Both old (`?tab=X`) and new (`/[tab]/`) co-exist until flip. When flag flips:
- Old `?tab=X` URLs → 301 to new paths
- Canonicals migrate
- Sitemap regenerates
- IndexNow push for new URLs

### Touch surface

~40 files. Largest scope of any planned PR. Sitemap, canonicals, json-ld breadcrumbs, redirects, all tab component routings.

### Risk

Multi-day. URL changes affect SEO. Recommend a soft launch window where both URL forms work for ~1 week to let crawlers catch up.

### Effort

2–3 days.

---

## 0.14.0 — histories + Moto2/Moto3

### Histories (user-authored, 14 series)

Following the F1 precedent in `docs/content-authoring/drafts/f1-history.md`:
- 3-section template (Origin / Turning points / Today's shape)
- ~500-600 words per series
- Tiered sources per `docs/content-authoring/SOURCES.md`
- 5+ sources per factual claim
- Author byline + last-updated frontmatter
- Renderer at `components/tabs/HistoryTab.tsx` reads `content/series/<slug>/history.md`

Sources packets to deliver to the user before they author:
- The BLOCKED history-packet agents (open-wheel + endurance batches) had drafts in memory but couldn't write. Re-spawn them WITHOUT worktree isolation when ready.
- Per-series sources tiered list per `docs/content-authoring/SOURCES.md` format. Examples:
  - WEC/IMSA: Janos Wimpffen's *Time and Two Seats* (Le Mans canon), Mulsannescorner.com, Daily Sportscar, Endurance-Info
  - NASCAR: Greg Fielden's *Forty Years of Stock Car Racing*, Racing Reference, Jayski.com
  - WRC: Martin Holmes annuals, DirtFish, eWRC-Results.com, Rally Action Group
  - DTM: Motorsport-Magazin.com, ADAC archives
  - GT World: SRO Motorsports Group archives
  - NLS/ADAC 24h: motorsport-total.de, racemax.de, nuerburgring.de archives

### Moto2 + Moto3 (new series)

Provision `content/series/moto2/` + `content/series/moto3/`:
- `meta.json` — color, URLs, season
- `rounds.json` — mirror MotoGP weekend structure (same venues/dates)
- `sessions.json` — from official MotoGP weekend bundles (Pulselive has Moto2/3 in same paths)
- `drivers.json` — per 5-source rule
- `champions.json` — Moto2 since 2010 + Moto3 since 2012 + 125cc legacy (1949–2011)
- `fallback.ics` — placeholder
- Wire into series list, home, calendar, navigation

### Effort

Histories: 3-4 hours of authoring per series × 14 = ~50 hours (paced across weeks).
Moto2/Moto3 provisioning: 4-6 hours.

---

## 0.15.0 — enrichment

### Scope

Photos + bios + accolades for every driver and team across all 15 series + Moto2/Moto3. Past champions added to `drivers.json` so they become linkable from Champions tabs everywhere.

### Per-driver enrichment fields

Extend `CuratedDriverEntry` in `lib/types.ts` (optional fields only — existing entries unaffected):

```ts
interface CuratedDriverEntry {
  name: string;
  code?: string;
  number?: number;
  // 0.15.0 additions
  countryCode?: string;       // ISO 3166-1 alpha-3
  photoUrl?: string;          // /images/drivers/<slug>.jpg or external CDN
  bio?: string;               // ~80-120 word career summary, markdown allowed
  accolades?: string[];       // ["7-time World Champion", "Most wins (105)"]
  yearsActive?: { from: number; to?: number };  // career span
  bornDate?: string;          // YYYY-MM-DD
  diedDate?: string;          // YYYY-MM-DD if applicable
  bornPlace?: string;
  championships?: number[];   // years they won championship (for past champs)
}
```

### Per-team enrichment

```ts
interface CuratedTeamLineup {
  name: string;
  color?: string;
  drivers: CuratedDriverEntry[];
  // 0.15.0 additions
  logoUrl?: string;
  bio?: string;
  founded?: number;
  hq?: string;
  championships?: number[];
}
```

### S6 integration (from old roadmap)

`/drivers/[slug]` page enrichment beyond the current minimal:
- Current standings position + points + wins (for series with live standings)
- Last 5 results (for series with live results)
- Recent news mentions (from existing news feed, filtered by driver mention)
- Country flag
- Bio + photo + accolades

`/teams/[slug]` same shape, with aggregate driver positions.

### Past champion bootstrapping

For F1 alone: ~33 unique drivers' champions since 1950 (Fangio, Ascari, Hawthorn, Brabham, Phil Hill, Graham Hill, Surtees, Jim Clark, Hulme, Rindt, Stewart, Fittipaldi, Lauda, Hunt, Andretti, Scheckter, Jones, Piquet, Rosberg Sr., Prost, Senna, Mansell, Schumacher, Villeneuve, Hakkinen, Räikkönen, Alonso, Hamilton, Button, Vettel, Rosberg Jr., Verstappen, Norris). Each needs a curated entry to become linkable.

Plus IndyCar past champs, MotoGP past champs, WSBK past champs, NASCAR past champs.

### Photo licensing

Open question for 0.15.0 planning: source + license for driver photos. Options:
1. Wikipedia Commons (free, attribution required)
2. Motorsport.com / Getty stock (paid)
3. Per-driver commissioned headshots (paddock-tracker.com origin)

Recommend Wikipedia Commons for v1.

### Effort

50+ hours across multiple sessions. Photo curation alone is hours per series.

---

## Architecture decisions made this session

### Versioning discipline (locked-in this session)

Per the mid-session discussion: minor bumps trigger on new features, patch on bug fixes. 0.10.42's countdown was minor-worthy in hindsight but shipped under patch — discipline starts now.

```
0.11.0 → live data across 5 series (substantial product moment)
0.11.x → patches: remaining series, FE colspan, BLOCKED implementations
0.12.0 → drivers.json bulk-commit (Champions clickability across all series)
0.13.0 → IA redesign + path routing
0.14.0 → histories + Moto2/Moto3
0.15.0 → enrichment (photos, bios, past champions)
1.0.0 → "Paddock is feature-complete across all 15 series" — brand moment
```

Don't bump 1.0.0 until the product is ready to showcase publicly. Reserve it for the readiness signal.

### Champions clickability mechanics (0.10.43 + 0.10.44)

In `components/tabs/ChampionsTab.tsx`:
- Loads `loadCuratedDrivers(series.meta.slug)` — per-series scope, not cross-series
- Builds `driverSlugs: Set<string>` from `slugify(driver.name)`
- Builds `teamSlugMap: Map<string, string>` — every team slug AND its suffix-stripped alias (drop `Racing|F1 Team|GP|Team$`) maps to the canonical drivers.json team slug
- `nameForSlugMatch()` strips trailing `(...)` annotations and `*†‡` markers before slug compare (Wikipedia's repeat-winner annotations like "Álex Palou (4)")
- `DriverCell` + `TeamCell` wrap names in `<Link>` if slug resolves, plain text otherwise
- Three sub-sections (DriversSection / ConstructorsSection / SecondarySection) thread the slug structures through

Drivers.json is source of truth for canonical hrefs. Champion text variations resolve to real pages, never 404s.

### Scraper patterns (summary across 7 live + 3 pending)

| Pattern | Series using it | Notes |
|---|---|---|
| Jolpica JSON API | F1 | Ergast mirror, no auth, hourly revalidate |
| IndyCar SSR cheerio | IndyCar standings | `data-driver-data` JSON attrs in HTML, browser-UA required |
| Pulselive JSON API | WSBK (shipped), MotoGP (pending) | `api.wsbk.pulselive.com` / `api.motogp.pulselive.com` |
| FIA SSR cheerio + `__NEXT_DATA__` | F2, F3 | Read the embedded JSON blob over the visible HTML table |
| Wikipedia /wiki/ standard URL + cheerio | FE, NASCAR, WRC (pending), IndyCar results (pending), IMSA (pending), WEC (pending) | NOT REST API (`/api/rest_v1/page/html/`) — Parsoid HTML breaks parsers |
| Wikipedia + colspan-aware index translation | FE (after 0.11.2) | Doubleheader weekend headers use `colspan="2"`. Required for any wiki standings table with merged headers. |

### Wikipedia URL pattern (corrected this session)

- ✅ Use `https://en.wikipedia.org/wiki/<page>` with browser User-Agent
- ❌ Avoid `https://en.wikipedia.org/api/rest_v1/page/html/<page>` (Parsoid HTML breaks column-detection heuristics; FE was the canary)

### Colspan handling (added 0.11.2)

`findTable` now returns `colspans: number[]` alongside `columns`. New helper `logicalToDataIdx(colspans, logicalIdx)` translates header logical index to data-row index by summing preceding cells' colspans. Required for any Wikipedia standings table where multi-event weekends use merged-cell headers. Applied to FE; defensive-applied to FE results parser. Should be backported to other Wikipedia scrapers if similar tables appear.

### Background agent caveats observed

- **Worktree isolation blocks Write tool** in some configurations. Agents return BLOCKED with code-in-report when they can't write files. Re-launch without `isolation: worktree` if this recurs.
- **Path resolution divergence**: Read/Write tools resolve absolute `C:\Dev\Personal\Motorsport\...` paths to the main repo, while Bash uses the worktree's `cwd`. Agents using non-worktree-prefixed absolute paths silently write to main. F2 agent caught and corrected this mid-session; WEC agent didn't (which is why its files leaked into main and ended up in the stash).
- **5-source rule** worked well per `feedback-paddock-search-for-missing-data`. Every claim verified across 5 distinct upstreams.

---

## Worktree / branch / stash hygiene (next-session cleanup)

### Worktrees to tear down

All under `C:\Dev\Personal\Motorsport\.claude\worktrees\`:
- `agent-a00b25200bc171ee7` (WRC) — pull lib files into main first
- `agent-a0b5d969428d27e03` (NLS BLOCKED) — discard
- `agent-a5b833cdb702c5996` (GTWCE) — pull lib files first
- `agent-a646dfec9e9342c3f` (Formula E) — already in main
- `agent-a6d0cb299a833e5ef` (WSBK) — already in main
- `agent-a744d7fd1b522d237` (NASCAR Cup) — already in main
- `agent-a96d4b44757a9df3a` (IMSA) — pull lib files first
- `agent-aa9f401e5cf08df34` (F2) — already in main
- `agent-ad18b814cd2604fda` (F3) — already in main
- Plus legacy: `merry-fluttering-rainbow`, `sleepy-crafting-pond`, `sprightly-knitting-gem` — pre-this-session, probably stale, audit before deleting

Use `git worktree remove <path>` for cleanup.

### Local branches to delete (already merged)

- `bugs/pr-a-blitz-2026-05-20` (merged via #60)
- `bugs/pr-a1-champions-fix-2026-05-20` (merged via #61)
- `bugs/pr-a2-champions-name-normalize-2026-05-20` (merged via #62)
- `feat/v0.11.0-live-data-all-series` (merged via #63)
- `bugs/pr-0.11.1-fe-wikipedia-url-2026-05-20` (merged via #64)

Plus likely-abandoned: `bugs/pr-b-f1-sprint-fix-2026-05-20` (created but no work, switched away)

### Local scraper branches

- `scraper/f2-standings-results`, `scraper/f3-standings-results`, `scraper/formula-e-standings-results`, `scraper/gt-world-standings-results`, `scraper/imsa-standings-results`, `scraper/nascar-cup-standings-results`, `scraper/wrc-standings-results`, `scraper/wsbk-standings-results` — keep until their lib files are confirmed in main + worktree torn down
- `scraper/dtm-standings-results`, `scraper/motogp-standings-results`, `scraper/nls-standings-results` — empty (BLOCKED agents); delete

### Stash to handle

```
stash@{0}: On bugs/pr-b-f1-sprint-fix-2026-05-20: agent-leakage-2026-05-20-defer
```

Contains WEC code (per 0.11.4 plan above) + F2 orphan test residue + possibly other agent artifacts. Inspect with `git stash show -p stash@{0}` before applying selectively.

```
stash@{1}: WIP on docs/handoff-2026-05-19: ...
stash@{2}: WIP on feat/badge-redesign: ...
```

Pre-this-session. Inspect for relevance — probably droppable.

### Worktree files still in main repo working tree (untracked)

Per `git status` at session end, the following files may be sitting in the main working tree without being committed (extracted from worktrees during the 0.11.0 integration, then unstaged when scope-trimmed):
- `lib/standings/{wrc,gt-world,imsa}.ts` + `.test.ts`
- `lib/results/{wrc,gt-world,imsa}.ts` + `.test.ts`

These are the lib files for the next-session 0.11.3 work. They'll be used directly.

---

## Critical landmines (carry-forward + new this session)

### Pre-existing (from `docs/HANDOFF.md`)

1. `next.config.ts` requires BOTH `serverExternalPackages: ["node-ical"]` AND `outputFileTracingIncludes` for node-ical.
2. Middleware is `proxy.ts` in Next 16, not `middleware.ts`.
3. KV env vars are unprefixed (`KV_REST_API_URL`, `KV_REST_API_TOKEN`).
4. Clerk publishable key must keep `NEXT_PUBLIC_` prefix. Marketplace integration leaves empty Production placeholders — paste real values manually.
5. Notification badge must be monochrome.
6. Crons fail-closed when `CRON_SECRET` is unset.
7. Open-Meteo lookups must use venue-local date, never UTC.
8. Vercel CLI quirks: Preview env vars need positional `''` argument.
9. Date-only ICS entries flow through `lib/ics.ts` with `Session.dateOnly: true`. UI renders "TBC", live-now skips, notifications never fire.
10. Round numbers are canonical (rounds.json), not array indices.

### Added this session

11. **Wikipedia REST API (`/api/rest_v1/page/html/<page>`) returns Parsoid HTML that breaks column-detection heuristics.** Use standard `/wiki/<page>` with browser User-Agent instead. (FE bug, fixed in 0.11.2.)
12. **Wikipedia standings tables with multi-event weekends use `colspan="2"` on race headers.** Parsers must translate header logical indices to data-row indices via the `colspans` array helper. (FE-discovered, defensive-applied to other Wikipedia scrapers as they integrate.)
13. **CHANGELOG/RELEASES vs code drift** — caught in 0.10.42 → 0.10.43 cycle. The release notes claimed Champions clickability but the code patch was missed. Mitigation now in place: pre-commit grep gate against staged diff before any commit referencing a planned change.
14. **PR body Claude attribution** — caught in PR A audit. Commit messages have been clean, but PR descriptions had occasional `🤖 Generated with Claude Code` footer. Audit habit: pre-push grep PR body for "claude" / "generated with".
15. **Background agent path resolution** — `Read/Write` resolve absolute paths to the canonical project root (main repo) while `Bash` honours worktree `cwd`. Agents using bare absolute paths leak files into main even with `isolation: worktree`. Always use full worktree-prefixed paths in agent instructions.

---

## Test fixture follow-ups

- **`lib/standings/formula-e.test.ts` + `lib/results/formula-e.test.ts`** — fixtures don't exercise the colspan code path (the bug 0.11.2 fixes wouldn't have surfaced in any test). Refresh fixtures from live `/wiki/2025%E2%80%9326_Formula_E_World_Championship` HTML and add a "colspan'd header row" test case to lock in the regression.
- **WSBK** — agent's pre-mortem flagged: "Pulselive backend refuses Vercel outbound IPs, returns 403 or empty `classification`." Field-verify in production after 0.11.0 deploy (should be live now). Mitigations: browser User-Agent, `MIN_DRIVERS=8` sanity floor, fail-closed on non-OK. Documented fallback is Wikipedia season scrape, then curated `content/series/wsbk/standings.json`.
- **NASCAR** — fallback paths probed (Cloudflare 403 on nascar.com / jayski / racing-reference). If Wikipedia upstream changes structure, the parser silently degrades.

---

## Carry-over from `docs/HANDOFF.md` (pre-this-session)

The following items from the master handoff are still pending and weren't touched this session:

### From "Loose items"

- UI/UX craft pass (mobile-first audit, WCAG 2.2 AA, motion, focus states, dark-mode contrast)
- User research (survey, fan interviews, subreddit pain-point mining)
- SEO keyword strategy
- Notification expansion (per-event-type pushes, deep-link click handler, Settings "Your devices", `payload.image`)
- Cleanup (delete `lib/onboarding.ts`, DRY `EnableNotifications` + `OnboardingWizard`, retheme Clerk sign-in/up)
- Weekend page media embeds (`WeekendMedia` section)
- Tracks/Circuits tab per series
- Home hero next-2-3-sessions when imminent
- Session-card tap-to-expand
- Per-driver season-trend on `/drivers/[slug]`
- Champions tab era markers + sparklines

### From "Sessions roadmap" (S4–S10)

- S4 — Supabase data layer + scheduled scrapes per series (Fotis sit-down pending)
- S6 — Detail-page enrichment (folded into 0.15.0 above)
- S7 — Native non-F1 results + standings (executing as 0.11.x line)
- S8 — Quality + monitoring + infra polish (Sentry, `app/error.tsx`, `/api/cron/health`, Lighthouse, ESLint zero + husky, vitest, Playwright E2E)
- S9 — Comments + predictions + paddock-coins
- S10 — Public README + Mermaid arch diagram + blog posts

### Infra

- Sentry integration
- `sk_live_*` Clerk key rotation
- GitHub Actions CI workflow (parked)
- Vercel Pro upgrade (not needed yet)
- B-perf catch-up (mobile-first perf audit, deferred to dedicated session)

### Bing fixes still open

- B1 — sitemap orphan-round filter (FE doubleheaders + IndyCar Milwaukee R2 + NLS Sunday qualifier — 8 weekend 404s)

### Other small items

- WRC `rounds.json` full curation (5 of 14 rounds in file; 9 missing)
- WRC Japan stage-level `sessions.json` (pending official itinerary publication)
- Countdown on home-page hero (currently text-relative)
- Countdown on weekend hero
- Per-session-card countdown
- ADAC 24h champions curated past winners
- Endurance-series weekend grouping audit (WEC/IMSA/NLS/ADAC 24h grouping accuracy)

---

## What "done" looks like

Next session should pop this file as its starting context, alongside `docs/HANDOFF.md`. The order of attack from here:

1. **First**: merge PR #65 (FE colspan fix) and Playwright-verify production.
2. **Then**: 0.11.3 (WRC + GTWCE + IMSA dispatch wiring). Largest 0.11.x sub-PR; budget 2 hours.
3. **Then**: 0.11.4 (WEC recovery from stash). ~1 hour.
4. **Then**: 0.11.5 (MotoGP + IndyCar results paste). ~1.5 hours.
5. **Then**: 0.11.6 (DTM + NLS write-from-research). ~3 hours.
6. **Then**: 0.11.7 (F1 Sprint races + season-trend points fix). ~1 hour.
7. **Then**: 0.12.0 drivers.json sweep (~5-10 hours).
8. **Then**: 0.13.0 IA redesign (multi-day).
9. **Then**: 0.14.0 histories (paced, user-authored) + Moto2/3.
10. **Then**: 0.15.0 enrichment (multi-week).
11. **Then**: 1.0.0 brand moment.

Estimated total to 1.0.0 from end of this session: ~80-130 hours of build + ~50 hours of authoring.

---

End of original handoff.

---

# Addendum — Post-#66 audit findings + re-ranked priorities

Written after PR #66 (0.11.3 FE results fix) shipped and was browser-verified. New bugs surfaced + several existing items got concrete severity ratings.

## New bugs surfaced after #66

### B1. FE Drivers' season trend chart shows every driver stuck at 25 points (HIGH)

**Symptom**: `/series/formula-e?tab=results` renders a season trend chart where every visible driver's line plateaus at 25 points after they win their one race. Standings tab shows Evans 128 / Rowland 109 / Mortara 103 etc. — totally different scale.

**Root cause**: `lib/results/formula-e.ts` only emits the race winner per round (Wikipedia's "Race results" table doesn't carry full classification). `buildSeasonTrendData()` accumulates points from `RaceResult.results[]` — sees one row per race at position 1 with 25 pts. Trend correctly plots winners-only, but the chart label "Drivers' season trend" is misleading because non-winners get 0 across the season.

**Fix options**:
1. **Quick (~15 min)**: drop the trend chart from FE results dispatch. Replace heading with "Race winners by round" or similar, drop the chart entirely.
2. **Medium (~3 h)**: per-event subpage scrape — fetch each `wiki/<year>_<eprix>_ePrix` page for full classification. Each page has a standalone Results table.
3. **Hard (~1 day)**: switch FE to a more authoritative upstream (motorsport.com results page, or any Pulselive equivalent if discoverable).

**Recommendation**: Option 1 immediately as 0.11.4. Defer Option 2 to its own session when the time is right to enrich FE results.

### B2. FE results show fake "Race winner 25" classification (MEDIUM)

**Symptom**: Expanding any FE race card shows a single row: "1 [Winner Name] Race winner 25". Looks like a 1-driver classification, when really we only have the winner data.

**Root cause**: same as B1 — `lib/results/formula-e.ts` emits 1 `RaceResultEntry` per `RaceResult` with `status: 'Race winner'`. The `RoundRow` renderer in `components/tabs/ResultsTab.tsx` shows the per-entry list inside the accordion.

**Fix options**:
1. **Quick**: change `status` from `'Race winner'` to a clearer label like `'Winner — partial classification'`, OR collapse the per-entry list when only 1 entry exists.
2. **Better**: detect partial-classification rows at the renderer level and skip the per-entry expansion entirely (only show "winner: X" on the card summary line).

**Recommendation**: ship with B1 in 0.11.4.

### B3. IndyCar results not wired — falls through to LinkOutCard (HIGH)

**Symptom**: `/series/indycar?tab=results` shows "Race-by-race results are on the official site" + a link to `indycar.com`. No live data.

**Root cause**: IndyCar results never landed. The agent (BLOCKED in worktree-permission issue this session) had the full implementation in its report. Standings shipped in PR #57 (0.10.39) via `indycar.com/Standings` SSR scrape; results were supposed to follow but the BLOCKED state stranded the work.

**Fix**: paste-from-agent-report. Approach per BLOCKED agent's design:
- Source: Wikipedia 2026 IndyCar Series season page (`indycar.com/Results` is SPA, can't scrape directly)
- Wikipedia Drivers' Championship table has per-driver per-round finish positions ("1L*", "1L", "1", "DNS", "Wth", **bold** = pole, _italic_ = fastest lap)
- Round abbreviations: STP / PHX / ARL / BAR / LBH / IGP / INDY / DET / GTW / ROA / MOH / NSS / POR / MRK / D.C. / MIL / LAG (17 rounds)
- Points scoring: 50-40-35-32-30-28-26-24-22-20-19-18-17-16-15-14-13-12-11-10-9-8-7-6-5 for positions 1-25, +5 for 26+, +1 lap led, +2 most laps, +1 pole (except Indy 500)
- Sanity floors: ≥4 races parsed, ≥10 finishers per race or fail closed
- Implementation: ~330 LoC for parser + ~200 LoC for tests
- Tradeoff: returns position + driver + team + status='Finished' + computed points only. Car number / lap count / elapsed time omitted (indycar.com SPA-only).

**Effort**: ~30 min to paste + adapt to current dispatch.

### B4. F3 standings vs results points mismatch — Ugochukwu 25 vs 26 (LOW)

**Symptom**: `/series/f3?tab=standings` shows U. Ugochukwu with 25 points. `/series/f3?tab=results` shows him with a Feature win (25 pts) AND a 1-pt Sprint finish — totalling 26.

**Possible root causes**:
1. **Standings parser reads wrong column** — FIA's `__NEXT_DATA__` blob has a `TotalPoints` field; maybe parser reads a different one.
2. **Results points assignment off by 1** — Sprint points scale is `10-8-6-5-4-3-2-1` for top-8. P8 = 1 pt. If Ugochukwu finished P9, results assigns 1 pt incorrectly.
3. **Driver code conflict** — there are two drivers with similar names/codes (unlikely but possible).

**Fix path**:
1. Probe `fiaformula3.com/Standings/Driver` directly with curl to see exact `TotalPoints` field for Ugochukwu.
2. Probe `fiaformula3.com/Results?raceid=<sprint-race>` to see his actual Sprint finish position.
3. Reconcile: if standings's TotalPoints is the FIA-authoritative value, that's truth; my results-points-from-position is the computation that's wrong. Fix the computation OR drop our point calculation and use a `null` "see standings for points" model.

**Effort**: 30 min to diagnose + fix.

### B5. F2/F3 results tab loads slowly (MEDIUM)

**Symptom**: `/series/f2?tab=results` and `/series/f3?tab=results` take noticeably longer than F1/Formula-E/NASCAR to first paint.

**Root cause**: F2/F3 parsers fetch the standings page (for the `SeasonRaces[]` manifest in `__NEXT_DATA__`) then fan-out per-event Results page fetches. With N=10+ events, that's N+1 sequential HTTP requests. ISR caches per page but every fresh ISR build pays the full latency.

**Fix options**:
1. **Promise.all the per-event fetches** — already done per agent reports, but verify in code.
2. **Vercel KV cache layer** — same pattern as `lib/weather.ts`'s KV-cached Open-Meteo. ~3-hour TTL.
3. **Reduce N** — only fetch races since last cache hit; static for completed past events.

**Recommendation**: verify Promise.all is in place (likely is), add KV cache layer next iteration.

### B6. F2/F3 results have no season trend chart (MEDIUM)

**Symptom**: F1 + Formula E results tabs show a season trend chart. F2 + F3 don't.

**Root cause**: agent designed F2/F3 dispatch without `SeasonTrendChart` — F2/F3 use separate Feature + Sprint panels, and the chart pattern wasn't ported.

**Fix**: F2/F3 parsers emit full classifications (the `__NEXT_DATA__` blob has every driver's per-race points). So data supports a trend. Add `buildSeasonTrendData()` call + `SeasonTrendChart` to F2/F3 dispatch.

**Caveat for F2/F3**: Sprint + Feature both have points. The trend chart's `RaceResult.results[].points` aggregates them. If results parser emits both as separate `RaceResult` entries (which it does — Feature + Sprint per round), the chart will plot the COMBINED total per round which is what users expect.

**Effort**: 30 min.

### B7. FE drivers tab shows "Unknown" team for every driver (KNOWN)

Already known. 0.12.0 work — needs `content/series/formula-e/drivers.json` curated. Same blocks all 13 non-F1/IndyCar series.

### B8. FE Mexico City team "Citroën Racing" (KNOWN — Wikipedia vandalism)

Already documented. Curate `content/series/formula-e/results-overrides.json` keyed by round, or `standings-overrides.json` for the team-name fix. Stellantis's actual FE team is **DS Penske**, not Citroën Racing. Low priority; data-quality not parser-quality.

### B9. FE doubleheader 2nd races dropped (KNOWN)

Already documented. Jeddah-2 (R5), Berlin-2 (R8), Monaco-2 (R10) currently lost to the rowspan filter. Full rowspan inheritance is the proper fix; deferred for now since dropping > rendering wrong.

---

## Re-ranked roadmap — priority order, with effort + impact

Each item carries an estimated dev-hours figure and a one-line "why this rank" justification. The ranking optimizes for user-visible quality first, internal quality second, future-proofing third.

### Immediate — 0.11.4 (this/next session, ~1.5 h)

1. **Drop FE season trend chart** [B1] — `components/tabs/ResultsTab.tsx`, remove `SeasonTrendChart` block from `formula-e` dispatch. Replace with simple `SeasonResultsPanel` only. (~15 min). **Why first**: misleading chart actively harms user trust; quick win.
2. **Clean FE per-event accordion** [B2] — collapse the fake "1 Winner Race winner 25" row to "winner: X · team Y" line only. Either skip rendering the per-entry list when length === 1 AND status === 'Race winner', or hide the accordion expand entirely on FE. (~15 min).
3. **Add CHANGELOG + RELEASES + bump 0.11.4**. Ship as a single PR.

### Critical — 0.11.5 (paste-from-BLOCKED IndyCar results) (~30 min)

4. **IndyCar results** [B3] — paste the BLOCKED agent's Wikipedia-season-page parser implementation (full design in CHANGELOG + handoff sources packet). Wire to `ResultsTab.tsx` dispatch. ~330 LoC + tests. **Why critical**: currently IndyCar has zero results data shown. Highest user impact for the lowest effort (work was already done, just not committed).

### High — 0.11.6 + 0.11.7 (~3.5 h)

5. **WRC + GTWCE + IMSA dispatch wiring** (lib files already in working tree, untracked). ~2 h. **Why**: three more series get live data. Worktree branches at:
   - `scraper/wrc-standings-results @ 669c375`
   - `scraper/gt-world-standings-results @ 632e309`
   - `scraper/imsa-standings-results @ 5d701d8`

6. **WEC recovery from stash + F2 orphan test cleanup** (`agent-leakage-2026-05-20-defer` stash). ~1.5 h. **Why**: WEC code already written + tested, just needs salvaging from stash and selective application.

### Medium — 0.11.8 + 0.11.9 (~4 h)

7. **MotoGP paste-from-BLOCKED** (Pulselive API, full impl in agent report). ~1 h. **Why**: same shape as WSBK (already shipped); should be cleanest to add.

8. **DTM + NLS write-from-research** (motorsport.com / Wikipedia / NLS PDF). ~3 h. **Why**: only series left without live data after MotoGP. Lower priority because fans are more niche.

### Cleanup — 0.11.10 + 0.11.11 (~3 h)

9. **F1 Sprint races + season-trend points fix** (bug #1 from original list). ~1 h. **Why**: F1 trend chart is currently wrong because Sprint points are missing.

10. **F2/F3 perf** — verify Promise.all + add KV cache layer (mirror `lib/weather.ts`). ~1.5 h.

11. **F2/F3 add SeasonTrendChart** [B6] — ~30 min. Sprint + Feature combined trend.

12. **F3 Ugochukwu points discrepancy** [B4] — ~30 min diagnosis + fix.

### Substantial — 0.12.0 drivers.json bulk-commit (~8-15 h, multi-session)

13. **drivers.json across 13 series**. **Why this minor bump**: unlocks `/drivers/<slug>` + `/teams/<slug>` everywhere, resolves "Unknown" team labels visible across FE/F2/F3/MotoGP/WSBK/etc., activates Champions clickability on all 15 series (the PR A1/A2 plumbing is already future-proofed for this).

14. Schema decision needed for multi-class/multi-driver-crew series (WEC, IMSA, GTWCE, NLS, WRC, ADAC 24h) — see 0.12.0 section above for the three approaches considered.

### Significant — 0.13.0 IA redesign (~2-3 days)

15. **3-tab + path-based routing**. **Why after 0.12**: depends on drivers.json being live for the Seasons tab to be useful (driver page links).

### Large — 0.14.0 histories + Moto2/3 (~50 h authoring + ~5 h provisioning)

16. **14 series histories** — user-authored.
17. **Moto2 + Moto3 provisioning** — new series.

### Capstone — 0.15.0 enrichment (~80+ h across multiple weeks)

18. **Past champions added to drivers.json** (Senna, Schumacher, Vettel, Rosberg, etc.).
19. **Photos + bios + accolades** per driver/team.
20. **Driver/team page enrichment** — current standings position, last 5 results, news mentions, country flag.

### Then — 1.0.0 (brand moment)

When the product is feature-complete across all 15 (+ Moto2/3) series. Reserve for the LinkedIn-share / sponsor-pitch / public-launch readiness signal.

---

## Curation-only follow-ups (small, can slot anytime)

- `content/series/formula-e/results-overrides.json` — fix Mexico City "Citroën Racing" → "DS Penske" [B8]
- `content/series/wrc/rounds.json` — fill 9 missing rounds (currently 5 of 14)
- `content/series/wrc/sessions.json` — Rally Japan stage-level timing (pending official itinerary publication)
- Bing B1 sitemap orphan-round filter — needs per-series enumeration of FE doubleheaders / IndyCar Milwaukee R2 / NLS Sunday qualifier rounds.json entries that don't have weekend pages

## Verification follow-ups

- **#39 Weather audit** across 15 series — manual click-through, verify Open-Meteo populates for next-race weekend
- **Champions clickability per-series** — verify on each series tab post-0.12.0 drivers.json landings

## Infra — parked indefinitely unless triggers fire

- Sentry integration (when error volume justifies)
- GitHub Actions CI workflow (when team grows)
- `sk_live_*` Clerk key rotation (when blast radius changes)
- B-perf catch-up (mobile-first audit, deferred to dedicated session)
- Vercel Pro upgrade (when usage hits Hobby tier limits)

---

## Critical landmines added this session

(Appending to the original list in the parent handoff section)

16. **Wikipedia "Race results" table has no Date column on FE.** Parsers must build a `Map<round, Date>` from a sibling Calendar table OR use a season-end placeholder. Required for any Wikipedia-sourced results parser. Pattern in `lib/results/formula-e.ts` `buildRoundToDateMap()`.

17. **Wikipedia doubleheader weekends use `rowspan="2"` on shared cells (E-Prix, Report).** Second-race rows have fewer `<td>` cells. Reading by header logical index pulls wrong cells. Until full rowspan inheritance: skip rows where cell-count < sum-of-header-colspans. Pattern in `lib/results/formula-e.ts` parseRaces.

18. **Winners-only race-results data produces misleading season-trend charts.** If a results parser emits 1 entry per race at position 1 with full points, `buildSeasonTrendData()` shows every driver plateauing at race-winner points. Either implement full-classification scraping OR remove the chart for affected series. Currently affects FE only.

19. **Test pass ≠ feature pass** (carried forward from earlier audit, restated). FE results test fixtures didn't match real Wikipedia structure (no Date column, doubleheader rowspans). Same family of bug-class that bit ChampionsTab's missed patch in 0.10.42 → 0.10.43. Mitigation: refresh fixtures from live HTML when parsing diverges; treat fixture-mismatched code as untested.

---

## Worktree hygiene update (post-#66)

Local branches added to delete-list:
- `bugs/pr-0.11.2-fe-colspan-2026-05-20` (merged via #65)
- `bugs/pr-0.11.3-fe-results-date-fallback-2026-05-20` (merged via #66)

All previously-listed cleanup items still pending.

---

## Versioning state at this checkpoint

| Version | Status | Theme |
|---|---|---|
| 0.11.0 | merged + prod-verified | 5-series scraper sweep |
| 0.11.1 | merged + prod-verified | FE URL switch (didn't fix; superseded by 0.11.2) |
| 0.11.2 | merged + prod-verified | FE colspan standings fix |
| 0.11.3 | merged + prod-verified | FE results date fallback + rowspan filter |
| **0.11.4** | **next** | **FE results UX cleanup (drop misleading trend chart + collapse fake 1-row classification)** |
| 0.11.5 | queued | IndyCar results paste |
| 0.11.6 | queued | WRC + GTWCE + IMSA dispatch |
| 0.11.7 | queued | WEC recovery from stash |
| 0.11.8 | queued | MotoGP paste |
| 0.11.9 | queued | DTM + NLS writes |
| 0.11.10 | queued | F1 Sprint fix |
| 0.11.11 | queued | F2/F3 perf + trend + Ugochukwu math |
| 0.12.0 | queued | drivers.json bulk-commit (13 series) |
| 0.13.0 | future | IA redesign + path routing |
| 0.14.0 | future | histories + Moto2/3 |
| 0.15.0 | future | enrichment (photos, bios, past champions) |
| 1.0.0 | future | brand moment |

---

End of addendum.
