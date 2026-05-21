import type { RaceResult, RaceResultEntry } from '@/lib/types';
import {
  MOTOGP_API_BASE,
  MOTOGP_CATEGORY_UUID_EXPORT,
  resolveMotoGPSeasonUuid,
} from '@/lib/standings/motogp';

export type { RaceResult, RaceResultEntry };

// MotoGP per-event results via the Pulselive endpoint chain:
//   1. /results/events?seasonUuid=<X>&isFinished=true → array of events
//   2. /results/sessions?eventUuid=<E>&categoryUuid=<MOTOGP> → array of
//      sessions with `type` field (FP / PR / Q / SPR / WUP / RAC)
//   3. /results/session/<sessionId>/classification?test=false → per-row
//      classification with rider / team / position / points / status
//
// Per event we emit up to TWO RaceResult entries: the Grand Prix (RAC
// session) and the Sprint (SPR session), mirroring the WSBK precedent
// (`lib/results/wsbk.ts`) where each session-type ships as its own
// RaceResult. The Sprint scores half-points (12-9-7-6-5-4-3-2-1 to top 9)
// and is named explicitly so SeasonResultsPanel renders both cards per
// round.
//
// Verified live 2026-05-21: 13 finished events; first round (Thailand,
// `f3fd8ba7-...`) returns 8 sessions including RAC + SPR, each with a
// 26-lap classification of 22 riders.

const MIN_FINISHERS = 10;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

interface PulseliveCountry { iso?: string; name?: string; }
interface PulseliveCircuit { name?: string; place?: string; nation?: string; }
interface PulseliveRider { full_name?: string; number?: number; }
interface PulseliveTeam { name?: string; }
interface PulseliveConstructor { name?: string; }
interface PulseliveGap { first?: string; lap?: string; }

interface PulseliveEvent {
  id?: string;
  name?: string;
  sponsored_name?: string;
  short_name?: string;
  date_start?: string;
  date_end?: string;
  country?: PulseliveCountry;
  circuit?: PulseliveCircuit;
  test?: boolean;
  status?: string;
}

interface PulseliveSession {
  id?: string;
  type?: string;
  date?: string;
  status?: string;
}

interface PulseliveClassificationRow {
  position?: number;
  rider?: PulseliveRider;
  team?: PulseliveTeam;
  constructor?: PulseliveConstructor;
  gap?: PulseliveGap;
  time?: string;
  total_laps?: number;
  points?: number;
  status?: string;
}

