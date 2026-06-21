// Shared core for the live source-health monitors (standings + results).
//
// Each monitor defines a registry of Checks — a series' REAL production fetcher
// plus the floor below which its output is treated as broken — and this core
// runs them with a timeout, counts the data rows in whatever shape comes back,
// and grades each OK / LOW / EMPTY / ERROR. Catches the failure the frozen test
// fixtures can't: a source site changing layout so a parser silently returns
// blank or partial data mid-season.

const TIMEOUT_MS = 30_000;

export type HealthStatus = 'OK' | 'LOW' | 'EMPTY' | 'ERROR';

export interface HealthResult {
  slug: string;
  label: string;
  source: string;
  status: HealthStatus;
  rows: number;
  min: number;
  ms: number;
  error?: string;
}

export interface Check {
  slug: string;
  label: string;
  source: string;
  run: () => Promise<unknown>;
  /** Floor below which the result is LOW (degraded). Use 1 to grade only OK/EMPTY. */
  min: number;
}

// Total data rows in a result of any shape: sum the lengths of every
// array-of-objects found, recursing through nested objects (e.g. IMSA/WEC return
// drivers/teams/manufacturers keyed by class; F2 returns {feature, sprint}).
// Arrays of primitives — string headers and the like — don't count.
export function countRows(value: unknown, depth = 0): number {
  if (!value || depth > 5) return 0;
  if (Array.isArray(value)) {
    const objs = value.filter(v => v && typeof v === 'object');
    return objs.length + objs.reduce((n: number, v) => n + countRows(v, depth + 1), 0);
  }
  if (typeof value === 'object') {
    let n = 0;
    for (const v of Object.values(value as Record<string, unknown>)) n += countRows(v, depth + 1);
    return n;
  }
  return 0;
}

async function runCheck(c: Check): Promise<HealthResult> {
  const t0 = Date.now();
  const base = { slug: c.slug, label: c.label, source: c.source, min: c.min };
  try {
    const value = await Promise.race([
      c.run(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`timeout after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS),
      ),
    ]);
    const ms = Date.now() - t0;
    const rows = countRows(value);
    if (value == null || rows === 0) return { ...base, status: 'EMPTY', rows, ms };
    if (rows < c.min) return { ...base, status: 'LOW', rows, ms };
    return { ...base, status: 'OK', rows, ms };
  } catch (e) {
    return { ...base, status: 'ERROR', rows: 0, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runChecks(checks: Check[]): Promise<HealthResult[]> {
  return Promise.all(checks.map(runCheck));
}

export interface HealthSummary {
  total: number;
  healthy: number;
  low: number;
  down: number;
  downSlugs: string[];
  lowSlugs: string[];
}

export function summarize(results: HealthResult[]): HealthSummary {
  const down = results.filter(r => r.status === 'EMPTY' || r.status === 'ERROR');
  const low = results.filter(r => r.status === 'LOW');
  return {
    total: results.length,
    healthy: results.length - down.length - low.length,
    low: low.length,
    down: down.length,
    downSlugs: down.map(r => r.slug),
    lowSlugs: low.map(r => r.slug),
  };
}
