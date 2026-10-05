import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  APPLICATION_KEY,
  listKeyProblem,
  listLabelProblem,
  loadListsForEditing,
  type EditableList,
} from '@/lib/design/lists';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET  /api/admin/design/lists → { lists } every list of the application with its
//      role, label, stamp and entry count: the Lists page and the Page Designer's
//      list picker read it.
// POST /api/admin/design/lists ← { key, label } → 201 { list }
//
// The POST creates a list of the operator's own (role `generic`; the five shell
// lists are seeded by migration and their keys are taken). The key and the
// label are checked by the same rules the editor applies (400 with the reason);
// a key already stored is a 409 with the current lists, also when the unique
// constraint says so first. Admin-only (404), production-only (403). Entries are
// saved through ./[key] (design_save_list), and deleting a list is ./[key] too.
export async function GET() {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const lists = await loadListsForEditing();
  if (!lists) return NextResponse.json({ error: 'the lists could not be read' }, { status: 500 });
  return NextResponse.json({ lists });
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

  let body: { key?: unknown; label?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  const keyProblem = listKeyProblem(key);
  if (keyProblem) return NextResponse.json({ error: `key: ${keyProblem}` }, { status: 400 });
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const labelProblem = listLabelProblem(label);
  if (labelProblem) return NextResponse.json({ error: `label: ${labelProblem}` }, { status: 400 });

  const current = await loadListsForEditing();
  if (current?.some(l => l.key === key)) {
    return NextResponse.json({ error: `A list with the key “${key}” exists already.`, current }, { status: 409 });
  }

  try {
    const { data, error } = await betDb()
      .from('list')
      .insert({ application_key: APPLICATION_KEY, key, role: 'generic', label, updated_by: user?.id ?? null })
      .select('updated_at')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `A list with the key “${key}” exists already.`, current }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const list: EditableList = { key, role: 'generic', label, updatedAt: String((data as { updated_at: string }).updated_at), entries: [] };
    return NextResponse.json({ ok: true, list }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
