import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { findDataService } from '@/lib/design/data-services';
import { loadDataOverview } from '@/lib/design/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/data/<key>[?fresh=1] → the service's overview: state,
// figures, series, breakdowns, health, which credentials are present (by
// name). The reader's answer is kept for a minute per process so opening the
// workspace twice does not ask Google twice; `fresh=1` is the Refresh button.
// Admin-only (404); an unknown key is 404 too. Nothing is written anywhere.
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  const { key } = await params;
  if (!findDataService(key)) return new Response('not found', { status: 404 });
  const fresh = new URL(req.url).searchParams.get('fresh') === '1';
  const overview = await loadDataOverview(key, { fresh });
  if (!overview) return new Response('not found', { status: 404 });
  return NextResponse.json(overview);
}
