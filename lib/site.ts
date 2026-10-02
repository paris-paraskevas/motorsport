// Single source of truth for site-wide identity strings. Imported by
// app/layout.tsx, app/robots.ts, and lib/sitemap-data.ts. When the domain
// changes, edit this file only.

export const SITE_URL = 'https://paddock-tracker.com';
export const SITE_TITLE = 'Paddock Tracker';
export const SITE_DESCRIPTION =
  'Personal motorsport companion — F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more.';

// IndexNow protocol key. Public by design — the key file at
// `${SITE_URL}/${INDEXNOW_KEY}.txt` proves domain ownership to Bing /
// Yandex / Seznam, so the key being in source is intentional. Regenerating
// is cheap (mint a new UUIDv4, rename the public file, redeploy).
// Buy Me a Coffee, operator-supplied 2026-08-21. Single-sourced because two
// surfaces link it (the header button and the account menu) and a payment link
// that drifts between them is worse than no link at all.
export const SUPPORT_URL = 'https://buymeacoffee.com/parisp';

export const INDEXNOW_KEY = '9a3e7f2c-8b4d-4c1a-a5e6-d7f8b9c0e1d2';
export const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

// App page-shell width — ONE source of truth for the container that wraps every
// (app) route body. Edit here to reshape the whole app's width at once.
//
// Reactive-to-viewport (operator 2026-07-09): the column tracks screen width
// CONTINUOUSLY instead of stepping at breakpoints (the old `lg:max-w-6xl
// xl:max-w-7xl 2xl:max-w-screen-2xl 3xl:max-w-[2000px]` ladder pinned the width
// between breakpoints and grew dead-space margins). Two profiles:
//   PAGE_WIDE — data / dashboard / hub pages + nav + footer: fully fluid, NO max
//     cap, fills the viewport minus gutters at any width (incl. ultrawide).
//   PAGE_READ — prose + forms: fluid up to a readable cap, then centred, so line
//     length stays comfortable (full-bleed legal/blog text is unreadable).
// Gutters are the padding: p-4 / md:p-6 / lg:p-8 (16 / 24 / 32px); pb-16 gives
// scroll clearance past the mobile bottom bar. Nav/footer match the horizontal
// gutter scale (px-4 md:px-6 lg:px-8) so chrome aligns with the body.
export const PAGE_WIDE = 'w-full p-4 md:p-6 lg:p-8 pb-16';
export const PAGE_READ = 'w-full max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16';

/** The play-money disclaimer, on every betting surface.
 *
 *  A launch gate, not decoration: `docs/launch-checklist.md` §A6 requires
 *  no-cashout framing on `/social` **and every betting surface**, because
 *  marketing must not imply real gambling. Audited on prod 2026-08-28 and
 *  `/social/leagues` carried **none** — nor did the league detail page — while
 *  `/social` had four mentions.
 *
 *  One constant rather than the same sentence typed into each page, because two
 *  copies of a compliance line are two copies to forget to update. Wording
 *  follows the voice already on `/social` ("No cash, no catch") and
 *  `WeekendBetting` ("free Paddock credits, no cashout"). */
export const PLAY_MONEY_NOTE =
  'Played with free Paddock credits. No cash in, no cash out — just bragging rights.';

// The v1.0 announcement used to live here as LAUNCH_ANNOUNCEMENT, rendered by
// components/LaunchBanner. Both were retired in 0.334.88: the What's-New modal
// (lib/whats-new.ts + components/whats-new/) had grown into a better version of
// the same thing — six cards carrying real screenshots of our own pages rather
// than a text list — and the two were mounted side by side under the SAME
// 'v1.0' dismissal id, with racing "is a dialog already open" guards.
//
// The roadmap copy moved across verbatim as WhatsNewEntry.next. Both files are
// in git history if the old shape is ever wanted back.

// Series/team colours used AS TEXT (labels, headings, deltas). Vibrant hexes
// wash out on the light themes, so the colour mixes toward black by the
// per-theme --series-ink-mix (globals.css): 100% on dark themes (identical to
// the raw colour), 52% on light (clears WCAG 4.5:1 for the brightest series
// tint on the darkest light surface). Fills (dots, rules, bars) stay raw.
export function seriesInk(colour: string): string {
  return `color-mix(in srgb, ${colour} var(--series-ink-mix), black)`;
}

