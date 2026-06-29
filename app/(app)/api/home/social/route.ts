import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { getUserLeagues, getLeaderboardsForLeagues } from '@/lib/betting/leagues';
import { listFriends, listIncomingRequests } from '@/lib/betting/friends';

// "Your leagues & friends" home-widget data — signed-in only, per-user, so NOT
// edge-cacheable like the other /api/home/* routes. Returns the user's leagues
// (with member count + their own rank within each) and a friends summary (count
// + pending incoming requests), for the widget's links into /social. Anonymous
// (or betting not configured) → { signedIn:false } so the widget can render a
// subtle sign-in nudge instead of nothing.
//
// auth-gated + per-user ⇒ force-dynamic and Cache-Control: private, no-store
// (mirrors /api/home/bets and the other auth'd routes under app/api/**).
export const dynamic = 'force-dynamic';

// Enough leagues to give the widget a flavour without unrolling the whole list;
// the client's `count` setting (2/3/5) slices this down further.
const LEAGUES_SHOWN = 5;

export interface HomeSocialLeague {
  id: string;
  name: string;
  memberCount: number;
  /** The viewer's 1-based rank in this league's win-rate leaderboard; null if
   *  they don't appear (shouldn't happen for a member, but render-safe). */
  myRank: number | null;
}

export interface HomeSocialData {
  signedIn: boolean;
  leagues: HomeSocialLeague[];
  friends: { count: number; pending: number };
}

const ANON: HomeSocialData = {
  signedIn: false,
  leagues: [],
  friends: { count: 0, pending: 0 },
};

function noStore(data: HomeSocialData) {
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId || !isBettingConfigured()) return noStore(ANON);

  try {
    // Plain reads only — like /api/home/bets, we do NOT call ensureBettingUser
    // (that grants the monthly allowance as a side effect; a passive home-widget
    // read shouldn't trigger an economy action — /play and /social do it).
    const [leagues, friends, pending] = await Promise.all([
      getUserLeagues(userId),
      listFriends(userId),
      listIncomingRequests(userId),
    ]);

    // Rank per league from the win-rate leaderboard (minPlaced=0 so every member
    // ranks, matching the /social/leagues page). Cache-backed per league.
    const shown = leagues.slice(0, LEAGUES_SHOWN);
    const boards = await getLeaderboardsForLeagues(shown.map(l => l.id), 0);
    const leagueLines: HomeSocialLeague[] = shown.map(l => {
      const rows = boards.get(l.id) ?? [];
      const idx = rows.findIndex(r => r.userId === userId);
      return {
        id: l.id,
        name: l.name,
        memberCount: l.memberCount,
        myRank: idx >= 0 ? idx + 1 : null,
      };
    });

    return noStore({
      signedIn: true,
      leagues: leagueLines,
      friends: { count: friends.length, pending: pending.length },
    });
  } catch {
    // Fail-soft to a signed-in-but-empty shape so the widget shows its empty
    // state + CTA rather than disappearing on a transient DB error.
    return noStore({ signedIn: true, leagues: [], friends: { count: 0, pending: 0 } });
  }
}
