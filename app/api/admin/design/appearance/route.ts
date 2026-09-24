import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  APPEARANCE_APPLICATION_KEY,
  loadAppearanceForEditing,
  parseAppearance,
  resetAppearanceMemo,
} from '@/lib/design/appearance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/appearance → the stored appearance with the application
// row's stamp, for the designer. Admin-only; 404 for everyone else.
export async function GET() {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const loaded = await loadAppearanceForEditing();
  if (!loaded) return NextResponse.json({ error: 'the appearance could not be read' }, { status: 500 });
  return NextResponse.json(loaded);
}

// PUT /api/admin/design/appearance  ← { appearance, updatedAt }
//
// The one write path for the appearance: the whole document is parsed by the
// same rule the loader uses and refused with every problem the gate found (400)
// before the database is touched; then a single conditional update on the
// application row, refused when its `updated_at` is no longer the stamp the
// caller loaded (409 with what is stored now), so two people editing the same
// screen cannot overwrite each other unknowingly. Admin-only (404),
// production-only (403). The stamp travels verbatim: it carries microseconds a
// JavaScript Date would round away.
export async function PUT(req: Request) {
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

  let body: { appearance?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) {
    return NextResponse.json({ error: 'updatedAt must be the stamp you loaded' }, { status: 400 });
  }
  if (!body.appearance || typeof body.appearance !== 'object') {
    return NextResponse.json({ error: 'appearance must be the document' }, { status: 400 });
  }
  const parsed = parseAppearance(body.appearance);
  if (parsed.problems.length > 0) {
    return NextResponse.json({ error: parsed.problems.join('; '), problems: parsed.problems }, { status: 400 });
  }

  try {
    const { data, error } = await betDb()
      .from('application')
      .update({ ui: parsed.value, updated_by: user?.id ?? null })
      .eq('key', APPEARANCE_APPLICATION_KEY)
      .eq('updated_at', body.updatedAt)
      .select('updated_at');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []) as { updated_at: string }[];
    if (rows.length === 0) {
      const current = await loadAppearanceForEditing();
      return NextResponse.json(
        { error: 'The appearance was saved again after you loaded it.', current },
        { status: 409 },
      );
    }
    resetAppearanceMemo();
    // The style block rides the layout of every page.
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, appearance: parsed.value, updatedAt: String(rows[0].updated_at) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
