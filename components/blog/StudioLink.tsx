'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { canAuthor } from '@/lib/threads';

// The author affordance on the public /blog page: authors get their Studio
// pill, everyone else (signed-out and pre-hydration included — that's the
// default render, so 99% of visitors see no swap) gets the Write-for-Paddock
// invitation. Client-side on purpose — /blog is revalidate-cached and must not
// go per-user dynamic for a role check. (threads.ts is client-safe; canAuthor
// matches the /studio server gate and reads an account's role, so the browser
// maps Clerk's user itself until A1b puts it on the seam.)
export function StudioLink() {
  const { user } = useUser();
  const pill =
    'rounded border border-border px-3 py-1.5 font-mono text-11 font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:border-brand/50 hover:text-text';
  if (canAuthor({ role: typeof user?.publicMetadata?.role === 'string' ? user.publicMetadata.role : null })) {
    return (
      <Link href="/studio" className={pill}>
        Studio →
      </Link>
    );
  }
  return (
    <Link href="/write-for-us" className={pill}>
      Write for Paddock →
    </Link>
  );
}
