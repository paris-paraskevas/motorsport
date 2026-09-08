'use client';

import { useMemo, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import {
  BUILD_OPTION_DEFAULTS,
  BUILD_OPTION_STATUSES,
  type BuildOptionKey,
  type BuildOptionStatus,
} from '@/lib/design/build-option-defaults';
import type { EditableBuildOption } from '@/lib/design/build-options';

// Build Options (APEX: Build Options): the feature switches in a table, the
// option, what it switches, Include or Exclude; Save writes every changed row
// through its own conditional update, and a row that moved since it was loaded
// comes back as a conflict with Reload or Save anyway. An option the site does
// not honour yet says so on its row and saves like the others, so the setting
// is in place when its gate arrives. A row that does not exist yet shows
// Include and cannot be saved.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-[12px] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';

const STATUS_LABEL: Record<BuildOptionStatus, string> = { include: 'Include', exclude: 'Exclude' };

type Conflict = { key: BuildOptionKey; current: EditableBuildOption };

export function BuildOptionsEditor({
  options,
  readOnly,
  onSaved,
}: {
  options: EditableBuildOption[];
  readOnly: boolean;
  onSaved: (options: EditableBuildOption[]) => void;
}) {
  const [draft, setDraft] = useState<Record<string, BuildOptionStatus>>(() =>
    Object.fromEntries(options.map(o => [o.key, o.status])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // New rows from the server replace the draft (adjusted during render, React's
  // own pattern for state that follows a prop).
  const [seen, setSeen] = useState(options);
  if (options !== seen) {
    setSeen(options);
    setDraft(Object.fromEntries(options.map(o => [o.key, o.status])));
    setConflicts([]);
    setError(null);
  }

  const changed = useMemo(
    () => options.filter(o => (draft[o.key] ?? o.status) !== o.status && o.updatedAt !== null),
    [options, draft],
  );

  async function save(overrides: Partial<Record<BuildOptionKey, string>> = {}) {
    if (busy || readOnly) return;
    setBusy(true);
    setError(null);
    setSavedCount(null);
    setConflicts([]);
    const next = options.map(o => ({ ...o }));
    const newConflicts: Conflict[] = [];
    let saved = 0;
    try {
      for (const o of changed) {
        const expected = overrides[o.key] ?? o.updatedAt;
        if (!expected) continue;
        const res = await fetch(`/api/admin/design/build-options/${o.key}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: draft[o.key], updatedAt: expected }),
        });
        if (res.status === 409) {
          const d = (await res.json().catch(() => ({}))) as { current?: EditableBuildOption[] | null };
          const current = d.current?.find(c => c.key === o.key);
          if (current) newConflicts.push({ key: o.key, current });
          else setError(`${o.key}: saved again after you loaded it. Reload the page.`);
          continue;
        }
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          setError(`${o.key}: ${d.error ?? `failed (${res.status})`}`);
          break;
        }
        const d = (await res.json()) as { status: BuildOptionStatus; updatedAt: string };
        const idx = next.findIndex(n => n.key === o.key);
        next[idx] = { ...next[idx], status: d.status, updatedAt: d.updatedAt };
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
    const next = options.map(o => (o.key === c.key ? c.current : o));
    onSaved(next);
  }

  return (
    <div>
      <h2 className="m-0 mb-1 text-[20px] font-bold text-text">Build Options</h2>
      <p className="m-0 mb-4 max-w-[70ch] text-[13px] text-text-muted">
        Feature switches. Exclude hides a feature everywhere without a deploy; Include brings it back. The site keeps
        a feature on for anything it cannot read, so a database problem can never hide one.
      </p>

      <div className="border border-border-strong bg-surface">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-text-faint">
              <th className="w-44 px-2.5 py-2 font-semibold">Option</th>
              <th className="px-2.5 py-2 font-semibold">What it switches</th>
              <th className="w-56 px-2.5 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {options.map(o => {
              const value = draft[o.key] ?? o.status;
              const isChanged = value !== o.status;
              const meta = BUILD_OPTION_DEFAULTS[o.key];
              const disabled = readOnly || o.updatedAt === null;
              return (
                <tr key={o.key} className="border-t border-border align-top">
                  <td className="px-2.5 py-2">
                    <div className="text-text">{o.label}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-text-muted">{o.key}</div>
                    {o.updatedAt === null && <span className="mt-1 block text-[9px] uppercase text-text-faint">no row yet</span>}
                    {isChanged && o.updatedAt !== null && <span className="mt-1 block text-[9px] uppercase text-edit">changed</span>}
                  </td>
                  <td className="px-2.5 py-2 text-text-muted">
                    {meta.switches}
                    {!meta.wired && (
                      <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">not wired yet</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    <div role="radiogroup" aria-label={`Status of ${o.label}`} className="flex flex-wrap gap-x-4 gap-y-1">
                      {BUILD_OPTION_STATUSES.map(status => (
                        <label
                          key={status}
                          className={`inline-flex items-center gap-1.5 ${disabled ? 'opacity-60' : 'cursor-pointer'} ${
                            value === status ? 'text-text' : 'text-text-muted'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`status-${o.key}`}
                            value={status}
                            checked={value === status}
                            disabled={disabled}
                            className="accent-(--edit)"
                            onChange={() => setDraft(d => ({ ...d, [o.key]: status }))}
                          />
                          {STATUS_LABEL[status]}
                        </label>
                      ))}
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
          disabled={busy || readOnly || changed.length === 0}
          onClick={() => save()}
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          {busy ? 'Saving…' : changed.length > 1 ? `Save ${changed.length} options` : 'Save'}
        </button>
        {changed.length > 0 && !busy && (
          <button
            type="button"
            className={TB}
            onClick={() => setDraft(Object.fromEntries(options.map(o => [o.key, o.status])))}
          >
            <RotateCcw size={13} /> Discard changes
          </button>
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
          {changed.length > 0
            ? `${changed.length} unsaved`
            : savedCount
              ? `Saved ${savedCount} · the site picks it up within a minute`
              : 'Stored'}
        </span>
      </div>
      {conflicts.map(c => (
        <div key={c.key} className="mt-3 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-[12px] text-text">
          <p className="m-0">
            <span className="font-mono text-[11px]">{c.key}</span> was saved again after you loaded it. It is now{' '}
            {STATUS_LABEL[c.current.status]}. Reload to take that, or save yours over it.
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
      {error && <p className="mt-2 text-[12px] text-negative">{error}</p>}
    </div>
  );
}
