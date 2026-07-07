import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { recordFeedback } from '@/lib/assistant/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 👍/👎 on an assistant answer. Signed-in only; best-effort (recordFeedback never
// throws). `question` is the user turn that produced the rated answer.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { question?: unknown; rating?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const rating = body.rating === 'up' || body.rating === 'down' ? body.rating : null;
  if (!question || !rating) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  await recordFeedback(question, rating);
  return NextResponse.json({ ok: true });
}
