import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureAppUser } from '@/lib/betting/credits';
import { isAdmin, isWriter } from '@/lib/threads';
import { getAuthorByClerkId, upsertAuthorProfile, type AuthorLink } from '@/lib/authors';
import { authorPostVisibility, setAuthorPostVisibility } from '@/lib/blog';
import { allowRequest } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The author's OWN public profile: the bio, links and per-post visibility behind
// /authors/<slug>. Both handlers key every read and write on the caller's Clerk id,
// so there is no path to another author's row. Writer-or-admin only; a reader with
// no writing role has no profile to edit.
async function requireWriter(): Promise<{ userId: string } | NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = await currentUser();
  if (!isWriter(user) && !isAdmin(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return { userId };
}

export async function GET() {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;

  const [profile, posts] = await Promise.all([
    getAuthorByClerkId(gate.userId),
    authorPostVisibility(gate.userId),
  ]);
  return NextResponse.json({ profile, posts });
}

export async function PUT(req: Request) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;

  // Authenticated, but still capped: a save rewrites a public page and busts its
  // cache, so a stuck client cannot hammer it.
  if (!(await allowRequest(`author-profile:${gate.userId}`, 20, 10 * 60))) {
    return NextResponse.json({ error: 'too many saves — try again in a few minutes' }, { status: 429 });
  }

  let body: {
    slug?: unknown;
    displayName?: unknown;
    bio?: unknown;
    links?: unknown;
    hiddenPostIds?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const links: AuthorLink[] = Array.isArray(body.links)
    ? body.links.map(l => ({
        label: str((l as { label?: unknown } | null)?.label),
        url: str((l as { url?: unknown } | null)?.url),
      }))
    : [];
  const hiddenPostIds = Array.isArray(body.hiddenPostIds)
    ? body.hiddenPostIds.filter((id): id is string => typeof id === 'string')
    : [];

  try {
    // The author row FKs app_user, so a writer who has never touched the betting
    // side needs mirroring first (same guard the draft-create path uses).
    await ensureAppUser(gate.userId);
    const previous = await getAuthorByClerkId(gate.userId);
    const slug = await upsertAuthorProfile(gate.userId, {
      slug: str(body.slug),
      displayName: str(body.displayName),
      bio: str(body.bio),
      links,
    });
    await setAuthorPostVisibility(gate.userId, hiddenPostIds);

    // ISR pages that just went stale. The old path matters too: changing a slug
    // leaves the previous URL cached and now 404-worthy.
    revalidatePath('/authors');
    revalidatePath(`/authors/${slug}`);
    if (previous && previous.slug !== slug) revalidatePath(`/authors/${previous.slug}`);
    revalidatePath('/blog');
    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'could not save your profile';
    // Validation messages are written for the form; anything else is a real fault.
    const domain = /must be|already taken|needs a label|up to|characters/i.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: domain ? 422 : 500 });
  }
}
