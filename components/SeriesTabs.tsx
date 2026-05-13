'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { TABS, TabKey } from '@/lib/tabs';

export function SeriesTabs({
  color,
  activeTab,
}: {
  color: string;
  activeTab: TabKey;
}) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Center the active tab in the horizontal scroller on mount + change.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [activeTab]);

  return (
    <div className="sticky top-14 lg:top-0 z-20 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-900/80 -mx-4 md:-mx-6 lg:-mx-8">
      <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <style>{`.tab-scroll::-webkit-scrollbar { display: none; }`}</style>
        <nav className="tab-scroll flex items-center min-w-max px-3">
          {TABS.map(tab => {
            const isActive = tab.key === activeTab;
            return (
              <Link
                key={tab.key}
                ref={isActive ? activeRef : undefined}
                href={`${pathname}?tab=${tab.key}`}
                scroll={false}
                className={`relative px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
