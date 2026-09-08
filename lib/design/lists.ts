import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { resolveDestination, type NavEntry, type NavLists } from './destinations';

export type { NavEntry, NavLists } from './destinations';

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

export type ListRole = 'menu' | 'bar' | 'footer' | 'reference' | 'generic';

export const APPLICATION_KEY = 'paddock';
export const NAV_LIST_KEYS = ['doors', 'bar', 'footer-site', 'footer-legal'] as const;
export type NavListKey = (typeof NAV_LIST_KEYS)[number];

/** The phone bar is four equal cells today and cannot fit fewer than three or
 *  more than five without the design breaking, so the loader and the API both
 *  hold this line. */
export const BAR_MIN = 3;
export const BAR_MAX = 5;

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
};

const FIELD: Record<NavListKey, keyof NavLists> = {
  doors: 'doors',
  bar: 'bar',
  'footer-site': 'footerSite',
  'footer-legal': 'footerLegal',
};

const ROLE: Record<NavListKey, ListRole> = {
  doors: 'menu',
  bar: 'bar',
  'footer-site': 'footer',
  'footer-legal': 'footer',
};

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * Coerce rows (or any JSON) into entries. A row without a label, or naming a
 * destination the catalogue does not know, is dropped on its own; nothing usable
 * returns null so the caller falls back to the default. A bar outside BAR_MIN..BAR_MAX
 * also returns null: the design cannot render it.
 */
export function parseEntries(raw: unknown, role: ListRole): NavEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: NavEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const label = text(row.label);
    const dest = text(row.dest_key) ?? text(row.dest);
    if (!label || !dest || !resolveDestination(dest)) continue;
    const entry: NavEntry = { label, dest };
    const icon = text(row.icon);
    if (icon) entry.icon = icon;
    const authz = text(row.authz_key) ?? text(row.authz);
    if (authz) entry.authz = authz;
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

/** The four lists for the shell, from rows where they are usable and from the
 *  defaults where they are not. Never throws. */
export async function loadNavLists(): Promise<NavLists> {
  if (!isBettingConfigured()) return DEFAULT_NAV;
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  try {
    const { data, error } = await betDb()
      .from('list_entry')
      .select('list_key, seq, label, dest_key, icon, authz_key')
      .eq('application_key', APPLICATION_KEY)
      .in('list_key', [...NAV_LIST_KEYS])
      .order('seq', { ascending: true });
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
      const parsed = parseEntries(grouped.get(key) ?? [], ROLE[key]);
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
    const { data: rows, error: rowsError } = await betDb()
      .from('list_entry')
      .select('seq, label, dest_key, icon, authz_key')
      .eq('application_key', APPLICATION_KEY)
      .eq('list_key', key)
      .order('seq', { ascending: true });
    if (rowsError) return null;
    const row = list as { key: string; role: string; label: string; updated_at: string };
    return {
      key: String(row.key),
      role: row.role as ListRole,
      label: String(row.label),
      updatedAt: String(row.updated_at),
      entries: parseEntries(rows ?? [], 'generic') ?? [],
    };
  } catch {
    return null;
  }
}
