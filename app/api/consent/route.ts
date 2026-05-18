import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ConsentBody {
  categories: {
    functional?: boolean;
    analytics?: boolean;
    marketing?: boolean;
  };
  version?: number;
  anonymousId?: string;
}

/**
 * Records a cookie-consent decision in Vercel KV so we can demonstrate
 * compliance with GDPR Article 7(1) (proof of consent).
 *
 * Stored as one entry per change at key `consent:<timestamp>:<anonId>`
 * with a 24-month TTL. Best effort — if KV is misconfigured we still
 * return 200 so the client UX isn't blocked.
 */
export async function POST(req: Request) {
  let body: ConsentBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid json' },
      { status: 400 },
    );
  }

  const { categories, version, anonymousId } = body ?? {};
  if (!categories || typeof categories !== 'object' || !anonymousId) {
    return NextResponse.json(
      { ok: false, error: 'missing fields' },
      { status: 400 },
    );
  }

  let userId: string | null = null;
  try {
    const a = await auth();
    userId = a.userId ?? null;
  } catch {
    userId = null;
  }

  const ts = Date.now();
  const record = {
    ts,
    categories: {
      functional: true, // always required
      analytics: categories.analytics === true,
      marketing: categories.marketing === true,
    },
    version: version ?? 1,
    anonymousId,
    userId,
  };

  try {
    const key = `consent:${ts}:${anonymousId}`;
    // 24 months in seconds
    await kv.set(key, record, { ex: 60 * 60 * 24 * 365 * 2 });
    return NextResponse.json({ ok: true });
  } catch {
    // KV not configured or temporary failure — don't break the user flow.
    return NextResponse.json({ ok: true, persisted: false });
  }
}
