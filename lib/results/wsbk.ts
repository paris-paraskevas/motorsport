import type { RaceResult, RaceResultEntry } from '@/lib/types';
import type { SessionClassification, SessionClassificationEntry } from '@/lib/results/openf1';
import {
  readResultsCache,
  writeResultsCache,
  seasonCacheKey,
} from '@/lib/results-cache';

export type { RaceResult, RaceResultEntry };

// Same Pulselive backend as the standings loader — see `lib/standings/wsbk.ts`
// header comment for the host justification.
const API_BASE = 'https://api.wsbk.pulselive.com';

// WorldSBK round = Race 1 (Sat) + Superpole Race (Sun, 10 laps, half-ish
// points) + Race 2 (Sun). Session source_ids: 001 = RC1, 002 = SPRC,
// 003 = RC2. `short_name` strings from the API confirm this mapping.
// Treat each as its own RaceResult so the SeasonResultsPanel can render
// three distinct cards per weekend.
interface WsbkSessionDef {
  sourceId: string;
  shortName: 'RC1' | 'SPRC' | 'RC2';
  label: 'Race 1' | 'Superpole Race' | 'Race 2';
  order: number;
}

const RACE_SESSIONS: WsbkSessionDef[] = [
  { sourceId: '001', shortName: 'RC1', label: 'Race 1', order: 1 },
  { sourceId: '002', shortName: 'SPRC', label: 'Superpole Race', order: 2 },
  { sourceId: '003', shortName: 'RC2', label: 'Race 2', order: 3 },
];

// Sanity floor — Class A WorldSBK grid is 24+ riders. Anything under 8 means
// the result feed is structurally broken; skip that session rather than
// rendering a half-empty card.
const MIN_FINISHERS = 8;

interface JsonApiResource {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { type: string; id: string } }>;
}

