import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  THEME_APPLICATION_KEY,
  THEME_LABEL_MAX,
  contrastProblems,
  isShippedThemeKey,
  loadThemesForEditing,
  parseThemeTokens,
  resetThemesMemo,
  shippedTheme,
  themeKeyFromLabel,
  type EditableTheme,
} from '@/lib/design/themes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET  /api/admin/design/themes → { themes } every theme with its row's stamp.
// POST /api/admin/design/themes ← { label, base, tokens, available? } → 201 { theme }
//
// The POST creates a theme of the operator's own: a shipped theme as its base
// and nine colours, refused before the database when a colour is not #rrggbb or
// the contrast gate fails (text on the page, muted on a card, faint on a raised
// panel at 4.5:1, the accent at 3:1). The key comes from the name and is never a
// shipped one; a name already in use is a 409. Admin-only (404), production-only
// (403). Changing the default is ./default/route.ts; editing and deleting a
// theme is ./[key]/route.ts.
export async function GET() {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const rows = await loadThemesForEditing();
  if (!rows) return NextResponse.json({ error: 'the themes could not be read' }, { status: 500 });
  return NextResponse.json({ themes: rows });
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

  let body: { label?: unknown; base?: unknown; tokens?: unknown; available?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label) return NextResponse.json({ error: 'the theme needs a name' }, { status: 400 });
  if (label.length > THEME_LABEL_MAX) {
    return NextResponse.json({ error: `the name is at most ${THEME_LABEL_MAX} characters` }, { status: 400 });
  }
  const key = themeKeyFromLabel(label);
  if (!key) return NextResponse.json({ error: 'the name needs a letter or a digit' }, { status: 400 });
  if (!isShippedThemeKey(body.base)) {
    return NextResponse.json({ error: 'the base must be one of the six shipped themes' }, { status: 400 });
  }
  const tokens = parseThemeTokens(body.tokens);
  if (!tokens) return NextResponse.json({ error: 'every colour must be written as #rrggbb' }, { status: 400 });
  const problems = contrastProblems(tokens);
  if (problems.length > 0) {
    return NextResponse.json({ error: `The theme fails the contrast check: ${problems.join('; ')}.`, problems }, { status: 400 });
  }
  const available = body.available !== false;

  const current = await loadThemesForEditing();
  if (current?.some(t => t.key === key)) {
    return NextResponse.json({ error: `A theme named “${label}” exists already.`, current }, { status: 409 });
  }

  try {
    const { data, error } = await betDb()
      .from('theme')
      .insert({
        application_key: THEME_APPLICATION_KEY,
        key,
        label,
        base: body.base,
        tokens,
        available,
        is_default: false,
        updated_by: user?.id ?? null,
      })
      .select('updated_at')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `A theme named “${label}” exists already.`, current }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    resetThemesMemo();
    revalidatePath('/', 'layout');
    const base = shippedTheme(body.base);
    const theme: EditableTheme = {
      key,
      label,
      hint: `On ${base.label}`,
      family: base.family,
      base: base.key,
      tokens,
      available,
      isDefault: false,
      shipped: false,
      updatedAt: String((data as { updated_at: string }).updated_at),
    };
    return NextResponse.json({ ok: true, theme }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
