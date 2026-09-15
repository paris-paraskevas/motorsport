import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let configured = true;
let result: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import {
  FACES,
  FACE_ROLES,
  SHIPPED_APPEARANCE,
  appearanceCss,
  appearanceWarnings,
  facesForRole,
  isShippedAppearance,
  loadAppearance,
  loadAppearanceForEditing,
  parseAppearance,
  resetAppearanceMemo,
  type Appearance,
} from './appearance';
import { SHIPPED_PRESETS } from './template-options';

const STAMP = '2026-09-08T15:30:00.505502+00:00';
const AIRY: Appearance = {
  faces: { sans: 'source-sans-3', serif: 'literata', mono: 'jetbrains-mono', condensed: 'roboto-condensed' },
  baseSize: 17,
  leading: 1.6,
  density: 0.3,
  radius: 0,
  motion: 'calm',
  templates: SHIPPED_PRESETS,
};

describe('parseAppearance', () => {
  it('an absent or empty document is exactly what shipped, with no problems', () => {
    for (const raw of [undefined, null, {}]) {
      expect(parseAppearance(raw)).toEqual({ value: SHIPPED_APPEARANCE, problems: [] });
    }
  });

  it('reads the template presets with the rest (P1.2): a known preset kept, an unusable one the shipped value with its problem named, and the style block untouched by them', () => {
    const roomy = parseAppearance({ templates: { standard: { spacing: 'SPACING_ROOMY' } } });
    expect(roomy.problems).toEqual([]);
    expect(roomy.value.templates.standard).toEqual({ ...SHIPPED_PRESETS.standard, spacing: 'SPACING_ROOMY' });
    expect(roomy.value.faces).toEqual(SHIPPED_APPEARANCE.faces);
    const bad = parseAppearance({ templates: { standard: { heading: 'HEADING_BIG' } } });
    expect(bad.value.templates).toEqual(SHIPPED_PRESETS);
    expect(bad.problems).toEqual(['Templates › Standard › Heading style: "HEADING_BIG" is not one of its options']);
    expect(isShippedAppearance(roomy.value)).toBe(true);
    expect(appearanceCss(roomy.value)).toBe('');
    // The parsed presets are a copy: a later edit of the value cannot reach the shipped constant.
    roomy.value.templates.standard.width = 'WIDTH_NARROW';
    expect(SHIPPED_PRESETS.standard.width).toBe('WIDTH_FULL');
  });

  it('keeps every usable key, falls back on the rest, and names each problem', () => {
    const { value, problems } = parseAppearance({
      faces: { sans: 'source-sans-3', mono: 'newsreader' },
      baseSize: 18,
      leading: 2.5,
      density: '0.30',
      radius: 'round',
      motion: 'fast',
    });
    expect(value.faces).toEqual({ ...SHIPPED_APPEARANCE.faces, sans: 'source-sans-3' });
    expect(value.baseSize).toBe(18);
    expect(value.leading).toBe(1.5);
    expect(value.density).toBe(0.3);
    expect(value.radius).toBe(8);
    expect(value.motion).toBe('normal');
    expect(problems).toHaveLength(4);
    expect(problems[0]).toMatch(/Data: Newsreader is not offered/);
    expect(problems[1]).toBe('Leading must be 1.3 to 1.8');
    expect(problems[2]).toBe('Corners must be a number');
    expect(problems[3]).toBe('Motion must be calm, normal or none');
  });

  it('refuses a face the catalogue does not know and a document that is not an object', () => {
    expect(parseAppearance({ faces: { serif: 'comic' } }).problems).toEqual(['Headlines: "comic" is not a face in the catalogue']);
    expect(parseAppearance([1]).problems).toEqual(['the document must be an object']);
    expect(parseAppearance({ faces: 'plex' }).problems).toEqual(['faces must be an object of role → face']);
    expect(parseAppearance({ baseSize: 13 }).problems).toEqual(['Base size must be 14 to 20 px']);
    expect(parseAppearance({ density: 0.36 }).problems).toEqual(['Density must be 0.2 to 0.35 rem']);
  });

  it("rounds a number to its key's decimals, so the stylesheet never carries float noise", () => {
    const { value } = parseAppearance({ density: 0.30000001, leading: 1.549, baseSize: 16.4, radius: 7.6 });
    expect(value.density).toBe(0.3);
    expect(value.leading).toBe(1.55);
    expect(value.baseSize).toBe(16);
    expect(value.radius).toBe(8);
  });
});

