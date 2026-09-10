// Unit tests for the hook scripts: synthetic stdin JSON in, exit code and
// stdout decision out. Run: node test.mjs (from this folder). No settings.json
// wiring is needed; nothing here touches the repo.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-'));
const run = (script, input) => {
  const r = spawnSync(process.execPath, [path.join(here, script)], { input: JSON.stringify(input), encoding: 'utf8' });
  let decision = null;
  try { decision = JSON.parse(r.stdout.trim().split(/\r?\n/).pop() || 'null')?.hookSpecificOutput ?? null; } catch { /* no json */ }
  return { code: r.status, decision, stderr: r.stderr.trim(), stdout: r.stdout.trim() };
};
let pass = 0, fail = 0;
const expect = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); };

// agent-model-guard
let r = run('agent-model-guard.mjs', { tool_name: 'Agent', tool_input: { prompt: 'x' } });
expect('agent without model → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('agent-model-guard.mjs', { tool_name: 'Agent', tool_input: { prompt: 'x', model: 'opus' } });
expect('agent on opus → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('agent-model-guard.mjs', { tool_name: 'Agent', tool_input: { prompt: 'x', model: 'sonnet' } });
expect('agent on sonnet → allow', [r.code, r.decision], [0, null]);
r = run('agent-model-guard.mjs', { tool_name: 'Agent', tool_input: { prompt: 'x', subagent_type: 'fork' } });
expect('fork → allow', r.code, 0);
r = run('agent-model-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'ls' } });
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
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'npm install @tanstack/react-table' } });
expect('night on: npm install → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('night-guard.mjs', { tool_name: 'Write', cwd: tmp, tool_input: { file_path: 'C:\\repo\\supabase\\migrations\\20260911000000_x.sql', content: '' } });
expect('night on: migration write → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('night-guard.mjs', { tool_name: 'Edit', cwd: tmp, tool_input: { file_path: 'C:\\repo\\lib\\design\\x.ts' } });
expect('night on: ordinary edit → allow', r.code, 0);
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'curl https://api.supabase.com/v1/projects/abc/database/query -d "begin; select 1; rollback;"' } });
expect('night on: rehearsal inside begin…rollback → allow', r.code, 0);
r = run('night-guard.mjs', { tool_name: 'Bash', cwd: tmp, tool_input: { command: 'curl https://api.supabase.com/v1/projects/abc/database/query -d "create table x()"' } });
expect('night on: prod write → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);

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
