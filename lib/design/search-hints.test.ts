import { beforeEach, describe, expect, it, vi } from 'vitest';

let configured = true;
let result: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let reads = 0;
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: () => {
      reads += 1;
      const q = {
        select: () => q,
        eq: () => q,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import { loadSearchHints, loadSearchHintsForEditing, resetSearchHintsMemo, searchHintFromRow, searchHintProblem } from './search-hints';

const A = 'a1b2c3d4-0000-4000-8000-000000000001';
const B = 'a1b2c3d4-0000-4000-8000-000000000002';
const rows = [
  { id: B, question: 'Who leads the F1 standings?', seq: 20, leads_to: '/series/f1/standings', leads_title: 'Standings', updated_at: '2026-09-08T18:00:00+00:00' },
  { id: A, question: ' When is the next race? ', seq: 10, leads_to: '/calendar', leads_title: 'Calendar', updated_at: '2026-09-08T18:00:00+00:00' },
  { id: 'nope', question: 'x', seq: 0, updated_at: 'x' },
  { id: 'a1b2c3d4-0000-4000-8000-000000000003', question: '   ', seq: 30, updated_at: 'x' },
];

describe('searchHintProblem and searchHintFromRow', () => {
  it('refuses an empty or over-long question and coerces a row or refuses it', () => {
    expect(searchHintProblem('  ')).toBe('needs a question');
    expect(searchHintProblem('x'.repeat(121))).toBe('a question is at most 120 characters');
    expect(searchHintProblem('When is the next race?')).toBeNull();
    expect(searchHintFromRow(rows[1])).toEqual({ id: A, question: 'When is the next race?', seq: 10, leadsTo: '/calendar', leadsTitle: 'Calendar', updatedAt: '2026-09-08T18:00:00+00:00' });
    expect(searchHintFromRow(rows[2])).toBeNull();
    expect(searchHintFromRow(rows[3])).toBeNull();
    expect(searchHintFromRow(null)).toBeNull();
  });
});

describe('loadSearchHints', () => {
  beforeEach(() => {
    configured = true;
    reads = 0;
    result = { data: rows, error: null };
    resetSearchHintsMemo();
  });

  it('is empty when unconfigured or on an error, the questions in sequence order otherwise, memoised for a minute', async () => {
    configured = false;
    expect(await loadSearchHints()).toEqual([]);
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadSearchHints()).toEqual([]);
    result = { data: rows, error: null };
    expect(await loadSearchHints()).toEqual(['When is the next race?', 'Who leads the F1 standings?']);
    const before = reads;
    expect(await loadSearchHints()).toEqual(['When is the next race?', 'Who leads the F1 standings?']);
    expect(reads).toBe(before);
    resetSearchHintsMemo();
    await loadSearchHints();
    expect(reads).toBe(before + 1);
  });

  it('hands the editor every usable row with its stamp, null on failure', async () => {
    const hints = await loadSearchHintsForEditing();
    expect(hints?.map(h => h.id)).toEqual([A, B]);
    result = { data: null, error: { message: 'boom' } };
    expect(await loadSearchHintsForEditing()).toBeNull();
    configured = false;
    expect(await loadSearchHintsForEditing()).toBeNull();
  });
});
