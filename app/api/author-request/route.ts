import { NextResponse, after } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { canAuthor } from '@/lib/threads';
import { clerkDisplayName } from '@/lib/betting/friends';
import { createAuthorRequest, notifyAdminsAuthorRequest } from '@/lib/author-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST = file a become-an-author application (/write-for-us). Signed-in only —
// the application is FOR this account, so there is no anonymous path. Existing
// authors are bounced to the studio instead of the queue. The operator email
// fires off the critical path; the insert is already committed by then.
export async function POST(req: Request) {
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = await currentUser();
  if (canAuthor(user)) {
    return NextResponse.json({ error: 'you can already write — open the studio' }, { status: 409 });
  }

  let body: { pitch?: unknown; links?: unknown; sample?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  try {
    const displayName = clerkDisplayName(user) || 'Unnamed applicant';
    await createAuthorRequest(userId, {
      displayName,
      pitch: str(body.pitch),
      links: str(body.links) || null,
      sample: str(body.sample) || null,
    });
    after(async () => {
      try {
        await notifyAdminsAuthorRequest({ displayName, pitch: str(body.pitch) });
      } catch (e) {
        console.error('author-request notify failed:', e);
      }
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'could not file the application';
    const domain = /must be|already in review/i.test(message);
    return NextResponse.json({ error: message }, { status: domain ? 422 : 500 });
  }
}
