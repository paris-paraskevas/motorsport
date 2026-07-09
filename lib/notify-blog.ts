import { listSubscriptions, deleteSubscription } from '@/lib/push-store';
import { sendPushTo, type PushPayload } from '@/lib/push';
import { recordSent } from '@/lib/push-history';
import { getUserFollowed, getUserNotifPrefs, isQuietNow } from '@/lib/userPrefs';
import { markNotified, unmarkNotified, shouldRetryAfterTotalFailure } from '@/lib/notify-ledger';
import { loadAllSeriesMeta } from '@/lib/series';
import type { BlogPost } from '@/lib/blog';

// Server-only. Fans a blog-publish push out to eligible subscribers for each
// freshly-published post, recording + ledgering as it goes. Extracted from the
// publish-posts cron (0.183.4) so the approve handler can publish+announce
// inline too — Next 16 forbids non-handler exports from a route.ts, so the
// shared logic has to live in a lib. Idempotent per post via the 'blog-publish'
// ledger key (mark-before-send) plus the status-flip guard in publishDuePosts.
// The caller must gate on isPushConfigured() before invoking.
//
// Audience: per-user `blog` notif pref + sound. A SERIES-TAGGED post is filtered
// to followers (+ mute) like a news push; an UNTAGGED post is site-wide editorial
// and goes to everyone with `blog` on. Subscriptions with no account are skipped.
export async function announcePublishedPosts(
  posts: BlogPost[],
): Promise<{ sent: number; skipped: number; evicted: number }> {
  const subs = await listSubscriptions();
  const now = new Date();
  const metas = await loadAllSeriesMeta();
  const colorBySlug = new Map(metas.map(m => [m.slug, m.color] as const));

  // Per-user followed + notif-prefs cache, mirroring betting-notify (gated on
  // the `blog` pref instead of `betting`).
  const userCache = new Map<
    string,
    { followed: string[] | null; blogOn: boolean; soundOn: boolean; muted: Set<string>; quiet: boolean }
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
      quiet: isQuietNow(prefs, now),
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
    // One history row per user, even with several push subscriptions (multiple
    // devices/registrations): the push still reaches every device, but the
    // notification centre must not list the same post twice.
    const recorded = new Set<string>();
    for (const { subscription, userId } of subs) {
      try {
        if (!userId) {
          skipped++;
          continue;
        }
        const state = await getUserState(userId);
        if (state.quiet) {
          skipped++;
          continue;
        }
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
        const silent = !state.soundOn;
        const res = await sendPushTo(subscription, silent ? { ...payload, silent: true } : payload);
        if (res.ok) {
          sent++;
          if (userId && !recorded.has(userId)) {
            recorded.add(userId);
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
  for (const post of posts) {
    // Mark before sending: a crash mid-fanout costs one missed announce, not a doubled one.
    await markNotified('blog-publish', post.id);
    const r = await announce(post);
    sent += r.sent;
    evicted += r.evicted;
    skipped += r.skipped;
    // Transient total failure → undo the mark to keep the ledger truthful (we did
    // NOT announce this post). The status flip in publishDuePosts is the real
    // once-ever guard; the ledger key is a secondary dedup, and we don't want it
    // falsely claiming a failed send.
    if (shouldRetryAfterTotalFailure(r)) {
      await unmarkNotified('blog-publish', post.id);
    }
  }
  return { sent, skipped, evicted };
}
