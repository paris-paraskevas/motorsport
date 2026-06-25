// Server-only. The site's single transactional-email path — a thin Resend
// wrapper used by the contact form (lib unauthenticated write) and the staff
// feedback board. No-ops (returns { ok: false }) when RESEND_API_KEY /
// CONTACT_TO_EMAIL aren't set, so callers treat email as best-effort and never
// block or fail on it. Plain `fetch` to the Resend REST API — no SDK dependency.

const DEFAULT_FROM = 'Paddock Tracker <contact@paddock-tracker.com>';

export async function sendEmail(opts: {
  subject: string;
  text: string;
  /** Defaults to CONTACT_TO_EMAIL (the operator's inbox). */
  to?: string;
  /** From display name + address; defaults to the contact@ sender. */
  from?: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = opts.to ?? process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) return { ok: false, error: 'resend not configured' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: opts.from ?? DEFAULT_FROM,
        to,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        subject: opts.subject,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'resend failed' };
  }
}
