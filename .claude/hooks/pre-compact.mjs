// PreCompact: before the context is summarised, write a handoff draft with the
// facts a summary loses (branch, dirty files, last commits, the next slot) and
// remind Claude to preserve modified files and test commands. Rule 8.
import { readInput, addContext } from './lib.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const input = readInput();
const cwd = input.cwd ?? process.cwd();
const sh = cmd => { try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const stamp = new Date().toISOString();
const draft = [
  `# Handoff draft written by the pre-compaction hook at ${stamp}`,
  `Branch: ${sh('git branch --show-current')}`,
  'Modified files:', sh('git status --porcelain') || '(none)',
  'Last commits:', sh('git log --oneline -5'),
  'Re-read after compaction: the slot’s files, then git status, before any edit.',
].join('\n');
try {
  fs.mkdirSync(`${cwd}/.claude`, { recursive: true });
  fs.writeFileSync(`${cwd}/.claude/handoff-draft.md`, draft);
} catch { /* fail soft */ }
addContext('PreCompact', 'When compacting, preserve the full list of modified files, the test and gate commands, the current slot id and its decision scan, and every open question for the operator. A handoff draft was written to .claude/handoff-draft.md.');
