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
import { fetchGa4Traffic, isGa4Configured, type Ga4Traffic } from '@/lib/analytics/ga4';
import { fetchGscSearch, isGscConfigured, type GscSearch } from '@/lib/analytics/gsc';
import { fetchBingSearch, isBingConfigured, type BingSearch } from '@/lib/analytics/bing';
import { HeatmapOverlay } from '@/components/admin/HeatmapOverlay';
import { AdminPageHeader, RankPanel, Sparkline, TelemetryPanel, Unavailable } from '@/components/admin/AdminUI';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Traffic · Admin' };

// Traffic: is anyone reading, and how did they find it.
//
// Four sources on one screen, on the SAME 28-day window, because the useful
// thing is that they disagree. Google's numbers are consent-gated and ours are
// not, so a gap between GA4 and the heatmap is the size of the consent refusal
// rather than an error. Bing is small in clicks and large in importance: its
// index is what ChatGPT search reads.
//
// Every panel is env-gated with a three-state contract — connected / configured
// but empty / not connected — so a missing key renders a "connect" prompt rather
// than a broken chart or a 500.

const EMPTY_OVERLAY: OverlayData = { clicks: [], scroll: { sample: 0, reached: [] }, rage: [], dead: [] };

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// Admin-gated server action for the overlay's controls. Re-checks admin: a
// server action is a POST endpoint anyone could invoke, so it must gate rather
// than trust the caller.
async function loadOverlayData(
  path: string,
  filter: { breakpoint: Breakpoint; source?: Source; visitor?: Visitor; from?: string },
): Promise<OverlayData> {
  'use server';
  if (!isAdmin(await currentUser())) return EMPTY_OVERLAY;
  return overlayData(path, filter);
}

function Kpi({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface-elevated p-4">
      <div className="truncate font-display text-3xl font-extrabold tabular-nums text-text">{value}</div>
      <div className="mt-1 truncate font-mono text-10 uppercase tracking-[0.14em] text-text-muted">{label}</div>
      {hint ? <div className="mt-0.5 truncate text-11 text-text-faint">{hint}</div> : null}
    </div>
  );
}

function NotConnected({ what, env }: { what: string; env: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-text-muted">{what} is not connected.</p>
      <p className="font-mono text-11 text-text-faint">Needs {env} as Worker secrets.</p>
    </div>
  );
}

