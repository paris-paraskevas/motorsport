import { betDb } from './client';

// Server-only. Global friend graph: send/respond to requests + list. One row per
// unordered pair (DB-enforced); 'pending' -> 'accepted', decline deletes.
// Reused by league invites (a join befriends the inviter) and the league page's
// "add friend". Names resolve from app_user.display_name (best-effort).

export interface Friend {
  userId: string;
  displayName: string | null;
  since: string | null;
}
export interface IncomingRequest {
  requesterId: string;
  displayName: string | null;
  createdAt: string;
}

// PostgREST OR filter matching a friendship row in either direction.
const pairFilter = (a: string, b: string) =>
  `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`;

/** Resolve display names for a set of clerk ids → Map(id -> name|null). */
export async function displayNames(ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const { data } = await betDb().from('app_user').select('clerk_user_id, display_name').in('clerk_user_id', ids);
  return new Map((data ?? []).map(u => [u.clerk_user_id as string, (u.display_name as string | null) ?? null]));
}

/**
 * Send (or auto-complete) a friend request. Idempotent + reciprocal-aware:
 * already friends → 'already'; a pending request the OTHER way → accept it
 * ('accepted'); a pending request THIS way → 'already'; otherwise create one.
 */
export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string,
): Promise<'requested' | 'accepted' | 'already' | 'self'> {
  if (fromUserId === toUserId) return 'self';
  const db = betDb();
  const { data: existing } = await db
    .from('friendship')
    .select('id, requester_id, status')
    .or(pairFilter(fromUserId, toUserId))
    .maybeSingle();
  if (existing) {
    if (existing.status === 'accepted') return 'already';
    if (existing.requester_id === toUserId) {
      await db
        .from('friendship')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', existing.id);
      return 'accepted';
    }
    return 'already';
  }
  const { error } = await db.from('friendship').insert({ requester_id: fromUserId, addressee_id: toUserId });
  if (error) throw new Error(`sendFriendRequest failed: ${error.message}`);
  return 'requested';
}

/** Accept (→ friends) or decline (→ delete) a pending request to `addresseeId` from `requesterId`. */
export async function respondToFriendRequest(addresseeId: string, requesterId: string, accept: boolean): Promise<void> {
  const db = betDb();
  const { error } = accept
    ? await db
        .from('friendship')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('requester_id', requesterId)
        .eq('addressee_id', addresseeId)
        .eq('status', 'pending')
    : await db
        .from('friendship')
        .delete()
        .eq('requester_id', requesterId)
        .eq('addressee_id', addresseeId)
        .eq('status', 'pending');
  if (error) throw new Error(`respondToFriendRequest failed: ${error.message}`);
}

/** A user's accepted friends (the other side of each edge), name-resolved. */
export async function listFriends(userId: string): Promise<Friend[]> {
  const { data, error } = await betDb()
    .from('friendship')
    .select('requester_id, addressee_id, responded_at')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw new Error(`listFriends failed: ${error.message}`);
  const rows = data ?? [];
  const others = rows.map(r => (r.requester_id === userId ? (r.addressee_id as string) : (r.requester_id as string)));
  const names = await displayNames(others);
  return rows
    .map(r => {
      const other = r.requester_id === userId ? (r.addressee_id as string) : (r.requester_id as string);
      return { userId: other, displayName: names.get(other) ?? null, since: (r.responded_at as string | null) ?? null };
    })
    .sort((a, b) => (a.displayName ?? a.userId).localeCompare(b.displayName ?? b.userId));
}

