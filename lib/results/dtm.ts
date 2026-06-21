import * as cheerio from 'cheerio';
import type { RaceResult, RaceResultEntry } from '@/lib/types';
import { fetchDTMStandings } from '@/lib/standings/dtm';
import {
  readResultsCache,
  writeResultsCache,
  seasonCacheKey,
} from '@/lib/results-cache';

export type { RaceResult, RaceResultEntry };

// DTM doesn't have a separate per-race classification source that's
// scrape-friendly from Vercel (the per-event pages on motorsport.com need a
// follow-up probe). What we DO have is the season-page Drivers' standings
// table's per-cell per-race breakdown — one column per round with each
// driver's points for that round. Summing those columns per driver yields
// the standings total by construction, so chart totals reconcile to the
// Standings tab without further work.
//
// This module reshapes that per-cell data into chart-ready `RaceResult[]`,
// one synthetic RaceResult per completed round. Each round's `results` is
// the list of drivers who scored, ordered by points descending. The
// position field is the rank-within-round (1-indexed); we don't have the
// actual race-finishing position because motorsport.com surfaces only
// points per cell. Per-race full classification (top-N with finish status
// + gap) is deferred to a follow-up that probes the per-event URL.

const DTM_ROUND_LABELS = [
  'Round 1',
  'Round 2',
  'Round 3',
  'Round 4',
  'Round 5',
  'Round 6',
  'Round 7',
  'Round 8',
  'Round 9',
];

export async function fetchDTMSeasonChartData(): Promise<RaceResult[]> {
  const standings = await fetchDTMStandings();
  if (!standings) return [];
  const breakdown = standings.driverRoundBreakdown;
  if (breakdown.length === 0) return [];

  const roundCount = Math.max(...breakdown.map(d => d.perRoundPoints.length));
  if (roundCount === 0) return [];

  const races: RaceResult[] = [];
  for (let roundIdx = 0; roundIdx < roundCount; roundIdx++) {
    // Collect every driver who scored a non-zero number of points this
    // round. A round with zero scorers (un-raced future column) is dropped
    // so the chart's x-axis only spans completed events.
    const scorers: Array<{ driver: string; team: string; points: number }> = [];
    for (const d of breakdown) {
      const pts = d.perRoundPoints[roundIdx] ?? 0;
      if (pts > 0) {
        scorers.push({ driver: d.driverName, team: d.team, points: pts });
      }
    }
    if (scorers.length === 0) continue;

    scorers.sort((a, b) => b.points - a.points);
    const entries: RaceResultEntry[] = scorers.map((s, i) => ({
      position: i + 1,
      driverName: s.driver,
      team: s.team,
      status: 'Scored',
      points: s.points,
    }));

    // Anchor each synthetic round at a UTC midnight derived from the
    // round index so chronological sort stays stable across SSRs. We
    // don't have authoritative dates from motorsport.com; the curated
    // rounds.json could be cross-referenced in a follow-up.
    const date = new Date(Date.UTC(2026, 3, 1 + roundIdx * 30));

    races.push({
      round: roundIdx + 1,
      raceName: DTM_ROUND_LABELS[roundIdx] ?? `Round ${roundIdx + 1}`,
      date,
      circuit: DTM_ROUND_LABELS[roundIdx] ?? `Round ${roundIdx + 1}`,
      results: entries,
    });
  }
  return races;
}

// --- Per-race classifications (the Results tab) -----------------------------
// Source: motorsport.com per-event result pages —
//   /dtm/results/<season>/<event-slug-id>/?st=RACE1   (and ?st=RACE2)
// SSR'd `table.ms-table--result`, the same `ms-*` family as the standings page
// (probed live 2026-06-21, datacenter-reachable). DTM runs two points races per
// weekend, so each event yields up to two RaceResults — the WSBK/MotoGP
// precedent of one RaceResult per scored session.
//
// Events are enumerated from the results page's own event picker
// (`a.msnt-select__option--event`): each event page lists the *other* events
// with name + date, so the landing redirect's target (the latest event) plus
// its picker covers the full set. Names/dates are harvested from every event
// page's picker as races are fetched, so each event is dated even though it
// never appears in its own picker. Round = chronological order (the numeric
// event-id suffix tracks the calendar).

const RESULTS_BASE = 'https://www.motorsport.com/dtm/results';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// The two points races. EL/FP1/FP2/Q1/Q2/GRID1/GRID2 also exist per event but
// aren't championship classifications.
const RACE_SESSIONS: { code: string; label: string }[] = [
  { code: 'RACE1', label: 'Race 1' },
  { code: 'RACE2', label: 'Race 2' },
];

