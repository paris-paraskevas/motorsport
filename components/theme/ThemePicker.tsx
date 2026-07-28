'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from '@/components/theme/ThemeScript';
import {
  THEMES,
  applyTheme,
  readChoice,
  setChoice,
  subscribe,
  type ThemeChoice,
} from '@/lib/theme';

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

  const pick = (next: ThemeChoice) => setChoice(next);

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
