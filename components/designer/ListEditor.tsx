'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, RotateCcw } from 'lucide-react';
import { DESTINATIONS, resolveDestination, type ListRole, type NavEntry } from '@/lib/design/destinations';
import { DEFAULT_TEXT, type ChromeText } from '@/lib/design/text-defaults';
import type { EditableList, NavListKey } from '@/lib/design/lists';
import {
  addEntry,
  canAdd,
  canRemove,
  maxEntries,
  minEntries,
  moveEntry,
  removeEntry,
  sameEntries,
  updateEntry,
} from '@/lib/design/list-edit';
import { BAR_ICON_NAMES, BottomBar } from '@/components/BottomBar';
import { DoorLinks } from '@/components/DoorLinks';
import { Footer } from '@/components/Footer';
import { SCHEMES } from './catalogue';

// One navigation list, edited in a table (APEX's list entries page): sequence,
// label, destination from the catalogue, icon for the bar, authorization for the
// doors and the bar, Remove; an add row; a preview that renders the REAL
// component with the edited entries; Save with the version check. The table
// operations are lib/design/list-edit.ts, the bounds are the API's bounds, and
// nothing here can type a URL: the destination is always a catalogue key.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-[12px] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'h-7 max-w-full border border-border-strong bg-bg px-1.5 text-[12px] text-text focus:border-edit focus:outline-none';
const MV =
  'grid h-6 w-6 place-items-center border border-border-strong text-text-muted hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-30';

const DEST_OPTIONS = Object.entries(DESTINATIONS)
  .map(([key, d]) => ({ key, label: d.label, kind: d.kind, href: d.kind === 'action' ? d.action : d.href }))
  .sort((a, b) => a.label.localeCompare(b.label));

