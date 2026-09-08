import type { Metadata } from 'next';
import { clerkClient } from '@clerk/nextjs/server';
import { Users } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-guard';
import { AdminPageHeader, KpiTile, Sparkline, TelemetryPanel, Unavailable } from '@/components/admin/AdminUI';
import { AuthorRequestActions } from '@/components/admin/AuthorRequestActions';
import { DonorToggle } from '@/components/admin/DonorToggle';
import { listAuthorRequests, type AuthorRequest } from '@/lib/author-requests';
import { listFeedback, type FeedbackItem } from '@/lib/feedback';
import { listThreads, type Thread } from '@/lib/threads';
import { FeedbackActions, ThreadActions } from '@/components/admin/ModerationActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Audience · Admin' };

interface UserRow {
  id: string;
  name: string;
  role: string | null;
  /** Supporter flag (publicMetadata.donor) — unlocks the studio's AI tools. */
  donor: boolean;
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
      donor: u.publicMetadata?.donor === true,
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

// Both queues are fail-soft to []: neither is load-bearing for the page, and a
// Supabase blip must not take the accounts panel down with it.
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const [users, requests, pendingThreads, feedback] = await Promise.all([
    loadUserStats(),
    loadPendingRequests(),
    safe(() => listThreads('pending'), [] as Thread[]),
    safe(() => listFeedback(), [] as FeedbackItem[]),
  ]);
  const cadence = users ? signupCadence(users.recent) : [];
  // Closed and done are history; the console shows what still needs deciding.
  const openFeedback = feedback.filter(f => f.status === 'open' || f.status === 'considered');

  return (
    <div>
      <AdminPageHeader title="Audience" tagline="Accounts · roles · what people are saying" />

      {pendingThreads.length > 0 && (
        <div className="mb-6">
          <TelemetryPanel title="Threads awaiting moderation" meta={`${pendingThreads.length} pending`} flush>
            <ul className="divide-y divide-border">
              {pendingThreads.map(t => (
                <li key={t.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-text">{t.title}</span>
                    <span className="font-mono text-11 tabular-nums text-text-faint">
                      {new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{t.body}</p>
                  <p className="font-mono text-11 text-text-faint">
                    {t.authorName ?? t.authorId}
                    {t.seriesSlug ? ` · ${t.seriesSlug}` : ''}
                  </p>
                  <ThreadActions id={t.id} />
                </li>
              ))}
            </ul>
          </TelemetryPanel>
        </div>
      )}

      {openFeedback.length > 0 && (
        <div className="mb-6">
          <TelemetryPanel title="Feedback" meta={`${openFeedback.length} to triage`} flush>
            <ul className="divide-y divide-border">
              {openFeedback.map(f => (
                <li key={f.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-text">{f.title}</span>
                    <span className="font-mono text-11 uppercase tracking-[0.14em] text-text-faint">
                      {f.kind}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{f.body}</p>
                  <p className="font-mono text-11 text-text-faint">
                    {f.authorName ?? f.authorId} ·{' '}
                    {new Date(f.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                  <FeedbackActions id={f.id} status={f.status} />
                </li>
              ))}
            </ul>
          </TelemetryPanel>
        </div>
      )}
      {requests.length > 0 && (
        <div className="mb-6">
          <TelemetryPanel title="Author applications" meta={`${requests.length} pending`} flush>
            <ul className="divide-y divide-border">
              {requests.map(r => (
                <li key={r.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-text">{r.displayName}</span>
                    <span className="font-mono text-11 tabular-nums text-text-faint">
                      {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{r.pitch}</p>
                  {r.links && (
                    <p className="break-all font-mono text-11 text-text-faint">{r.links}</p>
                  )}
                  {r.sample && (
                    <details className="text-sm text-text-muted">
                      <summary className="cursor-pointer font-mono text-11 uppercase tracking-[0.14em] text-text-faint">
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
                        <span className="shrink-0 font-mono text-10 uppercase tracking-[0.14em] text-brand">
                          {u.role}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      <DonorToggle userId={u.id} donor={u.donor} />
                      <span className="font-mono text-11 tabular-nums text-text-faint">
                        {new Date(u.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
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
