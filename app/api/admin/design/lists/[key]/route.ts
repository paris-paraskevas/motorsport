import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { resolveDestination, type NavEntry } from '@/lib/design/destinations';
import { APPLICATION_KEY, BAR_MAX, BAR_MIN, loadListForEditing, resetNavListsMemo } from '@/lib/design/lists';
import { loadAuthzSchemes } from '@/lib/design/authz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The one route that reads and writes a navigation list for the designer.
//
// GET  /api/admin/design/lists/<key>  → { key, role, label, updatedAt, entries }
// PUT  /api/admin/design/lists/<key>  ← { entries: NavEntry[], updatedAt }
//
// Admin-only; 404 for everyone else (the no-existence-oracle shape of the other
// admin routes). Writes are production-only (lib/env.ts): the three Workers share
// one database. `updatedAt` is the stamp the GET returned, passed back verbatim;
// the database function design_save_list() refuses the save when the list has
// moved since (409), and the designer offers Reload or Save anyway with the
// current stamp. Every entry's destination must be a catalogue key; a typed URL
// cannot enter the table through here. An entry's authorization must name a
// scheme row (lib/design/authz.ts). The phone bar takes three to five entries.

const LABEL_MAX = 60;
const NAME_MAX = 40;

type Rejection = { error: string };

function validateEntries(raw: unknown, role: string, schemeKeys: ReadonlySet<string>): NavEntry[] | Rejection {
  if (!Array.isArray(raw)) return { error: 'entries must be an array' };
  const out: NavEntry[] = [];
  for (const [i, item] of raw.entries()) {
    if (!item || typeof item !== 'object') return { error: `entry ${i + 1} is not an object` };
    const r = item as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label.trim() : '';
    if (!label) return { error: `entry ${i + 1} needs a label` };
    if (label.length > LABEL_MAX) return { error: `entry ${i + 1}: labels are at most ${LABEL_MAX} characters` };
    const dest = typeof r.dest === 'string' ? r.dest.trim() : '';
    if (!dest || !resolveDestination(dest)) return { error: `entry ${i + 1}: "${dest}" is not a destination in the catalogue` };
    const entry: NavEntry = { label, dest };
    if (r.icon !== undefined && r.icon !== null && r.icon !== '') {
      if (typeof r.icon !== 'string' || r.icon.length > NAME_MAX) return { error: `entry ${i + 1}: icon must be a short name` };
      entry.icon = r.icon;
    }
    if (r.authz !== undefined && r.authz !== null && r.authz !== '') {
      if (typeof r.authz !== 'string' || r.authz.length > NAME_MAX || !schemeKeys.has(r.authz)) {
        return { error: `entry ${i + 1}: "${String(r.authz)}" is not an authorization scheme` };
      }
      entry.authz = r.authz;
    }
    out.push(entry);
  }
  if (role === 'bar' && (out.length < BAR_MIN || out.length > BAR_MAX)) {
    return { error: `the phone bar takes ${BAR_MIN} to ${BAR_MAX} entries` };
  }
  if (out.length === 0) return { error: 'a list needs at least one entry' };
  return out;
}

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const { key } = await params;
  const list = await loadListForEditing(key);
  if (!list) return new Response('not found', { status: 404 });
  return NextResponse.json(list);
}

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

  let body: { entries?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) {
    return NextResponse.json({ error: 'updatedAt must be the stamp you loaded' }, { status: 400 });
  }

  const list = await loadListForEditing(key);
  if (!list) return new Response('not found', { status: 404 });

  const schemes = await loadAuthzSchemes();
  const entries = validateEntries(body.entries, list.role, new Set(schemes.map(s => s.key)));
  if (!Array.isArray(entries)) return NextResponse.json(entries, { status: 400 });

  try {
    const { data, error } = await betDb().rpc('design_save_list', {
      p_application: APPLICATION_KEY,
      p_key: key,
      p_expected: body.updatedAt,
      p_entries: entries.map(e => ({
        label: e.label,
        dest_key: e.dest,
        icon: e.icon ?? null,
        authz_key: e.authz ?? null,
      })),
      p_actor: user?.id ?? null,
    });
    if (error) {
      if (/stale/i.test(error.message)) {
        const current = await loadListForEditing(key);
        return NextResponse.json(
          { error: 'This list was saved again after you loaded it.', current },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    resetNavListsMemo();
    // The navigation renders inside the layout of every page, so every cached
    // page is told to re-render. Other isolates keep their memo for up to a minute.
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, updatedAt: String(data), entries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
