import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  AUTHZ_APPLICATION_KEY,
  AUTHZ_LABEL_MAX,
  AUTHZ_MESSAGE_MAX,
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
// round away. No page is revalidated: nothing on the site renders a scheme yet.
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
    return NextResponse.json({ ok: true, key, label, message: message || null, updatedAt: String(rows[0].updated_at) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
