// Post-readiness (item 17): the deterministic half of "make this draft
// post-ready". Pure module — no server imports, entities are injected — so the
// studio editor computes the checklist client-side live, the /api/blog/format
// route runs the linker server-side, and every rule here is unit-testable.
// Deliberately NO model anywhere: the linker only wraps text that is already
// present; AI-proposed section headings are a separate, gated phase.

export interface LinkEntity {
  /** Exact display name as it appears in prose ("Max Verstappen", "Formula 1"). */
  name: string;
  /** Root-relative target ("/drivers/max-verstappen"). */
  url: string;
}

export interface AutoLinkResult {
  body: string;
  added: { name: string; url: string }[];
}

/** ## / ### headings — the ToC threshold on the post page is 2+. */
export function countHeadings(body: string): number {
  return (body.match(/^#{2,3}\s+\S/gm) ?? []).length;
}

/** Internal markdown links: [label](/path). External links don't count — the
 *  point of the check is that the post feeds readers back into the site. */
export function countInternalLinks(body: string): number {
  return (body.match(/\]\(\/[^)]*\)/g) ?? []).length;
}

export interface ReadinessInput {
  summary: string;
  seriesSlug: string | null;
  heroImage: string | null;
  body: string;
}

export interface ReadinessCheck {
  key: 'summary' | 'series' | 'cover' | 'headings' | 'links';
  label: string;
  ok: boolean;
  hint: string;
}

/** The rail checklist. Facts only — every row is derivable from the draft
 *  itself, and the hints say what the reader-facing consequence is. */
export function readinessChecks(input: ReadinessInput): ReadinessCheck[] {
  const headings = countHeadings(input.body);
  const links = countInternalLinks(input.body);
  return [
    {
      key: 'summary',
      label: 'Summary',
      ok: input.summary.trim().length > 0,
      hint: 'The card + share text.',
    },
    {
      key: 'series',
      label: 'Series tag',
      ok: input.seriesSlug !== null && input.seriesSlug !== '',
      hint: 'Surfaces the post on that series’ page.',
    },
    {
      key: 'cover',
      label: 'Cover image',
      ok: input.heroImage !== null && input.heroImage.trim() !== '',
      hint: 'Posts without one share as the branded card only.',
    },
    {
      key: 'headings',
      label: `Sections ( ${headings} )`,
      ok: headings >= 2,
      hint: 'Two or more ## sections make the on-page contents list appear.',
    },
    {
      key: 'links',
      label: `Internal links ( ${links} )`,
      ok: links >= 1,
      hint: 'Link drivers, series or guides so readers can go deeper.',
    },
  ];
}

interface Range {
  start: number;
  end: number;
}

function overlaps(ranges: Range[], start: number, end: number): boolean {
  return ranges.some(r => start < r.end && end > r.start);
}

/** Regions the linker must never touch: existing markdown links, inline + fenced
 *  code, [[data embeds]], heading lines (anchors/ToC own them), blockquote lines
 *  (quoted material must stay verbatim), and bare URLs. */
function maskedRanges(body: string): Range[] {
  const ranges: Range[] = [];
  const push = (re: RegExp) => {
    for (const m of body.matchAll(re)) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
  };
  push(/```[\s\S]*?```/g); // fenced code first — it can contain anything below
  push(/`[^`\n]*`/g);
  push(/\[\[[^\]]*\]\]/g); // [[chart …]] / [[standings …]] embeds
  push(/\[[^\]\n]*\]\([^)\n]*\)/g); // existing markdown links (label + target)
  push(/^#{1,6}\s.*$/gm);
  push(/^[ \t]*>.*$/gm);
  push(/https?:\/\/\S+/g);
  return ranges;
}

const MIN_NAME_LEN = 3;

/** Link the FIRST mention of each known entity to its Paddock page. Exact,
 *  case-sensitive match (entity names are proper nouns; lowercase prose stays
 *  untouched) on Unicode word boundaries, longest names first so "Kimi
 *  Antonelli" wins before any shorter overlap. Every insertion becomes a masked
 *  range itself, so entities never nest. The transform is insert-only by
 *  construction: output minus the added link syntax is byte-identical input. */
export function autoLinkBody(body: string, entities: LinkEntity[]): AutoLinkResult {
  const masks = maskedRanges(body);
  // Longest first; dedupe by name (first URL wins — callers order by priority).
  const seen = new Set<string>();
  const candidates = entities
    .filter(e => {
      if (e.name.length < MIN_NAME_LEN || seen.has(e.name)) return false;
      seen.add(e.name);
      return true;
    })
    .sort((a, b) => b.name.length - a.name.length);

  // Collect chosen insertions against ORIGINAL offsets, apply in one pass.
  const chosen: { start: number; end: number; entity: LinkEntity }[] = [];
  for (const entity of candidates) {
    const escaped = entity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu');
    for (const m of body.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(masks, start, end) || chosen.some(c => start < c.end && end > c.start)) continue;
      chosen.push({ start, end, entity });
      break; // first mention only
    }
  }

  if (chosen.length === 0) return { body, added: [] };
  chosen.sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const c of chosen) {
    out += body.slice(cursor, c.start) + `[${body.slice(c.start, c.end)}](${c.entity.url})`;
    cursor = c.end;
  }
  out += body.slice(cursor);
  return { body: out, added: chosen.map(c => ({ name: c.entity.name, url: c.entity.url })) };
}
