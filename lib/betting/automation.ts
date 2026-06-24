import { betDb } from './client';
import { createWinnerMarket, createPodiumMarket, createTop10Market, createForecastMarket, createExactPositionMarket, settleMarket } from './markets';
import { PODIUM_SLOTS, TOP10_SLOTS, type DriverForm } from './pricing';
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

// How many upcoming weekends to keep an open winner market for, per series —
// gives bettors real lead time instead of only ever the single next race.
const LOOKAHEAD_WEEKENDS = 3;

// Market types opened per upcoming weekend. forecast (≥2 drivers + exact finishing
// positions, all-or-nothing; payout = least(product of per-pair odds, 500)) went
// LIVE 0.88.0; exact_position (single driver + exact finishing position) went LIVE
// by operator decision — its picker (ExactPositionBetCard) is wired in
// WeekendBetting and settlement is routed in settleDueMarkets (the `positions`
// branch). All five share the same creation-time-priced field.
const MARKET_BUILDERS: { type: string; create: (opts: Parameters<typeof createWinnerMarket>[0]) => Promise<string> }[] = [
  { type: 'winner', create: createWinnerMarket },
  { type: 'podium', create: createPodiumMarket },
  { type: 'top10', create: createTop10Market },
  { type: 'forecast', create: createForecastMarket },
  { type: 'exact_position', create: createExactPositionMarket },
];

export interface OpenMarketsSummary {
  opened: string[];
  skipped: string[];
  errors: string[];
}

/**
 * Open winner markets for each configured series' next few bettable race
 * weekends (LOOKAHEAD_WEEKENDS) — priced from current standings, each locking 1h
 * before its grid qualifying (you bet before quali reveals pace). Idempotent:
 * skips a round that already has a winner market. Fail-soft per series, so one
 * bad feed never blocks the others.
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
      // Collect the next LOOKAHEAD_WEEKENDS upcoming weekends whose grid
      // qualifying is still >1h away (an in-progress weekend past that cutoff
      // drops out). One winner market per round; lock = grid-quali start − 1h.
      const upcomingRaces = series.sessions
        .filter(ss => ss.start > now && looksLikeRaceSession(ss.title))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      const targets: { round: number; locksAt: Date }[] = [];
      const seenRounds = new Set<number>();
      for (const race of upcomingRaces) {
        if (targets.length >= LOOKAHEAD_WEEKENDS) break;
        const r = roundLookup.get(`${slug}:${race.uid}`);
        if (!r || seenRounds.has(r)) continue;
        const quali = series.sessions.find(
          ss => !ss.dateOnly && looksLikeQualifying(ss.title) && roundLookup.get(`${slug}:${ss.uid}`) === r,
        );
        if (!quali) {
          summary.skipped.push(`${slug} R${r}: no qualifying session — can't time the lock`);
          continue;
        }
        const locksAt = new Date(quali.start.getTime() - 60 * 60 * 1000);
        if (locksAt.getTime() <= now.getTime()) continue; // betting window already closed
        seenRounds.add(r);
        targets.push({ round: r, locksAt });
      }
      if (targets.length === 0) {
        summary.skipped.push(`${slug}: no upcoming weekend still open for betting`);
        continue;
      }

      // Price the field once from current standings; every weekend opened this
      // pass shares these creation-time odds (futures-style — a market's odds
      // are never re-priced after it opens, by design).
      const field = await getField();
      if (!field || field.length === 0) {
        summary.errors.push(`${slug}: could not price field`);
        continue;
      }
      for (const { round, locksAt } of targets) {
        for (const b of MARKET_BUILDERS) {
          const { data: existing } = await db
            .from('market')
            .select('id')
            .eq('series_slug', slug)
            .eq('round', round)
            .eq('type', b.type)
            .maybeSingle();
          if (existing) {
            summary.skipped.push(`${slug} R${round} ${b.type}: market already open`);
            continue;
          }
          const id = await b.create({
            seriesSlug: slug,
            round,
            locksAt: locksAt.toISOString(),
            field,
          });
          summary.opened.push(
            `${slug} R${round} ${b.type} — ${field.length} drivers, locks ${locksAt.toISOString()} (quali−1h) (${id})`,
          );
        }
      }
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

/** The official top-`n` driver names (P1..Pn) for a round, in order, or null
 *  until the full top-`n` classification is in. Same feed/names as pricing, so
 *  picks resolve cleanly. */
function topNForRound(races: RaceResult[], round: number, n: number): string[] | null {
  const race = races.find(r => r.round === round && (r.results?.length ?? 0) > 0);
  if (!race) return null;
  const top = race.results
    .filter(e => e.position >= 1 && e.position <= n)
    .sort((a, b) => a.position - b.position)
    .map(e => e.driverName);
  return top.length === n ? top : null;
}

/** The official finishing position of every classified driver for a round
 *  (driverName -> position), or null until the classification is in. */
function positionsForRound(races: RaceResult[], round: number): Record<string, number> | null {
  const race = races.find(r => r.round === round && (r.results?.length ?? 0) > 0);
  if (!race) return null;
  const map: Record<string, number> = {};
  for (const e of race.results) if (e.position >= 1) map[e.driverName] = e.position;
  return Object.keys(map).length > 0 ? map : null;
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
      if (m.type !== 'winner' && m.type !== 'podium' && m.type !== 'top10' && m.type !== 'exact_position' && m.type !== 'forecast') {
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

      // Build the official result for this market's type from the classification.
      let result: { winner?: string; podium?: string[]; top10?: string[]; positions?: Record<string, number> };
      let label: string;
      if (m.type === 'winner') {
        const winner = winnerForRound(feed, round);
        if (!winner) {
          summary.awaiting.push(`${slug} R${round}: official result not in yet`);
          continue;
        }
        result = { winner };
        label = winner;
      } else if (m.type === 'podium') {
        const podium = topNForRound(feed, round, PODIUM_SLOTS);
        if (!podium) {
          summary.awaiting.push(`${slug} R${round}: official podium not in yet`);
          continue;
        }
        result = { podium };
        label = podium.join(' / ');
      } else if (m.type === 'top10') {
        const top10 = topNForRound(feed, round, TOP10_SLOTS);
        if (!top10) {
          summary.awaiting.push(`${slug} R${round}: official top-10 not in yet`);
          continue;
        }
        result = { top10 };
        label = top10.join(', ');
      } else {
        const positions = positionsForRound(feed, round);
        if (!positions) {
          summary.awaiting.push(`${slug} R${round}: official classification not in yet`);
          continue;
        }
        result = { positions };
        label = `${Object.keys(positions).length} classified`;
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
        await settleLeagueMarket(marketId, leagueId, result);
      }
      const solo = await settleMarket(marketId, result);
      summary.settled.push(
        `${slug} R${round} ${m.type} → ${label} · solo ${solo.won}W/${solo.lost}L paid ${solo.paidCredits} · ${leagueIds.length} pool(s)`,
      );
    } catch (err) {
      summary.errors.push(`${slug} R${round}: ${err instanceof Error ? err.message : 'error'}`);
    }
  }
  return summary;
}
