'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import {
  applyTheme,
  isDark,
  readChoice,
  subscribe,
  toggleLightDark,
  type ThemeChoice,
} from '@/lib/theme';
import { THEME_STORAGE_KEY } from '@/components/theme/ThemeScript';

/** Header light/dark flip, mounted left of Search. One tap swaps chassis
    family and restores that family's last pick (Carbon survives a round trip);
    the five-theme gallery stays at /settings/theme.

    The server snapshot MUST be 'midnight' — every layout SSRs
    <html className="dark">, and any hydration mismatch here triggers React's
    full recovery, which wipes the pre-hydration data-theme off <html>
    (see the note in components/NextRaceCountdown.tsx). */
export function ThemeToggle() {
  const choice = useSyncExternalStore<ThemeChoice>(subscribe, readChoice, () => 'midnight');

  // Unlike the picker, this lives on every route — so it is what finally makes a
  // 'system' choice track OS appearance app-wide, not just on the settings page.
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

  const dark = isDarkSafe(choice);
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={toggleLightDark}
      aria-label={label}
      title={label}
      data-heatmap-id="chrome:theme"
      className="inline-flex h-9 w-9 items-center justify-center border border-border bg-surface/60 text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:text-text"
    >
      {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  );
}

// isDark() reads matchMedia for 'system', which is unavailable during SSR.
function isDarkSafe(choice: ThemeChoice): boolean {
  if (typeof window === 'undefined') return true;
  return isDark(choice);
}
