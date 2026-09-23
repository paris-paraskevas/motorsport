import 'server-only';
import { betDb, isBettingConfigured } from './betting/client';

// The operator-composed home page layout. Read by /app at ISR render and by the
// admin composer; written only through /api/admin/page-layout.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: every unknown, malformed or missing
// value falls back to the automatic composition the home page has always had.
// A layout row is editorial input typed by a person into a JSON blob, and /app
// is the most-visited page on the site — so a bad layout must degrade to
// "today's behaviour", never to a broken or empty page. Nothing in here throws.
//
// Storage is append-only revisions (supabase/migrations/20260824120000_page_layout.sql):
// live = newest row for the page with published_at set. That gives undo for free.

export const HOME_PAGE_KEY = 'home';

/** Blocks the operator can order, hide, or fill. `result` covers the result
 *  band together with the standings and next-up columns nested inside its grid
 *  (components/HomeLead.tsx:451-465) — they are one section in the markup and
 *  are deliberately treated as one block until that component is split. */
export const HOME_BLOCK_IDS = ['blog', 'live', 'result', 'wire'] as const;
export type HomeBlockId = (typeof HOME_BLOCK_IDS)[number];

export interface HomeBlock {
  id: HomeBlockId;
  hidden?: boolean;
}

export interface HomeLayout {
  blocks: HomeBlock[];
}

/** What the page falls back to: every block, in the order HomeLead renders them,
 *  nothing hidden, nothing pinned. Identical to the pre-layout behaviour.
 *
 *  `hidden: false` is written explicitly so this is byte-identical to what
 *  `parseHomeLayout` produces for the same input. The composer decides whether
 *  the Publish button is live by comparing the draft against what is published,
 *  and without this the two shapes differ and it offers to publish a layout
 *  identical to the one already live. */
export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  blocks: HOME_BLOCK_IDS.map(id => ({ id, hidden: false })),
};

function isBlockId(v: unknown): v is HomeBlockId {
  return typeof v === 'string' && (HOME_BLOCK_IDS as readonly string[]).includes(v);
}

/**
 * Coerce whatever is in the `blocks` column into a usable layout.
 *
 * Unknown ids are dropped, duplicates keep their first occurrence, and any block
 * the operator never mentioned is appended in its default position — so adding a
 * new block to the site does not require every stored layout to be rewritten,
 * and an older revision keeps working after a deploy that introduces one.
 *
 * Anything that is not an array of objects at all returns the default.
 */
export function parseHomeLayout(raw: unknown): HomeLayout {
  if (!Array.isArray(raw)) return DEFAULT_HOME_LAYOUT;

  const seen = new Set<HomeBlockId>();
  const blocks: HomeBlock[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, hidden } = entry as Record<string, unknown>;
    if (!isBlockId(id) || seen.has(id)) continue;
    seen.add(id);
    // A stored `pinnedSlug` (the retired console's pin) is ignored since P2.24 C: the lead is the Lead story region's business.
    blocks.push({ id, hidden: hidden === true });
  }

  // Nothing recognisable in the column → the operator has no usable layout.
  if (blocks.length === 0) return DEFAULT_HOME_LAYOUT;

  for (const id of HOME_BLOCK_IDS) if (!seen.has(id)) blocks.push({ id });
  return { blocks };
}

/** Block ids to render, in the operator's order, hidden ones removed.
 *
 *  Hiding EVERY block would leave a blank home page, which no layout should be
 *  able to produce, so an all-hidden layout falls back to the default order.
 *  Individual blocks still render nothing when they have no data — that is the
 *  band's own business, not the layout's. */
export function visibleBlocks(layout: HomeLayout): HomeBlockId[] {
  const visible = layout.blocks.filter(b => b.hidden !== true).map(b => b.id);
  return visible.length > 0 ? visible : [...HOME_BLOCK_IDS];
}

/** Build a layout from URL parameters, for the admin composer's draft preview.
 *  Unrecognised values are dropped by parseHomeLayout, so a hand-edited URL is
 *  as safe as a hand-edited row. */
export function layoutFromParams(params: { order?: string; hidden?: string }): HomeLayout {
  const hidden = new Set((params.hidden ?? '').split(',').filter(Boolean));
  const ordered = (params.order ?? '').split(',').filter(Boolean);
  const ids = ordered.length > 0 ? ordered : [...HOME_BLOCK_IDS];
  return parseHomeLayout(ids.map(id => ({ id, hidden: hidden.has(id) })));
}

/** One stored revision of the home layout, as the composer and the API see it.
 *  `at` is `published_at` for the live revision and `created_at` for a draft. */
export interface HomeRevision {
  id: string;
  at: string;
  layout: HomeLayout;
}

type RevisionRow = { id: string; blocks: unknown; published_at?: string | null; created_at?: string | null };

/**
 * The newest published revision, or null on ANY failure — Supabase unconfigured,
 * table missing (it is created by a migration that ships separately from this
 * code), query error, or a malformed column. Its `id` is the version the composer
 * hands back on publish: the API refuses a publish whose base is no longer the
 * live revision (Phase 1 of the designer plan, the 1.0.25 studio pattern).
 */
export async function loadLiveHomeRevision(): Promise<HomeRevision | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb()
      .from('page_layout')
      .select('id, blocks, published_at')
      .eq('page_key', HOME_PAGE_KEY)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as RevisionRow;
    return { id: String(row.id), at: String(row.published_at), layout: parseHomeLayout(row.blocks) };
  } catch {
    return null;
  }
}

/**
 * The draft the composer should open: the newest UNPUBLISHED revision saved after
 * the live one. A draft older than the live revision is history, not a draft —
 * publishing inserts a new row and never touches the draft row, so without this
 * cut-off every publish would resurrect whatever draft preceded it. Null when
 * there is none, or on any failure.
 */
export async function loadHomeDraftRevision(live: HomeRevision | null): Promise<HomeRevision | null> {
  if (!isBettingConfigured()) return null;
  try {
    let query = betDb()
      .from('page_layout')
      .select('id, blocks, created_at')
      .eq('page_key', HOME_PAGE_KEY)
      .is('published_at', null);
    if (live) query = query.gt('created_at', live.at);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    const row = data as RevisionRow;
    return { id: String(row.id), at: String(row.created_at), layout: parseHomeLayout(row.blocks) };
  } catch {
    return null;
  }
}

/** Live and draft together, for the composer page. Fail-soft like its parts. */
export async function loadHomeLayoutState(): Promise<{ live: HomeRevision | null; draft: HomeRevision | null }> {
  const live = await loadLiveHomeRevision();
  const draft = await loadHomeDraftRevision(live);
  return { live, draft };
}

/**
 * The live layout for the home page. Returns the default on ANY failure —
 * Supabase unconfigured, table missing, query error, or a malformed column.
 */
export async function loadLiveHomeLayout(): Promise<HomeLayout> {
  return (await loadLiveHomeRevision())?.layout ?? DEFAULT_HOME_LAYOUT;
}
