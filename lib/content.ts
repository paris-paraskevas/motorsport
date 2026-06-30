import fs from 'fs/promises';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

// Sanitised markdown→HTML (security audit). The rendered HTML feeds
// dangerouslySetInnerHTML in the blog + the file-backed legal/About/History
// tabs, so an XSS sink existed while the old remark-html pipeline ran with
// remark-html's default `sanitize:false` (raw HTML — incl. <script> — passed
// straight through). The pipeline now lowers mdast→hast (allowing raw HTML
// through so rehype-raw can re-parse it into real nodes), then rehype-sanitize
// strips anything outside GitHub's safe schema — <script>, event handlers,
// javascript: URLs, etc. — before stringifying.
//
// rehype-sanitize's default (GitHub) schema preserves everything operator
// content actually uses: GFM tables, links, images, headings, blockquotes,
// hard-breaks, and footnote markup (it permits `id`/`href` only under the
// `user-content-` clobber prefix that mdast-util-to-hast emits). So this is a
// no-visible-change for trusted content; it only removes dangerous HTML.
//
// Footnote-id note: the `normaliseFootnoteIds` post-process is STILL required
// (verified against this exact pipeline). mdast-util-to-hast already emits
// `user-content-`-prefixed footnote IDs/hrefs; rehype-sanitize's default schema
// then applies its OWN `clobberPrefix: 'user-content-'` and re-prefixes the
// IDs (but not the hrefs it doesn't clobber), so raw output has
// id="user-content-user-content-fn-1" against href="#user-content-fn-1" — the
// in-page scroll-to-footnote anchors break without this fix. Stripping the
// doubled prefix realigns IDs with hrefs. (Same symptom the old remark-html
// path had, for a different internal reason.) Operator markdown never contains
// a literal `id="user-content-user-content-"`, so the replace is targeted.
// See lib/content.test.ts for the footnote-anchor + sanitisation coverage.
function normaliseFootnoteIds(html: string): string {
  return html.replace(/id="user-content-user-content-/g, 'id="user-content-');
}

/** Render a markdown STRING to sanitised HTML (GFM + footnote-id safety). The
 *  shared core, used for both file-backed content (below) and DB-backed content
 *  (blog posts). Output is XSS-safe and goes straight to dangerouslySetInnerHTML. */
export async function renderMarkdown(content: string): Promise<string> {
  if (!content.trim()) return '';
  const processed = await remark()
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(content);
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
