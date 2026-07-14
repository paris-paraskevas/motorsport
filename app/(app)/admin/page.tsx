import type { Metadata } from 'next';
import { clerkClient } from '@clerk/nextjs/server';
import { BarChart3, Inbox, MousePointerClick, Search, Sparkles, Users } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-guard';
import { heatmapAdminOverview } from '@/lib/heatmap';
import { AdminPageHeader, HubCard } from '@/components/admin/AdminUI';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin' };

// Fail-soft account count (Clerk) — the hub must never 500 on an API blip.
async function accountCount(): Promise<number | null> {
  try {
    const client = await clerkClient();
    return await client.users.getCount();
  } catch {
    return null;
  }
}

// Admin console hub: one card per route. The glance line uses ONLY our own infra
// (self-captured heatmap totals + the Clerk account count). The Google/Bing routes
// show "Open" with no outbound call, so landing on the hub never doubles our
// Analytics / Search quota — each sub-route fetches its own source on demand.
export default async function AdminPage() {
  await requireAdmin();
  const [heat, accounts] = await Promise.all([heatmapAdminOverview(), accountCount()]);
  const totalClicks = heat.reduce((sum, p) => sum + p.total, 0);

  const clicksGlance = totalClicks > 0 ? `${totalClicks.toLocaleString()} clicks tracked` : 'Open';
  const accountsGlance = accounts !== null ? `${accounts.toLocaleString()} accounts` : 'Open';

  return (
    <div>
      <AdminPageHeader title="Admin" tagline="Traffic · search · users · behaviour" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <HubCard
          href="/admin/traffic"
          icon={BarChart3}
          title="Traffic"
          desc="Audience and Core Web Vitals, from Google Analytics."
          glance="Open"
        />
        <HubCard
          href="/admin/search"
          icon={Search}
          title="Search"
          desc="Clicks, impressions and queries from Search Console and Bing."
          glance="Open"
        />
        <HubCard
          href="/admin/behaviour"
          icon={MousePointerClick}
          title="Behaviour"
          desc="The self-captured click heatmap, with hot and dead zones."
          glance={clicksGlance}
        />
        <HubCard
          href="/admin/users"
          icon={Users}
          title="Users"
          desc="Account totals and the most recent sign-ups."
          glance={accountsGlance}
        />
        <HubCard
          href="/admin/submissions"
          icon={Inbox}
          title="Submissions"
          desc="Feeder-series data sent in through /contribute."
          glance="Open"
        />
        <HubCard
          href="/admin/tools"
          icon={Sparkles}
          title="Tools"
          desc="Blog queue, threads and feedback moderation, and more."
          glance="Open"
        />
      </div>
    </div>
  );
}
