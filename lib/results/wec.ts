import * as cheerio from 'cheerio';
import { fetchUpstream } from '@/lib/fetch-upstream';
import manifest from '@/content/series/wec/fiawec-races.json';
import rounds from '@/content/series/wec/rounds.json';
import {
  readResultsCache,
  writeResultsCache,
  seasonCacheKey,
} from '@/lib/results-cache';
import { fetchWecStandings, type WecStandings } from '@/lib/standings/wec';

// FIA WEC per-round race results, sourced from the results page's Symfony UX
// Live Component on fiawec.com (probe 2026-06-12). There is no open JSON
// feed: WEC's Al Kamel results portal is PDF-only and the alkamelcloud host
// that serves IMSA's JSON tree is a private backoffice for WEC. The live
// component, however, replays server-side with plain HTTP:
//
//   POST /en/_components/Editorial%3ACMS%3ACompleteResultsComponent
//   body: data={"props":<props verbatim>,"updated":{"raceId":4949}}
//
// where `props` is the server-signed JSON from `data-live-props-value` on
// the bootstrap page (or the previous response — every response re-signs).
// No cookies, no CSRF token; the component validates `Origin` +
// `Sec-Fetch-Site: same-origin` headers instead (ux-live-component ≥2.12
// removed CSRF in favour of same-origin checks). Props are always read
// fresh from the live page, never stored, so checksum rotation on their
// side can't strand us.
//
// Fetch chain per round: select race → read the race's session list from
// the response → select the RACE session → parse the rendered table, then
// swap `categoryId` once per remaining class. The classification table is
// per-class (Hypercar / LMGT3, plus LMP2 at Le Mans only in 2026) with
// positions numbered within the class — there is no overall table.
//
// The table carries car number + team + laps/times but NO driver names and
// NO championship points (it's a timing export, same limitation as IMSA's
// Alkamel JSON). Crews are joined from the standings parser, whose rows bake
// the car number into the team string ("BMW #20"); entries outside the
// season championship (Le Mans one-offs, the whole LMP2 field) render
// without drivers rather than with guessed ones. No points → no trend
// chart, per the cross-series chart-vs-standings invariant.

export type WecResultClass = 'Hypercar' | 'LMP2' | 'LMGT3';

// Display order mirrors WEC's own class hierarchy.
export const WEC_RESULT_CLASSES: readonly WecResultClass[] = [
  'Hypercar',
  'LMP2',
  'LMGT3',
];

// Structurally compatible with ImsaRaceEntry so the results tab reuses the
// IMSA class-card components unchanged. `vehicle` is always empty — the
// fiawec table shows a car illustration, not a model name.
export interface WecRaceEntry {
  position: number;
  carNumber: string;
  team: string;
  drivers: string;
  vehicle: string;
  manufacturer: string;
  laps: number;
  status: string;
  // "+1.969" style or "2 Laps"; empty string for the class leader.
  gap: string;
  elapsedTime: string;
}

export interface WecRoundResults {
  round: number;
  // From rounds.json ("TotalEnergies 6 Hours of Spa-Francorchamps") — the
  // live component only shows a country label.
  eventName: string;
  // Event date range parsed from the component header ("7 - 9 may 2026").
  // dateEnd is race day for the 6/8-hour races; Le Mans spans two days.
  dateStart: Date;
  dateEnd: Date;
  perClass: Partial<Record<WecResultClass, WecRaceEntry[]>>;
}

const PAGE_URL = 'https://www.fiawec.com/en/page/resultats-1';
const COMPONENT_URL =
  'https://www.fiawec.com/en/_components/Editorial%3ACMS%3ACompleteResultsComponent';

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

// Live-component props travel as opaque JSON — only the keys we update are
// typed. The blob includes `@checksum` + `@attributes`, replayed verbatim.
type LiveProps = Record<string, unknown>;

