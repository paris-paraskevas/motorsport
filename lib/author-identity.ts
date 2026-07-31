import { clerkClient } from '@clerk/nextjs/server';
import { readResultsCache, writeResultsCache } from './results-cache';

// Server-only. Name + avatar for a writer, resolved from CLERK (the source the
// author edits in their own account), KV-cached 1h, fail-soft to a stored
// fallback name (no avatar) when Clerk is unreachable or the user can't be
// resolved. Clerk is authoritative here, which is why a byline can differ from
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
    const u = await (await clerkClient()).users.getUser(clerkUserId);
    const name =
      u.fullName ||
      [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
      u.username ||
      fallbackName;
    // `imageUrl` is ALWAYS populated: with no uploaded photo Clerk serves its own
    // generated placeholder, so trusting it means every photo-less author gets a
    // generic grey avatar and our initial tile never renders. `hasImage` is the
    // only way to tell the two apart (observed live: the Greek contributor's
    // profile showed Clerk's default until this gate went in).
    const result = { name: name ?? null, image: u.hasImage ? u.imageUrl || null : null };
    await writeResultsCache(key, result, 60 * 60);
    return result;
  } catch {
    return { name: fallbackName, image: null };
  }
}
