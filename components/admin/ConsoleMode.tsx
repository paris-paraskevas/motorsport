'use client';

import { Moon, Sun } from 'lucide-react';

// The console's dark/light switch.
//
// The console is a separate root layout and must NOT run the site's
// ThemeScript: that script reads `paddock:theme` and would paint the console in
// whichever of the site's six themes the operator last picked. (It has been
// doing exactly that — the admin root SSRs data-theme="paper" and ThemeScript
// then overwrote it, so an operator on Midnight got a dark console by accident
// rather than by design.) This owns `paddock:console-mode` instead, which is
// independent of the site's theme by intent.
//
// Dyslexic mode IS still honoured, because that is an accessibility preference
// and not a look — same key, same contract as the site.
export const CONSOLE_MODE_KEY = 'paddock:console-mode';

const INIT = `(function(){try{
var m=localStorage.getItem('${CONSOLE_MODE_KEY}');
if(m!=='light'&&m!=='dark')m=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
var d=document.documentElement;
d.dataset.theme='console-'+m;
d.classList.toggle('dark',m==='dark');
if(localStorage.getItem('paddock:dyslexic')==='1')d.dataset.dyslexic='1';
}catch(e){}})();`;

/** Parser-blocking pre-paint init, rendered as the first child of <body> in the
 *  admin root — same contract as the site's ThemeScript, so a stored light mode
 *  never flashes dark first. */
export function ConsoleModeScript() {
  return <script dangerouslySetInnerHTML={{ __html: INIT }} />;
}

/**
 * The toggle.
 *
 * Both icons are always rendered and globals.css hides the wrong one off the
 * root's data-theme. That is deliberate: deriving the icon from React state
 * would mean the server (which cannot read localStorage) and the client
 * disagreeing on first paint — a hydration mismatch on every load for a light-
 * mode operator. With CSS doing the choosing there is no state to mismatch, and
 * the label stays state-independent so it is never read out wrong either.
 */
export function ConsoleModeToggle() {
  function flip() {
    const d = document.documentElement;
    const next = d.dataset.theme === 'console-light' ? 'dark' : 'light';
    d.dataset.theme = `console-${next}`;
    d.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem(CONSOLE_MODE_KEY, next);
    } catch {
      // Private mode / storage disabled: the flip still applies for this page.
    }
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label="Switch the console between dark and light"
      title="Switch the console between dark and light"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:text-text"
    >
      <Moon size={13} data-mode-icon="dark" aria-hidden />
      <Sun size={13} data-mode-icon="light" aria-hidden />
      Mode
    </button>
  );
}
