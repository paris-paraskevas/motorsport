import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserFollowed, setUserFollowed } from '@/lib/userPrefs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const followed = await getUserFollowed(userId);
    return NextResponse.json({ followed });
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
  let body: { followed?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!Array.isArray(body.followed) || !body.followed.every(s => typeof s === 'string')) {
    return NextResponse.json({ error: 'followed must be string[]' }, { status: 400 });
  }
  try {
    await setUserFollowed(userId, body.followed as string[]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