// DTM grids are ~21 cars; below this the result table is structurally broken
// (CMS rebuild / anti-bot) — skip that race rather than ship a stub.
const MIN_RESULT_ROWS = 12;

interface EventMeta {
  url: string; // canonical event results URL, no query
  slug: string; // "lausitzring-665350"
  name: string; // "Lausitzring"
  start: Date | null;
  end: Date | null;
}

const STATUS_MAP: Record<string, string> = {
  dnf: 'DNF',
  dns: 'DNS',
  dq: 'DSQ',
  dsq: 'DSQ',
  ret: 'DNF',
};

function cleanText(s: string): string {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

function titleCaseSlug(slug: string): string {
  // "red-bull-ring-665344" → "Red Bull Ring" (drop the trailing numeric id).
  return slug
    .replace(/-\d+$/, '')
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function eventIdOf(slug: string): number {
  const m = slug.match(/-(\d+)$/);
  return m ? Number(m[1]) : 0;
}

// Map an event to its canonical round via curated rounds.json (date match),
// not chronological position — DTM's round numbers skip values (2026 jumps 3→5),
// so a positional index would mislink the weekend pages after a gap. Falls back
// to the positional round when no curated round lands within a few days.
export function canonicalRound(
  eventStart: Date | null,
  fallback: number,
  rounds?: { round: number; startDate: string }[],
): number {
  if (!eventStart || !rounds?.length) return fallback;
  let best = fallback;
  let bestDelta = Infinity;
  for (const r of rounds) {
    const rs = new Date(r.startDate);
    if (Number.isNaN(rs.getTime())) continue;
    const delta = Math.abs(rs.getTime() - eventStart.getTime());
    if (delta < bestDelta) {
      bestDelta = delta;
      best = r.round;
    }
  }
  return bestDelta <= 6 * 24 * 60 * 60 * 1000 ? best : fallback;
}

function eventSlugFromUrl(url: string): string | null {
  const m = url.match(/\/dtm\/results\/\d+\/([a-z0-9-]+)\/?(?:\?|$)/i);
  return m ? m[1] : null;
}

// "Apr 24, 2026 to Apr 26, 2026" → { start, end }. Single dates set both.
function parseDateRange(text: string): { start: Date | null; end: Date | null } {
  const clean = cleanText(text);
  if (!clean) return { start: null, end: null };
  const parts = clean.split(/\s+to\s+/i);
  const parse = (s: string): Date | null => {
    const d = new Date(s.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const start = parse(parts[0]);
  const end = parts[1] ? parse(parts[1]) : start;
  return { start, end };
}

async function fetchEventHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Landing /results/<season>/ 302-redirects to the latest event; fetch follows
// it, so the final URL tells us which event that is.
async function fetchLanding(
  season: number,
): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetch(`${RESULTS_BASE}/${season}/`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return { html: await res.text(), finalUrl: res.url };
  } catch {
    return null;
  }
}

// Harvest the event picker (lists every *other* event with name + date) into
// the meta map. Across all fetched pages every event ends up named + dated.
function harvestPicker(
  $: cheerio.CheerioAPI,
  season: number,
  meta: Map<string, EventMeta>,
): void {
  $('a.msnt-select__option--event').each((_, a) => {
    const slug = eventSlugFromUrl($(a).attr('href') || '');
    if (!slug) return;
    const existing = meta.get(slug);
    if (existing && existing.start) return; // already dated — keep it
    const name =
      cleanText($(a).find('.msnt-select__option-title').first().text()) ||
      cleanText($(a).attr('data-selection-title') || '').replace(/^DTM\s+\d{4}\s*/i, '') ||
      titleCaseSlug(slug);
    const { start, end } = parseDateRange(
      $(a).find('.msnt-select__option-date').first().text(),
    );
    meta.set(slug, { url: `${RESULTS_BASE}/${season}/${slug}/`, slug, name, start, end });
  });
}

// One race's classification from a fetched event-session page.
export function parseDTMRaceClassification(html: string): RaceResultEntry[] | null {
  try {
    const $ = cheerio.load(html);
    const table = $('table.ms-table--result').first();
    if (table.length === 0) return null;
    const entries: RaceResultEntry[] = [];
    let dnfOrder = 90; // non-finishers sort after the field, in source order

    table.find('tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const driverCell = $tr.find('.ms-table_field--result_driver_id').first();
      if (driverCell.length === 0) return;
      // Team lives inside the driver cell (.team) — the separate --result_team
      // column is empty on these pages.
      const driverName =
        cleanText(driverCell.find('.name-short').first().text()) ||
        cleanText(driverCell.find('.name').first().text());
      if (!driverName) return;
      const team = cleanText(driverCell.find('.team').first().text());

      const posRaw = cleanText($tr.find('.ms-table_field--pos').first().text()).toLowerCase();
      const points = Number.parseInt(
        cleanText($tr.find('.ms-table_field--points').first().text()),
        10,
      );

      let position: number;
      let status: string;
      let time: string | undefined;

      if (/^\d+$/.test(posRaw)) {
        position = Number(posRaw);
        status = 'Finished';
        // The time cell holds total time (P1) or "+gap" then absolute time in
        // separate <p>s — the first <p> is the value we want either way.
        time =
          cleanText($tr.find('.ms-table_field--time p').first().text()) ||
          cleanText($tr.find('.ms-table_field--time').first().text()) ||
          undefined;
      } else {
        position = dnfOrder++;
        status = STATUS_MAP[posRaw] ?? (posRaw ? posRaw.toUpperCase() : 'DNF');
      }

      entries.push({
        position,
        driverName,
        team,
        status,
        time,
        points: Number.isFinite(points) ? points : 0,
      });
    });

    if (entries.length < MIN_RESULT_ROWS) return null;
    return entries.sort((a, b) => a.position - b.position);
  } catch {
    return null;
  }
}

export async function fetchDTMSeasonResults(
  season: number,
  rounds?: { round: number; startDate: string }[],
): Promise<RaceResult[]> {
  const cacheKey = seasonCacheKey('dtm', season);
  const cached = await readResultsCache<RaceResult[]>(cacheKey);
  if (cached) return cached;

  const landing = await fetchLanding(season);
  if (!landing) return [];

  const meta = new Map<string, EventMeta>();
  const $landing = cheerio.load(landing.html);
  harvestPicker($landing, season, meta);

  // The landing redirects to the latest event, which is absent from its own
  // picker — add it from the final URL (name from <title>; its date is filled
  // by another event's picker harvest in pass 1).
  const currentSlug = eventSlugFromUrl(landing.finalUrl);
  if (currentSlug && !meta.has(currentSlug)) {
    const titleName = cleanText($landing('title').first().text())
      .replace(/^DTM\s+\d{4}\s+/i, '')
      .replace(/\s+Results.*$/i, '')
      .trim();
    meta.set(currentSlug, {
      url: `${RESULTS_BASE}/${season}/${currentSlug}/`,
      slug: currentSlug,
      name: titleName || titleCaseSlug(currentSlug),
      start: null,
      end: null,
    });
  }
  if (meta.size === 0) return [];

  // Chronological order — the numeric event-id suffix increases with the
  // calendar — so round 1..N tracks the season.
  const ordered = [...meta.values()].sort((a, b) => eventIdOf(a.slug) - eventIdOf(b.slug));

  // Pass 1: fetch every race page, harvest each picker (fills any missing
  // dates/names — notably the latest event's), and parse classifications.
  const parsed = new Map<string, RaceResultEntry[]>(); // `${slug}:${code}` → entries
  for (const ev of ordered) {
    for (const { code } of RACE_SESSIONS) {
      const html = await fetchEventHtml(`${ev.url}?st=${code}`);
      if (!html) continue;
      harvestPicker(cheerio.load(html), season, meta);
      const entries = parseDTMRaceClassification(html);
      if (entries) parsed.set(`${ev.slug}:${code}`, entries);
    }
  }

  // Pass 2: assemble RaceResults with the now-complete meta.
  const races: RaceResult[] = [];
  ordered.forEach((evRaw, idx) => {
    const ev = meta.get(evRaw.slug) ?? evRaw; // pick up harvested date/name
    const round = canonicalRound(ev.start, idx + 1, rounds);
    RACE_SESSIONS.forEach(({ code, label }, raceIdx) => {
      const entries = parsed.get(`${ev.slug}:${code}`);
      if (!entries) return;
      // Race 1 ≈ Saturday (range start), Race 2 ≈ Sunday (range end).
      const date =
        (raceIdx === 0 ? ev.start : ev.end) ??
        ev.start ??
        ev.end ??
        new Date(Date.UTC(season, 2, 1 + round * 21));
      races.push({
        round,
        raceName: `${ev.name} — ${label}`,
        date,
        circuit: ev.name,
        results: entries,
      });
    });
  });

  // Most-recent event first; Race 1 before Race 2 within an event — matches the
  // MotoGP/WSBK panels (ResultsTab renders DTM with preserveOrder).
  races.sort((a, b) => {
    if (a.round !== b.round) return b.round - a.round;
    return a.raceName.localeCompare(b.raceName);
  });

  if (races.length > 0) await writeResultsCache(cacheKey, races);
  return races;
}
