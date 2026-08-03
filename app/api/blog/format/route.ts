import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { canAuthor } from '@/lib/threads';
import { loadAllDrivers, loadAllTeams } from '@/lib/people';
import { loadAllSeriesMeta } from '@/lib/series';
import { slugify } from '@/lib/slug';
import { autoLinkBody, type LinkEntity } from '@/lib/post-ready';
import { BODY_MAX } from '@/lib/blog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST = the studio's Auto-link action: { body } → { body, added[] }. Wraps the
// first mention of every known entity (driver, team, series) in a link to its
// Paddock page — deterministic, insert-only (lib/post-ready), author-gated like
// /api/blog/preview. The result goes back into the editor as UNSAVED changes;
// nothing persists here.

// Entity index, once per process. Order encodes priority for duplicate names:
// drivers first (base-slug entries only — a suffixed duplicate like
// max-verstappen-24h is the lower-priority series' page), then teams, then
// series. autoLinkBody dedupes by name keeping the first.
let entitiesPromise: Promise<LinkEntity[]> | null = null;
function entities(): Promise<LinkEntity[]> {
  entitiesPromise ??= (async () => {
    const [drivers, teams, series] = await Promise.all([
      loadAllDrivers(),
      loadAllTeams(),
      loadAllSeriesMeta(),
    ]);
    return [
      ...drivers
        .filter(d => d.slug === slugify(d.name))
        .map(d => ({ name: d.name, url: `/drivers/${d.slug}` })),
      ...teams.map(t => ({ name: t.name, url: `/teams/${t.slug}` })),
      ...series.map(s => ({ name: s.name, url: `/series/${s.slug}` })),
    ];
  })();
  return entitiesPromise;
}

export async function POST(req: Request) {
  if (!canAuthor(await currentUser())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  let body: { body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const text = typeof body.body === 'string' ? body.body : '';
  if (!text.trim()) return NextResponse.json({ error: 'nothing to link' }, { status: 400 });
  if (text.length > BODY_MAX) return NextResponse.json({ error: 'body too long' }, { status: 422 });

  try {
    const result = autoLinkBody(text, await entities());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
