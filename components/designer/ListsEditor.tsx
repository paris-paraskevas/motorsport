'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type { EditableList, ListSummary, NavListKey } from '@/lib/design/lists';
import { LIST_KEY_MAX, LIST_LABEL_MAX, listKeyProblem, listLabelProblem } from '@/lib/design/list-edit';
import { DEFAULT_AUTHZ_SCHEMES, type AuthzScheme } from '@/lib/design/authz-defaults';
import type { PageRow } from '@/lib/design/pages';
import { ListEditor } from './ListEditor';

// Lists (APEX: Lists), the Phase 3 entry: every list of the application in one
// table, the four the shell renders (opened in their own entries) and the
// operator's own, which a List region on any page may show. Create takes a key
// and a label; Open edits the entries in the same list editor the shell's lists
// use; Delete asks first and is refused by the database while a page's
// revision still names the list. The keys never change once stored: a region
// names a list by its key.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-50';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-50';
const FIELD =
  'border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';

const ROLE_WORD: Record<string, string> = {
  menu: 'the header’s doors',
  bar: 'the phone bar',
  footer: 'the footer',
  reference: 'reference cards',
  generic: 'your own',
};

type Opened = { state: 'loading'; key: string } | { state: 'error'; key: string; message: string } | { state: 'ready'; key: string; list: EditableList };

