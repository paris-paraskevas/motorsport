'use client';

import { useMemo, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { TEXT_MAX, type TextKey } from '@/lib/design/text-defaults';
import type { EditableText } from '@/lib/design/text';

// Text Messages (APEX: Text Messages): the chrome's fixed strings in a table,
// key, where shown, the text; Save writes every changed row through its own
// conditional update, and a row that moved since it was loaded comes back as a
// conflict with Reload or Save anyway. A message with no row yet shows the
// shipped text and cannot be saved until the migration has seeded it.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';

type Conflict = { key: TextKey; current: EditableText };

export function TextEditor({
  messages,
  readOnly,
  onSaved,
}: {
  messages: EditableText[];
  readOnly: boolean;
  onSaved: (messages: EditableText[]) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(messages.map(m => [m.key, m.text])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // New rows from the server replace the draft (adjusted during render, React's
  // own pattern for state that follows a prop).
  const [seen, setSeen] = useState(messages);
  if (messages !== seen) {
    setSeen(messages);
    setDraft(Object.fromEntries(messages.map(m => [m.key, m.text])));
    setConflicts([]);
    setError(null);
  }

  const changed = useMemo(
    () => messages.filter(m => (draft[m.key] ?? '').trim() !== m.text && m.updatedAt !== null),
    [messages, draft],
  );
  const invalid = useMemo(
    () => messages.filter(m => !(draft[m.key] ?? '').trim() || (draft[m.key] ?? '').length > TEXT_MAX),
    [messages, draft],
  );

  async function save(overrides: Partial<Record<TextKey, string>> = {}) {
    if (busy || readOnly) return;
    setBusy(true);
    setError(null);
    setSavedCount(null);
    setConflicts([]);
    const next = messages.map(m => ({ ...m }));
    const newConflicts: Conflict[] = [];
    let saved = 0;
    try {
      for (const m of changed) {
        const expected = overrides[m.key] ?? m.updatedAt;
        if (!expected) continue;
        const res = await fetch(`/api/admin/design/text/${m.key}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: draft[m.key], updatedAt: expected }),
        });
        if (res.status === 409) {
          const d = (await res.json().catch(() => ({}))) as { current?: EditableText[] | null };
          const current = d.current?.find(c => c.key === m.key);
          if (current) newConflicts.push({ key: m.key, current });
          else setError(`${m.key}: saved again after you loaded it. Reload the page.`);
          continue;
        }
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          setError(`${m.key}: ${d.error ?? `failed (${res.status})`}`);
          break;
        }
        const d = (await res.json()) as { text: string; updatedAt: string };
        const idx = next.findIndex(n => n.key === m.key);
        next[idx] = { ...next[idx], text: d.text, updatedAt: d.updatedAt };
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
    const next = messages.map(m => (m.key === c.key ? c.current : m));
    onSaved(next);
  }

  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Text Messages</h2>
      <p className="m-0 mb-4 max-w-[70ch] text-13 text-text-muted">
        The fixed strings the chrome shows, editable without a deploy. Each row says where its words appear; a blank
        or an over-long text is refused, and the site keeps the shipped words for anything it cannot use.
      </p>

      <div className="border border-border-strong bg-surface">
        <table className="w-full border-collapse text-12">
          <thead>
            <tr className="text-left text-text-faint">
              <th className="w-44 px-2.5 py-2 font-semibold">Key</th>
              <th className="w-72 px-2.5 py-2 font-semibold">Where shown</th>
              <th className="px-2.5 py-2 font-semibold">Text</th>
            </tr>
          </thead>
          <tbody>
            {messages.map(m => {
              const value = draft[m.key] ?? '';
              const long = m.key === 'footer.blurb';
              const isChanged = value.trim() !== m.text;
              const bad = !value.trim() || value.length > TEXT_MAX;
              return (
                <tr key={m.key} className="border-t border-border align-top">
                  <td className="px-2.5 py-2 font-mono text-11 text-text-muted">
                    {m.key}
                    {m.updatedAt === null && <span className="mt-1 block text-9 uppercase text-text-faint">no row yet</span>}
                    {isChanged && m.updatedAt !== null && <span className="mt-1 block text-9 uppercase text-edit">changed</span>}
                  </td>
                  <td className="px-2.5 py-2 text-text-muted">{m.where}</td>
                  <td className="px-2.5 py-2">
                    {long ? (
                      <textarea
                        value={value}
                        rows={3}
                        disabled={readOnly || m.updatedAt === null}
                        aria-label={`Text of ${m.key}`}
                        className={`${FIELD} resize-y`}
                        onChange={e => setDraft(d => ({ ...d, [m.key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        type="text"
                        value={value}
                        disabled={readOnly || m.updatedAt === null}
                        aria-label={`Text of ${m.key}`}
                        className={FIELD}
                        onChange={e => setDraft(d => ({ ...d, [m.key]: e.target.value }))}
                      />
                    )}
                    <div className="mt-1 flex justify-between font-mono text-9 text-text-faint">
                      <span className={bad ? 'text-negative' : ''}>
                        {!value.trim() ? 'cannot be empty' : value.length > TEXT_MAX ? `over ${TEXT_MAX} characters` : ''}
                      </span>
                      <span className="tabular-nums">
                        {value.length} / {TEXT_MAX}
                      </span>
                    </div>
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
          {busy ? 'Saving…' : changed.length > 1 ? `Save ${changed.length} messages` : 'Save'}
        </button>
        {changed.length > 0 && !busy && (
          <button
            type="button"
            className={TB}
            onClick={() => setDraft(Object.fromEntries(messages.map(m => [m.key, m.text])))}
          >
            <RotateCcw size={13} /> Discard changes
          </button>
        )}
        <span className="font-mono text-10 uppercase tracking-[0.12em] text-text-faint">
          {changed.length > 0
            ? `${changed.length} unsaved`
            : savedCount
              ? `Saved ${savedCount} · the site picks it up within a minute`
              : 'Stored'}
        </span>
      </div>
      {conflicts.map(c => (
        <div key={c.key} className="mt-3 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text">
          <p className="m-0">
            <span className="font-mono text-11">{c.key}</span> was saved again after you loaded it. It now reads: “{c.current.text}”.
            Reload to take that, or save yours over it.
          </p>
          <div className="mt-2 flex gap-3">
            <button type="button" className={PBTN} onClick={() => reloadConflict(c)}>
              Reload
            </button>
            <button
              type="button"
              className={PBTN}
              onClick={() => save({ [c.key]: c.current.updatedAt ?? undefined })}
            >
              Save anyway
            </button>
          </div>
        </div>
      ))}
      {error && <p className="mt-2 text-12 text-negative">{error}</p>}
    </div>
  );
}
