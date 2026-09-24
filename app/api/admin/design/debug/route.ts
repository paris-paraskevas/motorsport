import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { levelFromKey, levelFromParam, newCid } from '@/lib/design/debug';
import { tracePage } from '@/lib/design/debug-trace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/debug?path=/history/monza&level=app → the Debug trace
//     of that page's render for the caller (P1.9; APEX: View Debug). `rev=<id>`
//     traces a revision preview instead. `level` is the toolbar's name (info ·
//     app · full) or APEX's URL value (YES · LEVEL4 · LEVEL6 · LEVEL9); Info
//     when neither reads. Admin-only (404); a path no page answers is 404 too,
//     which is the allow-list: only the site's own pages are traced. The trace
//     runs the pipeline again for the caller; the cached page visitors get is
//     untouched.

export async function GET(req: Request) {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  const url = new URL(req.url);
  const levelParam = url.searchParams.get('level');
  // Absent: Info, as APEX starts. Named but unknown: refused, never a silent Info.
  const level = levelParam === null || levelParam === '' ? 4 : levelFromKey(levelParam) || levelFromParam(levelParam);
  if (level === 0) return NextResponse.json({ error: 'level must be info, app, full, or YES, LEVEL4, LEVEL6, LEVEL9' }, { status: 400 });
  const path = url.searchParams.get('path');
  const rev = url.searchParams.get('rev');
  const cid = newCid(req.headers.get('cf-ray'));
  const target = rev && /^[0-9a-f-]{36}$/.test(rev) ? { revisionId: rev } : path && path.startsWith('/') ? { path } : null;
  if (!target) return NextResponse.json({ error: 'name a path or a revision' }, { status: 400 });
  const report = await tracePage(target, level, cid);
  if (!report) return NextResponse.json({ error: 'no page there' }, { status: 404 });
  return NextResponse.json(report);
}
