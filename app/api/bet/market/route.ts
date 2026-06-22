import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { getOpenMarkets } from '@/lib/betting/markets';
import { ensureBettingUser } from '@/lib/betting/credits';
import { getUserBets } from '@/lib/betting/bets';
import { getUserLeagues } from '@/lib/betting/leagues';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Client data source for the weekend betting embed — the weekend page is ISR, so
// it can't server-fetch per-user market state. Returns the open market for a
// (series, round) plus, when signed in, the viewer's balance, leagues, and their
// bets on that market. 503-safe (returns { available:false } when unprovisioned).
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

  try {
    const market = (await getOpenMarkets()).find(m => m.seriesSlug === series && m.round === round) ?? null;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ available: true, signedIn: false, market });
    }
    const balance = await ensureBettingUser(userId);
    const [allBets, leagues] = await Promise.all([getUserBets(userId), getUserLeagues(userId)]);
    const bets = market ? allBets.filter(b => b.marketId === market.id) : [];
    return NextResponse.json({ available: true, signedIn: true, market, balance, bets, leagues });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ available: true, error: message }, { status: 500 });
  }
}
