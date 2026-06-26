import { NextResponse } from 'next/server';
import { loadAllSeriesMeta } from '@/lib/series';
import {
  fetchStandingsBrief,
  isEligibleStandingsSeries,
  ELIGIBLE_STANDINGS_SLUGS,
  type StandingsBrief,
} from '@/lib/standings/brief';

// Standings briefs for the home championship-leader + standings-snapshot
// widgets, served as cacheable Ajax (mirrors /api/just-missed + /api/home/from-the-blog)
// so /app stays statically generated. Takes ?series=f1,motogp,... and fans out
// per series (fail-soft, each KV-cached in fetchStandingsBrief), enriching with
// the series name + colour for rendering.
export const dynamic = 'force-dynamic';

export interface HomeStandingsItem extends StandingsBrief {
  name: string;
  color: string;
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('series') ?? '';
  // `all` = follow-all (the client can't enumerate eligible series); otherwise a
  // csv of slugs, filtered to the eligible (single-championship) set.
  const requested =
    raw === 'all'
      ? [...ELIGIBLE_STANDINGS_SLUGS]
      : [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))].filter(isEligibleStandingsSeries);
  if (requested.length === 0) {
    return NextResponse.json([], { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' } });
  }

  const metas = await loadAllSeriesMeta();
  const metaBySlug = new Map(metas.map(m => [m.slug, m]));
  const year = new Date().getFullYear();

  const items = (
    await Promise.all(
      requested.map(async (slug): Promise<HomeStandingsItem | null> => {
        const meta = metaBySlug.get(slug);
        if (!meta) return null;
        const brief = await fetchStandingsBrief(slug, meta.season ?? year);
        if (!brief) return null;
        return { ...brief, name: meta.name, color: meta.color };
      }),
    )
  ).filter((x): x is HomeStandingsItem => x !== null);

  return NextResponse.json(items, {
    headers: {
      // Edge-cache so the scrape fan-out runs at most once per window, served
      // stale-while-revalidate after — standings change slowly.
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
    },
  });
}
