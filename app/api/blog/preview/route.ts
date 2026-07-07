import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isWriter } from '@/lib/threads';
import { renderMarkdown } from '@/lib/content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Live-preview render for the blog editor. Takes { body } markdown and returns
// { html } through the SAME renderMarkdown pipeline the published post uses — so
// the preview is byte-identical to what ships (no client-side markdown library,
// no rehype-sanitize drift, which is exactly the risk the 2026-07-03 inline-edit
// spec flagged against a client-rendered preview). Writer/admin only.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isWriter(await currentUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: { body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const md = typeof body.body === 'string' ? body.body : '';
  // Mirror createDraft's BODY_MAX so the preview can't be used as an unbounded
  // render endpoint.
  if (md.length > 50000) return NextResponse.json({ error: 'body too long' }, { status: 413 });

  const html = await renderMarkdown(md);
  return NextResponse.json({ html });
}
