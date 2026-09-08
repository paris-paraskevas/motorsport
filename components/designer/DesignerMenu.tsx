'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// The Page Designer's menus, sheets and toasts (Paddock Designer v2.4): a
// menu anchored to a button or a right-click, a modal sheet with a head, a
// body and a foot of buttons, and toasts at the foot of the screen. Nothing
// here knows the document; the designer feeds them entries and text.

export type MenuEntry =
  | { head: string }
  | '-'
  | { label: string; sub?: string; k?: string; checked?: boolean; disabled?: boolean; run: () => void };

export interface MenuAt {
  x: number;
  y: number;
}

/** Where a menu opens for a button: under its left edge. */
export function anchorOf(el: HTMLElement | null): MenuAt {
  if (!el) return { x: 40, y: 80 };
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.bottom + 4 };
}

export function Menu({ at, entries, onClose }: { at: MenuAt; entries: MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Kept inside the viewport from its estimated size (a menu only ever renders
  // in the browser, on a click); the estimate errs on the large side.
  const width = 260;
  const height = entries.length * 31 + 8;
  const pos = {
    x: Math.max(8, Math.min(at.x, (typeof window === 'undefined' ? 1440 : window.innerWidth) - width - 8)),
    y: Math.max(8, Math.min(at.y, (typeof window === 'undefined' ? 900 : window.innerHeight) - height - 8)),
  };
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown, true);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[60] min-w-[220px] border border-border-strong bg-surface py-1 shadow-[0_14px_40px_rgba(0,0,0,0.5)]"
      style={{ left: pos.x, top: pos.y }}
    >
      {entries.map((e, i) => {
        if (e === '-') return <hr key={i} className="my-1 border-0 border-t border-border" />;
        if ('head' in e) {
          return (
            <div key={i} className="px-3.5 pb-1 pt-2 font-mono text-9 uppercase tracking-[0.14em] text-text-faint">
              {e.head}
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={e.disabled}
            className="flex w-full items-center gap-2.5 px-3.5 py-[7px] text-left text-12 text-text hover:bg-edit-dim disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
            onClick={() => {
              onClose();
              e.run();
            }}
          >
            {e.checked !== undefined && <span className="w-3.5 text-11 text-edit">{e.checked ? '✓' : ''}</span>}
            <span>{e.label}</span>
            {e.sub && <span className="ml-auto text-11 text-text-faint">{e.sub}</span>}
            {e.k && <span className={`${e.sub ? 'ml-2' : 'ml-auto'} font-mono text-10 text-text-faint`}>{e.k}</span>}
          </button>
        );
      })}
    </div>
  );
}

export interface SheetButton {
  label: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Runs, then the sheet closes; a button with no run only closes. */
  run?: () => void;
}

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';

export function Sheet({
  title,
  sub,
  children,
  buttons = [{ label: 'Close' }],
  onClose,
  wide = false,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
  buttons?: SheetButton[];
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, button:not([data-sheet-close])');
    first?.focus();
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-5" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pd-sheet-title"
        className={`flex max-h-[90vh] ${wide ? 'w-[min(1040px,96vw)]' : 'w-[min(760px,96vw)]'} flex-col border border-border-strong bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.6)]`}
      >
        <div className="flex items-start gap-3 border-b border-border px-[18px] py-3.5">
          <div className="min-w-0 flex-1">
            <h3 id="pd-sheet-title" className="m-0 mb-0.5 text-16 font-bold text-text">
              {title}
            </h3>
            {sub && <p className="m-0 text-12 text-text-muted">{sub}</p>}
          </div>
        </div>
        <div className="min-h-0 overflow-auto">{children}</div>
        <div className="flex items-center justify-end gap-2.5 border-t border-border px-[18px] py-2.5">
          {buttons.map(b => (
            <button
              key={b.label}
              type="button"
              data-sheet-close={b.run ? undefined : 'true'}
              disabled={b.disabled}
              className={`${TB} ${b.primary ? 'border-edit text-edit hover:bg-edit-dim hover:text-text' : ''} ${b.danger ? 'hover:border-negative hover:text-negative' : ''}`}
              onClick={() => {
                b.run?.();
                onClose();
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface Toast {
  id: number;
  text: string;
  cls?: 'ok' | 'bad';
}

/** Toasts at the foot of the screen, each gone after a moment. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);
  const toast = (text: string, cls?: 'ok' | 'bad') => {
    const id = ++n.current;
    setToasts(t => [...t, { id, text, cls }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  };
  return { toasts, toast };
}

export function Toasts({ items }: { items: Toast[] }) {
  if (items.length === 0) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-[52px] left-1/2 z-[70] grid -translate-x-1/2 gap-1.5">
      {items.map(t => (
        <div
          key={t.id}
          className={`border-l-[3px] bg-text px-3.5 py-2 text-12 text-bg shadow-[0_10px_30px_rgba(0,0,0,0.4)] ${
            t.cls === 'bad' ? 'border-negative' : t.cls === 'ok' ? 'border-positive' : 'border-edit'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
