// Table-of-contents helpers for blog posts. Shared so the heading slugs stay
// identical across the three consumers: the DB path (inject ids into the
// already-rendered HTML), the legacy file-post path (same renderer since 0.288.0),
// and the ToC list rendered in the sidebar.

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Stable heading slug — lowercase, runs of non-letters/digits to single hyphens.
 *
 * Unicode-aware on purpose. The old `[^a-z0-9]+` stripped every non-Latin
 * character, so a Greek-language post collapsed EVERY heading to the `section`
 * fallback: one shared id, a table of contents whose links all pointed at the
 * same place, and duplicate ids in the HTML. `\p{L}\p{N}` keeps Greek (and any
 * other script) while behaving identically for Latin headings.
 *
 * Diacritics are folded away first (NFD, then drop combining marks) so an anchor
 * stays readable in a URL and a heading matches itself whether or not it was
 * written with accents: "Ο απολογισμός" and "Ο ΑΠΟΛΟΓΙΣΜΟΣ" both give
 * `ο-απολογισμος`. Collisions are still handled by the caller's dedupe.
 */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .replace(/&amp;/g, '&')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

function dedupe(slug: string, used: Map<string, number>): string {
  const n = used.get(slug) ?? 0;
  used.set(slug, n + 1);
  return n ? `${slug}-${n}` : slug;
}

/** DB path: inject ids into the rendered h2/h3 and return the flat ToC. Runs on
 *  the already-sanitised HTML string — the ids we add are computed slugs, never
 *  user input, so this introduces no XSS surface. Headings that already carry an
 *  id are left untouched. Pass a shared `used` map to keep ids unique across
 *  multiple HTML fragments rendered separately (the embed pipeline renders each
 *  markdown run between shortcodes on its own, then threads one map through). */
export function injectHeadingIds(
  html: string,
  used: Map<string, number> = new Map(),
): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const withIds = html.replace(
    /<(h2|h3)\b([^>]*)>([\s\S]*?)<\/\1>/g,
    (m, tag: string, attrs: string, inner: string) => {
      if (/\bid=/.test(attrs)) return m;
      const text = inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
      const id = dedupe(slugify(text), used);
      toc.push({ id, text, level: tag === 'h2' ? 2 : 3 });
      return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
    },
  );
  return { html: withIds, toc };
}

/** MDX path: pull the ToC straight from the raw markdown source (## / ### lines,
 *  skipping fenced code). Slugs match the rendered headings' ids and the DB
 *  path, so the sidebar links resolve to the rendered headings. */
export function tocFromMarkdown(md: string): TocItem[] {
  const toc: TocItem[] = [];
  const used = new Map<string, number>();
  let inFence = false;
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const text = m[2].replace(/\*\*|__|\*|_|`/g, '').trim();
    toc.push({ id: dedupe(slugify(text), used), text, level: m[1].length as 2 | 3 });
  }
  return toc;
}
