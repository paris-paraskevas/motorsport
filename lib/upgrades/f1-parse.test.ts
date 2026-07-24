import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseCarPresentation, normalizeReason } from './f1-parse';

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../tests/fixtures/f1-upgrades/${name}`, import.meta.url)), 'utf8');

const R9 = parseCarPresentation(fixture('r9-british.txt'));
const R10 = parseCarPresentation(fixture('r10-belgian.txt'));
const R11 = parseCarPresentation(fixture('r11-hungarian.txt'));

const counts = (p: ReturnType<typeof parseCarPresentation>) =>
  Object.fromEntries(p.teams.map(t => [t.team, t.items.length]));

describe('parseCarPresentation — metadata', () => {
  it('reads doc / date / gp from each header', () => {
    expect({ doc: R9.doc, date: R9.date, gp: R9.gp }).toEqual({ doc: 13, date: '2026-07-03', gp: 'British Grand Prix' });
    expect({ doc: R10.doc, date: R10.date, gp: R10.gp }).toEqual({ doc: 12, date: '2026-07-17', gp: 'Belgian Grand Prix' });
    expect({ doc: R11.doc, date: R11.date, gp: R11.gp }).toEqual({ doc: 9, date: '2026-07-24', gp: 'Hungarian Grand Prix' });
  });
});

describe('parseCarPresentation — R9 British (ground truth vs curated)', () => {
  it('teams with items + counts', () => {
    expect(counts(R9)).toEqual({
      McLaren: 2, 'Red Bull': 1, Ferrari: 1, Williams: 1, 'Racing Bulls': 2, Haas: 2,
    });
  });
  it('no-update teams', () => {
    expect(new Set(R9.noUpdateTeams)).toEqual(new Set(['Mercedes', 'Aston Martin', 'Audi', 'Alpine', 'Cadillac']));
  });
  it('components match the FIA doc', () => {
    const by = Object.fromEntries(R9.teams.map(t => [t.team, t.items.map(i => i.component)]));
    expect(by['McLaren']).toEqual(['Front Corner', 'Floor Furniture']);
    expect(by['Racing Bulls']).toEqual(['Floor Edge & Diffuser', 'Rear Corner']);
    expect(by['Haas']).toEqual(['Rear Wing', 'Rear Wing Endplate']);
  });
});

describe('parseCarPresentation — R10 Belgian', () => {
  it('teams with items + counts', () => {
    expect(counts(R10)).toEqual({
      McLaren: 2, Mercedes: 3, 'Red Bull': 1, Williams: 3, 'Racing Bulls': 4, Haas: 4, Audi: 2, Alpine: 1, Cadillac: 1,
    });
  });
  it('no-update teams', () => {
    expect(new Set(R10.noUpdateTeams)).toEqual(new Set(['Ferrari', 'Aston Martin']));
  });
});

describe('parseCarPresentation — R11 Hungarian (incl. the 16-part Aston B-spec)', () => {
  it('teams with items + counts', () => {
    expect(counts(R11)).toEqual({
      McLaren: 5, Mercedes: 3, 'Red Bull': 3, Ferrari: 2, Williams: 2, 'Racing Bulls': 3,
      'Aston Martin': 16, Haas: 1, Audi: 1, Cadillac: 1,
    });
  });
  it('Alpine submitted no updates', () => {
    expect(R11.noUpdateTeams).toContain('Alpine');
  });
});

// The cron's confidence gate: a clean parse ships automatically; anything the
// parser can't cleanly resolve is FLAGGED, never emitted as silent garbage.
const CLASS_RE = /^(Performance|Circuit specific|Cooling Range|Reliability|Structural Improvement|Balance Range|Correlation)/;

describe('parseCarPresentation — safety contract (clean-or-flagged, never silent)', () => {
  it('every parsed item always has a non-empty component', () => {
    for (const p of [R9, R10, R11])
      for (const t of p.teams) for (const it of t.items) expect(it.component, `${t.team} item`).toBeTruthy();
  });
  it('standard layouts (R9, R10) resolve every reason to a recognised class', () => {
    for (const p of [R9, R10])
      for (const t of p.teams)
        for (const it of t.items) expect(it.reason, `${t.team} "${it.component}"`).toMatch(CLASS_RE);
  });
  it('R9 (the clean reference doc) parses with zero warnings', () => {
    expect(R9.warnings).toEqual([]);
  });
  it('any item whose reason cannot be resolved is flagged in warnings', () => {
    // R11's Ferrari + Aston tables are severely interleaved/single-spaced —
    // the gate must catch them so the cron alerts instead of publishing junk.
    for (const p of [R9, R10, R11]) {
      const unresolved = p.teams.flatMap(t => t.items.filter(i => !CLASS_RE.test(i.reason)).map(i => i.component));
      for (const component of unresolved)
        expect(p.warnings.some(w => w.includes(component)), `flagged: ${component}`).toBe(true);
    }
  });
});

describe('normalizeReason', () => {
  it('normalises separators, class casing, and subreason casing', () => {
    expect(normalizeReason('Performance - Flow Conditioning')).toBe('Performance — Flow Conditioning');
    expect(normalizeReason('Circuit Specific � Drag Reduction')).toBe('Circuit specific — Drag Reduction');
    expect(normalizeReason('Performance - Local load')).toBe('Performance — Local Load');
    expect(normalizeReason('Cooling Range')).toBe('Cooling Range');
  });
});