export function ListEditor({
  listKey,
  role,
  list,
  title,
  sub,
  readOnly,
  otherFooter,
  text = DEFAULT_TEXT,
  onSaved,
}: {
  listKey: NavListKey;
  role: ListRole;
  list: EditableList;
  title: string;
  sub: string;
  readOnly: boolean;
  /** For the footer preview: the other column, as currently stored. */
  otherFooter?: NavEntry[];
  /** For the footer preview: the chrome's strings as currently stored. */
  text?: ChromeText;
  onSaved: (list: EditableList) => void;
}) {
  const [entries, setEntries] = useState<NavEntry[]>(list.entries);
  const [stamp, setStamp] = useState(list.updatedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState<EditableList | null>(null);
  const [adding, setAdding] = useState('');

  // A new `list` from the server (a save, or the Reload button) replaces the
  // draft, and its stamp is the one the next save carries. Adjusted during
  // render, the way React documents for state that follows a prop, rather than
  // in an effect that would paint the stale draft first.
  const [seen, setSeen] = useState(list);
  if (list !== seen) {
    setSeen(list);
    setEntries(list.entries);
    setStamp(list.updatedAt);
    setConflict(null);
    setError(null);
  }

  const dirty = useMemo(() => !sameEntries(entries, list.entries), [entries, list.entries]);
  const isBar = role === 'bar';
  const withAuthz = role === 'menu' || role === 'bar';

  async function save(expected: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    setConflict(null);
    try {
      const res = await fetch(`/api/admin/design/lists/${listKey}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries, updatedAt: expected }),
      });
      if (res.status === 409) {
        const d = (await res.json().catch(() => ({}))) as { current?: EditableList | null };
        if (d.current) setConflict(d.current);
        else setError('This list was saved again after you loaded it. Reload the page.');
        return;
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `Failed (${res.status}).`);
        return;
      }
      const d = (await res.json()) as { updatedAt: string; entries: NavEntry[] };
      setStamp(d.updatedAt);
      setSaved(true);
      onSaved({ ...list, updatedAt: d.updatedAt, entries: d.entries });
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const bound = maxEntries(role);
  const columns = 3 + (isBar ? 1 : 0) + (withAuthz ? 1 : 0) + 1;

  return (
    <div>
      <h2 className="m-0 mb-1 text-[20px] font-bold text-text">{title}</h2>
      <p className="m-0 mb-4 max-w-[70ch] text-[13px] text-text-muted">{sub}</p>

      <div className="border border-border-strong bg-surface">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-text-faint">
              <th className="w-16 px-2.5 py-2 font-semibold">Seq</th>
              <th className="px-2.5 py-2 font-semibold">Label</th>
              <th className="px-2.5 py-2 font-semibold">Destination</th>
              {isBar && <th className="px-2.5 py-2 font-semibold">Icon</th>}
              {withAuthz && <th className="px-2.5 py-2 font-semibold">Authorization</th>}
              <th className="w-24 px-2.5 py-2" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const dest = resolveDestination(entry.dest);
              return (
                <tr key={`${entry.dest}-${i}`} className="border-t border-border align-middle">
                  <td className="px-2.5 py-1.5">
                    <span className="inline-flex gap-0.5">
                      <button
                        type="button"
                        className={MV}
                        disabled={readOnly || i === 0}
                        aria-label={`Move ${entry.label} up`}
                        onClick={() => setEntries(e => moveEntry(e, i, i - 1))}
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        type="button"
                        className={MV}
                        disabled={readOnly || i === entries.length - 1}
                        aria-label={`Move ${entry.label} down`}
                        onClick={() => setEntries(e => moveEntry(e, i, i + 1))}
                      >
                        <ChevronDown size={12} />
                      </button>
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <input
                      type="text"
                      value={entry.label}
                      maxLength={60}
                      disabled={readOnly}
                      aria-label={`Label of entry ${i + 1}`}
                      className={`${FIELD} w-40`}
                      onChange={e => setEntries(list => updateEntry(list, i, { label: e.target.value }))}
                    />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <select
                      value={entry.dest}
                      disabled={readOnly}
                      aria-label={`Destination of entry ${i + 1}`}
                      className={`${FIELD} w-56`}
                      onChange={e => setEntries(list => updateEntry(list, i, { dest: e.target.value }))}
                    >
                      {DEST_OPTIONS.map(o => (
                        <option key={o.key} value={o.key}>
                          {o.label} · {o.href}
                        </option>
                      ))}
                    </select>
                    {!dest && <span className="ml-2 font-mono text-[9px] uppercase text-negative">not in the catalogue</span>}
                  </td>
                  {isBar && (
                    <td className="px-2.5 py-1.5">
                      <select
                        value={entry.icon ?? ''}
                        disabled={readOnly}
                        aria-label={`Icon of entry ${i + 1}`}
                        className={`${FIELD} w-36`}
                        onChange={e => setEntries(list => updateEntry(list, i, { icon: e.target.value }))}
                      >
                        {BAR_ICON_NAMES.map(name => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  {withAuthz && (
                    <td className="px-2.5 py-1.5">
                      <select
                        value={entry.authz ?? ''}
                        disabled={readOnly}
                        aria-label={`Authorization of entry ${i + 1}`}
                        className={`${FIELD} w-36`}
                        onChange={e => setEntries(list => updateEntry(list, i, { authz: e.target.value }))}
                      >
                        {SCHEMES.map(s => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="px-2.5 py-1.5 text-right">
                    <button
                      type="button"
                      className={`${PBTN} hover:border-negative hover:text-negative`}
                      disabled={readOnly || !canRemove(role, entries.length)}
                      onClick={() => setEntries(list => removeEntry(list, i, role))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={columns} className="px-2.5 py-4 text-center text-text-faint">
                  No entries. The site shows its built-in navigation until this list has at least one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-2.5 border-t border-border px-2.5 py-2.5">
          <select
            value={adding}
            disabled={readOnly || !canAdd(role, entries.length)}
            aria-label="Add an entry from the catalogue"
            className={`${FIELD} w-64`}
            onChange={e => {
              const key = e.target.value;
              setAdding('');
              if (key) setEntries(list => addEntry(list, key, role));
            }}
          >
            <option value="">＋ Add from the catalogue…</option>
            {DEST_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>
                {o.label} · {o.href}
                {entries.some(e => e.dest === o.key) ? ' · in use' : ''}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-text-faint">
            {bound === null ? `At least ${minEntries(role)}; any number above that.` : `${minEntries(role)} to ${bound} cells.`}
          </span>
        </div>
      </div>

      <div className="mt-4 border border-border-strong bg-surface p-4">
        <h4 className="m-0 mb-2.5 text-[12px] font-semibold text-text-muted">Preview · the real component, with these entries</h4>
        {role === 'menu' && (
          <div className="flex h-[58px] items-center gap-[22px] overflow-x-auto border border-border-strong bg-surface-elevated px-10">
            <span className="shrink-0 font-condensed text-[19px] font-bold uppercase tracking-[0.06em] text-text">
              Paddock<span className="text-brand">•</span>Tracker
            </span>
            <DoorLinks entries={entries} preview />
          </div>
        )}
        {role === 'bar' && (
          <div className="max-w-[390px] border border-border-strong">
            <BottomBar entries={entries} preview />
          </div>
        )}
        {role === 'footer' && (
          <div className="overflow-hidden border border-border-strong [&_footer]:mt-0">
            <Footer
              site={listKey === 'footer-site' ? entries : (otherFooter ?? [])}
              legal={listKey === 'footer-legal' ? entries : (otherFooter ?? [])}
              text={text}
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={TB_PRIMARY} disabled={busy || !dirty || readOnly} onClick={() => save(stamp)}>
          {busy && <Loader2 size={13} className="animate-spin" />}
          {busy ? 'Saving…' : 'Save'}
        </button>
        {dirty && !busy && (
          <button type="button" className={TB} onClick={() => setEntries(list.entries)}>
            <RotateCcw size={13} /> Discard changes
          </button>
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
          {dirty ? 'Unsaved changes' : saved ? 'Saved · the site picks it up within a minute' : `Stored · ${stamp.replace('T', ' ').slice(0, 19)} UTC`}
        </span>
      </div>
      {conflict && (
        <div className="mt-3 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-[12px] text-text">
          <p className="m-0">
            This list was saved again at {conflict.updatedAt.replace('T', ' ').slice(0, 19)} UTC, after you loaded it. Reload to take
            that version, or save yours over it.
          </p>
          <div className="mt-2 flex gap-3">
            <button type="button" className={PBTN} onClick={() => onSaved(conflict)}>
              Reload
            </button>
            <button type="button" className={PBTN} onClick={() => save(conflict.updatedAt)}>
              Save anyway
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-negative">{error}</p>}
    </div>
  );
}
