import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { allowRequest } from '@/lib/rate-limit';
import {
  answerConversation,
  normalizeConversation,
  ASSISTANT_MAX_QUESTION_LEN,
  ASSISTANT_MIN_QUESTION_LEN,
  type ChatMessage,
} from '@/lib/assistant';
import { logQuestion } from '@/lib/assistant/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Per-user daily question cap — the primary cost + abuse control (bounds spend
// even if one account hammers it; each SENT message is one model call). Global
// per-minute guard — keeps the whole app under the model's free-tier RPM ceiling
// (Gemini Flash ≈ 15/min), kept below it for headroom. Both fail CLOSED (deny if
// KV is down) since each allowed request is a paid/limited LLM call.
const PER_USER_DAILY_CAP = 20;
const GLOBAL_PER_MINUTE = 12;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'sign in to use the assistant' }, { status: 401 });
  }

  const underDaily = await allowRequest(`assistant:user:${userId}`, PER_USER_DAILY_CAP, 86400, true);
  if (!underDaily) {
    return NextResponse.json(
      { error: 'daily_limit', message: "You've reached today's question limit. Try again tomorrow." },
      { status: 429 },
    );
  }
  const underGlobal = await allowRequest('assistant:global', GLOBAL_PER_MINUTE, 60, true);
  if (!underGlobal) {
    const retry = 60 - (Math.floor(Date.now() / 1000) % 60);
    return NextResponse.json(
      { error: 'busy', message: 'The assistant is busy right now — try again in a moment.' },
      { status: 429, headers: { 'Retry-After': String(retry) } },
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const raw = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
  const messages = normalizeConversation(raw);
  const latest = messages[messages.length - 1];
  if (!latest || latest.role !== 'user') {
    return NextResponse.json({ error: 'no question' }, { status: 400 });
  }
  if (latest.content.length < ASSISTANT_MIN_QUESTION_LEN) {
    return NextResponse.json({ error: 'question too short' }, { status: 400 });
  }
  if (latest.content.length > ASSISTANT_MAX_QUESTION_LEN) {
    return NextResponse.json({ error: 'question too long' }, { status: 400 });
  }

  const result = await answerConversation(messages);
  await logQuestion(userId, latest.content, result.ok); // best-effort usage log
  if (!result.ok) {
    // unconfigured → the feature ships dark (no API key yet): 503 so the UI can
    // show "not available yet". error → upstream/model failure: 502.
    const status = result.reason === 'unconfigured' ? 503 : 502;
    const message =
      result.reason === 'unconfigured'
        ? 'The assistant is not available yet.'
        : "The assistant couldn't answer that — please try again.";
    return NextResponse.json({ error: result.reason, message }, { status });
  }
  return NextResponse.json({ ok: true, answer: result.text });
}
