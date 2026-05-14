import { NextResponse } from 'next/server';
import { deleteSubscription } from '@/lib/push-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ ok: false, error: 'missing endpoint' }, { status: 400 });
  }
  try {
    await deleteSubscription(body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
