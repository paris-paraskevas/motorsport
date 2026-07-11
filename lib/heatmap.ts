import { kv } from '@vercel/kv';

// Anonymous click-heatmap aggregation. NO PII — only a same-site page path plus a
// coarse viewport grid cell per click. Feeds the /admin behaviour panel so the
// operator can see which page regions get attention (and which are dead) for
// sponsorship placement. Every read/write is fail-soft (an unprovisioned or
// blipping KV must never break page render or the click path).

export const GRID = 24; // GRID x GRID viewport cells per page
const CELLS = GRID * GRID;
const PATHS_KEY = 'heatmap:paths'; // set of tracked paths
const MAX_PATHS = 80; // safety cap on distinct paths
const TTL = 60 * 60 * 24 * 90; // 90-day rolling window on the per-path cell hash
const cellsKey = (path: string) => `heatmap:cells:${path}`;

/** Accept only clean same-site app paths: strip query/hash, lowercase, cap length,
 *  whitelist chars. Returns null for anything else (prevents unbounded/garbage KV
 *  keys from arbitrary client input). */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let p = raw.split('?')[0].split('#')[0].trim().toLowerCase();
  if (!p.startsWith('/')) return null;
  if (p.length > 1) p = p.replace(/\/+$/, ''); // drop trailing slash (keep bare "/")
  if (p.length > 80 || !/^\/[a-z0-9/_-]*$/.test(p)) return null;
  return p || '/';
}

export interface ClickCell {
  c: number; // cell index = gy * GRID + gx (0..CELLS-1)
  n: number; // count in this batch
}

/** Aggregate a batch of clicks for one path into KV. */
export async function recordClicks(rawPath: string, cells: ClickCell[]): Promise<void> {
  const path = normalizePath(rawPath);
  if (!path || !Array.isArray(cells) || cells.length === 0) return;
  const key = cellsKey(path);
  const pipe = kv.pipeline();
  let wrote = 0;
  for (const cell of cells.slice(0, CELLS)) {
    const c = Number(cell?.c);
    if (!Number.isInteger(c) || c < 0 || c >= CELLS) continue;
    const n = Math.max(1, Math.min(50, Math.floor(Number(cell?.n)) || 1));
    pipe.hincrby(key, String(c), n);
    wrote++;
  }
  if (wrote === 0) return;
  pipe.expire(key, TTL);
  pipe.sadd(PATHS_KEY, path);
  try {
    await pipe.exec();
  } catch {
    /* KV down — clicks are best-effort */
  }
}

export interface PathHeat {
  path: string;
  total: number;
  max: number;
  cells: Record<number, number>;
}

/** Top pages by total clicks, with their per-cell counts, for the admin panel. */
export async function topHeatmaps(limit = 8): Promise<PathHeat[]> {
  try {
    const paths = (await kv.smembers(PATHS_KEY)) as string[] | null;
    if (!paths || paths.length === 0) return [];
    const heats: PathHeat[] = [];
    for (const path of paths.slice(0, MAX_PATHS)) {
      const raw = ((await kv.hgetall(cellsKey(path))) ?? {}) as Record<string, unknown>;
      const cells: Record<number, number> = {};
      let total = 0;
      let max = 0;
      for (const [k, v] of Object.entries(raw)) {
        const c = Number(k);
        const n = Number(v);
        if (!Number.isInteger(c) || !Number.isFinite(n)) continue;
        cells[c] = n;
        total += n;
        if (n > max) max = n;
      }
      if (total > 0) heats.push({ path, total, max, cells });
    }
    heats.sort((a, b) => b.total - a.total);
    return heats.slice(0, limit);
  } catch {
    return [];
  }
}
