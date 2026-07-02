import { buildSearchIndex } from '@/lib/search-index';

// Global-search index: the flat entity list (drivers, teams, series + tabs,
// weekends, blog, pages) built at BUILD time and served static — the ⌘K overlay
// fetches it once, client-side, then fuzzy-matches locally (no per-keystroke
// network). Revalidated hourly so newly-published blog posts and rounds that
// have crossed into the past refresh without a redeploy.
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  const docs = await buildSearchIndex();
  return Response.json(docs, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
