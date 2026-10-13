import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { APPLICATION_KEY, DEFAULT_DEFINITION, definitionFromRow, type ApplicationDefinition } from './application-defaults';
import { loadDesignSnapshot, resetDesignSnapshot } from './snapshot';

export { APPLICATION_KEY, DEFAULT_DEFINITION, definitionFromRow, definitionToRow, parseDefinition } from './application-defaults';
export type { ApplicationDefinition, Availability } from './application-defaults';

// The application row for the shell (from the design snapshot, once a minute
// per isolate; the defaults on any failure) and for the designer's Application
// Definition editor (with the row's stamp). The same four failure paths as
// every design loader: unconfigured, error, empty, unusable row.

const COLUMNS = 'key, name, alias, availability, home_path, description, wordmark, tagline, date_chip, install_prompt, favicon_asset_id, updated_at';

export function resetApplicationMemo(): void {
  resetDesignSnapshot();
}

/** The definition the shell reads. Never throws. */
export async function loadApplicationDefinition(): Promise<ApplicationDefinition> {
  const snapshot = await loadDesignSnapshot();
  return snapshot ? definitionFromRow(snapshot) : DEFAULT_DEFINITION;
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
