import { kv } from '@vercel/kv';

// Fixed-window KV rate limiter (security audit 2026-06-11). Guards the
// unauthenticated write surface (/api/contact) and cheap-to-abuse authed
// writes. Fails OPEN when KV is absent or erroring: for these surfaces,
// availability beats strictness — the accepted trade is documented in
// docs/research/security-audit-2026-06-11.md.

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
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
