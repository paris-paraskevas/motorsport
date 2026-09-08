import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { DEFAULT_TEXT, TEXT_DEFAULTS, TEXT_KEYS, TEXT_MAX, isTextKey, type ChromeText, type TextKey } from './text-defaults';

export { DEFAULT_TEXT, TEXT_DEFAULTS, TEXT_KEYS, TEXT_MAX, isTextKey } from './text-defaults';
export type { ChromeText, TextKey } from './text-defaults';

// Text Messages (APEX: Text Messages): the chrome's fixed strings, read from the
// `text_message` rows for this application and rendered by the shell. Phase 2
// step 3 of the designer plan; the rows are seeded by migration 20260908150000.
//
// THE RULE THIS FILE ENFORCES: the shipped text is the fallback for every
// failure. A missing table, an unconfigured database, a query error, a blank
// value or one past TEXT_MAX all land on the default, key by key. A row can
// never blank the skip link or the footer.
//
// Writes go through app/api/admin/design/text/[key] only: one conditional
// update per row, refused when the row's updated_at moved (the 1.0.25 pattern).

const APPLICATION_KEY = 'paddock';

const usable = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= TEXT_MAX;

/** Coerce rows into the text record, defaults for anything unusable. */
export function textFromRows(rows: unknown): ChromeText {
  const out: ChromeText = { ...DEFAULT_TEXT };
  if (!Array.isArray(rows)) return out;
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.key !== 'string' || !isTextKey(row.key)) continue;
    if (usable(row.text)) out[row.key] = row.text.trim();
  }
  return out;
}

const MEMO_MS = 60_000;
let memo: { at: number; value: ChromeText } | null = null;

export function resetTextMemo(): void {
  memo = null;
}

/** The chrome's strings for the shell. Never throws. */
export async function loadTextMessages(): Promise<ChromeText> {
  if (!isBettingConfigured()) return DEFAULT_TEXT;
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  try {
    const { data, error } = await betDb()
      .from('text_message')
      .select('key, text')
      .eq('application_key', APPLICATION_KEY)
      .in('key', [...TEXT_KEYS]);
    if (error || !data) return DEFAULT_TEXT;
    const value = textFromRows(data);
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_TEXT;
  }
}

/** A message as the editor sees it. `updatedAt` is the row's stamp exactly as
 *  PostgREST sent it (microseconds intact); null when the row does not exist,
 *  in which case the editor shows the default and cannot save. */
export interface EditableText {
  key: TextKey;
  text: string;
  where: string;
  updatedAt: string | null;
}

/** Every key, with its row when there is one. Null on any failure. */
export async function loadTextForEditing(): Promise<EditableText[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb()
      .from('text_message')
      .select('key, text, where_shown, updated_at')
      .eq('application_key', APPLICATION_KEY)
      .in('key', [...TEXT_KEYS]);
    if (error) return null;
    const byKey = new Map<string, Record<string, unknown>>();
    for (const row of (data ?? []) as Record<string, unknown>[]) if (typeof row.key === 'string') byKey.set(row.key, row);
    return TEXT_KEYS.map(key => {
      const row = byKey.get(key);
      return {
        key,
        text: row && typeof row.text === 'string' ? row.text : TEXT_DEFAULTS[key].text,
        where: row && typeof row.where_shown === 'string' && row.where_shown ? row.where_shown : TEXT_DEFAULTS[key].where,
        updatedAt: row && row.updated_at != null ? String(row.updated_at) : null,
      };
    });
  } catch {
    return null;
  }
}

export { APPLICATION_KEY as TEXT_APPLICATION_KEY };
export type { TextKey as EditableTextKey };
