'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SeriesMeta } from '@/lib/types';
import { BottomBar } from './BottomBar';
import { Footer } from './Footer';
import { OnboardingWizard } from './OnboardingWizard';
import { ContactModal } from './ContactModal';
import { HeaderUtils } from './HeaderUtils';
import { PushSoundPlayer } from './PushSoundPlayer';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

// One nav system since 0.17.0 (operator: "navigation menu and burger bar can
// go"): a single fixed header on every viewport — wordmark, inline links on
// lg+ — plus the mobile bottom bar. The drawer/sidebar and burger are gone;
// the 15-series list lives at /series.
const NAV = [
  { href: '/app', label: 'Home', exact: true },
  { href: '/calendar', label: 'Calendar', exact: true },
  { href: '/series', label: 'Series', exact: false },
  { href: '/blog', label: 'Blog', exact: false },
] as const;

export function AppShell({
  children,
  seriesList,
  bettingEnabled,
}: {
  children: React.ReactNode;
  seriesList: SeriesMeta[];
  // Server-resolved (isBettingConfigured) — gates the Play nav entry so the
  // betting surface only appears once the Supabase env is provisioned.
  bettingEnabled: boolean;
}) {
  const pathname = usePathname();

  const nav = [
    ...NAV,
    ...(bettingEnabled
      ? [
          { href: '/play', label: 'Play', exact: false },
          { href: '/social', label: 'Social', exact: false },
        ]
      : []),
  ];

  // Installed-PWA detection (same condition as StandaloneRedirect). In the
  // PWA the wordmark must NOT link to the landing: the standalone guard on /
  // immediately bounces back to /app, so the click was a flash-of-landing
  // round trip (operator-reported). Browser users keep the landing link.
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const detect = () =>
      setStandalone(
        window.matchMedia('(display-mode: standalone)').matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true,
      );
    const t = setTimeout(detect, 0);
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', detect);
    return () => {
      clearTimeout(t);
      mq.removeEventListener('change', detect);
    };
  }, []);

  return (
    <TooltipProvider delay={300}>
      {/* Fixed (not sticky — overflow-x: hidden on body kills sticky) */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-surface-elevated/85 backdrop-blur-xl border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl mx-auto px-3 md:px-4 h-14 flex items-center gap-6">
          {/* Wordmark → landing in the browser; → home in the installed PWA
              (a "/" link there just flashes the landing before the standalone
              guard bounces back). */}
          <Link
            href={standalone ? '/app' : '/'}
            className="font-display text-base font-extrabold uppercase tracking-wide text-text"
          >
            Paddock<span className="text-brand">•</span>Tracker
          </Link>

          {/* Inline nav on lg+ only — below that the bottom bar owns primary nav. */}
          <nav aria-label="Sections" className="hidden lg:flex items-stretch self-stretch gap-5">
            {nav.map(item => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={item.href === '/series' ? 'series' : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center border-b-2 px-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors duration-(--duration-fast) ${
                    active
                      ? 'border-brand text-text'
                      : 'border-transparent text-text-muted hover:text-text'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto" data-tour="account"><HeaderUtils seriesList={seriesList} /></div>
        </div>
      </header>

      {/* pt-14 clears the fixed header; bottom padding clears the mobile
          bottom bar (h-14 + device safe area). */}
      <main className="min-h-screen flex flex-col pt-14 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="flex-1">{children}</div>
        <Footer />
      </main>

      <BottomBar bettingEnabled={bettingEnabled} />

      <OnboardingWizard seriesList={seriesList} />
      <ContactModal />
      <PushSoundPlayer />
      <Toaster position="bottom-right" closeButton richColors />
    </TooltipProvider>
  );
}
