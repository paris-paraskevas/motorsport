import { loadSiteHelpCorpus } from './corpus';
import { buildSystemPrompt, normalizeConversation, type ChatMessage } from './prompt';
import { askModel, isAssistantConfigured, type AskResult } from './model';

export { isAssistantConfigured } from './model';
export {
  ASSISTANT_MAX_QUESTION_LEN,
  ASSISTANT_MIN_QUESTION_LEN,
  ASSISTANT_MAX_TURNS,
  normalizeConversation,
  type ChatMessage,
} from './prompt';

/** Answer the latest turn of a conversation, grounded in the curated corpus.
 *  Server-only. Returns the model seam's discriminated result so the route can
 *  map reasons to HTTP status (unconfigured → 503, error → 502). */
export async function answerConversation(messages: ChatMessage[]): Promise<AskResult> {
  const corpus = await loadSiteHelpCorpus();
  // No corpus = nothing to ground on. Treat as unconfigured rather than let the
  // model answer from memory (the whole point of the guardrail).
  if (!corpus) return { ok: false, reason: 'unconfigured' };
  if (!isAssistantConfigured()) return { ok: false, reason: 'unconfigured' };
  const turns = normalizeConversation(messages);
  if (!turns.length || turns[turns.length - 1].role !== 'user') {
    return { ok: false, reason: 'error' };
  }
  return askModel(buildSystemPrompt(corpus), turns);
}
