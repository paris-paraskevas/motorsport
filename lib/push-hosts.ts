// Allowlist of real Web Push service hosts. The notify/blog/betting crons
// web-push to every stored endpoint, so a subscription endpoint is an
// outbound-POST target — treat it like SSRF surface and only accept URLs whose
// host belongs to a known browser-vendor push service.
//
// Seeded from the vendor endpoints browsers actually hand out (mirrors the
// provider sniff in app/api/push/inspect/route.ts):
//   - Chrome / Android  → fcm.googleapis.com
//   - Firefox           → updates.push.services.mozilla.com,
//                         *.autopush.services.mozilla.com,
//                         *.push.services.mozilla.com
//   - Apple (Safari)    → web.push.apple.com, *.push.apple.com
//   - Edge / Windows    → *.notify.windows.com
//
// This deliberately reverses the 0.x "shape-validate, don't allowlist" note in
// the 2026-06-11 security audit (finding #2): the host set is small and stable
// enough that an explicit allowlist is the stronger control.

/** Exact hosts we accept as-is (no subdomain wildcarding). */
const EXACT_HOSTS: readonly string[] = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
];

/**
 * Parent domains we accept along with any subdomain of them. Matched on a dot
 * boundary (host === parent OR host endsWith "." + parent) so a look-alike like
 * `push.apple.com.evil.com` is rejected — substring/`includes` matching would
 * wrongly accept it.
 */
const SUFFIX_PARENTS: readonly string[] = [
  'push.services.mozilla.com',
  'autopush.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
];

/**
 * True only for endpoints hosted on a known Web Push service. Callers must pass
 * an already-parsed https `URL` (the subscribe route parses + protocol-checks
 * first). Hostname comparison is case-insensitive; `URL` already lowercases the
 * host, but we normalise defensively.
 */
export function isAllowedPushEndpoint(url: URL): boolean {
  // Only ever deliver over TLS. The subscribe route enforces this too, but the
  // sink-side callers (listSubscriptions / sendPushTo) rely on this helper alone.
  if (url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();
  if (!host) return false;

  if (EXACT_HOSTS.includes(host)) return true;

  for (const parent of SUFFIX_PARENTS) {
    if (host === parent || host.endsWith(`.${parent}`)) return true;
  }

  return false;
}
