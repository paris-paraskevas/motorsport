import { accountById } from './auth/directory';
import { readResultsCache, writeResultsCache } from './results-cache';

// Server-only. Name + avatar for a writer, resolved from the account directory
// (lib/auth/directory.ts, the provider the author edits in their own account),
// KV-cached 1h, fail-soft to a stored fallback name (no avatar) when the
// directory is unreachable or the id can't be resolved. The account is
// authoritative here, which is why a byline can differ from
// app_user.display_name / author.display_name.
//
// Lifted verbatim out of app/(app)/blog/[slug]/page.tsx when /authors/<slug>
// became the second consumer — the profile page must render the same identity
// as the byline that links to it. The cache key is unchanged
// (`paddock:blog-author:*`) so existing warm entries kept serving; it has since
// gained a `v2:` segment, for the reason documented at the key itself.
//
// The ENTIRE body is inside the try (the KV read/write used to sit outside it):
// this is a decoration, and no decoration may 500 a blog URL.

export interface AuthorIdentity {
  name: string | null;
  image: string | null;
}

export async function resolveAuthorIdentity(
  clerkUserId: string,
  fallbackName: string | null,
): Promise<AuthorIdentity> {
  try {
    // v2: entries written before the `hasImage` gate cached Clerk's generated
    // placeholder as a real image, so a plain key reuse would serve the old
    // behaviour for up to an hour. The v1 entries expire on their own TTL.
    const key = `paddock:blog-author:v2:${clerkUserId}`;
    const cached = await readResultsCache<AuthorIdentity>(key);
    if (cached) return cached;
    const account = await accountById(clerkUserId);
    // The account's imageUrl is a photo the author uploaded, or null: Clerk's own
    // imageUrl is ALWAYS populated (a generated placeholder without a photo), and
    // trusting it gave every photo-less author a generic grey avatar while our
    // initial tile never rendered, so the seam applies Clerk's hasImage gate once
    // (observed live: the Greek contributor's profile showed Clerk's default until it went in).
    const result = { name: account?.name || account?.username || fallbackName || null, image: account?.imageUrl ?? null };
    await writeResultsCache(key, result, 60 * 60);
    return result;
  } catch {
    return { name: fallbackName, image: null };
  }
}
