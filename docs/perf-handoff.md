# Paddock Tracker: making the site fast

A handoff for the Claude Code session that will do the work. It says what is slow, why, and how to fix it in a fixed order, one PR at a time, with a measurement before and after each step.

**Sources.** Code facts come from `paris-paraskevas/motorsport` at `origin/main` 512ac6d (1.0.243, Fri 2 Oct 2026). The numbers come from `docs/perf-baselines.md` (latest entry 1 Oct), `open-next.config.ts`, `wrangler.jsonc`, `worker.ts`, `next.config.ts`, `lib/fonts.ts`, `lib/cache-headers.ts`, `middleware.ts` and each route's exports. The live site could not be measured from the session that wrote this, so Phase 0 measures it first.

## Read this first (for Claude Code)

The repo's `CLAUDE.md` laws apply to every step here. In short:

- Never push to `main`. Branch from the latest `main`, open a PR, review the preview, squash-merge. Use conventional commits whose body explains the why. No `Co-Authored-By` and no Claude attribution.
- Every PR carries `CHANGELOG.md`, `RELEASES.md`, a `package.json` version bump, and its entry in `docs/pull-requests.md`.
- Never weaken a failing check.
- Never delete files or branches, or run `git reset --hard` or `git checkout -- <file>`, without pasting what would be lost and getting the operator's word.
- New files need the operator's word: name, format, purpose.
- Prod Supabase writes only on an explicit "apply <id>".
- Every PR quotes the Worker dry-run size against the 80% alarm of the 64 MiB ceiling.
- A route file leaves only behind a parity check pasted in the PR.

Every step below has a **gate**. Stop at the gate, show the numbers, and wait for the operator's word before the next step. Measure on the testing Worker (`testing.paddock-tracker.com`, `wrangler.testing.jsonc`, `npm run deploy:testing`) before prod, then on prod right after the deploy. Append every measurement to `docs/perf-baselines.md` (append-only, dated).

## What is already fixed (do not redo)

- **The page cache:** R2 incremental cache plus regional cache, in place since 0.240.1. Before that, every request rendered.
- **The tag cache:** Durable Object sharded, since 0.255.0, so `revalidatePath` and `revalidateTag` now work on prod.
- **OpenNext cache interception:** `enableCacheInterception: true` since 1.0.203. On the home, p90 TTFB went from 1.7 s to 0.37 s.
- **Calendar, news, session pages and designer pages** joined the cache in 1.0.224.
- **Home covers** are drawn through Wikimedia thumbnails (transfer 19 MB → 2.2 MB).
- **Sentry** removed (1.0.230). AdSense and GA load with `lazyOnload`.

## The diagnosis

Three speeds, from `docs/perf-baselines.md`:

| Case | When it happens | TTFB measured |
|---|---|---|
| Cached page, warm Worker | someone visited recently in that region | 0.2–0.4 s |
| Fresh render | first visitor of a 5-minute window, or a dynamic route | 1–4 s (12 s for an F1 session page on a fresh Worker) |
| Cold Worker | first request after the isolate went idle | about 3 s before anything (2.96 s and 3.52 s on testing; Seobility saw 2.17–2.26 s) |

With about 20 users, the Worker is idle most of the time, so most visitors land in the second or third row. The causes, in order of how much they cost a real visitor:

1. **One 39 MB Worker serves everything.** The dry run is 39.5 MB raw, 8.6 MB gzipped (60% of the ceiling). It carries the reader pages, the whole designer system (`lib/design/*`, `app/(admin)`, `app/api/admin/*`) and the 13 cron schedules (`worker.ts` `CRON_JOBS`, invoked by fetching `https://paddock-tracker.com/api/cron/<job>`). Starting an isolate for that script is the cold cost.
2. **Nothing caches in front of the Worker.** The Worker runs on the zone's routes (`paddock-tracker.com/*`), and as far as is known Cloudflare's CDN cache does not store a Worker's own responses. `s-maxage` on a page therefore does nothing at the edge, and every request, hit or miss, boots the big Worker. *Verify this in Phase 2, step 1.*
3. **Articles are never cached.** `app/(app)/blog/[slug]/page.tsx` is `force-dynamic` only for the admin's scheduled-post preview (`currentAccount()`).
4. **Short windows.** Home, series, weekend and session pages use `revalidate = 300`. At low traffic, the first visitor of each window in each region pays the render.
5. **The lead image.** `next.config.ts` has `images: { unoptimized: true }`. Covers are hot-linked from `upload.wikimedia.org`, and a PNG stays a PNG (896 KiB on 28 Sep, mobile LCP 11.7 s).
6. **JavaScript and HTML weight.** The home loads 14 script files, 811 KiB raw / 256 KiB on the wire, 314 KiB unused; there are 154 `"use client"` modules. `/calendar` is 442 KB of HTML plus 353 KB of flight data.
7. **Fonts.** Plex Sans (latin, latin-ext, greek) and Newsreader are preloaded, about 375 KB.
8. **Cold-render data reads.** `app/(app)/layout.tsx` calls eight designer loaders (`loadNavLists`, `loadAuthzSchemes`, `loadSearchHints`, `loadApplicationDefinition`, `loadTextMessages`, `loadSettings`, `loadThemeSet`, `loadAppearance`). Each hits Supabase and is remembered only 60 s per isolate (`MEMO_MS = 60_000`).

