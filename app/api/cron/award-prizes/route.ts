import { NextResponse } from 'next/server';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { isBettingConfigured } from '@/lib/betting/client';
import { awardDuePrizes } from '@/lib/betting/leagues';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Awards league prizes (titles/badges for the top 3 by win-rate) for the most
// recently completed calendar month + season, once each is past its grace
// window. NO credits. Fail-closed cron auth; 503s cleanly when the betting DB
// isn't provisioned. Idempotent — a league already awarded for a period is
// skipped in SQL, so the daily run is a no-op between period boundaries.
export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);
  if (!isBettingConfigured()) {
    return NextResponse.json({ ok: false, error: 'betting DB not configured' }, { status: 503 });
  }
  try {
    const summary = await awardDuePrizes();
    return NextResponse.json({ ok: true, ...summary, at: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