export function ListsEditor({
  lists,
  readOnly,
  schemes = DEFAULT_AUTHZ_SCHEMES,
  pages = [],
  deleted = [],
  onOpenShell,
  onChanged,
}: {
  lists: ListSummary[];
  readOnly: boolean;
  /** The authorization schemes an entry may name, as currently stored. */
  schemes?: readonly AuthzScheme[];
  /** The row pages an entry may name, and the deleted ones (P1.12 B1). */
  pages?: readonly PageRow[];
  deleted?: readonly PageRow[];
  /** One of the shell's four lists: its own catalogue entry opens. */
  onOpenShell: (key: NavListKey) => void;
  /** The index after a create, a save or a delete. */
  onChanged: (lists: ListSummary[]) => void;
}) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);

  const keyProblem = key ? listKeyProblem(key.trim()) : null;
  const labelProblem = label ? listLabelProblem(label) : null;
  const canCreate = !readOnly && busy === null && key.trim() !== '' && label.trim() !== '' && !keyProblem && !labelProblem;
  const own = lists.filter(l => l.role === 'generic');
  const shell = lists.filter(l => l.role !== 'generic');

  async function create() {
    if (!canCreate) return;
    setBusy('create');
    setError(null);
    try {
      const res = await fetch('/api/admin/design/lists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), label: label.trim() }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; list?: EditableList; current?: ListSummary[] };
      if (!res.ok) {
        setError(d.error ?? `Failed (${res.status}).`);
        if (res.status === 409 && d.current) onChanged(d.current);
        return;
      }
      const made = d.list!;
      onChanged([...lists, { key: made.key, role: made.role, label: made.label, updatedAt: made.updatedAt, entries: 0 }].sort((a, b) => a.key.localeCompare(b.key)));
      setKey('');
      setLabel('');
      setOpened({ state: 'ready', key: made.key, list: made });
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function open(k: string) {
    setOpened({ state: 'loading', key: k });
    setError(null);
    try {
      const res = await fetch(`/api/admin/design/lists/${k}`, { cache: 'no-store' });
      if (!res.ok) {
        setOpened({ state: 'error', key: k, message: `The list could not be loaded (HTTP ${res.status}).` });
        return;
      }
      setOpened({ state: 'ready', key: k, list: (await res.json()) as EditableList });
    } catch {
      setOpened({ state: 'error', key: k, message: 'The list could not be loaded: network error.' });
    }
  }

  async function remove(l: ListSummary) {
    setBusy(l.key);
    setError(null);
    setConfirm(null);
    try {
      const res = await fetch(`/api/admin/design/lists/${l.key}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updatedAt: l.updatedAt }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; current?: EditableList | null };
      if (!res.ok) {
        setError(d.error ?? `Failed (${res.status}).`);
        if (res.status === 409 && d.current) onChanged(lists.map(x => (x.key === l.key ? { ...x, updatedAt: d.current!.updatedAt, entries: d.current!.entries.length } : x)));
        return;
      }
      onChanged(lists.filter(x => x.key !== l.key));
      if (opened?.key === l.key) setOpened(null);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const saved = (list: EditableList) => {
    setOpened({ state: 'ready', key: list.key, list });
    onChanged(lists.map(x => (x.key === list.key ? { ...x, updatedAt: list.updatedAt, entries: list.entries.length } : x)));
  };

  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Lists</h2>
      <p className="m-0 mb-4 max-w-[70ch] text-13 text-text-muted">
        Every list of links the application holds. The shell renders four of them; the rest are yours, and a List region on any page can show one.
        A key never changes once stored, because regions name a list by it; a list any page revision has named stays, since revisions are kept.
      </p>

      <div className="border border-border-strong bg-surface">
        <table className="w-full border-collapse text-12">
          <thead>
            <tr className="text-left text-text-faint">
              <th className="px-2.5 py-2 font-semibold">Key</th>
              <th className="px-2.5 py-2 font-semibold">Label</th>
              <th className="px-2.5 py-2 font-semibold">Renders as</th>
              <th className="px-2.5 py-2 text-right font-semibold">Entries</th>
              <th className="px-2.5 py-2 font-semibold">Stored</th>
              <th className="w-40 px-2.5 py-2" />
            </tr>
          </thead>
          <tbody>
            {[...shell, ...own].map(l => (
              <tr key={l.key} className={`border-t border-border align-middle ${opened?.key === l.key ? 'bg-edit-dim' : ''}`}>
                <td className="px-2.5 py-1.5 font-mono text-11 text-text">{l.key}</td>
                <td className="px-2.5 py-1.5 text-text">{l.label}</td>
                <td className="px-2.5 py-1.5 text-text-muted">
                  {ROLE_WORD[l.role] ?? l.role}
                  {l.role !== 'generic' && <span className="ml-2 font-mono text-9 uppercase tracking-[0.12em] text-text-faint">shell</span>}
                </td>
                <td className="px-2.5 py-1.5 text-right font-mono text-11 text-text-muted">{l.entries}</td>
                <td className="px-2.5 py-1.5 font-mono text-10 text-text-faint">{l.updatedAt.replace('T', ' ').slice(0, 16)}Z</td>
                <td className="px-2.5 py-1.5 text-right">
                  {l.role !== 'generic' ? (
                    <button type="button" className={PBTN} onClick={() => onOpenShell(l.key as NavListKey)}>
                      Open
                    </button>
                  ) : confirm === l.key ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-11 text-text-muted">Delete “{l.label}”?</span>
                      <button type="button" className={`${PBTN} border-negative text-negative`} disabled={busy !== null} onClick={() => void remove(l)}>
                        {busy === l.key ? <Loader2 size={11} className="animate-spin" /> : 'Yes'}
                      </button>
                      <button type="button" className={PBTN} onClick={() => setConfirm(null)}>
                        No
                      </button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <button type="button" className={PBTN} onClick={() => void open(l.key)}>
                        Open
                      </button>
                      <button
                        type="button"
                        className={`${PBTN} hover:border-negative hover:text-negative`}
                        disabled={readOnly || busy !== null}
                        aria-label={`Delete ${l.key}`}
                        onClick={() => setConfirm(l.key)}
                      >
                        <Trash2 size={11} />
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {own.length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={6} className="px-2.5 py-3 text-center text-text-faint">
                  No list of your own yet. Create one below, then show it with a List region on a page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-wrap items-end gap-2.5 border-t border-border px-2.5 py-2.5">
          <label className="grid gap-0.5 text-10 uppercase tracking-[0.12em] text-text-faint">
            Key
            <input
              type="text"
              value={key}
              maxLength={LIST_KEY_MAX}
              disabled={readOnly || busy !== null}
              placeholder="useful-links"
              aria-label="Key of the new list"
              className={`${FIELD} w-48 font-mono text-11`}
              onChange={e => setKey(e.target.value)}
            />
          </label>
          <label className="grid gap-0.5 text-10 uppercase tracking-[0.12em] text-text-faint">
            Label
            <input
              type="text"
              value={label}
              maxLength={LIST_LABEL_MAX}
              disabled={readOnly || busy !== null}
              placeholder="Useful links"
              aria-label="Label of the new list"
              className={`${FIELD} w-64`}
              onChange={e => setLabel(e.target.value)}
            />
          </label>
          <button type="button" className={TB_PRIMARY} disabled={!canCreate} onClick={() => void create()}>
            {busy === 'create' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Create list
          </button>
          <span className="text-11 text-text-faint">{keyProblem ?? labelProblem ?? 'Lower-case letters, digits and hyphens for the key.'}</span>
        </div>
      </div>
      {error && <p className="mt-2 text-12 text-negative">{error}</p>}

      {opened && (
        <div className="mt-6 border-t border-border-strong pt-5">
          {opened.state === 'loading' && <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading {opened.key}…</p>}
          {opened.state === 'error' && <p className="text-12 text-negative">{opened.message}</p>}
          {opened.state === 'ready' && (
            <ListEditor
              key={opened.key}
              listKey={opened.key}
              role="generic"
              list={opened.list}
              title={opened.list.label}
              sub={`Your own list, key “${opened.key}”. A List region shows it as links or cards; a card shows the note under the entry’s words; an entry with an authorization is left out for a visitor who fails it.`}
              readOnly={readOnly}
              schemes={schemes}
              pages={pages}
              deleted={deleted}
              onSaved={saved}
            />
          )}
        </div>
      )}
    </div>
  );
}
