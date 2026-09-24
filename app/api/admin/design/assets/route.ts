import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import {
  ASSET_APPLICATION_KEY,
  ASSET_COLUMNS,
  ASSET_MAX_BYTES,
  assetFromRow,
  formatBytes,
  getMediaBucket,
  loadAssetsForEditing,
  newAssetKey,
  parseAssetMeta,
} from '@/lib/design/assets';
import { sniffImage } from '@/lib/design/image-size';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET  /api/admin/design/assets → { assets, mediaConfigured } every row, newest first.
// POST /api/admin/design/assets ← multipart: file, caption, credit, licence → 201 { asset }
//
// The upload path, the one way a photo enters the site. The words are checked
// first (a credit and a licence are required), then the size against the cap,
// then the bytes themselves: the file must prove itself a JPEG, a PNG or a WebP
// by its header, whatever the browser declared, and its width and height come
// from the same header. The file is stored under a generated key, then the row is
// written; if the row fails the file is removed again, so the bucket never holds
// a photo no row knows. Admin-only (404), production-only (403); 503 when this
// Worker has no media binding. No page is revalidated: nothing places a photo yet.
export async function GET() {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const assets = await loadAssetsForEditing();
  if (!assets) return NextResponse.json({ error: 'the assets could not be read' }, { status: 500 });
  return NextResponse.json({ assets, mediaConfigured: getMediaBucket() !== null });
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
  const bucket = getMediaBucket();
  if (!bucket) {
    return NextResponse.json({ error: 'the media store is not bound on this copy of the site' }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'the upload must be a multipart form with a file' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'a file is needed' }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ error: 'the file is empty' }, { status: 400 });
  if (file.size > ASSET_MAX_BYTES) {
    return NextResponse.json({ error: `the file is over ${formatBytes(ASSET_MAX_BYTES)}` }, { status: 400 });
  }
  const meta = parseAssetMeta({ caption: form.get('caption'), credit: form.get('credit'), licence: form.get('licence') });
  if (meta.problems.length > 0) {
    return NextResponse.json({ error: meta.problems.join('; '), problems: meta.problems }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = sniffImage(bytes);
  if (!info) return NextResponse.json({ error: 'the file is not a JPEG, PNG or WebP image' }, { status: 400 });

  const key = newAssetKey(info.type);
  try {
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: info.type, cacheControl: 'public, max-age=31536000, immutable' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `the file could not be stored: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 500 },
    );
  }

  try {
    const { data, error } = await betDb()
      .from('asset')
      .insert({
        application_key: ASSET_APPLICATION_KEY,
        r2_key: key,
        kind: 'image',
        caption: meta.value.caption || null,
        credit: meta.value.credit,
        licence: meta.value.licence,
        width: info.width,
        height: info.height,
        bytes: bytes.length,
        content_type: info.type,
        updated_by: user?.id ?? null,
      })
      .select(ASSET_COLUMNS)
      .single();
    if (error) {
      await bucket.delete(key).catch(() => undefined);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const asset = assetFromRow(data);
    if (!asset) return NextResponse.json({ error: 'the stored row could not be read back' }, { status: 500 });
    return NextResponse.json({ ok: true, asset }, { status: 201 });
  } catch (err) {
    await bucket.delete(key).catch(() => undefined);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
