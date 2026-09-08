'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { AUTHZ_LABEL_MAX, AUTHZ_MESSAGE_MAX, DEFAULT_AUTHZ_SCHEMES, describeAuthzCheck, type AuthzType } from '@/lib/design/authz-defaults';
import type { EditableAuthzScheme } from '@/lib/design/authz';

// Authorization Schemes (APEX: Authorization Schemes): the rules an entry, a
// region or a page can require, in a table: the scheme with its label editable,
// how the check is made (shown), and the message a refused visitor reads. Save
// writes every changed row through its own conditional update, and a row that
// moved since it was loaded comes back as a conflict with Reload or Save anyway.
// Since Phase 3 the schemes are enforced: on a row page and its regions when
// served (step 3) and on the navigation lists (step 4). A scheme of the
// operator's own is added below the table (its key and check fixed once stored)
// and removed from its row; the shipped four stay.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';
const LABEL = 'grid gap-1 text-11 text-text-muted';

type Draft = { label: string; message: string };
type Conflict = { key: string; current: EditableAuthzScheme };
type NewScheme = { key: string; label: string; type: Exclude<AuthzType, 'public'>; value: string; message: string };

const NEW_TYPES: { type: Exclude<AuthzType, 'public'>; label: string; needs: string | null }[] = [
  { type: 'signed_in', label: 'Any signed-in account', needs: null },
  { type: 'author', label: 'An approved writer', needs: null },
  { type: 'role', label: 'An account role', needs: 'the role, such as moderator' },
  { type: 'email_domain', label: 'An email domain', needs: 'the domain, such as @example.com' },
];
const KEY = /^[a-z0-9_-]{1,40}$/;
const EMPTY_NEW: NewScheme = { key: '', label: '', type: 'signed_in', value: '', message: '' };

const draftOf = (schemes: EditableAuthzScheme[]): Record<string, Draft> =>
  Object.fromEntries(schemes.map(s => [s.key, { label: s.label, message: s.message ?? '' }]));
const storedDraft = (s: EditableAuthzScheme): Draft => ({ label: s.label, message: s.message ?? '' });
const isBad = (d: Draft) => !d.label.trim() || d.label.length > AUTHZ_LABEL_MAX || d.message.length > AUTHZ_MESSAGE_MAX;
const differs = (s: EditableAuthzScheme, d: Draft) => d.label.trim() !== s.label || d.message.trim() !== (s.message ?? '');
const shipped = (key: string) => DEFAULT_AUTHZ_SCHEMES.some(s => s.key === key);

export function newSchemeProblem(n: NewScheme, existing: readonly string[]): string | null {
  if (!n.key.trim()) return 'needs a key';
  if (!KEY.test(n.key)) return 'a key is lower-case letters, digits, dashes and underscores, at most 40';
  if (existing.includes(n.key) || shipped(n.key)) return 'that key exists already';
  if (!n.label.trim()) return 'needs a label';
  if (n.label.length > AUTHZ_LABEL_MAX) return `a label is at most ${AUTHZ_LABEL_MAX} characters`;
  if (n.type === 'role' && !/^[a-z0-9_-]{1,40}$/.test(n.value.trim())) return 'a role check needs the role, lower-case';
  if (n.type === 'email_domain' && !/^@?[a-z0-9.-]+\.[a-z]{2,}$/i.test(n.value.trim())) return 'an email check needs a domain such as @example.com';
  if (n.message.length > AUTHZ_MESSAGE_MAX) return `a message is at most ${AUTHZ_MESSAGE_MAX} characters`;
  return null;
}