interface JsonApiEnvelope {
  data?: JsonApiResource[];
  included?: JsonApiResource[];
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function buildIncludedMap(
  included: JsonApiResource[] | undefined,
): Record<string, Record<string, JsonApiResource>> {
  const map: Record<string, Record<string, JsonApiResource>> = {};
  if (!Array.isArray(included)) return map;
  for (const item of included) {
    if (!item?.type || !item?.id) continue;
    if (!map[item.type]) map[item.type] = {};
    map[item.type][item.id] = item;
  }
  return map;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// WorldSBK points table — official FIM scale. Race 1 + Race 2 award full
// championship points 25-1 down to 15th. Superpole Race awards half-ish
// points 12-1 down to 9th. The API does NOT echo points in the per-result
// row (it carries laps/time/status only), so we derive them locally.
// This keeps the loader self-contained and stable against future API drift.
const FULL_RACE_POINTS = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const SUPERPOLE_POINTS = [12, 9, 7, 6, 5, 4, 3, 2, 1];

function pointsForPosition(
  position: number,
  sessionKind: WsbkSessionDef['shortName'],
  status: string | undefined,
): number {
  if (status && /^(?:dns|dnq|exc|dsq)/i.test(status)) return 0;
  if (!Number.isFinite(position) || position < 1) return 0;
  const table = sessionKind === 'SPRC' ? SUPERPOLE_POINTS : FULL_RACE_POINTS;
  return table[position - 1] ?? 0;
}

interface ParsedSessionResults {
  results: RaceResultEntry[];
  sessionShortName: WsbkSessionDef['shortName'];
}

function parseSessionResults(
  env: JsonApiEnvelope,
  sessionKind: WsbkSessionDef['shortName'],
): ParsedSessionResults | null {
  const rows = env?.data;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  // Per-session included uses SINGULAR keys (`rider`, `team`, `session`),
  // unlike the standings endpoint which uses PLURAL (`riders`, `teams`).
  // The two-shape design appears intentional in the Pulselive backend; we
  // accept both for forward-compatibility.
  const included = buildIncludedMap(env.included);
  const riders = { ...(included['rider'] || {}), ...(included['riders'] || {}) };
  const teams = { ...(included['team'] || {}), ...(included['teams'] || {}) };

  const entries: RaceResultEntry[] = [];
  const timesByPosition = new Map<number, number | null>();
  for (const row of rows) {
    if (!row || row.type !== 'results') continue;
    const position = asNumber(row.attributes?.position);
    const status = asString(row.attributes?.status) ?? 'Unknown';
    const timeMs = asNumber(row.attributes?.time);

    if (position == null) continue;

    const riderRef = row.relationships?.rider?.data;
    const teamRef = row.relationships?.team?.data;
    if (!riderRef?.id || !teamRef?.id) continue;

    const rider = riders[riderRef.id];
    const team = teams[teamRef.id];
    const givenName = asString(rider?.attributes?.name);
    const familyName = asString(rider?.attributes?.surname);
    const teamName = asString(team?.attributes?.name);
    if (!givenName || !familyName || !teamName) continue;

    entries.push({
      position,
      driverName: `${givenName} ${familyName}`.trim(),
      team: teamName,
      status,
      // Filled in below once the winner's time is known.
      time: undefined,
      points: pointsForPosition(position, sessionKind, status),
    });
    timesByPosition.set(position, typeof timeMs === 'number' && timeMs > 0 ? timeMs : null);
  }

  // Floor counts total ROWS (including DNFs/retired). Anything under 8 means
  // the feed is broken, not that the race was short.
  if (entries.length < MIN_FINISHERS) return null;

  entries.sort((a, b) => a.position - b.position);

  // `time` is the CUMULATIVE race time in ms for EVERY rider — not a gap.
  // (Validation 2026-06-11: rendering it as "+gap" showed P2 as "+54:07.653"
  // at every round.) Winner shows the total; everyone else shows the derived
  // difference to the winner. Negative/zero deltas (data noise) render blank.
  const winnerMs = timesByPosition.get(1) ?? null;
  for (const entry of entries) {
    const ms = timesByPosition.get(entry.position) ?? null;
    if (ms == null) continue;
    if (entry.position === 1) {
      entry.time = formatRaceTime(ms);
    } else if (winnerMs != null && ms > winnerMs) {
      entry.time = `+${formatGap(ms - winnerMs)}`;
    }
  }

  return {
    results: entries,
    sessionShortName: sessionKind,
  };
}

function formatRaceTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds - hours * 3600 - minutes * 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`;
  }
  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
}

function formatGap(ms: number): string {
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(3)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = (ms % 60_000) / 1000;
  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
}

interface RoundDescriptor {
  sourceId: string; // e.g. "POR"
  briefDescription: string; // e.g. "Portimao"
  description: string; // e.g. "Portuguese Round"
  startDate: Date;
  status: string; // "FINISHED" | "NOT-STARTED" | ...
  sequenceOrder: number; // championship round number
  circuit?: string;
}

function parseRounds(env: JsonApiEnvelope): RoundDescriptor[] {
  const rows = env?.data;
  if (!Array.isArray(rows)) return [];

  const included = buildIncludedMap(env.included);
  const circuits = included['circuits'] || {};

  const out: RoundDescriptor[] = [];
  for (const row of rows) {
    if (row?.type !== 'rounds') continue;
    const sourceId = asString(row.attributes?.source_id);
    const description = asString(row.attributes?.description) ?? '';
    const brief = asString(row.attributes?.brief_description) ?? '';
    const startStr = asString(row.attributes?.start_date);
    const status = asString(row.attributes?.status) ?? 'UNKNOWN';
    const seq = asNumber(row.attributes?.sequence_order);
    if (!sourceId || !startStr || seq == null) continue;
    const startDate = new Date(startStr);
    if (Number.isNaN(startDate.getTime())) continue;
    const circuitRef = row.relationships?.circuit?.data;
    const circuitName =
      asString(circuits[circuitRef?.id ?? '']?.attributes?.name) ?? undefined;
    out.push({
      sourceId,
      briefDescription: brief,
      description,
      startDate,
      status,
      sequenceOrder: seq,
      circuit: circuitName,
    });
  }
  return out.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
}

/**
 * Fetch all finished WorldSBK rounds in the given season and expand each
 * one to three RaceResult entries (Race 1 → Superpole Race → Race 2) when
 * those sessions have results. Empty array on outright failure or
 * empty season.
 *
 * Each RaceResult.round is the canonical championship round number;
 * multiple RaceResults can share the same round (three sessions per
 * weekend). The `raceName` carries the session label so the
 * SeasonResultsPanel renders three distinct cards per round.
 */
export async function fetchWsbkSeasonResults(
  season: number,
): Promise<RaceResult[]> {
  const cacheKey = seasonCacheKey('wsbk', season);
  const cached = await readResultsCache<RaceResult[]>(cacheKey);
  if (cached) return cached;

  const roundsEnv = await fetchJson<JsonApiEnvelope>(
    `${API_BASE}/wsbk-events/v1/seasons/${season}/rounds`,
  );
  if (!roundsEnv) return [];

  const rounds = parseRounds(roundsEnv);
  const finished = rounds.filter(r => r.status === 'FINISHED');
  if (finished.length === 0) return [];

  const out: RaceResult[] = [];

  // Fetch sessions per round in parallel; for each finished round we issue
  // 3 result fetches in parallel (R1/SP/R2). Rate-of-load is modest — 12
  // rounds × 3 = 36 calls across a full season.
  await Promise.all(
    finished.map(async round => {
      const sessionResults = await Promise.all(
        RACE_SESSIONS.map(async sess => {
          const url = `${API_BASE}/wsbk-results/v1/seasons/${season}/categories/SBK/rounds/${round.sourceId}/sessions/${sess.sourceId}/results`;
          const env = await fetchJson<JsonApiEnvelope>(url);
          if (!env) return null;
          const parsed = parseSessionResults(env, sess.shortName);
          if (!parsed) return null;
          return { def: sess, parsed };
        }),
      );

      for (const item of sessionResults) {
        if (!item) continue;
        out.push({
          round: round.sequenceOrder,
          raceName: `${round.description || round.briefDescription} — ${item.def.label}`,
          date: round.startDate,
          circuit: round.circuit ?? round.briefDescription,
          results: item.parsed.results,
        });
      }
    }),
  );

  // Stable order: most recent round first, then R1 → SP → R2 within a round.
  const races = out.sort((a, b) => {
    if (a.round !== b.round) return b.round - a.round;
    return orderOf(a.raceName) - orderOf(b.raceName);
  });
  if (races.length > 0) await writeResultsCache(cacheKey, races);
  return races;
}

function orderOf(raceName: string): number {
  if (/Superpole Race/i.test(raceName)) return 2;
  if (/Race 2/i.test(raceName)) return 3;
  return 1; // Race 1 default
}

// --- Per-session classifications (practice / Superpole) ---------------------
// The three races ship as RaceResults above; these are the non-race weekend
// sessions for the session pages. The session list lives on the events API
// (source_ids like L1A/Q1A, not the short names), so we resolve short_name →
// source_id there, then pull that session's classification. `time` is the best
// LAP in ms (not cumulative), so these render as timed sessions (best/gap), no points.

// Paddock session slug → WorldSBK short_name (race + superpole-race go through
// the season-results path like every race).
const SESSION_SHORT_BY_SLUG: Record<string, string> = {
  fp1: 'FP1',
  fp2: 'FP2',
  fp3: 'FP3',
  superpole: 'SP',
  'warm-up': 'WUP',
};

export function parseSessionClassification(env: JsonApiEnvelope): SessionClassification | null {
  const rows = env?.data;
  if (!Array.isArray(rows)) return null;
  const included = buildIncludedMap(env.included);
  const riders = { ...(included['rider'] || {}), ...(included['riders'] || {}) };
  const teams = { ...(included['team'] || {}), ...(included['teams'] || {}) };

  const parsed: { position: number; name: string; code?: string; team: string; ms: number | null; status?: string }[] = [];
  for (const row of rows) {
    if (!row || row.type !== 'results') continue;
    const position = asNumber(row.attributes?.position);
    if (position == null) continue;
    const rider = riders[row.relationships?.rider?.data?.id ?? ''];
    const team = teams[row.relationships?.team?.data?.id ?? ''];
    const name = asString(rider?.attributes?.name);
    const surname = asString(rider?.attributes?.surname);
    const teamName = asString(team?.attributes?.name);
    if (!name || !surname || !teamName) continue;
    const num = asNumber(rider?.attributes?.number);
    const ms = asNumber(row.attributes?.time);
    parsed.push({
      position,
      name: `${name} ${surname}`.trim(),
      code: num != null ? `#${num}` : undefined,
      team: teamName,
      ms: typeof ms === 'number' && ms > 0 ? ms : null,
      status: asString(row.attributes?.status),
    });
  }
  if (parsed.length < MIN_FINISHERS) return null;
  parsed.sort((a, b) => a.position - b.position);

  // `time` is each rider's best LAP in ms. Topper shows the lap; the rest show
  // the gap to it. (Unlike the race feed, this is not cumulative race time.)
  const topMs = parsed.find(p => p.position === 1)?.ms ?? null;
  const entries: SessionClassificationEntry[] = parsed.map(p => {
    let time: string | undefined;
    let gap: string | undefined;
    if (p.ms != null) {
      if (p.position === 1 || topMs == null || p.ms <= topMs) time = formatRaceTime(p.ms);
      else gap = `+${formatGap(p.ms - topMs)}`;
    }
    const status: SessionClassificationEntry['status'] =
      !p.status || /classified|finished/i.test(p.status)
        ? undefined
        : /^dns/i.test(p.status)
          ? 'DNS'
          : /excl|dsq|dnq/i.test(p.status)
            ? 'DSQ'
            : 'DNF';
    return { position: p.position, driverName: p.name, driverCode: p.code, team: p.team, time, gap, status };
  });
  return { isQualifying: false, isRace: false, entries };
}

