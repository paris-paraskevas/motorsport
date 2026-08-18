'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { NavSeriesMeta } from '@/lib/types';
import { groupSeriesByCategory } from '@/lib/categories';
import type { SearchDoc, SearchType } from '@/lib/search-index';
import { searchDocs } from '@/lib/search-match';

// The one nav control (design handoff §2, panels 2a/8b): a single always-visible
// menu-and-search field in the header. Click or focus opens the panel printing
// the whole site as one index — the four doors, all fifteen series grouped by
// category, Read, Learn, and the "Also" foot rule — and typing filters that
// same index in place, with full-site search results (drivers, teams,
// weekends…) beneath. One surface, one code path, both viewports. ⌘K / Ctrl-K
// / "/" still focus the field; the visible shortcut-hint chrome is gone by
// design ("not every user is on a Mac") — the mock's own ESC affordance stays.
//
// Panel 2a's NOW group (Latest results / This weekend) and its foot "Settings →"
// are deliberately absent: panel 8b (later turn) replaced NOW with THE FOUR
// DOORS, and the design's own anti-repetition rule kills rows that duplicate a
// door (Home covers latest results; Calendar covers this weekend; Account
// covers settings).

// Module-level cache so re-opening never re-fetches the static index.
let INDEX_CACHE: SearchDoc[] | null = null;

const DOORS = [
  { href: '/app', label: 'Home', sub: 'What just happened' },
  { href: '/calendar', label: 'Calendar', sub: 'When everything is on' },
  { href: '/information', label: 'Learn', sub: 'What it all means' },
  { href: '/settings', label: 'Account', sub: 'What you follow' },
];

const LEARN_LINKS = [
  { href: '/information/series-guides', label: 'Series guides' },
  { href: '/information/formula-1', label: 'Formula 1 & open-wheel' },
  { href: '/information/feeder-series', label: 'Feeder series' },
  { href: '/information/tracks', label: 'Tracks & circuits' },
  { href: '/information/general', label: 'Motorsport 101' },
];

const ALSO_LINKS = [
  { href: '/social', label: 'Predictions & leagues', gated: true },
  { href: '/social/threads', label: 'Threads', gated: false },
  { href: '/write-for-us', label: 'Write for Paddock', gated: false },
  { href: '/about', label: 'About', gated: false },
  { href: '/changelog', label: 'Changelog', gated: false },
];

const TYPE_ORDER: SearchType[] = ['driver', 'team', 'series', 'weekend', 'tab', 'info', 'blog', 'page'];
const TYPE_LABEL: Record<SearchType, string> = {
  driver: 'Drivers',
  team: 'Teams',
  series: 'Series',
  weekend: 'Weekends',
  tab: 'Series pages',
  info: 'Learn',
  blog: 'Blog',
  page: 'Pages',
};

