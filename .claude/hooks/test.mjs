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
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'gh pr create --base next --title x --body y' } });
expect('pr into next → allow', r.code, 0);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'gh pr create --title x --body y' } });
expect('pr without a base (main by default) → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'gh pr create -B main --title x' } });
expect('pr into main → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'gh pr merge 12 --squash --delete-branch' } }, { PUSH_GUARD_PR_BASE: 'next' });
expect('merge a pr into next → allow', r.code, 0);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'gh pr merge 12 --squash' } }, { PUSH_GUARD_PR_BASE: 'main' });
expect('merge a pr into main → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'gh pr merge --squash' } }, { PUSH_GUARD_PR_BASE: 'next' });
expect('merge without a pr number → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'gh api -X PUT repos/o/r/pulls/12/merge' } });
expect('merge through the api → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: "git commit -q -F - <<'MSG'\nfeat: gh pr merge checks the base; gh pr create needs --base next\nMSG" } });
expect('a heredoc message naming the commands → allow', r.code, 0);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'git commit -m "open it with gh pr create, merge with gh pr merge"' } });
expect('a quoted message naming the commands → allow', r.code, 0);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: "bash <<'EOF'\ngh pr merge 12 --squash\nEOF" } }, { PUSH_GUARD_PR_BASE: 'main' });
expect('a merge fed to a shell through a heredoc → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);
r = run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'cd repo && gh pr merge 12 --squash' } }, { PUSH_GUARD_PR_BASE: 'main' });
expect('a merge after && → deny', [r.code, r.decision?.permissionDecision], [2, 'deny']);

// push-guard, from the review of #1148 (session 68): commands after a heredoc, behind
// wrappers and in nested scripts; every occurrence; gh api's other doors; git's own
// options and a plain push on main; base flags after punctuated text; no false refusals.
const guard = (command, env = {}, cwd) => run('push-guard.mjs', { tool_name: 'Bash', tool_input: { command }, ...(cwd ? { cwd } : {}) }, env);
const denied = (name, command, env, cwd) => { const g = guard(command, env, cwd); expect(`${name} → deny`, [g.code, g.decision?.permissionDecision], [2, 'deny']); };
const allowed = (name, command, env, cwd) => { const g = guard(command, env, cwd); expect(`${name} → allow`, [g.code, g.decision], [0, null]); };
const toMain = { PUSH_GUARD_PR_BASE: 'main' }, toNext = { PUSH_GUARD_PR_BASE: 'next' };
const bases = { PUSH_GUARD_PR_BASE: JSON.stringify({ 1145: 'main', 1147: 'next', 1148: 'next' }) };
const checkoutOn = (branch) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'push-guard-')); spawnSync('git', ['init', '-q', '-b', branch, d]); return d; };
denied('a merge after a commit heredoc', `git commit -m "$(cat <<'EOF'\nmsg\nEOF\n)" && gh pr merge 1145 --squash`, toMain);
denied('a merge on the line after a heredoc', "git commit -F - <<'MSG'\nfeat: x\nMSG\ngh pr merge 12", toMain);
denied('a PR without a base after a heredoc', "git commit -F - <<'MSG'\nx\nMSG\ngit push -u origin feat/x && gh pr create --title t");
denied('a merge behind an env prefix', 'GH_PAGER=cat gh pr merge 1145 --squash', toMain);
denied('a merge in a for loop', 'for n in 12; do gh pr merge $n; done', toNext);
denied('a merge in an if', 'if true; then gh pr merge 12; fi', toMain);
denied('a merge through bash -c', 'bash -c "gh pr merge 12"', toMain);
denied('a merge through xargs', 'echo 12 | xargs gh pr merge', toNext);
denied('a merge in braces', '{ gh pr merge 12; }', toMain);
denied('a negated merge', '! gh pr merge 12', toMain);
denied('a merge in backticks', 'echo `gh pr merge 12`', toMain);
denied('a merge through eval', "eval 'gh pr merge 12'", toMain);
denied('a merge in a heredoc piped to bash', "cat <<'EOF' | bash\ngh pr merge 12\nEOF", toMain);
denied('a merge in a heredoc fed to bash -e', "bash -e <<'EOF'\ngh pr merge 12\nEOF", toMain);
denied('the second of two merges', 'gh pr merge 1148 --squash && gh pr merge 1145 --squash', bases);
denied('a merge whose body names another pull request', 'gh pr merge --body "lands after 1147 is in" 1145', bases);
allowed('a merge into next whose body names another pull request', 'gh pr merge --body "lands after 1145" 1147', bases);
denied('the second of two PRs', 'gh pr create --base next --title a && gh pr create --title b');
denied('a merge through the api, the number in a variable', 'gh api -X PUT repos/o/r/pulls/$PR/merge');
denied('a branch merge through the api', 'gh api repos/o/r/merges -f base=main -f head=next');
denied('a ref write through the api', 'gh api -X PATCH repos/o/r/git/refs/heads/main -f sha=abc -F force=true');
denied('a merge through graphql', `gh api graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`);
denied('auto-merge through graphql', `gh api graphql -f query='mutation { enablePullRequestAutoMerge(input: {pullRequestId: "x"}) { clientMutationId } }'`);
denied('a ruleset deleted', 'gh api -X DELETE repos/o/r/rulesets/123');
denied('a ruleset disabled', 'gh api -X PUT repos/o/r/rulesets/123 -f enforcement=disabled');
denied('branch protection removed', 'gh api -X DELETE repos/o/r/branches/main/protection');
allowed('the rulesets read', 'gh api repos/o/r/rulesets');
allowed('a ruleset created', 'gh api -X POST repos/o/r/rulesets --input ruleset.json');
allowed('a commit message naming a push to main', 'git commit -m "docs: never git push to main"');
allowed('a heredoc message naming a push to main', "git commit -F - <<'MSG'\ndocs: never git push origin main\nMSG");
allowed('a branch whose name contains main', 'git push -u origin feat/main-menu');
denied('a push to main through git -C', 'git -C ../repo push origin main');
denied('a push to main through git -c', 'git -c core.askPass=x push origin main');
denied('a push of HEAD to main', 'git push origin HEAD:refs/heads/main');
denied('a plain push on main', 'git push', {}, checkoutOn('main'));
denied('a push of HEAD on main', 'git push origin HEAD', {}, checkoutOn('main'));
allowed('a plain push on a branch', 'git push', {}, checkoutOn('feat/x'));
denied('a push of every branch', 'git push --all origin');
denied('a mirror push', 'git push --mirror origin');
denied('a force push by +refspec', 'git push origin +feat/x');
allowed('a PR whose title has an ampersand', 'gh pr create --title "fix: R&D page" --base next');
allowed('a PR whose title has a pipe, with -B', 'gh pr create --title "a | b" -B next');
allowed('a PR with a multi-line body before its base', 'gh pr create --title t --body "line one\nline two" --base next');
allowed('a PR with a heredoc body before its base', `gh pr create --title t --body "$(cat <<'EOF'\n## What\nx; y && z\nEOF\n)" --base next`);
allowed('a PR with a quoted base', "gh pr create --title t --base 'next'");
allowed('a PR with an attached short base', 'gh pr create -Bnext --title t');
denied('a PR into a branch that only starts with next', 'gh pr create --base next-release --title t');
allowed('a merge named by URL', 'gh pr merge https://github.com/o/r/pull/12 --squash', toNext);
allowed('a merge named by branch', 'gh pr merge feat/x --squash', toNext);
denied('a PR retargeted at main', 'gh pr edit 12 --base main');
allowed('a PR retargeted at next', 'gh pr edit 12 --base next');

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
