import {
  IBM_Plex_Sans,
  IBM_Plex_Sans_Condensed,
  IBM_Plex_Mono,
  Newsreader,
  Source_Sans_3,
  Fira_Sans,
  Source_Serif_4,
  Literata,
  JetBrains_Mono,
  Source_Code_Pro,
  Roboto_Condensed,
  Fira_Sans_Condensed,
} from 'next/font/google';

// The type system (operator board, 2026-08-03 "READING COMFORT"):
//   PLEX SANS 400 app-wide · PLEX SANS CONDENSED quarantined to names ·
//   PLEX MONO for the data register · ground #121215.
// Self-hosted at build by next/font (no runtime Google request, GDPR-clean) —
// shared module so all root layouts load the exact same instances. Per-tree
// preload trimming is NOT possible here: Turbopack merges this module's font
// CSS into the same output chunk as the @fontsource/opendyslexic sheets every
// layout imports, and preloads follow chunk membership — a marketing-only
// instance set was tried (0.322.x LCP work) and inherited the full preload
// set anyway. Preload tuning therefore happens globally, on these instances.
//
// Sans is the VARIABLE font (the board's own note: variable lets weight tuning
// like 380-on-dark later without a reload) and carries the GREEK subset — which
// is what let the GeistSans GreekFallback omega hack retire. Condensed has NO
// Greek upstream (checked in Next's font manifest): it is only ever applied to
// data-surface names, which are Latin; Greek names live on Sans surfaces.
export const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext', 'greek'],
  variable: '--font-plex-sans',
  display: 'swap',
});

// Condensed and Mono are label faces, never the LCP element, so they are not
// worth head preloads: `preload: false` drops their 12 <link rel=preload>
// tags (~132 KiB that contended with the serif the hero paints in — the
// 0.322.x PSI mobile-LCP finding). Every @font-face stays in the CSS
// regardless (subsets/preload only select preloading, verified against the
// emitted CSS and next/font docs), so they still load on first use with
// display:swap + the size-adjusted fallback next/font already generates.
export const plexCondensed = IBM_Plex_Sans_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-plex-condensed',
  display: 'swap',
  preload: false,
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
});

// The Paper editorial serif (design handoff 2026-08: page titles, headlines,
// row names, body prose on the reimagined surfaces). Variable wght 200-800 +
// the opsz axis — optical sizing is load-bearing here: the same family sets
// 66px heroes and 18px body. No Greek upstream (latin/latin-ext/vietnamese
// only), so Greek names inside serif surfaces fall through per-glyph to Plex
// Sans via the --font-serif chain in globals.css.
// `subsets: ['latin']` (not latin-ext): subsets only choose which files get a
// head preload — the latin-ext @font-face rules remain in the CSS and fetch
// on demand for the rare Ł/ř/ș glyph. Preloading them was 178 KiB of head
// weight on every page for glyphs the first paint almost never contains.
export const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-newsreader',
  display: 'swap',
});

// The Appearance faces (designer step 8, lib/design/appearance-defaults.ts):
// the alternatives the operator may put in a role. Declared here because
// next/font bundles only what the build sees, so the offered list is fixed per
// deploy and adding a face is a deploy, like a new component kind. None is
// preloaded: a face costs its @font-face rules in the stylesheet and nothing
// else until the operator picks it, and then it loads on first use with
// display:swap and next/font's size-adjusted fallback (no head preload can
// follow a runtime choice; the shipped default keeps its preloads above). The
// body candidates carry Greek, like Plex Sans; the mono and condensed ones are
// Latin, like theirs. The catalogue names these variables, and a test reads
// this file to keep the two lists equal.
export const sourceSans3 = Source_Sans_3({
  subsets: ['latin', 'latin-ext', 'greek'],
  variable: '--font-source-sans-3',
  display: 'swap',
  preload: false,
});
export const firaSans = Fira_Sans({
  subsets: ['latin', 'latin-ext', 'greek'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fira-sans',
  display: 'swap',
  preload: false,
});
export const sourceSerif4 = Source_Serif_4({
  subsets: ['latin', 'latin-ext', 'greek'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-source-serif-4',
  display: 'swap',
  preload: false,
});
export const literata = Literata({
  subsets: ['latin', 'latin-ext', 'greek'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-literata',
  display: 'swap',
  preload: false,
});
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  preload: false,
});
export const sourceCodePro = Source_Code_Pro({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-source-code-pro',
  display: 'swap',
  preload: false,
});
export const robotoCondensed = Roboto_Condensed({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-roboto-condensed',
  display: 'swap',
  preload: false,
});
export const firaSansCondensed = Fira_Sans_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-fira-sans-condensed',
  display: 'swap',
  preload: false,
});

/** The html-level class string every root layout applies: Sans as the base
 *  family class, the others as CSS variables for the token layer, the Appearance
 *  alternatives among them so a stored choice resolves on every page. */
export const FONT_CLASSES = [
  plexSans.variable,
  plexCondensed.variable,
  plexMono.variable,
  newsreader.variable,
  sourceSans3.variable,
  firaSans.variable,
  sourceSerif4.variable,
  literata.variable,
  jetbrainsMono.variable,
  sourceCodePro.variable,
  robotoCondensed.variable,
  firaSansCondensed.variable,
].join(' ');
