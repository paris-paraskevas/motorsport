// The WordPress publisher's health (slot O10): one row per feed (a series'
// standings, results or calendar), the stale rule that decides which data a
// page shows, and the /status/ page that lists every feed.

import { formatDay, paragraph, tableBlock, type Page, type ResultRound } from './render';

export type FeedKind = 'standings' | 'results' | 'calendar';
export type FeedStatus = 'OK' | 'STALE' | 'MISSING';

export interface FeedHealth {
  slug: string;
  name: string;
  kind: FeedKind;
  status: FeedStatus;
  /** Why the feed is not OK, or "partial" when a short answer was used for lack of a stored one. */
  note: string;
  /** YYYY-MM-DD the stored data last changed; null when nothing is stored. */
  since: string | null;
}

/** What this run fetched: the data, or null and the reason. */
export interface Fresh<T> {
  data: T | null;
  /** The source answered below its floor (lib/health-core.ts LOW), or a calendar
   *  feed failed and only the curated sessions remain. */
  partial?: boolean;
  error?: string;
}

export interface Decision<T> {
  data: T | null;
  status: FeedStatus;
  note: string;
}

/** The stale rule. OK: this run fetched usable data. STALE: it did not (an error,
 *  an empty answer, or a partial one where a full one is stored), so the last
 *  committed data stands. MISSING: nothing usable anywhere, and the page is not
 *  written. A page is never rewritten from an empty fetch. */
export function decideFeed<T>(fresh: Fresh<T>, previous: T | null, usable: (v: T) => boolean): Decision<T> {
  const freshOk = fresh.data !== null && usable(fresh.data);
  const previousOk = previous !== null && usable(previous);
  if (freshOk && !(fresh.partial && previousOk)) {
    return { data: fresh.data, status: 'OK', note: fresh.partial ? 'partial' : '' };
  }
  if (previousOk) {
    return { data: previous, status: 'STALE', note: fresh.error || (fresh.partial ? 'partial answer' : 'empty answer') };
  }
  return { data: null, status: 'MISSING', note: fresh.error || 'no data' };
}

/** Whether a fetched season holds fewer rounds or races than the stored one: a short answer the
 *  results registry cannot see, its floor being 1 (jolpi.ca's paging stops at the first failed
 *  page, the F1 sprint list fails on its own, a FOM call is lost). A newer season starting small
 *  is no shrink. A real drop (a race struck out) stays STALE until the stored file is removed. */
export function resultsShrank(fresh: ResultRound[], stored: ResultRound[] | null): boolean {
  if (!stored || stored.length === 0) return false;
  const newestYear = (rounds: ResultRound[]) =>
    rounds.reduce((year, r) => (r.date !== null && r.date.slice(0, 4) > year ? r.date.slice(0, 4) : year), '');
  if (newestYear(fresh) > newestYear(stored)) return false;
  const races = (rounds: ResultRound[]) => rounds.reduce((n, r) => n + r.sessions.length, 0);
  return fresh.length < stored.length || races(fresh) < races(stored);
}

const KIND_LABEL: Record<FeedKind, string> = { standings: 'Standings', results: 'Results', calendar: 'Calendar' };
const KIND_ORDER: Record<FeedKind, number> = { standings: 0, results: 1, calendar: 2 };

/** /status/: every feed, its status and the date of the data each page shows. Dated by the day, not
 *  the minute, so WordPress keeps one revision a day rather than one a run. */
export function statusPage(rows: FeedHealth[], runAt: Date): Page {
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const down = rows.filter(r => r.status !== 'OK').length;
  const body = [
    paragraph(
      `Checked ${formatDay(runAt.toISOString().slice(0, 10))}. ` +
        (down === 0 ? `All ${rows.length} feeds answered.` : `${down} of ${rows.length} feeds did not answer this time.`),
    ),
    tableBlock(
      ['Series', 'Feed', 'Status', 'Data from', 'Note'],
      sorted.map(r => [r.name, KIND_LABEL[r.kind], r.status, r.since ? formatDay(r.since) : '', r.note]),
    ),
    paragraph(
      'OK: the source answered this time. STALE: it did not, so the page shows the last data it gave, from the date shown. ' +
        'MISSING: no data yet, so there is no page.',
    ),
  ];
  return { path: '/status/', title: 'Status', body: body.join('\n\n') };
}
