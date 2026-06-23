import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserHomeLayout, setUserHomeLayout } from '@/lib/userPrefs';
import { parseHomeLayout } from '@/lib/homeLayout';

export const dynamic = 'force-dynamic';

// Per-user home (/app) layout prefs. Mirrors /api/user/prefs: Clerk-auth,
// strict validation, KV-backed. GET returns null when nothing's stored yet
// (the client then falls back to localStorage + default).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const layout = await getUserHomeLayout(userId);
    return NextResponse.json({ layout });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const parsed = parseHomeLayout(body);
  if (!parsed) return NextResponse.json({ error: 'invalid layout' }, { status: 400 });
  try {
    await setUserHomeLayout(userId, parsed);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}
