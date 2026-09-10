// Stop: when source files changed since the last gate run, run tsc and the
// tests touched by the change before the turn may end; block with the failing
// line otherwise. A marker file records the last checked change set so the gates
// run once per change set, not on every turn. Rule 6 of the executive rules.
// Claude Code gives up blocking after 8 consecutive blocks by design.
import { readInput, blockStop } from './lib.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';

const input = readInput();
const cwd = input.cwd ?? process.cwd();
const run = (cmd, timeout = 600000) => execSync(cmd, { cwd, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
const marker = `${cwd}/.claude/.gates-checked`;

let changed = [];
try {
  changed = run('git status --porcelain').split(/\r?\n/).filter(Boolean).map(l => l.slice(3)).filter(f => /\.(ts|tsx|mts|json)$/.test(f) && !/^docs\//.test(f));
} catch { process.exit(0); } // not a git tree: nothing to gate
if (changed.length === 0) process.exit(0);
// The change set's fingerprint: the changed files' names and contents. (`git
// write-tree` would hash the index, which unstaged edits never touch.)
const tree = crypto.createHash('sha256').update(changed.map(f => { try { return f + ' ' + fs.readFileSync(`${cwd}/${f}`, 'utf8'); } catch { return f + ' (deleted)'; } }).join(' ')).digest('hex');
try { if (fs.readFileSync(marker, 'utf8').trim() === tree) process.exit(0); } catch { /* no marker yet */ }

const failures = [];
try { run('npx tsc --noEmit -p tsconfig.json'); } catch (e) { failures.push('tsc: ' + String(e.stdout || e.message).split(/\r?\n/).find(l => /error TS/.test(l))); }
const tests = changed.filter(f => /\.test\.(ts|tsx)$/.test(f));
const sources = changed.filter(f => !/\.test\./.test(f)).map(f => f.replace(/\.(ts|tsx)$/, ''));
const related = [...new Set([...tests, ...sources.map(s => `${s}.test.ts`), ...sources.map(s => `${s}.test.tsx`)])].filter(f => fs.existsSync(`${cwd}/${f}`));
if (related.length) {
  try { run(`npx vitest run ${related.map(f => JSON.stringify(f)).join(' ')}`); } catch (e) { failures.push('vitest: ' + String(e.stdout || e.message).split(/\r?\n/).find(l => /FAIL|×|failed/.test(l))); }
}
if (failures.length) blockStop(`Gates failed before the turn may end:\n${failures.join('\n')}\nFix, or say UNVERIFIED and why.`);
fs.mkdirSync(`${cwd}/.claude`, { recursive: true });
fs.writeFileSync(marker, tree);
process.exit(0);
