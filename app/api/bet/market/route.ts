import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { getOpenMarkets } from '@/lib/betting/markets';
import { ensureBettingUser } from '@/lib/betting/credits';
import { getUserBets } from '@/lib/betting/bets';
import { getUserLeagues } from '@/lib/betting/leagues';
import { MARKET_TYPE_ORDER } from '@/lib/betting/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Client data source for the weekend betting embed — the weekend page is ISR, so
// it can't server-fetch per-user market state. Returns ALL open markets for a
// (series, round) — winner, podium, … sorted by type — plus, when signed in, the
// viewer's balance, leagues, and their bets across those markets. 503-safe
// (returns { available:false } when unprovisioned).
export async function GET(req: Request) {
  if (!isBettingConfigured()) {
    return NextResponse.json({ available: false });
  }
  const { searchParams } = new URL(req.url);
  const series = searchParams.get('series') ?? '';
  const round = Number(searchParams.get('round'));
  if (!series || !Number.isInteger(round)) {
    return NextResponse.json({ error: 'series and round required' }, { status: 400 });
  }

  const typeRank = (t: string) => {
    const i = MARKET_TYPE_ORDER.indexOf(t);
    return i < 0 ? MARKET_TYPE_ORDER.length : i;
  };

  try {
    const markets = (await getOpenMarkets())
      .filter(m => m.seriesSlug === series && m.round === round)
      .sort((a, b) => typeRank(a.type) - typeRank(b.type));
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ available: true, signedIn: false, markets });
    }
    const balance = await ensureBettingUser(userId);
    const [allBets, leagues] = await Promise.all([getUserBets(userId), getUserLeagues(userId)]);
    const ids = new Set(markets.map(m => m.id));
    const bets = allBets.filter(b => ids.has(b.marketId));
    return NextResponse.json({ available: true, signedIn: true, markets, balance, bets, leagues });
  } catch (err) {
    // Log server-side for diagnosis; never surface raw DB/internal errors to the client.
    console.error('bet/market failed', err);
    return NextResponse.json({ available: true, error: 'internal error' }, { status: 500 });
  }
}
