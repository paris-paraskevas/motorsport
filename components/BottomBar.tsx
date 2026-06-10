'use client';
import { CalendarDays, CircleUser, Flag, House } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Mobile bottom navigation (PR 2a, docs/redesign-2026-06.md): thumb-reach
// nav for phones and the installed PWA. Every tab is a real destination —
// Series goes to the /series hub (operator feedback on 0.15.0: a nav tab
// must not open a menu); the drawer stays reachable from the header burger.
// Hidden on lg+ where the permanent sidebar covers navigation.
export function BottomBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-elevated/90 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4 h-14 max-w-2xl mx-auto">
        <BarLink href="/app" active={pathname === '/app'} label="Home" Icon={House} />
        <BarLink
          href="/calendar"
          active={pathname === '/calendar'}
          label="Calendar"
          Icon={CalendarDays}
        />
        <BarLink
          href="/series"
          active={pathname === '/series' || pathname.startsWith('/series/')}
          label="Series"
          Icon={Flag}
        />
        <BarLink
          href="/settings"
          active={pathname === '/settings'}
          label="Account"
          Icon={CircleUser}
        />
      </div>
    </nav>
  );
}

function BarLink({
  href,
  active,
  label,
  Icon,
}: {
  href: string;
  active: boolean;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex flex-col items-center justify-center gap-1 transition-colors duration-(--duration-fast) ${
        active ? 'text-brand' : 'text-text-faint hover:text-text'
      }`}
    >
      {/* Timing-screen active marker — a hard amber rule across the cell top,
          not a pill or glow. */}
      {active && (
        <span aria-hidden="true" className="absolute top-0 inset-x-3 h-0.5 bg-brand" />
      )}
      <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em]">
        {label}
      </span>
    </Link>
  );
}
