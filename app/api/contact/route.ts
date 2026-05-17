import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LEN = 4000;
const MIN_MESSAGE_LEN = 5;

function isKvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
}

async function sendViaResend(
  fromEmail: string,
  message: string,
  userId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const toAddress = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !toAddress) return { ok: false, error: 'resend not configured' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Paddock Contact <contact@send.paddock-tracker.com>',
        to: toAddress,
        reply_to: fromEmail,
        subject: `Paddock contact from ${fromEmail}`,
        text: `From: ${fromEmail}${userId ? ` (clerk user: ${userId})` : ''}\n\n${message}`,
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
  let body: { email?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!email || !email.includes('@') || email.length > 200) {
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
    userId,
    createdAt: new Date().toISOString(),
  };

  // Persist to KV when available (queryable inbox).
  if (isKvConfigured()) {
    const key = `paddock:contact:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    try {
      await kv.set(key, record);
    } catch {
      /* don't block on KV failure */
    }
  }

  // Best-effort email via Resend if configured.
  const sent = await sendViaResend(email, message, userId);

  return NextResponse.json({
    ok: true,
    stored: isKvConfigured(),
    emailed: sent.ok,
  });
}
