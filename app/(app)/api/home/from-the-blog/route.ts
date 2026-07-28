import { NextResponse } from 'next/server';
import { publishedPosts } from '@/lib/blog';

// "From the blog" home-widget data, served as cacheable Ajax (mirrors
// /api/just-missed) so /app stays statically generated and the DB read runs at
// most once per window, not per visit. Latest published posts only; the
// underlying query is fail-soft (returns [] when Supabase isn't configured or
// errors), so this never throws.
// ISR (force-static + revalidate), not force-dynamic + s-maxage: the s-maxage
// contract was Vercel's edge cache and died in the Cloudflare migration — see
// app/(app)/api/just-missed/route.ts (0.243.0). Same staleness the header promised.
export const dynamic = 'force-static';
export const revalidate = 300;

// Up to the max the widget's `count` setting allows (the client slices down).
const LIMIT = 6;

export interface HomeBlogItem {
  slug: string;
  title: string;
  summary: string;
  seriesSlug: string | null;
  publishedAt: string | null;
  /** Operator-curated cover URL, already licence-gated by normalizeHeroImage in
      lib/blog.ts (absolute https:// or root-relative only). Projected so the home
      lead-story card can show real photography; null is the common case and the
      card falls back to its series-colour gradient. */
  heroImage: string | null;
}

export async function GET() {
  const posts = await publishedPosts();
  const items: HomeBlogItem[] = posts.slice(0, LIMIT).map(p => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    seriesSlug: p.seriesSlug,
    publishedAt: p.publishedAt,
    heroImage: p.heroImage,
  }));
  return NextResponse.json(items, {
    headers: {
      // Edge-cache the JSON so the DB read runs at most once per window, served
      // stale-while-revalidate after — posts publish infrequently.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
