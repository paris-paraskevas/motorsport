import { BAR_MAX, BAR_MIN, NAV_LIST_KEYS, pageIdOf, resolveDestination, type ListRole, type NavEntry, type PageDestinations } from './destinations';

// A list of the operator's own (Phase 3): the key and label rules, shared by the
// Lists page (which greys Create out) and the collection route (which refuses).
export const LIST_KEY_MAX = 40;
export const LIST_LABEL_MAX = 60;
/** A card's sentence (R18 PR C): about three lines on a phone-width card. */
export const LIST_NOTE_MAX = 120;
const LIST_KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Why a key cannot name a new list, or null. The shell's five keys are taken. */
export function listKeyProblem(key: string): string | null {
  if (!key) return 'a key is needed';
  if (key.length > LIST_KEY_MAX) return `keys are at most ${LIST_KEY_MAX} characters`;
  if (!LIST_KEY.test(key)) return 'lower-case letters, digits and hyphens, starting with a letter or a digit';
  if ((NAV_LIST_KEYS as readonly string[]).includes(key)) return 'that key belongs to one of the shell’s lists';
  return null;
}

/** Why a label cannot be stored, or null. */
export function listLabelProblem(label: string): string | null {
  const t = label.trim();
  if (!t) return 'a label is needed';
  if (t.length > LIST_LABEL_MAX) return `labels are at most ${LIST_LABEL_MAX} characters`;
  return null;
}

// The list editor's table operations, pure and client-safe, so the designer's
// buttons and the tests share one definition of what a list may become. The API
// (app/api/admin/design/lists/[key]) enforces the same bounds on save; this is
// what lets the editor grey a button out before the server would refuse.

export function minEntries(role: ListRole): number {
  return role === 'bar' ? BAR_MIN : 1;
}

/** Null means no upper bound. */
export function maxEntries(role: ListRole): number | null {
  return role === 'bar' ? BAR_MAX : null;
}

export function canRemove(role: ListRole, count: number): boolean {
  return count > minEntries(role);
}

export function canAdd(role: ListRole, count: number): boolean {
  const max = maxEntries(role);
  return max === null || count < max;
}

/** Move the entry at `from` so it sits at `to`; out-of-range indexes leave the
 *  list as it was. Returns a new array, never mutates. */
export function moveEntry(entries: NavEntry[], from: number, to: number): NavEntry[] {
  if (from === to || from < 0 || to < 0 || from >= entries.length || to >= entries.length) return entries;
  const next = entries.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function updateEntry(entries: NavEntry[], index: number, patch: Partial<NavEntry>): NavEntry[] {
  if (index < 0 || index >= entries.length) return entries;
  return entries.map((e, i) => {
    if (i !== index) return e;
    const next: NavEntry = { ...e, ...patch };
    // An emptied optional field is removed, not kept as ''.
    if (!next.icon) delete next.icon;
    if (!next.authz) delete next.authz;
    if (!next.note) delete next.note;
    return next;
  });
}

export function removeEntry(entries: NavEntry[], index: number, role: ListRole): NavEntry[] {
  if (index < 0 || index >= entries.length || !canRemove(role, entries.length)) return entries;
  return entries.filter((_, i) => i !== index);
}

/** Append a catalogue destination with the catalogue's own label, or a row page
 *  (P1.12 B1) with the page's name and its path as the entry's href so the
 *  preview draws it before a save; the bar gets a default icon so a cell is
 *  never blank. Unknown destinations and a full bar leave the list as it was. */
export function addEntry(entries: NavEntry[], dest: string, role: ListRole, pages?: PageDestinations): NavEntry[] {
  const destination = resolveDestination(dest, pages);
  if (!destination || !canAdd(role, entries.length)) return entries;
  const entry: NavEntry = { label: destination.label, dest };
  if (pageIdOf(dest) && destination.kind === 'route') entry.href = destination.href;
  if (role === 'bar') entry.icon = 'compass';
  return [...entries, entry];
}

/** Whether two entry lists would store the same rows. */
export function sameEntries(a: NavEntry[], b: NavEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((e, i) => {
    const o = b[i];
    return e.label === o.label && e.dest === o.dest && (e.icon ?? '') === (o.icon ?? '') && (e.authz ?? '') === (o.authz ?? '') && (e.note ?? '') === (o.note ?? '');
  });
}
