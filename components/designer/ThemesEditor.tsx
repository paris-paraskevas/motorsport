'use client';

import { useState } from 'react';
import { Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  SHIPPED_THEMES,
  THEME_LABEL_MAX,
  THEME_TOKEN_KEYS,
  THEME_TOKEN_LABELS,
  contrastProblems,
  parseThemeTokens,
  shippedTheme,
  themeContrast,
  type ShippedThemeKey,
  type ThemeTokenKey,
  type ThemeTokens,
} from '@/lib/design/theme-defaults';
import { formatRatio, isHexColour } from '@/lib/design/contrast';
import type { EditableTheme } from '@/lib/design/themes';
import { Swatch } from '@/components/theme/ThemePicker';

// Themes (APEX: Themes): the six looks the site ships and the operator's own,
// as cards. A shipped theme offers two things: whether visitors may pick it and
// whether it is the default for everyone. A theme of the operator's own adds a
// name, the shipped theme it builds on, nine colours with a live preview and the
// contrast gate, and Delete. Save writes creates, then the default, then edits,
// then deletes, each through its own route with the stamp that was loaded; a row
// that moved comes back as a conflict with Reload. Nothing here can type CSS: a
// theme is a base plus nine colours.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-[12px] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'border border-border-strong bg-bg px-2 py-1 text-[12.5px] leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';

interface CustomDraft {
  /** A client id, stable across renders; the key once the row exists. */
  id: string;
  key: string | null;
  label: string;
  base: ShippedThemeKey;
  tokens: Record<ThemeTokenKey, string>;
  available: boolean;
  deleted: boolean;
  updatedAt: string | null;
}

let seq = 0;
const newId = () => `new-${++seq}`;

