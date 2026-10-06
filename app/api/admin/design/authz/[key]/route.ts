import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';
import { purgeEdgeAfterRevalidate } from '@/lib/cache-headers';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  AUTHZ_APPLICATION_KEY,
  AUTHZ_LABEL_MAX,
  AUTHZ_MESSAGE_MAX,
  DEFAULT_AUTHZ_SCHEMES,
  loadAuthzForEditing,
  resetAuthzMemo,
} from '@/lib/design/authz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEY = /^[a-z0-9_-]{1,40}$/;

// PUT /api/admin/design/authz/<key>  ← { label, message, updatedAt }
//
// The one write path for an authorization scheme: its label and the message a
// refused visitor reads. The type and the value decide how the check is made
// and stay with the code, so they are not accepted here. A single conditional
// update, refused when the row's `updated_at` is no longer the stamp the caller
// loaded (409 with the current rows). Admin-only (404), production-only (403).
// The stamp travels verbatim: it carries microseconds a JavaScript Date would
// round away. The layout is revalidated: the served pages read a scheme's
// message and the shell's lists its check.
export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }) {
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
  const { key } = await params;
  if (!KEY.test(key)) return new Response('not found', { status: 404 });

  let body: { label?: unknown; message?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label) return NextResponse.json({ error: 'the label cannot be empty' }, { status: 400 });
  if (label.length > AUTHZ_LABEL_MAX) {
    return NextResponse.json({ error: `the label is at most ${AUTHZ_LABEL_MAX} characters` }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message.length > AUTHZ_MESSAGE_MAX) {
    return NextResponse.json({ error: `the message is at most ${AUTHZ_MESSAGE_MAX} characters` }, { status: 400 });
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) {
    return NextResponse.json({ error: 'updatedAt must be the stamp you loaded' }, { status: 400 });
  }

  try {
    const { data, error } = await betDb()
      .from('authz_scheme')
      .update({ label, message: message || null, updated_by: user?.id ?? null })
      .eq('application_key', AUTHZ_APPLICATION_KEY)
      .eq('key', key)
      .eq('updated_at', body.updatedAt)
      .select('updated_at');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []) as { updated_at: string }[];
    if (rows.length === 0) {
      const current = await loadAuthzForEditing();
      return NextResponse.json(
        { error: 'This scheme was saved again after you loaded it.', current },
        { status: 409 },
      );
    }
    resetAuthzMemo();
    // The shell's lists and the served pages read the schemes at render.
    revalidatePath('/', 'layout');
    await purgeEdgeAfterRevalidate(['site']);
    return NextResponse.json({ ok: true, key, label, message: message || null, updatedAt: String(rows[0].updated_at) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/design/authz/<key>
//
// Removes a scheme of the operator's own (Phase 3 step 4). The shipped four
// stay: the code's pages and the selects lean on them (400). A scheme a page, a
// region's reference or a navigation entry still names is refused by the
// database's foreign keys and answered 409 with the current rows, so nothing is
// ever left pointing at a rule that is gone. Admin-only (404), production-only (403).
export async function DELETE(_req: Request, { params }: { params: Promise<{ key: string }> }) {
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
  const { key } = await params;
  if (!KEY.test(key)) return new Response('not found', { status: 404 });
  if (DEFAULT_AUTHZ_SCHEMES.some(s => s.key === key)) {
    return NextResponse.json({ error: 'the shipped schemes stay; only a scheme of your own can be removed' }, { status: 400 });
  }

  try {
    const { data, error } = await betDb()
      .from('authz_scheme')
      .delete()
      .eq('application_key', AUTHZ_APPLICATION_KEY)
      .eq('key', key)
      .select('key');
    if (error) {
      if (error.code === '23503' || /foreign key/i.test(error.message)) {
        return NextResponse.json(
          { error: 'This scheme is still used by a page, a region or a navigation entry. Change those first.', current: await loadAuthzForEditing() },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (((data ?? []) as unknown[]).length === 0) return new Response('not found', { status: 404 });
    resetAuthzMemo();
    revalidatePath('/', 'layout');
    await purgeEdgeAfterRevalidate(['site']);
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
