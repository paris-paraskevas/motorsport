import 'server-only';
import { generateInfoEntries } from './generated';
import { loadCuratedInfoEntries } from './curated';
import { entryKey, type InfoEntry } from './types';
import { loadCircuits, normalise } from '@/lib/circuits';

// The single source of truth for the information hub: merges the verified,
// champions-derived Q&A (generated.ts) with curated/web-researched content
// (curated.ts), then decides what is INDEXABLE.
//
// Anti-spam control — the whole reason this section can hold hundreds of pages
// without a Search Console "scaled content" risk:
//   • Only `verified && featured` entries are eligible for indexing…
//   • …and even then, capped at INFORMATION_MAX_INDEXED. Everything else
//     renders with <meta robots="noindex">, is left out of the sitemap, and
//     (if unverified) out of on-site search too.
// Raising the cap / flipping more `featured` flags is a deliberate editorial
// act — do it as curated content proves out and after AdSense re-review.
// 2026-07-08: raised 150 → 225 to index the fact-checked tracks + per-country and
// most-famous aggregates + team histories + rising-stars watchlist (aggressive
// promotion round; ~221 entries indexed).
// 2026-07-10: raised 225 → 290 for the 52 fact-checked series Q&A pages (4 per
// series × 13 championships — "what is / weekend / points / what's new in 2026"),
// each derived from the audited series overviews and adversarially fact-checked
// before promotion.
// 2026-07-10: raised 290 → 320 for the 30 series history/rules guides (IA
// restructure Phase C) flipped to featured; the old /series/<slug>/history tabs
// 308-redirect to the guides (proxy.ts) + drop from the sitemap so nothing
// duplicates, and "Rules essentials" was pulled out of the About tab.
// 2026-07-12: raised 320 → 322 for the two F1 2026-regulation Q&A pages ("what's
// new in F1 2026" + "how the 2026 power unit works"), each adversarially
// fact-checked (every load-bearing claim verified against 2+ primary sources)
// before promotion.
// 2026-07-13: raised 322 → 323 for "who has won the most MotoGP titles" (a GSC
// top-query gap; premier-class + all-class + by-manufacturer records, triple-
// verified against motogp.com / FIM / Wikipedia before promotion).
// 2026-07-31: raised 323 → 900 (operator decision) so all 488 generated champion
// pages become indexable, taking the section from 310 indexed to ~783. The cap
// existed as the anti-"scaled content" control, and the reason it is safe to
// loosen HERE is that the pages it was holding back are not thin: measured across
// all 488, shortest body 188 characters, median 316, longest 495, none a single
// sentence, every fact traceable to a vetted champions.json. What the cap still
// guards is genuinely low-quality bulk, so it is raised, not removed — 900 leaves
// roughly seven seasons of headroom (~15 new champion pages a year) before anyone
// has to think about it again, and the console.warn below still fires first.
export const INFORMATION_MAX_INDEXED = 900;

interface RegistryState {
  all: InfoEntry[];
  indexedKeys: Set<string>;
}

let cache: RegistryState | null = null;
let trackByCircuitSlug: Map<string, string> | null = null;

// Priority for the indexed cap: hand-written editorial first, then the
// per-series record pages, then the current-champion pages. Lower = kept first.
function indexPriority(e: InfoEntry): number {
  if (e.kind === 'qa' && e.slug.startsWith('most-')) return 1; // record pages
  if (e.slug.startsWith('who-won-')) return 2; // current champion (only featured ones)
  return 0; // editorial
}

async function build(): Promise<RegistryState> {
  const [generated, curated] = await Promise.all([
    generateInfoEntries(),
    loadCuratedInfoEntries(),
  ]);

  // Curated wins on a key collision (hand-written overrides generated).
  const byKey = new Map<string, InfoEntry>();
  for (const e of [...curated, ...generated]) {
    const k = entryKey(e);
    if (!byKey.has(k)) byKey.set(k, e);
  }
  const all = [...byKey.values()];

  const candidates = all
    .filter((e) => e.review === 'verified' && e.featured)
    .sort(
      (a, b) =>
        indexPriority(a) - indexPriority(b) ||
        a.topic.localeCompare(b.topic) ||
        a.slug.localeCompare(b.slug),
    );

  if (candidates.length > INFORMATION_MAX_INDEXED) {
    // Never silently truncate — surface it in build logs.
    console.warn(
      `[information] ${candidates.length} indexable entries exceed the cap of ${INFORMATION_MAX_INDEXED}; ` +
        `${candidates.length - INFORMATION_MAX_INDEXED} will render noindex until the cap is raised.`,
    );
  }
  const indexedKeys = new Set(
    candidates.slice(0, INFORMATION_MAX_INDEXED).map((e) => entryKey(e)),
  );

  return { all, indexedKeys };
}

