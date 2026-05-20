'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const STORAGE_KEY = 'paddock-theme';
type Theme = 'light' | 'dark';

function readSavedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = readSavedTheme();
    setTheme(saved ?? systemTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  if (!mounted) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex items-center bg-surface border border-border rounded-full p-1.5"
        style={{ width: 29, height: 29 }}
      />
    );
  }

  const Icon = theme === 'dark' ? Sun : Moon;
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex items-center text-text-muted hover:text-text bg-surface hover:bg-surface-elevated border border-border rounded-full p-1.5 transition-colors duration-(--duration-fast)"
    >
      <Icon size={13} />
    </button>
  );
}
