import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { CODE_PAGES, PAGE_GROUPS, isPageGroup, type PageAuthz, type PageGroup, type PageRendering } from './page-registry';
import { pageIdOf, type PageDestinations } from './destinations';

export { CODE_PAGES, PAGE_GROUPS, PAGE_GROUP_LABELS, isPageGroup, registryPathOf } from './page-registry';
export type { CodePage, PageAuthz, PageGroup, PageRendering } from './page-registry';

// The page registry, read from the `page` rows for this application. Phase 3
// step 1 of the designer plan; the code pages are seeded by migration
// 20260908233000.
//
// THE RULE THIS FILE ENFORCES: the code's list is the fallback. Every code page
// is listed whether or not its row exists (a missing row shows "no row yet");
// a row overlays the code's facts for the same path and brings its stamp; a row
// the parser cannot use (a path outside the rule, an unknown kind) is left out.
// Nothing on the site reads the registry yet, so there is only the editor's view.
//
// No write path in this step: code pages are the code's, and row pages (step 2)
// bring their own routes.

const APPLICATION_KEY = 'paddock';

/** A page as the App Builder lists it. `updatedAt` is the row's stamp exactly as
 *  PostgREST sent it; null when the code page has no row yet. */
export interface PageRow {
  id: string | null;
  path: string;
  name: string;
  kind: 'code' | 'row';
  /** `rows` when the catch-all serves the page from its row: every page made
   *  in the designer, and a code page whose route file has left (the
   *  components programme, R4). Absent means a route file in the code serves
   *  it. Derived from the registry, never stored. */
  served?: 'rows';
  group: PageGroup | null;
  template: string;
  authz: PageAuthz | string | null;
  title: string | null;
  rendering: PageRendering;
  indexable: boolean;
  comments: string | null;
  updatedAt: string | null;
  /** Deleted (P1.12): when, and by whom; absent on a live page. A deleted page
   *  stays RECOVERY_DAYS for Reinstate, then may be removed for good; every
   *  reader that serves visitors skips it. */
  deletedAt?: string | null;
  deletedBy?: string | null;
}

const PATH =/^\/(?:[a-z0-9-]+|\[[a-z]+\])(?:\/(?:[a-z0-9-]+|\[[a-z]+\]))*$|^\/$/;

function codePageRow(path: string): PageRow | undefined {
  const c = CODE_PAGES.find(p => p.path === path);
  if (!c) return undefined;
  return {
    id: null,
    path: c.path,
    name: c.name,
    kind: 'code',
    ...(c.served === 'rows' ? { served: 'rows' as const } : {}),
    group: c.group,
    template: 'paddock-standard',
    authz: c.authz,
    title: null,
    rendering: c.rendering,
    indexable: c.indexable,
    comments: c.note ?? null,
    updatedAt: null,
  };
}

/** A code page as the registry alone describes it (no row): what the catch-all
 *  falls back to for a page served from rows whose row cannot be read. */
export function registryPageRow(path: string): PageRow | null {
  return codePageRow(path) ?? null;
}

/** Coerce one row, or null when it cannot be used. */
export function pageFromRow(item: unknown): PageRow | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  if (typeof r.path !== 'string' || !PATH.test(r.path)) return null;
  if (r.kind !== 'code' && r.kind !== 'row') return null;
  if (typeof r.name !== 'string' || !r.name.trim()) return null;
  const registered = r.kind === 'code' ? CODE_PAGES.find(c => c.path === r.path) : undefined;
  return {
    id: typeof r.id === 'string' ? r.id : null,
    path: r.path,
    name: r.name.trim(),
    kind: r.kind,
    ...(r.kind === 'row' || registered?.served === 'rows' ? { served: 'rows' as const } : {}),
    group: isPageGroup(r.group_key) ? r.group_key : null,
    template: typeof r.template === 'string' && r.template ? r.template : 'paddock-standard',
    authz: typeof r.authz_key === 'string' ? r.authz_key : null,
    title: typeof r.title === 'string' ? r.title : null,
    rendering: r.rendering === 'dynamic' ? 'dynamic' : 'cached',
    indexable: r.indexable === true,
    comments: typeof r.comments === 'string' && r.comments ? r.comments : null,
    updatedAt: r.updated_at != null ? String(r.updated_at) : null,
    ...(r.deleted_at != null ? { deletedAt: String(r.deleted_at), deletedBy: typeof r.deleted_by === 'string' ? r.deleted_by : null } : {}),
  };
}

