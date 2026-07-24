'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LAUNCH_ANNOUNCEMENT } from '@/lib/site';

const STORAGE_KEY = `paddock:launch-dismissed:${LAUNCH_ANNOUNCEMENT.id}`;

// Full-width announcement bar at the top of the content column (below the fixed
// header). Ships DARK — when LAUNCH_ANNOUNCEMENT.active is false it renders
// nothing. Dismissal persists in localStorage keyed by the announcement id, so
// bumping the id in lib/site.ts re-shows a new announcement to everyone.
//
// Visibility is decided in an effect (localStorage is browser-only) rather than
// at SSR, mirroring CookieConsent: dismissers never see a flash on later loads.
export function LaunchBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!LAUNCH_ANNOUNCEMENT.active) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // Private mode / blocked storage: treat as not dismissed (banner shows).
    }
    if (!dismissed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Non-persistent dismissal is acceptable — it'll reappear next visit.
    }
  };

  return (
    <div
      role="region"
      aria-label="Announcement"
      className="border-b border-border bg-surface-elevated"
    >
      <div className="w-full flex items-center gap-3 px-4 md:px-6 lg:px-8 py-2.5">
        <span aria-hidden className="h-3.5 w-[3px] shrink-0 bg-brand-fill" />
        <p className="min-w-0 flex-1 text-sm text-text">
          <span>{LAUNCH_ANNOUNCEMENT.message}</span>{' '}
          <Link
            href={LAUNCH_ANNOUNCEMENT.ctaHref}
            className="font-medium text-text underline decoration-brand decoration-2 underline-offset-2 hover:decoration-text focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated rounded-sm"
          >
            {LAUNCH_ANNOUNCEMENT.ctaLabel}
            <span aria-hidden> →</span>
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="-mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors duration-(--duration-fast) hover:bg-surface hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
