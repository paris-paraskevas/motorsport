import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Workers Cache's purge never throws: it resolves { success, errors } and a rate-limited call says success:false
// (developers.cloudflare.com/workers/cache/purge, read 2026-10-05).
type PurgeResult = { success?: boolean; errors?: Array<{ code?: number; message?: string }> };
type EdgeCache = { purge?: (options: { tags: string[] }) => Promise<PurgeResult | undefined> };
type WorkerContext = { cache?: EdgeCache; waitUntil?: (p: Promise<unknown>) => void };

// The Worker's regional tag answer is kept for 5 s (open-next.config.ts), so a request landing inside that window is
// still answered with the old page under a fresh s-maxage and the edge stores it again; a second purge once the window
// has passed catches that copy.
const SECOND_PURGE_DELAY_MS = 6_000;

function workerContext(): WorkerContext {
  try {
    return getCloudflareContext().ctx as unknown as WorkerContext;
  } catch {
    return {};
  }
}

async function purgeEdgeTags(ctx: WorkerContext, tags: string[]): Promise<boolean> {
  if (typeof ctx.cache?.purge !== 'function') return false;
  try {
    const result = await ctx.cache.purge({ tags });
    if (result?.success !== true) {
      console.error(`[edge-purge] refused for ${tags.length} tags: ${JSON.stringify(result?.errors ?? result ?? null)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[edge-purge] failed for ${tags.length} tags: ${err instanceof Error ? err.message : String(err)}`);
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
  const ctx = workerContext();
  const tags = paths.map(p => `path:${p}`);
  const edgePurged = await purgeEdgeTags(ctx, tags);
  if (edgePurged && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(
      new Promise<void>(resolve => setTimeout(resolve, SECOND_PURGE_DELAY_MS)).then(() => purgeEdgeTags(ctx, tags)),
    );
  }
  return NextResponse.json({ ok: true, revalidated: paths, edgePurged, at: new Date().toISOString() });
}
