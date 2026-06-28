import { buildDecoderTraces } from '@/lib/openf1/decoder';

export const runtime = 'nodejs';
// Same immutability story as the summary route — telemetry for a finished
// session never changes. See ../route.ts for the caching rationale.
export const revalidate = 86400;

const CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=604800';

// Qualifying Decoder traces: telemetry + self-drawn track for a chosen set of
// drivers' fastest laps (heavier — fetched on demand). Fetched by components/f1
// at /api/f1/decoder/trace?session=<key>&drivers=16,1[&series=f1]. Capped at 4
// drivers to bound the car_data/location fan-out. The assembler caches upstream
// and skips drivers with no lap, so this never 500s on sparse data.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const session = Number(searchParams.get('session'));
  if (!Number.isInteger(session) || session <= 0) {
    return Response.json({ error: 'session must be a positive integer' }, { status: 400 });
  }

  const driverNumbers = (searchParams.get('drivers') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number);
  if (
    driverNumbers.length === 0 ||
    driverNumbers.length > 4 ||
    !driverNumbers.every(n => Number.isInteger(n) && n > 0)
  ) {
    return Response.json(
      { error: 'drivers must be a comma-separated list of 1-4 positive integers' },
      { status: 400 },
    );
  }

  const series = searchParams.get('series') ?? 'f1';

  const traces = await buildDecoderTraces(session, driverNumbers, series);
  return Response.json(traces, { headers: { 'Cache-Control': CACHE_CONTROL } });
}
