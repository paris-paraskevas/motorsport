'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  Newspaper,
  BarChart3,
  Flag,
  Users,
  Scale,
  Info,
  Clock,
  Trophy,
  LucideIcon,
} from 'lucide-react';
import { TABS, TabKey, tabsFor } from '@/lib/tabs';

const ICONS: Record<TabKey, LucideIcon> = {
  calendar: Calendar,
  news: Newspaper,
  standings: BarChart3,
  results: Flag,
  drivers: Users,
  rules: Scale,
  about: Info,
  history: Clock,
  champions: Trophy,
};

export function SeriesTabs({
  color,
  activeTab,
  singleEvent,
}: {
  color: string;
  activeTab: TabKey;
  singleEvent?: boolean;
}) {
  const pathname = usePathname();
  const tabs = tabsFor(singleEvent);
  const cols = singleEvent ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3';

  return (
    <nav className={`grid ${cols} gap-2 md:gap-3 mb-8`} aria-label="Series sections">
      {tabs.map(tab => {
        const isActive = tab.key === activeTab;
        const Icon = ICONS[tab.key];
        return (
          <Link
            key={tab.key}
            href={`${pathname}?tab=${tab.key}`}
            scroll={false}
            aria-current={isActive ? 'page' : undefined}
            className={`group relative flex flex-col items-center justify-center gap-2 py-5 px-2 rounded-2xl border transition-all duration-(--duration-base) ${
              isActive
                ? 'bg-surface-elevated border-tint'
                : 'bg-surface/40 border-border/60 hover:bg-surface hover:border-border-strong'
            }`}
            style={
              isActive
                ? { boxShadow: `inset 0 0 0 1px ${color}, 0 8px 24px -16px ${color}` }
                : undefined
            }
          >
            <Icon
              size={22}
              className={isActive ? 'text-tint' : 'text-text-muted group-hover:text-text transition-colors duration-(--duration-fast)'}
              strokeWidth={isActive ? 2 : 1.75}
            />
            <span
              className={`text-[11px] uppercase tracking-[0.12em] font-semibold text-center leading-tight ${
                isActive ? 'text-text' : 'text-text-muted group-hover:text-text'
              }`}
            >
              {singleEvent && tab.key === 'champions' ? 'Past Winners' : tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
