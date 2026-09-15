'use client';

import { useEffect, useRef, useState } from 'react';
import { Braces } from 'lucide-react';
import { substituteShortcuts } from '@/lib/design/page-document';
import type { EditableShortcut } from '@/lib/design/shortcuts';

// The text picker (P1.11; APEX: the picker icon at the right of a text
// attribute in the Property Editor, opening a list of values to insert): one
// button beside every field that takes shortcuts (Static Content's Text, Header
// Text, Footer Text), opening a popover with the shortcuts by key and their
// current text, a filter, and a Preview of the field as the page will render
// it, the hovered shortcut in place. The picker reads the field's cursor when
// it OPENS, before the click takes the focus, and hands it back with the token
// on a pick; the pane splices the token and puts the caret after it. It knows
// nothing of regions: a field's id, its value and the shortcuts come in, a token
// and a cursor go out.

export interface Cursor {
  start: number;
  end: number;
}

const IB =
  'grid h-7 w-7 shrink-0 place-items-center border border-border-strong bg-bg text-text-muted transition-colors duration-(--duration-fast) hover:border-edit hover:text-text disabled:cursor-default disabled:opacity-35 aria-expanded:border-edit aria-expanded:text-edit';
const OPTION = 'grid cursor-pointer gap-0.5 px-2.5 py-1.5 hover:bg-edit-dim focus:bg-edit-dim focus:outline-none aria-selected:bg-edit-dim';

export function TextPicker({
  field,
  fieldId,
  shortcuts,
  value,
  disabled = false,
  onInsert,
}: {
  /** The field as its label names it: Text, Header Text, Footer Text. */
  field: string;
  /** The id of the field the token lands in; its cursor is read when the popover opens. */
  fieldId: string;
  shortcuts: readonly EditableShortcut[];
  /** The field's value, for the Preview. */
  value: string;
  disabled?: boolean;
  /** The token to splice at the cursor the picker read (the field's end when the field is not in the page). */
  onInsert: (token: string, at: Cursor) => void;
}) {
  // Open while a cursor is held: the field's selection as it was when the button was clicked.
  const [at, setAt] = useState<Cursor | null>(null);
  const [filter, setFilter] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const open = at !== null;
  const close = () => {
    setAt(null);
    setFilter('');
    setHover(null);
  };
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLInputElement>('input')?.focus();
    // Escape and a click outside close it, in the capture phase so the designer's own Escape does not act on the same key.
    const shut = () => {
      setAt(null);
      setFilter('');
      setHover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        shut();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) shut();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown, true);
    };
  }, [open]);

  const openPicker = () => {
    const el = document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement | null;
    const start = el && el.selectionStart !== null ? el.selectionStart : value.length;
    const end = el && el.selectionEnd !== null ? el.selectionEnd : start;
    setAt({ start, end });
  };
  const pick = (key: string) => {
    if (!at) return;
    onInsert(`{shortcut:${key}}`, at);
    close();
  };
  const q = filter.trim().toLowerCase();
  const listed = shortcuts.filter(s => !q || s.key.toLowerCase().includes(q) || s.text.toLowerCase().includes(q));
  const texts = Object.fromEntries(shortcuts.map(s => [s.key, s.text]));
  const previewed = at && hover ? value.slice(0, at.start) + `{shortcut:${hover}}` + value.slice(at.end) : value;
  const preview = substituteShortcuts(previewed, texts);
  const none = shortcuts.length === 0;
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        className={IB}
        disabled={disabled || none}
        aria-label={`Insert a shortcut into ${field}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={none ? 'None yet: add one under Shared Components › Shortcuts' : 'Insert a shortcut at the cursor; the page substitutes its text'}
        onClick={() => (open ? close() : openPicker())}
      >
        <Braces size={13} />
      </button>
      {open && (
        <div role="dialog" aria-label={`Shortcuts for ${field}`} className="absolute right-0 top-full z-[60] mt-1 w-[300px] border border-border-strong bg-surface shadow-[0_14px_40px_rgba(0,0,0,0.5)]">
          <div className="border-b border-border p-2">
            <input
              type="search"
              value={filter}
              aria-label="Filter shortcuts"
              placeholder="Filter by key or text"
              className="w-full border border-border-strong bg-bg px-2 py-1 text-12 leading-snug text-text focus:border-edit focus:outline-none"
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <ul role="listbox" aria-label="Shortcuts" className="m-0 max-h-[220px] list-none overflow-auto p-0">
            {listed.map(s => (
              <li
                key={s.key}
                role="option"
                aria-selected={hover === s.key}
                tabIndex={0}
                className={OPTION}
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover(h => (h === s.key ? null : h))}
                onFocus={() => setHover(s.key)}
                onClick={() => pick(s.key)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pick(s.key);
                  }
                }}
              >
                <span className="font-mono text-10 text-text">{s.key}</span>
                <span className="text-11 leading-snug text-text-muted">{s.text}</span>
              </li>
            ))}
            {listed.length === 0 && <li className="px-2.5 py-2 text-11 text-text-faint">No shortcut matches.</li>}
          </ul>
          <div className="border-t border-border px-2.5 py-2">
            <span className="block font-mono text-8 uppercase tracking-[0.14em] text-text-faint">Preview</span>
            <p aria-label="Preview" className="m-0 mt-0.5 max-h-[72px] overflow-hidden text-11 leading-snug text-text">
              {preview || <span className="text-text-faint">Empty</span>}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
