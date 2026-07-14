'use client';
import { useEffect, useRef, type RefObject } from 'react';

// Elements that take keyboard focus, minus disabled controls and anything pulled
// out of the tab order. Drives the trap's first/last stops and the focus-in target.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Focus management for a `role="dialog" aria-modal="true"` container
 * (WCAG 2.4.3 focus order, 2.1.2 no keyboard trap):
 *  - on activate: moves focus to the first focusable element (or the container);
 *  - traps Tab / Shift+Tab within `containerRef`, pulling stray focus back in;
 *  - Escape calls `onEscape`;
 *  - on deactivate/unmount: restores focus to whatever held it before opening.
 *
 * Generalises the pattern already proven in SearchOverlay (focus-in + Escape) and
 * NotificationBell (Escape + focus-restore), adding the missing Tab trap.
 *
 * `active` covers both mounting models: dialogs that unmount on close leave it
 * default `true`; an always-mounted dialog that renders null when closed passes
 * its open flag so the trap binds and unbinds with visibility.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  onEscape: () => void,
  active = true,
): void {
  // Latest onEscape held in a ref so the trap effect binds ONCE per open, not per
  // render: an inline onEscape would otherwise re-run the effect on every render
  // (each keystroke), re-capturing the pre-open focus and yanking focus to the
  // top. Synced in an effect — never mutated during render (repo convention).
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    // Hand focus back here on close — the element (trigger) that opened the dialog.
    const restoreTo = document.activeElement as HTMLElement | null;

    const focusable = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Move focus into the dialog: first focusable, else the container itself.
    const first = focusable()[0];
    if (first) {
      first.focus();
    } else {
      container.tabIndex = -1;
      container.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const activeEl = document.activeElement;
      // Wrap at the edges, and pull focus back if it has escaped the dialog.
      if (e.shiftKey) {
        if (activeEl === firstEl || !container.contains(activeEl)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (activeEl === lastEl || !container.contains(activeEl)) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreTo?.focus();
    };
  }, [active, containerRef]);
}
