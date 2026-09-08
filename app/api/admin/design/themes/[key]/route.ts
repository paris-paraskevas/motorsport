import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  THEME_APPLICATION_KEY,
  THEME_KEY,
  THEME_LABEL_MAX,
  contrastProblems,
  isShippedThemeKey,
  loadThemesForEditing,
  parseThemeTokens,
  resetThemesMemo,
} from '@/lib/design/themes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT    /api/admin/design/themes/<key> ← { label?, base?, tokens?, available?, updatedAt }
// DELETE /api/admin/design/themes/<key> ← { updatedAt }
//
// One conditional statement per row on the stamp the caller loaded (409 with the
// current themes when it moved). A shipped theme offers only `available`: its
// colours are the stylesheet's. A theme of the operator's own offers its name,
// base, colours (through the contrast gate) and availability. The default may
// not be hidden or deleted: choose another default first. Admin-only (404),
// production-only (403). The stamp travels verbatim: it carries microseconds a
// JavaScript Date would round away.

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
  if (!THEME_KEY.test(key)) return new Response('not found', { status: 404 });

  let body: { label?: unknown; base?: unknown; tokens?: unknown; available?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return refused(400, 'invalid body');
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) return refused(400, 'updatedAt must be the stamp you loaded');

  const current = await loadThemesForEditing();
  const theme = current?.find(t => t.key === key);
  if (!theme) return new Response('not found', { status: 404 });

  const patch: Record<string, unknown> = {};
  if (body.available !== undefined) {
    if (typeof body.available !== 'boolean') return refused(400, 'available must be true or false');
    if (!body.available && theme.isDefault) return refused(400, 'the default theme must stay available; choose another default first');
    patch.available = body.available;
  }
  if (theme.shipped) {
    if (body.label !== undefined || body.base !== undefined || body.tokens !== undefined) {
      return refused(400, 'a shipped theme keeps its name and colours; only whether it is offered can change');
    }
  } else {
    if (body.label !== undefined) {
      const label = typeof body.label === 'string' ? body.label.trim() : '';
      if (!label) return refused(400, 'the theme needs a name');
      if (label.length > THEME_LABEL_MAX) return refused(400, `the name is at most ${THEME_LABEL_MAX} characters`);
      patch.label = label;
    }
    if (body.base !== undefined) {
      if (!isShippedThemeKey(body.base)) return refused(400, 'the base must be one of the six shipped themes');
      patch.base = body.base;
    }
    if (body.tokens !== undefined) {
      const tokens = parseThemeTokens(body.tokens);
      if (!tokens) return refused(400, 'every colour must be written as #rrggbb');
      const problems = contrastProblems(tokens);
      if (problems.length > 0) {
        return refused(400, `The theme fails the contrast check: ${problems.join('; ')}.`, { problems });
      }
      patch.tokens = tokens;
    }
  }
  if (Object.keys(patch).length === 0) return refused(400, 'nothing to change');

  try {
    const { data, error } = await betDb()
      .from('theme')
      .update({ ...patch, updated_by: g.user?.id ?? null })
      .eq('application_key', THEME_APPLICATION_KEY)
      .eq('key', key)
      .eq('updated_at', body.updatedAt)
      .select('updated_at');
    if (error) return refused(500, error.message);
    const rows = (data ?? []) as { updated_at: string }[];
    if (rows.length === 0) {
      return refused(409, 'This theme was saved again after you loaded it.', { current: await loadThemesForEditing() });
    }
    resetThemesMemo();
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, key, updatedAt: String(rows[0].updated_at) });
  } catch (err) {
    return refused(500, err instanceof Error ? err.message : 'unknown');
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  const g = await gate();
  if (g.fail) return g.fail;
  const { key } = await params;
  if (!THEME_KEY.test(key)) return new Response('not found', { status: 404 });

  let body: { updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return refused(400, 'invalid body');
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) return refused(400, 'updatedAt must be the stamp you loaded');

  const current = await loadThemesForEditing();
  const theme = current?.find(t => t.key === key);
  if (!theme) return new Response('not found', { status: 404 });
  if (theme.shipped) return refused(400, 'the six shipped themes cannot be deleted; hide one instead');
  if (theme.isDefault) return refused(400, 'this theme is the default; choose another default first');

  try {
    const { data, error } = await betDb()
      .from('theme')
      .delete()
      .eq('application_key', THEME_APPLICATION_KEY)
      .eq('key', key)
      .eq('updated_at', body.updatedAt)
      .select('key');
    if (error) return refused(500, error.message);
    const rows = (data ?? []) as { key: string }[];
    if (rows.length === 0) {
      return refused(409, 'This theme was saved again after you loaded it.', { current: await loadThemesForEditing() });
    }
    resetThemesMemo();
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    return refused(500, err instanceof Error ? err.message : 'unknown');
  }
}
