import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { PAGE_APPLICATION_KEY, PAGE_COLUMNS, isPageGroup, pageFromRow } from '@/lib/design/pages';
import { loadPageDetail } from '@/lib/design/page-revisions';
import { PAGE_NAME_MAX, PAGE_TITLE_MAX } from '@/lib/design/page-document';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/pages/<id> → the page, its live and newest revision (with
//     the newest document parsed) and every revision, newest first. 404 when the
//     page does not exist. Admin-only.
// PUT /api/admin/design/pages/<id> ← { name, title, group, authz, indexable, updatedAt }
//     The one write path for a row page's attributes: one conditional update,
//     refused when the row's `updated_at` is no longer the stamp the caller
//     loaded (409 with the detail as stored now). The path never changes here
//     (a page keeps its address; a new address is a new page), and code pages
//     are the code's (404). A saved page is revalidated so the served page
//     follows at once. Admin-only (404), production-only (403).
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

const SLUG = /^[a-z0-9_-]+$/;

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!isAdmin(user)) return new Response('not found', { status: 404 });
  if (!isProductionWorker()) {
    return NextResponse.json(
      { error: 'Design edits are made on production; this copy of the site is read-only.' },
      { status: 403 },
    );
  }
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const { id } = await params;

  let body: { name?: unknown; title?: unknown; group?: unknown; authz?: unknown; indexable?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'the page needs a name' }, { status: 400 });
  if (name.length > PAGE_NAME_MAX) return NextResponse.json({ error: `the name is at most ${PAGE_NAME_MAX} characters` }, { status: 400 });
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;
  if (title && title.length > PAGE_TITLE_MAX) return NextResponse.json({ error: `the title is at most ${PAGE_TITLE_MAX} characters` }, { status: 400 });
  if (!isPageGroup(body.group)) return NextResponse.json({ error: 'the group must be one of the six' }, { status: 400 });
  const authz = body.authz === null || body.authz === undefined || body.authz === '' ? 'public' : body.authz;
  if (typeof authz !== 'string' || !SLUG.test(authz)) return NextResponse.json({ error: 'the scheme must be a key' }, { status: 400 });
  if (typeof body.indexable !== 'boolean') return NextResponse.json({ error: 'indexable must be true or false' }, { status: 400 });
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) {
    return NextResponse.json({ error: 'updatedAt must be the stamp you loaded' }, { status: 400 });
  }

  try {
    const { data, error } = await betDb()
      .from('page')
      .update({ name, title, group_key: body.group, authz_key: authz, indexable: body.indexable, updated_by: user?.id ?? null })
      .eq('application_key', PAGE_APPLICATION_KEY)
      .eq('id', id)
      .eq('kind', 'row')
      .eq('updated_at', body.updatedAt)
      .select(PAGE_COLUMNS);
    if (error) {
      if (error.code === '23503' || /foreign key/i.test(error.message)) {
        return NextResponse.json({ error: 'The scheme does not exist.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const page = pageFromRow(((data ?? []) as unknown[])[0]);
    if (!page) {
      const current = await loadPageDetail(id);
      if (!current || current.page.kind !== 'row') return new Response('not found', { status: 404 });
      return NextResponse.json({ error: 'This page was saved again after you loaded it.', current }, { status: 409 });
    }
    revalidatePath(page.path);
    return NextResponse.json({ ok: true, page });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
