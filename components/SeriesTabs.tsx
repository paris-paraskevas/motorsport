'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  Newspaper,
  BarChart3,
  Flag,
  Users,
  Building2,
  Scale,
  Info,
  Clock,
  Trophy,
  LucideIcon,
} from 'lucide-react';
import { TABS, TabKey } from '@/lib/tabs';

const ICONS: Record<TabKey, LucideIcon> = {
  calendar: Calendar,
  news: Newspaper,
  standings: BarChart3,
  results: Flag,
  drivers: Users,
  teams: Building2,
  rules: Scale,
  about: Info,
  history: Clock,
  champions: Trophy,
};

export function SeriesTabs({
  color,
  activeTab,
}: {
  color: string;
  activeTab: TabKey;
}) {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-3 gap-2 md:gap-3 mb-8" aria-label="Series sections">
      {TABS.map(tab => {
        const isActive = tab.key === activeTab;
        const Icon = ICONS[tab.key];
        return (
          <Link
            key={tab.key}
            href={`${pathname}?tab=${tab.key}`}
            scroll={false}
            aria-current={isActive ? 'page' : undefined}
            className={`group relative flex flex-col items-center justify-center gap-2 py-5 px-2 rounded-2xl border transition-all duration-200 ${
              isActive
                ? 'bg-zinc-900/80 border-zinc-700'
                : 'bg-zinc-900/20 border-zinc-800/60 hover:bg-zinc-900/50 hover:border-zinc-700/80'
            }`}
            style={
              isActive
                ? {
                    borderColor: color,
                    boxShadow: `inset 0 0 0 1px ${color}, 0 8px 24px -16px ${color}`,
                  }
                : undefined
            }
          >
            <Icon
              size={22}
              className={isActive ? '' : 'text-zinc-400 group-hover:text-zinc-200 transition-colors'}
              strokeWidth={isActive ? 2 : 1.75}
              style={isActive ? { color } : undefined}
            />
            <span
              className={`text-[11px] uppercase tracking-[0.12em] font-semibold text-center leading-tight ${
                isActive ? 'text-zinc-50' : 'text-zinc-400 group-hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
