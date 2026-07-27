import { withSourceSnapshot } from '@/lib/source-snapshot';
import type { DriverStanding, ConstructorStanding } from '@/lib/types';
import { fetchFomStandings } from '@/lib/results/fom-api';

export type { DriverStanding, ConstructorStanding };

// F3 standings come from the shared FOM API client (lib/results/fom-api.ts) —
// same api.formula1.com breakdown endpoints and identical handling to F2 (the
// two FIA sites are the same App-Router app on different brand ids). The old
// __NEXT_DATA__ scrape of fiaformula3.com died in the same rebuild. Wrapped in
// the durable source-snapshot last-good.
export async function fetchF3Standings(): Promise<{
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
} | null> {
  return withSourceSnapshot(
    'standings:f3',
    () => fetchFomStandings('f3', new Date().getUTCFullYear()),
    v => v == null || v.drivers.length === 0,
  );
}
