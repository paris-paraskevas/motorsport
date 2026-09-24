import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  ASSET_APPLICATION_KEY,
  ASSET_COLUMNS,
  assetFromRow,
  getMediaBucket,
  isAssetId,
  loadAssetsForEditing,
  parseAssetMeta,
} from '@/lib/design/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT    /api/admin/design/assets/<id> ← { caption, credit, licence, updatedAt }
// DELETE /api/admin/design/assets/<id> ← { updatedAt }
//
// The words of a photo change by one conditional update on the stamp the caller
// loaded (409 with the current list when it moved); the file and its key never
// change. A deletion removes the row on the stamp first, then the file: a row
// that outlives its file would be a broken picture, a file that outlives its row
// is only bytes, and the response says whether the file went. Admin-only (404),
// production-only (403). The stamp travels verbatim: it carries microseconds a
// JavaScript Date would round away. No page is revalidated: nothing places a
// photo until Phase 3.

function refused(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

type Gate =
  | { fail: Response; user?: undefined }
  | { fail: null; user: Awaited<ReturnType<typeof currentAccount>> };

async function gate(): Promise<Gate> {
  const user = await currentAccount();
  if (!isAdmin(user)) return { fail: new Response('not found', { status: 404 }) };
  if (!isProductionWorker()) {
    return { fail: refused(403, 'Design edits are made on production; this copy of the site is read-only.') };
  }
  if (!isBettingConfigured()) return { fail: refused(503, 'database not configured') };
  return { fail: null, user };
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const g = await gate();
  if (g.fail) return g.fail;
  const { id } = await params;
  if (!isAssetId(id)) return new Response('not found', { status: 404 });

  let body: { caption?: unknown; credit?: unknown; licence?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return refused(400, 'invalid body');
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) return refused(400, 'updatedAt must be the stamp you loaded');
  const meta = parseAssetMeta(body);
  if (meta.problems.length > 0) return refused(400, meta.problems.join('; '), { problems: meta.problems });

  try {
    const { data, error } = await betDb()
      .from('asset')
      .update({
        caption: meta.value.caption || null,
        credit: meta.value.credit,
        licence: meta.value.licence,
        updated_by: g.user?.id ?? null,
      })
      .eq('application_key', ASSET_APPLICATION_KEY)
      .eq('id', id)
      .eq('updated_at', body.updatedAt)
      .select(ASSET_COLUMNS);
    if (error) return refused(500, error.message);
    const rows = (data ?? []) as unknown[];
    if (rows.length === 0) {
      return refused(409, 'This photo was saved again after you loaded it.', { current: await loadAssetsForEditing() });
    }
    const asset = assetFromRow(rows[0]);
    if (!asset) return refused(500, 'the stored row could not be read back');
    return NextResponse.json({ ok: true, asset });
  } catch (err) {
    return refused(500, err instanceof Error ? err.message : 'unknown');
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const g = await gate();
  if (g.fail) return g.fail;
  const { id } = await params;
  if (!isAssetId(id)) return new Response('not found', { status: 404 });

  let body: { updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return refused(400, 'invalid body');
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt) return refused(400, 'updatedAt must be the stamp you loaded');

  try {
    const { data, error } = await betDb()
      .from('asset')
      .delete()
      .eq('application_key', ASSET_APPLICATION_KEY)
      .eq('id', id)
      .eq('updated_at', body.updatedAt)
      .select('r2_key');
    if (error) return refused(500, error.message);
    const rows = (data ?? []) as { r2_key: string }[];
    if (rows.length === 0) {
      return refused(409, 'This photo was saved again after you loaded it.', { current: await loadAssetsForEditing() });
    }
    let fileRemoved = false;
    const bucket = getMediaBucket();
    if (bucket) {
      try {
        await bucket.delete(rows[0].r2_key);
        fileRemoved = true;
      } catch {
        fileRemoved = false;
      }
    }
    return NextResponse.json({ ok: true, id, key: rows[0].r2_key, fileRemoved });
  } catch (err) {
    return refused(500, err instanceof Error ? err.message : 'unknown');
  }
}
