import type { DraftInput } from './blog';

// Parse a weekend-post draft `.md` (the exemplar format: a leading <!-- --> comment
// block of SINGLE-LINE metadata, then the article) into createDraft's DraftInput.
// The /weekend-post routine emits this shape (docs/content-authoring/weekend-post-playbook.md)
// and scripts/draft-post.mts feeds the result to createDraft. Length caps are
// enforced by createDraft — this checks only presence + slug shape so a bad draft
// fails before the DB call, with a clear message.
//
// Metadata keys (single-line values): slug, title, summary (or excerpt), series
// (or seriesSlug), publishAt (a trailing "(local...)" note is dropped), heroImage.

export function parseDraftMarkdown(md: string): DraftInput {
  const end = md.indexOf('-->');
  const meta = end >= 0 ? md.slice(0, end) : '';
  const rest = end >= 0 ? md.slice(end + 3) : md;

  const field = (...keys: string[]): string => {
    for (const k of keys) {
      const m = meta.match(new RegExp(`^\\s*${k}\\s*:\\s*(.+?)\\s*$`, 'mi'));
      if (m) return m[1].trim();
    }
    return '';
  };

  const slug = field('slug').toLowerCase();
  const title = field('title');
  const summary = field('summary', 'excerpt');
  const series = field('series', 'seriesSlug');
  const hero = field('heroImage', 'hero');
  const publishRaw = field('publishAt', 'publish_at');
  const publishAt = publishRaw ? publishRaw.split(/\s+/)[0] : null;

  // Body = the article after the comment. Drop leading blank lines and a leading
  // "# H1" — the post title lives in its own field, so the body must not repeat it.
  const body = rest.replace(/^\s+/, '').replace(/^#\s.*(?:\r?\n)+/, '').trim();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`draft .md: slug must be kebab-case (got "${slug}")`);
  }
  if (!title) throw new Error('draft .md: missing "title" in the metadata block');
  if (!summary) throw new Error('draft .md: missing "summary" (or "excerpt") in the metadata block');
  if (!body) throw new Error('draft .md: empty article body (nothing after the comment block)');

  return {
    slug,
    title,
    summary,
    body,
    seriesSlug: series || null,
    heroImage: hero || null,
    publishAt,
  };
}
