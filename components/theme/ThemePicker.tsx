'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from '@/components/theme/ThemeScript';
import { pickableThemes, resolveThemeAttributes, type ThemeOption, type ThemeSet } from '@/lib/design/theme-defaults';

// The visitor's theme picker. The themes come from the same set the layout and
// the pre-paint script read (the six shipped, plus the operator's own from the
// designer's Themes, 1.0.47), so what is offered here is exactly what the site
// can render. The swatch previews use each theme's own colours, never the live
// tokens: each card shows itself.

type ThemeChoice = string;

// Same-tab picks dispatch this so useSyncExternalStore re-reads; cross-tab
// picks arrive via the native storage event.
const CHANGE_EVENT = 'paddock:theme-change';

function systemResolved(set: ThemeSet): string {
  const wants = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'paper';
  return pickableThemes(set).some(t => t.key === wants) ? wants : set.defaultKey;
}

function applyTheme(choice: ThemeChoice, set: ThemeSet) {
  const resolved = choice === 'system' ? systemResolved(set) : choice;
  const attrs = resolveThemeAttributes(set, resolved);
  const option = set.themes.find(t => t.key === resolved) ?? set.themes.find(t => t.key === set.defaultKey)!;
  const el = document.documentElement;
  el.dataset.theme = attrs.dataTheme;
  if (attrs.custom) el.dataset.themeCustom = attrs.custom;
  else delete el.dataset.themeCustom;
  el.classList.toggle('dark', attrs.dark);
  // PWA / mobile address bar follows the active chassis.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', option.tokens.bg);
}

function readChoice(set: ThemeSet): ThemeChoice {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'system' || pickableThemes(set).some(t => t.key === stored)) return stored as ThemeChoice;
  return set.defaultKey;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

// Swatch preview: chassis block + card + type sample + accent dot, from the
// theme's own hexes (intentionally NOT theme tokens — each card shows itself).
export function Swatch({ theme }: { theme: Pick<ThemeOption, 'tokens' | 'family'> }) {
  const t = theme.tokens;
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-full items-center justify-center border border-border"
      style={{ backgroundColor: t.bg }}
    >
      <span
        className="flex items-baseline gap-1.5 px-2 py-1 border"
        style={{ backgroundColor: t.surface, borderColor: theme.family === 'dark' ? '#ffffff26' : '#00000026' }}
      >
        <span className="text-[13px] font-semibold" style={{ color: t.text }}>Aa</span>
        <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color: t.accent }}>12</span>
      </span>
    </span>
  );
}

function SystemSwatch() {
  return (
    <span aria-hidden="true" className="flex h-12 w-full border border-border">
      <span className="flex-1" style={{ backgroundColor: '#121215' }} />
      <span className="flex-1" style={{ backgroundColor: '#f7f3e8' }} />
    </span>
  );
}

export function ThemePicker({ set }: { set: ThemeSet }) {
  // localStorage IS the store; the server snapshot renders the default until
  // hydration, then the real choice takes over (no setState-in-effect).
  const choice = useSyncExternalStore<ThemeChoice>(subscribe, () => readChoice(set), () => set.defaultKey);

  // External-system sync only (no state): OS appearance flips re-resolve a
  // live 'system' choice; a change made in another tab re-skins this one.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = () => { if (readChoice(set) === 'system') applyTheme('system', set); };
    const onStorage = (e: StorageEvent) => { if (e.key === THEME_STORAGE_KEY) applyTheme(readChoice(set), set); };
    mq.addEventListener('change', onSystem);
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', onSystem);
      window.removeEventListener('storage', onStorage);
    };
  }, [set]);

  const pick = (next: ThemeChoice) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next, set);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const themes = pickableThemes(set);
  const options: { key: ThemeChoice; label: string; hint: string; swatch: React.ReactNode }[] = [
    { key: 'system', label: 'System', hint: 'Match device', swatch: <SystemSwatch /> },
    ...themes.map(t => ({
      key: t.key,
      label: t.label,
      hint: t.isDefault ? `${t.hint}. The default` : t.hint,
      swatch: <Swatch theme={t} />,
    })),
  ];

  return (
    <section className="border-t border-border py-5 md:py-6">
      <h2 className="text-text text-base font-semibold">Appearance</h2>
      <p className="mt-1 text-text-faint text-xs">
        {themes.length} themes on the same instrument chassis. Stored on this device.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7" role="group" aria-label="Theme">
        {options.map(o => {
          const active = choice === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={active}
              onClick={() => pick(o.key)}
              className={`group border p-1.5 text-left transition-colors duration-(--duration-fast) ${
                active ? 'border-brand' : 'border-border hover:border-border-strong'
              }`}
            >
              {o.swatch}
              <span className="mt-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text">
                {o.label}
              </span>
              <span className="block text-[11px] leading-tight text-text-faint">{o.hint}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
