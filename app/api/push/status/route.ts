import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const vapidConfigured = Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
  const kvConfigured = Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
  return NextResponse.json({
    ready: vapidConfigured && kvConfigured,
    vapidConfigured,
    kvConfigured,
    // The VAPID PUBLIC key is public by design (every subscriber's browser
    // holds a copy) — serving it here lets the client subscribe without the
    // key being inlined at build time, which is the exact landmine that made
    // Workers builds ship push compiled out (sessions 22-26). The private key
    // never leaves the server.
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
  });
}
