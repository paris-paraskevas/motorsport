import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildCrewIndex,
  extractLiveProps,
  parseClassificationTable,
  parseEventDateRange,
  parseSelectOptions,
  WEC_RESULT_CLASSES,
} from './wec';
import type { WecStandings } from '@/lib/standings/wec';

// All cases drive the pure parsers against real captures from fiawec.com's
// results live component (2026-06-12, post-Spa R2 / pre-Le Mans R3): the
// bootstrap page plus three component responses (Spa race Hypercar, Spa race
// LMGT3, Imola race Hypercar — the latter for lap-deficit gap strings).
// Synthetic fixtures would have missed the 11-cell row layout and the
// illustration column (same lesson as the FE colspan / WRC mw-heading bugs).
const fixture = (name: string) =>
  readFileSync(resolve(process.cwd(), 'tests/fixtures', name), 'utf-8');

const PAGE = fixture('wec-results-page-2026-06-12.html');
const SPA_HYPERCAR = fixture('wec-results-spa-race-hypercar-2026-06-12.html');
const SPA_LMGT3 = fixture('wec-results-spa-race-lmgt3-2026-06-12.html');
const IMOLA_HYPERCAR = fixture('wec-results-imola-race-hypercar-2026-06-12.html');

describe('extractLiveProps', () => {
  it('reads the signed props blob from the bootstrap page', () => {
    const props = extractLiveProps(PAGE);
    expect(props).not.toBeNull();
    expect(props!.raceId).toBe(4951); // Le Mans selected by default pre-race
    expect(props!.seasonId).toBe(4175); // 2026
    expect(props!['@checksum']).toBeTruthy();
  });

  it('reads re-signed props from a component response', () => {
    const props = extractLiveProps(SPA_HYPERCAR);
    expect(props).not.toBeNull();
    expect(props!.raceId).toBe(4949);
    expect(props!.sessionId).toBe(7812);
  });

  it('returns null when the attribute is absent or unparseable', () => {
    expect(extractLiveProps('<div>nothing</div>')).toBeNull();
    expect(
      extractLiveProps('<div data-live-props-value="not json"></div>'),
    ).toBeNull();
  });
});

describe('parseSelectOptions', () => {
  it('parses the 2026 race list with FRANCE selected', () => {
    const races = parseSelectOptions(PAGE, 'changeRace');
    expect(races).toHaveLength(8);
    const selected = races.find(r => r.selected);
    expect(selected?.label).toBe('FRANCE');
    expect(selected?.id).toBe(4951);
    expect(races.map(r => r.label)).toContain('BELGIUM');
  });

  it('parses the session list of a selected race', () => {
    const sessions = parseSelectOptions(SPA_HYPERCAR, 'sessionChanged');
    const race = sessions.find(s => s.label === 'RACE');
    expect(race?.id).toBe(7812);
    expect(race?.selected).toBe(true);
  });

  it('reads the category ids from the bootstrap page (manifest harvest source)', () => {
    // Component RESPONSES ship this select empty — only the bootstrap page
    // populates it, which is why the ids live curated in fiawec-races.json.
    expect(parseSelectOptions(SPA_HYPERCAR, 'changeCategory')).toEqual([]);
    const cats = parseSelectOptions(PAGE, 'changeCategory');
    expect(cats.find(c => c.label === 'HYPERCAR')?.id).toBe(4167);
    expect(cats.find(c => c.label === 'LMP2')?.id).toBe(3);
    expect(cats.find(c => c.label === 'LMGT3')?.id).toBe(4183);
  });

  it('returns [] for an unknown action', () => {
    expect(parseSelectOptions(PAGE, 'noSuchAction')).toEqual([]);
  });
});

describe('parseEventDateRange', () => {
  it('parses a same-month range (Spa, 7 - 9 may 2026)', () => {
    const range = parseEventDateRange(SPA_HYPERCAR);
    expect(range?.start.toISOString().slice(0, 10)).toBe('2026-05-07');
    expect(range?.end.toISOString().slice(0, 10)).toBe('2026-05-09');
  });

  it('parses the Imola range (17 - 19 april 2026)', () => {
    const range = parseEventDateRange(IMOLA_HYPERCAR);
    expect(range?.start.toISOString().slice(0, 10)).toBe('2026-04-17');
    expect(range?.end.toISOString().slice(0, 10)).toBe('2026-04-19');
  });

  it('returns null when no date appears', () => {
    expect(parseEventDateRange('<p>no dates here</p>')).toBeNull();
  });
});

describe('parseClassificationTable', () => {
  it('parses the full Spa Hypercar classification', () => {
    // 17 classified of the 18-car grid — the table is fiawec's classified
    // list, and the header row is <td>-based, caught by the numeric guard.
    const entries = parseClassificationTable(SPA_HYPERCAR);
    expect(entries).toHaveLength(17);
    const p1 = entries[0];
    expect(p1.position).toBe(1);
    expect(p1.carNumber).toBe('20');
    expect(p1.team).toBe('BMW M TEAM WRT');
    expect(p1.manufacturer).toBe('BMW');
    expect(p1.laps).toBe(151);
    expect(p1.elapsedTime).toBe('6:01:17.036');
    expect(p1.gap).toBe(''); // leader's "-" normalises to empty
    expect(entries[1].gap).toBe('1.969');
    // Sorted by position throughout.
    expect(entries.map(e => e.position)).toEqual(
      entries.map((_, i) => i + 1),
    );
  });

  it('parses the Spa LMGT3 classification', () => {
    const entries = parseClassificationTable(SPA_LMGT3);
    expect(entries).toHaveLength(18);
    expect(entries[0].carNumber).toBe('10');
    expect(entries[0].team).toBe('GARAGE 59');
  });

  it('keeps lap-deficit gap strings verbatim (Imola)', () => {
    const entries = parseClassificationTable(IMOLA_HYPERCAR);
    expect(entries).toHaveLength(17);
    const last = entries[entries.length - 1];
    expect(last.position).toBe(17);
    expect(last.gap).toBe('24 Laps');
    expect(last.laps).toBe(189);
  });

  it('returns [] when no table is present', () => {
    expect(parseClassificationTable('<table><tbody></tbody></table>')).toEqual([]);
    expect(parseClassificationTable('<p>none</p>')).toEqual([]);
  });
});

describe('buildCrewIndex', () => {
  it('indexes crews by class + car number from standings team strings', () => {
    const standings: WecStandings = {
      drivers: {
        Hypercar: [
          { position: 1, driverName: 'R. RAST S. VAN DER LINDE', team: 'BMW #20', points: 60 },
          { position: 2, driverName: 'K. MAGNUSSEN D. VANTHOOR', team: 'BMW #15', points: 50 },
        ],
        LMGT3: [
          { position: 1, driverName: 'A. DRIVER B. DRIVER', team: 'MCLAREN #10', points: 40 },
        ],
      },
      teams: {},
      manufacturers: {},
    };
    const index = buildCrewIndex(standings);
    expect(index.get('Hypercar:20')).toBe('R. RAST S. VAN DER LINDE');
    expect(index.get('LMGT3:10')).toBe('A. DRIVER B. DRIVER');
    expect(index.get('Hypercar:10')).toBeUndefined(); // class-scoped
  });

  it('returns an empty index for null standings', () => {
    expect(buildCrewIndex(null).size).toBe(0);
  });
});

describe('WEC_RESULT_CLASSES', () => {
  it('orders classes Hypercar → LMP2 → LMGT3', () => {
    expect(WEC_RESULT_CLASSES).toEqual(['Hypercar', 'LMP2', 'LMGT3']);
  });
});
