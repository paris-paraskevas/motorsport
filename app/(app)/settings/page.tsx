import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Bell, Trophy } from 'lucide-react';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { getAccountStats } from '@/lib/betting/account';
import { AccountIdentity } from '@/components/AccountIdentity';
import { AccountStats } from '@/components/AccountStats';
import { HomeCustomizeBanner } from '@/components/HomeCustomizeBanner';

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

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
        <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
          Account<span className="text-brand">.</span>
        </h1>
      </header>

      <AccountIdentity />
      {stats && <AccountStats stats={stats} />}

      <HomeCustomizeBanner />

      <nav className="border-t border-border">
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
      </nav>
    </div>
  );
}
