import { verifyWebhook } from '@clerk/nextjs/webhooks';
import type { NextRequest } from 'next/server';
import { kv } from '@vercel/kv';
import { sendEmail, renderBrandedEmail } from '@/lib/email';
import { SITE_URL, SITE_TITLE } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Clerk webhook receiver. Public by design — verifyWebhook checks the Svix
// signature (CLERK_WEBHOOK_SIGNING_SECRET), so the route guards itself; it's
// intentionally NOT in proxy.ts's isProtected list (a Clerk session cookie
// never accompanies a server-to-server webhook). Today it only sends a
// one-time branded welcome email on user.created; other events are acked + ignored.

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function POST(req: NextRequest) {
  // ALWAYS verify — never skip, even for a notify-only handler. Reads
  // CLERK_WEBHOOK_SIGNING_SECRET automatically; throws on a bad/missing signature.
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response('invalid signature', { status: 400 });
  }

  if (evt.type === 'user.created') {
    const { id, email_addresses, first_name } = evt.data;
    const email = email_addresses?.[0]?.email_address;
    if (email) {
      // One welcome per user, ever. Svix retries on non-2xx and Clerk can
      // replay events — without this a flaky send would re-welcome the user.
      const key = `paddock:welcome:${id}`;
      let already = false;
      if (kvConfigured()) {
        try {
          already = Boolean(await kv.get(key));
        } catch {
          already = false;
        }
      }

      if (!already) {
        const name = (first_name ?? '').trim();
        const { html, text } = renderBrandedEmail({
          preheader: `Welcome to ${SITE_TITLE} — your motorsport companion.`,
          heading: name ? `Welcome to ${SITE_TITLE}, ${name}` : `Welcome to ${SITE_TITLE}`,
          intro: 'Your personal motorsport companion.',
          paragraphs: [
            'Paddock keeps F1, MotoGP, WEC, WRC, IndyCar, NASCAR and more in one place — live schedules in your local time, results, standings, and a friendly no-stakes prediction game.',
            'Follow your series so their sessions land front and centre, and turn on notifications so you never miss lights-out.',
          ],
          cta: { label: 'Open Paddock', href: `${SITE_URL}/app` },
          footerNote: `You’re receiving this once because you just created a ${SITE_TITLE} account. Manage email and notifications anytime in Settings.`,
        });
        const res = await sendEmail({ to: email, subject: `Welcome to ${SITE_TITLE}`, text, html });
        if (res.ok && kvConfigured()) {
          try {
            await kv.set(key, '1', { ex: 60 * 60 * 24 * 365 });
          } catch {
            /* best-effort dedupe — a missing key at worst re-welcomes once */
          }
        }
      }
    }
  }

  // Always ack receipt for handled + unhandled events. We never return non-2xx
  // on a send failure: a welcome email isn't worth a Svix retry storm.
  return new Response('ok', { status: 200 });
}
