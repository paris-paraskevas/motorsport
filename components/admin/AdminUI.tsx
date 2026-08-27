import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { SeriesSubmission } from '@/lib/feeder';
import type { HeatmapPathPanel, ElementRank } from '@/lib/heatmap';

// Server-rendered UI kit for the /admin console. All server-safe (no hooks, no
// client state) so every admin route can compose these directly. The telemetry
// aesthetic — accent, mono/display type, hairline borders and inline-SVG
// sparklines — lives here so the console reads as one instrument panel, not a
// templated card wall. Client interactivity (the heatmap overlay, the nav rail,
// the home composer) lives in its own 'use client' components.
//
// The GA4 / Search Console / Bing panels were removed in 0.334.27 along with the
// two pages that rendered them: read-only reporting that duplicated Google's own
// console and cost ~352 KiB gzipped of a 10 MiB Worker budget that had 19 KiB
// left. MiniStat, DataBar, StatList and NotConnected went with them — every use
// of all four was inside those panels.

type IconType = React.ComponentType<{ size?: number; className?: string }>;

// Page masthead: an amber index bar + a mono/display title with the signature
// "." accent + a one-line tagline. One per admin route, above the content.
export function AdminPageHeader({ title, tagline }: { title: string; tagline: string }) {
  return (
    <header className="mb-6 flex items-stretch gap-3">
      <span aria-hidden className="w-1 shrink-0 bg-brand-fill" />
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
// so a divide-y list sits edge-to-edge under the header.
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
    <div className="min-w-0 rounded-xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{label}</span>
        <Icon size={14} className="shrink-0 text-text-faint" />
      </div>
      <div className="mt-2 truncate font-display text-3xl font-extrabold tabular-nums text-text">{value}</div>
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

export function Unavailable({ note }: { note: string }) {
  return <p className="font-mono text-sm text-text-faint">{note}</p>;
}

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
    reviewing: 'text-text-muted',
    ingested: 'text-positive',
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
