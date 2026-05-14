import type { Series } from '@/lib/types';
import { fetchChampions } from '@/lib/wikipedia-champions';
import { PlaceholderTab } from './PlaceholderTab';

const MAX_ROWS = 30;
const FADE_AFTER = 15;

function wikipediaUrl(pageTitle: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
}

export async function ChampionsTab({ series }: { series: Series }) {
  // Try the dedicated champions list page first, then the main article as a fallback.
  // Many series don't have a separate "List of <X> champions" article; the table
  // lives inside the main article on Wikipedia.
  const candidates: string[] = [];
  if (series.meta.championsPage) candidates.push(series.meta.championsPage);
  if (series.meta.wikipediaPage && series.meta.wikipediaPage !== series.meta.championsPage) {
    candidates.push(series.meta.wikipediaPage);
  }
  if (candidates.length === 0) {
    return <PlaceholderTab tabLabel="Champions" />;
  }

  const champions = await fetchChampions(candidates);
  const pageUrl = wikipediaUrl(series.meta.championsPage ?? series.meta.wikipediaPage ?? '');

  if (champions.length === 0) {
    return (
      <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-8 text-center">
        <div className="text-zinc-300 text-base font-medium mb-1">
          No champions data
        </div>
        <div className="text-zinc-500 text-sm mb-4">
          We couldn&apos;t parse a champions table for {series.meta.name}.
        </div>
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-zinc-300 text-sm underline underline-offset-4 hover:text-white"
        >
          View on Wikipedia
        </a>
      </div>
    );
  }

  const rows = champions.slice(0, MAX_ROWS);

  return (
    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 overflow-hidden">
      <div className="hidden sm:grid grid-cols-[3rem_1fr_minmax(0,1fr)] gap-x-3 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500 border-b border-zinc-800/60 font-semibold">
        <div>Year</div>
        <div>Driver</div>
        <div>Constructor</div>
      </div>
      <div className="divide-y divide-zinc-800/40">
        {rows.map((c, i) => {
          const fade = i >= FADE_AFTER ? 'opacity-60' : '';
          return (
            <div
              key={`${c.year}-${i}`}
              className={`px-4 py-2 ${fade}`}
            >
              {/* Desktop layout — three columns */}
              <div className="hidden sm:grid grid-cols-[3rem_1fr_minmax(0,1fr)] gap-x-3 items-baseline">
                <div className="text-zinc-400 tabular-nums text-sm font-medium">
                  {c.year}
                </div>
                <div className="min-w-0">
                  <div className="text-zinc-100 text-sm leading-snug">{c.driver}</div>
                  {c.points !== undefined ? (
                    <div className="text-[10px] text-zinc-500 tabular-nums mt-0.5">
                      {c.points} pts
                    </div>
                  ) : null}
                </div>
                <div className="text-xs text-zinc-400 leading-snug">
                  {c.constructor ?? ''}
                </div>
              </div>

              {/* Mobile layout — stacked so constructor never truncates */}
              <div className="sm:hidden">
                <div className="flex items-baseline gap-3">
                  <span className="text-zinc-400 tabular-nums text-sm font-medium tnum w-12">
                    {c.year}
                  </span>
                  <span className="text-zinc-100 text-sm">{c.driver}</span>
                </div>
                {(c.constructor || c.points !== undefined) && (
                  <div className="ml-[3.75rem] mt-0.5 text-[11px] text-zinc-500 flex items-baseline gap-2 flex-wrap">
                    {c.constructor && <span>{c.constructor}</span>}
                    {c.points !== undefined && (
                      <span className="tabular-nums">· {c.points} pts</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-2 text-[11px] text-zinc-500 border-t border-zinc-800/60">
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-300"
        >
          Source: Wikipedia &rarr;
        </a>
      </div>
    </div>
  );
}
