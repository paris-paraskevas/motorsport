import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureBettingUser } from '@/lib/betting/credits';
import { placeBet } from '@/lib/betting/bets';
import { selectionForMarket } from '@/lib/betting/markets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Place a bet (winner / podium / …), solo or into a league pool. Auth via Clerk; the user is lazily onboarded
// (mirror + monthly grant) on first hit. The atomic SQL `place_bet` is the real
// guard — open market + sufficient balance — so this route just validates shape.
// 503s when the betting DB isn't provisioned, so it's inert in prod until then.
export async function POST(req: Request) {
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'betting not available' }, { status: 503 });
  }
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { marketId?: unknown; pick?: unknown; stake?: unknown; leagueId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const marketId = typeof body.marketId === 'string' ? body.marketId : '';
  const pick = typeof body.pick === 'string' ? body.pick.trim() : '';
  const stake = Number(body.stake);
  if (!marketId || !pick) {
    return NextResponse.json({ error: 'marketId and pick are required' }, { status: 400 });
  }
  if (!Number.isInteger(stake) || stake <= 0 || stake > 1_000_000) {
    return NextResponse.json({ error: 'stake must be a positive integer' }, { status: 400 });
  }

  const leagueId = typeof body.leagueId === 'string' && body.leagueId ? body.leagueId : undefined;

  try {
    await ensureBettingUser(userId);
    // The server keys the selection by market type (winner→{winner}, podium→{driver})
    // so it always matches settlement, whatever the client sends.
    const selection = await selectionForMarket(marketId, pick);
    const betId = await placeBet(userId, marketId, selection, stake, leagueId);
    return NextResponse.json({ ok: true, betId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    // place_bet raises domain errors (market not open / insufficient balance /
    // already bet) — surface those as 422, anything else as 500.
    const domain = /not open|insufficient|already|not a member|market not found|stake must|positive/i.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: domain ? 422 : 500 });
  }
}
