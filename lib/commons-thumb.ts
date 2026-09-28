// A Wikimedia Commons picture at the size a box needs (R13 PR C, the SEO check of 2026-09-27: the home weighed 19 MB because
// the posts' covers were Commons originals, a 12 MB file drawn 560 px wide). Commons renders resized copies under
// /thumb/<a>/<ab>/<File>/<width>px-<File>, but only at bucketed widths: 120, 250, 330, 500, 960, 1280 and 1920 answer 200 for
// our files; 320, 640, 800, 1000, 1024, 1500, 1600, 2000 and 2560 answer 400 "Use thumbnail sizes listed on
// https://w.wiki/GHai" (probed 2026-08-20 for the drivers' portraits and 2026-09-28 for the covers). A bucket wider than the
// original answers 200 with the file as it is, so a narrow picture cannot break. The drivers page carried this rule alone from
// 2026-08-20; the covers, the thumbnails, the cards and the tables read it here.

/** The widths the service renders that a box of ours needs (330 exists and has no site). */
export type CommonsWidth = 120 | 250 | 500 | 960 | 1280 | 1920;

// A Commons original: /wikipedia/commons/<a>/<ab>/<File>, JPG, JPEG or PNG, with or without a query string (the covers carry
// Commons' own ?utm_source=…). An existing thumb: /thumb/<a>/<ab>/<File>/<n>px-<File>, whatever its width.
const ORIGINAL = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+\.(?:jpg|jpeg|png))(?:[?#].*)?$/i;
const THUMB = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+\.(?:jpg|jpeg|png))\/\d+px-[^/?#]+(?:[?#].*)?$/i;

/** The picture at one of the widths the service renders: an original or an existing thumb becomes the bucket's thumb, the
 *  query dropped; any other address (another host, an SVG, a page) returns as it is, so an unexpected src can never 404. */
export function commonsThumb(src: string, width: CommonsWidth): string {
  const m = ORIGINAL.exec(src) ?? THUMB.exec(src);
  if (!m) return src;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/${width}px-${m[3]}`;
}

/** A `srcset` over several widths for the browser's own choice, `''` for an address the rule leaves alone (the attribute is
 *  then omitted, and `sizes` with it). */
export function commonsSrcSet(src: string, widths: readonly CommonsWidth[]): string {
  if (!ORIGINAL.test(src) && !THUMB.test(src)) return '';
  return widths.map(w => `${commonsThumb(src, w)} ${w}w`).join(', ');
}
