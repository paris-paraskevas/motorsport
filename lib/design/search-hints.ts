import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import type { SearchHint } from './search-hint-defaults';
import { loadDesignSnapshot, resetDesignSnapshot, snapshotRows } from './snapshot';

export { SEARCH_HINT_MAX, SEARCH_HINT_ROTATE_MS, searchHintProblem } from './search-hint-defaults';
export type { SearchHint } from './search-hint-defaults';

// The search hints, read from the `search_hint` rows for this application
// (migration 20260909020000). Client-safe pieces live in search-hint-defaults.ts.
//
// THE RULE THIS FILE ENFORCES: nothing here throws, and no hint is guessed at.
// An unconfigured database, a missing table, a query error or an empty table all
// read as no hints, and the header keeps its one text message; a row without a
// usable question is left out.
//
// Writes go through app/api/admin/design/search-hints (POST) and
// .../search-hints/[id] (PUT, DELETE) only.

const APPLICATION_KEY = 'paddock';
const COLUMNS = 'id, question, seq, leads_to, leads_title, updated_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface EditableSearchHint extends SearchHint {
  updatedAt: string;
}

/** Coerce one row, or null when it cannot be used. */
export function searchHintFromRow(item: unknown): EditableSearchHint | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  if (typeof r.id !== 'string' || !UUID.test(r.id)) return null;
  if (typeof r.question !== 'string' || !r.question.trim()) return null;
  if (r.updated_at == null) return null;
  return {
    id: r.id,
    question: r.question.trim(),
    seq: typeof r.seq === 'number' && Number.isFinite(r.seq) ? r.seq : 0,
    leadsTo: typeof r.leads_to === 'string' && r.leads_to ? r.leads_to : null,
    leadsTitle: typeof r.leads_title === 'string' && r.leads_title ? r.leads_title : null,
    updatedAt: String(r.updated_at),
  };
}

function ordered(rows: unknown): EditableSearchHint[] {
  const out: EditableSearchHint[] = [];
  if (!Array.isArray(rows)) return out;
  for (const item of rows) {
    const h = searchHintFromRow(item);
    if (h) out.push(h);
  }
  return out.sort((a, b) => a.seq - b.seq || a.question.localeCompare(b.question));
}

export function resetSearchHintsMemo(): void {
  resetDesignSnapshot();
}

/** The questions in order, for the header, from the design snapshot (the hints ride the layout of every page). Empty on any failure. */
export async function loadSearchHints(): Promise<string[]> {
  const snapshot = await loadDesignSnapshot();
  return snapshot ? ordered(snapshotRows(snapshot, 'search_hint')).map(h => h.question) : [];
}

/** Every row with its stamp, in order. Null on any failure; empty when there are none. */
export async function loadSearchHintsForEditing(): Promise<EditableSearchHint[] | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb().from('search_hint').select(COLUMNS).eq('application_key', APPLICATION_KEY);
    if (error) return null;
    return ordered(data ?? []);
  } catch {
    return null;
  }
}

export { APPLICATION_KEY as SEARCH_HINT_APPLICATION_KEY, COLUMNS as SEARCH_HINT_COLUMNS };
