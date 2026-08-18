// The session-classification contract layer (reimagining §9 step 3; extracted
// verbatim from app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx,
// where ~250 lines of per-series adapters were inlined). F1 is the simplest
// sport on this site — one race, one table per round — and is NOT the
// template: these adapters exist precisely because fourteen championships
// break the F1 assumption (per-class fields, multi-race rounds, feeder-series
// session feeds). Every redesigned results surface builds on this module so
// the shape is right once, not fifteen times.

import { sessionSlug } from '@/lib/weekend';
import type { RaceResult, Series } from '@/lib/types';
import type { OpenF1Session, SessionClassification } from '@/lib/results/openf1';
import { fetchWecSeasonResults, WEC_RESULT_CLASSES } from '@/lib/results/wec';
import { fetchImsaSeasonResults } from '@/lib/results/imsa';
import { IMSA_CLASSES } from '@/lib/standings/imsa';
import {
  fetchAllGtWorldSeasonRaces,
  type GtWorldRaceResult,
} from '@/lib/results/gt-world';
import { fetchF2SeasonResults } from '@/lib/results/f2';
import { fetchF3SessionResults } from '@/lib/results/f3';
import { loadSnapshotSource } from '@/components/weekend/WeekendStandingsSnapshot';

// Match our curated session to its OpenF1 twin: slugified name first, then
// nearest start time within 3h — names drift ("Sprint Qualifying" vs
// "Sprint Shootout" eras), start times don't.
export function matchOpenF1Session(
  candidates: OpenF1Session[],
  slug: string,
  start: Date,
): OpenF1Session | null {
  const byName = candidates.find(s => sessionSlug(s.session_name) === slug);
  if (byName) return byName;
  let best: OpenF1Session | null = null;
  let bestDelta = 3 * 3600 * 1000;
  for (const s of candidates) {
    const delta = Math.abs(new Date(s.date_start).getTime() - start.getTime());
    if (delta < bestDelta) {
      bestDelta = delta;
      best = s;
    }
  }
  return best;
}

// Race-session classifications for non-F1 series (the per-round results the
// series' own results tab renders). Real classifications only: WRC comes
// from the per-rally articles (NOT the chart sub-totals), DTM has no
// per-race source yet, IMSA/GTWC class shapes are a follow-up.
// WRC is absent deliberately: rallies have stage itineraries, not a "race"
// session — its per-rally classification lives on the results tab.
const RACE_SESSION_SERIES = new Set([
  'f2', 'f3', 'formula-e', 'indycar', 'motogp', 'wsbk', 'nascar-cup',
]);

export function isRaceLikeTitle(title: string): boolean {
  const cleaned = title.replace(/^.*?[-–—:]\s*/, '');
  if (/sprint\s*(qualifying|shootout)/i.test(cleaned)) return false;
  return /race|sprint|feature/i.test(cleaned);
}

// Multi-race rounds (Feature/Sprint, R1/Superpole/R2) — pick the candidate
// whose name shares the most tokens with the session title; tie → first.
export function pickRaceForSession(candidates: RaceResult[], sessionTitle: string): RaceResult | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const tokens = ['sprint', 'feature', 'superpole', 'race 1', 'race 2'];
  const t = sessionTitle.toLowerCase();
  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    const n = c.raceName.toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (t.includes(tok) && n.includes(tok)) score += 2;
      if (t.includes(tok) !== n.includes(tok)) score -= 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

// Class-based series whose race sessions render one classification table per
// class/cup, fed by the same season feeds the Results tab uses (categories
// parity, operator 2026-06-13: a class with results on the Results tab must
// show them on the weekend's race-session page too).
export const CLASS_RESULT_SERIES = new Set(['wec', 'imsa', 'gt-world']);

// Sprint rounds carry two races; match "Sprint Race 1/2" session titles to
// the SRO raceName ("Race 1"/"Race 2") by digit. Endurance rounds have one.
export function pickGtWorldRace(
  races: GtWorldRaceResult[],
  sessionTitle: string,
): GtWorldRaceResult | null {
  if (races.length === 0) return null;
  if (races.length === 1) return races[0];
  const digit = /race\s*(\d)/i.exec(sessionTitle)?.[1];
  if (digit) {
    const hit = races.find(r => r.raceName.includes(digit));
    if (hit) return hit;
  }
  return races.find(r => /main/i.test(r.raceName)) ?? races[0];
}

