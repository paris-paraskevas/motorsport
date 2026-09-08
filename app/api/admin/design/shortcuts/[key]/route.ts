import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  SHORTCUT_APPLICATION_KEY,
  isShortcutKey,
  loadShortcutsForEditing,
  resetShortcutsMemo,
  shortcutTextProblem,
} from '@/lib/design/shortcuts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT    /api/admin/design/shortcuts/<key> ← { text, updatedAt }
// DELETE /api/admin/design/shortcuts/<key> ← { updatedAt }
//
// One conditional statement per row on the stamp the caller loaded (409 with
// the current list when it moved), so two people editing the same shortcut
// cannot overwrite each other unknowingly. The key never changes: a Static
// Content box names it, so a rename is a new shortcut and a deletion.
// Admin-only (404), production-only (403). The stamp travels verbatim: it
// carries microseconds a JavaScript Date would round away. No page is
// revalidated: nothing renders a shortcut until Phase 3.

function refused(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

type Gate =
  | { fail: Response; user?: undefined }
  | { fail: null; user: Awaited<ReturnType<typeof currentUser>> };

async function gate(): Promise<Gate> {
  const user = await currentUser();
  if (!isAdmin(user)) return { fail: new Response('not found', { status: 404 }) };
  if (!isProductionWorker()) {
    return { fail: refused(403, 'Design edits are made on production; this copy of the site is read-only.') };
  }
  if (!isBettingConfigured()) return { fail: refused(503, 'database not configured') };
  return { fail: null, user };
}

export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  const g = await gate();
  if (g.fail) return g.fail;
  const { key } = await params;
  if (!isShortcutKey(key)) return new Response('not found', { status: 404 });

  let body: { text?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return refused(400, 'invalid body');
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) return refused(400, 'updatedAt must be the stamp you loaded');
  const text = typeof body.text === 'string' ? body.text : '';
  const problem = shortcutTextProblem(text);
  if (problem) return refused(400, `text: ${problem}`);

  try {
    const { data, error } = await betDb()
      .from('shortcut')
      .update({ text: text.trim(), updated_by: g.user?.id ?? null })
      .eq('application_key', SHORTCUT_APPLICATION_KEY)
      .eq('key', key)
      .eq('updated_at', body.updatedAt)
      .select('updated_at');
    if (error) return refused(500, error.message);
    const rows = (data ?? []) as { updated_at: string }[];
    if (rows.length === 0) {
      return refused(409, 'This shortcut was saved again after you loaded it.', { current: await loadShortcutsForEditing() });
    }
    resetShortcutsMemo();
    return NextResponse.json({ ok: true, key, text: text.trim(), updatedAt: String(rows[0].updated_at) });
  } catch (err) {
    return refused(500, err instanceof Error ? err.message : 'unknown');
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  const g = await gate();
  if (g.fail) return g.fail;
  const { key } = await params;
  if (!isShortcutKey(key)) return new Response('not found', { status: 404 });

  let body: { updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return refused(400, 'invalid body');
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) return refused(400, 'updatedAt must be the stamp you loaded');

  try {
    const { data, error } = await betDb()
      .from('shortcut')
      .delete()
      .eq('application_key', SHORTCUT_APPLICATION_KEY)
      .eq('key', key)
      .eq('updated_at', body.updatedAt)
      .select('key');
    if (error) return refused(500, error.message);
    const rows = (data ?? []) as { key: string }[];
    if (rows.length === 0) {
      return refused(409, 'This shortcut was saved again after you loaded it.', { current: await loadShortcutsForEditing() });
    }
    resetShortcutsMemo();
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    return refused(500, err instanceof Error ? err.message : 'unknown');
  }
}
