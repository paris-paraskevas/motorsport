import type { Metadata } from 'next';
import { loadAllSeriesMeta } from '@/lib/series';
import { AccountIdentity } from '@/components/AccountIdentity';
import { SettingsClient } from '@/components/SettingsClient';
import { EnableNotifications } from '@/components/EnableNotifications';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

// URL stays /settings (bookmarks, sitemap, Clerk redirects); the surface is
// the Account page the bottom bar promises.
export default async function AccountPage() {
  const seriesList = await loadAllSeriesMeta();

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
            Account<span className="text-brand">.</span>
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Profile · notifications · followed series
          </p>
        </div>
      </header>
      <AccountIdentity />
      <EnableNotifications />
      <SettingsClient seriesList={seriesList} />
    </div>
  );
}
