import { betDb, isBettingConfigured } from './betting/client';
import {
  sanitizeLinks,
  validateAuthorProfile,
  type AuthorLink,
  type AuthorProfileInput,
} from './author-profile';

// Server-only. Public author profiles (table `author`, migration 20260728120000):
// the editorial layer over the Clerk id that post.author_id already stores. This
// module is deliberately DB-only — no Clerk import — because lib/sitemap-data.ts
// reads it, and the identity lookup (name + avatar) lives in
// lib/author-identity.ts instead. The pure shape + validation live in
// lib/author-profile.ts so the client form can share the limits without pulling
// the service-role Supabase client into a client bundle.
//
// Fail-soft everywhere, like lib/blog.ts: a profile is what a byline links TO, and
// no decoration may 500 a blog URL. An unconfigured or unreachable Supabase yields
// "no profile", which renders the byline as plain text exactly as it did before.

export type { AuthorLink, AuthorProfileInput };

export interface AuthorProfile {
  clerkUserId: string;
  /** Public URL segment: /authors/<slug>. Chosen per author, not derived. */
  slug: string;
  /** The author's own byline name — authoritative on Paddock surfaces, because they
   *  typed it into /settings/author. Clerk supplies the avatar, and the name only
   *  as a fallback for a writer with no profile row at all. */
  displayName: string;
  /** Masthead label ("Founder & Editor"). Admin-set, never author-set. */
  roleTitle: string | null;
  bio: string;
  links: AuthorLink[];
}

const COLS = 'clerk_user_id, slug, display_name, role_title, bio, links';

// `links` is jsonb, so a stored row's shape is whatever was inserted — re-sanitize
// on the way out, not just on the way in (rows predate the form, and the SQL editor
// can write anything).
function toProfile(r: Record<string, unknown>): AuthorProfile {
  return {
    clerkUserId: r.clerk_user_id as string,
    slug: r.slug as string,
    displayName: r.display_name as string,
    roleTitle: (r.role_title as string | null) ?? null,
    bio: r.bio as string,
    links: sanitizeLinks(r.links),
  };
}

/** Every author profile, alphabetical by display name (the /authors index). */
export async function listAuthors(): Promise<AuthorProfile[]> {
  if (!isBettingConfigured()) return [];
  try {
    const { data, error } = await betDb().from('author').select(COLS).order('display_name');
    if (error || !data) return [];
    return data.map(toProfile);
  } catch {
    return [];
  }
}

/** One profile by its public slug, or null (the page 404s on null). */
export async function getAuthorBySlug(slug: string): Promise<AuthorProfile | null> {
  if (!isBettingConfigured() || !slug) return null;
  try {
    const { data, error } = await betDb().from('author').select(COLS).eq('slug', slug).maybeSingle();
    if (error || !data) return null;
    return toProfile(data);
  } catch {
    return null;
  }
}

/** One profile by Clerk id — the byline's lookup (name + slug to link to) and the
 *  author's own settings screen. Fail-soft: null means "no profile", which renders
 *  a plain-text byline exactly as before. */
export async function getAuthorByClerkId(clerkUserId: string): Promise<AuthorProfile | null> {
  if (!isBettingConfigured() || !clerkUserId) return null;
  try {
    const { data, error } = await betDb()
      .from('author')
      .select(COLS)
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();
    if (error || !data) return null;
    return toProfile(data);
  } catch {
    return null;
  }
}

/** Create or update the caller's OWN profile (the clerk id is the key, so an
 *  author can never write someone else's row). Returns the stored slug.
 *  `role_title` is preserved on update and left null on insert — admin-only. */
export async function upsertAuthorProfile(clerkUserId: string, input: AuthorProfileInput): Promise<string> {
  const clean = validateAuthorProfile(input);
  const db = betDb();
  const now = new Date().toISOString();

  // The slug is unique across authors; catch the collision here so the form can
  // say "taken" rather than surfacing a Postgres constraint string.
  const { data: clash } = await db.from('author').select('clerk_user_id').eq('slug', clean.slug).maybeSingle();
  if (clash && (clash.clerk_user_id as string) !== clerkUserId) {
    throw new Error('That profile URL is already taken — try another.');
  }

  const { error } = await db.from('author').upsert(
    {
      clerk_user_id: clerkUserId,
      slug: clean.slug,
      display_name: clean.displayName,
      bio: clean.bio,
      links: clean.links,
      updated_at: now,
    },
    { onConflict: 'clerk_user_id' },
  );
  if (error) throw new Error(`could not save your profile: ${error.message}`);
  return clean.slug;
}
