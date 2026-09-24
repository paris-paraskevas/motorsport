import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { accountId, currentAccount } from '@/lib/auth/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { isStaff, isAdmin } from '@/lib/threads';
import { FeedbackBoard } from '@/components/feedback/FeedbackBoard';
import { PAGE_READ } from '@/lib/site';
import { pageMetadata, withPageGate } from '@/lib/design/page-frame';

export const dynamic = 'force-dynamic';
// Private staff page — keep it out of search + the sitemap.
const BASE_METADATA: Metadata = { title: 'Feedback', robots: { index: false, follow: false } };
export const generateMetadata = pageMetadata('/feedback', BASE_METADATA);

async function FeedbackPage() {
  if (!isBettingConfigured()) notFound();
  const userId = await accountId();
  const user = userId ? await currentAccount() : null;
  // Everyday users + signed-out get a 404 — the page doesn't exist for them.
  if (!isStaff(user)) notFound();

  return (
    <div className={PAGE_READ}>
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand-fill" />
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text md:text-4xl">
          Feedback<span className="text-brand">.</span>
        </h1>
      </header>
      <p className="mb-6 font-mono text-sm text-text-muted">
        Bugs, feature requests and notes — staff only.{isAdmin(user) ? ' You can move an item’s status.' : ''}
      </p>
      <FeedbackBoard canManage={isAdmin(user)} />
    </div>
  );
}

export default withPageGate('/feedback', FeedbackPage);
