import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { allowRequest } from '@/lib/rate-limit';
import {
  answerQuestion,
  ASSISTANT_MAX_QUESTION_LEN,
  ASSISTANT_MIN_QUESTION_LEN,
} from '@/lib/assistant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Per-user daily question cap — the primary cost + abuse control (bounds spend
// even if a single account hammers it). Global per-minute guard — keeps the
// whole app under the model's free-tier RPM ceiling (Gemini Flash ≈ 15/min);
// kept below it for headroom. Both fail CLOSED (deny if KV is down) since each
// allowed request is a paid/limited LLM call.
const PER_USER_DAILY_CAP = 20;
const GLOBAL_PER_MINUTE = 12;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'sign in to use the assistant' }, { status: 401 });
  }

  // Per-user daily cap first (specific to this account), then the shared
  // per-minute ceiling. Fail-closed: an unavailable limiter denies.
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

  let body: { question?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (question.length < ASSISTANT_MIN_QUESTION_LEN) {
    return NextResponse.json({ error: 'question too short' }, { status: 400 });
  }
  if (question.length > ASSISTANT_MAX_QUESTION_LEN) {
    return NextResponse.json({ error: 'question too long' }, { status: 400 });
  }

  const result = await answerQuestion(question);
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
