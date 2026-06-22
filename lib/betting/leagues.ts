import { betDb } from './client';
import { displayNames, friendStates, type FriendState } from './friends';

// Server-only. Friend leagues: create, join by code, and the win-rate
// leaderboard. League bets pool pari-mutuel (see settlement.ts).

function makeJoinCode(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Create a peer-pool league; the owner is added as the first member. */
export async function createLeague(ownerId: string, name: string): Promise<{ id: string; joinCode: string }> {
  const db = betDb();
  const joinCode = makeJoinCode();
  const { data, error } = await db
    .from('league')
    .insert({ owner_id: ownerId, name, join_code: joinCode, mode: 'peer_pool' })
    .select('id, join_code')
    .single();
  if (error) throw new Error(`createLeague failed: ${error.message}`);
  const { error: mErr } = await db
    .from('league_member')
    .upsert({ league_id: data.id, user_id: ownerId }, { onConflict: 'league_id,user_id', ignoreDuplicates: true });
  if (mErr) throw new Error(`createLeague (add owner) failed: ${mErr.message}`);
  return { id: data.id as string, joinCode: data.join_code as string };
}

/** Join a league by its code. Returns the league id. */
export async function joinLeague(userId: string, joinCode: string): Promise<string> {
  const db = betDb();
  const { data: league, error } = await db
    .from('league')
    .select('id')
    .eq('join_code', joinCode.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(`joinLeague lookup failed: ${error.message}`);
  if (!league) throw new Error('no league for that code');
  const { error: mErr } = await db
    .from('league_member')
    .upsert({ league_id: league.id, user_id: userId }, { onConflict: 'league_id,user_id', ignoreDuplicates: true });
  if (mErr) throw new Error(`joinLeague failed: ${mErr.message}`);
  return league.id as string;
}

export interface LeaderboardRow {
  userId: string;
  displayName: string | null;
  wins: number;
  placed: number;
  winRate: number;
}

/** League standings by win-rate (wins / placed), then wins; only members with >= minPlaced bets rank. */
export async function getLeaderboard(leagueId: string, minPlaced = 1): Promise<LeaderboardRow[]> {
  const { data, error } = await betDb()
    .from('league_leaderboard')
    .select('user_id, wins, placed, win_rate')
    .eq('league_id', leagueId);
  if (error) throw new Error(`getLeaderboard failed: ${error.message}`);
  const rows = (data ?? [])
    .map(r => ({ userId: r.user_id as string, wins: r.wins as number, placed: r.placed as number, winRate: Number(r.win_rate) }))
    .filter(r => r.placed >= minPlaced)
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
  const names = await displayNames(rows.map(r => r.userId));
  return rows.map(r => ({ ...r, displayName: names.get(r.userId) ?? null }));
}

export interface UserLeague {
  id: string;
  name: string;
  joinCode: string;
  mode: string;
  isOwner: boolean;
  memberCount: number;
}

/** Leagues the user belongs to, with member counts. */
export async function getUserLeagues(userId: string): Promise<UserLeague[]> {
  const db = betDb();
  const { data: mine, error } = await db.from('league_member').select('league_id').eq('user_id', userId);
  if (error) throw new Error(`getUserLeagues failed: ${error.message}`);
  const ids = (mine ?? []).map(r => r.league_id as string);
  if (ids.length === 0) return [];

  const [{ data: leagues, error: lErr }, { data: members, error: mErr }] = await Promise.all([
    db.from('league').select('id, name, join_code, mode, owner_id').in('id', ids),
    db.from('league_member').select('league_id').in('league_id', ids),
  ]);
  if (lErr) throw new Error(`getUserLeagues (leagues) failed: ${lErr.message}`);
  if (mErr) throw new Error(`getUserLeagues (members) failed: ${mErr.message}`);

  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    const id = m.league_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return (leagues ?? []).map(l => ({
    id: l.id as string,
    name: l.name as string,
    joinCode: l.join_code as string,
    mode: l.mode as string,
    isOwner: (l.owner_id as string) === userId,
    memberCount: counts.get(l.id as string) ?? 0,
  }));
}

// ---- invite links ----------------------------------------------------------

function makeInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/** Get (or create) a member's stable invite token for a league. Members only. */
export async function getOrCreateInvite(leagueId: string, inviterId: string): Promise<string> {
  const db = betDb();
  const { data: member } = await db
    .from('league_member')
    .select('league_id')
    .eq('league_id', leagueId)
    .eq('user_id', inviterId)
    .maybeSingle();
  if (!member) throw new Error('only league members can invite');

  const { data: existing } = await db
    .from('league_invite')
    .select('token')
    .eq('league_id', leagueId)
    .eq('inviter_id', inviterId)
    .maybeSingle();
  if (existing) return existing.token as string;

  const token = makeInviteToken();
  const { error } = await db.from('league_invite').insert({ token, league_id: leagueId, inviter_id: inviterId });
  if (error) {
    // lost a race to create the (league, inviter) row — re-read the winner's token
    const { data: again } = await db
      .from('league_invite')
      .select('token')
      .eq('league_id', leagueId)
      .eq('inviter_id', inviterId)
      .maybeSingle();
    if (again) return again.token as string;
    throw new Error(`getOrCreateInvite failed: ${error.message}`);
  }
  return token;
}

export interface InviteInfo {
  token: string;
  leagueId: string;
  leagueName: string;
  inviterId: string;
  inviterName: string | null;
}

/** Resolve an invite token → league + inviter, or null if unknown. */
export async function getInvite(token: string): Promise<InviteInfo | null> {
  const db = betDb();
  const { data, error } = await db
    .from('league_invite')
    .select('token, league_id, inviter_id')
    .eq('token', token)
    .maybeSingle();
  if (error || !data) return null;
  const [{ data: league }, { data: inviter }] = await Promise.all([
    db.from('league').select('name').eq('id', data.league_id).maybeSingle(),
    db.from('app_user').select('display_name').eq('clerk_user_id', data.inviter_id).maybeSingle(),
  ]);
  return {
    token: data.token as string,
    leagueId: data.league_id as string,
    leagueName: (league?.name as string) ?? 'a league',
    inviterId: data.inviter_id as string,
    inviterName: (inviter?.display_name as string | null) ?? null,
  };
}

/** Join a league via an invite token. Adds the member; returns the league + inviter. */
export async function joinLeagueByToken(userId: string, token: string): Promise<{ leagueId: string; inviterId: string }> {
  const invite = await getInvite(token);
  if (!invite) throw new Error('invalid or expired invite');
  const { error } = await betDb()
    .from('league_member')
    .upsert({ league_id: invite.leagueId, user_id: userId }, { onConflict: 'league_id,user_id', ignoreDuplicates: true });
  if (error) throw new Error(`joinLeagueByToken failed: ${error.message}`);
  return { leagueId: invite.leagueId, inviterId: invite.inviterId };
}

// ---- league detail (dedicated page) ----------------------------------------

export interface LeagueMemberDetail {
  userId: string;
  displayName: string | null;
  nickname: string | null;
  color: string | null;
  wins: number;
  placed: number;
  winRate: number;
  isYou: boolean;
  friendState: FriendState;
}
export interface LeagueDetail {
  id: string;
  name: string;
  joinCode: string;
  isOwner: boolean;
  isMember: boolean;
  members: LeagueMemberDetail[];
}

/** Everything the league page needs (members ranked by win-rate, names, nicknames,
 *  colours, friend state vs the viewer). Null if the league doesn't exist. */
export async function getLeagueDetail(leagueId: string, viewerId: string): Promise<LeagueDetail | null> {
  const db = betDb();
  const { data: league } = await db.from('league').select('id, name, join_code, owner_id').eq('id', leagueId).maybeSingle();
  if (!league) return null;
  const { data: members } = await db
    .from('league_member')
    .select('user_id, nickname, color, wins, placed')
    .eq('league_id', leagueId);
  const rows = members ?? [];
  const ids = rows.map(m => m.user_id as string);
  const [names, states] = await Promise.all([
    displayNames(ids),
    friendStates(viewerId, ids.filter(id => id !== viewerId)),
  ]);
  const detail: LeagueMemberDetail[] = rows
    .map(m => {
      const uid = m.user_id as string;
      const wins = (m.wins as number) ?? 0;
      const placed = (m.placed as number) ?? 0;
      return {
        userId: uid,
        displayName: names.get(uid) ?? null,
        nickname: (m.nickname as string | null) ?? null,
        color: (m.color as string | null) ?? null,
        wins,
        placed,
        winRate: placed > 0 ? wins / placed : 0,
        isYou: uid === viewerId,
        friendState: (uid === viewerId ? 'friends' : states.get(uid) ?? 'none') as FriendState,
      };
    })
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
  return {
    id: league.id as string,
    name: league.name as string,
    joinCode: league.join_code as string,
    isOwner: (league.owner_id as string) === viewerId,
    isMember: ids.includes(viewerId),
    members: detail,
  };
}

/** Set a member's nickname/colour. ANY league member may set it for ANY member. */
export async function setMemberProfile(
  leagueId: string,
  byUserId: string,
  targetUserId: string,
  profile: { nickname?: string | null; color?: string | null },
): Promise<void> {
  const db = betDb();
  const { data: editor } = await db
    .from('league_member')
    .select('user_id')
    .eq('league_id', leagueId)
    .eq('user_id', byUserId)
    .maybeSingle();
  if (!editor) throw new Error('only league members can edit profiles');
  const patch: Record<string, string | null> = {};
  if (profile.nickname !== undefined) {
    const n = profile.nickname?.trim() ?? '';
    patch.nickname = n ? n.slice(0, 40) : null;
  }
  if (profile.color !== undefined) {
    const c = profile.color?.trim() ?? '';
    patch.color = /^#[0-9a-fA-F]{6}$/.test(c) ? c : null; // only #rrggbb
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await db.from('league_member').update(patch).eq('league_id', leagueId).eq('user_id', targetUserId);
  if (error) throw new Error(`setMemberProfile failed: ${error.message}`);
}

/** Rename a league (owner only). */
export async function renameLeague(leagueId: string, ownerId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) throw new Error('name must be 1–60 characters');
  const { error } = await betDb().from('league').update({ name: trimmed }).eq('id', leagueId).eq('owner_id', ownerId);
  if (error) throw new Error(`renameLeague failed: ${error.message}`);
}

/** Disband a league (owner only). Cascades members + invites; any pending league
 *  bets are detached (bet.league_id → null) and thereafter settle solo. */
export async function disbandLeague(leagueId: string, ownerId: string): Promise<void> {
  const { error, count } = await betDb()
    .from('league')
    .delete({ count: 'exact' })
    .eq('id', leagueId)
    .eq('owner_id', ownerId);
  if (error) throw new Error(`disbandLeague failed: ${error.message}`);
  if (!count) throw new Error('league not found, or you are not the owner');
}

/** Remove a member (owner only; the owner can't kick themselves — disband instead). */
export async function kickMember(leagueId: string, ownerId: string, targetUserId: string): Promise<void> {
  const db = betDb();
  const { data: league } = await db.from('league').select('owner_id').eq('id', leagueId).maybeSingle();
  if (!league || (league.owner_id as string) !== ownerId) throw new Error('only the owner can remove members');
  if (targetUserId === ownerId) throw new Error('the owner cannot be removed — disband the league instead');
  const { error } = await db.from('league_member').delete().eq('league_id', leagueId).eq('user_id', targetUserId);
  if (error) throw new Error(`kickMember failed: ${error.message}`);
}
