# Paddock — performance baselines

Time-series perf snapshot. **Append-only by date** — never overwrite prior rows; the trend is the point.

**Sources:**
- **Vercel Speed Insights** (field / Real Experience Score): `vercel.com/<org>/motorsport/speed-insights`
- **PageSpeed Insights** (lab / Lighthouse): `pagespeed.web.dev/?url=https://paddock-tracker.com/`

---

## 2026-10-06 — PF2 PR B: Workers Cache on the testing Worker (1.0.253)

The front cache (design D) measured with the perf file's ten-page script, three requests per page, from the operator's machine in Thessaloniki. The first test build (381f21ee) was made without `DATA_SOURCE=db` in the build's environment, which left the home and the series tabs dynamic (never cacheable) and stored OpenNext's one-second stale copies; the corrected build (83b8c266, deployed 23:33:01Z) prerenders the home again and never stores a STALE or regenerating answer. A HIT runs no Worker code.

Pass A (the fill, 00:00:01Z): / BYPASS/STALE 0.35 s, /series/f1 BYPASS/STALE 0.30 s, /series/f1/standings MISS/HIT 0.51 s, /series/f1/weekend/17 BYPASS/STALE 0.27 s, /calendar BYPASS/STALE 1.49 s, /news BYPASS/STALE 0.97 s, /drivers/kimi-antonelli HIT 0.34 s, /information HIT 0.64 s, /blog BYPASS/STALE 0.68 s; a STALE answer now says no-store (BYPASS, not stored) and the very next request is a fresh HIT from the Worker, stored (the revalidation landed within the second).

Pass B (warm, 00:00:48Z): every cacheable page HIT, 0.13 s–1.16 s over 27 hits (the article BYPASS, private: PF1).

Pass C (cold, after fifteen idle minutes, 00:16:18Z): 2 pages still HIT (/series/f1/standings 0.19 s, /information 0.28 s); the pages whose window had ended: / BYPASS/STALE 5.64 s → BYPASS/STALE 0.69 s → BYPASS/STALE 0.64 s; /series/f1 BYPASS/STALE 2.22 s → BYPASS/STALE 0.35 s → BYPASS/STALE 0.32 s; /series/f1/weekend/17 BYPASS/STALE 1.70 s → BYPASS/STALE 0.38 s → BYPASS/STALE 0.81 s; /calendar BYPASS/STALE 1.42 s → BYPASS/STALE 0.72 s → BYPASS/STALE 0.33 s; /news BYPASS/STALE 1.62 s → BYPASS/STALE 0.37 s → BYPASS/STALE 0.67 s; /drivers/kimi-antonelli BYPASS/STALE 1.64 s → BYPASS/STALE 0.39 s → BYPASS/STALE 0.64 s; /blog MISS/HIT 4.42 s → HIT/HIT 0.23 s → HIT/HIT 0.19 s.

The purge check on /series/f3 (00:00:05Z): fill MISS 2.95 s, warm HIT 0.15 s; POST /api/cron/revalidate answered edgePurged:true; the next request MISS at 1.35 s (a fresh render), then HIT 0.14 s; nine seconds later MISS 0.38 s with x-opennext-cache HIT (the second purge had removed the copy, the Worker answered from its fresh entry), then HIT 0.34 s and 0.34 s.

The STALE rule seen on every short-window page of pass A (x-opennext-cache STALE, Cache-Control no-store, Cf-Cache-Status BYPASS, then a fresh HIT) and on the home at 23:46Z before the chain (STALE no-store three times in 30 s, then x-opennext-cache HIT with s-maxage=245 stored). The populate of the corrected build stopped at 29 % (R2 writes answered 500 fourteen times, a Cloudflare-side fault of the night) and was re-run after the measurements; the ten pages rendered on demand meanwhile.

### Build 83b8c266 (the corrected build, DATA_SOURCE=db)

#### pass B warm (00:00:48Z)

| page | #1 | #2 | #3 | Cf-Cache-Status | OpenNext | cache-control |
|---|---|---|---|---|---|---|
| / | 0.20 s | 0.39 s | 0.80 s | HIT · HIT · HIT | HIT/HIT/HIT | s-maxage=293 |
| /series/f1 | 0.13 s | 0.14 s | 0.18 s | HIT · HIT · HIT | HIT/HIT/HIT | s-maxage=221 |
| /series/f1/standings | 0.23 s | 0.14 s | 1.16 s | HIT · HIT · HIT | HIT/HIT/HIT | s-maxage=1123 |
| /series/f1/weekend/17 | 0.25 s | 0.23 s | 0.14 s | HIT · HIT · HIT | HIT/HIT/HIT | s-maxage=247 |
| /calendar | 0.15 s | 0.13 s | 0.34 s | HIT · HIT · HIT | HIT/HIT/HIT | s-maxage=287 |
| /news | 0.16 s | 0.15 s | 0.36 s | HIT · HIT · HIT | HIT/HIT/HIT | s-maxage=289 |
| /drivers/kimi-antonelli | 0.15 s | 0.14 s | 0.36 s | HIT · HIT · HIT | - | s-maxage=1800 |
| /information | 0.20 s | 0.26 s | 0.36 s | HIT · HIT · HIT | - | s-maxage=3600 |
| /blog | 0.14 s | 0.36 s | 0.15 s | HIT · HIT · HIT | HIT/HIT/HIT | s-maxage=273 |
| /blog/f1-bahrain-grand-prix-2026-race-recap | 1.37 s | 1.49 s | 3.30 s | BYPASS · BYPASS · BYPASS | - | private, no-cache, no-store |

#### pass C cold (00:16:18Z)

| page | #1 | #2 | #3 | Cf-Cache-Status | OpenNext | cache-control |
|---|---|---|---|---|---|---|
| / | 5.64 s | 0.69 s | 0.64 s | BYPASS · BYPASS · BYPASS | STALE/STALE/STALE | no-store |
| /series/f1 | 2.22 s | 0.35 s | 0.32 s | BYPASS · BYPASS · BYPASS | STALE/STALE/STALE | no-store |
| /series/f1/standings | 0.19 s | 0.14 s | 0.49 s | HIT · HIT · HIT | HIT/HIT/HIT | s-maxage=1123 |
| /series/f1/weekend/17 | 1.70 s | 0.38 s | 0.81 s | BYPASS · BYPASS · BYPASS | STALE/STALE/STALE | no-store |
| /calendar | 1.42 s | 0.72 s | 0.33 s | BYPASS · BYPASS · BYPASS | STALE/STALE/STALE | no-store |
| /news | 1.62 s | 0.37 s | 0.67 s | BYPASS · BYPASS · BYPASS | STALE/STALE/STALE | no-store |
| /drivers/kimi-antonelli | 1.64 s | 0.39 s | 0.64 s | BYPASS · BYPASS · BYPASS | STALE/STALE/STALE | no-store |
| /information | 0.28 s | 0.23 s | 0.41 s | HIT · HIT · HIT | - | s-maxage=3600 |
| /blog | 4.42 s | 0.23 s | 0.19 s | MISS · HIT · HIT | HIT/HIT/HIT | s-maxage=266 |
| /blog/f1-bahrain-grand-prix-2026-race-recap | 2.78 s | 1.34 s | 1.48 s | BYPASS · BYPASS · BYPASS | - | private, no-cache, no-store |

### Build 381f21ee (the first build, without DATA_SOURCE=db)

#### pass A fill

| page | #1 | #2 | #3 | Cf-Cache-Status | OpenNext | cache-control |
|---|---|---|---|---|---|---|
| / | 6.89 s | 4.24 s | 2.85 s | BYPASS · BYPASS · BYPASS | - | private, no-cache, no-store |
| /series/f1 | 3.32 s | 0.21 s | 0.18 s | MISS · HIT · HIT | - | s-maxage=300 |
| /series/f1/standings | 2.23 s | 0.34 s | 0.31 s | MISS · HIT · HIT | HIT/HIT/HIT | s-maxage=313 |
| /series/f1/weekend/17 | 3.62 s | 0.20 s | 0.24 s | MISS · HIT · HIT | - | s-maxage=300 |
| /calendar | 2.16 s | 0.21 s | 0.42 s | EXPIRED · HIT · EXPIRED | STALE/STALE/STALE | s-maxage=1 |
| /news | 3.14 s | 0.20 s | 0.15 s | MISS · HIT · HIT | - | s-maxage=300 |
| /drivers/kimi-antonelli | 3.56 s | 0.22 s | 0.27 s | MISS · HIT · HIT | - | s-maxage=1800 |
| /information | 1.45 s | 0.19 s | 0.21 s | MISS · HIT · HIT | HIT/HIT/HIT | s-maxage=3123 |
| /blog | 1.65 s | 0.20 s | 0.32 s | MISS · HIT · EXPIRED | STALE/STALE/STALE | s-maxage=1 |
| /blog/f1-bahrain-grand-prix-2026-race-recap | 2.42 s | 1.81 s | 1.58 s | BYPASS · BYPASS · BYPASS | - | private, no-cache, no-store |

#### pass B warm (22:55:42Z)

