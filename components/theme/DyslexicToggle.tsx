'use client';

import { useSyncExternalStore } from 'react';
import { DYSLEXIC_STORAGE_KEY } from './ThemeScript';

// Readability: swaps the entire type system to OpenDyslexic (globals.css token
// override on html[data-dyslexic]) with looser leading. Same store pattern as
// ThemePicker: localStorage IS the store, the server snapshot renders "off"
// until hydration (no setState-in-effect), ThemeScript applies the saved state
// pre-paint on the next load and this toggle applies it live for the current one.

const CHANGE_EVENT = 'paddock:dyslexic-change';

function readOn(): boolean {
  return localStorage.getItem(DYSLEXIC_STORAGE_KEY) === '1';
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

function apply(on: boolean) {
  const d = document.documentElement;
  if (on) d.dataset.dyslexic = '1';
  else delete d.dataset.dyslexic;
}

export function DyslexicToggle() {
  const on = useSyncExternalStore(subscribe, readOn, () => false);

  function toggle() {
    const next = !on;
    if (next) localStorage.setItem(DYSLEXIC_STORAGE_KEY, '1');
    else localStorage.removeItem(DYSLEXIC_STORAGE_KEY);
    apply(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
        Readability
      </h2>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-text">Dyslexic mode</div>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            Swaps the site&apos;s type to OpenDyslexic with looser line spacing. Applies on this
            device and stays on until you turn it off.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Dyslexic mode"
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-(--duration-fast) ${
            on ? 'border-brand/60 bg-brand-fill' : 'border-border bg-surface'
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0.5 h-[22px] w-[22px] rounded-full transition-all duration-(--duration-fast) ${
              on ? 'left-[22px] bg-bg' : 'left-0.5 bg-text-faint'
            }`}
          />
        </button>
      </div>
    </section>
  );
}
