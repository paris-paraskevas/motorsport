import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin-guard';
import { readHealthReport, type HealthReport } from '@/lib/health-store';
import { getSourceHealth, type SourceHealth } from '@/lib/source-snapshot';
import { latestRuns, type SourceRunSummary } from '@/lib/standing-rows';
import { getOpenMarkets, type OpenMarket } from '@/lib/betting/markets';
import {
  fetchBillableUsage,
  fetchWorkerUsage,
  isCloudflareBillingConfigured,
  isCloudflareUsageConfigured,
  WORKERS_INCLUDED_REQUESTS,
  type BillableUsage,
  type WorkerUsage,
} from '@/lib/analytics/cloudflare';
import { AdminPageHeader, KpiTile, TelemetryPanel, Unavailable } from '@/components/admin/AdminUI';
import { LocalTime } from '@/components/LocalTime';
import { Activity, ListChecks, Radio } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'System · Admin' };

// System: is the machine healthy, and what does it cost.
//
// EVERY PANEL HERE IS A READ. Nothing on this page calls a parser: the verdict
// comes from the KV report the 6-hourly cron writes (lib/health-store.ts), so
// this renders in one round trip instead of fifteen series of live network
// fan-out behind a 30s-per-check timeout.
//
// The board deliberately keeps TWO measures apart, because they answer
// different questions and conflating them is how one upstream break renders as
// fifteen red tiles:
//   • Parser health — can our code still read its source, over the WORKER's
//     network. That is the stored report.
//   • Freshness — how old the data a reader is actually served is. The Worker
//     runs DATA_SOURCE=db, so readers get snapshots written by the warm job
//     from clean egress IPs. That is `source_snapshot`, read live because it is
//     one indexed query.
//
// Cloudflare usage and cost arrived in 0.334.77. The one nuance the panel states
// out loud: the billable-usage endpoint returns USAGE-BASED charges only, so the
// Workers Paid $5/month base is not in it. Presenting that total as "what the
// site costs" would understate the bill by most of it.

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const STATUS_TONE: Record<string, string> = {
  OK: 'text-positive',
  LOW: 'text-brand',
  EMPTY: 'text-negative',
  ERROR: 'text-negative',
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`font-mono text-10 uppercase tracking-[0.14em] ${STATUS_TONE[status] ?? 'text-text-faint'}`}>
      {status}
    </span>
  );
}

/** Every series named by any of the three monitors, so a series that only one
 *  of them covers still gets a row rather than silently vanishing. */
function seriesRows(report: HealthReport) {
  const labels = new Map<string, string>();
  for (const c of [...report.standings.checks, ...report.results.checks]) labels.set(c.slug, c.label);
  for (const c of report.sessions.checks) labels.set(c.slug, c.label);

  const standings = new Map(report.standings.checks.map(c => [c.slug, c]));
  const results = new Map(report.results.checks.map(c => [c.slug, c]));
  const sessions = new Map(report.sessions.checks.map(c => [c.slug, c]));

  return [...labels.entries()]
    .map(([slug, label]) => ({
      slug,
      label,
      standings: standings.get(slug),
      results: results.get(slug),
      sessions: sessions.get(slug),
    }))
    // Anything not OK first — the board should open on what needs you.
    .sort((a, b) => {
      const bad = (r: typeof a) =>
        [r.standings?.status, r.results?.status, r.sessions?.status].filter(s => s && s !== 'OK').length;
      return bad(b) - bad(a) || a.label.localeCompare(b.label);
    });
}

