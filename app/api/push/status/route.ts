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
  });
}
