import { describe, expect, it } from 'vitest';
import { Collector, LEVEL_KEYS, LEVEL_NAMES, keyOfLevel, levelFromKey, levelFromParam, newCid } from './debug';

// The Debug helper (P1.9): APEX's levels read from the address and the toolbar,
// a collector that keeps what its level allows, times steps and logs each line
// with the correlation id first, and the id itself.

describe('the Debug helper (P1.9)', () => {
  it("reads APEX's levels from the address and the toolbar's names, and names them back", () => {
    expect(levelFromParam('YES')).toBe(4);
    expect(levelFromParam('level6')).toBe(6);
    expect(levelFromParam('LEVEL9')).toBe(9);
    expect(levelFromParam('no')).toBe(0);
    expect(levelFromParam(null)).toBe(0);
    expect(levelFromKey('app')).toBe(6);
    expect(levelFromKey('full')).toBe(9);
    expect(levelFromKey('x')).toBe(0);
    expect(levelFromKey(undefined)).toBe(0);
    expect(keyOfLevel(4)).toBe('info');
    expect(keyOfLevel(0)).toBeNull();
    expect(LEVEL_NAMES[LEVEL_KEYS.app]).toBe('App Trace');
  });

  it('keeps the entries its level allows, times steps, logs each line with the id first, and reports', async () => {
    let t = 1000;
    const lines: string[] = [];
    const d = new Collector('ab12cd34', 6, '/history/monza', () => t, l => lines.push(l));
    expect(d.on).toBe(true);
    d.note(4, 'resolve', 'the page');
    t += 5;
    d.note(9, 'refs', 'the keys');
    const out = await d.step(6, 'build', 'the build options', async () => {
      t += 12;
      return 'ok';
    });
    expect(out).toBe('ok');
    await expect(
      d.step(4, 'render', '2 components', async () => {
        t += 3;
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const r = d.report();
    expect(r.entries.map(e => `${e.phase}@${e.at}${e.ms !== undefined ? ` ${e.ms}ms` : ''}`)).toEqual(['resolve@0', 'build@17 12ms', 'render@20 3ms']);
    expect(r.entries[2].text).toBe('2 components failed: boom');
    expect(lines).toEqual(['[pd ab12cd34] resolve the page', '[pd ab12cd34] build the build options 12ms', '[pd ab12cd34] render 2 components failed: boom 3ms']);
    expect(r).toMatchObject({ cid: 'ab12cd34', level: 6, page: '/history/monza', totalMs: 20 });
    d.note(4, 'render:wire', 'The wire', { ms: 41.5, src: ['snapshot:news:aggregate:'], run: 'news:aggregate:3 · local' });
    expect(d.entries[3]).toEqual({ at: 20, level: 4, phase: 'render:wire', text: 'The wire', ms: 41.5, src: ['snapshot:news:aggregate:'], run: 'news:aggregate:3 · local' });
    const off = new Collector('x', 0, '/', () => t, l => lines.push(l));
    off.note(4, 'resolve', 'never');
    expect(off.entries).toEqual([]);
    expect(off.on).toBe(false);
    expect(lines).toHaveLength(4);
  });

  it('takes the correlation id from cf-ray, else eight hex characters', () => {
    expect(newCid('8a1b2c3d4e5f6a7b-ATH')).toBe('8a1b2c3d4e5f6a7b');
    expect(newCid(null)).toMatch(/^[0-9a-f]{8}$/);
    expect(newCid()).not.toBe(newCid());
  });
});
