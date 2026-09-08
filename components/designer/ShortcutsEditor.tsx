'use client';

import { useState } from 'react';
import { Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { SHORTCUT_KEY_MAX, SHORTCUT_TEXT_MAX, shortcutKeyProblem, shortcutTextProblem } from '@/lib/design/shortcut-defaults';
import type { EditableShortcut } from '@/lib/design/shortcuts';

// Shortcuts (APEX: Shortcuts): house-style fragments in a table, key and text,
// the list the operator's to add to and remove from. Save runs creates, then
// edits, then deletes, each through its own route with the stamp that was
// loaded; a row that moved comes back as a conflict with Reload. A stored key
// never changes (a Static Content box will name it): a rename is a new row and
// a deletion. Nothing on the site reads a shortcut until Phase 3.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';

interface Draft {
  /** A client id, stable across renders; the key once the row exists. */
  id: string;
  key: string;
  text: string;
  /** The row as loaded, null for a shortcut not saved yet. */
  stored: EditableShortcut | null;
  deleted: boolean;
}

let seq = 0;
const newId = () => `new-${++seq}`;
const draftsOf = (rows: EditableShortcut[]): Draft[] => rows.map(s => ({ id: s.key, key: s.key, text: s.text, stored: s, deleted: false }));

export function ShortcutsEditor({
  shortcuts,
  readOnly,
  onSaved,
}: {
  shortcuts: EditableShortcut[];
  readOnly: boolean;
  onSaved: (shortcuts: EditableShortcut[]) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => draftsOf(shortcuts));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [conflict, setConflict] = useState<EditableShortcut[] | null>(null);

  // New rows from the server replace the draft (adjusted during render, React's
  // own pattern for state that follows a prop).
  const [seen, setSeen] = useState(shortcuts);
  if (shortcuts !== seen) {
    setSeen(shortcuts);
    setDrafts(draftsOf(shortcuts));
    setConflict(null);
    setError(null);
  }

  const live = drafts.filter(d => !d.deleted);
  const keyCount = new Map<string, number>();
  for (const d of live) keyCount.set(d.key.trim(), (keyCount.get(d.key.trim()) ?? 0) + 1);

  /** The reasons a row cannot be saved, in plain words. */
  const problemsOf = (d: Draft): string[] => {
    const out: string[] = [];
    if (d.stored === null) {
      const p = shortcutKeyProblem(d.key.trim());
      if (p) out.push(p);
      else if ((keyCount.get(d.key.trim()) ?? 0) > 1) out.push('this key is used twice');
    }
    const t = shortcutTextProblem(d.text);
    if (t) out.push(t);
    return out;
  };

  const work = {
    creates: live.filter(d => d.stored === null),
    edits: live.filter(d => d.stored !== null && d.text.trim() !== d.stored.text),
    deletes: drafts.filter(d => d.stored !== null && d.deleted),
  };
  const count = work.creates.length + work.edits.length + work.deletes.length;
  const invalid = live.some(d => problemsOf(d).length > 0);

  const update = (id: string, patch: Partial<Draft>) => setDrafts(list => list.map(d => (d.id === id ? { ...d, ...patch } : d)));
  const add = () => setDrafts(list => [...list, { id: newId(), key: '', text: '', stored: null, deleted: false }]);
  const remove = (d: Draft) =>
    d.stored ? update(d.id, { deleted: true }) : setDrafts(list => list.filter(x => x.id !== d.id));
  const discard = () => {
    setDrafts(draftsOf(shortcuts));
    setError(null);
  };

  async function save() {
    if (busy || readOnly || count === 0 || invalid) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    setConflict(null);
    const headers = { 'content-type': 'application/json' };
    let done = 0;
    // A refusal stops the run; a 409 shows the conflict; anything else is the error line.
    const fail = async (res: Response, what: string): Promise<void> => {
      if (res.status === 409) {
        const d = (await res.json().catch(() => ({}))) as { current?: EditableShortcut[] | null };
        setConflict(d.current ?? []);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(`${what}: ${d.error ?? `failed (${res.status})`}`);
    };
    try {
      for (const d of work.creates) {
        const res = await fetch('/api/admin/design/shortcuts', {
          method: 'POST',
          headers,
          body: JSON.stringify({ key: d.key.trim(), text: d.text }),
        });
        if (!res.ok) return void (await fail(res, d.key.trim() || 'new shortcut'));
        done += 1;
      }
      for (const d of work.edits) {
        const res = await fetch(`/api/admin/design/shortcuts/${d.key}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ text: d.text, updatedAt: d.stored!.updatedAt }),
        });
        if (!res.ok) return void (await fail(res, d.key));
        done += 1;
      }
      for (const d of work.deletes) {
        const res = await fetch(`/api/admin/design/shortcuts/${d.key}`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ updatedAt: d.stored!.updatedAt }),
        });
        if (!res.ok) return void (await fail(res, d.key));
        done += 1;
      }
      const fresh = await fetch('/api/admin/design/shortcuts', { cache: 'no-store' });
      if (fresh.ok) {
        const d = (await fresh.json()) as { shortcuts: EditableShortcut[] };
        onSaved(d.shortcuts);
      }
      setSaved(done);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Shortcuts</h2>
      <p className="m-0 mb-4 max-w-[72ch] text-13 text-text-muted">
        House-style fragments a Static Content box will insert by key, so one edit changes every page that uses one.
        Nothing on the site reads them until Phase 3 brings Static Content; until then this is the list, and it is
        yours to edit, add to and shorten. A key is lower-case letters, digits, dots, dashes and underscores, and never
        changes once saved: to rename, add the new one and delete the old.
      </p>

      <div className="border border-border-strong bg-surface">
        <table className="w-full border-collapse text-12">
          <thead>
            <tr className="text-left text-text-faint">
              <th className="w-56 px-2.5 py-2 font-semibold">Key</th>
              <th className="px-2.5 py-2 font-semibold">Text</th>
              <th className="w-10 px-2.5 py-2" />
            </tr>
          </thead>
          <tbody>
            {live.length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={3} className="px-2.5 py-3 text-text-faint">
                  No shortcuts yet.
                </td>
              </tr>
            )}
            {live.map(d => {
              const problems = problemsOf(d);
              const changed = d.stored !== null && d.text.trim() !== d.stored.text;
              const keyBad = d.stored === null && problems.some(p => p !== shortcutTextProblem(d.text));
              return (
                <tr key={d.id} className="border-t border-border align-top">
                  <td className="px-2.5 py-2 font-mono text-11 text-text-muted">
                    {d.stored ? (
                      <>
                        {d.key}
                        {changed && <span className="mt-1 block text-9 uppercase text-edit">changed</span>}
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={d.key}
                          disabled={readOnly}
                          spellCheck={false}
                          maxLength={SHORTCUT_KEY_MAX}
                          placeholder="section.name"
                          aria-label="Key of the new shortcut"
                          className={`${FIELD} font-mono text-11 ${keyBad ? 'border-negative' : ''}`}
                          onChange={e => update(d.id, { key: e.target.value.toLowerCase() })}
                        />
                        <span className="mt-1 block text-9 uppercase text-edit">new</span>
                      </>
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    <input
                      type="text"
                      value={d.text}
                      disabled={readOnly}
                      aria-label={d.stored ? `Text of ${d.key}` : 'Text of the new shortcut'}
                      className={FIELD}
                      onChange={e => update(d.id, { text: e.target.value })}
                    />
                    <div className="mt-1 flex justify-between font-mono text-9 text-text-faint">
                      <span className={problems.length > 0 ? 'text-negative' : ''}>{problems.join(' · ')}</span>
                      <span className="tabular-nums">
                        {d.text.length} / {SHORTCUT_TEXT_MAX}
                      </span>
                    </div>
                  </td>
                  <td className="px-2.5 py-2">
                    <button
                      type="button"
                      className={`${PBTN} hover:border-negative hover:text-negative`}
                      disabled={readOnly}
                      title={d.stored ? `Delete ${d.key}` : 'Remove this row'}
                      aria-label={d.stored ? `Delete ${d.key}` : 'Remove the new row'}
                      onClick={() => remove(d)}
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!readOnly && (
          <div className="border-t border-border px-2.5 py-2">
            <button type="button" className={`${TB} h-[26px]`} onClick={add}>
              <Plus size={13} /> Add a shortcut
            </button>
          </div>
        )}
      </div>

      {work.deletes.length > 0 && (
        <p className="mt-3 text-12 text-text-muted">To be deleted on Save: {work.deletes.map(d => d.key).join(', ')}.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={TB_PRIMARY} disabled={busy || readOnly || count === 0 || invalid} onClick={() => void save()}>
          {busy && <Loader2 size={13} className="animate-spin" />}
          {busy ? 'Saving…' : count > 1 ? `Save ${count} changes` : 'Save'}
        </button>
        {count > 0 && !busy && (
          <button type="button" className={TB} onClick={discard}>
            <RotateCcw size={13} /> Discard changes
          </button>
        )}
        <span className="font-mono text-10 uppercase tracking-[0.12em] text-text-faint">
          {count > 0
            ? `${count} unsaved${invalid ? ' · a row fails its checks' : ''}`
            : saved
              ? `Saved ${saved} · read by nothing yet`
              : 'Stored'}
        </span>
      </div>
      {conflict && (
        <div className="mt-3 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text">
          <p className="m-0">
            The shortcuts were saved again after you loaded them. Reload to see what is stored now; your unsaved changes
            are dropped.
          </p>
          <div className="mt-2 flex gap-3">
            <button type="button" className={PBTN} onClick={() => onSaved(conflict)}>
              Reload
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-12 text-negative">{error}</p>}
    </div>
  );
}
