import type { Champion, Series } from '@/lib/types';
import { fetchChampions } from '@/lib/wikipedia-champions';
import { loadCuratedChampions } from '@/lib/series-content';
import { PlaceholderTab } from './PlaceholderTab';

function wikipediaUrl(pageTitle: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
}

interface DecadeGroup {
  decade: number;
  label: string;
  champions: Champion[];
}

function groupByDecade(champions: Champion[]): DecadeGroup[] {
  const buckets = new Map<number, Champion[]>();
  for (const c of champions) {
    const decade = Math.floor(c.year / 10) * 10;
    if (!buckets.has(decade)) buckets.set(decade, []);
    buckets.get(decade)!.push(c);
  }
  const groups = [...buckets.entries()].map(([decade, list]) => ({
    decade,
    label: `${decade}s`,
    champions: list.sort((a, b) => b.year - a.year),
  }));
  groups.sort((a, b) => b.decade - a.decade);
  return groups;
}

export async function ChampionsTab({ series }: { series: Series }) {
  const curated = await loadCuratedChampions(series.meta.slug);
  let champions: Champion[];
  let sourceLabel: string;
  let pageUrl: string;

  if (curated && curated.length > 0) {
    champions = [...curated].sort((a, b) => b.year - a.year);
    sourceLabel = 'curated';
    pageUrl = wikipediaUrl(series.meta.championsPage ?? series.meta.wikipediaPage ?? '');
  } else {
    const candidates: string[] = [];
    if (series.meta.championsPage) candidates.push(series.meta.championsPage);
    if (series.meta.wikipediaPage && series.meta.wikipediaPage !== series.meta.championsPage) {
      candidates.push(series.meta.wikipediaPage);
    }
    if (candidates.length === 0) {
      return <PlaceholderTab tabLabel="Champions" />;
    }
    champions = await fetchChampions(candidates);
    sourceLabel = 'Wikipedia';
    pageUrl = wikipediaUrl(series.meta.championsPage ?? series.meta.wikipediaPage ?? '');
  }

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

  const groups = groupByDecade(champions);

  return (
    <div className="space-y-3">
      {groups.map((group, idx) => (
        <details
          key={group.decade}
          open={idx === 0}
          className="group rounded-xl bg-zinc-900/40 border border-zinc-800/60 overflow-hidden"
        >
          <summary className="flex items-baseline justify-between px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-zinc-900/70 transition-colors">
            <span className="text-zinc-100 text-base font-semibold tracking-tight">
              {group.label}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">
              {group.champions.length} {group.champions.length === 1 ? 'champion' : 'champions'}
            </span>
          </summary>
          <div className="divide-y divide-zinc-800/40 border-t border-zinc-800/60">
            {group.champions.map((c, i) => (
              <div
                key={`${c.year}-${i}`}
                className="px-4 py-2.5"
              >
                <div className="hidden sm:grid grid-cols-[3.5rem_1fr_minmax(0,1fr)] gap-x-3 items-baseline">
                  <div className="text-zinc-400 tabular-nums text-sm font-medium tnum">
                    {c.year}
                  </div>
                  <div className="text-zinc-100 text-sm leading-snug">
                    {c.driver}
                  </div>
                  <div className="text-xs text-zinc-400 leading-snug">
                    {c.constructor ?? ''}
                  </div>
                </div>
                <div className="sm:hidden">
                  <div className="flex items-baseline gap-3">
                    <span className="text-zinc-400 tabular-nums text-sm font-medium tnum w-12 shrink-0">
                      {c.year}
                    </span>
                    <span className="text-zinc-100 text-sm">{c.driver}</span>
                  </div>
                  {c.constructor && (
                    <div className="ml-[3.75rem] mt-0.5 text-[11px] text-zinc-500">
                      {c.constructor}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}
      <div className="px-2 py-2 text-[11px] text-zinc-500">
        {sourceLabel === 'curated' ? (
          <span>Source: curated</span>
        ) : (
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-300"
          >
            Source: Wikipedia →
          </a>
        )}
      </div>
    </div>
  );
}
