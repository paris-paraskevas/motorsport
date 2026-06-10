'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { TabKey, tabsFor } from '@/lib/tabs';

// Sticky tab rail (PR 2c-3, docs/redesign-2026-06.md): replaces the 9-tile
// grid that ate the first mobile viewport before any content. Horizontally
// scrollable, sticks under the fixed app header (top-14) — which works
// because html/body use overflow-x: clip, not hidden. Active tab carries the
// series color via the page's --tint scope.
export function SeriesTabs({
  activeTab,
  singleEvent,
}: {
  activeTab: TabKey;
  singleEvent?: boolean;
}) {
  const pathname = usePathname();
  const tabs = tabsFor(singleEvent);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // Keep the active tab in view when landing deep (e.g. ?tab=champions).
  useEffect(() => {
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
          return (
            <Link
              key={tab.key}
              ref={isActive ? activeRef : undefined}
              href={`${pathname}?tab=${tab.key}`}
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
