// Unit tests for the hook scripts: synthetic stdin JSON in, exit code and
// stdout decision out. Run: node test.mjs (from this folder). No settings.json
// wiring is needed; nothing here touches the repo.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-'));
/** Runs a hook with the input on stdin; `env` overrides (or blanks, with '') variables of the test's own environment. */
const run = (script, input, env = {}) => {
  const r = spawnSync(process.execPath, [path.join(here, script)], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...env } });
  let decision = null;
  try { decision = JSON.parse(r.stdout.trim().split(/\r?\n/).pop() || 'null')?.hookSpecificOutput ?? null; } catch { /* no json */ }
  return { code: r.status, decision, stderr: r.stderr.trim(), stdout: r.stdout.trim() };
};
let pass = 0, fail = 0;
const expect = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); };

// agent-model-guard. The Agent tool names no model itself since 2026-09-15, so
// the force in the session's environment decides; the tests set or blank it.
const noForce = { CLAUDE_CODE_SUBAGENT_MODEL: '', CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '' };
const forceOn = model => ({ CLAUDE_CODE_SUBAGENT_MODEL: model, CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1' });
let r = run('agent-model-guard.mjs', { tool_name: 'Agent', tool_input: { prompt: 'x' } }, noForce);
expect('agent without model, no force → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('agent-model-guard.mjs', { tool_name: 'Agent', tool_input: { prompt: 'x', subagent_type: 'general-purpose' } }, forceOn('sonnet'));
expect('agent without model, force on sonnet → allow', [r.code, r.decision], [0, null]);
r = run('agent-model-guard.mjs', { tool_name: 'Agent', tool_input: { prompt: 'x' } }, forceOn('haiku'));
expect('agent without model, force on haiku → allow', [r.code, r.decision], [0, null]);
r = run('agent-model-guard.mjs', { tool_name: 'Agent', tool_input: { prompt: 'x' } }, { CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet', CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '' });
expect('agent without model, sonnet named but not forced → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('agent-model-guard.mjs', { tool_name: 'Agent', tool_input: { prompt: 'x' } }, forceOn('fable'));
expect('agent without model, force on fable → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('agent-model-guard.mjs', { tool_name: 'Agent', tool_input: { prompt: 'x', model: 'opus' } }, forceOn('sonnet'));
expect('agent on opus → deny, force or not', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('agent-model-guard.mjs', { tool_name: 'Agent', tool_input: { prompt: 'x', model: 'sonnet' } }, noForce);
expect('agent on sonnet → allow', [r.code, r.decision], [0, null]);
r = run('agent-model-guard.mjs', { tool_name: 'Agent', tool_input: { prompt: 'x', subagent_type: 'fork' } }, noForce);
expect('fork → allow', r.code, 0);
r = run('agent-model-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'ls' } }, noForce);
expect('other tool → allow', r.code, 0);

// push-guard
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'git push origin main' } });
expect('push to main → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'git push -u origin feat/x' } });
expect('push to a branch → allow', r.code, 0);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'git push --force origin feat/x' } });
expect('force push → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'git push -q --force-with-lease origin feat/x' } });
expect('force-with-lease on a branch → allow', r.code, 0);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'git pull && npm test' } });
expect('no push → allow', r.code, 0);

// night-guard (night flag off → allow everything)
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'git rm app/(app)/calendar/page.tsx' } });
expect('night off: route rm → allow', r.code, 0);
fs.mkdirSync(path.join(tmp, '.claude'), { recursive: true }); fs.writeFileSync(path.join(tmp, '.claude', 'night-mode'), 'on');
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'git rm app/(app)/calendar/page.tsx' } });
expect('night on: route rm → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'rm app/(marketing)/pricing/page.tsx' } });
expect('night on: route rm in another group → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'rm -rf .next/dev/types/calendar' } });
expect('night on: rm of a non-route path → allow', r.code, 0);
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'npm install @tanstack/react-table' } });
expect('night on: npm install → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('night-guard.mjs', { tool_name: 'Write', cwd: tmp, tool_input: { file_path: 'C:\\repo\\supabase\\migrations\\20260911000000_x.sql', content: '' } });
expect('night on: migration write → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'echo "select 1;" > supabase/migrations/20260911000000_x.sql' } });
expect('night on: migration via redirect → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: "cat > supabase/migrations/20260911000000_x.sql <<'EOF'\nselect 1;\nEOF" } });
expect('night on: migration via heredoc → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'cat supabase/migrations/20260909050000_x.sql' } });
expect('night on: reading a migration → allow', r.code, 0);
r = run('night-guard.mjs', { tool_name: 'Write', cwd: tmp, tool_input: { file_path: 'C:\\repo\\app\\(admin)\\design\\page.tsx', content: '' } });
expect('night on: route Write in another group → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('night-guard.mjs', { tool_name: 'Edit', cwd: tmp, tool_input: { file_path: 'C:\\repo\\lib\\design\\x.ts' } });
expect('night on: ordinary edit → allow', r.code, 0);
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'curl https://api.supabase.com/v1/projects/abc/database/query -d "begin; select 1; rollback;"' } });
expect('night on: rehearsal inside begin…rollback → allow', r.code, 0);
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'curl https://api.supabase.com/v1/projects/abc/database/query -d "create table x()"' } });
expect('night on: prod write → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'curl https://api.supabase.com/v1/projects/abc123/database/query -d "create table x()"' } });
expect('night on: prod write, ref with digits → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);

// stop-gates: in a non-git temp dir → exit 0 (nothing to gate)
r = run('stop-gates.mjs', { cwd: tmp });
expect('stop-gates outside a git tree → allow', r.code, 0);

// session-start / pre-compact: produce additionalContext, exit 0
r = run('session-start.mjs', { cwd: tmp });
expect('session-start → context', [r.code, typeof r.decision?.additionalContext], [0, 'string']);
r = run('pre-compact.mjs', { cwd: tmp });
expect('pre-compact → context + draft file', [r.code, fs.existsSync(path.join(tmp, '.claude', 'handoff-draft.md'))], [0, true]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
