'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, BarChart3, FileText, Hammer, LayoutDashboard, LayoutTemplate, NotebookPen, Users } from 'lucide-react';
import { SITE_URL } from '@/lib/site';

// Admin console nav rail: six tabs, each answering one question, on the shape
// Ghost's admin uses. Ordered operational first — Overview then the two
// analytical tabs then System — because health is the only thing here that is
// ever urgent.
//
//   Overview  is the site all right, and what should I do next?
//   Content   what have I published, and where are the holes?
//   Audience  who is out there and how do I reach them?
//   Traffic   is anyone reading, and how did they find it?
//   System    is the machine healthy and what does it cost?
//   Site      what do visitors see, and who decided?
//   Designer  Paddock Developer: the shared components, and later the pages
//
// Studio is NOT a tab. It is a different surface on the main host, so it sits
// below a divider as an external link — the rail should not imply you are
// staying in the console when you are not.
const NAV: { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/content', label: 'Content', icon: FileText },
  { href: '/admin/audience', label: 'Audience', icon: Users },
  { href: '/admin/traffic', label: 'Traffic', icon: BarChart3 },
  { href: '/admin/system', label: 'System', icon: Activity },
  { href: '/admin/site', label: 'Site', icon: LayoutTemplate },
  { href: '/admin/designer', label: 'Designer', icon: Hammer },
];

// ABSOLUTE, and it has to be. The console is served from
// dev.paddock-tracker.com, where middleware.ts 404s anything that is not
// /admin, /api/ or the heatmap frame — so a relative /studio link would 404. A
// full navigation to the main host is the only thing that works from both.
const STUDIO = `${SITE_URL}/studio`;

const ROW =
  'flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-(--duration-fast)';

export function AdminNav() {
  const pathname = usePathname();

  // Exact match for the hub so it does not stay lit on its sub-routes; prefix
  // match for the rest so a future /admin/system/<detail> keeps System active.
  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  return (
    <nav aria-label="Admin sections" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`${ROW} ${
                  active ? 'bg-surface-elevated text-brand' : 'text-text-muted hover:bg-surface-elevated hover:text-text'
                }`}
              >
                <Icon size={13} className={`shrink-0 ${active ? 'text-brand' : 'text-text-faint'}`} />
                {label}
              </Link>
            </li>
          );
        })}

        <li className="shrink-0 lg:mt-3 lg:border-t lg:border-border lg:pt-3">
          <a href={STUDIO} className={`${ROW} text-text-muted hover:bg-surface-elevated hover:text-text`}>
            <NotebookPen size={13} className="shrink-0 text-text-faint" />
            Studio
            <span aria-hidden className="text-text-faint">
              ↗
            </span>
          </a>
        </li>
      </ul>
    </nav>
  );
}