function customDraftOf(t: EditableTheme): CustomDraft {
  return { id: t.key, key: t.key, label: t.label, base: t.base ?? 'paper', tokens: { ...t.tokens }, available: t.available, deleted: false, updatedAt: t.updatedAt };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function ThemesEditor({
  themes,
  readOnly,
  onSaved,
}: {
  themes: EditableTheme[];
  readOnly: boolean;
  onSaved: (themes: EditableTheme[]) => void;
}) {
  const storedDefault = themes.find(t => t.isDefault)?.key ?? 'paper';
  const [defaultKey, setDefaultKey] = useState(storedDefault);
  const [shippedAvailable, setShippedAvailable] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(themes.filter(t => t.shipped).map(t => [t.key, t.available])),
  );
  const [customs, setCustoms] = useState<CustomDraft[]>(() => themes.filter(t => !t.shipped).map(customDraftOf));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [conflict, setConflict] = useState<EditableTheme[] | null>(null);

  // New rows from the server replace the draft (adjusted during render, React's
  // own pattern for state that follows a prop).
  const [seen, setSeen] = useState(themes);
  if (themes !== seen) {
    setSeen(themes);
    setDefaultKey(themes.find(t => t.isDefault)?.key ?? 'paper');
    setShippedAvailable(Object.fromEntries(themes.filter(t => t.shipped).map(t => [t.key, t.available])));
    setCustoms(themes.filter(t => !t.shipped).map(customDraftOf));
    setConflict(null);
    setError(null);
  }

  const shipped = themes.filter(t => t.shipped);
  const storedCustom = new Map(themes.filter(t => !t.shipped).map(t => [t.key, t]));
  const canSave = shipped.every(t => t.updatedAt !== null);

  // What Save would do, in the order it does it. Plain arithmetic on the drafts,
  // cheap enough to run every render.
  const edited = (c: CustomDraft) => {
    if (c.key === null || c.deleted) return false;
    const s = storedCustom.get(c.key);
    return !!s && !(same(c.tokens, s.tokens) && c.label.trim() === s.label && c.base === s.base && c.available === s.available);
  };
  const work = {
    creates: customs.filter(c => c.key === null && !c.deleted),
    deletes: customs.filter(c => c.key !== null && c.deleted),
    edits: customs.filter(edited),
    shippedEdits: shipped.filter(t => shippedAvailable[t.key] !== undefined && shippedAvailable[t.key] !== t.available),
    defaultChange: defaultKey !== storedDefault,
    count: 0,
  };
  work.count = work.creates.length + work.deletes.length + work.edits.length + work.shippedEdits.length + (work.defaultChange ? 1 : 0);

  const problemsOf = (c: CustomDraft): string[] => {
    const out: string[] = [];
    if (!c.label.trim()) out.push('needs a name');
    if (c.label.length > THEME_LABEL_MAX) out.push(`name over ${THEME_LABEL_MAX} characters`);
    const tokens = parseThemeTokens(c.tokens);
    if (!tokens) out.push('every colour must be #rrggbb');
    else out.push(...contrastProblems(tokens));
    return out;
  };
  const live = (c: CustomDraft) => !c.deleted;
  const invalid = customs.some(c => live(c) && problemsOf(c).length > 0);
  const defaultAvailable = (() => {
    const s = shipped.find(t => t.key === defaultKey);
    if (s) return shippedAvailable[s.key] !== false;
    const c = customs.find(x => x.key === defaultKey || x.id === defaultKey);
    return !!c && !c.deleted && c.available;
  })();

  function updateCustom(id: string, patch: Partial<CustomDraft>) {
    setCustoms(list => list.map(c => (c.id === id ? { ...c, ...patch } : c)));
  }
  function addTheme() {
    const base = shippedTheme('paper');
    setCustoms(list => [
      ...list,
      { id: newId(), key: null, label: 'New theme', base: base.key, tokens: { ...base.tokens }, available: true, deleted: false, updatedAt: null },
    ]);
  }
  function discard() {
    setDefaultKey(storedDefault);
    setShippedAvailable(Object.fromEntries(shipped.map(t => [t.key, t.available])));
    setCustoms(themes.filter(t => !t.shipped).map(customDraftOf));
    setError(null);
  }

  async function save() {
    if (busy || readOnly || !canSave) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    setConflict(null);
    let done = 0;
    const headers = { 'content-type': 'application/json' };
    const fail = async (res: Response, what: string): Promise<boolean> => {
      if (res.status === 409) {
        const d = (await res.json().catch(() => ({}))) as { current?: EditableTheme[] | null };
        setConflict(d.current ?? []);
        return true;
      }
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(`${what}: ${d.error ?? `failed (${res.status})`}`);
      return true;
    };
    try {
      // Creates first, so a new theme can become the default below.
      const createdKeys = new Map<string, string>();
      for (const c of work.creates) {
        const res = await fetch('/api/admin/design/themes', {
          method: 'POST',
          headers,
          body: JSON.stringify({ label: c.label.trim(), base: c.base, tokens: c.tokens, available: c.available }),
        });
        if (!res.ok) {
          if (await fail(res, c.label.trim() || 'new theme')) return;
        }
        const d = (await res.json()) as { theme: EditableTheme };
        createdKeys.set(c.id, d.theme.key);
        done += 1;
      }
      if (work.defaultChange) {
        const key = createdKeys.get(defaultKey) ?? defaultKey;
        const stamp = themes.find(t => t.key === storedDefault)?.updatedAt ?? null;
        const res = await fetch('/api/admin/design/themes/default', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ key, updatedAt: stamp }),
        });
        if (!res.ok) {
          if (await fail(res, 'default')) return;
        }
        done += 1;
      }
      for (const t of work.shippedEdits) {
        const res = await fetch(`/api/admin/design/themes/${t.key}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ available: shippedAvailable[t.key], updatedAt: t.updatedAt }),
        });
        if (!res.ok) {
          if (await fail(res, t.label)) return;
        }
        done += 1;
      }
      for (const c of work.edits) {
        const res = await fetch(`/api/admin/design/themes/${c.key}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ label: c.label.trim(), base: c.base, tokens: c.tokens, available: c.available, updatedAt: c.updatedAt }),
        });
        if (!res.ok) {
          if (await fail(res, c.label.trim())) return;
        }
        done += 1;
      }
      for (const c of work.deletes) {
        const res = await fetch(`/api/admin/design/themes/${c.key}`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ updatedAt: c.updatedAt }),
        });
        if (!res.ok) {
          if (await fail(res, c.label.trim())) return;
        }
        done += 1;
      }
      const fresh = await fetch('/api/admin/design/themes', { cache: 'no-store' });
      if (fresh.ok) {
        const d = (await fresh.json()) as { themes: EditableTheme[] };
        onSaved(d.themes);
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
      <h2 className="m-0 mb-1 text-[20px] font-bold text-text">Themes</h2>
      <p className="m-0 mb-4 max-w-[76ch] text-[13px] text-text-muted">
        The looks the site offers. Pick the one a visitor sees before choosing their own (a visitor’s own choice always
        wins), hide a look from the picker, or add one of your own: a shipped theme as its base and nine colours of yours,
        checked for contrast before they can be saved. The six shipped themes keep their colours in the code.
      </p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {shipped.map(t => {
          const isDefault = defaultKey === t.key;
          const offered = shippedAvailable[t.key] !== false;
          const disabled = readOnly || !canSave;
          return (
            <div key={t.key} className="grid content-start gap-2 border border-border-strong bg-surface p-3">
              <Swatch theme={t} />
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold text-text">{t.label}</div>
                  <div className="text-[11px] text-text-faint">{t.hint}</div>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">shipped</span>
              </div>
              <ThemeSwitches
                isDefault={isDefault}
                offered={offered}
                disabled={disabled}
                onDefault={() => {
                  setDefaultKey(t.key);
                  setShippedAvailable(s => ({ ...s, [t.key]: true }));
                }}
                onOffered={v => setShippedAvailable(s => ({ ...s, [t.key]: v }))}
              />
              {t.updatedAt === null && <span className="text-[9px] uppercase text-text-faint">no row yet</span>}
            </div>
          );
        })}

        {customs.filter(live).map(c => {
          const isDefault = defaultKey === (c.key ?? c.id);
          const problems = problemsOf(c);
          const tokens = parseThemeTokens(c.tokens);
          const base = shippedTheme(c.base);
          const s = c.key ? storedCustom.get(c.key) : undefined;
          const changed = !s || !(same(c.tokens, s.tokens) && c.label.trim() === s.label && c.base === s.base && c.available === s.available);
          return (
            <div key={c.id} className="grid content-start gap-2 border border-edit/60 bg-surface p-3">
              <Swatch theme={{ tokens: tokens ?? base.tokens, family: base.family }} />
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={c.label}
                  disabled={readOnly}
                  aria-label={c.key ? `Name of ${c.key}` : 'Name of the new theme'}
                  className={`${FIELD} min-w-0 flex-1 font-semibold`}
                  onChange={e => updateCustom(c.id, { label: e.target.value })}
                />
                <button
                  type="button"
                  className={`${PBTN} hover:border-negative hover:text-negative`}
                  disabled={readOnly || isDefault}
                  title={isDefault ? 'The default cannot be deleted; choose another default first' : 'Delete this theme'}
                  onClick={() => (c.key ? updateCustom(c.id, { deleted: true }) : setCustoms(list => list.filter(x => x.id !== c.id)))}
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-faint">
                <label className="inline-flex items-center gap-1.5">
                  built on
                  <select
                    value={c.base}
                    disabled={readOnly}
                    aria-label={`Base of ${c.label || 'the new theme'}`}
                    className={`${FIELD} py-0.5`}
                    onChange={e => updateCustom(c.id, { base: e.target.value as ShippedThemeKey })}
                  >
                    {SHIPPED_THEMES.map(t => (
                      <option key={t.key} value={t.key}>
                        {t.label} ({t.family})
                      </option>
                    ))}
                  </select>
                </label>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em]">
                  {c.key ?? 'new'}
                  {changed && c.key && <span className="ml-1.5 text-edit">changed</span>}
                </span>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
                {THEME_TOKEN_KEYS.map(k => {
                  const v = c.tokens[k];
                  const ok = isHexColour(v);
                  return (
                    <label key={k} className="contents">
                      <span className="self-center text-[11px] text-text-muted">
                        {THEME_TOKEN_LABELS[k].label}
                        <span className="text-text-faint"> · {THEME_TOKEN_LABELS[k].paints}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="color"
                          value={ok ? v : '#000000'}
                          disabled={readOnly}
                          aria-label={`${THEME_TOKEN_LABELS[k].label} colour of ${c.label || 'the new theme'}`}
                          className="h-7 w-8 cursor-pointer border border-border-strong bg-bg p-0.5 disabled:cursor-default"
                          onChange={e => updateCustom(c.id, { tokens: { ...c.tokens, [k]: e.target.value } })}
                        />
                        <input
                          type="text"
                          value={v}
                          disabled={readOnly}
                          spellCheck={false}
                          aria-label={`${THEME_TOKEN_LABELS[k].label} of ${c.label || 'the new theme'} as #rrggbb`}
                          className={`${FIELD} w-[5.5rem] font-mono text-[11px] ${ok ? '' : 'border-negative'}`}
                          onChange={e => updateCustom(c.id, { tokens: { ...c.tokens, [k]: e.target.value.trim().toLowerCase() } })}
                        />
                      </span>
                    </label>
                  );
                })}
              </div>

              {tokens && <Preview tokens={tokens} />}

              <ul className="m-0 grid list-none gap-0.5 p-0 font-mono text-[9px] uppercase tracking-[0.1em]">
                {(tokens ? themeContrast(tokens) : []).map(r => (
                  <li key={r.id} className={`flex justify-between ${r.pass ? 'text-text-faint' : 'text-negative'}`}>
                    <span>{r.label}</span>
                    <span className="tabular-nums">
                      {formatRatio(r.ratio)} {r.pass ? '· ok' : `· below ${formatRatio(r.min)}`}
                    </span>
                  </li>
                ))}
                {!tokens && <li className="text-negative">every colour must be #rrggbb</li>}
                {!c.label.trim() && <li className="text-negative">needs a name</li>}
              </ul>

              <ThemeSwitches
                isDefault={isDefault}
                offered={c.available}
                disabled={readOnly || problems.length > 0}
                onDefault={() => {
                  setDefaultKey(c.key ?? c.id);
                  updateCustom(c.id, { available: true });
                }}
                onOffered={v => updateCustom(c.id, { available: v })}
              />
            </div>
          );
        })}

        {!readOnly && (
          <button
            type="button"
            className="grid min-h-[120px] place-items-center border border-dashed border-border-strong text-[12px] text-text-muted hover:border-edit hover:text-text"
            onClick={addTheme}
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus size={14} /> Add a theme
            </span>
          </button>
        )}
      </div>

      {customs.some(c => c.key && c.deleted) && (
        <p className="mt-3 text-[12px] text-text-muted">
          To be deleted on Save: {customs.filter(c => c.key && c.deleted).map(c => c.label).join(', ')}.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={TB_PRIMARY}
          disabled={busy || readOnly || !canSave || work.count === 0 || invalid || !defaultAvailable}
          onClick={() => void save()}
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          {busy ? 'Saving…' : work.count > 1 ? `Save ${work.count} changes` : 'Save'}
        </button>
        {work.count > 0 && !busy && (
          <button type="button" className={TB} onClick={discard}>
            <RotateCcw size={13} /> Discard changes
          </button>
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
          {!canSave
            ? 'the theme rows are not seeded yet'
            : work.count > 0
              ? `${work.count} unsaved${invalid ? ' · a theme fails its checks' : !defaultAvailable ? ' · the default must be offered' : ''}`
              : saved
                ? `Saved ${saved} · the site picks it up within a minute`
                : 'Stored'}
        </span>
      </div>
      {conflict && (
        <div className="mt-3 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-[12px] text-text">
          <p className="m-0">
            The themes were saved again after you loaded them. Reload to see what is stored now; your unsaved changes
            are dropped, because a theme is a whole and not a field.
          </p>
          <div className="mt-2 flex gap-3">
            <button type="button" className={PBTN} onClick={() => onSaved(conflict)}>
              Reload
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-negative">{error}</p>}
    </div>
  );
}

function ThemeSwitches({
  isDefault,
  offered,
  disabled,
  onDefault,
  onOffered,
}: {
  isDefault: boolean;
  offered: boolean;
  disabled: boolean;
  onDefault: () => void;
  onOffered: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
      <label className={`inline-flex items-center gap-1.5 ${disabled ? 'opacity-60' : 'cursor-pointer'} ${isDefault ? 'text-text' : 'text-text-muted'}`}>
        <input type="radio" name="default-theme" checked={isDefault} disabled={disabled} className="accent-(--edit)" onChange={onDefault} />
        Default for everyone
      </label>
      <label
        className={`inline-flex items-center gap-1.5 ${disabled || isDefault ? 'opacity-60' : 'cursor-pointer'} ${offered ? 'text-text' : 'text-text-muted'}`}
        title={isDefault ? 'The default is always offered' : undefined}
      >
        <input
          type="checkbox"
          checked={offered}
          disabled={disabled || isDefault}
          className="accent-(--edit)"
          onChange={e => onOffered(e.target.checked)}
        />
        Offered to visitors
      </label>
    </div>
  );
}

/** A small page in the theme's own colours, so a change is seen before it is saved. */
function Preview({ tokens: t }: { tokens: ThemeTokens }) {
  return (
    <div aria-hidden="true" className="text-[12px]" style={{ background: t.bg, color: t.text, border: `1px solid ${t.borderStrong}` }}>
      <div className="flex items-center justify-between px-2 py-1.5" style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
          Paddock<span style={{ color: t.accent }}>•</span>Tracker
        </span>
        <span className="text-[11px]" style={{ color: t.textMuted }}>
          Calendar · Learn · Series
        </span>
      </div>
      <div className="p-2">
        <div className="font-semibold">Italian Grand Prix</div>
        <div style={{ color: t.textMuted }}>Qualifying starts in 2 h 14 min.</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: t.textFaint }}>
          Sat 6 Sep · 16:00
        </div>
        <div className="mt-2 flex justify-between p-2" style={{ background: t.surfaceElevated, border: `1px solid ${t.border}` }}>
          <span>Antonelli</span>
          <span className="font-mono tabular-nums">267</span>
        </div>
        <span className="mt-2 inline-block underline" style={{ color: t.accent }}>
          Full standings
        </span>
      </div>
    </div>
  );
}
