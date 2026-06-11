import { type ImsaClass } from '@/lib/standings/imsa';
import manifest from '@/content/series/imsa/alkamel-rounds.json';

// IMSA WeatherTech SportsCar Championship — full-class race results sourced
// directly from Al Kamel Systems' open Apache index at
// `imsa.results.alkamelcloud.com`. The sibling endpoint
// `05_Results by Class_Race_Official.JSON` pre-buckets the classification by
// class (GTP / LMP2 / GTD Pro / GTD) — every session of every round,
// unauthenticated, no reCAPTCHA. Beats the PDF-behind-reCAPTCHA path the
// per-series-source-audit feared.
//
// The Alkamel directory layout is not catalog-discoverable — folder names
// embed timestamps and the 24h endurance races nest the final classification
// under `24_Hour 24/` while sprint races sit directly under the `Race/`
// folder. Rather than scrape the index to discover URLs at runtime, we
// curate the full URL per round in `content/series/imsa/alkamel-rounds.json`.
// Conversational authoring (one line per completed round) maps cleanly to
// the project's content model.

export interface ImsaRaceEntry {
  position: number;
  // Car number as a string to preserve leading zeros (e.g. "04", "911").
  carNumber: string;
  team: string;
  // Multi-driver crews space-joined per IMSA/WRC/WEC convention. Alkamel's
  // `drivers[]` preserves a specific ordering (typically Driver 1 / 2 / 3
  // by license rating); we keep that ordering verbatim.
  drivers: string;
  vehicle: string;
  manufacturer: string;
  laps: number;
  // "Classified", "Not Started", or whatever Alkamel emits. Preserved as-is
  // so the UI can show the literal upstream status when timing is absent.
  status: string;
  // "+1.569" or "76 Laps" for non-leaders, empty string for the leader.
  gap: string;
  // "24:01:20.108" — the leader's total race time. Empty for DNS entries.
  elapsedTime: string;
}

export interface ImsaRoundResults {
  round: number;
  // "Rolex 24 at Daytona" — from Alkamel's `session.event_name`.
  eventName: string;
  // "Daytona International Speedway" — from `session.circuit.name`.
  circuit: string;
  // Race date parsed from `session.session_date` (DD-MM-YYYY HH:MM). The
  // HH:MM portion is unreliable upstream (sometimes a 12-hour rollover, see
  // probe notes) so we only honour the date component.
  date: Date;
  // Classes that did not contest the round are omitted entirely, mirroring
  // the `Partial<Record>` shape used by `lib/standings/imsa.ts`. Sprint
  // rounds (Long Beach, Detroit) skip LMP2 + GTD Pro; full-season rounds
  // run all four classes.
  perClass: Partial<Record<ImsaClass, ImsaRaceEntry[]>>;
}

interface AlkamelDriver {
  firstname: string;
  surname: string;
}

interface AlkamelEntry {
  status: string;
  position: number;
  number: string;
  team: string;
  class: string;
  vehicle: string;
  manufacturer: string;
  laps: string;
  elapsed_time: string;
  gap_first: string;
  drivers: AlkamelDriver[];
}

interface AlkamelClassification {
  name: string;
  classification: AlkamelEntry[];
}

interface AlkamelJson {
  session: {
    event_name: string;
    session_date: string;
    circuit: { name: string };
  };
  classifications: AlkamelClassification[];
}

const FETCH_HEADERS = {
  // Alkamel's Apache index serves whatever client connects without
  // user-agent filtering, but we send a real one anyway in case the CDN
  // tightens later.
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
};

// Alkamel class names are uppercase, no space (GTDPRO). Our canonical
// `ImsaClass` enum uses the title-case label IMSA itself uses on broadcasts
// ("GTD Pro"). Unknown class names map to null and are skipped.
function normalizeClassName(raw: string): ImsaClass | null {
  switch (raw) {
    case 'GTP':
      return 'GTP';
    case 'LMP2':
      return 'LMP2';
    case 'GTDPRO':
      return 'GTD Pro';
    case 'GTD':
      return 'GTD';
    default:
      return null;
  }
}

function parseEventDate(raw: string): Date | null {
  // "24-01-2026 01:40" — DD-MM-YYYY HH:MM. The HH:MM is unreliable upstream
  // (often a 12-hour rollover with no AM/PM marker, see probe-2026-05-22).
  // We only consume the date component and anchor at UTC midnight; consumers
  // that need venue-local time should pull from `content/series/imsa/sessions.json`.
  // Separator varies per event: Detroit 2026 filed "30/05/2026" where every
  // earlier round used dashes — a dash-only regex silently dropped the whole
  // round (validation 2026-06-11). Accept both.
  const match = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(raw);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function joinDriverNames(drivers: AlkamelDriver[] | undefined): string {
  if (!Array.isArray(drivers)) return '';
  return drivers
    .map(d => `${d.firstname ?? ''} ${d.surname ?? ''}`.trim())
    .filter(s => s.length > 0)
    .join(' ');
}

function parseEntry(raw: AlkamelEntry): ImsaRaceEntry | null {
  if (!Number.isFinite(raw.position)) return null;
  return {
    position: raw.position,
    carNumber: raw.number,
    team: raw.team,
    drivers: joinDriverNames(raw.drivers),
    vehicle: raw.vehicle,
    manufacturer: raw.manufacturer,
    laps: Number(raw.laps) || 0,
    status: raw.status,
    gap: raw.gap_first ?? '',
    elapsedTime: raw.elapsed_time ?? '',
  };
}

export async function fetchImsaRoundResults(
  url: string,
  round: number,
): Promise<ImsaRoundResults | null> {
  let raw: string;
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      // Hourly revalidate matches the standings loader. Alkamel marks each
      // file Official/Provisional/Unofficial — once Official is filed (a few
      // days after the race) the data is frozen, so caching aggressively is
      // safe.
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    raw = await res.text();
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(raw.replace(/^﻿/, '')) as AlkamelJson;
    if (!data?.session || !Array.isArray(data.classifications)) return null;

    const perClass: Partial<Record<ImsaClass, ImsaRaceEntry[]>> = {};
    for (const cls of data.classifications) {
      const normalized = normalizeClassName(cls.name);
      if (!normalized) continue;
      const entries = (cls.classification ?? [])
        .map(parseEntry)
        .filter((e): e is ImsaRaceEntry => e !== null);
      if (entries.length === 0) continue;
      entries.sort((a, b) => a.position - b.position);
      perClass[normalized] = entries;
    }
    if (Object.keys(perClass).length === 0) return null;

    const date = parseEventDate(data.session.session_date);
    if (!date) return null;

    return {
      round,
      eventName: data.session.event_name ?? '',
      circuit: data.session.circuit?.name ?? '',
      date,
      perClass,
    };
  } catch {
    return null;
  }
}

export async function fetchImsaSeasonResults(): Promise<ImsaRoundResults[]> {
  const rounds = manifest.rounds ?? [];
  const settled = await Promise.all(
    rounds.map(r => fetchImsaRoundResults(r.url, r.round)),
  );
  return settled
    .filter((r): r is ImsaRoundResults => r !== null)
    .sort((a, b) => a.round - b.round);
}
