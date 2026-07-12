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

// Escape author-controlled strings before they land in the preview HTML the
// editor feeds to dangerouslySetInnerHTML.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Flatten a body to a single HTML string for the composer's live preview.
 * Markdown runs go through the same sanitised pipeline as the published post;
 * each embed becomes a labelled PLACEHOLDER, never the live widget — the preview
 * fires on every keystroke, so it must not run an embed's data fetch, and a
 * placeholder still shows the author where the embed lands and with what args.
 * A body with no shortcodes is a single markdown run → byte-identical to
 * `renderMarkdown` (so non-embed posts preview exactly as before).
 */
export async function renderPreviewHtml(body: string): Promise<string> {
  const parts: string[] = [];
  for (const seg of parseBodySegments(body)) {
    if (seg.kind === 'markdown') {
      parts.push(await renderMarkdown(seg.text));
    } else {
      const args = Object.entries(seg.spec.args)
        .map(([k, v]) => `${escapeHtml(k)}=${escapeHtml(v)}`)
        .join(' ');
      parts.push(
        `<div class="not-prose my-4 rounded-lg border border-dashed border-border bg-surface/40 px-4 py-3 text-sm text-text-faint">▮ ${escapeHtml(seg.spec.type)} embed${args ? ` · ${args}` : ''}</div>`,
      );
    }
  }
  return parts.join('\n');
}
