'use client';

import { Puzzle, Search } from 'lucide-react';
import { CATALOGUE, type CatalogueItem } from './catalogue';

// The Shared Components rail: the catalogue with a search field over it, its
// own eyebrow, icon and title (operator, 2026-09-08: "i cant really
// differentiate between all pages/shared components"). The App Builder has no
// rail: it follows the approved designer's home and Page Designer (the
// operator's call, 2026-09-09: "the app builder takes precedent"), where the
// pages list carries the group filter as the Page Groups button.

const ITEM =
  'flex w-full items-center gap-2.5 py-[7px] pl-[22px] pr-3.5 text-left text-12 transition-colors duration-(--duration-fast)';
const ACTIVE = 'bg-edit-dim text-text shadow-[inset_2px_0_0_var(--edit)]';

function RailHead({ icon, eyebrow, title, children }: { icon: React.ReactNode; eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="border-b border-border px-3.5 pb-3 pt-3">
      <span className="flex items-center gap-1.5 font-mono text-9 uppercase tracking-[0.16em] text-text-faint">
        {icon}
        {eyebrow}
      </span>
      <span className="mt-1 block text-14 font-bold text-text">{title}</span>
      {children}
    </div>
  );
}

/** The catalogue items whose label or group holds every word of the query. */
export function filterCatalogue(query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return CATALOGUE;
  return CATALOGUE.map(g => ({
    group: g.group,
    items: g.items.filter(it => {
      const hay = `${it.label} ${g.group}`.toLowerCase();
      return words.every(w => hay.includes(w));
    }),
  })).filter(g => g.items.length > 0);
}

export function SharedRail({
  query,
  onQuery,
  selected,
  onSelect,
  badge,
}: {
  query: string;
  onQuery: (query: string) => void;
  selected: string | null;
  onSelect: (key: string) => void;
  badge: (item: CatalogueItem) => number | null;
}) {
  const groups = filterCatalogue(query);
  const live = (it: CatalogueItem) => Boolean(it.listKey || it.editor);
  return (
    <>
      <RailHead icon={<Puzzle size={11} />} eyebrow="Shared Components" title="Components">
        <label className="mt-2 flex items-center gap-1.5 border border-border-strong bg-bg px-2 py-1 text-text-faint focus-within:border-edit">
          <Search size={11} />
          <input
            type="search"
            value={query}
            placeholder="Find a component"
            aria-label="Find a component"
            className="w-full bg-transparent text-12 text-text placeholder:text-text-faint focus:outline-none"
            onChange={e => onQuery(e.target.value)}
          />
        </label>
      </RailHead>
      {groups.length === 0 && <p className="px-3.5 pt-3 text-12 text-text-faint">Nothing in the catalogue matches.</p>}
      {groups.map(group => (
        <div key={group.group}>
          <div className="px-3.5 pb-1 pt-3 text-12 font-semibold text-text-muted">{group.group}</div>
          {group.items.map(it => {
            const active = selected === it.key;
            const n = badge(it);
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => onSelect(it.key)}
                aria-current={active ? 'true' : undefined}
                className={`${ITEM} ${
                  active ? ACTIVE : live(it) ? 'text-text-muted hover:bg-surface-elevated hover:text-text' : 'text-text-faint hover:bg-surface-elevated hover:text-text-muted'
                }`}
              >
                <span className={`font-mono text-9 ${live(it) ? 'text-edit' : 'text-text-faint'}`} aria-hidden="true">
                  {live(it) ? '●' : '○'}
                </span>
                <span>{it.label}</span>
                {it.later && <span className="ml-auto font-mono text-9 text-text-faint">{it.later}</span>}
                {n !== null && <span className="ml-auto font-mono text-9 tabular-nums text-text-faint">{n}</span>}
              </button>
            );
          })}
        </div>
      ))}
      <p className="mt-4 border-t border-border px-3.5 pt-3 font-mono text-9 uppercase tracking-[0.12em] text-text-faint">
        <span className="text-edit">●</span> editable now · ○ arrives later
      </p>
    </>
  );
}
