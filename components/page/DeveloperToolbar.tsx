import Link from 'next/link';
import type { PageRow } from '@/lib/design/pages';

// The runtime developer toolbar (APEX: the Developer Toolbar on a running
// page), Phase 3 step 6. Shown to an administrator on a revision preview only:
// which page and which revision this is, whether it is the one visitors see,
// and the way back to the designer. Public pages never carry it, so they stay
// cached renders.

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

export function DeveloperToolbar({
  page,
  revisionId,
  createdAt,
  publishedAt,
  isLive,
  problems,
}: {
  page: PageRow;
  revisionId: string;
  createdAt: string;
  publishedAt: string | null;
  isLive: boolean;
  problems: string[];
}) {
  const state = isLive ? 'the live revision' : publishedAt ? 'published, superseded' : 'a draft';
  return (
    <div
      role="region"
      aria-label="Developer toolbar"
      className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-text bg-text px-4 py-2 font-mono text-10 uppercase tracking-[0.14em] text-bg"
    >
      <span className="font-semibold">Preview</span>
      <span>{page.name}</span>
      <span>
        revision {revisionId.slice(0, 8)} · {state} · saved {when(createdAt)}
      </span>
      {problems.length > 0 && <span className="text-brand">{problems.length} problem{problems.length === 1 ? '' : 's'} in the stored document</span>}
      <span className="flex-1" />
      <Link href={`/admin/designer?ws=builder&page=${page.id ?? ''}`} className="underline underline-offset-2 hover:text-brand">
        Edit in the designer
      </Link>
      <Link href={page.path} className="underline underline-offset-2 hover:text-brand">
        The live page
      </Link>
      <span className="normal-case tracking-normal text-bg/70">Only administrators see this address.</span>
    </div>
  );
}