| page | #1 | #2 | #3 | Cf-Cache-Status | OpenNext | cache-control |
|---|---|---|---|---|---|---|
| / | 2.97 s | 3.04 s | 2.94 s | BYPASS · BYPASS · BYPASS | - | private, no-cache, no-store |
| /series/f1 | 0.42 s | 0.37 s | 0.40 s | HIT · HIT · HIT | - | s-maxage=300 |
| /series/f1/standings | 0.23 s | 0.47 s | 0.16 s | HIT · HIT · HIT | HIT/HIT/HIT | s-maxage=313 |
| /series/f1/weekend/17 | 0.16 s | 0.48 s | 0.16 s | HIT · HIT · HIT | - | s-maxage=300 |
| /calendar | 1.21 s | 0.51 s | 0.64 s | EXPIRED · HIT · EXPIRED | STALE/STALE/HIT | s-maxage=257 |
| /news | 0.51 s | 0.18 s | 0.14 s | HIT · HIT · HIT | - | s-maxage=300 |
| /drivers/kimi-antonelli | 0.18 s | 0.13 s | 0.26 s | HIT · HIT · HIT | - | s-maxage=1800 |
| /information | 0.14 s | 0.49 s | 0.49 s | HIT · HIT · HIT | HIT/HIT/HIT | s-maxage=3123 |
| /blog | 1.35 s | 0.26 s | 0.43 s | EXPIRED · HIT · EXPIRED | STALE/STALE/STALE | s-maxage=1 |
| /blog/f1-bahrain-grand-prix-2026-race-recap | 1.67 s | 1.54 s | 1.71 s | BYPASS · BYPASS · BYPASS | - | private, no-cache, no-store |

#### pass C cold, after

| page | #1 | #2 | #3 | Cf-Cache-Status | OpenNext | cache-control |
|---|---|---|---|---|---|---|
| / | 4.50 s | 2.87 s | 2.78 s | BYPASS · BYPASS · BYPASS | - | private, no-cache, no-store |
| /series/f1 | 2.43 s | 0.18 s | 0.14 s | EXPIRED · HIT · HIT | STALE/STALE/STALE | s-maxage=1 |
| /series/f1/standings | 1.88 s | 0.48 s | 0.34 s | EXPIRED · HIT · EXPIRED | HIT/HIT/HIT | s-maxage=1 |
| /series/f1/weekend/17 | 3.22 s | 0.19 s | 0.30 s | EXPIRED · HIT · EXPIRED | STALE/STALE/STALE | s-maxage=1 |
| /calendar | 0.53 s | 0.14 s | 0.60 s | EXPIRED · HIT · EXPIRED | HIT/HIT/HIT | s-maxage=1 |
| /news | 1.38 s | 0.14 s | 0.28 s | EXPIRED · HIT · EXPIRED | STALE/STALE/STALE | s-maxage=1 |
| /drivers/kimi-antonelli | 0.14 s | 0.10 s | 0.19 s | HIT · HIT · HIT | - | s-maxage=1800 |
| /information | 0.47 s | 0.20 s | 0.15 s | HIT · HIT · HIT | HIT/HIT/HIT | s-maxage=3123 |
| /blog | 3.32 s | 0.34 s | 0.21 s | EXPIRED · EXPIRED · HIT | STALE/STALE/STALE | s-maxage=1 |
| /blog/f1-bahrain-grand-prix-2026-race-recap | 1.75 s | 1.46 s | 1.37 s | BYPASS · BYPASS · BYPASS | - | private, no-cache, no-store |


## 2026-10-06 — PF0: the field numbers (prod 1.0.252) and the Phase 0 tables

**Cloudflare Workers metrics, prod, the seven days to 2026-10-05 ~22:00Z (the operator's screenshots):** invocations 330.81k (+82.7 % on the week before), subrequests 5.56M (+300 %), asset requests 540.24k at a 94.77 % asset-cache hit rate; CPU time median 70 ms (+72.5 %), P50 158 ms · P90 1 s · P99 2 s · P999 3 s; wall time median 1.6 s (+121 %), P50 1 s · P90 5 s · P99 8 s · P999 15 s; request duration 899 ms (+132.8 %); memory P50 131.2 MB · P90 149.6 MB · P99 169.4 MB · P999 195.1 MB against the 128 MiB line, 17 errors, all "Exceeded Memory"; 32k client disconnects ("Cancelled") on 5 October. Subrequests by host: dzelqrtajnauunzmxfic.supabase.co 2M 2xx and 182k 5xx at 1.61 s each; adjusted-yak-124038.upstash.io 104k at 140 ms; paddock-tracker.com 13k (the crons' self-fetch) with 32 5xx; www.motorsport.com 5k; en.wikipedia.org 3k; calendar.google.com 2k. Requests by colo: Singapore 121k, Sofia 30k, Amsterdam 22k, Paris 15k, Mumbai 12k, San Jose 12k, Seattle 12k, Atlanta 6k.

**Zone analytics, the 24 h to 2026-10-05 ~22:00Z:** 253.56k requests, 248.2k served by Cloudflare's edge, 765 by the origin, 4.59k mitigated by managed rules; cache statuses None 145.58k · Hit 107.21k · Miss 763; GET 244.91k · POST 8.62k · HEAD 29; countries US 74.99k · Germany 74.84k · China 33.4k; browsers Chrome 102.83k · Unknown 94.67k · Edge 26.54k; HTTP/2 215.22k · HTTP/1.1 23.21k · HTTP/3 15.06k. The top addresses: 87.202.188.33 (12.87k; OTEnet, the operator's own line and this machine's checks), 2a01:4f8:c0c:fd3a::1 and 2a01:4f8:c0c:f4c0::1 (9.84k and 9.83k): both /64s are listed in Seobility's published crawler list (seobility.net/bots.json, read 2026-10-05 ~22:50Z; the block is Hetzner Cloud NBG1 per RIPE), so the night crawler of the two-bills reading is SeobilityBot, the site's own audits.

**PageSpeed Insights, prod, 2026-10-05 22:00Z (Lighthouse 13.5.0; mobile = Moto G Power on slow 4G; lab only, "no data" from real users yet):**

| page | mobile perf | FCP | LCP | TBT | CLS | SI | desktop perf | desktop LCP | desktop TBT |
|---|---|---|---|---|---|---|---|---|---|
| / | 72 | 2.0 s | 5.6 s | 20 ms | 0.128 | 3.4 s | 97 | 1.1 s | 80 ms |
| /calendar | 78 | 1.8 s | 4.7 s | 100 ms | 0 | 5.4 s | 95 | 0.9 s | 30 ms |
| /blog/f1-bahrain-grand-prix-2026-qualifying-recap | 83 | 1.7 s | 4.5 s | 50 ms | 0 | 2.8 s | 96 | 1.1 s | 10 ms |
| /series/f1/standings | 77 | 2.0 s | 4.8 s | 120 ms | 0.001 | 4.8 s | 90 | 1.0 s | 240 ms |

Accessibility 96–100, Best Practices 92 on all eight runs, SEO 100 (66 on /series/f1/standings: `noindex, follow` by design, R14). What the lab says: Lighthouse saw the document's first byte in 0–30 ms on every run (the pages answered from the Worker's cache interception), so the mobile LCP is the render path, not the server: the 26 KiB stylesheet blocks render for 600–950 ms on slow 4G; six or seven woff2 files sit on the critical path; the home's LCP image is a Wikimedia thumbnail discovered late (resource load delay 1,240 ms, 95 KiB JPEG at 864×540 for a 735×413 box); the calendar's and the standings' LCP element is the h1 with 1.9–2.5 s of element render delay; the standings page runs 1.7 s of JavaScript (the shared chunk 06es8zzmnhasg.js 1,175 ms, the chart chunk 277 ms). Three defects beside the numbers: the Content-Security-Policy blocks fundingchoicesmessages.google.com (the AdSense consent script) on every page; Wikimedia answered 429 for four thumbnails on the article run (hotlinked images); the home's h1 shifts 0.128 on mobile when its font arrives.