function Rows({ rows }: { rows: { label: string; right: string; sub?: string }[] }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
          <span className="min-w-0 truncate text-text">{r.label}</span>
          <span className="flex shrink-0 items-baseline gap-3">
            {r.sub ? <span className="font-mono text-10 text-text-faint">{r.sub}</span> : null}
            <span className="font-mono text-11 tabular-nums text-text">{r.right}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminTrafficPage() {
  await requireAdmin();

  const [heat, ga4, gsc, bing] = await Promise.all([
    safe(() => heatmapAdminOverview(), []),
    safe(() => fetchGa4Traffic(28), null as Ga4Traffic | null),
    safe(() => fetchGscSearch(28), null as GscSearch | null),
    safe(() => fetchBingSearch(), null as BingSearch | null),
  ]);

  const initialOverlay: OverlayData = heat[0]
    ? await safe(() => overlayData(heat[0].path, { breakpoint: 'desktop' }), EMPTY_OVERLAY)
    : EMPTY_OVERLAY;
  const totalClicks = heat.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Traffic" tagline="Who is reading · how they found it · what they touch" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi value={ga4 ? ga4.users.toLocaleString() : '—'} label="visitors" hint="GA4, 28 days" />
        <Kpi
          value={gsc ? gsc.impressions.toLocaleString() : '—'}
          label="google impressions"
          hint={gsc ? `${gsc.clicks.toLocaleString()} clicks · pos ${gsc.position.toFixed(1)}` : undefined}
        />
        <Kpi
          value={bing ? bing.impressions.toLocaleString() : '—'}
          label="bing impressions"
          hint={bing ? `${bing.clicks.toLocaleString()} clicks` : undefined}
        />
        <Kpi value={totalClicks.toLocaleString()} label="clicks tracked" hint="our own, consent-gated" />
      </div>

      <TelemetryPanel title="Visitors" meta={ga4 ? 'GA4 · 28 days' : undefined} flush>
        {ga4 === null ? (
          <div className="p-4">
            {isGa4Configured() ? (
              <Unavailable note="Google Analytics is configured but returned nothing. Check the service account still has Viewer on the property." />
            ) : (
              <NotConnected what="Google Analytics" env="GA4_PROPERTY_ID + GA4_SA_KEY" />
            )}
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {ga4.trend.length >= 2 ? (
              <div className="text-brand">
                <Sparkline values={ga4.trend} width={480} height={44} />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-11 tabular-nums text-text-muted">
              <span>{ga4.users.toLocaleString()} users</span>
              <span>{ga4.sessions.toLocaleString()} sessions</span>
              <span>{ga4.pageViews.toLocaleString()} views</span>
            </div>
            <p className="text-xs leading-relaxed text-text-faint">
              Consent-gated: anyone who declines analytics is invisible here but still counted in the click heatmap
              below. The gap between the two is the size of that refusal, not an error.
            </p>
          </div>
        )}
      </TelemetryPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <TelemetryPanel
          title="Google Search"
          meta={gsc ? `CTR ${(gsc.ctr * 100).toFixed(1)}%` : undefined}
          flush
        >
          {gsc === null ? (
            <div className="p-4">
              {isGscConfigured() ? (
                <Unavailable note="Search Console is configured but returned nothing. Check GSC_SITE_URL matches the property exactly." />
              ) : (
                <NotConnected what="Search Console" env="GSC_SITE_URL + GSC_SA_KEY" />
              )}
            </div>
          ) : gsc.topQueries.length === 0 ? (
            <div className="p-4">
              <Unavailable note="Connected, but no query data in the window yet." />
            </div>
          ) : (
            <Rows
              rows={gsc.topQueries.map(q => ({
                label: q.query,
                right: `${q.clicks}`,
                sub: `${q.impressions.toLocaleString()} impr`,
              }))}
            />
          )}
        </TelemetryPanel>

        <TelemetryPanel
          title="Bing"
          meta={bing ? `${(bing.ctr * 100).toFixed(1)}% CTR · feeds ChatGPT search` : undefined}
          flush
        >
          {bing === null ? (
            <div className="p-4">
              {isBingConfigured() ? (
                <Unavailable note="Bing is configured but returned nothing. The key may have been rotated." />
              ) : (
                <NotConnected what="Bing Webmaster" env="BING_WEBMASTER_API_KEY + BING_SITE_URL" />
              )}
            </div>
          ) : bing.topQueries.length === 0 ? (
            <div className="p-4">
              <Unavailable note="Connected, but Bing has returned no query rows." />
            </div>
          ) : (
            <Rows
              rows={bing.topQueries.map(q => ({
                label: q.query,
                right: `${q.clicks}`,
                sub: `${q.impressions.toLocaleString()} impr`,
              }))}
            />
          )}
        </TelemetryPanel>
      </div>

      {ga4 && ga4.topPages.length > 0 ? (
        <TelemetryPanel title="Top pages" meta="GA4 · 28 days" flush>
          <Rows rows={ga4.topPages.map(p => ({ label: p.path, right: p.views.toLocaleString() }))} />
        </TelemetryPanel>
      ) : null}

      <TelemetryPanel title="Cloudflare" >
        <NotConnected what="Cloudflare Web Analytics and Workers usage" env="CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_ANALYTICS_TOKEN" />
      </TelemetryPanel>

      <div>
        <h2 className="mb-3 font-mono text-11 uppercase tracking-[0.16em] text-text-muted">
          What readers reach for
        </h2>
        {heat.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-6 text-center">
            <p className="text-sm text-text-muted">
              Our own click heatmap. No data yet; it fills as people browse (analytics consent only, anonymous).
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <HeatmapOverlay
              paths={heat.map(p => p.path)}
              initialPath={heat[0].path}
              initialData={initialOverlay}
              loadData={loadOverlayData}
            />
            <div className="space-y-4">
              {heat.map(p => (
                <RankPanel key={p.path} panel={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