// X10 (the Seobility crawl of 1 October 2026): the title and description rules every template calls. Seobility measures a
// <title> in Arial at 20 px and flags one over 580 px, a meta description in Arial at 14 px and flags one over 1,000 px, and a
// title that uses a word twice. The widths below are Helvetica's advance widths per 1,000 units of the em, which Arial
// matches; the crawl's own rows reproduce within one per cent (its 586 px title measures 582 here), so the budgets keep a
// margin: 570 px for a whole title, 985 px for a description, with a floor of 440 px (about seventy characters: Bing flagged
// one-line descriptions in August 2026) under which a tail is appended. The social cards keep the full strings; these rules
// shape the browser tab and the search snippet only.
const GLYPH: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584, '—': 1000, '–': 556, '·': 333, '’': 222, '‘': 222, '“': 333, '”': 333, '…': 1000, '•': 350, '€': 556, '°': 400, '£': 556, '×': 584, '→': 1000, '←': 1000,
};
const OWN: Record<string, number> = { í: 278, ì: 278, î: 278, ï: 278, ı: 278, ø: 611, Ø: 778, ß: 611, æ: 889, Æ: 1000, œ: 944, Œ: 1000 };
const BASE: Record<string, string> = { à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a', ç: 'c', è: 'e', é: 'e', ê: 'e', ë: 'e', ì: 'i', í: 'i', î: 'i', ï: 'i', ñ: 'n', ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o', ø: 'o', ù: 'u', ú: 'u', û: 'u', ü: 'u', ý: 'y', ÿ: 'y', À: 'A', Á: 'A', Â: 'A', Ä: 'A', Å: 'A', Ç: 'C', È: 'E', É: 'E', Ê: 'E', Ë: 'E', Ì: 'I', Í: 'I', Î: 'I', Ï: 'I', Ñ: 'N', Ò: 'O', Ó: 'O', Ô: 'O', Ö: 'O', Ø: 'O', Ù: 'U', Ú: 'U', Û: 'U', Ü: 'U', Ý: 'Y', ß: 's', æ: 'a', œ: 'o', Æ: 'A', Œ: 'O', č: 'c', ć: 'c', š: 's', ž: 'z', ł: 'l', ą: 'a', ę: 'e', ő: 'o', ű: 'u', ğ: 'g', ı: 'i', ş: 's', İ: 'I' };
/** The width of `text` in Arial at `px` pixels; a glyph the table lacks counts as a lowercase letter, or as a capital
 *  (667, Arial’s Greek and Cyrillic capitals average 647–677) when it has a different lowercase form. */
export function textWidth(text: string, px: number): number {
  let units = 0;
  for (const ch of text) units += GLYPH[ch] ?? OWN[ch] ?? GLYPH[BASE[ch] ?? ''] ?? (ch !== ch.toLowerCase() ? 667 : 556);
  return (units * px) / 1000;
}
export const TITLE_PX = 20;
export const TITLE_MAX_PX = 570;
export const TITLE_SUFFIX = ` — ${SITE_TITLE}`;
export const DESCRIPTION_PX = 14;
export const DESCRIPTION_MAX_PX = 985;
export const DESCRIPTION_MIN_PX = 440;
export const DESCRIPTION_TAIL = 'A sourced Paddock Tracker explainer.';

