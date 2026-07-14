import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin-guard';
import { fetchGscSearch, isGscConfigured } from '@/lib/analytics/gsc';
import { fetchBingSearch, isBingConfigured } from '@/lib/analytics/bing';
import { AdminPageHeader, SearchPanel, BingPanel, NotConnected, Unavailable } from '@/components/admin/AdminUI';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Search · Admin' };

// Search route: Google Search Console + Bing Webmaster Tools, side by side on lg+.
// Fetches both in parallel; each side is independently fail-soft + env-gated with
// the connected / configured-but-empty / not-connected three-state.
export default async function AdminSearchPage() {
  await requireAdmin();
  const [gsc, bing] = await Promise.all([fetchGscSearch(28), fetchBingSearch()]);
  const gscConnected = isGscConfigured();
  const bingConnected = isBingConfigured();

  return (
    <div>
      <AdminPageHeader title="Search" tagline="Google Search Console · Bing Webmaster Tools" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Search Console</h2>
          {gsc ? (
            <SearchPanel data={gsc} />
          ) : gscConnected ? (
            <Unavailable note="Search Console is configured but returned no data yet." />
          ) : (
            <NotConnected what="Google Search Console" env="GSC_SITE_URL + GSC_SA_KEY" />
          )}
        </div>
        <div className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Bing</h2>
          {bing ? (
            <BingPanel data={bing} />
          ) : bingConnected ? (
            <Unavailable note="Bing is configured but returned no data yet." />
          ) : (
            <NotConnected what="Bing Webmaster Tools" env="BING_WEBMASTER_API_KEY + BING_SITE_URL" />
          )}
        </div>
      </div>
    </div>
  );
}