export function extractLiveProps(html: string): LiveProps | null {
  const $ = cheerio.load(html);
  const raw = $('[data-live-props-value]').first().attr('data-live-props-value');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LiveProps;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export interface LiveSelectOption {
  id: number;
  label: string;
  selected: boolean;
}

// Options of the <select data-live-action-param="<action>"> dropdown. The
// page renders both button-grid and mobile-select pickers; the selects are
// the stable parse target (actions: changeSeason / changeRace /
// sessionChanged / changeCategory).
export function parseSelectOptions(
  html: string,
  action: string,
): LiveSelectOption[] {
  const $ = cheerio.load(html);
  const out: LiveSelectOption[] = [];
  $(`select[data-live-action-param="${action}"]`)
    .first()
    .find('option')
    .each((_, el) => {
      const $el = $(el);
      const id = Number($el.attr('value'));
      const label = $el.text().replace(/\s+/g, ' ').trim();
      if (!Number.isFinite(id) || !label) return;
      out.push({ id, label, selected: $el.attr('selected') !== undefined });
    });
  return out;
}

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function monthIndex(name: string): number | null {
  const lower = name.toLowerCase();
  for (const [month, idx] of Object.entries(MONTHS)) {
    if (month.startsWith(lower) || lower.startsWith(month.slice(0, 3))) {
      return idx;
    }
  }
  return null;
}

// "7 - 9 may 2026" (same-month range) or "30 may - 1 june 2026". The header
// is the only place the component states the event date.
export function parseEventDateRange(
  html: string,
): { start: Date; end: Date } | null {
  const text = cheerio.load(html).text().replace(/\s+/g, ' ');
  const range =
    /(\d{1,2})\s*(?:([a-zà-ü]+)\s*)?-\s*(\d{1,2})\s+([a-zà-ü]+)\s+(\d{4})/i.exec(text);
  if (range) {
    const [, d1, m1, d2, m2, year] = range;
    const endMonth = monthIndex(m2);
    const startMonth = m1 ? monthIndex(m1) : endMonth;
    if (startMonth === null || endMonth === null) return null;
    return {
      start: new Date(Date.UTC(Number(year), startMonth, Number(d1))),
      end: new Date(Date.UTC(Number(year), endMonth, Number(d2))),
    };
  }
  const single = /(\d{1,2})\s+([a-zà-ü]+)\s+(\d{4})/i.exec(text);
  if (!single) return null;
  const month = monthIndex(single[2]);
  if (month === null) return null;
  const day = new Date(Date.UTC(Number(single[3]), month, Number(single[1])));
  return { start: day, end: day };
}

// One classification row is 11 cells: Pos | illustration | #car | Team |
// Laps | Total time | Gap | Interval | Avg | Best lap | On. Anchored on the
// "#car" cell rather than fixed indices so a dropped illustration column
// doesn't shift every field (fixtures 2026-06-12: Spa + Imola, 17-18 rows).
export function parseClassificationTable(html: string): WecRaceEntry[] {
  const $ = cheerio.load(html);
  const out: WecRaceEntry[] = [];
  $('table tbody tr').each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr
      .find('td')
      .map((_, td) => $(td).text().replace(/\s+/g, ' ').trim())
      .get();
    if (cells.length < 8) return;
    const position = Number(cells[0]);
    if (!Number.isInteger(position) || position < 1) return;
    const carIdx = cells.findIndex(c => /^#\S+$/.test(c));
    if (carIdx === -1 || carIdx + 4 >= cells.length) return;
    const gapRaw = cells[carIdx + 4] ?? '';
    out.push({
      position,
      carNumber: cells[carIdx].slice(1),
      team: cells[carIdx + 1] ?? '',
      drivers: '',
      vehicle: '',
      manufacturer: $tr.find('img.brand-logo').attr('alt')?.trim() ?? '',
      laps: Number(cells[carIdx + 2]) || 0,
      status: '',
      gap: gapRaw === '-' ? '' : gapRaw,
      elapsedTime: cells[carIdx + 3] ?? '',
    });
  });
  out.sort((a, b) => a.position - b.position);
  return out;
}

// Category (class) ids are global CMS entities curated in the manifest —
// component responses render the changeCategory <select> empty (it only
// populates on the bootstrap page), so the ids can't be discovered from a
// response. The component accepts any of them for any race; classes that
// didn't contest a round just render no rows.
function categoryIdFor(cls: WecResultClass): number | null {
  const id = (manifest.categories as Record<string, number>)[cls];
  return Number.isFinite(id) ? id : null;
}

function classForCategoryId(id: unknown): WecResultClass | null {
  for (const cls of WEC_RESULT_CLASSES) {
    if (categoryIdFor(cls) === id) return cls;
  }
  return null;
}

// Crew lookup from the standings parser: "<class>:<carNumber>" → joined
// driver names. Standings team strings end in the car number ("BMW #20",
// "IRON LYNX #50"), which is the only key the results table shares.
export function buildCrewIndex(
  standings: WecStandings | null,
): Map<string, string> {
  const index = new Map<string, string>();
  if (!standings) return index;
  for (const [cls, drivers] of Object.entries(standings.drivers)) {
    for (const row of drivers) {
      const match = /#(\S+)/.exec(row.team);
      if (!match) continue;
      const key = `${cls}:${match[1]}`;
      if (!index.has(key)) index.set(key, row.driverName);
    }
  }
  return index;
}

