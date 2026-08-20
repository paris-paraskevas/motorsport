import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Bell, Download, LogOut, Palette } from 'lucide-react';
import { auth } from '@clerk/nextjs/server';
import { SignOutButton } from '@clerk/nextjs';
import { isBettingConfigured } from '@/lib/betting/client';
import { getAccountStats } from '@/lib/betting/account';
import { AccountIdentity } from '@/components/AccountIdentity';
import { ChampionshipsRow, TimezoneRow } from '@/components/FollowedChips';
import { loadAllSeriesMeta } from '@/lib/series';
import { AccountStats } from '@/components/AccountStats';
import { AccountStaffLinks } from '@/components/AccountStaffLinks';
import { PAGE_WIDE } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

// The Account hub: identity, your personal stats (own account, signed-in), and
// links into the dedicated Notifications + Championships pages. URL stays
// /settings (bookmarks, Clerk redirects); the surface is "Account".
export default async function AccountPage() {
  const { userId } = await auth();
  const stats = userId && isBettingConfigured() ? await getAccountStats(userId).catch(() => null) : null;
  const seriesList = (await loadAllSeriesMeta()).map(({ slug, name, color }) => ({ slug, name, color }));

  return (
    // Full page width (operator, 2026-08-20: "/account's width is small") —
    // the 880px read-column cap was out of step with the reimagined surfaces.
    <div className={PAGE_WIDE}>
      {/* Paper masthead (round-2 ③): the display-caps register and its accent
          bar were the pre-reimagining language. */}
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="font-serif text-[38px] font-medium leading-none tracking-[-0.02em] text-text md:text-[46px]">
          Account
        </h1>
        <p className="mt-2 font-serif text-[16px] leading-snug text-text-muted">
          What you follow, how the site pings you, and your data.
        </p>
      </header>

      <AccountIdentity />
      {stats && <AccountStats stats={stats} />}

      <nav className="border-t border-border">
        <Link
          href="/settings/theme"
          className="group flex items-center gap-3 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          <Palette size={18} className="shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-text text-base font-semibold">Theme</span>
            <span className="block text-text-faint text-xs">Six looks, or match your device</span>
          </span>
          <ArrowUpRight size={16} className="shrink-0 text-text-faint group-hover:text-text-muted" />
        </Link>
        {/* "Customise home" row removed with the editorial-home cutover
            (2026-08-18) — the four lead blocks are fixed; the widget system +
            /settings/customize are being retired. */}
        <Link
          href="/settings/notifications"
          className="group flex items-center gap-3 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          <Bell size={18} className="shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-text text-base font-semibold">Notifications</span>
            <span className="block text-text-faint text-xs">Opt in, and choose what pings you</span>
          </span>
          <ArrowUpRight size={16} className="shrink-0 text-text-faint group-hover:text-text-muted" />
        </Link>
        {/* Championships carries the live follow state — the standalone
            "You follow" block it replaces duplicated this row. */}
        <ChampionshipsRow series={seriesList} />
        <TimezoneRow />
        <AccountStaffLinks />
        {/* The 11c foot rows (job ⑨/#15): your data and your session, stated
            plainly. Export goes through /contact — there is no self-serve
            export pipeline, and pretending otherwise would be dishonest;
            "Customise home" stays dead (widget cutover decision). */}
        <Link
          href="/contact"
          data-heatmap-id="account:export-data"
          className="group flex items-center gap-3 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          <Download size={18} className="shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-text text-base font-semibold">Export your data</span>
            <span className="block text-text-faint text-xs">Ask, and we send everything we hold — by email</span>
          </span>
          <ArrowUpRight size={16} className="shrink-0 text-text-faint group-hover:text-text-muted" />
        </Link>
        {userId && (
          <SignOutButton>
            <button
              type="button"
              data-heatmap-id="account:sign-out"
              className="group flex w-full items-center gap-3 border-b border-border py-4 text-left transition-colors duration-(--duration-fast) hover:bg-surface"
            >
              <LogOut size={18} className="shrink-0 text-brand" />
              <span className="min-w-0 flex-1">
                <span className="block text-text text-base font-semibold">Sign out</span>
                <span className="block text-text-faint text-xs">End this session on this device</span>
              </span>
            </button>
          </SignOutButton>
        )}
      </nav>
    </div>
  );
}
