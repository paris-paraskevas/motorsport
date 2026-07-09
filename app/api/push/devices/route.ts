import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listUserSubscriptions } from '@/lib/push-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The signed-in user's push devices, for the Settings "Your devices" list.
// Returns each device's endpoint (the id the test/unsubscribe routes key on,
// both ownership-checked) + its label + when it was added. Signed-out → 401.
export async function GET() {
  const a = await auth();
  if (!a.userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const devices = await listUserSubscriptions(a.userId);
    return NextResponse.json({ ok: true, devices });
  } catch (err) {
    console.error('GET /api/push/devices failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
