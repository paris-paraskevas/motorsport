import { slugify } from './slug';

// The release index (X6 A): the `# ` headers of RELEASES.md as key, label and
// address slug. RELEASES.md stays out of the Worker bundle (it grows with every
// push), so this is all the Worker knows of the releases: the sitemap, which is
// regenerated on the Worker every six hours, lists the release pages from the
// bundled RELEASE_INDEX that scripts/bundle-content.mts emits through
// parseReleaseIndex; the pages themselves are prerendered at build from the
// file. The header grammar is the one app/(app)/changelog/releases.ts parses
// (`# Release 15 · The finishing pass`): one regex, one separator, shared. This
// module imports relatively so the bundle script can run it under tsx.

export interface ReleaseRef {
  /** The identity token before the separator, e.g. "Release 15" or "1.0"; the whole header without one. */
  key: string;
  /** The display name after the separator; the whole header without one. */
  label: string;
  /** The page's address segment: the label's slug, the key's when the label yields nothing. */
  slug: string;
}

/** A release header: `# ` then the text. `^#\s` cannot match `## `, so the two levels stay apart without a lookahead. */
export const RELEASE_RE = /^#\s+(.+?)\s*$/;
/** Separator between a release's identity token and its name (U+00B7). */
export const KEY_SEPARATOR = ' · ';

/** The key and the label of one release header line, or null for any other line. */
export function releaseHeader(line: string): { key: string; label: string } | null {
  const m = RELEASE_RE.exec(line);
  if (!m) return null;
  const raw = m[1].trim();
  const at = raw.indexOf(KEY_SEPARATOR);
  return at === -1 ? { key: raw, label: raw } : { key: raw.slice(0, at).trim(), label: raw.slice(at + KEY_SEPARATOR.length).trim() };
}

/** The address segment of a release: the label's slug, the key's when the label gives nothing. */
export function releaseSlug(r: { key: string; label: string }): string {
  return slugify(r.label) || slugify(r.key);
}

/** Every release header of the markdown in file order (newest first, as the file is authored). */
export function parseReleaseIndex(markdown: string): ReleaseRef[] {
  const out: ReleaseRef[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const h = releaseHeader(line);
    if (h) out.push({ ...h, slug: releaseSlug(h) });
  }
  return out;
}
