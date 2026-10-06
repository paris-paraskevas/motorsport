'use client';
import {
  BookOpen,
  CalendarDays,
  CircleUser,
  Compass,
  Flag,
  House,
  Newspaper,
  Search,
  Settings,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount } from '@/lib/auth/client';
import { ICON_NAMES, isActivePath, resolveEntry, type IconName, type NavEntry } from '@/lib/design/destinations';
import type { AuthzScheme } from '@/lib/design/authz-defaults';
import { useVisibleEntries } from './useVisitor';

// The doors on phones (design handoff §2, panel 8b): equal cells, hairline
// dividers, a 2px accent rule across the active cell's top. The bar NEVER
// changes per section; series, blog, news and social are reached by name through
// the header's menu-and-search panel. Hidden on lg+ where the header carries the
// same model.
//
// Since Phase 2 the cells are the `bar` list (lib/design/lists.ts), three to five
// entries, each a route. The loader guarantees the count; a cell whose
// destination is not a route is skipped.

// The icon names an entry may carry (ICON_NAMES in lib/design/destinations.ts,
// plain, so the page parser checks a region's icon without this file's lucide
// graph, P2.10); the designer offers this set. An unknown name falls back to the
// compass so a cell is never blank.
const ICONS: Record<IconName, LucideIcon> = {
  house: House,
  'calendar-days': CalendarDays,
  compass: Compass,
  'circle-user': CircleUser,
  flag: Flag,
  trophy: Trophy,
  newspaper: Newspaper,
  'book-open': BookOpen,
  users: Users,
  settings: Settings,
  search: Search,
};
export const BAR_ICON_NAMES: readonly string[] = ICON_NAMES;
/** The set's icons by name, for the Tabs strip (P2.10). */
export const BAR_ICONS: Readonly<Record<string, LucideIcon>> = ICONS;

// An entry asking for an authorization scheme shows only to a visitor who
// passes it (Phase 3 step 4); with no schemes given (the designer's preview)
// every entry shows.
export function BottomBar({
  entries,
  schemes,
  preview = false,
}: {
  entries: NavEntry[];
  schemes?: readonly AuthzScheme[];
  preview?: boolean;
}) {
  const pathname = usePathname();
  // The signed-in user's picture on the Account cell (falls back to the
  // generic icon when signed-out). The provider is already mounted by the (app)
  // layout, so this adds no new SDK cost.
  const { isSignedIn, avatarUrl } = useAccount();
  const visible = useVisibleEntries(entries, schemes);

  const cells: { entry: NavEntry; href: string }[] = [];
  for (const entry of visible) {
    const dest = resolveEntry(entry);
    if (dest && dest.kind === 'route') cells.push({ entry, href: dest.href });
  }

  return (
    // `preview`: the designer draws the bar in place at phone width; on the site
    // it is fixed to the bottom of the phone viewport and hidden on lg+. The bottom
    // padding reserves the gesture bar's full height (safe-area-max-inset-bottom,
    // static) and the bar slides down by what the live inset does not yet need
    // (Chrome's edge-to-edge form): while the browser keeps the viewport off the
    // gesture bar the reserve sits below the screen, once the page extends under
    // it the reserve comes up, and the labels keep one distance from the bottom.
    // Browsers without the max inset (iOS) get bottom 0 and the live padding.
    <nav
      aria-label="Primary"
      className={`${
        preview ? 'relative' : 'lg:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)_-_env(safe-area-max-inset-bottom,env(safe-area-inset-bottom,0px)))] inset-x-0 z-30'
      } bg-surface-elevated border-t border-text pb-[env(safe-area-max-inset-bottom,env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]`}
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {cells.map(({ entry, href }, i) => (
          <BarLink
            key={`${entry.dest}-${i}`}
            href={href}
            active={isActivePath(href, pathname)}
            label={entry.label}
            Icon={BAR_ICONS[entry.icon ?? ''] ?? Compass}
            avatarUrl={entry.dest === 'account' && isSignedIn ? avatarUrl ?? undefined : undefined}
            divider={i > 0}
            dataTour={entry.dest === 'account' ? 'account' : undefined}
            dataHeatmapId={`bottombar:${entry.dest}`}
          />
        ))}
      </div>
    </nav>
  );
}

function BarLink({
  href,
  active,
  label,
  Icon,
  avatarUrl,
  divider,
  dataTour,
  dataHeatmapId,
}: {
  href: string;
  active: boolean;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  avatarUrl?: string;
  divider?: boolean;
  dataTour?: string;
  dataHeatmapId?: string;
}) {
  return (
    <Link
      href={href}
      data-tour={dataTour}
      data-heatmap-id={dataHeatmapId}
      aria-current={active ? 'page' : undefined}
      className={`relative flex flex-col items-center justify-center gap-[5px] pt-[9px] pb-[11px] transition-colors duration-(--duration-fast) ${
        divider ? 'border-l border-border' : ''
      } ${active ? 'text-brand' : 'text-text-faint hover:text-text'}`}
    >
      {/* The active marker — a hard 2px accent rule across the cell top,
          inset 14px, not a pill or glow. */}
      {active && (
        <span aria-hidden="true" className="absolute top-0 inset-x-[14px] h-[2px] bg-brand" />
      )}
      {avatarUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt=""
            className={`h-5 w-5 rounded-full object-cover ${active ? 'ring-2 ring-brand' : ''}`}
          />
        </>
      ) : (
        <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
      )}
      <span className="font-mono text-10 font-semibold uppercase tracking-[0.14em]">
        {label}
      </span>
    </Link>
  );
}
