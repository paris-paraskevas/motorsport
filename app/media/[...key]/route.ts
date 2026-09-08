import { ASSET_KEY } from '@/lib/design/asset-defaults';
import { getMediaBucket } from '@/lib/design/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /media/<yyyy>/<mm>/<uuid>.<ext> → the photo, streamed from the media bucket.
//
// The one address a stored photo has (lib/design/asset-defaults.ts `mediaUrl`).
// Keys never change and carry a UUID, so the response is cacheable for a year and
// immutable; the browser and any cache in front keep it. Anything that is not a
// key in the rule's shape is 404 before the bucket is asked. The middleware skips
// these paths by their image extension, so no sign-in check runs here. A public
// bucket domain can take this route's place later without touching the rows.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }): Promise<Response> {
  const { key } = await params;
  const k = Array.isArray(key) ? key.join('/') : '';
  if (!ASSET_KEY.test(k)) return new Response('not found', { status: 404 });
  const bucket = getMediaBucket();
  if (!bucket) return new Response('media store not configured', { status: 503 });
  const object = await bucket.get(k);
  if (!object || !object.body) return new Response('not found', { status: 404 });
  const headers = new Headers({
    'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  });
  if (object.httpEtag) headers.set('etag', object.httpEtag);
  if (typeof object.size === 'number') headers.set('content-length', String(object.size));
  return new Response(object.body, { headers });
}
