'use client';

import { useCallback, useEffect, useState } from 'react';
import { THEME_LABEL_MAX, THEME_TOKEN_KEYS, THEME_TOKEN_LABELS, themeContrast, type ThemeTokenKey, type ThemeTokens } from '@/lib/design/theme-defaults';
import type { EditableTheme } from '@/lib/design/themes';
import { formatRatio, normaliseHex } from '@/lib/design/contrast';
import { applyPreview, clearPreview, editToken, isDirty, redo, resetTo, runningThemeKey, saveState, startRoller, switchTab, undo, type RollerState } from '@/lib/design/theme-roller';
import { record } from '@/lib/design/debug-client';
import type { Position } from './DeveloperToolbar';

// The Theme Roller (P1.8; APEX: the Developer Toolbar's Customize › Theme
// Roller, "a live CSS editor that enables you to quickly change the theme
// style, colors, rounded corners and other application attributes"; its dialog
// offers Undo, Redo, Save for an editable style, Save As and Reset). Ours edits
// the nine colours a theme of the operator's own stores (the operator's word of
// 2026-09-16: "the nine"), previews them on this tab alone, and saves through
// the routes the designer's Themes editor uses, through the same contrast gate.
// Docked to the right of the running page in the Debug panel's frame, so the
// page stays in view; loaded on demand by the toolbar. Custom CSS, Export and
// Import are not offered: the tokens-first decision.

const BTN = 'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const PRIMARY = `${BTN} border-brand text-brand hover:border-brand`;
const FIELD = 'border border-border-strong bg-transparent px-2 py-1 font-mono text-11 text-text';

type Listing = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; themes: EditableTheme[] };

