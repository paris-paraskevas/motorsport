import { loadSiteHelpCorpus } from './corpus';
import { ASSISTANT_SYSTEM_PROMPT, buildUserContent } from './prompt';
import { askModel, isAssistantConfigured, type AskResult } from './model';

export { isAssistantConfigured } from './model';
export {
  ASSISTANT_MAX_QUESTION_LEN,
  ASSISTANT_MIN_QUESTION_LEN,
} from './prompt';

/** Answer a site-help question, grounded in the curated corpus. Server-only.
 *  Returns the same discriminated result as the model seam so the route can map
 *  reasons to HTTP status (unconfigured → 503, error → 502). */
export async function answerQuestion(question: string): Promise<AskResult> {
  const corpus = await loadSiteHelpCorpus();
  // No corpus = nothing to ground on. Treat as unconfigured rather than let the
  // model answer from memory (the whole point of the guardrail).
  if (!corpus) return { ok: false, reason: 'unconfigured' };
  if (!isAssistantConfigured()) return { ok: false, reason: 'unconfigured' };
  return askModel(ASSISTANT_SYSTEM_PROMPT, buildUserContent(corpus, question));
}
