'use client';
import { CalendarDays, Flag, House, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Mobile bottom navigation (PR 2a, docs/redesign-2026-06.md): thumb-reach
// nav for phones and the installed PWA. Home / Calendar / Series / Settings —
// Series opens the drawer, which keeps the full 15-series list. Hidden on
// lg+ where the permanent sidebar covers navigation.
export function BottomBar({
  onSeriesClick,
  seriesOpen,
}: {
  onSeriesClick: () => void;
  seriesOpen: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-elevated/90 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4 h-14 max-w-2xl mx-auto">
        <BarLink
          href="/app"
          active={pathname === '/app'}
          label="Home"
          icon={<House size={20} strokeWidth={strokeFor(pathname === '/app')} />}
        />
        <BarLink
          href="/calendar"
          active={pathname === '/calendar'}
          label="Calendar"
          icon={<CalendarDays size={20} strokeWidth={strokeFor(pathname === '/calendar')} />}
        />
        <button
          type="button"
          onClick={onSeriesClick}
          aria-expanded={seriesOpen}
          className={`relative flex flex-col items-center justify-center gap-1 transition-colors duration-(--duration-fast) ${
            seriesOpen ? 'text-brand' : 'text-text-faint hover:text-text'
          }`}
        >
          {seriesOpen && <ActiveRule />}
          <Flag size={20} strokeWidth={strokeFor(seriesOpen)} />
          <BarLabel>Series</BarLabel>
        </button>
        <BarLink
          href="/settings"
          active={pathname === '/settings'}
          label="Settings"
          icon={<Settings size={20} strokeWidth={strokeFor(pathname === '/settings')} />}
        />
      </div>
    </nav>
  );
}

function strokeFor(isActive: boolean): number {
  return isActive ? 2.2 : 1.8;
}

function BarLink({
  href,
  active,
  label,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex flex-col items-center justify-center gap-1 transition-colors duration-(--duration-fast) ${
        active ? 'text-brand' : 'text-text-faint hover:text-text'
      }`}
    >
      {active && <ActiveRule />}
      {icon}
      <BarLabel>{label}</BarLabel>
    </Link>
  );
}

/* Timing-screen active marker — a hard amber rule across the cell top,
   not a pill or glow. */
function ActiveRule() {
  return <span aria-hidden="true" className="absolute top-0 inset-x-3 h-0.5 bg-brand" />;
}

function BarLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em]">
      {children}
    </span>
  );
}
