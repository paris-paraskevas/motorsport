import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_BACKGROUND, MAP_BACKGROUNDS, fillKey, findMapBackground, tilesFor } from './map-backgrounds';

// Map Backgrounds (P2.12; APEX: Shared Components › Map Backgrounds): the named
// basemaps a Map region draws its tiles from, declared in code (rule 10: a key
// is named, never stored in a row), each a light set and a dark set for the
// theme's family.

describe('Map Backgrounds (P2.12)', () => {
  it('declares one named background, Canvas: Esri’s light and dark grey sets with their attribution and the zoom ceiling, no key; the dark set for the dark family; a key filled from the environment by its name', () => {
    expect(MAP_BACKGROUNDS.map(b => b.key)).toEqual(['canvas']);
    expect(DEFAULT_MAP_BACKGROUND).toBe('canvas');
    const canvas = findMapBackground('canvas')!;
    expect(canvas).toMatchObject({ name: 'Canvas', keyVar: null });
    expect(canvas.holds.length).toBeGreaterThan(0);
    for (const set of [canvas.light, canvas.dark!]) {
      expect(set.url).toMatch(/^https:\/\/server\.arcgisonline\.com\/.*\{z\}.*\{y\}.*\{x\}$/);
      expect(set.attribution).toContain('Esri');
      expect(set.attribution).toContain('OpenStreetMap');
      expect(set.maxZoom).toBe(16);
    }
    expect(canvas.light.url).toContain('World_Light_Gray_Base');
    expect(canvas.dark!.url).toContain('World_Dark_Gray_Base');
    expect(tilesFor(canvas, 'dark')).toBe(canvas.dark);
    expect(tilesFor(canvas, 'light')).toBe(canvas.light);
    expect(tilesFor({ ...canvas, dark: null }, 'dark')).toBe(canvas.light);
    expect(findMapBackground('nope')).toBeNull();
    // A keyed provider (none today): the variable's value goes where {key} stands, nothing else is touched; a missing variable leaves it empty.
    expect(fillKey('https://tiles.example/{z}/{x}/{y}?key={key}', { TILES_KEY: 'abc' }, 'TILES_KEY')).toBe('https://tiles.example/{z}/{x}/{y}?key=abc');
    expect(fillKey('https://tiles.example/{z}/{x}/{y}?key={key}', {}, 'TILES_KEY')).toBe('https://tiles.example/{z}/{x}/{y}?key=');
    expect(fillKey(canvas.light.url, { TILES_KEY: 'abc' }, null)).toBe(canvas.light.url);
  });

  it('imports nothing at runtime: the declarations travel with every route’s chunk through the parser (the sources’ rule)', () => {
    const source = readFileSync(path.join(process.cwd(), 'lib', 'design', 'map-backgrounds.ts'), 'utf8');
    expect(source.match(/^import (?!type )/gm)).toBeNull();
  });
});
