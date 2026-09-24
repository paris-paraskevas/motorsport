import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { isBettingConfigured } from '@/lib/betting/client';
import { loadBuildOptionsForEditing } from '@/lib/design/build-options';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/build-options → every build option with its row's
// stamp, for the designer. Admin-only; 404 for everyone else. Writes are per
// key, in ./[key]/route.ts.
export async function GET() {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const rows = await loadBuildOptionsForEditing();
  if (!rows) return NextResponse.json({ error: 'the build options could not be read' }, { status: 500 });
  return NextResponse.json({ options: rows });
}
