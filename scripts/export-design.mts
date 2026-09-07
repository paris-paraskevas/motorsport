/**
 * Export the design and editorial tables as JSON, for the `export/design` branch.
 *
 *   npx tsx scripts/export-design.mts --out export-branch/export
 *
 * WHY. The database is the source of truth and the audit trail (revisions, never
 * overwrites), but the Supabase organisation is on the Free plan: no backups and
 * no point-in-time recovery (checked 2026-09-07). This is the off-platform copy,
 * committed weekly by .github/workflows/export-design.yml to a branch that is
 * never merged: not main (a bot push there is an unreviewed deploy) and not
 * content/ (that folder ships inside the Worker). Operator decision 2026-09-08.
 *
 * Deterministic on purpose: rows are sorted by a stable key per table and the
 * manifest carries counts, not a timestamp, so an unchanged database produces an
 * unchanged tree and the workflow commits nothing.
 *
 * Exits 2 when the database is not configured and 1 when any table fails to
 * read. Nothing is written in either case, so a previous good export is never
 * overwritten by a partial one.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { betDb, isBettingConfigured } from '../lib/betting/client';

// Table -> the columns that order its rows. A key where the table has one;
// created_at then id for append-only tables (id alone is a uuid and would
// shuffle the file on every run).
const TABLES: Record<string, string[]> = {
  application: ['key'],
  page_group: ['key'],
  authz_scheme: ['key'],
  build_option: ['key'],
  asset: ['r2_key'],
  page: ['path'],
  page_revision: ['created_at', 'id'],
  page_revision_ref: ['revision_id', 'kind', 'id'],
  list: ['key'],
  list_entry: ['list_key', 'seq', 'id'],
  theme: ['key'],
  setting: ['key'],
  text_message: ['key'],
  shortcut: ['key'],
  redirect: ['from_path'],
  // Editorial: human-authored, and just as unbacked-up as the design rows.
  page_layout: ['created_at', 'id'],
  post: ['created_at', 'id'],
  author: ['created_at', 'id'],
};

// PostgREST's default ceiling per request; anything larger is paged.
const PAGE = 1000;

type Row = Record<string, unknown>;

async function readAll(table: string, order: string[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = betDb().from(table).select('*').range(from, from + PAGE - 1);
    for (const column of order) query = query.order(column, { ascending: true });
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function main(): Promise<number> {
  const outFlag = process.argv.indexOf('--out');
  const out = outFlag >= 0 && process.argv[outFlag + 1] ? process.argv[outFlag + 1] : 'export';

  if (!isBettingConfigured()) {
    console.error('FAILED: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set; nothing exported.');
    return 2;
  }

  const files = new Map<string, string>();
  const counts: Record<string, number> = {};
  for (const [table, order] of Object.entries(TABLES)) {
    try {
      const rows = await readAll(table, order);
      files.set(`${table}.json`, JSON.stringify(rows, null, 2) + '\n');
      counts[table] = rows.length;
      console.error(`  ${table.padEnd(18)} ${String(rows.length).padStart(6)} rows`);
    } catch (err) {
      console.error(`FAILED: ${err instanceof Error ? err.message : String(err)}; nothing written.`);
      return 1;
    }
  }
  files.set('_manifest.json', JSON.stringify({ tables: counts }, null, 2) + '\n');

  mkdirSync(out, { recursive: true });
  for (const [name, body] of files) writeFileSync(join(out, name), body);
  console.error(`OK: ${Object.keys(counts).length} tables written to ${out}/`);
  return 0;
}

// `process.exitCode` rather than `process.exit()`: the Supabase client keeps a
// handle open and tearing it down mid-flight trips a libuv assertion on Windows.
main().then(code => {
  process.exitCode = code;
});
