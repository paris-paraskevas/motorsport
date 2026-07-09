import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isPushConfigured } from '@/lib/push';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { isBettingConfigured } from '@/lib/betting/client';
import { publishDuePosts } from '@/lib/blog';
import { announcePublishedPosts } from '@/lib/notify-blog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Publishes approved posts whose publish_at has passed, then fans an all-users
// push out for each. Runs every 15 min (.github/workflows/publish-posts.yml) and
// is ALSO invoked inline when an admin approves a post whose publish time has
// already passed (app/api/blog/[id]), so a "publish now" no longer waits for the
// (GitHub-Actions-throttled) tick. publishDuePosts is idempotent (status-guarded
// flip) and a 'blog-publish' KV ledger key (mark-before-send) guarantees
// once-ever-per-post even when the cron and an inline approve race.
//
// Audience: gated on the per-user `blog` notif pref + sound. A SERIES-TAGGED post
// is filtered to followers (+ mute) like a news push; an UNTAGGED post is
// site-wide editorial and goes to everyone with `blog` on. (Fan-out lives in
// lib/notify-blog so the approve handler can reuse it.)
export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);

  // No-op cleanly when Supabase isn't provisioned, so the workflow's 200-check passes.
  if (!isBettingConfigured()) {
    return NextResponse.json({ ok: true, message: 'betting not configured' });
  }

  try {
    const published = await publishDuePosts(new Date());
    if (published.length === 0) {
      return NextResponse.json({ ok: true, published: 0 });
    }

    // ISR: refresh the list + each new post's page so they appear immediately,
    // not after the 5-min revalidate window.
    revalidatePath('/blog');
    for (const p of published) revalidatePath(`/blog/${p.slug}`);

    // Publishing is the primary job and already happened above. The push is
    // secondary — if VAPID isn't configured, report it clearly rather than
    // throwing from the send loop, but DON'T undo the publish.
    if (!isPushConfigured()) {
      return NextResponse.json({
        ok: true,
        published: published.length,
        slugs: published.map(p => p.slug),
        pushed: false,
        reason: 'push not configured',
      });
    }

    const { sent, skipped, evicted } = await announcePublishedPosts(published);

    return NextResponse.json({
      ok: true,
      published: published.length,
      slugs: published.map(p => p.slug),
      sent,
      skipped,
      evicted,
    });
  } catch (err) {
    console.error('GET /api/cron/publish-posts failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
