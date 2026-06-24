import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isBettingConfigured } from '@/lib/betting/client';
import { ensureBettingUser } from '@/lib/betting/credits';
import {
  createLeague,
  joinLeague,
  getOrCreateInvite,
  joinLeagueByToken,
  setMemberProfile,
  renameLeague,
  disbandLeague,
  kickMember,
  addFriendToLeague,
} from '@/lib/betting/leagues';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Friend leagues: create one (returns a join code) or join by code. The user is
// lazily onboarded first. 503s when the betting DB isn't provisioned.
export async function POST(req: Request) {
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'betting not available' }, { status: 503 });
  }
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: {
    action?: unknown;
    name?: unknown;
    joinCode?: unknown;
    leagueId?: unknown;
    token?: unknown;
    targetUserId?: unknown;
    friendUserId?: unknown;
    nickname?: unknown;
    color?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  await ensureBettingUser(userId);

  if (body.action === 'create') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 60) {
      return NextResponse.json({ error: 'name must be 1–60 characters' }, { status: 400 });
    }
    const { id, joinCode } = await createLeague(userId, name);
    return NextResponse.json({ ok: true, id, joinCode });
  }

  if (body.action === 'join') {
    const code = typeof body.joinCode === 'string' ? body.joinCode.trim() : '';
    if (!code) return NextResponse.json({ error: 'join code required' }, { status: 400 });
    try {
      const id = await joinLeague(userId, code);
      return NextResponse.json({ ok: true, id });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'could not join';
      return NextResponse.json({ ok: false, error: message }, { status: 422 });
    }
  }

  if (body.action === 'invite') {
    const leagueId = typeof body.leagueId === 'string' ? body.leagueId : '';
    if (!leagueId) return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
    try {
      const token = await getOrCreateInvite(leagueId, userId);
      return NextResponse.json({ ok: true, token });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'could not create invite';
      return NextResponse.json({ ok: false, error: message }, { status: 422 });
    }
  }

  if (body.action === 'joinByToken') {
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });
    try {
      const { leagueId } = await joinLeagueByToken(userId, token);
      return NextResponse.json({ ok: true, id: leagueId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'could not join';
      return NextResponse.json({ ok: false, error: message }, { status: 422 });
    }
  }

  if (body.action === 'setProfile') {
    const leagueId = typeof body.leagueId === 'string' ? body.leagueId : '';
    const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : '';
    if (!leagueId || !targetUserId) {
      return NextResponse.json({ error: 'leagueId and targetUserId required' }, { status: 400 });
    }
    try {
      await setMemberProfile(leagueId, userId, targetUserId, {
        nickname: typeof body.nickname === 'string' ? body.nickname : undefined,
        color: typeof body.color === 'string' ? body.color : undefined,
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'could not update';
      return NextResponse.json({ ok: false, error: message }, { status: 422 });
    }
  }

  if (body.action === 'rename') {
    const leagueId = typeof body.leagueId === 'string' ? body.leagueId : '';
    if (!leagueId) return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
    try {
      await renameLeague(leagueId, userId, typeof body.name === 'string' ? body.name : '');
      return NextResponse.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'could not rename';
      return NextResponse.json({ ok: false, error: message }, { status: 422 });
    }
  }

  if (body.action === 'disband') {
    const leagueId = typeof body.leagueId === 'string' ? body.leagueId : '';
    if (!leagueId) return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
    try {
      await disbandLeague(leagueId, userId);
      return NextResponse.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'could not disband';
      return NextResponse.json({ ok: false, error: message }, { status: 422 });
    }
  }

  if (body.action === 'kick') {
    const leagueId = typeof body.leagueId === 'string' ? body.leagueId : '';
    const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : '';
    if (!leagueId || !targetUserId) {
      return NextResponse.json({ error: 'leagueId and targetUserId required' }, { status: 400 });
    }
    try {
      await kickMember(leagueId, userId, targetUserId);
      return NextResponse.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'could not remove member';
      return NextResponse.json({ ok: false, error: message }, { status: 422 });
    }
  }

  if (body.action === 'addFriend') {
    const leagueId = typeof body.leagueId === 'string' ? body.leagueId : '';
    const friendUserId = typeof body.friendUserId === 'string' ? body.friendUserId : '';
    if (!leagueId || !friendUserId) {
      return NextResponse.json({ error: 'leagueId and friendUserId required' }, { status: 400 });
    }
    try {
      await addFriendToLeague(leagueId, userId, friendUserId);
      return NextResponse.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'could not add friend';
      return NextResponse.json({ ok: false, error: message }, { status: 422 });
    }
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
