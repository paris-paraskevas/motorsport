'use client';

import { useMemo, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { AUTHZ_LABEL_MAX, AUTHZ_MESSAGE_MAX, describeAuthzCheck } from '@/lib/design/authz-defaults';
import type { EditableAuthzScheme } from '@/lib/design/authz';

// Authorization Schemes (APEX: Authorization Schemes): the rules an entry, a box
// or a page can require, in a table: the scheme with its label editable, how the
// check is made (code's, shown), and the message a refused visitor reads. Save
// writes every changed row through its own conditional update, and a row that
// moved since it was loaded comes back as a conflict with Reload or Save anyway.
// Nothing enforces a scheme yet (Phase 3), and the page says so. A row that
// does not exist yet shows the shipped scheme and cannot be saved.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';

type Draft = { label: string; message: string };
type Conflict = { key: string; current: EditableAuthzScheme };

const draftOf = (schemes: EditableAuthzScheme[]): Record<string, Draft> =>
  Object.fromEntries(schemes.map(s => [s.key, { label: s.label, message: s.message ?? '' }]));
const storedDraft = (s: EditableAuthzScheme): Draft => ({ label: s.label, message: s.message ?? '' });
const isBad = (d: Draft) => !d.label.trim() || d.label.length > AUTHZ_LABEL_MAX || d.message.length > AUTHZ_MESSAGE_MAX;
const differs = (s: EditableAuthzScheme, d: Draft) => d.label.trim() !== s.label || d.message.trim() !== (s.message ?? '');

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

  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Authorization Schemes</h2>
      <p className="m-0 mb-4 max-w-[70ch] text-13 text-text-muted">
        The rules a navigation entry, a box or a page can require before a visitor sees it. How each check is made
        belongs to the code; the name and the message a refused visitor reads are yours. Enforced when pages and boxes
        arrive (Phase 3): until then, what you change here changes nothing a visitor sees.
      </p>

      <div className="border border-border-strong bg-surface">
        <table className="w-full border-collapse text-12">
          <thead>
            <tr className="text-left text-text-faint">
              <th className="w-64 px-2.5 py-2 font-semibold">Scheme</th>
              <th className="w-56 px-2.5 py-2 font-semibold">Check</th>
              <th className="px-2.5 py-2 font-semibold">Message a refused visitor reads</th>
            </tr>
          </thead>
          <tbody>
            {schemes.map(s => {
              const d = draftFor(s);
              const disabled = readOnly || s.updatedAt === null;
              const changedRow = isChanged(s);
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
                      {s.value ? ` · ${s.value}` : ''} · code
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
    </div>
  );
}
