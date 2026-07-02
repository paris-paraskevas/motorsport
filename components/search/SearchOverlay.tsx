'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, CornerDownLeft } from 'lucide-react';
import type { SearchDoc, SearchType } from '@/lib/search-index';
import { searchDocs } from '@/lib/search-match';

// Module-level cache so re-opening the overlay never re-fetches the static index.
let INDEX_CACHE: SearchDoc[] | null = null;

const TYPE_ORDER: SearchType[] = ['driver', 'team', 'series', 'weekend', 'tab', 'blog', 'page'];
const TYPE_LABEL: Record<SearchType, string> = {
  driver: 'Drivers',
  team: 'Teams',
  series: 'Series',
  weekend: 'Weekends',
  tab: 'Series tabs',
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

  // Group for display; flatten (in display order) for keyboard navigation.
  const { groups, flat } = useMemo(() => {
    const byType = new Map<SearchType, SearchDoc[]>();
    for (const d of results) {
      const arr = byType.get(d.type);
      if (arr) arr.push(d);
      else byType.set(d.type, [d]);
    }
    const grouped = TYPE_ORDER.filter((t) => byType.has(t)).map((t) => ({ type: t, items: byType.get(t)! }));
    return { groups: grouped, flat: grouped.flatMap((g) => g.items) };
  }, [results]);

  useEffect(() => {
    setActive(0);
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl border border-border bg-surface-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={16} className="shrink-0 text-text-faint" aria-hidden />
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
            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-text placeholder:text-text-faint outline-none"
          />
          <button type="button" onClick={onClose} aria-label="Close search" className="text-text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>

        <div ref={listRef} id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto">
          {docs === null ? (
            <p className="px-4 py-6 text-center font-mono text-xs uppercase tracking-[0.14em] text-text-faint">Loading…</p>
          ) : query.trim() === '' ? (
            <p className="px-4 py-6 text-center font-mono text-xs uppercase tracking-[0.14em] text-text-faint">
              Type to search drivers, teams, weekends, series &amp; more
            </p>
          ) : flat.length === 0 ? (
            <p className="px-4 py-6 text-center font-mono text-xs uppercase tracking-[0.14em] text-text-faint">
              No matches for “{query.trim()}”
            </p>
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
