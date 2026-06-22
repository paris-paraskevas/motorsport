import { betDb } from './client';

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
  return (data ?? [])
    .map(r => ({ userId: r.user_id as string, wins: r.wins as number, placed: r.placed as number, winRate: Number(r.win_rate) }))
    .filter(r => r.placed >= minPlaced)
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
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
