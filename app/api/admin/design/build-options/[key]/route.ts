import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  BUILD_OPTION_APPLICATION_KEY,
  isBuildOptionKey,
  isBuildOptionStatus,
  loadBuildOptionsForEditing,
  resetBuildOptionsMemo,
} from '@/lib/design/build-options';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT /api/admin/design/build-options/<key>  ← { status, updatedAt }
//
// The one write path for a build option: a single conditional update, refused
// when the row's `updated_at` is no longer the stamp the caller loaded (409 with
// the current rows), so two people flipping the same switch cannot overwrite
// each other unknowingly. Admin-only (404), production-only (403). The stamp
// travels verbatim: it carries microseconds a JavaScript Date would round away.
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
  if (!isBuildOptionKey(key)) return new Response('not found', { status: 404 });

  let body: { status?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!isBuildOptionStatus(body.status)) {
    return NextResponse.json({ error: 'status must be include or exclude' }, { status: 400 });
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) {
    return NextResponse.json({ error: 'updatedAt must be the stamp you loaded' }, { status: 400 });
  }

  try {
    const { data, error } = await betDb()
      .from('build_option')
      .update({ status: body.status, updated_by: user?.id ?? null })
      .eq('application_key', BUILD_OPTION_APPLICATION_KEY)
      .eq('key', key)
      .eq('updated_at', body.updatedAt)
      .select('updated_at');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []) as { updated_at: string }[];
    if (rows.length === 0) {
      const current = await loadBuildOptionsForEditing();
      return NextResponse.json(
        { error: 'This option was saved again after you loaded it.', current },
        { status: 409 },
      );
    }
    resetBuildOptionsMemo();
    // The session page renders on every request, so the memo reset is all the
    // ghost lap needs. The weekend page is cached for five minutes: mark it for
    // a fresh render on its next visit. From a Route Handler, revalidatePath with
    // a route pattern renders nothing here and now; each weekend page is rebuilt
    // when it is next asked for.
    if (key === 'weather') revalidatePath('/series/[slug]/weekend/[round]', 'page');
    return NextResponse.json({ ok: true, key, status: body.status, updatedAt: String(rows[0].updated_at) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
