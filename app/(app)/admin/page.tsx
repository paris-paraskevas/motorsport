import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  MessageSquare,
  MousePointerClick,
  Newspaper,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { isAdmin } from '@/lib/threads';
import { PAGE_READ } from '@/lib/site';
import { topHeatmaps, GRID, type PathHeat } from '@/lib/heatmap';

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

// Admin console — one screen for who's using Paddock and how (operator ask). The
// GA4 (traffic) + Search Console (search) panels light up once their API creds
// are set; Clerk user stats are live now; the click heatmap lands next. 404s for
// non-admins (Clerk publicMetadata.role === 'admin'), noindex.
export default async function AdminPage() {
  if (!isAdmin(await currentUser())) notFound();
  const [users, heat] = await Promise.all([loadUserStats(), topHeatmaps(6)]);
  const ga4Connected = Boolean(process.env.GA4_PROPERTY_ID);
  const gscConnected = Boolean(process.env.GSC_SITE_URL);

  return (
    <div className={PAGE_READ}>
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

      {/* Users — live from Clerk */}
      <Section icon={Users} title="Users">
        {users === null ? (
          <Unavailable note="Clerk API unavailable right now." />
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total accounts" value={users.count} />
              <Stat label="Recent" value={users.recent.length} />
            </div>
            {users.recent.length > 0 && (
              <ul className="divide-y divide-border">
                {users.recent.map(u => (
                  <li key={u.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                    <span className="truncate text-text">{u.name}</span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-faint">
                      {new Date(u.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>

      {/* Traffic — Google Analytics 4 (needs GA4_PROPERTY_ID + a service account) */}
      <Section icon={BarChart3} title="Traffic (Google Analytics)">
        {ga4Connected ? (
          <Unavailable note="GA4 is configured — data panels wire up in a follow-up." />
        ) : (
          <NotConnected what="Google Analytics 4" env="GA4_PROPERTY_ID + a Data API service account" />
        )}
      </Section>

      {/* Search — Search Console (needs GSC_SITE_URL + a service account) */}
      <Section icon={Search} title="Search (Search Console)">
        {gscConnected ? (
          <Unavailable note="Search Console is configured — data panels wire up in a follow-up." />
        ) : (
          <NotConnected what="Google Search Console" env="GSC_SITE_URL + a service account" />
        )}
      </Section>

      {/* Behaviour — the self-captured click heatmap */}
      <Section icon={MousePointerClick} title="Behaviour — click heatmap">
        {heat.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-6 text-center">
            <p className="text-sm text-text-muted">
              A self-hosted click heatmap — where on each page people click (and the dead zones to sell). No data
              yet; it fills as people browse (analytics-consent only, anonymous).
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 font-mono text-[11px] leading-relaxed text-text-faint">
              Hottest pages by clicks — brighter = more clicks in that viewport region. Cold zones are candidates for
              sponsorships.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {heat.map(h => (
                <HeatGrid key={h.path} heat={h} />
              ))}
            </div>
          </>
        )}
      </Section>

      {/* Existing admin tools, gathered in one place */}
      <Section icon={Sparkles} title="Tools">
        <div className="grid gap-2 sm:grid-cols-2">
          <ToolLink href="/settings/assistant" icon={Sparkles} label="Assistant insights" desc="What people ask the Race Engineer" />
          <ToolLink href="/blog" icon={Newspaper} label="Blog queue" desc="Draft → approve → schedule" />
          <ToolLink href="/threads" icon={MessageSquare} label="Threads moderation" desc="Approve community threads" />
          <ToolLink href="/feedback" icon={MessageSquare} label="Feedback board" desc="What users report" />
        </div>
      </Section>

      <p className="mt-6 font-mono text-[11px] leading-relaxed text-text-faint">
        Admin-only (Clerk role). Reachable at <span className="text-text-muted">dev.paddock-tracker.com</span> once the
        subdomain is pointed here.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3">
      <div className="font-display text-2xl font-extrabold tabular-nums text-text">{value.toLocaleString()}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{label}</div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
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

// A page's click heatmap: a GRIDxGRID viewport grid, each cell brand-tinted by
// its share of that page's max cell count. Aspect-video mirrors a landscape
// viewport so hot regions map to where they were clicked.
function HeatGrid({ heat }: { heat: PathHeat }) {
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < GRID * GRID; i++) {
    const n = heat.cells[i] ?? 0;
    const o = heat.max > 0 && n > 0 ? 0.12 + (n / heat.max) * 0.88 : 0;
    cells.push(<div key={i} style={o > 0 ? { backgroundColor: `rgba(255,180,0,${o.toFixed(3)})` } : undefined} />);
  }
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate font-mono text-xs text-text">{heat.path}</span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-faint">
          {heat.total.toLocaleString()} clicks
        </span>
      </div>
      <div
        className="grid aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface"
        style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {cells}
      </div>
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
