// Pure author-profile shape + validation. NO database import on purpose: the
// client form (components/author/AuthorProfileForm) imports the limits and would
// otherwise drag lib/betting/client (and the service-role Supabase client) into a
// client bundle. lib/authors.ts is the server half that reads and writes rows.

export interface AuthorLink {
  label: string;
  url: string;
}

export interface AuthorProfileInput {
  slug: string;
  displayName: string;
  bio: string;
  links: AuthorLink[];
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const BIO_MIN = 40;
export const BIO_MAX = 1200;
export const LINKS_MAX = 6;
export const LINK_LABEL_MAX = 24;
const URL_MAX = 2048;

/** Keep only absolute https links with a label. These render as href on the public
 *  profile AND as Person.sameAs in its JSON-LD, so a javascript:, protocol-relative
 *  or relative value is both an injection shape and a broken identity claim.
 *  Order is preserved: it is editorial. */
export function sanitizeLinks(raw: unknown): AuthorLink[] {
  if (!Array.isArray(raw)) return [];
  const out: AuthorLink[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { label, url } = entry as { label?: unknown; url?: unknown };
    if (typeof label !== 'string' || typeof url !== 'string') continue;
    const trimmedLabel = label.trim();
    const trimmedUrl = url.trim();
    if (!trimmedLabel || !trimmedUrl.startsWith('https://') || trimmedUrl.length > URL_MAX) continue;
    out.push({ label: trimmedLabel, url: trimmedUrl });
  }
  return out;
}

/** Validate + normalize what an author typed. Throws with a message written for the
 *  form (the API maps a throw to 422).
 *
 *  `roleTitle` is deliberately absent: it is the masthead label ("Founder &
 *  Editor") and stays admin-set, so a new contributor cannot self-promote. */
export function validateAuthorProfile(input: AuthorProfileInput): AuthorProfileInput {
  const slug = input.slug.trim().toLowerCase();
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX || !SLUG_RE.test(slug)) {
    throw new Error(
      `Your profile address must be ${SLUG_MIN}-${SLUG_MAX} characters: lowercase letters, numbers and single hyphens.`,
    );
  }
  const displayName = input.displayName.trim().replace(/\s+/g, ' ');
  if (displayName.length < NAME_MIN || displayName.length > NAME_MAX) {
    throw new Error(`Your name must be between ${NAME_MIN} and ${NAME_MAX} characters.`);
  }
  // The minimum length is the thin-content guard: a profile is an indexable page,
  // and a two-word bio is exactly the stub that should never exist.
  const bio = input.bio.trim();
  if (bio.length < BIO_MIN || bio.length > BIO_MAX) {
    throw new Error(`Your bio must be between ${BIO_MIN} and ${BIO_MAX} characters.`);
  }
  const links = sanitizeLinks(input.links);
  if (links.length > LINKS_MAX) throw new Error(`You can add up to ${LINKS_MAX} links.`);
  if (links.some(l => l.label.length > LINK_LABEL_MAX)) {
    throw new Error(`Link labels must be ${LINK_LABEL_MAX} characters or fewer.`);
  }
  // A row the author filled in that sanitizeLinks dropped would vanish silently on
  // save, so refuse the whole save instead and say why.
  const supplied = Array.isArray(input.links)
    ? input.links.filter(l => l && (l.label?.trim() || l.url?.trim()))
    : [];
  if (supplied.length !== links.length) {
    throw new Error('Every link needs a label and an https:// address.');
  }
  return { slug, displayName, bio, links };
}
