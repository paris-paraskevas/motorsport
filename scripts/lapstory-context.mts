// Grounding for the F1 "lap-by-lap analysis" blog variant (the race chronology:
// who overtook whom, who pitted, who retired, safety cars, tyre strategy).
// Mirrors scripts/weekend-post-context.mts: READ-ONLY, emits a GROUNDED JSON
// pack on stdout for a drafting session/skill to narrate. F1-ONLY — OpenF1 is
// the only per-lap source we have.
//
//   npx tsx scripts/lapstory-context.mts                 # latest completed F1 race
//   npx tsx scripts/lapstory-context.mts --round 10      # a specific round
//   npx tsx scripts/lapstory-context.mts --round 10 --now 2026-07-21
//
// stdout = the JSON pack; stderr = a short human summary. Exit 1 (loud) when the
// OpenF1 race session can't be resolved — NEVER emit a silent empty pack, or a
// draft could be written about a race we have no data for (RULE #1).
//
// Data tiers baked into the pack (factTiers): the classification, DNFs, stints,
// pit laps/durations and race-control neutralisations/penalties are authoritative
// (they drive the site's own tabs). Individual overtakes are OpenF1-recorded and
// coverage is admittedly incomplete — the drafter cross-checks every DECISIVE
// pass against a primary race report before asserting it (the guardrail behind
// feedback-paddock-scrutinise-drafts).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadSeries } from '../lib/series';
import { groupByWeekend } from '../lib/group';
import { weekendStartEnd, weekendLabel } from '../lib/weekend';
import {
  fetchOpenF1WeekendSessions,
  fetchSessionClassification,
  type OpenF1Session,
} from '../lib/results/openf1';
import type { OF1Lap, OF1Overtake, OF1Pit, OF1RaceControl, OF1Stint } from '../lib/openf1/types';

const OF1_BASE = 'https://api.openf1.org/v1';
const SLUG = 'f1';

// ---- args ----
const argv = process.argv.slice(2);
function arg(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const roundArg = arg('round');
const nowArg = arg('now');
const now = nowArg ? new Date(nowArg) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error(`--now is not a valid date: ${nowArg}`);
  process.exit(1);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Plain-fetch OpenF1 (no auth, historical data is immutable). Deliberately not
// the paced client (lib/openf1/client → fetchUpstream/KV) so it runs clean under
// tsx. OpenF1 free tier is ~3 req/s, so pace calls ~380ms apart and RETRY on a
// throttle (429/5xx → !res.ok): without this, a throttled race_control fetch
// returns [] and SILENTLY drops the safety cars/penalties from the pack (seen
// live). An empty array on a genuine 200 is returned as-is; callers guard the
// datasets that must never be empty for a completed race.
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let lastCallAt = 0;
// Every endpoint we call is NON-EMPTY for a completed race, so an empty array
// means an OpenF1 throttle (429 → !ok, or an empty 200 under load), not "quiet
// race" — retry until it's populated. ~600ms spacing (~1.6 req/s, well under the
// 3/s free limit) + growing backoff; give up loudly after `attempts`.
async function of1<T>(endpoint: string, sessionKey: number, attempts = 7): Promise<T[]> {
  const url = `${OF1_BASE}/${endpoint}?session_key=${sessionKey}`;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const gap = 600 - (Date.now() - lastCallAt);
    if (gap > 0) await sleep(gap);
    lastCallAt = Date.now();
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data as T[];
      }
    } catch {
      // network error — fall through to backoff
    }
    await sleep(600 * (attempt + 1));
  }
  console.error(`  ⚠ OpenF1 ${endpoint} still empty after ${attempts} tries — pack unreliable.`);
  return [];
}

// Curated number → { name, team } from the committed grid (clean display names),
// read straight off disk to avoid any server-only import under tsx.
function curatedGrid(): Map<number, { name: string; team: string }> {
  const map = new Map<number, { name: string; team: string }>();
  try {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'series', SLUG, 'drivers.json');
    const json = JSON.parse(readFileSync(file, 'utf-8')) as {
      teams: { name: string; drivers: { name: string; number?: number }[] }[];
    };
    for (const team of json.teams) {
      for (const d of team.drivers) {
        if (typeof d.number === 'number') map.set(d.number, { name: d.name, team: team.name });
      }
    }
  } catch {
    /* fall back to bare #number below */
  }
  return map;
}

