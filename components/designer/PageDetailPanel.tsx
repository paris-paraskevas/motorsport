'use client';

import { ArrowLeft } from 'lucide-react';
import { PAGE_GROUP_LABELS } from '@/lib/design/page-registry';
import { EMPTY_DOCUMENT } from '@/lib/design/page-document';
import type { PageDetail } from '@/lib/design/page-revisions';
import { LayoutSchematic } from './LayoutSchematic';

// One page in the App Builder (Phase 3 step 2a): its facts, its revisions and
// the schematic of its newest revision, read-only. Laying out regions and
// saving them (step 2b) and serving the page (step 3) come next; this screen
// shows what is stored and says so.

const AUTHZ_LABEL: Record<string, string> = {
  public: 'Everyone',
  signed_in: 'Signed in',
  contributor: 'Approved writers',
  administrator: 'Administrators',
};

const PBTN =
  'inline-flex items-center gap-1.5 border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text';

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

export function PageDetailPanel({ detail, onBack }: { detail: PageDetail; onBack: () => void }) {
  const { page, live, newest, revisions } = detail;
  const document = newest?.document ?? EMPTY_DOCUMENT;
  return (
    <div>
      <button type="button" className={`${PBTN} mb-3`} onClick={onBack}>
        <ArrowLeft size={11} /> All pages
      </button>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">{page.name}</h2>
      <p className="m-0 mb-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-11 text-text-muted">
        <span>{page.path}</span>
        <span>{page.group ? PAGE_GROUP_LABELS[page.group] : 'no group'}</span>
        <span>{page.kind === 'code' ? 'served by the code' : 'served from a revision'}</span>
        <span>{page.rendering === 'dynamic' ? 'renders each visit' : 'cached'}</span>
        <span>{page.indexable ? 'indexed' : 'not indexed'}</span>
        <span>{page.authz ? (AUTHZ_LABEL[page.authz] ?? page.authz) : 'Everyone'}</span>
      </p>

      {page.kind === 'code' ? (
        <p className="mb-4 max-w-[70ch] text-12 text-text-muted">
          The code serves this page; the designer lists it so a page made here can never take its path. It has no layout
          document.
        </p>
      ) : (
        <>
          <p className="mb-4 max-w-[76ch] text-13 text-text-muted">
            {newest
              ? `The newest revision, ${newest.publishedAt ? 'published' : 'a draft'} from ${when(newest.createdAt)}, drawn on the schematic below.`
              : 'No revision yet: the schematic is empty.'}{' '}
            {live ? `The live revision is from ${when(live.publishedAt ?? live.createdAt)}.` : 'Nothing is published.'} Laying out
            regions and saving them arrives with the next step; serving the page to visitors with the step after. Until
            then this shows what is stored.
          </p>
          {newest && newest.problems.length > 0 && (
            <p className="mb-3 max-w-[76ch] border border-border-strong bg-surface px-3 py-2 text-12 text-negative">
              The stored document has problems the reader worked around: {newest.problems.join('; ')}.
            </p>
          )}
          <LayoutSchematic document={document} />

          <h3 className="mb-2 mt-5 text-13 font-bold text-text">Revisions</h3>
          {revisions.length === 0 ? (
            <p className="text-12 text-text-faint">None yet.</p>
          ) : (
            <div className="border border-border-strong bg-surface">
              <table className="w-full border-collapse text-12">
                <thead>
                  <tr className="text-left text-text-faint">
                    <th className="px-2.5 py-1.5 font-semibold">Saved</th>
                    <th className="px-2.5 py-1.5 font-semibold">State</th>
                    <th className="px-2.5 py-1.5 font-semibold">By</th>
                    <th className="px-2.5 py-1.5 font-semibold">Revision</th>
                  </tr>
                </thead>
                <tbody>
                  {revisions.map(r => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-2.5 py-1.5 font-mono text-11 text-text-muted">{when(r.createdAt)}</td>
                      <td className="px-2.5 py-1.5 text-text">
                        {r.publishedAt ? (live && live.id === r.id ? 'live' : 'published, superseded') : 'draft'}
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-11 text-text-faint">{r.author ? r.author.slice(0, 12) : '—'}</td>
                      <td className="px-2.5 py-1.5 font-mono text-9 text-text-faint">{r.id.slice(0, 8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
