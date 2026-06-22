// Client-safe betting constants — NO server-only imports (no node:fs), so this
// is importable from 'use client' components and from the server-only allowance
// / grant code alike. See lib/betting/allowance.ts for the economy rationale.
export const STANDARD_STAKE = 100; // the unit of "a bet" — the UI default stake
export const PER_WEEKEND_CREDITS = 100; // ~one standard bet per race weekend
export const BASE_CREDITS = 50; // off-month floor (F1 has 0-race months: Jan/Feb/Apr)
