import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  SHORTCUT_APPLICATION_KEY,
  loadShortcutsForEditing,
  resetShortcutsMemo,
  shortcutKeyProblem,
  shortcutTextProblem,
  type EditableShortcut,
} from '@/lib/design/shortcuts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET  /api/admin/design/shortcuts → { shortcuts } every row with its stamp, by key.
// POST /api/admin/design/shortcuts ← { key, text } → 201 { shortcut }
//
// The POST creates a shortcut: the key and the text are checked by the same
// rules the editor applies (400 with the reason), and a key already stored is a
// 409 with the current list, also when the database's unique constraint says so
// first. Admin-only (404), production-only (403). Editing and deleting a
// shortcut is ./[key]/route.ts. No page is revalidated: nothing renders a
// shortcut until Phase 3.
export async function GET() {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const rows = await loadShortcutsForEditing();
  if (!rows) return NextResponse.json({ error: 'the shortcuts could not be read' }, { status: 500 });
  return NextResponse.json({ shortcuts: rows });
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

  let body: { key?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  const keyProblem = shortcutKeyProblem(key);
  if (keyProblem) return NextResponse.json({ error: `key: ${keyProblem}` }, { status: 400 });
  const text = typeof body.text === 'string' ? body.text : '';
  const textProblem = shortcutTextProblem(text);
  if (textProblem) return NextResponse.json({ error: `text: ${textProblem}` }, { status: 400 });

  const current = await loadShortcutsForEditing();
  if (current?.some(s => s.key === key)) {
    return NextResponse.json({ error: `A shortcut with the key “${key}” exists already.`, current }, { status: 409 });
  }

  try {
    const { data, error } = await betDb()
      .from('shortcut')
      .insert({ application_key: SHORTCUT_APPLICATION_KEY, key, text: text.trim(), updated_by: user?.id ?? null })
      .select('updated_at')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `A shortcut with the key “${key}” exists already.`, current }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    resetShortcutsMemo();
    const shortcut: EditableShortcut = { key, text: text.trim(), updatedAt: String((data as { updated_at: string }).updated_at) };
    return NextResponse.json({ ok: true, shortcut }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