/** Pending requests awaiting this user's response, name-resolved (newest first). */
export async function listIncomingRequests(userId: string): Promise<IncomingRequest[]> {
  const { data, error } = await betDb()
    .from('friendship')
    .select('requester_id, created_at')
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listIncomingRequests failed: ${error.message}`);
  const rows = data ?? [];
  const names = await displayNames(rows.map(r => r.requester_id as string));
  return rows.map(r => ({
    requesterId: r.requester_id as string,
    displayName: names.get(r.requester_id as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

/** Backfill app_user.display_name from Clerk — only when currently null (never clobbers). */
export async function setDisplayNameIfMissing(userId: string, name: string | null): Promise<void> {
  if (!name) return;
  await betDb().from('app_user').update({ display_name: name }).eq('clerk_user_id', userId).is('display_name', null);
}

/** Best display name from a Clerk user: full name → username → email local-part → null. */
export function clerkDisplayName(
  u: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    primaryEmailAddress?: { emailAddress?: string | null } | null;
  } | null,
): string | null {
  if (!u) return null;
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (u.username) return u.username;
  const email = u.primaryEmailAddress?.emailAddress;
  if (email) return email.split('@')[0];
  return null;
}

export type FriendState = 'none' | 'pending-out' | 'pending-in' | 'friends';

/** Each `otherId`'s relationship to `userId` — for a member list's friend buttons. One query. */
export async function friendStates(userId: string, otherIds: string[]): Promise<Map<string, FriendState>> {
  const out = new Map<string, FriendState>();
  if (otherIds.length === 0) return out;
  const { data } = await betDb()
    .from('friendship')
    .select('requester_id, addressee_id, status')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  const wanted = new Set(otherIds);
  for (const r of data ?? []) {
    const other = (r.requester_id === userId ? r.addressee_id : r.requester_id) as string;
    if (!wanted.has(other)) continue;
    out.set(other, r.status === 'accepted' ? 'friends' : r.requester_id === userId ? 'pending-out' : 'pending-in');
  }
  return out;
}

export interface SearchResult {
  userId: string;
  displayName: string | null;
  friendState: FriendState;
}

/** Find users by display name (case-insensitive substring), excluding the viewer,
 *  each with its friend state vs the viewer. Empty for queries under 2 chars; capped. */
export async function searchUsers(viewerId: string, query: string, limit = 20): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const escaped = q.replace(/[\\%_]/g, '\\$&'); // treat ILIKE wildcards as literals
  const { data, error } = await betDb()
    .from('app_user')
    .select('clerk_user_id, display_name')
    .neq('clerk_user_id', viewerId)
    .not('display_name', 'is', null)
    .ilike('display_name', `%${escaped}%`)
    .limit(limit);
  if (error) throw new Error(`searchUsers failed: ${error.message}`);
  const rows = data ?? [];
  const states = await friendStates(viewerId, rows.map(u => u.clerk_user_id as string));
  return rows
    .map(u => ({
      userId: u.clerk_user_id as string,
      displayName: (u.display_name as string | null) ?? null,
      friendState: states.get(u.clerk_user_id as string) ?? ('none' as FriendState),
    }))
    .sort((a, b) => (a.displayName ?? a.userId).localeCompare(b.displayName ?? b.userId));
}

/** Remove the friendship edge between two users in either direction, any status —
 *  unfriend an accepted friend, or cancel a request you sent. Idempotent. */
export async function removeFriend(userId: string, otherId: string): Promise<void> {
  const { error } = await betDb().from('friendship').delete().or(pairFilter(userId, otherId));
  if (error) throw new Error(`removeFriend failed: ${error.message}`);
}

export interface OutgoingRequest {
  addresseeId: string;
  displayName: string | null;
  createdAt: string;
}

/** Pending requests this user has SENT (for a "sent" list + cancel), name-resolved (newest first). */
export async function listOutgoingRequests(userId: string): Promise<OutgoingRequest[]> {
  const { data, error } = await betDb()
    .from('friendship')
    .select('addressee_id, created_at')
    .eq('requester_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listOutgoingRequests failed: ${error.message}`);
  const rows = data ?? [];
  const names = await displayNames(rows.map(r => r.addressee_id as string));
  return rows.map(r => ({
    addresseeId: r.addressee_id as string,
    displayName: names.get(r.addressee_id as string) ?? null,
    createdAt: r.created_at as string,
  }));
}
