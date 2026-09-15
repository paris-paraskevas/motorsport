import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { CODE_PAGES, PAGE_APPLICATION_KEY, isPageGroup, loadDeletedPages, loadPagesForEditing, pageFromRow } from '@/lib/design/pages';
import { PAGE_NAME_MAX, daysLeft, documentRefs, refRows, rowPagePathProblem } from '@/lib/design/page-document';
import { pageTemplate } from '@/lib/design/page-templates';
import { resetPageFrameMemo } from '@/lib/design/page-frame';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET  /api/admin/design/pages → { pages, deleted } the registry: every code page
//      from its row (or from the code, unstamped, when the row is not there yet)
//      and every row page, in group order; the deleted pages apart (P1.12),
//      newest deletion first. Reads only.
// POST /api/admin/design/pages ← { name, path, group, template } → 201 { page }
//
// The POST creates a row page: a page served from a published revision by the
// catch-all (step 3). The path is literal and lower-case, never reserved, never
// one the code already serves (the registry's patterns are matched segment by
// segment, so /series/monza is refused because /series/[slug] exists), never
// one another row page holds (409), never a deleted page's (409: its address
// stays its own until it is removed for good). The template is one of the
// starting layouts in lib/design/page-templates.ts; design_create_page() writes
// the page and, unless the template is blank, its first draft revision in one
// transaction. The page starts unindexed, cached, for everyone, on the
// standard template. Admin-only (404), production-only (403). Code pages are
// the code's and have no write path.
//
// DELETE /api/admin/design/pages?expired=1 → { purged, held } removes for good
//      the deleted pages past their recovery window, each through
//      design_purge_page(); a page a live page still names stays and is
//      reported with the names. The pages list's "Remove expired pages" button:
//      an administrator's click, never a side effect of a read (the plan
//      critic's finding). Admin-only (404), production-only (403).
export async function GET() {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const [pages, deleted] = await Promise.all([loadPagesForEditing(), loadDeletedPages()]);
  if (!pages) return NextResponse.json({ error: 'the pages could not be read' }, { status: 500 });
  return NextResponse.json({ pages, deleted: deleted ?? [] });
}

const READ_ONLY = { error: 'Design edits are made on production; this copy of the site is read-only.' };

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isAdmin(user)) return new Response('not found', { status: 404 });
  if (!isProductionWorker()) return NextResponse.json(READ_ONLY, { status: 403 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }

  let body: { name?: unknown; path?: unknown; group?: unknown; template?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'the page needs a name' }, { status: 400 });
  if (name.length > PAGE_NAME_MAX) return NextResponse.json({ error: `the name is at most ${PAGE_NAME_MAX} characters` }, { status: 400 });
  if (!isPageGroup(body.group)) return NextResponse.json({ error: 'the group must be one of the six' }, { status: 400 });
  const template = pageTemplate(body.template);
  if (!template) return NextResponse.json({ error: 'the template must be one of those offered' }, { status: 400 });
  const path = typeof body.path === 'string' ? body.path.trim() : '';

  const [current, deleted] = await Promise.all([loadPagesForEditing(), loadDeletedPages()]);
  if (!current) return NextResponse.json({ error: 'the pages could not be read' }, { status: 500 });
  const rowPaths = current.filter(p => p.kind === 'row').map(p => p.path);
  const deletedPaths = (deleted ?? []).map(p => p.path);
  const problem = rowPagePathProblem(path, CODE_PAGES.map(p => p.path), rowPaths, deletedPaths);
  if (problem) {
    return NextResponse.json({ error: `path: ${problem}` }, { status: rowPaths.includes(path) || deletedPaths.includes(path) ? 409 : 400 });
  }

  const document = template.document.regions.length > 0 ? template.document : null;
  try {
    const { data, error } = await betDb().rpc('design_create_page', {
      p_application: PAGE_APPLICATION_KEY,
      p_path: path,
      p_name: name,
      p_group: body.group,
      p_actor: user?.id ?? null,
      p_document: document,
      p_refs: document ? refRows(documentRefs(document)) : [],
    });
    if (error) {
      if (error.code === '23505' || /duplicate key/i.test(error.message)) {
        return NextResponse.json({ error: 'path: a page with this path exists already' }, { status: 409 });
      }
      if (error.code === '23503' || /foreign key/i.test(error.message)) {
        return NextResponse.json(
          { error: 'The template names a list that does not exist on this database.', detail: error.message },
          { status: 400 },
        );
      }
      if (error.code === 'PGRST202' || /could not find the function/i.test(error.message)) {
        return NextResponse.json(
          { error: 'The database is not ready for this yet: migration 20260909010000 has not been applied.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const page = pageFromRow(Array.isArray(data) ? data[0] : data);
    if (!page) return NextResponse.json({ error: 'the stored row could not be read back' }, { status: 500 });
    return NextResponse.json({ ok: true, page, template: template.key }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  if (!isProductionWorker()) return NextResponse.json(READ_ONLY, { status: 403 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  if (new URL(req.url).searchParams.get('expired') !== '1') {
    return NextResponse.json({ error: 'say ?expired=1 to remove the deleted pages past their recovery window' }, { status: 400 });
  }
  const deleted = await loadDeletedPages();
  if (!deleted) return NextResponse.json({ error: 'the pages could not be read' }, { status: 500 });
  const now = Date.now();
  const purged: string[] = [];
  const held: { id: string; pages: string[] }[] = [];
  try {
    for (const p of deleted) {
      if (!p.id || !p.deletedAt || daysLeft(p.deletedAt, now) > 0) continue;
      const { data, error } = await betDb().rpc('design_purge_page', { p_application: PAGE_APPLICATION_KEY, p_page_id: p.id });
      if (error) {
        const named = /^referenced: (.+)$/.exec(error.message.trim());
        if (named) {
          held.push({ id: p.id, pages: named[1].split(' · ') });
          continue;
        }
        return NextResponse.json({ error: error.message, purged, held }, { status: 500 });
      }
      if (data === true) {
        purged.push(p.id);
        revalidatePath(p.path);
      }
    }
    if (purged.length > 0) resetPageFrameMemo();
    return NextResponse.json({ ok: true, purged, held });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown', purged, held },
      { status: 500 },
    );
  }
}
