import type { Metadata } from 'next';
import { clerkClient } from '@clerk/nextjs/server';
import { Activity, BarChart3, FileText, LayoutTemplate, NotebookPen, Users } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-guard';
import { heatmapAdminOverview } from '@/lib/heatmap';
import { listAuthorRequests } from '@/lib/author-requests';
import { listSeriesSubmissions } from '@/lib/feeder';
import { listPosts } from '@/lib/blog';
import { readHealthReport } from '@/lib/health-store';
import { loadLiveHomeLayout, pinnedLeadSlug } from '@/lib/home-layout';
import { AdminPageHeader, HubCard } from '@/components/admin/AdminUI';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin' };

// The console hub, rebuilt in 0.334.27 around DOING rather than linking. It used
// to be seven cards to seven pages, five of which only reported at you, and its
// "glance" line ran three queries to print three strings.
//
// Now the glance on each card is a COUNT OF WORK WAITING — applications to
// decide, drafts to review, submissions to read — so the hub answers "what needs
// me?" before you click anything. Everything is fail-soft: a Clerk or Supabase
// blip drops one glance to a neutral label rather than 500ing the console.

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function AdminPage() {
  await requireAdmin();

  const [heat, accounts, layout, pendingAuthors, submissions, inReview, health] = await Promise.all([
    safe(() => heatmapAdminOverview(), []),
    safe(async () => (await clerkClient()).users.getCount(), null as number | null),
    loadLiveHomeLayout(),
    safe(() => listAuthorRequests('pending'), []),
    safe(() => listSeriesSubmissions(20), []),
    safe(() => listPosts('in_review'), []),
    safe(() => readHealthReport(), null),
  ]);

  const totalClicks = heat.reduce((sum, p) => sum + p.total, 0);
  // One KV read, not fifteen series of live fan-out — see lib/health-store.ts.
  const healthGlance = health
    ? health.ok
      ? 'All series healthy'
      : `${health.down} needing attention`
    : 'No check yet';

  return (
    <div>
      <AdminPageHeader title="Console" tagline="What needs you, and what you can change" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {/* Order mirrors the rail. System leads because health is the only thing
            in here that is ever urgent. The full board arrives with the Overview
            rewrite; these cards are the interim. */}
        <HubCard
          href="/admin/system"
          icon={Activity}
          title="System"
          desc="Data health across every series, and what the site costs to run."
          glance={healthGlance}
        />
        <HubCard
          href="/admin/site"
          icon={LayoutTemplate}
          title="Site"
          desc="Arrange the home page bands and choose what leads, for everyone."
          glance={pinnedLeadSlug(layout) ? 'Lead pinned' : 'Automatic'}
        />
        <HubCard
          href="/admin/content"
          icon={FileText}
          title="Content"
          desc="Posts, Learn placement, and the data sent in through /contribute."
          glance={submissions.length > 0 ? plural(submissions.length, 'submission', 'submissions') : 'Nothing waiting'}
        />
        <HubCard
          href="/admin/audience"
          icon={Users}
          title="Audience"
          desc="Author applications, supporter flags and recent sign-ups."
          glance={
            pendingAuthors.length > 0
              ? plural(pendingAuthors.length, 'application', 'applications')
              : accounts !== null
                ? `${accounts.toLocaleString()} accounts`
                : 'Open'
          }
        />
        <HubCard
          href="/admin/traffic"
          icon={BarChart3}
          title="Traffic"
          desc="Our own click heatmap: what readers reach for, and what they never touch."
          glance={totalClicks > 0 ? `${totalClicks.toLocaleString()} clicks tracked` : 'Open'}
        />
        <HubCard
          href={`${SITE_URL}/studio`}
          icon={NotebookPen}
          title="Studio"
          desc="Write, review and schedule posts."
          glance={inReview.length > 0 ? plural(inReview.length, 'awaiting review', 'awaiting review') : 'Nothing waiting'}
        />
      </div>
    </div>
  );
}
