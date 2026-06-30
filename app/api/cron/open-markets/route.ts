import { NextResponse } from 'next/server';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { isBettingConfigured } from '@/lib/betting/client';
import { openUpcomingMarkets } from '@/lib/betting/automation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Opens winner markets for upcoming races (Paddock Betting). Fail-closed cron
// auth (mirrors grant-credits); 503s cleanly when the betting DB isn't
// provisioned, so it's inert in prod until the Supabase env is set. Idempotent
// — re-running skips rounds that already have a winner market.
export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);
  if (!isBettingConfigured()) {
    return NextResponse.json({ ok: false, error: 'betting DB not configured' }, { status: 503 });
  }
  try {
    const summary = await openUpcomingMarkets();
    return NextResponse.json({ ok: true, ...summary, at: new Date().toISOString() });
  } catch (err) {
    console.error('GET /api/cron/open-markets failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