// One weekend session's classification (practice / Superpole), on demand:
// rounds → the round's source_id → its session list → the matching session's
// source_id → that session's results. Round numbering = sequence_order.
export async function fetchWsbkSessionClassification(
  season: number,
  round: number,
  sessionSlug: string,
): Promise<SessionClassification | null> {
  const short = SESSION_SHORT_BY_SLUG[sessionSlug];
  if (!short) return null;

  const roundsEnv = await fetchJson<JsonApiEnvelope>(
    `${API_BASE}/wsbk-events/v1/seasons/${season}/rounds`,
  );
  if (!roundsEnv) return null;
  const rd = parseRounds(roundsEnv).find(r => r.sequenceOrder === round);
  if (!rd) return null;

  const sessionsEnv = await fetchJson<JsonApiEnvelope>(
    `${API_BASE}/wsbk-events/v1/seasons/${season}/rounds/${rd.sourceId}/sessions`,
  );
  // The list carries both SBK and Supersport sessions; the SBK ones have
  // "-SBK-" in their resource id. Match by short_name within that category.
  const session = (sessionsEnv?.data ?? []).find(
    s => s?.id?.includes('-SBK-') && asString(s.attributes?.short_name) === short,
  );
  const sourceId = asString(session?.attributes?.source_id);
  if (!sourceId) return null;

  const env = await fetchJson<JsonApiEnvelope>(
    `${API_BASE}/wsbk-results/v1/seasons/${season}/categories/SBK/rounds/${rd.sourceId}/sessions/${sourceId}/results`,
  );
  if (!env) return null;
  return parseSessionClassification(env);
}

/**
 * Fetch only the most-recently-finished round's Race 2. Convenience wrapper
 * for the weekend / "last race" views. Returns null if no round has
 * finished yet.
 */
export async function fetchWsbkLastRace(season: number): Promise<RaceResult | null> {
  const all = await fetchWsbkSeasonResults(season);
  if (all.length === 0) return null;
  // fetchWsbkSeasonResults sorts by round desc then session order; the top
  // round's Race 2 is the canonical "last race".
  const topRound = all[0].round;
  const sameRound = all.filter(r => r.round === topRound);
  const race2 = sameRound.find(r => /Race 2/i.test(r.raceName));
  return race2 ?? sameRound[sameRound.length - 1] ?? null;
}
