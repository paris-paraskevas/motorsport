import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { listSubscriptions, deleteSubscription } from '@/lib/push-store';
import { sendPushTo, isPushConfigured, type PushPayload } from '@/lib/push';
import { recordSent } from '@/lib/push-history';
import { getUserFollowed, getUserNotifPrefs } from '@/lib/userPrefs';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { markNotified, unmarkNotified, shouldRetryAfterTotalFailure } from '@/lib/notify-ledger';
import { isBettingConfigured } from '@/lib/betting/client';
import { publishDuePosts, type BlogPost } from '@/lib/blog';
import { loadAllSeriesMeta } from '@/lib/series';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Publishes approved posts whose publish_at has passed, then fans an all-users
// push out for each. Runs every 15 min (.github/workflows/publish-posts.yml).
// publishDuePosts is idempotent (status-guarded flip) and a 'blog-publish' KV
// ledger key (mark-before-send) guarantees once-ever-per-post even on overlap.
//
// Audience: gated on the per-user `blog` notif pref + sound. A SERIES-TAGGED post
// is filtered to followers (+ mute) like a news push; an UNTAGGED post is
// site-wide editorial and goes to everyone with `blog` on.
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

    const subs = await listSubscriptions();
    const metas = await loadAllSeriesMeta();
    const colorBySlug = new Map(metas.map(m => [m.slug, m.color] as const));

    // Per-user followed + notif-prefs cache, mirroring betting-notify (gated on
    // the `blog` pref instead of `betting`).
    const userCache = new Map<
      string,
      { followed: string[] | null; blogOn: boolean; soundOn: boolean; muted: Set<string> }
    >();
    const getUserState = async (userId: string) => {
      const cached = userCache.get(userId);
      if (cached) return cached;
      const [followed, prefs] = await Promise.all([getUserFollowed(userId), getUserNotifPrefs(userId)]);
      const state = {
        followed,
        blogOn: prefs.blog !== false,
        soundOn: prefs.sound !== false,
        muted: new Set(prefs.mutedSeries ?? []),
      };
      userCache.set(userId, state);
      return state;
    };

    const announce = async (post: BlogPost) => {
      const payload: PushPayload = {
        title: `📝 New post: ${post.title}`,
        body: post.summary,
        url: `/blog/${post.slug}`,
        tag: `paddock-blog-${post.id}`,
        color: post.seriesSlug ? colorBySlug.get(post.seriesSlug) : undefined,
        image: post.heroImage ?? undefined,
      };
      let sent = 0;
      let evicted = 0;
      let skipped = 0;
      let errored = 0;
      for (const { subscription, userId } of subs) {
        try {
          let silent = false;
          if (userId) {
            const state = await getUserState(userId);
            if (!state.blogOn) {
              skipped++;
              continue;
            }
            // Series-tagged → followers only (+ honour mute); untagged → everyone.
            if (post.seriesSlug) {
              if (state.followed !== null && !state.followed.includes(post.seriesSlug)) {
                skipped++;
                continue;
              }
              if (state.muted.has(post.seriesSlug)) {
                skipped++;
                continue;
              }
            }
            silent = !state.soundOn;
          }
          const res = await sendPushTo(subscription, silent ? { ...payload, silent: true } : payload);
          if (res.ok) {
            sent++;
            if (userId) {
              await recordSent(userId, {
                kind: 'blog-publish',
                title: payload.title,
                body: payload.body,
                url: payload.url ?? '/app',
                ts: Date.now(),
                seriesSlug: post.seriesSlug ?? undefined,
              });
            }
          } else if (res.gone) {
            await deleteSubscription(subscription.endpoint);
            evicted++;
          } else {
            // Real (non-gone) send error — a transient blip.
            errored++;
          }
        } catch {
          // a single gone/erroring sub must not abort the fan-out; count it as a
          // real error so a total failure is reflected in the ledger.
          errored++;
        }
      }
      return { sent, evicted, skipped, errored };
    };

    let sent = 0;
    let evicted = 0;
    let skipped = 0;
    for (const post of published) {
      // Mark before sending: a crash mid-fanout costs one missed announce, not a doubled one.
      await markNotified('blog-publish', post.id);
      const r = await announce(post);
      sent += r.sent;
      evicted += r.evicted;
      skipped += r.skipped;
      // Transient total failure → undo the mark to keep the ledger truthful (we
      // did NOT announce this post). NB: unlike the session/betting crons this
      // doesn't by itself re-drive the announce — publishDuePosts only returns
      // freshly-flipped posts, and this one is already 'published', so it won't
      // recur. The status flip is the real once-ever guard; the ledger key is a
      // secondary dedup, and we don't want it falsely claiming a failed send.
      if (shouldRetryAfterTotalFailure(r)) {
        await unmarkNotified('blog-publish', post.id);
      }
    }

    return NextResponse.json({
      ok: true,
      published: published.length,
      slugs: published.map(p => p.slug),
      sent,
      skipped,
      evicted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
