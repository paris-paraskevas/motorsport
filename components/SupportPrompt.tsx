'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Coffee, Heart, X } from 'lucide-react';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { SUPPORT_URL } from '@/lib/site';
import { isConsentPending } from '@/components/CookieConsent';
import {
  createEngagedClock,
  dueAsk,
  hasOptedOut,
  isQuietRoute,
  parseThresholds,
  parseVisit,
  serializeVisit,
  EMPTY_VISIT,
  OPT_OUT_KEY,
  OPT_OUT_VALUE,
  THRESHOLDS_MS,
  VISIT_KEY,
  type AskStage,
  type EngagedClock,
  type VisitState,
} from '@/lib/support-prompt';

const TICK_MS = 1000;

/** `?supportPromptMs=3000,6000` walks the whole ladder in seconds. Harmless in
 *  public: it can only change when a reader's own prompt appears. */
const OVERRIDE_PARAM = 'supportPromptMs';

// The trap lands focus on the first focusable element, which is the close
// button — so every control here needs a real focus ring rather than the UA
// default box. Same treatment as LaunchBanner's dismiss.
const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated';

/**
 * The dwell-triggered support prompt. Two asks, never a third: one at two
 * minutes of ENGAGED time (see lib/support-prompt.ts — a backgrounded or
 * walked-away tab earns nothing), and, only if that one was soft-dismissed,
 * one at five minutes of total engaged time whose copy says out loud that it
 * is the last.
 *
 * Mounted in app/(app)/layout.tsx beside CookieConsent, so it keeps counting
 * across client-side navigation; the visit total and the ladder position live
 * in sessionStorage, so a reload restarts neither and closing the tab ends the
 * visit.
 *
 * Dismissal scope differs by auth state, and the copy says so: a guest's
 * "don't show this again" holds for the visit (sessionStorage), while a signed-
 * in reader's writes a versioned flag to Clerk `unsafeMetadata` and silences it
 * everywhere, for good. Clerk metadata rather than a table because `useUser()`
 * reads it client-side with no extra request, which leaves ISR untouched.
 */
