'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { NavSeriesMeta } from '@/lib/types';
import { BottomBar } from './BottomBar';
import { Footer } from './Footer';
import { OnboardingWizard } from './OnboardingWizard';
import { ContactModal } from './ContactModal';
import { NavPanel } from './NavPanel';
import { NotificationBell } from './NotificationBell';
import { PushSoundPlayer } from './PushSoundPlayer';

// The four-door shell (design handoff §2, panel 8b). The global nav is exactly
// four destinations — Home, Calendar, Learn, Account — as the bottom bar on
// phones and the wordmark + the one menu-and-search panel (NavPanel) on
// desktop. Everything else — the series and their whole chain, blog, news,
// social, tools — is reached by name through that panel. The six hover
// mega-menus, the ⌘K modal and the header pill row died with this; Contact and
// the coffee link moved to the footer, sign-in lives behind the Account door.
// The wordmark is the only always-visible destination and goes HOME (/app),
// never the marketing landing — which also retires the old installed-PWA
// standalone detection (its whole job was avoiding a landing flash-trip).
export function AppShell({
  children,
  seriesList,
  bettingEnabled,
}: {
  children: React.ReactNode;
  seriesList: NavSeriesMeta[];
  // Server-resolved (isBettingConfigured) — gates the Social row in the nav
  // panel so the betting/social surface only appears once Supabase env exists.
  bettingEnabled: boolean;
}) {
  // Pointer glow (operator idea): a soft signal-amber halo trails the cursor to
  // highlight where the mouse is. Desktop-mouse only and off under reduced
  // motion; pointer-events:none so it never intercepts a click. Driven by a ref
  // + rAF (no React state) so mousemove costs no re-render.
  // Diameter in px — the transform below offsets by half of it to stay centred.
  // 440 → 140 (operator, 2026-08-03: much smaller circle).
  const GLOW_SIZE = 140;
  const glowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = glowRef.current;
    if (!el || !finePointer || reducedMotion) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    let shown = false;
    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        el.style.transform = `translate3d(${x - GLOW_SIZE / 2}px, ${y - GLOW_SIZE / 2}px, 0)`;
        if (!shown) {
          el.style.opacity = '1';
          shown = true;
        }
      });
    };
    const onLeave = () => {
      el.style.opacity = '0';
      shown = false;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Skip link: the first focusable element, visually hidden until keyboard
          focus, jumps past the fixed header/nav to the main content (WCAG 2.4.1). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:border focus:border-border focus:bg-surface-elevated focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-text"
      >
        Skip to content
      </a>
      {/* Fixed (not sticky — overflow-x: hidden on body kills sticky). 50px on
          phones, the spec's 58px on lg+, closed by a hard 1px ink rule. */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-surface-elevated border-b border-text pt-[env(safe-area-inset-top)]">
        <div className="flex h-[50px] w-full items-center gap-3 px-[14px] lg:h-[58px] lg:gap-[22px] lg:px-10">
          <Link
            href="/app"
            data-heatmap-id="nav:wordmark"
            className="shrink-0 font-serif text-[17px] font-semibold tracking-[-0.01em] text-text lg:text-[22px]"
          >
            <span className="hidden lg:inline">Paddock Tracker</span>
            <span className="lg:hidden">Paddock</span>
          </Link>

          <NavPanel seriesList={seriesList} bettingEnabled={bettingEnabled} />

          {/* Desktop door links (operator 2026-08-19): Calendar, Learn and
              Account one click from the header — Home stays the wordmark, and
              the panel remains the whole index. */}
          <DoorLinks />

          <div className="ml-auto flex shrink-0 items-center gap-3 lg:gap-4">
            <HeaderDate />
            <HeaderAccount />
          </div>
        </div>
      </header>

      {/* Top padding clears the fixed header; bottom padding clears the mobile
          bottom bar (device safe area included). */}
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-screen flex flex-col pt-[50px] lg:pt-[58px] pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0 outline-none"
      >
        <div className="flex-1">{children}</div>
        <Footer />
      </main>

      <BottomBar />

      <OnboardingWizard seriesList={seriesList} />
      <ContactModal />
      <PushSoundPlayer />

      {/* Cursor glow — see the effect above. Always rendered; only animated
          (and only visible) when gated in, otherwise it stays at opacity 0. */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[60] rounded-full opacity-0 transition-opacity duration-300 will-change-transform"
        style={{
          width: GLOW_SIZE,
          height: GLOW_SIZE,
          background:
            'radial-gradient(circle, rgba(255,180,0,0.14) 0%, rgba(255,180,0,0.06) 45%, rgba(255,180,0,0.02) 65%, transparent 82%)',
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}

// The three non-Home doors as quiet mono links, desktop only.
function DoorLinks() {
  const pathname = usePathname();
  const doors = [
    { href: '/calendar', label: 'Calendar' },
    { href: '/information', label: 'Learn' },
    { href: '/settings', label: 'Account' },
  ];
  return (
    <nav aria-label="Doors" className="hidden items-stretch gap-5 self-stretch lg:flex">
      {doors.map(d => {
        const active = pathname === d.href || pathname.startsWith(`${d.href}/`);
        return (
          <Link
            key={d.href}
            href={d.href}
            aria-current={active ? 'page' : undefined}
            data-heatmap-id={`nav:door:${d.label.toLowerCase()}`}
            className={`inline-flex items-center border-b-2 px-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors duration-(--duration-fast) ${
              active ? 'border-brand text-text' : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {d.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Today's date in the header (spec: mono 10px uppercase, desktop only).
// useSyncExternalStore with a null server snapshot keeps the device clock out
// of the SSR'd HTML (nothing to mismatch) without a set-state-in-effect.
const subscribeNever = () => () => {};
function todayLabel() {
  return new Date()
    .toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    .replace(',', '')
    .toUpperCase();
}
function HeaderDate() {
  const date = useSyncExternalStore(subscribeNever, todayLabel, () => null);
  return (
    <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted lg:block">
      {date}
    </span>
  );
}

// The Account door on desktop: notification bell (signed-in) + a 26px avatar
// circle. Signed-out shows the empty circle — /settings carries the sign-in,
// same as the bottom bar's Account cell has always behaved.
function HeaderAccount() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  return (
    <span className="flex items-center gap-2" data-tour="account">
      {isLoaded && isSignedIn && <NotificationBell />}
      <Link
        href="/settings"
        aria-label="Account"
        data-heatmap-id="nav:account"
        className="hidden lg:block h-[26px] w-[26px] shrink-0 overflow-hidden rounded-full border border-border-strong bg-surface"
      >
        {isLoaded && isSignedIn && user?.imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
          </>
        )}
      </Link>
    </span>
  );
}
