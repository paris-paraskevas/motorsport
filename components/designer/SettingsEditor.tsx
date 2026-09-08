'use client';

import { useMemo, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import {
  SETTING_SPECS,
  parseSettingValue,
  settingValueRule,
  type SettingKey,
  type SettingValue,
} from '@/lib/design/setting-defaults';
import type { EditableSetting } from '@/lib/design/settings';
import { WHATS_NEW } from '@/lib/whats-new';

// Application Settings (APEX: Application Settings): the named values the site
// reads at render, in a table: the setting, what it changes, and its value in
// the control its kind calls for (a select over the real championships, a set of
// them, a bounded whole number, the known notices). Save writes every changed
// row through its own conditional update, and a row that moved since it was
// loaded comes back as a conflict with Reload or Save anyway. A row that does
// not exist yet shows the shipped value and cannot be saved.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';

export interface SeriesOption {
  slug: string;
  name: string;
}

type Conflict = { key: SettingKey; current: EditableSetting };

const same = (a: SettingValue, b: SettingValue) => JSON.stringify(a) === JSON.stringify(b);

/** A value as a person reads it, for the conflict banner. */
function describe(key: SettingKey, value: SettingValue, series: SeriesOption[]): string {
  const control = SETTING_SPECS[key].control;
  const nameOf = (slug: string) => series.find(s => s.slug === slug)?.name ?? slug;
  switch (control.kind) {
    case 'series':
      return nameOf(String(value));
    case 'series-set':
      return Array.isArray(value) && value.length > 0 ? value.map(nameOf).join(', ') : 'none';
    case 'integer':
      return String(value);
    case 'announcement': {
      if (value === '') return 'none';
      const entry = WHATS_NEW.find(e => e.id === value);
      return entry ? `${entry.version} · ${entry.title}` : String(value);
    }
  }
}

export function SettingsEditor({
  settings,
  series,
  readOnly,
  onSaved,
}: {
  settings: EditableSetting[];
  /** The championships the two series controls offer, from the server. */
  series: SeriesOption[];
  readOnly: boolean;
  onSaved: (settings: EditableSetting[]) => void;
}) {
  const sorted = useMemo(() => [...series].sort((a, b) => a.name.localeCompare(b.name)), [series]);
  const [draft, setDraft] = useState<Record<string, SettingValue>>(() =>
    Object.fromEntries(settings.map(s => [s.key, s.value])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // New rows from the server replace the draft (adjusted during render, React's
  // own pattern for state that follows a prop).
  const [seen, setSeen] = useState(settings);
  if (settings !== seen) {
    setSeen(settings);
    setDraft(Object.fromEntries(settings.map(s => [s.key, s.value])));
    setConflicts([]);
    setError(null);
  }

  const valueOf = (s: EditableSetting): SettingValue => draft[s.key] ?? s.value;
  const changed = useMemo(
    () => settings.filter(s => !same(draft[s.key] ?? s.value, s.value) && s.updatedAt !== null),
    [settings, draft],
  );
  // A number field can hold nothing, or a value outside its bounds, while a
  // person types; Save waits until every value passes the key's rule.
  const invalid = useMemo(
    () => settings.filter(s => parseSettingValue(s.key, draft[s.key] ?? s.value) === undefined),
    [settings, draft],
  );

  async function save(overrides: Partial<Record<SettingKey, string>> = {}) {
    if (busy || readOnly) return;
    setBusy(true);
    setError(null);
    setSavedCount(null);
    setConflicts([]);
    const next = settings.map(s => ({ ...s }));
    const newConflicts: Conflict[] = [];
    let saved = 0;
    try {
      for (const s of changed) {
        const expected = overrides[s.key] ?? s.updatedAt;
        if (!expected) continue;
        const res = await fetch(`/api/admin/design/settings/${s.key}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ value: valueOf(s), updatedAt: expected }),
        });
        if (res.status === 409) {
          const d = (await res.json().catch(() => ({}))) as { current?: EditableSetting[] | null };
          const current = d.current?.find(c => c.key === s.key);
          if (current) newConflicts.push({ key: s.key, current });
          else setError(`${s.key}: saved again after you loaded it. Reload the page.`);
          continue;
        }
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          setError(`${s.key}: ${d.error ?? `failed (${res.status})`}`);
          break;
        }
        const d = (await res.json()) as { value: SettingValue; updatedAt: string };
        const idx = next.findIndex(n => n.key === s.key);
        next[idx] = { ...next[idx], value: d.value, updatedAt: d.updatedAt };
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
    const next = settings.map(s => (s.key === c.key ? c.current : s));
    onSaved(next);
  }

  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Application Settings</h2>
      <p className="m-0 mb-4 max-w-[70ch] text-13 text-text-muted">
        Named values the site reads when it renders a page. Each row says what it changes; a value outside its rule is
        refused, and the site keeps the shipped value for anything it cannot read.
      </p>

      <div className="border border-border-strong bg-surface">
        <table className="w-full border-collapse text-12">
          <thead>
            <tr className="text-left text-text-faint">
              <th className="w-52 px-2.5 py-2 font-semibold">Setting</th>
              <th className="px-2.5 py-2 font-semibold">What it changes</th>
              <th className="w-[22rem] px-2.5 py-2 font-semibold">Value</th>
            </tr>
          </thead>
          <tbody>
            {settings.map(s => {
              const spec = SETTING_SPECS[s.key];
              const value = valueOf(s);
              const isChanged = !same(value, s.value);
              const ok = parseSettingValue(s.key, value) !== undefined;
              const disabled = readOnly || s.updatedAt === null;
              return (
                <tr key={s.key} className="border-t border-border align-top">
                  <td className="px-2.5 py-2">
                    <div className="text-text">{spec.label}</div>
                    <div className="mt-0.5 font-mono text-11 text-text-muted">{s.key}</div>
                    {s.updatedAt === null && <span className="mt-1 block text-9 uppercase text-text-faint">no row yet</span>}
                    {isChanged && s.updatedAt !== null && <span className="mt-1 block text-9 uppercase text-edit">changed</span>}
                  </td>
                  <td className="px-2.5 py-2 text-text-muted">
                    {s.description}
                    <span className="mt-1 block font-mono text-9 uppercase tracking-[0.12em] text-text-faint">
                      shipped: {describe(s.key, spec.shipped, sorted)}
                    </span>
                  </td>
                  <td className="px-2.5 py-2">
                    <Control
                      setting={s}
                      value={value}
                      disabled={disabled}
                      series={sorted}
                      onChange={v => setDraft(d => ({ ...d, [s.key]: v }))}
                    />
                    {!ok && (
                      <span className="mt-1 block font-mono text-9 uppercase tracking-[0.12em] text-negative">
                        {settingValueRule(s.key)}
                      </span>
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
          {busy ? 'Saving…' : changed.length > 1 ? `Save ${changed.length} settings` : 'Save'}
        </button>
        {changed.length > 0 && !busy && (
          <button
            type="button"
            className={TB}
            onClick={() => setDraft(Object.fromEntries(settings.map(s => [s.key, s.value])))}
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
            <span className="font-mono text-11">{c.key}</span> was saved again after you loaded it. It now reads:{' '}
            {describe(c.key, c.current.value, sorted)}. Reload to take that, or save yours over it.
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

/** The control a setting's kind calls for. Every kind offers only what the
 *  site can use, so a typed value can be wrong in bounds but never in shape. */
function Control({
  setting,
  value,
  disabled,
  series,
  onChange,
}: {
  setting: EditableSetting;
  value: SettingValue;
  disabled: boolean;
  series: SeriesOption[];
  onChange: (value: SettingValue) => void;
}) {
  const spec = SETTING_SPECS[setting.key];
  switch (spec.control.kind) {
    case 'series': {
      const current = String(value);
      const known = series.some(s => s.slug === current);
      return (
        <select
          value={current}
          disabled={disabled}
          aria-label={spec.label}
          className={`${FIELD} w-full`}
          onChange={e => onChange(e.target.value)}
        >
          {!known && <option value={current}>{current} (not a championship the site has)</option>}
          {series.map(s => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      );
    }
    case 'series-set': {
      const list = Array.isArray(value) ? value : [];
      const max = spec.control.max;
      return (
        <div role="group" aria-label={spec.label} className="grid grid-cols-2 gap-x-4 gap-y-1">
          {series.map(s => {
            const on = list.includes(s.slug);
            const full = !on && list.length >= max;
            return (
              <label
                key={s.slug}
                className={`inline-flex items-center gap-1.5 ${disabled || full ? 'opacity-60' : 'cursor-pointer'} ${
                  on ? 'text-text' : 'text-text-muted'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={disabled || full}
                  className="accent-(--edit)"
                  onChange={() => onChange(on ? list.filter(x => x !== s.slug) : [...list, s.slug])}
                />
                {s.name}
              </label>
            );
          })}
        </div>
      );
    }
    case 'integer': {
      const { min, max } = spec.control;
      const n = typeof value === 'number' ? value : Number.NaN;
      return (
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={Number.isFinite(n) ? String(n) : ''}
          disabled={disabled}
          aria-label={spec.label}
          className={`${FIELD} w-24 tabular-nums`}
          onChange={e => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
        />
      );
    }
    case 'announcement':
      return (
        <select
          value={String(value)}
          disabled={disabled}
          aria-label={spec.label}
          className={`${FIELD} w-full`}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">None: the notice stays hidden</option>
          {WHATS_NEW.map(e => (
            <option key={e.id} value={e.id}>
              {e.version} · {e.title}
            </option>
          ))}
        </select>
      );
  }
}
