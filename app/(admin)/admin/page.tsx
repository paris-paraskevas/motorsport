import type { Metadata } from 'next';
import Link from 'next/link';
import { clerkClient } from '@clerk/nextjs/server';
import { requireAdmin } from '@/lib/admin-guard';
import { heatmapAdminOverview } from '@/lib/heatmap';
import { listAuthorRequests } from '@/lib/author-requests';
import { listSeriesSubmissions } from '@/lib/feeder';
import { listPosts } from '@/lib/blog';
import { readHealthReport, type HealthReport } from '@/lib/health-store';
import { getSourceHealth, type SourceHealth } from '@/lib/source-snapshot';
import { loadLiveHomeLayout, pinnedLeadSlug } from '@/lib/home-layout';
import { listFeedback, type FeedbackItem } from '@/lib/feedback';
import { listThreads, type Thread } from '@/lib/threads';
import { AdminPageHeader, TelemetryPanel } from '@/components/admin/AdminUI';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin' };

// The console hub, rebuilt around ANSWERING rather than linking.
//
// It used to be five cards to five pages with one word of state each, and on a
// normal day three of those words were "Nothing waiting" — which is why it went
// unopened. NN/g's distinction is exact: data you can act on at a glance is a
// dashboard; a grid of doors is a portal.
//
// So the screen opens on the two things that are ever urgent — is the data
// healthy, and what has a person waiting on it — and everything else is a fact
// rather than a door. Health is one KV read (lib/health-store.ts), never a live
// fan-out. Everything is fail-soft: a Clerk, Supabase or KV blip drops one row
// to a neutral state rather than 500ing the console.

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: 'good' | 'bad' }) {
  const colour = tone === 'good' ? 'text-positive' : tone === 'bad' ? 'text-negative' : 'text-text';
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface-elevated p-4">
      <div className={`truncate font-display text-3xl font-extrabold tabular-nums ${colour}`}>{value}</div>
      <div className="mt-1 truncate font-mono text-10 uppercase tracking-[0.14em] text-text-muted">{label}</div>
    </div>
  );
}

/** One thing with a person waiting: what it is, how long, and the way to it. */
function TaskRow({ what, detail, href, action }: { what: string; detail: string; href: string; action: string }) {
  const external = href.startsWith('http');
  const cls = 'group flex items-center gap-3 px-4 py-3 transition-colors duration-(--duration-fast) hover:bg-surface';
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-text">{what}</span>
        <span className="block truncate text-xs text-text-muted">{detail}</span>
      </span>
      <span className="shrink-0 rounded-lg border border-border px-2.5 py-1 font-mono text-10 uppercase tracking-[0.14em] text-text-muted group-hover:border-brand group-hover:text-brand">
        {action}
      </span>
    </>
  );
  return external ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}

/** The date a thing started waiting, not an age.
 *
 *  "3 days ago" needs the clock, and reading the clock during render is impure
 *  (react-hooks/purity catches it) — as well as being wrong the moment the HTML
 *  is cached. Parsing a fixed ISO string is pure, and an absolute date is what
 *  the rest of the console already shows on its rows. */
