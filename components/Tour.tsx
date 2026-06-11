'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TOUR_VERSION, shouldShowTour, writeTourState } from '@/lib/tour';

// Hand-rolled spotlight tour (design + rules:
// docs/research/onboarding-tour-2026-06.md). One cutout div whose huge
// box-shadow dims everything else; popover is a labelled dialog with its own
// focus trap. Portaled to <body> (fixed elements inside blurred ancestors
// collapse — the 0.24.3 lesson). Geometry jumps are instant by design: the
// research rule is "animate transform/opacity, never box-shadow", and instant
// cuts also satisfy reduced-motion with zero branching.

export interface TourStop {
  // First VISIBLE match wins — lets one stop target the bottom-bar link on
  // phones and the header link on desktop with the same data-tour value.
  selector: string;
  title: string;
  body: string;
}

const PAD = 6;
const POPOVER_W = 320;

function visibleEl(selector: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(selector);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Tour({ stops }: { stops: TourStop[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [neverShow, setNeverShow] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Auto-show once per device; ?tour=1 (the Account page's replay link)
  // forces it regardless of stored state. window.location inside the effect
  // keeps useSearchParams (and its Suspense requirement) out of the tree.
  useEffect(() => {
    const replay = new URLSearchParams(window.location.search).has('tour');
    if (!replay && !shouldShowTour()) return;
    // Let layout settle (fonts, chyron data) before measuring targets.
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, []);

  const measure = useCallback(() => {
    if (!open) return;
    const el = visibleEl(stops[step]?.selector ?? '');
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [open, step, stops]);

  // Scroll the target into view on step change, then track geometry on
  // scroll/resize (no scroll lock — tracking is simpler and never strands
  // the spotlight; rAF-throttled).
  useEffect(() => {
    if (!open) return;
    const el = visibleEl(stops[step]?.selector ?? '');
    el?.scrollIntoView({ block: 'center', behavior: 'auto' });
    // First measurement after the scroll has painted — also keeps setState
    // out of the synchronous effect body.
    let raf = requestAnimationFrame(measure);
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, step, measure, stops]);

  const end = useCallback(
    (completed: boolean) => {
      setOpen(false);
      writeTourState({
        dismissedAt: new Date().toISOString(),
        completedStep: completed ? stops.length : step + 1,
        neverShow,
      });
    },
    [neverShow, step, stops.length],
  );

  // Focus management: dialog takes focus per step; Tab cycles inside; ESC
  // ends the whole tour; arrows page through stops.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        end(false);
        return;
      }
      if (e.key === 'ArrowRight' && step < stops.length - 1) setStep(s => s + 1);
      if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1);
      if (e.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) return;
        const list = [...focusables];
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step, stops.length, end]);

  if (!open || stops.length === 0) return null;
  const stop = stops[step];
  const last = step === stops.length - 1;

  // Popover placement: under the target when there's room, else above;
  // clamped to the viewport. Fixed coordinates — everything tracks rect.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
  const popW = Math.min(POPOVER_W, vw - 24);
  const below = rect ? rect.top + rect.height + 12 : vh / 2;
  const popTop = rect && below + 190 > vh ? Math.max(12, rect.top - 190 - 12) : below;
  const popLeft = rect
    ? Math.min(Math.max(12, rect.left + rect.width / 2 - popW / 2), vw - popW - 12)
    : (vw - popW) / 2;

  return createPortal(
    <div className="fixed inset-0 z-[68]">
      {/* Spotlight cutout — the shadow does the dimming. */}
      {rect ? (
        <div
          aria-hidden
          className="fixed rounded-lg pointer-events-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/65 pointer-events-none" />
      )}
      {/* Click-catcher: outside clicks are a no-op (accidental-skip guard). */}
      <div className="fixed inset-0 z-[69]" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className="fixed z-[70] border border-border bg-surface-elevated p-4 outline-none motion-safe:transition-opacity motion-safe:duration-200 motion-safe:starting:opacity-0"
        style={{ top: popTop, left: popLeft, width: popW }}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-text-faint">
          Step {step + 1} of {stops.length}
        </div>
        <h2 id="tour-title" className="mt-1 font-display text-base font-extrabold uppercase tracking-wide text-text">
          {stop.title}
        </h2>
        <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-text-muted">
          {stop.body}
        </p>

        <label className="mt-3 flex items-center gap-2 text-[11px] text-text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={neverShow}
            onChange={e => setNeverShow(e.target.checked)}
            className="accent-brand w-4 h-4"
          />
          Don&apos;t show this again
        </label>

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => end(false)}
            className="min-h-6 font-mono text-[11px] uppercase tracking-[0.14em] font-semibold text-text-faint hover:text-text transition-colors duration-(--duration-fast)"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="min-h-6 px-3 py-1.5 border border-border font-mono text-[11px] uppercase tracking-[0.14em] font-semibold text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? end(true) : setStep(s => s + 1))}
              className="min-h-6 px-3 py-1.5 bg-brand text-black font-mono text-[11px] uppercase tracking-[0.14em] font-bold hover:bg-brand-deep transition-colors duration-(--duration-fast)"
            >
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        Tour step {step + 1} of {stops.length} (tour version {TOUR_VERSION})
      </span>
    </div>,
    document.body,
  );
}
