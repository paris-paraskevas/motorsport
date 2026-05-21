import * as cheerio from 'cheerio';

// FIA WEC has two classes that each award their own championships, but with
// asymmetric titles: Hypercar awards Drivers + Manufacturers (no Teams — at
// the Hypercar level each manufacturer fields the team itself); LMGT3 awards
// Drivers + Teams (no Manufacturers — the class is pro-am, manufacturers
// don't get a title). 2026 rules; verified live against
// fiawec.com/en/page/manufacturers-classification on 2026-05-21.
export type WecClass = 'Hypercar' | 'LMGT3';

export const WEC_CLASSES: readonly WecClass[] = ['Hypercar', 'LMGT3'] as const;
export const WEC_MANUFACTURER_CLASSES: readonly WecClass[] = ['Hypercar'] as const;
export const WEC_TEAM_CLASSES: readonly WecClass[] = ['LMGT3'] as const;

export interface WecDriverStanding {
  position: number;
  // Multi-driver endurance crew joined with a single space (same convention as
  // IMSA + WRC) so the existing DriversTable renders a single line.
  driverName: string;
  // For Hypercar this is the manufacturer + car number ("BMW #20"); for LMGT3
  // it's the team + car number ("IRON LYNX #50"). Mirrors IMSA's pattern of
  // baking the car number into the team string.
  team: string;
  points: number;
}

export interface WecTeamStanding {
  position: number;
  // "IRON LYNX #50" — manufacturer + car number prefix kept so the row matches
  // how WEC's own UI shows it.
  team: string;
  points: number;
}

export interface WecManufacturerStanding {
  position: number;
  manufacturer: string;
  points: number;
}

export interface WecStandings {
  drivers: Record<WecClass, WecDriverStanding[]>;
  // Hypercar omitted — no Hypercar teams' championship.
  teams: Partial<Record<WecClass, WecTeamStanding[]>>;
  // LMGT3 omitted — no LMGT3 manufacturers' championship.
  manufacturers: Partial<Record<WecClass, WecManufacturerStanding[]>>;
}

// Sanity floor: the 2026 Hypercar grid is 18 cars (8 manufacturers, most
// running 2-car efforts) and LMGT3 is 18 cars (one per team). Drivers tables
// span ~36 entries per class. 4 is the floor where we fail closed rather than
// ship a misleadingly-empty table.
const MIN_ROWS_PER_TABLE = 4;

const STANDINGS_URL =
  'https://www.fiawec.com/en/page/manufacturers-classification';

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html',
};

