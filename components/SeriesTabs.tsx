'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { TabKey, railTabsFor } from '@/lib/tabs';

// Module-level so it survives SeriesTabs REMOUNTING across the calendar (bare
// /series/[slug]) ↔ tab (/series/[slug]/[tab]) route-file boundary — those are
// separate route files, so a component-instance ref resets on each crossing and
// the scroll-to-top gets skipped (the "stays scrolled down on tab change" bug).
let lastScrolledPath: string | null = null;

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
  const tabs = railTabsFor(singleEvent, slug);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  // On tab navigation, land at the top of the new tab instead of inheriting the
  // old tab's scroll depth. The tab Links keep scroll={false} (Next's default
  // keeps position whenever the page still fills the viewport), so the scroll is
  // owned here — keyed on pathname and tracked module-side so it fires even when
  // SeriesTabs remounts crossing the calendar↔tab route boundary. The very
  // first path we see is exempt (fresh load / restored position).
  useEffect(() => {
    if (lastScrolledPath !== null && lastScrolledPath !== pathname) {
      window.scrollTo(0, 0);
    }
    lastScrolledPath = pathname;
    // Center the active tab in the horizontally-scrollable rail (mobile) by
    // scrolling the RAIL itself — NOT scrollIntoView, which also scrolls the
    // window vertically to the sticky rail's in-flow position (~73px) and undoes
    // the scroll-to-top above. Only when the rail actually overflows.
    const el = activeRef.current;
    const rail = railRef.current;
    if (el && rail && rail.scrollWidth > rail.clientWidth) {
      rail.scrollLeft = el.offsetLeft - (rail.clientWidth - el.clientWidth) / 2;
    }
  }, [pathname]);

  return (
    <nav
      aria-label="Series sections"
      className="sticky top-14 z-20 -mx-4 md:-mx-6 lg:-mx-8 mb-6 border-y border-border bg-bg/95 backdrop-blur-xl"
    >
      <div ref={railRef} className="flex overflow-x-auto scrollbar-none px-4 md:px-6 lg:px-8 gap-5 sm:gap-0">
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
              className={`shrink-0 sm:flex-1 inline-flex items-center justify-center h-11 border-b-2 px-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap transition-colors duration-(--duration-fast) ${
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
