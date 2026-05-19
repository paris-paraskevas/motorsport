# Paddock — SEO + GEO audit

_Date: 2026-05-19. Version audited: `0.10.22`. Repo root: `C:\Dev\Personal\Motorsport\`. Live URL: https://paddock-tracker.com._

Read-only discoverability audit. No code, no config, no commits touched. Output is a delta report — what's wrong, what's missing — across ten pillars covering classic SEO (Google indexability + ranking) and GEO (LLM crawler-visibility + citability for ChatGPT, Claude, Perplexity, Gemini).

Background: `site:paddock-tracker.com` returns zero Google results as of yesterday's external audit. Site is live for 4 days. Search Console verification is in progress. This audit answers "what's blocking discovery, and what's blocking citation."

Methodology: static reads against the repo for the structural claims, plus live `curl -A "Googlebot/2.1"` / `WebFetch` probes against the deployed site for the runtime claims. Every finding cites either a `file:line` or the live URL probed. Rows marked `BEST_EFFORT` are claims I could not fully verify (typically because the deployed page renders content the static read can't fully predict).

Severity legend identical to `docs/audit-2026-05-19.md`: `HIGH` (blocks indexing or citation) · `MEDIUM` (defect, not blocking) · `LOW` (polish) · `INFO` (heads-up).

---

## Executive summary

1. `HIGH` **`app/robots.ts` + `app/sitemap.ts` both missing.** Live confirms: `https://paddock-tracker.com/robots.txt` → **404** (43,129 B), `https://paddock-tracker.com/sitemap.xml` → **404**. Google has no manifest of URLs to crawl. With no internal-link path to most leaf pages either, the practical discoverable surface is ≈ 20 URLs (home + 15 series + a handful of static pages).
2. `HIGH` **Zero JSON-LD anywhere in source.** Grep `application/ld+json` and `@context` across `app/`, `components/`, `lib/` returns **0 matches**. No `Organization`, `WebSite`, `SearchAction`, `SportsEvent`, `SportsTeam`, `Person`, `BreadcrumbList`, `Article`. Google cannot build rich-result cards; LLMs that prefer structured facts have nothing to extract.
3. `HIGH` **Tabs are `?tab=*` query strings on a single route, with identical `<title>` across all 9 variants and no canonical.** `app/series/[slug]/page.tsx:28-40` returns only `{ title: meta.name }` regardless of `searchParams.tab`. 15 series × 9 tab values = 135 URL variants collapsed into one indexable identity with no canonical telling Google which is the parent. Most tabs carry distinct content (Champions, Standings, History, Calendar, Drivers) and *should* each be their own indexable page.
4. `HIGH` **History + Rules tabs dump full Wikipedia HTML verbatim** via `dangerouslySetInnerHTML` (`components/tabs/HistoryTab.tsx:27-30`, `RulesTab.tsx:58-61`). Each F1 History tab is ~12,000–14,000 words of Wikipedia text, 80+ outbound `en.wikipedia.org` links (no `nofollow`), and 4+ hot-linked images from `upload.wikimedia.org`. Three compounding harms: duplicate-content vs. the canonical Wikipedia article (Google will pick Wikipedia), authority-leakage via outbound links to the very source Google prefers, and CC BY-SA license violation (no license link, no attribution to authors, no modification notice).
5. `HIGH` **`Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` on every response.** Verified live via `curl -I` against `/`. Combined with `export const dynamic = 'force-dynamic'` on every non-legal page, this defeats Google's crawl cache, defeats Vercel's edge cache (`X-Vercel-Cache: MISS` confirmed), and wastes crawl budget. The legal pages (`/privacy`, `/terms`, `/cookies`, `/accessibility`, `/do-not-sell`) are correctly `force-static` and DO cache; everything else doesn't.
6. `HIGH` **`/drivers/[slug]` and `/teams/[slug]` route trees are dead** — `content/series/*/drivers.json` does not exist for any of the 15 series, so `loadAllDrivers()` / `loadAllTeams()` return `[]`, `generateStaticParams` (`app/drivers/[slug]/page.tsx:9-12`) yields no params, and every driver/team URL 404s. Verified live: `https://paddock-tracker.com/drivers/lando-norris` → 404; `https://paddock-tracker.com/teams/mclaren` → 404; `https://paddock-tracker.com/drivers/f1__lando-norris` → 404. The Supabase migration plans 1500+ such pages; the route shells exist but no data fills them.
7. `HIGH` **`content/posts/` does not exist** → `/blog` renders the empty-state placeholder (live 200, 39 KB shell), `/feed.xml` emits a zero-item RSS, every `/blog/[slug]` is a 404. The blog is in the global nav but ships zero indexable content.
8. `HIGH` **Home and Calendar are server pages that render client-component bodies** — `app/page.tsx:35-83` wraps `<HomeContent>` (`components/HomeContent.tsx:1` is `'use client'`), `app/calendar/page.tsx` wraps `<FilteredSessions>` (`components/FilteredSessions.tsx:1` is `'use client'`). Initial HTML is the props-serialized shell, no card / list / heading content. Googlebot (which executes JS) sees the rendered DOM, but **non-rendering LLM crawlers (CCBot, Bytespider, the older GPTBot ingest path) see an empty shell**.
9. `HIGH` **`<html lang="en">` hardcoded** (`app/layout.tsx:71`); zero i18n framework; zero Greek content anywhere under `content/`; no `metadata.alternates.languages`. The operator is Greek and based in Larissa (per `content/legal/privacy.md:13` "based in Greece (EU)"). Greek-language motorsport queries are an uncontested market — the structural absence (no `next-intl`, no `/el/` route tree, no `hreflang`) is the entire blocker.
10. `HIGH` **No `<time dateTime="…">` markup on race-weekend session dates** — `components/WeekendBlock.tsx:43,95-96` renders `formatLocal(s.start)` inside a `<span>`. Same for date ranges. The most fact-dense markup on the site (rounds → sessions → times → circuits) has zero machine-readable date markup. LLM date extraction will fail across the entire calendar surface.

Hot-list of what's working: HSTS is set (`max-age=63072000`), HTTPS redirects clean (no chains observed), `<html lang="en">` is at least *set*, `metadataBase` is set in layout, weekend pages are 100% server-rendered, `opengraph-image.tsx` generates a proper 1200×630 PNG, all external links carry `rel="noopener noreferrer"`, no bot-blocking middleware (Googlebot/GPTBot/ClaudeBot/PerplexityBot all return 200), service worker does not intercept crawler fetches, `/changelog` + legal pages are correctly `force-static`. Foundation isn't poisoned — it's just barely built.

---

## Pillar 1 — Indexability fundamentals

### What's missing

| Item | File | Status | Live URL | Severity |
|---|---|---|---|---|
| Robots | `app/robots.ts` | absent | `/robots.txt` → **404** | `HIGH` |
| Sitemap | `app/sitemap.ts` | absent | `/sitemap.xml` → **404** | `HIGH` |
| LLM manifest | `public/llms.txt` | absent | `/llms.txt` → **404** | `HIGH` |
| AI policy | `public/ai.txt` | absent | `/ai.txt` → 404 (not probed; assumed) | `HIGH` |
| Search Console | grep `google-site-verification` | 0 hits across repo | n/a (DNS TXT in progress per brief) | `HIGH` |
| Bing verification | grep `BingSiteAuth` | 0 hits | n/a | `MEDIUM` |
| Yandex verification | grep `yandex-verification` | 0 hits | n/a | `LOW` |
| AdSense identity | `public/ads.txt` | EXISTS (1 line: `google.com, pub-3573600995951624, DIRECT, f08c47fec0942fa0`) | `/ads.txt` → 200, 59 B | `INFO` |

