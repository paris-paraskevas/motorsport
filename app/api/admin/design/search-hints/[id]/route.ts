import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';
import { purgeEdgeAfterRevalidate } from '@/lib/cache-headers';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  SEARCH_HINT_APPLICATION_KEY,
  SEARCH_HINT_COLUMNS,
  loadSearchHintsForEditing,
  resetSearchHintsMemo,
  searchHintFromRow,
  searchHintProblem,
} from '@/lib/design/search-hints';
import { whereItLeads } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function gate(user: { role?: string | null } | null, id: string): Response | null {
  if (!isAdmin(user)) return new Response('not found', { status: 404 });
  if (!isProductionWorker()) {
    return NextResponse.json(
      { error: 'Design edits are made on production; this copy of the site is read-only.' },
      { status: 403 },
    );
  }
  if (!isBettingConfigured()) return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  if (!UUID.test(id)) return new Response('not found', { status: 404 });
  return null;
}

// PUT    /api/admin/design/search-hints/<id> ← { question, seq, updatedAt } → { hint }
//        One conditional update on the row's stamp (409 with the current rows when
//        it moved). A changed question is asked of the search again and refused
//        (422) when it leads nowhere; `seq` reorders.
// DELETE /api/admin/design/search-hints/<id> → { ok }
// Admin-only (404), production-only (403); the layout is revalidated after both.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentAccount();
  const { id } = await params;
  const refused = gate(user, id);
  if (refused) return refused;

  let body: { question?: unknown; seq?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const question = typeof body.question === 'string' ? body.question.trim().replace(/\s+/g, ' ') : '';
  const problem = searchHintProblem(question);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (typeof body.seq !== 'number' || !Number.isInteger(body.seq)) {
    return NextResponse.json({ error: 'seq must be a whole number' }, { status: 400 });
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) {
    return NextResponse.json({ error: 'updatedAt must be the stamp you loaded' }, { status: 400 });
  }

  try {
    const current = await loadSearchHintsForEditing();
    if (!current) return NextResponse.json({ error: 'the hints could not be read' }, { status: 500 });
    const stored = current.find(h => h.id === id);
    if (!stored) return new Response('not found', { status: 404 });
    let leads = { url: stored.leadsTo, title: stored.leadsTitle };
    if (question !== stored.question) {
      const found = await whereItLeads(question);
      if (!found) {
        return NextResponse.json(
          { error: 'This question leads nowhere: the site’s search finds nothing for it. Reword it so it finds a page.' },
          { status: 422 },
        );
      }
      leads = found;
    }
    const { data, error } = await betDb()
      .from('search_hint')
      .update({ question, seq: body.seq, leads_to: leads.url, leads_title: leads.title, updated_by: user?.id ?? null })
      .eq('application_key', SEARCH_HINT_APPLICATION_KEY)
      .eq('id', id)
      .eq('updated_at', body.updatedAt)
      .select(SEARCH_HINT_COLUMNS);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const hint = searchHintFromRow(((data ?? []) as unknown[])[0]);
    if (!hint) {
      return NextResponse.json(
        { error: 'This hint was saved again after you loaded it.', current: await loadSearchHintsForEditing() },
        { status: 409 },
      );
    }
    resetSearchHintsMemo();
    revalidatePath('/', 'layout');
    await purgeEdgeAfterRevalidate(['site']);
    return NextResponse.json({ ok: true, hint });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentAccount();
  const { id } = await params;
  const refused = gate(user, id);
  if (refused) return refused;
  try {
    const { data, error } = await betDb()
      .from('search_hint')
      .delete()
      .eq('application_key', SEARCH_HINT_APPLICATION_KEY)
      .eq('id', id)
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (((data ?? []) as unknown[]).length === 0) return new Response('not found', { status: 404 });
    resetSearchHintsMemo();
    revalidatePath('/', 'layout');
    await purgeEdgeAfterRevalidate(['site']);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
