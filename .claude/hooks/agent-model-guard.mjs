// PreToolUse on Agent: every subagent runs on an allowed model (sonnet or
// haiku). Belt to the brace of CLAUDE_CODE_SUBAGENT_MODEL_FORCE in settings.
// Rule 7 of the executive rules. Forks inherit by design and are exempt.
//
// The Agent tool carries no `model` field any more (2026-09-15): a subagent's
// model comes from its type's definition, and the settings force every one onto
// CLAUDE_CODE_SUBAGENT_MODEL. So a call that names no model is allowed when
// that force is on and names an allowed model, the hook reading the same
// environment the session runs in; a call that names a disallowed model is
// denied whatever the force says, since the ask itself breaks the rule.
import { readInput, deny, allow } from './lib.mjs';

const input = readInput();
if (input.tool_name !== 'Agent') allow();
const t = input.tool_input ?? {};
if (t.subagent_type === 'fork') allow();
const ALLOWED = new Set(['sonnet', 'haiku']);
if (t.model === undefined || t.model === null || t.model === '') {
  const forced = process.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE === '1' ? String(process.env.CLAUDE_CODE_SUBAGENT_MODEL ?? '') : '';
  if (ALLOWED.has(forced)) allow();
  deny(`Rule 7: a subagent must run on sonnet or haiku; the call names no model and the session does not force one (CLAUDE_CODE_SUBAGENT_MODEL=${process.env.CLAUDE_CODE_SUBAGENT_MODEL ?? 'unset'}, FORCE=${process.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE ?? 'unset'}).`);
}
if (!ALLOWED.has(String(t.model))) deny(`Rule 7: subagent model "${t.model}" is not allowed; use sonnet or haiku.`);
allow();
