// Phase 0 of the weekly preview/digest blog cadence.
// Design: docs/research/2026-07-07-blog-cadence-automation.md
//
// Deterministically picks the "marquee event of the week" from our own schedule
// loaders and emits a GROUNDED data pack (JSON on stdout) for a drafting session
// / skill to turn into a blog draft. READ-ONLY — no prod writes, no DB. The pack
// carries the numbers our own pages show (standings leader/top, latest podium)
// so a draft can't contradict the site; narrative + fact-check is the drafter's
// job on top of it (RULE #1).
//
//   npx tsx scripts/weekend-post-context.mts --mode preview
//   npx tsx scripts/weekend-post-context.mts --mode digest --now 2026-07-07
//   npx tsx scripts/weekend-post-context.mts --mode digest --series f1 > pack.json
//
// stdout = the JSON pack (or {marquee:null} when nothing races this cycle → skip).
// stderr = a short human summary. Exit 0 always (a skip is a valid outcome).

import { loadAllSeriesMeta, loadSeries } from '../lib/series';
import { groupByWeekend } from '../lib/group';
import { weekendLabel, weekendStartEnd } from '../lib/weekend';
import type { SeriesMeta, Weekend, DriverStanding, RaceResult } from '../lib/types';

// Raw single-leader standings fetchers — mirrors lib/standings-health.ts (proven
// to run under tsx) and lib/standings/brief.ts's eligible set. Deliberately NOT
// importing brief.ts / home-results.ts: those pull in the `server-only`-guarded
// overrides modules. Multi-class series (wec/imsa/gt-world) have no single leader.
import { fetchF1Standings } from '../lib/standings/f1';
import { fetchF2Standings } from '../lib/standings/f2';
import { fetchF3Standings } from '../lib/standings/f3';
import { fetchIndyCarStandings } from '../lib/standings/indycar';
import { fetchFormulaEStandings } from '../lib/standings/formula-e';
import { fetchMotoGPStandings } from '../lib/standings/motogp';
import { fetchNascarCupStandings } from '../lib/standings/nascar-cup';
import { fetchWsbkStandings } from '../lib/standings/wsbk';
import { fetchWRCStandings } from '../lib/standings/wrc';
import { fetchDTMStandings } from '../lib/standings/dtm';

// Raw flat-results fetchers — the same set home-results.ts calls "just missed"
// on (single-class finishing order). Latest-podium extraction is inlined below.
import { fetchF1SeasonResults } from '../lib/results/f1';
import { fetchF3SeasonResults } from '../lib/results/f3';
import { fetchFormulaESeasonResults } from '../lib/results/formula-e';
import { fetchIndyCarSeasonResults } from '../lib/results/indycar';
import { fetchMotoGPSeasonResults } from '../lib/results/motogp';

const DAY_MS = 86_400_000;
// A preview covers a weekend starting within this window; a digest covers one
// that ended within this window. Tuned to the Thu-preview / Mon-digest rhythm.
const PREVIEW_LOOKAHEAD_DAYS = 8;
const DIGEST_LOOKBACK_DAYS = 4;

// Marquee prominence order (most → least). A crown-jewel event can jump its
// series to the front (below).
const PRIORITY = [
  'f1', 'motogp', 'indycar', 'nascar-cup', 'wec', 'formula-e', 'wsbk',
  'f2', 'f3', 'dtm', 'gt-world', 'imsa', 'wrc', 'nls', 'adac-ravenol-24h',
];
const CROWN_JEWELS: { slug: string; match: RegExp }[] = [
  { slug: 'wec', match: /le mans/i },
  { slug: 'indycar', match: /indianapolis|indy\s*500/i },
  { slug: 'f1', match: /monaco/i },
  { slug: 'adac-ravenol-24h', match: /./ }, // the 24h itself is the crown jewel
];

type StandingsFn = (season: number) => Promise<{ drivers: DriverStanding[] } | null>;
const STANDINGS: Record<string, StandingsFn> = {
  f1: () => fetchF1Standings(),
  f2: () => fetchF2Standings(),
  f3: () => fetchF3Standings(),
  indycar: () => fetchIndyCarStandings(),
  'formula-e': () => fetchFormulaEStandings(),
  motogp: s => fetchMotoGPStandings(s),
  'nascar-cup': () => fetchNascarCupStandings(),
  wsbk: s => fetchWsbkStandings(s),
  wrc: () => fetchWRCStandings(),
  dtm: () => fetchDTMStandings(),
};

type ResultsFn = (season: number) => Promise<RaceResult[]>;
const FLAT_RESULTS: Record<string, ResultsFn> = {
  f1: () => fetchF1SeasonResults(),
  f3: s => fetchF3SeasonResults(s),
  'formula-e': () => fetchFormulaESeasonResults(),
  indycar: () => fetchIndyCarSeasonResults({ drivers: null }),
  motogp: s => fetchMotoGPSeasonResults(s),
};

