import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin-guard';
import { fetchGa4Traffic, isGa4Configured } from '@/lib/analytics/ga4';
import { AdminPageHeader, TrafficPanel, TelemetryPanel, NotConnected, Unavailable } from '@/components/admin/AdminUI';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Traffic · Admin' };

// Traffic route: Google Analytics 4 audience data + a parked PageSpeed Insights
// panel (Core Web Vitals, not wired yet). Fetches only GA4; fail-soft + env-gated
// with the connected / configured-but-empty / not-connected three-state.
export default async function AdminTrafficPage() {
  await requireAdmin();
  const ga4 = await fetchGa4Traffic(30);
  const ga4Connected = isGa4Configured();

  return (
    <div>
      <AdminPageHeader title="Traffic" tagline="Audience · Google Analytics · Core Web Vitals" />
      <div className="space-y-6">
        {ga4 ? (
          <TrafficPanel data={ga4} />
        ) : ga4Connected ? (
          <TelemetryPanel title="Google Analytics">
            <Unavailable note="GA4 is configured but returned no data — grant the service account Viewer on the property." />
          </TelemetryPanel>
        ) : (
          <TelemetryPanel title="Google Analytics">
            <NotConnected what="Google Analytics 4" env="GA4_PROPERTY_ID + GA4_SA_KEY" />
          </TelemetryPanel>
        )}

        <TelemetryPanel title="PageSpeed Insights" meta="parked">
          <NotConnected what="PageSpeed Insights" env="PSI_API_KEY" />
        </TelemetryPanel>
      </div>
    </div>
  );
}
