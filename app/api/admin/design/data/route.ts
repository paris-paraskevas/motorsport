import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { loadDataIndex } from '@/lib/design/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/data → { services: [{ key, state, fetchedAt }] }
//
// The Data workspace's index: every service in the catalogue with its state
// (live, connect, own) from the credentials this Worker holds, by presence
// only, and when its figures were last read here. Reads nothing upstream:
// the figures come one service at a time from ./[key]. Admin-only (404).
export async function GET() {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  return NextResponse.json({ services: loadDataIndex() });
}
