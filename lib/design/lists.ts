import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { BAR_MAX, BAR_MIN, NAV_LIST_KEYS, pageIdOf, resolveDestination, type ListRole, type NavEntry, type NavListKey, type NavLists, type PageDestinations } from './destinations';
import { loadPageDestinations } from './pages';

export { BAR_MAX, BAR_MIN, NAV_LIST_KEYS } from './destinations';
export type { ListRole, NavEntry, NavListKey, NavLists } from './destinations';
// The rules for a list of the operator's own are client-safe (the editor greys
// Create out before the route would refuse) and live beside the table operations.
export { LIST_KEY_MAX, LIST_LABEL_MAX, listKeyProblem, listLabelProblem } from './list-edit';

// The navigation lists (APEX: Lists, Navigation Menu, Navigation Bar List), read
// from the `list` / `list_entry` rows for this application and rendered by the
// shell. Phase 2 of the designer plan; the tables and the seeds are migrations
// 20260908090000, 20260908110000 and 20260908130000.
//
// THE RULE THIS FILE ENFORCES: the code below is the fallback for every failure.
// A missing table, an unconfigured database, a query error, an entry naming a
// destination the catalogue does not know, an empty list, or a phone bar outside
// three to five cells all land on today's hard-coded navigation, list by list.
// A row can never blank the header, the bar or the footer.
//
// Writes go through the database function design_save_list() and the route
// app/api/admin/design/lists/[key] only.

export const APPLICATION_KEY = 'paddock';

/** What the components rendered before Phase 2, and what they fall back to. */
export const DEFAULT_NAV: NavLists = {
  doors: [
    { label: 'Calendar', dest: 'calendar' },
    { label: 'Learn', dest: 'learn' },
    { label: 'Series', dest: 'series' },
    { label: 'Blog', dest: 'blog' },
  ],
  bar: [
    { label: 'Home', dest: 'home', icon: 'house' },
    { label: 'Calendar', dest: 'calendar', icon: 'calendar-days' },
    { label: 'Learn', dest: 'learn', icon: 'compass' },
    { label: 'Account', dest: 'account', icon: 'circle-user' },
  ],
  footerSite: [
    { label: 'Home', dest: 'home' },
    { label: 'About', dest: 'about' },
    { label: 'Learn', dest: 'learn' },
    { label: 'News', dest: 'news' },
    { label: 'Blog', dest: 'blog' },
    { label: 'Write for Paddock', dest: 'write-for-us' },
    { label: 'Threads', dest: 'threads' },
    { label: 'Release notes', dest: 'changelog' },
    { label: 'Season archive', dest: 'archive' },
    { label: 'Account', dest: 'account' },
    { label: 'Contact', dest: 'action:contact' },
    { label: 'Buy me a coffee', dest: 'external:support' },
    { label: 'Manage cookies', dest: 'action:cookies' },
  ],
  footerLegal: [
    { label: 'Privacy', dest: 'privacy' },
    { label: 'Terms', dest: 'terms' },
    { label: 'Cookies', dest: 'cookies' },
    { label: 'Accessibility', dest: 'accessibility' },
    { label: 'Do Not Sell or Share', dest: 'do-not-sell' },
    { label: 'Imprint', dest: 'imprint' },
  ],
  // X13: the footer's third column, every championship's hub one click from any page, in the series index's order.
  footerSeries: [
    { label: 'Formula 1', dest: 'series:f1' },
    { label: 'Formula 2', dest: 'series:f2' },
    { label: 'Formula 3', dest: 'series:f3' },
    { label: 'Formula E', dest: 'series:formula-e' },
    { label: 'MotoGP', dest: 'series:motogp' },
    { label: 'FIA WEC', dest: 'series:wec' },
    { label: 'IMSA', dest: 'series:imsa' },
    { label: 'GT World Challenge', dest: 'series:gt-world' },
    { label: 'DTM', dest: 'series:dtm' },
    { label: 'IndyCar', dest: 'series:indycar' },
    { label: 'NASCAR Cup', dest: 'series:nascar-cup' },
    { label: 'WorldSBK', dest: 'series:wsbk' },
    { label: 'WRC', dest: 'series:wrc' },
    { label: 'ADAC Ravenol 24h Nürburgring', dest: 'series:adac-ravenol-24h' },
    { label: 'NLS Nürburgring', dest: 'series:nls' },
  ],
};

