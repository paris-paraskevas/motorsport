import { NextResponse } from 'next/server';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { isBettingConfigured } from '@/lib/betting/client';
import { settleDueMarkets } from '@/lib/betting/automation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Settles markets past their lock against the official classification (Paddock
// Betting, provisional-is-final). Fail-closed cron auth; 503s cleanly when the
// betting DB isn't provisioned. Idempotent — settled markets drop out and the
// SQL refuses to re-settle, so re-running is safe.
export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);
  if (!isBettingConfigured()) {
    return NextResponse.json({ ok: false, error: 'betting DB not configured' }, { status: 503 });
  }
  try {
    const summary = await settleDueMarkets();
    return NextResponse.json({ ok: true, ...summary, at: new Date().toISOString() });
  } catch (err) {
    console.error('GET /api/cron/settle-markets failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
