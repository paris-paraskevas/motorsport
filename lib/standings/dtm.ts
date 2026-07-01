import * as cheerio from 'cheerio';
import { fetchUpstream } from '@/lib/fetch-upstream';
import { withSourceSnapshot } from '@/lib/source-snapshot';
import type { Element } from 'domhandler';
import type { DriverStanding, ConstructorStanding } from '@/lib/types';

export type { DriverStanding, ConstructorStanding };

// DTM standings — Drivers / Teams / Constructors triple.
//
// Source: `motorsport.com/dtm/standings/2026/?type={Driver|Team|Constructor}&class=`
// SSR'd, no auth, no CAPTCHA. Probed 2026-05-22 — every row shipped in HTML;
// no client-side hydration needed. dtm.com itself is a SPA shell (returns
// the same chrome for every URL), so the official site is NOT a viable
// source.
//
// Table shape (same skeleton across all three types — only the second-cell
// class name varies):
//
//   <table class="ms-table ms-table--standings">
//     <thead><tr> ← cells: Pos, Driver/Team/Constructor, Points, then N
//                  per-race columns each with a country-flag header
//     <tbody><tr class="ms-table_row">
//       <td class="ms-table_cell ms-table_field--pos">1</td>
//       <td class="ms-table_cell ms-table_field--driver">                       ← drivers
//           <a href="/driver/..."> [<flag>] <span class="info">
//             <span class="name"><span class="name-short">M. Engel</span></span>
//             <span class="team">Mercedes-AMG Team Ravenol</span>
//           </span></a>
//       </td>
//       — OR — `--team` with bare <span class="name">Mercedes-AMG Team Landgraf</span>
//       — OR — `--result_constructor` with text "Mercedes"
//       <td class="ms-table_cell ms-table_field--total_points">44</td>
//       <td class="ms-table_cell ms-table_field--race_points">44</td>   ← per-race × N
//       …
//     </tr>
//   </tbody></table>
//
// Some rows have a `<div class="info">` wrapper instead of `<a>` (drivers
// without a profile page yet — e.g. F. Wiebelhaus, T. Kalender). Parser
// reads the inner spans either way.

