'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { SESSION_KINDS, type SessionKind } from '@/lib/calendar-grid';

const LABELS: Record<SessionKind, { label: string; hint: string }> = {
  practice: { label: 'Practice', hint: 'Free practice, warm-ups, shakedowns, testing' },
  qualifying: { label: 'Qualifying', hint: 'Qualifying, Hyperpole, Superpole, shootouts' },
  race: { label: 'Race', hint: 'Races, sprints, features, rally stages' },
  other: { label: 'Other', hint: 'Anything else — parades, ceremonial starts, briefings' },
};

// One filter option = a checkbox row (single brand accent, not a coloured fill).
function CheckRow({
  label,
  hint,
  checked,
  onToggle,
  strong,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onToggle: () => void;
  strong?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
      />
      <span className="min-w-0">
        <span className={`${checked ? 'text-text' : 'text-text-muted'}${strong ? ' font-semibold' : ''}`}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-text-faint">{hint}</span>}
      </span>
    </label>
  );
}

// Session-type filter. Series selection lives on the legend chip bar in the
// control deck now — it was invisible in here, and the page needed a colour key
// anyway, so one control does both jobs.
//
// DRAFT model: edits stay local and the calendar does NOT change until Save
// commits them. Reset re-selects everything; the X / backdrop discards.
//
// 'Other' is an explicit option for the first time. It used to ride along
// implicitly — shown only while all three named kinds were selected — so
// unticking Practice ALSO silently dropped every session classifySession didn't
// recognise, with nothing in the UI to say so.
export function CalendarFilters({
  initialTypes,
  onApply,
  onClose,
}: {
  initialTypes: Set<SessionKind>;
  onApply: (types: Set<SessionKind>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Set<SessionKind>>(() => new Set(initialTypes));

  const toggle = (k: SessionKind) =>
    setDraft(cur => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const allSelected = draft.size === SESSION_KINDS.length;
  const toggleAll = () => setDraft(allSelected ? new Set() : new Set(SESSION_KINDS));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Session filters"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col border border-border bg-surface-elevated"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-display text-base font-bold uppercase tracking-wide text-text">
            Sessions
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <CheckRow label="Select all" checked={allSelected} onToggle={toggleAll} strong />
          <div className="my-1 border-t border-border/60" />
          {SESSION_KINDS.map(kind => (
            <CheckRow
              key={kind}
              label={LABELS[kind].label}
              hint={LABELS[kind].hint}
              checked={draft.has(kind)}
              onToggle={() => toggle(kind)}
            />
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => setDraft(new Set(SESSION_KINDS))}
            className="border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(new Set(draft));
              onClose();
            }}
            className="bg-brand-fill px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-tint-contrast transition-opacity duration-(--duration-fast) hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
