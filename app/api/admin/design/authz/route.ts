import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/threads';
import { isBettingConfigured } from '@/lib/betting/client';
import { loadAuthzForEditing } from '@/lib/design/authz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/authz → every authorization scheme with its row's stamp,
// for the designer. Admin-only; 404 for everyone else. Writes are per key, in
// ./[key]/route.ts.
export async function GET() {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const rows = await loadAuthzForEditing();
  if (!rows) return NextResponse.json({ error: 'the schemes could not be read' }, { status: 500 });
  return NextResponse.json({ schemes: rows });
}
