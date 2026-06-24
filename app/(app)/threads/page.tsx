import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { listThreads, isAdmin } from '@/lib/threads';
import { ThreadComposer } from '@/components/threads/ThreadComposer';
import { ThreadModeration } from '@/components/threads/ThreadModeration';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Threads',
  description: 'Community threads — fan discussion across the grid, lightly moderated.',
};

function frame(children: ReactNode) {
  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl p-4 pb-16 md:p-6 lg:p-8">
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text md:text-4xl">
          Threads<span className="text-brand">.</span>
        </h1>
      </header>
      {children}
    </div>
  );
}

export default async function ThreadsPage() {
  if (!isBettingConfigured()) return frame(<p className="font-mono text-sm text-text-muted">Not live yet.</p>);
  const { userId } = await auth();
  const user = userId ? await currentUser() : null;
  const admin = isAdmin(user);
  const [approved, pending] = await Promise.all([
    listThreads('approved'),
    admin ? listThreads('pending') : Promise.resolve([]),
  ]);

  return frame(
    <div className="space-y-8">
      {userId ? (
        <ThreadComposer />
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
          <h2 className="mb-2 font-display uppercase tracking-wide text-text">Pending review ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="font-mono text-sm text-text-muted">Nothing waiting.</p>
          ) : (
            <ThreadModeration threads={pending} />
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display uppercase tracking-wide text-text">Latest</h2>
        {approved.length === 0 ? (
          <p className="font-mono text-sm text-text-muted">No threads yet — be the first.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {approved.map(t => (
              <li key={t.id} className="py-3">
                <Link href={`/threads/${t.id}`} className="group block">
                  <span className="block font-semibold text-text transition-colors group-hover:text-brand">{t.title}</span>
                  <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">
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
