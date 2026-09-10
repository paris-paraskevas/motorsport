// Shared helpers for the hook scripts. Node only (no jq): read the hook's JSON
// from stdin, deny a PreToolUse call with the documented JSON shape, block a
// Stop with exit 2 and a reason on stderr. See code.claude.com/docs/en/hooks.
import fs from 'node:fs';

export function readInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** PreToolUse: deny the call. Prints the decision JSON and exits 2. */
export function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }) + '\n');
  process.exit(2);
}

/** PreToolUse: no decision; the normal permission flow applies. */
export function allow() {
  process.exit(0);
}

/** Stop: block the turn from ending; the reason reaches Claude. */
export function blockStop(reason) {
  process.stderr.write(reason + '\n');
  process.exit(2);
}

/** SessionStart / PreCompact: add context for Claude without blocking. */
export function addContext(eventName, text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: eventName, additionalContext: text } }) + '\n');
  process.exit(0);
}

/** The night flag: a file the operator or the runner creates for unattended hours. */
export function nightMode(cwd) {
  try { return fs.existsSync(`${cwd}/.claude/night-mode`); } catch { return false; }
}
