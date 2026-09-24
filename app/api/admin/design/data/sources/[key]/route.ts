import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { findSource, parseSourceRef } from '@/lib/design/sources';
import { readSource } from '@/lib/design/source-read';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PREVIEW_ROWS = 50;

// GET /api/admin/design/data/sources/<key>?<parameters> → the preview of a
// source (P2.1; APEX: a REST Data Source's Preview): the parameters read by
// the catalogue's own rule (400 with the problems in words; the season clamp
// among them, so an administrator's pick never sends the Worker upstream for
// a slot the loader has not warmed), then the reader's first fifty rows, the
// total and the provenance. Admin-only (404); an unknown key is 404. The
// reader never throws.
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  const { key } = await params;
  if (!findSource(key)) return new Response('not found', { status: 404 });
  const query = new URL(req.url).searchParams.toString();
  const parsed = parseSourceRef(query ? `${key}?${query}` : key);
  if (!parsed.value) return NextResponse.json({ error: parsed.problems[0] ?? 'the parameters could not be read', problems: parsed.problems }, { status: 400 });
  const read = await readSource(parsed.value, { limit: PREVIEW_ROWS });
  return NextResponse.json({ key, label: read.provenance.label, columns: read.columns, rows: read.rows, total: read.total, provenance: read.provenance });
}