interface PulseliveClassificationResponse {
  classification?: PulseliveClassificationRow[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function parseEventDate(event: PulseliveEvent): Date | null {
  const raw = event.date_end ?? event.date_start;
  if (!raw) return null;
  const parsed = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function eventDisplayName(event: PulseliveEvent): string {
  // Pulselive's `name` is uppercase ("GRAND PRIX OF THAILAND"). Title-case
  // for display so it sits alongside other series' RaceResult.raceName
  // without screaming. `sponsored_name` is sometimes longer (e.g. "PT Grand
  // Prix of Thailand") and inconsistent across rounds; prefer `name`.
  const raw = event.name || event.sponsored_name || event.short_name || 'MotoGP Round';
  return raw.replace(/\w[\w']*/g, t => t[0] + t.slice(1).toLowerCase());
}

function circuitDisplayName(event: PulseliveEvent): string {
  const c = event.circuit;
  if (!c?.name) return eventDisplayName(event);
  return c.place ? `${c.name}, ${c.place}` : c.name;
}

// Translate a Pulselive classification row into a typed entry. Non-finishers
// (status !== 'INSTND') get the literal status code; the table uses 'OUTSTND'
// for "did not classify" (DNF / mechanical / accident). Position is null on
// those rows; we synthesise a sort-key so the table places them at the bottom
// in source order.
function buildResultEntries(rows: PulseliveClassificationRow[]): RaceResultEntry[] {
  const entries: RaceResultEntry[] = [];
  let fallback = 100;
  for (const row of rows) {
    const driverName = row.rider?.full_name;
    const team = row.team?.name;
    if (!driverName || !team) continue;

    const numericPos =
      typeof row.position === 'number' && Number.isFinite(row.position)
        ? row.position
        : null;
    const position = numericPos ?? fallback++;
    const status = row.status === 'INSTND' ? 'Finished' : row.status || 'DNF';
    const time =
      numericPos === 1
        ? row.time
        : row.gap?.first
          ? `+${row.gap.first}`
          : row.time;
    const points =
      typeof row.points === 'number' && Number.isFinite(row.points) ? row.points : 0;

    entries.push({
      position,
      driverName,
      team,
      status,
      time: time ?? undefined,
      points,
    });
  }
  return entries.sort((a, b) => a.position - b.position);
}

async function buildRaceResult(
  event: PulseliveEvent,
  session: PulseliveSession,
  round: number,
  labelSuffix: string,
): Promise<RaceResult | null> {
  if (!session.id) return null;
  const resp = await fetchJson<PulseliveClassificationResponse>(
    `${MOTOGP_API_BASE}/motogp/v1/results/session/${session.id}/classification?test=false`,
  );
  if (!resp?.classification) return null;
  if (resp.classification.length < MIN_FINISHERS) return null;

  const date = parseEventDate(event);
  if (!date) return null;

  const entries = buildResultEntries(resp.classification);
  if (entries.length === 0) return null;

  return {
    round,
    raceName: `${eventDisplayName(event)} — ${labelSuffix}`,
    date,
    circuit: circuitDisplayName(event),
    results: entries,
  };
}

export async function fetchMotoGPSeasonResults(year: number): Promise<RaceResult[]> {
  const seasonUuid = await resolveMotoGPSeasonUuid(year);
  if (!seasonUuid) return [];

  const events = await fetchJson<PulseliveEvent[]>(
    `${MOTOGP_API_BASE}/motogp/v1/results/events?seasonUuid=${seasonUuid}&isFinished=true`,
  );
  if (!Array.isArray(events) || events.length === 0) return [];

  // Defensive filter: drop test events even with isFinished=true (pre-season
  // Sepang / Portimão tests can appear depending on Pulselive backfill).
  // Order by date_start ascending so round numbers track championship order.
  const ordered = events
    .filter(e => e?.test !== true && e?.id && (e.date_start || e.date_end))
    .sort((a, b) => (a.date_start ?? '').localeCompare(b.date_start ?? ''));

  const races: RaceResult[] = [];

  // Process rounds in parallel for the sessions list, then sequentially per
  // round for the classification fetches. The classification fetches go
  // through the same Pulselive CloudFront layer as standings; sequential
  // per-round keeps the burst polite while still parallelising the cross-
  // round fan-out via Promise.all.
  await Promise.all(
    ordered.map(async (event, idx) => {
      const round = idx + 1;
      const sessions = await fetchJson<PulseliveSession[]>(
        `${MOTOGP_API_BASE}/motogp/v1/results/sessions?eventUuid=${event.id}` +
          `&categoryUuid=${MOTOGP_CATEGORY_UUID_EXPORT}`,
      );
      if (!Array.isArray(sessions)) return;

      const racSession = sessions.find(s => s?.type === 'RAC');
      const sprSession = sessions.find(s => s?.type === 'SPR');

      const [racResult, sprResult] = await Promise.all([
        racSession ? buildRaceResult(event, racSession, round, 'Grand Prix') : null,
        sprSession ? buildRaceResult(event, sprSession, round, 'Sprint') : null,
      ]);

      // Order: Grand Prix card before Sprint card within the same round
      // (matches WSBK precedent: marquee race appears first).
      if (racResult) races.push(racResult);
      if (sprResult) races.push(sprResult);
    }),
  );

  // Sort by round ascending, then by Grand Prix before Sprint within a round.
  // The Promise.all above resolves in unspecified order; this final pass is
  // what guarantees stable rendering.
  races.sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    const aSprint = /Sprint/i.test(a.raceName) ? 1 : 0;
    const bSprint = /Sprint/i.test(b.raceName) ? 1 : 0;
    return aSprint - bSprint;
  });

  return races;
}