async function state(): Promise<RegistryState> {
  if (!cache) cache = await build();
  return cache;
}

/** Test-only: drop the memoised registry so a fresh fixture is picked up. */
export function __resetInfoRegistry(): void {
  cache = null;
  trackByCircuitSlug = null;
}

export async function getAllInfoEntries(): Promise<InfoEntry[]> {
  return (await state()).all;
}

export async function getInfoEntry(topic: string, slug: string): Promise<InfoEntry | null> {
  const { all } = await state();
  return all.find((e) => e.topic === topic && e.slug === slug) ?? null;
}

/** Entries in a topic, featured first then alphabetical by question. */
export async function getTopicEntries(topic: string): Promise<InfoEntry[]> {
  const { all } = await state();
  return all
    .filter((e) => e.topic === topic)
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        a.question.localeCompare(b.question),
    );
}

export async function isEntryIndexed(e: InfoEntry): Promise<boolean> {
  return (await state()).indexedKeys.has(entryKey(e));
}

/** The capped set that is indexable + eligible for the sitemap + prerendered. */
export async function getIndexedInfoEntries(): Promise<InfoEntry[]> {
  const { all, indexedKeys } = await state();
  return all.filter((e) => indexedKeys.has(entryKey(e)));
}

/** Bridge a circuits.json slug → its `/information/tracks/<slug>` profile, so
 *  weekend + calendar pages can deep-link the venue to its circuit page — those
 *  pages are otherwise reachable only from the tracks index + on-site search
 *  (near internal-link orphans, which suppresses indexing). Match is by EXACT
 *  normalised-name equality (circuit name ↔ track name), NOT the greedy
 *  substring matcher: that let e.g. "Homestead-Miami Speedway" falsely claim the
 *  "miami" circuit. A missing match yields no entry → no link (graceful, and
 *  strictly better than a wrong one). Only verified tracks are mapped. Memoised
 *  — static content. */
export async function getTrackInfoByCircuitSlug(): Promise<Map<string, string>> {
  if (trackByCircuitSlug) return trackByCircuitSlug;
  const { all } = await state();
  const trackByName = new Map<string, string>();
  for (const e of all) {
    if (e.topic === 'tracks' && e.review === 'verified') {
      trackByName.set(normalise(e.question), e.slug);
    }
  }
  const circuits = await loadCircuits();
  const map = new Map<string, string>();
  for (const [circuitSlug, circuit] of Object.entries(circuits)) {
    const trackSlug = trackByName.get(normalise(circuit.name));
    if (trackSlug) map.set(circuitSlug, trackSlug);
  }
  trackByCircuitSlug = map;
  return map;
}

/** Verified entries (featured or not) — surfaced in on-site ⌘K search. Unverified
 *  drafts are deliberately excluded so users never hit unreviewed facts. */
export async function getSearchableInfoEntries(): Promise<InfoEntry[]> {
  return (await state()).all.filter((e) => e.review === 'verified');
}

/** A topic index page is indexable only if it holds ≥1 verified entry (so the
 *  all-unverified tracks directory stays noindex until reviewed). */
export async function isTopicIndexable(topic: string): Promise<boolean> {
  return (await state()).all.some((e) => e.topic === topic && e.review === 'verified');
}

/** Counts for the build report + tests. */
export async function getInfoStats(): Promise<{
  total: number;
  verified: number;
  unverified: number;
  indexed: number;
  byTopic: Record<string, number>;
}> {
  const { all, indexedKeys } = await state();
  const byTopic: Record<string, number> = {};
  for (const e of all) byTopic[e.topic] = (byTopic[e.topic] ?? 0) + 1;
  return {
    total: all.length,
    verified: all.filter((e) => e.review === 'verified').length,
    unverified: all.filter((e) => e.review === 'unverified').length,
    indexed: indexedKeys.size,
    byTopic,
  };
}
