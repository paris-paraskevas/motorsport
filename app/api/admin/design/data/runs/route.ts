import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/threads';
import { loadRunsLog } from '@/lib/design/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/data/runs[?limit=200&fresh=1] → the loader's runs page
// (Phase 4, PR 4.2): every source with its state, the newest runs, the last
// day's counts. Kept for a minute per limit; `fresh=1` is the Refresh button.
// Admin-only (404). Nothing is written anywhere. A static segment, so it wins
// over the sibling `[key]` route.
export async function GET(req: Request) {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  const params = new URL(req.url).searchParams;
  const limit = Number(params.get('limit'));
  const log = await loadRunsLog({ fresh: params.get('fresh') === '1', limit: Number.isFinite(limit) && limit > 0 ? limit : undefined });
  if (!log) return NextResponse.json({ error: 'The loader’s runs could not be read.' }, { status: 503 });
  return NextResponse.json(log);
}
