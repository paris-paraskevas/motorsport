import { NextResponse } from 'next/server';
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/threads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH = set a user's supporter flag: { donor: boolean }. Admin-only; 404 for
// everyone else (the no-existence-oracle shape the other admin routes use).
// updateUserMetadata merges the given keys into existing publicMetadata
// (verified against @clerk/backend UserApi — the 0.251.0 lesson), so role and
// every other key survive the toggle. The flag gates the studio's AI tools;
// donation → account matching is manual (Buy Me a Coffee has no webhook wired).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });

  const { id } = await params;
  let body: { donor?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (typeof body.donor !== 'boolean') {
    return NextResponse.json({ error: 'donor must be true or false' }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(id, { publicMetadata: { donor: body.donor } });
    return NextResponse.json({ ok: true, donor: body.donor });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