### Live response headers (from `curl -I -A "Googlebot/2.1" https://paddock-tracker.com/`)

```
HTTP/1.1 200 OK
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
Strict-Transport-Security: max-age=63072000
Server: Vercel
X-Vercel-Cache: MISS
X-Clerk-Auth-Reason: session-token-and-uat-missing
X-Clerk-Auth-Status: signed-out
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
```

| Finding | Severity | Detail |
|---|---|---|
| `Cache-Control: private, no-cache, no-store` site-wide | `HIGH` | Defeats Vercel edge cache, Google crawl cache, and any intermediate CDN. Every Googlebot visit forces a full SSR. Crawl budget is finite — pages-per-second × no-cache = far fewer pages indexed than the URL count would suggest. **Fix:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400` for the home/series/weekend routes via `next.config.ts` `headers()` (currently empty). |
| No `X-Robots-Tag` header | `MEDIUM` | No global rule for `noindex` on the sign-in / sign-up / settings / api routes; relies on per-page meta. |
| Clerk session check on every request | `LOW` | `X-Clerk-Auth-Reason` shows the middleware runs even for anonymous Googlebot. Doesn't block, but adds latency. `proxy.ts:14-18` could short-circuit on non-protected paths to skip the auth lookup. |
| No `verification` field in `Metadata` | `HIGH` | `app/layout.tsx:19-39` doesn't carry `verification: { google: '...', yandex: '...', other: { 'msvalidate.01': '...' } }`. When Search Console TXT lands, also add the HTML-meta path for redundancy. |

### Crawler reachability (live, `curl -A "Googlebot/2.1"`)

| Route | HTTP | Bytes |
|---|---|---|
| `/` | 200 | 376,286 |
| `/calendar` | 200 | 375,377 |
| `/blog` | 200 | 39,593 (empty placeholder) |
| `/about` | 200 | 54,393 |
| `/changelog` | 200 | 89,026 |
| `/series/f1` | 200 | 96,276 |
| `/series/f1?tab=champions` | 200 | 244,613 |
| `/series/f1?tab=history` | 200 | 169,385 |
| `/series/f1/weekend/5` | 200 | 99,892 |
| `/drivers/lando-norris` | **404** | 23,554 |
| `/drivers/f1__lando-norris` | **404** | 23,562 |
| `/teams/mclaren` | **404** | 23,532 |
| `/teams/f1__mclaren` | **404** | 23,540 |
| `/privacy` | 200 | 62,858 |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt` | **404** | 43,129 (next.js 404 page) |

LLM-bot UAs tested against `/`: **Googlebot, GPTBot, ClaudeBot, PerplexityBot** all return 200, identical 376 KB payload. No UA-based branching anywhere (`Grep bot|crawler|userAgent` in `proxy.ts` → 0 hits). **No bot blocking** — `INFO`, good.

### Indexable but shouldn't be

| Route | Why it shouldn't be indexed | Severity |
|---|---|---|
| `/sign-in/[[...sign-in]]/page.tsx`, `/sign-up/[[...sign-up]]/page.tsx` | Auth landing pages compete for the brand query. | `MEDIUM` — add `robots: { index: false, follow: true }` to their `metadata` exports. |
| `/settings/page.tsx` | Authed-only, useless to crawlers. | `MEDIUM` — same fix. Currently no `robots` declaration. |
| `/do-not-sell` | Compliance page; you want it discoverable BUT not competing for "paddock" — leave it indexable. | `INFO`. |
| `/feed.xml` | Crawlable RSS; currently emits zero items. | `LOW` — fine to leave indexable once posts exist. |
| `app/api/cron/*`, `app/api/contact`, `app/api/push/status`, `app/api/consent`, `app/api/feed.xml/route.ts` | API endpoints don't 401 to anonymous GET — `/api/contact` POST-only but the route file exists. | `LOW` — once `robots.txt` ships, `Disallow: /api/`. |

---

## Pillar 2 — Per-page metadata

### Site-wide defaults (`app/layout.tsx:19-39`)

```ts
metadataBase: new URL('https://paddock-tracker.com'),
title: {
  default: 'Paddock — Personal motorsport companion',
  template: '%s — Paddock',
},
description: 'Personal motorsport companion — F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more.',
manifest: '/manifest.json',
openGraph: { type: 'website', url, siteName, title, description },
twitter: { card: 'summary_large_image', title, description },
// NO alternates.canonical, NO robots, NO verification, NO openGraph.images, NO twitter.images
```

App Router auto-derives `og:image` + `twitter:image` from `app/opengraph-image.tsx` (1200×630 PNG, brand checkerboard + wordmark + series list). Live HTML confirms both tags are emitted with `https://paddock-tracker.com/opengraph-image?<hash>`.

### Per-route inventory

| Route | static metadata? | generateMetadata? | title | description | og.image | canonical | robots | JSON-LD |
|---|---|---|---|---|---|---|---|---|
| `/` (`app/page.tsx`) | no | no | layout default | layout default | root OG | — | — | 0 |
| `/calendar` (`app/calendar/page.tsx:8-10`) | yes | no | `"Calendar"` | none | root OG | — | — | 0 |
| `/blog` (`app/blog/page.tsx:6-9`) | yes | no | `"Blog"` | "Analysis, recaps, and opinion across motorsport championships." | root OG | — | — | 0 |
| `/blog/[slug]` (`app/blog/[slug]/page.tsx:16-35`) | no | yes | frontmatter | frontmatter | heroImage if any | — | — | 0 |
| `/about` (`app/about/page.tsx:6-8`) | yes | no | `"About"` | none | root OG | — | — | 0 |
| `/changelog` (`app/changelog/page.tsx:8-10`) | yes | no | `"Changelog"` | none | root OG | — | — | 0 |
| `/series/[slug]` (`app/series/[slug]/page.tsx:28-40`) | no | yes | `meta.name` only | **none** | root OG | — | — | 0 |
| `/series/[slug]/weekend/[round]` (`app/series/[slug]/weekend/[round]/page.tsx:36-71`) | no | yes | composed | composed (best on the site) | root OG | — | — | 0 |
| `/drivers/[slug]` (`app/drivers/[slug]/page.tsx:14-26`) | no | yes | `driver.name` | `"{name}, {team} ({seriesName})."` | root OG | — | — | 0 |
| `/teams/[slug]` (`app/teams/[slug]/page.tsx:14-26`) | no | yes | `team.name` | `"{name} — {seriesName} lineup and details."` | root OG | — | — | 0 |
| `/privacy`, `/terms`, `/cookies`, `/accessibility`, `/do-not-sell` (`app/*/page.tsx:7-9`) | yes | no | page name | none | root OG | — | — | 0 |
| `/settings` (`app/settings/page.tsx:8-10`) | yes | no | `"Settings"` | none | root OG | — | — | 0 |
| `/sign-in`, `/sign-up` (`app/sign-{in,up}/[[...x]]/page.tsx`) | yes | no | `"Sign in"`/`"Sign up"` | none | root OG | — | — | 0 |

### Findings

