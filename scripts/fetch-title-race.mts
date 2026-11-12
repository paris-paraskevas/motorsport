// A season's title race (O29): each round's name, local race day and winner, and the points of the season's top three
// after every round, from Jolpica, into content/series/<slug>/title-race-<season>.json. The file's words (the band's
// line, the turning points, the decider) are written by hand and kept: a run replaces only `rounds` and `drivers`.
//
//   npx tsx scripts/fetch-title-race.mts 2025
//   npx tsx scripts/fetch-title-race.mts 2026 --slug f1
//
// By hand, after a season's last race (rules.md § 12):
//   1. Run it for the season. It writes the numbers and prints each round's day, winner and the three totals.
//   2. Check the totals against formula1.com's season results for each of the three (/en/results/<season>/drivers/…),
//      and the days and winners against /en/results/<season>/races.
//   3. Write the band's line (`intro`), the turning points (`turns`) and the decider in the same file, every claim with
//      its sources, checked against formula1.com or the FIA.
//   4. npx tsx scripts/bundle-content.mts, then the publish run --only /series/<slug>/.
//
// Jolpica allows four calls a second and 500 an hour, so the calls go 650 ms apart: 28 for a 24-round season.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { matchCircuit } from '../lib/circuits';
import { loadTeamNames, officialTeamName, type TitleRaceFile } from '../lib/series-content';

const argv = process.argv.slice(2);
const season = Number(argv[0]);
const slugAt = argv.indexOf('--slug');
const slug = slugAt >= 0 ? argv[slugAt + 1] : 'f1';
if (!Number.isInteger(season) || season < 1950 || !slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('usage: npx tsx scripts/fetch-title-race.mts <season> [--slug f1]');
  process.exit(1);
}

const BASE = `https://api.jolpi.ca/ergast/${slug}/${season}`;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
let calls = 0;

interface JDriver { driverId: string; code?: string; givenName: string; familyName: string }
interface JResult { position: string; Driver: JDriver; Constructor: { name: string } }
interface JRace { round: string; raceName: string; date: string; time?: string; Results?: JResult[] }
interface JStanding { position: string; points: string; Driver: JDriver; Constructors: { name: string }[] }

async function get<T>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await wait(650);
    calls++;
    const res = await fetch(`${BASE}/${path}`, { headers: { accept: 'application/json' } });
    if (res.status === 429) {
      await wait(5000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }
  throw new Error(`${path}: still rate limited after four tries`);
}

/** The race's own calendar day where it was run: Jolpica dates a race in UTC, which puts a night race in the Americas
 *  on the next day (Las Vegas 2025: 23 November in UTC, 22 November on formula1.com). */
async function raceDay(race: JRace): Promise<{ day: string; local: boolean }> {
  const tz = (await matchCircuit(race.raceName))?.tz;
  if (!tz || !race.time) return { day: race.date, local: false };
  const at = new Date(`${race.date}T${race.time}`);
  return { day: new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at), local: true };
}

const fullName = (d: JDriver) => `${d.givenName} ${d.familyName}`;

const races = (await get<{ MRData: { RaceTable: { Races: JRace[] } } }>('races/?limit=100')).MRData.RaceTable.Races;
if (races.length === 0) throw new Error(`no ${season} calendar`);
const winners = new Map(
  (await get<{ MRData: { RaceTable: { Races: JRace[] } } }>('results/1/?limit=100')).MRData.RaceTable.Races.map(r => [Number(r.round), r.Results?.[0]]),
);
const last = races.length;
if (!winners.has(last)) throw new Error(`round ${last} has no result yet: run this after the season's last race`);
// Whether the standings hold sprint points too, for the chart's line "sprints included".
const sprints = Number((await get<{ MRData: { total: string } }>('sprint/?limit=1')).MRData.total) > 0;

const names = await loadTeamNames(slug);
// A season with no lines of its own in team-names.json takes the newest season's (2025 has none: its "Red Bull" is
// formula1.com's "Red Bull Racing", as in 2026). Step 2 checks every name the run prints.
const newest = Object.keys(names ?? {}).filter(k => /^\d{4}$/.test(k)).sort().pop();
const team = (name: string) => officialTeamName(names, names?.[String(season)] ? String(season) : newest, name);

const tables: JStanding[][] = [];
for (let r = 1; r <= last; r++) {
  const table = (await get<{ MRData: { StandingsTable: { StandingsLists: { DriverStandings: JStanding[] }[] } } }>(`${r}/driverstandings/?limit=100`)).MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];
  // An empty table would write a round with no leader and no points that the loader takes as whole.
  if (table.length === 0) throw new Error(`round ${r}: no standings`);
  tables.push(table);
}
const finalTable = tables[last - 1];
const three = finalTable.slice(0, 3);
if (three.length < 3) throw new Error('fewer than three drivers in the final standings');
const lastRace = (await get<{ MRData: { RaceTable: { Races: JRace[] } } }>(`${last}/results/?limit=100`)).MRData.RaceTable.Races[0];

const rounds: TitleRaceFile['rounds'] = [];
const unmatched: string[] = [];
for (const race of races) {
  const n = Number(race.round);
  const w = winners.get(n);
  const { day, local } = await raceDay(race);
  if (!local) unmatched.push(`${n} ${race.raceName}`);
  const top = tables[n - 1]?.[0];
  rounds.push({
    round: n,
    name: race.raceName,
    date: day,
    winner: w ? fullName(w.Driver) : '',
    team: w ? team(w.Constructor.name) : '',
    leader: top ? fullName(top.Driver) : '',
    lead: Number(top?.points ?? 0),
  });
}
const drivers: TitleRaceFile['drivers'] = three.map(s => ({
  name: fullName(s.Driver),
  code: s.Driver.code ?? s.Driver.familyName.slice(0, 3).toUpperCase(),
  team: team(s.Constructors[s.Constructors.length - 1]?.name ?? ''),
  last: Number(lastRace?.Results?.find(x => x.Driver.driverId === s.Driver.driverId)?.position) || null,
  points: tables.map(t => Number(t.find(x => x.Driver.driverId === s.Driver.driverId)?.points ?? 0)),
}));

// Keep every word already written by hand; replace the numbers.
const file = join(process.cwd(), 'content', 'series', slug, `title-race-${season}.json`);
const kept: Record<string, unknown> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
for (const k of ['season', 'sprints', 'rounds', 'drivers']) delete kept[k];
const words = Object.entries(kept).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v, null, 2).replace(/\n/g, '\n  ')}`);
const line = (x: object) => `    ${JSON.stringify(x).replace(/":/g, '": ').replace(/,"/g, ', "')}`;
writeFileSync(
  file,
  `{\n  "season": ${season},\n${words.map(w => `${w},\n`).join('')}  "sprints": ${sprints},\n  "rounds": [\n${rounds.map(line).join(',\n')}\n  ],\n  "drivers": [\n${drivers.map(line).join(',\n')}\n  ]\n}\n`,
);

for (const r of rounds) {
  const totals = drivers.map(d => `${d.code} ${String(d.points[r.round - 1]).padStart(3)}`).join('  ');
  console.log(`${String(r.round).padStart(2)}  ${r.date}  ${r.name.padEnd(26)} ${r.winner.padEnd(18)} ${totals}  led by ${r.leader} ${r.lead}`);
}
console.log(`teams: ${[...new Set([...drivers.map(d => d.team), ...rounds.map(r => r.team)])].join(', ')}`);
if (unmatched.length) console.log(`UTC days, no circuit time zone matched: ${unmatched.join('; ')}`);
console.log(`${calls} calls; wrote ${file}`);
