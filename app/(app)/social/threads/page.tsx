import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { listThreads, isAdmin } from '@/lib/threads';
import { loadAllSeriesMeta } from '@/lib/series';
import { ThreadComposer } from '@/components/threads/ThreadComposer';
import { ThreadModeration } from '@/components/threads/ThreadModeration';
import { PAGE_READ } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Threads',
  description: 'Community threads — fan discussion across the grid, lightly moderated.',
};

// Paper masthead (round-2 ⑨) — the display-caps register was pre-reimagining.
function frame(children: ReactNode) {
  return (
    <div className={PAGE_READ}>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="font-serif text-[38px] font-medium leading-none tracking-[-0.02em] text-text md:text-[46px]">
          Threads
        </h1>
        <p className="mt-2 max-w-[52ch] font-serif text-[16px] leading-snug text-text-muted">
          Fan discussion across the grid, lightly moderated — start one or join in.
        </p>
      </header>
      {children}
    </div>
  );
}

export default async function ThreadsPage({
  searchParams,
}: {
  searchParams: Promise<{ series?: string }>;
}) {
  if (!isBettingConfigured()) return frame(<p className="font-mono text-sm text-text-muted">Not live yet.</p>);
  const { userId } = await auth();
  const { series: rawSeries } = await searchParams;
  const user = userId ? await currentUser() : null;
  const admin = isAdmin(user);
  const allSeries = await loadAllSeriesMeta();
  // Validate the ?series= filter against real slugs; ignore anything unknown.
  const seriesFilter = rawSeries && allSeries.some(s => s.slug === rawSeries) ? rawSeries : undefined;
  const filterName = seriesFilter ? allSeries.find(s => s.slug === seriesFilter)?.name : undefined;
  const seriesOptions = allSeries.map(s => ({ slug: s.slug, name: s.name }));
  const [approved, pending] = await Promise.all([
    listThreads('approved', seriesFilter),
    admin ? listThreads('pending') : Promise.resolve([]),
  ]);

  return frame(
    <div className="space-y-8">
      {seriesFilter && (
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
          Filtered to <span className="text-text">{filterName}</span> ·{' '}
          <Link href="/social/threads" className="text-brand underline underline-offset-2">
            Show all
          </Link>
        </p>
      )}
      {userId ? (
        <ThreadComposer series={seriesOptions} defaultSeries={seriesFilter ?? ''} />
      ) : (
        <p className="font-mono text-sm text-text-muted">
          <Link href="/sign-in" className="text-brand underline underline-offset-2">
            Sign in
          </Link>{' '}
          to start a thread.
        </p>
      )}

      {admin && (
        <section>
          <h2 className="mb-2 border-b border-text pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Pending review · {pending.length}
          </h2>
          {pending.length === 0 ? (
            <p className="font-mono text-sm text-text-muted">Nothing waiting.</p>
          ) : (
            <ThreadModeration threads={pending} />
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 border-b border-text pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Latest
        </h2>
        {approved.length === 0 ? (
          <p className="font-mono text-sm text-text-muted">No threads yet — be the first.</p>
        ) : (
          <ul>
            {approved.map(t => (
              <li key={t.id}>
                <Link
                  href={`/threads/${t.id}`}
                  className="group block border-b border-border py-3 transition-colors duration-(--duration-fast) hover:bg-surface"
                >
                  <span className="block font-serif text-[17px] font-semibold leading-snug text-text transition-colors duration-(--duration-fast) group-hover:text-brand">
                    {t.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
                    {t.authorName ?? `Racer ${t.authorId.slice(-4)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>,
  );
}
