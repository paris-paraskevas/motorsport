import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { PAGE_APPLICATION_KEY } from '@/lib/design/pages';
import { documentRefs, loadPageDetail, parsePageDocument } from '@/lib/design/page-revisions';
import { refRows } from '@/lib/design/page-document';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/design/pages/<id>/revisions ← { document, action: 'draft' | 'publish', base }
//
// The one write path for a page's layout. The document is parsed by the same
// rule the reader uses and refused with every problem (400) before the database
// is touched; its references (lists, photos, shortcuts, schemes) are projected
// and stored beside the revision by design_save_page_revision() in one
// transaction. A publish carries `base`, the id of the live revision the
// designer loaded (or null when nothing was live); the function refuses a
// publish whose base is no longer live (409 with what is stored now). A row the
// document names that does not exist is a foreign-key refusal, answered 400.
// Admin-only (404), production-only (403). Nothing serves a row page until step
// 3, so no page is revalidated yet.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  let body: { document?: unknown; action?: unknown; base?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const action = body.action === 'draft' || body.action === 'publish' ? body.action : null;
  if (!action) return NextResponse.json({ error: "action must be 'draft' or 'publish'" }, { status: 400 });
  const base = body.base === undefined || body.base === null ? null : body.base;
  if (base !== null && typeof base !== 'string') {
    return NextResponse.json({ error: 'base must be the id of the live revision you loaded, or null' }, { status: 400 });
  }
  const parsed = parsePageDocument(body.document);
  if (parsed.problems.length > 0) {
    return NextResponse.json({ error: parsed.problems.join('; '), problems: parsed.problems }, { status: 400 });
  }
  const refs = documentRefs(parsed.value);
  const p_refs = refRows(refs);

  try {
    const { data, error } = await betDb().rpc('design_save_page_revision', {
      p_application: PAGE_APPLICATION_KEY,
      p_page_id: id,
      p_base: base,
      p_document: parsed.value,
      p_refs,
      p_actor: user?.id ?? null,
      p_publish: action === 'publish',
    });
    if (error) {
      if (/stale/i.test(error.message)) {
        return NextResponse.json(
          { error: 'This page was published again after you loaded it.', current: await loadPageDetail(id) },
          { status: 409 },
        );
      }
      if (/no such row page/i.test(error.message)) return new Response('not found', { status: 404 });
      if (error.code === '23503' || /foreign key/i.test(error.message)) {
        return NextResponse.json(
          { error: 'The layout names a list, a photo, a shortcut or a scheme that does not exist.', detail: error.message },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const row = (Array.isArray(data) ? data[0] : data) as { id: string; created_at: string; published_at: string | null } | undefined;
    if (!row) return NextResponse.json({ error: 'the revision was not returned' }, { status: 500 });
    return NextResponse.json({
      ok: true,
      action,
      revision: { id: row.id, createdAt: String(row.created_at), publishedAt: row.published_at != null ? String(row.published_at) : null },
      refs,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
