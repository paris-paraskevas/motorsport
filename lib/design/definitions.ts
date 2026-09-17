import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { COMPONENTS, type ComponentDefinition } from './components';
import { DEFINITIONS, EMPTY_OVERLAY, isDefinitionKey, mergeDefinition, mergeDefinitions, parseOverlay, type DefinitionOverlay, type EditableDefinition } from './component-definitions';
import { encodeSourceRef, parseSourceRef } from './sources';

// The component definitions as the site and the designer read them (the
// components programme, P2.0, PR B; APEX: Plug-ins): the code's definitions
// (lib/design/component-definitions.ts) with the `component_definition` rows
// merged over them, one row per definition the operator added attributes or
// groups to (migration 20260917100000).
//
// THE RULE THIS FILE ENFORCES: the code's definition is the fallback for every
// failure. An unconfigured database, a missing table, a query error, a row for
// a key the code does not define, or an overlay the rules refuse, all read as
// the code's definition alone. A row can add to a definition; it can never
// change or remove what a renderer reads.
//
// Writes go through app/api/admin/design/definitions/[key] only: an insert for
// a definition with no row yet, else one conditional update on the stamp the
// caller loaded (the 1.0.25 pattern), after the guard that keeps an attribute a
// page still carries.

const APPLICATION_KEY = 'paddock';
const MEMO_MS = 60_000;

interface Stamp {
  updatedAt: string;
  updatedBy: string | null;
}

function readRows(rows: unknown): { overlays: Record<string, DefinitionOverlay>; stamps: Record<string, Stamp> } {
  const overlays: Record<string, DefinitionOverlay> = {};
  const stamps: Record<string, Stamp> = {};
  if (!Array.isArray(rows)) return { overlays, stamps };
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.key !== 'string' || !isDefinitionKey(row.key)) continue;
    const shipped = DEFINITIONS.find(d => d.key === row.key)!;
    const parsed = parseOverlay(row.overlay, shipped);
    if (parsed.problems.length) continue;
    overlays[row.key] = parsed.value;
    if (row.updated_at != null) stamps[row.key] = { updatedAt: String(row.updated_at), updatedBy: typeof row.updated_by === 'string' ? row.updated_by : null };
  }
  return { overlays, stamps };
}

/** Rows → overlays by key, each read against its shipped definition; a row for
 *  a key the code does not define, or one the rules refuse, is left out. */
export function overlaysFromRows(rows: unknown): Record<string, DefinitionOverlay> {
  return readRows(rows).overlays;
}

let memo: { at: number; overlays: Record<string, DefinitionOverlay> } | null = null;

export function resetDefinitionsMemo(): void {
  memo = null;
}

/** The usable overlays, by definition key. Never throws; empty on any failure. */
export async function loadOverlays(): Promise<Record<string, DefinitionOverlay>> {
  if (!isBettingConfigured()) return {};
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.overlays;
  try {
    const { data, error } = await betDb().from('component_definition').select('key, overlay, updated_at, updated_by').eq('application_key', APPLICATION_KEY);
    if (error || !data) return {};
    const overlays = overlaysFromRows(data);
    memo = { at: Date.now(), overlays };
    return overlays;
  } catch {
    return {};
  }
}

/** One definition's row as it is NOW, read fresh (no memo): what the write
 *  path's guard compares against, so a stale isolate can never let an
 *  attribute a page carries slip out. Null when there is no row; throws when
 *  the read fails, so the caller stops rather than guard blind. */
export async function loadOverlayRow(key: string): Promise<{ overlay: DefinitionOverlay; updatedAt: string; updatedBy: string | null } | null> {
  const { data, error } = await betDb().from('component_definition').select('key, overlay, updated_at, updated_by').eq('application_key', APPLICATION_KEY).eq('key', key);
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]).filter(r => r && r.key === key) : [];
  const { overlays, stamps } = readRows(rows);
  const stamp = stamps[key];
  return overlays[key] && stamp ? { overlay: overlays[key], updatedAt: stamp.updatedAt, updatedBy: stamp.updatedBy } : null;
}

