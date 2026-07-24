'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from '@/components/theme/ThemeScript';

// Palette metadata for the picker previews only — the live values are the
// :root[data-theme=…] token blocks in globals.css (WCAG-gated there).
const THEMES = [
  { key: 'midnight', label: 'Midnight', hint: 'Classic dark. The default', bg: '#07070a', surface: '#14141a', text: '#f5f5f7', accent: '#ffb400', dark: true },
  { key: 'carbon', label: 'Carbon', hint: 'Cool graphite. Night races', bg: '#060a12', surface: '#111721', text: '#f0f4f9', accent: '#ffb400', dark: true },
  { key: 'ember', label: 'Ember', hint: 'Amber instrument. Evening', bg: '#0c0a05', surface: '#1a140a', text: '#f8f1e7', accent: '#ffb400', dark: true },
  { key: 'newsprint', label: 'Newsprint', hint: 'Paper light. Long reads', bg: '#f7f3e8', surface: '#fbf7ec', text: '#1e1a13', accent: '#7d5300', dark: false },
  { key: 'circuit', label: 'Circuit', hint: 'High contrast. Daylight', bg: '#f4f4f5', surface: '#ffffff', text: '#09090b', accent: '#7d5300', dark: false },
] as const;

type ThemeKey = (typeof THEMES)[number]['key'];
type ThemeChoice = ThemeKey | 'system';

// Same-tab picks dispatch this so useSyncExternalStore re-reads; cross-tab
// picks arrive via the native storage event.
const CHANGE_EVENT = 'paddock:theme-change';

function systemResolved(): ThemeKey {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'newsprint';
}

function applyTheme(choice: ThemeChoice) {
  const resolved = choice === 'system' ? systemResolved() : choice;
  const def = THEMES.find(t => t.key === resolved) ?? THEMES[0];
  const el = document.documentElement;
  el.dataset.theme = def.key;
  el.classList.toggle('dark', def.dark);
  // PWA / mobile address bar follows the active chassis.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', def.bg);
}

function readChoice(): ThemeChoice {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'system' || THEMES.some(t => t.key === stored)) return stored as ThemeChoice;
  return 'midnight';
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
function Swatch({ theme }: { theme: (typeof THEMES)[number] }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-full items-center justify-center border border-border"
      style={{ backgroundColor: theme.bg }}
    >
      <span
        className="flex items-baseline gap-1.5 px-2 py-1 border"
        style={{ backgroundColor: theme.surface, borderColor: theme.dark ? '#ffffff26' : '#00000026' }}
      >
        <span className="text-[13px] font-semibold" style={{ color: theme.text }}>Aa</span>
        <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color: theme.accent }}>12</span>
      </span>
    </span>
  );
}

function SystemSwatch() {
  return (
    <span aria-hidden="true" className="flex h-12 w-full border border-border">
      <span className="flex-1" style={{ backgroundColor: '#07070a' }} />
      <span className="flex-1" style={{ backgroundColor: '#f7f3e8' }} />
    </span>
  );
}

export function ThemePicker() {
  // localStorage IS the store; the server snapshot renders the default until
  // hydration, then the real choice takes over (no setState-in-effect).
  const choice = useSyncExternalStore<ThemeChoice>(subscribe, readChoice, () => 'midnight');

  // External-system sync only (no state): OS appearance flips re-resolve a
  // live 'system' choice; a change made in another tab re-skins this one.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = () => { if (readChoice() === 'system') applyTheme('system'); };
    const onStorage = (e: StorageEvent) => { if (e.key === THEME_STORAGE_KEY) applyTheme(readChoice()); };
    mq.addEventListener('change', onSystem);
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', onSystem);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const pick = (next: ThemeChoice) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const options: { key: ThemeChoice; label: string; hint: string; swatch: React.ReactNode }[] = [
    { key: 'system', label: 'System', hint: 'Match device', swatch: <SystemSwatch /> },
    ...THEMES.map(t => ({ key: t.key as ThemeChoice, label: t.label, hint: t.hint, swatch: <Swatch theme={t} /> })),
  ];

  return (
    <section className="border-t border-border py-5 md:py-6">
      <h2 className="text-text text-base font-semibold">Appearance</h2>
      <p className="mt-1 text-text-faint text-xs">
        Five themes on the same instrument chassis. Stored on this device.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" role="group" aria-label="Theme">
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
