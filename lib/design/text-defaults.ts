// The fixed strings the chrome shows (APEX: Text Messages), by key, with the
// text the code shipped and a plain-language note of where each one appears.
// Client-safe: the designer's editor lists them, the server loader (text.ts)
// falls back to them, and the components render them.

export const TEXT_KEYS = ['a11y.skip', 'nav.search', 'footer.site', 'footer.legal', 'footer.blurb', 'footer.install'] as const;
export type TextKey = (typeof TEXT_KEYS)[number];

/** Every key resolved to a string; what the shell renders from. */
export type ChromeText = Record<TextKey, string>;

/** A message may be this long and no longer: the footer blurb is the longest
 *  string the chrome carries, and a paragraph, not an essay. */
export const TEXT_MAX = 500;

export const TEXT_DEFAULTS: Record<TextKey, { text: string; where: string }> = {
  'a11y.skip': { text: 'Skip to content', where: 'The first link on every page, visible to keyboard users' },
  'nav.search': { text: 'Browse the site, or search it', where: 'The header search field on desktop, and its spoken label everywhere' },
  'footer.site': { text: 'Site', where: 'Footer · heading of the first column' },
  'footer.legal': { text: 'Legal', where: 'Footer · heading of the second column' },
  'footer.blurb': {
    text: 'Independent motorsport companion, built in the open. Fifteen championships, every session in your own time zone. No account needed to browse.',
    where: 'Footer · the one paragraph saying what the site is',
  },
  'footer.install': { text: 'Install as an app', where: 'Footer · the install button' },
};

export const DEFAULT_TEXT: ChromeText = Object.fromEntries(
  TEXT_KEYS.map(k => [k, TEXT_DEFAULTS[k].text]),
) as ChromeText;

export function isTextKey(key: string): key is TextKey {
  return (TEXT_KEYS as readonly string[]).includes(key);
}
