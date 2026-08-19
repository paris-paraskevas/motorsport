import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { getThread, isAdmin } from '@/lib/threads';
import { PAGE_READ } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Thread', robots: { index: false, follow: false } };

function frame(children: ReactNode) {
  return (
    <div className={PAGE_READ}>
      <Link
        href="/threads"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
      >
        <ArrowLeft size={13} /> Threads
      </Link>
      {children}
    </div>
  );
}

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isBettingConfigured()) return frame(<p className="font-mono text-sm text-text-muted">Not live yet.</p>);

  const thread = await getThread(id);
  if (!thread) return frame(<p className="font-mono text-sm text-text-muted">Thread not found.</p>);

  const { userId } = await auth();
  const user = userId ? await currentUser() : null;
  // A non-approved thread is visible only to its author + admins (never leak a
  // pending/rejected submission to the public).
  const canSee = thread.status === 'approved' || isAdmin(user) || (!!userId && userId === thread.authorId);
  if (!canSee) return frame(<p className="font-mono text-sm text-text-muted">Thread not found.</p>);

  return frame(
    <article>
      {thread.status !== 'approved' && (
        <span className="mb-2 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-brand">
          {thread.status === 'pending' ? 'Pending review' : 'Rejected'}
        </span>
      )}
      <h1 className="font-serif text-[30px] font-medium leading-[1.1] tracking-[-0.02em] text-text md:text-[38px]">
        {thread.title}
      </h1>
      <div className="mt-2 border-y border-border py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        {thread.authorName ?? `Racer ${thread.authorId.slice(-4)}`}
      </div>
      <p className="mt-4 max-w-[68ch] whitespace-pre-wrap font-serif text-[17px] leading-relaxed text-text">{thread.body}</p>
    </article>,
  );
}
