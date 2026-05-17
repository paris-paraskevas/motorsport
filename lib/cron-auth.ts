import { NextResponse } from 'next/server';

export type CronAuth = 'ok' | 'missing-secret' | 'invalid';

// Three-state auth result so cron routes can fail-closed (503) when the
// secret is unset rather than fail-open. The previous shape (boolean) had
// `return true` when CRON_SECRET was unset, which turned every cron route
// into an unauth'd spam gun if the env var ever got cleared. See
// docs/HANDOFF.md "Critical landmines" #6.
export function authorizeCronRequest(req: Request): CronAuth {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return 'missing-secret';
  const header = req.headers.get('authorization');
  return header === `Bearer ${cronSecret}` ? 'ok' : 'invalid';
}

export function cronAuthFailureResponse(auth: Exclude<CronAuth, 'ok'>): NextResponse {
  if (auth === 'missing-secret') {
    return NextResponse.json(
      { ok: false, error: 'cron secret not configured' },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}
