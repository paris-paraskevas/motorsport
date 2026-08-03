'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { isWriter } from '@/lib/threads';

// The one trace of the studio on the public /blog page: a quiet pill for
// signed-in writers/admins, null for everyone else. Client-side on purpose —
// /blog is revalidate-cached and must not go per-user dynamic for a role check.
// (threads.ts is client-safe; isWriter here matches the /studio server gate.)
export function StudioLink() {
  const { user } = useUser();
  if (!isWriter(user)) return null;
  return (
    <Link
      href="/studio"
      className="rounded border border-border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:border-brand/50 hover:text-text"
    >
      Studio →
    </Link>
  );
}
