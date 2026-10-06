import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { purgeEdgeAfterRevalidate } from '@/lib/cache-headers';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { REGION_ID, SAVED_VIEW_APPLICATION_KEY, loadRegionShape, loadViewTargets, loadViewsForEditing, resetViewsMemo, type EditableSavedView } from '@/lib/design/views';
import { bindViewState, definitionOf, parseViewState, viewKeyProblem, viewNameProblem } from '@/lib/design/view-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET  /api/admin/design/views → { views, targets }: every row with its stamp, by seq then name; the pages with Data regions
//                                 a view may belong to (one scan of the revisions).
// POST /api/admin/design/views ← { key, name, pageId, regionId, definition } → 201 { view }
//
// The POST creates a saved view (P2.3 PR B): the key and the name are checked by the same rules the editor applies (400
// with the reason); the definition is the vocabulary's text (`sort=-points&cols=name,points`), read leniently and bound to
// the page's LIVE Data region's shape — a region that is not live, or a preset the region lacks, is a 400, since a view is
// saved against what readers see; a key already stored is a 409 with the current list, also when the database's unique
// constraint says so first. Admin-only (404), production-only (403). The page's path is revalidated: its Views menu changes.
export async function GET() {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  const [views, targets] = await Promise.all([loadViewsForEditing(), loadViewTargets()]);
  if (!views) return NextResponse.json({ error: 'the saved views could not be read' }, { status: 500 });
  return NextResponse.json({ views, targets: targets ?? [] });
}

export async function POST(req: Request) {
  const user = await currentAccount();
  if (!isAdmin(user)) return new Response('not found', { status: 404 });
  if (!isProductionWorker()) {
    return NextResponse.json({ error: 'Design edits are made on production; this copy of the site is read-only.' }, { status: 403 });
  }
  if (!isBettingConfigured()) return NextResponse.json({ error: 'database not configured' }, { status: 503 });

  let body: { key?: unknown; name?: unknown; pageId?: unknown; regionId?: unknown; definition?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  const keyProblem = viewKeyProblem(key);
  if (keyProblem) return NextResponse.json({ error: `key: ${keyProblem}` }, { status: 400 });
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const nameProblem = viewNameProblem(name);
  if (nameProblem) return NextResponse.json({ error: `name: ${nameProblem}` }, { status: 400 });
  const pageId = typeof body.pageId === 'string' ? body.pageId.trim() : '';
  const regionId = typeof body.regionId === 'string' ? body.regionId.trim() : '';
  if (!pageId || !REGION_ID.test(regionId)) return NextResponse.json({ error: 'page and region: a view belongs to one Data region of one page' }, { status: 400 });
  const text = typeof body.definition === 'string' ? body.definition.trim() : '';
  const parsed = parseViewState(text);
  if (parsed.problems.length > 0) return NextResponse.json({ error: `definition: ${parsed.problems.join('; ')}` }, { status: 400 });
  const target = await loadRegionShape(pageId, regionId);
  if (!target) return NextResponse.json({ error: `page and region: the page has no live Data region “${regionId}” with a preset` }, { status: 400 });
  const definition = definitionOf(bindViewState(parsed.value, target.shape));

  const current = await loadViewsForEditing();
  if (current?.some(v => v.key === key)) {
    return NextResponse.json({ error: `A saved view with the key “${key}” exists already.`, current }, { status: 409 });
  }

  try {
    const { data, error } = await betDb()
      .from('saved_view')
      .insert({ application_key: SAVED_VIEW_APPLICATION_KEY, key, page_id: pageId, region_id: regionId, name, definition, updated_by: user?.id ?? null })
      .select('updated_at, seq')
      .single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: `A saved view with the key “${key}” exists already.`, current }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    resetViewsMemo();
    revalidatePath(target.path);
    await purgeEdgeAfterRevalidate([`path:${target.path}`]);
    const row = data as { updated_at: string; seq: number };
    const view: EditableSavedView = { key, pageId, regionId, name, definition, seq: row.seq, updatedAt: String(row.updated_at) };
    return NextResponse.json({ ok: true, view }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}
