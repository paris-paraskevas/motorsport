import { buildDecoderSummary } from '@/lib/openf1/decoder';

export const runtime = 'nodejs';
// Historical session telemetry is immutable once a session is over, so cache
// hard. revalidate handles the ISR/data layer; the explicit Cache-Control puts
// it on the CDN edge too (s-maxage 1d, stale-while-revalidate 7d) — same shape
// as /api/just-missed but with a far longer window because this never changes.
export const revalidate = 86400;

const CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=604800';

// Qualifying Decoder summary: every driver's best lap for a session (light —
// powers the picker + sector bars). Fetched by components/f1 at
// /api/f1/decoder?session=<session_key>[&series=f1]. The assembler caches
// upstream via the Next data cache and returns empty arrays gracefully, so this
// never 500s on a session with no laps.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const session = Number(searchParams.get('session'));
  if (!Number.isInteger(session) || session <= 0) {
    return Response.json({ error: 'session must be a positive integer' }, { status: 400 });
  }
  const series = searchParams.get('series') ?? 'f1';

  const summary = await buildDecoderSummary(session, series);
  return Response.json(summary, { headers: { 'Cache-Control': CACHE_CONTROL } });
}
