import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { HOME_PAGE_KEY, parseHomeLayout } from '@/lib/home-layout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST = publish a new home-page layout revision: { blocks: HomeBlock[] }.
// Admin-only; 404 for everyone else (the no-existence-oracle shape the other
// admin routes use — app/api/admin/users/[id]/route.ts:15).
//
// The table is APPEND-ONLY (supabase/migrations/20260824120000_page_layout.sql):
// publishing inserts a new row rather than updating one, so every version the
// home page has ever had stays recoverable and reverting is just publishing an
// older revision's blocks again.
//
// The body is run through parseHomeLayout before it is stored, so what lands in
// the column is already normalised — unknown ids dropped, duplicates collapsed,
// missing blocks appended. The page parses defensively again on read, because
// rows can also be written by hand in SQL.
export async function POST(req: Request) {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }

  let body: { blocks?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!Array.isArray(body.blocks)) {
    return NextResponse.json({ error: 'blocks must be an array' }, { status: 400 });
  }

  const layout = parseHomeLayout(body.blocks);
  const user = await currentUser();

  try {
    const { error } = await betDb().from('page_layout').insert({
      page_key: HOME_PAGE_KEY,
      blocks: layout.blocks,
      published_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // /app is ISR (revalidate = 300). Without this the change would not appear
    // until the window elapsed. revalidatePath only works on prod because of the
    // sharded tag cache wired in open-next.config.ts — it was a silent no-op
    // before 0.255.0, so if a publish ever stops appearing, look there first.
    revalidatePath('/');
    return NextResponse.json({ ok: true, blocks: layout.blocks });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
