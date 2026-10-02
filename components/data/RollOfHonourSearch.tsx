'use client';
import { useId, useRef, useState } from 'react';
import { slugify } from '@/lib/slug';

// R18 PR E (the operator's "search box next", 2026-10-02): the Roll of honour's search box, a client island inside the view's
// Jump-to bar. The seasons stay server markup: each wrapper carries `data-search`, the season's words slugified (lib/slug.ts:
// lowercase, the diacritics stripped, hyphens between words), and a query matches when every one of its words, slugified, is
// in that haystack. The island hides the seasons that do not match, a decade left with none and its chip, the era row and
// its chip while a query is active, writes the counts and shows the empty line; an empty query restores everything. Nothing
// is fetched and the address does not change: every season is already on the page. The view's root carries `data-honours`
// and the island finds it from its own input, so two regions on one page stay apart.

/** Whether every word of the query is in the haystack, both slugified ("Théo Pourchaire" meets "theo pourchaire"). */
export function matches(haystack: string, query: string): boolean {
  const words = query.split(/\s+/).map(slugify).filter(Boolean);
  return words.length > 0 && words.every(w => haystack.includes(w));
}

const seasons = (n: number) => `${n} ${n === 1 ? 'season' : 'seasons'}`;

export function RollOfHonourSearch({ total }: { total: number }) {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(total);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const apply = (raw: string) => {
    setQuery(raw);
    const root = input.current?.closest<HTMLElement>('[data-honours]');
    if (!root) return;
    const active = raw.trim() !== '';
    // Read before the toggles: whether the reader has scrolled into the roll (its top above the viewport's top).
    const scrolledIn = root.getBoundingClientRect().top < 0;
    let visible = 0;
    for (const season of root.querySelectorAll<HTMLElement>('[data-season]')) {
      const hit = !active || matches(season.dataset.search ?? '', raw);
      season.hidden = !hit;
      if (hit) visible++;
    }
    for (const decade of root.querySelectorAll<HTMLElement>('[data-decade]')) {
      const all = decade.querySelectorAll('[data-season]').length;
      const left = decade.querySelectorAll('[data-season]:not([hidden])').length;
      decade.hidden = active && left === 0;
      const count = decade.querySelector<HTMLElement>('[data-decade-count]');
      if (count) count.textContent = active ? `${left} of ${seasons(all)}` : seasons(all);
      const chip = root.querySelector<HTMLElement>(`[data-chip="${decade.id}"]`);
      if (chip) chip.hidden = decade.hidden;
    }
    for (const el of root.querySelectorAll<HTMLElement>('[data-era], [data-chip-era]')) el.hidden = active;
    const empty = root.querySelector<HTMLElement>('[data-empty]');
    if (empty) empty.hidden = !(active && visible === 0);
    // A roll made shorter under its sticky bar: the browser anchors the content after it, so the bar rides up out of view
    // with the box in it. The roll's top (the bar under the header, the root's scroll margin) is brought back, instantly.
    if (active && scrolledIn) root.scrollIntoView({ block: 'start', behavior: 'instant' });
    setShown(visible);
  };
  const active = query.trim() !== '';
  const words = !active ? seasons(total) : shown === 0 ? 'No season matches' : `${shown} of ${seasons(total)}`;
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Find a season or a driver
      </label>
      <input
        ref={input}
        id={id}
        type="search"
        value={query}
        onChange={e => apply(e.target.value)}
        // Enter has nothing to submit: it closes the phone keyboard over the seasons left.
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        placeholder="Find a season or a driver"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        // 16 px up to lg: a touch browser zooms a smaller field on focus, and tablets sit between sm and lg.
        className="h-9 w-full min-w-0 rounded-lg border border-border-strong bg-surface px-3 font-sans text-16 text-text placeholder:text-text-faint focus:border-brand focus:outline-none sm:h-8 sm:w-60 lg:text-13"
      />
      <span role="status" className="shrink-0 font-mono text-11 text-text-faint">
        {words}
      </span>
    </>
  );
}
