import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin-guard';
import { publishedPosts } from '@/lib/blog';
import { loadLiveHomeLayout, pinnedLeadSlug } from '@/lib/home-layout';
import { AdminPageHeader } from '@/components/admin/AdminUI';
import { LeadPicker } from '@/components/admin/LeadPicker';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Home page' };

// The home composer. Ship 1 does one thing: choose which published post leads
// /app, instead of "the newest one". Publishing inserts a layout revision and
// revalidates /app (app/api/admin/page-layout/route.ts).
//
// This page is the first tool in the console that CHANGES the site rather than
// reporting on it, which is the point of the rebuild.
export default async function AdminHomePage() {
  await requireAdmin();
  const [layout, posts] = await Promise.all([loadLiveHomeLayout(), publishedPosts()]);
  const pinned = pinnedLeadSlug(layout);

  return (
    <div>
      <AdminPageHeader
        title="Home page"
        tagline="Choose what leads the home page for everyone"
      />
      {posts.length === 0 ? (
        <p className="text-sm text-text-muted">
          Nothing is published yet, so there is nothing to lead with. The home page will keep
          showing its automatic composition.
        </p>
      ) : (
        <LeadPicker
          pinnedSlug={pinned}
          blocks={layout.blocks}
          posts={posts.slice(0, 30).map(p => ({
            slug: p.slug,
            title: p.title,
            publishedAt: p.publishedAt ?? p.createdAt,
            seriesSlug: p.seriesSlug,
          }))}
        />
      )}
    </div>
  );
}
