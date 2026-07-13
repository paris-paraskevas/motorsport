import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  MousePointerClick,
  Newspaper,
  Search,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import { isAdmin } from '@/lib/threads';
import { PAGE_WIDE } from '@/lib/site';
import { heatmapAdminOverview, overlayData, type HeatmapPathPanel, type ElementRank, type OverlayData, type Breakpoint } from '@/lib/heatmap';
import { listSeriesSubmissions, type SeriesSubmission } from '@/lib/feeder';
import { HeatmapOverlay } from '@/components/admin/HeatmapOverlay';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

// Live Clerk user stats — total + the most recent sign-ups. Fail-soft: the admin
// dashboard must never 500 on a Clerk API blip (it just shows "unavailable").
async function loadUserStats(): Promise<{ count: number; recent: { id: string; name: string; at: number }[] } | null> {
  try {
    const client = await clerkClient();
    const [count, list] = await Promise.all([
      client.users.getCount(),
      client.users.getUserList({ limit: 6, orderBy: '-created_at' }),
    ]);
    const recent = list.data.map(u => ({
      id: u.id,
      name:
        [u.firstName, u.lastName].filter(Boolean).join(' ') ||
        u.username ||
        u.emailAddresses[0]?.emailAddress ||
        u.id,
      at: u.createdAt,
    }));
    return { count, recent };
  } catch {
    return null;
  }
}

const EMPTY_OVERLAY: OverlayData = { clicks: [], scroll: { sample: 0, reached: [] }, rage: [], dead: [] };

// Admin-gated server action: fetch the overlay bundle (clicks + scroll + rage/dead)
// for one path+breakpoint on demand (the overlay's picker calls this). Re-checks
// admin — a server action is a POST endpoint anyone could invoke, so it must
// guard, not trust the caller.
async function loadOverlayData(path: string, breakpoint: Breakpoint): Promise<OverlayData> {
  'use server';
  if (!isAdmin(await currentUser())) return EMPTY_OVERLAY;
  return overlayData(path, { breakpoint });
}

// The dashboard's sections, in order. Drives both the sticky section-nav rail and
// the anchor targets, so nav and content can't drift out of sync.
const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'traffic', label: 'Traffic', icon: BarChart3 },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'behaviour', label: 'Behaviour', icon: MousePointerClick },
  { id: 'submissions', label: 'Submissions', icon: Inbox },
  { id: 'tools', label: 'Tools', icon: Sparkles },
] as const;

