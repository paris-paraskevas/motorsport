'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Flag, X } from 'lucide-react';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { LAUNCH_ANNOUNCEMENT } from '@/lib/site';
import { isConsentPending } from '@/components/CookieConsent';

const STORAGE_KEY = `paddock:launch-dismissed:${LAUNCH_ANNOUNCEMENT.id}`;
/** Clerk `unsafeMetadata` key, so a dismissal follows an account across devices
 *  — the same mechanism SupportPrompt uses for its permanent opt-out. */
const META_KEY = 'launchDismissed';

// The trap lands focus on the first focusable element, which is the close
// button, so every control needs a real ring rather than the UA default box.
const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated';

/**
 * The 1.0 announcement, as a modal over whatever page the reader arrived on.
 *
 * Operator, 2026-08-25: "1.0 needs to be a pop up banner that covers any page
 * upon a users visit, it can be shown to everyone, same dont show again logic as
 * support prompt." It replaced an inline dismissible bar, which could not carry
 * an explanation of anything.
 *
 * Ships DARK — `LAUNCH_ANNOUNCEMENT.active` false renders nothing at all, so
 * this is inert until launch day.
 *
 * Shown ONCE. Dismissal persists in localStorage keyed by the announcement id
 * (so bumping the id re-shows a new announcement), and additionally to Clerk
 * `unsafeMetadata` when signed in, so it does not reappear on another device.
 * localStorage rather than SupportPrompt's sessionStorage because an
 * announcement that returns in every new tab is an annoyance, not an announcement.
 *
 * The shell — backdrop, focus trap, scroll lock, and an entrance gated behind
 * `motion-safe:` so `prefers-reduced-motion` is honoured — follows SupportPrompt
 * deliberately, rather than inventing a second dialog language.
 */
export function LaunchBanner() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [open, setOpen] = useState(false);
  // Entrance flag, flipped a frame after mount so the closed state renders first
  // and the transition actually plays (CookieConsent's pattern).
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const dismissedOnAccount = Boolean(
    isSignedIn && (user?.unsafeMetadata as Record<string, unknown> | undefined)?.[META_KEY],
  );

  useEffect(() => {
    if (!LAUNCH_ANNOUNCEMENT.active) return;
    // Wait for Clerk rather than flash an announcement at an account that has
    // already dismissed it on another device.
    if (!isLoaded || dismissedOnAccount) return;
    // The consent modal owns the screen on a first visit, and two stacked
    // dialogs is the definition of infuriating. It reappears on the next
    // navigation once consent is settled.
    if (isConsentPending()) return;
    // Any other dialog already holds the screen and the focus.
    if (document.querySelector('[role="dialog"]')) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // Private mode / blocked storage: treat as not dismissed, so the reader
      // still sees it once per session rather than never.
    }
    if (dismissed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [isLoaded, dismissedOnAccount]);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  /** Closing it at all counts as seen — there is no "remind me later" for a
   *  launch, which is why Esc, the backdrop and both buttons all land here. */
  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* non-persistent dismissal is acceptable; it returns next visit */
    }
    if (isSignedIn && user) {
      void user
        .update({ unsafeMetadata: { ...user.unsafeMetadata, [META_KEY]: LAUNCH_ANNOUNCEMENT.id } })
        .catch(() => {
          /* offline / rate-limited: the local dismissal still holds */
        });
    }
  }, [isSignedIn, user]);

  useFocusTrap(panelRef, dismiss, open);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="launch-title"
      data-state={entered ? 'open' : 'closed'}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out data-[state=closed]:motion-safe:opacity-0 data-[state=open]:motion-safe:opacity-100 md:items-center md:p-4"
      onClick={dismiss}
    >
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        data-heatmap-id="launch:v1"
        data-state={entered ? 'open' : 'closed'}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto border-[1.5px] border-text bg-surface-elevated shadow-2xl shadow-black/60 motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out data-[state=closed]:motion-safe:translate-y-4 data-[state=closed]:motion-safe:scale-[0.98] data-[state=closed]:motion-safe:opacity-0 data-[state=open]:motion-safe:translate-y-0 data-[state=open]:motion-safe:scale-100 data-[state=open]:motion-safe:opacity-100"
      >
        {/* The chequered rule: the site's own marker, not a generic accent bar.
            Its wipe-in is the one piece of motion with any personality, and it
            is CSS only — no library, and nothing animates under
            prefers-reduced-motion. */}
        <div
          aria-hidden
          className="h-[5px] w-full origin-left bg-brand-fill motion-safe:transition-transform motion-safe:duration-[600ms] motion-safe:ease-out data-[state=closed]:motion-safe:scale-x-0 data-[state=open]:motion-safe:scale-x-100"
          data-state={entered ? 'open' : 'closed'}
        />
        <div className="p-5 md:p-7">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
              <Flag size={11} aria-hidden />
              {LAUNCH_ANNOUNCEMENT.kicker}
            </span>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className={`-mr-1.5 -mt-1.5 p-1.5 text-text-muted transition-colors duration-(--duration-fast) hover:text-text ${FOCUS_RING}`}
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          <h2
            id="launch-title"
            className="mt-2.5 font-serif text-[26px] font-semibold leading-tight text-text md:text-[30px]"
          >
            {LAUNCH_ANNOUNCEMENT.title}
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-text-muted">
            {LAUNCH_ANNOUNCEMENT.intro}
          </p>

          <dl className="mt-5 border-t border-border">
            {LAUNCH_ANNOUNCEMENT.does.map(([label, text]) => (
              <div key={label} className="flex gap-3 border-b border-border py-2">
                <dt className="w-[104px] shrink-0 pt-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text">
                  {label}
                </dt>
                <dd className="min-w-0 flex-1 text-[13px] leading-snug text-text-muted">{text}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-faint">
            What comes next
          </p>
          <ul className="mt-1.5">
            {LAUNCH_ANNOUNCEMENT.next.map(item => (
              <li key={item} className="flex gap-2 py-1 text-[13px] leading-snug text-text-muted">
                <span aria-hidden className="mt-[7px] h-[3px] w-2.5 shrink-0 bg-border-strong" />
                <span className="min-w-0 flex-1">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={LAUNCH_ANNOUNCEMENT.ctaHref}
              onClick={dismiss}
              data-heatmap-id="launch:v1:cta"
              className={`inline-flex min-h-11 flex-1 items-center justify-center bg-text px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted ${FOCUS_RING}`}
            >
              {LAUNCH_ANNOUNCEMENT.ctaLabel}
              <span aria-hidden> →</span>
            </Link>
            <button
              type="button"
              onClick={dismiss}
              data-heatmap-id="launch:v1:close"
              className={`inline-flex min-h-11 items-center px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint transition-colors duration-(--duration-fast) hover:text-text ${FOCUS_RING}`}
            >
              Start browsing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
