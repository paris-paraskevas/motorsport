import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/threads';
import { SOURCES, describeLoaderKey } from '@/lib/design/sources';
import { loadSourceUsage } from '@/lib/design/definitions';
import { loadRunsLog } from '@/lib/design/data';
import { getSourceHealth, readSnapshotMeta } from '@/lib/source-snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/data/sources → { sources: [{ key, usedOn, runs, snapshots }] }
//
// The catalogue's side that needs the database (P2.1): for each of the
// thirteen (lib/design/sources.ts, client-safe, so the definitions travel
// with the page), Utilization (the live pages whose newest or live revision
// picks it, with the refs) and the loader's work behind it in its two tiers,
// each key placed by describeLoaderKey: the rows tier's runs (source_run,
// standings today) and the snapshot tier's fetches (source_snapshot, with the
// F and W phases from the KV meta). A key the vocabulary lacks is left out;
// every read is fail-soft, so a missing table empties its part and nothing
// else. Admin-only (404). A static segment, so it wins over the sibling
// `[key]` route as `runs` does.
export async function GET() {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  const [usage, log, health, meta] = await Promise.all([loadSourceUsage(), loadRunsLog().catch(() => null), getSourceHealth(), readSnapshotMeta()]);
  const sources = SOURCES.map(s => ({
    key: s.key,
    usedOn: usage[s.key] ?? [],
    runs: (log?.sources ?? []).flatMap(r => {
      const d = describeLoaderKey(r.key);
      return d && d.ref.source === s.key ? [{ key: r.key, label: d.label, state: r.state, newest: r.newest }] : [];
    }),
    snapshots: health.flatMap(h => {
      const d = describeLoaderKey(h.key);
      return d && d.ref.source === s.key ? [{ key: h.key, label: d.label, fetchedAt: h.fetchedAt, ok: h.ok, stale: h.stale, meta: meta[h.key] ?? null }] : [];
    }),
  }));
  return NextResponse.json({ sources });
}
