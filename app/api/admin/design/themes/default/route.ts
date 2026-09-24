import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { THEME_APPLICATION_KEY, THEME_KEY, loadThemesForEditing, resetThemesMemo } from '@/lib/design/themes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT /api/admin/design/themes/default ← { key, updatedAt }
//
// The one way to change which theme a visitor gets before choosing. The table
// allows one default per application, so clearing the old and setting the new
// must be one transaction: the database function design_set_default_theme()
// does both and checks the version the caller loaded, the current default's
// `updated_at` (null when the table has no default yet), raising `stale` when it
// moved (409 with the current themes). An unavailable or unknown theme is
// refused by the function too (400). Admin-only (404), production-only (403).
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

  let body: { key?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (typeof body.key !== 'string' || !THEME_KEY.test(body.key)) {
    return NextResponse.json({ error: 'key must name a theme' }, { status: 400 });
  }
  if (body.updatedAt !== null && (typeof body.updatedAt !== 'string' || !body.updatedAt)) {
    return NextResponse.json({ error: 'updatedAt must be the current default’s stamp, or null when there is none' }, { status: 400 });
  }

  try {
    const { data, error } = await betDb().rpc('design_set_default_theme', {
      p_application: THEME_APPLICATION_KEY,
      p_key: body.key,
      p_expected: body.updatedAt,
      p_actor: user?.id ?? null,
    });
    if (error) {
      if (/stale/i.test(error.message)) {
        return NextResponse.json(
          { error: 'The default was changed again after you loaded it.', current: await loadThemesForEditing() },
          { status: 409 },
        );
      }
      if (/unknown or unavailable/i.test(error.message)) {
        return NextResponse.json({ error: 'the default must be a theme that is offered to visitors' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    resetThemesMemo();
    // Every page carries the default on its <html>; the pre-paint script and the
    // address-bar colour follow it too.
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, key: body.key, updatedAt: String(data) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
