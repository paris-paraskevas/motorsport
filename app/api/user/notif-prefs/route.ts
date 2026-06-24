import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getUserNotifPrefs,
  setUserNotifPrefs,
  type NotifPrefs,
} from '@/lib/userPrefs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const prefs = await getUserNotifPrefs(userId);
    return NextResponse.json({ prefs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: { prefs?: Partial<NotifPrefs> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!body.prefs || typeof body.prefs !== 'object') {
    return NextResponse.json({ error: 'prefs required' }, { status: 400 });
  }
  const patch: Partial<NotifPrefs> = {};
  if (typeof body.prefs.sessions === 'boolean') patch.sessions = body.prefs.sessions;
  if (typeof body.prefs.news === 'boolean') patch.news = body.prefs.news;
  if (typeof body.prefs.raceWeek === 'boolean') patch.raceWeek = body.prefs.raceWeek;
  if (typeof body.prefs.betting === 'boolean') patch.betting = body.prefs.betting;
  // Pre-existing gap (fixed 0.86.0): the Sound toggle POSTs `sound` but the PUT
  // dropped it, so it silently never persisted. Accept it.
  if (typeof body.prefs.sound === 'boolean') patch.sound = body.prefs.sound;
  try {
    const next = await setUserNotifPrefs(userId, patch);
    return NextResponse.json({ prefs: next });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
