// Cache-Control for browsers, on top of what OpenNext emits.
//
// OpenNext hard-codes `s-maxage=<ttl>, stale-while-revalidate=2592000` on every
// ISR page and RSC payload (@opennextjs/aws core/routing/util.js and
// cacheInterceptor.js). There is no max-age, so a browser treats its copy as
// stale at once, and stale-while-revalidate then lets it REUSE that stale copy
// for thirty days while it revalidates in the background. After a deploy, a
// returning visitor's browser answers a client-side navigation from a payload of
// the previous build, whose stylesheet and script chunk names no longer exist,
// and shows the previous build's content until the next navigation. Prod logged
// `Refused to apply style from …/0ej-ohiw8omjz.css because its MIME type
// ('text/html')` on /series/f1/standings all day on 2026-09-07; the chunk was a
// /blog stylesheet from an earlier build, named by a prefetched /blog payload
// that the browser had served from its own cache.
//
// A page rendered for the first time carries Next's own version of the same
// shape, `s-maxage=<ttl>, stale-while-revalidate=31534800` (a year less the
// ttl, from Next's default expireTime), so the rule keys on the SHAPE: an ISR
// header has s-maxage and stale-while-revalidate and no max-age. Anything with
// an explicit max-age was decided by someone and is left alone.
//
// Vercel's default for the same pages is `public, max-age=0, must-revalidate`:
// a browser may keep a copy but must ask before using it. This restores that
// for browsers and keeps s-maxage for any shared cache that may sit in front.
// Only HTML and RSC payloads are touched; static assets carry their own headers
// and dynamic pages carry no stale-while-revalidate to begin with.
const SWR = /,?\s*stale-while-revalidate=\d+\b/;
const S_MAXAGE = /\bs-maxage=\d+/;
const MAX_AGE = /(^|[\s,])max-age=/;

export function browserSafeCacheControl(
  cacheControl: string | null,
  contentType: string | null,
): string | null {
  if (!cacheControl) return null;
  if (!SWR.test(cacheControl) || !S_MAXAGE.test(cacheControl) || MAX_AGE.test(cacheControl)) return null;
  const type = (contentType ?? '').toLowerCase();
  if (!type.startsWith('text/html') && !type.startsWith('text/x-component')) return null;
  const kept = cacheControl.replace(SWR, '').trim().replace(/,$/, '').trim();
  return `${kept ? `${kept}, ` : ''}max-age=0, must-revalidate`;
}

/**
 * The handler's response with the corrected header, or the very same response
 * when nothing applies. A handler's Response headers may be immutable, hence
 * the copy; status, statusText and every other header carry over.
 */
export function withBrowserSafeCache(res: Response): Response {
  const fixed = browserSafeCacheControl(
    res.headers.get('cache-control'),
    res.headers.get('content-type'),
  );
  if (!fixed) return res;
  const out = new Response(res.body, res);
  out.headers.set('cache-control', fixed);
  return out;
}
