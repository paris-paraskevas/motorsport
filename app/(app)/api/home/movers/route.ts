import { NextResponse } from 'next/server';
import { loadAllSeriesMeta } from '@/lib/series';
import {
  fetchSeriesMovers,
  isEligibleMoversSeries,
  MOVERS_ELIGIBLE_SLUGS,
  type SeriesMovers,
} from '@/lib/standings/movers';

// Round-over-round championship movers for the home standings-movers widget,
// served as cacheable Ajax (mirrors /api/home/standings) so /app stays static.
// ?series=all (the client can't enumerate eligible series) or a csv of slugs,
// filtered to the movers-eligible set; fans out per series (fail-soft), each
// reusing the season-results fetchers' own caches.
export const dynamic = 'force-dynamic';

export interface HomeMoversItem extends SeriesMovers {
  name: string;
  color: string;
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('series') ?? '';
  const requested =
    raw === 'all'
      ? [...MOVERS_ELIGIBLE_SLUGS]
      : [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))].filter(isEligibleMoversSeries);
  if (requested.length === 0) {
    return NextResponse.json([], {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
    });
  }

  const metas = await loadAllSeriesMeta();
  const metaBySlug = new Map(metas.map(m => [m.slug, m]));
  const year = new Date().getUTCFullYear();

  const items = (
    await Promise.all(
      requested.map(async (slug): Promise<HomeMoversItem | null> => {
        const meta = metaBySlug.get(slug);
        if (!meta) return null;
        const movers = await fetchSeriesMovers(slug, meta.season ?? year);
        if (!movers) return null;
        return { ...movers, name: meta.name, color: meta.color };
      }),
    )
  ).filter((x): x is HomeMoversItem => x !== null);

  return NextResponse.json(items, {
    headers: {
      // Standings move slowly; edge-cache the scrape fan-out, serve stale-while-revalidate.
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
    },
  });
}
