import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  SETTING_SPECS,
  isSettingKey,
  parseSettingValue,
  type SettingKey,
  type SettingValue,
  type SettingValues,
} from './setting-defaults';

export {
  ANNOUNCEMENT_IDS,
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  SETTING_SPECS,
  isSettingKey,
  parseSettingValue,
  serialiseSettingValue,
  settingValueRule,
} from './setting-defaults';
export type { SettingControl, SettingKey, SettingSpec, SettingType, SettingValue, SettingValues } from './setting-defaults';

// Application Settings (APEX: Application Settings): the named values the site
// reads at render, from the `setting` rows for this application. Phase 2 step 5
// of the designer plan; the rows are seeded by migration 20260908170000.
//
// THE RULE THIS FILE ENFORCES: the shipped value is the fallback for every
// failure. An unconfigured database, a missing table, a query error, a missing
// row or a value the parser refuses all land on what the code shipped, key by
// key. A row can never blank the home page or arm a notice the code does not
// carry.
//
// Writes go through app/api/admin/design/settings/[key] only: one conditional
// update per row, refused when the row's updated_at moved (the 1.0.25 pattern),
// and refused before the database when the value breaks the key's rule.

const APPLICATION_KEY = 'paddock';

/** Coerce rows into the values record, the shipped value for anything unusable. */
export function settingsFromRows(rows: unknown): SettingValues {
  const out = { ...DEFAULT_SETTINGS } as Record<SettingKey, SettingValue>;
  if (!Array.isArray(rows)) return out as SettingValues;
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.key !== 'string' || !isSettingKey(row.key)) continue;
    const parsed = parseSettingValue(row.key, row.value);
    if (parsed !== undefined) out[row.key] = parsed;
  }
  return out as SettingValues;
}

const MEMO_MS = 60_000;
let memo: { at: number; value: SettingValues } | null = null;

export function resetSettingsMemo(): void {
  memo = null;
}

/** Every setting's value, for the site. Never throws. */
export async function loadSettings(): Promise<SettingValues> {
  if (!isBettingConfigured()) return DEFAULT_SETTINGS;
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  try {
    const { data, error } = await betDb()
      .from('setting')
      .select('key, value')
      .eq('application_key', APPLICATION_KEY)
      .in('key', [...SETTING_KEYS]);
    if (error || !data) return DEFAULT_SETTINGS;
    const value = settingsFromRows(data);
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** A setting as the editor sees it. `value` is what the site reads right now:
 *  the row's when usable, else the shipped one. `updatedAt` is the row's stamp
 *  exactly as PostgREST sent it (microseconds intact); null when the row does
 *  not exist, in which case the editor shows the shipped value and cannot save. */
export interface EditableSetting {
  key: SettingKey;
  value: SettingValue;
  description: string;
  updatedAt: string | null;
}

/** Every key, with its row when there is one. Null on any failure. */
export async function loadSettingsForEditing(): Promise<EditableSetting[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb()
      .from('setting')
      .select('key, value, description, updated_at')
      .eq('application_key', APPLICATION_KEY)
      .in('key', [...SETTING_KEYS]);
    if (error) return null;
    const byKey = new Map<string, Record<string, unknown>>();
    for (const row of (data ?? []) as Record<string, unknown>[]) if (typeof row.key === 'string') byKey.set(row.key, row);
    return SETTING_KEYS.map(key => {
      const row = byKey.get(key);
      const parsed = row ? parseSettingValue(key, row.value) : undefined;
      return {
        key,
        value: parsed !== undefined ? parsed : SETTING_SPECS[key].shipped,
        description:
          row && typeof row.description === 'string' && row.description ? row.description : SETTING_SPECS[key].description,
        updatedAt: row && row.updated_at != null ? String(row.updated_at) : null,
      };
    });
  } catch {
    return null;
  }
}

export { APPLICATION_KEY as SETTING_APPLICATION_KEY };
