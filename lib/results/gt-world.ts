import * as cheerio from 'cheerio';

// GT World Challenge Europe — per-event race results.
//
// URL shape:
//   https://www.gt-world-challenge-europe.com/results/{year}/{event-slug}
//     ?filter_race_id={raceId}
//
// Without `filter_race_id` the event page renders the per-session fastest
// entry only (one row per session). With `filter_race_id` it renders the
// full classification for that specific race. We always fetch with a race
// ID — that's where the meaningful data lives.
//
// Race-result table columns: Pos, Car #, Class, Drivers (comma-separated
// driver crew), Team, Car, Time, Laps, Gap. The Class column carries the
// per-entry category — values seen: "Pro Cup", "Gold Cup", "Silver Cup",
// "Bronze Cup". We surface this in the typed result rows so the Results
// tab can group / filter by class.
//
// Fail-closed: any individual race that returns <MIN_ROWS rows is dropped
// from the output (likely an unstarted future round or a CMS hiccup). The
// caller receives the rest of the season — empty arrays are valid.

import type { Championship } from '@/lib/standings/gt-world';

const BASE_URL = 'https://www.gt-world-challenge-europe.com/results';

// 24h of Spa typically classifies ~50 cars. A 3h race ~40. Below 5 entries
// means the data isn't published yet.
const MIN_ROWS = 5;

export type Cup = 'pro' | 'gold' | 'silver' | 'bronze' | 'unknown';

function parseCup(text: string): Cup {
  const t = text.toLowerCase();
  if (t.includes('pro')) return 'pro';
  if (t.includes('gold')) return 'gold';
  if (t.includes('silver')) return 'silver';
  if (t.includes('bronze')) return 'bronze';
  return 'unknown';
}

export interface GtWorldRaceResultEntry {
  position: number;
  carNumber: string;
  cup: Cup;
  cupLabel: string;
  drivers: string[];
  team: string;
  car: string;
  time?: string;
  laps?: number;
  gap?: string;
}

export interface GtWorldRaceResult {
  raceId: number;
  raceName: string;
  eventName: string;
  eventSlug: string;
  championship: Championship;
  entries: GtWorldRaceResultEntry[];
}

interface ParseEventArgs {
  html: string;
  raceId: number;
  eventSlug: string;
}

// The event page <h2> looks like:
//   "Main Race\n\t\tCircuit Paul Ricard\n\t\t2026 Results"
// and the <title> ends with " | GT World Challenge Europe powered by AWS
// Endurance Cup | ...". We pull the race name from the h2 and the
// championship from the title.
function parseChampionshipFromTitle(title: string): Championship {
  const lower = title.toLowerCase();
  if (lower.includes('sprint cup')) return 'sprint';
  if (lower.includes('endurance cup')) return 'endurance';
  return 'overall';
}

function parseRaceNameFromH2(h2Text: string): string {
  // Take the first non-empty trimmed line — that's the race / session name
  // (e.g. "Main Race", "Qualifying 1").
  for (const line of h2Text.split('\n')) {
    const t = line.trim();
    if (t.length > 0) return t;
  }
  return 'Race';
}

function parseEventNameFromH2(h2Text: string): string {
  const lines = h2Text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
  // Layout: [raceName, eventName, "<year> Results"]
  return lines[1] ?? '';
}

