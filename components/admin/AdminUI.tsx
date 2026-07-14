import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Ga4Traffic } from '@/lib/analytics/ga4';
import type { GscSearch } from '@/lib/analytics/gsc';
import type { BingSearch } from '@/lib/analytics/bing';
import type { SeriesSubmission } from '@/lib/feeder';
import type { HeatmapPathPanel, ElementRank } from '@/lib/heatmap';

// Server-rendered UI kit for the /admin console. All server-safe (no hooks, no
// client state) so every admin route can compose these directly. The telemetry
// aesthetic — amber accents, mono/display type, hairline borders, per-row data
// bars and inline-SVG sparklines — lives here so the seven routes read as one
// instrument panel, not a templated card wall. Client interactivity (the heatmap
// overlay, the nav rail) lives in its own 'use client' components.

type IconType = React.ComponentType<{ size?: number; className?: string }>;

// Page masthead: an amber index bar + a mono/display title with the signature
// "." accent + a one-line tagline. One per admin route, above the content.
export function AdminPageHeader({ title, tagline }: { title: string; tagline: string }) {
  return (
    <header className="mb-6 flex items-stretch gap-3">
      <span aria-hidden className="w-1 shrink-0 bg-brand" />
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
          {title}
          <span className="text-brand">.</span>
        </h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">{tagline}</p>
      </div>
    </header>
  );
}

// Bordered, titled panel — the general section container (a mono uppercase title,
// optional right-aligned meta, hairline divider). `flush` drops the body padding
// so a divide-y list sits edge-to-edge under the header (the StatList chrome).
export function TelemetryPanel({
  title,
  meta,
  children,
  flush = false,
  className,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-border bg-surface-elevated ${className ?? ''}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-2.5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">{title}</h2>
        {meta ? (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-text-faint">
            {meta}
          </span>
        ) : null}
      </div>
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

// A prominent KPI tile: icon + label + big value + optional sparkline + hint.
// `spark` is an optional slot (pass <Sparkline/>); it inherits amber via currentColor.
export function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  spark,
}: {
  icon: IconType;
  label: string;
  value: string;
  hint?: string;
  spark?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{label}</span>
        <Icon size={14} className="shrink-0 text-text-faint" />
      </div>
      <div className="mt-2 font-display text-3xl font-extrabold tabular-nums text-text">{value}</div>
      {spark ? <div className="mt-2 text-brand">{spark}</div> : null}
      {hint ? <div className="mt-0.5 text-[11px] text-text-faint">{hint}</div> : null}
    </div>
  );
}

// Pure inline-SVG sparkline from a number[] (server-safe — no recharts, no hooks).
// Draws a single polyline; stroke = currentColor so the parent picks the tint.
// Returns null for <2 points (nothing meaningful to trend).
export function Sparkline({
  values,
  width = 120,
  height = 28,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pad = 2;
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - pad - ((v - min) / span) * (height - pad * 2)).toFixed(1)}`)
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden
      className={className}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// A single headline metric (Users / Clicks / CTR …). `text` overrides the numeric
// formatting for non-count values (CTR, position).
export function MiniStat({ label, value, text }: { label: string; value?: number; text?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold tabular-nums text-text">
        {text ?? (value ?? 0).toLocaleString()}
      </div>
    </div>
  );
}

// A thin per-row proportion bar (value relative to a list max) — the telemetry
// readout touch on ranked lists. Decorative (aria-hidden); a floor keeps a tiny
// nonzero value visible. Uses tokens only (border track, amber fill).
export function DataBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div aria-hidden className={`h-0.5 w-full overflow-hidden rounded-full bg-border/60 ${className ?? ''}`}>
      <div className="h-full rounded-full bg-brand/70" style={{ width: `${pct}%` }} />
    </div>
  );
}

// A labelled top-N list (top pages / queries / countries), capped at 8, with a
// per-row relative data bar scaled to the list max.
export function StatList({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const shown = rows.slice(0, 8);
  const max = shown.reduce((m, r) => Math.max(m, r.value), 0);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
      <div className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        {title}
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-3 font-mono text-[11px] text-text-faint">No data</p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((r, i) => (
            <li key={`${r.label}-${i}`} className="px-4 py-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-text">{r.label || '—'}</span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-faint">
                  {r.value.toLocaleString()}
                </span>
              </div>
              <DataBar value={r.value} max={max} className="mt-1.5" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NotConnected({ what, env }: { what: string; env: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-5">
      <p className="text-sm text-text-muted">
        {what} isn&apos;t connected yet. Add <span className="font-mono text-xs text-text">{env}</span> to light up this
        panel.
      </p>
    </div>
  );
}

export function Unavailable({ note }: { note: string }) {
  return <p className="font-mono text-sm text-text-faint">{note}</p>;
}

// GA4 traffic: headline totals + top pages / countries (last 30 days).
export function TrafficPanel({ data }: { data: Ga4Traffic }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Users" value={data.users} />
        <MiniStat label="Sessions" value={data.sessions} />
        <MiniStat label="Page views" value={data.pageViews} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatList title="Top pages" rows={data.topPages.map(p => ({ label: p.path, value: p.views }))} />
        <StatList title="Top countries" rows={data.topCountries.map(c => ({ label: c.country, value: c.users }))} />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">Last 30 days · Google Analytics 4</p>
    </div>
  );
}

// GSC search: clicks / impressions / CTR / position + top queries + pages (28 days).
export function SearchPanel({ data }: { data: GscSearch }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Clicks" value={data.clicks} />
        <MiniStat label="Impressions" value={data.impressions} />
        <MiniStat label="CTR" text={`${(data.ctr * 100).toFixed(1)}%`} />
        <MiniStat label="Avg position" text={data.position.toFixed(1)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatList title="Top queries" rows={data.topQueries.map(q => ({ label: q.query, value: q.clicks }))} />
        <StatList title="Top pages" rows={data.topPages.map(p => ({ label: p.page, value: p.clicks }))} />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">Last 28 days · Search Console</p>
    </div>
  );
}

// Bing search: clicks / impressions / CTR + top queries + pages. Bing clicks are
// sparse, so the lists rank by impressions (where the signal is).
export function BingPanel({ data }: { data: BingSearch }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Clicks" value={data.clicks} />
        <MiniStat label="Impressions" value={data.impressions} />
        <MiniStat label="CTR" text={`${(data.ctr * 100).toFixed(1)}%`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatList title="Top queries" rows={data.topQueries.map(q => ({ label: q.query, value: q.impressions }))} />
        <StatList title="Top pages" rows={data.topPages.map(p => ({ label: p.page, value: p.impressions }))} />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">Bing Webmaster Tools · ranked by impressions</p>
    </div>
  );
}

// A feeder-series submission row in the admin review list. File downloads go
// through the admin-gated /api/admin/submissions/[id] route (the base64 blob is
// never inlined into this page); links open the submitter's data source.
export function SubmissionRow({ s }: { s: SeriesSubmission }) {
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-semibold text-text">{s.seriesName}</span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-faint">
          {new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        <a href={`mailto:${s.contactEmail}`} className="hover:text-text">
          {s.contactEmail}
        </a>
        {s.season ? <span className="text-text-faint">{s.season}</span> : null}
        <SubmissionStatusBadge status={s.status} />
        {s.fileName ? (
          <a href={`/api/admin/submissions/${s.id}`} className="text-brand hover:underline">
            ↓ {s.fileName}
          </a>
        ) : null}
        {s.dataUrl ? (
          <a href={s.dataUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
            link ↗
          </a>
        ) : null}
      </div>
      {s.note ? <p className="mt-1 line-clamp-2 text-xs text-text-faint">{s.note}</p> : null}
    </li>
  );
}

export function SubmissionStatusBadge({ status }: { status: SeriesSubmission['status'] }) {
  const tone: Record<SeriesSubmission['status'], string> = {
    new: 'text-brand',
    reviewing: 'text-amber-400',
    ingested: 'text-emerald-400',
    rejected: 'text-text-faint',
  };
  return <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${tone[status]}`}>{status}</span>;
}

