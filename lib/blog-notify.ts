import { clerkClient } from '@clerk/nextjs/server';
import { listSubscriptions, deleteSubscription } from './push-store';
import { sendPushTo, type PushPayload } from './push';
import { getUserNotifPrefs } from './userPrefs';
import { wasNotified, markNotified } from './notify-ledger';

// Server-only. The admin-only half of the blog pipeline's push fan-out: tell the
// admins a draft is waiting. (The all-users "new post" push lives in the
// publish-posts cron, which reuses betting-notify's per-user prefs cache.)
//
// Runtime-agnostic on purpose — no `next/server` import — so scripts/draft-post
// can import it too. The API route wraps the call in `after()`; the script
// awaits it best-effort (it no-ops when KV / Clerk / VAPID env is absent).

/** Clerk user ids with publicMetadata.role === 'admin'. Single source of admin
 *  truth (matches lib/threads isAdmin). Fail-soft: an empty set on any Clerk
 *  error, so a draft create/notify never throws on this. Small user base → one
 *  page (limit 100) covers it. */
export async function adminUserIds(): Promise<Set<string>> {
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ limit: 100 });
    return new Set(
      data
        .filter(u => (u.publicMetadata as { role?: unknown } | null)?.role === 'admin')
        .map(u => u.id),
    );
  } catch {
    return new Set();
  }
}

/** Push the admins a "draft ready to review" notification. Operational, not a
 *  content feed — ignores the `blog`/followed/mute prefs, but honours each
 *  admin's `sound` toggle. Mark-before-send + a 48h ledger key keyed by post id
 *  so a retry (or both create paths) can't double-fire. No-ops with no admins /
 *  no subscribers / no KV. */
export async function notifyAdminsDraftReady(post: { id: string; title: string }): Promise<void> {
  if (await wasNotified('blog-draft', post.id)) return;
  const [subs, admins] = await Promise.all([listSubscriptions(), adminUserIds()]);
  if (subs.length === 0 || admins.size === 0) return;

  // Mark before sending: a crash mid-fanout costs one missed ping, not a doubled one.
  await markNotified('blog-draft', post.id);
  const payload: PushPayload = {
    title: 'Draft ready to review',
    body: post.title,
    url: '/blog?review=1',
    tag: `paddock-blog-draft-${post.id}`,
  };
  for (const { subscription, userId } of subs) {
    if (!userId || !admins.has(userId)) continue;
    try {
      const prefs = await getUserNotifPrefs(userId);
      const silent = prefs.sound === false;
      const res = await sendPushTo(subscription, silent ? { ...payload, silent: true } : payload);
      if (!res.ok && res.gone) await deleteSubscription(subscription.endpoint);
    } catch {
      // a single gone/erroring sub must not abort the fan-out
    }
  }
}
