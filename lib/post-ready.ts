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

// ---------------------------------------------------------------------------
// AI-proposed section headings (item 17 phase 2). The MODEL only ever returns
// {before-paragraph, heading} pairs over the numbered digest built here; the
// insertion itself is code (insert-only by construction), and a byte-identity
// guard re-derives the original from the result as an invariant. Still no model
// imports in this module — the /api/blog/headings route owns the model call;
// everything below stays pure and unit-testable.

export interface ParagraphInfo {
  /** 1-based candidate ordinal, as numbered in the model digest. */
  index: number;
  /** Offset of the paragraph's first character in the body. */
  start: number;
  /** Single-line opening excerpt, for the digest and the review UI. */
  excerpt: string;
}

const EXCERPT_LEN = 90;

/** Prose-paragraph starts — the only legal heading-insertion anchors: a line at
 *  the start of the body or after a blank line, outside fenced code, that isn't
 *  itself a heading, list item, blockquote, table row, image, embed or indented
 *  code. Over-filtering is safe here: fewer candidates, never a corrupt insert. */
export function paragraphStarts(body: string): ParagraphInfo[] {
  const lines = body.split('\n');
  const out: ParagraphInfo[] = [];
  let offset = 0;
  let inFence = false;
  let prevBlank = true;
  for (const line of lines) {
    const t = line.trim();
    if (/^(```|~~~)/.test(t)) {
      inFence = !inFence;
      prevBlank = false;
    } else if (t === '') {
      prevBlank = true;
    } else {
      if (!inFence && prevBlank && isProseStart(line)) {
        out.push({ index: out.length + 1, start: offset, excerpt: t.slice(0, EXCERPT_LEN) });
      }
      prevBlank = false;
    }
    offset += line.length + 1;
  }
  return out;
}

function isProseStart(line: string): boolean {
  if (/^[\s#>|!`]/.test(line)) return false; // indented code, heading, quote, table, image, fence
  if (/^[-*+]\s/.test(line)) return false; // unordered list
  if (/^\d+[.)]\s/.test(line)) return false; // ordered list
  if (line.startsWith('[[')) return false; // [[chart …]] data embed
  return true;
}

export interface HeadingProposal {
  before: number;
  heading: string;
}

export interface InsertedHeading {
  heading: string;
  excerpt: string;
}

export interface HeadingInsertResult {
  body: string;
  inserted: InsertedHeading[];
}

const HEADING_MAX = 80;
const PROPOSALS_MAX = 8;

/** Normalise a model-proposed heading; null = drop that proposal. Strips any
 *  heading markdown the model added despite instructions, collapses whitespace,
 *  trims terminal punctuation, and bans em/en dashes (house style). */
export function sanitizeHeading(raw: string): string | null {
  const t = raw
    .replace(/^#+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.:;,\s]+$/, '');
  if (t.length < 3 || t.length > HEADING_MAX) return null;
  if (/[—–]/.test(t)) return null;
  return t;
}

/** Insert `## heading` lines above the chosen candidate paragraphs. Rules: never
 *  before the first paragraph (the intro stays headless), one heading per
 *  anchor, at most PROPOSALS_MAX, unknown anchors dropped, headings sanitised.
 *  Insert-only by construction; the byte-identity guard then re-derives the
 *  input from the output and throws on any mismatch — it defends the invariant
 *  against future edits to this function, not against the model (which never
 *  touches the body at all). */
export function insertHeadings(
  body: string,
  paragraphs: ParagraphInfo[],
  proposals: HeadingProposal[],
): HeadingInsertResult {
  const byIndex = new Map(paragraphs.map(p => [p.index, p]));
  const seen = new Set<number>();
  const chosen: { start: number; heading: string; excerpt: string }[] = [];
  for (const p of proposals.slice(0, PROPOSALS_MAX)) {
    const target = byIndex.get(p.before);
    const heading = sanitizeHeading(String(p.heading ?? ''));
    if (!target || target.index < 2 || heading === null || seen.has(target.index)) continue;
    seen.add(target.index);
    chosen.push({ start: target.start, heading, excerpt: target.excerpt });
  }
  chosen.sort((a, b) => a.start - b.start);

  let out = '';
  let cursor = 0;
  const cuts: { start: number; end: number }[] = []; // inserted ranges, in OUT offsets
  for (const c of chosen) {
    out += body.slice(cursor, c.start);
    const ins = `## ${c.heading}\n\n`;
    cuts.push({ start: out.length, end: out.length + ins.length });
    out += ins;
    cursor = c.start;
  }
  out += body.slice(cursor);

  let check = '';
  let at = 0;
  for (const cut of cuts) {
    check += out.slice(at, cut.start);
    at = cut.end;
  }
  check += out.slice(at);
  if (check !== body) throw new Error('heading insertion failed the byte-identity guard');

  return { body: out, inserted: chosen.map(c => ({ heading: c.heading, excerpt: c.excerpt })) };
}

/** Parse the model's reply into proposals; [] on anything malformed. Tolerates a
 *  fenced ```json block (models add them despite instructions). */
export function parseHeadingReply(text: string): HeadingProposal[] {
  const stripped = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    const data: unknown = JSON.parse(stripped);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (x): x is { before: number; heading: string } =>
          typeof x === 'object' &&
          x !== null &&
          typeof (x as { before?: unknown }).before === 'number' &&
          typeof (x as { heading?: unknown }).heading === 'string',
      )
      .map(x => ({ before: x.before, heading: x.heading }));
  } catch {
    return [];
  }
}
