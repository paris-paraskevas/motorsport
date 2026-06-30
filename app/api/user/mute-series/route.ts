import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { addMutedSeries, removeMutedSeries } from '@/lib/userPrefs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface MuteBody {
  seriesSlug?: string;
  action?: 'mute' | 'unmute';
}

export async function POST(req: Request) {
  const a = await auth();
  if (!a.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: MuteBody;
  try {
    body = (await req.json()) as MuteBody;
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const slug = body.seriesSlug?.trim();
  if (!slug || !/^[a-z0-9-]{1,64}$/.test(slug)) {
    return NextResponse.json({ error: 'seriesSlug required' }, { status: 400 });
  }

  try {
    const prefs =
      body.action === 'unmute'
        ? await removeMutedSeries(a.userId, slug)
        : await addMutedSeries(a.userId, slug);
    return NextResponse.json({ ok: true, mutedSeries: prefs.mutedSeries ?? [] });
  } catch (err) {
    console.error('POST /api/user/mute-series failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