export function SupportPrompt() {
  const { isLoaded, isSignedIn, user } = useUser();
  const pathname = usePathname();
  const [stage, setStage] = useState<AskStage | null>(null);
  // Entrance flag, flipped a frame after the panel mounts so the closed-state
  // render lands first and the CSS transition plays (CookieConsent's pattern).
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const visitRef = useRef<VisitState>({ ...EMPTY_VISIT });
  const clockRef = useRef<EngagedClock | null>(null);
  const thresholdsRef = useRef<readonly [number, number]>(THRESHOLDS_MS);
  // `stage` again, but written SYNCHRONOUSLY. The interval lives outside React's
  // event system, so setStage only takes effect on the next render — and if that
  // render is delayed past one tick (a busy page) the timer fires again, reads
  // the freshly-raised `shown`, and promotes ask 1 to ask 2 before ask 1 has
  // ever been on screen. Reproduced in dev before this guard existed.
  const stageRef = useRef<AskStage | null>(null);

  const optedOut = Boolean(isSignedIn && hasOptedOut(user?.unsafeMetadata));

  const persist = useCallback(() => {
    try {
      sessionStorage.setItem(VISIT_KEY, serializeVisit(visitRef.current));
    } catch {
      // Private mode / blocked storage: the ladder then lives in memory only,
      // which still holds for the page but restarts on reload. Acceptable.
    }
  }, []);

  // Lazily restore the visit and start the clock. Called from whichever effect
  // runs first so no engaged time is lost to effect ordering.
  const ensureClock = useCallback((): EngagedClock => {
    if (clockRef.current) return clockRef.current;
    let restored = { ...EMPTY_VISIT };
    try {
      restored = parseVisit(sessionStorage.getItem(VISIT_KEY));
    } catch {
      /* no storage — start the visit fresh */
    }
    visitRef.current = restored;
    try {
      const override = parseThresholds(
        new URLSearchParams(window.location.search).get(OVERRIDE_PARAM),
      );
      if (override) thresholdsRef.current = override;
    } catch {
      /* unparseable location — keep the real thresholds */
    }
    clockRef.current = createEngagedClock({
      startedAt: Date.now(),
      initialMs: restored.ms,
      visible: document.visibilityState === 'visible',
    });
    return clockRef.current;
  }, []);

  // Engagement signals. Bound once, for the life of the document.
  useEffect(() => {
    const clock = ensureClock();
    const onActivity = () => clock.activity(Date.now());
    const onVisibility = () => {
      clock.setVisible(document.visibilityState === 'visible', Date.now());
      visitRef.current = { ...visitRef.current, ms: clock.total() };
      persist(); // a tab going away is the last chance to bank the total
    };
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('scroll', onActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('scroll', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ensureClock, persist]);

  // The ladder. Runs while nothing is on screen; a prompt already open pauses
  // the check so a crossing threshold can never swap ask 1 for ask 2 mid-read.
  useEffect(() => {
    const clock = ensureClock();
    if (stage !== null) return;
    // Nothing can ever be shown again this visit, so stop counting entirely —
    // an idle tab was otherwise writing sessionStorage once a second, forever,
    // for no possible effect (measured on prod: the total kept climbing long
    // after `done` was set). The effect re-runs when `stage` returns to null,
    // which is the same moment `done` flips, so this is reached.
    if (visitRef.current.done || optedOut) return;
    const id = window.setInterval(() => {
      visitRef.current = { ...visitRef.current, ms: clock.tick(Date.now()) };
      persist();
      const due = dueAsk(visitRef.current, thresholdsRef.current);
      if (!due || stageRef.current !== null) return;
      // Clerk unresolved: wait rather than flash a prompt at an account that
      // has already silenced it for good.
      if (!isLoaded || optedOut) return;
      // The consent modal owns the screen on a first visit; two stacked
      // dialogs is the definition of infuriating.
      if (isConsentPending()) return;
      // Never over an auth flow or a form somebody is mid-way through.
      if (isQuietRoute(pathname)) return;
      // Any other dialog already has the screen and the focus. This one sits at
      // z-70, ABOVE ContactModal's z-65, so without this it would appear on top
      // of a half-typed contact message and take the keyboard with it. Every
      // dialog in the tree renders null when closed, so a hit means one is open.
      if (document.querySelector('[role="dialog"]')) return;
      // A session is running on this page and the reader is watching timing.
      // `.live-pulse` is the site-wide live marker (app/globals.css: "used on
      // actually-live indicators only") and it is the honest client-side
      // reading, unlike a server-baked isLive under 5-minute ISR. Suppressed,
      // not lost: the banked time stays and the ask lands after the session.
      if (document.querySelector('.live-pulse')) return;
      stageRef.current = due;
      visitRef.current = { ...visitRef.current, shown: due };
      persist();
      setStage(due);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [stage, isLoaded, optedOut, pathname, ensureClock, persist]);

  // Play the entrance a frame after the panel appears; reset when it closes.
  useEffect(() => {
    if (stage === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [stage]);

  useEffect(() => {
    if (stage === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [stage]);

  const settle = useCallback(
    (done: boolean) => {
      visitRef.current = { ...visitRef.current, done: visitRef.current.done || done };
      persist();
      stageRef.current = null; // synchronous, so the timer can resume this tick
      setStage(null);
    },
    [persist],
  );

  // Esc, backdrop and "Not now" are one thing: a soft dismiss. On ask 1 it
  // leaves the visit open to ask 2; on ask 2 it ends the visit, because ask 2
  // is the last one on every path.
  const softDismiss = useCallback(() => settle(stage === 2), [settle, stage]);

  const neverAgain = useCallback(() => {
    settle(true);
    // Signed in: make it permanent, on every device. The visit flag above has
    // already taken effect, so a failed write costs this visit's silence only.
    if (isSignedIn && user) {
      void user
        .update({ unsafeMetadata: { ...user.unsafeMetadata, [OPT_OUT_KEY]: OPT_OUT_VALUE } })
        .catch(() => {
          /* offline / rate-limited: the visit-scoped dismissal still holds */
        });
    }
  }, [settle, isSignedIn, user]);

  useFocusTrap(panelRef, softDismiss, stage !== null);

  if (stage === null) return null;

  const isLast = stage === 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-prompt-title"
      data-state={entered ? 'open' : 'closed'}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-3 motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out data-[state=closed]:motion-safe:opacity-0 data-[state=open]:motion-safe:opacity-100 md:items-center md:p-4"
      onClick={softDismiss}
    >
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        data-heatmap-id={`support:ask-${stage}`}
        data-state={entered ? 'open' : 'closed'}
        className="w-full max-w-sm border-[1.5px] border-text bg-surface-elevated shadow-2xl shadow-black/60 motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out data-[state=closed]:motion-safe:translate-y-3 data-[state=closed]:motion-safe:opacity-0 data-[state=open]:motion-safe:translate-y-0 data-[state=open]:motion-safe:opacity-100"
      >
        {/* A red hairline instead of an icon block — the LaunchBanner marker,
            turned on its side. `live` is the one red the palette tunes per
            theme (bright on the dark chassis, deep on the three light ones),
            which is what a heart and a warm rule both need on all six. */}
        <div aria-hidden className="h-[3px] w-full bg-live" />
        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-live">
              <Heart size={11} fill="currentColor" aria-hidden />
              {isLast ? 'Last ask' : 'Made by hand'}
            </span>
            <button
              type="button"
              onClick={softDismiss}
              aria-label="Close"
              className={`-mr-1.5 -mt-1.5 p-1.5 text-text-muted transition-colors duration-(--duration-fast) hover:text-text ${FOCUS_RING}`}
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          <h2
            id="support-prompt-title"
            className="mt-2.5 font-serif text-[20px] font-semibold leading-tight text-text"
          >
            {isLast ? "Last time I'll ask, promise :)" : "Hi, I'm Paris :)"}
          </h2>

          {isLast ? (
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              That is me done asking. Paddock stays free either way, and I am genuinely glad you
              have been reading. Thank you.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                Paddock is a one-person project. I build it in the evenings, pay for it myself, and
                keep it free for everyone.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                If it has made your race weekend a little better, a coffee would make my week.
              </p>
            </>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => settle(true)}
              data-heatmap-id={`support:ask-${stage}:donate`}
              className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 bg-text px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted ${FOCUS_RING}`}
            >
              <Coffee size={14} aria-hidden />
              Buy me a coffee
              <Heart size={12} fill="currentColor" aria-hidden className="text-live" />
            </a>
            <button
              type="button"
              onClick={softDismiss}
              data-heatmap-id={`support:ask-${stage}:not-now`}
              className={`inline-flex min-h-10 items-center px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint transition-colors duration-(--duration-fast) hover:text-text ${FOCUS_RING}`}
            >
              {isLast ? 'Close' : 'Not now'}
            </button>
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <button
              type="button"
              onClick={neverAgain}
              data-heatmap-id={`support:ask-${stage}:never`}
              className={`font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint underline decoration-border decoration-1 underline-offset-4 transition-colors duration-(--duration-fast) hover:text-text hover:decoration-text ${FOCUS_RING}`}
            >
              Don&apos;t show this again
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
              {isSignedIn
                ? 'Signed in, so that sticks on every device you use.'
                : 'You are signed out, so that lasts until you close the tab. Preferences live with an account, which is what makes it permanent.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
