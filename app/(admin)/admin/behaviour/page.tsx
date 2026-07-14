import type { Metadata } from 'next';
import { currentUser } from '@clerk/nextjs/server';
import { requireAdmin } from '@/lib/admin-guard';
import { isAdmin } from '@/lib/threads';
import {
  heatmapAdminOverview,
  overlayData,
  type OverlayData,
  type Breakpoint,
  type Source,
  type Visitor,
} from '@/lib/heatmap';
import { HeatmapOverlay } from '@/components/admin/HeatmapOverlay';
import { AdminPageHeader, RankPanel } from '@/components/admin/AdminUI';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Behaviour · Admin' };

const EMPTY_OVERLAY: OverlayData = { clicks: [], scroll: { sample: 0, reached: [] }, rage: [], dead: [] };

// Admin-gated server action: fetch the overlay bundle (clicks + scroll + rage/dead)
// for one path + filter (breakpoint / segment / date window) on demand — the
// overlay's controls call this. Re-checks admin — a server action is a POST
// endpoint anyone could invoke, so it must guard, not trust the caller.
async function loadOverlayData(
  path: string,
  filter: { breakpoint: Breakpoint; source?: Source; visitor?: Visitor; from?: string },
): Promise<OverlayData> {
  'use server';
  if (!isAdmin(await currentUser())) return EMPTY_OVERLAY;
  return overlayData(path, filter);
}

// Behaviour route: the self-captured click heatmap. The overlay (a live iframe +
// canvas) is seeded with the busiest page on desktop so it paints on first render;
// its controls fetch other path/breakpoint/segment combos via loadOverlayData.
// Below it, every tracked path is ranked into Hot / Dead elements per breakpoint.
export default async function AdminBehaviourPage() {
  await requireAdmin();
  const heat = await heatmapAdminOverview();
  const overlayPaths = heat.map(p => p.path);
  const initialOverlay: OverlayData = heat[0]
    ? await overlayData(heat[0].path, { breakpoint: 'desktop' })
    : EMPTY_OVERLAY;

  return (
    <div>
      <AdminPageHeader title="Behaviour" tagline="Self-captured click heatmap · hot + dead zones" />
      {heat.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-6 text-center">
          <p className="text-sm text-text-muted">
            A self-hosted click heatmap — where on each page people click (and the dead zones to sell). No data yet; it
            fills as people browse (analytics-consent only, anonymous).
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <HeatmapOverlay
            paths={overlayPaths}
            initialPath={heat[0].path}
            initialData={initialOverlay}
            loadData={loadOverlayData}
          />
          <div>
            <p className="mb-3 font-mono text-[11px] leading-relaxed text-text-faint">
              Ranked per page and viewport. Hot elements get the most clicks; Dead elements are seen but never clicked
              (wasted space, candidates to sell).
            </p>
            <div className="space-y-4">
              {heat.map(p => (
                <RankPanel key={p.path} panel={p} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
