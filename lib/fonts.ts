import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, IBM_Plex_Mono, Newsreader } from 'next/font/google';

// The type system (operator board, 2026-08-03 "READING COMFORT"):
//   PLEX SANS 400 app-wide · PLEX SANS CONDENSED quarantined to names ·
//   PLEX MONO for the data register · ground #121215.
// Self-hosted at build by next/font (no runtime Google request, GDPR-clean) —
// shared module so all four root layouts load the exact same instances.
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

export const plexCondensed = IBM_Plex_Sans_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-plex-condensed',
  display: 'swap',
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

// The Paper editorial serif (design handoff 2026-08: page titles, headlines,
// row names, body prose on the reimagined surfaces). Variable wght 200-800 +
// the opsz axis — optical sizing is load-bearing here: the same family sets
// 66px heroes and 18px body. No Greek upstream (latin/latin-ext/vietnamese
// only), so Greek names inside serif surfaces fall through per-glyph to Plex
// Sans via the --font-serif chain in globals.css.
export const newsreader = Newsreader({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-newsreader',
  display: 'swap',
});

/** The html-level class string every root layout applies: Sans as the base
 *  family class, the others as CSS variables for the token layer. */
export const FONT_CLASSES = `${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable} ${newsreader.variable}`;