// Admin console — one screen for who's using Paddock and how (operator ask).
// Dashboard layout: a sticky section-nav rail + a KPI overview row + cards for
// Users (live Clerk), Traffic (GA4), Search (Search Console), Behaviour (the
// self-captured click heatmap) and Tools. GA4/GSC light up once their API creds
// are set. 404s for non-admins (Clerk publicMetadata.role === 'admin'), noindex.
export default async function AdminPage() {
  if (!isAdmin(await currentUser())) notFound();
  const [users, heat, submissions] = await Promise.all([
    loadUserStats(),
    heatmapAdminOverview(),
    listSeriesSubmissions(20),
  ]);
  // Seed the overlay with the busiest page (desktop) so it paints on first render;
  // the picker fetches other path/breakpoint combos via the loadOverlayData action.
  const overlayPaths = heat.map(p => p.path);
  const initialOverlay: OverlayData = heat[0] ? await overlayData(heat[0].path, { breakpoint: 'desktop' }) : EMPTY_OVERLAY;
  const ga4Connected = Boolean(process.env.GA4_PROPERTY_ID);
  const gscConnected = Boolean(process.env.GSC_SITE_URL);
  const totalClicks = heat.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className={PAGE_WIDE}>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
      >
        <ArrowLeft size={13} /> Account
      </Link>
      <header className="mb-6 flex items-stretch gap-3">
        <span aria-hidden className="w-1 shrink-0 bg-brand" />
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
            Admin<span className="text-brand">.</span>
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Traffic · users · search · behaviour
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <SectionNav />

        <div className="min-w-0 space-y-8">
          {/* Overview — KPI row */}
          <Section id="overview" icon={LayoutDashboard} title="Overview">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                icon={Users}
                label="Total accounts"
                value={users ? users.count.toLocaleString() : '—'}
                hint={users ? `${users.recent.length} shown below` : 'Clerk unavailable'}
              />
              <KpiCard
                icon={MousePointerClick}
                label="Tracked clicks"
                value={totalClicks > 0 ? totalClicks.toLocaleString() : '—'}
                hint={heat.length > 0 ? `across ${heat.length} page${heat.length === 1 ? '' : 's'}` : 'no data yet'}
              />
              <KpiCard
                icon={BarChart3}
                label="Traffic (30d)"
                value="—"
                hint={ga4Connected ? 'GA4 configured' : 'connect GA4'}
              />
              <KpiCard
                icon={Search}
                label="Search clicks"
                value="—"
                hint={gscConnected ? 'GSC configured' : 'connect GSC'}
              />
            </div>
          </Section>

          {/* Users — live from Clerk */}
          <Section id="users" icon={Users} title="Users">
            {users === null ? (
              <Unavailable note="Clerk API unavailable right now." />
            ) : users.recent.length === 0 ? (
              <Unavailable note="No sign-ups yet." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
                <ul className="divide-y divide-border">
                  {users.recent.map(u => (
                    <li key={u.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="truncate text-text">{u.name}</span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-faint">
                        {new Date(u.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* Traffic — Google Analytics 4 (needs GA4_PROPERTY_ID + a service account) */}
          <Section id="traffic" icon={BarChart3} title="Traffic — Google Analytics">
            {ga4Connected ? (
              <Unavailable note="GA4 is configured — data panels wire up in a follow-up." />
            ) : (
              <NotConnected what="Google Analytics 4" env="GA4_PROPERTY_ID + a Data API service account" />
            )}
          </Section>

          {/* Search — Search Console (needs GSC_SITE_URL + a service account) */}
          <Section id="search" icon={Search} title="Search — Search Console">
            {gscConnected ? (
              <Unavailable note="Search Console is configured — data panels wire up in a follow-up." />
            ) : (
              <NotConnected what="Google Search Console" env="GSC_SITE_URL + a service account" />
            )}
          </Section>

          {/* Behaviour — the self-captured click heatmap */}
          <Section id="behaviour" icon={MousePointerClick} title="Behaviour — click heatmap">
            {heat.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-6 text-center">
                <p className="text-sm text-text-muted">
                  A self-hosted click heatmap — where on each page people click (and the dead zones to sell). No data
                  yet; it fills as people browse (analytics-consent only, anonymous).
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
                    Ranked per page and viewport. Hot elements get the most clicks; Dead elements are seen but never
                    clicked (wasted space, candidates to sell).
                  </p>
                  <div className="space-y-4">
                    {heat.map(p => (
                      <RankPanel key={p.path} panel={p} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* Submissions — feeder-series data intake (/contribute) */}
          <Section
            id="submissions"
            icon={Inbox}
            title={submissions.length ? `Feeder submissions · ${submissions.length}` : 'Feeder submissions'}
          >
            {submissions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-6 text-center">
                <p className="text-sm text-text-muted">
                  Series that send their data via{' '}
                  <Link href="/contribute" className="text-brand hover:underline">
                    /contribute
                  </Link>{' '}
                  land here for review. None yet.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
                <ul className="divide-y divide-border">
                  {submissions.map(s => (
                    <SubmissionRow key={s.id} s={s} />
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* Tools — existing admin surfaces, gathered in one place */}
          <Section id="tools" icon={Sparkles} title="Tools">
            <div className="grid gap-2 sm:grid-cols-2">
              <ToolLink href="/settings/assistant" icon={Sparkles} label="Assistant insights" desc="What people ask the Race Engineer" />
              <ToolLink href="/blog" icon={Newspaper} label="Blog queue" desc="Draft → approve → schedule" />
              <ToolLink href="/threads" icon={MessageSquare} label="Threads moderation" desc="Approve community threads" />
              <ToolLink href="/feedback" icon={MessageSquare} label="Feedback board" desc="What users report" />
              <ToolLink href="/contribute" icon={Upload} label="Feeder intake" desc="Public series-data submit form" />
            </div>
          </Section>

          <p className="font-mono text-[11px] leading-relaxed text-text-faint">
            Admin-only (Clerk role). Reachable at <span className="text-text-muted">dev.paddock-tracker.com</span> once
            the subdomain is pointed here.
          </p>
        </div>
      </div>
    </div>
  );
}

// Sticky in-page navigation between dashboard sections. A vertical rail on lg+
// (sticks below the app header); a horizontally-scrollable chip strip on mobile.
// Anchor links, so it works with zero client JS.
function SectionNav() {
  return (
    <nav aria-label="Admin sections" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <li key={id} className="shrink-0">
            <a
              href={`#${id}`}
              className="flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:bg-surface-elevated hover:text-text"
            >
              <Icon size={13} className="shrink-0 text-text-faint" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// A single overview metric. `value` is pre-formatted (a count string or "—").
function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{label}</span>
        <Icon size={14} className="shrink-0 text-text-faint" />
      </div>
      <div className="mt-2 font-display text-3xl font-extrabold tabular-nums text-text">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-text-faint">{hint}</div> : null}
    </div>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
        <Icon size={13} className="text-text-faint" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function NotConnected({ what, env }: { what: string; env: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-5">
      <p className="text-sm text-text-muted">
        {what} isn&apos;t connected yet. Add <span className="font-mono text-xs text-text">{env}</span> to light up this
        panel.
      </p>
    </div>
  );
}

function Unavailable({ note }: { note: string }) {
  return <p className="font-mono text-sm text-text-faint">{note}</p>;
}

// A feeder-series submission row in the admin review list. File downloads go
// through the admin-gated /api/admin/submissions/[id] route (the base64 blob is
// never inlined into this page); links open the submitter's data source.
function SubmissionRow({ s }: { s: SeriesSubmission }) {
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

function SubmissionStatusBadge({ status }: { status: SeriesSubmission['status'] }) {
  const tone: Record<SeriesSubmission['status'], string> = {
    new: 'text-brand',
    reviewing: 'text-amber-400',
    ingested: 'text-emerald-400',
    rejected: 'text-text-faint',
  };
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${tone[status]}`}>{status}</span>
  );
}

// A page's element ranking: Hot (most clicks) and Dead (seen but never clicked)
// lists, split per breakpoint. Dead elements are the wasted-space / sponsorship
// signal the operator asked for. Replaces the old KV viewport-grid HeatGrid.
function RankPanel({ panel }: { panel: HeatmapPathPanel }) {
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
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
              {bp.breakpoint}
            </div>
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
function RankList({
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

function ToolLink({
  href,
  icon: Icon,
  label,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-3 transition-colors duration-(--duration-fast) hover:border-brand"
    >
      <span aria-hidden className="shrink-0 text-text-muted">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text">{label}</span>
        <span className="block truncate text-xs text-text-faint">{desc}</span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
