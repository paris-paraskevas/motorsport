// PreToolUse on Bash: never push to main (or master); pushes to a PR branch
// pass. Force pushes to main are denied twice over. The law in CLAUDE.md.
import { readInput, deny, allow } from './lib.mjs';

const input = readInput();
if (input.tool_name !== 'Bash') allow();
const cmd = String(input.tool_input?.command ?? '');
if (!/\bgit\s+push\b/.test(cmd)) allow();
// Explicit main/master refspecs, or a plain `git push` while on main is caught by the
// runner's branch check; here we deny the explicit forms.
if (/\bgit\s+push\b[^|;&]*\b(origin\s+)?(main|master)\b/.test(cmd)) deny('Law: never push to main; open a PR from a branch.');
if (/\bgit\s+push\b[^|;&]*--force(?!-with-lease)/.test(cmd)) deny('Law: no force push; use --force-with-lease on a PR branch only.');
allow();
