import { NextResponse } from 'next/server';
import { loadAllDrivers } from '@/lib/people';

// "Driver spotlight" home-widget data, served as cacheable Ajax (mirrors
// /api/home/from-the-blog + /api/home/threads) so /app stays statically
// generated and the curated-driver fan-out runs at most once per window, not per
// visit. Returns a small ROTATING sample of drivers (+ their team) with deep
// links into /drivers and /teams. Multi-series by design — sampled across every
// curated series, so it never skews the home all-F1.
//
// The sample rotates per window: a time-seeded shuffle (Math.random is fine in an
// app route handler — this is app code, not a workflow script), edge-cached for
// the window so every visitor in that window sees the same handful, then it
// turns over. Fail-soft to [] throughout, so this never throws.
export const dynamic = 'force-dynamic';

// How many drivers to ship; the client renders them as a rotating card stack and
// can show fewer. Kept small — it's a discovery nudge, not a directory.
const SAMPLE = 6;

export interface HomeSpotlightDriver {
  /** Driver slug → /drivers/{slug}. */
  slug: string;
  name: string;
  code: string | null;
  team: string;
  /** Team slug → /teams/{teamSlug}. */
  teamSlug: string;
  teamColor: string | null;
  seriesSlug: string;
  seriesName: string;
  seriesColor: string;
}

// Fisher–Yates over a copy — uniform shuffle, doesn't mutate the source list.
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET() {
  try {
    const drivers = await loadAllDrivers();
    if (drivers.length === 0) {
      return NextResponse.json([] as HomeSpotlightDriver[], { headers: cacheHeaders() });
    }
    const sample = shuffle(drivers)
      .slice(0, SAMPLE)
      .map((d): HomeSpotlightDriver => ({
        slug: d.slug,
        name: d.name,
        code: d.code ?? null,
        team: d.team,
        teamSlug: d.teamSlug,
        teamColor: d.teamColor ?? null,
        seriesSlug: d.seriesSlug,
        seriesName: d.seriesName,
        seriesColor: d.seriesColor,
      }));
    return NextResponse.json(sample, { headers: cacheHeaders() });
  } catch {
    return NextResponse.json([] as HomeSpotlightDriver[], { headers: cacheHeaders() });
  }
}

function cacheHeaders() {
  return {
    // Edge-cache the JSON for the window so the curated-driver read runs at most
    // once per window and every visitor in it sees the same sample; the set then
    // rotates. The lineup is curated data that changes rarely, so a stale window
    // is fine — stale-while-revalidate keeps the turnover cheap.
    'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
  };
}
