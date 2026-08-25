'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, LayoutDashboard, LayoutTemplate, MousePointerClick, NotebookPen, Users } from 'lucide-react';
import { SITE_URL } from '@/lib/site';

// Admin console nav rail. Ordered by what you came here to DO, not by data
// source: composing the home page first, then the queue of things with a person
// waiting, then the one screen of measurement nobody else can give us.
//
// Traffic and Search were removed in 0.334.27 — read-only pages duplicating
// Google's own console, holding ~352 KiB of a Worker budget with 19 KiB left.
// Tools went with them: it was five links to surfaces that live elsewhere, which
// is why Studio is a real row here instead.
//
// Active state is an EXACT pathname match (like AppShell's isActive('/',
// true)) so /admin does not stay lit on its sub-routes. A horizontally
// scrollable chip strip on mobile; a vertical rail that sticks below the fixed
// h-14 header on lg+.
const NAV: { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/home', label: 'Home page', icon: LayoutTemplate },
  // ABSOLUTE, and it has to be. The console is served from
  // dev.paddock-tracker.com, where middleware.ts:92-98 404s anything that is not
  // /admin, /api/ or the heatmap frame — so a relative /studio link from here
  // would 404. A full navigation to the main host is the only thing that works
  // from both hosts.
  { href: `${SITE_URL}/studio`, label: 'Studio', icon: NotebookPen },
  { href: '/admin/users', label: 'People', icon: Users },
  { href: '/admin/submissions', label: 'Submissions', icon: Inbox },
  { href: '/admin/behaviour', label: 'Behaviour', icon: MousePointerClick },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {NAV.map(({ href, label, icon: Icon }) => {
          const external = href.startsWith('http');
          const active = !external && pathname === href;
          const cls = `flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-(--duration-fast) ${
            active ? 'bg-surface-elevated text-brand' : 'text-text-muted hover:bg-surface-elevated hover:text-text'
          }`;
          const inner = (
            <>
              <Icon size={13} className={`shrink-0 ${active ? 'text-brand' : 'text-text-faint'}`} />
              {label}
              {external && <span aria-hidden className="text-text-faint">↗</span>}
            </>
          );
          return (
            <li key={href} className="shrink-0">
              {external ? (
                <a href={href} className={cls}>
                  {inner}
                </a>
              ) : (
                <Link href={href} aria-current={active ? 'page' : undefined} className={cls}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