| Severity | File:line | Finding |
|---|---|---|
| `HIGH` | `app/series/[slug]/page.tsx:33-40` | `generateMetadata` ignores `searchParams.tab`. The same `<title>F1 — Paddock</title>` is emitted whether the URL is `/series/f1`, `/series/f1?tab=champions`, `/series/f1?tab=history`, `/series/f1?tab=standings`, `/series/f1?tab=results`, `/series/f1?tab=drivers`, `/series/f1?tab=rules`, `/series/f1?tab=about`, `/series/f1?tab=news`. 15 series × 9 tabs = 135 URL variants with identical metadata. Either canonicalize all tabs to the base series URL (loses tab content from index) or differentiate per-tab metadata (each tab earns its own SERP slot). |
| `HIGH` | `app/layout.tsx:19-39` | No `alternates.canonical` strategy. Next.js does not emit `<link rel="canonical">` unless explicitly set. Combined with the tab fan-out + Clerk-injected querystrings + future analytics campaign params (`?utm_*`, `?ref=`), every querystring permutation will be crawled as a unique URL. |
| `HIGH` | `app/page.tsx:1-84` | Home has no `metadata` export and no `generateMetadata`. The most important page on the site inherits the generic site-wide title and description verbatim. A custom title + description would let the home page rank for "motorsport calendar all series", "F1 MotoGP WEC schedule", etc. |
| `MEDIUM` | `app/series/[slug]/page.tsx:36` | No `openGraph` block on series pages → every series shares the generic Paddock OG image. Per-series OG images (series color + series logo + season year) would massively improve share-preview CTR. Easy win: create `app/series/[slug]/opengraph-image.tsx` reading `series.meta.color`. |
| `MEDIUM` | `app/series/[slug]/weekend/[round]/page.tsx:69` | `openGraph` has `{ title, description }` only — no `images`. Same problem for the weekend page (the highest-intent surface on the site after a search like "F1 Monaco 2026 schedule"). |
| `MEDIUM` | `app/drivers/[slug]/page.tsx:22-26`, `app/teams/[slug]/page.tsx:22-26` | No `openGraph` blocks → driver/team detail shares fall back to the generic site card. (Currently irrelevant because the route returns 404 — see Pillar 1.) |
| `MEDIUM` | `app/blog/[slug]/page.tsx:27-34` | `openGraph.type: 'article'` is set, `publishedTime` is set, but `modifiedTime`, `authors`, `tags` are missing. `twitter` block is entirely missing on blog post pages → Twitter cards rely on layout fallback. (Currently irrelevant because no posts exist.) |
| `MEDIUM` | `app/calendar/page.tsx:8-10`, `app/about/page.tsx:6-8`, `app/changelog/page.tsx:8-10`, all legal pages `app/*/page.tsx:7-9` | All have title only, no description. Google often shows the description in the SERP for navigational queries; an empty description leaves Google to pick a snippet from body text. |
| `MEDIUM` | `app/sign-in`, `app/sign-up`, `app/settings`, `app/do-not-sell` | None declare `robots: { index: false }`. Sign-in/up will compete for branded queries; settings is useless to crawlers. |
| `LOW` | `app/opengraph-image.tsx:39-58` | Brand-correct but text-only and identical across every page. Acceptable as a default; harmful as the only option. |
| `LOW` | `app/layout.tsx:27-33` | `openGraph` and `twitter` blocks in layout don't explicitly reference `/opengraph-image`. Next auto-injects from the convention file, but being explicit (`openGraph.images: ['/opengraph-image']`) is more defensible against crawler quirks. |

---

## Pillar 3 — Structured data (JSON-LD)

### Inventory

`Grep "application/ld+json" path="C:/Dev/Personal/Motorsport" output_mode="files_with_matches"` → **0 source matches**. Hits only in `node_modules/hono/dist/types/utils/mime.d.ts` and `node_modules/undici/types/header.d.ts` (MIME type tables).

`Grep "@context"|"@type"|"schema.org"` → 0 hits in `app/`, `components/`, `lib/`.

**Site has zero JSON-LD anywhere.** Not in layout, not in any page, not in any component, not server-rendered, not client-injected.

### Breadcrumb UI

Visible breadcrumbs: none. Single-step "back" links only:

- `app/blog/[slug]/page.tsx:59-65` — "Back to blog"
- `app/drivers/[slug]/page.tsx:58-64` — "Back to {seriesName} drivers"
- `app/teams/[slug]/page.tsx:57-63` — "Back to {seriesName} drivers"

No `BreadcrumbList` JSON-LD anywhere. `MEDIUM` — schema doesn't require visible breadcrumbs; emit anyway. Even a single `BreadcrumbList` on every detail route is a measurable rich-result win.

### Recommended schema-per-route

Full table in **Appendix B**. Quick reference for the highest-leverage emissions:

| Route | Highest-value schema type |
|---|---|
| `/` | `Organization` + `WebSite` with `potentialAction: SearchAction` (gates Google sitelinks searchbox) |
| `/series/[slug]` | `SportsOrganization` + `ItemList` of `SportsEvent` |
| `/series/[slug]/weekend/[round]` | `SportsEvent` with `subEvent: SportsEvent[]` per session |
| `/drivers/[slug]` | `Person` with `jobTitle: "Racing driver"` + `affiliation: SportsTeam` |
| `/teams/[slug]` | `SportsTeam` with `athlete: Person[]` |
| `/blog/[slug]` | `Article` with full author/date/publisher/mainEntityOfPage |
| every page | `BreadcrumbList` |

---

## Pillar 4 — URL architecture & canonicalization

### Tabs are query strings (`HIGH`)

`app/series/[slug]/page.tsx:75` reads `searchParams.tab`. Tab values: `calendar | news | standings | results | drivers | rules | about | history | champions` (`lib/tabs.ts:1-11`). No path-based routes exist — directory tree under `app/series/[slug]/` is just `page.tsx` + `weekend/`.

