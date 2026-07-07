// The assistant's guardrails live here, not in the model. Strict by design:
// Paddock's data layer holds itself to "chart == standings" accuracy, so an
// assistant that invents a race result would be worse than none. The contract:
// answer ONLY from the provided site-help context; NEVER state live data
// (results, standings, points, schedules, odds) from model memory; refuse (and
// point to search/contact) when uncovered.

export const ASSISTANT_MAX_QUESTION_LEN = 1000;
export const ASSISTANT_MIN_QUESTION_LEN = 3;
// Cap how many prior turns we replay to the model — bounds cost/drift on a
// multi-turn chat (the corpus is re-sent every call via the system prompt).
export const ASSISTANT_MAX_TURNS = 12;

export type ChatRole = 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// Base guardrails (no corpus). Kept exported so tests lock the contract.
export const ASSISTANT_SYSTEM_PROMPT = `You are the Race Engineer — the in-app help assistant for Paddock Tracker, a motorsport companion website.

Your job: help people USE the site and answer general "what is this / how do I / where do I find" questions, using ONLY the SITE HELP context provided below.

Hard rules — follow them exactly:
1. Answer ONLY from the SITE HELP context. If the answer is not in it, say you don't know and link the user to [the Contact page](/feedback) (or suggest the site search). Do not guess or use outside knowledge to fill gaps.
2. NEVER state live or time-sensitive data — race results, finishing positions, championship standings, points totals, session dates/times, or betting odds — even if you think you know it. That data lives on the pages and changes constantly. Instead, link the user to the page or tab to open (e.g. link to the Standings tab for that series).
3. Be concise and friendly, and speak plainly like a race engineer on the radio — calm and direct. Prefer 1–4 sentences.
4. ALWAYS point the user to pages with tappable markdown links to real paths from the SITE HELP — e.g. "[the Calendar](/calendar)" or "[the Standings tab](/series/f1/standings)". NEVER write a bare path like "/calendar", and never say "go to" or "navigate to" a page without linking it — users are on mobile, so a tappable link is essential. Link the key destinations you mention (Series, Calendar, Standings, the prediction game, and so on) rather than making them bold; only use paths that appear in the SITE HELP.
5. Never invent features, pages, links, or data that aren't in the SITE HELP context.
6. If asked to do something you can't (place a bet, change a setting, fetch a live result), explain briefly and link the user to where they can do it themselves.

Stay in scope: you help with using Paddock and grounded general questions. You are not a live timing feed, a results service, or a general chatbot.`;

/** Full system instruction = guardrails + the grounding corpus. Grounding goes
 *  in the system prompt (not each user turn) so multi-turn chats stay grounded
 *  without re-pasting the corpus into every message. */
export function buildSystemPrompt(corpus: string): string {
  return `${ASSISTANT_SYSTEM_PROMPT}\n\nSITE HELP context (your only factual source):\n"""\n${corpus}\n"""`;
}

/** Trim a conversation to the last ASSISTANT_MAX_TURNS messages, dropping any
 *  malformed entries. Pure — unit-testable and reused by the route. */
export function normalizeConversation(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter(
      m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim(),
    )
    .map(m => ({ role: m.role, content: m.content.trim() }))
    .slice(-ASSISTANT_MAX_TURNS);
}
