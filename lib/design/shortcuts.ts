import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { SHORTCUT_TEXT_MAX, isShortcutKey } from './shortcut-defaults';

export { SHORTCUT_KEY, SHORTCUT_KEY_MAX, SHORTCUT_TEXT_MAX, isShortcutKey, shortcutKeyProblem, shortcutTextProblem } from './shortcut-defaults';
export type { Shortcut } from './shortcut-defaults';

// Shortcuts (APEX: Shortcuts), read from the `shortcut` rows for this
// application. Phase 2 step 9 of the designer plan; three example rows are
// seeded by migration 20260908230000.
//
// THE RULE THIS FILE ENFORCES: a row the parser cannot use (a key outside the
// rule, an empty or over-long text) is left out rather than guessed at, and any
// failure reads as no shortcuts at all. There is no shipped set: nothing renders
// a shortcut until Phase 3, and when Static Content does, a missing key is the
// box's problem to show, never the loader's to invent.
//
// Writes go through app/api/admin/design/shortcuts/* only: an insert for a new
// key, one conditional update or delete per row on the stamp the caller loaded
// (the 1.0.25 pattern).

const APPLICATION_KEY = 'paddock';

const usableText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= SHORTCUT_TEXT_MAX;

/** Coerce rows into key → text, leaving out anything unusable. */
export function shortcutsFromRows(rows: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(rows)) return out;
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (!isShortcutKey(row.key) || !usableText(row.text)) continue;
    out[row.key] = row.text.trim();
  }
  return out;
}

const MEMO_MS = 60_000;
let memo: { at: number; value: Record<string, string> } | null = null;

export function resetShortcutsMemo(): void {
  memo = null;
}

/** Every usable shortcut, key → text, for the site (Phase 3's Static Content). Never throws. */
export async function loadShortcuts(): Promise<Record<string, string>> {
  if (!isBettingConfigured()) return {};
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  try {
    const { data, error } = await betDb().from('shortcut').select('key, text').eq('application_key', APPLICATION_KEY);
    if (error || !data) return {};
    const value = shortcutsFromRows(data);
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return {};
  }
}

/** A shortcut as the editor sees it: a row, so it always has a stamp, exactly
 *  as PostgREST sent it (microseconds intact). */
export interface EditableShortcut {
  key: string;
  text: string;
  updatedAt: string;
}

/** Every usable row with its stamp, by key. Null on any failure; empty when
 *  there are none. */
export async function loadShortcutsForEditing(): Promise<EditableShortcut[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb()
      .from('shortcut')
      .select('key, text, updated_at')
      .eq('application_key', APPLICATION_KEY);
    if (error) return null;
    const out: EditableShortcut[] = [];
    for (const item of (data ?? []) as Record<string, unknown>[]) {
      if (!isShortcutKey(item.key) || !usableText(item.text) || item.updated_at == null) continue;
      out.push({ key: item.key, text: item.text, updatedAt: String(item.updated_at) });
    }
    out.sort((a, b) => a.key.localeCompare(b.key));
    return out;
  } catch {
    return null;
  }
}

export { APPLICATION_KEY as SHORTCUT_APPLICATION_KEY };
