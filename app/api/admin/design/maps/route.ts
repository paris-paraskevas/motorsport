import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { MAP_BACKGROUNDS } from '@/lib/design/map-backgrounds';
import { loadMapBackgroundUsage } from '@/lib/design/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/maps → { backgrounds: [{ key, keySet, usedOn }] }
//
// The Map Backgrounds' side that needs the server (P2.12): for each background of
// lib/design/map-backgrounds.ts (client-safe, so the declarations travel with the
// page), Utilization (the live pages whose newest or live revision carries a Map
// region drawing it, by the regions' ids) and, for a keyed provider, whether its
// variable is set on this deployment; the value itself never leaves the server
// (rule 10). Fail-soft: an unreadable database empties Utilization and nothing
// else. Admin-only (404).
export async function GET() {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  const usage = await loadMapBackgroundUsage();
  const backgrounds = MAP_BACKGROUNDS.map(b => ({
    key: b.key,
    keySet: b.keyVar === null ? null : Boolean(process.env[b.keyVar]),
    usedOn: usage[b.key] ?? [],
  }));
  return NextResponse.json({ backgrounds });
}