function waitingSince(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'unknown' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default async function AdminPage() {
  await requireAdmin();

  const [heat, accounts, layout, pendingAuthors, submissions, inReview, report, sources, pendingThreads, feedback] =
    await Promise.all([
    safe(() => heatmapAdminOverview(), []),
    safe(async () => (await clerkClient()).users.getCount(), null as number | null),
    loadLiveHomeLayout(),
    safe(() => listAuthorRequests('pending'), []),
    safe(() => listSeriesSubmissions(20), []),
    safe(() => listPosts('in_review'), []),
    safe(() => readHealthReport(), null as HealthReport | null),
    safe(() => getSourceHealth(), [] as SourceHealth[]),
    safe(() => listThreads('pending'), [] as Thread[]),
    safe(() => listFeedback(), [] as FeedbackItem[]),
  ]);

  const totalClicks = heat.reduce((sum, p) => sum + p.total, 0);
  const stale = sources.filter(s => s.stale).length;
  const seriesTotal = report ? Math.max(report.standings.total, report.results.total, report.sessions.total) : 0;
  // A series failing two checks is ONE unhealthy series, not two — the set
  // matters here, or one broken upstream reads as a wave of failures.
  const downSlugs = report
    ? [...new Set([...report.standings.downSlugs, ...report.results.downSlugs, ...report.sessions.flaggedSlugs])]
    : [];

  // Order is deliberate: broken data first, then people waiting. A queue sorted
  // any other way buries the thing that has been ignored longest.
  const tasks: { what: string; detail: string; href: string; action: string }[] = [];
  if (downSlugs.length > 0) {
    tasks.push({
      what: `${downSlugs.length} ${downSlugs.length === 1 ? 'series is' : 'series are'} failing a data check`,
      detail: downSlugs.join(', '),
      href: '/admin/system',
      action: 'Open',
    });
  }
  if (stale > 0) {
    tasks.push({
      what: `${stale} ${stale === 1 ? 'source has' : 'sources have'} not refreshed in a day`,
      detail: 'Readers are being served old data for these feeds',
      href: '/admin/system',
      action: 'Open',
    });
  }
  for (const p of inReview) {
    tasks.push({
      what: p.title,
      detail: `Waiting on review · since ${waitingSince(p.updatedAt ?? p.createdAt)}`,
      href: `${SITE_URL}/studio/${p.id}`,
      action: 'Review',
    });
  }
  for (const r of pendingAuthors) {
    tasks.push({
      what: `Author application — ${r.displayName}`,
      detail: `Pending · since ${waitingSince(r.createdAt)}`,
      href: '/admin/audience',
      action: 'Decide',
    });
  }
  for (const t of pendingThreads) {
    tasks.push({
      what: `Thread — ${t.title}`,
      detail: `Awaiting moderation · since ${waitingSince(t.createdAt)}`,
      href: '/admin/audience',
      action: 'Moderate',
    });
  }
  for (const f of feedback.filter(f => f.status === 'open')) {
    tasks.push({
      what: `Feedback — ${f.title}`,
      detail: `${f.kind} · since ${waitingSince(f.createdAt)}`,
      href: '/admin/audience',
      action: 'Triage',
    });
  }
  for (const s of submissions.filter(s => s.status === 'new')) {
    tasks.push({
      what: `Data sent in for ${s.seriesName}`,
      detail: `Unreviewed · since ${waitingSince(s.createdAt)}`,
      href: '/admin/content',
      action: 'Read',
    });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Console" tagline="Is the site all right, and what should I do next" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          value={report ? `${seriesTotal - downSlugs.length}/${seriesTotal}` : '—'}
          label="series healthy"
          tone={report ? (downSlugs.length === 0 ? 'good' : 'bad') : undefined}
        />
        <Stat value={String(stale)} label="sources stale" tone={stale === 0 ? 'good' : 'bad'} />
        <Stat value={String(tasks.length)} label="needing you" tone={tasks.length === 0 ? 'good' : undefined} />
        <Stat value={accounts === null ? '—' : accounts.toLocaleString()} label="accounts" />
      </div>

      <TelemetryPanel
        title="Needs you"
        meta={tasks.length === 0 ? 'clear' : `${tasks.length} ${tasks.length === 1 ? 'item' : 'items'}`}
        flush
      >
        {tasks.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-text-muted">
            Nothing is waiting and nothing is failing. The health check runs every six hours; anything it finds
            appears here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((t, i) => (
              <li key={`${t.href}-${i}`}>
                <TaskRow {...t} />
              </li>
            ))}
          </ul>
        )}
      </TelemetryPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <TelemetryPanel title="The site right now" flush>
          <ul className="divide-y divide-border">
            <li className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="text-text-muted">Home page lead</span>
              <span className="font-mono text-11 uppercase tracking-[0.14em] text-text">
                {pinnedLeadSlug(layout) ? 'pinned by you' : 'automatic'}
              </span>
            </li>
            <li className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="text-text-muted">Last data check</span>
              <span className="font-mono text-11 uppercase tracking-[0.14em] text-text">
                {report ? (report.ok ? 'all clear' : `${report.down} failing`) : 'none yet'}
              </span>
            </li>
            <li className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="text-text-muted">Clicks tracked</span>
              <span className="font-mono text-11 tabular-nums text-text">{totalClicks.toLocaleString()}</span>
            </li>
          </ul>
        </TelemetryPanel>

        <TelemetryPanel title="Where to go" flush>
          <ul className="divide-y divide-border">
            <li>
              <TaskRow
                what="System"
                detail="Data health, freshness, what is switched on"
                href="/admin/system"
                action="Open"
              />
            </li>
            <li>
              <TaskRow
                what="Site"
                detail="Arrange the home page and choose what leads"
                href="/admin/site"
                action="Open"
              />
            </li>
            <li>
              <TaskRow
                what="Studio"
                detail="Write, review and schedule posts"
                href={`${SITE_URL}/studio`}
                action="Open"
              />
            </li>
            <li>
              <TaskRow
                what="Traffic"
                detail="Click heatmap, hot and dead zones"
                href="/admin/traffic"
                action="Open"
              />
            </li>
          </ul>
        </TelemetryPanel>
      </div>
    </div>
  );
}
