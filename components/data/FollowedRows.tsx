'use client';

import { useEffect } from 'react';
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
