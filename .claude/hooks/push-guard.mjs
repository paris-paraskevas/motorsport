// PreToolUse on Bash: never push to main (or master); pushes to a PR branch
// pass. Force pushes to main are denied twice over. Since 2026-10-08 (slot O4)
// only the operator merges next into main, once a day, and that merge is the
// only deploy: Claude opens pull requests into next and merges only there.
// The laws in CLAUDE.md.
import { spawnSync } from 'node:child_process';
import { readInput, deny, allow } from './lib.mjs';

const input = readInput();
if (input.tool_name !== 'Bash') allow();
const cmd = String(input.tool_input?.command ?? '');

// The gh checks read commands, not text: a heredoc's body (a commit message, a PR
// body, notes) is data unless it is fed to a shell, and a command counts only where
// a command can start (the line's start, or after ; & | or an opening bracket).
const intoShell = /\b(?:ba|z)?sh\s+(?:-s\s+)?<</.test(cmd);
const live = intoShell ? cmd : cmd.split(/<<-?\s*['"]?[A-Za-z_]\w*['"]?/)[0];
const at = '(?:^|[;&|(]\\s*|\\n\\s*)';
const create = live.match(new RegExp(`${at}gh\\s+pr\\s+create\\b([^|;&\\n]*)`));
if (create && !/(--base|-B)[=\s]+next\b/.test(create[1])) {
  deny('Law: pull requests target next (gh pr create --base next); only the operator merges next into main.');
}
if (new RegExp(`${at}gh\\s+api\\b[^|;&\\n]*\\/pulls\\/\\d+\\/merge\\b`).test(live)) deny('Law: merge through gh pr merge, into next only.');
const merge = live.match(new RegExp(`${at}gh\\s+pr\\s+merge\\b([^|;&\\n]*)`));
if (merge) {
  const num = (merge[1].match(/(?:^|\s)#?(\d+)(?=\s|$)/) || [])[1];
  if (!num) deny('Law: name the pull request number in gh pr merge, so its base can be checked.');
  // PUSH_GUARD_PR_BASE stands in for the lookup in the hook tests only.
  const base = process.env.PUSH_GUARD_PR_BASE
    ?? (spawnSync('gh', ['pr', 'view', num, '--json', 'baseRefName', '--jq', '.baseRefName'], { encoding: 'utf8' }).stdout ?? '').trim();
  if (base !== 'next') deny(`Law: #${num} targets ${base || 'an unknown branch'}; I merge only into next, and only the operator merges next into main.`);
}

if (!/\bgit\s+push\b/.test(cmd)) allow();
// Explicit main/master refspecs, or a plain `git push` while on main is caught by the
// runner's branch check; here we deny the explicit forms.
if (/\bgit\s+push\b[^|;&]*\b(origin\s+)?(main|master)\b/.test(cmd)) deny('Law: never push to main; open a PR from a branch.');
if (/\bgit\s+push\b[^|;&]*--force(?!-with-lease)/.test(cmd)) deny('Law: no force push; use --force-with-lease on a PR branch only.');
allow();
