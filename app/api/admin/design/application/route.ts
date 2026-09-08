import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { APPLICATION_KEY, definitionToRow, loadApplicationForEditing, parseDefinition, resetApplicationMemo } from '@/lib/design/application';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/application → the application definition with the row's
//     stamp, for the designer's Application Definition editor. Admin-only (404).
export async function GET() {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const loaded = await loadApplicationForEditing();
  if (!loaded) return NextResponse.json({ error: 'the application row could not be read' }, { status: 500 });
  return NextResponse.json(loaded);
}

// PUT /api/admin/design/application ← { definition, updatedAt }
//
// The one write path for the definition: parsed by the loader's rule and
// refused with every problem (400) before the database is touched; then one
// conditional update on the application row, refused when its `updated_at` is
// no longer the stamp the caller loaded (409 with what is stored now). The
// alias and the home path are never written (the code's). Admin-only (404),
// production-only (403). The layout is revalidated: the shell reads the row.
export async function PUT(req: Request) {
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

  let body: { definition?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) {
    return NextResponse.json({ error: 'updatedAt must be the stamp you loaded' }, { status: 400 });
  }
  if (!body.definition || typeof body.definition !== 'object') {
    return NextResponse.json({ error: 'definition must be the document' }, { status: 400 });
  }
  const parsed = parseDefinition(body.definition);
  if (parsed.problems.length > 0) {
    return NextResponse.json({ error: parsed.problems.join('; '), problems: parsed.problems }, { status: 400 });
  }

  try {
    const { data, error } = await betDb()
      .from('application')
      .update({ ...definitionToRow(parsed.value), updated_by: user?.id ?? null })
      .eq('key', APPLICATION_KEY)
      .eq('updated_at', body.updatedAt)
      .select('updated_at');
    if (error) {
      if (error.code === '23503' || /foreign key/i.test(error.message)) {
        return NextResponse.json({ error: 'The favicon must be one of your photos.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as { updated_at: string }[];
    if (rows.length === 0) {
      const current = await loadApplicationForEditing();
      return NextResponse.json({ error: 'The definition was saved again after you loaded it.', current }, { status: 409 });
    }
    resetApplicationMemo();
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, definition: parsed.value, updatedAt: String(rows[0].updated_at) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}
