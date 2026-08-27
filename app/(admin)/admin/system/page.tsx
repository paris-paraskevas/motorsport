import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin-guard';
import { readHealthReport } from '@/lib/health-store';
import { AdminPageHeader, KpiTile, TelemetryPanel, Unavailable } from '@/components/admin/AdminUI';
import { LocalTime } from '@/components/LocalTime';
import { Activity, ListChecks, Radio } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'System · Admin' };

// System: is the machine healthy, and what does it cost.
//
// This is the interim shape. The full board — per-series grades, upstream
// freshness, the cron ledger, Cloudflare usage against the included allowance,
// billable cost and the flags-as-built panel — lands with the next step. What is
// here already is the part that needed no new plumbing: the stored verdict from
// `/api/cron/health`, which until 0.334.70 was computed every six hours and
// thrown away.
//
// One KV read, deliberately. Calling the health functions here instead would
// mean fifteen series of live network fan-out on every page load behind a
// 30s-per-check timeout — see lib/health-store.ts for why that is the wrong
// shape, and why per-source freshness is NOT in this report.

export default async function AdminSystemPage() {
  await requireAdmin();
  const report = await readHealthReport();

  return (
    <div>
      <AdminPageHeader title="System" tagline="Data health · usage · what it costs" />

      {report === null ? (
        // An empty state has to say what fills it and when, or it reads as
        // broken. The check runs at 17 minutes past every sixth hour.
        <TelemetryPanel title="Data health">
          <Unavailable note="No check stored yet. The health run fires every six hours and its verdict lands here; until then there is nothing to show." />
        </TelemetryPanel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiTile
              icon={Activity}
              label="Standings"
              value={`${report.standings.healthy}/${report.standings.total}`}
              hint={report.standings.downSlugs.length ? `down: ${report.standings.downSlugs.join(', ')}` : 'all parsers returning data'}
            />
            <KpiTile
              icon={ListChecks}
              label="Results"
              value={`${report.results.healthy}/${report.results.total}`}
              hint={report.results.downSlugs.length ? `down: ${report.results.downSlugs.join(', ')}` : 'all parsers returning data'}
            />
            <KpiTile
              icon={Radio}
              label="Session schedules"
              value={`${report.sessions.healthy}/${report.sessions.total}`}
              hint={report.sessions.flaggedSlugs.length ? `thin: ${report.sessions.flaggedSlugs.join(', ')}` : 'no thin weekends'}
            />
          </div>

          {/* An absolute instant through the site's existing LocalTime, not a
              server-computed "41m ago": reading the clock during render is
              impure (react-hooks/purity catches it), and a relative string baked
              at render drifts the moment it is cached. LocalTime is
              hydration-safe by construction and shows the viewer's own zone. */}
          <TelemetryPanel
            title="Last check"
            meta={<LocalTime instant={Date.parse(report.checkedAt)} />}
            flush
          >
            <div className="px-4 py-3 text-sm text-text-muted">
              {report.ok ? (
                <p>Every check passed. Nothing needs you here.</p>
              ) : (
                <p>
                  <span className="font-semibold text-text">{report.down}</span>{' '}
                  {report.down === 1 ? 'check is' : 'checks are'} failing. The per-series board arrives with the next
                  step; the names are in the tiles above.
                </p>
              )}
              <p className="mt-2 text-xs text-text-faint">
                This grades the parsers over the Worker&rsquo;s own network. What a reader is actually served is the
                snapshot written by the warm job, and its freshness is a separate measure — also arriving with the
                board.
              </p>
            </div>
          </TelemetryPanel>
        </div>
      )}
    </div>
  );
}
