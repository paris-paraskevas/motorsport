import type { Metadata } from 'next';
import { clerkClient } from '@clerk/nextjs/server';
import { Users } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-guard';
import { AdminPageHeader, KpiTile, Sparkline, TelemetryPanel, Unavailable } from '@/components/admin/AdminUI';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Users · Admin' };

interface UserRow {
  id: string;
  name: string;
  role: string | null;
  at: number;
}

// Live Clerk user stats — total account count + the 25 most recent sign-ups (with
// their role). Fail-soft: the admin must never 500 on a Clerk API blip (it shows
// "unavailable" instead). Uses only getCount + getUserList (both proven).
async function loadUserStats(): Promise<{ count: number; recent: UserRow[] } | null> {
  try {
    const client = await clerkClient();
    const [count, list] = await Promise.all([
      client.users.getCount(),
      client.users.getUserList({ limit: 25, orderBy: '-created_at' }),
    ]);
    const recent: UserRow[] = list.data.map(u => ({
      id: u.id,
      name:
        [u.firstName, u.lastName].filter(Boolean).join(' ') ||
        u.username ||
        u.emailAddresses[0]?.emailAddress ||
        u.id,
      role: typeof u.publicMetadata?.role === 'string' ? u.publicMetadata.role : null,
      at: u.createdAt,
    }));
    return { count, recent };
  } catch {
    return null;
  }
}

// Daily new-sign-up counts across the window the recent sign-ups span (from Clerk
// createdAt), oldest to newest — a real cadence series for the KPI sparkline.
// Returns [] when there aren't at least two distinct days to trend.
function signupCadence(recent: UserRow[]): number[] {
  if (recent.length < 2) return [];
  const days = recent.map(u => Math.floor(u.at / 86_400_000));
  const min = Math.min(...days);
  const max = Math.max(...days);
  if (max === min) return [];
  const series: number[] = new Array(max - min + 1).fill(0);
  for (const d of days) series[d - min] += 1;
  return series;
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await loadUserStats();
  const cadence = users ? signupCadence(users.recent) : [];

  return (
    <div>
      <AdminPageHeader title="Users" tagline="Accounts · roles · recent sign-ups" />
      {users === null ? (
        <Unavailable note="Clerk API unavailable right now." />
      ) : (
        <div className="space-y-6">
          <div className="sm:max-w-xs">
            <KpiTile
              icon={Users}
              label="Total accounts"
              value={users.count.toLocaleString()}
              hint={`${users.recent.length} most recent below`}
              spark={cadence.length >= 2 ? <Sparkline values={cadence} /> : undefined}
            />
          </div>
          {users.recent.length === 0 ? (
            <Unavailable note="No sign-ups yet." />
          ) : (
            <TelemetryPanel title="Recent sign-ups" meta={`${users.count.toLocaleString()} total`} flush>
              <ul className="divide-y divide-border">
                {users.recent.map(u => (
                  <li key={u.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-text">{u.name}</span>
                      {u.role ? (
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-brand">
                          {u.role}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-faint">
                      {new Date(u.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </li>
                ))}
              </ul>
            </TelemetryPanel>
          )}
        </div>
      )}
    </div>
  );
}
