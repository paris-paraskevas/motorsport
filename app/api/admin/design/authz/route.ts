import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  AUTHZ_APPLICATION_KEY,
  AUTHZ_LABEL_MAX,
  AUTHZ_MESSAGE_MAX,
  DEFAULT_AUTHZ_SCHEMES,
  isAuthzType,
  loadAuthzForEditing,
  resetAuthzMemo,
} from '@/lib/design/authz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET  /api/admin/design/authz → every authorization scheme with its row's stamp,
//      for the designer. Admin-only; 404 for everyone else.
// POST /api/admin/design/authz ← { key, label, type, value, message } → 201 { scheme }
//      A scheme of the operator's own (Phase 3 step 4). The key is fixed once
//      stored (rows point at it); the type says how the check is made and stays
//      as created: signed_in, author, role (with the role), email_domain (with
//      the suffix). A second public scheme is refused: the shipped one is the
//      "everyone" every select offers. Admin-only (404), production-only (403).
//      Label and message edits go through ./[key] (PUT); removal through its DELETE.
const KEY = /^[a-z0-9_-]{1,40}$/;

export async function GET() {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const rows = await loadAuthzForEditing();
  if (!rows) return NextResponse.json({ error: 'the schemes could not be read' }, { status: 500 });
  return NextResponse.json({ schemes: rows });
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

  let body: { key?: unknown; label?: unknown; type?: unknown; value?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const key = typeof body.key === 'string' ? body.key.trim().toLowerCase() : '';
  if (!KEY.test(key)) {
    return NextResponse.json({ error: 'the key is lower-case letters, digits, dashes and underscores, at most 40' }, { status: 400 });
  }
  if (DEFAULT_AUTHZ_SCHEMES.some(s => s.key === key)) {
    return NextResponse.json({ error: 'that key is one of the shipped schemes' }, { status: 409 });
  }
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label) return NextResponse.json({ error: 'the label cannot be empty' }, { status: 400 });
  if (label.length > AUTHZ_LABEL_MAX) {
    return NextResponse.json({ error: `the label is at most ${AUTHZ_LABEL_MAX} characters` }, { status: 400 });
  }
  if (!isAuthzType(body.type) || body.type === 'public') {
    return NextResponse.json({ error: 'the check must be signed_in, author, role or email_domain' }, { status: 400 });
  }
  const type = body.type;
  let value: string | null = typeof body.value === 'string' ? body.value.trim() : '';
  if (type === 'role') {
    if (!/^[a-z0-9_-]{1,40}$/.test(value)) return NextResponse.json({ error: 'a role check needs the role, lower-case' }, { status: 400 });
  } else if (type === 'email_domain') {
    value = value.toLowerCase();
    if (!/^@?[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) return NextResponse.json({ error: 'an email check needs a domain such as @example.com' }, { status: 400 });
    if (!value.startsWith('@')) value = `@${value}`;
  } else {
    value = null;
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message.length > AUTHZ_MESSAGE_MAX) {
    return NextResponse.json({ error: `the message is at most ${AUTHZ_MESSAGE_MAX} characters` }, { status: 400 });
  }

  try {
    const { data, error } = await betDb()
      .from('authz_scheme')
      .insert({ application_key: AUTHZ_APPLICATION_KEY, key, label, type, value, message: message || null, updated_by: user?.id ?? null })
      .select('key, label, type, value, message, updated_at');
    if (error) {
      if (error.code === '23505' || /duplicate key/i.test(error.message)) {
        return NextResponse.json({ error: 'a scheme with this key exists already', current: await loadAuthzForEditing() }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const row = ((data ?? []) as { updated_at: string }[])[0];
    if (!row) return NextResponse.json({ error: 'the stored row could not be read back' }, { status: 500 });
    resetAuthzMemo();
    return NextResponse.json(
      { ok: true, scheme: { key, label, type, value, message: message || null, updatedAt: String(row.updated_at) } },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
