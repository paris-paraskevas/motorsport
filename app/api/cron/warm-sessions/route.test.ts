import { beforeEach, describe, expect, it, vi } from 'vitest';

// P2.25: the cron's capture writes the session's rows beside its KV write, under
// the same guard: a throttled or nameless classification reaches neither, and a
// failed row write never blocks the KV write or the run's report.

const now = new Date('2026-09-25T14:00:00Z');
const ended = new Date(now.getTime() - 40 * 60_000);
const started = new Date(ended.getTime() - 60 * 60_000);

vi.mock('@/lib/cron-auth', () => ({
  authorizeCronRequest: () => 'ok',
  cronAuthFailureResponse: () => new Response('no', { status: 401 }),
}));
vi.mock('@/lib/series', () => ({
  loadSeries: async () => ({
    meta: { slug: 'f1', season: 2026 },
    sessions: [{ uid: 'q', seriesSlug: 'f1', title: 'F1 - Qualifying', start: started, end: ended, location: 'Baku' }],
    rounds: { season: 2026, rounds: [] },
  }),
}));
vi.mock('@/lib/weekend', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/weekend')>();
  return {
    ...real,
    buildRoundLookup: () => ({}),
    roundFor: () => 15,
    weekendFor: () => ({ round: 15 }),
    weekendStartEnd: () => ({ start: started, end: ended }),
  };
});
const fetchSessionClassification = vi.fn();
vi.mock('@/lib/results/openf1', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/results/openf1')>();
  return {
    ...real,
    fetchOpenF1WeekendSessions: async () => [{ session_key: 9001, session_name: 'Qualifying', session_type: 'Qualifying', date_start: started.toISOString(), date_end: ended.toISOString(), location: 'Baku', circuit_short_name: 'Baku', meeting_key: 1, year: 2026 }],
    fetchSessionClassification: (s: unknown) => fetchSessionClassification(s),
  };
});
const writeResultsCache = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
vi.mock('@/lib/results-cache', () => ({
  readResultsCache: async () => null,
  writeResultsCache: (...a: unknown[]) => writeResultsCache(...a),
  sessionClassCacheKey: (...parts: unknown[]) => parts.join(':'),
}));
const writeSessionResultRun = vi.fn();
vi.mock('@/lib/session-result-rows', () => ({
  writeSessionResultRun: (...a: unknown[]) => writeSessionResultRun(...a),
}));

import { GET } from './route';

const entries = [
  { position: 1, driverName: 'Oscar Piastri', driverCode: 'PIA', carNumber: '81', team: 'McLaren', time: '1:40.123', compound: 'Soft' },
  { position: 2, driverName: 'Lando Norris', driverCode: 'NOR', carNumber: '4', team: 'McLaren', time: '1:40.223', gap: '+0.100' },
];
const resolved = { isQualifying: true, isRace: false, entries };
const nameless = { isQualifying: true, isRace: false, entries: entries.map(e => ({ ...e, driverName: `#${e.carNumber}` })) };

async function run() {
  vi.useFakeTimers({ now });
  try {
    const res = await GET(new Request('https://paddock-tracker.com/api/cron/warm-sessions'));
    return (await res.json()) as { ok: boolean; outcomes: Record<string, unknown>[] };
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(() => {
  fetchSessionClassification.mockReset();
  writeResultsCache.mockClear();
  writeSessionResultRun.mockReset();
  writeSessionResultRun.mockResolvedValue({ ok: true, rows: 2, runId: 'run-1', note: 'ok' });
});

describe('GET /api/cron/warm-sessions (P2.25: the rows beside the KV write)', () => {
  it('writes the rows beside the KV write for a resolved classification, and reports both', async () => {
    fetchSessionClassification.mockResolvedValue(resolved);
    const body = await run();
    expect(body.ok).toBe(true);
    expect(writeResultsCache).toHaveBeenCalledTimes(1);
    expect(writeSessionResultRun).toHaveBeenCalledTimes(1);
    expect(writeSessionResultRun).toHaveBeenCalledWith({ series: 'f1', season: 2026, round: 15, session: 'qualifying', entries, runner: 'warm-sessions' });
    expect(body.outcomes).toEqual([{ session: 'qualifying', round: 15, status: 'warmed', db: 'written' }]);
  });

  it('writes neither for a nameless classification (the guard), nor for none at all', async () => {
    fetchSessionClassification.mockResolvedValue(nameless);
    expect((await run()).outcomes).toEqual([{ session: 'qualifying', round: 15, status: 'no-driver-names' }]);
    fetchSessionClassification.mockResolvedValue(null);
    expect((await run()).outcomes).toEqual([{ session: 'qualifying', round: 15, status: 'no-classification' }]);
    expect(writeResultsCache).not.toHaveBeenCalled();
    expect(writeSessionResultRun).not.toHaveBeenCalled();
  });

  it('a failed row write never blocks the KV write; the report names the failure', async () => {
    fetchSessionClassification.mockResolvedValue(resolved);
    writeSessionResultRun.mockResolvedValue({ ok: false, rows: 0, note: 'relation does not exist' });
    const body = await run();
    expect(body.ok).toBe(true);
    expect(writeResultsCache).toHaveBeenCalledTimes(1);
    expect(body.outcomes).toEqual([{ session: 'qualifying', round: 15, status: 'warmed', db: 'failed: relation does not exist' }]);
  });
});
