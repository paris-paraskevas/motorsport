import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildHealthReport,
  readHealthReport,
  writeHealthReport,
  HEALTH_REPORT_KEY,
  type HealthReport,
} from './health-store';
import type { HealthResult, HealthSummary } from '@/lib/health-core';
import type { SessionHealthResult, SessionHealthSummary } from '@/lib/sessions-health';

// In-memory KV mock, same shape as lib/results-cache.test.ts: the real lib/kv is
// replaced wholesale so get/set become hash lookups. `failing` flips the store
// into throwing so the fail-soft paths are exercised for real rather than
// assumed — a KV outage must degrade the console, never 500 it.
const store = new Map<string, unknown>();
const setSpy = vi.fn();
let failing = false;

vi.mock('./kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => {
      if (failing) throw new Error('kv down');
      const raw = store.get(key);
      if (raw === undefined) return null;
      // KV round-trips through JSON — mirror that so the test can't pass on
      // object identity that production would never have.
      return JSON.parse(JSON.stringify(raw));
    }),
    set: vi.fn(async (key: string, value: unknown, opts?: { ex?: number }) => {
      if (failing) throw new Error('kv down');
      setSpy(key, value, opts);
      store.set(key, value);
      return 'OK';
    }),
  },
}));

function check(slug: string, over: Partial<HealthResult> = {}): HealthResult {
  return { slug, label: slug.toUpperCase(), source: 'https://example.invalid', status: 'OK', rows: 20, min: 10, ms: 120, ...over };
}

function sessionCheck(slug: string, over: Partial<SessionHealthResult> = {}): SessionHealthResult {
  return { slug, label: slug.toUpperCase(), status: 'OK', completedRounds: 12, median: 5, floor: 3, thin: [], ms: 90, ...over };
}

function summary(over: Partial<HealthSummary> = {}): HealthSummary {
  return { total: 2, healthy: 2, low: 0, down: 0, downSlugs: [], lowSlugs: [], ...over };
}

function sessionSummary(over: Partial<SessionHealthSummary> = {}): SessionHealthSummary {
  return { total: 2, healthy: 2, flagged: 0, flaggedSlugs: [], ...over };
}

const AT = new Date('2026-08-27T14:06:00.000Z');

function green(): HealthReport {
  return buildHealthReport(
    { summary: summary(), checks: [check('f1'), check('motogp')] },
    { summary: summary(), checks: [check('f1'), check('f2')] },
    { summary: sessionSummary(), checks: [sessionCheck('f1'), sessionCheck('wec')] },
    AT,
  );
}

describe('buildHealthReport', () => {
  it('is ok with an explicit timestamp when nothing is down', () => {
    const r = green();
    expect(r.ok).toBe(true);
    expect(r.down).toBe(0);
    expect(r.checkedAt).toBe('2026-08-27T14:06:00.000Z');
  });

  it('counts a thin session schedule toward `down` alongside the row-count failures', () => {
    // The whole point of the sessions monitor: a weekend with the right rows but
    // a broken timetable must still make the report red.
    const r = buildHealthReport(
      { summary: summary({ down: 1, downSlugs: ['dtm'] }), checks: [check('dtm', { status: 'ERROR', rows: 0 })] },
      { summary: summary({ down: 2, downSlugs: ['wec', 'imsa'] }), checks: [check('wec', { status: 'EMPTY', rows: 0 })] },
      { summary: sessionSummary({ flagged: 3, flaggedSlugs: ['wrc', 'nls', 'gt-world'] }), checks: [sessionCheck('wrc', { status: 'LOW' })] },
      AT,
    );
    expect(r.down).toBe(6);
    expect(r.ok).toBe(false);
  });

  it('omits `error` when a check passed and carries it when it failed', () => {
    const r = buildHealthReport(
      { summary: summary(), checks: [check('f1'), check('dtm', { status: 'ERROR', rows: 0, error: 'timeout after 30s' })] },
      { summary: summary(), checks: [] },
      { summary: sessionSummary(), checks: [] },
      AT,
    );
    expect('error' in r.standings.checks[0]).toBe(false);
    expect(r.standings.checks[1].error).toBe('timeout after 30s');
  });

  it('keeps the summary fields alongside the checks', () => {
    const r = green();
    expect(r.standings.total).toBe(2);
    expect(r.standings.healthy).toBe(2);
    expect(r.standings.checks).toHaveLength(2);
    expect(r.sessions.flaggedSlugs).toEqual([]);
  });

  it('carries thin rounds through so a consumer can name them', () => {
    const thin = [{ round: 4, name: 'Misano', sessions: 1 }];
    const r = buildHealthReport(
      { summary: summary(), checks: [] },
      { summary: summary(), checks: [] },
      { summary: sessionSummary({ flagged: 1, flaggedSlugs: ['gt-world'] }), checks: [sessionCheck('gt-world', { status: 'LOW', thin })] },
      AT,
    );
    expect(r.sessions.checks[0].thin).toEqual(thin);
  });
});

describe('health report store', () => {
  beforeEach(() => {
    store.clear();
    setSpy.mockClear();
    failing = false;
    process.env.KV_REST_API_URL = 'https://kv.test.invalid';
    process.env.KV_REST_API_TOKEN = 'test-token';
  });
  afterEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('returns null when nothing has ever been written', async () => {
    expect(await readHealthReport()).toBeNull();
  });

  it('round-trips a report under the single shared key', async () => {
    const r = green();
    await writeHealthReport(r);
    expect(setSpy).toHaveBeenCalledWith(HEALTH_REPORT_KEY, r, { ex: 30 * 24 * 60 * 60 });
    expect(await readHealthReport()).toEqual(r);
  });

  it('writes a 30-day TTL, not the cron interval', async () => {
    // A TTL at the 6-hour cadence would empty the key after one failed run, and
    // a stale report with an honest age beats an empty screen.
    await writeHealthReport(green());
    const [, , opts] = setSpy.mock.calls[0];
    expect(opts.ex).toBeGreaterThan(6 * 60 * 60);
  });

  it('does nothing when KV is unconfigured, rather than throwing', async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    await expect(writeHealthReport(green())).resolves.toBeUndefined();
    expect(setSpy).not.toHaveBeenCalled();
    expect(await readHealthReport()).toBeNull();
  });

  it('degrades to null on a KV read failure instead of throwing', async () => {
    failing = true;
    expect(await readHealthReport()).toBeNull();
  });

  it('swallows a KV write failure so the cron response stays green', async () => {
    failing = true;
    await expect(writeHealthReport(green())).resolves.toBeUndefined();
  });
});
