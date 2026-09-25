import { describe, expect, it } from 'vitest';
import type { ViewState } from './view-state';
import { readFileSync } from 'node:fs';
import { PRESETS, PRESET_GROUPS, SHAPES, findPreset, presetRows, presetsFor, rowPasses } from './presets';
import { SERIES_OPTIONS } from './sources';

/** P2.24 B2: the two Series values the readers resolve (Home's series on Results, the Latest result on Standings), declared, not slugs. */
const SPECIAL: Readonly<Record<string, readonly string[]>> = { results: ['home'], standings: ['latest'] };

// The preset catalogue (P2.2): the fifteen groups as the operator saw them
// drawn, every class heading its own preset, presets that share their columns
// one shape with a label of their own (the word of 2026-09-18); the seven
// results presets declared and waiting for the Rounds view (PR B).

describe('the preset catalogue', () => {
  it('holds the twenty-one groups in the drawn order and thirty-nine presets: twenty-seven standings over two shapes, eight results over four, one session (P2.25), the site’s tables drawn as the Rounds layout by default (P2.2 B1), and Home’s five boxes as templates (P2.24 A, B1, B2)', () => {
    expect(PRESET_GROUPS.map(g => g.name)).toEqual([
      'Drivers',
      'Constructors',
      'Teams',
      'Manufacturers',
      'Co-Drivers',
      'GT World Challenge cups',
      'IMSA classes',
      'FIA WEC classes',
      'Season results',
      'Feature races',
      'Sprint races',
      'Overall winners',
      'Season results · IMSA',
      'Season results · WEC',
      'Season results · GT World',
      'Lead story',
      'The wire',
      "What's next",
      'Latest result',
      'What it changed',
      'Session',
    ]);
    expect(PRESETS).toHaveLength(39);
    const standings = PRESETS.filter(p => p.source === 'standings');
    expect(standings).toHaveLength(27);
    expect(new Set(standings.map(p => p.shape))).toEqual(new Set(['driver-rows', 'team-rows']));
    const results = PRESETS.filter(p => p.source === 'results');
    expect(results).toHaveLength(8);
    expect(new Set(results.map(p => p.shape))).toEqual(new Set(['race-rows', 'car-rows', 'cup-rows', 'podium-rows']));
    expect(PRESETS.filter(p => p.source === 'posts').map(p => p.key)).toEqual(['lead-story']);
    expect(PRESETS.filter(p => p.source === 'news').map(p => p.key)).toEqual(['wire']);
    expect(PRESETS.filter(p => p.source === 'weekends').map(p => p.key)).toEqual(['whats-next']);
    // P2.25: one Session preset over the session-results source, F1 alone, the Table, thirty rows so a full classification shows.
    expect(PRESETS.filter(p => p.source === 'session-results')).toEqual([{ key: 'session', name: 'Session', group: 'session', source: 'session-results', shape: 'session-rows', where: {}, series: ['f1'], nameLabel: 'Driver', view: 'table', rows: 30 }]);
    expect(SHAPES['session-rows'].columns.map(c => c.key)).toEqual(['position', 'driver', 'code', 'team', 'laps', 'time', 'gap', 'interval', 'q1', 'q2', 'q3', 'compound', 'status']);
    expect(SHAPES['session-rows'].columns.find(c => c.key === 'driver')).toEqual({ key: 'driver', label: 'Driver', type: 'link', href: 'profile' });
    expect(SHAPES['session-rows'].card).toEqual({ title: 'driver', subtitle: 'team', body: 'time', badge: 'position' });
    expect(presetsFor('session-results', 'f1').map(p => p.key)).toEqual(['session']);
    expect(presetsFor('session-results', 'f2')).toEqual([]);
    for (const p of PRESETS) expect(Object.keys(p), p.key).not.toContain('later');
    // The site's tables bring the Rounds layout (results) or the Table (standings); Home's two boxes over these sources bring their own templates (P2.24 B2).
    for (const p of results) expect(p.view, p.key).toBe(p.key === 'latest-result' ? 'podium' : 'list');
    for (const p of standings) expect(p.view, p.key).toBe(p.key === 'what-it-changed' ? 'leader' : 'table');
    expect(results.map(p => [p.key, p.shape, p.where])).toEqual([
      ['latest-result', 'podium-rows', {}],
      ['season-results', 'race-rows', { session: 'race' }],
      ['feature-races', 'race-rows', { session: 'feature' }],
      ['sprint-races', 'race-rows', { session: 'sprint' }],
      ['overall-winners', 'race-rows', {}],
      ['season-results-imsa', 'car-rows', {}],
      ['season-results-wec', 'car-rows', {}],
      ['season-results-gt-world', 'cup-rows', {}],
    ]);
    expect(findPreset('season-results')?.series).toEqual(['f1', 'f3', 'indycar', 'nascar-cup', 'wrc', 'motogp', 'wsbk', 'dtm', 'formula-e']);
    // The results shapes: the race title links to the round's weekend page; the sportscar shapes carry the car, its vehicle and the gap, no points.
    expect(SHAPES['race-rows'].columns.map(c => c.key)).toEqual(['round', 'race', 'date', 'circuit', 'session', 'position', 'driver', 'code', 'team', 'status', 'time', 'points']);
    expect(SHAPES['race-rows'].columns.find(c => c.key === 'race')).toEqual({ key: 'race', label: 'Race', type: 'link', href: 'weekend' });
    expect(SHAPES['race-rows'].columns.find(c => c.key === 'date')?.type).toBe('date');
    expect(SHAPES['car-rows'].columns.map(c => c.key)).toEqual(['round', 'race', 'date', 'class', 'position', 'car', 'driver', 'team', 'vehicle', 'manufacturer', 'laps', 'status', 'gap']);
    expect(SHAPES['cup-rows'].columns.map(c => c.key)).toEqual(['round', 'race', 'class', 'position', 'car', 'driver', 'team', 'vehicle', 'laps', 'gap']);
    expect(SHAPES['car-rows'].card).toEqual({ title: 'driver', subtitle: 'team', body: 'gap', badge: 'car' });
    expect(new Set(PRESETS.map(p => p.key)).size).toBe(39);
    const groups = new Set(PRESET_GROUPS.map(g => g.key));
    const slugs = new Set(SERIES_OPTIONS.map(o => o.key));
    for (const p of PRESETS) {
      expect(groups.has(p.group), p.key).toBe(true);
      expect(SHAPES[p.shape], p.key).toBeDefined();
      expect(SHAPES[p.shape].source, p.key).toBe(p.source);
      expect(p.series.length, p.key).toBeGreaterThan(0);
      for (const s of p.series) expect(slugs.has(s) || (SPECIAL[p.source] ?? []).includes(s), `${p.key}: ${s}`).toBe(true);
      expect(p.name.trim(), p.key).toBe(p.name);
    }
    for (const shape of Object.values(SHAPES)) expect(new Set(shape.columns.map(c => c.key)).size).toBe(shape.columns.length);
  });

  it('names the class families as the site heads them, every heading its own preset with the class in its where; same-column presets share a shape and differ by the name column’s label', () => {
    const gt = PRESETS.filter(p => p.group === 'gt-world-cups');
    expect(gt.map(p => p.name)).toEqual(['Overall — Drivers', 'Overall — Teams', 'Sprint Cup — Drivers', 'Sprint Cup — Teams', 'Endurance Cup — Drivers', 'Endurance Cup — Teams']);
    expect(gt.map(p => p.where)).toEqual([
      { kind: 'driver', class: 'Overall' },
      { kind: 'team', class: 'Overall' },
      { kind: 'driver', class: 'Sprint Cup' },
      { kind: 'team', class: 'Sprint Cup' },
      { kind: 'driver', class: 'Endurance Cup' },
      { kind: 'team', class: 'Endurance Cup' },
    ]);
    expect(gt.every(p => p.series.length === 1 && p.series[0] === 'gt-world')).toBe(true);
    const imsa = PRESETS.filter(p => p.group === 'imsa-classes');
    expect(imsa.map(p => p.name)).toEqual([
      'GTP — Drivers',
      'GTP — Teams',
      'GTP — Manufacturers',
      'LMP2 — Drivers',
      'LMP2 — Teams',
      'GTD Pro — Drivers',
      'GTD Pro — Teams',
      'GTD Pro — Manufacturers',
      'GTD — Drivers',
      'GTD — Teams',
      'GTD — Manufacturers',
    ]);
    expect(findPreset('imsa-gtd-pro-manufacturers')).toMatchObject({ shape: 'team-rows', nameLabel: 'Manufacturer', where: { kind: 'manufacturer', class: 'GTD Pro' }, series: ['imsa'] });
    const wec = PRESETS.filter(p => p.group === 'wec-classes');
    expect(wec.map(p => p.name)).toEqual(['Hypercar — Drivers', 'Hypercar — Manufacturers', 'LMGT3 — Drivers', 'LMGT3 — Teams']);
    expect(findPreset('drivers')).toMatchObject({ shape: 'driver-rows', nameLabel: 'Driver', where: { kind: 'driver' }, view: 'table' });
    expect(findPreset('co-drivers')).toMatchObject({ shape: 'driver-rows', nameLabel: 'Co-Driver', where: { kind: 'co-driver' }, series: ['wrc'] });
    expect(findPreset('constructors')).toMatchObject({ shape: 'team-rows', nameLabel: 'Constructor', where: { kind: 'constructor' } });
    expect(findPreset('teams')).toMatchObject({ shape: 'team-rows', nameLabel: 'Team', where: { kind: 'constructor' }, series: ['dtm'] });
    expect(findPreset('manufacturers')).toMatchObject({ shape: 'team-rows', nameLabel: 'Manufacturer', where: { kind: 'manufacturer' }, series: ['wrc'] });
    expect(findPreset('overall-winners')).toMatchObject({ source: 'results', series: ['nls'], shape: 'race-rows', view: 'list' });
    expect(findPreset('nope')).toBeNull();
  });

  it('offers the presets of a source and a series: F1 its Drivers and Constructors, MotoGP its Drivers, WRC its three, WEC its four classes, F2’s results its two, NLS no standings', () => {
    // P2.24 B2: What it changed joins the ten with a drivers' brief, Latest result every results series.
    expect(presetsFor('standings', 'f1').map(p => p.key)).toEqual(['drivers', 'constructors', 'what-it-changed']);
    expect(presetsFor('standings', 'motogp').map(p => p.key)).toEqual(['drivers', 'what-it-changed']);
    expect(presetsFor('standings', 'wrc').map(p => p.key)).toEqual(['drivers', 'manufacturers', 'co-drivers', 'what-it-changed']);
    expect(presetsFor('standings', 'dtm').map(p => p.key)).toEqual(['drivers', 'teams', 'what-it-changed']);
    expect(presetsFor('standings', 'wec').map(p => p.key)).toEqual(['wec-hypercar-drivers', 'wec-hypercar-manufacturers', 'wec-lmgt3-drivers', 'wec-lmgt3-teams']);
    expect(presetsFor('standings', 'imsa')).toHaveLength(11);
    // R8: the Latest result box leads every results series' list, so a change of Source lands on it (R7 picks the first offered).
    expect(presetsFor('results', 'f2').map(p => p.key)).toEqual(['latest-result', 'feature-races', 'sprint-races']);
    expect(presetsFor('results', 'f1').map(p => p.key)).toEqual(['latest-result', 'season-results']);
    expect(presetsFor('results', 'wec').map(p => p.key)).toEqual(['latest-result', 'season-results-wec']);
    expect(presetsFor('standings', 'nls')).toEqual([]);
    expect(presetsFor('results', 'nls').map(p => p.key)).toEqual(['latest-result', 'overall-winners']);
  });

  it('selects a preset’s rows: the kind and the class, by position, cut to the count; a flat series’ rows carry no class and match a preset with none', () => {
    const rows = [
      { kind: 'team', position: 1, name: 'WRT', class: 'Overall', points: 120 },
      { kind: 'driver', position: 2, name: 'Engel', class: 'Overall', points: 91 },
      { kind: 'driver', position: 1, name: 'Marciello', class: 'Overall', points: 98 },
      { kind: 'driver', position: 1, name: 'Sprinter', class: 'Sprint Cup', points: 50 },
    ];
    expect(presetRows(rows, findPreset('gt-world-overall-drivers')!, 10).map(r => r.name)).toEqual(['Marciello', 'Engel']);
    expect(presetRows(rows, findPreset('gt-world-overall-drivers')!, 1).map(r => r.name)).toEqual(['Marciello']);
    expect(presetRows(rows, findPreset('gt-world-overall-teams')!, 10).map(r => r.name)).toEqual(['WRT']);
    expect(presetRows(rows, findPreset('gt-world-endurance-cup-teams')!, 10)).toEqual([]);
    expect(findPreset('gt-world-sprint-cup-drivers')?.name).toBe('Sprint Cup — Drivers');
    const flat = [
      { kind: 'constructor', position: 2, name: 'McLaren', class: null, points: 377 },
      { kind: 'driver', position: 1, name: 'Antonelli', class: null, points: 292 },
      { kind: 'constructor', position: 1, name: 'Mercedes', class: null, points: 503 },
    ];
    expect(presetRows(flat, findPreset('constructors')!, 10).map(r => r.name)).toEqual(['Mercedes', 'McLaren']);
    expect(presetRows(flat, findPreset('drivers')!, 10).map(r => r.name)).toEqual(['Antonelli']);
  });

  it('P2.2 B1: a results preset’s rows are its session’s, newest round first, a weekend’s races kept together in the order the fetcher gave them (R1 · Superpole · R2), each by position', () => {
    const at = (round: number, race: string, position: number, session = 'race') => ({ round, race, raceId: null, position, driver: `${race} P${position}`, session, points: 25 - position, class: null });
    const rows = [
      at(1, 'Australia Race 1', 1),
      at(1, 'Australia Race 1', 2),
      at(2, 'Assen Race 1', 2),
      at(2, 'Assen Race 1', 1),
      at(2, 'Assen Superpole Race', 1),
      at(2, 'Assen Superpole Race', 2),
      at(2, 'Assen Race 2', 1),
      at(2, 'Assen Race 2', 2),
      at(2, 'Assen Sprint', 1, 'sprint'),
    ];
    expect(presetRows(rows, findPreset('season-results')!, 50).map(r => r.driver)).toEqual([
      'Assen Race 1 P1',
      'Assen Race 1 P2',
      'Assen Superpole Race P1',
      'Assen Superpole Race P2',
      'Assen Race 2 P1',
      'Assen Race 2 P2',
      'Australia Race 1 P1',
      'Australia Race 1 P2',
    ]);
    expect(presetRows(rows, findPreset('sprint-races')!, 50).map(r => r.driver)).toEqual(['Assen Sprint P1']);
    // The count is of races, each whole: two races, four rows, never half a classification.
    expect(presetRows(rows, findPreset('season-results')!, 2).map(r => r.driver)).toEqual(['Assen Race 1 P1', 'Assen Race 1 P2', 'Assen Superpole Race P1', 'Assen Superpole Race P2']);
    expect(presetRows(rows, findPreset('season-results')!, 0)).toEqual([]);
    // A GT World race without a round sorts last, its rows kept together by the race id.
    const cups = [
      { round: null, raceId: 777, race: 'Spa Race', class: 'Pro Cup', position: 1, driver: 'Spa P1' },
      { round: 2, raceId: 501, race: 'Brands Hatch Race 1', class: 'Gold Cup', position: 1, driver: 'Gold P1' },
      { round: 2, raceId: 501, race: 'Brands Hatch Race 1', class: 'Pro Cup', position: 2, driver: 'Pro P2' },
      { round: 2, raceId: 501, race: 'Brands Hatch Race 1', class: 'Pro Cup', position: 1, driver: 'Pro P1' },
    ];
    expect(presetRows(cups, findPreset('season-results-gt-world')!, 50).map(r => r.driver)).toEqual(['Gold P1', 'Pro P1', 'Pro P2', 'Spa P1']);
  });

  it('P2.24 A: Home’s two boxes over the posts and news sources: the Lead story preset over post-rows (its view the Lead story template, four rows: the lead and three further) and The wire over news-rows (its view The wire, five rows), every series; the shapes carry the pieces’ facts, the cover as the image column, the news title as a link that leaves the site; a shape without a position keeps the source’s order', () => {
    expect(PRESET_GROUPS.slice(15, 17)).toEqual([
      { key: 'lead-story', name: 'Lead story', source: 'posts' },
      { key: 'wire', name: 'The wire', source: 'news' },
    ]);
    expect(findPreset('lead-story')).toMatchObject({ name: 'Lead story', group: 'lead-story', source: 'posts', shape: 'post-rows', where: {}, view: 'lead-story', rows: 4, nameLabel: 'Title' });
    expect(findPreset('wire')).toMatchObject({ name: 'The wire', group: 'wire', source: 'news', shape: 'news-rows', where: {}, view: 'wire', rows: 5 });
    for (const key of ['lead-story', 'wire']) expect([...findPreset(key)!.series].sort(), key).toEqual(SERIES_OPTIONS.map(o => o.key).sort());
    for (const key of ['drivers', 'season-results']) expect(findPreset(key)!.rows, key).toBeUndefined();
    expect(SHAPES['post-rows']).toEqual({
      key: 'post-rows',
      source: 'posts',
      columns: [
        { key: 'hero', label: 'Cover', type: 'image' },
        { key: 'title', label: 'Title', type: 'link', href: 'link' },
        { key: 'summary', label: 'Summary', type: 'text' },
        { key: 'seriesName', label: 'Series', type: 'text' },
        { key: 'author', label: 'Author', type: 'text' },
        { key: 'published', label: 'Published', type: 'date' },
        { key: 'minutes', label: 'Read time', type: 'number' },
      ],
      card: { title: 'title', subtitle: 'author', body: 'published', badge: 'seriesName', media: 'hero' },
    });
    expect(SHAPES['news-rows']).toEqual({
      key: 'news-rows',
      source: 'news',
      columns: [
        { key: 'title', label: 'Title', type: 'link', href: 'link', external: true },
        { key: 'source', label: 'Source', type: 'text' },
        { key: 'seriesName', label: 'Series', type: 'text' },
        { key: 'published', label: 'Published', type: 'date' },
      ],
      card: { title: 'title', subtitle: 'source', body: 'published', badge: 'seriesName' },
    });
    expect(presetsFor('posts', 'f1').map(p => p.key)).toEqual(['lead-story']);
    expect(presetsFor('posts', 'wsbk').map(p => p.key)).toEqual(['lead-story']);
    expect(presetsFor('news', 'nls').map(p => p.key)).toEqual(['wire']);
    // No position on a post or a headline: the rows stay in the source's order (newest first), cut to the count.
    const posts = [{ slug: 'a', title: 'A' }, { slug: 'b', title: 'B' }, { slug: 'c', title: 'C' }];
    expect(presetRows(posts, findPreset('lead-story')!, 2).map(r => r.slug)).toEqual(['a', 'b']);
    expect(presetRows(posts, findPreset('wire')!, 10).map(r => r.slug)).toEqual(['a', 'b', 'c']);
  });

  it('P2.24 B1: Home’s What’s next over the weekends source: the preset over weekend-rows (its view the Coming weekends template, three rows, every series), named with Home’s straight apostrophe; the shape links the title to the weekend page; the rows keep the source’s order', () => {
    expect(PRESET_GROUPS[17]).toEqual({ key: 'whats-next', name: "What's next", source: 'weekends' });
    expect(findPreset('whats-next')).toMatchObject({ name: "What's next", group: 'whats-next', source: 'weekends', shape: 'weekend-rows', where: {}, view: 'coming-weekends', rows: 3, nameLabel: 'Title' });
    expect([...findPreset('whats-next')!.series].sort()).toEqual(SERIES_OPTIONS.map(o => o.key).sort());
    expect(SHAPES['weekend-rows']).toEqual({
      key: 'weekend-rows',
      source: 'weekends',
      columns: [
        { key: 'title', label: 'Title', type: 'link', href: 'weekend' },
        { key: 'seriesName', label: 'Series', type: 'text' },
        { key: 'dates', label: 'Dates', type: 'text' },
        { key: 'start', label: 'First session', type: 'date' },
        { key: 'end', label: 'Last session', type: 'date' },
        { key: 'round', label: 'Round', type: 'number' },
      ],
      card: { title: 'title', subtitle: 'seriesName', body: 'dates', badge: 'round' },
    });
    expect(presetsFor('weekends', 'wec').map(p => p.key)).toEqual(['whats-next']);
    const weekends = [{ round: 17, title: 'A' }, { round: 7, title: 'B' }, { round: 5, title: 'C' }];
    expect(presetRows(weekends, findPreset('whats-next')!, 2).map(r => r.title)).toEqual(['A', 'B']);
  });

  it('P2.24 B2: Home’s Latest result and What it changed: the Latest result preset over podium-rows (its view the Podium template, three rows) for Home’s series and every results series, What it changed over driver-rows (its view the Leader template, five rows) for the Latest result and the ten with a drivers’ brief; the podium shape puts its numbers last; the podium rows are the newest race by date, its first class alone, by position, cut to the count', () => {
    expect(PRESET_GROUPS.slice(18, 20)).toEqual([
      { key: 'latest-result', name: 'Latest result', source: 'results' },
      { key: 'what-it-changed', name: 'What it changed', source: 'standings' },
    ]);
    expect(findPreset('latest-result')).toMatchObject({ name: 'Latest result', group: 'latest-result', source: 'results', shape: 'podium-rows', where: {}, view: 'podium', rows: 3, nameLabel: 'Driver' });
    expect(findPreset('latest-result')!.series).toEqual(['home', 'f1', 'f2', 'f3', 'formula-e', 'indycar', 'motogp', 'wsbk', 'nascar-cup', 'wrc', 'dtm', 'nls', 'imsa', 'wec', 'gt-world']);
    expect(findPreset('what-it-changed')).toMatchObject({ name: 'What it changed', group: 'what-it-changed', source: 'standings', shape: 'driver-rows', where: { kind: 'driver' }, view: 'leader', rows: 5, nameLabel: 'Driver' });
    expect(findPreset('what-it-changed')!.series).toEqual(['latest', 'f1', 'f2', 'f3', 'indycar', 'formula-e', 'motogp', 'nascar-cup', 'wsbk', 'wrc', 'dtm']);
    expect(SHAPES['podium-rows']).toEqual({
      key: 'podium-rows',
      source: 'results',
      columns: [
        { key: 'race', label: 'Race', type: 'link', href: 'weekend' },
        { key: 'seriesName', label: 'Series', type: 'text' },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'position', label: 'Pos', type: 'position' },
        { key: 'driver', label: 'Driver', type: 'link', href: 'profile' },
        { key: 'team', label: 'Team', type: 'text' },
        { key: 'car', label: 'Car', type: 'badge' },
        { key: 'time', label: 'Time', type: 'text' },
        { key: 'gap', label: 'Gap', type: 'text' },
        { key: 'points', label: 'Pts', type: 'number' },
        { key: 'round', label: 'Round', type: 'number' },
      ],
      card: { title: 'driver', subtitle: 'team', body: 'time', badge: 'position' },
    });
    // P2.4 PR B: the name and the driver link to the person's page the row carries (text where it carries none); a crew stays text.
    expect(SHAPES['driver-rows'].columns.find(c => c.key === 'name')).toEqual({ key: 'name', label: 'Driver', type: 'link', href: 'profile' });
    expect(SHAPES['team-rows'].columns.find(c => c.key === 'name')).toEqual({ key: 'name', label: 'Constructor', type: 'link', href: 'profile' });
    expect(SHAPES['race-rows'].columns.find(c => c.key === 'driver')).toEqual({ key: 'driver', label: 'Driver', type: 'link', href: 'profile' });
    expect(SHAPES['car-rows'].columns.find(c => c.key === 'driver')).toEqual({ key: 'driver', label: 'Drivers', type: 'text' });
    expect(SHAPES['cup-rows'].columns.find(c => c.key === 'driver')).toEqual({ key: 'driver', label: 'Drivers', type: 'text' });
    expect(presetsFor('results', 'home').map(p => p.key)).toEqual(['latest-result']);
    expect(presetsFor('standings', 'latest').map(p => p.key)).toEqual(['what-it-changed']);
    expect(presetsFor('standings', 'wec').map(p => p.key)).not.toContain('what-it-changed');
    const latest = findPreset('latest-result')!;
    const at = (round: number, race: string, date: string | null, position: number, cls: string | null = null) => ({ round, race, raceId: null, date, position, driver: `${race} P${position}`, class: cls, session: 'race' });
    const mixed = [
      at(17, 'Azerbaijan Grand Prix', '2026-09-20T13:00:00.000Z', 2),
      at(17, 'Azerbaijan Grand Prix', '2026-09-20T13:00:00.000Z', 1),
      at(17, 'Azerbaijan Grand Prix', '2026-09-20T13:00:00.000Z', 3),
      at(6, '6 Hours of Fuji', '2026-09-27T06:00:00.000Z', 1, 'Hypercar'),
      at(6, '6 Hours of Fuji', '2026-09-27T06:00:00.000Z', 1, 'LMGT3'),
      at(6, '6 Hours of Fuji', '2026-09-27T06:00:00.000Z', 2, 'Hypercar'),
      at(5, 'Undated race', null, 1),
    ];
    // The newest race by date, its first class alone, by position, cut to the count.
    expect(presetRows(mixed, latest, 3).map(r => `${r.class} P${r.position}`)).toEqual(['Hypercar P1', 'Hypercar P2']);
    expect(presetRows(mixed, latest, 1).map(r => r.driver)).toEqual(['6 Hours of Fuji P1']);
    expect(presetRows(mixed.slice(0, 3), latest, 3).map(r => r.driver)).toEqual(['Azerbaijan Grand Prix P1', 'Azerbaijan Grand Prix P2', 'Azerbaijan Grand Prix P3']);
    expect(presetRows(mixed.slice(0, 3), latest, 2).map(r => r.position)).toEqual([1, 2]);
    // A tie on the date keeps the first race in row order (Home's series order); a race without a date is never the newest.
    expect(presetRows([at(8, 'Monza Feature', '2026-09-20T13:00:00.000Z', 1), ...mixed.slice(0, 3)], latest, 3).map(r => r.driver)).toEqual(['Monza Feature P1']);
    expect(presetRows([at(5, 'Undated race', null, 1)], latest, 3)).toEqual([]);
    // What it changed: the driver rows by position, the count of rows.
    const table = [
      { kind: 'constructor', position: 1, name: 'Mercedes', points: 500 },
      { kind: 'driver', position: 2, name: 'Russell', points: 280 },
      { kind: 'driver', position: 1, name: 'Antonelli', points: 300 },
      { kind: 'driver', position: 3, name: 'Leclerc', points: 260 },
    ];
    expect(presetRows(table, findPreset('what-it-changed')!, 2).map(r => r.name)).toEqual(['Antonelli', 'Russell']);
  });

  it('imports nothing at runtime: the catalogue reaches every route’s chunk through the parser, so it stays declarations', () => {
    const src = readFileSync(new URL('./presets.ts', import.meta.url), 'utf8');
    for (const m of src.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)'/gm)) expect(m[1], `${m[2]} is imported at runtime`).toBe('type ');
  });
});