export function ThemeRoller({ barPosition, onClose }: { barPosition: Position; onClose: () => void }) {
  const [listing, setListing] = useState<Listing>({ state: 'loading' });
  const [running, setRunning] = useState<EditableTheme | null>(null);
  const [stored, setStored] = useState<ThemeTokens | null>(null);
  const [roller, setRoller] = useState<RollerState | null>(null);
  // What is typed into a #rrggbb field before it is a colour.
  const [drafts, setDrafts] = useState<Partial<Record<ThemeTokenKey, string>>>({});
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const begin = (theme: EditableTheme) => {
    setRunning(theme);
    setStored(theme.tokens);
    setRoller(startRoller(theme.tokens));
    setDrafts({});
  };

  useEffect(() => {
    let live = true;
    fetch('/api/admin/design/themes', { cache: 'no-store' })
      .then(async r => {
        const d = (await r.json().catch(() => ({}))) as { themes?: EditableTheme[]; error?: string };
        if (!live) return;
        if (!r.ok || !Array.isArray(d.themes)) {
          setListing({ state: 'error', message: d.error ?? `The themes could not be read (${r.status})` });
          return;
        }
        const key = runningThemeKey(document.documentElement);
        const theme = d.themes.find(t => t.key === key) ?? d.themes.find(t => t.isDefault) ?? d.themes[0];
        if (!theme) {
          setListing({ state: 'error', message: 'There is no theme to edit' });
          return;
        }
        setListing({ state: 'ready', themes: d.themes });
        begin(theme);
        record('theme', `Theme Roller opened on ${theme.label}`);
      })
      .catch(() => {
        if (live) setListing({ state: 'error', message: 'Network error. Try again.' });
      });
    return () => {
      live = false;
    };
  }, []);

  // The preview follows every edit; the stored colours mean no preview at all.
  useEffect(() => {
    if (!roller || !stored) return;
    if (isDirty(roller, stored)) applyPreview(document.documentElement, roller.tokens);
    else clearPreview(document.documentElement);
  }, [roller, stored]);
  // Whatever closes the panel takes the preview with it.
  useEffect(() => () => clearPreview(document.documentElement), []);

  const close = useCallback(() => {
    clearPreview(document.documentElement);
    onClose();
  }, [onClose]);
  // Escape in the capture phase, stopped there: Quick Edit's own bubble-phase
  // listener never hears it, so the Roller closes alone (the Sheet's pattern).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [close]);

  const step = (fn: (s: RollerState) => RollerState) => {
    setRoller(s => (s ? fn(s) : s));
    setMessage(null);
  };
  const edit = (key: ThemeTokenKey, value: string) => step(s => editToken(s, key, value));
  const typeHex = (key: ThemeTokenKey, value: string) => {
    const hex = normaliseHex(value);
    if (hex) {
      edit(key, hex);
      setDrafts(d => {
        const next = { ...d };
        delete next[key];
        return next;
      });
    } else setDrafts(d => ({ ...d, [key]: value }));
  };
  const dropDraft = (key: ThemeTokenKey) =>
    setDrafts(d => {
      const next = { ...d };
      delete next[key];
      return next;
    });

  const themes = listing.state === 'ready' ? listing.themes : [];
  const nameOf = (key: string | null) => themes.find(t => t.key === key)?.label ?? key ?? '';
  const headers = { 'content-type': 'application/json' };
  const fail = (d: { error?: string; current?: EditableTheme[] }, res: Response, what: string) => {
    if (d.current) {
      setListing({ state: 'ready', themes: d.current });
      const fresh = running ? d.current.find(t => t.key === running.key) : undefined;
      if (fresh) setRunning(fresh);
    }
    setMessage(d.error ?? `${what} failed (${res.status})`);
  };

  async function saveAs() {
    if (!roller || !running || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/design/themes', {
        method: 'POST',
        headers,
        body: JSON.stringify({ label: label.trim(), base: running.base ?? running.key, tokens: roller.tokens, available: true }),
      });
      const d = (await res.json().catch(() => ({}))) as { theme?: EditableTheme; error?: string; current?: EditableTheme[] };
      if (!res.ok || !d.theme) {
        fail(d, res, 'Save as new theme');
        return;
      }
      const theme = d.theme;
      setListing(l => (l.state === 'ready' ? { state: 'ready', themes: [...l.themes, theme] } : l));
      switchTab(document, theme);
      begin(theme);
      setLabel('');
      setMessage(`Saved “${theme.label}” on ${nameOf(theme.base)}. This tab runs it now; visitors find it in the picker. Set as default makes it everyone’s start.`);
      record('theme', `Saved “${theme.label}” as a new theme on ${theme.base}`);
    } catch {
      setMessage('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!roller || !running || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/design/themes/${running.key}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ tokens: roller.tokens, updatedAt: running.updatedAt }),
      });
      const d = (await res.json().catch(() => ({}))) as { updatedAt?: string; error?: string; current?: EditableTheme[] };
      if (!res.ok || !d.updatedAt) {
        fail(d, res, 'Save');
        return;
      }
      const theme: EditableTheme = { ...running, tokens: roller.tokens, updatedAt: d.updatedAt };
      setListing(l => (l.state === 'ready' ? { state: 'ready', themes: l.themes.map(t => (t.key === theme.key ? theme : t)) } : l));
      switchTab(document, theme);
      begin(theme);
      setMessage(`Saved “${theme.label}”. This tab runs it; every visitor on it sees the colours within a minute.`);
      record('theme', `Saved “${theme.label}”`);
    } catch {
      setMessage('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function setDefault() {
    if (!running || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const stamp = themes.find(t => t.isDefault)?.updatedAt ?? null;
      const res = await fetch('/api/admin/design/themes/default', { method: 'PUT', headers, body: JSON.stringify({ key: running.key, updatedAt: stamp }) });
      const d = (await res.json().catch(() => ({}))) as { updatedAt?: string; error?: string; current?: EditableTheme[] };
      if (!res.ok || !d.updatedAt) {
        fail(d, res, 'Set as default');
        return;
      }
      const at = d.updatedAt;
      setListing(l => (l.state === 'ready' ? { state: 'ready', themes: l.themes.map(t => ({ ...t, isDefault: t.key === running.key, updatedAt: t.key === running.key ? at : t.updatedAt })) } : l));
      setRunning({ ...running, isDefault: true, updatedAt: at });
      setMessage(`“${running.label}” is the default: visitors who have not chosen get it from now on (within a minute on every server).`);
      record('theme', `“${running.label}” set as the default theme`);
    } catch {
      setMessage('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const dock = barPosition === 'right' ? 'right-16' : 'right-3';
  const can = roller && stored && running ? saveState(roller, stored, running, label) : null;
  const dirty = roller && stored ? isDirty(roller, stored) : false;
  const shown = listing.state === 'error' ? listing.message : can ? (can.problems.length > 0 ? can.reason : (message ?? can.reason)) : 'Reading the themes…';
  const negative = listing.state === 'error' || (can !== null && can.problems.length > 0);

  return (
    <section role="dialog" aria-label="Theme Roller" className={`fixed ${dock} top-3 z-40 flex max-h-[calc(100vh-88px)] w-[340px] max-w-[calc(100vw-24px)] flex-col border border-text/40 bg-bg text-text shadow-2xl`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2 font-mono text-10 uppercase tracking-[0.14em] text-text-muted">
        <span className="font-semibold text-text">Theme Roller</span>
        {running && <span>{`On ${running.label} · ${running.shipped ? 'shipped' : 'yours'}`}</span>}
        <span className="flex-1" />
        <button type="button" className={BTN} onClick={close} aria-label="Close Theme Roller">
          Close
        </button>
      </header>
      <p className="border-b border-border px-3 py-1.5 text-11 text-text-faint">Moves the nine colours of this theme on this tab; nothing is stored until Save. A swatch drawn in its own colours (the picker’s cards) does not follow.</p>
      {roller && running && stored && can ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
            {THEME_TOKEN_KEYS.map(key => (
              <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-border py-1.5">
                <span className="text-12 font-semibold text-text">{THEME_TOKEN_LABELS[key].label}</span>
                <div className="row-span-2 flex items-center gap-2">
                  <input
                    id={`pd-roller-${key}`}
                    type="color"
                    value={roller.tokens[key]}
                    aria-label={THEME_TOKEN_LABELS[key].label}
                    className="h-6 w-8 cursor-pointer border border-border-strong bg-transparent p-0"
                    onChange={e => edit(key, e.target.value)}
                  />
                  <input
                    id={`pd-roller-${key}-hex`}
                    type="text"
                    value={drafts[key] ?? roller.tokens[key]}
                    maxLength={7}
                    aria-label={`${THEME_TOKEN_LABELS[key].label} as #rrggbb`}
                    className={`${FIELD} w-[76px]`}
                    onChange={e => typeHex(key, e.target.value)}
                    onBlur={() => dropDraft(key)}
                  />
                </div>
                <p className="text-11 text-text-faint">{THEME_TOKEN_LABELS[key].paints}</p>
              </div>
            ))}
            <ul aria-label="The contrast gate" className="my-2 grid gap-0.5 text-11">
              {themeContrast(roller.tokens).map(r => (
                <li key={r.id} className={`flex justify-between gap-3 ${r.pass ? 'text-text-faint' : 'text-negative'}`}>
                  <span>{r.label}</span>
                  <span className="font-mono tabular-nums">{`${formatRatio(r.ratio)}${r.pass ? ' · ok' : ` · below ${formatRatio(r.min)}`}`}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-2 border-t border-border px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className={BTN} disabled={roller.past.length === 0} onClick={() => step(undo)}>
                Undo
              </button>
              <button type="button" className={BTN} disabled={roller.future.length === 0} onClick={() => step(redo)}>
                Redo
              </button>
              <button type="button" className={BTN} disabled={!dirty} onClick={() => step(s => resetTo(s, stored))}>
                Reset
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className={BTN}
                disabled={!can.save || busy}
                title={running.shipped ? 'A shipped theme keeps its colours in the stylesheet' : `Save ${running.label} with its stamp`}
                onClick={() => void save()}
              >
                Save
              </button>
              <input
                type="text"
                value={label}
                maxLength={THEME_LABEL_MAX}
                placeholder="Name the new theme"
                aria-label="Name of the new theme"
                className={`${FIELD} min-w-[150px] flex-1`}
                onChange={e => {
                  setLabel(e.target.value);
                  setMessage(null);
                }}
              />
              <button type="button" className={PRIMARY} disabled={!can.saveAs || busy} onClick={() => void saveAs()}>
                Save as new theme
              </button>
              {!running.shipped && !running.isDefault && (
                <button type="button" className={BTN} disabled={busy} onClick={() => void setDefault()}>
                  Set as default
                </button>
              )}
            </div>
            <p role="status" className={`text-11 ${negative ? 'text-negative' : 'text-text-faint'}`}>
              {shown}
            </p>
          </div>
        </>
      ) : (
        <p role="status" className={`px-3 py-3 text-11 ${negative ? 'text-negative' : 'text-text-faint'}`}>
          {shown}
        </p>
      )}
    </section>
  );
}
