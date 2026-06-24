'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useSignedIn } from './LandingAuth';

const GROUPS: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: 'Paddock',
    links: [
      { href: '/', label: 'Landing' },
      { href: '/app', label: 'Dashboard' },
      { href: '/calendar', label: 'Calendar' },
      { href: '/#series', label: 'All series' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/sign-in', label: 'Sign in' },
      { href: '/sign-up', label: 'Create account' },
      { href: '/settings', label: 'Settings' },
    ],
  },
  {
    heading: 'Project',
    links: [
      { href: '/changelog', label: 'Changelog' },
      { href: '/blog', label: 'Blog' },
      { href: '/about', label: 'About' },
    ],
  },
];

// Full-screen landing menu (the mockup's burger overlay). Proper dialog
// behaviour: focus moves in on open, Escape closes, focus returns to the
// trigger, body scroll locks. Links only to pages that exist today.
export function LandingMenu() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const signedIn = useSignedIn();
  // Signed in → the auth links (Sign in / Create account) are nonsense; collapse
  // the Account group to a single link into the app's account surface.
  const groups = signedIn
    ? GROUPS.map(g => (g.heading === 'Account' ? { ...g, links: [{ href: '/settings', label: 'Account' }] } : g))
    : GROUPS;

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    // Lock the page's real scroller — that's <html>; a body-level lock
    // leaves the document scrolling behind the open menu.
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="rounded-lg border border-border p-2 text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
      >
        <Menu size={18} />
      </button>

      {/* Portaled to <body>: the trigger lives inside the landing nav, whose
          backdrop-blur makes the header a containing block for fixed
          descendants (CSS filter-effects spec) — rendered in place, a fixed
          overlay collapses into the 56px header strip. Side drawer per
          operator 2026-06-11: half the screen, slides from the right, the
          landing grays out behind a scrim. Phones get 85% width — half of
          390px can't hold the type. Entry animates via @starting-style
          (Tailwind `starting:`), so reduced-motion and older engines simply
          appear in place. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 w-full bg-black/60 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:starting:opacity-0"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="absolute inset-y-0 right-0 w-[85%] max-w-sm sm:w-1/2 sm:max-w-none overflow-y-auto border-l border-border bg-bg motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-(--ease) motion-safe:starting:translate-x-full"
          >
            <div className="px-5 py-4 sm:px-8">
              <div className="flex h-10 items-center justify-between">
                <span className="font-display text-lg font-extrabold uppercase tracking-wide text-text">
                  Paddock<span className="text-brand">•</span>Tracker
                </span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="rounded-lg border border-border p-2 text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="mt-8 space-y-8 pb-16" aria-label="Site">
                {groups.map(group => (
                  <div key={group.heading}>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-faint">
                      {group.heading}
                    </p>
                    <ul className="mt-2 divide-y divide-border/40">
                      {group.links.map(l => (
                        <li key={l.href}>
                          <Link
                            href={l.href}
                            onClick={() => setOpen(false)}
                            className="block py-2.5 text-xl font-semibold tracking-tight text-text transition-colors duration-(--duration-fast) hover:text-brand"
                          >
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
