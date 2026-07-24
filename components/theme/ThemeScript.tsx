// Pre-paint theme init. Rendered as the FIRST child of <body> in every root
// layout: a parser-blocking inline script that runs before first paint, so a
// non-default theme never flashes Midnight. The <html> SSR default stays
// class="dark" (Midnight) — this script only corrects the minority.
//
// Keys here MUST stay in sync with THEMES in components/theme/ThemePicker.tsx
// and the :root[data-theme=…] blocks in app/globals.css. 'system' maps
// dark→midnight / light→newsprint (GitHub precedent: system-light lands on the
// soft paper theme, never high-contrast).
export const THEME_STORAGE_KEY = 'paddock:theme';

const INIT = `(function(){try{
var K={midnight:1,carbon:1,ember:1,newsprint:1,circuit:1};
var t=localStorage.getItem('${THEME_STORAGE_KEY}');
if(t!=='system'&&!K[t])t='midnight';
var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'midnight':'newsprint'):t;
var d=document.documentElement;
d.dataset.theme=r;
d.classList.toggle('dark',r!=='newsprint'&&r!=='circuit');
}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: INIT }} />;
}
