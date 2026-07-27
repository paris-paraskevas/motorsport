import { NextResponse } from 'next/server';
import { loadLatestF1Upgrades } from '@/lib/series-content';

// Latest F1 round's declared upgrades, summarised per team (part count) for the
// opt-in home "F1 car upgrades" widget. Reads the curated FIA sidecar (fs), so
// it's cheap + edge-cacheable; fail-soft to null. F1-only (only F1 publishes the
// Car Presentation doc). Mirrors the /api/home/* defer-fetch pattern.
// ISR (force-static + revalidate), not force-dynamic + s-maxage: the s-maxage
// contract was Vercel's edge cache and died in the Cloudflare migration — see
// app/(app)/api/just-missed/route.ts (0.243.0). Same staleness the header promised.
export const dynamic = 'force-static';
export const revalidate = 3600;

export interface HomeUpgradesData {
  round: number;
  gp: string;
  totalParts: number;
  teams: { team: string; count: number }[];
}

const CACHE = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' };

export async function GET() {
  try {
    const latest = await loadLatestF1Upgrades();
    if (!latest) return NextResponse.json(null, { headers: CACHE });
    const teams = latest.teams
      .map(t => ({ team: t.team, count: t.items.length }))
      .sort((a, b) => b.count - a.count);
    const totalParts = teams.reduce((n, t) => n + t.count, 0);
    const data: HomeUpgradesData = { round: latest.round, gp: latest.gp, totalParts, teams };
    return NextResponse.json(data, { headers: CACHE });
  } catch {
    return NextResponse.json(null, { headers: CACHE });
  }
}
