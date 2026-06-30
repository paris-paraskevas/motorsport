// Shared wrapper for every outbound `fetch` in the data layer (scrapers,
// OpenF1, Wikipedia, ICS). It exists to fix two audit findings:
//
//   1. No timeout. A hung upstream (TCP connect that never completes, a server
//      that accepts the request then stalls) would block the server render
//      until the platform's own wall-clock killed the function — tens of
//      seconds of a spinning page. `AbortSignal.timeout(8000)` caps every call.
//
//   2. Silent failures. Callers historically did `catch { return [] }` with no
//      log, so a source breaking mid-season (UA block, layout change, 5xx) was
//      invisible. This wrapper emits a structured `console.warn` on a thrown
//      error or a non-ok response, so a broken feed shows up in the function
//      logs / observability without us having to notice blank UI first.
//
// FAIL-SOFT IS PRESERVED. The wrapper does NOT swallow — callers keep their
// existing `try/catch` + `if (!res.ok)` fail-soft (`return []`/`null`/`break`).
// Specifically:
//   - On a network/abort throw: log, then RETHROW. Every data-layer caller
//     already wraps the fetch in try/catch returning the soft value, so the
//     rethrow lands in that catch exactly as a raw `fetch` rejection would —
//     behaviour is identical, we just logged first.
//   - On a non-ok response (4xx/5xx): log, then RETURN the response. Callers
//     branch on `!res.ok` themselves (some `return null`, some `break` mid-
//     pagination, OpenF1's pacer inspects `res.status` for 429/503 retry).
//     Returning the response keeps every one of those control flows intact;
//     throwing here would change them (extra retries, lost partial pages). The
//     log is the only added effect.

/** Default per-request timeout. A real upstream answers well inside this; a
 *  hung connection is cut here instead of stalling the whole render. */
const TIMEOUT_MS = 8000;

/** Best-effort host extraction for log lines; never throws on a bad URL. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.slice(0, 80);
  }
}

/**
 * Structured warn for a swallowed upstream/data-store failure. Call this from
 * the silent `catch { return null/[] }` sites that don't go through
 * `fetchUpstream` (KV reads, Supabase ops) so they stop failing invisibly.
 *
 * @param key  short source identifier, e.g. "results-cache:read" or a host
 * @param err  the caught error (or any thrown value)
 */
export function logSourceError(key: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[source] ${key} failed: ${message}`);
}

/**
 * `fetch` for outbound data-layer calls. Adds an 8s timeout (merged with any
 * caller-supplied `signal`) and logs failures before surfacing them, while
 * preserving each caller's existing fail-soft handling — see the file header.
 *
 * All other init is passed straight through, so Next.js options
 * (`next: { revalidate }`), `cache`, `method`, `headers`, `body`, etc. behave
 * exactly as on a raw `fetch`.
 *
 * @returns the `Response` (even when `!res.ok` — logged first); throws only on
 *          a network error / timeout abort (logged first), as raw `fetch` does.
 */
export async function fetchUpstream(
  url: string,
  init?: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } },
): Promise<Response> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  // Merge the timeout with a caller-supplied signal (if any) so either aborts
  // the request; otherwise just use the timeout.
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal } as RequestInit);
  } catch (err) {
    // Network error or the timeout firing. Distinguish a timeout for the log.
    const timedOut = timeout.aborted;
    const detail = timedOut
      ? `timed out after ${TIMEOUT_MS}ms`
      : err instanceof Error
        ? err.message
        : String(err);
    console.warn(`[upstream] ${hostOf(url)} fetch failed: ${detail}`);
    throw err;
  }

  if (!res.ok) {
    console.warn(`[upstream] ${hostOf(url)} responded ${res.status} ${res.statusText}`);
  }
  return res;
}
