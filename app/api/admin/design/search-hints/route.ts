import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { buildSearchIndex } from '@/lib/search-index';
import { searchDocs } from '@/lib/search-match';
import {
  SEARCH_HINT_APPLICATION_KEY,
  SEARCH_HINT_COLUMNS,
  loadSearchHintsForEditing,
  resetSearchHintsMemo,
  searchHintFromRow,
  searchHintProblem,
} from '@/lib/design/search-hints';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET  /api/admin/design/search-hints → { hints } every question with where it
//      leads and its stamp, in order, for the designer. Admin-only (404).
// POST /api/admin/design/search-hints ← { question } → 201 { hint }
//      The question is asked of the site's own search first (the same index and
//      matcher the header uses); one that finds nothing is refused (422) so the
//      field never suggests a dead end. The first hit is recorded with the row.
//      Appended last. Admin-only (404), production-only (403).
export async function GET() {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const hints = await loadSearchHintsForEditing();
  if (!hints) return NextResponse.json({ error: 'the hints could not be read' }, { status: 500 });
  return NextResponse.json({ hints });
}

/** Where the site's search leads for a question, or null when nowhere. */
export async function whereItLeads(question: string): Promise<{ url: string; title: string } | null> {
  const docs = await buildSearchIndex();
  const hit = searchDocs(docs, question, 1)[0];
  return hit ? { url: hit.url, title: hit.title } : null;
}

export async function POST(req: Request) {
  const user = await currentAccount();
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

  let body: { question?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const question = typeof body.question === 'string' ? body.question.trim().replace(/\s+/g, ' ') : '';
  const problem = searchHintProblem(question);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const leads = await whereItLeads(question);
    if (!leads) {
      return NextResponse.json(
        { error: 'This question leads nowhere: the site’s search finds nothing for it. Reword it so it finds a page.' },
        { status: 422 },
      );
    }
    const current = await loadSearchHintsForEditing();
    if (!current) return NextResponse.json({ error: 'the hints could not be read' }, { status: 500 });
    const seq = current.reduce((m, h) => Math.max(m, h.seq), 0) + 10;
    const { data, error } = await betDb()
      .from('search_hint')
      .insert({ application_key: SEARCH_HINT_APPLICATION_KEY, question, seq, leads_to: leads.url, leads_title: leads.title, updated_by: user?.id ?? null })
      .select(SEARCH_HINT_COLUMNS);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const hint = searchHintFromRow(((data ?? []) as unknown[])[0]);
    if (!hint) return NextResponse.json({ error: 'the stored row could not be read back' }, { status: 500 });
    resetSearchHintsMemo();
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, hint }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
