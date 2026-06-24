import type { DriverStanding, ConstructorStanding } from '@/lib/types';
import { withF1LastGood } from '@/lib/f1-cache';

export type { DriverStanding, ConstructorStanding };

const DRIVER_URL = 'https://api.jolpi.ca/ergast/f1/current/driverStandings.json';
const CONSTRUCTOR_URL = 'https://api.jolpi.ca/ergast/f1/current/constructorStandings.json';

interface RawDriver {
  position?: string;
  points?: string;
  wins?: string;
  Driver?: { givenName?: string; familyName?: string; code?: string };
  Constructors?: Array<{ name?: string }>;
}

interface RawConstructor {
  position?: string;
  points?: string;
  wins?: string;
  Constructor?: { name?: string };
}

interface DriverPayload {
  MRData?: {
    StandingsTable?: {
      StandingsLists?: Array<{ DriverStandings?: RawDriver[] }>;
    };
  };
}

interface ConstructorPayload {
  MRData?: {
    StandingsTable?: {
      StandingsLists?: Array<{ ConstructorStandings?: RawConstructor[] }>;
    };
  };
}

function parseDrivers(payload: DriverPayload): DriverStanding[] | null {
  const list = payload?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings;
  if (!Array.isArray(list)) return null;
  const drivers: DriverStanding[] = [];
  for (const raw of list) {
    const position = Number(raw?.position);
    const points = Number(raw?.points);
    const givenName = raw?.Driver?.givenName;
    const familyName = raw?.Driver?.familyName;
    const team = raw?.Constructors?.[0]?.name;
    if (!Number.isFinite(position) || !Number.isFinite(points)) return null;
    if (!givenName || !familyName || !team) return null;
    const wins = raw?.wins != null ? Number(raw.wins) : undefined;
    drivers.push({
      position,
      driverName: `${givenName} ${familyName}`,
      driverCode: raw?.Driver?.code,
      team,
      points,
      wins: Number.isFinite(wins as number) ? (wins as number) : undefined,
    });
  }
  return drivers;
}

function parseConstructors(payload: ConstructorPayload): ConstructorStanding[] | null {
  const list = payload?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings;
  if (!Array.isArray(list)) return null;
  const constructors: ConstructorStanding[] = [];
  for (const raw of list) {
    const position = Number(raw?.position);
    const points = Number(raw?.points);
    const name = raw?.Constructor?.name;
    if (!Number.isFinite(position) || !Number.isFinite(points)) return null;
    if (!name) return null;
    const wins = raw?.wins != null ? Number(raw.wins) : undefined;
    constructors.push({
      position,
      name,
      points,
      wins: Number.isFinite(wins as number) ? (wins as number) : undefined,
    });
  }
  return constructors;
}

type F1Standings = {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
};

async function fetchF1StandingsLive(): Promise<F1Standings | null> {
  try {
    const [driverRes, constructorRes] = await Promise.all([
      fetch(DRIVER_URL, { next: { revalidate: 3600 } }),
      fetch(CONSTRUCTOR_URL, { next: { revalidate: 3600 } }),
    ]);
    if (!driverRes.ok || !constructorRes.ok) return null;
    const [driverJson, constructorJson] = (await Promise.all([
      driverRes.json(),
      constructorRes.json(),
    ])) as [DriverPayload, ConstructorPayload];
    const drivers = parseDrivers(driverJson);
    const constructors = parseConstructors(constructorJson);
    if (!drivers || !constructors) return null;
    return { drivers, constructors };
  } catch {
    return null;
  }
}

/**
 * Public standings fetch, wrapped in the KV last-good read-through so a Jolpica
 * outage (HTTP 521, network error, or unexpected shape → null) serves the last
 * successful standings instead of blanking the page. Self-heals on the next
 * good fetch. Fails open when KV is unconfigured (local dev): behaves exactly
 * like `fetchF1StandingsLive`. Return type is unchanged for callers.
 */
export async function fetchF1Standings(): Promise<F1Standings | null> {
  return withF1LastGood<F1Standings | null>(
    'standings',
    fetchF1StandingsLive,
    result => result == null || result.drivers.length === 0 || result.constructors.length === 0,
  );
}
