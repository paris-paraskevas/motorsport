// Server-only OpenF1 client (api.openf1.org) — community F1 API, no auth.
// Coverage probed live 2026-06-11 (docs/redesign-2026-06.md session-5 log):
// full 2026 per-session classifications including practices; qualifying
// `duration` / `gap_to_leader` come as [Q1, Q2, Q3] arrays; race rows carry
// `points`. Driver names/teams join via /drivers on driver_number.
//
// Ops note: community API with unspecified rate limits — every call caches
// via the data cache (revalidate below). Datacenter-IP behavior on Vercel
// was unverified at first ship; per CLAUDE.md, verify on preview/prod before
// trusting it (Jolpica precedent suggests fine).

import { fetchOpenF1 } from '@/lib/openf1/client';
import { loadCuratedDrivers } from '@/lib/series-content';

const REVALIDATE_SECONDS = 300;

export interface OpenF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  location: string;
  circuit_short_name: string;
  meeting_key: number;
  year: number;
}

interface OpenF1Result {
  position: number | null;
  driver_number: number;
  number_of_laps: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  duration: number | Array<number | null> | null;
  gap_to_leader: number | string | Array<number | null> | null;
  points?: number;
}

interface OpenF1Driver {
  driver_number: number;
  full_name: string;
  name_acronym?: string;
  team_name?: string;
}

export interface SessionClassificationEntry {
  position: number | null;
  driverName: string;
  driverCode?: string;
  /** Race number as displayed on the car ("1", "44"). F1 sets it from
   *  OpenF1's driver_number; the class-based series pack theirs into
   *  driverCode as "#50" instead (see fetchClassClassifications). */
  carNumber?: string;
  // Rally crews: the co-driver alongside `driverName`, and the car model
  // (e.g. "Toyota GR Yaris Rally1"). Only WRC sets these; every other series
  // leaves them undefined, so ClassificationTable renders exactly as before.
  coDriverName?: string;
  car?: string;
  team: string;
  laps?: number;
  // Display-ready values; which ones are present depends on session type.
  time?: string; // race: winner's total; practice: best lap
  gap?: string;
  /** Gap to the car ahead ("+1.234"), derived from consecutive rows' leader
   *  gaps via deriveIntervals. Absent where it can't be honestly derived
   *  (leader, lapped/DNF rows and their followers, qualifying). */
  interval?: string;
  q1?: string;
  q2?: string;
  q3?: string;
  points?: number;
  status?: 'DNF' | 'DNS' | 'DSQ';
}

export interface SessionClassification {
  isQualifying: boolean;
  isRace: boolean;
  entries: SessionClassificationEntry[];
}

/**
 * Every OpenF1 read in this module goes through the shared paced client
 * (`lib/openf1/client.ts`), which enforces BOTH documented free-tier limits
 * (3 req/s and 30 req/min) and routes through `fetchUpstream` for the timeout +
 * failure logging.
 *
 * It used to call `fetch` directly: unpaced, untimed, and silent — a 429 became
 * `null` with nothing in the logs. On a weekend session page, which fans out to
 * several OpenF1 endpoints at once, that reliably throttled one call while its
 * sibling succeeded. The visible symptom was the Hungary classification
 * rendering `#1`, `#3` instead of driver names: `/session_result` returned, its
 * parallel `/drivers` was throttled to `[]`, and the half-resolved result was
 * then cached.
 *
 * `fetchOpenF1` always resolves to an array (`[]` on any failure), so this
 * keeps the module's `T[] | null` contract by mapping empty → null; callers
 * already branch on null.
 */