const GROUP_ORDER: Record<string, number> = Object.fromEntries(PAGE_GROUPS.map((g, i) => [g, i]));

/** Every code page (from its row when there is one, else from the code) and
 *  every row page, in group order then by path. */
export function pagesFromRows(rows: unknown): PageRow[] {
  const byPath = new Map<string, PageRow>();
  for (const c of CODE_PAGES) byPath.set(c.path, codePageRow(c.path)!);
  if (Array.isArray(rows)) {
    for (const item of rows) {
      const row = pageFromRow(item);
      if (!row) continue;
      byPath.set(row.path, row);
    }
  }
  const out = [...byPath.values()];
  out.sort((a, b) => {
    const ga = a.group ? GROUP_ORDER[a.group] : PAGE_GROUPS.length;
    const gb = b.group ? GROUP_ORDER[b.group] : PAGE_GROUPS.length;
    return ga - gb || a.path.localeCompare(b.path);
  });
  return out;
}

export const PAGE_COLUMNS = 'id, path, name, kind, group_key, template, authz_key, title, rendering, indexable, comments, updated_at, deleted_at, deleted_by';

/** The registry for the App Builder: the live pages (a deleted page is listed
 *  by loadDeletedPages alone, P1.12). Null on any failure. */
export async function loadPagesForEditing(): Promise<PageRow[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb().from('page').select(PAGE_COLUMNS).eq('application_key', APPLICATION_KEY).is('deleted_at', null);
    if (error) return null;
    return pagesFromRows(data ?? []);
  } catch {
    return null;
  }
}

/** The deleted pages (P1.12), the newest deletion first, for the pages list's
 *  Deleted view; only pages made in the designer can be here. Null on any failure. */
export async function loadDeletedPages(): Promise<PageRow[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb()
      .from('page')
      .select(PAGE_COLUMNS)
      .eq('application_key', APPLICATION_KEY)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    if (error) return null;
    return ((data ?? []) as unknown[]).map(pageFromRow).filter((p): p is PageRow => p !== null);
  } catch {
    return null;
  }
}

/** The live row pages a document's buttons and go effects name, by id (P1.12
 *  B2): what the served page and its dynamic actions resolve `page:` keys
 *  against. Nothing is asked when the document names no page. */
export async function loadNamedPages(dests: readonly string[]): Promise<PageDestinations> {
  const ids = dests.map(pageIdOf).filter((id): id is string => id !== null);
  if (ids.length === 0) return {};
  const live = await loadPageDestinations();
  return Object.fromEntries(ids.filter(id => id in live).map(id => [id, live[id]]));
}

/** The row pages a `page:` destination may name, by id (P1.12 B1): the live
 *  ones for the shell and the write path; with the deleted ones too for the
 *  editor, which shows an entry to a deleted page for what it is. Empty on any
 *  failure, so an unresolved entry is left out rather than the list. */
export async function loadPageDestinations(opts: { includeDeleted?: boolean } = {}): Promise<PageDestinations> {
  if (!isBettingConfigured()) return {};
  try {
    let q = betDb().from('page').select('id, path, name').eq('application_key', APPLICATION_KEY).eq('kind', 'row');
    if (!opts.includeDeleted) q = q.is('deleted_at', null);
    const { data, error } = await q;
    if (error || !Array.isArray(data)) return {};
    const out: Record<string, { path: string; name: string }> = {};
    for (const r of data as { id?: unknown; path?: unknown; name?: unknown }[]) {
      if (typeof r.id === 'string' && typeof r.path === 'string' && typeof r.name === 'string') out[r.id] = { path: r.path, name: r.name };
    }
    return out;
  } catch {
    return {};
  }
}

export { APPLICATION_KEY as PAGE_APPLICATION_KEY };
