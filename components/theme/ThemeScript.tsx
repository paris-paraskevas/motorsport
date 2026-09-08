import { SHIPPED_THEME_SET, pickableThemes, resolveThemeAttributes, type ThemeSet } from '@/lib/design/theme-defaults';

// Pre-paint theme init. Rendered as the FIRST child of <body> in the app root
// layout: a parser-blocking inline script that runs before first paint, so a
// non-default theme never flashes. The <html> SSR attributes carry the SET's
// default (Paper unless the designer's Themes says otherwise, 1.0.47) — this
// script only corrects visitors who stored another theme.
//
// The keys the script accepts come from the same set the layout, the picker
// and the style block read (lib/design/theme-defaults.ts, rows through
// lib/design/themes.ts), so the four can never disagree. 'system' maps
// dark→midnight / light→paper (GitHub precedent: system-light lands on the
// soft paper theme, never high-contrast).
export const THEME_STORAGE_KEY = 'paddock:theme';
/** '1' = dyslexic mode on (html[data-dyslexic] swaps the font tokens to
 *  OpenDyslexic — globals.css). Same pre-paint contract as the theme. */
export const DYSLEXIC_STORAGE_KEY = 'paddock:dyslexic';

/** The script for a set: K maps every pickable key to the shipped theme whose
 *  CSS block applies, D marks the dark family, C the operator's themes (which
 *  add `data-theme-custom`). Pure, so tests read what the browser will run. */
export function themeInitScript(set: ThemeSet): string {
  const K: Record<string, string> = {};
  const D: Record<string, 1> = {};
  const C: Record<string, 1> = {};
  for (const t of pickableThemes(set)) {
    const a = resolveThemeAttributes(set, t.key);
    K[t.key] = a.dataTheme;
    if (a.dark) D[t.key] = 1;
    if (a.custom) C[t.key] = 1;
  }
  return `(function(){try{
var K=${JSON.stringify(K)},D=${JSON.stringify(D)},C=${JSON.stringify(C)},F=${JSON.stringify(set.defaultKey)};
var t=localStorage.getItem('${THEME_STORAGE_KEY}');
if(t!=='system'&&!K[t])t=F;
var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'midnight':'paper'):t;
if(!K[r])r=F;
var d=document.documentElement;
d.dataset.theme=K[r];
if(C[r])d.dataset.themeCustom=r;else delete d.dataset.themeCustom;
d.classList.toggle('dark',!!D[r]);
if(localStorage.getItem('${DYSLEXIC_STORAGE_KEY}')==='1')d.dataset.dyslexic='1';
}catch(e){}})();`;
}

export function ThemeScript({ set = SHIPPED_THEME_SET }: { set?: ThemeSet }) {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript(set) }} />;
}