async function livePost(
  props: LiveProps,
  updated: Record<string, number>,
): Promise<string | null> {
  const body = new URLSearchParams({
    data: JSON.stringify({ props, updated }),
  });
  try {
    const res = await fetchUpstream(COMPONENT_URL, {
      method: 'POST',
      headers: {
        ...FETCH_HEADERS,
        Accept: 'application/vnd.live-component+html, text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://www.fiawec.com',
        Referer: PAGE_URL,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body.toString(),
      // POST responses bypass the Next data cache; cross-render reuse comes
      // from the KV season cache below, not from fetch caching.
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchBootstrapPage(): Promise<string | null> {
  try {
    const res = await fetchUpstream(PAGE_URL, {
      headers: { ...FETCH_HEADERS, Accept: 'text/html' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface ManifestRace {
  round: number;
  raceId: number;
  label: string;
}

interface RoundDates {
  name: string;
  startDate: string;
}

function roundDates(): Map<number, RoundDates> {
  const out = new Map<number, RoundDates>();
  for (const r of rounds.rounds ?? []) {
    out.set(r.round, { name: r.name, startDate: r.startDate });
  }
  return out;
}

async function fetchRound(
  bootstrapProps: LiveProps,
  race: ManifestRace,
  eventName: string,
  crews: Map<string, string>,
): Promise<WecRoundResults | null> {
  // Step 1 — select the race. The response carries this race's session list
  // and freshly-signed props for the follow-up posts.
  const raceHtml = await livePost(bootstrapProps, { raceId: race.raceId });
  if (!raceHtml) return null;
  let props = extractLiveProps(raceHtml);
  if (!props) return null;

  const sessions = parseSelectOptions(raceHtml, 'sessionChanged');
  const raceSession = sessions.find(s => s.label.toUpperCase() === 'RACE');
  if (!raceSession) return null;

  // Step 2 — select the race session. Renders the currently-selected
  // category's table (Hypercar by default).
  const sessionHtml = await livePost(props, { sessionId: raceSession.id });
  if (!sessionHtml) return null;
  props = extractLiveProps(sessionHtml) ?? props;

  const dates = parseEventDateRange(sessionHtml);
  if (!dates) return null;

  const perClass: Partial<Record<WecResultClass, WecRaceEntry[]>> = {};

  const ingest = (cls: WecResultClass, entries: WecRaceEntry[]) => {
    if (entries.length === 0) return;
    perClass[cls] = entries.map(e => ({
      ...e,
      drivers: crews.get(`${cls}:${e.carNumber}`) ?? '',
    }));
  };

  // The step-2 response already renders whichever category the props carry
  // (Hypercar when bootstrapping from the season default).
  const renderedClass = classForCategoryId(props.categoryId);
  if (renderedClass) {
    ingest(renderedClass, parseClassificationTable(sessionHtml));
  }

  // Step 3 — post the remaining classes explicitly. A class that didn't
  // contest the round (LMP2 outside Le Mans) renders no rows and is skipped
  // by ingest().
  for (const cls of WEC_RESULT_CLASSES) {
    if (cls === renderedClass || perClass[cls]) continue;
    const categoryId = categoryIdFor(cls);
    if (categoryId === null) continue;
    const catHtml = await livePost(props, { categoryId });
    if (!catHtml) continue;
    props = extractLiveProps(catHtml) ?? props;
    ingest(cls, parseClassificationTable(catHtml));
  }

  if (Object.keys(perClass).length === 0) return null;

  return {
    round: race.round,
    eventName,
    dateStart: dates.start,
    dateEnd: dates.end,
    perClass,
  };
}

export async function fetchWecSeasonResults(): Promise<WecRoundResults[]> {
  const season = manifest.season;
  const cacheKey = seasonCacheKey('wec', season);
  const cached = await readResultsCache<WecRoundResults[]>(cacheKey);
  if (cached) return reviveRoundDates(cached);

  const dates = roundDates();
  const now = new Date();
  // Only rounds that have started can have a race classification; skipping
  // future rounds saves the 2-post discovery chain per round.
  const due = (manifest.races as ManifestRace[]).filter(r => {
    const meta = dates.get(r.round);
    return meta ? new Date(`${meta.startDate}T00:00:00Z`) <= now : false;
  });
  if (due.length === 0) return [];

  const bootstrapHtml = await fetchBootstrapPage();
  if (!bootstrapHtml) return [];
  const bootstrapProps = extractLiveProps(bootstrapHtml);
  if (!bootstrapProps) return [];

  const crews = buildCrewIndex(await fetchWecStandings());

  // Sequential on purpose: each round is a 3-5 post chain against a CMS
  // origin with unknown burst tolerance, and the KV cache makes this a
  // once-per-TTL cost, not a per-render one.
  const out: WecRoundResults[] = [];
  for (const race of due) {
    const eventName = dates.get(race.round)?.name ?? race.label;
    const result = await fetchRound(bootstrapProps, race, eventName, crews);
    if (result) out.push(result);
  }
  out.sort((a, b) => a.round - b.round);

  if (out.length > 0) {
    // Non-empty only — caching a transient upstream failure would freeze the
    // empty state for the full TTL (same rule as the F2/F3 cache).
    await writeResultsCache(cacheKey, out);
  }
  return out;
}

// KV round-trips serialize Dates to ISO strings; the generic results-cache
// reviver only knows the flat RaceResult `date` field, so WEC's two range
// fields are revived here.
function reviveRoundDates(cached: WecRoundResults[]): WecRoundResults[] {
  return cached.map(r => ({
    ...r,
    dateStart: r.dateStart instanceof Date ? r.dateStart : new Date(r.dateStart),
    dateEnd: r.dateEnd instanceof Date ? r.dateEnd : new Date(r.dateEnd),
  }));
}
