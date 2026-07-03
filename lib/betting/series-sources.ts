import type { DriverForm } from './pricing';
import type { RaceResult } from '@/lib/types';
import { fetchF1Standings } from '@/lib/standings/f1';
import { fetchF1SeasonResults } from '@/lib/results/f1';
import { fetchF2Standings } from '@/lib/standings/f2';
import { fetchF2SeasonResults } from '@/lib/results/f2';

// Server-only. The per-series adapters the betting automation runs on. A series
// qualifies for markets when BOTH adapters exist and two correctness gates hold
// (tested in series-sources.test.ts):
//
//   (a) NAME CONSISTENCY — the driver names produced by the standings source
//       (used to price/build the field at market open) match the names produced
//       by the results source (used at settlement). A mismatch means a winning
//       pick can never resolve.
//   (b) RACE DISAMBIGUATION — on multi-race weekends (F2/F3 Sprint + Feature)
//       the results adapter must return exactly ONE race per round: the
//       HEADLINE race (Feature), which is what winner/podium/top10/exact/
//       forecast markets settle against. Mirrors F1, where the winner market
//       settles on the Grand Prix, never the sprint.
//   (c) ROUND ALIGNMENT — the market's `round` comes from the curated
//       rounds.json numbering (via buildRoundLookupAcrossSeries); the result
//       feed's `RaceResult.round` must use the SAME numbering or settlement
//       matches the wrong race.
//
// Live-probe ledger (fiaformula2.com / fiaformula3.com __NEXT_DATA__, 2026-07-03):
//   - f2: standings FullName === results "Forename Surname" for all 22 drivers
//     (incl. the double-space "Oliver  Goethe" record, identical on both feeds);
//     FIA RoundNumber matches content/series/f2/rounds.json (Melbourne=1,
//     Spielberg=6, Lusail=13, Yas Marina=14). All three gates hold → wired.
//   - f3: gates (a)+(b) hold, but gate (c) FAILS — FIA renumbered after the
//     Bahrain cancellation (Monaco=2, Spielberg=4, contiguous 1..9) while
//     content/series/f3/rounds.json still carries the pre-cancellation
//     numbering with a hole at 2 (Monaco=3, Spielberg=5). A market opened for
//     curated round N would settle against FIA round N (a DIFFERENT race).
//     DO NOT wire f3 until rounds.json is renumbered to the FIA scheme.
//   - motogp / wsbk: not wired — sprint/GP disambiguation + Pulselive naming
//     need their own verification pass before markets can settle safely.
//
// A future 'grid' (qualifying) market's settlement source plugs in HERE as a
// third map (e.g. QUALI_SOURCES: slug -> per-round {driver -> grid position}
// from the qualifying classification — f2's fetchF2SeasonResults().qualifying
// already carries it). Deliberately not built yet: the grid market type ships
// dormant (see lib/betting/markets.ts createGridMarket).

/** Collapse whitespace runs so field keys and settlement names can never drift
 *  on formatting alone. The FIA feeds carry at least one double-space record
 *  ("Oliver  Goethe", live 2026-07-03) that is identical on both feeds TODAY,
 *  but only normalization keeps a one-sided upstream cleanup from stranding an
 *  open market. f1 stays raw on purpose — its Jolpica names are clean, and
 *  open markets already store odds under the raw keys. */
function normalizeDriverName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/** A RaceResult with every entry's driverName whitespace-normalized, so the
 *  settlement names match the normalized field names of FIELD_SOURCES. */
function normalizeRaceNames(race: RaceResult): RaceResult {
  return {
    ...race,
    results: race.results.map(e => ({ ...e, driverName: normalizeDriverName(e.driverName) })),
  };
}

/** {name, points} field per series, priced from current standings at market
 *  open. Names MUST match the series' RESULT_SOURCES names (gate a). */
export const FIELD_SOURCES: Record<string, () => Promise<DriverForm[] | null>> = {
  f1: async () => {
    const s = await fetchF1Standings();
    return s ? s.drivers.map(d => ({ name: d.driverName, points: d.points })) : null;
  },
  f2: async () => {
    const s = await fetchF2Standings();
    return s ? s.drivers.map(d => ({ name: normalizeDriverName(d.driverName), points: d.points })) : null;
  },
};

/** Season classification per series for settlement — exactly one RaceResult per
 *  round (the headline race), same names as FIELD_SOURCES (gates a + b + c). */
export const RESULT_SOURCES: Record<string, () => Promise<RaceResult[]>> = {
  f1: () => fetchF1SeasonResults(),
  // FEATURE races only — the explicit gate-(b) pick. fetchF2SeasonResults
  // splits feature/sprint upstream, so the sprint classification can never
  // reach settlement. Season arg keys the shared KV cache (repo precedent:
  // lib/results-ready.ts); the FIA site only ever serves the current season.
  f2: async () => (await fetchF2SeasonResults(new Date().getUTCFullYear())).feature.map(normalizeRaceNames),
};
