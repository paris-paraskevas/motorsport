'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useAccountFlags } from '@/lib/auth/client';
import { Check, Flag, X } from 'lucide-react';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { currentWhatsNew, type WhatsNewEntry } from '@/lib/whats-new';
import { CardShot } from './CardShot';
import { isConsentPending } from '@/components/CookieConsent';

/** Clerk `unsafeMetadata` key. Stores the dismissed ENTRY ID rather than a
 *  boolean, so a reader who dismissed 1.0 still meets 1.1 — the reason this is a
 *  recurring dialog and not the one-off launch banner it replaces. */
const META_KEY = 'whatsNewDismissed';
const storageKey = (id: string) => `paddock:whats-new-dismissed:${id}`;

// The trap lands focus on the first focusable element, which is the close
// button, so every control needs a real ring rather than the UA default box.
const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated';

/**
 * The recurring What's-New dialog: what changed in the release the reader has
 * just arrived on, shown once, over whatever page they landed on.
 *
 * Operator decision, 2026-08-26, replacing the one-off 1.0 banner: it needs
 * "photos and widgets and boxes to be visually appealing and clear", modelled on
 * a What's-New dialog from another product — a hero, a stack of illustrated
 * feature cards, then a row of chips for the long tail.
 *
 * Each card's banner is a screenshot of the page it describes (see `CardShot`),
 * captured at the banner's own width so it reads 1:1. The first attempt drew
 * abstract panels instead and was rejected outright — "show parts of our site" —
 * which is also why the crops sidestep the licensing wall that killed the
 * portrait and logo waves: they are our own pages.
 *
 * Ships DARK — `currentWhatsNew()` returns null while every entry is inactive,
 * so this renders nothing at all until an entry is switched on in the same commit
 * as its version bump. `activeId` is the Application Setting
 * `announcement.active_id`, read by the layout on the server: it names the
 * entry in force, '' hides the notice, and it is seeded with the active entry.
 *
 * The shell — backdrop, focus trap, scroll lock, dismissal to localStorage plus
 * the account's flags, and an entrance gated behind `motion-safe:` — follows
 * SupportPrompt and the banner it replaces rather than inventing a third dialog
 * language.
 */
