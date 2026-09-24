import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { listSeriesSlugs } from '@/lib/series';
import {
  SETTING_APPLICATION_KEY,
  SETTING_SPECS,
  isSettingKey,
  loadSettingsForEditing,
  parseSettingValue,
  resetSettingsMemo,
  serialiseSettingValue,
  settingValueRule,
} from '@/lib/design/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT /api/admin/design/settings/<key>  ← { value, updatedAt }
//
// The one write path for an application setting: the value is checked against
// the key's rule before the database is touched (400 with the rule), then a
// single conditional update, refused when the row's `updated_at` is no longer
// the stamp the caller loaded (409 with the current rows), so two people
// editing the same setting cannot overwrite each other unknowingly. Admin-only
// (404), production-only (403). The stamp travels verbatim: it carries
// microseconds a JavaScript Date would round away.
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
  if (!isSettingKey(key)) return new Response('not found', { status: 404 });

  let body: { value?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) {
    return NextResponse.json({ error: 'updatedAt must be the stamp you loaded' }, { status: 400 });
  }
  // The two series controls are checked against the championships that exist;
  // the other controls carry their bounds in the spec.
  const kind = SETTING_SPECS[key].control.kind;
  const seriesSlugs = kind === 'series' || kind === 'series-set' ? await listSeriesSlugs() : undefined;
  const value = parseSettingValue(key, body.value, { seriesSlugs });
  if (value === undefined) {
    return NextResponse.json({ error: `${SETTING_SPECS[key].label} ${settingValueRule(key)}` }, { status: 400 });
  }

  try {
    const { data, error } = await betDb()
      .from('setting')
      .update({ value: serialiseSettingValue(key, value), updated_by: user?.id ?? null })
      .eq('application_key', SETTING_APPLICATION_KEY)
      .eq('key', key)
      .eq('updated_at', body.updatedAt)
      .select('updated_at');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []) as { updated_at: string }[];
    if (rows.length === 0) {
      const current = await loadSettingsForEditing();
      return NextResponse.json(
        { error: 'This setting was saved again after you loaded it.', current },
        { status: 409 },
      );
    }
    resetSettingsMemo();
    // The home page reads four of these and is cached for five minutes; the
    // notice rides the layout of every page. One nudge covers both.
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, key, value, updatedAt: String(rows[0].updated_at) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
