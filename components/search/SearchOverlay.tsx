'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, CornerDownLeft } from 'lucide-react';
import type { SearchDoc, SearchType } from '@/lib/search-index';
import { searchDocs } from '@/lib/search-match';

// Module-level cache so re-opening the overlay never re-fetches the static index.
let INDEX_CACHE: SearchDoc[] | null = null;

const TYPE_ORDER: SearchType[] = ['driver', 'team', 'series', 'weekend', 'tab', 'info', 'blog', 'page'];
const TYPE_LABEL: Record<SearchType, string> = {
  driver: 'Drivers',
  team: 'Teams',
  series: 'Series',
  weekend: 'Weekends',
  tab: 'Series tabs',
  info: 'Learn',
  blog: 'Blog',
  page: 'Pages',
};

// Lazy-loaded (dynamic ssr:false) by SearchTrigger, so this + the matcher + the
// fetched index stay off the initial app bundle.
export default function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<SearchDoc[] | null>(INDEX_CACHE);
  const [active, setActive] = useState(0);
  const [typeFilter, setTypeFilter] = useState<SearchType | 'all'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch the static index once per session.
  useEffect(() => {
    if (INDEX_CACHE) return;
    let alive = true;
    fetch('/api/search')
      .then((r) => {
        // Throw on a non-2xx so it lands in .catch below — a transient error
        // (cold revalidation miss, mid-deploy) must NOT poison INDEX_CACHE with
        // [], which would leave search dead for the whole session with no retry.
        if (!r.ok) throw new Error(`search index ${r.status}`);
        return r.json();
      })
      .then((data: SearchDoc[]) => {
        INDEX_CACHE = data;
        if (alive) setDocs(data);
      })
      .catch(() => {
        // Show empty this time but leave INDEX_CACHE null, so the next ⌘K open retries.
        if (alive) setDocs([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => (docs ? searchDocs(docs, query, 40) : []), [docs, query]);

  // Per-type counts over the FULL result set — drives the filter chips.
  const counts = useMemo(() => {
    const c: Partial<Record<SearchType, number>> = {};
    for (const d of results) c[d.type] = (c[d.type] ?? 0) + 1;
    return c;
  }, [results]);

  // Narrow to the chosen type (or all); group for display + flatten (in display
  // order) for keyboard navigation.
  const { groups, flat } = useMemo(() => {
    const scoped = typeFilter === 'all' ? results : results.filter((d) => d.type === typeFilter);
    const byType = new Map<SearchType, SearchDoc[]>();
    for (const d of scoped) {
      const arr = byType.get(d.type);
      if (arr) arr.push(d);
      else byType.set(d.type, [d]);
    }
    const grouped = TYPE_ORDER.filter((t) => byType.has(t)).map((t) => ({ type: t, items: byType.get(t)! }));
    return { groups: grouped, flat: grouped.flatMap((g) => g.items) };
  }, [results, typeFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-query is intentional and must be synchronous so a new query can never render a stale filter
    setActive(0);
    setTypeFilter('all'); // a new query resets the type filter so it can't strand an empty view
  }, [query]);

  const go = (doc: SearchDoc | undefined) => {
    if (!doc) return;
    onClose();
    router.push(doc.url);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[active]);
    }
  };

  // Keep the active row in view as arrows move it.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-md p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-2xl ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={18} className="shrink-0 text-text-muted" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drivers, teams, weekends, series…"
            aria-label="Search Paddock"
            role="combobox"
            aria-expanded
            aria-controls="search-results"
            className="min-w-0 flex-1 bg-transparent py-4 text-[15px] text-text placeholder:text-text-faint outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="shrink-0 rounded-md p-1 text-text-faint transition-colors hover:bg-surface hover:text-text"
          >
            <X size={16} />
          </button>
        </div>

        {docs && results.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2" role="tablist" aria-label="Filter results by type">
            <FilterChip
              label="All"
              count={results.length}
              active={typeFilter === 'all'}
              onClick={() => {
                setTypeFilter('all');
                inputRef.current?.focus();
              }}
            />
            {TYPE_ORDER.filter((t) => counts[t]).map((t) => (
              <FilterChip
                key={t}
                label={TYPE_LABEL[t]}
                count={counts[t]!}
                active={typeFilter === t}
                onClick={() => {
                  setTypeFilter(t);
                  inputRef.current?.focus();
                }}
              />
            ))}
          </div>
        )}

        <div ref={listRef} id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto">
          {docs === null ? (
            <p className="px-4 py-6 text-center font-mono text-xs uppercase tracking-[0.14em] text-text-faint">Loading…</p>
          ) : query.trim() === '' ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <Search size={22} className="text-text-faint/60" aria-hidden />
              <p className="text-sm text-text-faint">Search drivers, teams, weekends, series &amp; more</p>
            </div>
          ) : flat.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
              <p className="text-sm text-text-muted">No matches for “{query.trim()}”</p>
              <p className="text-xs text-text-faint">Try a driver, team, series or circuit name.</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.type}>
                <div className="px-3 pt-3 pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
                  {TYPE_LABEL[g.type]}
                </div>
                {g.items.map((d) => {
                  const idx = flat.indexOf(d);
                  const isActive = idx === active;
                  return (
                    <button
                      key={d.url}
                      type="button"
                      data-idx={idx}
                      role="option"
                      aria-selected={isActive}
                      onMouseMove={() => setActive(idx)}
                      onClick={() => go(d)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-(--duration-fast) ${
                        isActive ? 'bg-surface' : 'hover:bg-surface/60'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text">{d.title}</span>
                        {d.subtitle && (
                          <span className="block truncate font-mono text-[11px] text-text-faint">{d.subtitle}</span>
                        )}
                      </span>
                      {isActive && <CornerDownLeft size={13} className="shrink-0 text-text-faint" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// A single type-filter chip: label + live count; lit when it's the active filter.
function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors duration-(--duration-fast) ${
        active
          ? 'border-border-strong bg-surface text-text'
          : 'border-border text-text-faint hover:border-border-strong hover:text-text-muted'
      }`}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
