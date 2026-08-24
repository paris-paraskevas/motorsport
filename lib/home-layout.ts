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
  /** `blog` only: publish this exact post as the lead instead of the newest. */
  pinnedSlug?: string;
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
    const { id, hidden, pinnedSlug } = entry as Record<string, unknown>;
    if (!isBlockId(id) || seen.has(id)) continue;
    seen.add(id);
    blocks.push({
      id,
      hidden: hidden === true,
      // A blank or non-string pin is no pin, not an empty-slug lookup.
      pinnedSlug: typeof pinnedSlug === 'string' && pinnedSlug.trim() !== '' ? pinnedSlug.trim() : undefined,
    });
  }

  // Nothing recognisable in the column → the operator has no usable layout.
  if (blocks.length === 0) return DEFAULT_HOME_LAYOUT;

  for (const id of HOME_BLOCK_IDS) if (!seen.has(id)) blocks.push({ id });
  return { blocks };
}

/** The post slug the operator pinned as the lead, if any. */
export function pinnedLeadSlug(layout: HomeLayout): string | null {
  return layout.blocks.find(b => b.id === 'blog')?.pinnedSlug ?? null;
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
export function layoutFromParams(params: {
  order?: string;
  hidden?: string;
  lead?: string;
}): HomeLayout {
  const hidden = new Set((params.hidden ?? '').split(',').filter(Boolean));
  const ordered = (params.order ?? '').split(',').filter(Boolean);
  const ids = ordered.length > 0 ? ordered : [...HOME_BLOCK_IDS];
  return parseHomeLayout(
    ids.map(id => ({
      id,
      hidden: hidden.has(id),
      ...(id === 'blog' && params.lead ? { pinnedSlug: params.lead } : {}),
    })),
  );
}

/**
 * The live layout for the home page. Returns the default on ANY failure —
 * Supabase unconfigured, table missing (it is created by a migration that ships
 * separately from this code), query error, or a malformed column.
 */
export async function loadLiveHomeLayout(): Promise<HomeLayout> {
  if (!isBettingConfigured()) return DEFAULT_HOME_LAYOUT;
  try {
    const { data, error } = await betDb()
      .from('page_layout')
      .select('blocks')
      .eq('page_key', HOME_PAGE_KEY)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return DEFAULT_HOME_LAYOUT;
    return parseHomeLayout(data.blocks);
  } catch {
    return DEFAULT_HOME_LAYOUT;
  }
}
