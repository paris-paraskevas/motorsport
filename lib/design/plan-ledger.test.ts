import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CODE_PAGES } from './page-registry';

// THE PLAN-LEDGER TEST (the executive rules, groups 1, 5 and 9). docs/plan/ledger.json
// is the single record of the components programme: a page may be served from rows
// only once a done slot lists it, a slot's scope changes only on purpose (its hash is
// rewritten by `node docs/plan/render-ledger.mjs --rehash` beside a dated changes
// line), and the rendered Markdown must be current. The P0 slots predate the ledger
// and are exempt from the decision-scan fields.

const PLAN = path.join(process.cwd(), 'docs', 'plan');

type Slot = {
  id: string;
  phase: string;
  title: string;
  scope: string;
  fixedBy: string;
  acceptance: string;
  status: 'planned' | 'started' | 'done';
  evidence?: string;
  defaults?: string;
  needsWord?: string;
  pages?: string[];
  scopeHash: string;
};
type Ledger = {
  title: string;
  preamble: string;
  rules: string[];
  changes: { date: string; change: string; word: string }[];
  phases: Record<string, { title: string; note?: string }>;
  slots: Slot[];
};

const ledger: Ledger = JSON.parse(fs.readFileSync(path.join(PLAN, 'ledger.json'), 'utf8'));
const rendered = fs.readFileSync(path.join(PLAN, 'components-programme.md'), 'utf8');
const STATUSES = new Set(['planned', 'started', 'done']);
const filled = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
/** The first 12 hex characters of the SHA-256 of the scope text, as render-ledger.mjs writes it. */
const scopeHash = (scope: string) => crypto.createHash('sha256').update(scope).digest('hex').slice(0, 12);

describe('the plan ledger', () => {
  it('is well formed: unique ids, known phases and statuses, the fields every slot needs', () => {
    expect(ledger.slots.length).toBeGreaterThan(0);
    expect(new Set(ledger.slots.map(s => s.id)).size).toBe(ledger.slots.length);
    for (const s of ledger.slots) {
      expect(Object.keys(ledger.phases), `${s.id}: unknown phase ${s.phase}`).toContain(s.phase);
      expect(STATUSES.has(s.status), `${s.id}: unknown status ${s.status}`).toBe(true);
      for (const k of ['title', 'scope', 'fixedBy', 'acceptance'] as const) expect(filled(s[k]), `${s.id}: ${k} is empty`).toBe(true);
    }
  });

  it('a slot past planned carries its decision scan; a done slot carries its evidence', () => {
    for (const s of ledger.slots) {
      if (s.status !== 'planned' && s.phase !== 'P0') {
        expect('defaults' in s, `${s.id}: Defaults I take is not recorded`).toBe(true);
        expect('needsWord' in s, `${s.id}: Needs your word is not recorded`).toBe(true);
      }
      if (s.status === 'done') expect(filled(s.evidence), `${s.id}: done without evidence`).toBe(true);
    }
  });

  it('every scope matches its hash, so a scope changes only on purpose', () => {
    for (const s of ledger.slots) {
      expect(s.scopeHash, `${s.id}: scope changed; add a dated changes line, then run node docs/plan/render-ledger.mjs --rehash`).toBe(scopeHash(s.scope));
    }
  });

  it('a page served from rows has a done slot that lists it, and no slot claims a page the code still serves', () => {
    const served = CODE_PAGES.filter(p => p.served === 'rows').map(p => p.path);
    const listed = ledger.slots.filter(s => s.status === 'done').flatMap(s => s.pages ?? []);
    const listedSet = new Set(listed);
    const servedSet = new Set(served);
    expect(served.filter(p => !listedSet.has(p)), 'served from rows without a done slot').toEqual([]);
    expect(listed.filter(p => !servedSet.has(p)), 'a slot lists a page the registry does not serve from rows').toEqual([]);
  });

  it('every change to the plan is dated and carries the word', () => {
    expect(ledger.changes.length).toBeGreaterThan(0);
    for (const c of ledger.changes) {
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(filled(c.change)).toBe(true);
      expect(filled(c.word)).toBe(true);
    }
  });

  it('the rendered Markdown is current: every slot and every change date appear in it', () => {
    for (const s of ledger.slots) expect(rendered, `${s.id} missing from components-programme.md; re-render`).toContain(`**${s.id}**`);
    for (const c of ledger.changes) expect(rendered).toContain(`| ${c.date} |`);
  });
});