**Phase 0 of the perf file (the ttfb script, 5 Oct 2026 ~21:50–22:05Z, from the operator's machine in Thessaloniki; three requests per page):**

#### testing, cold (idle since ~19:10Z)

| page | #1 | #2 | #3 | code | x-opennext-cache | cache-control |
|---|---|---|---|---|---|---|
| / | 4.98 s | 1.48 s | 0.70 s | 200 | STALE | s-maxage=1, max-age=0, must-revalidate |
| /series/f1 | 1.68 s | 1.35 s | 0.39 s | 200 | STALE | s-maxage=1, max-age=0, must-revalidate |
| /series/f1/standings | 2.28 s | 1.71 s | 0.42 s | 200 | STALE | s-maxage=1, max-age=0, must-revalidate |
| /series/f1/weekend/17 | 2.17 s | 2.02 s | 0.44 s | 200 | STALE | s-maxage=1, max-age=0, must-revalidate |
| /calendar | 3.04 s | 1.28 s | 0.40 s | 200 | STALE | s-maxage=1, max-age=0, must-revalidate |
| /news | 0.53 s | 0.28 s | 0.33 s | 200 | STALE | s-maxage=1, max-age=0, must-revalidate |
| /drivers/kimi-antonelli | 2.28 s | 2.14 s | 0.66 s | 200 | STALE | s-maxage=1, max-age=0, must-revalidate |
| /information | 0.40 s | 0.41 s | 0.29 s | 200 | STALE | s-maxage=1, max-age=0, must-revalidate |
| /blog | 0.65 s | 0.24 s | 0.23 s | 200 | STALE | s-maxage=1, max-age=0, must-revalidate |
| /blog/f1-bahrain-grand-prix-2026-race-recap | 3.33 s | 1.32 s | 1.52 s | 200 | - | private, no-cache, no-store, max-age=0, must-revalidate |

#### prod, first pass

| page | #1 | #2 | #3 | code | x-opennext-cache | cache-control |
|---|---|---|---|---|---|---|
| / | 0.53 s | 0.21 s | 0.19 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /series/f1 | 0.51 s | 0.46 s | 1.54 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /series/f1/standings | 0.42 s | 0.43 s | 0.44 s | 200 | HIT | s-maxage=934, max-age=0, must-revalidate |
| /series/f1/weekend/17 | 11.58 s | 0.82 s | 0.48 s | 200 | STALE | s-maxage=1, max-age=0, must-revalidate |
| /calendar | 0.51 s | 0.53 s | 0.62 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /news | 0.66 s | 0.44 s | 0.49 s | 200 | HIT | s-maxage=165, max-age=0, must-revalidate |
| /drivers/kimi-antonelli | 0.60 s | 0.42 s | 0.42 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /information | 0.50 s | 0.43 s | 0.80 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /blog | 0.46 s | 0.44 s | 0.42 s | 200 | HIT | s-maxage=159, max-age=0, must-revalidate |
| /blog/f1-bahrain-grand-prix-2026-race-recap | 2.17 s | 1.77 s | 1.76 s | 200 | - | private, no-cache, no-store, max-age=0, must-revalidate |

#### testing, warm

| page | #1 | #2 | #3 | code | x-opennext-cache | cache-control |
|---|---|---|---|---|---|---|
| / | 0.58 s | 0.44 s | 0.86 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /series/f1 | 0.65 s | 0.55 s | 0.47 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /series/f1/standings | 0.51 s | 0.42 s | 0.21 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /series/f1/weekend/17 | 0.25 s | 0.19 s | 0.18 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /calendar | 0.28 s | 0.20 s | 1.23 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /news | 0.31 s | 0.33 s | 0.21 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /drivers/kimi-antonelli | 0.23 s | 0.23 s | 0.20 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /information | 0.17 s | 0.20 s | 0.17 s | 200 | HIT | s-maxage=3542, max-age=0, must-revalidate |
| /blog | 0.22 s | 0.18 s | 0.18 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /blog/f1-bahrain-grand-prix-2026-race-recap | 1.35 s | 1.32 s | 1.50 s | 200 | - | private, no-cache, no-store, max-age=0, must-revalidate |

#### prod, warm

| page | #1 | #2 | #3 | code | x-opennext-cache | cache-control |
|---|---|---|---|---|---|---|
| / | 0.46 s | 0.16 s | 0.18 s | 200 | HIT | s-maxage=135, max-age=0, must-revalidate |
| /series/f1 | 0.49 s | 0.47 s | 0.45 s | 200 | STALE | s-maxage=1, max-age=0, must-revalidate |
| /series/f1/standings | 0.42 s | 0.43 s | 0.43 s | 200 | HIT | s-maxage=880, max-age=0, must-revalidate |
| /series/f1/weekend/17 | 0.52 s | 0.56 s | 0.45 s | 200 | STALE/HIT | s-maxage=1, max-age=0, must-revalidate |
| /calendar | 0.50 s | 0.45 s | 0.45 s | 200 | HIT | s-maxage=126, max-age=0, must-revalidate |
| /news | 0.53 s | 0.79 s | 0.84 s | 200 | HIT | s-maxage=123, max-age=0, must-revalidate |
| /drivers/kimi-antonelli | 0.70 s | 0.91 s | 0.74 s | 200 | HIT | s-maxage=916, max-age=0, must-revalidate |
| /information | 0.75 s | 0.68 s | 0.63 s | 200 | HIT | s-maxage=3415, max-age=0, must-revalidate |
| /blog | 0.67 s | 0.77 s | 0.61 s | 200 | HIT | s-maxage=114, max-age=0, must-revalidate |
| /blog/f1-bahrain-grand-prix-2026-race-recap | 2.02 s | 1.74 s | 1.49 s | 200 | - | private, no-cache, no-store, max-age=0, must-revalidate |

Worker Startup Time (wrangler deploy): 40 ms on the X13 testing deploy of the 5th, 26 ms on B3’s; the dry run 40,360.82 KiB raw / 8,808.41 KiB gzip.

**The bundle:** handler.mjs 27.74 MiB of which .next/server/chunks 21.91 MiB (79.0 %) and node_modules/next 4.43 MiB (16.0 %); the server function 75.3 MiB on disk (handler.mjs 27.74, .next/server/chunks 20.80, node_modules/next 15.92, the metafile 2.10, app/(app) 1.84, content 1.67, data 1.40, react-dom 1.25); the dry run 40,360.82 KiB raw / 8,808.41 KiB gzip before PF2, 40,663.94 KiB after.

## 2026-10-01 — B2: the event-named races, the three tabs X6 B left (1.0.233)

X6 B (1.0.227) could only give a round's row a "Classification →" line where the race session page could answer, and three series could not: NASCAR and IndyCar name the race by the event, DTM's session page read the chart data. B2 chooses the race per weekend for the event-named series, keys IndyCar's results by date against the curated rounds, gives DTM its per-race source, and (on the operator's word after the reviewer's finding) curates the Honda Indy 200 at Mid-Ohio as IndyCar round 11, the later rounds renumbered 12–18. The three tabs take X6 B's shape; the race session pages of the three series show their tables.

**Method:** as X6's: `curl -s -o /dev/null -w '%{size_download}'` plain (the HTML), `--compressed` (the wire) and with `RSC: 1` (the flight payload), with a browser user agent, from Greece; the testing Worker on the PR's build before the merge, prod at 1.0.232 before and at 1.0.233 after (2026-10-01T13:32:12Z).

| tab | before (prod 1.0.232) | after, testing (the curated build) | after, prod 1.0.233 |
|---|---|---|---|
| /series/nascar-cup/results | 2,161,913 · 55,964 · 1,157,139 | 225,024 · 19,000 · 114,691 | 225,755 · 18,910 · 114,691 |
| /series/indycar/results | 826,895 · 29,417 · 442,454 | 155,861 · 16,791 · 78,447 (152,539 · 16,695 · 76,728 before Mid-Ohio's row) | 156,248 · 16,599 · 78,447 |
| /series/dtm/results | 590,939 · 27,564 · 313,680 | 136,568 · 15,911 · 68,171 | 136,955 · 15,815 · 68,171 |

The race session pages answer with their tables on prod: the Hollywood Casino 400 page 200 with its table, the Indianapolis 500 page 200 with its table, Mid-Ohio's race page 200 with its table and its weekend page 200 (“IndyCar · Honda Indy 200 at Mid-Ohio · Round 11”), round 18 200 (“IndyCar · WeatherTech Raceway Laguna Seca (Season Finale) ·…”), DTM's /series/dtm/weekend/1/race-2 200 with its table; the old Music City race address 404 (as named); the tabs' Classification occurrences 58 · 34 · 26 (two per earlier round), the IndyCar tab naming Mid-Ohio 3 times; every tab a cache HIT. The Worker: the dry run 39572.66 KiB / gzip 8600.58 KiB on B2's first build, 39523.55 / 8586.69 on the curated one (1.0.232: 39460.94 / 8574.37; 60% of the ceiling). The review page: https://claude.ai/code/artifact/75d8a7b2-0e2a-491d-8869-23f78265c7c4.

## 2026-10-01 — X9: the JavaScript count (1.0.230)

Seobility's page-speed check of the home ("This page loads 16 JavaScript files", Very important; the crawl of 29 September, id 16008487, read through the Seobility MCP). Two of the site's own files did nothing for a reader: the Sentry browser SDK, shipped without a DSN so it initialised to a no-op, and `app/error.tsx`, a boundary above both root layouts. Both left in 1.0.230 (#1112), and the last `@sentry/nextjs` import took the server SDK out of the Worker bundle with it.

**Method:** the page fetched with a browser user agent (so the edge injects Cloudflare's beacon, as Seobility sees it), its `<script src>` files counted; each of the home's own files fetched plain and `--compressed` for the raw and the wire bytes; the browser's list after idle (Playwright at 1440, the performance resource entries) quoted apart because it adds the router's prefetches of linked routes, Google's scripts and, right after a deploy, the previous build's stale chunk names; `wrangler deploy --dry-run` for the Worker; Seobility's live `seo_check` of the home for its own verdict.

| page | before (prod 1.0.229, 07:50Z): script files in the HTML | after, testing (08:55Z) | after, prod 1.0.230 (09:36Z) |
|---|---|---|---|
| / | 16 (15 ours + the beacon) | 15 (14 + 1) | 15 (14 + 1) |
| /series/f1/weekend/15/qualifying | 18 (17 + 1) | 17 (16 + 1) | 17 (16 + 1) |
| /calendar | 16 (15 + 1) | 15 (14 + 1) | 15 (14 + 1) |

| the home's own script files | before | after, testing | after, prod |
|---|---|---|---|
| files · raw · wire | 15 · 1,055 KiB · 336 KiB | 14 · 811 KiB · 256 KiB | 14 · 811 KiB · 256 KiB |
| the browser after idle (ours loaded · stale 404s) | 14 · 12 (prod, right after the morning's deploy) | 20 · 1 (the prefetches included) | after the windows: next session |

**The Worker:** `wrangler deploy --dry-run` Total Upload 41338.39 KiB / gzip 8982.35 (main at 1.0.229) → 39433.18 KiB / gzip 8564.55 (−1,905 KiB; 60% of the 64 MiB ceiling): the server SDK, OpenTelemetry and the database instrumentation that `app/global-error.tsx`'s import had kept since the 0.288.0 diet.

**Seobility's verdict:** the live single-page check of the home raises no JavaScript-files hint any more (testing at 09:00Z, prod at 09:38Z; 100–105 credits each); its page-speed section flags only the HTML response time (2.26 s on prod from Seobility's crawler, "performance_html_slow_crit"), the next thing to read beside X7's edge cache. The scores: 79 on prod (the home's three hints: a title word, duplicate headlines, the response time).

**Known and accepted:** the count is the bundler's (five framework files, the nomodule polyfill, three error boundaries, three for the chrome, one page chunk, one main entry); no Next config merges chunks; the next lever is the chrome's optional pieces behind dynamic imports, a throwaway build on the operator's word of ~09:10Z, the count reported before anything is built.

---

## 2026-10-01 — X6: page weight, three PRs (1.0.226, 1.0.227, 1.0.228)

Seobility's "Big HTML pages": `/changelog` 2.1 MB, the results tabs 1.1–2.4 MB, `/calendar` 532 kB. The App Router ships every server-rendered element twice, as HTML and again inside the inline flight payload, so a page weighs about twice its markup and folds hide but do not lighten; the lever was how much markup a page carries.

**Method:** `curl -s -o /dev/null -w '%{size_download}'` plain (the HTML), `--compressed` (the wire) and with `RSC: 1` (the flight payload), from Greece; the testing Worker on the PR's build before the merge, prod at 1.0.225 before and after each deploy.

**A — the changelog on pages of its own releases (#1108):** `/changelog` lists the releases with the newest release's 30 newest updates inline; every release has a page of its own (`/changelog/<label slug>`, prerendered at build, listed in the sitemap from a bundled release index).

| page | before (html · gzip · flight) | after, testing | after, prod |
|---|---|---|---|
| /changelog | 2,127,898 · 172,469 · 1,089,877 | 163,003 · 17,652 · 81,179 | 163,229 · 17,576 · 81,292 |
| /changelog/lights-out | 404 | 456,152 · 35,102 · 233,853 | 459,681 · 35,308 · 235,689 |
| /changelog/the-finishing-pass | 404 | 381,498 · 36,765 · 193,082 | 381,498 · 36,739 · 193,082 |
| /changelog/first-light | 404 | 49,925 · 11,206 · 22,475 | 49,925 · 11,193 · 22,475 |
| /changelog/no-such-release | 404 | 404 · 23,492 | 23,535 · 6,482 · 17,993 (404) |

**B — the results tabs: the latest round open, the earlier rounds one line each (#1109):** the latest round keeps its accordion, open; every earlier round is one line with "Classification →" to the race session page where that page can answer (F1, the class series, the series of `RACE_SESSION_SERIES`); a round without such a page keeps its closed accordion.

| tab | before | after, testing | after, prod |
|---|---|---|---|
| /series/nascar-cup/results | 2,383,067 · 59,230 · 1,276,083 | 2,162,042 · 56,515 · 1,157,139 | 2,161,913 · 55,964 · 1,157,139 |
| /series/motogp/results | 1,262,093 · 43,522 · 676,610 | 190,816 · 17,181 · 96,536 | 191,547 · 17,048 · 96,536 |
| /series/f1/results | 756,661 · 29,954 · 401,266 | 146,401 · 16,593 · 73,185 | 146,831 · 16,502 · 73,185 |
| /series/wec/results | 530,384 · 25,878 · 277,386 | 161,970 · 18,096 · 81,137 | 162,228 · 18,002 · 81,137 |
| /series/imsa/results | 481,653 · 28,475 · 249,709 (testing) | 145,095 · 17,275 · 71,892 | 145,482 · 17,233 · 71,892 |
| /series/gt-world/results | 1,146,361 · 46,684 · 600,214 (testing) | 282,585 · 20,990 · 143,538 | 283,574 · 20,590 · 143,538 |
| /series/f2/results | 1,173,920 · 39,360 · 625,210 (testing) | 219,925 · 18,355 · 112,229 | 220,570 · 18,245 · 112,229 |
| /series/indycar/results | 867,764 · 30,072 · 464,564 | 826,895 · 29,795 · 442,454 | 826,895 · 29,417 · 442,454 |
| /series/dtm/results | 590,622 · 27,357 · 313,405 | 590,982 · 27,954 · 313,680 | 590,939 · 27,564 · 313,680 |
| /series/wrc/results | 351,617 · 21,157 · 182,961 | 351,864 · 21,502 · 183,176 | 351,864 · 21,199 · 183,176 |

NASCAR, IndyCar and WRC name their race sessions by event and DTM's session page has no per-race source, so their rounds keep the accordion and their tabs their weight: a follow-up (B2, the weekend's main session as the race for NASCAR and IndyCar in the session page's classification rule) awaits the operator's word.

**C — the calendar's payload (#1110):** each entry carries its round and a short key; the round map keyed by the feed's ids and the ICS uids left the flight payload.

| page | before | after, testing | after, prod |
|---|---|---|---|
| /calendar | 544,891 · 54,510 · 454,014 | 442,552 · 43,456 · 352,739 | 442,552 · 43,446 · 352,739 (measured 06:45Z on the 1st in session 61, the edge cache hit; this cell replaces the placeholder written at the close of session 60, when the previous build’s entry of 544,934 was still served until its window ended) |

The plan's estimate for the calendar (a flight under 300 kB, the HTML under 400 kB) was optimistic by about 50 kB: the uids ran shorter than assumed and the rest is the sessions' own fields, which the views read. A further cut, not built: a table of the fifteen series referenced by index from each entry, about 60 kB more.

**The deploy window on prod:** the first request of /changelog after the deploy answered with the release list (the populate had landed before the switch); the measurement above is the request that followed.

**PSI:** the API's daily quota was spent on the anonymous key during the build; the operator's pagespeed.web.dev runs on mobile for `/changelog`, `/series/nascar-cup/results` and `/calendar` are the before-and-after Lighthouse record (the operator's home runs of 2026-10-01 00:11 local: 68 on mobile, 89 on desktop, the gap the emulated phone on slow 4G and the lead image).

---

## 2026-09-30 — X7: the session pages and the designer-made pages join the edge cache (1.0.224)

Two route families had never been in the cache: every session page (`/series/<slug>/weekend/<round>/<session>`) and every page the catch-all serves (`/calendar`, `/news`, a row page made in the designer). Both answered `Cache-Control: private, no-cache, no-store` and rendered per visitor. The cause was not a hidden request API but a missing export: a route without `generateStaticParams` is rendered dynamically whatever the page does, and the prerender manifest that OpenNext's cache interception keys on listed neither route. 1.0.224 adds `revalidate = 300` and an empty `generateStaticParams` to both (the drivers' and weekend pages' model) and drops the session route's `force-dynamic`.

**Method:** `curl -s -o /dev/null -D - -w '%{time_starttransfer}'`, twice per page in a row, from Greece; the first request the render (or a cold cache), the second the cache hit; the headers quoted are `cache-control` and `x-opennext-cache`. The testing Worker ran the PR's build before the merge; prod was measured at 1.0.223 just before the merge and at 1.0.224 right after the deploy (20:35Z, the first visit of each page on the new Worker).

**Testing Worker (testing.paddock-tracker.com), before → after:**

| page | before: cache-control · #1 → #2 | after: cache-control · #1 (cold, the populate running) → #2 | steady state, both HIT |
|---|---|---|---|
| /series/f1/weekend/15/qualifying | private, no-cache, no-store · 4.87 s → 2.28 s | s-maxage=300 · 12.10 s → HIT 0.25 s | 1.21 s → 0.19 s |
| /series/wec/weekend/6/6-hours-of-fuji-race | private, no-cache, no-store · 0.48 s → 0.27 s | s-maxage=300 · 3.57 s → HIT 1.41 s | 0.24 s → 0.22 s |
| /series/dtm/weekend/6/race-1 | private, no-cache, no-store · 0.54 s → 0.40 s | s-maxage=300 · 2.72 s → HIT 0.96 s | 0.18 s → 0.20 s |
| /calendar | private, no-cache, no-store · 3.06 s → 1.48 s | s-maxage=300 · 4.16 s → HIT 0.46 s | 0.29 s → 0.58 s |
| /news | private, no-cache, no-store · 0.71 s → 1.23 s | s-maxage=300 · 3.18 s → HIT 0.22 s | 0.43 s → 0.67 s |
| /history/monza (a 404 on the testing host) | private, no-cache, no-store · 0.26 s → 0.26 s | private (the 404's first render) 0.76 s → HIT 0.20 s | 0.22 s → 0.21 s |

**Prod (paddock-tracker.com), before (1.0.223, ~20:20Z) → after (1.0.224, ~20:35Z):**

| page | before: cache-control · #1 → #2 | after: cache-control · #1 (the first render on the new Worker) → #2 |
|---|---|---|
| /series/f1/weekend/15/qualifying | private, no-cache, no-store · 4.03 s → 0.54 s | s-maxage=300 · 3.28 s → HIT 0.33 s |
| /series/wec/weekend/6/6-hours-of-fuji-race | private, no-cache, no-store · 0.66 s → 0.53 s | s-maxage=300 · 5.29 s → HIT 0.36 s |
| /series/dtm/weekend/6/race-1 | private, no-cache, no-store · 0.69 s → 0.53 s | s-maxage=300 · 2.87 s → HIT 0.38 s |
| /calendar | private, no-cache, no-store · 4.05 s → 2.97 s | s-maxage=300 · 3.94 s → HIT 0.40 s |
| /news | private, no-cache, no-store · 1.07 s → 1.05 s | s-maxage=300 · 1.87 s → HIT 0.42 s |
| /history/monza (a 404 on prod too: the row page lives in the local design store alone) | private, no-cache, no-store · 0.26 s → 0.24 s | private (the 404's first render) 0.79 s → HIT 0.36 s |

**What to expect over time:** each of the ~1,800 session pages and every designer-made page renders once per five-minute window while visited, instead of once per visitor; the first visitor of a window pays the render (the OpenF1 analyses on an F1 page: 1–4 s, the first render on a fresh Worker slower still), everyone else in the window gets the edge answer (0.2–0.6 s). A not-found address under the catch-all is cached for the window as the drivers' are. Seobility's 1,813 medium-response pages and its 88 crawl errors (the per-request renders under its load) are the numbers to re-read on the operator's next crawl.

**Known and accepted (the plan's defaults, recorded in the ledger's X7 slot):** the five-minute window for sessions, no per-request exception for a running session; a single-page publish does not revalidate that page's `/__view/<state>/<path>` variants (up to 300 s stale); the FIA WEC `no-store` POST is reached only on an unseeded `results:wec` snapshot key, so that one render stays dynamic until the loader seeds the key.

---

## 2026-09-28 — R13 PR C2 measured on the testing Worker: OpenNext's cache interception

The Worker's answer, the second lever of the plan of 2026-09-28. `enableCacheInterception: true` in open-next.config.ts, built here with `DATA_SOURCE=db npm run cf:build` (without the variable in the build's environment the home's loaders fetch upstreams with no-store and `/` leaves the prerender manifest as a dynamic route, which the interceptor never touches; prod's build carries it, so `/` is ISR there: its prefetch payload is the full page, 125,921 bytes) and deployed to testing.paddock-tracker.com at 14:34Z (version f555ad91; the populate wrote 11,755 entries by 14:47Z under the testing prefix). The interceptor answers a page the prerender manifest knows (`/`, `/blog`, `/series/<slug>`, `/drivers/<slug>`, the archive and information pages) from the incremental cache in the routing layer, after the middleware and before Next's server; its answers carry `x-opennext-cache: HIT|STALE` and no `x-nextjs-cache`.

Twenty interleaved fetches from here, one second apart, testing against prod (curl, TTFB in seconds):

| Page | Testing (intercepted) p50 / p90 / max | Prod p50 / p90 / max | Prod's cache header |
|---|---|---|---|
| `/` (20 each) | 0.194 / 0.317 / 1.540 | 0.222 / 1.705 / 1.899 | 19 HIT, 1 STALE |
| `/series/f1` (10) | 0.212 / 2.546 / 2.546 (the first a MISS) | 0.390 / 0.871 / 0.871 | 8 HIT, 2 STALE |
| `/blog` (10) | 0.211 / 0.380 / 0.380 | 0.348 / 0.407 / 0.407 | 9 HIT, 1 STALE |
| `/calendar` (5, not interceptable) | 1.762 / 2.139 / 2.139 | 2.427 / 2.480 / 2.480 | none; `private, no-cache, no-store` |

The cold answer (the first request after the isolate went idle): 2.96 s at 14:48Z (13 minutes idle after the populate, `x-opennext-cache: HIT`) and 3.52 s at 15:03Z (11 minutes idle, STALE); the next request to `/calendar` 2.22 s and to `/` again 1.57 s (the queued revalidation of `/` in flight). The cold cost is the isolate's start of a 39 MB Worker and the first read of the cache, not Next's render: interception does not move it, and it is the cost Seobility met after a deploy (2.17 s).

The middleware on an intercepted page, checked on testing: `/calendar?series=f1` answers the filtered page through the `/__view` rewrite (200, 549,132 bytes against the plain page's 549,084); an `RSC: 1` request of `/` gets the RSC payload from the interceptor (`text/x-component`, 125,921 bytes, `x-nextjs-prerender: 1`); the router's prefetch of `/blog` is the same 95,202 bytes as prod's; a request with a bogus session cookie answers 200 with no Set-Cookie (the middleware ignores it either way); plain http on the testing host answers 200 as before (the R13 redirects name the apex only). The middleware's headers ride on an intercepted answer by the routing handler's own code (`applyMiddlewareHeaders` before the early return, @opennextjs/aws 4.1.0 routingHandler.js).

**What this says:** the cached pages answer a little sooner and far steadier (the home's p90 from 1.7 s to 0.3 s: a stale entry is served at once and revalidated behind, where Next's own path waited); the cold start stays; the `/calendar` control, which neither Worker can intercept, answers about 27% faster on testing than on prod at every percentile (p50 1.76 against 2.43), so part of the home, series and blog gap is a testing-versus-prod offset (the isolate's warmth, the path) rather than interception alone, and the real read is prod's own before and after once switched; the catch-all's pages (`/calendar`, `/news`) render per request at 1.5–2.5 s with `no-store`, although their rows say `cached` and the registry does too: the next lever, and a Debug-trace question of its own (in IDEAS). The prod switch is the operator's word; the dry run stood at 39235.19 KiB (gzip 8533.75).

**On prod (1.0.203, merged 18:26:52Z, live by 18:31Z; twenty fetches of the home and ten of three pages at 18:32–18:36Z):** the home answers `x-opennext-cache: HIT` with no `x-nextjs-cache`; `/` p50 0.215 s, p90 0.365, max 0.378 (the same afternoon before the switch: 0.222 / 1.705 / 1.899); `/series/f1` p50 0.355 (the first fetch a MISS at 2.4 s, the deploy's fresh cache); `/blog` p50 0.340; `/calendar`, not interceptable, p50 2.51 and p90 4.10 either way. The tail is what interception removed; the median was never the problem. The catch-all's per-request pages stay the next lever (IDEAS).

Raw: the session's scratchpad, `c2-ttfb-*.txt`, `c2-prod-after.txt`, `c2-deploy-testing.txt` (not committed).

## 2026-09-28 — the home on 1.0.201, after R13's PR C1 (the covers at the size their boxes need)

Run here at ~14:09Z, four minutes after the 1.0.201 deploy (#1083, merged 14:01Z), the same `npx lighthouse@12` through Playwright's Chromium as the baseline below, mobile and desktop, performance only. The page cache was warm (this machine's curl checks of the deploy came first), so the server-response row is the warm case, not the baseline's cold one; the cold case is C2's measurement.

| Metric | Mobile (Moto G Power, slow 4G sim) | Desktop |
|---|---|---|
| **Performance** | **68** (was 56) | **82** (was 74) |
| FCP | 2.0 s | 1.0 s |
| LCP | 11.7 s (was 13.6 s) | 2.8 s (was 3.7 s) |
| TBT | 95 ms (was 290 ms) | 0 ms |
| CLS | 0.124 | 0.004 |
| Speed Index | 3.2 s (was 6.5 s) | 1.3 s (was 2.4 s) |
| Server response (root document, warm cache) | 344 ms | 345 ms |
| Requests / total transfer | 62 / 2,183 KiB (was 75 / 19,419 KiB) | 73 / 2,599 KiB (was 85 / 20,112 KiB) |
| Images / transfer | 2 / 897 KiB | 6 / 1,306 KiB |
| JavaScript files / transfer | 21 / 734 KiB | 22 / 718 KiB |
| Unused JavaScript | 314 KiB | 315 KiB |
| Main-thread work / bootup | 2.1 s / 0.8 s | 0.5 s / 0.1 s |

**The LCP element, both runs:** the lead story's cover again, now `…/commons/thumb/7/76/Baku-F1-Street-Circuit-Openstreetmaps-rev1.png/960px-…png` at 896 KiB: the newest post's cover is a PNG map (a 1.1 MB original), and a PNG stays a PNG at Wikimedia's thumbnail service (252 KiB at 500, 896 KiB at 960). The mobile LCP's phases: TTFB 0.6 s, load delay 4.1 s, load time 6.5 s (the 896 KiB on the simulated 1.6 Mbps), render 0.5 s. A JPEG of the same map would be about a tenth; the cover's file is an editor's choice (in IDEAS), not this slot's.

**Seen in the desktop run's requests:** three 500 px covers the home never draws (the Baku map, the SkySat and the Tsolov covers, 372 KiB): the router prefetches /blog from the header's link, and React's Flight payload carries a preload hint for every eager `<img>` (the blog list's lead and its two eager rows), which the client preloads. Before this PR the same prefetch preloaded the originals. In IDEAS: the rows lazy from the second when a lead cover exists, or the link's prefetch on hover.

**What C1 changed, in the numbers:** the transfer 19.4 MB → 2.2 MB on mobile and 20.1 → 2.6 MB on desktop; "Properly size images" from the top opportunity to 424 KiB (the PNG); the Speed Index halved; the mobile LCP 13.6 → 11.7 s only, the PNG holding it; TBT 290 → 95 ms. **Next, C2:** the Worker's answer (OpenNext's cache interception on the testing Worker first), then the cold-cache server response measured again.

Raw reports: the session's scratchpad, `lh-c1-mobile.json` and `lh-c1-desktop.json` (not committed).

## 2026-09-28 — the home on 1.0.199, a Lighthouse 12 baseline for R13's PR C (the SEO check's response time)

Run here at ~09:24Z, four minutes after the 1.0.199 deploy, with `npx lighthouse@12` against `https://paddock-tracker.com/` through Playwright's Chromium (the PageSpeed API's keyless daily quota was spent by then; the operator's pagespeed.web.dev run stays the better lab number and belongs in this file when they paste one). The first request after a deploy meets a cold page cache (`s-maxage=300, must-revalidate`, no stale-while-revalidate), so the server-response numbers below are the cold case, the one Seobility met (2.17 s); warm hits from the same machine by curl measured 0.20–0.48 s an hour earlier.

| Metric | Mobile (Moto G Power, slow 4G sim) | Desktop |
|---|---|---|
| **Performance** | **56** | **74** |
| FCP | 2.2 s | 0.9 s |
| LCP | 13.6 s | 3.7 s |
| TBT | 290 ms | 0 ms |
| CLS | 0.125 | 0.004 |
| Speed Index | 6.5 s | 2.4 s |
| Server response (root document) | 2,150 ms | 1,640 ms |
| Requests / total transfer | 75 / 19,419 KiB | 85 / 20,112 KiB |
| JavaScript files / transfer | 20 / 734 KiB | 21 / 751 KiB |
| Unused JavaScript | 316 KiB | 315 KiB |
| Main-thread work / bootup | 4.1 s / 1.2 s | 0.9 s / 0.2 s |

**The LCP element, both runs:** the lead story's cover, `https://upload.wikimedia.org/wikipedia/commons/7/76/Baku-F1-Street-Circuit….jpg`, the original upload, not a thumbnail. Lighthouse's opportunities in order: "Serve images in next-gen formats" (4,860 ms mobile / 1,020 ms desktop), "Properly size images" (3,320 / 1,120 ms), "Reduce initial server response time" (2,151 / 1,641 ms), "Reduce unused JavaScript" (710 ms mobile). Nineteen to twenty megabytes of transfer for the home is the covers: the posts' hero images are Wikimedia originals (several megabytes each) drawn at 1200 px wide at most.

**The levers for PR C, in the order of the numbers:**
1. The covers' size: a Wikimedia original (`/wikipedia/commons/<a>/<ab>/<File>`) drawn through Wikimedia's own thumbnail service (`/wikipedia/commons/thumb/<a>/<ab>/<File>/1200px-<File>`, the width the layout needs; JPG and PNG), at the one place the posts' hero URL is read for the lead, the thumbnails and the cards; the same for the blog pages. No dependency, no proxy; a fallback to the original when a URL is not a Commons original. Expected: the transfer from ~20 MB to under 2 MB and the LCP from 13.6 s toward the 2.5 s target on mobile.
2. The server response on a cold cache: Next 16's `expireTime` (a stale-while-revalidate on ISR answers, Next core's `getCacheControlHeader`) so a visitor at expiry gets the stale page while the Worker revalidates; its effect on OpenNext's R2/regional cache to be tested on the testing Worker before prod, never assumed; then the home's own cold render cost (its source reads, timed with the Debug trace).
3. Unused JavaScript, 316 KiB: the home's client chunks (the Live band's countdown, the consent and analytics scripts, the developer toolbar's chunk for a signed-out reader?) listed from the report's `unused-javascript` items before any is touched.
4. CLS 0.125 on mobile: the cover's reserved box or a late font; from the report's `layout-shift-elements` before any change.

Raw reports: the session's scratchpad, `lh-home-mobile.json` and `lh-home-desktop.json` (not committed; 1.5 MB each).


## 2026-05-19

First baseline capture. Site is 4–5 days from public launch; Track A + 11 of ~18 Track B bundles shipped today (versions 0.10.23 → 0.10.34, 14 PRs). B-perf hasn't started yet — these are pre-work numbers.

### Vercel Speed Insights — Real Experience Score, last 7 days (May 13–19)

| Metric | Desktop | Mobile |
|---|---|---|
| **RES** | **95** (Great) | **76** (Needs Improvement) |
| FCP | 2.2 s | 3.67 s |
| LCP | 2.34 s | 3.67 s |
| INP | 48 ms | 80 ms |
| CLS | 0.06 | 0.11 |
| FID | 2 ms | 28 ms |
| TTFB | 1.63 s | 3.17 s |

**Routes — desktop, by RES bucket:**
- Great (≥ 90): `/series/[slug]` 100 (192 visits), `/changelog` 99 (31), `/impressum` 100 (25), `/series/[slug]/weekend/[round]` 100 (23), `/imprint` 100 (16), `/calendar` 97 (16), `/about` 99 (8).
- Needs Improvement (50–90): `/` **73** (211 visits) ← desktop offender.

**Routes — mobile:**
- Great: `/series/[slug]` 99 (41 visits), `/settings` 97 (18), `/calendar` 95 (4).
- Needs Improvement: `/` **67** (159 visits) ← mobile offender (same route on both platforms).

**Countries — desktop poor (RES < 50):**
- USA — 43 (91 visits)
- France — 36 (11)
- Germany — 35 (9)

**Countries — mobile poor:**
- France — 33 (3 visits)
- Philippines — 34 (3)

### PageSpeed Insights — desktop lab

**LCP critical path:** max 2,037 ms. Two CSS bundles block render to ~1.9–2.0 s:
- `paddock-tracker.com` — 1,187 ms (41.98 KiB)
- `css/d397e6bd08c1deec.css` — 2,037 ms (19.77 KiB)
- `css/9dae90f238ec9279.css` — 1,913 ms (1.63 KiB)

**Preconnect:** zero origins preconnected. Candidate: `clerk.paddock-tracker.com` → est. 90 ms LCP saving.

**Reduce unused JavaScript — total est. savings 616 KiB:**

| Bucket | Transfer | Unused | % of budget |
|---|---|---|---|
| Clerk SDK (1st-party via subdomain) | 288.4 KiB | 224.4 KiB | 36% |
| Other 1st-party chunks (`1270` / `4bd1` / `5838`) | 160.3 KiB | 72.6 KiB | 12% |
| AdSense (`show_ads_impl` + `adsbygoogle`) | 226.5 KiB | 157.2 KiB | 26% |
| Google FundingChoices (CMP) | 137.4 KiB | 97.8 KiB | 16% |
| Google Tag Manager | 154.3 KiB | 64.1 KiB | 10% |

Three Google scripts together = **52% of the unused-JS budget**. Clerk alone = **36%**.

**Long main-thread tasks:** 7 found (cut off at bottom of PSI screenshot — re-capture for full list next snapshot).

**Performance score:** not captured in screenshots this session — recapture.

### PageSpeed Insights — mobile lab

- **Best Practices:** 81
  - Failing: AdSense `lidar.js` uses deprecated `unload` event listeners (3rd-party — no action available).
  - Failing: Touch targets too small — footer links Release notes / Cookies / About / Accessibility / Imprint (`<a class="hover:text-text transition-colors duration-(--duration-fast)">`).
- **Accessibility:** 90
  - Failing: button without accessible name — mobile-header Coffee button (`<button class="inline-flex items-center gap-1.5 ..." >`). Needs `aria-label="Buy me a coffee"`.
- **Performance:** **not captured this snapshot.** Audit-doc pre-A4b values: Perf 39 / LCP 5.2 s / TBT 5340 ms / 661 KiB unused JS. Treat as stale until re-measured post-`0.10.27` ISR.

---

## 2026-06-21 — `/app` restored to static/ISR (0.37.1)

Lab / curl evidence; **field numbers pending** (capture PSI + Vercel SI ≥24–72 h post-deploy and append).

- **Build:** `/app` was `ƒ` (Dynamic) → now `○` (Static, 5 m ISR). Root cause: slice-2's JUST MISSED WEC podium triggered a `no-store` live-component fetch in the page render, forcing the whole route dynamic (`Cache-Control: private, no-store`, `X-Vercel-Cache: MISS`).
- **Prod TTFB before fix:** cold **~19.7 s**, warm ~1.0 s (vs `/calendar` 0.79 s — both ISR; `/calendar` + marketing edge-cache as `STALE`/`HIT`). After: `/app` should serve from edge cache like they do.
- **Fix:** JUST MISSED → CDN-cached route handler (`/api/just-missed`, `s-maxage=300`), client-fetched; the WEC live fetch + podium fan-out run off the static page path.
- **Still open:** content pages (`series/[slug]`, `weekend`, `[session]`, `drivers`, `teams`) remain `force-dynamic` — next caching PR. JS levers (Clerk ~224 KB for anon, AdSense/GTM `afterInteractive`) unaddressed.

## 2026-06-21 — pre-launch audit verification (prod 0.38.3)

Read-only prod verification of last session's PRs #145–#153 (caching / home-v3 / WeekendMedia / JS-defer). **All four areas pass.** Field RES re-baseline still **pending** — Vercel SI lags 24–72 h behind the #148/#150/#153 deploys; capture + append per the protocol below once settled.

**Edge-cache, verified on prod (`curl`, 2 passes each):** `/app`, `/series/f1/weekend/7`, `/drivers/*`, `/teams/*` all return `X-Vercel-Cache: STALE`/`HIT`/`MISS→HIT` with ISR headers (`public, max-age=0, must-revalidate`). **None are `no-store`/dynamic** — the #148 `/app` un-regression and #150 weekend/driver/team ISR are live and holding. Warm TTFB 0.21–0.32 s.

**`/api/just-missed` cold-start tail:** warm `HIT` 0.44 s, but **cold-on-cold MISS = 13.8 s** (vs the `/app` page itself now fast + static). Cause: the route fans out to full season-results fetchers (WEC live-component + MotoGP "re-fetches every round, no parser-level cache") whenever *both* its edge cache and the per-series `paddock:home:podium:*` KV cache are cold. Already mitigated for the common case (static page + lazy client-fetch + `s-maxage=300, swr=600` + KV podium cache) so the tail is rare; logged to IDEAS Inbox (fix candidates: cache-warm cron, or MotoGP parser-level cache).

**`/app` lab warm-load (Chrome PerformanceAPI, desktop 1440, reload):** TTFB 104 ms · FCP 312 ms · DCL 199 ms · load 326 ms · 76 requests (35 JS). `transferSize`/LCP not reliable from this capture (disk-cache + cross-origin TAO zero out bytes; LCP buffer empty) — byte/LCP numbers must come from PSI.

**GA4 after #153 `lazyOnload` (the key risk):** `googletagmanager.com/gtag/js?id=G-DDMJ2NMBWC` → 200; `window.gtag` is a function with a populated `dataLayer`; two `POST region1.google-analytics.com/g/collect …en=page_view` → **204** hits fired. Fresh visitor is in consent-**denied** mode (`gcs=G100`, `npa=1`, cookieless ping, no `_ga`) — correct Consent Mode v2 behavior. **`lazyOnload` did not break GA** (loads later, still fires). Custom CookieConsent modal is the active CMP (footer "Manage cookies" present; no Funding Choices UI). Consent-grant flip is unchanged by #153 (last verified 0.12.7).

**Console:** 0 errors on `/app` at both 390 and 1440 (1–2 benign warnings).

## 2026-06-23 — weekend page tabbed, heavy content deferred (0.61.0)

The race-weekend page (`/series/[slug]/weekend/[round]`, `● ISR`) was server-rendering everything on every cold render: schedule + weather + the standings **season-results fan-out** + the news feed. Now split into client tabs (Schedule | Bets | News | Sessions) — only Schedule (+ weather) renders with the page; the rest mount + fetch on first tab-open from cached route handlers (`/api/weekend/{news,standings}`, `s-maxage=300`).

**Local dev, F1 R8 (compiled, single render — dev has no ISR cache, so this is the raw per-render server cost):**
- **Page render: 0.66 s** (previously also paid standings + news inline).
- Deferred `/api/weekend/standings` cold: **3.1 s** (the season-results fan-out) — now only paid when the Sessions tab is opened.
- Deferred `/api/weekend/news` cold: 0.74 s — only on the News tab.
- Page HTML no longer contains the standings table (`"Standings at this round"` 0×) — deferral confirmed; page stayed `●` (ISR), not dynamic.

Net: a cold weekend page sheds ~**3–4 s** of upstream fan-out off its render path; the page stays ISR-cacheable and the deferred APIs are independently CDN-cached. **Field numbers pending** — capture PSI + Vercel SI ≥24 h post-deploy and append.

## 2026-07-09 — field re-baseline (Vercel Speed Insights, last 7 days Jul 2–9)

First field snapshot since the caching + defer work landed. **Both platforms improved on RES and TTFB vs the 2026-05-19 baseline, but CLS regressed on both and is now the primary systemic issue.**

| Metric | Desktop | Mobile | vs 2026-05-19 |
|---|---|---|---|
| **RES** | **98** (Great) | **81** (Needs Improvement) | ↑ from 95 / 76 |
| FCP | 1.35 s | 2.22 s | ↑ both |
| LCP | 1.91 s | 3.58 s | mobile still > 2.5 s target |
| INP | 40 ms | 72 ms | passing |
| **CLS** | **0.12** | **0.16** | ↓ **regressed** (was 0.06 / 0.11) — both now > 0.1 |
| FID | 3 ms | 31 ms | passing |
| TTFB | 0.59 s | 1.55 s | ↑↑ big win (was 1.63 / 3.17 s) |

**Headline:** the mobile TTFB collapse (3.17 → 1.55 s) validates the ISR/caching work. **CLS is the new offender — 0.12 desktop / 0.16 mobile, both above the 0.1 threshold and both worse than May.** It is the single systemic Core Web Vital to attack next.

**Routes — desktop:** Great: `/` 100 (141), `/blog` 100 (44), `/changelog` 100 (34), `/app` 94 (126), `/settings` 99 (15), `/series/[slug]/weekend/[round]` 96 (11), `/about` 100 (7). Needs Improvement: `/series/[slug]` 88 (21), `/calendar` 84 (6), `/settings/customize` 79 (9), `/settings/series` 75 (5), `/series/[slug]/[tab]` 55 (12). Poor: `/blog/[slug]` 48 (16), `/series/[slug]/weekend/[round]/[session]` 38 (8), `/social` 30 (10), `/sign-in` 30 (8), `/settings/notifications` 25 (3), `/drivers/[slug]` **1** (3 visits — outlier).

**Routes — mobile:** Great: `/changelog` 100 (25), `/` 97 (17), `/blog/[slug]` 100 (6), `/series/[slug]` 100 (4). Needs Improvement: `/app` 85 (56), `/drivers/[slug]` 88 (11), `/play` 78 (9), `/blog` 75 (8), `/series/[slug]/[tab]` 64 (14), `/series/[slug]/weekend/[round]` 55 (18), `.../[session]` 70 (7). Poor: `/feedback` 40 (7).

**Countries:** desktop — China 80 (3). Mobile — China 48 (6, Poor).

**Sample-size caveat:** the scary desktop "Poor" routes all have 3–16 visits, so one slow load skews them (`/drivers/[slug]` = 1 from 3 visits, yet mobile is 88). Reliable systemic signals: **CLS (both)** and secondarily **mobile LCP 3.58 s / TTFB 1.55 s**.

**→ NEXT-SESSION CLS hunt (queued).** CLS regressed since May. Suspects: (a) images/embeds without reserved `width`/`height` (May plan already flagged the Wikipedia History-tab `<img>`, rank 5); (b) late-injected UI shifting content — the Race Engineer chat launcher, banners; (c) web-font swap; (d) recently-added on-page bylines / enriched blocks. **PSI lab not captured this snapshot** — grab PSI desktop+mobile at the start of the CLS session for layout-shift attribution.

## 2026-08-03 — post-Cloudflare re-baseline (0.252.1 live during capture; first row of the Workers era)

First snapshot since the Vercel → Cloudflare migration (07-26/27). **Field source is GONE** (Vercel Speed Insights dep removed 0.245.1) — PSI reported "Discover what your real users are experiencing: No Data". **Replacement decision: Cloudflare Web Analytics RUM is ALREADY collecting** (this very report shows `static.cloudflareinsights.com/beacon.min.js` on the page), so the CF dashboard becomes the field source going forward; GSC CWV as the slow-moving cross-check.

### PSI lab — `/` (operator-run, pagespeed.web.dev, Lighthouse 13.4.1)

| Metric | Mobile | Desktop |
|---|---|---|
| **Performance** | **71** | **78** |
| FCP | 1.7 s | 0.5 s |
| **LCP** | **15.3 s** | 3.3 s |
| TBT | 60 ms | 20 ms |
| CLS | **0** | **0** |
| Speed Index | 4.9 s | 2.0 s |
| Accessibility | 96 | 100 |
| Best Practices | 96 | 96 |
| SEO | 100 | 100 |

**The May CLS problem is GONE (0 on both)** and TBT/unused-JS collapsed vs the May row (mobile TBT 60 ms; unused JS 616 KiB → 164 KiB — AdSense/GTM lazyOnload + the Cloudflare stack did their job; the only 3rd party left on the critical path is the 11 KiB CF beacon).

**The whole story is now ONE problem: the landing carousel images.** LCP breakdown (mobile): TTFB 10 ms · resource load 100 ms · **resource load delay 1,510 ms + element render delay 5,650 ms**. Causes, all in the landing hero/marquee carousel:
1. `/landing/circuits/*.jpg` are raw JPEGs totalling **4,112 KiB** (monaco 979 KiB, nordschleife 743, rally-finland 638…) served via `images: unoptimized` at ~1900px for ~500-700px slots. PSI est. savings **3,684-3,925 KiB** (WebP/AVIF + responsive sizes).
2. The LCP image is **`loading="lazy"`** and mounts at **`opacity-0`** with a 700 ms fade (`transition-opacity duration-700 … opacity-0`) — LCP counts the paint at full visibility, so the fade + lazy discovery alone add ~5.6 s of render delay.
3. No `fetchpriority="high"` / preload on the first slide; zero preconnects (fine — everything is 1st-party now).

**Queued fix bundle (one PR, est. mobile LCP 15.3 s → ~2.5-3 s):** convert the seven circuit JPEGs to properly-sized WebP (~150-250 KiB each), eager-load + `fetchpriority="high"` the first visible slide only, start slide 1 at full opacity (keep the fade for subsequent slides), add `sizes`. Cosmetic extras from the report: carousel dot touch-targets (a11y 96 mobile), the two non-composited `width` dot animations, `Array.prototype.at`-class polyfills (13 KiB legacy JS).

**Security headers flagged by PSI** (Best Practices 96): CSP is still report-only (by design — the promote-to-enforcing plan lives in `next.config.ts`), no COOP header. Unchanged since the audit; listed here so the trend row exists.

Context for trend readers: this row is NOT comparable to Vercel-era rows for TTFB/route-level RES (different platform, different field source, R2 ISR cache since 0.241.0). Treat 2026-08-03 as the new epoch line.

## 2026-08-06 — the landing-LCP delta row (0.267.1 live; 3 days after the 0.254.0 image bundle)

Operator-run PSI (pagespeed.web.dev, Lighthouse 13.4.1, Moto G Power / slow-4G mobile, captured 10:52 GMT+3). Field data still "No Data" (CrUX threshold — traffic, not tooling; CF RUM keeps collecting).

| Metric | Mobile | Desktop | vs 08-03 |
|---|---|---|---|
| **Performance** | **81** | **96** | 71 / 78 |
| FCP | 1.7 s | 0.5 s | 1.7 / 0.5 |
| **LCP** | **4.9 s** | **1.3 s** | **15.3 / 3.3** |
| TBT | 30 ms | 90 ms | 60 / 20 |
| CLS | 0 | 0 | 0 / 0 |
| Speed Index | 3.3 s | 1.2 s | 4.9 / 2.0 |
| Accessibility | 96 | 96 | 96 / 100 |
| Best Practices / SEO | 96 / 100 | 96 / 100 | unchanged |

**The 0.254.0 bundle worked: mobile LCP 15.3 s → 4.9 s (−68%), desktop 3.3 → 1.3 s** — short of the ~2.5-3 s estimate, and the report says exactly why the tail remains:

1. **The first-slide `opacity-0` fade still gates paint.** The LCP img in the report carries `fetchpriority="high"` AND `class="… opacity-0"` — the "start slide 1 at full opacity" part of the queued bundle didn't make it. Element render delay: 1,750 ms mobile / 5,480 ms desktop (desktop's number is inconsistent with its 1.3 s LCP metric — likely the fade-completion pass; recorded as reported). On mobile the LCP element is now the hero TEXT ("TRACKING 15 SERIES…"), i.e. the image has been demoted — good.
2. **`lemans.webp` is oversized for its slot**: 188.9 KiB at 1128-1275×853 for ~939×501 (mobile) / 596×318 (desktop) display. Est. savings 112 KiB mobile / 294 KiB desktop (incl. spa.webp 149 KiB → responsive `sizes`/srcset + a notch more compression).
3. Render-blocking CSS 23 KiB (820 ms on slow-4G mobile), 13 KiB legacy polyfills (`Array.prototype.at` class), 165 KiB unused JS in the shared chunks — all known shapes, smaller than before.

**Next lever bundle (small):** first-slide fade skip + `sizes` on the carousel images. Cosmetics re-flagged: carousel dot touch-targets (a11y 96), two non-composited `width` dot animations, CSP report-only / no COOP (unchanged, by design/backlog).

## 2026-08-24 — the admin clean-up bought back 653 KiB (0.334.27)

Deleting two read-only console pages moved the Worker from **19.35 KiB of headroom to 672.31 KiB** — 35× more room, and the single largest bundle change ever recorded here.

| | Gzipped | Spare against 10240 KiB |
|---|---:|---:|
| 0.334.24 (composer shipped) | 10220.65 KiB | 19.35 KiB |
| **0.334.27 (clean-up)** | **9567.69 KiB** | **672.31 KiB** |
| **Saved** | **652.96 KiB** | |

Removed: `/admin/traffic`, `/admin/search`, `/admin/tools`, `lib/analytics/{ga4,gsc,bing}.ts`, `scripts/verify-analytics.mts`, four dead `AdminUI` exports, and the `@google-analytics/data` + `@googleapis/searchconsole` dependencies.

**The saving is nearly double the 352 KiB estimated from chunk analysis**, because measuring the built chunks only counted what was attributed to those two routes — it missed the transitive `google-gax` / `@grpc` / `google-auth-library` trees that went with them. Worth remembering the next time a chunk measurement is used to size a removal: **it is a floor, not the answer.**

Why it was so expensive in the first place: both packages are **server** imports inside **server** components, so they land in the Worker script. Contrast `three` (25 MB installed), `recharts` (8.3 MB) and `leaflet` — all client-side behind `next/dynamic`, none of which touch the Worker at all.

## 2026-08-24 — Worker bundle ceiling, and how fast a published home layout goes live (0.334.24)

Two numbers this file did not previously carry. Both are operational ceilings rather than page metrics, and both were measured rather than assumed.

**Worker bundle — 19.35 KiB of headroom left.** `wrangler deploy --dry-run`, after the home composer:

| When | Gzipped | Spare against 10 MiB (10240 KiB) |
|---|---:|---:|
| 2026-08-21 (0.330.0) | 10176.64 KiB | 63.4 KiB |
| 2026-08-22 (0.333.1, session-32 close) | 10186.22 KiB | 53.8 KiB |
| **2026-08-24 (0.334.24)** | **10220.65 KiB** | **19.35 KiB (0.19%)** |

The jump is mostly `@dnd-kit`: it had been a dependency with **zero importers** since the 2026-08-18 orphan sweep deleted the home editor, so it was in `package.json` but never in the bundle. The composer's drag-to-reorder is its first real consumer. Operator decision to ship it with the number recorded (2026-08-24). **Measure before adding anything else** — `npm run deploy:testing` rejects harmlessly.

**Publishing a home layout appears within the ISR window, not the regional-cache window.** The open question was whether `withRegionalCache(..., { mode: "long-lived" })` in `open-next.config.ts:36` — which re-uses an ISR entry up to 30 minutes per region — would swamp `/app`'s 5-minute `revalidate`. It does not. Measured on prod by writing a published revision straight to `page_layout` and polling `/app` for the change:

| Change | Time to appear |
|---|---:|
| Pin a different lead post | 48 s |
| Revert to automatic | ~4 m 45 s |

Both **without** `revalidatePath`, so this is the natural ISR pickup and the honest worst case. The Publish button calls `revalidatePath('/app')` and should therefore be at or under these, but that path is unmeasured — it needs an admin session. The `revalidate = 60` fallback the plan held in reserve is **not needed**.

## 2026-08-20 — the PSI sweep: every major page (operator-run pagespeed.web.dev, Lighthouse 13.4.1; prod = 0.322.3 during capture)

First per-page lab baseline. Mobile = Moto G Power / slow-4G sim. The morning's landing-stream fix (0.321.2) had already landed; the sweep drove four fix packages: **#1 fonts 19→5 preloads + Redis-SDK-out-of-browser (0.322.4)** · **#2 tap targets + gtag/Clerk dispositions (0.322.5)** · **#3 standings chart CLS/defer + info-hub heading order (queued)** · **#4 LCP image pass + Serwist DataCloneError (queued)**. Re-measure the trio root/standings/weekend after #4 merges.

| Page | Perf M/D | LCP M/D | SI M/D | TBT M/D | CLS M/D | Page-specific finding → package |
|---|---|---|---|---|---|---|
| `/` | 76 / 94 | 6.3* / 1.2 s | 3.7 / 2.0 | 40 / 60 ms | 0 / 0 | Font over-preloading (19/660 KiB) → #1 SHIPPED |
| `/app` | 63 / 88 | 9.7* / 1.4 | 7.3 / 2.1 | 170 / 150 | 0 / 0 | Shared 3rd-party shell; footer targets → #2 SHIPPED |
| `/series/f1` | 59 / 94 | 9.8* / 1.4 | 8.1 / 1.5 | 190 / 50 | 0 / 0 | Shell only |
| `/series/f1/standings` | 41 / 84 | 10.4* / 1.4 | 7.8 / 2.5 | 650 / 200 | 0.134 / 0.011 | Trend chart mounts unreserved + 96 KiB chunk → #3 |
| `/series/f1/weekend/12` | 49 / 89 | 8.2* / 1.5 | 6.9 / 2.5 | 650 / 90 | 0.002 / 0.001 | Track-map SVG lazy LCP → #4 |
| `/series/f1/weekend/11/race` | 65 / 78 | 7.7* / 1.4 | 7.4 / 2.9 | 70 / 270 | 0.006 / 0.019 | force-dynamic TTFB 665 ms → unpark ISR with the AdSense enrichment |
| `/drivers/kimi-antonelli` | 67 / 91 | 8.5* / 1.5 | 6.9 / 2.1 | 90 / 0 | 0 / 0 | Wikimedia portrait lazy LCP + 171 KiB oversize → #4 |
| `/calendar` | 64 / 89 | 8.3* / 1.4 | 7.3 / 2.4 | 130 / 110 | 0.036 / 0 | Serwist DataCloneError → #4; contrast + grid targets = operator calls |
| `/blog/<post>` | 63 / 94 | 8.1* / 1.5 | 7.5 / 1.4 | 150 / 0 | 0 / 0 | Clean; shell only |
| `/information/formula-1` | 66 / 95 | 8.1* / 1.4 | 4.4 / 1.2 | 210 / 30 | 0 / 0 | Heading order → #3; still pre-Paper register |

*Mobile LCP metrics were inflated sitewide by the font-preload contention (each report's own breakdown summed far lower); 0.322.4 removes the cause. Constant across pages: ~615 KiB unused 3rd-party JS (Clerk-anon NO-GO documented in #745; AdSense kept pending re-approval; gtag already lazyOnload), CSP/COOP report-only by design, desktop Best-Practices 77s = Google's own lidar.js deprecation. Root same-day delta vs pre-0.321.2: mobile 69→76, desktop 88→94, SI 10.8→3.7 / 4.6→2.0, doc stream 7.1 s→1.96 s.

## Targets

| Metric | Field target (CWV pass) | Lab target (PSI green) |
|---|---|---|
| LCP | ≤ 2.5 s | ≤ 2.5 s |
| INP | < 200 ms | < 200 ms |
| CLS | < 0.1 | < 0.1 |
| TTFB | < 800 ms | < 800 ms |
| PSI Performance score | — | ≥ 90 |

### 2026-05-19 gap analysis

| Metric | Current (mobile) | Target | Gap |
|---|---|---|---|
| RES | 76 | 90 | 14 pts |
| LCP | 3.67 s | 2.5 s | 1.17 s |
| **TTFB** | **3.17 s** | **0.8 s** | **2.37 s** ← biggest lever |
| CLS | 0.11 | 0.1 | marginal |
| INP | 80 ms | <200 ms | passing |

Desktop is already green-ish (RES 95). Mobile `/` (RES 67) is the offender on both platforms. **Mobile TTFB 3.17 s is the biggest single number to attack** — points at server-rendering work + edge-cache hit rate + JS hydration cost on the home shell.

---

## Workstream priorities derived from these numbers

Cross-ref: `docs/HANDOFF.md` → Active workstream → Next-session pickup → B-perf. Sequenced plan: `SCHEDULE.md` Wed 2026-05-20 entry.

| Rank | Lever | Est. recovery |
|---|---|---|
| 1 | **Clerk lazy-load** on non-auth surfaces (keep `<ClerkProvider>` synchronous at root; `<UserButton>` + widgets via `next/dynamic`) | ~225 KiB unused JS |
| 2 | **Defer AdSense + GTM** via `next/script strategy="lazyOnload"`. Verify FundingChoices CMP runs first (consent gate). Optionally Partytown for GTM. | ~319 KiB unused JS, big TBT relief |
| 3 | **Preconnect `clerk.paddock-tracker.com`** | 90 ms LCP |
| 4 | **CSS critical-path** investigation (two CSS bundles blocking render to 2 s) | LCP down to <2.5 s target |
| 5 | **Wikipedia History tab `<img>`** — strip or lazy + width/height | CLS prevention |
| 6 | **B9 server-render** `<HomeContent>` / `<FilteredSessions>` / `<MonthScopedWeekends>` (separate bundle in HANDOFF) | Biggest LCP lever on `/` (RES 67/73) |

---

## Measurement protocol

When capturing a new snapshot:

1. **Vercel Speed Insights:** open `vercel.com/<org>/motorsport/speed-insights`, flip Desktop / Mobile, set range "Last 7 Days", screenshot. Capture RES + FCP / LCP / INP / CLS / FID / TTFB + per-route breakdown (Great + Needs Improvement) + per-country poor list.
2. **PSI desktop + mobile:** open `pagespeed.web.dev/?url=https://paddock-tracker.com/`. Capture Performance / Accessibility / Best Practices / SEO scores + the top 3 entries from Opportunities and Diagnostics. For Performance specifically capture LCP / INP / CLS / TBT + the LCP critical path + the unused-JS breakdown (1st-party + 3rd-party).
3. **Append a new dated subsection** to this file. Never overwrite prior rows. The trend matters more than the most recent number.
4. **Re-measure ≥ 24 h after a perf-relevant deploy** so Vercel SI field data has time to refresh. Lab numbers (PSI) are immediate; field numbers (Vercel SI / GSC CWV) lag by ~24–72 h.

When two rows diverge unexpectedly, suspect: (a) AdSense / GTM script-injection variance, (b) CDN cold-cache vs. warm-cache, (c) field-vs.-lab divergence is normal (different cohort, different network conditions).
