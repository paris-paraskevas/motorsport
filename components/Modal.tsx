'use client';

import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useFocusTrap } from '@/lib/useFocusTrap';

// Generic modal box: dim backdrop (click-outside closes), top-anchored card with
// a titled header + close button. Matches the calendar-filters box. Body padded.
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Focus into the dialog on open, trap Tab, Escape-to-close, restore focus on close.
  useFocusTrap(panelRef, onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-20"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div ref={panelRef} className="w-full max-w-md border border-border bg-surface-elevated" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-display text-sm font-bold uppercase tracking-wide text-text">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="-m-1.5 p-1.5 text-text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
