// Client-safe betting constants — NO server-only imports (no node:fs), so this
// is importable from 'use client' components and from the server-only allowance
// / grant code alike. See lib/betting/allowance.ts for the economy rationale.
export const STANDARD_STAKE = 100; // the unit of "a bet" — the UI default stake
export const PER_WEEKEND_CREDITS = 100; // ~one standard bet per race weekend
export const BASE_CREDITS = 50; // off-month floor (F1 has 0-race months: Jan/Feb/Apr)

// Per-market-type UI + selection metadata. `selectionKey` is the JSON key a pick
// is stored under in bet.selection_json — it MUST match what settlement reads
// (settle_market / settleLeagueMarket): winner→'winner', podium→'driver'.
export interface MarketTypeMeta {
  label: string; // card heading
  blurb: string; // one-line "what you're backing"
  cta: string; // signed-out CTA verb
  selectionKey: string; // JSON key the pick is stored under
}
export const MARKET_TYPE_META: Record<string, MarketTypeMeta> = {
  winner: { label: 'Race winner', blurb: 'Back the driver you think wins.', cta: 'back the winner', selectionKey: 'winner' },
  podium: { label: 'Podium — top 3', blurb: 'Back a driver to finish in the top three.', cta: 'back a podium finisher', selectionKey: 'driver' },
  top10: { label: 'Top 10 finish', blurb: 'Back a driver to finish in the points — top ten.', cta: 'back a top-10 finish', selectionKey: 'driver' },
  exact_position: { label: 'Exact finish', blurb: 'Pick a driver and their exact finishing position.', cta: 'call an exact finish', selectionKey: 'driver' },
  forecast: { label: 'Forecast', blurb: 'Pick two or more drivers and their exact finishing positions — all or nothing.', cta: 'call a forecast', selectionKey: 'legs' },
};
// Display order for a round's markets (unknown types fall to the end).
export const MARKET_TYPE_ORDER = ['winner', 'podium', 'top10', 'exact_position', 'forecast'];

/** Split an exact-position odds map (keyed `driver@position`, as written by
 *  exactPositionMultipliers) into its drivers (favourite-first by win odds) and
 *  positions (ascending) — the source the driver/position picker renders from. */
export function parseExactPositionOdds(odds: Record<string, number>): { drivers: string[]; positions: number[] } {
  const drivers = new Set<string>();
  const positions = new Set<number>();
  for (const key of Object.keys(odds)) {
    const at = key.lastIndexOf('@');
    if (at < 0) continue;
    drivers.add(key.slice(0, at));
    const pos = Number(key.slice(at + 1));
    if (Number.isInteger(pos)) positions.add(pos);
  }
  return {
    drivers: [...drivers].sort((a, b) => (odds[`${a}@1`] ?? Infinity) - (odds[`${b}@1`] ?? Infinity)),
    positions: [...positions].sort((a, b) => a - b),
  };
}

/** Human-readable summary of a bet's selection — NEVER raw JSON. Selection shapes
 *  (see lib/betting/markets selectionForMarket): winner→{winner}, podium/top10→
 *  {driver}, exact_position→{driver,position}, forecast→{legs:[{driver,position}]}. */
export function formatBetSelection(type: string, selection: Record<string, unknown>): string {
  const name = selection.winner ?? selection.driver;
  const driver = typeof name === 'string' ? name : undefined;
  if (type === 'forecast' && Array.isArray(selection.legs)) {
    const parts = (selection.legs as unknown[]).flatMap(leg => {
      const l = (leg ?? {}) as Record<string, unknown>;
      const d = l.driver ?? l.winner;
      if (typeof d !== 'string') return [];
      return [typeof l.position === 'number' ? `${d} P${l.position}` : d];
    });
    if (parts.length) return parts.join(', ');
  }
  if (type === 'exact_position' && driver && typeof selection.position === 'number') {
    return `${driver} P${selection.position}`;
  }
  return driver ?? '—';
}