Targets, from `docs/perf-baselines.md`: TTFB under 0.8 s, LCP under 2.5 s, CLS under 0.1, INP under 200 ms, PSI mobile at least 90.

## Phase 0: measure (no product code)

**Goal.** Numbers to judge every later step against, and the facts the later phases depend on.

**Steps.**

1. Run the script below against prod and testing, from the operator's machine or a session with network access to the site. Run it three times: once after the site has sat idle for 15 minutes (cold), then twice in a row (warm). It is a scratch script; committing it as `scripts/perf/ttfb.sh` needs the operator's word.
2. Record **Worker startup time.** `wrangler deploy` prints "Worker Startup Time" for the uploaded script. Get it for the current build with `npx wrangler deploy --dry-run` or from the last deploy log. If the dry run doesn't print it, quote the number from the most recent real deploy.
3. **What makes the Worker 39 MB.** Build with `DATA_SOURCE=db npm run cf:build`. List the largest inputs of `.open-next/server-functions/default/` and `.open-next/worker.js` by package and by app directory (an esbuild metafile, or `du` on the output plus a source-map explorer). Report the top 20: how much is Next itself, `lib/design` with `app/(admin)` and `app/api/admin`, the cron routes, `three`/`@react-three/*`, `leaflet`, `recharts`, `@dnd-kit/*`, `cheerio`, `web-push`, `node-ical`, `ical.js` and `remark`/`rehype`.
4. **Field data.** Ask the operator for PageSpeed Insights mobile and desktop for `/`, one article, `/series/f1/standings` and `/calendar`. Also ask for Cloudflare's Workers observability: requests, wall time p50/p90/p99 and CPU time for the last 7 days.

```bash
#!/usr/bin/env bash
# Usage: ./ttfb.sh https://paddock-tracker.com   (or https://testing.paddock-tracker.com)
# Prints TTFB, size and the cache headers for each page, three requests in a row.
BASE="${1:-https://paddock-tracker.com}"
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36'
PAGES=(/ /series/f1 /series/f1/standings /series/f1/weekend/17 /calendar /news /drivers/kimi-antonelli /information /blog)
# Add one real article slug from /blog:
PAGES+=("${ARTICLE:-/blog}")
for p in "${PAGES[@]}"; do
  for i in 1 2 3; do
    curl -s -o /dev/null --compressed -A "$UA" -D /tmp/h.txt \
      -w "$p  #$i  ttfb=%{time_starttransfer}s  bytes=%{size_download}  code=%{http_code}" "$BASE$p"
    printf '  %s  %s  %s\n' \
      "$(grep -i '^x-opennext-cache:' /tmp/h.txt | tr -d '\r')" \
      "$(grep -i '^cf-cache-status:' /tmp/h.txt | tr -d '\r')" \
      "$(grep -i '^cache-control:' /tmp/h.txt | tr -d '\r')"
  done
done
```

**Gate.** Paste into `docs/perf-baselines.md`:

- the cold and warm table
- the startup time
- the top-20 size breakdown
- the field numbers

The operator picks the order of Phases 2 and 4 from these. If startup time is small (under ~300 ms) but cold TTFB is still about 3 s, the cold cost is Next's first render path and the first R2 read, not script size. Phase 2 still helps; Phase 4 helps less.

## Phase 1: cache the articles (PR A, small)

**Goal.** Articles answer from the cache like the home does. They are the pages that search and shares send people to.

