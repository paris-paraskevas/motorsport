import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requireAuthor } from '@/lib/admin-guard';
import { PAGE_WIDE } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Shared, writer-gated shell for the /studio surface (the blog's authoring +
// moderation home — the public /blog page carries none of it any more).
// requireAuthor() 404s everyone below contributor, anonymous included (defence in
// depth: the pages re-check to scope their queries); robots noindex keeps the
// workspace out of search. Every page below is per-user, hence force-dynamic.
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  await requireAuthor();
  return (
    <div className={PAGE_WIDE}>
      <Link
        href="/blog"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
      >
        <ChevronLeft size={13} /> Blog
      </Link>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
