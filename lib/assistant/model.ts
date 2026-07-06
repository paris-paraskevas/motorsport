import type { ChatMessage } from './prompt';

// The swappable model seam. Everything provider-specific lives here, so moving
// off Gemini's free tier (to an open model, or the paid Vercel AI Gateway) later
// is a change to THIS file only, not the route or the UI.
//
// Free-tier note: we call Google's Gemini REST API directly with an AI Studio
// key so it stays on the free tier (routing through a gateway would use paid
// routes). Config via env:
//   GOOGLE_GENERATIVE_AI_API_KEY  — the AI Studio key (REQUIRED; absent → the
//                                   assistant degrades to "unavailable")
//   ASSISTANT_MODEL               — model id override (default below). Model ids
//                                   change often; set this to the current free
//                                   Flash model from AI Studio rather than trust
//                                   the default.

const DEFAULT_MODEL = 'gemini-2.0-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 12_000;

export type AskResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'unconfigured' | 'error' };

export function isAssistantConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

/** One grounded generation over a conversation. `system` carries the guardrails
 *  + corpus; `messages` is the turn history (user/assistant), oldest first, last
 *  turn being the new question. Never throws — failures collapse to reason:'error'. */
export async function askModel(system: string, messages: ChatMessage[]): Promise<AskResult> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return { ok: false, reason: 'unconfigured' };
  const model = process.env.ASSISTANT_MODEL || DEFAULT_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          // Gemini roles: 'user' and 'model'. Map our assistant turns to 'model'.
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          // Low temperature: grounded help, not creative writing. Cap output so
          // a runaway generation can't blow the free-tier token budget.
          generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
        }),
      },
    );
    if (!res.ok) return { ok: false, reason: 'error' };
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map(p => p.text ?? '')
      .join('')
      .trim();
    if (!text) return { ok: false, reason: 'error' }; // empty or safety-blocked
    return { ok: true, text };
  } catch {
    return { ok: false, reason: 'error' }; // network / timeout / abort
  } finally {
    clearTimeout(timer);
  }
}
