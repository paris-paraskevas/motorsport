// Race Story — client-safe types. The server assembler lives in
// ./racestory-loader (it enriches drivers → series-content → fs, so it must
// not reach a client bundle). Components import types from HERE and the Moment
// type from ./moments (which is already client-safe).

import type { EnrichedDriver } from './drivers';
import type { Moment } from './moments';

export type { Moment } from './moments';

/** One tyre stint for the strategy bands. */
export interface StintBand {
  compound: string | null; // SOFT | MEDIUM | HARD | INTERMEDIATE | WET
  lapStart: number;
  lapEnd: number;
  ageAtStart: number | null;
}

export interface DriverStints {
  driverNumber: number;
  stints: StintBand[];
}

export interface RaceStoryData {
  sessionKey: number;
  drivers: EnrichedDriver[];
  totalLaps: number; // for the stint-band scale
  stints: DriverStints[];
  moments: Moment[]; // race_control + overtakes + pit + radio, chronological
}
