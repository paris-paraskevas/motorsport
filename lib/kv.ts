import { Redis } from '@upstash/redis';

// The KV client, and the single seam through which every module reaches the
// store. Replaces `@vercel/kv`, which was a thin subclass of this same
// `@upstash/redis` client — its only dependency — reading the same
// KV_REST_API_* credentials. Dropping it is a library change, NOT a data
// migration: the store, the keys and the credentials are unchanged.
//
// Faithful to what @vercel/kv did, because these are not defaults:
//  - `cache: 'default'` — @upstash/redis defaults to `no-store`; Vercel's
//    wrapper overrode it on the Next team's recommendation, and changing it now
//    would silently alter every read's fetch caching.
//  - `enableAutoPipelining: true` — batches commands issued in the same tick.
//    Off by default upstream; leaving it off would multiply round trips to a
//    store that is already 180ms from the Athens colo.
//  - telemetry disabled.
//
// Deliberately NOT carried over: the four `*ScanIterator` helpers (verified
// unused), so this is a plain client rather than a subclass.
//
// Lazily constructed, exactly as @vercel/kv's default export was. Credentials
// are read on FIRST USE, not at import: most of the test suite imports modules
// that reach for `kv` without any KV env present, and a module-level
// `new Redis(...)` would throw at import time and take those suites down.

let client: Redis | null = null;

function resolve(): Redis {
  if (client) return client;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error('lib/kv: missing required environment variables KV_REST_API_URL and KV_REST_API_TOKEN');
  }
  process.env.UPSTASH_DISABLE_TELEMETRY = '1';
  client = new Redis({ url, token, cache: 'default', enableAutoPipelining: true });
  return client;
}

// A Proxy keeps every call site as `kv.get(...)` rather than `getKv().get(...)`,
// so swapping the import line was the whole change at each of the 14 consumers.
// `then` and `parse` are passed through untouched: without that guard, anything
// that awaits or inspects the object (a test's `await import`, a promise check)
// would trigger construction and throw on missing env.
export const kv = new Proxy({} as Redis, {
  get(target, prop, receiver) {
    if (prop === 'then' || prop === 'parse') return Reflect.get(target, prop, receiver);
    const value = Reflect.get(resolve(), prop, receiver);
    return typeof value === 'function' ? value.bind(resolve()) : value;
  },
}) as Redis;
