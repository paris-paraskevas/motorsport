import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { SAVED_VIEW_APPLICATION_KEY, SEQ_MAX, loadRegionShape, loadViewsForEditing, resetViewsMemo, type EditableSavedView } from '@/lib/design/views';
import { bindViewState, definitionOf, isViewKey, parseViewState, viewNameProblem, type ViewDefinition } from '@/lib/design/view-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT    /api/admin/design/views/<key> ← { name?, definition?, seq?, updatedAt } → 200 { view }
// DELETE /api/admin/design/views/<key> ← { updatedAt } → 200 { ok, key }
//
// One conditional statement per row on the stamp the caller loaded (409 with the current list when it moved), the shortcuts'
// pattern. The key never changes: readers share it in a link, so a rename is a new view and a deletion; the page and the
// region never change either (a view belongs to one region). A definition is re-bound to the region's live shape. Admin-only
// (404), production-only (403). The page's path is revalidated: its Views menu or a view's rows change.

function refused(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

type Gate = { fail: Response; user?: undefined } | { fail: null; user: Awaited<ReturnType<typeof currentAccount>> };

async function gate(): Promise<Gate> {
  const user = await currentAccount();
  if (!isAdmin(user)) return { fail: new Response('not found', { status: 404 }) };
  if (!isProductionWorker()) return { fail: refused(403, 'Design edits are made on production; this copy of the site is read-only.') };
  if (!isBettingConfigured()) return { fail: refused(503, 'database not configured') };
  return { fail: null, user };
}

export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  const g = await gate();
  if (g.fail) return g.fail;
  const { key } = await params;
  if (!isViewKey(key)) return new Response('not found', { status: 404 });

  let body: { name?: unknown; definition?: unknown; seq?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return refused(400, 'invalid body');
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) return refused(400, 'updatedAt must be the stamp you loaded');
  const current = await loadViewsForEditing();
  const stored = current?.find(v => v.key === key);
  if (!stored) return new Response('not found', { status: 404 });
  // The region's live shape once: a definition binds to it, and the page's path is revalidated after the write.
  const target = await loadRegionShape(stored.pageId, stored.regionId);

  const patch: { name?: string; definition?: ViewDefinition; seq?: number } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const problem = viewNameProblem(name);
    if (problem) return refused(400, `name: ${problem}`);
    patch.name = name;
  }
  if (body.definition !== undefined) {
    const parsed = parseViewState(typeof body.definition === 'string' ? body.definition.trim() : '');
    if (parsed.problems.length > 0) return refused(400, `definition: ${parsed.problems.join('; ')}`);
    if (!target) return refused(400, `page and region: the page has no live Data region “${stored.regionId}” with a preset`);
    patch.definition = definitionOf(bindViewState(parsed.value, target.shape));
  }
  if (body.seq !== undefined) {
    if (typeof body.seq !== 'number' || !Number.isInteger(body.seq) || body.seq < 1 || body.seq > SEQ_MAX) return refused(400, `seq: a whole number from 1 to ${SEQ_MAX}`);
    patch.seq = body.seq;
  }

  try {
    const { data, error } = await betDb()
      .from('saved_view')
      .update({ ...patch, updated_by: g.user?.id ?? null })
      .eq('application_key', SAVED_VIEW_APPLICATION_KEY)
      .eq('key', key)
      .eq('updated_at', body.updatedAt)
      .select('updated_at');
    if (error) return refused(500, error.message);
    const rows = (data ?? []) as { updated_at: string }[];
    if (rows.length === 0) return refused(409, 'This saved view was saved again after you loaded it.', { current: await loadViewsForEditing() });
    resetViewsMemo();
    if (target) revalidatePath(target.path);
    const view: EditableSavedView = { ...stored, ...patch, updatedAt: String(rows[0].updated_at) };
    return NextResponse.json({ ok: true, view });
  } catch (err) {
    return refused(500, err instanceof Error ? err.message : 'unknown');
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  const g = await gate();
  if (g.fail) return g.fail;
  const { key } = await params;
  if (!isViewKey(key)) return new Response('not found', { status: 404 });

  let body: { updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return refused(400, 'invalid body');
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) return refused(400, 'updatedAt must be the stamp you loaded');
  const stored = (await loadViewsForEditing())?.find(v => v.key === key);
  if (!stored) return new Response('not found', { status: 404 });
  const target = await loadRegionShape(stored.pageId, stored.regionId);

  try {
    const { data, error } = await betDb()
      .from('saved_view')
      .delete()
      .eq('application_key', SAVED_VIEW_APPLICATION_KEY)
      .eq('key', key)
      .eq('updated_at', body.updatedAt)
      .select('key');
    if (error) return refused(500, error.message);
    const rows = (data ?? []) as { key: string }[];
    if (rows.length === 0) return refused(409, 'This saved view was saved again after you loaded it.', { current: await loadViewsForEditing() });
    resetViewsMemo();
    if (target) revalidatePath(target.path);
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    return refused(500, err instanceof Error ? err.message : 'unknown');
  }
}
