import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin-guard';
import { publishedPosts } from '@/lib/blog';
import {
  DEFAULT_HOME_LAYOUT,
  loadHomeLayoutState,
  layoutFromParams,
  pinnedLeadSlug,
  visibleBlocks,
} from '@/lib/home-layout';
import { buildHomeModel } from '@/lib/home-model';
import { isProductionWorker } from '@/lib/env';
import { HomeLead } from '@/components/HomeLead';
import { AdminPageHeader } from '@/components/admin/AdminUI';
import { HomeComposer } from '@/components/admin/HomeComposer';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Site · Admin' };

// The home composer: arrange the bands, choose what leads, see it before it is
// live. The first tool in the console that CHANGES the site rather than
// reporting on it.
//
// The in-progress draft lives in the URL (?order=&hidden=&lead=), and the
// preview is a real server render of the real components from lib/home-model.ts
// — the same function /app itself uses, so the preview cannot drift from the
// page. That is also why the draft is a query parameter rather than client
// state: this route is already force-dynamic, so reading searchParams costs
// nothing here, whereas on /app it would opt the route out of ISR for everyone.
// A SAVED draft is an unpublished page_layout row (Save draft in the composer);
// the page opens it when the URL carries no edits.
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; hidden?: string; lead?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const { live, draft: savedDraft } = await loadHomeLayoutState();
  const liveLayout = live?.layout ?? DEFAULT_HOME_LAYOUT;

  // No parameters yet → the composer opens on the saved draft if one is newer
  // than the live layout, else on whatever is live: real state, never a default.
  const touched = Boolean(params.order || params.hidden || params.lead);
  const draft = touched
    ? layoutFromParams(params)
    : (savedDraft?.layout ?? liveLayout);

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
          liveBlocks={liveLayout.blocks}
          liveId={live?.id ?? null}
          savedDraft={
            savedDraft ? { id: savedDraft.id, at: savedDraft.at, blocks: savedDraft.layout.blocks } : null
          }
          order={visibleBlocks(draft)}
          pinnedSlug={pinnedLeadSlug(draft)}
          // Decided on the server: PADDOCK_ENV is not a NEXT_PUBLIC_ variable, so
          // the client cannot read it, and the API refuses the publish anyway.
          readOnly={!isProductionWorker()}
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
          <p className="mb-2 font-mono text-10 font-semibold uppercase tracking-[0.16em] text-text-faint">
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
