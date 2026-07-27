// OpenNext Cloudflare adapter config.
//
// Until 0.240.1 this passed `{}`, which leaves `incrementalCache` at the
// adapter's `"dummy"` default — i.e. NO page cache at all. Every request
// re-rendered the route (`x-nextjs-cache: MISS` on every hit, verified on prod),
// so each visitor paid the full render plus its data reads, and while an upstream
// was hanging, the 8s fetch timeout too (/series/f1/standings measured 9.34s TTFB).
//
// - incrementalCache: R2 (`NEXT_INC_CACHE_R2_BUCKET` → bucket `paddock-inc-cache`,
//   created with an `eeur` location hint to sit near the audience).
// - queue: the Durable Object queue, which is REQUIRED rather than optional here:
//   the default `"dummy"` queue THROWS `FatalError("Dummy queue is not
//   implemented")` from `queue.send`, and that is exactly what a stale ISR page
//   calls to schedule its background revalidation. With a real cache and no
//   queue, every stale page would hit that throw. `DOQueueHandler` is already
//   re-exported from `worker.ts`; it needs the `WORKER_SELF_REFERENCE` service
//   binding to call back into this worker.
//
// Docs: https://opennext.js.org/cloudflare/caching
// COST: R2's free tier is 10 GB storage / 1M Class A (writes) / 10M Class B
// (reads) per month, no egress charge (developers.cloudflare.com/r2/pricing,
// checked 2026-07-27). Storage is a non-issue — the whole build cache is 134 MB.
// Operations are what to watch, so the regional cache below sits in front of R2
// and absorbs reads ("reduce[s] amount of requests being sent to object
// storage", opennext.js.org/cloudflare/caching); `long-lived` re-uses an ISR
// entry for up to 30 minutes per region. Writes only happen when a stale page is
// actually requested, so Class A can't exceed the number of ISR page requests —
// the free tier holds until the site serves ~1M page views a month.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  queue: doQueue,
});