export function NavPanel({
  seriesList,
  bettingEnabled,
}: {
  seriesList: NavSeriesMeta[];
  bettingEnabled: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<SearchDoc[] | null>(INDEX_CACHE);
  // Placeholder text is viewport-dependent (spec: "Browse the site, or search
  // it" on desktop, "Browse or search" on phones) — CSS can't swap placeholder
  // strings, so one matchMedia listener does.
  const [wide, setWide] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const groups = groupSeriesByCategory(seriesList);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Fetch the static search index once per session, on first open.
  useEffect(() => {
    if (!open || INDEX_CACHE) return;
    let alive = true;
    fetch('/api/search')
      .then(r => {
        // Non-2xx must NOT poison the cache with [] — leave null so the next
        // open retries (same contract the old SearchOverlay carried).
        if (!r.ok) throw new Error(`search index ${r.status}`);
        return r.json();
      })
      .then((data: SearchDoc[]) => {
        INDEX_CACHE = data;
        if (alive) setDocs(data);
      })
      .catch(() => {
        if (alive) setDocs([]);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  // Navigating anywhere closes the panel and clears the query — adjusted
  // DURING render (the sanctioned prev-value pattern) so the panel is closed
  // before paint, with no set-state-in-effect cascade.
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
    setQuery('');
  }

  // ⌘K / Ctrl-K and "/" focus the field (which opens the panel). No visible hint.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (e.key === '/') {
        const el = document.activeElement;
        const typing =
          el instanceof HTMLElement &&
          (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (!typing) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Outside click closes (the panel is anchored, not modal).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Escape closes; arrows walk the rendered rows so the keyboard path from the
  // field into the index is two keys, not a tab-tour of the whole header.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = rootRef.current
      ? [...rootRef.current.querySelectorAll<HTMLElement>('[data-nav-row]')]
      : [];
    if (!rows.length) return;
    e.preventDefault();
    const idx = rows.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') rows[Math.min(idx + 1, rows.length - 1)]?.focus();
    else if (idx <= 0) inputRef.current?.focus();
    else rows[idx - 1]?.focus();
  };

  // ── The filtered index ──────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const hit = (label: string, sub = '') =>
    !q || label.toLowerCase().includes(q) || sub.toLowerCase().includes(q);
  const doorHits = DOORS.filter(d => hit(d.label, d.sub));
  const seriesGroups = groups
    .map(g => ({
      category: g.category,
      series: q
        ? g.series.filter(s => s.name.toLowerCase().includes(q) || s.slug.includes(q))
        : g.series,
    }))
    .filter(g => g.series.length > 0);
  const readRows = [
    { href: '/blog', label: 'Blog', sub: 'Analysis & recaps' },
    { href: '/news', label: 'News', sub: 'The wire' },
    { href: '/authors', label: 'Writers', sub: 'Who writes here' },
  ].filter(r => hit(r.label, r.sub));
  const learnHits = LEARN_LINKS.filter(l => hit(l.label));
  const alsoHits = ALSO_LINKS.filter(l => (l.gated ? bettingEnabled : true) && hit(l.label));

  // Full-site search beneath the printed index, deduped against rows already
  // showing above (the index has 'page' docs for the doors themselves).
  const printedUrls = new Set<string>([
    ...doorHits.map(d => d.href),
    ...seriesGroups.flatMap(g => g.series.map(s => `/series/${s.slug}`)),
    ...readRows.map(r => r.href),
    ...learnHits.map(l => l.href),
    ...alsoHits.map(l => l.href),
  ]);
  const found = q && docs ? searchDocs(docs, query, 30).filter(d => !printedUrls.has(d.url)) : [];
  const foundGroups = TYPE_ORDER.map(t => ({ type: t, items: found.filter(d => d.type === t) })).filter(
    g => g.items.length > 0,
  );
  const nothing =
    q.length > 0 &&
    doorHits.length + readRows.length + learnHits.length + alsoHits.length + found.length === 0 &&
    seriesGroups.length === 0;

  const doorsSection = doorHits.length > 0 && (
    <section aria-label="The four doors">
      <PanelRule label="The four doors" />
      {doorHits.map(d => {
        const active = pathname === d.href || pathname.startsWith(`${d.href}/`);
        return (
          <Link
            key={d.href}
            href={d.href}
            data-nav-row
            data-heatmap-id={`nav:panel:door:${d.label.toLowerCase()}`}
            aria-current={active ? 'page' : undefined}
            className="block min-h-11 border-b border-border py-2 transition-colors duration-(--duration-fast) hover:bg-surface"
          >
            <span className={`block font-serif text-[19px] font-semibold leading-tight ${active ? 'text-brand' : 'text-text'}`}>
              {d.label}
            </span>
            <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">
              {d.sub}
            </span>
          </Link>
        );
      })}
    </section>
  );

  const readSection = readRows.length > 0 && (
    <section aria-label="Read">
      <PanelRule label="Read" />
      {readRows.map(r => (
        <Link
          key={r.href}
          href={r.href}
          data-nav-row
          data-heatmap-id={`nav:panel:${r.label.toLowerCase()}`}
          className="flex min-h-11 items-center justify-between gap-3 border-b border-border py-1.5 transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          <span className="font-serif text-[16px] font-semibold text-text">{r.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">{r.sub}</span>
        </Link>
      ))}
    </section>
  );

  const seriesSection = seriesGroups.length > 0 && (
    <section aria-label="Series">
      <PanelRule label="Series" right={`${seriesGroups.reduce((n, g) => n + g.series.length, 0)}`} />
      {/* Stated once, as a line of type — never fifteen times behind a hover. */}
      <p className="mt-1 hidden font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint lg:block">
        Every series opens with calendar · standings · results · drivers · champions
      </p>
      <div className="lg:columns-2 lg:gap-6">
        {seriesGroups.map(g => (
          <div key={g.category.id} className="lg:break-inside-avoid">
            <div className="mt-3 mb-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              {g.category.label}
            </div>
            {g.series.map(s => (
              <Link
                key={s.slug}
                href={`/series/${s.slug}`}
                data-nav-row
                data-heatmap-id={`nav:panel:series:${s.slug}`}
                className="flex min-h-11 items-center gap-2.5 border-b border-border py-1.5 transition-colors duration-(--duration-fast) hover:bg-surface"
              >
                <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: s.color }} />
                <span className="truncate font-serif text-[16px] font-semibold text-text">{s.name}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </section>
  );

  const learnSection = learnHits.length > 0 && (
    <section aria-label="Learn">
      <PanelRule label="Learn" />
      {learnHits.map(l => (
        <Link
          key={l.href}
          href={l.href}
          data-nav-row
          className="block min-h-11 border-b border-border py-2.5 font-serif text-[16px] font-semibold leading-tight text-text transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          {l.label}
        </Link>
      ))}
      {!q && (
        <Link
          href="/information/map"
          data-nav-row
          className="mt-3 block border border-border-strong p-3 transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
            Circuit map
          </span>
          <span className="mt-1 block font-serif text-[15px] font-semibold leading-snug text-text">
            All 138 venues on one map
          </span>
        </Link>
      )}
    </section>
  );

  const alsoFoot = alsoHits.length > 0 && (
    <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-text pt-2 pb-1">
      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-text-faint">Also</span>
      {alsoHits.map(l => (
        <Link
          key={l.href}
          href={l.href}
          data-nav-row
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="relative min-w-0 flex-1 lg:max-w-[460px]">
      {/* The control: burger (X while open) + divider + the always-visible field. */}
      <div
        data-tour="series"
        className={`flex h-[34px] items-center gap-3 rounded-[4px] border bg-surface-elevated px-3 transition-colors duration-(--duration-fast) ${
          open ? 'border-text' : 'border-border-strong'
        }`}
      >
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Menu'}
          aria-expanded={open}
          aria-controls="nav-panel"
          data-heatmap-id="nav:menu"
          onClick={() => {
            setOpen(o => !o);
            if (!open) inputRef.current?.focus();
          }}
          className="relative flex h-full w-[13px] shrink-0 flex-col items-start justify-center gap-[3px]"
        >
          {open ? (
            <>
              <span aria-hidden="true" className="absolute left-0 top-1/2 block h-[1.5px] w-[13px] rotate-45 bg-text" />
              <span aria-hidden="true" className="absolute left-0 top-1/2 block h-[1.5px] w-[13px] -rotate-45 bg-text" />
            </>
          ) : (
            <>
              <span aria-hidden="true" className="block h-[1.5px] w-[13px] bg-text" />
              <span aria-hidden="true" className="block h-[1.5px] w-[13px] bg-text" />
              <span aria-hidden="true" className="block h-[1.5px] w-[13px] bg-text" />
            </>
          )}
        </button>
        <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border-strong" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={wide ? 'Browse the site, or search it' : 'Browse or search'}
          aria-label="Browse the site, or search it"
          role="combobox"
          aria-expanded={open}
          aria-controls="nav-panel"
          data-heatmap-id="nav:search-field"
          className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-text outline-none placeholder:text-text-muted"
        />
        {open && (
          <span aria-hidden="true" className="hidden shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-text-faint lg:block">
            Esc to close
          </span>
        )}
      </div>

      {/* The panel: full-bleed sheet on phones (the bottom bar stays visible,
          per panel 8b), a wide three-column surface on lg+ (panel 2a: the
          entire site, one surface). */}
      {open && (
        <div
          id="nav-panel"
          className="fixed inset-x-0 top-[calc(50px+env(safe-area-inset-top))] bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 overflow-y-auto border-t border-text bg-bg px-[14px] pb-6 lg:absolute lg:inset-x-auto lg:left-0 lg:top-[calc(100%+11px)] lg:bottom-auto lg:w-[min(880px,calc(100vw-5rem))] lg:max-h-[calc(100vh-90px)] lg:rounded-[4px] lg:border lg:bg-surface-elevated lg:px-5 lg:pb-4"
        >
          {nothing ? (
            <div className="px-1 py-10 text-center">
              <p className="text-sm text-text-muted">No matches for “{query.trim()}”</p>
              <p className="mt-1 text-xs text-text-faint">Try a driver, team, series or circuit name.</p>
            </div>
          ) : (
            <>
              <div className="lg:grid lg:grid-cols-[190px_minmax(0,1fr)_200px] lg:gap-7">
                <div>
                  {doorsSection}
                  {readSection}
                </div>
                <div>{seriesSection}</div>
                <div>{learnSection}</div>
              </div>

              {foundGroups.map(g => (
                <section key={g.type} aria-label={TYPE_LABEL[g.type]}>
                  <PanelRule label={TYPE_LABEL[g.type]} right={`${g.items.length}`} />
                  {g.items.map(d => (
                    <Link
                      key={d.url}
                      href={d.url}
                      data-nav-row
                      className="block min-h-11 border-b border-border py-2 transition-colors duration-(--duration-fast) hover:bg-surface"
                    >
                      <span className="block truncate text-sm text-text">{d.title}</span>
                      {d.subtitle && (
                        <span className="block truncate font-mono text-[11px] text-text-faint">{d.subtitle}</span>
                      )}
                    </Link>
                  ))}
                </section>
              ))}

              {q.length > 0 && docs === null && (
                <p className="px-1 py-4 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                  Loading the index…
                </p>
              )}

              {alsoFoot}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// The panel's section head: mono micro-label, optional right figure, and the
// 1px ink rule beneath — the SectionRule register from the handoff, local to
// the panel until a page surface creates the shared primitive.
function PanelRule({ label, right }: { label: string; right?: string }) {
  return (
    <div className="mt-4 flex items-baseline justify-between border-b border-text pb-1">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</span>
      {right !== undefined && (
        <span className="font-mono text-[10px] tabular-nums text-text-faint">{right}</span>
      )}
    </div>
  );
}