describe('the face catalogue', () => {
  it('has unique keys, three or more faces per role, and the shipped face in every role', () => {
    const keys = FACES.map(f => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const role of FACE_ROLES) {
      const offered = facesForRole(role);
      expect(offered.length, role).toBeGreaterThanOrEqual(3);
      expect(offered.map(f => f.key), role).toContain(SHIPPED_APPEARANCE.faces[role]);
    }
  });

  it('every variable it names is declared by lib/fonts.ts, and the alternatives are not preloaded', () => {
    const fonts = fs.readFileSync(path.join(process.cwd(), 'lib', 'fonts.ts'), 'utf8');
    for (const face of FACES) expect(fonts, face.key).toContain(`variable: '${face.variable}'`);
    // Plex Sans and Newsreader, the shipped body and headline faces, keep their
    // preloads (the hero paints in them); every other declaration carries
    // `preload: false`.
    expect(fonts.match(/^\s+preload: false,$/gm)?.length).toBe(FACES.length - 2);
  });

  it('warns, without refusing, when the body face carries no Greek', () => {
    expect(appearanceWarnings(SHIPPED_APPEARANCE)).toEqual([]);
    const serifBody = { ...SHIPPED_APPEARANCE, faces: { ...SHIPPED_APPEARANCE.faces, sans: 'newsreader' } };
    expect(parseAppearance(serifBody).problems).toEqual([]);
    expect(appearanceWarnings(serifBody)).toEqual(['Newsreader carries no Greek: Greek names in body text fall to a system face']);
  });
});

describe('appearanceCss', () => {
  it('is empty for the shipped appearance', () => {
    expect(isShippedAppearance(SHIPPED_APPEARANCE)).toBe(true);
    expect(appearanceCss(SHIPPED_APPEARANCE)).toBe('');
    expect(appearanceCss(parseAppearance({}).value)).toBe('');
  });

  it('emits one root rule: the four roles, the size, the leading, the spacing unit, the two radii and the three durations', () => {
    expect(appearanceCss(AIRY)).toBe(
      ':root{--face-sans:var(--font-source-sans-3);--face-serif:var(--font-literata);--face-mono:var(--font-jetbrains-mono);--face-condensed:var(--font-roboto-condensed);font-size:17px;line-height:1.6;--spacing:0.3rem;--radius:0px;--radius-card:0px;--duration-fast:288ms;--duration-base:448ms;--duration-slow:832ms}',
    );
  });

  it('a single changed value is enough for a block, and motion none zeroes the durations', () => {
    const bigger = { ...SHIPPED_APPEARANCE, baseSize: 18 };
    expect(isShippedAppearance(bigger)).toBe(false);
    expect(appearanceCss(bigger)).toContain('font-size:18px');
    expect(appearanceCss(bigger)).toContain('--face-sans:var(--font-plex-sans)');
    expect(appearanceCss({ ...SHIPPED_APPEARANCE, motion: 'none' })).toContain('--duration-fast:0ms;--duration-base:0ms;--duration-slow:0ms');
  });
});

describe('loadAppearance', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
    resetAppearanceMemo();
  });

  it('is the shipped appearance when the database is unconfigured, errors, or has no row', async () => {
    configured = false;
    expect(await loadAppearance()).toEqual(SHIPPED_APPEARANCE);
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadAppearance()).toEqual(SHIPPED_APPEARANCE);
    result = { data: [], error: null };
    expect(await loadAppearance()).toEqual(SHIPPED_APPEARANCE);
  });

  it('reads the row, keeps the answer for a minute, and forgets it on reset', async () => {
    result = { data: [{ ui: AIRY }], error: null };
    expect(await loadAppearance()).toEqual(AIRY);
    result = { data: [{ ui: {} }], error: null };
    expect(await loadAppearance()).toEqual(AIRY);
    resetAppearanceMemo();
    expect(await loadAppearance()).toEqual(SHIPPED_APPEARANCE);
  });

  it('a document with a bad value reads as the shipped value for that key alone', async () => {
    result = { data: [{ ui: { ...AIRY, baseSize: 40 } }], error: null };
    expect(await loadAppearance()).toEqual({ ...AIRY, baseSize: 16 });
  });
});

describe('loadAppearanceForEditing', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
  });

  it('is null when unconfigured or on an error, the shipped values with no stamp when there is no row', async () => {
    configured = false;
    expect(await loadAppearanceForEditing()).toBeNull();
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadAppearanceForEditing()).toBeNull();
    result = { data: [], error: null };
    expect(await loadAppearanceForEditing()).toEqual({ appearance: SHIPPED_APPEARANCE, updatedAt: null });
  });

  it('returns the parsed document with the stamp exactly as sent', async () => {
    result = { data: [{ ui: AIRY, updated_at: STAMP }], error: null };
    expect(await loadAppearanceForEditing()).toEqual({ appearance: AIRY, updatedAt: STAMP });
  });
});
