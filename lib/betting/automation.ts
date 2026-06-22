import { betDb } from './client';
import { createWinnerMarket } from './markets';
import type { DriverForm } from './pricing';
import { loadAllSeries } from '@/lib/series';
import { buildRoundLookupAcrossSeries } from '@/lib/weekend';
import { looksLikeRaceSession } from '@/lib/results-ready';
import { fetchF1Standings } from '@/lib/standings/f1';

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
 * Open a winner market for each configured series' next upcoming race — priced
 * from current standings, locking at the race session start. Idempotent: skips
 * a round that already has a winner market. Fail-soft per series, so one bad
 * feed never blocks the others.
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
      const next = series.sessions
        .filter(ss => ss.start > now && looksLikeRaceSession(ss.title))
        .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
      if (!next) {
        summary.skipped.push(`${slug}: no upcoming race session`);
        continue;
      }
      const round = roundLookup.get(`${slug}:${next.uid}`);
      if (!round) {
        summary.skipped.push(`${slug}: no round mapped for ${next.uid}`);
        continue;
      }
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
        locksAt: next.start.toISOString(),
        field,
      });
      summary.opened.push(
        `${slug} R${round} winner — ${field.length} drivers, locks ${next.start.toISOString()} (${id})`,
      );
    } catch (err) {
      summary.errors.push(`${slug}: ${err instanceof Error ? err.message : 'error'}`);
    }
  }
  return summary;
}