// Global lap clock: lap N is taken to start at the earliest date_start recorded
// for that lap across all drivers. Used to anchor overtakes (which carry only a
// timestamp) to a lap number.
function buildLapClock(laps: OF1Lap[]): { lap: number; start: number }[] {
  const earliest = new Map<number, number>();
  for (const l of laps) {
    if (!l.date_start) continue;
    const t = Date.parse(l.date_start);
    if (!Number.isFinite(t)) continue;
    const cur = earliest.get(l.lap_number);
    if (cur === undefined || t < cur) earliest.set(l.lap_number, t);
  }
  return [...earliest.entries()].map(([lap, start]) => ({ lap, start })).sort((a, b) => a.start - b.start);
}
function lapAt(clock: { lap: number; start: number }[], dateISO: string): number | null {
  const t = Date.parse(dateISO);
  if (!Number.isFinite(t)) return null;
  let lap: number | null = null;
  for (const c of clock) {
    if (t >= c.start) lap = c.lap;
    else break;
  }
  return lap;
}

// ---- resolve the target weekend ----
const series = await loadSeries(SLUG);
const season = series.meta.season;
const weekends = groupByWeekend(series.sessions, now, series.rounds).filter(w => w.sessions.length > 0);

let weekend;
if (roundArg) {
  const r = Number(roundArg);
  weekend = weekends.find(w => w.round === r);
  if (!weekend) {
    console.error(`no F1 weekend for round ${r} (${season}).`);
    process.exit(1);
  }
} else {
  // latest completed race weekend
  weekend = weekends
    .map(w => ({ w, se: weekendStartEnd(w) }))
    .filter(({ se }) => se.end.getTime() <= now.getTime())
    .sort((a, b) => b.se.end.getTime() - a.se.end.getTime())[0]?.w;
  if (!weekend) {
    console.error(`no completed F1 race weekend on/before ${now.toISOString().slice(0, 10)}.`);
    process.exit(1);
  }
}

const roundName = weekend.roundName ?? weekendLabel(weekend, weekend.round).title;
const { start, end } = weekendStartEnd(weekend);

// ---- resolve the OpenF1 race session for the weekend ----
const of1Sessions = await fetchOpenF1WeekendSessions(start, end);
const race: OpenF1Session | undefined =
  of1Sessions.find(s => s.session_name === 'Race') ??
  of1Sessions.find(s => /race/i.test(s.session_name) && !/sprint/i.test(s.session_name));

if (!race) {
  console.error(
    `\n  LAPSTORY: STOP — OpenF1 has no Race session for ${roundName} (R${weekend.round}) ` +
      `in ${start.toISOString().slice(0, 10)}…${end.toISOString().slice(0, 10)}.\n` +
      `  OpenF1 lists ${of1Sessions.length} session(s): ${of1Sessions.map(s => s.session_name).join(', ') || 'none'}.\n` +
      `  The race may not be in OpenF1 yet (data lag), or the weekend dates don't overlap. No pack emitted.\n`,
  );
  process.exit(1);
}
const sk = race.session_key;

// ---- pull everything (classification = authoritative; raw arrays for the chronology) ----
const classification = await fetchSessionClassification(race);
const stints = await of1<OF1Stint>('stints', sk);
const raceControl = await of1<OF1RaceControl>('race_control', sk);
const overtakes = await of1<OF1Overtake>('overtakes', sk);
const pit = await of1<OF1Pit>('pit', sk);
const laps = await of1<OF1Lap>('laps', sk);