describe('presetRows with a reader’s state (P2.3)', () => {
  const drivers = findPreset('drivers')!;
  const row = (position: number, name: string, team: string | null, points: number | null, wins: number) => ({ kind: 'driver', position, name, team, points, wins, class: null });
  const ROWS = [row(3, 'Norris', 'McLaren', 180, 2), row(1, 'Antonelli', 'Mercedes', 267, 7), row(2, 'Russell', 'Mercedes', 201, 2), row(4, 'Leclerc', null, null, 0)];
  const state = (over: Partial<ViewState>): ViewState => ({ filters: [], ...over });

  it('filters by the column’s type (eq, ne and in on text, case-insensitive; the comparisons on numbers), sorts by the column as its type orders (nulls last, a tie in the preset’s own order), then counts; an empty state is today’s rows', () => {
    expect(presetRows(ROWS, drivers, 10, state({ filters: [{ column: 'team', op: 'eq', value: 'mercedes' }] })).map(r => r.name)).toEqual(['Antonelli', 'Russell']);
    expect(presetRows(ROWS, drivers, 10, state({ filters: [{ column: 'team', op: 'ne', value: 'Mercedes' }] })).map(r => r.name)).toEqual(['Norris', 'Leclerc']);
    expect(presetRows(ROWS, drivers, 10, state({ filters: [{ column: 'name', op: 'in', value: 'Norris, Leclerc' }] })).map(r => r.name)).toEqual(['Norris', 'Leclerc']);
    expect(presetRows(ROWS, drivers, 10, state({ filters: [{ column: 'points', op: 'gte', value: '201' }] })).map(r => r.name)).toEqual(['Antonelli', 'Russell']);
    expect(presetRows(ROWS, drivers, 10, state({ filters: [{ column: 'points', op: 'lt', value: '201' }] })).map(r => r.name)).toEqual(['Norris']);
    expect(presetRows(ROWS, drivers, 10, state({ filters: [{ column: 'wins', op: 'gt', value: '1' }, { column: 'team', op: 'eq', value: 'McLaren' }] })).map(r => r.name)).toEqual(['Norris']);
    expect(presetRows(ROWS, drivers, 10, state({ sort: { column: 'points', desc: false } })).map(r => r.name)).toEqual(['Norris', 'Russell', 'Antonelli', 'Leclerc']);
    expect(presetRows(ROWS, drivers, 10, state({ sort: { column: 'points', desc: true } })).map(r => r.name)).toEqual(['Antonelli', 'Russell', 'Norris', 'Leclerc']);
    expect(presetRows(ROWS, drivers, 10, state({ sort: { column: 'name', desc: false } })).map(r => r.name)).toEqual(['Antonelli', 'Leclerc', 'Norris', 'Russell']);
    // Two wins each: Russell (P2) before Norris (P3), the preset's order.
    expect(presetRows(ROWS, drivers, 10, state({ sort: { column: 'wins', desc: true } })).map(r => r.name)).toEqual(['Antonelli', 'Russell', 'Norris', 'Leclerc']);
    expect(presetRows(ROWS, drivers, 2, state({ sort: { column: 'points', desc: false } })).map(r => r.name)).toEqual(['Norris', 'Russell']);
    expect(presetRows(ROWS, drivers, 10, state({}))).toEqual(presetRows(ROWS, drivers, 10));
  });

  it('a results shape under a reader’s sort lists its rows flat, the count counting rows; a filter alone keeps the races whole and the count counting races', () => {
    const at = (round: number, race: string, position: number, points: number) => ({ round, race, raceId: null, position, driver: `${race} P${position}`, session: 'race', points, class: null, date: `2026-0${round}-10` });
    const rows = [at(1, 'Australia', 1, 25), at(1, 'Australia', 2, 18), at(2, 'China', 1, 25), at(2, 'China', 2, 18), at(2, 'China', 3, 15)];
    const season = findPreset('season-results')!;
    // Twenty-five points twice: the newer round first, the preset's order.
    expect(presetRows(rows, season, 2, state({ sort: { column: 'points', desc: true } })).map(r => r.driver)).toEqual(['China P1', 'Australia P1']);
    expect(presetRows(rows, season, 10, state({ sort: { column: 'position', desc: false } })).map(r => r.driver)).toEqual(['China P1', 'Australia P1', 'China P2', 'Australia P2', 'China P3']);
    expect(presetRows(rows, season, 10, state({ filters: [{ column: 'position', op: 'eq', value: '1' }] })).map(r => r.driver)).toEqual(['China P1', 'Australia P1']);
    expect(presetRows(rows, season, 1, state({ filters: [{ column: 'round', op: 'eq', value: '1' }] })).map(r => r.driver)).toEqual(['Australia P1', 'Australia P2']);
  });
});

describe('rowPasses (P2.4): a row against one condition, as the column’s type reads it', () => {
  it('numbers as numbers, text case-insensitively, in over a list; a missing cell passes ne alone', () => {
    const columns = SHAPES['driver-rows'].columns;
    const row = { position: 2, name: 'George Russell', team: 'Mercedes', points: 201, wins: null };
    expect(rowPasses(row, { column: 'position', op: 'lte', value: '3' }, columns)).toBe(true);
    expect(rowPasses(row, { column: 'position', op: 'eq', value: '1' }, columns)).toBe(false);
    expect(rowPasses(row, { column: 'team', op: 'eq', value: 'mercedes' }, columns)).toBe(true);
    expect(rowPasses(row, { column: 'name', op: 'in', value: 'Norris, George Russell' }, columns)).toBe(true);
    expect(rowPasses(row, { column: 'wins', op: 'gte', value: '1' }, columns)).toBe(false);
    expect(rowPasses(row, { column: 'wins', op: 'ne', value: '1' }, columns)).toBe(true);
  });
});
