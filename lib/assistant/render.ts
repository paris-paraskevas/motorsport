// Minimal, safe inline renderer for the assistant's replies. Supports exactly the
// two markdown constructs the model is instructed to use — links [text](href) and
// **bold** — and nothing else. href is whitelisted to internal "/..." paths or
// http(s) URLs, so no other scheme (javascript:, data:) can ever become a link
// token, and the widget builds React nodes from these tokens (never
// dangerouslySetInnerHTML). Anything that isn't a well-formed link/bold stays
// literal text — including bare paths, which the prompt tells the model to avoid.

export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; href: string; external: boolean };

// [label](href) where href is /internal (no spaces/parens) OR http(s)://… ; or **bold**.
const INLINE = /\[([^\]\n]+)\]\((\/[^\s)]*|https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*/g;

/** Tokenize one line of assistant text into text / bold / link spans. Pure. */
export function parseInline(line: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(line)) !== null) {
    if (m.index > last) tokens.push({ kind: 'text', text: line.slice(last, m.index) });
    if (m[1] !== undefined && m[2] !== undefined) {
      tokens.push({ kind: 'link', text: m[1], href: m[2], external: !m[2].startsWith('/') });
    } else if (m[3] !== undefined) {
      tokens.push({ kind: 'bold', text: m[3] });
    }
    last = INLINE.lastIndex;
  }
  if (last < line.length) tokens.push({ kind: 'text', text: line.slice(last) });
  return tokens;
}
