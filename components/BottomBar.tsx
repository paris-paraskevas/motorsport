'use client';
import { CalendarDays, CircleUser, Compass, House } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';

// The four doors on phones (design handoff §2, panel 8b): Home, Calendar,
// Learn, Account — four equal cells, hairline dividers, a 2px accent rule
// across the active cell's top. The bar NEVER changes per section, and nothing
// else gets a cell: series, blog, news and social are reached by name through
// the header's menu-and-search panel. Hidden on lg+ where the header carries
// the same model.
export function BottomBar() {
  const pathname = usePathname();
  // The signed-in user's picture on the Account cell (falls back to the
  // generic icon when signed-out). Clerk is already mounted by the (app)
  // layout, so this adds no new SDK cost.
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-elevated border-t border-text pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4">
        <BarLink href="/app" active={pathname === '/app'} label="Home" Icon={House} dataHeatmapId="bottombar:home" />
        <BarLink
          href="/calendar"
          active={pathname === '/calendar' || pathname.startsWith('/calendar/')}
          label="Calendar"
          Icon={CalendarDays}
          divider
          dataHeatmapId="bottombar:calendar"
        />
        <BarLink
          href="/information"
          active={pathname === '/information' || pathname.startsWith('/information/')}
          label="Learn"
          Icon={Compass}
          divider
          dataHeatmapId="bottombar:learn"
        />
        <BarLink
          href="/settings"
          active={pathname === '/settings' || pathname.startsWith('/settings/')}
          label="Account"
          Icon={CircleUser}
          avatarUrl={isSignedIn ? user?.imageUrl : undefined}
          divider
          dataTour="account"
          dataHeatmapId="bottombar:account"
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
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">
        {label}
      </span>
    </Link>
  );
}
