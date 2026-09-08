import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/threads';
import { isBettingConfigured } from '@/lib/betting/client';
import { loadPagesForEditing } from '@/lib/design/pages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/pages → { pages } the registry: every code page from its
// row (or from the code, unstamped, when the row is not there yet) and every
// row page, in group order. Admin-only; 404 for everyone else. No write path in
// this step: code pages are the code's, and row pages arrive with step 2.
export async function GET() {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const pages = await loadPagesForEditing();
  if (!pages) return NextResponse.json({ error: 'the pages could not be read' }, { status: 500 });
  return NextResponse.json({ pages });
}
