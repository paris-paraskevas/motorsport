import { betDb } from './client';
import { getBalance } from './credits';

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
