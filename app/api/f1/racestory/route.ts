import { buildRaceStory } from '@/lib/openf1/racestory-loader';

// Immutable historical race data → cache hard (mirrors the decoder routes).
export const runtime = 'nodejs';
export const revalidate = 86400;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const session = Number(searchParams.get('session'));
  const series = searchParams.get('series') ?? 'f1';
  if (!Number.isInteger(session) || session <= 0) {
    return Response.json({ error: 'session must be a positive integer' }, { status: 400 });
  }
  const data = await buildRaceStory(session, series);
  return Response.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