/** Every definition, the code's merged with its row. */
export async function loadDefinitions(): Promise<ComponentDefinition[]> {
  return mergeDefinitions(DEFINITIONS, await loadOverlays());
}

/** The component kinds, merged: what the parser and the renderers take. */
export async function loadComponents(): Promise<ComponentDefinition[]> {
  return mergeDefinitions(COMPONENTS, await loadOverlays());
}

export interface UsagePage {
  id: string;
  path: string;
  name: string;
  /** The attribute keys the page's regions of this type carry, on its newest and its live revision. */
  attributes: string[];
}
export interface Usage {
  usedOn: UsagePage[];
  regions: number;
}

const REGION_KINDS = new Set(['static', 'image', 'list', 'button']);

interface PageLatest {
  page: { id: string; path: string; name: string };
  /** The newest revision's regions, and the live one's; the same array when the newest is live. */
  newest: unknown[] | null;
  live: unknown[] | null;
}

/** The pages with their newest and their live revision's regions (the rule
 *  every Utilization scan shares: a page carries what its newest revision
 *  holds, and what its live one still shows). A raw read of the rows. */
function latestRevisions(pages: unknown, revisions: unknown): PageLatest[] {
  if (!Array.isArray(pages) || !Array.isArray(revisions)) return [];
  const byPage = new Map<string, { created: string; published: boolean; regions: unknown[] }[]>();
  for (const item of revisions) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.page_id !== 'string') continue;
    const doc = r.document && typeof r.document === 'object' ? (r.document as Record<string, unknown>) : null;
    const regions = doc && Array.isArray(doc.regions) ? (doc.regions as unknown[]) : [];
    const list = byPage.get(r.page_id) ?? [];
    list.push({ created: String(r.created_at ?? ''), published: r.published_at != null, regions });
    byPage.set(r.page_id, list);
  }
  const out: PageLatest[] = [];
  for (const item of pages) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== 'string' || typeof p.path !== 'string' || typeof p.name !== 'string') continue;
    const revs = [...(byPage.get(p.id) ?? [])].sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
    const newest = revs[0];
    const live = revs.find(r => r.published);
    out.push({ page: { id: p.id, path: p.path, name: p.name }, newest: newest?.regions ?? null, live: live?.regions ?? null });
  }
  return out;
}

/** Utilization from the live pages and their revisions (newest first): for each
 *  definition, the pages whose newest or live revision uses it, with the
 *  attribute keys those regions carry, and the count of regions of that type
 *  on the newest revisions. A raw scan, so a value of an attribute the code no
 *  longer knows still counts. */
export function usageFromRows(pages: unknown, revisions: unknown): Record<string, Usage> {
  const out: Record<string, Usage> = {};
  const keys = new Map<string, Map<string, Set<string>>>();
  const scan = (page: { id: string; path: string; name: string }, regions: unknown[], count: boolean) => {
    for (const item of regions) {
      if (!item || typeof item !== 'object') continue;
      const region = item as Record<string, unknown>;
      const key = region.kind === 'component' && typeof region.component === 'string' ? region.component : typeof region.kind === 'string' && REGION_KINDS.has(region.kind) ? `region.${region.kind}` : null;
      if (!key) continue;
      const usage = (out[key] ??= { usedOn: [], regions: 0 });
      let entry = usage.usedOn.find(p => p.id === page.id);
      if (!entry) {
        entry = { id: page.id, path: page.path, name: page.name, attributes: [] };
        usage.usedOn.push(entry);
      }
      if (count) usage.regions += 1;
      if (region.kind === 'component' && region.settings && typeof region.settings === 'object') {
        const perKey = keys.get(key) ?? new Map<string, Set<string>>();
        const set = perKey.get(page.id) ?? new Set<string>();
        for (const k of Object.keys(region.settings as Record<string, unknown>)) set.add(k);
        perKey.set(page.id, set);
        keys.set(key, perKey);
      }
    }
  };
  for (const { page, newest, live } of latestRevisions(pages, revisions)) {
    if (newest) scan(page, newest, true);
    if (live && live !== newest) scan(page, live, false);
  }
  for (const [key, perKey] of keys) for (const entry of out[key]?.usedOn ?? []) entry.attributes = [...(perKey.get(entry.id) ?? [])].sort();
  return out;
}

