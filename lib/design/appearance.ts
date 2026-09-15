import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { SHIPPED_APPEARANCE, parseAppearance, type Appearance } from './appearance-defaults';

export {
  APPEARANCE_RANGES,
  FACES,
  FACE_ROLES,
  FACE_ROLE_LABELS,
  MOTIONS,
  MOTION_LABELS,
  MOTION_MS,
  SHIPPED_APPEARANCE,
  appearanceCss,
  appearanceWarnings,
  faceByKey,
  facesForRole,
  isShippedAppearance,
  parseAppearance,
  roundTo,
} from './appearance-defaults';
export type { Appearance, Face, FaceRole, Motion, NumericKey, ParsedAppearance } from './appearance-defaults';
export type { TemplatePresets } from './template-options';

// Appearance (APEX: User Interface Attributes), read from the application row's
// `ui` document. Phase 2 step 8 of the designer plan; the column comes from
// migration 20260908210000.
//
// THE RULE THIS FILE ENFORCES: what the code shipped is the fallback for every
// failure, key by key. An unconfigured database, a missing column, a query
// error, a missing row, an empty document or a value the parser refuses all
// read as exactly what the site shipped. A document can never blank the page or
// shrink its type below the gate.
//
// Writes go through app/api/admin/design/appearance only: one conditional
// update on the row's `updated_at`, refused when it moved (the 1.0.25 pattern),
// and refused before the database when the gate finds a problem.

const APPLICATION_KEY = 'paddock';

const MEMO_MS = 60_000;
let memo: { at: number; value: Appearance } | null = null;

export function resetAppearanceMemo(): void {
  memo = null;
}

/** The appearance for the site's layout. Never throws. */
export async function loadAppearance(): Promise<Appearance> {
  if (!isBettingConfigured()) return SHIPPED_APPEARANCE;
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  try {
    const { data, error } = await betDb().from('application').select('ui').eq('key', APPLICATION_KEY);
    if (error || !data || data.length === 0) return SHIPPED_APPEARANCE;
    const value = parseAppearance((data[0] as { ui?: unknown }).ui).value;
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return SHIPPED_APPEARANCE;
  }
}

/** The appearance as the editor sees it, with the application row's stamp
 *  exactly as PostgREST sent it (microseconds intact); the stamp is null when
 *  the row does not exist, in which case the editor shows the shipped values and
 *  cannot save. */
export interface EditableAppearance {
  appearance: Appearance;
  updatedAt: string | null;
}

/** The stored appearance and its stamp; the shipped values with no stamp when
 *  there is no row. Null on any failure. */
export async function loadAppearanceForEditing(): Promise<EditableAppearance | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb().from('application').select('ui, updated_at').eq('key', APPLICATION_KEY);
    if (error) return null;
    const row = (data ?? [])[0] as { ui?: unknown; updated_at?: unknown } | undefined;
    if (!row) return { appearance: SHIPPED_APPEARANCE, updatedAt: null };
    return {
      appearance: parseAppearance(row.ui).value,
      updatedAt: row.updated_at != null ? String(row.updated_at) : null,
    };
  } catch {
    return null;
  }
}

export { APPLICATION_KEY as APPEARANCE_APPLICATION_KEY };