Cost of this choice:
- 9 tab variants × 15 series = 135 unique-content URLs collapsed into one indexable identity per series.
- Identical `<title>` across all 9 (Pillar 2 #1).
- No canonical strategy means Google picks one tab's content arbitrarily as "the" `/series/f1` page; the other 8 compete as near-duplicates and get demoted.

**Fix paths:**
- **Path-based:** convert to `/series/f1/champions`, `/series/f1/history`, etc. via parallel routes or nested segments. Each tab becomes its own indexable page with its own metadata, its own JSON-LD, its own social card. Massively better. Requires `<SeriesTabs>` nav to emit `<Link href="/series/f1/champions">` instead of `?tab=`, and the page tree to shard. Effort: medium. Multiplier on every future fix.
- **Tab-aware metadata + canonical to base:** keep query-string tabs but `generateMetadata` reads `searchParams.tab`, builds per-tab title + description + `openGraph.url: /series/${slug}?tab=${tab}`, AND sets `alternates.canonical: /series/${slug}` to consolidate. Cheaper. Each tab gets distinct SERP snippets but only the base URL accrues authority.

The Supabase migration is the right inflection point for path-based, but the cheap canonical-to-base fix unblocks indexing immediately.

### Other findings

| Severity | File:line | Finding |
|---|---|---|
| `HIGH` | `content/posts/` | Directory does not exist. `lib/posts.ts:8-14` handles ENOENT silently → `/blog` empty state, `/feed.xml` zero-item RSS, every `/blog/[slug]` is 404. Blog is in `components/AppShell.tsx:106-127` global nav with zero content behind it. Either ship at least 3 posts or remove the nav entry until launch. |
| `HIGH` | `app/page.tsx:8`, `app/series/[slug]/page.tsx:21`, `app/series/[slug]/weekend/[round]/page.tsx:12`, `app/drivers/[slug]/page.tsx:7`, `app/teams/[slug]/page.tsx:7`, `app/blog/[slug]/page.tsx:9`, `app/blog/page.tsx:4`, `app/calendar/page.tsx:6`, `app/settings/page.tsx:6`, `app/sign-in/[[...sign-in]]/page.tsx:4`, `app/sign-up/[[...sign-up]]/page.tsx:4`, `app/feed.xml/route.ts:3` | All have `export const dynamic = 'force-dynamic'`. Multiple routes ALSO declare `generateStaticParams` (series, weekend, driver, team, blog) — that's wasted work because `force-dynamic` overrides static generation. Either set `dynamic = 'force-static'` + `revalidate` for the routes whose data changes infrequently (driver/team/champion content), or remove the redundant `generateStaticParams`. |
| `HIGH` | global | Zero canonicals anywhere. `Grep "canonical|alternates|rel=\"canonical\""` in `app/` → 0 hits. Means every querystring permutation of every URL is treated as distinct by Google. |
| `MEDIUM` | `app/feed.xml/route.ts:35-46` | RSS has `<title>Paddock</title>`, single `<atom:link rel="self">`, no `<lastBuildDate>`, no `<image>`, no `<category>` per series. Once posts exist, this is the LLM-friendly summary path; harden it. |
| `LOW` | global | No `redirect()` / `permanentRedirect()` in `app/`. Clean — no redirect chains, no legacy-URL handling either (none needed yet). |
| `INFO` | `components/AppShell.tsx:106-127`, `components/Footer.tsx:25-39` | Internal nav: 7 `<Link>` in sidebar (home, calendar, blog, per-series, about), 8 in footer (changelog, about, settings, privacy, terms, cookies, accessibility, do-not-sell). All relative paths. Settings is footer-linked despite being authed-only — crawlers will hit it. |
| `INFO` | `app/layout.tsx:20` | `metadataBase: new URL('https://paddock-tracker.com')` is set. All relative OG URLs resolve correctly. |
| `INFO` | global | External links uniformly `rel="noopener noreferrer"`, no `nofollow`. See Pillar 5 for the authority-leakage implication on Wikipedia / motorsport.com links. |

### Internal-link graph (rough)

Estimated from grep of `<Link href=` across `components/`:

- Sidebar emits ≈ 22 links (home + calendar + blog + 15 series + about + 3 footer-ish).
- Footer emits 8.
- Per-tab content adds variable links (Drivers tab → driver detail × current lineup; Champions tab → no outbound).
- Home page → 12 motorsport.com outbound (news), 0 Wikipedia, 0 hot-linked Wikimedia images (verified live).
- Series-history tab → ≈ 80–150 outbound `en.wikipedia.org` links per page (verified for F1).

**Orphan candidates:**
- `/drivers/[slug]` and `/teams/[slug]` are reachable in code via `<Link>` inside `DriversTab` and back-links — but with zero data, they're orphans in practice.
- `/feed.xml` is linked from `app/layout.tsx`? — not found in grep. Probably orphaned beyond `head` injection (which next.js doesn't auto-do for RSS). `MEDIUM` — add a `<link rel="alternate" type="application/rss+xml">` in layout `head` when posts exist.

---

## Pillar 5 — Content quality (search + LLM perspective)

### Tab content matrix

| Tab | Source | Wikipedia content fraction | Outbound `en.wikipedia.org` links | Hot-linked Wikimedia images | `rel="nofollow"`? | CC BY-SA attribution? |
|---|---|---|---|---|---|---|
| **History** | Wikipedia section HTML, `dangerouslySetInnerHTML` (`components/tabs/HistoryTab.tsx:27-30`) | ~100% | 80+ per F1 page (verified live); ~30–150 typical | 4+ per page (F1 verified live: Alfa Romeo 159, Stirling Moss/Lotus 18, Stefan Johansson/Ferrari, Schumacher/Ferrari F2001) | NO (`Grep nofollow` in repo → 0 hits) | NO (only "Source: X on Wikipedia ↗" footer, no license link, no contributors, no modification notice) |
| **Rules** | Wikipedia HTML + optional `overview.md` (`components/tabs/RulesTab.tsx:58-89`) | ~95% Wikipedia, ~5% curated | same path as History | same | NO | NO |
| **About** | Wikipedia REST `/page/summary` (`firstSentences`, 3 sentences, plain text) + optional `overview.md` (`components/tabs/AboutTab.tsx`) | ~50/50 if `overview.md` exists; ~100% Wikipedia otherwise | 1 (footer "Source: Wikipedia →") | 0 (REST summary is plain text) | NO | partial |
| **Champions** | `content/series/<slug>/champions.json` curated (`components/tabs/ChampionsTab.tsx:214-237`) | 0% (Wikipedia code path is dead in practice — all 15 series have curated files as of `0.10.22`) | 0 in curated mode (1 in fallback mode, never exercised) | 0 | n/a | n/a |
| **News** | motorsport.com RSS (`lib/news.ts`, `components/tabs/NewsTab.tsx`) | 0% Wikipedia | 0 Wikipedia | 0 | NO | n/a |

### Findings

| Severity | File:line | Finding |
|---|---|---|
| `HIGH` | `components/tabs/HistoryTab.tsx:27-30`, `lib/wikipedia-article.ts:120-138` | **Wikipedia HTML dumped verbatim with no canonical to source, no `nofollow` on outbound links, no `rel="ugc"` markup, no license compliance.** Google will pick the Wikipedia original over Paddock's copy ~100% of the time (it has 20+ years of authority on the topic). Paddock pays the duplicate-content cost AND donates link authority to the source it's competing against. Three remediation options, in order of preference: (a) replace with a 200-300-word original summary citing Wikipedia once, link-out once, no images — turns a SEO liability into a thin-but-real original; (b) keep Wikipedia content but add `rel="nofollow noopener"` to every link, strip all images, and add a top-of-page `<blockquote>` attribution + CC BY-SA license link; (c) drop the History tab entirely and use the slot for something original. Option (a) is the right answer. |
| `HIGH` | `lib/wikipedia-article.ts:141-150` | `<img>` tags from Wikipedia are passed through with only `srcset` stripped and protocol normalized. Result: every History tab page fetches images from `upload.wikimedia.org` on every load. Three harms: (a) violates Wikimedia's `User-Agent` and hot-linking policy (https://meta.wikimedia.org/wiki/User-Agent_policy); (b) Wikimedia sees every visitor IP — privacy leak; (c) no `width`/`height`/`loading="lazy"` → CLS + LCP regression. Fix: strip `<img>` entirely from the rendered HTML (cheerio is already imported per `package.json:20`), or download/proxy via `app/api/img-proxy/[hash]/route.ts` and re-serve via Next `<Image>`. |
| `HIGH` | `lib/wikipedia-article.ts:120-138` + `content/legal/terms.md:40` | **CC BY-SA license obligations are not satisfied.** The license requires: (1) attribution to the article + its contributors, (2) a link to the CC BY-SA text, (3) marking of modifications. Current implementation: a footer reading "Source: <title> on Wikipedia ↗" — no license link, no contributor list (impossible to list all but at minimum a link to the page's revision history is required), no statement that content has been modified (cheerio strips footnotes, navboxes, tables, references — all modifications). Mention of CC BY-SA in `terms.md:40` is too distant from the rendering surface. ShareAlike clause: derivative works must be released under the same license; `terms.md:38` claims editorial ownership of all content. This is a license violation independent of the SEO concern. |
| `HIGH` | `components/tabs/NewsTab.tsx:50-55,67` | News links go to motorsport.com with `rel="noopener noreferrer"` only — no `nofollow`. ~10 outbound per series × 15 series = 150 high-authority outbound links every cron cycle, no UTM params. Excerpts are RSS verbatim (240 chars, "Keep reading" stripped via `news.ts:118`). Duplicate content vs motorsport.com which is the canonical authority. Fix: `rel="noopener noreferrer nofollow"` on every news link AND truncate excerpts to ≤120 chars to reduce duplicate-content overlap. |
| `HIGH` | `content/posts/` | Directory does not exist. **No original long-form content anywhere on the site.** The site's only original assets are: (1) curated champions JSON (15 × 1949–2025), (2) curated session timetables, (3) cross-series next-session aggregation on home page, (4) `overview.md` per series (≈ 250 words each where filled — F1 confirmed, others unverified). Filling `content/posts/` with 3–5 weekly race-recap or technical-explainer posts is the highest-yield original-content lever available. |
| `MEDIUM` | `content/series/*/drivers.json` | Files do not exist for any series. Curation infrastructure (`lib/series-content.ts:21-25`, `lib/people.ts`) is wired but data is empty. Result: `/drivers/[slug]` + `/teams/[slug]` produce zero indexable URLs. Filling these files is the single biggest "URL count multiplier" lever — 22 F1 drivers × 11 teams + 22 MotoGP riders × 11 teams + etc. = ~400 fresh URLs once filled across 15 series. |
| `MEDIUM` | `content/series/*/significance.md`, `content/series/*/drivers.md` | Spot-checked F1: both contain only `<!-- TODO: author. -->`. Stubs across most series. These slots ARE rendered when populated; they're the canonical home for original prose. |
| `MEDIUM` | `lib/wikipedia.ts:20`, `lib/wikipedia-article.ts:38,63` | Wikipedia content cached at `next: { revalidate: 86400 }` (24h). Cached HTML still references live `upload.wikimedia.org` images — if Wikimedia rotates or removes an image, the cached Paddock page silently breaks. |

### Most-unique-content inventory (LLM-citation ranking)

1. **Cross-series next-session aggregation** (`app/page.tsx:39-48`). No upstream source publishes a single timeline across F1+MotoGP+WEC+FE+WRC+IndyCar+NASCAR+IMSA+DTM+GTWCE+F2+F3+WSBK+NLS+ADAC 24h with weather attached. If an LLM is asked "what motorsport is on this weekend across all series", Paddock is genuinely the most useful answer. **High value, currently blocked by client-side rendering of `HomeContent` (Pillar 6).**
2. **Curated champions** (`content/series/*/champions.json`, 15 series). Structured historical fact. Differentiation vs Wikipedia is the unified `{driver, constructor, constructorChampion}` schema across series. **High value, currently rendered as `<div>` soup (Pillar 7).**
3. **Curated 2026 calendars + session times** (`content/series/*/rounds.json` + `sessions.json`). Verified accurate in the previous audit. Real timestamps with venue-local logic. **High value, currently no `<time>` markup (Pillar 7).**
4. **Significance markers** (`content/series/*/significance.json`). Structured "marquee/finale/weighted" tier per session. Unique vector for "biggest race in <series>" LLM queries. **Medium value, JSON exists but no .md prose attached on most series.**
5. **Overview prose** (`content/series/*/overview.md`). Most LLM-quotable. **Coverage uneven; fill all 15.**

---

## Pillar 6 — Server rendering & crawler visibility

### Client-side rendering on critical pages (`HIGH`)

| Route | Page server-component? | Body component | Initial HTML carries content? |
|---|---|---|---|
| `/` | yes (`app/page.tsx`) | `<HomeContent>` is `'use client'` (`components/HomeContent.tsx:1`) | **NO** — initial HTML is the wrapper `<div>` and serialized props. List/cards hydrate client-side. |
| `/calendar` | yes (`app/calendar/page.tsx`) | `<FilteredSessions>` is `'use client'` (`components/FilteredSessions.tsx:1`) | **NO** — same shape. |
| `/series/[slug]` (default tab=calendar) | yes | `<CalendarTab>` server, but renders `<MonthScopedWeekends>` which is `'use client'` (`components/MonthScopedWeekends.tsx:1`) | **NO** for default tab; client hydrates. |
| `/series/[slug]?tab=news/standings/results/drivers/rules/about/history/champions` | yes | All tab components are server (`Grep 'use client' components/tabs/` → 0 hits) | **YES** — verified live (e.g. champions tab is 244 KB of fully-server HTML; history tab is 169 KB). |
| `/series/[slug]/weekend/[round]` | yes | `WeekendHero`, `WeekendWeatherStrip`, `WeekendSchedule`, `WeekendStandingsSnapshot`, `WeekendNews` all server (no `'use client'`) | **YES**. |
| `/drivers/[slug]`, `/teams/[slug]` | yes | Pure server (no client children) | **YES** when data exists; **N/A** currently (404). |
| `/blog`, `/blog/[slug]` | yes | Pure server | **YES** when posts exist; **N/A** currently. |
| `/privacy`, `/terms`, `/cookies`, `/accessibility`, `/do-not-sell`, `/changelog` | yes | Server, markdown via `dangerouslySetInnerHTML` | **YES**. |

**Implication:** Googlebot executes JS and *will* see the home + calendar + default-tab content after hydration. But:
- LLM crawlers that do not execute JS (CCBot, Bytespider, older GPTBot ingestion, ClaudeBot's index path, PerplexityBot's index path) see an empty shell.
- Initial HTML LCP is poor (header + ad placeholder, nothing else).
- The most-cited LLM-target surface is the home page's "next sessions across all series" — and it's invisible to non-rendering crawlers.

**Fix:** `<HomeContent>` and `<FilteredSessions>` should be split — server components render the list HTML, client components handle interactivity (filter state, sorting). Pattern: pass a server-rendered `<SessionList />` as `children` to the client filter wrapper. `MonthScopedWeekends` likewise.

### Other findings

| Severity | File:line | Finding |
|---|---|---|
| `INFO` | `app/sw.ts:1-145` + `next.config.ts:4-10` | Serwist registers via the browser. Crawlers never trigger SW registration. SW does not intercept crawler fetches. Confirmed safe. |
| `INFO` | global | No `'use server'` server actions on public-content routes. |
| `INFO` | `app/layout.tsx:73-119` | Three `<Script>` tags injected (Consent Default, AdSense, GA). All `strategy="beforeInteractive"` (consent) and `"afterInteractive"` (ads + analytics). Don't block initial HTML. |
| `MEDIUM` | global | Vercel hosting on `fra1::iad1` edge (per `X-Vercel-Id` header). No geo-restriction. No Vercel Firewall rules visible. No Clerk bot detection. Crawlers from all regions reach all pages. |

---

## Pillar 7 — LLM-specific signals (GEO)

### Files missing (all `HIGH`)

- `public/llms.txt` — absent. **Highest-leverage LLM affordance currently absent.** Proposed format (https://llmstxt.org/) is markdown, ≤ 200 lines, with a brief site description and a flat list of canonical URLs by category. Paddock's natural shape (`/series/<slug>` × 15, `/series/<slug>/weekend/<round>` × ~150, `/drivers/<slug>` × ~400 once filled, `/changelog`, `/blog/<slug>`) maps directly. A handcrafted `llms.txt` with the 15 series + key tabs + the calendar URL is 30 minutes of work and is the single biggest GEO move available before structural fixes ship.
- `public/ai.txt` — absent. Conventional file (https://site.spawning.ai/) declaring training-data opt-in/opt-out. Less important than `llms.txt` but cheap.
- `public/robots.txt` — absent (Pillar 1). No user-agent rules for `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `anthropic-ai`, `ChatGPT-User`, `CCBot`, `FacebookBot`, `Amazonbot`, `Applebot-Extended`, `Bytespider`, `cohere-ai`, `Diffbot`. Default = allow. Once `robots.txt` lands, each should be explicitly allowed (or explicitly disallowed if you want to opt out of training corpus but stay in LLM citations — Anthropic, OpenAI, and Google all split crawl from training in their UAs).

### Date markup (`HIGH`)

- `<time>` tag appears in only **2 files** (`Grep "<time" app/ components/`): `app/blog/[slug]/page.tsx:69`, `app/blog/page.tsx:57`. Both render `frontmatter.publishedAt` as text. **Neither sets `dateTime=` attribute** — `Grep "dateTime=" app/ components/` → 0 hits. So even the two existing `<time>` tags have no ISO timestamp. (Currently moot — no blog posts.)
- `components/WeekendBlock.tsx:43,95-96` renders session dates via `formatLocal(s.start)` inside `<span>`s, not `<time dateTime={s.start.toISOString()}>`. The richest fact-set on the site (15 series × ~20 weekends × ~5 sessions each = 1500 session-time data points) has zero machine-readable date markup.
- Legal pages: `content/legal/*.md:3` carries `_Last updated: 2026-05-19_` as italic markdown. `lib/content.ts:14-19` remarks it to `<em>` — no `<time>`.
- `CHANGELOG.md` / `RELEASES.md` renders at `/changelog` via `loadMarkdownAsHtml`. Version entries like `## 0.10.22 — 2026-05-19` render as plain `<h2>`. No machine-readable `datePublished`.

### Structured-fact markup (`HIGH`)

| Component | Markup shape | Should be |
|---|---|---|
| `components/tabs/ChampionsTab.tsx:62-194` | `<details>`/`<summary>` decade groups with `<div>` rows (driver name + team in grid) | `<table>` with `<thead>` (Year, Driver, Team, Constructor) and `<tbody>` rows. LLMs cite tables far more reliably than div soup. |
| `components/tabs/DriversTab.tsx:32-56` | Per-team card with `<ul>`/`<li>` of drivers — reasonable | Add microdata: `itemtype="https://schema.org/SportsTeam"` on team card, `itemtype="https://schema.org/Person"` per driver. |
| `components/WeekendBlock.tsx:34-105` | Nested `<div>`s + `<ul>` of sessions, no schema | `<article itemtype="https://schema.org/SportsEvent">` with `<time>` on every session timestamp. |
| `components/tabs/CalendarTab.tsx` | Similar to WeekendBlock | Same. |

### Cross-entity linking

Architecture is correct in code:
- `app/drivers/[slug]/page.tsx:102-120` → team
- `app/teams/[slug]/page.tsx:96-117` → drivers
- `components/tabs/DriversTab.tsx:27-32,42-47` → series → drivers/teams

**Blocked in practice** because `drivers.json` files don't exist (Pillar 5). The graph is wired; the nodes are empty.

### Source-of-truth check

Asked: "Where does the site say Lando Norris drives for McLaren in 2026?"

- `content/series/f1/champions.json:2` says `"driver": "Lando Norris", "constructor": "McLaren"` — but that's the **2025** champion record.
- `content/series/f1/drivers.json` — **does not exist**.
- `content/series/f1/drivers.md` — `<!-- TODO: author. -->`.
- The 2026 lineup is rendered by `app/series/[slug]/page.tsx` → `DriversTab` → `lib/wikipedia-season.ts` (live scrape of Wikipedia `2026_Formula_One_World_Championship` per request).

**Conclusion:** the site cannot cite itself for who drives for whom in 2026. The fact only exists on Paddock at request time, fetched live from Wikipedia. No version control, no audit trail, no LLM-citable durable URL. `HIGH`.

---

## Pillar 8 — Performance signals (brief)

| Page | Transfer size (Googlebot UA) | Time-to-last-byte | Notes |
|---|---|---|---|
| `/` | 376 KB | 2.5 s | Initial HTML is largely shell + serialized props for `HomeContent` (client component). 16 JS chunks loaded. |
| `/calendar` | 375 KB | (not measured) | Same shape — client `FilteredSessions`. |
| `/series/f1` (default tab) | 96 KB | 0.7 s | Tab chrome + `CalendarTab` server + `MonthScopedWeekends` client. |
| `/series/f1?tab=champions` | 244 KB | (not measured) | Full champions list (1950→2025) is server-rendered into HTML. Heavy, but it's all real content. |
| `/series/f1?tab=history` | 169 KB | 0.8 s | Wikipedia HTML dump. Heavy duplicate-content payload. |
| `/series/f1/weekend/5` | 100 KB | (not measured) | Server-rendered weekend. |
| `/blog` | 39 KB | (not measured) | Empty-state shell. |
| `/about` | 54 KB | (not measured) | Markdown. |
| `/changelog` | 89 KB | (not measured) | Full RELEASES.md. |
| `/privacy` | 63 KB | (not measured) | Markdown. |
| `/opengraph-image` | (1200×630 PNG via `next/og`) | (not measured) | Acceptable. |

Findings:

| Severity | Detail |
|---|---|
| `HIGH` | Home is **376 KB** for what's largely empty initial HTML. JS bundles dominate. LCP element is unclear without a Lighthouse run; likely the first session card after hydration. |
| `HIGH` | `Cache-Control: no-store` means even repeat Googlebot visits re-render. Crawl budget burned. |
| `MEDIUM` | `<img>` tags hot-linked from `upload.wikimedia.org` on every History tab (Pillar 5). No `loading="lazy"`, no `width`/`height` (`Grep "loading=" app/ components/` → 0 hits). |
| `MEDIUM` | Fonts: `GeistSans` + `GeistMono` via `geist/font/sans` + `geist/font/mono`. Next auto-preloads with `<link rel="preload" as="font" type="font/woff2" crossorigin>` (confirmed in live HTML). Self-hosted by Geist package. Good. |
| `LOW` | No `<Image>` component used anywhere for series logos, circuit photos, hero images (`Grep "from 'next/image'" components/ app/` should be 0 — not run but inferred from the lack of `loading=` hits). The PWA uses raw `<img>` everywhere. |
| `BEST_EFFORT` | No Lighthouse run as part of this audit (per brief). Real Core Web Vitals data is in Vercel Speed Insights — needs the operator's dashboard view. |

---

## Pillar 9 — Internationalization

### Hard blockers (all `HIGH`)

| Severity | File:line | Finding |
|---|---|---|
| `HIGH` | `app/layout.tsx:71` | `<html lang="en">` hardcoded. Single locale, no negotiation. |
| `HIGH` | `next.config.ts:12-32` | No `i18n` configuration block. Next.js does not auto-route locales without one. |
| `HIGH` | `package.json:13-43` | Zero i18n framework. `next-intl`, `next-i18next`, `react-i18next` all absent. |
| `HIGH` | `content/` | Zero Greek content. `Grep "[Α-Ωα-ω]"` across `content/` → 0 files. No `/el/series/<slug>`, no localized markdown. |
| `HIGH` | `app/layout.tsx:19-39` | No `metadata.alternates.languages`. Even if Greek content shipped tomorrow at `/el/`, search engines wouldn't link `en` and `el` versions as alternates. |
| `MEDIUM` | source | All date formatting is `'en-GB'` or `'en-US'`. `Grep "'el-GR'\|Intl\\.DateTimeFormat\\('el"` → 0 hits. Even for non-localized routes, displaying dates in the visitor's locale would help. |

### Strategic context

`content/legal/privacy.md:13` self-declares "based in Greece (EU)". The operator's market alignment with Greek-language motorsport is structural and uncontested. Estimated competition for "Πρόγραμμα F1 Σαββατοκύριακο" / "MotoGP Ελλάδα 2026" / similar: ≈ zero professional aggregators. A `/el/` route tree with even minimal coverage (home + 15 series + calendar) would own those queries. Effort: medium-high (translation surface is large), but the structural blockers (no `i18n`, no `hreflang`, no `lang` switching) are the prerequisite — the translation can come later.

---

## Pillar 10 — External presence & authority signals

| Item | Status | File:line | Severity |
|---|---|---|---|
| OG image (1200×630) | Generated by `app/opengraph-image.tsx` | confirmed in live HTML | `INFO` |
| OG image per-page | Site uses the root convention only — no per-segment `opengraph-image.tsx` for `/series/[slug]/`, `/series/[slug]/weekend/[round]/`, `/drivers/[slug]/`, `/teams/[slug]/`, `/blog/[slug]/` | global | `MEDIUM` |
| Twitter Card | `summary_large_image` site-wide | `app/layout.tsx:34-38` | `INFO` |
| Favicon | `/icon.png` 192×192 referenced | live HTML `<link rel="icon" href="/icon.png?... sizes="192x192">` | `INFO` |
| Apple touch icon | Not visible in HTML | (would be `app/apple-icon.png` or `apple-touch-icon.png` in `/public`) | `LOW` |
| PWA manifest | `/manifest.json` referenced | `app/layout.tsx:26` | `INFO` |
| Buy Me a Coffee | Linked, `target="_blank" rel="noopener noreferrer"` | live HTML + `components/HeaderUtils.tsx` | `INFO` (good) |
| GitHub link | Not visible in nav/footer | n/a | `LOW` — adding a footer link to the public repo (when ready) builds authority. |
| Social profiles (Twitter/X, Bluesky, Instagram) | None | n/a | `LOW` — at launch scale, not critical. Add when the brand exists outside the URL. |
| Schema:Organization with `sameAs` array | Absent (no JSON-LD) | n/a | `MEDIUM` — once profiles exist, declare them via `Organization.sameAs`. |

---

## Concrete fixes — ordered by effort × impact

Each item is sized roughly: `<1h` / `1–4h` / `>1d`. Effort first, then severity. Highest-impact-per-hour at top.

### Cheap wins (`<1h` each, ship today)

1. `HIGH` Create `app/robots.ts` exporting `MetadataRoute.Robots` that allows all crawlers, disallows `/api/`, `/settings`, `/sign-in`, `/sign-up`, and references the sitemap. Effort: 15 min.
2. `HIGH` Create `app/sitemap.ts` exporting `MetadataRoute.Sitemap` with: home, calendar, blog, about, changelog, 15 × `/series/<slug>`, all `/series/<slug>/weekend/<round>` from rounds.json, all legal pages. Skip drivers/teams until data exists. Effort: 30 min.
3. `HIGH` Create `public/llms.txt` (markdown, ≤150 lines) describing the site, its 15 series, its champions corpus, its calendar, and key URLs. Effort: 30 min.
4. `HIGH` Add `verification` field to `app/layout.tsx` `metadata` once Search Console TXT lands. Effort: 5 min.
5. `HIGH` Add `robots: { index: false, follow: true }` to `app/sign-in/[[...sign-in]]/page.tsx:6-8`, `app/sign-up/[[...sign-up]]/page.tsx:6-8`, `app/settings/page.tsx:8-10`. Effort: 5 min.
6. `HIGH` Add `nofollow` to outbound Wikipedia + motorsport.com links in `lib/wikipedia-article.ts:120-138` and `components/tabs/NewsTab.tsx:50-55`. Single string change per file. Effort: 10 min.
7. `MEDIUM` Add `next.config.ts` `headers()` setting `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400` for `/`, `/calendar`, `/series/(.*)`, `/blog`, `/about`, `/changelog`. Don't apply to `/api/`, `/settings`. Effort: 30 min.
8. `MEDIUM` Add per-route descriptions to `/calendar`, `/about`, `/changelog`, `/privacy`, `/terms`, `/cookies`, `/accessibility`, `/do-not-sell` `metadata` blocks. Effort: 20 min total.
9. `MEDIUM` Wrap `formatLocal(s.start)` calls in `components/WeekendBlock.tsx:43,95-96` with `<time dateTime={s.start.toISOString()}>...</time>`. Affects every weekend page and calendar tab. Effort: 15 min.
10. `MEDIUM` `app/feed.xml/route.ts:35-46` — add `<lastBuildDate>`, `<image>`, per-item `<category>`. Effort: 30 min.

### Medium lifts (`1–4h` each, ship this week)

11. `HIGH` Make tabs differentiate metadata: `app/series/[slug]/page.tsx:28-40` reads `searchParams.tab`, builds per-tab `title` + `description` + `alternates.canonical`. Decide: canonicalize all to base (cheaper) OR distinct per tab (better SERP). Effort: 1–2 h.
12. `HIGH` Add JSON-LD emitters: create `components/JsonLd.tsx` server component that emits `<script type="application/ld+json">`. Wire into layout for `Organization` + `WebSite`. Wire into series pages for `SportsOrganization`. Wire into weekend pages for `SportsEvent`. Add `BreadcrumbList` on every detail route. Effort: 3–4 h.
13. `HIGH` Replace `<HomeContent>` with a server-rendered `<SessionList>` for the initial list, passed as `children` to the existing client wrapper for filter state. Same pattern for `<FilteredSessions>` / `<MonthScopedWeekends>`. Effort: 2–3 h.
14. `HIGH` Cut the Wikipedia content path. Choose one of: (a) replace History/Rules with a 300-word original summary per series (effort: 4h per series × 15 = 60h — bulkable into 5×3h sessions); (b) keep the dump but strip images via cheerio in `lib/wikipedia-article.ts:141-150`, add `rel="nofollow"` to all `<a>` tags, add a compliant CC BY-SA attribution block to `HistoryTab.tsx`/`RulesTab.tsx`. (b) is the 2h compromise; (a) is the right long-term answer. Effort: 2h for (b).
15. `MEDIUM` Convert `components/tabs/ChampionsTab.tsx` decade groups to `<table>` markup. Keep collapsible UX via `<details>` wrapping a `<table>`. Effort: 1–2 h.
16. `MEDIUM` Populate `content/series/*/drivers.json` for all 15 series. Source from each series's Wikipedia 2026 season page (already used by `lib/wikipedia-season.ts` for live fallback). Effort: 30 min per series × 15 = 8 h, but parallelizable; the curation work itself is data entry. Unblocks `/drivers/[slug]` and `/teams/[slug]` route trees → ~400 new indexable URLs.
17. `MEDIUM` Per-segment OG images: `app/series/[slug]/opengraph-image.tsx`, `app/series/[slug]/weekend/[round]/opengraph-image.tsx`. Themed with `series.meta.color`. Effort: 2 h.

### Bigger projects (`>1d`, plan into sessions)

18. `HIGH` Convert tabs from query strings to paths: `/series/f1/champions`, `/series/f1/history`, etc. via Next.js nested segments or parallel routes. Each tab becomes its own indexable page with its own metadata, JSON-LD, and OG image. This is the right shape to land BEFORE the Supabase URL multiplication. Effort: 1–2 days. Multiplier: every future fix benefits.
19. `HIGH` Originalize Wikipedia-sourced content (History, Rules tabs) — 300-word original per series × 15 series. Effort: 5 days realistic. **The single biggest SEO + GEO lever once the structural fixes ship.**
20. `HIGH` `/el/` Greek route tree. Install `next-intl`, configure `i18n` in `next.config.ts`, mirror the routes under `/el/`, add `alternates.languages` to all metadata, translate static prose (legal pages, overview.md, significance.md) first. Effort: 3–5 days for plumbing + initial translation surface.
21. `MEDIUM` Originalize blog: ship 3–5 weekly race-recap or technical-explainer posts. Each gets `Article` JSON-LD, hero image, `<time>` markup, full meta. Effort: 2–4 h per post.
22. `MEDIUM` Fill `content/series/*/significance.md` (15 stubs) and `drivers.md` (15 stubs) with real prose. Effort: 1 day total.

---

## Appendix A — Per-page audit table

| Route | HTTP | Bytes | `<title>` | description | OG image | canonical | JSON-LD | server-rendered body? | `<time>`? |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 200 | 376 KB | "Paddock — Personal motorsport companion" | site-wide default | root OG | — | 0 | NO (client `HomeContent`) | — |
| `/calendar` | 200 | 375 KB | "Calendar — Paddock" | inherits | root OG | — | 0 | NO (client `FilteredSessions`) | — |
| `/blog` | 200 | 40 KB | "Blog — Paddock" | "Analysis, recaps, and opinion across motorsport championships." | root OG | — | 0 | YES (empty state) | — |
| `/blog/[slug]` | 404 | — | (would be frontmatter title) | (frontmatter summary) | hero if any | — | 0 | YES | yes (no `dateTime=`) |
| `/about` | 200 | 54 KB | "About — Paddock" | none | root OG | — | 0 | YES | — |
| `/changelog` | 200 | 89 KB | "Changelog — Paddock" | none | root OG | — | 0 | YES (markdown) | — |
| `/series/f1` (tab=calendar default) | 200 | 96 KB | "F1 — Paddock" | site-wide default | root OG | — | 0 | NO (client `MonthScopedWeekends`) | — |
| `/series/f1?tab=champions` | 200 | 245 KB | "F1 — Paddock" (identical) | site-wide default (identical) | root OG | — | 0 | YES | — |
| `/series/f1?tab=history` | 200 | 169 KB | "F1 — Paddock" (identical) | site-wide default (identical) | root OG | — | 0 | YES + Wikipedia dump | — |
| `/series/f1?tab=news` | 200 (assumed) | (not probed) | identical | identical | root OG | — | 0 | YES | — |
| `/series/f1/weekend/5` | 200 | 100 KB | composed | composed (richest on site) | root OG | — | 0 | YES | NO |
| `/drivers/lando-norris` | **404** | 24 KB | "Driver not found" | — | root OG | — | 0 | — | — |
| `/teams/mclaren` | **404** | 24 KB | "Team not found" | — | root OG | — | 0 | — | — |
| `/privacy` | 200 | 63 KB | "Privacy Policy — Paddock" | none | root OG | — | 0 | YES (markdown) | — |
| `/terms` | 200 (assumed) | (not probed) | "Terms of Service — Paddock" | none | root OG | — | 0 | YES | — |
| `/cookies` | 200 (assumed) | (not probed) | "Cookie Policy — Paddock" | none | root OG | — | 0 | YES | — |
| `/accessibility` | 200 (assumed) | (not probed) | "Accessibility — Paddock" | none | root OG | — | 0 | YES | — |
| `/do-not-sell` | 200 (assumed) | (not probed) | "Do Not Sell or Share — Paddock" | none | root OG | — | 0 | YES | — |
| `/settings` | 200 (anonymous → Clerk redirect) | — | "Settings — Paddock" | none | root OG | — | 0 | (gated) | — |
| `/sign-in` | 200 | (not probed) | "Sign in — Paddock" | none | root OG | — | 0 | YES | — |
| `/sign-up` | 200 | (not probed) | "Sign up — Paddock" | none | root OG | — | 0 | YES | — |
| `/robots.txt` | **404** | 43 KB | (Next 404) | — | — | — | — | — | — |
| `/sitemap.xml` | **404** | 43 KB | (Next 404) | — | — | — | — | — | — |
| `/llms.txt` | **404** | 43 KB | (Next 404) | — | — | — | — | — | — |
| `/ads.txt` | 200 | 59 B | — | — | — | — | — | — | — |
| `/feed.xml` | 200 | (assumed small) | — | — | — | — | — | — | — |
| `/opengraph-image` | 200 | (PNG) | — | — | self | — | — | — | — |

---

## Appendix B — Recommended JSON-LD per route type

| Route | Schema types | Notes |
|---|---|---|
| `/` (home) | `Organization` + `WebSite` with `potentialAction: SearchAction` | Even without an internal search input today, declare a `SearchAction` placeholder so when search lands the sitelinks searchbox is eligible. `Organization` carries `name`, `url`, `logo`, future `sameAs` array. |
| `/calendar` | `WebPage` + `ItemList` of upcoming `SportsEvent` | Each session = `SportsEvent` with `name`, `startDate`, `endDate`, `location.address`, `sport`. Limit to next 10–20. |
| `/blog` | `WebPage` + `Blog` + `ItemList` of `BlogPosting` summaries | (Once posts exist.) |
| `/blog/[slug]` | `Article` (or `BlogPosting`) | `headline`, `author`, `datePublished`, `dateModified`, `image`, `publisher: Organization`, `mainEntityOfPage`. Critical for Google News / Discover eligibility. |
| `/series/[slug]` (champions tab) | `SportsOrganization` + `ItemList` of historical champions | One `Person`/`SportsTeam` per item with `award: SportsAward`. Decade-grouped via separate `ItemList`s. |
| `/series/[slug]` (calendar tab) | `SportsOrganization` + `ItemList` of `SportsEvent` | Whole-season calendar as `ItemList`. |
| `/series/[slug]` (drivers tab) | `SportsOrganization` + `ItemList` of `SportsTeam` (with embedded `athlete: Person[]`) | Once `drivers.json` exists. |
| `/series/[slug]` (results tab) | `SportsOrganization` + `ItemList` of `SportsResult` | Per-race results. |
| `/series/[slug]/weekend/[round]` | `SportsEvent` with `subEvent: SportsEvent[]` per session | Each session = `subEvent` with `name` ("Practice 1", "Qualifying", "Race"), `startDate`, `endDate`, `location: Place` with `address`, `sport: meta.name`. **Highest rich-result yield on the site.** |
| `/drivers/[slug]` | `Person` with `jobTitle: "Racing driver"` | `affiliation: SportsTeam`, `memberOf: SportsOrganization` (the series), `nationality`, optional `birthDate`, `identifier` for number/code. Once `drivers.json` exists. |
| `/teams/[slug]` | `SportsTeam` | `athlete: Person[]` for the lineup, `sport`, `memberOf: SportsOrganization`. |
| `/privacy`, `/terms`, `/cookies`, `/accessibility`, `/do-not-sell` | `WebPage` + `about: CreativeWork` | Minimal completeness markup. |
| `/changelog` | `WebPage` + `TechArticle` OR `ItemList` of release entries | Each release entry as `SoftwareApplication.softwareVersion` with `releaseNotes` and `datePublished`. |
| `/about` | `AboutPage` + reference to `Organization` | Authoritative org info. |
| `/settings`, `/sign-in`, `/sign-up` | none — mark `noindex` instead | These should not be indexed. |
| **All routes (additive)** | `BreadcrumbList` | Emit on every detail route. Home → Series → Driver / Home → Series → Weekend / etc. UI doesn't need to render visible breadcrumbs for this to work. |

---

_End of audit. No code, config, or commits modified — read-only delta report. Per ESPA discipline, fix-PR work to be planned in a separate session._
