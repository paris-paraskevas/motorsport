import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { APPLICATION_KEY, DEFAULT_DEFINITION, definitionFromRow, type ApplicationDefinition } from './application-defaults';

export { APPLICATION_KEY, DEFAULT_DEFINITION, definitionFromRow, definitionToRow, parseDefinition } from './application-defaults';
export type { ApplicationDefinition, Availability } from './application-defaults';

// The application row for the shell (once a minute per isolate, the defaults
// on any failure) and for the designer's Application Definition editor (with
// the row's stamp). The same four failure paths as every design loader:
// unconfigured, error, empty, unusable row.

const COLUMNS = 'key, name, alias, availability, home_path, description, wordmark, tagline, date_chip, install_prompt, favicon_asset_id, updated_at';
const MEMO_MS = 60_000;
let memo: { at: number; value: ApplicationDefinition } | null = null;

export function resetApplicationMemo(): void {
  memo = null;
}

/** The definition the shell reads. Never throws. */
export async function loadApplicationDefinition(): Promise<ApplicationDefinition> {
  if (!isBettingConfigured()) return DEFAULT_DEFINITION;
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  try {
    const { data, error } = await betDb().from('application').select(COLUMNS).eq('key', APPLICATION_KEY);
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (error || !row) return DEFAULT_DEFINITION;
    const value = definitionFromRow(row);
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_DEFINITION;
  }
}

/** The definition as the editor sees it, with the row's stamp exactly as
 *  PostgREST sent it. Null when the row cannot be read. */
export interface EditableApplication {
  definition: ApplicationDefinition;
  updatedAt: string;
}

export async function loadApplicationForEditing(): Promise<EditableApplication | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb().from('application').select(COLUMNS).eq('key', APPLICATION_KEY);
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (error || !row || row.updated_at == null) return null;
    return { definition: definitionFromRow(row), updatedAt: String(row.updated_at) };
  } catch {
    return null;
  }
}
