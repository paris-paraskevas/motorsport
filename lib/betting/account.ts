import { betDb } from './client';
import { getBalance } from './credits';
import { friendStates, type FriendState } from './friends';
import { getUserLeagues } from './leagues';

// Server-only. The signed-in user's own account stats for the Account page:
// credits, join date, friend + league counts. Four reads in one parallel wave
// (the cross-region DB makes round-trips dear — keep them concurrent).
export interface AccountStats {
  balance: number;
  joinedAt: string | null;
  friendCount: number;
  leagueCount: number;
}

export async function getAccountStats(userId: string): Promise<AccountStats> {
  const db = betDb();
  const [balance, joined, friends, leagues] = await Promise.all([
    getBalance(userId),
    db.from('app_user').select('created_at').eq('clerk_user_id', userId).maybeSingle(),
    db
      .from('friendship')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    db.from('league_member').select('league_id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  return {
    balance,
    joinedAt: (joined.data?.created_at as string | undefined) ?? null,
    friendCount: friends.count ?? 0,
    leagueCount: leagues.count ?? 0,
  };
}

export interface UserProfile {
  userId: string;
  exists: boolean;
  displayName: string | null;
  joinedAt: string | null;
  friendCount: number;
  leagueCount: number;
  relationship: FriendState | 'self';
  // The target's leagues (id + name only) — populated for friends + self, null
  // for everyone else. This is the friends-only visibility gate.
  leagues: { id: string; name: string }[] | null;
}

// A public profile for `targetId` as seen by `viewerId` (null = signed out).
// Never exposes the balance; leagues are friends-only. Same batched-read shape
// as getAccountStats — the cross-region DB makes round-trips dear.
export async function getUserProfile(targetId: string, viewerId: string | null): Promise<UserProfile> {
  const db = betDb();
  const isSelf = viewerId != null && viewerId === targetId;
  const [user, friends, leagues, states] = await Promise.all([
    db.from('app_user').select('display_name, created_at').eq('clerk_user_id', targetId).maybeSingle(),
    db
      .from('friendship')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`requester_id.eq.${targetId},addressee_id.eq.${targetId}`),
    db.from('league_member').select('league_id', { count: 'exact', head: true }).eq('user_id', targetId),
    viewerId && !isSelf ? friendStates(viewerId, [targetId]) : Promise.resolve(new Map<string, FriendState>()),
  ]);
  const relationship: FriendState | 'self' = isSelf ? 'self' : states.get(targetId) ?? 'none';
  const canSeeLeagues = isSelf || relationship === 'friends';
  const leagueList = canSeeLeagues
    ? (await getUserLeagues(targetId)).map(l => ({ id: l.id, name: l.name }))
    : null;
  return {
    userId: targetId,
    exists: Boolean(user.data),
    displayName: (user.data?.display_name as string | null) ?? null,
    joinedAt: (user.data?.created_at as string | undefined) ?? null,
    friendCount: friends.count ?? 0,
    leagueCount: leagues.count ?? 0,
    relationship,
    leagues: leagueList,
  };
}
