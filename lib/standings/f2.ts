import { withSourceSnapshot } from '@/lib/source-snapshot';
import type { DriverStanding, ConstructorStanding } from '@/lib/types';
import { fetchFomStandings } from '@/lib/results/fom-api';

export type { DriverStanding, ConstructorStanding };

// F2 standings come from the shared FOM API client (lib/results/fom-api.ts) —
// the api.formula1.com driver/constructor-standings-breakdown endpoints the
// rebuilt fiaformula2.com uses. The old __NEXT_DATA__ scrape of /Standings/Driver
// + /Standings/Team died when the FIA site was rebuilt (same root cause as F2
// results). Wrapped in the durable source-snapshot last-good so a transient API
// blip serves the last good standings instead of blanking the tab.
export async function fetchF2Standings(): Promise<{
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
} | null> {
  return withSourceSnapshot(
    'standings:f2',
    () => fetchFomStandings('f2', new Date().getUTCFullYear()),
    v => v == null || v.drivers.length === 0,
  );
}
