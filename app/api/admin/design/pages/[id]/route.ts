import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/threads';
import { isBettingConfigured } from '@/lib/betting/client';
import { loadPageDetail } from '@/lib/design/page-revisions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/pages/<id> → the page, its live revision, its newest
// revision with the document, and every revision newest first. Admin-only;
// 404 for everyone else and for a page that does not exist. Saving a revision
// is ./revisions/route.ts.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const { id } = await params;
  const detail = await loadPageDetail(id);
  if (!detail) return new Response('not found', { status: 404 });
  return NextResponse.json(detail);
}
