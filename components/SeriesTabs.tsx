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
import { TABS, TabKey } from '@/lib/tabs';

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
}: {
  color: string;
  activeTab: TabKey;
}) {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-3 gap-2 mb-6">
      {TABS.map(tab => {
        const isActive = tab.key === activeTab;
        const Icon = ICONS[tab.key];
        return (
          <Link
            key={tab.key}
            href={`${pathname}?tab=${tab.key}`}
            scroll={false}
            aria-current={isActive ? 'page' : undefined}
            className={`group flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-xl border transition-all ${
              isActive
                ? 'bg-zinc-900 border-zinc-700'
                : 'bg-zinc-900/30 border-zinc-800/60 hover:bg-zinc-900/70 hover:border-zinc-700'
            }`}
            style={isActive ? { borderColor: color, boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
          >
            <Icon
              size={20}
              className={isActive ? '' : 'text-zinc-400 group-hover:text-zinc-200 transition-colors'}
              style={isActive ? { color } : undefined}
            />
            <span
              className={`text-[11px] uppercase tracking-[0.1em] font-semibold text-center leading-tight ${
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
