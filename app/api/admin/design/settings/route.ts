import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/threads';
import { isBettingConfigured } from '@/lib/betting/client';
import { loadSettingsForEditing } from '@/lib/design/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/settings → every application setting with its row's
// stamp, for the designer. Admin-only; 404 for everyone else. Writes are per
// key, in ./[key]/route.ts.
export async function GET() {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const rows = await loadSettingsForEditing();
  if (!rows) return NextResponse.json({ error: 'the settings could not be read' }, { status: 500 });
  return NextResponse.json({ settings: rows });
}
