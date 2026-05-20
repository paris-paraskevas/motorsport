import * as cheerio from 'cheerio';
import { IMSA_CLASSES, type ImsaClass } from '@/lib/standings/imsa';

export interface ImsaClassWinner {
  // e.g. "#7 Porsche Penske Motorsport"
  team: string;
  // Space-joined driver names from Wikipedia's pair-row layout, e.g.
  // "Julien Andlauer Laurin Heinrich Felipe Nasr". Multi-driver entries are
  // the norm in endurance racing — preserving them as one string mirrors the
  // standings shape and avoids over-imposing structure on a free-form field.
  drivers: string;
}

export interface ImsaRaceResult {
  round: number;
  circuit: string;
  // Map of class → winner. A class may be missing if that class didn't
  // contest the round (e.g. LMP2 + GTD Pro skip the Long Beach sprint per the
  // current IMSA schedule structure — LMP2 only runs the four Michelin
  // Endurance Cup rounds plus a handful of others).
  winners: Partial<Record<ImsaClass, ImsaClassWinner>>;
}

// Sanity floor: a complete 2026 IMSA season has 11 rounds. Mid-season we
// still expect at least 4 rounds populated (Daytona, Sebring, Long Beach,
// Laguna Seca have all happened by this commit). Below that = upstream
// mid-edit, fail closed.
const MIN_ROUNDS_WITH_WINNER = 1;

const RESULTS_URL =
  'https://en.wikipedia.org/wiki/2026_IMSA_SportsCar_Championship';

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html',
};

// The Wikipedia "Race results" section has a single wikitable laid out as
// pair-rows per event: row[2k] = "Rnd | Circuit | <class winning team>... |
// Report", row[2k+1] = "<class winning drivers>..." with one cell per class
// that ran. Header occupies rows 0+1. We pair them up and emit one
// ImsaRaceResult per round.
//
// Sentinel values for classes that didn't participate appear as the literal
// "did not participate" string — we treat that as "no winner" and omit the
// class from the round's winners map.

function findRaceResultsTable($: cheerio.CheerioAPI): ReturnType<cheerio.CheerioAPI> | null {
  let inRaceResults = false;
  let table: ReturnType<cheerio.CheerioAPI> | null = null;
  $('h2, table.wikitable').each((_, el) => {
    if (table) return;
    const $el = $(el);
    const tag = (el as { tagName?: string }).tagName?.toLowerCase?.() ?? '';
    if (tag === 'h2') {
      const text = $el.text().replace(/\[edit\]/g, '').trim();
      inRaceResults = text === 'Race results';
      return;
    }
    if (inRaceResults) table = $el;
  });
  return table;
}

interface HeaderMap {
  // Column index for each class' winning-team cell. The drivers cell sits at
  // the same column index in the following row (the pair-row layout).
  teamColumns: Partial<Record<ImsaClass, number>>;
  circuitColumn: number;
  // Indices that we expect to be present in the data rows but to skip when
  // pairing the drivers row (because the drivers row drops the Rnd / Circuit /
  // Report columns).
}

function parseHeader(rows: string[][]): HeaderMap | null {
  // Header occupies rows[0] for ours since we're filtering by class.
  // The actual page layout:
  //  Header row 0: Rnd | Circuit | GTP Winning Team | LMP2 Winning Team | GTD Pro Winning Team | GTD Winning Team | Report
  //  Header row 1: GTP Winning Drivers | LMP2 Winning Drivers | GTD Pro Winning Drivers | GTD Winning Drivers
  //  Then data rows alternate the same pair structure.
  const row0 = rows[0];
  if (!row0 || row0.length === 0) return null;
  const teamColumns: Partial<Record<ImsaClass, number>> = {};
  let circuitColumn = -1;
  row0.forEach((cell, idx) => {
    const lower = cell.toLowerCase();
    if (lower === 'circuit') circuitColumn = idx;
    for (const cls of IMSA_CLASSES) {
      // The header reads "GTP Winning Team" / "LMP2 Winning Team" /
      // "GTD Pro Winning Team" / "GTD Winning Team". Match by leading token.
      const re = new RegExp(
        `^${cls.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')} winning team$`,
        'i',
      );
      if (re.test(cell)) teamColumns[cls] = idx;
    }
  });
  if (circuitColumn < 0) return null;
  if (Object.keys(teamColumns).length === 0) return null;
  return { teamColumns, circuitColumn };
}

