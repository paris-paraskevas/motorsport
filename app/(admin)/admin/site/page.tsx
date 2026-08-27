import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin-guard';
import { publishedPosts } from '@/lib/blog';
import {
  loadLiveHomeLayout,
  layoutFromParams,
  pinnedLeadSlug,
  visibleBlocks,
} from '@/lib/home-layout';
import { buildHomeModel } from '@/lib/home-model';
import { HomeLead } from '@/components/HomeLead';
import { AdminPageHeader } from '@/components/admin/AdminUI';
import { HomeComposer } from '@/components/admin/HomeComposer';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Site · Admin' };

// The home composer: arrange the bands, choose what leads, see it before it is
// live. The first tool in the console that CHANGES the site rather than
// reporting on it.
//
// The DRAFT lives in the URL (?order=&hidden=&lead=), and the preview is a real
// server render of the real components from lib/home-model.ts — the same
// function /app itself uses, so the preview cannot drift from the page. That is
// also why the draft is a query parameter rather than client state: this route
// is already force-dynamic, so reading searchParams costs nothing here, whereas
// on /app it would opt the route out of ISR for everyone.
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; hidden?: string; lead?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const live = await loadLiveHomeLayout();

  // No parameters yet → the draft starts as whatever is currently live, so the
  // composer opens showing the real home page rather than a default.
  const touched = Boolean(params.order || params.hidden || params.lead);
  const draft = touched
    ? layoutFromParams(params)
    : live;

  const [model, posts] = await Promise.all([buildHomeModel(draft), publishedPosts()]);

  return (
    <div>
      <AdminPageHeader
        title="Home page"
        tagline="Arrange the bands, choose what leads, publish when it looks right"
      />
      <div className="grid gap-8 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <HomeComposer
          blocks={draft.blocks}
          liveBlocks={live.blocks}
          order={visibleBlocks(draft)}
          pinnedSlug={pinnedLeadSlug(draft)}
          posts={posts.slice(0, 30).map(p => ({
            slug: p.slug,
            title: p.title,
            publishedAt: p.publishedAt ?? p.createdAt,
            seriesSlug: p.seriesSlug,
          }))}
        />
        {/* The preview. Scaled down so the whole page reads at a glance, and
            pointer-events disabled so a stray click inside it cannot navigate
            away from the composer mid-edit. */}
        <div className="min-w-0">
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
            Preview · exactly what visitors will see
          </p>
          <div className="overflow-hidden border border-border bg-bg p-4">
            <div className="pointer-events-none origin-top-left scale-[0.62] [width:161%]">
              <HomeLead {...model} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
