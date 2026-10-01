'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, RotateCcw } from 'lucide-react';
import { DESTINATIONS, pageDest, pageIdOf, resolveDestination, resolveEntry, seriesDestinationOptions, type ListRole, type NavEntry, type PageDestinations } from '@/lib/design/destinations';
import type { PageRow } from '@/lib/design/pages';
import { DEFAULT_TEXT, type ChromeText } from '@/lib/design/text-defaults';
import type { EditableList } from '@/lib/design/lists';
import {
  LIST_NOTE_MAX,
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
import { DEFAULT_AUTHZ_SCHEMES, authzOptions, type AuthzScheme } from '@/lib/design/authz-defaults';

// One navigation list, edited in a table (APEX's list entries page): sequence,
// label, destination from the catalogue, icon for the bar, authorization for the
// doors and the bar, Remove; an add row; a preview that renders the REAL
// component with the edited entries; Save with the version check. The table
// operations are lib/design/list-edit.ts, the bounds are the API's bounds, and
// nothing here can type a URL: the destination is always a catalogue key.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'h-7 max-w-full border border-border-strong bg-bg px-1.5 text-12 text-text focus:border-edit focus:outline-none';
const MV =
  'grid h-6 w-6 place-items-center border border-border-strong text-text-muted hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-30';

type DestOption = { key: string; label: string; kind: string; href: string };
const CATALOGUE_OPTIONS: DestOption[] = [
  ...Object.entries(DESTINATIONS).map(([key, d]) => ({ key, label: d.label, kind: d.kind, href: d.kind === 'action' ? d.action : d.href })),
  // The series tabs (R18): the rule's keys, flat among the catalogue's by label (the designer's selects group them).
  ...seriesDestinationOptions().map(o => ({ key: o.key, label: o.label, kind: 'route', href: o.href })),
].sort((a, b) => a.label.localeCompare(b.label));
/** The row pages as options (P1.12 B1), by name, after the catalogue's. */
const pageOptions = (pages: readonly PageRow[], suffix = ''): DestOption[] =>
  pages
    .filter(p => p.id)
    .map(p => ({ key: pageDest(p.id!), label: p.name + suffix, kind: 'route', href: p.path }))
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
  schemes = DEFAULT_AUTHZ_SCHEMES,
  pages = [],
  deleted = [],
  onSaved,
}: {
  /** One of the shell's four keys, or the key of a list of the operator's own. */
  listKey: string;
  role: ListRole;
  list: EditableList;
  title: string;
  sub: string;
  readOnly: boolean;
  /** For the footer preview: the other column, as currently stored. */
  otherFooter?: NavEntry[];
  /** For the footer preview: the chrome's strings as currently stored. */
  text?: ChromeText;
  /** The authorization schemes an entry may name, as currently stored. */
  schemes?: readonly AuthzScheme[];
  /** The live row pages an entry may name (P1.12 B1), and the deleted ones, whose entries show for what they are. */
  pages?: readonly PageRow[];
  deleted?: readonly PageRow[];
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
  // The footer shows every entry to everyone; the doors, the bar and a list of
  // the operator's own (shown by a List region) may hide an entry behind a scheme.
  const withAuthz = role === 'menu' || role === 'bar' || role === 'generic';
  // The sentence a card draws (R18 PR C), on a list of the operator's own; the shell's lists draw none.
  const withNote = role === 'generic';

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
  const columns = 3 + (isBar ? 1 : 0) + (withAuthz ? 1 : 0) + (withNote ? 1 : 0) + 1;
  // Row pages as destinations (P1.12 B1): the live pages are offered; a stored
  // entry to a deleted page keeps its option, named deleted, so the row reads
  // right and Remove is at hand; the preview hides it as the shell does.
  const livePages = pages.filter(p => p.kind === 'row');
  const pageMap: PageDestinations = Object.fromEntries(livePages.filter(p => p.id).map(p => [p.id!, { path: p.path, name: p.name }]));
  const deletedIds = new Set(deleted.map(p => p.id).filter((id): id is string => id !== null));
  const stateOf = (entry: NavEntry): 'live' | 'deleted' | 'unknown' => {
    const id = pageIdOf(entry.dest);
    if (id) return pageMap[id] ? 'live' : deletedIds.has(id) ? 'deleted' : 'unknown';
    return resolveDestination(entry.dest) ? 'live' : 'unknown';
  };
  const addOptions: DestOption[] = [...CATALOGUE_OPTIONS, ...pageOptions(livePages)];
  const namedDeleted = deleted.filter(p => p.id && entries.some(e => pageIdOf(e.dest) === p.id));
  const entryOptions: DestOption[] = [...addOptions, ...pageOptions(namedDeleted, ' · deleted')];
  const previewEntries = entries.map(e => (stateOf(e) === 'deleted' ? { ...e, href: undefined } : e));

  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">{title}</h2>
      <p className="m-0 mb-4 max-w-[70ch] text-13 text-text-muted">{sub}</p>

      <div className="overflow-x-auto border border-border-strong bg-surface">
        <table className="w-full border-collapse text-12">
          <thead>
            <tr className="text-left text-text-faint">
              <th className="w-16 px-2.5 py-2 font-semibold">Seq</th>
              <th className="px-2.5 py-2 font-semibold">Label</th>
              <th className="px-2.5 py-2 font-semibold">Destination</th>
              {isBar && <th className="px-2.5 py-2 font-semibold">Icon</th>}
              {withAuthz && <th className="px-2.5 py-2 font-semibold">Authorization</th>}
              {withNote && <th className="px-2.5 py-2 font-semibold">Note</th>}
              <th className="w-24 px-2.5 py-2" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const state = stateOf(entry);
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
                      {entryOptions.map(o => (
                        <option key={o.key} value={o.key}>
                          {o.label} · {o.href}
                        </option>
                      ))}
                    </select>
                    {state === 'unknown' && <span className="ml-2 font-mono text-9 uppercase text-negative">not in the catalogue</span>}
                    {state === 'deleted' && <span className="ml-2 font-mono text-9 uppercase text-text-faint">deleted page</span>}
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
                        {authzOptions(schemes).map(s => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  {withNote && (
                    <td className="px-2.5 py-1.5">
                      <input
                        type="text"
                        value={entry.note ?? ''}
                        maxLength={LIST_NOTE_MAX}
                        disabled={readOnly}
                        aria-label={`Note of entry ${i + 1}`}
                        placeholder="One sentence a card shows"
                        className={`${FIELD} w-64`}
                        onChange={e => setEntries(list => updateEntry(list, i, { note: e.target.value }))}
                      />
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
              if (key) setEntries(list => addEntry(list, key, role, pageMap));
            }}
          >
            <option value="">＋ Add from the catalogue…</option>
            {addOptions.map(o => (
              <option key={o.key} value={o.key}>
                {o.label} · {o.href}
                {entries.some(e => e.dest === o.key) ? ' · in use' : ''}
              </option>
            ))}
          </select>
          <span className="text-11 text-text-faint">
            {bound === null ? `At least ${minEntries(role)}; any number above that.` : `${minEntries(role)} to ${bound} cells.`}
          </span>
        </div>
      </div>

      <div className="mt-4 border border-border-strong bg-surface p-4">
        <h4 className="m-0 mb-2.5 text-12 font-semibold text-text-muted">Preview · the real component, with these entries</h4>
        {role === 'menu' && (
          <div className="flex h-[58px] items-center gap-[22px] overflow-x-auto border border-border-strong bg-surface-elevated px-10">
            <span className="shrink-0 font-condensed text-19 font-bold uppercase tracking-[0.06em] text-text">
              Paddock<span className="text-brand">•</span>Tracker
            </span>
            <DoorLinks entries={previewEntries} preview />
          </div>
        )}
        {role === 'bar' && (
          <div className="max-w-[390px] border border-border-strong">
            <BottomBar entries={previewEntries} preview />
          </div>
        )}
        {role === 'footer' && (
          <div className="overflow-hidden border border-border-strong [&_footer]:mt-0">
            <Footer
              site={listKey === 'footer-site' ? previewEntries : (otherFooter ?? [])}
              legal={listKey === 'footer-legal' ? previewEntries : (otherFooter ?? [])}
              text={text}
            />
          </div>
        )}
        {role === 'generic' && (
          // A List region draws these as links (or cards); the region's own
          // title and style are set on the page.
          <ul className="m-0 list-none border border-border-strong bg-bg p-4" aria-label="Preview of the list">
            {previewEntries.map((e, i) => {
              const dest = resolveEntry(e);
              return (
                <li key={`${e.dest}-${i}`} className="py-1 font-serif text-16 text-text underline underline-offset-2">
                  {e.label}
                  {dest && dest.kind !== 'action' && <span className="ml-2 font-mono text-10 no-underline text-text-faint">{dest.href}</span>}
                  {e.authz && <span className="ml-2 font-mono text-9 uppercase tracking-[0.12em] text-text-faint">{e.authz}</span>}
                  {e.note && <span className="ml-2 font-sans text-12 no-underline text-text-muted">{e.note}</span>}
                </li>
              );
            })}
            {entries.length === 0 && <li className="text-13 text-text-faint">Nothing yet: a region showing this list renders nothing.</li>}
          </ul>
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
        <span className="font-mono text-10 uppercase tracking-[0.12em] text-text-faint">
          {dirty ? 'Unsaved changes' : saved ? 'Saved · the site picks it up within a minute' : `Stored · ${stamp.replace('T', ' ').slice(0, 19)} UTC`}
        </span>
      </div>
      {conflict && (
        <div className="mt-3 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text">
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
      {error && <p className="mt-2 text-12 text-negative">{error}</p>}
    </div>
  );
}
