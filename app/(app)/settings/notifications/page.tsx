import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { EnableNotifications } from '@/components/EnableNotifications';
import { YourDevices } from '@/components/YourDevices';
import { NotifPrefsSection } from '@/components/NotifPrefsSection';
import { PAGE_WIDE } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return (
    <div className={PAGE_WIDE}>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
      >
        <ArrowLeft size={13} /> Account
      </Link>
      {/* Paper masthead (round-2 ③). */}
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="font-serif text-[38px] font-medium leading-none tracking-[-0.02em] text-text md:text-[46px]">
          Notifications
        </h1>
        <p className="mt-2 font-serif text-[16px] leading-snug text-text-muted">
          Pushes to this device, only for what you choose.
        </p>
      </header>
      <EnableNotifications />
      <YourDevices />
      <NotifPrefsSection />
    </div>
  );
}
