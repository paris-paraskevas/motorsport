import { NextResponse } from 'next/server';
import { recordClicks, type ClickCell } from '@/lib/heatmap';

export const runtime = 'nodejs';

// Ingest anonymous click batches for the /admin heatmap. Public (it's aggregate,
// consent-gated on the client) and stores NO PII — only a path + coarse viewport
// cells. Always 204s so the client's sendBeacon stays fire-and-forget.
export async function POST(req: Request) {
  let body: { path?: unknown; cells?: unknown };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const path = typeof body.path === 'string' ? body.path : '';
  const cells = Array.isArray(body.cells)
    ? (body.cells.filter(
        c => c && typeof (c as ClickCell).c === 'number' && typeof (c as ClickCell).n === 'number',
      ) as ClickCell[]).slice(0, 576)
    : [];
  if (path && cells.length) {
    try {
      await recordClicks(path, cells);
    } catch {
      /* best-effort */
    }
  }
  return new NextResponse(null, { status: 204 });
}
