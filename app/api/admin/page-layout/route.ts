import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { HOME_PAGE_KEY, parseHomeLayout } from '@/lib/home-layout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST = save a home-page layout revision:
//   { blocks: HomeBlock[], action: 'draft' | 'publish', base?: string | null }
// Admin-only; 404 for everyone else (the no-existence-oracle shape the other
// admin routes use — app/api/admin/users/[id]/route.ts:15). Production-only;
// 403 on a preview Worker (lib/env.ts): the three Workers share one database,
// so a publish from testing. or paris. would change the live home page.
//
// The table is APPEND-ONLY (supabase/migrations/20260824120000_page_layout.sql):
// a draft is a new row with published_at null, a publish is a new row with
// published_at set, and nothing is ever updated in place, so every version the
// home page has ever had stays recoverable and reverting is just publishing an
// older revision's blocks again.
//
// THE VERSION CHECK (Phase 1 of the designer plan, the 1.0.25 studio pattern):
// a publish carries `base`, the id of the live revision the composer loaded, or
// null when nothing was live. If the live revision has moved since, the publish
// is refused with 409 and the current live id, and the composer offers Reload or
// Publish anyway, which resends with that id. page_layout has no updated_at; the
// live row's id is the version.
//
// The body is run through parseHomeLayout before it is stored, so what lands in
// the column is already normalised — unknown ids dropped, duplicates collapsed,
// missing blocks appended. The page parses defensively again on read, because
// rows can also be written by hand in SQL.
export async function POST(req: Request) {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  if (!isProductionWorker()) {
    return NextResponse.json(
      { error: 'Design edits are made on production; this copy of the site is read-only.' },
      { status: 403 },
    );
  }
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }

  let body: { blocks?: unknown; action?: unknown; base?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!Array.isArray(body.blocks)) {
    return NextResponse.json({ error: 'blocks must be an array' }, { status: 400 });
  }
  const action = body.action === 'draft' || body.action === 'publish' ? body.action : null;
  if (!action) {
    return NextResponse.json({ error: "action must be 'draft' or 'publish'" }, { status: 400 });
  }
  const base = body.base === undefined ? null : body.base;
  if (action === 'publish' && base !== null && typeof base !== 'string') {
    return NextResponse.json(
      { error: 'base must be the id of the live revision you loaded, or null' },
      { status: 400 },
    );
  }

  const layout = parseHomeLayout(body.blocks);
  const user = await currentUser();

  try {
    if (action === 'publish') {
      const { data: live, error: liveError } = await betDb()
        .from('page_layout')
        .select('id, published_at')
        .eq('page_key', HOME_PAGE_KEY)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      // Not fail-soft on purpose: a version check that cannot read the version
      // must refuse, not wave the publish through.
      if (liveError) return NextResponse.json({ error: liveError.message }, { status: 500 });
      const liveId = live ? String(live.id) : null;
      if (liveId !== base) {
        return NextResponse.json(
          {
            error: 'The home page was published again after you loaded it.',
            live: live ? { id: liveId, publishedAt: live.published_at } : null,
          },
          { status: 409 },
        );
      }
    }

    const now = new Date().toISOString();
    const { data, error } = await betDb()
      .from('page_layout')
      .insert({
        page_key: HOME_PAGE_KEY,
        blocks: layout.blocks,
        published_at: action === 'publish' ? now : null,
        created_by: user?.id ?? null,
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // /app is ISR (revalidate = 300). Without this a publish would not appear
    // until the window elapsed. revalidatePath only works on prod because of the
    // sharded tag cache wired in open-next.config.ts — it was a silent no-op
    // before 0.255.0, so if a publish ever stops appearing, look there first.
    // A draft changes nothing a visitor sees, so it does not revalidate.
    if (action === 'publish') revalidatePath('/');
    return NextResponse.json({
      ok: true,
      action,
      id: data ? String(data.id) : null,
      at: now,
      blocks: layout.blocks,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
