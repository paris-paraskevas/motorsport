import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { Champion } from './types';

const REST_BASE = 'https://en.wikipedia.org/api/rest_v1/page/html';
// Most championships have <100 seasons; we keep a high ceiling rather
// than truncate the list. Series like F1 hit ~75 seasons.
const MAX_ENTRIES = 200;

const YEAR_HEADERS = ['year', 'season'];
const DRIVER_HEADERS = ['driver', 'rider', 'champion'];
const CONSTRUCTOR_HEADERS = ['constructor', 'team', 'manufacturer'];
const POINTS_HEADERS = ['points'];

interface ColumnMap {
  year: number;
  driver: number;
  constructor: number;
  points: number;
}

function findColumnIndex(
  headers: string[],
  needles: string[],
): number {
  for (let i = 0; i < headers.length; i++) {
    const cell = headers[i];
    for (const needle of needles) {
      if (cell.includes(needle)) {
        return i;
      }
    }
  }
  return -1;
}

function detectColumns(headerCells: string[]): ColumnMap | null {
  const lowered = headerCells.map((c) => c.trim().toLowerCase());
  const yearIdx = findColumnIndex(lowered, YEAR_HEADERS);
  const driverIdx = findColumnIndex(lowered, DRIVER_HEADERS);
  if (yearIdx === -1 || driverIdx === -1) return null;
  return {
    year: yearIdx,
    driver: driverIdx,
    constructor: findColumnIndex(lowered, CONSTRUCTOR_HEADERS),
    points: findColumnIndex(lowered, POINTS_HEADERS),
  };
}

function parseYear(text: string): number | null {
  // Accept "2024", "2023–24", "2023-24", "2023/24" — take the later year.
  const cleaned = text.replace(/\s+/g, '').trim();
  // Find all 2-or-4 digit groups
  const matches = cleaned.match(/\d{2,4}/g);
  if (!matches || matches.length === 0) return null;
  let last = matches[matches.length - 1];
  // If a two-digit suffix follows a 4-digit prefix, expand to full year (e.g. "2023–24" → "2024")
  if (last.length === 2 && matches.length >= 2) {
    const prev = matches[matches.length - 2];
    if (prev.length === 4) {
      last = prev.slice(0, 2) + last;
    }
  }
  const n = parseInt(last, 10);
  if (Number.isNaN(n)) return null;
  return n;
}

function parsePoints(text: string): number | undefined {
  const cleaned = text.replace(/[^\d.\-]/g, '');
  if (!cleaned) return undefined;
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return undefined;
  return n;
}

function cellText($: cheerio.CheerioAPI, el: AnyNode): string {
  return $(el).text().replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
}

export async function fetchChampions(
  pageTitleOrTitles: string | string[],
): Promise<Champion[]> {
  const titles = Array.isArray(pageTitleOrTitles)
    ? pageTitleOrTitles.filter(Boolean)
    : [pageTitleOrTitles].filter(Boolean);
  for (const title of titles) {
    const result = await fetchChampionsFromPage(title);
    if (result.length > 0) return result;
  }
  return [];
}

async function fetchChampionsFromPage(pageTitle: string): Promise<Champion[]> {
  const url = `${REST_BASE}/${encodeURIComponent(pageTitle)}`;
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/html' },
      next: { revalidate: 86400 },
    } as RequestInit);
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  try {
    const $ = cheerio.load(html);
    const tables = $('table').toArray();

    for (const table of tables) {
      const $table = $(table);
      // Grab the first row that has any cells (header row, may be th or mixed)
      const headerRow = $table.find('tr').first();
      const headerCells = headerRow
        .find('th, td')
        .toArray()
        .map((el) => cellText($, el));
      if (headerCells.length === 0) continue;

      const cols = detectColumns(headerCells);
      if (!cols) continue;

      const champions: Champion[] = [];
      const dataRows = $table.find('tr').slice(1).toArray();

      for (const row of dataRows) {
        const cells = $(row).find('td, th').toArray();
        if (cells.length === 0) continue;
        const yearText = cells[cols.year]
          ? cellText($, cells[cols.year])
          : '';
        if (!yearText) continue;
        const year = parseYear(yearText);
        if (year === null) continue;

        const driverText = cells[cols.driver]
          ? cellText($, cells[cols.driver])
          : '';
        if (!driverText) continue;

        let constructorText: string | undefined;
        if (cols.constructor !== -1 && cells[cols.constructor]) {
          const c = cellText($, cells[cols.constructor]);
          if (c) constructorText = c;
        }

        let pointsValue: number | undefined;
        if (cols.points !== -1 && cells[cols.points]) {
          const p = parsePoints(cellText($, cells[cols.points]));
          if (p !== undefined) pointsValue = p;
        }

        const champion: Champion = {
          year,
          driver: driverText,
          constructor: constructorText,
          points: pointsValue,
        };

        champions.push(champion);
      }

      if (champions.length === 0) continue;

      // Sort by year descending and slice to most recent ~50.
      champions.sort((a, b) => b.year - a.year);
      return champions.slice(0, MAX_ENTRIES);
    }
  } catch {
    return [];
  }

  return [];
}
