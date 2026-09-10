// SessionStart: tell Claude the state of the programme before it reads anything
// else: the rules to re-read, the next undone slot from the ledger, the open
// questions, the branch and whether the working tree is clean. Rule 8.
import { readInput, addContext } from './lib.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const input = readInput();
const cwd = input.cwd ?? process.cwd();
const sh = cmd => { try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const lines = ['Session start (hook): re-read CLAUDE.md’s rules first, then the ledger.'];
lines.push(`Branch: ${sh('git branch --show-current') || 'unknown'} · working tree: ${sh('git status --porcelain') ? 'DIRTY' : 'clean'} · last commit: ${sh('git log --oneline -1')}`);
try {
  const L = JSON.parse(fs.readFileSync(`${cwd}/docs/plan/ledger.json`, 'utf8'));
  const next = L.slots.find(s => s.status !== 'done' && !s.needsWord) ?? null;
  const open = L.slots.filter(s => s.status !== 'done' && s.needsWord).map(s => `${s.id}: ${s.needsWord}`);
  lines.push(next ? `Next decision-free slot: ${next.id} ${next.title}.` : 'No decision-free slot is left; the next slot needs the operator’s word.');
  if (open.length) lines.push(`Open questions (${open.length}): ${open.slice(0, 5).join(' · ')}${open.length > 5 ? ' · …' : ''}`);
  if (fs.existsSync(`${cwd}/.claude/night-mode`)) lines.push('NIGHT MODE is on: decision-free slots only; no route deletions, migrations, installs or prod writes.');
} catch {
  lines.push('No ledger at docs/plan/ledger.json yet.');
}
addContext('SessionStart', lines.join('\n'));