const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim();
const STOP_WORDS = /\s(a|an|the|and|or|of|on|in|at|to|for|by|with|from|as|is|its|his|her|their|our|your|that|this|but|so)$/i;
/** The longest prefix of `text` within `budget` that ends at a word, its trailing stop word and punctuation dropped. */
function cutAtWord(text: string, budget: number, px: number): string {
  if (textWidth(text, px) <= budget) return text;
  let cut = '';
  for (let at = text.indexOf(' '); at > 0; at = text.indexOf(' ', at + 1)) {
    const prefix = text.slice(0, at);
    if (textWidth(prefix, px) > budget) break;
    cut = prefix;
  }
  if (!cut) {
    cut = '';
    for (const ch of text) {
      if (textWidth(cut + ch, px) > budget) break;
      cut += ch;
    }
  }
  const closed = cut.replace(/\s*\([^)]*$/, '');
  if (closed.trim()) cut = closed;
  while (STOP_WORDS.test(cut)) cut = cut.replace(/\s\S+$/, '');
  return cut.replace(/[\s,:;·|/&–—-]+$/, '');
}
/** The words (three characters or more) a title uses twice, the layout's suffix included when `withSuffix`. */
export function repeatedWords(text: string, withSuffix = false): string[] {
  const words: string[] = (withSuffix ? text + TITLE_SUFFIX : text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  return [...new Set(words.filter((w, i) => words.indexOf(w) !== i))];
}
/** The first variant that fits the title's budget without a repeated word, else the first that fits, else the last cut at a
 *  word. The budget is the whole title's, the layout's suffix included. */
export function fitTitle(variants: readonly string[], maxPx = TITLE_MAX_PX): string {
  const budget = maxPx - textWidth(TITLE_SUFFIX, TITLE_PX);
  const clean = variants.map(squeeze).filter(Boolean);
  const fits = clean.filter(v => textWidth(v, TITLE_PX) <= budget);
  return fits.find(v => repeatedWords(v, true).length === 0) ?? fits[0] ?? cutAtWord(clean[clean.length - 1] ?? '', budget, TITLE_PX);
}
const CLAUSE_ENDS: ReadonlyArray<readonly [string, number]> = [[': ', 0], [' — ', 0], [' – ', 0], [' - ', 0], [', and ', 0], [', ', 0], ['; ', 0], ['. ', 0], ['? ', 1], ['! ', 1]];
/** An editorial headline for the tab: the longest clause before a delimiter that fits and is at least `minChars` long (a
 *  clause without a repeated word before one with), the headline itself when it fits, else a cut at a word. */
export function shortTitle(title: string, maxPx = TITLE_MAX_PX, minChars = 15): string {
  const budget = maxPx - textWidth(TITLE_SUFFIX, TITLE_PX);
  const t = squeeze(title);
  if (textWidth(t, TITLE_PX) <= budget) return t;
  const clauses: string[] = [];
  for (const [d, keep] of CLAUSE_ENDS) {
    for (let at = t.indexOf(d); at >= 0; at = t.indexOf(d, at + 1)) {
      const prefix = t.slice(0, at + keep);
      if (prefix.length >= minChars && textWidth(prefix, TITLE_PX) <= budget) clauses.push(prefix);
    }
  }
  const longest = (list: string[]) => list.reduce((a, b) => (b.length > a.length ? b : a), '');
  return longest(clauses.filter(c => repeatedWords(c, true).length === 0)) || longest(clauses) || cutAtWord(t, budget, TITLE_PX);
}
/** A meta description within Seobility's width. One text: left alone when it fits (the tail appended under the floor),
 *  else the longest prefix ending at a sentence end above the floor, else a cut at a word with an ellipsis. Several
 *  variants: the first that fits, else the last cut the same way. */
export function fitDescription(text: string | readonly string[], opts: { maxPx?: number; minPx?: number; tail?: string } = {}): string {
  const max = opts.maxPx ?? DESCRIPTION_MAX_PX;
  const min = opts.minPx ?? DESCRIPTION_MIN_PX;
  const tail = opts.tail ?? DESCRIPTION_TAIL;
  if (typeof text !== 'string') {
    const clean = text.map(squeeze).filter(Boolean);
    const fit = clean.find(v => textWidth(v, DESCRIPTION_PX) <= max);
    return fit ?? `${cutAtWord(clean[clean.length - 1] ?? '', max - textWidth('…', DESCRIPTION_PX), DESCRIPTION_PX)}…`;
  }
  const t = squeeze(text);
  const width = textWidth(t, DESCRIPTION_PX);
  if (width <= max) {
    if (width >= min || !tail) return t;
    const withTail = t ? `${t} ${tail}` : tail;
    return textWidth(withTail, DESCRIPTION_PX) <= max ? withTail : t;
  }
  let best = '';
  const re = /[.!?](?=\s|$)/g;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const prefix = t.slice(0, m.index + 1);
    const w = textWidth(prefix, DESCRIPTION_PX);
    if (w > max) break;
    if (w >= min) best = prefix;
  }
  return best || `${cutAtWord(t, max - textWidth('…', DESCRIPTION_PX), DESCRIPTION_PX)}…`;
}
