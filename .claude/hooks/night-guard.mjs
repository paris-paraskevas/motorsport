// PreToolUse on Bash and on file writes while the night flag is set: no route
// file deleted, no migration written, no dependency installed, no prod Supabase
// write. Rule 2 of the executive rules. Off when .claude/night-mode is absent.
import { readInput, deny, allow, nightMode } from './lib.mjs';

const input = readInput();
const cwd = input.cwd ?? process.cwd();
if (!nightMode(cwd)) allow();
const tool = input.tool_name;
const t = input.tool_input ?? {};
if (tool === 'Bash') {
  const cmd = String(t.command ?? '');
  if (/\bgit\s+rm\b.*app[\\/]\(app\)[\\/].*page\.tsx/.test(cmd) || /\brm\b.*app[\\/]\(app\)[\\/].*page\.tsx/.test(cmd)) deny('Rule 2: no route file leaves the code overnight.');
  if (/\bnpm\s+(install|i|add)\b|\bpnpm\s+add\b|\byarn\s+add\b/.test(cmd)) deny('Rule 2: no dependency is added overnight.');
  if (/supabase[\\/]migrations[\\/]/.test(cmd) && /\b(cat\s*>|tee|cp|mv|touch)\b/.test(cmd)) deny('Rule 2: no migration is written overnight.');
  if (/api\.supabase\.com\/v1\/projects\/[a-z]+\/database\/query/.test(cmd) && !/begin[\s\S]*rollback/i.test(cmd)) deny('Rule 2: no prod Supabase write overnight; a rehearsal inside begin…rollback is allowed.');
  allow();
}
if (tool === 'Write' || tool === 'Edit') {
  const p = String(t.file_path ?? '').replace(/\\/g, '/');
  if (/\/supabase\/migrations\//.test(p)) deny('Rule 2: no migration is written overnight.');
  if (/\/app\/\(app\)\/.*\/page\.tsx$/.test(p) && tool === 'Write') deny('Rule 2: no route file is created or replaced overnight.');
  allow();
}
allow();
