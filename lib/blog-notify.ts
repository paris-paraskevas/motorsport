import { clerkClient } from '@clerk/nextjs/server';
import { listSubscriptions, deleteSubscription } from './push-store';
import { sendPushTo, type PushPayload } from './push';
import { recordSent } from './push-history';
import { getUserNotifPrefs } from './userPrefs';
import { wasNotified, markNotified } from './notify-ledger';
import { sendEmail, renderBrandedEmail } from './email';
import { SITE_URL } from './site';

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

/** Tell an author what happened to the piece they submitted — the half of the loop
 *  that did not exist: `decidePost` flipped the status and notified nobody, so a
 *  writer had to poll the console to learn whether their work was going live.
 *
 *  Email only, deliberately: a contributor is not necessarily a push subscriber,
 *  and the scheduled time is the payload — it does not fit a notification body.
 *  Best-effort throughout, and it must never fail the decision that triggered it:
 *  the approval has already been committed by the time this runs.
 *
 *  Ledger-keyed per post AND per outcome, so re-approving after a reschedule can
 *  still tell the author the new time, while a retry of the same decision cannot
 *  double-send. */
export async function notifyAuthorDecision(post: {
  id: string;
  title: string;
  slug: string;
  authorId: string;
  approved: boolean;
  publishAt?: string | null;
}): Promise<void> {
  const ledgerKey = `${post.id}:${post.approved ? 'approved' : 'rejected'}:${post.publishAt ?? 'none'}`;
  if (await wasNotified('blog-decision', ledgerKey)) return;
  await markNotified('blog-decision', ledgerKey);

  let to: string | undefined;
  try {
    const u = await (await clerkClient()).users.getUser(post.authorId);
    to = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? undefined;
  } catch {
    return; // no address, no email; the console still shows the status
  }
  if (!to) return;

  // Times are rendered in Athens, the operator's timezone and the one every
  // scheduling decision is made in, with the zone named so it is unambiguous.
  const when = post.publishAt
    ? new Intl.DateTimeFormat('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Europe/Athens', timeZoneName: 'short',
      }).format(new Date(post.publishAt))
    : null;

  const { html, text } = post.approved
    ? renderBrandedEmail({
        preheader: when ? `Scheduled for ${when}.` : 'Approved and scheduled.',
        heading: 'Your post is approved',
        intro: post.title,
        paragraphs: [
          when
            ? `It goes live on ${when}. Publishing runs on a schedule, so allow up to fifteen minutes after that time for it to appear.`
            : 'It is approved and will go live at its scheduled time.',
          'You can still edit it until it publishes.',
        ],
        cta: { label: 'View your post', href: `${SITE_URL}/blog/${post.slug}` },
      })
    : renderBrandedEmail({
        preheader: 'Your submission was not published.',
        heading: 'Your post was not approved',
        intro: post.title,
        paragraphs: [
          'It has not been published. The editor will follow up with what needs changing.',
        ],
      });

  await sendEmail({
    to,
    subject: post.approved
      ? `Your post is scheduled: ${post.title}`
      : `About your post: ${post.title}`,
    text,
    html,
  });
}

/** Push the admins a "draft ready to review" notification. Operational, not a
 *  content feed — ignores the `blog`/followed/mute prefs, but honours each
 *  admin's `sound` toggle. Mark-before-send + a 48h ledger key keyed by post id
 *  so a retry (or both create paths) can't double-fire. No-ops with no admins /
 *  no subscribers / no KV. */
export async function notifyAdminsDraftReady(post: { id: string; title: string }): Promise<void> {
  if (await wasNotified('blog-draft', post.id)) return;

  // Mark before any send: a crash mid-notify costs one missed alert, not a
  // doubled one (the API route's after() and the draft script can both call us).
  await markNotified('blog-draft', post.id);

  // Email the operator's inbox — the reliable channel, independent of whether
  // any admin has a push subscription yet. Best-effort (no-ops unconfigured).
  const { html, text } = renderBrandedEmail({
    preheader: 'A blog draft is waiting for review.',
    heading: 'Draft ready to review',
    intro: post.title,
    paragraphs: [
      'A new blog post draft is waiting in the review queue. Approve it (optionally with a future publish time) to schedule it live.',
    ],
    cta: { label: 'Review the draft', href: `${SITE_URL}/blog?review=1` },
  });
  await sendEmail({ subject: `[Blog] Draft ready: ${post.title}`, text, html });

  // Admin push fan-out (on top of the email; needs subscribers + admins).
  const [subs, admins] = await Promise.all([listSubscriptions(), adminUserIds()]);
  if (subs.length === 0 || admins.size === 0) return;
  const payload: PushPayload = {
    title: 'Draft ready to review',
    body: post.title,
    url: '/blog?review=1',
    tag: `paddock-blog-draft-${post.id}`,
  };
  // One history row per admin, even with several push subscriptions.
  const recorded = new Set<string>();
  for (const { subscription, userId } of subs) {
    if (!userId || !admins.has(userId)) continue;
    try {
      const prefs = await getUserNotifPrefs(userId);
      const silent = prefs.sound === false;
      const res = await sendPushTo(subscription, silent ? { ...payload, silent: true } : payload);
      if (res.ok) {
        // Record to the admin's sent-history once (fail-soft). No retry-unmark
        // here: the operator email above is the reliable channel, this is a
        // one-shot (no cron tick re-drives it), and unmarking would only re-open
        // the double-fire window the 'blog-draft' mark deliberately closes.
        if (!recorded.has(userId)) {
          recorded.add(userId);
          await recordSent(userId, {
            kind: 'blog-draft',
            title: payload.title,
            body: payload.body,
            url: payload.url ?? '/app',
            ts: Date.now(),
          });
        }
      } else if (res.gone) {
        await deleteSubscription(subscription.endpoint);
      }
    } catch {
      // a single gone/erroring sub must not abort the fan-out
    }
  }
}
