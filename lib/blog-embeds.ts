// Blog data-visual embeds: a small shortcode → segment pipeline so DB blog
// posts (plain markdown, rendered to sanitised HTML) can interleave LIVE
// components — a season-trend chart, a standings snapshot — between prose.
//
// A shortcode is a line whose ENTIRE content is one `[[type key=value ...]]`
// token. The body is split into segments BEFORE the markdown→HTML render, so
// the tokens never reach remark / rehype-sanitize: no new XSS surface, no
// sanitiser-schema change, and every markdown run renders exactly as it does
// today. Values are opaque strings; which types/args are valid is decided by
// the embed dispatcher (fail-soft), not here — this module is purely
// structural, which keeps it a cheap pure unit to test.

import { renderMarkdown } from './content';
import { injectHeadingIds, type TocItem } from './toc';

export interface EmbedSpec {
  type: string;
  args: Record<string, string>;
}

export type BodySegment =
  | { kind: 'markdown'; text: string }
  | { kind: 'embed'; spec: EmbedSpec };

// A whole line that is exactly one shortcode (leading/trailing whitespace only,
// nothing else on the line) — so a `[[` inside a paragraph or a code span is
// never mistaken for an embed. Type is a lowercase kebab slug; the rest is the
// raw arg string, parsed separately.
const EMBED_LINE_RE = /^[ \t]*\[\[[ \t]*([a-z][a-z0-9-]*)[ \t]*(.*?)[ \t]*\]\][ \t]*$/i;

// key=value | key="value with spaces" | key='value' — repeated per line.
const ARG_RE = /([a-z][a-z0-9-]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/gi;

export function parseEmbedArgs(raw: string): Record<string, string> {
  const args: Record<string, string> = {};
  ARG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ARG_RE.exec(raw)) !== null) {
    args[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return args;
}

/**
 * Split a markdown body into ordered markdown / embed segments. Contiguous
 * non-shortcode lines coalesce into one markdown segment (so tables, lists and
 * multi-paragraph blocks render intact); a fenced code block is never scanned
 * for shortcodes (a `[[...]]` inside a fence is literal content). Whitespace-
 * only markdown runs are dropped so no empty prose block renders between two
 * adjacent embeds.
 */
export function parseBodySegments(body: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let buffer: string[] = [];
  let inFence = false;

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.join('\n');
    if (text.trim()) segments.push({ kind: 'markdown', text });
    buffer = [];
  };

  for (const line of body.split('\n')) {
    if (/^[ \t]*(```|~~~)/.test(line)) {
      inFence = !inFence;
      buffer.push(line);
      continue;
    }
    const m = inFence ? null : EMBED_LINE_RE.exec(line);
    if (m) {
      flush();
      segments.push({ kind: 'embed', spec: { type: m[1].toLowerCase(), args: parseEmbedArgs(m[2]) } });
    } else {
      buffer.push(line);
    }
  }
  flush();
  return segments;
}

export type RenderedSegment =
  | { kind: 'html'; html: string }
  | { kind: 'embed'; spec: EmbedSpec };

export interface RenderedBody {
  segments: RenderedSegment[];
  toc: TocItem[];
}

/**
 * Render a post body to interleaved sanitised-HTML runs + embed specs, plus the
 * merged table of contents. Each markdown run is rendered with the shared
 * blog pipeline; heading ids are injected with ONE dedup map threaded across
 * every run, so a heading repeated on opposite sides of an embed still gets a
 * unique id and the ToC anchors line up. Embed specs are passed through for the
 * server component to resolve.
 */
export async function renderPostBody(body: string): Promise<RenderedBody> {
  const parsed = parseBodySegments(body);
  const used = new Map<string, number>();
  const toc: TocItem[] = [];
  const segments: RenderedSegment[] = [];
  for (const seg of parsed) {
    if (seg.kind === 'markdown') {
      const injected = injectHeadingIds(await renderMarkdown(seg.text), used);
      toc.push(...injected.toc);
      segments.push({ kind: 'html', html: injected.html });
    } else {
      segments.push({ kind: 'embed', spec: seg.spec });
    }
  }
  return { segments, toc };
}
