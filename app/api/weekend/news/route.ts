import { NextResponse } from 'next/server';
import { loadSeries } from '@/lib/series';
import { weekendFor, weekendStartEnd } from '@/lib/weekend';
import { fetchNews, NEWS_SLUG_MAP } from '@/lib/news';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Weekend news for the News tab, served on demand (client-fetched when the tab
// opens) so the weekend page render no longer blocks on fetchNews. Same window
// as the old WeekendNews server component; CDN-cached like the page.
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_BEFORE_DAYS = 7;
const WINDOW_AFTER_DAYS = 1;
const MAX_ITEMS = 8;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const slug = sp.get('series') ?? '';
  const round = Number(sp.get('round'));
  if (!slug || !Number.isInteger(round) || round < 1 || NEWS_SLUG_MAP[slug] == null) {
    return NextResponse.json({ items: [] });
  }
  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    return NextResponse.json({ items: [] });
  }
  const weekend = weekendFor(series, round);
  if (!weekend) return NextResponse.json({ items: [] });

  const all = await fetchNews(slug);
  const { start, end } = weekendStartEnd(weekend);
  const from = new Date(start.getTime() - WINDOW_BEFORE_DAYS * DAY_MS);
  const to = new Date(end.getTime() + WINDOW_AFTER_DAYS * DAY_MS);
  const items = all
    .filter(i => i.pubDate >= from && i.pubDate <= to)
    .slice(0, MAX_ITEMS)
    .map(i => ({ title: i.title, link: i.link, pubDate: i.pubDate.toISOString() }));

  return NextResponse.json(
    { items, seriesName: series.meta.name, color: series.meta.color },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
}
