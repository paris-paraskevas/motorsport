import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LATER_ROUNDS, PRESETS, PRESET_GROUPS, SHAPES, findPreset, presetRows, presetsFor } from './presets';
import { SERIES_OPTIONS } from './sources';

// The preset catalogue (P2.2): the fifteen groups as the operator saw them
// drawn, every class heading its own preset, presets that share their columns
// one shape with a label of their own (the word of 2026-09-18); the seven
// results presets declared and waiting for the Rounds view (PR B).

describe('the preset catalogue', () => {
  it('holds the fifteen groups in the drawn order and thirty-three presets: twenty-six standings over two shapes, seven results that wait for the Rounds view', () => {
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
    ]);
    expect(PRESETS).toHaveLength(33);
    const standings = PRESETS.filter(p => p.source === 'standings');
    expect(standings).toHaveLength(26);
    expect(new Set(standings.map(p => p.shape))).toEqual(new Set(['driver-rows', 'team-rows']));
    const results = PRESETS.filter(p => p.source === 'results');
    expect(results).toHaveLength(7);
    for (const p of results) expect(p.later, p.key).toBe(LATER_ROUNDS);
    for (const p of standings) expect(p.later, p.key).toBeUndefined();
    expect(new Set(PRESETS.map(p => p.key)).size).toBe(33);
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
    expect(findPreset('overall-winners')).toMatchObject({ source: 'results', series: ['nls'], later: LATER_ROUNDS });
    expect(findPreset('nope')).toBeNull();
  });

  it('offers the presets of a source and a series: F1 its Drivers and Constructors, MotoGP its Drivers, WRC its three, WEC its four classes, F2’s results its two (waiting), NLS no standings', () => {
    expect(presetsFor('standings', 'f1').map(p => p.key)).toEqual(['drivers', 'constructors']);
    expect(presetsFor('standings', 'motogp').map(p => p.key)).toEqual(['drivers']);
    expect(presetsFor('standings', 'wrc').map(p => p.key)).toEqual(['drivers', 'manufacturers', 'co-drivers']);
    expect(presetsFor('standings', 'dtm').map(p => p.key)).toEqual(['drivers', 'teams']);
    expect(presetsFor('standings', 'wec').map(p => p.key)).toEqual(['wec-hypercar-drivers', 'wec-hypercar-manufacturers', 'wec-lmgt3-drivers', 'wec-lmgt3-teams']);
    expect(presetsFor('standings', 'imsa')).toHaveLength(11);
    expect(presetsFor('results', 'f2').map(p => [p.key, p.later])).toEqual([
      ['feature-races', LATER_ROUNDS],
      ['sprint-races', LATER_ROUNDS],
    ]);
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

  it('imports nothing at runtime: the catalogue reaches every route’s chunk through the parser, so it stays declarations', () => {
    const src = readFileSync(new URL('./presets.ts', import.meta.url), 'utf8');
    for (const m of src.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)'/gm)) expect(m[1], `${m[2]} is imported at runtime`).toBe('type ');
  });
});