// ---- args ----
const argv = process.argv.slice(2);
function arg(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const mode = (arg('mode') as 'preview' | 'digest' | undefined) ?? 'preview';
if (mode !== 'preview' && mode !== 'digest') {
  console.error('--mode must be "preview" or "digest"');
  process.exit(1);
}
const forceSeries = arg('series');
const nowArg = arg('now');
const now = nowArg ? new Date(nowArg) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error(`--now is not a valid date: ${nowArg}`);
  process.exit(1);
}
const nowMs = now.getTime();

// ---- date / timezone helpers ----
// Minutes east of UTC for a wall clock in `tz` at the given UTC instant. Robust
// across DST via Intl (no hardcoded EEST/EET). Verified with a probe before use.
function tzOffsetMinutes(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - utcMs) / 60000);
}
// The UTC instant of `hour:00` local time in `tz` on calendar date `ymd`.
function localHourInstant(ymd: string, hour: number, tz: string): Date {
  const naive = Date.parse(`${ymd}T${String(hour).padStart(2, '0')}:00:00Z`);
  const off = tzOffsetMinutes(naive, tz); // 15:00 is far from any DST switch hour
  return new Date(naive - off * 60000);
}
function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}
// Monday (UTC) of the ISO week containing d, at 00:00Z.
function mondayOfWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // 0 = Monday
  return new Date(x.getTime() - dow * DAY_MS);
}
function athensLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Athens', weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ---- candidate selection ----
interface Candidate {
  meta: SeriesMeta;
  weekend: Weekend;
  start: Date;
  end: Date;
  title: string;
  crownJewel: boolean;
}

function candidateFor(meta: SeriesMeta, weekends: Weekend[]): Candidate | null {
  const withRange = weekends
    .filter(w => w.sessions.length > 0)
    .map(w => ({ w, se: weekendStartEnd(w) }));
  let hit: { w: Weekend; se: { start: Date; end: Date } } | undefined;
  if (mode === 'preview') {
    hit = withRange
      .filter(({ w, se }) => !w.isPast && se.start.getTime() >= nowMs && se.start.getTime() <= nowMs + PREVIEW_LOOKAHEAD_DAYS * DAY_MS)
      .sort((a, b) => a.se.start.getTime() - b.se.start.getTime())[0];
  } else {
    hit = withRange
      .filter(({ se }) => se.end.getTime() <= nowMs && se.end.getTime() >= nowMs - DIGEST_LOOKBACK_DAYS * DAY_MS)
      .sort((a, b) => b.se.end.getTime() - a.se.end.getTime())[0];
  }
  if (!hit) return null;
  const title = weekendLabel(hit.w, hit.w.round).title;
  const jewel = CROWN_JEWELS.some(
    c => c.slug === meta.slug && (c.match.test(title) || c.match.test(hit!.w.roundName ?? '')),
  );
  return { meta, weekend: hit.w, start: hit.se.start, end: hit.se.end, title, crownJewel: jewel };
}

function rank(c: Candidate): number {
  const base = PRIORITY.indexOf(c.meta.slug);
  const idx = base < 0 ? PRIORITY.length : base;
  return c.crownJewel ? idx - 100 : idx; // crown-jewels jump ahead of everything
}

// Latest finished race + top-3 from a flat feed. Mirrors home-results.latestRaceFromFlat.
function latestPodium(races: RaceResult[]) {
  const finished = races
    .map(r => ({ r, t: r.date instanceof Date ? r.date.getTime() : new Date(r.date).getTime() }))
    .filter(({ r, t }) => Number.isFinite(t) && t <= nowMs && r.results && r.results.length > 0)
    .sort((a, b) => b.t - a.t);
  const latest = finished[0]?.r;
  if (!latest) return null;
  const podium = latest.results
    .filter(e => e.position >= 1 && e.position <= 3)
    .sort((a, b) => a.position - b.position)
    .slice(0, 3)
    .map(e => ({ position: e.position, name: e.driverName, team: e.team || undefined, points: e.points }));
  if (podium.length === 0) return null;
  const date = latest.date instanceof Date ? latest.date : new Date(latest.date);
  return { round: latest.round, raceName: latest.raceName, date: date.toISOString(), podium };
}

// ---- main ----
const metas = await loadAllSeriesMeta();
const candidates: Candidate[] = [];
for (const meta of metas) {
  if (forceSeries && meta.slug !== forceSeries) continue;
  try {
    const series = await loadSeries(meta.slug);
    const weekends = groupByWeekend(series.sessions, now, series.rounds);
    const c = candidateFor(meta, weekends);
    if (c) candidates.push(c);
  } catch (e) {
    console.error(`  (skip ${meta.slug}: ${e instanceof Error ? e.message : e})`);
  }
}

candidates.sort((a, b) => rank(a) - rank(b));
const pick = candidates[0];