/** A page a source is used on (P2.1; APEX: a REST Data Source's Utilization), with the refs its regions carry. */
export interface SourceUsagePage {
  id: string;
  path: string;
  name: string;
  refs: string[];
}

/** Utilization of the sources: for each catalogue source, the pages whose
 *  newest or live revision has a component region picking it, with the refs
 *  (canonical, sorted). The same raw scan as the definitions'; a ref the
 *  catalogue refuses is left out, never a throw. */
export function sourceUsageFromRows(pages: unknown, revisions: unknown): Record<string, SourceUsagePage[]> {
  const out: Record<string, SourceUsagePage[]> = {};
  for (const { page, newest, live } of latestRevisions(pages, revisions)) {
    for (const regions of [newest, live]) {
      if (!regions) continue;
      for (const item of regions) {
        if (!item || typeof item !== 'object') continue;
        const region = item as Record<string, unknown>;
        if (region.kind !== 'component' || typeof region.source !== 'string' || !region.source) continue;
        const parsed = parseSourceRef(region.source);
        if (!parsed.value) continue;
        const list = (out[parsed.value.source] ??= []);
        let entry = list.find(p => p.id === page.id);
        if (!entry) {
          entry = { ...page, refs: [] };
          list.push(entry);
        }
        const canonical = encodeSourceRef(parsed.value);
        if (!entry.refs.includes(canonical)) entry.refs.push(canonical);
      }
    }
  }
  for (const list of Object.values(out)) for (const entry of list) entry.refs.sort();
  return out;
}

async function readUsageRows(): Promise<{ pages: unknown; revisions: unknown } | null> {
  const [pagesRes, revRes] = await Promise.all([
    betDb().from('page').select('id, path, name').eq('application_key', APPLICATION_KEY).is('deleted_at', null).order('name'),
    betDb().from('page_revision').select('page_id, document, published_at, created_at').order('created_at', { ascending: false }),
  ]);
  if (pagesRes.error || revRes.error) return null;
  return { pages: pagesRes.data, revisions: revRes.data };
}

async function readUsage(): Promise<Record<string, Usage> | null> {
  const rows = await readUsageRows();
  return rows ? usageFromRows(rows.pages, rows.revisions) : null;
}

/** Utilization of every source in use (P2.1). Empty on any failure. */
export async function loadSourceUsage(): Promise<Record<string, SourceUsagePage[]>> {
  if (!isBettingConfigured()) return {};
  try {
    const rows = await readUsageRows();
    return rows ? sourceUsageFromRows(rows.pages, rows.revisions) : {};
  } catch {
    return {};
  }
}

/** Utilization for every definition in use. Empty on any failure. */
export async function loadUsage(): Promise<Record<string, Usage>> {
  if (!isBettingConfigured()) return {};
  try {
    return (await readUsage()) ?? {};
  } catch {
    return {};
  }
}

/** Every definition for the Plug-ins page, in the code's order. Null on any failure. */
export async function loadDefinitionsForEditing(): Promise<EditableDefinition[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const [rowsRes, usage] = await Promise.all([
      betDb().from('component_definition').select('key, overlay, updated_at, updated_by').eq('application_key', APPLICATION_KEY),
      readUsage(),
    ]);
    if (rowsRes.error || !usage) return null;
    const { overlays, stamps } = readRows(rowsRes.data);
    return DEFINITIONS.map(d => {
      const overlay = overlays[d.key] ?? EMPTY_OVERLAY;
      const u = usage[d.key];
      return {
        key: d.key,
        definition: mergeDefinition(d, overlay),
        overlay,
        updatedAt: stamps[d.key]?.updatedAt ?? null,
        updatedBy: stamps[d.key]?.updatedBy ?? null,
        usedOn: (u?.usedOn ?? []).map(({ id, path, name }) => ({ id, path, name })),
        regions: u?.regions ?? 0,
      };
    });
  } catch {
    return null;
  }
}

export { APPLICATION_KEY as DEFINITION_APPLICATION_KEY };