const BASE_URL = 'https://www.motorsport.com/dtm/standings/2026/';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// Minimum sane row count per table — below this we treat the response as
// structurally broken (CMS rebuild, anti-bot challenge, etc.) and fail
// closed so the UI renders the "temporarily unavailable" placeholder
// rather than a misleading partial table. DTM is a small field; 8 is the
// realistic floor for drivers across a season.
const MIN_DRIVER_ROWS = 8;
const MIN_TEAM_ROWS = 4;
const MIN_CONSTRUCTOR_ROWS = 2;

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetchUpstream(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\[\d+\]/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findStandingsTable(
  $: cheerio.CheerioAPI,
): cheerio.Cheerio<Element> | null {
  const table = $('table.ms-table--standings').first();
  return table.length > 0 ? table : null;
}

interface DriverRow {
  position: number;
  driverName: string;
  team: string;
  points: number;
  perRoundPoints: number[];
}

export function parseDriverStandingsFromHtml(
  html: string,
): DriverRow[] | null {
  try {
    const $ = cheerio.load(html);
    const table = findStandingsTable($);
    if (!table) return null;
    const rows: DriverRow[] = [];
    table.find('tbody tr.ms-table_row').each((_, tr) => {
      const $tr = $(tr);
      const posText = $tr.find('td.ms-table_field--pos').first().text().trim();
      const position = Number(posText);
      if (!Number.isFinite(position) || position < 1) return;

      const driverCell = $tr.find('td.ms-table_field--driver').first();
      if (driverCell.length === 0) return;
      const driverName = cleanText(
        driverCell.find('.name-short').first().text(),
      );
      const team = cleanText(driverCell.find('.team').first().text());
      if (!driverName) return;

      const totalText = $tr
        .find('td.ms-table_field--total_points')
        .first()
        .text()
        .trim();
      const points = Number(totalText);
      if (!Number.isFinite(points)) return;

      const perRoundPoints: number[] = [];
      $tr.find('td.ms-table_field--race_points').each((_, td) => {
        const v = $(td).text().trim();
        // Cell renders "-" for un-raced rounds; treat as 0.
        const n = v === '-' || v === '' ? 0 : Number(v);
        perRoundPoints.push(Number.isFinite(n) ? n : 0);
      });

      rows.push({ position, driverName, team, points, perRoundPoints });
    });
    if (rows.length < MIN_DRIVER_ROWS) return null;
    return rows.sort((a, b) => a.position - b.position);
  } catch {
    return null;
  }
}

interface NamedRow {
  position: number;
  name: string;
  points: number;
  perRoundPoints: number[];
}

// Shared parser for Team + Constructor tables. They share the same skeleton
// — only the name-cell class differs (`ms-table_field--team` for teams,
// `ms-table_field--result_constructor` for constructors).
function parseNamedRowsFromHtml(
  html: string,
  nameCellClass: string,
  minRows: number,
  nameLookup: (cell: cheerio.Cheerio<Element>) => string,
): NamedRow[] | null {
  try {
    const $ = cheerio.load(html);
    const table = findStandingsTable($);
    if (!table) return null;
    const rows: NamedRow[] = [];
    table.find('tbody tr.ms-table_row').each((_, tr) => {
      const $tr = $(tr);
      const posText = $tr.find('td.ms-table_field--pos').first().text().trim();
      const position = Number(posText);
      if (!Number.isFinite(position) || position < 1) return;

      const nameCell = $tr.find(`td.${nameCellClass}`).first();
      if (nameCell.length === 0) return;
      const name = cleanText(nameLookup(nameCell));
      if (!name) return;

      const totalText = $tr
        .find('td.ms-table_field--total_points')
        .first()
        .text()
        .trim();
      const points = Number(totalText);
      if (!Number.isFinite(points)) return;

      const perRoundPoints: number[] = [];
      $tr.find('td.ms-table_field--race_points').each((_, td) => {
        const v = $(td).text().trim();
        const n = v === '-' || v === '' ? 0 : Number(v);
        perRoundPoints.push(Number.isFinite(n) ? n : 0);
      });

      rows.push({ position, name, points, perRoundPoints });
    });
    if (rows.length < minRows) return null;
    return rows.sort((a, b) => a.position - b.position);
  } catch {
    return null;
  }
}

export function parseTeamStandingsFromHtml(html: string): NamedRow[] | null {
  return parseNamedRowsFromHtml(
    html,
    'ms-table_field--team',
    MIN_TEAM_ROWS,
    cell => cell.find('.name').first().text(),
  );
}

export function parseConstructorStandingsFromHtml(
  html: string,
): NamedRow[] | null {
  return parseNamedRowsFromHtml(
    html,
    'ms-table_field--result_constructor',
    MIN_CONSTRUCTOR_ROWS,
    // Constructor cell has no nested span — the text() of the <td> itself
    // is the manufacturer name (e.g. "Mercedes", "BMW").
    cell => cell.text(),
  );
}

export interface DTMStandings {
  drivers: DriverStanding[];
  teams: ConstructorStanding[];
  constructors: ConstructorStanding[];
  // Per-round per-driver points breakdown, used by the trend chart. Each
  // row carries the same shape as the drivers' standings table on the
  // source page (per-cell per-race column). Reconciles to drivers totals
  // by construction.
  driverRoundBreakdown: DriverRow[];
}

async function fetchDTMStandingsLive(): Promise<DTMStandings | null> {
  const [driversHtml, teamsHtml, constructorsHtml] = await Promise.all([
    fetchHtml(`${BASE_URL}?type=Driver&class=`),
    fetchHtml(`${BASE_URL}?type=Team&class=`),
    fetchHtml(`${BASE_URL}?type=Constructor&class=`),
  ]);
  if (!driversHtml) return null;
  const driverRows = parseDriverStandingsFromHtml(driversHtml);
  if (!driverRows) return null;
  // Teams + constructors are nice-to-have; if either is structurally
  // broken we still ship the drivers table.
  const teamRows = teamsHtml ? parseTeamStandingsFromHtml(teamsHtml) : null;
  const constructorRows = constructorsHtml
    ? parseConstructorStandingsFromHtml(constructorsHtml)
    : null;

  return {
    drivers: driverRows.map(d => ({
      position: d.position,
      driverName: d.driverName,
      team: d.team,
      points: d.points,
    })),
    teams: (teamRows ?? []).map(r => ({
      position: r.position,
      name: r.name,
      points: r.points,
    })),
    constructors: (constructorRows ?? []).map(r => ({
      position: r.position,
      name: r.name,
      points: r.points,
    })),
    driverRoundBreakdown: driverRows,
  };
}

/**
 * Public DTM standings fetch, wrapped in the durable `source_snapshot` last-good
 * so a motorsport.com outage (5xx / anti-bot challenge / structural break →
 * null) serves the last successful standings instead of blanking the page.
 * Self-heals on the next good fetch (which overwrites the snapshot).
 *
 * `DTMStandings` carries no `Date` fields, so the jsonb round-trip is lossless
 * and no rehydration is needed. Fails soft when Supabase is unconfigured (local
 * dev): behaves exactly like `fetchDTMStandingsLive`. Return type is unchanged.
 */
export async function fetchDTMStandings(): Promise<DTMStandings | null> {
  return withSourceSnapshot<DTMStandings | null>(
    'standings:dtm',
    fetchDTMStandingsLive,
    v => v == null || v.drivers.length === 0,
  );
}
