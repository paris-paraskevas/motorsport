import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { serialise } from './upgrades-file';

// `npm run upgrades:draft` writes a new round into content/series/f1/upgrades.json
// and THE REVIEW IS THE GIT DIFF. That only works while serialise() re-emits the
// file in its own house style. The first version of the script used
// JSON.stringify(obj, null, 2): 70 lines became 255, _comment moved to the bottom
// (V8 orders integer-like keys first), and every existing round showed as
// changed. This round-trip is what stops that returning silently.
//
// If it fails, DO NOT relax it. Either the file's style changed deliberately, in
// which case serialise() follows it, or the serialiser drifted, in which case it
// is about to bury the next round in an unreviewable diff.
const FILE = path.join(process.cwd(), 'content', 'series', 'f1', 'upgrades.json');

// Compared with line endings normalised: git's autocrlf leaves CRLF in the
// working tree on Windows and LF in the repo, and the house style is about
// structure, not about which bytes end a line. The script writes back using
// whatever the file already used.
const lf = (s: string) => s.replace(/\r\n/g, '\n');

describe('upgrades.json house-style serialiser', () => {
  const raw = lf(readFileSync(FILE, 'utf8'));
  const data = JSON.parse(raw) as Record<string, unknown>;

  it('reproduces the committed file exactly', () => {
    expect(serialise(data)).toBe(raw);
  });

  it('keeps _comment first and the rounds ascending', () => {
    const keys = [...serialise(data).matchAll(/^ {2}"([^"]+)":/gm)].map(m => m[1]);
    expect(keys[0]).toBe('_comment');
    const rounds = keys.slice(1).map(Number);
    expect(rounds).toEqual([...rounds].sort((a, b) => a - b));
  });

  it('adding a round leaves every existing line untouched', () => {
    const next = String(
      Math.max(...Object.keys(data).filter(k => /^\d+$/.test(k)).map(Number)) + 1,
    );
    const out = serialise({
      ...data,
      [next]: {
        gp: 'Test Grand Prix',
        date: '2026-01-01',
        doc: 1,
        teams: [{ team: 'McLaren', items: [{ component: 'Rear Wing', reason: 'Performance', detail: 'x' }] }],
      },
    });
    // Everything up to the final round's closing brace is byte-identical, which
    // is the property that keeps the diff to just the new round's lines.
    const upToLastRound = raw.slice(0, raw.lastIndexOf('\n  }\n}\n'));
    expect(out.startsWith(upToLastRound)).toBe(true);
    expect(out).toContain(`  "${next}": {`);
  });
});
