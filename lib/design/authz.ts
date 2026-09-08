import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { DEFAULT_AUTHZ_SCHEMES, isAuthzType, type AuthzScheme } from './authz-defaults';

export {
  AUTHZ_LABEL_MAX,
  AUTHZ_MESSAGE_MAX,
  AUTHZ_TYPES,
  DEFAULT_AUTHZ_SCHEMES,
  authzOptions,
  describeAuthzCheck,
  isAuthzType,
} from './authz-defaults';
export type { AuthzScheme, AuthzType } from './authz-defaults';

// Authorization schemes (APEX: Authorization Schemes), read from the
// `authz_scheme` rows for this application. Phase 2 step 6 of the designer plan;
// the four rows were seeded by migration 20260908090000 and given their
// application by 20260908110000, so this step needs no migration.
//
// THE RULE THIS FILE ENFORCES: the shipped four are the fallback for every
// failure. An unconfigured database, a missing table, a query error or an empty
// table all read as the four schemes the code ships, and a row the parser cannot
// use (no key, no label, a type the code does not know) is left out rather than
// guessed at.
//
// Readers today: the lists route, which refuses an entry naming a scheme that is
// not a row, and the designer. Enforcement on the site arrives with Phase 3.
// Writes go through app/api/admin/design/authz/[key] only: one conditional
// update per row, refused when the row's updated_at moved (the 1.0.25 pattern).

const APPLICATION_KEY = 'paddock';
const SLUG = /^[a-z0-9_-]+$/;

/** The four shipped keys first, in their order; anything else after, by key. */
function order(a: AuthzScheme, b: AuthzScheme): number {
  const rank = (s: AuthzScheme) => {
    const i = DEFAULT_AUTHZ_SCHEMES.findIndex(d => d.key === s.key);
    return i === -1 ? DEFAULT_AUTHZ_SCHEMES.length : i;
  };
  return rank(a) - rank(b) || a.key.localeCompare(b.key);
}

/** Coerce rows into schemes; a row the code cannot use is left out. An empty
 *  result means "nothing usable", which the loaders turn into the shipped four. */
export function authzFromRows(rows: unknown): AuthzScheme[] {
  if (!Array.isArray(rows)) return [];
  const out: AuthzScheme[] = [];
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.key !== 'string' || !SLUG.test(row.key)) continue;
    if (typeof row.label !== 'string' || !row.label.trim()) continue;
    if (!isAuthzType(row.type)) continue;
    out.push({
      key: row.key,
      label: row.label.trim(),
      type: row.type,
      value: typeof row.value === 'string' && row.value.trim() ? row.value.trim() : null,
      message: typeof row.message === 'string' && row.message.trim() ? row.message.trim() : null,
    });
  }
  return out.sort(order);
}

const MEMO_MS = 60_000;
let memo: { at: number; value: AuthzScheme[] } | null = null;

export function resetAuthzMemo(): void {
  memo = null;
}

/** Every scheme, for the site and the lists route. Never throws. */
export async function loadAuthzSchemes(): Promise<readonly AuthzScheme[]> {
  if (!isBettingConfigured()) return DEFAULT_AUTHZ_SCHEMES;
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  try {
    const { data, error } = await betDb()
      .from('authz_scheme')
      .select('key, label, type, value, message')
      .eq('application_key', APPLICATION_KEY);
    if (error || !data) return DEFAULT_AUTHZ_SCHEMES;
    const value = authzFromRows(data);
    if (value.length === 0) return DEFAULT_AUTHZ_SCHEMES;
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_AUTHZ_SCHEMES;
  }
}

/** A scheme as the editor sees it. `updatedAt` is the row's stamp exactly as
 *  PostgREST sent it (microseconds intact); null when the row does not exist,
 *  in which case the editor shows the shipped scheme and cannot save. */
export interface EditableAuthzScheme extends AuthzScheme {
  updatedAt: string | null;
}

/** Every row, or the shipped four with no stamp when the table has none. Null
 *  on any failure. */
export async function loadAuthzForEditing(): Promise<EditableAuthzScheme[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb()
      .from('authz_scheme')
      .select('key, label, type, value, message, updated_at')
      .eq('application_key', APPLICATION_KEY);
    if (error) return null;
    const rows = (data ?? []) as Record<string, unknown>[];
    const schemes = authzFromRows(rows);
    if (schemes.length === 0) return DEFAULT_AUTHZ_SCHEMES.map(s => ({ ...s, updatedAt: null }));
    const stampOf = new Map<string, string | null>();
    for (const row of rows) {
      if (typeof row.key === 'string') stampOf.set(row.key, row.updated_at != null ? String(row.updated_at) : null);
    }
    return schemes.map(s => ({ ...s, updatedAt: stampOf.get(s.key) ?? null }));
  } catch {
    return null;
  }
}

export { APPLICATION_KEY as AUTHZ_APPLICATION_KEY };
