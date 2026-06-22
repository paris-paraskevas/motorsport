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
  nickname: string | null;
  wins: number;
  placed: number;
  winRate: number;
}

/** League standings by win-rate (wins / placed), then wins; only members with >= minPlaced bets rank.
 *  Reads league_member directly so the per-league nickname rides along — the leaderboard shows it
 *  over the global display name (the league_leaderboard view dropped it). */
export async function getLeaderboard(leagueId: string, minPlaced = 1): Promise<LeaderboardRow[]> {
  const { data, error } = await betDb()
    .from('league_member')
    .select('user_id, nickname, wins, placed')
    .eq('league_id', leagueId);
  if (error) throw new Error(`getLeaderboard failed: ${error.message}`);
  const rows = (data ?? [])
    .map(r => {
      const wins = (r.wins as number) ?? 0;
      const placed = (r.placed as number) ?? 0;
      return {
        userId: r.user_id as string,
        nickname: (r.nickname as string | null) ?? null,
        wins,
        placed,
        winRate: placed > 0 ? wins / placed : 0,
      };
    })
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

/** A prize a member has won in this league (rank → medal in the UI). */
export interface MemberAward {
  period: string;
  rank: number;
  title: string;
}
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
  awards: MemberAward[];
}
/** One completed period's podium (the league's trophy cabinet). */
export interface LeagueHonour {
  period: string;
  label: string;
  podium: { rank: number; userId: string; name: string; title: string }[];
}
export interface LeagueDetail {
  id: string;
  name: string;
  joinCode: string;
  isOwner: boolean;
  isMember: boolean;
  members: LeagueMemberDetail[];
  honours: LeagueHonour[];
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
  const awards = await getLeagueAwards(leagueId);
  // names must also cover award winners who may have since left the league.
  const allIds = [...new Set([...ids, ...awards.map(a => a.userId)])];
  const [names, states] = await Promise.all([
    displayNames(allIds),
    friendStates(viewerId, ids.filter(id => id !== viewerId)),
  ]);

  const awardsByUser = new Map<string, MemberAward[]>();
  for (const a of awards) {
    const list = awardsByUser.get(a.userId) ?? [];
    list.push({ period: a.period, rank: a.rank, title: a.title });
    awardsByUser.set(a.userId, list);
  }

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
        awards: awardsByUser.get(uid) ?? [],
      };
    })
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);

  // Group awards into per-period podiums (already ordered period-desc, rank-asc).
  const byPeriod = new Map<string, typeof awards>();
  for (const a of awards) {
    const list = byPeriod.get(a.period) ?? [];
    list.push(a);
    byPeriod.set(a.period, list);
  }
  const honours: LeagueHonour[] = [...byPeriod.entries()].map(([period, list]) => ({
    period,
    label: formatPeriodLabel(period),
    podium: list.map(a => ({
      rank: a.rank,
      userId: a.userId,
      name: names.get(a.userId) ?? `Racer ${a.userId.slice(-4)}`,
      title: a.title,
    })),
  }));

  return {
    id: league.id as string,
    name: league.name as string,
    joinCode: league.join_code as string,
    isOwner: (league.owner_id as string) === viewerId,
    isMember: ids.includes(viewerId),
    members: detail,
    honours,
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

// ---- prizes (P4) -----------------------------------------------------------
// Period titles/badges for the top 3 by win-rate. NO credits (locked). Awards
// are a point-in-time snapshot per completed period, written by the daily
// award-prizes cron at the boundary and rendered as medals on the league page.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Human label for a period key: '2026-06' → 'June 2026'; '2026-season' → '2026 Season'. */
export function formatPeriodLabel(period: string): string {
  if (period.endsWith('-season')) return `${period.slice(0, 4)} Season`;
  const [year, month] = period.split('-');
  const name = MONTH_NAMES[Number(month) - 1];
  return name ? `${name} ${year}` : period;
}

export interface LeagueAwardRow {
  period: string;
  rank: number;
  userId: string;
  title: string;
  wins: number;
  placed: number;
  awardedAt: string;
}

/** Every award a league has earned, newest period first, ranks ascending. */
export async function getLeagueAwards(leagueId: string): Promise<LeagueAwardRow[]> {
  const { data, error } = await betDb()
    .from('league_award')
    .select('period, rank, user_id, title, wins, placed, awarded_at')
    .eq('league_id', leagueId)
    .order('period', { ascending: false })
    .order('rank', { ascending: true });
  if (error) throw new Error(`getLeagueAwards failed: ${error.message}`);
  return (data ?? []).map(a => ({
    period: a.period as string,
    rank: a.rank as number,
    userId: a.user_id as string,
    title: a.title as string,
    wins: a.wins as number,
    placed: a.placed as number,
    awardedAt: a.awarded_at as string,
  }));
}

/** Award the top-3 (by win-rate, min `minPlaced` settled bets) of every league
 *  over [startISO, endISO). Idempotent per (league, period) in SQL. */
export async function awardLeaguePrizes(
  period: string,
  label: string,
  startISO: string,
  endISO: string,
  minPlaced = 3,
): Promise<{ period: string; awarded: number }> {
  const { data, error } = await betDb().rpc('award_league_prizes', {
    p_period: period,
    p_label: label,
    p_start: startISO,
    p_end: endISO,
    p_min_placed: minPlaced,
  });
  if (error) throw new Error(`awardLeaguePrizes failed: ${error.message}`);
  return data as { period: string; awarded: number };
}

export interface AwardSummary {
  awarded: { period: string; awarded: number }[];
}

// Award only periods that ended at least this many days ago, so a race that runs
// at the very end of a period and settles a day or two later still counts.
const GRACE_DAYS = 3;

/** Award the most-recently-completed calendar month and season (year), once each
 *  is past the grace window. Called by the daily cron; idempotent. */
export async function awardDuePrizes(now: Date = new Date()): Promise<AwardSummary> {
  const cutoff = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000);
  const out: AwardSummary = { awarded: [] };

  // Latest completed month relative to the (graced) cutoff.
  const monthEnd = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), 1));
  const monthStart = new Date(Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth() - 1, 1));
  const monthPeriod = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;
  out.awarded.push(
    await awardLeaguePrizes(monthPeriod, formatPeriodLabel(monthPeriod), monthStart.toISOString(), monthEnd.toISOString()),
  );

  // Latest completed calendar year (the "season").
  const yearEnd = new Date(Date.UTC(cutoff.getUTCFullYear(), 0, 1));
  const yearStart = new Date(Date.UTC(yearEnd.getUTCFullYear() - 1, 0, 1));
  const seasonPeriod = `${yearStart.getUTCFullYear()}-season`;
  out.awarded.push(
    await awardLeaguePrizes(seasonPeriod, formatPeriodLabel(seasonPeriod), yearStart.toISOString(), yearEnd.toISOString()),
  );

  return out;
}
