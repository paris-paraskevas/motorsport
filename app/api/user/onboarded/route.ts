import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getUserFollowed,
  isUserOnboarded,
  markUserOnboarded,
  resetUserOnboarded,
} from '@/lib/userPrefs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    let onboarded = await isUserOnboarded(userId);
    if (!onboarded) {
      // Backfill: any user who already has followed-series from before
      // the flag existed is implicitly onboarded.
      const followed = await getUserFollowed(userId);
      if (followed !== null) {
        await markUserOnboarded(userId);
        onboarded = true;
      }
    }
    return NextResponse.json({ onboarded });
  } catch (err) {
    console.error('GET /api/user/onboarded failed:', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    await markUserOnboarded(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/user/onboarded failed:', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    await resetUserOnboarded(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/user/onboarded failed:', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
