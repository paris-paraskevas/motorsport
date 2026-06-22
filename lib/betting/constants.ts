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
};
// Display order for a round's markets (unknown types fall to the end).
export const MARKET_TYPE_ORDER = ['winner', 'podium', 'top10', 'exact_position'];
