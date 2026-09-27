'use client';

import { useEffect, useRef, useState } from 'react';
import { useFollowedSeries } from '@/lib/useFollowedSeries';

/** The followed-series tint of a Data region (P2.4): after the page loads, the rows of the region whose `data-series` the
 *  reader follows are marked `data-followed` (the stylesheet tints them); every other row loses the mark. The reader's list
 *  lives in the browser and the account, never on the cached page, so the server draws nothing of it; the site's `null`
 *  ("follow everything") marks nothing. Draws nothing of its own. */
export function FollowedRows({ region }: { region: string }) {
  const { followed } = useFollowedSeries();
  useEffect(() => {
    const root = document.getElementById(`region-${region}`);
    if (!root) return;
    for (const el of root.querySelectorAll('[data-series]')) {
      const slug = el.getAttribute('data-series');
      if (slug && followed !== null && followed.includes(slug)) el.setAttribute('data-followed', '');
      else el.removeAttribute('data-followed');
    }
  }, [followed, region]);
  return null;
}

/** The reader's scope over a region's rows (P2.5 PR C; the News page's Everything and Yours only, as its route file drew them):
 *  for a reader who follows series, two chips above the rows, Yours only first as the route had it, hiding every row of another
 *  series (`hidden`, the stylesheet's rule) under `#region-<id>`, and says so when that leaves none; Everything shows them all. A
 *  pick in the address (a Filters region's `filter=`, a link the reader followed or shared) wins: the scope starts at Everything
 *  then, so a series picked outside the follows shows. The rows carry `data-series`, as the tint reads them. Nothing for a reader
 *  following everything (the site's `null`), and nothing on the cached page. */
export function FollowedScope({ region }: { region: string }) {
  const { followed, hydrated } = useFollowedSeries();
  // Read in the browser alone (the server draws no chips, so the first client render matches whichever value this takes).
  const [scope, setScope] = useState<'all' | 'yours'>(() => (typeof window !== 'undefined' && [...new URLSearchParams(window.location.search).keys()].some(k => k === 'filter' || k.endsWith('.filter')) ? 'all' : 'yours'));
  const follows = hydrated && followed !== null && followed.length > 0;
  const note = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const root = document.getElementById(`region-${region}`);
    if (!root) return;
    let shown = 0;
    const rows = root.querySelectorAll('[data-series]');
    for (const el of rows) {
      const slug = el.getAttribute('data-series');
      if (follows && scope === 'yours' && slug && !followed!.includes(slug)) el.setAttribute('hidden', '');
      else {
        el.removeAttribute('hidden');
        shown++;
      }
    }
    if (note.current) note.current.hidden = !(follows && scope === 'yours' && rows.length > 0 && shown === 0);
  }, [followed, follows, scope, region]);
  if (!follows) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {(['all', 'yours'] as const).map(k => (
        <button
          key={k}
          type="button"
          aria-pressed={scope === k}
          onClick={() => setScope(k)}
          className={`shrink-0 border px-3 py-1.5 font-mono text-11 font-semibold uppercase tracking-[0.12em] transition-colors duration-(--duration-fast) ${
            scope === k ? 'border-text bg-surface-elevated text-text' : 'border-border text-text-muted hover:text-text'
          }`}
        >
          {k === 'all' ? 'Everything' : 'Yours only'}
        </button>
      ))}
      <p ref={note} hidden className="basis-full font-mono text-11 text-text-faint">
        No stories from the series you follow; Everything shows the rest.
      </p>
    </div>
  );
}
