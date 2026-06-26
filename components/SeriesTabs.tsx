'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { TabKey, tabsFor } from '@/lib/tabs';

// Sticky tab rail (PR 2c-3, docs/redesign-2026-06.md): replaces the 9-tile
// grid that ate the first mobile viewport before any content. Horizontally
// scrollable, sticks under the fixed app header (top-14) — which works
// because html/body use overflow-x: clip, not hidden. Active tab carries the
// series color via the page's --tint scope.
//
// Path-based tabs (B11): each tab links to /series/[slug]/[tab] (calendar to the
// bare /series/[slug]); the active tab comes from the route params, not searchParams.
export function SeriesTabs({
  slug,
  activeTab,
  singleEvent,
}: {
  slug: string;
  activeTab: TabKey;
  singleEvent?: boolean;
}) {
  const tabs = tabsFor(singleEvent);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const prevTabRef = useRef<TabKey | null>(null);

  // On tab switch, land at the top of the new tab instead of inheriting the
  // old tab's scroll depth. Next's default Link scroll can't deliver this —
  // it maintains position whenever the page still fills the viewport — so the
  // Links keep scroll={false} and the scroll is owned here. First render is
  // exempt: fresh loads already start at top, and back/forward should keep
  // the browser's restored position.
  useEffect(() => {
    if (prevTabRef.current !== null && prevTabRef.current !== activeTab) {
      window.scrollTo(0, 0);
    }
    prevTabRef.current = activeTab;
    // Keep the active tab in view when landing deep (e.g. /series/f1/champions).
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [activeTab]);

  return (
    <nav
      aria-label="Series sections"
      className="sticky top-14 z-20 -mx-4 md:-mx-6 lg:-mx-8 mb-6 border-y border-border bg-bg/95 backdrop-blur-xl"
    >
      <div className="flex overflow-x-auto scrollbar-none px-4 md:px-6 lg:px-8 gap-5">
        {tabs.map(tab => {
          const isActive = tab.key === activeTab;
          const href = tab.key === 'calendar' ? `/series/${slug}` : `/series/${slug}/${tab.key}`;
          return (
            <Link
              key={tab.key}
              ref={isActive ? activeRef : undefined}
              href={href}
              scroll={false}
              aria-current={isActive ? 'page' : undefined}
              className={`shrink-0 inline-flex items-center h-11 border-b-2 px-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap transition-colors duration-(--duration-fast) ${
                isActive
                  ? 'border-tint text-text'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              {singleEvent && tab.key === 'champions' ? 'Past Winners' : tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
