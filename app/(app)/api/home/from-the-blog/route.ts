import { NextResponse } from 'next/server';
import { publishedPosts } from '@/lib/blog';

// "From the blog" home-widget data, served as cacheable Ajax (mirrors
// /api/just-missed) so /app stays statically generated and the DB read runs at
// most once per window, not per visit. Latest published posts only; the
// underlying query is fail-soft (returns [] when Supabase isn't configured or
// errors), so this never throws.
export const dynamic = 'force-dynamic';

const LIMIT = 4;

export interface HomeBlogItem {
  slug: string;
  title: string;
  summary: string;
  seriesSlug: string | null;
  publishedAt: string | null;
}

export async function GET() {
  const posts = await publishedPosts();
  const items: HomeBlogItem[] = posts.slice(0, LIMIT).map(p => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    seriesSlug: p.seriesSlug,
    publishedAt: p.publishedAt,
  }));
  return NextResponse.json(items, {
    headers: {
      // Edge-cache the JSON so the DB read runs at most once per window, served
      // stale-while-revalidate after — posts publish infrequently.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
