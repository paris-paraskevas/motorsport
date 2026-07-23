import { betDb, isBettingConfigured } from './betting/client';

// Server-only. Like/dislike tallies for blog posts, keyed by post slug (immutable
// and also covers legacy MDX posts). Identity is resolved in the API route:
// signed-in readers key by Clerk user id, anonymous readers by a salted IP hash
// (the raw IP never reaches here). RLS-on / service_role-only; all access via here.

export type Reaction = 'like' | 'dislike';

export interface ReactionSummary {
  likes: number;
  dislikes: number;
  /** The caller's own current reaction, if any. */
  mine: Reaction | null;
}

// Exactly one identity is set (the migration enforces the XOR); this mirrors it.
export type Voter =
  | { userId: string; ipHash?: undefined }
  | { userId?: undefined; ipHash: string };

const EMPTY: ReactionSummary = { likes: 0, dislikes: 0, mine: null };

function identity(voter: Voter): { col: 'user_id' | 'ip_hash'; val: string } {
  // Discriminate on `!== undefined` (not truthiness): the union's variants set
  // exactly one of userId/ipHash, and only `!== undefined` narrows it cleanly.
  if (voter.userId !== undefined) return { col: 'user_id', val: voter.userId };
  return { col: 'ip_hash', val: voter.ipHash };
}

/** Like/dislike counts for a post plus the caller's own reaction. Fail-soft:
 *  returns zeros when Supabase is unconfigured or a query errors — a reaction
 *  widget must never break the post page. */
export async function getReactionSummary(slug: string, voter: Voter | null): Promise<ReactionSummary> {
  if (!isBettingConfigured()) return EMPTY;
  try {
    const db = betDb();
    const id = voter ? identity(voter) : null;
    const [likeRes, dislikeRes, mineRes] = await Promise.all([
      db.from('post_reaction').select('*', { count: 'exact', head: true }).eq('post_slug', slug).eq('reaction', 'like'),
      db.from('post_reaction').select('*', { count: 'exact', head: true }).eq('post_slug', slug).eq('reaction', 'dislike'),
      id
        ? db.from('post_reaction').select('reaction').eq('post_slug', slug).eq(id.col, id.val).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const mine = (mineRes.data as { reaction?: Reaction } | null)?.reaction ?? null;
    return { likes: likeRes.count ?? 0, dislikes: dislikeRes.count ?? 0, mine };
  } catch {
    return EMPTY;
  }
}

/** Set (or switch) the caller's reaction. Select-then-insert/update rather than
 *  upsert: the dedup uniques are partial (one per identity kind) and Postgres
 *  can't infer a partial index from a plain ON CONFLICT — the partial unique
 *  index still guards against a concurrent double-insert at the DB level. */
export async function setReaction(slug: string, voter: Voter, reaction: Reaction): Promise<void> {
  const db = betDb();
  const { col, val } = identity(voter);
  const { data: existing } = await db
    .from('post_reaction')
    .select('id')
    .eq('post_slug', slug)
    .eq(col, val)
    .maybeSingle();
  if (existing) {
    const { error } = await db
      .from('post_reaction')
      .update({ reaction, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('post_reaction').insert({
      post_slug: slug,
      reaction,
      user_id: voter.userId ?? null,
      ip_hash: voter.ipHash ?? null,
    });
    if (error) throw new Error(error.message);
  }
}

/** Remove the caller's reaction (clicking the active one again). */
export async function removeReaction(slug: string, voter: Voter): Promise<void> {
  const db = betDb();
  const { col, val } = identity(voter);
  const { error } = await db.from('post_reaction').delete().eq('post_slug', slug).eq(col, val);
  if (error) throw new Error(error.message);
}
