export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      now: new Date().toISOString(),
      node: process.version,
      env: process.env.VERCEL_ENV ?? 'unknown',
      region: process.env.VERCEL_REGION ?? 'unknown',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
