import fs from 'fs/promises';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

// remark-html (via mdast-util-to-hast) double-applies the clobber prefix to
// footnote element IDs but only single-applies it to the corresponding hrefs,
// so the in-page scroll-to-footnote behaviour silently breaks. remark-html
// silently drops `clobberPrefix` options, and rehype-stringify isn't an
// existing dependency, so the pragmatic fix is a post-process pass that
// normalises the doubled prefix on IDs. Only affects footnote-related IDs
// (the only IDs the pipeline generates from operator-curated markdown);
// operator content does not contain raw `id="user-content-user-content-"`.
function normaliseFootnoteIds(html: string): string {
  return html.replace(/id="user-content-user-content-/g, 'id="user-content-');
}

/** Render a markdown STRING to HTML (GFM + the footnote-id fix). The shared core,
 *  used for both file-backed content (below) and DB-backed content (blog posts). */
export async function renderMarkdown(content: string): Promise<string> {
  if (!content.trim()) return '';
  const processed = await remark().use(remarkGfm).use(remarkHtml).process(content);
  return normaliseFootnoteIds(processed.toString());
}

export async function loadMarkdownAsHtml(filePath: string): Promise<string> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
  const { content } = matter(raw);
  return renderMarkdown(content);
}

export interface MarkdownDocument {
  html: string;
  frontmatter: Record<string, unknown>;
}

export async function loadMarkdownWithFrontmatter(
  filePath: string,
): Promise<MarkdownDocument> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return { html: '', frontmatter: {} };
  }
  const { content, data } = matter(raw);
  return { html: await renderMarkdown(content), frontmatter: data };
}