// No points columns anywhere here: these are timing exports (the same
// limitation the Results tab documents per series), so isRace stays false
// and the time column shows total time / gap.
export async function fetchClassClassifications(
  series: Series,
  round: number,
  sessionTitle: string,
): Promise<{ cls: string; data: SessionClassification }[]> {
  const slug = series.meta.slug;

  if (slug === 'wec') {
    const rounds = await fetchWecSeasonResults();
    const roundResults = rounds.find(r => r.round === round);
    if (!roundResults) return [];
    return WEC_RESULT_CLASSES.flatMap(cls => {
      const entries = roundResults.perClass[cls] ?? [];
      if (entries.length === 0) return [];
      return [{
        cls: cls as string,
        data: {
          isQualifying: false,
          isRace: false,
          entries: entries.map(e => ({
            position: e.position,
            driverName: e.drivers || e.team,
            driverCode: `#${e.carNumber}`,
            team: e.drivers ? e.team : e.manufacturer,
            time: e.elapsedTime,
            gap: e.gap,
          })),
        },
      }];
    });
  }

  if (slug === 'imsa') {
    const rounds = await fetchImsaSeasonResults();
    const roundResults = rounds.find(r => r.round === round);
    if (!roundResults) return [];
    return IMSA_CLASSES.flatMap(cls => {
      const entries = roundResults.perClass[cls] ?? [];
      if (entries.length === 0) return [];
      return [{
        cls: cls as string,
        data: {
          isQualifying: false,
          isRace: false,
          entries: entries.map(e => ({
            position: e.position,
            driverName: e.drivers || e.team,
            driverCode: `#${e.carNumber}`,
            team: e.vehicle ? `${e.team} · ${e.vehicle}` : e.team,
            time: e.elapsedTime,
            gap: e.gap,
          })),
        },
      }];
    });
  }

  if (slug === 'gt-world') {
    const races = (await fetchAllGtWorldSeasonRaces(series.meta.season)).filter(
      r => r.round === round,
    );
    const race = pickGtWorldRace(races, sessionTitle);
    if (!race) return [];
    const cupOrder = ['pro', 'gold', 'silver', 'bronze', 'unknown'] as const;
    return cupOrder.flatMap(cup => {
      const entries = race.entries.filter(e => e.cup === cup);
      if (entries.length === 0) return [];
      return [{
        cls: entries[0].cupLabel || cup,
        data: {
          isQualifying: false,
          isRace: false,
          entries: entries.map(e => ({
            position: e.position,
            driverName: e.drivers.join(' · '),
            driverCode: `#${e.carNumber}`,
            team: e.car ? `${e.team} · ${e.car}` : e.team,
            time: e.time,
            gap: e.gap,
          })),
        },
      }];
    });
  }

  return [];
}

// F2/F3 practice and qualifying classifications (their races go through
// fetchRoundClassification like the other flat-feed series). The FIA junior
// series carry every session — practice, qualifying, both races — on the same
// per-round results page; these are the two non-race ones, keyed per round.
export const FORMULA_SESSION_SERIES = new Set(['f2', 'f3']);

export async function fetchFormulaNonRaceClassification(
  slug: string,
  season: number,
  round: number,
  sessionTitle: string,
): Promise<SessionClassification | null> {
  const name = sessionTitle.replace(/^.*?[-–—:]\s*/, '');
  const isQuali = /qualifying|superpole/i.test(name);
  const isPractice = /practice/i.test(name) || /^fp\s*\d/i.test(name);
  if (!isQuali && !isPractice) return null;
  const { qualifying, practice } =
    slug === 'f3' ? await fetchF3SessionResults(season) : await fetchF2SeasonResults(season);
  const list = isQuali ? qualifying : practice;
  return list?.find(r => r.round === round)?.data ?? null;
}

export async function fetchRoundClassification(
  series: Series,
  round: number,
  sessionTitle: string,
): Promise<SessionClassification | null> {
  const slug = series.meta.slug;
  if (!RACE_SESSION_SERIES.has(slug) || !isRaceLikeTitle(sessionTitle)) return null;
  const source = await loadSnapshotSource(series);
  if (!source) return null;
  const pool: RaceResult[] = [...source.races, ...(source.extras ?? [])];
  const race = pickRaceForSession(pool.filter(r => r.round === round), sessionTitle);
  if (!race || race.results.length <= 1) return null;
  return {
    isQualifying: false,
    isRace: true,
    entries: race.results.map(e => ({
      position: e.position,
      driverName: e.driverName,
      driverCode: e.driverCode,
      team: e.team,
      time: e.time ?? e.status,
      points: e.points,
    })),
  };
}
