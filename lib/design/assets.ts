import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { ASSET_KEY, ASSET_TYPES, mediaUrl } from './asset-defaults';

export {
  ASSET_CAPTION_MAX,
  ASSET_CREDIT_MAX,
  ASSET_KEY,
  ASSET_LICENCE_MAX,
  ASSET_MAX_BYTES,
  ASSET_TYPES,
  LICENCE_SUGGESTIONS,
  assetFileProblems,
  formatBytes,
  mediaUrl,
  parseAssetMeta,
} from './asset-defaults';
export type { AssetMeta } from './asset-defaults';

// Assets (APEX: Static Application Files), the `asset` rows for this application
// and the media bucket their files live in. Phase 2 step 10 of the designer
// plan. No migration: the table exists since 20260908090000 and nothing is
// seeded, because the photos are the operator's.
//
// THE RULE THIS FILE ENFORCES: a row the parser cannot use (a key outside the
// rule, no stamp) is left out rather than guessed at, and any failure reads as
// no assets. Nothing renders an asset until Phase 3 places photos on pages, so
// there is no site-facing loader yet, only the editor's view.
//
// Writes go through app/api/admin/design/assets/* only: the upload route puts
// the file and inserts the row (and removes the file again if the row fails);
// caption, credit and licence change by one conditional update on the stamp;
// a deletion removes the row on the stamp first, then the file.

const APPLICATION_KEY = 'paddock';

/** The three bucket methods the routes use, typed structurally: the repo carries
 *  no Cloudflare type package, and this is all the binding is asked to do. */
export interface MediaBucket {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream | null; httpMetadata?: { contentType?: string }; httpEtag?: string; size?: number } | null>;
  delete(key: string): Promise<void>;
}

/** The `MEDIA` binding (wrangler.jsonc, bucket paddock-media), or null when this
 *  process has none: `next dev` without the Cloudflare context, a test, a Worker
 *  whose config lacks the binding. The routes answer 503 in that case; nothing
 *  falls back to another store. */
export function getMediaBucket(): MediaBucket | null {
  try {
    const env = getCloudflareContext().env as unknown as Record<string, unknown>;
    const bucket = env.MEDIA;
    return bucket && typeof bucket === 'object' && typeof (bucket as MediaBucket).put === 'function' ? (bucket as MediaBucket) : null;
  } catch {
    return null;
  }
}

/** A storage key for a new photo: year, month, a UUID and the proven extension. */
export function newAssetKey(type: keyof typeof ASSET_TYPES, now = new Date(), uuid = crypto.randomUUID()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/${uuid}.${ASSET_TYPES[type].ext}`;
}

/** A photo as the editor sees it: the row, its address, and the row's stamp
 *  exactly as PostgREST sent it (microseconds intact). */
export interface EditableAsset {
  id: string;
  key: string;
  url: string;
  caption: string;
  credit: string;
  licence: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  contentType: string | null;
  createdAt: string;
  updatedAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isAssetId(id: unknown): id is string {
  return typeof id === 'string' && UUID.test(id);
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Coerce one row, or null when it cannot be used. */
export function assetFromRow(item: unknown): EditableAsset | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  if (!isAssetId(row.id) || typeof row.r2_key !== 'string' || !ASSET_KEY.test(row.r2_key)) return null;
  if (row.updated_at == null || row.created_at == null) return null;
  return {
    id: row.id,
    key: row.r2_key,
    url: mediaUrl(row.r2_key),
    caption: str(row.caption),
    credit: str(row.credit),
    licence: str(row.licence),
    width: num(row.width),
    height: num(row.height),
    bytes: num(row.bytes),
    contentType: typeof row.content_type === 'string' ? row.content_type : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const ASSET_COLUMNS = 'id, r2_key, caption, credit, licence, width, height, bytes, content_type, created_at, updated_at';

/** Every usable row, newest first. Null on any failure; empty when there are none. */
export async function loadAssetsForEditing(): Promise<EditableAsset[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb().from('asset').select(ASSET_COLUMNS).eq('application_key', APPLICATION_KEY);
    if (error) return null;
    const out: EditableAsset[] = [];
    for (const item of (data ?? []) as unknown[]) {
      const a = assetFromRow(item);
      if (a) out.push(a);
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return out;
  } catch {
    return null;
  }
}

export { APPLICATION_KEY as ASSET_APPLICATION_KEY };