// Guard: these are never empty for a completed race. An empty one means a
// throttle slipped through — warn so a thin pack is never mistaken for a quiet race.
for (const [label, len] of [['laps', laps.length], ['race_control', raceControl.length], ['stints', stints.length]] as const) {
  if (len === 0) console.error(`  ⚠ ${label} EMPTY for a completed race — pack is unreliable, re-run (likely OpenF1 throttle).`);
}

const grid = curatedGrid();
const name = (n: number | null | undefined): string =>
  (typeof n === 'number' ? grid.get(n)?.name : undefined) ?? (typeof n === 'number' ? `#${n}` : 'unknown');

const clock = buildLapClock(laps);
const totalLaps =
  stints.reduce((m, s) => Math.max(m, s.lap_end ?? 0), 0) ||
  laps.reduce((m, l) => Math.max(m, l.lap_number ?? 0), 0);

// ---- classification + DNFs (authoritative) ----
const classified = (classification?.entries ?? [])
  .slice()
  .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
  .map(e => ({
    position: e.position,
    driver: e.driverName,
    team: e.team,
    laps: e.laps ?? null,
    points: e.points ?? 0,
    status: e.status ?? null,
  }));
const dnfs = classified
  .filter(e => e.status)
  .map(e => ({ driver: e.driver, team: e.team, status: e.status, lastLap: e.laps }));

// ---- neutralisations + penalties (authoritative — race_control) ----
const neutralisations = raceControl
  .filter(rc => (rc.flag || '').toUpperCase() === 'RED' || (rc.category || '').toLowerCase() === 'safetycar' || /safety car|virtual safety/i.test(rc.message || ''))
  .map(rc => ({
    lap: rc.lap_number ?? lapAt(clock, rc.date),
    type: (rc.flag || '').toUpperCase() === 'RED'
      ? 'Red flag'
      : /virtual/i.test(rc.message || '')
        ? 'Virtual Safety Car'
        : 'Safety Car',
    detail: rc.message,
    at: rc.date,
  }));
const penalties = raceControl
  .filter(rc => /penalty|investigation|noted|deleted/i.test(rc.message || ''))
  .map(rc => ({
    lap: rc.lap_number ?? lapAt(clock, rc.date),
    driver: rc.driver_number ? name(rc.driver_number) : null,
    detail: rc.message,
    at: rc.date,
  }));

// ---- pit stops (authoritative) ----
const stops = pit
  .map(p => ({
    lap: p.lap_number,
    driver: name(p.driver_number),
    durationSec: p.stop_duration ?? p.pit_duration ?? null,
  }))
  .sort((a, b) => (a.lap ?? 0) - (b.lap ?? 0));

// ---- tyre strategy (authoritative) ----
const byDriverStints = new Map<number, { compound: string | null; lapStart: number; lapEnd: number; ageAtStart: number | null }[]>();
for (const s of stints) {
  const arr = byDriverStints.get(s.driver_number) ?? [];
  arr.push({ compound: s.compound, lapStart: s.lap_start, lapEnd: s.lap_end, ageAtStart: s.tyre_age_at_start });
  byDriverStints.set(s.driver_number, arr);
}
const strategy = [...byDriverStints.entries()]
  .map(([n, arr]) => ({ driver: name(n), stints: arr.sort((a, b) => a.lapStart - b.lapStart) }))
  .sort((a, b) => a.driver.localeCompare(b.driver));

// ---- overtakes (OpenF1-recorded → CROSS-CHECK tier), FULL FIELD ----
// Every recorded pass, front to back, lap-anchored via the clock. OpenF1's
// overtake feed also fires on pit-cycling (a car "passes" one that just pitted),
// so flag likelyPitCycle when either driver pitted within ±1 lap — the drafter
// skips those as they aren't on-track moves. forPosition lets the drafter spread
// named passes across the field instead of only the lead battle.
const pitLapsByDriver = new Map<number, number[]>();
for (const p of pit) {
  const arr = pitLapsByDriver.get(p.driver_number) ?? [];
  if (typeof p.lap_number === 'number') arr.push(p.lap_number);
  pitLapsByDriver.set(p.driver_number, arr);
}
const nearPit = (driverNum: number, lap: number | null): boolean => {
  if (lap == null) return false;
  const pls = pitLapsByDriver.get(driverNum);
  return !!pls && pls.some(pl => Math.abs(pl - lap) <= 1);
};
const overtakesOut = overtakes
  .map(o => {
    const lap = lapAt(clock, o.date);
    return {
      lap,
      at: o.date,
      overtaker: name(o.overtaking_driver_number),
      overtaken: name(o.overtaken_driver_number),
      forPosition: o.position,
      likelyPitCycle: nearPit(o.overtaken_driver_number, lap) || nearPit(o.overtaking_driver_number, lap),
    };
  })
  .sort((a, b) => (a.lap ?? 0) - (b.lap ?? 0) || Date.parse(a.at) - Date.parse(b.at));
