import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Bell, Palette, Trophy } from 'lucide-react';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { getAccountStats } from '@/lib/betting/account';
import { AccountIdentity } from '@/components/AccountIdentity';
import { FollowedChips, TimezoneRow } from '@/components/FollowedChips';
import { loadAllSeriesMeta } from '@/lib/series';
import { AccountStats } from '@/components/AccountStats';
import { AccountStaffLinks } from '@/components/AccountStaffLinks';
import { PAGE_READ } from '@/lib/site';

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
    <div className={PAGE_READ}>
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand-fill" />
        <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
          Account<span className="text-brand">.</span>
        </h1>
      </header>

      <AccountIdentity />
      {stats && <AccountStats stats={stats} />}

      {/* "You follow" leads (design handoff §4.11c). */}
      <FollowedChips series={seriesList} />

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
        <Link
          href="/settings/series"
          className="group flex items-center gap-3 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          <Trophy size={18} className="shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-text text-base font-semibold">Championships</span>
            <span className="block text-text-faint text-xs">Choose the series you follow</span>
          </span>
          <ArrowUpRight size={16} className="shrink-0 text-text-faint group-hover:text-text-muted" />
        </Link>
        <TimezoneRow />
        <AccountStaffLinks />
      </nav>
    </div>
  );
}
