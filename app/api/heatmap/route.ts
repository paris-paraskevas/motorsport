import { NextResponse } from 'next/server';
import { sanitizeEvents, recordEvents } from '@/lib/heatmap';

export const runtime = 'nodejs';

// Ingest anonymous element-relative click + impression batches for the /admin
// heatmap. Public (aggregate + consent-gated on the client) and stores NO PII —
// only a same-site path, an element id / compact selector, a coarse in-element
// ratio, breakpoint and viewport. Validation/clamping lives in lib/heatmap's
// sanitizeEvents. Always 204s so the client's sendBeacon stays fire-and-forget,
// and the whole handler is fail-soft (a bad body or a Supabase blip never errors).
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new NextResponse(null, { status: 204 });
    }
    const rows = sanitizeEvents(body);
    if (rows.length > 0) await recordEvents(rows);
  } catch {
    /* best-effort — ingest must never surface an error to the client */
  }
  return new NextResponse(null, { status: 204 });
}
