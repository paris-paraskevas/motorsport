'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActivePath, resolveDestination, type NavEntry } from '@/lib/design/destinations';

// The non-Home doors as quiet mono links, desktop only. Account left the header
// (round-2 ④, operator: "instead of account have series here") and stays one
// tap away via the panel's Settings → and the avatar.
//
// Since Phase 2 the doors are the `doors` list (lib/design/lists.ts), edited in
// the designer and rendered here. A door is a link, so an entry whose
// destination is an action is skipped rather than drawn as something it is not.
export function DoorLinks({ entries }: { entries: NavEntry[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Doors" className="hidden items-stretch gap-5 self-stretch lg:flex">
      {entries.map((entry, i) => {
        const dest = resolveDestination(entry.dest);
        if (!dest || dest.kind === 'action') return null;
        const active = dest.kind === 'route' && isActivePath(dest.href, pathname);
        const className = `inline-flex items-center border-b-2 px-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors duration-(--duration-fast) ${
          active ? 'border-brand text-text' : 'border-transparent text-text-muted hover:text-text'
        }`;
        if (dest.kind === 'external') {
          return (
            <a
              key={`${entry.dest}-${i}`}
              href={dest.href}
              target="_blank"
              rel="noopener noreferrer"
              data-heatmap-id={`nav:door:${entry.dest}`}
              className={className}
            >
              {entry.label}
            </a>
          );
        }
        return (
          <Link
            key={`${entry.dest}-${i}`}
            href={dest.href}
            aria-current={active ? 'page' : undefined}
            data-heatmap-id={`nav:door:${entry.dest}`}
            className={className}
          >
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