const FIELD: Record<NavListKey, keyof NavLists> = {
  doors: 'doors',
  bar: 'bar',
  'footer-site': 'footerSite',
  'footer-legal': 'footerLegal',
  'footer-series': 'footerSeries',
};

const ROLE: Record<NavListKey, ListRole> = {
  doors: 'menu',
  bar: 'bar',
  'footer-site': 'footer',
  'footer-legal': 'footer',
  'footer-series': 'footer',
};

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * Coerce rows (or any JSON) into entries. A row without a label, or naming a
 * destination the catalogue does not know, is dropped on its own; nothing usable
 * returns null so the caller falls back to the default. A bar outside BAR_MIN..BAR_MAX
 * also returns null: the design cannot render it. A page key (P1.12 B1) resolves
 * against `pages` and carries the page's path as the entry's href; without the
 * map, or for a page not in it, the row is dropped like an unknown key.
 */
export function parseEntries(raw: unknown, role: ListRole, pages?: PageDestinations): NavEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: NavEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const label = text(row.label);
    const dest = text(row.dest_key) ?? text(row.dest);
    if (!label || !dest) continue;
    const resolved = resolveDestination(dest, pages);
    if (!resolved) continue;
    const entry: NavEntry = { label, dest };
    if (pageIdOf(dest) && resolved.kind === 'route') entry.href = resolved.href;
    const icon = text(row.icon);
    if (icon) entry.icon = icon;
    const authz = text(row.authz_key) ?? text(row.authz);
    if (authz) entry.authz = authz;
    const note = text(row.note);
    if (note) entry.note = note;
    out.push(entry);
  }
  if (out.length === 0) return null;
  if (role === 'bar' && (out.length < BAR_MIN || out.length > BAR_MAX)) return null;
  return out;
}

// One read per isolate per minute: the lists render inside the layout of every
// page, and a save calls resetNavListsMemo() so its own isolate sees it at once;
// the others catch up within the minute (field guide §03: "a minute for the
// in-process nav cache").
const MEMO_MS = 60_000;
let memo: { at: number; value: NavLists } | null = null;

export function resetNavListsMemo(): void {
  memo = null;
}

/** The five lists for the shell, from rows where they are usable and from the
 *  defaults where they are not. Never throws. */
export async function loadNavLists(): Promise<NavLists> {
  if (!isBettingConfigured()) return DEFAULT_NAV;
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  try {
    // The live row pages the entries may name (P1.12 B1), read with the entries; a deleted page's entry leaves with it.
    const [{ data, error }, pages] = await Promise.all([
      betDb()
        .from('list_entry')
        .select('list_key, seq, label, dest_key, icon, authz_key')
        .eq('application_key', APPLICATION_KEY)
        .in('list_key', [...NAV_LIST_KEYS])
        .order('seq', { ascending: true }),
      loadPageDestinations(),
    ]);
    if (error || !data) return DEFAULT_NAV;
    const grouped = new Map<string, unknown[]>();
    for (const row of data as Array<Record<string, unknown>>) {
      const key = String(row.list_key);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(row);
      else grouped.set(key, [row]);
    }
    const value: NavLists = { ...DEFAULT_NAV };
    for (const key of NAV_LIST_KEYS) {
      const parsed = parseEntries(grouped.get(key) ?? [], ROLE[key], pages);
      if (parsed) value[FIELD[key]] = parsed;
    }
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_NAV;
  }
}

/** A list as the editor and the API see it. `updatedAt` is the row's stamp
 *  exactly as PostgREST sent it, microseconds intact: it goes back to
 *  design_save_list() as the version check and must never pass through a Date. */
export interface EditableList {
  key: string;
  role: ListRole;
  label: string;
  updatedAt: string;
  entries: NavEntry[];
}

/** Null when the list does not exist, the database is unconfigured, or a read
 *  fails. Entries are parsed leniently (no count rule) so the editor shows what
 *  is stored even when the runtime would fall back. */
