import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { canAuthor } from '@/lib/threads';
import { askModel, isAssistantConfigured } from '@/lib/assistant/model';
import { BODY_MAX } from '@/lib/blog';
import {
  insertHeadings,
  paragraphStarts,
  parseHeadingReply,
} from '@/lib/post-ready';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST = the studio's AI section-headings proposal (item 17 phase 2):
// { body, title? } → { ok, body, inserted[] }. The model sees a NUMBERED DIGEST
// of paragraph openings plus any existing sections and returns {before, heading}
// pairs; lib/post-ready does the insertion (insert-only by construction +
// byte-identity guard), so model output can never alter existing prose — the
// worst failure mode is an empty proposal, never a corrupted draft. Author-gated
// like /api/blog/format; the result goes back to the editor as a REVIEWED
// proposal (Apply = unsaved changes, Save = accept). Nothing persists here.

const MIN_PARAGRAPHS = 4;
const DIGEST_PARAGRAPHS_MAX = 60;

const SYSTEM = [
  'You propose section headings for a motorsport blog post.',
  'You are given numbered paragraph openings and any existing section headings.',
  'Return STRICT JSON only: an array of {"before": <paragraph number>, "heading": "<text>"} — no prose, no code fences.',
  'Choose 2 to 6 boundaries where a new section naturally starts. Never use paragraph 1.',
  'Headings: 2 to 6 words, sentence case, specific to what follows, British English.',
  'Never use em dashes, terminal punctuation, or generic labels like "Introduction", "Overview" or "Conclusion".',
  'If the piece reads fine without more sections, return [].',
].join('\n');

export async function POST(req: Request) {
  if (!canAuthor(await currentUser())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  let payload: { body?: unknown; title?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const text = typeof payload.body === 'string' ? payload.body : '';
  const title = typeof payload.title === 'string' ? payload.title.slice(0, 140) : '';
  if (!text.trim()) return NextResponse.json({ error: 'nothing to section' }, { status: 400 });
  if (text.length > BODY_MAX) return NextResponse.json({ error: 'body too long' }, { status: 422 });

  const paragraphs = paragraphStarts(text);
  if (paragraphs.length < MIN_PARAGRAPHS) {
    return NextResponse.json(
      { error: 'too short to section — write a few more paragraphs first' },
      { status: 422 },
    );
  }
  if (!isAssistantConfigured()) {
    return NextResponse.json({ error: 'model key not configured' }, { status: 503 });
  }

  const existing = text.match(/^##\s+.*$/gm) ?? [];
  const digest = [
    title ? `Title: ${title}` : null,
    existing.length > 0 ? `Existing sections:\n${existing.join('\n')}` : 'Existing sections: none',
    'Paragraph openings:',
    ...paragraphs.slice(0, DIGEST_PARAGRAPHS_MAX).map(p => `¶${p.index}: ${p.excerpt}`),
  ]
    .filter((l): l is string => l !== null)
    .join('\n');

  const reply = await askModel(SYSTEM, [{ role: 'user', content: digest }]);
  if (!reply.ok) {
    const status = reply.reason === 'unconfigured' ? 503 : 502;
    return NextResponse.json({ error: 'model unavailable — try again shortly' }, { status });
  }

  try {
    const result = insertHeadings(text, paragraphs, parseHeadingReply(reply.text));
    return NextResponse.json({ ok: true, ...result });
  } catch {
    // The byte-identity guard tripped: discard everything, never a partial apply.
    return NextResponse.json(
      { error: 'proposal discarded — failed the byte-identity guard' },
      { status: 500 },
    );
  }
}