function HealthMatrix({ report }: { report: HealthReport }) {
  const rows = seriesRows(report);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {['Series', 'Standings', 'Results', 'Sessions', 'Slowest'].map(h => (
              <th
                key={h}
                className="px-4 py-2 text-left font-mono text-10 uppercase tracking-[0.14em] font-medium text-text-faint"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const ms = Math.max(r.standings?.ms ?? 0, r.results?.ms ?? 0, r.sessions?.ms ?? 0);
            return (
              <tr key={r.slug} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2 text-text">{r.label}</td>
                <td className="px-4 py-2">
                  {r.standings ? (
                    <span className="flex items-baseline gap-2">
                      <StatusPill status={r.standings.status} />
                      <span className="font-mono text-11 tabular-nums text-text-faint">{r.standings.rows}</span>
                    </span>
                  ) : (
                    <span className="text-text-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {r.results ? (
                    <span className="flex items-baseline gap-2">
                      <StatusPill status={r.results.status} />
                      <span className="font-mono text-11 tabular-nums text-text-faint">{r.results.rows}</span>
                    </span>
                  ) : (
                    <span className="text-text-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {r.sessions ? (
                    <span className="flex items-baseline gap-2">
                      <StatusPill status={r.sessions.status} />
                      {r.sessions.thin.length > 0 ? (
                        <span className="font-mono text-11 text-text-faint">
                          {r.sessions.thin.length} thin
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-text-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-11 tabular-nums text-text-faint">
                  {ms > 0 ? `${(ms / 1000).toFixed(1)}s` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FreshnessPanel({ sources }: { sources: SourceHealth[] }) {
  // Newest first is how getSourceHealth returns them; the stale ones are what
  // matter, so surface those first instead.
  const ordered = [...sources].sort((a, b) => (b.ageMinutes ?? 0) - (a.ageMinutes ?? 0)).slice(0, 12);
  return (
    <ul className="divide-y divide-border">
      {ordered.map(s => (
        <li key={s.key} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
          <span className="min-w-0 truncate font-mono text-xs text-text">{s.key}</span>
          <span className="flex shrink-0 items-baseline gap-3">
            {!s.ok ? <span className="font-mono text-10 uppercase tracking-[0.14em] text-negative">failed</span> : null}
            <span
              className={`font-mono text-11 tabular-nums ${s.stale ? 'text-negative' : 'text-text-faint'}`}
            >
              {s.ageMinutes == null
                ? 'never'
                : s.ageMinutes < 60
                  ? `${s.ageMinutes}m`
                  : `${Math.round(s.ageMinutes / 60)}h`}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Feature flags as the running build actually contains them.
 *
 * This is the panel that would have caught the assistant going dark. A
 * NEXT_PUBLIC_* value is inlined at BUILD time, and Workers Builds runs its own
 * build on every merge — so a flag set only in a local env file compiles out
 * silently and nothing anywhere reports it. Reading it here reports it.
 */
function flagRows() {
  return [
    {
      label: 'Race Engineer assistant',
      on: process.env.NEXT_PUBLIC_ASSISTANT_ENABLED === '1',
      note: 'Also needs its widget remounting — it was taken out of the app layout on 2026-08-21.',
    },
    {
      label: 'Push notifications',
      on: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      note: 'Without the public key in the build, new subscriptions fail silently.',
    },
    {
      label: 'Studio AI tools',
      on: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
      note: 'Server-side key. Powers the section-heading proposals, and the assistant when it is on.',
    },
  ];
}

export default async function AdminSystemPage() {
  await requireAdmin();

  const [report, sources, runs, markets, usage, billing] = await Promise.all([
    safe(() => readHealthReport(), null as HealthReport | null),
    safe(() => getSourceHealth(), [] as SourceHealth[]),
    safe(() => latestRuns(), [] as SourceRunSummary[]),
    safe(() => getOpenMarkets(), [] as OpenMarket[]),
    safe(() => fetchWorkerUsage(30), null as WorkerUsage | null),
    safe(() => fetchBillableUsage(30), null as BillableUsage | null),
  ]);

  const flags = flagRows();

  return (
    <div className="space-y-6">
      <AdminPageHeader title="System" tagline="Data health · freshness · what is switched on" />

      {report === null ? (
        // An empty state has to say what fills it and when, or it reads as
        // broken. The check runs at 17 minutes past every sixth hour.
        <TelemetryPanel title="Data health">
          <Unavailable note="No check stored yet. The health run fires every six hours and its verdict lands here; until then there is nothing to show." />
        </TelemetryPanel>
      ) : (
        <>
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

          <TelemetryPanel
            title="Parser health"
            meta={<LocalTime instant={Date.parse(report.checkedAt)} />}
            flush
          >
            <HealthMatrix report={report} />
            <p className="border-t border-border px-4 py-2.5 text-xs leading-relaxed text-text-faint">
              Graded from the Worker&rsquo;s own network, which many upstreams reject on datacenter IPs. It answers
              &ldquo;can our code still read its source&rdquo;, not &ldquo;is the site stale&rdquo; — that is the panel
              below.
            </p>
          </TelemetryPanel>
        </>
      )}

      <TelemetryPanel
        title="Freshness — what readers are served"
        meta={sources.length ? `${sources.filter(s => s.stale).length} stale of ${sources.length}` : undefined}
        flush
      >
        {sources.length === 0 ? (
          <div className="p-4">
            <Unavailable note="No snapshots on file. The warm job writes these from GitHub Actions every 20 minutes." />
          </div>
        ) : (
          <FreshnessPanel sources={sources} />
        )}
      </TelemetryPanel>

      <TelemetryPanel
        title="Loads — rows with provenance"
        meta={runs.length ? `${runs.filter(r => r.status !== 'ok').length} failed of ${runs.length}` : undefined}
        flush
      >
        {runs.length === 0 ? (
          <div className="p-4">
            <Unavailable note="No loads recorded yet. Rows arrive with the Phase 0 migration (source, source_run, standing); until it is applied the loader writes payloads only." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {runs.slice(0, 16).map(r => (
              <li key={r.sourceKey} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 truncate font-mono text-xs text-text">{r.sourceKey}</span>
                <span className="flex shrink-0 items-baseline gap-3">
                  {r.status !== 'ok' ? (
                    <span className="font-mono text-10 uppercase tracking-[0.14em] text-negative">{r.status}</span>
                  ) : (
                    <span className="font-mono text-11 tabular-nums text-text-faint">{r.rowsWritten} rows</span>
                  )}
                  <span
                    className={`font-mono text-11 tabular-nums ${
                      r.ageMinutes != null && r.ageMinutes > 12 * 60 ? 'text-negative' : 'text-text-faint'
                    }`}
                  >
                    {r.ageMinutes == null
                      ? 'running'
                      : r.ageMinutes < 60
                        ? `${r.ageMinutes}m`
                        : `${Math.round(r.ageMinutes / 60)}h`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-border px-4 py-2.5 text-xs leading-relaxed text-text-faint">
          Each row is the newest run per source. A load is visible to readers only once its run is marked ok, so a
          failed run here means readers still see the previous good load, not a half-written one.
        </p>
      </TelemetryPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <TelemetryPanel title="Switched on, as built" flush>
          <ul className="divide-y divide-border">
            {flags.map(f => (
              <li key={f.label} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-text">{f.label}</span>
                  <span
                    className={`shrink-0 font-mono text-10 uppercase tracking-[0.14em] ${
                      f.on ? 'text-positive' : 'text-text-faint'
                    }`}
                  >
                    {f.on ? 'on' : 'off'}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-faint">{f.note}</p>
              </li>
            ))}
          </ul>
          <p className="border-t border-border px-4 py-2.5 text-xs leading-relaxed text-text-faint">
            Read from the running build, not from a file on a laptop. A public flag is baked in at build time, so one
            set only locally compiles out on deploy and nothing else would ever tell you.
          </p>
        </TelemetryPanel>

        <TelemetryPanel title="Markets" meta={markets.length ? `${markets.length} open` : undefined} flush>
          {markets.length === 0 ? (
            <div className="p-4">
              <Unavailable note="No markets open. The open-markets cron runs twice a day and settlement every three hours." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {markets.slice(0, 8).map(m => (
                <li key={m.id} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                  <span className="min-w-0 truncate text-text">
                    <span className="font-mono text-11 uppercase tracking-[0.12em] text-text-faint">
                      {m.seriesSlug} R{m.round}
                    </span>{' '}
                    {m.type}
                  </span>
                  <span className="shrink-0 font-mono text-11 tabular-nums text-text-faint">
                    <LocalTime instant={Date.parse(m.locksAt)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TelemetryPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TelemetryPanel title="Cloudflare usage" meta={usage ? `${usage.days} days` : undefined} flush>
          {usage === null ? (
            <div className="p-4">
              {isCloudflareUsageConfigured() ? (
                <Unavailable note="Configured, but Cloudflare returned nothing. The token may have lost its Account Analytics permission." />
              ) : (
                <Unavailable note="Not connected. Needs CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_ANALYTICS_TOKEN as Worker secrets." />
              )}
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <div>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-text-muted">Worker requests</span>
                  <span className="font-mono text-11 tabular-nums text-text">
                    {usage.requests.toLocaleString()} / {(WORKERS_INCLUDED_REQUESTS / 1_000_000).toFixed(0)}M
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                  <div
                    className={`h-full rounded-full ${
                      usage.requests > WORKERS_INCLUDED_REQUESTS ? 'bg-negative' : 'bg-positive'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(1, (usage.requests / WORKERS_INCLUDED_REQUESTS) * 100))}%`,
                    }}
                  />
                </div>
              </div>
              <ul className="divide-y divide-border border-t border-border">
                <li className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="text-text-muted">Errors</span>
                  <span
                    className={`font-mono text-11 tabular-nums ${usage.errors > 0 ? 'text-negative' : 'text-positive'}`}
                  >
                    {usage.errors.toLocaleString()}
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="text-text-muted">Subrequests</span>
                  <span className="font-mono text-11 tabular-nums text-text">
                    {usage.subrequests.toLocaleString()}
                  </span>
                </li>
              </ul>
              <p className="text-xs leading-relaxed text-text-faint">
                The allowance is the Workers Paid included figure, shown as a reference rather than used to compute
                anything — if the plan changes, a wrong reference is visibly wrong.
              </p>
            </div>
          )}
        </TelemetryPanel>

        <TelemetryPanel
          title="Usage-based charges"
          meta={billing ? `${billing.currency} · 30 days` : undefined}
          flush
        >
          {billing === null ? (
            <div className="p-4">
              {isCloudflareBillingConfigured() ? (
                <Unavailable note="Configured, but Cloudflare returned nothing. The Billable Usage API covers self-serve accounts only." />
              ) : (
                <Unavailable note="Not connected. Needs CLOUDFLARE_BILLING_TOKEN as a Worker secret." />
              )}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {billing.services.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-text-muted">No usage-based charges in this period.</li>
                ) : (
                  billing.services.map(sv => (
                    <li key={sv.name} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                      <span className="min-w-0 truncate text-text-muted">{sv.name}</span>
                      <span className="flex shrink-0 items-baseline gap-3">
                        <span className="font-mono text-10 text-text-faint">
                          {sv.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {sv.unit}
                        </span>
                        <span className="font-mono text-11 tabular-nums text-text">{sv.cost.toFixed(2)}</span>
                      </span>
                    </li>
                  ))
                )}
                <li className="flex items-baseline justify-between gap-3 border-t border-border-strong px-4 py-2.5 text-sm">
                  <span className="font-semibold text-text">Total</span>
                  <span className="font-mono text-11 tabular-nums font-semibold text-text">
                    {billing.total.toFixed(2)} {billing.currency}
                  </span>
                </li>
              </ul>
              <p className="border-t border-border px-4 py-2.5 text-xs leading-relaxed text-text-faint">
                <strong className="text-text-muted">Usage-based charges only.</strong> Fixed plan subscriptions are not
                in this figure, so the Workers Paid monthly base is not counted here — this is what usage adds on top,
                not the bill.
              </p>
            </>
          )}
        </TelemetryPanel>
      </div>
    </div>
  );
}
