import { NextResponse, after } from 'next/server';
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { isAdmin, canAuthor } from '@/lib/threads';
import { isBettingConfigured } from '@/lib/betting/client';
import { getAuthorRequestById, decideAuthorRequest, notifyApplicantDecision } from '@/lib/author-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST = decide a become-an-author application: { action: 'approve' | 'decline' }.
// Admin-only; 404 for everyone else (same no-existence-oracle shape as the other
// admin routes). Approve grants Clerk publicMetadata.role = 'contributor' FIRST,
// then flips the row — if the grant crashes mid-way the application stays
// pending and re-lists, whereas the reverse order could record an approval that
// never granted anything. updateUserMetadata merges the given keys into the
// existing publicMetadata (verified against @clerk/backend UserApi), so no other
// metadata key is touched. An applicant who already climbed the ladder (writer/
// admin) keeps their higher role: the grant is skipped, the row still closes.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentUser();
  if (!isAdmin(admin)) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) return NextResponse.json({ error: 'not available' }, { status: 503 });

  const { id } = await params;
  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (body.action !== 'approve' && body.action !== 'decline') {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
  const approve = body.action === 'approve';

  const request = await getAuthorRequestById(id);
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'application is not pending (already decided?)' }, { status: 422 });
  }

  try {
    const client = await clerkClient();
    const applicant = await client.users.getUser(request.clerkUserId);
    if (approve && !canAuthor(applicant)) {
      await client.users.updateUserMetadata(request.clerkUserId, {
        publicMetadata: { role: 'contributor' },
      });
    }
    await decideAuthorRequest(id, admin!.id, approve);

    const to = applicant.primaryEmailAddress?.emailAddress ?? applicant.emailAddresses[0]?.emailAddress;
    if (to) {
      after(async () => {
        try {
          await notifyApplicantDecision({ to, displayName: request.displayName, approved: approve });
        } catch (e) {
          console.error('applicant decision notify failed:', e);
        }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    const domain = /not pending/i.test(message);
    return NextResponse.json({ error: message }, { status: domain ? 422 : 500 });
  }
}
