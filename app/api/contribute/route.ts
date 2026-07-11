import { NextResponse } from 'next/server';
import { allowRequest, clientIp } from '@/lib/rate-limit';
import { createSeriesSubmission, notifyNewSubmission, ackSubmission } from '@/lib/feeder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The public feeder-series intake write (design: docs/research/2026-07-06-feeder-series-intake.md).
// Anonymous like /api/contact, so it is rate-limited per IP + globally and gated
// behind a honeypot + a required consent flag. Files arrive base64 in the JSON
// body (capped in lib/feeder — well under Vercel's request-body limit).
export async function POST(req: Request) {
  const ip = clientIp(req);
  const [ipAllowed, globalAllowed] = await Promise.all([
    allowRequest(`contribute:ip:${ip}`, 5, 60 * 60), // 5 / hour / IP (uploads are heavier than a contact msg)
    allowRequest('contribute:global', 100, 60 * 60), // 100 / hour globally
  ]);
  if (!ipAllowed || !globalAllowed) {
    return NextResponse.json({ error: 'too many requests — try again later' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Honeypot: a hidden field real users never see. Bots fill it → pretend success.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  // Consent (design decision #3): the submitter must affirm they can share the data.
  if (body.consent !== true) {
    return NextResponse.json({ error: 'please confirm you can share this data' }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const rawFile =
    body.file && typeof body.file === 'object' ? (body.file as Record<string, unknown>) : null;
  const file =
    rawFile && typeof rawFile.dataBase64 === 'string' && rawFile.dataBase64
      ? { name: str(rawFile.name), type: str(rawFile.type), dataBase64: rawFile.dataBase64 }
      : null;

  const result = await createSeriesSubmission({
    seriesName: str(body.seriesName),
    contactEmail: str(body.contactEmail),
    season: str(body.season),
    note: str(body.note),
    dataUrl: str(body.dataUrl),
    file,
    refToken: str(body.ref),
  });

  if ('error' in result) {
    const status = /failed:|not configured/.test(result.error) ? 502 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  // Best-effort notifications — never block or fail the accepted submission.
  const c = result.clean;
  await notifyNewSubmission({
    seriesName: c.series_name,
    contactEmail: c.contact_email,
    season: c.season,
    note: c.note,
    dataUrl: c.data_url,
    fileName: c.file_name,
  });
  await ackSubmission(c.contact_email, c.series_name);

  return NextResponse.json({ ok: true, id: result.id });
}
