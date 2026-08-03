import type { Metadata } from 'next';
import { clerkClient } from '@clerk/nextjs/server';
import { Users } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-guard';
import { AdminPageHeader, KpiTile, Sparkline, TelemetryPanel, Unavailable } from '@/components/admin/AdminUI';
import { AuthorRequestActions } from '@/components/admin/AuthorRequestActions';
import { listAuthorRequests, type AuthorRequest } from '@/lib/author-requests';

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

// Pending become-an-author applications (/write-for-us). Fail-soft to []: the
// page must render even before the author_request migration exists in an env.
async function loadPendingRequests(): Promise<AuthorRequest[]> {
  try {
    return await listAuthorRequests('pending');
  } catch {
    return [];
  }
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const [users, requests] = await Promise.all([loadUserStats(), loadPendingRequests()]);
  const cadence = users ? signupCadence(users.recent) : [];

  return (
    <div>
      <AdminPageHeader title="Users" tagline="Accounts · roles · author applications · recent sign-ups" />
      {requests.length > 0 && (
        <div className="mb-6">
          <TelemetryPanel title="Author applications" meta={`${requests.length} pending`} flush>
            <ul className="divide-y divide-border">
              {requests.map(r => (
                <li key={r.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-text">{r.displayName}</span>
                    <span className="font-mono text-[11px] tabular-nums text-text-faint">
                      {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{r.pitch}</p>
                  {r.links && (
                    <p className="break-all font-mono text-[11px] text-text-faint">{r.links}</p>
                  )}
                  {r.sample && (
                    <details className="text-sm text-text-muted">
                      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">
                        Writing sample
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap leading-relaxed">{r.sample}</p>
                    </details>
                  )}
                  <AuthorRequestActions id={r.id} />
                </li>
              ))}
            </ul>
          </TelemetryPanel>
        </div>
      )}
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