**Why it's safe.** The only reason for `force-dynamic` is the admin preview of unpublished posts. Next's Draft Mode exists for exactly this: a route stays static or ISR for everyone, and renders per request only when the draft cookie is present. OpenNext's cache interception already skips requests that carry preview cookies (see the comment on `enableCacheInterception` in `open-next.config.ts`).

**Steps.**

1. In `app/(app)/blog/[slug]/page.tsx`, replace `export const dynamic = 'force-dynamic'` with `export const revalidate = 3600`. Keep `generateStaticParams` returning the MDX slugs, or `[]` for DB posts. The route must export it so the prerender manifest knows the route.
2. Make the preview branch depend on `draftMode()` instead of `currentAccount()` at render. Only when `(await draftMode()).isEnabled` is true, read `currentAccount()` and allow unpublished posts. Otherwise a non-live post returns `notFound()` exactly as today for readers.
3. Add a route handler that turns preview on: for example `app/api/preview/route.ts` (a new file, so it needs the operator's word). It checks the admin with `currentAccount()`, calls `(await draftMode()).enable()` and redirects to the post. Add a second handler, or a query flag, to disable it.
4. Point the Studio's "Preview" links (`components/studio/*`, `components/blog/DraftPreview.tsx`) at that handler.
5. On publish, revalidate the post. Find where publishing happens (`lib/blog-notify.ts`, `lib/notify-blog.ts`, the `publish-posts` cron route, the Studio API) and call `revalidatePath('/blog/<slug>')`, `revalidatePath('/blog')` and `revalidatePath('/')` if they don't already.
6. Check the share counts and reactions (`BlogReactions`, `BlogShare`). They are client components and fetch on their own, so a cached article still shows live counts. If any server-side per-visitor value is rendered into the article, move it to the client island.

```typescript
// app/(app)/blog/[slug]/page.tsx: sketch of the preview branch, not run against the repo
import { draftMode } from 'next/headers';

export const revalidate = 3600;

async function previewAllowed(): Promise<boolean> {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return false;            // readers: cached path, no cookies read
  const account = await currentAccount();  // only admins ever reach this line
  return account?.role === 'admin';
}
```

**Acceptance.**

- On testing, two requests to a live article: the second answers `x-opennext-cache: HIT` and `cache-control` carries `s-maxage`.
- An unpublished post still 404s for a signed-out reader.
- An admin who opens preview sees the post with its banner.
- Publishing a scheduled post makes it appear within the regional cache's 5 s tag window.
- TTFB for the article before and after goes into the baselines.

**Rollback.** Revert the PR; the route goes back to `force-dynamic`.

## Phase 2: a small cache Worker in front (PRs B and C, the biggest win)

**Goal.** A cached page answers in tens of milliseconds even when the big Worker is cold. The big Worker only boots for cache misses, signed-in visitors, APIs and the admin.

### Step 1: verify the platform facts (no code)

Before designing, confirm these against current Cloudflare and OpenNext docs, and quote the pages in the PR:

- Does Cloudflare's CDN cache a Worker's own responses on a route? The expected answer is no: a Worker runs before the cache, and only its subrequests (`fetch`) or the Cache API store responses.
- Cache API scope. `caches.default` is per data centre, and `cache.delete` clears one data centre only. Can a zone purge (by URL, tag or prefix, on the zone's plan) clear Cache API entries?
- The alternative design. The front Worker fetches the app through a hostname with `fetch(url, { cf: { cacheEverything: true, cacheTtl } })`, which stores responses in the real CDN cache and can be purged zone-wide. Does that work when the origin is another Worker on the same zone? It needs a separate hostname for the app (for example `app.paddock-tracker.com`) or a route the front Worker doesn't own.
- OpenNext's "automatic cache purge" (`cachePurge` in `open-next.config.ts`; the generated worker already exports `BucketCachePurge`). What does it purge, and does it fit either design?

**Gate.** The operator picks a design: A, Cache API with a service binding (simplest, purge per data centre plus short TTL); or B, CDN cache via a subrequest (zone-wide purge, more setup).

### Step 2: build the front Worker (PR B)

A new, separate Worker project, for example `edge/` in the repo with its own `wrangler.edge.jsonc` (new files, so they need the word). It is plain TypeScript with no Next, a few KB. Design A is sketched below; design B swaps the cache calls for a `fetch` with `cf` options.

**What it caches.**

- `GET` and `HEAD` only.
- HTML navigations only at first: no `RSC` header and no `_rsc` query. The Next router's RSC requests vary on several headers (`RSC`, `Next-Router-State-Tree`, `Next-Router-Prefetch`, `Next-Url`), so pass them through until a second PR handles them on purpose.
- No `pd-session` cookie (also `pd-session.*`), and no `__prerender_bypass` or `__next_preview_data` cookie.
- Paths not under `/api`, `/admin`, `/sign-in`, `/sign-up`, `/settings`, `/social`, `/studio`, `/preview`, `/feedback` or `/threads`, and not the `dev.` host.
- Only a response that is 200, carries `s-maxage`, and has no `Set-Cookie`. The middleware adds Set-Cookie only for sessions, which are already bypassed, but check anyway.

**Cache key.** The URL with tracking parameters removed (`utm_*`, `fbclid`, `gclid`, `mc_*`), with the remaining query sorted. Keep real parameters: `/calendar?series=f1` is a different page through the `/__view` rewrite.

**Freshness.** Store the time with the entry. Serve fresh entries directly. Serve stale entries (up to a day) at once, and refresh them in the background with `ctx.waitUntil`. That gives every visitor the cached speed, and the big Worker renders behind them.

**Headers out.**

- Keep the app's `cache-control` for browsers. `lib/cache-headers.ts` already turns it into `s-maxage=…, max-age=0, must-revalidate`.
- Add `x-edge-cache: HIT|STALE|MISS|BYPASS` so measurements can tell the layers apart.

**Everything else** passes straight through the service binding to the app Worker, untouched. That covers redirects, the middleware's rewrites, APIs and the cron calls to `/api/cron/*`.

```typescript
// edge/worker.ts: design A sketch, not run. The app Worker is bound as APP (service binding).
export interface Env { APP: Fetcher }

const BYPASS = /^\/(api|admin|sign-in|sign-up|settings|social|studio|preview|feedback|threads)(\/|$)/;
const TRACKING = /^(utm_|fbclid$|gclid$|mc_)/;
const SESSION = /(?:^|;\s*)(pd-session(?:\.[^=]*)?|__prerender_bypass|__next_preview_data)=/;
const MAX_STALE_S = 86_400;

function cacheKey(url: URL): Request {
  const u = new URL(url.toString());
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  return new Request(u.toString(), { method: 'GET' });
}

function sMaxAge(res: Response): number {
  const m = /s-maxage=(\d+)/.exec(res.headers.get('cache-control') ?? '');
  return m ? Number(m[1]) : 0;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const cacheable =
      (req.method === 'GET' || req.method === 'HEAD') &&
      !url.hostname.startsWith('dev.') &&
      !BYPASS.test(url.pathname) &&
      !req.headers.has('rsc') && !url.searchParams.has('_rsc') &&
      !SESSION.test(req.headers.get('cookie') ?? '');
    if (!cacheable) return tag(await env.APP.fetch(req), 'BYPASS');

    const cache = caches.default;
    const key = cacheKey(url);
    const hit = await cache.match(key);
    if (hit) {
      const age = (Date.now() - Number(hit.headers.get('x-edge-stored') ?? 0)) / 1000;
      const ttl = Number(hit.headers.get('x-edge-ttl') ?? 0);
      if (age <= ttl) return tag(hit, 'HIT');
      if (age <= ttl + MAX_STALE_S) {
        ctx.waitUntil(refresh(req, key, env, cache));
        return tag(hit, 'STALE');
      }
    }
    return tag(await refresh(req, key, env, cache), 'MISS');
  },
};

async function refresh(req: Request, key: Request, env: Env, cache: Cache): Promise<Response> {
  const res = await env.APP.fetch(new Request(req.url, { headers: req.headers, method: 'GET' }));
  const ttl = sMaxAge(res);
  if (res.status === 200 && ttl > 0 && !res.headers.has('set-cookie')) {
    const stored = new Response(res.clone().body, res);
    stored.headers.set('x-edge-stored', String(Date.now()));
    stored.headers.set('x-edge-ttl', String(ttl));
    // The Cache API needs a cacheable header on what it stores; the edge keeps it for the stale window.
    stored.headers.set('cache-control', `public, max-age=${ttl + MAX_STALE_S}`);
    await cache.put(key, stored);
  }
  return res;
}

function tag(res: Response, state: string): Response {
  const out = new Response(res.body, res);
  out.headers.set('x-edge-cache', state);
  out.headers.delete('x-edge-stored');
  out.headers.delete('x-edge-ttl');
  // What browsers see stays the app's own header; on a cache hit, put it back.
  return out;
}
```

The sketch leaves three things for the PR to settle:

- Restoring the app's browser `cache-control` on hits. Store it in its own header and put it back in `tag`.
- `HEAD` handling.
- A guard so a single slow refresh doesn't run many times at once.

**Wiring.**

- `wrangler.edge.jsonc` declares `routes` for `testing.paddock-tracker.com/*` first, and a service binding `APP` → `motorsport-testing`.
- The app Worker's own route for that host is removed in the same deploy. Two Workers can't own the same route pattern.
- The app keeps a `workers.dev` address, or no public route at all, and is reached only through the binding.
- The crons keep working because they fetch the public hostname, which now goes through the edge Worker and passes `/api/*` through.

**Acceptance on testing.**

- Five pages after 15 idle minutes answer `x-edge-cache: HIT` or `STALE` in under 0.3 s TTFB.
- Signed-in requests answer `BYPASS`.
- `/calendar?series=f1` and `/calendar` are different entries.
- `/api/cron/health` still runs.
- Redirects (`www`, legacy `?tab=`, `/series/<slug>/history`) still redirect.
- No `Set-Cookie` is ever served from the cache.
- The app Worker's request count drops in observability.

**Gate.** The operator reviews the testing numbers and the bypass list before prod.

### Step 3: invalidation and prod (PR C)

- **Purge on publish.** With design A, short TTLs (the page's own `s-maxage`) plus stale-while-refresh mean a publish shows within one window after the next visit. If the operator wants instant publishes, have the app call the zone purge API for the changed URLs on publish. That needs a Cloudflare API token as a Worker secret; name the variable and where it lives, never print it. With design B, the same call purges the CDN entries zone-wide.
- **Move prod.** Point `paddock-tracker.com/*` and `www.paddock-tracker.com/*` at the edge Worker. The app keeps `dev.paddock-tracker.com/*`, which is admin only and never cached.
- **Rollback.** Put the routes back on `motorsport` in `wrangler.jsonc` and deploy. Keep this one-line change written in the PR body.

**Acceptance on prod.**

- The Phase 0 script, cold and warm. Cold TTFB on cached pages under 0.5 s.
- Field TTFB in PSI under 0.8 s.

## Phase 3: longer windows, updated on change (PR D)

**Goal.** Fewer renders at all: pages change when data changes, not every 5 minutes.

**Steps.**

1. List what each cron route changes: `warm-sessions`, `warm-results`, `news`, `publish-posts`, `recheck-results`, `race-week`, `settle-markets`, `open-markets`. For each, list which pages show that data.
2. In each of those cron routes, compare the new data with what is stored (a hash). Only when it changed, call `revalidateTag` for a tag the affected pages use, or `revalidatePath` for each affected path. Today `revalidatePath`/`revalidateTag` appear only in the admin design routes and publishing.
3. Then raise the windows. Weekend, session, series tabs, driver and team pages go to `revalidate = 3600` or more. The home stays at 300 while a session is live, which only a short window covers, or gets its own tag from `warm-sessions`.
4. Check R2 Class A operations stay inside the free tier: `open-next.config.ts` notes 1M writes a month. A revalidation that fires every minute on unchanged data would burn them, hence the hash check.

**Acceptance.**

- Render counts per page per hour fall, which shows in observability as fewer requests that reach Next's render.
- A new result appears on its pages within one cron cycle.
- R2 operations for a day are quoted in the PR.

## Phase 4: make the Worker smaller (PRs E…, decided by Phase 0)

**Goal.** A faster cold start for everything that still reaches the app Worker: misses, signed-in visitors, APIs.

Do only what the Phase 0 breakdown justifies. In likely order:

1. **Crons out.** Move the cron jobs to a separate small Worker that calls the same data code, or keep them calling `/api/cron/*` but from the new Worker. This only shrinks the app if the cron-only modules (ingest, `cheerio`, `node-ical`, `web-push`, feed parsers) are not imported by any page. Prove it with the size breakdown before and after.
2. **Heavy client libraries out of the server bundle.** Client components are still server-rendered, so anything a page imports normally lands in the Worker. `GhostLap3D`, `TracksMapInner` and `SeasonTrendChart` already load through `next/dynamic`. Check that `three`, `@react-three/*`, `leaflet`, `recharts` and `@dnd-kit/*` don't reach the server bundle through another import (`components/f1/DeltaTrace.tsx`, `components/f1/onboard/*`, `components/data/ChartCanvas.tsx`, `lib/openf1/track-environment.ts`).
3. **The admin and designer.** Moving `app/(admin)` and `app/api/admin/*` to their own deployment is the large one. It may need a second Next app or OpenNext's function splitting; check whether `@opennextjs/cloudflare` supports splitting today before planning it. Plan this separately only if the breakdown shows it is a large share and Phase 2 hasn't already removed the felt slowness.

**Acceptance.** Each PR quotes the dry-run size and the startup time before and after, and the Phase 0 cold numbers for the routes that still reach the app.

## Phase 5: cheaper cold renders (PR F)

**Goal.** A fresh isolate doesn't make eight Supabase round trips before rendering.

**Steps.**

1. Combine the layout's eight designer loaders into one snapshot read: one query, or one RPC, returning nav lists, authz schemes, search hints, application, texts, settings, theme set and appearance.
2. Cache that snapshot across isolates, not per isolate. Use Next's data cache with a tag (`unstable_cache` with `tags: ['design-snapshot']`, or `'use cache'` with `cacheTag` if the project uses Next 16's cache components). The admin design routes already call `revalidatePath`/`revalidateTag` on save; make them revalidate `design-snapshot` too.
3. Keep the 60 s in-isolate memo as the first layer.

**Acceptance.**

- A cold render's server timing (the project's Debug trace) shows one design read instead of eight.
- A design change still shows within the tag window.

## Phase 6: page weight (PRs G…, overlaps the redesign)

1. **The lead image (PR G).** Store covers as WebP or JPEG at 500, 960 and 1280 px in the `MEDIA` R2 bucket when a post is published or its cover changes, and serve them from the site's own domain. Keep the Wikimedia thumbnail as the fallback, and keep the photo credit. Then:
   - give the LCP image `fetchpriority="high"`, explicit width and height, and `sizes`
   - stop the Flight payload preloading covers the home never draws (the `/blog` prefetch, noted in the baselines)
   - convert the existing posts' covers once; that is a content write, so get the operator's word
2. **Fonts.** The redesign's global layer replaces the Plex families and Newsreader with one Archivo variable file plus a Plex Sans Greek fallback that isn't preloaded. See `docs/redesign/mapping.md`, "The global layer". Until then, a quick win is to stop preloading Newsreader.
3. **JavaScript.** Follow the redesign's budgets: home ≤ 90 KiB of JS compressed, server components by default, islands only for live data. The current 314 KiB of unused JS is listed in the Lighthouse report's `unused-javascript` items. Start with the chrome's optional pieces behind dynamic imports, as the 1 Oct note in the baselines suggests.
4. **HTML.** Keep cutting what pages print. The calendar's next cut is the series table referenced by index, about 60 KB, noted in the baselines.

## Order and dependencies

| PR | What | Depends on | Expected effect |
|---|---|---|---|
| — | Phase 0 measurement | nothing | the numbers every gate needs |
| A | Articles cached (Draft Mode preview) | nothing | articles 1–3 s → cache speed |
| B | Front cache Worker on testing | Phase 0, design pick | cached pages fast even when the app is cold |
| C | Front Worker on prod, purge on publish | B | the felt slowness for most visitors gone |
| D | Revalidate on change, longer windows | the tag cache (in place) | far fewer renders |
| E… | Smaller app Worker | Phase 0 breakdown | faster misses and signed-in pages |
| F | One cached design snapshot | nothing | faster cold renders |
| G… | Covers, fonts, JS | redesign global layer for fonts and JS | mobile LCP toward 2.5 s, PSI toward 90 |

## Do not

- Cache any response for a signed-in visitor, any response with `Set-Cookie`, or anything under `/api`, `/admin`, `/settings`, `/social`, `/studio` or `/preview`.
- Purge everything on the prod zone without the operator's word.
- Change any slug or URL. Slug stability is a hard rule.
- Turn off `enableCacheInterception`, the R2 incremental cache, the DO queue or the DO tag cache. They are what makes the app's own cache work.
- Weaken a test to make a PR pass.

## Questions for the operator

1. Front-cache design A (Cache API, simplest) or B (CDN cache via a subrequest, zone-wide purge)? Decide after Phase 2 step 1.
2. Should publishing be instant everywhere (zone purge, needs a Cloudflare API token as a secret), or is "within the page's window" fine?
3. May the existing posts' covers be converted and stored in R2 (Phase 6)?
4. Is the admin and designer moving to its own deployment in scope this round, or only if Phase 0 shows it is most of the Worker?
