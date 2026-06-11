import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { auth } from '@clerk/nextjs/server';
import { allowRequest, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LEN = 4000;
const MIN_MESSAGE_LEN = 5;

const CATEGORIES = ['bug', 'feature', 'suggestion', 'general'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABEL: Record<Category, string> = {
  bug: 'Bug report',
  feature: 'Feature request',
  suggestion: 'Suggested change',
  general: 'General',
};

function isKvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
}

async function sendViaResend(
  fromEmail: string,
  message: string,
  category: Category,
  userId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const toAddress = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !toAddress) return { ok: false, error: 'resend not configured' };

  const categoryLabel = CATEGORY_LABEL[category];

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Paddock Tracker Contact <contact@paddock-tracker.com>',
        to: toAddress,
        reply_to: fromEmail,
        subject: `[${categoryLabel}] Paddock Tracker contact from ${fromEmail}`,
        text: `Category: ${categoryLabel}\nFrom: ${fromEmail}${userId ? ` (clerk user: ${userId})` : ''}\n\n${message}`,
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

export async function POST(req: Request) {
  // The only unauthenticated write on the site — rate-limited per IP and
  // globally so it can't become a Resend spam gun or a KV flood
  // (security audit 2026-06-11; the long-standing carry-over).
  const ip = clientIp(req);
  const [ipAllowed, globalAllowed] = await Promise.all([
    allowRequest(`contact:ip:${ip}`, 5, 15 * 60),
    allowRequest('contact:global', 60, 60 * 60),
  ]);
  if (!ipAllowed || !globalAllowed) {
    return NextResponse.json({ error: 'too many requests' }, { status: 429 });
  }

  let body: { email?: unknown; message?: unknown; category?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const rawCategory = typeof body.category === 'string' ? body.category : 'general';
  const category: Category = (CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : 'general';

  // No whitespace/control characters: the address lands in Resend's
  // reply_to and the mail subject — keep header-injection shapes out even
  // though the JSON transport already defuses most of them.
  if (!email || !email.includes('@') || email.length > 200 || /\s/.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }
  if (message.length < MIN_MESSAGE_LEN) {
    return NextResponse.json({ error: 'message too short' }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: 'message too long' }, { status: 400 });
  }

  let userId: string | null = null;
  try {
    const a = await auth();
    userId = a.userId ?? null;
  } catch {
    userId = null;
  }

  const record = {
    email,
    message,
    category,
    userId,
    createdAt: new Date().toISOString(),
  };

  if (isKvConfigured()) {
    const key = `paddock:contact:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    try {
      // 12-month retention to match the privacy policy retention table.
      await kv.set(key, record, { ex: 60 * 60 * 24 * 365 });
    } catch {
      /* don't block on KV failure */
    }
  }

  const sent = await sendViaResend(email, message, category, userId);

  return NextResponse.json({
    ok: true,
    stored: isKvConfigured(),
    emailed: sent.ok,
  });
}
