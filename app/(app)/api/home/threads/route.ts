import { NextResponse } from 'next/server';
import { listThreads } from '@/lib/threads';
import { isBettingConfigured } from '@/lib/betting/client';
import { loadAllSeriesMeta } from '@/lib/series';

// "Paddock chatter" home-widget data, served as cacheable Ajax (mirrors
// /api/home/from-the-blog + /api/just-missed) so /app stays statically
// generated and the Supabase read runs at most once per window, not per visit.
// The most-recent APPROVED threads only; fail-soft (returns [] when the
// community DB isn't configured or the query errors), so this never throws.
export const dynamic = 'force-dynamic';

// Up to the max the widget's `count` setting allows (the client slices down).
const LIMIT = 5;

export interface HomeThreadItem {
  id: string;
  title: string;
  /** Series tag, enriched with name + colour for the chip; null = general. */
  seriesSlug: string | null;
  seriesName: string | null;
  seriesColor: string | null;
  createdAt: string;
}

export async function GET() {
  if (!isBettingConfigured()) {
    return NextResponse.json([] as HomeThreadItem[], {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  }

  try {
    // listThreads already orders newest-first; slice to the widget cap.
    const [threads, metas] = await Promise.all([listThreads('approved'), loadAllSeriesMeta()]);
    const metaBySlug = new Map(metas.map(m => [m.slug, m]));
    const items: HomeThreadItem[] = threads.slice(0, LIMIT).map(t => {
      const meta = t.seriesSlug ? metaBySlug.get(t.seriesSlug) : undefined;
      return {
        id: t.id,
        title: t.title,
        seriesSlug: t.seriesSlug,
        seriesName: meta?.name ?? null,
        seriesColor: meta?.color ?? null,
        createdAt: t.createdAt,
      };
    });
    return NextResponse.json(items, {
      headers: {
        // Edge-cache the JSON so the DB read runs at most once per window, served
        // stale-while-revalidate after — chatter trickles in, it isn't live.
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
      },
    });
  } catch {
    return NextResponse.json([] as HomeThreadItem[], {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  }
}
