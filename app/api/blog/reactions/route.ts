import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { allowRequest, clientIp } from '@/lib/rate-limit';
import { getReactionSummary, setReaction, removeReaction, type Voter } from '@/lib/blog-reactions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Anonymous reactions dedup on a salted hash of the client IP — never the raw IP.
// Keyed on CRON_SECRET (present in every deployed env) so the hash is not
// reversible from the IP space; falls back to a constant key only if it is unset.
function ipHashOf(req: Request): string {
  const key = process.env.CRON_SECRET || 'paddock-reactions';
  return createHmac('sha256', key).update(clientIp(req)).digest('hex');
}

async function resolveVoter(req: Request): Promise<Voter> {
  const { userId } = await auth();
  return userId ? { userId } : { ipHash: ipHashOf(req) };
}

function normalizeSlug(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  return /^[a-z0-9-]{1,200}$/.test(s) ? s : null;
}

export async function GET(req: Request) {
  if (!isBettingConfigured()) return NextResponse.json({ likes: 0, dislikes: 0, mine: null });
  const slug = normalizeSlug(new URL(req.url).searchParams.get('slug'));
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
  return NextResponse.json(await getReactionSummary(slug, await resolveVoter(req)));
}

export async function POST(req: Request) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  let body: { slug?: unknown; reaction?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const slug = normalizeSlug(body.slug);
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
  if (body.reaction !== 'like' && body.reaction !== 'dislike') {
    return NextResponse.json({ error: 'reaction must be like or dislike' }, { status: 400 });
  }
  // Cheap-to-abuse write — cap per IP (fail-open; not cost-bearing).
  if (!(await allowRequest(`blog-react:${clientIp(req)}`, 30, 60))) {
    return NextResponse.json({ error: 'too many requests' }, { status: 429 });
  }
  const voter = await resolveVoter(req);
  try {
    await setReaction(slug, voter, body.reaction);
  } catch (e) {
    console.error('setReaction failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'could not save reaction' }, { status: 500 });
  }
  return NextResponse.json(await getReactionSummary(slug, voter));
}

export async function DELETE(req: Request) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const slug = normalizeSlug(new URL(req.url).searchParams.get('slug'));
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
  const voter = await resolveVoter(req);
  try {
    await removeReaction(slug, voter);
  } catch (e) {
    console.error('removeReaction failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'could not remove reaction' }, { status: 500 });
  }
  return NextResponse.json(await getReactionSummary(slug, voter));
}
