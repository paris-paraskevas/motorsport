import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { listSubscriptions, deleteSubscription } from '@/lib/push-store';
import { sendPushTo, type PushPayload } from '@/lib/push';
import { getUserFollowed, getUserNotifPrefs } from '@/lib/userPrefs';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { markNotified } from '@/lib/notify-ledger';
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
          } else if (res.gone) {
            await deleteSubscription(subscription.endpoint);
            evicted++;
          }
        } catch {
          // a single gone/erroring sub must not abort the fan-out
        }
      }
      return { sent, evicted, skipped };
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
