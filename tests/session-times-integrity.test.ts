import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// One circuit has one track, so two cars-on-track sessions cannot run at the
// same instant at the same venue. That is the only invariant here, and it is
// here because it caught a real bug that a read-through did not: the 2026 Monza
// data had F2 Practice and F3 Qualifying Group A starting at the same moment,
// which is not merely wrong but impossible. The same collision existed at
// Barcelona, the Red Bull Ring, Silverstone, Spa and Madrid.
//
// It pools EVERY series rather than checking each one alone, because the Monza
// collision was between two series and a per-series check cannot see it.
//
// WHAT THIS DOES NOT CATCH, stated so a green run is never misread as proof the
// schedule is right: an hour-shifted session that collides with nothing. That
// was the original Monza F1 bug, and only comparison against the official
// timetable finds it. `npm run sessions:audit` does that comparison against the
// upstream feed; the human check against the official timetable remains.
//
// A round-window invariant was also tried and deliberately abandoned. It failed
// on Le Mans, the Indy 500 and the Spa 24 Hours, all of which are correct:
// rounds.json describes RACE days, and those events legitimately run practice
// and qualifying across the preceding week. No slack setting both admits Le Mans
// and catches a session filed one day early, so it punished correct data without
// catching the bug it was written for.

const SERIES_ROOT = path.join(process.cwd(), 'content', 'series');

interface OverrideSession {
  title: string;
  start: string;
  end?: string;
  location?: string;
  dateOnly?: boolean;
}

// Paddock and ceremonial activity is not exclusive use of the track, and much of
// it deliberately runs concurrently: scrutineering happens alongside
// administrative checks, and the grid is opened while the grid is forming.
const NOT_ON_TRACK =
  /administrative check|scrutineer|pit walk|track walk|grid formation|open grid|autograph|press conference|driver.?s? parade|podium|paddock|briefing|photo/i;

function seriesWithSessions(): string[] {
  return readdirSync(SERIES_ROOT).filter((slug) =>
    existsSync(path.join(SERIES_ROOT, slug, 'sessions.json')),
  );
}

const SERIES = seriesWithSessions();

it('has series to check', () => {
  expect(SERIES.length).toBeGreaterThan(10);
});

describe('one venue, one track', () => {
  it('no two on-track sessions share a venue and an instant', () => {
    const byVenue = new Map<string, { label: string; from: number; to: number }[]>();

    for (const slug of SERIES) {
      const raw = readFileSync(path.join(SERIES_ROOT, slug, 'sessions.json'), 'utf8');
      const { overrides = [] } = JSON.parse(raw) as {
        overrides?: { sessions?: OverrideSession[] }[];
      };

      for (const block of overrides) {
        for (const s of block.sessions ?? []) {
          const venue = (s.location ?? '').trim();
          // No venue: nothing to pool it against.
          // dateOnly: the hour is not known, so it cannot contradict anything.
          if (!venue || !s.start || !s.end || s.dateOnly) continue;
          if (NOT_ON_TRACK.test(s.title)) continue;

          const from = Date.parse(s.start);
          const to = Date.parse(s.end);
          if (Number.isNaN(from) || Number.isNaN(to)) continue;

          const list = byVenue.get(venue) ?? [];
          list.push({ label: `${slug}: ${s.title} (${s.start})`, from, to });
          byVenue.set(venue, list);
        }
      }
    }

    const clashes: string[] = [];
    for (const [venue, list] of byVenue) {
      list.sort((a, b) => a.from - b.from);
      for (let i = 0; i < list.length - 1; i++) {
        // Touching is legal: one session may end exactly as the next begins.
        // Strictly greater is the overlap.
        if (list[i].to > list[i + 1].from) {
          clashes.push(`${venue}\n    ${list[i].label}\n    overlaps ${list[i + 1].label}`);
        }
      }
    }

    expect(clashes.join('\n  ')).toBe('');
  });

  it('is actually looking at something', () => {
    // A filter bug that excluded everything would make the test above pass
    // vacuously, which is the failure mode this whole file exists to prevent.
    const venues = new Set<string>();
    let pooled = 0;
    for (const slug of SERIES) {
      const raw = readFileSync(path.join(SERIES_ROOT, slug, 'sessions.json'), 'utf8');
      const { overrides = [] } = JSON.parse(raw) as {
        overrides?: { sessions?: OverrideSession[] }[];
      };
      for (const block of overrides) {
        for (const s of block.sessions ?? []) {
          if (!s.location || !s.end || s.dateOnly || NOT_ON_TRACK.test(s.title)) continue;
          venues.add(s.location);
          pooled++;
        }
      }
    }
    expect(pooled).toBeGreaterThan(500);
    expect(venues.size).toBeGreaterThan(50);
  });
});