export function parseEventResultsHtml(args: ParseEventArgs): GtWorldRaceResult | null {
  try {
    const $ = cheerio.load(args.html);
    const title = $('title').first().text();
    const h2Text = $('h2').first().text();
    const championship = parseChampionshipFromTitle(title);
    const raceName = parseRaceNameFromH2(h2Text);
    const eventName = parseEventNameFromH2(h2Text);
    const table = $('table').first();
    if (table.length === 0) return null;
    const entries: GtWorldRaceResultEntry[] = [];
    table.find('tbody tr').each((_, el) => {
      const cells = $(el)
        .find('td')
        .map((__, td) => $(td).text().trim())
        .get();
      if (cells.length < 8) return;
      const posText = cells[0];
      if (!/^\d+$/.test(posText)) return;
      const position = Number(posText);
      const carNumber = cells[1];
      const cupLabel = cells[2];
      const drivers = cells[3]
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      const team = cells[4];
      const car = cells[5];
      const time = cells[6] || undefined;
      const lapsRaw = cells[7];
      const laps = lapsRaw && /^\d+$/.test(lapsRaw) ? Number(lapsRaw) : undefined;
      const gap = cells[8] || undefined;
      if (!Number.isFinite(position) || drivers.length === 0 || !team) return;
      entries.push({
        position,
        carNumber,
        cup: parseCup(cupLabel),
        cupLabel,
        drivers,
        team,
        car,
        time,
        laps,
        gap,
      });
    });
    if (entries.length < MIN_ROWS) return null;
    return {
      raceId: args.raceId,
      raceName,
      eventName,
      eventSlug: args.eventSlug,
      championship,
      entries: entries.sort((a, b) => a.position - b.position),
    };
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface EventResultsRequest {
  year: number;
  eventSlug: string;
  raceId: number;
}

export function buildEventResultsUrl(args: EventResultsRequest): string {
  return `${BASE_URL}/${args.year}/${encodeURI(args.eventSlug)}?filter_race_id=${args.raceId}`;
}

export async function fetchGtWorldRaceResult(
  args: EventResultsRequest,
): Promise<GtWorldRaceResult | null> {
  const url = buildEventResultsUrl(args);
  const html = await fetchHtml(url);
  if (!html) return null;
  return parseEventResultsHtml({
    html,
    raceId: args.raceId,
    eventSlug: args.eventSlug,
  });
}

// Fetch every race the caller knows about. Each request is fire-and-forget
// (failures drop silently), so an unstarted late-season round won't sink
// the rest of the season output. Caller passes the (eventSlug, raceId)
// pairs — we discover this list per-event by scraping the event landing
// page (see `discoverGtWorldEventRaces`).
export async function fetchGtWorldSeasonResults(
  year: number,
  races: EventResultsRequest[],
): Promise<GtWorldRaceResult[]> {
  if (races.length === 0) return [];
  const results = await Promise.all(
    races.map(r => fetchGtWorldRaceResult({ ...r, year })),
  );
  return results.filter((r): r is GtWorldRaceResult => r !== null);
}

// ---- Event discovery -----------------------------------------------------
//
// `/results` lists the event slugs for the season but its <select> for
// race IDs is empty until an event is chosen (the dropdown is populated by
// the SPA after an event-meeting is selected). To enumerate the actual
// races we hit each event landing page; the same `filter_race_id` <select>
// is then SSR'd with that event's race options. We only keep the "Main
// Race" entries (race results, not free-practice or qualifying) — the
// /results tab on Paddock surfaces race classifications, not session
// lap times.

export interface GtWorldEventListing {
  meetingId: number;
  eventSlug: string;
  eventName: string;
}

export interface GtWorldRaceOption {
  raceId: number;
  raceName: string;
  // We surface the full /results page link so renderers can fall back to
  // a permalink when a fetch fails.
  url: string;
}

// Parses the /results page (no event selected) for the per-event entries.
// Returns the (meeting-id, slug, display-name) triples for the season.
export function parseEventListingHtml(html: string, year: number): GtWorldEventListing[] {
  try {
    const $ = cheerio.load(html);
    const out: GtWorldEventListing[] = [];
    const meetingsSelect = $('select#filter_meeting_id').first();
    const idByName = new Map<string, number>();
    meetingsSelect.find('option').each((_, el) => {
      const value = Number($(el).attr('value'));
      const text = $(el).text().trim();
      if (Number.isFinite(value) && value > 0 && text.length > 0) {
        idByName.set(text, value);
      }
    });
    const slugPattern = new RegExp(`/results/${year}/([^/?#]+)`);
    const seenSlugs = new Set<string>();
    $('a').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const match = href.match(slugPattern);
      if (!match) return;
      const eventSlug = match[1];
      if (seenSlugs.has(eventSlug)) return;
      // The site puts "test-days" landing slugs alongside the canonical
      // event landing — skip auxiliary entries; the race-day slug is the
      // one without -test-days at the end.
      if (eventSlug.includes('test-days')) return;
      const linkText = $(el).text().trim();
      const meetingId = idByName.get(linkText) ?? -1;
      seenSlugs.add(eventSlug);
      out.push({ meetingId, eventSlug, eventName: linkText });
    });
    return out;
  } catch {
    return [];
  }
}

// Parses an event landing page (no race id) for the available race ID
// options. Filters to FINAL classifications only — endurance events also
// expose intermediate hourly checkpoints ("Main Race after 5.30 hours",
// "Main Race after 4.30 hours", etc.) that the parser must not promote
// to standalone races. Verified against Paul Ricard 1000km (7 options:
// 1 final "Main Race" + 6 intermediate "Main Race after N.NN hours")
// and Brands Hatch (2 options: "Race 1", "Race 2"). Spa 24h has
// scheduled 3-stage scoring at 6h / 12h / 18h plus the finish — those
// stage checkpoints surface as separate races and ARE valid finals (the
// SRO rules award points at each); we accept them here.
const RACE_NAME_PATTERN =
  /^(Main Race|Race \d+|\d+\s*hr|\d+\s*h|\d+\s*Hours?)$/i;

export function parseEventRaceOptions(html: string): GtWorldRaceOption[] {
  try {
    const $ = cheerio.load(html);
    const out: GtWorldRaceOption[] = [];
    const raceSelect = $('select#filter_race_id').first();
    raceSelect.find('option').each((_, el) => {
      const value = Number($(el).attr('value'));
      const text = $(el).text().trim();
      if (!Number.isFinite(value) || value <= 0) return;
      if (!text || !RACE_NAME_PATTERN.test(text)) return;
      out.push({ raceId: value, raceName: text, url: '' });
    });
    return out;
  } catch {
    return [];
  }
}

export async function discoverGtWorldEventListings(
  year: number,
): Promise<GtWorldEventListing[]> {
  const html = await fetchHtml(`${BASE_URL}/${year}`);
  if (!html) return [];
  return parseEventListingHtml(html, year);
}

export async function discoverGtWorldEventRaces(
  year: number,
  eventSlug: string,
): Promise<GtWorldRaceOption[]> {
  const html = await fetchHtml(`${BASE_URL}/${year}/${encodeURI(eventSlug)}`);
  if (!html) return [];
  return parseEventRaceOptions(html);
}

// Convenience: walk the season and pull every race classification we can
// find. One outer call (listing) + N event calls (race-id lookup) + M race
// calls (results). Each step fails closed individually.
export async function fetchAllGtWorldSeasonRaces(
  year: number,
): Promise<GtWorldRaceResult[]> {
  const events = await discoverGtWorldEventListings(year);
  if (events.length === 0) return [];
  const requestLists = await Promise.all(
    events.map(async ev => {
      const races = await discoverGtWorldEventRaces(year, ev.eventSlug);
      return races.map(r => ({
        year,
        eventSlug: ev.eventSlug,
        raceId: r.raceId,
      } satisfies EventResultsRequest));
    }),
  );
  const allRequests = requestLists.flat();
  return fetchGtWorldSeasonResults(year, allRequests);
}
