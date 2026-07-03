import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getUserNotifPrefs,
  setUserNotifPrefs,
  type NotifPrefsPatch,
  type SessionTypePrefs,
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
    console.error('GET /api/user/notif-prefs failed:', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: { prefs?: NotifPrefsPatch };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!body.prefs || typeof body.prefs !== 'object') {
    return NextResponse.json({ error: 'prefs required' }, { status: 400 });
  }
  const patch: NotifPrefsPatch = {};
  if (typeof body.prefs.sessions === 'boolean') patch.sessions = body.prefs.sessions;
  if (typeof body.prefs.news === 'boolean') patch.news = body.prefs.news;
  if (typeof body.prefs.raceWeek === 'boolean') patch.raceWeek = body.prefs.raceWeek;
  if (typeof body.prefs.betting === 'boolean') patch.betting = body.prefs.betting;
  if (typeof body.prefs.blog === 'boolean') patch.blog = body.prefs.blog;
  // Pre-existing gap (fixed 0.86.0): the Sound toggle POSTs `sound` but the PUT
  // dropped it, so it silently never persisted. Accept it.
  if (typeof body.prefs.sound === 'boolean') patch.sound = body.prefs.sound;
  // Per-session-type flags: accept only the three known keys, each boolean.
  // A partial object is fine — setUserNotifPrefs deep-merges it.
  if (body.prefs.sessionTypes && typeof body.prefs.sessionTypes === 'object') {
    const src = body.prefs.sessionTypes as Record<string, unknown>;
    const st: Partial<SessionTypePrefs> = {};
    if (typeof src.practice === 'boolean') st.practice = src.practice;
    if (typeof src.qualifying === 'boolean') st.qualifying = src.qualifying;
    if (typeof src.race === 'boolean') st.race = src.race;
    if (Object.keys(st).length > 0) patch.sessionTypes = st;
  }
  try {
    const next = await setUserNotifPrefs(userId, patch);
    return NextResponse.json({ prefs: next });
  } catch (err) {
    console.error('PUT /api/user/notif-prefs failed:', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