export function AuthzEditor({
  schemes,
  readOnly,
  onSaved,
}: {
  schemes: EditableAuthzScheme[];
  readOnly: boolean;
  onSaved: (schemes: EditableAuthzScheme[]) => void;
}) {
  const [draft, setDraft] = useState<Record<string, Draft>>(() => draftOf(schemes));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [adding, setAdding] = useState<NewScheme>(EMPTY_NEW);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  // New rows from the server replace the draft (adjusted during render, React's
  // own pattern for state that follows a prop).
  const [seen, setSeen] = useState(schemes);
  if (schemes !== seen) {
    setSeen(schemes);
    setDraft(draftOf(schemes));
    setConflicts([]);
    setError(null);
  }

  const draftFor = (s: EditableAuthzScheme): Draft => draft[s.key] ?? storedDraft(s);
  const isChanged = (s: EditableAuthzScheme) => differs(s, draftFor(s));

  const changed = useMemo(
    () => schemes.filter(s => s.updatedAt !== null && differs(s, draft[s.key] ?? storedDraft(s))),
    [schemes, draft],
  );
  const invalid = useMemo(() => schemes.filter(s => isBad(draft[s.key] ?? storedDraft(s))), [schemes, draft]);
  const addProblem = newSchemeProblem(adding, schemes.map(s => s.key));
  const addTouched = adding.key !== '' || adding.label !== '' || adding.value !== '' || adding.message !== '';

  async function save(overrides: Partial<Record<string, string>> = {}) {
    if (busy || readOnly) return;
    setBusy(true);
    setError(null);
    setSavedCount(null);
    setConflicts([]);
    const next = schemes.map(s => ({ ...s }));
    const newConflicts: Conflict[] = [];
    let saved = 0;
    try {
      for (const s of changed) {
        const expected = overrides[s.key] ?? s.updatedAt;
        if (!expected) continue;
        const d = draftFor(s);
        const res = await fetch(`/api/admin/design/authz/${s.key}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ label: d.label, message: d.message, updatedAt: expected }),
        });
        if (res.status === 409) {
          const body = (await res.json().catch(() => ({}))) as { current?: EditableAuthzScheme[] | null };
          const current = body.current?.find(c => c.key === s.key);
          if (current) newConflicts.push({ key: s.key, current });
          else setError(`${s.key}: saved again after you loaded it. Reload the page.`);
          continue;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(`${s.key}: ${body.error ?? `failed (${res.status})`}`);
          break;
        }
        const body = (await res.json()) as { label: string; message: string | null; updatedAt: string };
        const idx = next.findIndex(n => n.key === s.key);
        next[idx] = { ...next[idx], label: body.label, message: body.message, updatedAt: body.updatedAt };
        saved += 1;
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
    setConflicts(newConflicts);
    if (saved > 0) {
      setSavedCount(saved);
      onSaved(next);
    }
  }

  function reloadConflict(c: Conflict) {
    onSaved(schemes.map(s => (s.key === c.key ? c.current : s)));
  }

  async function add() {
    if (addBusy || readOnly || addProblem) return;
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await fetch('/api/admin/design/authz', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: adding.key, label: adding.label.trim(), type: adding.type, value: adding.value.trim(), message: adding.message.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; scheme?: EditableAuthzScheme; current?: EditableAuthzScheme[] | null };
      if (res.status === 409 && body.current) {
        setAddError(body.error ?? 'that key exists already');
        onSaved(body.current);
        return;
      }
      if (!res.ok || !body.scheme) {
        setAddError(body.error ?? `failed (${res.status})`);
        return;
      }
      setAdding(EMPTY_NEW);
      onSaved([...schemes, body.scheme]);
    } catch {
      setAddError('Network error. Try again.');
    } finally {
      setAddBusy(false);
    }
  }

  async function remove(key: string) {
    if (removeBusy || readOnly) return;
    setRemoveBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/design/authz/${key}`, { method: 'DELETE' });
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; current?: EditableAuthzScheme[] | null };
        setError(body.error ?? `${key} is still in use.`);
        if (body.current) onSaved(body.current);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`${key}: ${body.error ?? `failed (${res.status})`}`);
        return;
      }
      onSaved(schemes.filter(s => s.key !== key));
    } catch {
      setError('Network error. Try again.');
    } finally {
      setRemoveBusy(false);
      setRemoving(null);
    }
  }

  const needs = NEW_TYPES.find(t => t.type === adding.type)?.needs ?? null;

  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Authorization Schemes</h2>
      <p className="m-0 mb-4 max-w-[70ch] text-13 text-text-muted">
        The rules a navigation entry, a region or a page can require before a visitor sees it. A page or a region asking
        for one is served only to a visitor who passes, and a navigation entry asking for one shows only to them. The
        name and the message a refused visitor reads are yours; how a check is made is fixed when the scheme is made.
      </p>

      <div className="border border-border-strong bg-surface">
        <table className="w-full border-collapse text-12">
          <thead>
            <tr className="text-left text-text-faint">
              <th className="w-64 px-2.5 py-2 font-semibold">Scheme</th>
              <th className="w-56 px-2.5 py-2 font-semibold">Check</th>
              <th className="px-2.5 py-2 font-semibold">Message a refused visitor reads</th>
              <th className="w-28 px-2.5 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {schemes.map(s => {
              const d = draftFor(s);
              const disabled = readOnly || s.updatedAt === null;
              const changedRow = isChanged(s);
              const own = !shipped(s.key);
              return (
                <tr key={s.key} className="border-t border-border align-top">
                  <td className="px-2.5 py-2">
                    <input
                      type="text"
                      value={d.label}
                      disabled={disabled}
                      aria-label={`Label of ${s.key}`}
                      className={FIELD}
                      onChange={e => setDraft(all => ({ ...all, [s.key]: { ...draftFor(s), label: e.target.value } }))}
                    />
                    <div className="mt-1 flex justify-between font-mono text-9 uppercase tracking-[0.12em] text-text-faint">
                      <span>{s.key}</span>
                      <span className={!d.label.trim() || d.label.length > AUTHZ_LABEL_MAX ? 'text-negative' : ''}>
                        {!d.label.trim() ? 'cannot be empty' : d.label.length > AUTHZ_LABEL_MAX ? `over ${AUTHZ_LABEL_MAX}` : ''}
                      </span>
                    </div>
                    {s.updatedAt === null && <span className="mt-1 block text-9 uppercase text-text-faint">no row yet</span>}
                    {changedRow && s.updatedAt !== null && <span className="mt-1 block text-9 uppercase text-edit">changed</span>}
                  </td>
                  <td className="px-2.5 py-2 text-text-muted">
                    {describeAuthzCheck(s)}
                    <span className="mt-1 block font-mono text-9 uppercase tracking-[0.12em] text-text-faint">
                      {s.type}
                      {s.value ? ` · ${s.value}` : ''} · {own ? 'yours' : 'shipped'}
                    </span>
                  </td>
                  <td className="px-2.5 py-2">
                    {s.type === 'public' ? (
                      <span className="text-text-faint">Nobody is refused.</span>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={d.message}
                          disabled={disabled}
                          aria-label={`Message of ${s.key}`}
                          placeholder="No message"
                          className={FIELD}
                          onChange={e => setDraft(all => ({ ...all, [s.key]: { ...draftFor(s), message: e.target.value } }))}
                        />
                        <div className="mt-1 flex justify-end font-mono text-9 tabular-nums text-text-faint">
                          <span className={d.message.length > AUTHZ_MESSAGE_MAX ? 'text-negative' : ''}>
                            {d.message.length} / {AUTHZ_MESSAGE_MAX}
                          </span>
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-right">
                    {own && !readOnly && (
                      removing === s.key ? (
                        <span className="grid justify-items-end gap-1">
                          <span className="text-11 text-text-muted">Remove this scheme?</span>
                          <span className="flex gap-1">
                            <button type="button" className={`${PBTN} text-negative`} disabled={removeBusy} onClick={() => void remove(s.key)}>
                              {removeBusy ? 'Removing…' : 'Remove'}
                            </button>
                            <button type="button" className={PBTN} disabled={removeBusy} onClick={() => setRemoving(null)}>
                              Keep
                            </button>
                          </span>
                        </span>
                      ) : (
                        <button type="button" className={PBTN} onClick={() => setRemoving(s.key)} aria-label={`Remove ${s.key}`}>
                          <Trash2 size={10} className="mr-1 inline" />
                          Remove
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={TB_PRIMARY}
          disabled={busy || readOnly || changed.length === 0 || invalid.length > 0}
          onClick={() => save()}
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          {busy ? 'Saving…' : changed.length > 1 ? `Save ${changed.length} schemes` : 'Save'}
        </button>
        {changed.length > 0 && !busy && (
          <button type="button" className={TB} onClick={() => setDraft(draftOf(schemes))}>
            <RotateCcw size={13} /> Discard changes
          </button>
        )}
        <span className="font-mono text-10 uppercase tracking-[0.12em] text-text-faint">
          {changed.length > 0 ? `${changed.length} unsaved` : savedCount ? `Saved ${savedCount}` : 'Stored'}
        </span>
      </div>
      {conflicts.map(c => (
        <div key={c.key} className="mt-3 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text">
          <p className="m-0">
            <span className="font-mono text-11">{c.key}</span> was saved again after you loaded it. It is now “{c.current.label}”
            {c.current.message ? ` with the message “${c.current.message}”` : ' with no message'}. Reload to take that, or save
            yours over it.
          </p>
          <div className="mt-2 flex gap-3">
            <button type="button" className={PBTN} onClick={() => reloadConflict(c)}>
              Reload
            </button>
            <button type="button" className={PBTN} onClick={() => save({ [c.key]: c.current.updatedAt ?? undefined })}>
              Save anyway
            </button>
          </div>
        </div>
      ))}
      {error && <p className="mt-2 text-12 text-negative">{error}</p>}

      {!readOnly && (
        <section className="mt-6 max-w-[80ch] border border-border-strong bg-surface p-3">
          <h3 className="m-0 text-13 font-bold text-text">A scheme of your own</h3>
          <p className="m-0 mb-3 text-11 text-text-faint">
            A key (fixed once stored), a name, how the check is made, and the sentence a refused visitor reads. The check
            cannot be changed later: remove the scheme and make it again.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <label className={LABEL}>
              Key
              <input
                type="text"
                value={adding.key}
                spellCheck={false}
                placeholder="moderators"
                aria-label="Key of the new scheme"
                className={`${FIELD} font-mono text-11`}
                onChange={e => setAdding(a => ({ ...a, key: e.target.value.trim().toLowerCase() }))}
              />
            </label>
            <label className={LABEL}>
              Name
              <input
                type="text"
                value={adding.label}
                maxLength={AUTHZ_LABEL_MAX}
                aria-label="Name of the new scheme"
                className={FIELD}
                onChange={e => setAdding(a => ({ ...a, label: e.target.value }))}
              />
            </label>
            <label className={LABEL}>
              Check
              <select
                value={adding.type}
                aria-label="Check of the new scheme"
                className={FIELD}
                onChange={e => setAdding(a => ({ ...a, type: e.target.value as NewScheme['type'], value: '' }))}
              >
                {NEW_TYPES.map(t => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              {needs ? `Needs ${needs}` : 'Needs nothing more'}
              <input
                type="text"
                value={adding.value}
                disabled={!needs}
                spellCheck={false}
                aria-label="Value of the new scheme"
                className={`${FIELD} font-mono text-11`}
                onChange={e => setAdding(a => ({ ...a, value: e.target.value }))}
              />
            </label>
            <label className={`${LABEL} md:col-span-2`}>
              Message a refused visitor reads
              <input
                type="text"
                value={adding.message}
                maxLength={AUTHZ_MESSAGE_MAX}
                placeholder="No message: a refused page answers the 404, a refused entry or region shows nothing"
                aria-label="Message of the new scheme"
                className={FIELD}
                onChange={e => setAdding(a => ({ ...a, message: e.target.value }))}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className={TB_PRIMARY} disabled={addBusy || Boolean(addProblem)} onClick={() => void add()}>
              {addBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {addBusy ? 'Adding…' : 'Add scheme'}
            </button>
            <span className={`font-mono text-9 uppercase tracking-[0.1em] ${addError || (addTouched && addProblem) ? 'text-negative' : 'text-text-faint'}`}>
              {addError ?? (addTouched ? (addProblem ?? 'ready') : 'key, name, check')}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
