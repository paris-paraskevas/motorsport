import { NextResponse } from 'next/server';
import { loadSeries } from '@/lib/series';
import { groupByWeekend } from '@/lib/group';
import { buildSeriesIcs } from '@/lib/ics-export';

// Per-series ICS calendar feed: GET /api/calendar/f1 or /api/calendar/f1.ics
// (a dynamic segment can't carry the literal .ics suffix as a route, so it's
// stripped from the param). Subscribe via webcal://paddock-tracker.com/api/
// calendar/<slug>.ics — the series page's Calendar tab links it. Sessions come
// from the SAME resolution the calendar tab renders (loadSeries +
// groupByWeekend), windowed to future + recent-past inside buildSeriesIcs.

export const runtime = 'nodejs';

const SLUG_RE = /^[a-z0-9-]+$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await params;
  const slug = raw.toLowerCase().endsWith('.ics') ? raw.slice(0, -4) : raw;
  // Slug is used as a content-directory name — reject anything but plain
  // kebab-case before it reaches the fs loader.
  if (!SLUG_RE.test(slug)) {
    return new NextResponse('Not found', { status: 404 });
  }

  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  const now = new Date();
  const weekends = groupByWeekend(series.sessions, now, series.rounds);
  const ics = buildSeriesIcs({
    slug: series.meta.slug,
    name: series.meta.name,
    weekends,
    now,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${slug}.ics"`,
      // Edge-cache an hour; serve stale for a day while revalidating — session
      // times move rarely and calendar clients poll infrequently anyway.
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