// A page's element ranking: Hot (most clicks) and Dead (seen but never clicked)
// lists, split per breakpoint. Dead elements are the wasted-space / sponsorship
// signal the operator asked for.
export function RankPanel({ panel }: { panel: HeatmapPathPanel }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
        <span className="truncate font-mono text-xs text-text">{panel.path}</span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-faint">
          {panel.total.toLocaleString()} clicks
        </span>
      </div>
      <div className="divide-y divide-border">
        {panel.breakpoints.map(bp => (
          <div key={bp.breakpoint} className="px-4 py-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">{bp.breakpoint}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <RankList
                title="Hot"
                tone="text-brand"
                rows={bp.hot}
                empty="No clicks yet"
                render={r => `${(r.ctr * 100).toFixed(0)}% CTR`}
              />
              <RankList
                title="Dead, candidates to sell"
                tone="text-text-faint"
                rows={bp.dead}
                empty="No dead zones yet"
                render={r => `${r.impressions.toLocaleString()} seen, 0 clicks`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// One ranked list (Hot or Dead), capped at the top 6 elements. `render` formats
// the right-hand metric per row (CTR for hot, impressions for dead).
export function RankList({
  title,
  tone,
  rows,
  empty,
  render,
}: {
  title: string;
  tone: string;
  rows: ElementRank[];
  empty: string;
  render: (r: ElementRank) => string;
}) {
  return (
    <div>
      <div className={`mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${tone}`}>{title}</div>
      {rows.length === 0 ? (
        <p className="font-mono text-[11px] text-text-faint">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, 6).map(r => (
            <li key={r.elementId} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-mono text-text">{r.elementId}</span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-faint">{render(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// A hub tile linking to one admin route: icon, title, one-line description, a live
// KPI glance (or "Open"), and a → affordance. Page-sized relative to ToolLink.
export function HubCard({
  href,
  icon: Icon,
  title,
  desc,
  glance,
}: {
  href: string;
  icon: IconType;
  title: string;
  desc: string;
  glance?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-xl border border-border bg-surface-elevated p-5 transition-colors duration-(--duration-fast) hover:border-brand"
    >
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden className="text-text-muted transition-colors duration-(--duration-fast) group-hover:text-brand">
          <Icon size={22} />
        </span>
        <ArrowRight size={15} className="mt-1 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="min-w-0">
        <div className="font-display text-lg font-bold uppercase tracking-wide text-text">{title}</div>
        <div className="mt-1 text-xs leading-relaxed text-text-faint">{desc}</div>
      </div>
      <div className="mt-auto font-mono text-[11px] uppercase tracking-[0.14em] tabular-nums text-text-muted">
        {glance ?? 'Open'}
      </div>
    </Link>
  );
}