if (!pick) {
  const reason = forceSeries
    ? `no ${mode} weekend for ${forceSeries} in window`
    : `no series has a ${mode} weekend in window`;
  console.error(`\n  ${mode}: SKIP — ${reason} (as of ${ymdUtc(now)}).`);
  console.log(JSON.stringify({ mode, generatedForNow: now.toISOString(), marquee: null, reason }, null, 2));
  process.exit(0);
}

const { meta, weekend } = pick;
const season = meta.season;
const roundName = weekend.roundName ?? pick.title;

// publish_at target: preview → Thursday of the race week; digest → the Monday
// after. Both at 15:00 Europe/Athens (DST-correct via Intl).
const targetDate =
  mode === 'preview'
    ? new Date(mondayOfWeek(pick.start).getTime() + 3 * DAY_MS)
    : new Date(mondayOfWeek(pick.end).getTime() + 7 * DAY_MS);
const publishAt = localHourInstant(ymdUtc(targetDate), 15, 'Europe/Athens');

// Grounded standings snapshot (single-leader series only).
let standings: unknown = { available: false, reason: 'multi-class or unsupported series — link to the Standings tab' };
if (STANDINGS[meta.slug]) {
  try {
    const drivers = (await STANDINGS[meta.slug](season))?.drivers ?? null;
    if (drivers && drivers.length) {
      const sorted = [...drivers].sort((a, b) => a.position - b.position);
      standings = {
        available: true,
        leader: { name: sorted[0].driverName, points: sorted[0].points },
        gapToSecond: sorted[1] ? sorted[0].points - sorted[1].points : null,
        top: sorted.slice(0, 5).map(d => ({ position: d.position, name: d.driverName, points: d.points })),
      };
    } else {
      standings = { available: false, reason: 'standings fetch returned empty — verify live' };
    }
  } catch (e) {
    standings = { available: false, reason: `standings fetch failed: ${e instanceof Error ? e.message : e}` };
  }
}

// Grounded latest podium (digest only, flat-feed series only).
let latestResult: unknown = null;
if (mode === 'digest' && FLAT_RESULTS[meta.slug]) {
  try {
    latestResult = latestPodium(await FLAT_RESULTS[meta.slug](season));
  } catch (e) {
    latestResult = { available: false, reason: `results fetch failed: ${e instanceof Error ? e.message : e}` };
  }
}

const weekendHref = `/series/${meta.slug}/weekend/${weekend.round}`;
const pack = {
  mode,
  generatedForNow: now.toISOString(),
  event: {
    seriesSlug: meta.slug,
    seriesName: meta.name,
    round: weekend.round,
    roundName,
    title: pick.title,
    dateRangeLabel: weekend.dateRangeLabel,
    startUtc: pick.start.toISOString(),
    endUtc: pick.end.toISOString(),
    crownJewel: pick.crownJewel,
    watch: meta.watch ?? null,
  },
  schedule: weekend.sessions
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(s => ({
      title: s.title,
      startUtc: s.dateOnly ? null : s.start.toISOString(),
      startAthens: s.dateOnly ? null : athensLabel(s.start),
      dateOnly: !!s.dateOnly,
      significance: s.significance?.note,
    })),
  standings,
  latestResult,
  suggested: {
    slug: `${meta.slug}-${slugify(roundName)}-${season}-${mode === 'preview' ? 'preview' : 'recap'}`,
    seriesSlug: meta.slug,
    publishAtUtc: publishAt.toISOString(),
    publishAtLabel: `${athensLabel(publishAt)} (Europe/Athens)`,
    titleHint:
      mode === 'preview'
        ? `${roundName} ${season}: preview`
        : `${roundName} ${season}: race report`,
    heroImageHint: 'reuse existing curated circuit/series imagery, or leave null',
  },
  groundingNotes: [
    'Numbers above (standings leader/top, latest podium) come from Paddock\'s own reconciled loaders — use them verbatim so the post matches the site.',
    'Everything else (storylines, penalties, quotes, championship narrative) must be researched from primary sources and fact-checked (RULE #1) before drafting.',
    mode === 'digest'
      ? 'Flag any result that may still change on appeal as provisional.'
      : 'Do not state finishing positions or session times as fact — link the weekend page instead.',
    `Deep-link the weekend page: ${weekendHref}`,
  ],
};

console.error(
  `\n  ${mode.toUpperCase()} marquee: ${meta.name} — ${roundName} (R${weekend.round})` +
    `${pick.crownJewel ? ' [crown jewel]' : ''}\n` +
    `  window: ${pick.start.toISOString().slice(0, 10)} → ${pick.end.toISOString().slice(0, 10)}` +
    ` · publish ${pack.suggested.publishAtLabel}\n` +
    `  standings: ${(standings as { available: boolean }).available ? 'grounded' : 'link-out'}` +
    ` · latestResult: ${latestResult && (latestResult as { podium?: unknown }).podium ? 'grounded' : mode === 'digest' ? 'link-out' : 'n/a'}` +
    ` · candidates considered: ${candidates.length}\n`,
);
console.log(JSON.stringify(pack, null, 2));
