import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureBettingUser } from '@/lib/betting/credits';
import { createLeague, joinLeague } from '@/lib/betting/leagues';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Friend leagues: create one (returns a join code) or join by code. The user is
// lazily onboarded first. 503s when the betting DB isn't provisioned.
export async function POST(req: Request) {
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'betting not available' }, { status: 503 });
  }
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { action?: unknown; name?: unknown; joinCode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  await ensureBettingUser(userId);

  if (body.action === 'create') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 60) {
      return NextResponse.json({ error: 'name must be 1–60 characters' }, { status: 400 });
    }
    const { id, joinCode } = await createLeague(userId, name);
    return NextResponse.json({ ok: true, id, joinCode });
  }

  if (body.action === 'join') {
    const code = typeof body.joinCode === 'string' ? body.joinCode.trim() : '';
    if (!code) return NextResponse.json({ error: 'join code required' }, { status: 400 });
    try {
      const id = await joinLeague(userId, code);
      return NextResponse.json({ ok: true, id });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'could not join';
      return NextResponse.json({ ok: false, error: message }, { status: 422 });
    }
  }

  return NextResponse.json({ error: "action must be 'create' or 'join'" }, { status: 400 });
}
