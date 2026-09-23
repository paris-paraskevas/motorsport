import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PRESETS, PRESET_GROUPS, SHAPES, findPreset, presetRows, presetsFor } from './presets';
import { SERIES_OPTIONS } from './sources';

// The preset catalogue (P2.2): the fifteen groups as the operator saw them
// drawn, every class heading its own preset, presets that share their columns
// one shape with a label of their own (the word of 2026-09-18); the seven
// results presets declared and waiting for the Rounds view (PR B).

describe('the preset catalogue', () => {
  it('holds the seventeen groups in the drawn order and thirty-five presets: twenty-six standings over two shapes, seven results over three, drawn as the Rounds layout by default (P2.2 B1), and Home’s two boxes over posts and news (P2.24 A)', () => {
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
    ]);
    expect(PRESETS).toHaveLength(35);
    const standings = PRESETS.filter(p => p.source === 'standings');
    expect(standings).toHaveLength(26);
    expect(new Set(standings.map(p => p.shape))).toEqual(new Set(['driver-rows', 'team-rows']));
    const results = PRESETS.filter(p => p.source === 'results');
    expect(results).toHaveLength(7);
    expect(PRESETS.filter(p => p.source === 'posts').map(p => p.key)).toEqual(['lead-story']);
    expect(PRESETS.filter(p => p.source === 'news').map(p => p.key)).toEqual(['wire']);
    for (const p of PRESETS) expect(Object.keys(p), p.key).not.toContain('later');
    for (const p of results) expect(p.view, p.key).toBe('list');
    for (const p of standings) expect(p.view, p.key).toBe('table');
    expect(results.map(p => [p.key, p.shape, p.where])).toEqual([
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
    expect(new Set(PRESETS.map(p => p.key)).size).toBe(35);
    const groups = new Set(PRESET_GROUPS.map(g => g.key));
    const slugs = new Set(SERIES_OPTIONS.map(o => o.key));
    for (const p of PRESETS) {
      expect(groups.has(p.group), p.key).toBe(true);
      expect(SHAPES[p.shape], p.key).toBeDefined();
      expect(SHAPES[p.shape].source, p.key).toBe(p.source);
      expect(p.series.length, p.key).toBeGreaterThan(0);
      for (const s of p.series) expect(slugs.has(s), `${p.key}: ${s}`).toBe(true);
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
    expect(presetsFor('standings', 'f1').map(p => p.key)).toEqual(['drivers', 'constructors']);
    expect(presetsFor('standings', 'motogp').map(p => p.key)).toEqual(['drivers']);
    expect(presetsFor('standings', 'wrc').map(p => p.key)).toEqual(['drivers', 'manufacturers', 'co-drivers']);
    expect(presetsFor('standings', 'dtm').map(p => p.key)).toEqual(['drivers', 'teams']);
    expect(presetsFor('standings', 'wec').map(p => p.key)).toEqual(['wec-hypercar-drivers', 'wec-hypercar-manufacturers', 'wec-lmgt3-drivers', 'wec-lmgt3-teams']);
    expect(presetsFor('standings', 'imsa')).toHaveLength(11);
    expect(presetsFor('results', 'f2').map(p => p.key)).toEqual(['feature-races', 'sprint-races']);
    expect(presetsFor('results', 'f1').map(p => p.key)).toEqual(['season-results']);
    expect(presetsFor('results', 'wec').map(p => p.key)).toEqual(['season-results-wec']);
    expect(presetsFor('standings', 'nls')).toEqual([]);
    expect(presetsFor('results', 'nls').map(p => p.key)).toEqual(['overall-winners']);
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
    expect(PRESET_GROUPS.slice(-2)).toEqual([
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

  it('imports nothing at runtime: the catalogue reaches every route’s chunk through the parser, so it stays declarations', () => {
    const src = readFileSync(new URL('./presets.ts', import.meta.url), 'utf8');
    for (const m of src.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)'/gm)) expect(m[1], `${m[2]} is imported at runtime`).toBe('type ');
  });
});
