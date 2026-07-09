// Table-of-contents helpers for blog posts. Shared so the heading slugs stay
// identical across the three consumers: the DB path (inject ids into the
// already-rendered HTML), the MDX path (heading components in mdx-components),
// and the ToC list rendered in the sidebar.

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Stable heading slug — lowercase, runs of non-alphanumerics to single hyphens. */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/&amp;/g, '&')
      .replace(/[^a-z0-9]+/g, '-')
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
 *  id are left untouched. */
export function injectHeadingIds(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Map<string, number>();
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
 *  skipping fenced code). Slugs match mdx-components' heading ids and the DB
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
