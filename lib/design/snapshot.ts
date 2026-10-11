import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';

// One design snapshot (PF5): every design table the site reads once a minute, in
// one read of the application row with the rows that name it. Each table's
// application_key references application(key), so PostgREST embeds them. Twelve
// loaders used to read their own table, about 19,000 times a day each.
//
// THE RULE THIS FILE ENFORCES: null on any failure, and a failure is never
// memoised, so every loader falls back to what the code shipped and the next
// render asks again. Loaders that ask at the same time share one read.
//
// Each loader keeps its own parser. The column lists below are what those parsers
// read, so a column a parser starts to need is added here too (snapshot.test.ts,
// which also holds the pages' list to PAGE_COLUMNS; the list is written out so
// this module loads where a test replaces ./pages).
// A page's live revision and its row by path stay per-request reads, so a publish
// shows on the next render.

const APPLICATION_KEY = 'paddock';

export const SNAPSHOT_SELECT = [
  // The definition (application.ts) and the appearance's `ui` (appearance.ts).
  'key, name, alias, availability, home_path, description, wordmark, tagline, date_chip, install_prompt, favicon_asset_id, updated_at, ui',
  'text_message(key, text)',
  'setting(key, value)',
  'theme(key, label, tokens, is_default, available, base)',
  'authz_scheme(key, label, type, value, message)',
  'search_hint(id, question, seq, leads_to, leads_title, updated_at)',
  'shortcut(key, text)',
  'build_option(key, status)',
  'component_definition(key, overlay, updated_at, updated_by)',
  'list_entry(list_key, seq, label, dest_key, icon, authz_key)',
  'page(id, path, name, kind, group_key, template, authz_key, title, rendering, indexable, comments, updated_at, deleted_at, deleted_by)',
].join(', ');

/** The application row, with each embedded table's rows under the table's name:
 *  the live pages only, the list entries by `seq`. */
export type DesignSnapshot = Readonly<Record<string, unknown>>;

const MEMO_MS = 60_000;
let memo: { at: number; value: DesignSnapshot } | null = null;
let pending: Promise<DesignSnapshot | null> | null = null;
// A save's reset outranks a read already under way, which may hold the rows from before the save.
let generation = 0;

/** Called by every design save (through the loaders' reset…Memo), so this isolate reads the change at once. */
export function resetDesignSnapshot(): void {
  memo = null;
  pending = null;
  generation++;
}

async function read(gen: number): Promise<DesignSnapshot | null> {
  try {
    const { data, error } = await betDb()
      .from('application')
      .select(SNAPSHOT_SELECT)
      .eq('key', APPLICATION_KEY)
      .is('page.deleted_at', null)
      .order('seq', { referencedTable: 'list_entry', ascending: true });
    const row: unknown = Array.isArray(data) ? data[0] : undefined;
    if (error || !row || typeof row !== 'object') return null;
    const value = row as DesignSnapshot;
    if (gen === generation) memo = { at: Date.now(), value };
    return value;
  } catch {
    return null;
  }
}

/** The snapshot, or null when the database is unconfigured or the read fails. Never throws. */
export function loadDesignSnapshot(): Promise<DesignSnapshot | null> {
  if (!isBettingConfigured()) return Promise.resolve(null);
  if (memo && Date.now() - memo.at < MEMO_MS) return Promise.resolve(memo.value);
  if (!pending) {
    const p: Promise<DesignSnapshot | null> = read(generation).finally(() => {
      if (pending === p) pending = null;
    });
    pending = p;
  }
  return pending;
}

/** One embedded table's rows; empty when the snapshot does not carry them. */
export function snapshotRows(snapshot: DesignSnapshot, table: string): unknown[] {
  const rows = snapshot[table];
  return Array.isArray(rows) ? rows : [];
}
