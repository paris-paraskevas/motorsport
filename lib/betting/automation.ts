import { betDb } from './client';
import { createWinnerMarket, settleMarket } from './markets';
import type { DriverForm } from './pricing';
import { loadAllSeries } from '@/lib/series';
import { buildRoundLookupAcrossSeries } from '@/lib/weekend';
import { looksLikeRaceSession, looksLikeQualifying } from '@/lib/results-ready';
import { fetchF1Standings } from '@/lib/standings/f1';
import { settleLeagueMarket } from './settlement';
import { fetchF1SeasonResults } from '@/lib/results/f1';
import type { RaceResult } from '@/lib/types';

// Server-only. Auto-open winner markets for upcoming races. A series qualifies
// when its field can be priced as {name, points} from a standings source whose
// driver names match the results feed used at settlement — so a winning pick
// resolves cleanly. F1 first (Jolpica names are identical on both sides); add
// adapters here as other series line up.
const FIELD_SOURCES: Record<string, () => Promise<DriverForm[] | null>> = {
  f1: async () => {
    const s = await fetchF1Standings();
    return s ? s.drivers.map(d => ({ name: d.driverName, points: d.points })) : null;
  },
};

export interface OpenMarketsSummary {
  opened: string[];
  skipped: string[];
  errors: string[];
}

/**
 * Open a winner market for each configured series' next bettable race weekend —
 * priced from current standings, locking 1h before the grid qualifying (you bet
 * before quali reveals pace). Idempotent: skips a round that already has a
 * winner market. Fail-soft per series, so one bad feed never blocks the others.
 */
export async function openUpcomingMarkets(): Promise<OpenMarketsSummary> {
  const summary: OpenMarketsSummary = { opened: [], skipped: [], errors: [] };
  const all = await loadAllSeries();
  const now = new Date();
  const roundLookup = buildRoundLookupAcrossSeries(all, now);
  const db = betDb();

  for (const [slug, getField] of Object.entries(FIELD_SOURCES)) {
    try {
      const series = all.find(s => s.meta.slug === slug);
      if (!series) {
        summary.errors.push(`${slug}: series not loaded`);
        continue;
      }
      // Pick the soonest upcoming race weekend whose grid-qualifying is more
      // than an hour away — an in-progress weekend past that cutoff rolls to
      // the next. Lock = quali start − 1h.
      const upcomingRaces = series.sessions
        .filter(ss => ss.start > now && looksLikeRaceSession(ss.title))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      let target: { round: number; locksAt: Date } | null = null;
      for (const race of upcomingRaces) {
        const r = roundLookup.get(`${slug}:${race.uid}`);
        if (!r) continue;
        const quali = series.sessions.find(
          ss => !ss.dateOnly && looksLikeQualifying(ss.title) && roundLookup.get(`${slug}:${ss.uid}`) === r,
        );
        if (!quali) {
          summary.skipped.push(`${slug} R${r}: no qualifying session — can't time the lock`);
          continue;
        }
        const locksAt = new Date(quali.start.getTime() - 60 * 60 * 1000);
        if (locksAt.getTime() <= now.getTime()) continue; // betting window already closed
        target = { round: r, locksAt };
        break;
      }
      if (!target) {
        summary.skipped.push(`${slug}: no upcoming weekend still open for betting`);
        continue;
      }
      const { round, locksAt } = target;

      const { data: existing } = await db
        .from('market')
        .select('id')
        .eq('series_slug', slug)
        .eq('round', round)
        .eq('type', 'winner')
        .maybeSingle();
      if (existing) {
        summary.skipped.push(`${slug} R${round}: winner market already open`);
        continue;
      }
      const field = await getField();
      if (!field || field.length === 0) {
        summary.errors.push(`${slug}: could not price field`);
        continue;
      }
      const id = await createWinnerMarket({
        seriesSlug: slug,
        round,
        locksAt: locksAt.toISOString(),
        field,
      });
      summary.opened.push(
        `${slug} R${round} winner — ${field.length} drivers, locks ${locksAt.toISOString()} (quali−1h) (${id})`,
      );
    } catch (err) {
      summary.errors.push(`${slug}: ${err instanceof Error ? err.message : 'error'}`);
    }
  }
  return summary;
}

// ---- settlement ------------------------------------------------------------

const RESULT_SOURCES: Record<string, () => Promise<RaceResult[]>> = {
  f1: () => fetchF1SeasonResults(),
};

/** The official winner (P1 driver name) for a series' round, or null if the
 *  classification isn't in yet. Names come from the same feed used to price the
 *  market, so a winning pick resolves cleanly. */
function winnerForRound(races: RaceResult[], round: number): string | null {
  const race = races.find(r => r.round === round && (r.results?.length ?? 0) > 0);
  const p1 = race?.results.find(e => e.position === 1);
  return p1?.driverName ?? null;
}

export interface SettleSummary {
  settled: string[];
  awaiting: string[];
  errors: string[];
}

/**
 * Settle every market past its lock that isn't settled yet, once its OFFICIAL
 * classification is in (provisional-is-final, design §5). League peer pools
 * settle pari-mutuel first, then the solo book settles fixed-odds and the
 * market flips to settled. Idempotent: a settled market drops out of the
 * `status='open'` query, and the SQL refuses to re-settle a pool/market.
 */
export async function settleDueMarkets(): Promise<SettleSummary> {
  const summary: SettleSummary = { settled: [], awaiting: [], errors: [] };
  const db = betDb();
  const { data: due, error } = await db
    .from('market')
    .select('id, series_slug, round, type')
    .eq('status', 'open')
    .lt('locks_at', new Date().toISOString());
  if (error) throw new Error(`settleDueMarkets: load failed: ${error.message}`);

  const feedCache = new Map<string, RaceResult[] | null>();

  for (const m of due ?? []) {
    const slug = m.series_slug as string;
    const round = m.round as number;
    const marketId = m.id as string;
    try {
      if (m.type !== 'winner') {
        summary.awaiting.push(`${slug} R${round}: ${m.type} settlement not supported yet`);
        continue;
      }
      const source = RESULT_SOURCES[slug];
      if (!source) {
        summary.awaiting.push(`${slug} R${round}: no result source`);
        continue;
      }
      let feed = feedCache.get(slug);
      if (feed === undefined) {
        feed = await source().catch(() => null);
        feedCache.set(slug, feed);
      }
      if (!feed) {
        summary.errors.push(`${slug} R${round}: result fetch failed`);
        continue;
      }
      const winner = winnerForRound(feed, round);
      if (!winner) {
        summary.awaiting.push(`${slug} R${round}: official result not in yet`);
        continue;
      }
      // League peer pools first (pari-mutuel), then the solo book (fixed-odds),
      // which also flips the market to settled.
      const { data: leagueRows } = await db
        .from('bet')
        .select('league_id')
        .eq('market_id', marketId)
        .not('league_id', 'is', null);
      const leagueIds = [...new Set((leagueRows ?? []).map(r => r.league_id as string))];
      for (const leagueId of leagueIds) {
        await settleLeagueMarket(marketId, leagueId, { winner });
      }
      const solo = await settleMarket(marketId, { winner });
      summary.settled.push(
        `${slug} R${round} → ${winner} · solo ${solo.won}W/${solo.lost}L paid ${solo.paidCredits} · ${leagueIds.length} pool(s)`,
      );
    } catch (err) {
      summary.errors.push(`${slug} R${round}: ${err instanceof Error ? err.message : 'error'}`);
    }
  }
  return summary;
}
