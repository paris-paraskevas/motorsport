import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { getBalance } from '@/lib/betting/credits';
import { getUserBets } from '@/lib/betting/bets';
import { getOpenMarkets } from '@/lib/betting/markets';
import { loadAllSeriesMeta } from '@/lib/series';

// "Your bets & credits" home-widget data — signed-in only, per-user, so NOT
// edge-cacheable like the other /api/home/* routes. Returns the user's open
// (pending) bets, credit balance, and the next market closing, for the widget's
// CTA into /play. Anonymous (or betting not configured) → { signedIn:false } so
// the widget can render a subtle sign-in nudge instead of nothing.
//
// auth-gated + per-user ⇒ force-dynamic and Cache-Control: private, no-store
// (mirrors the other auth'd routes under app/api/** which serve per-user data).
export const dynamic = 'force-dynamic';

// Enough open-bet lines to show a flavour of the slip without unrolling it.
const OPEN_BETS_SHOWN = 3;

export interface HomeBetLine {
  id: string;
  /** Market type key (winner / podium / top10 / exact_position / forecast). */
  type: string;
  /** The raw selection JSON; the client formats it via formatBetSelection. */
  selection: Record<string, unknown>;
  seriesSlug: string;
  seriesName: string | null;
  round: number;
  stake: number;
}

export interface HomeNextMarket {
  seriesSlug: string;
  seriesName: string | null;
  round: number;
  type: string;
  locksAt: string;
}

export interface HomeBetsData {
  signedIn: boolean;
  balance: number;
  openCount: number;
  openBets: HomeBetLine[];
  nextMarket: HomeNextMarket | null;
}

const ANON: HomeBetsData = {
  signedIn: false,
  balance: 0,
  openCount: 0,
  openBets: [],
  nextMarket: null,
};

function noStore(data: HomeBetsData) {
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId || !isBettingConfigured()) return noStore(ANON);

  try {
    // We do NOT call ensureBettingUser here (it grants the monthly allowance as a
    // side effect — a passive home-widget read shouldn't trigger that economy
    // action; /play does it on a deliberate visit). Plain reads only.
    const [balance, allBets, markets, metas] = await Promise.all([
      getBalance(userId),
      getUserBets(userId),
      getOpenMarkets(),
      loadAllSeriesMeta(),
    ]);
    const metaBySlug = new Map(metas.map(m => [m.slug, m]));
    const nameFor = (slug: string): string | null => metaBySlug.get(slug)?.name ?? null;

    const open = allBets.filter(b => b.outcome === 'pending');
    const openBets: HomeBetLine[] = open.slice(0, OPEN_BETS_SHOWN).map(b => ({
      id: b.id,
      type: b.type,
      selection: b.selection,
      seriesSlug: b.seriesSlug,
      seriesName: nameFor(b.seriesSlug),
      round: b.round,
      stake: b.stake,
    }));

    // getOpenMarkets is pre-sorted soonest-locking first and already drops any
    // market past its lock, so [0] is the next one closing.
    const m = markets[0];
    const nextMarket: HomeNextMarket | null = m
      ? { seriesSlug: m.seriesSlug, seriesName: nameFor(m.seriesSlug), round: m.round, type: m.type, locksAt: m.locksAt }
      : null;

    return noStore({ signedIn: true, balance, openCount: open.length, openBets, nextMarket });
  } catch {
    // Fail-soft to a signed-in-but-empty shape so the widget shows the balance
    // shell + CTA rather than disappearing on a transient DB error.
    return noStore({ signedIn: true, balance: 0, openCount: 0, openBets: [], nextMarket: null });
  }
}
