// Server-only. The site's single transactional-email path — a thin Resend
// wrapper used by the contact form (lib unauthenticated write), the staff
// feedback board, the blog draft-ready alert, and the new-user welcome email.
// No-ops (returns { ok: false }) when RESEND_API_KEY / CONTACT_TO_EMAIL aren't
// set, so callers treat email as best-effort and never block or fail on it.
// Plain `fetch` to the Resend REST API — no SDK dependency.

import { SITE_URL, SITE_TITLE } from './site';
import { kv } from './kv';

const DEFAULT_FROM = 'Paddock Tracker <contact@paddock-tracker.com>';

export async function sendEmail(opts: {
  subject: string;
  /** Plaintext part — always required (the deliverability + no-HTML fallback). */
  text: string;
  /** Optional HTML part. When set, Resend sends a multipart message. */
  html?: string;
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
        ...(opts.html ? { html: opts.html } : {}),
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

// --- Branded HTML email -----------------------------------------------------
// Hand-rolled, no React Email / MJML dependency. Email HTML is not web HTML:
// clients strip <style>, ignore flex/grid, and many invert dark backgrounds —
// so the layout is a 600px <table> with inline styles only, and every send is
// multipart (the matched plaintext part below is what shows when HTML is off).

const BRAND = {
  pageBg: '#0a0a0f',
  cardBg: '#14141a',
  border: '#26262e',
  text: '#f5f5f7',
  muted: '#9a9aa4',
  faint: '#6b6b76',
  red: '#ff4136',
};

const FONT_STACK = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface BrandedEmailOptions {
  /** Hidden inbox-preview snippet (most clients show it after the subject). */
  preheader?: string;
  /** Big title inside the card. */
  heading: string;
  /** Optional muted sub-line under the heading. */
  intro?: string;
  /** Body paragraphs. Newlines within a paragraph become <br>. */
  paragraphs: string[];
  /** Optional call-to-action button. */
  cta?: { label: string; href: string };
  /** Small-print line in the footer (e.g. why they received this). */
  footerNote?: string;
}

/**
 * Render a branded transactional email to matched { html, text } parts. Pass
 * both to sendEmail so the message is multipart. All interpolated strings are
 * HTML-escaped, so caller-supplied content (a feedback body, a visitor's
 * message) can't break the markup or inject tags into the recipient's client.
 */
export function renderBrandedEmail(opts: BrandedEmailOptions): { html: string; text: string } {
  const domain = SITE_URL.replace(/^https?:\/\//, '');
  const paras = opts.paragraphs.map(p => escapeHtml(p).replace(/\n/g, '<br>'));

  const introHtml = opts.intro
    ? `<tr><td style="padding:0 0 14px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.muted};">${escapeHtml(opts.intro)}</td></tr>`
    : '';

  const bodyHtml = paras
    .map(
      p =>
        `<tr><td style="padding:0 0 14px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:${BRAND.text};">${p}</td></tr>`,
    )
    .join('');

  const ctaHtml = opts.cta
    ? `<tr><td style="padding:6px 0 2px;">` +
      `<a href="${escapeHtml(opts.cta.href)}" style="display:inline-block;background:${BRAND.red};color:#ffffff;text-decoration:none;font-family:${FONT_STACK};font-weight:700;font-size:15px;padding:12px 22px;border-radius:8px;">${escapeHtml(opts.cta.label)} &rarr;</a>` +
      `</td></tr>`
    : '';

  const footerNoteHtml = opts.footerNote
    ? `<div style="margin:0 0 8px;">${escapeHtml(opts.footerNote)}</div>`
    : '';

  const html =
    `<!DOCTYPE html><html lang="en"><head>` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="dark light">` +
    `<meta name="supported-color-schemes" content="dark light">` +
    `<title>${escapeHtml(opts.heading)}</title></head>` +
    `<body style="margin:0;padding:0;background:${BRAND.pageBg};">` +
    `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader ?? opts.heading)}</span>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:24px 12px;">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">` +
    // wordmark
    `<tr><td style="padding:4px 4px 16px;">` +
    `<span style="display:inline-block;width:12px;height:12px;background:${BRAND.red};border-radius:2px;vertical-align:middle;margin-right:8px;"></span>` +
    `<span style="font-family:${FONT_STACK};font-weight:800;letter-spacing:0.14em;font-size:15px;color:${BRAND.text};text-transform:uppercase;vertical-align:middle;">${escapeHtml(SITE_TITLE)}</span>` +
    `</td></tr>` +
    // card
    `<tr><td style="background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-top:3px solid ${BRAND.red};border-radius:14px;padding:28px 28px 24px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
    `<tr><td style="padding:0 0 12px;font-family:${FONT_STACK};font-weight:700;font-size:21px;line-height:1.3;color:${BRAND.text};">${escapeHtml(opts.heading)}</td></tr>` +
    introHtml +
    bodyHtml +
    ctaHtml +
    `</table></td></tr>` +
    // footer
    `<tr><td style="padding:18px 8px 4px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.faint};">` +
    footerNoteHtml +
    `<a href="${SITE_URL}" style="color:${BRAND.muted};text-decoration:none;">${escapeHtml(domain)}</a>` +
    `</td></tr>` +
    `</table></td></tr></table></body></html>`;

  // Matched plaintext part.
  const lines: string[] = [opts.heading, ''];
  if (opts.intro) lines.push(opts.intro, '');
  for (const p of opts.paragraphs) lines.push(p, '');
  if (opts.cta) lines.push(`${opts.cta.label}: ${opts.cta.href}`, '');
  lines.push('—');
  if (opts.footerNote) lines.push(opts.footerNote);
  lines.push(`${SITE_TITLE} · ${domain}`);

  return { html, text: lines.join('\n') };
}

/** The one welcome a new account gets, at its first confirmed sign-up (PA A3; Clerk's webhook sent it before, with the
 *  same words). One per account ever, kept in KV under the account's id; a missing KV at worst re-welcomes once. Best
 *  effort: a failed send is false, never a throw. */
export async function sendWelcomeEmail({ id, email, name }: { id: string; email: string; name?: string | null }): Promise<boolean> {
  const key = `paddock:welcome:${id}`;
  const kvOn = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (kvOn) {
    try {
      if (await kv.get(key)) return false;
    } catch {
      /* best-effort dedupe */
    }
  }
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  const { html, text } = renderBrandedEmail({
    preheader: `Welcome to ${SITE_TITLE} — your motorsport companion.`,
    heading: first ? `Welcome to ${SITE_TITLE}, ${first}` : `Welcome to ${SITE_TITLE}`,
    intro: 'Your personal motorsport companion.',
    paragraphs: [
      'Paddock keeps F1, MotoGP, WEC, WRC, IndyCar, NASCAR and more in one place — live schedules in your local time, results, standings, and a friendly no-stakes prediction game.',
      'Follow your series so their sessions land front and centre, and turn on notifications so you never miss lights-out.',
    ],
    cta: { label: 'Open Paddock', href: `${SITE_URL}/app` },
    footerNote: `You’re receiving this once because you just created a ${SITE_TITLE} account. Manage email and notifications anytime in Settings.`,
  });
  let ok = false;
  try {
    ok = (await sendEmail({ to: email, subject: `Welcome to ${SITE_TITLE}`, text, html })).ok;
  } catch {
    ok = false;
  }
  if (ok && kvOn) {
    try {
      await kv.set(key, '1', { ex: 60 * 60 * 24 * 365 });
    } catch {
      /* a missing key at worst re-welcomes once */
    }
  }
  return ok;
}
