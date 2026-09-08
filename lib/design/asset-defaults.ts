// Assets (APEX: Static Application Files): the operator's photos, stored in the
// media bucket with a caption, a credit and a licence, so a page can use one
// later without a licence question. Client-safe: the designer's editor checks a
// file and its words with the same rules the upload route applies, so what the
// editor lets through is what the route accepts.
//
// THE RAILS (field guide, Assets): photos are the operator's own uploads or
// Commons files with the licence read; no CSS or JavaScript uploads, by design;
// the three image kinds only, ten megabytes at most (operator, 2026-09-08).

export const ASSET_MAX_BYTES = 10 * 1024 * 1024;

/** The kinds a photo may be, by the type the bytes prove, with the extension a key carries. */
export const ASSET_TYPES: Record<string, { ext: 'jpg' | 'png' | 'webp'; label: string }> = {
  'image/jpeg': { ext: 'jpg', label: 'JPEG' },
  'image/png': { ext: 'png', label: 'PNG' },
  'image/webp': { ext: 'webp', label: 'WebP' },
};

export const ASSET_CAPTION_MAX = 300;
export const ASSET_CREDIT_MAX = 120;
export const ASSET_LICENCE_MAX = 80;

/** Offered in the licence field; anything else may still be typed. */
export const LICENCE_SUGGESTIONS = [
  'Own work',
  'CC BY 4.0',
  'CC BY-SA 4.0',
  'CC0 1.0',
  'Public domain',
  'Press kit, permission on file',
] as const;

/** A storage key: year, month, a UUID and the proven extension. Never a name. */
export const ASSET_KEY = /^\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export interface AssetMeta {
  caption: string;
  credit: string;
  licence: string;
}

/** The words a photo must carry, trimmed, or the reasons it is refused. A
 *  caption may be empty; a credit and a licence may not. */
export function parseAssetMeta(raw: { caption?: unknown; credit?: unknown; licence?: unknown }): { value: AssetMeta; problems: string[] } {
  const problems: string[] = [];
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const value = { caption: s(raw.caption), credit: s(raw.credit), licence: s(raw.licence) };
  if (value.caption.length > ASSET_CAPTION_MAX) problems.push(`the caption is at most ${ASSET_CAPTION_MAX} characters`);
  if (!value.credit) problems.push('a credit is needed: who took or owns the photo');
  else if (value.credit.length > ASSET_CREDIT_MAX) problems.push(`the credit is at most ${ASSET_CREDIT_MAX} characters`);
  if (!value.licence) problems.push('a licence is needed: under what terms the photo may be shown');
  else if (value.licence.length > ASSET_LICENCE_MAX) problems.push(`the licence is at most ${ASSET_LICENCE_MAX} characters`);
  return { value, problems };
}

/** Why a file is refused before it is read, by what the browser reports; the
 *  route checks the bytes themselves afterwards. */
export function assetFileProblems(file: { type: string; size: number }): string[] {
  const problems: string[] = [];
  if (!(file.type in ASSET_TYPES)) problems.push('only JPEG, PNG and WebP photos are accepted');
  if (file.size <= 0) problems.push('the file is empty');
  else if (file.size > ASSET_MAX_BYTES) problems.push(`the file is over ${formatBytes(ASSET_MAX_BYTES)}`);
  return problems;
}

/** Where a stored photo is served from. Keys never change, so the address is for life. */
export function mediaUrl(key: string): string {
  return `/media/${key}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
