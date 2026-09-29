'use client';

import { useEffect, useState } from 'react';
import { BAR_ICONS } from '@/components/BottomBar';

// The Tabs strip (P2.10; APEX: Region Display Selector) over a page's regions:
// the tabs the server listed (the regions of the position with Region Display
// Selector on), drawn as the weekend page draws its tabs. In View Single Region
// a tab shows its region and hides the others by their wrappers (the dynamic
// actions' way, `data-region`); Show all shows every one. In Scroll Window every
// region stays shown and a tab scrolls to its region. The choice is remembered
// where the setting says, and read once after mount, so the server's first tab
// stands until then (applyTabs hid the rest before the page left the server).

export interface RegionTab {
  id: string;
  label: string;
  icon?: string;
}

const ALL = 'all';

export function RegionTabs({
  tabs,
  mode,
  showAll,
  remember,
  storageKey,
  icons,
}: {
  tabs: readonly RegionTab[];
  mode: 'single' | 'scroll';
  showAll: boolean;
  remember: 'browser' | 'visit' | 'no';
  storageKey: string;
  icons: boolean;
}) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? ALL);
  const store = (): Storage | null => (remember === 'browser' ? window.localStorage : remember === 'visit' ? window.sessionStorage : null);
  const wrapper = (id: string) => document.querySelector<HTMLElement>(`[data-region="${id}"]`);
  // View Single Region: every listed region but the chosen hidden; Show all, or Scroll Window, none.
  const apply = (id: string) => {
    for (const t of tabs) {
      const el = wrapper(t.id);
      if (el) el.hidden = mode === 'single' && id !== ALL && t.id !== id;
    }
  };
  const pick = (id: string) => {
    setActive(id);
    apply(id);
    try {
      store()?.setItem(storageKey, id);
    } catch {
      // A browser refusing storage keeps the choice for this page alone.
    }
    if (mode === 'scroll' && id !== ALL) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      wrapper(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    // The remembered tab, once after mount (the weekend tabs' own pattern: a lazy initializer would differ from the server's
    // first tab); a stored id no tab carries is ignored, Show all only while it is offered.
    let stored: string | null = null;
    try {
      stored = store()?.getItem(storageKey) ?? null;
    } catch {
      stored = null;
    }
    if (stored && stored !== active && (stored === ALL ? showAll && mode === 'single' : tabs.some(t => t.id === stored))) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setActive(stored);
      /* eslint-enable react-hooks/set-state-in-effect */
      apply(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (tabs.length < 2) return null;
  const entries: RegionTab[] = [...(showAll && mode === 'single' ? [{ id: ALL, label: 'Show all' }] : []), ...tabs];
  return (
    <nav aria-label="Sections" role="tablist" className="mb-5 flex flex-wrap gap-x-5 gap-y-2 border-b border-border font-mono text-11 uppercase tracking-[0.16em]">
      {entries.map(t => {
        const Icon = icons && t.icon ? BAR_ICONS[t.icon] : undefined;
        const selected = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={t.id === ALL ? undefined : `region-${t.id}`}
            onClick={() => pick(t.id)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2 transition-colors duration-(--duration-fast) ${
              selected ? 'border-brand text-text' : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
