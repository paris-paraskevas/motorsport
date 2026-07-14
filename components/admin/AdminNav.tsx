'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Inbox, LayoutDashboard, MousePointerClick, Search, Sparkles, Users } from 'lucide-react';

// Admin console nav rail: the seven routes. Active state is an EXACT pathname
// match (like AppShell's isActive('/app', true)) so /admin (Overview) does not
// stay lit on its sub-routes. A horizontally-scrollable chip strip on mobile; a
// vertical rail that sticks below the fixed h-14 header on lg+.
const NAV: { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/traffic', label: 'Traffic', icon: BarChart3 },
  { href: '/admin/search', label: 'Search', icon: Search },
  { href: '/admin/behaviour', label: 'Behaviour', icon: MousePointerClick },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/submissions', label: 'Submissions', icon: Inbox },
  { href: '/admin/tools', label: 'Tools', icon: Sparkles },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-(--duration-fast) ${
                  active ? 'bg-surface-elevated text-brand' : 'text-text-muted hover:bg-surface-elevated hover:text-text'
                }`}
              >
                <Icon size={13} className={`shrink-0 ${active ? 'text-brand' : 'text-text-faint'}`} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
