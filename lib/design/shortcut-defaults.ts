// Shortcuts (APEX: Shortcuts): house-style fragments a Static Content box
// inserts by key, so one edit changes every page that uses one. Client-safe:
// the designer's editor checks a key and a text with the same rules the write
// routes apply, so what the editor lets through is what the route accepts.
//
// There is no shipped set to fall back on: nothing on the site reads a shortcut
// until Phase 3 brings Static Content, and the list is the operator's to add to
// and remove from. The three rows migration 20260908230000 seeds are examples.

/** A key is what a Static Content box will name: lower-case letters and digits,
 *  dots, dashes and underscores, starting with a letter or digit, at most 60. */
export const SHORTCUT_KEY = /^[a-z0-9][a-z0-9._-]{0,59}$/;
export const SHORTCUT_KEY_MAX = 60;

/** A fragment is a sentence or two, never an essay. */
export const SHORTCUT_TEXT_MAX = 500;

export interface Shortcut {
  key: string;
  text: string;
}

export function isShortcutKey(key: unknown): key is string {
  return typeof key === 'string' && SHORTCUT_KEY.test(key);
}

/** Why a key is refused, in plain words; null when it is fine. */
export function shortcutKeyProblem(key: string): string | null {
  if (!key.trim()) return 'needs a key';
  if (key.length > SHORTCUT_KEY_MAX) return `a key is at most ${SHORTCUT_KEY_MAX} characters`;
  if (!SHORTCUT_KEY.test(key)) return 'a key is lower-case letters, digits, dots, dashes and underscores, starting with a letter or digit';
  return null;
}

/** Why a text is refused, in plain words; null when it is fine. */
export function shortcutTextProblem(text: string): string | null {
  if (!text.trim()) return 'cannot be empty';
  if (text.length > SHORTCUT_TEXT_MAX) return `over ${SHORTCUT_TEXT_MAX} characters`;
  return null;
}