export function WhatsNewModal({ activeId }: { activeId: string }) {
  const entry = currentWhatsNew(activeId);
  const { isLoaded, isSignedIn } = useAccount();
  const { flags, setFlag } = useAccountFlags();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const dismissedId = isSignedIn ? flags?.[META_KEY] : undefined;
  const dismissedOnAccount = Boolean(entry && dismissedId === entry.id);

  useEffect(() => {
    if (!entry) return;
    // Wait for the account rather than flash an announcement at one that has
    // already dismissed this entry on another device.
    if (!isLoaded || dismissedOnAccount) return;
    // The consent modal owns the screen on a first visit, and two stacked
    // dialogs is the definition of infuriating.
    if (isConsentPending()) return;
    if (document.querySelector('[role="dialog"]')) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(storageKey(entry.id)) === '1';
    } catch {
      // Private mode / blocked storage: treat as not dismissed, so the reader
      // still sees it once per session rather than never.
    }
    if (dismissed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [entry, isLoaded, dismissedOnAccount]);

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

  /** Closing it at all counts as seen: Esc, the backdrop and both buttons land
   *  here. There is no "remind me later" for an announcement. */
  const dismiss = useCallback(() => {
    setOpen(false);
    if (!entry) return;
    try {
      localStorage.setItem(storageKey(entry.id), '1');
    } catch {
      /* non-persistent dismissal is acceptable; it returns next visit */
    }
    if (isSignedIn) {
      void setFlag(META_KEY, entry.id).catch(() => {
        /* offline / rate-limited: the local dismissal still holds */
      });
    }
  }, [entry, isSignedIn, setFlag]);

  useFocusTrap(panelRef, dismiss, open);

  if (!entry || !open) return null;
  return <Panel entry={entry} entered={entered} dismiss={dismiss} panelRef={panelRef} />;
}

function Panel({
  entry,
  entered,
  dismiss,
  panelRef,
}: {
  entry: WhatsNewEntry;
  entered: boolean;
  dismiss: () => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const state = entered ? 'open' : 'closed';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      data-state={state}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out data-[state=closed]:motion-safe:opacity-0 data-[state=open]:motion-safe:opacity-100 md:items-center md:p-6"
      onClick={dismiss}
    >
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        data-heatmap-id={`whats-new:${entry.id}`}
        data-state={state}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col border-[1.5px] border-text bg-surface-elevated shadow-2xl shadow-black/60 motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out data-[state=closed]:motion-safe:translate-y-4 data-[state=closed]:motion-safe:scale-[0.98] data-[state=closed]:motion-safe:opacity-0 data-[state=open]:motion-safe:translate-y-0 data-[state=open]:motion-safe:scale-100 data-[state=open]:motion-safe:opacity-100"
      >
        {/* The chequered rule: the site's own marker, not a generic accent bar.
            CSS-only wipe, and nothing moves under prefers-reduced-motion. */}
        <div
          aria-hidden
          data-state={state}
          className="h-[5px] w-full shrink-0 origin-left bg-brand-fill motion-safe:transition-transform motion-safe:duration-[600ms] motion-safe:ease-out data-[state=closed]:motion-safe:scale-x-0 data-[state=open]:motion-safe:scale-x-100"
        />

        {/* Header stays put while the body scrolls, so the version and the way
            out are always reachable — the reference's one structural idea worth
            copying outright. */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5 md:px-7">
          <span className="inline-flex items-center gap-2 font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text">
            <Flag size={11} aria-hidden />
            What&rsquo;s new
            <span className="border border-brand px-1.5 py-0.5 text-brand">{entry.version}</span>
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className={`-mr-1.5 p-1.5 text-text-muted transition-colors duration-(--duration-fast) hover:text-text ${FOCUS_RING}`}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* md:p-6 is load-bearing, not taste: 896px panel − 2×24 padding − the
            card border leaves 845px, and the crops are 848px wide, so a banner
            renders at 0.996 scale. Widen the padding and the screenshots start
            being downscaled. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {/* Hero. The ghosted numeral bleeds off the right edge so the block
              reads as a crop rather than a centred badge. */}
          <div className="relative overflow-hidden border border-border bg-surface p-5 md:p-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-3 -top-6 select-none font-mono text-112 font-bold leading-none text-border-strong opacity-40 md:text-136"
            >
              {entry.version}
            </span>
            <div className="relative max-w-[74%]">
              <h2
                id="whats-new-title"
                className="font-serif text-26 font-semibold leading-tight text-text md:text-32"
              >
                {entry.title}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-text-muted">{entry.intro}</p>
            </div>
          </div>

          {/* One column, image on top, banner at the panel's own width. A two-up
              grid puts each crop at ~330px, and dense UI is illegible below a
              1.3x downscale — the "read it at display size" test. Consistent
              zoom across every card matters as much as the zoom itself. */}
          <div className="mt-4 flex flex-col gap-4">
            {entry.cards.map((card, i) => (
              <article key={card.title} className="border border-border bg-surface-elevated">
                <CardShot art={card.art} first={i === 0} />
                <div className="p-4 md:p-5">
                  <h3 className="font-serif text-base font-semibold leading-snug text-text">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-13 leading-relaxed text-text-muted">{card.body}</p>
                </div>
              </article>
            ))}
          </div>

          {entry.chips.length > 0 && (
            <>
              <p className="mt-6 font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-faint">
                And more
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {entry.chips.map(chip => (
                  <li
                    key={chip}
                    className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-12 leading-none text-text-muted"
                  >
                    <Check size={12} aria-hidden className="text-brand" />
                    {chip}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* "What to expect later" — required by launch-checklist §A9, and the
              one thing the retired LaunchBanner had that this modal did not.
              Grafted here rather than kept in a second modal (0.334.88): both
              were keyed 'v1.0', both mounted, and their "is another dialog
              open" guards RACE — each effect runs before the other's dialog is
              in the DOM, so flipping both live could stack two modals.

              Anything listed becomes a public promise, so the copy is
              operator-signed per item. */}
          {entry.next.length > 0 && (
            <>
              <p className="mt-6 font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-faint">
                What comes next
              </p>
              <ul className="mt-1.5">
                {entry.next.map(item => (
                  <li
                    key={item}
                    className="flex gap-2 py-1 text-13 leading-snug text-text-muted"
                  >
                    <span aria-hidden className="mt-[7px] h-[3px] w-2.5 shrink-0 bg-border-strong" />
                    <span className="min-w-0 flex-1">{item}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3.5 md:px-7">
          <button
            type="button"
            onClick={dismiss}
            data-heatmap-id={`whats-new:${entry.id}:close`}
            className={`inline-flex min-h-11 items-center px-3 font-mono text-10 font-semibold uppercase tracking-[0.14em] text-text-faint transition-colors duration-(--duration-fast) hover:text-text ${FOCUS_RING}`}
          >
            Start browsing
          </button>
          <Link
            href={entry.ctaHref}
            onClick={dismiss}
            data-heatmap-id={`whats-new:${entry.id}:cta`}
            className={`inline-flex min-h-11 items-center justify-center bg-text px-4 font-mono text-10 font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted ${FOCUS_RING}`}
          >
            {entry.ctaLabel}
            <span aria-hidden> →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