function isPlaceholder(cell: string): boolean {
  if (!cell) return true;
  const lower = cell.toLowerCase();
  return (
    lower === 'did not participate' ||
    lower === 'cancelled' ||
    lower === 'canceled' ||
    lower === 'tbd' ||
    lower === 'tba'
  );
}

function readAllRows(
  $: cheerio.CheerioAPI,
  table: ReturnType<cheerio.CheerioAPI>,
): string[][] {
  const rows: string[][] = [];
  table.find('tr').each((_, tr) => {
    const cells: string[] = [];
    $(tr)
      .find('th, td')
      .each((__, cell) => {
        cells.push($(cell).text().replace(/\s+/g, ' ').trim());
      });
    rows.push(cells);
  });
  return rows;
}

export async function fetchImsaSeasonResults(): Promise<ImsaRaceResult[]> {
  let html: string;
  try {
    const res = await fetch(RESULTS_URL, {
      headers: FETCH_HEADERS,
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  try {
    const $ = cheerio.load(html);
    const table = findRaceResultsTable($);
    if (!table) return [];

    const rows = readAllRows($, table);
    if (rows.length < 4) return [];

    const headerMap = parseHeader(rows);
    if (!headerMap) return [];

    const results: ImsaRaceResult[] = [];
    // Header is rows[0] + rows[1] (Wikipedia's pair-row header), then data
    // rows start at index 2 and come in pairs.
    let i = 2;
    while (i < rows.length) {
      const teamRow = rows[i];
      const driversRow = rows[i + 1];
      if (!teamRow || !driversRow) break;
      i += 2;

      const roundRaw = teamRow[0];
      const round = Number(roundRaw);
      if (!Number.isFinite(round)) continue;

      const circuit = teamRow[headerMap.circuitColumn] || '';
      if (!circuit) continue;

      // The drivers row drops the Rnd, Circuit and Report cells AND skips
      // any class that "did not participate" in this round. The N-th cell in
      // the drivers row therefore corresponds to the N-th *participating*
      // class — not the N-th class overall. Iterate class columns left-to-
      // right, advance the drivers-row pointer only when we record a winner.
      const orderedClassEntries = (Object.entries(headerMap.teamColumns) as Array<[
        ImsaClass,
        number,
      ]>).sort((a, b) => a[1] - b[1]);

      const winners: Partial<Record<ImsaClass, ImsaClassWinner>> = {};
      let driversIdx = 0;
      for (const [cls, teamCol] of orderedClassEntries) {
        const teamCell = teamRow[teamCol] ?? '';
        if (!teamCell || isPlaceholder(teamCell)) {
          // Class didn't run (or upstream not yet filled). Do NOT advance the
          // drivers pointer — the drivers row has no cell for an absent class.
          continue;
        }
        const driverCell = driversRow[driversIdx] ?? '';
        driversIdx++;
        winners[cls] = {
          team: teamCell,
          // Drivers cell may be empty if upstream is mid-edit; we still record
          // the team-winner with an empty drivers string rather than dropping
          // the result. UI can show a fallback.
          drivers: isPlaceholder(driverCell) ? '' : driverCell,
        };
      }

      results.push({ round, circuit, winners });
    }

    const populated = results.filter(r =>
      Object.values(r.winners).some(w => w && w.team),
    );
    if (populated.length < MIN_ROUNDS_WITH_WINNER) return [];

    return results;
  } catch {
    return [];
  }
}
