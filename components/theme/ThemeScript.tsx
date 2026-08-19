// Pre-paint theme init. Rendered as the FIRST child of <body> in every root
// layout: a parser-blocking inline script that runs before first paint, so a
// non-default theme never flashes. The <html> SSR default is data-theme="paper"
// with NO dark class (Paper became the default for everybody, operator
// 2026-08-19) — this script only corrects users who stored another theme.
//
// Keys here MUST stay in sync with THEMES in components/theme/ThemePicker.tsx
// and the :root[data-theme=…] blocks in app/globals.css. 'system' maps
// dark→midnight / light→newsprint (GitHub precedent: system-light lands on the
// soft paper theme, never high-contrast).
export const THEME_STORAGE_KEY = 'paddock:theme';
/** '1' = dyslexic mode on (html[data-dyslexic] swaps the font tokens to
 *  OpenDyslexic — globals.css). Same pre-paint contract as the theme. */
export const DYSLEXIC_STORAGE_KEY = 'paddock:dyslexic';

const INIT = `(function(){try{
var K={midnight:1,carbon:1,ember:1,newsprint:1,circuit:1,paper:1};
var L={newsprint:1,circuit:1,paper:1};
var t=localStorage.getItem('${THEME_STORAGE_KEY}');
if(t!=='system'&&!K[t])t='paper';
var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'midnight':'paper'):t;
var d=document.documentElement;
d.dataset.theme=r;
d.classList.toggle('dark',!L[r]);
if(localStorage.getItem('${DYSLEXIC_STORAGE_KEY}')==='1')d.dataset.dyslexic='1';
}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: INIT }} />;
}
