'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth, useUser, SignOutButton } from '@clerk/nextjs';
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
          {/* The PADDOCK•TRACKER wordmark (operator, 2026-08-20: "get back our
              logo") — condensed caps + the brand dot, one treatment shared with
              LandingNav and LandingFooter. Mobile drops to PADDOCK for width. */}
          <Link
            href="/app"
            data-heatmap-id="nav:wordmark"
            className="shrink-0 font-condensed text-[16px] font-bold uppercase tracking-[0.06em] text-text lg:text-[19px]"
          >
            <span className="hidden lg:inline">
              Paddock<span className="text-brand">•</span>Tracker
            </span>
            <span className="lg:hidden">Paddock</span>
          </Link>

          <NavPanel seriesList={seriesList} bettingEnabled={bettingEnabled} />

          {/* Desktop door links (operator 2026-08-19, revised round-2 ④):
              Calendar, Learn and Series one click from the header — Home stays
              the wordmark, and the panel remains the whole index. */}
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

// The three non-Home doors as quiet mono links, desktop only. Account left
// the header (round-2 ④, operator: "instead of account have series here") —
// it stays one tap away via the panel's Settings → and the avatar.
function DoorLinks() {
  const pathname = usePathname();
  const doors = [
    { href: '/calendar', label: 'Calendar' },
    { href: '/information', label: 'Learn' },
    { href: '/series', label: 'Series' },
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

// The Account door on desktop: notification bell (signed-in) + the avatar,
// which now opens a small account MENU instead of jumping straight to
// /settings (operator, 2026-08-20, Gantt-app reference: "If i then click
// Profile i will go to account page. If not i have access to blog, whats new,
// about, sign out"). Signed-out gets the same menu with Sign in at the top.
function HeaderAccount() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const itemClass =
    'block w-full px-3 py-2 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:bg-surface hover:text-text';
  const close = () => setOpen(false);

  return (
    <span ref={wrapRef} className="relative flex items-center gap-2" data-tour="account">
      {isLoaded && isSignedIn && <NotificationBell />}
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        data-heatmap-id="nav:account"
        onClick={() => setOpen(v => !v)}
        className="hidden lg:block h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border-strong bg-surface transition-colors duration-(--duration-fast) hover:border-text"
      >
        {isLoaded && isSignedIn && user?.imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-60 border-[1.5px] border-text bg-surface-elevated shadow-lg"
        >
          {isSignedIn && user ? (
            <div className="border-b border-border px-3 py-2.5">
              <span className="block truncate font-serif text-[15px] font-semibold leading-tight text-text">
                {user.fullName ?? user.username ?? 'Signed in'}
              </span>
              {user.primaryEmailAddress?.emailAddress && (
                <span className="mt-0.5 block truncate font-mono text-[10px] text-text-faint">
                  {user.primaryEmailAddress.emailAddress}
                </span>
              )}
            </div>
          ) : (
            <Link href="/settings" role="menuitem" onClick={close} className={`${itemClass} border-b border-border text-brand`}>
              Sign in
            </Link>
          )}
          {isSignedIn && (
            <Link href="/settings" role="menuitem" onClick={close} className={itemClass}>
              Profile
            </Link>
          )}
          <Link href="/changelog" role="menuitem" onClick={close} className={itemClass}>
            What&apos;s new
          </Link>
          <Link href="/blog" role="menuitem" onClick={close} className={itemClass}>
            Blog
          </Link>
          <Link href="/about" role="menuitem" onClick={close} className={itemClass}>
            About
          </Link>
          {isSignedIn && (
            <div className="border-t border-border">
              <SignOutButton redirectUrl="/">
                <button type="button" role="menuitem" className={`${itemClass} text-brand hover:text-brand`}>
                  Sign out
                </button>
              </SignOutButton>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