export async function loadListForEditing(key: string): Promise<EditableList | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data: list, error } = await betDb()
      .from('list')
      .select('key, role, label, updated_at')
      .eq('application_key', APPLICATION_KEY)
      .eq('key', key)
      .maybeSingle();
    if (error || !list) return null;
    // Every row page, the deleted ones too (P1.12 B1): the editor shows an entry to a deleted page for what it is.
    const [{ data: rows, error: rowsError }, pages] = await Promise.all([
      betDb()
        .from('list_entry')
        .select('seq, label, dest_key, icon, authz_key, note')
        .eq('application_key', APPLICATION_KEY)
        .eq('list_key', key)
        .order('seq', { ascending: true }),
      loadPageDestinations({ includeDeleted: true }),
    ]);
    if (rowsError) return null;
    const row = list as { key: string; role: string; label: string; updated_at: string };
    return {
      key: String(row.key),
      role: row.role as ListRole,
      label: String(row.label),
      updatedAt: String(row.updated_at),
      entries: parseEntries(rows ?? [], 'generic', pages) ?? [],
    };
  } catch {
    return null;
  }
}

// Lists of the operator's own (Phase 3 of the designer plan, the catalogue's
// Lists entry): rows of `list` with role `generic`, created and deleted through
// app/api/admin/design/lists, their entries saved through design_save_list()
// like the shell's five. A List region on any page may name one by key.

/** A list as the Lists page and the Page Designer's picker see it. */
export interface ListSummary {
  key: string;
  role: ListRole;
  label: string;
  updatedAt: string;
  entries: number;
}

/** Every list of the application with its entry count, by key. Null when the
 *  database is unconfigured or a read fails. */
export async function loadListsForEditing(): Promise<ListSummary[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const [lists, entries] = await Promise.all([
      betDb().from('list').select('key, role, label, updated_at').eq('application_key', APPLICATION_KEY).order('key', { ascending: true }),
      betDb().from('list_entry').select('list_key').eq('application_key', APPLICATION_KEY),
    ]);
    if (lists.error || !Array.isArray(lists.data) || entries.error) return null;
    const counts = new Map<string, number>();
    for (const row of (entries.data ?? []) as { list_key?: unknown }[]) {
      const k = String(row.list_key);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return (lists.data as { key: unknown; role: unknown; label: unknown; updated_at: unknown }[]).map(r => ({
      key: String(r.key),
      role: r.role as ListRole,
      label: String(r.label),
      updatedAt: String(r.updated_at),
      entries: counts.get(String(r.key)) ?? 0,
    }));
  } catch {
    return null;
  }
}

/** The entries of the lists a document names, by key: the shell's five from the
 *  memoised set it was given, the operator's own read now (a page is rendered
 *  far less often than the shell), a key with nothing usable empty. Never throws. */
export async function loadDocumentLists(keys: readonly string[], nav: NavLists): Promise<Record<string, NavEntry[]>> {
  const out: Record<string, NavEntry[]> = {};
  const own: string[] = [];
  for (const key of keys) {
    if ((NAV_LIST_KEYS as readonly string[]).includes(key)) out[key] = nav[FIELD[key as NavListKey]];
    else if (!own.includes(key)) own.push(key);
  }
  for (const key of own) out[key] = [];
  if (own.length === 0 || !isBettingConfigured()) return out;
  try {
    const [{ data, error }, pages] = await Promise.all([
      betDb()
        .from('list_entry')
        // The note (R18 PR C) is read for the editor and the pages' own lists alone: the shell's loader above names no column
        // the shell does not draw, so a column missing on the database can fail a page's list, never every page's chrome.
        .select('list_key, seq, label, dest_key, icon, authz_key, note')
        .eq('application_key', APPLICATION_KEY)
        .in('list_key', own)
        .order('seq', { ascending: true }),
      loadPageDestinations(),
    ]);
    if (error || !Array.isArray(data)) return out;
    const grouped = new Map<string, unknown[]>();
    for (const row of data as Array<Record<string, unknown>>) {
      const key = String(row.list_key);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(row);
      else grouped.set(key, [row]);
    }
    for (const key of own) out[key] = parseEntries(grouped.get(key) ?? [], 'generic', pages) ?? [];
    return out;
  } catch {
    return out;
  }
}
