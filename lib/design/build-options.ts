import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import {
  BUILD_OPTION_DEFAULTS,
  BUILD_OPTION_KEYS,
  DEFAULT_BUILD_OPTIONS,
  isBuildOptionKey,
  isBuildOptionStatus,
  type BuildOptionKey,
  type BuildOptionStatus,
  type BuildOptions,
} from './build-option-defaults';

export {
  BUILD_OPTION_DEFAULTS,
  BUILD_OPTION_KEYS,
  BUILD_OPTION_STATUSES,
  DEFAULT_BUILD_OPTIONS,
  isBuildOptionKey,
  isBuildOptionStatus,
} from './build-option-defaults';
export type { BuildOptionKey, BuildOptionStatus, BuildOptions } from './build-option-defaults';

// Build Options (APEX: Build Options): the feature switches, read from the
// `build_option` rows for this application. Phase 2 step 4 of the designer plan;
// the rows were seeded by migration 20260908090000 and given their application
// by 20260908110000, so this step needs no migration.
//
// THE RULE THIS FILE ENFORCES: Include is the fallback for every failure. An
// unconfigured database, a missing table, a query error, a missing row or a
// status the code does not know all read as Include, key by key. A database
// problem can never hide a feature; it can only fail to hide one.
//
// Writes go through app/api/admin/design/build-options/[key] only: one
// conditional update per row, refused when the row's updated_at moved (the
// 1.0.25 pattern).

const APPLICATION_KEY = 'paddock';

/** Coerce rows into the options record, Include for anything unusable. */
export function buildOptionsFromRows(rows: unknown): BuildOptions {
  const out: BuildOptions = { ...DEFAULT_BUILD_OPTIONS };
  if (!Array.isArray(rows)) return out;
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.key !== 'string' || !isBuildOptionKey(row.key)) continue;
    if (isBuildOptionStatus(row.status)) out[row.key] = row.status;
  }
  return out;
}

const MEMO_MS = 60_000;
let memo: { at: number; value: BuildOptions } | null = null;

export function resetBuildOptionsMemo(): void {
  memo = null;
}

/** Every option's status, for the site. Never throws. */
export async function loadBuildOptions(): Promise<BuildOptions> {
  if (!isBettingConfigured()) return DEFAULT_BUILD_OPTIONS;
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  try {
    const { data, error } = await betDb()
      .from('build_option')
      .select('key, status')
      .eq('application_key', APPLICATION_KEY)
      .in('key', [...BUILD_OPTION_KEYS]);
    if (error || !data) return DEFAULT_BUILD_OPTIONS;
    const value = buildOptionsFromRows(data);
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_BUILD_OPTIONS;
  }
}

/** Whether the feature behind `key` renders. Include on any failure. */
export async function isBuildOptionIncluded(key: BuildOptionKey): Promise<boolean> {
  return (await loadBuildOptions())[key] === 'include';
}

/** An option as the editor sees it. `updatedAt` is the row's stamp exactly as
 *  PostgREST sent it (microseconds intact); null when the row does not exist,
 *  in which case the editor shows Include and cannot save. */
export interface EditableBuildOption {
  key: BuildOptionKey;
  label: string;
  status: BuildOptionStatus;
  updatedAt: string | null;
}

/** Every key, with its row when there is one. Null on any failure. */
export async function loadBuildOptionsForEditing(): Promise<EditableBuildOption[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb()
      .from('build_option')
      .select('key, label, status, updated_at')
      .eq('application_key', APPLICATION_KEY)
      .in('key', [...BUILD_OPTION_KEYS]);
    if (error) return null;
    const byKey = new Map<string, Record<string, unknown>>();
    for (const row of (data ?? []) as Record<string, unknown>[]) if (typeof row.key === 'string') byKey.set(row.key, row);
    return BUILD_OPTION_KEYS.map(key => {
      const row = byKey.get(key);
      return {
        key,
        label: row && typeof row.label === 'string' && row.label ? row.label : BUILD_OPTION_DEFAULTS[key].label,
        status: row && isBuildOptionStatus(row.status) ? row.status : 'include',
        updatedAt: row && row.updated_at != null ? String(row.updated_at) : null,
      };
    });
  } catch {
    return null;
  }
}

export { APPLICATION_KEY as BUILD_OPTION_APPLICATION_KEY };