const onTrackOvertakes = overtakesOut.filter(o => !o.likelyPitCycle);

const podium = classified.filter(e => e.position && e.position <= 3);
const weekendHref = `/series/${SLUG}/weekend/${weekend.round}`;

const pack = {
  variant: 'lapstory',
  generatedForNow: now.toISOString(),
  event: {
    seriesSlug: SLUG,
    seriesName: series.meta.name,
    round: weekend.round,
    roundName,
    sessionKey: sk,
    sessionName: race.session_name,
    dateStartUtc: race.date_start,
    location: race.location,
    totalLaps,
    weekendHref,
  },
  podium: podium.map(e => ({ position: e.position, driver: e.driver, team: e.team, points: e.points })),
  classification: classified,
  dnfs,
  neutralisations,
  penalties,
  stops,
  strategy,
  overtakes: overtakesOut,
  totalOvertakesRecorded: overtakes.length,
  onTrackOvertakesCount: onTrackOvertakes.length,
  suggested: {
    slug: `${SLUG}-${slugify(roundName)}-${season}-lap-by-lap`,
    seriesSlug: SLUG,
    titleHint: `${roundName} ${season}: lap by lap`,
  },
  factTiers: {
    authoritative: [
      'classification / podium / points / DNFs (final result)',
      'tyre strategy (stints)',
      'pit stops (lap + duration)',
      'neutralisations (safety car / VSC / red flag laps)',
      'penalties + investigations (race control)',
    ],
    crossCheck: [
      'overtakes — OpenF1-recorded, full field. Coverage is admittedly incomplete. Skip likelyPitCycle:true rows (a place gained because the other car pitted, not an on-track pass). Confirm every DECISIVE pass (lead / podium / points-deciding) against a primary race report; midfield passes may be attributed to OpenF1 timing as-is.',
      'overtake lap numbers are inferred from a lap clock (earliest lap start), so ±1 lap; a primary source wins where one exists.',
    ],
  },
  groundingNotes: [
    'F1-only pack (OpenF1 is the only per-lap source). All numbers here are from OpenF1, which powers the site\'s own Race Story / results.',
    'Use the authoritative tier verbatim; treat overtakes as OpenF1-timed leads — skip likelyPitCycle rows, verify the decisive ones (RULE #1).',
    'When naming midfield/back-of-grid passes, ATTRIBUTE the movement data to OpenF1 timing in the post (coverage is not exhaustive) — mirrors the site\'s existing OpenF1 attribution.',
    'Flag any classification that can still change on appeal as provisional.',
    `Deep-link the weekend page: ${weekendHref}`,
  ],
};

console.error(
  `\n  LAPSTORY: ${series.meta.name} — ${roundName} (R${weekend.round}) · OpenF1 session ${sk} (${race.session_name})\n` +
    `  laps ${totalLaps} · classified ${classified.length} · DNFs ${dnfs.length} · stops ${stops.length}` +
    ` · neutralisations ${neutralisations.length} · penalties ${penalties.length}` +
    ` · overtakes ${onTrackOvertakes.length} on-track / ${overtakes.length} recorded\n` +
    (classification ? '' : '  ⚠ classification EMPTY — OpenF1 /session_result returned nothing; verify before drafting.\n'),
);
console.log(JSON.stringify(pack, null, 2));
