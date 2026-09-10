// PreToolUse on Agent: every subagent must name an allowed model (sonnet or
// haiku). Belt to the brace of CLAUDE_CODE_SUBAGENT_MODEL_FORCE in settings.
// Rule 7 of the executive rules. Forks inherit by design and are exempt.
import { readInput, deny, allow } from './lib.mjs';

const input = readInput();
if (input.tool_name !== 'Agent') allow();
const t = input.tool_input ?? {};
if (t.subagent_type === 'fork') allow();
const ALLOWED = new Set(['sonnet', 'haiku']);
if (!t.model) deny('Rule 7: a subagent must name its model (sonnet or haiku); none given.');
if (!ALLOWED.has(String(t.model))) deny(`Rule 7: subagent model "${t.model}" is not allowed; use sonnet or haiku.`);
allow();
