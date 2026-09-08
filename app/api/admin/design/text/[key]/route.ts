import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { TEXT_APPLICATION_KEY, TEXT_MAX, isTextKey, loadTextForEditing, resetTextMemo } from '@/lib/design/text';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT /api/admin/design/text/<key>  ← { text, updatedAt }
//
// The one write path for a chrome string: a single conditional update, refused
// when the row's `updated_at` is no longer the stamp the caller loaded (409 with
// the current rows), so two people editing the same message cannot overwrite
// each other unknowingly. Admin-only (404), production-only (403). The stamp
// travels verbatim: it carries microseconds a JavaScript Date would round away.
export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }) {
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
  const { key } = await params;
  if (!isTextKey(key)) return new Response('not found', { status: 404 });

  let body: { text?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'the text cannot be empty' }, { status: 400 });
  if (text.length > TEXT_MAX) {
    return NextResponse.json({ error: `the text is at most ${TEXT_MAX} characters` }, { status: 400 });
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) {
    return NextResponse.json({ error: 'updatedAt must be the stamp you loaded' }, { status: 400 });
  }

  try {
    const { data, error } = await betDb()
      .from('text_message')
      .update({ text, updated_by: user?.id ?? null })
      .eq('application_key', TEXT_APPLICATION_KEY)
      .eq('key', key)
      .eq('updated_at', body.updatedAt)
      .select('updated_at');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []) as { updated_at: string }[];
    if (rows.length === 0) {
      const current = await loadTextForEditing();
      return NextResponse.json(
        { error: 'This message was saved again after you loaded it.', current },
        { status: 409 },
      );
    }
    resetTextMemo();
    // The strings render inside the layout of every page.
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, key, text, updatedAt: String(rows[0].updated_at) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
