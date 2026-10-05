import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

type EdgeCache = { purge?: (options: { tags: string[] }) => Promise<unknown> };

async function purgeEdgeTags(tags: string[]): Promise<boolean> {
  try {
    const ctx = getCloudflareContext().ctx as unknown as { cache?: EdgeCache };
    if (typeof ctx.cache?.purge !== 'function') return false;
    await ctx.cache.purge({ tags });
    return true;
  } catch {
    return false;
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The loader runs on GitHub Actions and cannot call revalidatePath itself, so
// after a successful load it asks the Worker to: POST { paths } here with the
// cron secret, and the ISR entries for those routes are dropped inside the
// Worker, where revalidatePath works (proven by the page-layout route since
// 0.255.0). Without this call the pages still refresh on their own window
// (series tabs 1200 s); this only shortens the wait after new data lands.
//
// Cron-auth'd and fail-closed like every /api/cron route (lib/cron-auth.ts).
// Paths only: root-relative, no query string, no protocol, at most MAX_PATHS.

const MAX_PATHS = 50;
const PATH_RE = /^\/[A-Za-z0-9._~\-/]*$/;

/** Keep the root-relative paths, deduplicated, capped; drop everything else. */
export function pickPaths(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const p of input) {
    if (typeof p !== 'string' || p.length > 200 || !PATH_RE.test(p) || p.includes('//')) continue;
    if (!out.includes(p)) out.push(p);
    if (out.length >= MAX_PATHS) break;
  }
  return out;
}

export async function POST(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);
  let body: { paths?: unknown };
  try {
    body = (await req.json()) as { paths?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }
  const paths = pickPaths(body?.paths);
  if (!paths.length) {
    return NextResponse.json({ ok: false, error: 'paths required: root-relative, no query, at most 50' }, { status: 400 });
  }
  for (const p of paths) revalidatePath(p);
  // PF2: the cache in front of the Worker (Workers Cache) keeps a copy of each page under the tag path:<pathname>
  // (worker.ts); purging those tags makes the loader's refresh visible at once instead of at the window's end.
  // Best effort: the purge rides on the Worker's execution context where the runtime offers it, and a refusal never
  // fails the revalidation.
  const edgePurged = await purgeEdgeTags(paths.map(p => `path:${p}`));
  return NextResponse.json({ ok: true, revalidated: paths, edgePurged, at: new Date().toISOString() });
}
