import { kv } from '@vercel/kv';

// Fixed-window KV rate limiter (security audit 2026-06-11). Guards the
// unauthenticated write surface (/api/contact) and cheap-to-abuse authed
// writes. Fails OPEN when KV is absent or erroring: for these surfaces,
// availability beats strictness — the accepted trade is documented in
// docs/research/security-audit-2026-06-11.md.

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/** Best-effort client IP behind Vercel's proxy.
 *
 * SECURITY: never trust the LEFTMOST x-forwarded-for entry — a client can send
 * `X-Forwarded-For: <spoofed>` and Vercel APPENDS the real edge-observed IP to
 * the right, so the leftmost value is attacker-controlled. Taking it would let
 * a single abuser dodge the rate limiter by rotating a fake left entry per
 * request. Prefer Vercel's own `x-vercel-forwarded-for` (the platform-set
 * client IP); otherwise take the RIGHTMOST x-forwarded-for hop — the entry the
 * trusted proxy appended. */
export function clientIp(req: Request): string {
  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) {
    // Normally a single client IP; defensively take the last hop if a list ever appears.
    const parts = vercel.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * True when the request fits inside `limit` per `windowSeconds` for this
 * bucket. Fixed window via INCR + EXPIRE — boundary bursts can reach 2×limit
 * momentarily, which is fine at these thresholds.
 */
export async function allowRequest(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!isKvConfigured()) return true;
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `paddock:ratelimit:${bucket}:${window}`;
  try {
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, windowSeconds);
    }
    return count <= limit;
  } catch {
    return true;
  }
}
