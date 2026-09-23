import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { latestRevisions, readUsageRows } from './definitions';
import { loadLivePage } from './live-page';
import { loadPagesForEditing } from './pages';
import { SHAPES, findPreset, type Shape } from './presets';
import { VIEW_NAME_MAX, isViewKey, parseViewDefinition, type ViewDefinition } from './view-state';

// Saved views (P2.3 PR B; APEX: an Interactive Report's saved reports, the designer-authored tiers alone), read from the
// `saved_view` rows for this application: one row per named Alternative of a Data region on one page, its definition the
// vocabulary's parameters (lib/design/view-state.ts). Primary is the region as designed and has no row.
//
// THE RULE THIS FILE ENFORCES: a row the parser cannot use (a key outside the rule, a definition the vocabulary does not
// say, a region id or a name out of shape) is left out rather than guessed at, and any failure reads as no views at all.
// Writes go through app/api/admin/design/views/* only: an insert for a new key, one conditional update or delete per row on
// the stamp the caller loaded (the shortcuts' pattern).

const APPLICATION_KEY = 'paddock';
export { APPLICATION_KEY as SAVED_VIEW_APPLICATION_KEY };
/** A region id as the designer writes them. */
export const REGION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
export const SEQ_MAX = 999;

export interface SavedView {
  key: string;
  pageId: string;
  regionId: string;
  name: string;
  definition: ViewDefinition;
  seq: number;
}
/** A saved view as the editor sees it: a row, so it always has a stamp, exactly as PostgREST sent it. */
export interface EditableSavedView extends SavedView {
  updatedAt: string;
}

const usableName = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= VIEW_NAME_MAX;

/** Coerce rows into views, leaving out anything unusable; by seq, then name, then key. */
export function viewsFromRows(rows: unknown): EditableSavedView[] {
  const out: EditableSavedView[] = [];
  if (!Array.isArray(rows)) return out;
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const definition = parseViewDefinition(row.definition);
    if (!isViewKey(row.key) || typeof row.page_id !== 'string' || !row.page_id || typeof row.region_id !== 'string' || !REGION_ID.test(row.region_id) || !usableName(row.name) || !definition || row.updated_at == null) continue;
    const seq = typeof row.seq === 'number' && Number.isInteger(row.seq) ? row.seq : 10;
    out.push({ key: row.key, pageId: row.page_id, regionId: row.region_id, name: row.name.trim(), definition, seq, updatedAt: String(row.updated_at) });
  }
  out.sort((a, b) => a.seq - b.seq || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
  return out;
}

const COLUMNS = 'key, page_id, region_id, name, definition, seq, updated_at';
const MEMO_MS = 60_000;
let memo: { at: number; value: SavedView[] } | null = null;

export function resetViewsMemo(): void {
  memo = null;
}

async function loadAll(): Promise<SavedView[]> {
  if (!isBettingConfigured()) return [];
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  try {
    const { data, error } = await betDb().from('saved_view').select(COLUMNS).eq('application_key', APPLICATION_KEY);
    if (error || !data) return [];
    const value = viewsFromRows(data);
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return [];
  }
}

/** The Alternatives of one region on one page, in their order (the served page's Views menu and ?view=). Never throws. */
export async function loadViewsFor(pageId: string, regionId: string): Promise<SavedView[]> {
  return (await loadAll()).filter(v => v.pageId === pageId && v.regionId === regionId);
}

/** Every usable row with its stamp, for the editor. Null on any failure; empty when there are none. */
export async function loadViewsForEditing(): Promise<EditableSavedView[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb().from('saved_view').select(COLUMNS).eq('application_key', APPLICATION_KEY);
    if (error) return null;
    return viewsFromRows(data ?? []);
  } catch {
    return null;
  }
}

/** A page a view may belong to and its Data regions (the editor's Page and Region picks, and each view's Utilization):
 *  every live page whose newest or live revision holds one; a region on the newest revision alone is not live yet. */
export interface ViewTarget {
  pageId: string;
  path: string;
  name: string;
  regions: { id: string; label: string; live: boolean }[];
}

export function targetsFromRows(pages: unknown, revisions: unknown): ViewTarget[] {
  const out: ViewTarget[] = [];
  const dataRegions = (regions: unknown[] | null) => {
    const found = new Map<string, string>();
    for (const item of regions ?? []) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      if (r.kind !== 'component' || r.component !== 'data.region' || typeof r.id !== 'string' || !REGION_ID.test(r.id)) continue;
      const settings = (r.settings ?? {}) as Record<string, unknown>;
      const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim() : typeof settings.heading === 'string' && settings.heading.trim() ? settings.heading.trim() : '';
      found.set(r.id, title ? `${title} (${r.id})` : `Data region ${r.id}`);
    }
    return found;
  };
  for (const { page, newest, live } of latestRevisions(pages, revisions)) {
    const onNewest = dataRegions(newest);
    const onLive = dataRegions(live);
    const ids = new Set([...onNewest.keys(), ...onLive.keys()]);
    if (ids.size === 0) continue;
    out.push({ pageId: page.id, path: page.path, name: page.name, regions: [...ids].sort().map(id => ({ id, label: onLive.get(id) ?? onNewest.get(id)!, live: onLive.has(id) })) });
  }
  return out;
}

/** The targets from the live pages and their revisions, one scan (never a document read per row). Null on any failure. */
export async function loadViewTargets(): Promise<ViewTarget[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const rows = await readUsageRows();
    return rows ? targetsFromRows(rows.pages, rows.revisions) : null;
  } catch {
    return null;
  }
}

/** The shape a view's definition binds to: the page's live Data region and its preset. Null when the page, its live revision,
 *  the region or its preset is missing — a view is saved against what readers see. */
export async function loadRegionShape(pageId: string, regionId: string): Promise<{ path: string; shape: Shape } | null> {
  const pages = await loadPagesForEditing();
  const page = pages?.find(p => p.id === pageId);
  if (!page) return null;
  const live = await loadLivePage(page.path);
  const region = live?.document.regions.find(r => r.kind === 'component' && r.component === 'data.region' && r.id === regionId);
  if (!region || region.kind !== 'component') return null;
  const preset = findPreset(typeof region.settings.preset === 'string' ? region.settings.preset : '');
  return preset ? { path: page.path, shape: SHAPES[preset.shape] } : null;
}