async function fetchJson<T>(path: string): Promise<T[] | null> {
  const [endpoint, qs = ''] = path.replace(/^\//, '').split('?');
  const filters = qs ? qs.split('&').filter(Boolean) : [];
  const rows = await fetchOpenF1<T>(endpoint, {}, { filters, revalidate: REVALIDATE_SECONDS });
  return rows.length > 0 ? rows : null;
}

/**
 * The OpenF1 sessions that belong to a Paddock weekend, by date overlap —
 * OpenF1 has no round numbers, so the weekend's start/end (±36h slack for
 * timezone and Thursday-running sessions) is the join key.
 */
export async function fetchOpenF1WeekendSessions(
  start: Date,
  end: Date,
): Promise<OpenF1Session[]> {
  const all = await fetchJson<OpenF1Session>(
    `/sessions?year=${start.getUTCFullYear()}`,
  );
  if (!all) return [];
  const from = start.getTime() - 36 * 3600 * 1000;
  const to = end.getTime() + 36 * 3600 * 1000;
  return all
    .filter(s => {
      const t = new Date(s.date_start).getTime();
      return Number.isFinite(t) && t >= from && t <= to;
    })
    .sort(
      (a, b) =>
        new Date(a.date_start).getTime() - new Date(b.date_start).getTime(),
    );
}

/** "1:13.978" under an hour, "2:23:31.243" above. */
export function formatSeconds(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return '';
  const ms = Math.round(total * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const frac = String(ms % 1000).padStart(3, '0');
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${frac}`
    : `${m}:${String(s).padStart(2, '0')}.${frac}`;
}

/** Gaps arrive as seconds or pre-formatted strings ("+1 LAP"). */
export function formatGap(gap: number | string | null | undefined): string {
  if (gap == null) return '';
  if (typeof gap === 'string') return gap.startsWith('+') ? gap : `+${gap}`;
  if (!Number.isFinite(gap) || gap === 0) return '';
  return `+${gap.toFixed(3)}`;
}

/**
 * Interval (gap to the car ahead) per classified row, derived from the rows'
 * gap-to-leader values in finishing order. Returns display-ready "+D.DDD"
 * strings aligned with the input; `null` where the delta can't be honestly
 * derived: the leader (no car ahead), lapped cars (OpenF1 sends "+N LAP"
 * strings), DNF/DNS rows (null gaps), any row directly behind one of those,
 * qualifying's per-segment arrays, and out-of-order data that would produce
 * a negative interval. Only the front row may treat a null/0 gap as zero —
 * a null further down means "no timing", not "0s behind the leader".
 */
export function deriveIntervals(
  gaps: Array<number | string | Array<number | null> | null | undefined>,
): Array<string | null> {
  const numeric = gaps.map((g, i) => {
    if (typeof g === 'number' && Number.isFinite(g)) return g;
    if (i === 0 && g == null) return 0;
    return null;
  });
  return numeric.map((cur, i) => {
    if (i === 0) return null; // leader: no car ahead
    const prev = numeric[i - 1];
    if (cur == null || prev == null) return null;
    const delta = cur - prev;
    if (delta < 0) return null;
    return `+${delta.toFixed(3)}`;
  });
}

function lastFiniteIndex(arr: Array<number | null>): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return i;
  }
  return -1;
}

/**
 * True when a classification carries real driver identities rather than the
 * `#<car number>` placeholder used when the `/drivers` join comes back empty.
 *
 * Callers persist classifications to KV for 7 days, so a nameless one must never
 * be written — that is exactly how the Hungary race sat cached as `#1 / #3 /
 * #12` with blank teams while its timing data was perfectly correct. The visitor
 * on the render that produced it still sees the timing; it just doesn't get
 * frozen in for a week.
 */
export function hasResolvedDrivers(c: SessionClassification | null): boolean {
  if (!c || c.entries.length === 0) return false;
  return c.entries.some(e => e.driverName && !/^#\d+$/.test(e.driverName));
}

export async function fetchSessionClassification(
  session: OpenF1Session,
): Promise<SessionClassification | null> {
  const [results, drivers] = await Promise.all([
    fetchJson<OpenF1Result>(`/session_result?session_key=${session.session_key}`),
    fetchJson<OpenF1Driver>(`/drivers?session_key=${session.session_key}`),
  ]);
  if (!results || results.length === 0) return null;

  const byNumber = new Map((drivers ?? []).map(d => [d.driver_number, d]));
  // Belt-and-braces: if `/drivers` came back empty (throttled, or the session is
  // inside OpenF1's paid live window), fall back to the curated F1 grid, which
  // carries each driver's car number. Timing data is useless without identities,
  // and this file is F1-only (OpenF1 covers no other series).
  if (byNumber.size === 0) {
    const curated = await loadCuratedDrivers('f1');
    for (const team of curated?.teams ?? []) {
      for (const d of team.drivers) {
        if (d.number == null) continue;
        byNumber.set(d.number, {
          driver_number: d.number,
          full_name: d.name,
          name_acronym: d.code,
          team_name: team.name,
        });
      }
    }
  }
  const isQualifying = /qualifying/i.test(session.session_name);
  const isRace = /^(sprint|race)$/i.test(session.session_name);

  const sorted = [...results].sort(
    (a, b) => (a.position ?? 99) - (b.position ?? 99),
  );
  // Self-gating: qualifying's per-segment gap arrays and DNF/lapped rows all
  // derive to null, so only rows with real consecutive timing get an interval.
  const intervals = deriveIntervals(sorted.map(r => r.gap_to_leader));

  const entries: SessionClassificationEntry[] = sorted.map((r, idx) => {
    const driver = byNumber.get(r.driver_number);
    const status = r.dsq ? 'DSQ' : r.dns ? 'DNS' : r.dnf ? 'DNF' : undefined;
    const entry: SessionClassificationEntry = {
      position: r.position,
      driverName: driver?.full_name ?? `#${r.driver_number}`,
      driverCode: driver?.name_acronym,
      carNumber: String(r.driver_number),
      team: driver?.team_name ?? '',
      laps: r.number_of_laps ?? undefined,
      points: r.points,
      status,
    };

    if (isQualifying && Array.isArray(r.duration)) {
      const [q1, q2, q3] = r.duration;
      if (typeof q1 === 'number') entry.q1 = formatSeconds(q1);
      if (typeof q2 === 'number') entry.q2 = formatSeconds(q2);
      if (typeof q3 === 'number') entry.q3 = formatSeconds(q3);
      const best = lastFiniteIndex(r.duration);
      if (best >= 0) entry.time = formatSeconds(r.duration[best] as number);
    } else if (typeof r.duration === 'number') {
      entry.time = formatSeconds(r.duration);
    }

    if (!Array.isArray(r.gap_to_leader)) {
      entry.gap = formatGap(r.gap_to_leader);
    }
    const interval = intervals[idx];
    if (interval) entry.interval = interval;
    return entry;
  });

  return { isQualifying, isRace, entries };
}
