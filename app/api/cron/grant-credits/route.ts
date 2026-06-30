import { NextResponse } from 'next/server';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { isBettingConfigured } from '@/lib/betting/client';
import { grantMonthlyToAll } from '@/lib/betting/credits';
import { computeMonthlyAllowance } from '@/lib/betting/allowance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Monthly free-credit grant for every user (Paddock Betting, design doc §1/§8).
// Idempotent per calendar month (enforced in SQL), so scheduling it daily is
// safe — only the first run each month actually grants. Fails closed on cron
// auth; 503s cleanly when the betting DB isn't provisioned yet (prod before
// Supabase is wired), so it never 500s.
export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);
  if (!isBettingConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'betting DB not configured' },
      { status: 503 },
    );
  }
  try {
    const grantedThisRun = await grantMonthlyToAll(computeMonthlyAllowance(new Date()));
    return NextResponse.json({ ok: true, grantedThisRun, at: new Date().toISOString() });
  } catch (err) {
    console.error('GET /api/cron/grant-credits failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