// Classify a collapse-button label into (cls, section). The button text on
// fiawec.com follows a stable pattern:
//   "FIA Hypercar World Endurance Manufacturers' Championship"
//   "FIA Hypercar World Endurance Drivers Championship"
//   "FIA Endurance Trophy for LMGT3 Teams"
//   "FIA Endurance Trophy for LMGT3 Drivers"
// Curly + straight apostrophes both appear depending on rendering; the regex
// tolerates either.
function classifyButton(
  text: string,
): { cls: WecClass; section: 'drivers' | 'teams' | 'manufacturers' } | null {
  const t = text.toLowerCase();
  const isHypercar = /hypercar/.test(t);
  const isLmgt3 = /lmgt3/.test(t);
  if (!isHypercar && !isLmgt3) return null;
  const cls: WecClass = isHypercar ? 'Hypercar' : 'LMGT3';
  if (/manufacturers?[’']? championship/.test(t)) {
    return { cls, section: 'manufacturers' };
  }
  if (/drivers?[’']? championship/.test(t) || /lmgt3 drivers/.test(t)) {
    return { cls, section: 'drivers' };
  }
  if (/teams?[’']? championship/.test(t) || /lmgt3 teams/.test(t)) {
    return { cls, section: 'teams' };
  }
  return null;
}

function parsePoints(raw: string): number {
  // Tables ship totals with whitespace and occasional thousands separators.
  // Empty cells render as "-" or just whitespace.
  const cleaned = raw.replace(/[,\s]/g, '');
  if (!cleaned || cleaned === '-') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parsePosition(raw: string): number {
  return Number(raw.trim());
}

// Total points lives in the last column of every WEC standings table. Anchor
// on the last <td> rather than counting columns, so the parser stays robust
// when WEC adds/removes per-round columns through the season.
function lastCellText(
  $: cheerio.CheerioAPI,
  $row: ReturnType<cheerio.CheerioAPI>,
): string {
  const cells = $row.find('td');
  return $(cells[cells.length - 1])
    .text()
    .trim();
}

// Pull a clean text node from a complex cell — strips inner <img> alt attrs,
// collapses whitespace, drops any "Total" / "Pts" labels that the responsive
// CSS shows on narrow viewports.
function cellText(
  $: cheerio.CheerioAPI,
  $cell: ReturnType<cheerio.CheerioAPI>,
): string {
  return $cell.text().replace(/\s+/g, ' ').trim();
}

function parseManufacturerRow(
  $: cheerio.CheerioAPI,
  $row: ReturnType<cheerio.CheerioAPI>,
): WecManufacturerStanding | null {
  const cells = $row.find('td');
  if (cells.length < 3) return null;
  const position = parsePosition($(cells[0]).text());
  // Cell 2: manufacturer name — text plus brand logo image. The cheerio .text()
  // pulls just the text node ("BMW", "FERRARI", "TOYOTA"). Use the image alt
  // as a fallback when the text node is empty (some templates render only the
  // logo).
  const $nameCell = $(cells[1]);
  let manufacturer = cellText($, $nameCell);
  if (!manufacturer) {
    manufacturer = $nameCell.find('img').attr('alt')?.trim() ?? '';
  }
  const points = parsePoints(lastCellText($, $row));
  if (!Number.isFinite(position) || !manufacturer) return null;
  return { position, manufacturer, points };
}

function parseDriverRow(
  $: cheerio.CheerioAPI,
  $row: ReturnType<cheerio.CheerioAPI>,
): WecDriverStanding | null {
  const cells = $row.find('td');
  if (cells.length < 5) return null;
  const position = parsePosition($(cells[0]).text());
  // Cells: Pos | Manufacturer (logo) | Car# | Drivers | per-round columns | Total
  const manufacturer = (
    $(cells[1]).find('img').attr('alt')?.trim() ?? cellText($, $(cells[1]))
  );
  const carNumber = cellText($, $(cells[2]));
  // Drivers cell carries one or more <span class="text-reset text-body"> nodes
  // separated by commas. Joining the inner text by spaces produces e.g.
  // "RENÉ RAST ROBIN FRIJNS" — single-space-joined matches IMSA + WRC.
  const $driversCell = $(cells[3]);
  const driverNames = $driversCell
    .find('span.text-body, span.text-reset')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const driverName =
    driverNames.length > 0 ? driverNames.join(' ') : cellText($, $driversCell);
  const points = parsePoints(lastCellText($, $row));
  if (!Number.isFinite(position) || !driverName) return null;
  // Hypercar drivers are tagged by manufacturer + car number; LMGT3 drivers
  // also include a manufacturer in column 2, so the same shape applies.
  const team = [manufacturer, carNumber].filter(Boolean).join(' ').trim();
  return { position, driverName, team, points };
}

function parseTeamRow(
  $: cheerio.CheerioAPI,
  $row: ReturnType<cheerio.CheerioAPI>,
): WecTeamStanding | null {
  const cells = $row.find('td');
  if (cells.length < 5) return null;
  const position = parsePosition($(cells[0]).text());
  // Cells: Pos | Competitors (mfr logo) | Car# | Team | per-round | Total
  const manufacturer = (
    $(cells[1]).find('img').attr('alt')?.trim() ?? cellText($, $(cells[1]))
  );
  const carNumber = cellText($, $(cells[2]));
  const teamName = cellText($, $(cells[3]));
  const points = parsePoints(lastCellText($, $row));
  if (!Number.isFinite(position) || !teamName) return null;
  // Team string keeps the car-number prefix so duplicates (e.g. two #5s
  // across years) stay distinguishable, matching WEC's own UI.
  const team = [manufacturer, carNumber, teamName].filter(Boolean).join(' ').trim();
  return { position, team, points };
}

export async function fetchWecStandings(): Promise<WecStandings | null> {
  let html: string;
  try {
    const res = await fetch(STANDINGS_URL, {
      headers: FETCH_HEADERS,
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }
  return parseWecStandings(html);
}

export function parseWecStandings(html: string): WecStandings | null {
  const $ = cheerio.load(html);

  const empty: WecStandings = {
    drivers: { Hypercar: [], LMGT3: [] },
    teams: {},
    manufacturers: {},
  };

  // Find every collapse-toggle button and its associated table.
  let foundAny = false;
  $('button[data-bs-toggle="collapse"][data-bs-target]').each((_, btn) => {
    const $btn = $(btn);
    const target = $btn.attr('data-bs-target');
    if (!target) return;
    const label = $btn.text().trim();
    const classified = classifyButton(label);
    if (!classified) return;

    const $panel = $(target);
    const $table = $panel.find('table.table-standing').first();
    if ($table.length === 0) return;

    const rows = $table.find('tbody > tr').toArray();

    if (classified.section === 'manufacturers') {
      const parsed = rows
        .map(r => parseManufacturerRow($, $(r)))
        .filter((x): x is WecManufacturerStanding => x !== null)
        .sort((a, b) => a.position - b.position);
      if (parsed.length >= MIN_ROWS_PER_TABLE) {
        empty.manufacturers[classified.cls] = parsed;
        foundAny = true;
      }
    } else if (classified.section === 'drivers') {
      const parsed = rows
        .map(r => parseDriverRow($, $(r)))
        .filter((x): x is WecDriverStanding => x !== null)
        .sort((a, b) => a.position - b.position);
      if (parsed.length >= MIN_ROWS_PER_TABLE) {
        empty.drivers[classified.cls] = parsed;
        foundAny = true;
      }
    } else if (classified.section === 'teams') {
      const parsed = rows
        .map(r => parseTeamRow($, $(r)))
        .filter((x): x is WecTeamStanding => x !== null)
        .sort((a, b) => a.position - b.position);
      if (parsed.length >= MIN_ROWS_PER_TABLE) {
        empty.teams[classified.cls] = parsed;
        foundAny = true;
      }
    }
  });

  return foundAny ? empty : null;
}
