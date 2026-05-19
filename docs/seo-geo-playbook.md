# Paddock — Google Search SEO + GEO Playbook

_Compiled 2026-05-19 by scanning 152 Google Search Central documents in parallel (8 research agents). Cross-references the 10-pillar audit at `docs/audit-seo-geo-2026-05-19.md` and the Track B bundle plan in `docs/HANDOFF.md`._

## How to use this document

This is a reference, not a checklist. **Part 1** is the synthesis — twelve doctrines that distil the 152 docs into what to actually do for Paddock specifically, plus an updated Track B priority order, four new bundles surfaced by the research, things never to do, and the post-launch operational playbook. Read it cold and you have the strategy. **Part 2** is the per-URL reference — one section per Google doc, with 3–8 key takeaways and an explicit "Paddock relevance" line per source. Use it to verify a claim or look up a feature. **Parts 3–5** are the bundle map, deferred candidates, and a flat URL inventory.

If you are about to ship a Track B bundle, read Part 1 + the relevant sub-section of Part 2 + Part 3. If you are debugging traffic, read Part 1 Operational Playbook + Part 2 Section F (Monitoring & Debugging).

---

## Part 1 — Top-line synthesis for Paddock

### The twelve doctrines

#### 1. Mobile-first indexing decides everything

Googlebot Smartphone is the primary crawler. Only content that renders on mobile counts for indexing and ranking. Paddock's mobile PageSpeed 39/100 with LCP 5.2s and TBT 5340ms isn't just a UX problem — it actively suppresses every other SEO signal. B-perf must precede B7, B8, B9 because Google rates mobile content quality first.

Source docs: `mobile-sites-mobile-first-indexing`, `googlebot`, `page-experience`, `core-web-vitals`.

#### 2. Path-based URLs beat query-string tabs and hash fragments

Google explicitly states fragments (`#tab=history`) are invisible to the crawler. Query strings (`?tab=history`) are crawled, but when nine variants share an identical `<title>`, Google treats them as near-duplicates and picks one arbitrarily — the other eight compete for demoted slots. The site-diversity cap typically limits a single domain to two results per SERP, so collapsed-into-one-URL tabs lose seven of nine potential SERP entries per series. B11 (path-based tabs `/series/[slug]/[tab]`) is more urgent than the bundle order suggested; it unlocks both crawl-discovery and per-tab metadata.

Source docs: `url-structure`, `title-link`, `canonicalization`, `links-crawlable`, `ranking-systems-guide` (site diversity cap), `301-redirects` (preserve old `?tab=` URLs).

#### 3. Sitelinks search box is retired — `WebSite` schema still earns the site name

Google sunset the in-SERP search input in 2024. `WebSite` JSON-LD with `SearchAction` no longer drives that feature. But `WebSite` schema (`name`, `url`, optional `alternateName`) remains the primary signal Google uses to pick the site-name display in branded-query results. The audit's Appendix B is partially outdated; we still emit `WebSite` for site-name reasons, just not for the searchbox.

The other flavor of sitelinks — the indented mini-links under the main result — is 100% algorithmic. No markup controls it. The levers are clear internal-link hierarchy, distinct page titles, and brand-query volume. Paddock is too new (4–5 days) for these mini-links to appear; realistic timeline is 6–12+ months.

Source docs: `sitelinks`, `site-names`, `title-link`.

#### 4. Structured data is the comprehension layer, not a ranking bypass

Every Google doc on structured data carries the same disclaimer: valid markup makes pages **eligible** for rich results, but Google chooses display algorithmically based on content quality, E-E-A-T, and policy compliance. Pick types you genuinely qualify for. Required fields are non-negotiable; missing them ⇒ zero eligibility. Partial implementation of recommended fields hurts quality score even when not blocking.

The Paddock priority order (B8 scope):

| Type | Where | Why |
|---|---|---|
| `Organization` | Home only | Brand identity + logo; reused by `publisher` references elsewhere via `@id` |
| `WebSite` | Home only | Site-name display in SERP |
| `BreadcrumbList` | Every nested route | Hierarchy in SERP; minimum 2 items; logical path not URL mirror |
| `SportsEvent` (subtype of `Event`) | `/series/[slug]/weekend/[round]` and arguably one per session via `subEvent` | Highest-leverage enriched-result type on the site |
| `Article` | F1 history tab (live) + future history/blog | Headline + author + date + image stack |
| `ProfilePage` wrapping `Person` | `/drivers/[slug]` (gated on data) | Driver bio pages once `drivers.json` curation lands |
| `ProfilePage` wrapping `Organization`/`SportsTeam` | `/teams/[slug]` (gated on data) | Team pages once `drivers.json` populates |

Notably **deferred or excluded**: `SoftwareApplication` (semantically fits the PWA, blocked by required `aggregateRating` until reviews exist), `Recipe`/`Movie`/`Course`/`Book`/`Product`/`JobPosting`/`LocalBusiness`/`VacationRental`/`Paywalled` (no entity fit), `Speakable` (US-English beta only), `FactCheck` (not a fact-check publisher), `QAPage`/`DiscussionForum` (no UGC), `Carousel` (closed inner-type list excludes our entities).

Source docs: `intro-structured-data`, `sd-policies`, `enriched-search-results`, `generate-structured-data-with-javascript`, `search-gallery`, all 33 type-specific docs.

#### 5. `lastmod` only helps if it's accurate

Google verifies sitemap `lastmod` values against actual page-change history. Faking freshness on every deploy trains the crawler to ignore the field. Our B1 decision to omit `lastmod` entirely was correct and is reaffirmed by the official `sitemaps/build-sitemap` doc: "Google uses the lastmod value if it's consistently and verifiably accurate." Until we wire per-page change tracking (rounds.json mtime, frontmatter dates), omission is the spec-correct shape. **Do not add `lastmod` back in.**

Source docs: `sitemaps/build-sitemap`, `sitemaps/overview`.

#### 6. Canonical tags must be server-rendered, absolute, and in source HTML

`consolidate-duplicate-urls` is explicit: do not inject canonicals via JavaScript. Use absolute URLs. Place in `<head>` server-side. Pair with sitemap inclusion. Don't combine HTML `<link rel="canonical">` and HTTP `Link:` header for the same page — pick one. Quality matters too; Google may override your declared canonical if it judges another page better.

B7 implementation pattern for tab metadata: each tab emits `<link rel="canonical" href="https://paddock-tracker.com/series/<slug>">` consolidating to the base series URL. Each tab still gets a distinct `<title>` + meta description so it earns its own SERP slot via search-features routing, but signals consolidate to the parent.

Source docs: `canonicalization`, `consolidate-duplicate-urls`, `canonicalization-troubleshooting`.

#### 7. Server-rendered HTML matters more than ever

The `javascript-seo-basics` doc admits Googlebot renders JS via Chrome but pulls no punches: "rendering isn't free, SSR is safer." Paddock's `<HomeContent>` and `<FilteredSessions>` are `'use client'` — initial HTML is a props-serialized shell, no card or list content. Non-rendering LLM crawlers (CCBot, Bytespider, older GPTBot path) see only the shell. Even Googlebot, which does render, deprioritises slow-to-hydrate pages because rendering cost cuts into crawl budget.

B9 (server-render bodies) splits these into server `<SessionList>` + client filter wrapper. Same pattern for `MonthScopedWeekends`. This compounds with B-perf — both improve LCP, TBT, crawler visibility together.

Source docs: `javascript-seo-basics`, `fix-search-javascript`, `lazy-loading`, `how-search-works`.

#### 8. Helpful, original, byline-bound content beats every technical lever

Multiple docs (`creating-helpful-content`, `ai-optimization-guide`, `using-gen-ai-content`, ecommerce `write-high-quality-reviews`) converge on the same message: technical SEO is the floor, content quality is the ceiling. Specifically: people-first content, demonstrate first-hand experience, byline with author bio + URL, transparent disclosure of AI use, dates that reflect real edits.

The F1 history tab is the template. The 14 placeholder history tabs and 15 placeholder rules tabs are thin-content liabilities until filled — they risk being seen as low-quality once indexed. A new bundle **B-content** captures filling these out under the F1 pattern.

E-E-A-T explicitly: Trust is most important. Experience + Expertise + Authoritativeness reinforce Trust. E-E-A-T is NOT a ranking factor by itself (per `creating-helpful-content`) but it's how quality is judged.

Source docs: `creating-helpful-content`, `ai-optimization-guide`, `using-gen-ai-content`, `reviews-system`, ecommerce `write-high-quality-reviews`.

#### 9. Page metadata + visible date hygiene controls the SERP impression

For each indexable page, Google composes the SERP entry from: `<title>` + visible H1 + Open Graph + structured data + anchor text pointing to the page + `WebSite` schema. Identical `<title>` across tabs is the duplicate-title antipattern. Missing meta description ⇒ Google auto-snippets from body content (often badly). Publication dates must be both in JSON-LD (`datePublished`, `dateModified`) AND visible on the page; mismatch confuses Google.

Specific Paddock items:
- B7 ships per-tab titles + meta descriptions.
- B8 ships `Article` schema with `datePublished` + `dateModified` aligned to the byline on history pages.
- Future blog posts emit `BlogPosting` with the same date hygiene.

Source docs: `title-link`, `snippet`, `valid-page-metadata`, `special-tags`, `publication-dates`.

#### 10. Discover surfaces are visual — large images + Article schema is the unlock

Google Discover prefers ≥1200px-wide images at ~16:9 (300k+ total pixels), surfaced via `<meta name="robots" content="max-image-preview:large">` plus `Article` schema with valid `image` array. Motorsport is timely + visual + tribal — exactly the Discover sweet spot. The mobile-PWA install funnel benefits doubly.

This surfaces a new candidate bundle **B-discover** (image-preview meta + Discover-grade hero images per blog post + verification that OG images meet the 1200×675 threshold). Pairs naturally with B10 (per-segment OG images).

Source docs: `google-discover`, `ai-features`, `google-images`.

#### 11. Greek `/el/` route tree is the right architecture

For B12: subdirectory pattern (`/el/...`) on `.com` is recommended over subdomain or ccTLD. Bidirectional `hreflang` reciprocity is mandatory — every English page links to its Greek counterpart and vice versa, or annotations get ignored. Use `hreflang="x-default"` for the fallback. Locale-adaptive serving at the root URL is explicitly discouraged: don't auto-detect language and swap content at `/` — separate URLs only.

Implementation method (pick one, not multiple): HTML `<link rel="alternate" hreflang="...">`, HTTP `Link:` header, or sitemap entries. In Next.js, `metadata.alternates.languages` emits the HTML form. Greek does NOT currently get reviews-system credit (only 11 languages supported; Greek not in list). Discover, AI surfaces, Translated Results all still work in Greek.

Source docs: `international` (overview), `managing-multi-regional-sites`, `localized-versions`, `locale-adaptive-pages`, `url-structure` (multi-regional section).

#### 12. AI features are SEO-fed, not a separate channel

Per `ai-optimization-guide`: "no special optimization" for AI Overviews or AI Mode. Pages must be indexed, snippet-eligible (no `noindex`, no blanket `nosnippet`), and discoverable via standard signals. Google explicitly disclaims `llms.txt` as "the next keywords meta tag." Our llms.txt ships in B1 as a hedge for non-Google LLM crawlers (Cursor / IDE agents / OpenAI's OAI-SearchBot, which reportedly reads it occasionally) — not as a Google bet.

AI traffic shows up in Search Console under the standard "Web" search type — no new report. The control levers are existing: `nosnippet`, `data-nosnippet`, `max-snippet`, `noindex`. Ship `Article` schema, server-rendered content, breadcrumbs, and clean canonicals; AI features follow automatically.

Source docs: `ai-features`, `ai-optimization-guide`, `using-gen-ai-content`.

### Updated Track B priority — post-research

This supersedes the priority table in `docs/HANDOFF.md` (research-phase synthesis 2026-05-19). The order changes only at the margins; bundle definitions are unchanged.

| Order | Bundle | Why this order |
|---|---|---|
| 1 | **B1** (DONE) — robots/sitemap/llms.txt | Foundation; merged in 0.10.30. |
| 2 | **B-perf** — mobile-perf pass | Mobile-first indexing means Perf 39/100 suppresses every other signal. Folds the pinned "Speed Insights US-perf" item. |
| 3 | **B8** — JSON-LD | Organization + WebSite (site-name) + BreadcrumbList + SportsEvent + Article. Eligibility for rich results across home / weekend / history pages. |
| 4 | **B7** — tab-aware metadata + canonical | Kills duplicate-title cannibalization across 9 tabs × 15 series = 135 collapsed URLs. |
| 5 | **B-content (NEW)** — fill placeholder history + rules tabs | Strongest non-technical lever per helpful-content + AI-features docs. Currently 14 placeholder history + 15 placeholder rules tabs are thin-content liabilities. |
| 6 | **B11** — path-based tab routes | Promoted above B9. Unlocks crawl-discovery + per-tab metadata + breadcrumb hierarchy + clean 301s from old `?tab=` URLs. |
| 7 | B2 — noindex auth pages | 5-min cheap win. |
| 8 | B3 — `rel="nofollow"` on outbound news + ≤120-char excerpts | 15-min cheap win. |
| 9 | B4 — per-route descriptions on legal/about/changelog pages | 20-min cheap win. |
| 10 | B5 — `<time dateTime=…>` markup on `WeekendBlock` + `CalendarTab` | 20-min cheap win. |
| 11 | B6 — RSS hardening | 30-min cheap win. |
| 12 | **B-discover (NEW)** — `max-image-preview:large` + Discover-grade OG images | Visual + timely + tribal fit Discover perfectly. ~30 min meta + folds into B10. |
| 13 | B9 — server-render home/calendar bodies | Helps perf + non-JS LLM crawlers. Demoted slightly since B-perf addresses the primary symptom. |
| 14 | B10 — per-segment OG images | CTR; pair with B-discover. |
| 15 | **B-monitor (NEW)** — operational runbook | Post-deploy + weekly + monthly Search Console checks. No code; a runbook. |
| 16 | B12 — Greek `/el/` route tree | Multi-week; defer. |
| 17 | **B8b (DEFERRED)** — SoftwareApplication schema | Blocked until aggregate review data exists. |

### Four new bundles surfaced

1. **B-content** — Fill the 14 placeholder history tabs + 15 placeholder rules tabs + 3–5 initial MDX blog posts in `content/posts/`. Each follows the F1 history pattern (curated markdown, byline, "last updated" frontmatter, 3-section structure, inline source citations). The single highest-impact non-technical lever per the helpful-content and AI-features docs. Slot after B7.
2. **B-discover** — `<meta name="robots" content="max-image-preview:large">` site-wide, plus blog hero images ≥1200×675 16:9, plus `Article.image` array pointing at multi-aspect renditions. Pairs with B10. Enables Google Discover eligibility.
3. **B-monitor** — Operational runbook (not code). Weekly: `site:paddock-tracker.com` Google + Bing tracking. Monthly: Security Issues + Manual Actions report. Post-deploy: URL Inspection on top 10 routes. Sitemap submitted to both Google Search Console and Bing Webmaster Tools (ChatGPT search uses Bing's index — confirmed by external research in PR #45). Add to `docs/HANDOFF.md` as an ops appendix.
4. **B8b (deferred)** — `SoftwareApplication` JSON-LD on `/` for the PWA itself. Semantic fit is perfect (`WebApplication` + `applicationCategory: "SportsApplication"`) but the required `aggregateRating` / `review` blocks emission until Paddock has either real user reviews or at least one editorial review to cite. Park until a review surface exists.

### Things to never do for Paddock

- Don't add `lastmod` back to the sitemap until per-page change tracking lands. Fake freshness is worse than no freshness.
- Don't add `priority` or `changefreq` back — Google ignores both entirely.
- Don't emit `host:` in robots.txt — Yandex deprecated it; Google ignores it.
- Don't AMP anything. AMP is dead as a Google Search feature priority.
- Don't ship Web Stories (AMP-only).
- Don't emit `SoftwareApplication` until `aggregateRating` is real. Invalid markup ⇒ zero eligibility.
- Don't emit `Carousel` schema. Inner-type list is closed (Course/Movie/Recipe/Restaurant) and excludes our entities. For event lists use `ItemList` of `SportsEvent`.
- Don't auto-redirect at `/` based on browser locale or IP. The `/el/` tree is separate URLs with reciprocal hreflang.
- Don't combine HTML `<link rel="canonical">` and HTTP `Link:` header on the same page — pick one.
- Don't inject canonicals or JSON-LD via client JavaScript. Server-render both.
- Don't block JS/CSS bundles in robots.txt. Googlebot needs them to render.
- Don't return 500/503/429 for sustained periods — Google reduces crawl rate hostname-wide and indexed URLs drop.
- Don't expect `llms.txt` to move Google rankings. It's a forward-compatible hedge.
- Don't expect sitelinks-mini-links for 6–12+ months. Site is 4–5 days old.
- Don't use the `keywords` meta tag. Ignored since the early 2000s.
- Don't use `rel="next"` / `rel="prev"` for pagination — deprecated. Use real `<a href>` to `?page=N` URLs and self-canonical per page.
- Don't block Googlebot with age gates, sign-in walls, or interstitials that obstruct public content.

### Operational playbook

**After every push to `main`:**
1. Verify Vercel preview/prod deploy is green.
2. Spot-check `/robots.txt`, `/sitemap.xml`, `/llms.txt` for unexpected diffs after structural changes.
3. URL Inspection in Search Console on any newly-added route segment (manual; one-off per ship).

**Weekly:**
4. `site:paddock-tracker.com` on Google + Bing (or DuckDuckGo). Confirm the indexed-URL count is growing toward the sitemap count (~227 URLs today). Plateauing or shrinking is the signal.
5. Search Console **Performance** report: top-line impressions, clicks, CTR. Compare to prior week.
6. Search Console **Page Indexing** report: any new "Why pages aren't indexed" entries triage immediately.

**Monthly:**
7. Search Console **Security Issues** + **Manual Actions** reports — should be empty; investigate immediately if not.
8. Search Console **Core Web Vitals** report once Paddock has enough field data. Target: 75% of URLs in green for LCP, INP, CLS.
9. Bubble-chart analysis: export Performance report, plot CTR × position × clicks. Focus on low-pos / high-CTR (B8 rich-results opportunity) and high-pos / low-CTR (snippet improvement opportunity).

**After bundle ships:**
10. URL Inspection on a representative page covered by the bundle.
11. Rich Results Test on any new JSON-LD.
12. Note the deploy date in `CHANGELOG.md` so we can correlate Search Console deltas to the ship.

**Annual:**
13. Re-read this playbook — Google's docs move every few months. The "What changed" delta vs previous compile is its own audit.

---

## Part 2 — Per-document reference

Each subsection below mirrors a chunk of Google's docs. Per URL: a one-line purpose, 3–8 takeaways, and an explicit Paddock-relevance line with the Track B bundle (if any) it feeds.

### Section A — SEO Fundamentals

#### seo-starter-guide
**Source:** https://developers.google.com/search/docs/fundamentals/seo-starter-guide
**Purpose:** Foundational SEO checklist for new sites.

- Verify indexing first with `site:` operator before optimizing.
- Use descriptive, keyword-bearing URL paths (not random IDs).
- Unique title tags + meta descriptions per page influence SERP display.
- Compelling, useful, well-organized content beats most tactics.
- Quality images near relevant text with descriptive alt text.
- Strategic internal linking with clear anchor text.
- Set up Search Console to receive indexing alerts.
- Ignore keyword stuffing and `meta keywords` tag.

**Paddock relevance:** applicable. Direct match for B7 (per-tab titles/descriptions), internal linking gaps, and image alt text across the 15 series.
**Feeds:** B7, B2–B6, image-alt audit sub-task.

#### how-search-works
**Source:** https://developers.google.com/search/docs/fundamentals/how-search-works
**Purpose:** Explains the crawl → index → serve pipeline.

- Three stages: crawling, indexing, serving — debug at the correct stage.
- Googlebot renders JS via Chrome but rendering isn't free; SSR is safer.
- Canonicalization groups similar pages and picks one to display.
- Not every crawled page is indexed; quality + design matter.
- No pay-to-rank or pay-to-crawl mechanism exists.
- Ranking uses hundreds of signals (location, language, device, quality).

**Paddock relevance:** applicable. Informs B9 — current client-rendered tab bodies risk being seen as thin/duplicate; canonicalization risk is exactly why duplicate tab titles are dangerous.
**Feeds:** B9, B7, B-perf.

#### creating-helpful-content
**Source:** https://developers.google.com/search/docs/fundamentals/creating-helpful-content
**Purpose:** People-first content + E-E-A-T guidance.

- Create for your audience first, not for ranking manipulation.
- Demonstrate Experience, Expertise, Authoritativeness, Trust — bylines linking to author pages help.
- Trust is the most important E-E-A-T factor.
- Don't mass-produce content on trending topics without expertise.
- Disclose AI/automation use transparently.
- Deliver insight beyond what's obvious; readers shouldn't need other sources.
- Ignore word-count targets and artificial freshness signals.

**Paddock relevance:** applicable. F1 history tab pattern (curated, bylined) is the model; the 14 placeholder history tabs + 15 placeholder rules tabs need real content before they help.
**Feeds:** B-content (NEW); B8 Person/Author schema on bylines.

#### ai-optimization-guide
**Source:** https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
**Purpose:** Google's guidance on visibility in AI features.

- SEO fundamentals carry over to AI features — no separate "AEO" needed.
- Prioritize unique, non-commodity content with original perspective.
- Crawlability + indexing eligibility + clear structure are the foundation.
- Skip "AEO hacks": llms.txt, artificial chunking, fake mentions.
- Write for humans first, no variant content for ranking games.
- Structured data helps but is not required for AI visibility.
- Stay informed on browser agents and protocols like UCP.

**Paddock relevance:** applicable, with a wrinkle — Paddock just shipped `public/llms.txt` (B1). Google explicitly disclaims llms.txt as an "AEO hack". Keep it (low cost, OpenAI/Anthropic crawlers do read it) but don't expect Google visibility lift.
**Feeds:** B8; explicit note in playbook that llms.txt is hedge-not-bet.

#### using-gen-ai-content
**Source:** https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
**Purpose:** Policy on AI-generated content.

- AI content must meet Search Essentials + spam policy — quality bar is identical.
- Scaled content abuse (many pages, no value) violates policy.
- Accuracy, quality, relevance especially required for metadata, structured data, alt text.
- Disclose how content was created; explain automation use.
- AI-generated images need IPTC metadata labeling (for ecommerce).
- Validate structured data passes guidelines for rich-result eligibility.
- AI should augment, not replace, human expertise per Quality Raters guidelines.

**Paddock relevance:** partial. Paddock isn't mass-producing AI content; curated markdown is human-written. Relevant if Claude ever drafts history/rules content — must be reviewed + bylined as human-edited.
**Feeds:** Author/content-policy note in B-content.

#### get-started
**Source:** https://developers.google.com/search/docs/fundamentals/get-started
**Purpose:** Technical SEO + site-maintenance overview.

- Understand crawl/index/serve pipeline to debug effectively.
- robots.txt + sitemaps are complementary, not redundant.
- 301 for permanent, 302 for temporary; emit real 404s not soft 404s.
- Structured data unlocks rich results.
- Mobile-first indexing — responsive design mandatory.
- HTTPS is a ranking + trust signal.
- Core Web Vitals are ranking factors; monitor via Search Console + PageSpeed.

**Paddock relevance:** applicable. Confirms B-perf, B8, and validates current HTTPS/HSTS work in Track A.
**Feeds:** B-perf, B8.

#### get-started-developers
**Source:** https://developers.google.com/search/docs/fundamentals/get-started-developers
**Purpose:** Developer-focused Search getting-started.

- Use URL Inspection / Rich Results Test to see Google's render vs. browser render.
- Crawlable links require real `<a href>` (not JS-only handlers).
- JS limitations: Google ≠ a full browser; assume conservative support.
- Make text visible — Googlebot doesn't OCR images or read video frames.
- Unique titles + meta descriptions per page.
- Semantic HTML preferred over canvas / plugin rendering.
- Explicit indexing control via robots.txt, noindex, password.

**Paddock relevance:** applicable. The crawlable-links rule directly indicts the `?tab=` query-string tab system. Strengthens case for B11.
**Feeds:** B11, B7, B9, B-perf.

#### do-i-need-seo
**Source:** https://developers.google.com/search/docs/fundamentals/do-i-need-seo
**Purpose:** When to hire an SEO consultant.

- Small site owners can self-manage with free Google tools.
- Expect 4–12 months before SEO changes show benefit.
- Engage SEOs early during redesigns.
- Avoid "guaranteed #1 ranking" promises — red flag.
- Avoid shadow domains, doorway pages, link schemes.
- Site owner is liable for tactics any hired SEO uses.

**Paddock relevance:** not applicable. Solo project, no SEO hire planned.
**Feeds:** —.

### Section B — Crawling & Indexing

#### crawling-indexing (overview)
**Source:** https://developers.google.com/search/docs/crawling-indexing
**Purpose:** Hub for controlling discovery, crawling, and indexing.

- Logical, human-intelligible URL structure is foundational for crawler comprehension.
- Sitemaps explicitly surface new/updated pages instead of relying on link discovery alone.
- robots.txt manages access but does not prevent indexing.
- Canonicalization consolidates duplicates; reduces wasted crawl budget.
- Mobile-first indexing is the default — desktop-only renderings are a liability.
- JavaScript-heavy pages need consideration for rendering and lazy-loaded content.
- Meta tags (noindex, robots) signal indexing preferences.

**Paddock relevance:** applicable. Hub doc framing every other Track B item.
**Feeds:** Cross-cutting; informs B1 (done), B7, B8, B9.

#### indexable-file-types
**Source:** https://developers.google.com/search/docs/crawling-indexing/indexable-file-types
**Purpose:** Catalog of file formats Googlebot can index.

- Content-Type header is primary signal; extension is fallback.
- Plain text (HTML, XML, CSV, source code) fully supported.
- Office, PDF, OpenOffice documents indexable.
- Images (BMP/GIF/JPEG/PNG/WebP) and video (MP4/WebM/MOV) indexed.
- Specialty: TeX, EPUB, PostScript, GPX.
- `filetype:` operator lets users filter results.

**Paddock relevance:** partial. Paddock is HTML+JSON-LD only — confirms OG images (PNG/JPEG/WebP) are indexable.
**Feeds:** B10 (OG image format choices).

#### url-structure
**Source:** https://developers.google.com/search/docs/crawling-indexing/url-structure
**Purpose:** Best practices for crawler-friendly URLs.

- Comply with IETF STD 66; percent-encode reserved characters.
- Don't use URL fragments to change content — Google doesn't see them. Use History API.
- Standard parameter encoding: `=` for pairs, `&` for separators.
- Prioritize readable, descriptive slugs over numeric IDs.
- Hyphens, not underscores, between words.
- Trim parameters that don't change content.
- Block infinite calendars, additive filters, faceted noise via robots.txt.
- Multi-regional sites: country-specific domains or subdirectories.

**Paddock relevance:** applicable. Direct hit on B11 (path-based tabs vs fragments) and B12 (Greek `/el/` locale).
**Feeds:** B11, B12.

#### links-crawlable
**Source:** https://developers.google.com/search/docs/crawling-indexing/links-crawlable
**Purpose:** What makes links discoverable to Googlebot.

- Use `<a href>`, not JS click handlers or custom routers.
- `href` must resolve to a real URL — not `javascript:`.
- Descriptive anchor text; `title` is fallback.
- Image links need `alt` text.
- Avoid "click here" / "read more" anchors.
- Don't cluster links; distribute through prose.
- Every important page needs at least one internal link.

**Paddock relevance:** applicable. Confirms Next.js `<Link>` components emit proper `<a href>`. Driver/team pages need internal links from series pages once they exist.
**Feeds:** B9, future driver/team bundle.

#### sitemaps/overview
**Source:** https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
**Purpose:** When and why to use sitemaps.

- Sitemap describes pages, videos, files, and their relationships.
- Needed when: 500+ pages, new site with thin backlinks, heavy rich media, news.
- Optional when: small + well-linked site.
- Supports video, image, news extensions with specialized metadata.
- Inclusion does NOT guarantee indexing.
- Improves discovery efficiency for complex sites.

**Paddock relevance:** applicable. ~227 URLs today; driver/team expansion will push past 500. Already shipped via `app/sitemap.ts`.
**Feeds:** B1 (done).

#### sitemaps/build-sitemap
**Source:** https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
**Purpose:** How to construct and submit sitemaps.

- XML (most versatile), RSS/Atom, plain text supported.
- Hard limits: 50 MB uncompressed OR 50 000 URLs per sitemap.
- `lastmod` only used when consistently accurate — minor edits like copyright date don't qualify.
- Only canonical URLs in sitemap; no duplicates.
- Submit via Search Console, API, or `Sitemap:` line in robots.txt.
- Cross-domain sitemaps allowed if all properties verified in Search Console.

**Paddock relevance:** applicable. Validates B1 decision to omit `lastmod`. Confirms robots.txt `Sitemap:` directive is a valid submission method.
**Feeds:** B1 (done) — reference for future per-page mtime work.

#### sitemaps/large-sitemaps
**Source:** https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps
**Purpose:** Splitting sitemaps via index files.

- Use sitemap index when over 50K URLs or 50MB.
- Up to 500 sitemap index files per site in Search Console.
- Child sitemaps must live in same directory or deeper than the index.
- Cross-site sitemaps need verified cross-site submission setup.
- Index file holds up to 50K `<loc>` entries.
- `lastmod` (W3C datetime) on index entries helps schedule crawling.

**Paddock relevance:** not applicable yet. 227 URLs is far below threshold.
**Feeds:** — (deferred reference).

#### sitemaps/image-sitemaps
**Source:** https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
**Purpose:** Surface images that JS or layout might hide from Googlebot.

- Either standalone image sitemap or `<image:image>` blocks inside main sitemap.
- Namespace: `http://www.google.com/schemas/sitemap-image/1.1`.
- Only `<image:image>` + `<image:loc>` required. caption/title/license deprecated.
- Up to 1 000 image entries per `<url>`.
- Cross-domain hosting permitted if both domains Search-Console-verified.

**Paddock relevance:** partial. Minimal first-party imagery today; becomes a B10 companion if driver headshots / circuit maps ship.
**Feeds:** Downstream of B10.

#### sitemaps/news-sitemap
**Source:** https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
**Purpose:** Help news publishers surface fresh articles to Google News.

- Articles included must be ≤2 days old; strip metadata older than that.
- Namespace: `http://www.google.com/schemas/sitemap-news/0.9`.
- Required: `<news:news>`, `<news:publication>` (name + language), `<news:publication_date>`, `<news:title>`.
- Publication name must EXACTLY match `news.google.com` listing.
- Dates in W3C format.
- Up to 1 000 entries per file.
- Update existing file rather than create per-article.

**Paddock relevance:** not applicable. Paddock is not a Google News publisher.
**Feeds:** —.

#### sitemaps/video-sitemaps
**Source:** https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps
**Purpose:** Help Google find and index on-page video content.

- Required: `<video:video>`, `<video:thumbnail_loc>`, `<video:title>`, `<video:description>`.
- Plus either `<video:content_loc>` (file) or `<video:player_loc>` (player URL).
- Files must be reachable without login/firewall/robots block; HTTP/FTP only.
- Namespace `http://www.google.com/schemas/sitemap-video/1.1`.
- Multiple videos can nest under one `<url>`.
- Optional: `<video:duration>`, `<video:rating>`, `<video:publication_date>`, `<video:family_friendly>`.
- mRSS feeds are an alternative.

**Paddock relevance:** not applicable. No video content.
**Feeds:** —.

#### sitemaps/combine-sitemap-extensions
**Source:** https://developers.google.com/search/docs/crawling-indexing/sitemaps/combine-sitemap-extensions
**Purpose:** Stack image/video/news/hreflang extensions inside one sitemap.

- Declare each extension's `xmlns` on the `<urlset>` root.
- Multiple namespaces co-exist on one file.
- Extension tag order after `<loc>` is irrelevant.
- File-size limits still apply — combining inflates size.
- One `<url>` can hold news + video + image + hreflang at once.

**Paddock relevance:** partial. Future-relevant if hreflang (B12 Greek) lands at the same time as image metadata.
**Feeds:** B12 — when added, declare xhtml hreflang namespace.

#### ask-google-to-recrawl
**Source:** https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
**Purpose:** Trigger Google to re-fetch new or updated URLs.

- URL Inspection tool requests individual URL recrawl (Search Console owner/full user only).
- Hard quota on per-URL submissions; repeat requests don't speed it up.
- Sitemaps are the bulk-submission path.
- Crawling can take days to weeks.
- Submission ≠ guaranteed indexing.
- Monitor via Index Status and URL Inspection.

**Paddock relevance:** applicable. Post-launch workflow: B1 sitemap ships → submit via Search Console → use URL Inspection for high-value pages.
**Feeds:** B-monitor.

#### crawlers-fetchers/overview-google-crawlers
**Source:** https://developers.google.com/crawling/docs/crawlers-fetchers/overview-google-crawlers
**Purpose:** Catalog of all Google crawler/fetcher types.

- Three classes: common crawlers (Googlebot), special-case (AdsBot), user-triggered fetchers.
- Distributed: requests come from many IPs across global datacenters.
- HTTP/1.1 and HTTP/2; 421 lets sites opt out of HTTP/2.
- gzip/deflate/Brotli supported; first 15 MB crawled (per-crawler may vary).
- Identification: user-agent + IP + reverse DNS.
- ETag/Last-Modified honored; `Cache-Control: max-age` recommended.
- Rate can be reduced via documented signals.

**Paddock relevance:** partial. Confirms ISR + caching headers shipped in Track A interact correctly with Googlebot. Brotli already on at Vercel edge.
**Feeds:** B-perf — validate cache headers on Vercel defaults.

#### googlebot
**Source:** https://developers.google.com/search/docs/crawling-indexing/googlebot
**Purpose:** Deep dive on Googlebot's behavior.

- Two variants: Mobile (Smartphone) + Desktop; same robots.txt rules.
- Mobile is dominant — mobile-first indexing.
- 2 MB cap for standard files, 64 MB for PDFs.
- Crawl frequency ≤ once per few seconds typical.
- User-agent spoofable — verify via reverse DNS or IP ranges.
- Crawl-blocked URLs can still appear indexed (links from elsewhere).
- Googlebot timezone: Pacific Time (US IPs).

**Paddock relevance:** applicable. Mobile-first is critical — Paddock's mobile PageSpeed is 39/100. Confirms B-perf as highest leverage.
**Feeds:** B-perf.

#### crawlers-fetchers/reduce-crawl-rate
**Source:** https://developers.google.com/crawling/docs/crawlers-fetchers/reduce-crawl-rate
**Purpose:** Emergency throttling of Googlebot.

- Return 500/503/429 only for hours-to-1-2-days windows.
- Sustained errors → automatic rate reduction across the hostname.
- Recovery is automatic once errors clear.
- Extended throttling can drop URLs from index and pause Ads.
- Long-term throttling: Search Console request, days to approve.
- Root-cause first — faceted nav, infinite calendars, Dynamic Search Ads are common culprits.

**Paddock relevance:** not applicable. No crawl-rate pressure.
**Feeds:** —.

#### crawlers-fetchers/verify-google-requests
**Source:** https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests
**Purpose:** Confirm a request is genuinely from Google.

- Three crawler categories (common, special-case, user-triggered).
- Manual: reverse DNS → must end in `googlebot.com`, `google.com`, or `googleusercontent.com` → forward DNS verifies.
- Common crawlers: `crawl-*-*-*-*.googlebot.com`; special-case: `rate-limited-proxy-*-*-*-*.google.com`.
- Google publishes JSON IP-range files for automated CIDR matching.
- Used to filter out spoofers in logs / rate-limit logic.

**Paddock relevance:** not applicable. No bot-filtering logic today.
**Feeds:** —.

#### robots/intro
**Source:** https://developers.google.com/search/docs/crawling-indexing/robots/intro
**Purpose:** What robots.txt does and does not do.

- Manages crawl traffic; not a privacy/indexing tool.
- URL can still appear in results if other sites link to it.
- Use `noindex`, password, or removal — not robots.txt — to hide content.
- Media-file blocking via robots.txt does work for Search visibility.
- Crawlers vary in respect for robots.txt.
- Can block non-essential JS/CSS only if pages function without them.

**Paddock relevance:** applicable. Validates B1 robots.ts approach. Don't block `_next/static/*` JS/CSS bundles.
**Feeds:** B1 (done).

#### robots-txt/robots-txt-spec
**Source:** https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
**Purpose:** Exact parser semantics for robots.txt.

- File must live at top-level (`/robots.txt`); scoped to host + protocol + port.
- Most-specific user-agent group wins; multiple matches merge but never with `*`.
- Wildcards: `*` (zero+ chars) and `$` (end of URL). Trailing `*` ignored.
- Conflicting rules: longest path wins; ties → least restrictive.
- Field names case-insensitive; paths case-sensitive.
- `Sitemap:` directive accepts full URL, independent of user-agent.
- 2xx → process; 4xx (except 429) → assume open; 5xx → 12h soft-block then 30d cached fallback.
- File capped at 500 KiB; invalid lines ignored.

**Paddock relevance:** applicable. Sitemap directive in robots.ts is spec-correct. Reference if per-bot rules (GPTBot block etc.) are added later.
**Feeds:** B1 (done); future AI-bot policy.

#### canonicalization
**Source:** https://developers.google.com/search/docs/crawling-indexing/canonicalization
**Purpose:** How Google picks one URL from a duplicate set.

- Canonical = Google's chosen representative URL from duplicates.
- Common sources: regional variants, device variants, HTTP/HTTPS, filters, accidental access paths.
- Signals weighed: HTTPS, redirects, sitemap presence, `rel="canonical"`.
- All signals are hints, not commands.
- Canonical gets the lion's share of crawls; duplicates crawled less.
- Display can vary by user context (e.g. mobile).
- Pages aren't duplicates if primary content differs by language.
- Quality assessment runs on the canonical.

**Paddock relevance:** applicable. Series pages with multiple tab states currently risk being seen as duplicates without canonical tags.
**Feeds:** B7, B8 indirectly.

#### consolidate-duplicate-urls
**Source:** https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
**Purpose:** Implementation guide for canonicalization.

- Strength order: redirects / `rel=canonical` > sitemap. Stack them.
- `<link rel="canonical">` in `<head>`; use absolute URLs.
- Choose one delivery (HTML link OR HTTP header) — combining is error-prone.
- HTTPS auto-preferred unless bad cert/HTTP redirect overrides.
- hreflang reciprocity strengthens canonical selection within a language cluster.
- DON'T: robots.txt or removal tools for canonicalization, conflicting canonicals, `noindex` as a workaround.
- Don't inject canonicals via JS — put them in source HTML.
- Sitemap-as-canonical fine for huge/volatile sets but weakest signal.

**Paddock relevance:** applicable. Drives B7 exact implementation: emit `<link rel="canonical" href="https://paddock-tracker.com/series/<slug>">` in SSR `<head>` for every tab variant.
**Feeds:** B7; B12 hreflang reciprocity.

#### canonicalization-troubleshooting
**Source:** https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting
**Purpose:** Diagnose when Google picks the wrong canonical.

- Use URL Inspection to see Google's selected canonical.
- Quality matters — Google may override your declared canonical.
- Localized duplicates need hreflang annotations.
- CMS misconfigurations are a common cause; validate raw HTML.
- Server config can serve cross-domain content or soft 404s that confuse selection.
- Hacked sites often inject malicious canonicals/redirects.
- Syndication: canonical alone won't stop duplication — partners must `noindex`.
- External copycats: DMCA, not Search-Console tooling.

**Paddock relevance:** applicable. Post-B7 verification workflow.
**Feeds:** B7 validation + B-monitor.

#### mobile-sites-mobile-first-indexing
**Source:** https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing
**Purpose:** Google indexes the mobile version of pages.

- Googlebot Smartphone is the primary crawler; only content visible on mobile is used for indexing/ranking.
- Responsive design is Google's recommended configuration (vs dynamic serving or separate URLs).
- Mobile and desktop must have equivalent primary content, `<title>`, meta description, and structured data.
- Prioritize Breadcrumb, Product, and VideoObject structured data on mobile.
- Don't block images/CSS/JS via robots.txt; content must render without user interaction (no tap-to-expand for primary text).
- Common landmines: identical URLs with different error pages, URL fragments only on mobile, many-to-one desktop-to-mobile redirects.

**Paddock relevance:** applicable. Paddock is responsive Next.js — content parity and "no interaction required to render" matter for the tab system.
**Feeds:** B9, B7.

#### amp (overview), amp/about-amp, amp/enhance-amp, amp/validate-amp, amp/remove-amp
**Sources:** https://developers.google.com/search/docs/crawling-indexing/amp and four sub-pages.
**Purpose:** AMP overview, display mechanics (cache, viewer, signed exchange), configuration, validation, removal.

- AMP HTML compliance + validation required for AMP-specific Search features.
- Content parity between AMP and canonical mandatory.
- `rel="amphtml"` on canonical, `rel="canonical"` on AMP.
- AMP is not a ranking factor; speed (which AMP enforces) is judged equally regardless of tech.
- Removal: drop `rel="amphtml"` and 301 AMP URL to canonical; invalidate Google AMP Cache.

**Paddock relevance:** not applicable across all five. Paddock is a Next.js 16 PWA; AMP is end-of-life as a Search priority.
**Feeds:** —.

#### javascript/javascript-seo-basics
**Source:** https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
**Purpose:** How Googlebot crawls, renders, and indexes JavaScript-driven pages.

- Three phases: crawl → render → index; Googlebot queues 200-status pages for render unless `noindex` is set.
- Pre-rendering / SSR encouraged for speed and non-JS crawlers.
- SPAs should use History API (real URLs) not URL fragments; canonical URLs should be set in HTML.
- Serve meaningful HTTP status codes; in client apps redirect to a real 404 or set `noindex` to avoid soft 404s.
- Use content-fingerprinted filenames so Googlebot's aggressive cache doesn't serve stale assets.
- Web Components: shadow DOM is flattened during rendering; verify rendered HTML in URL Inspection.

**Paddock relevance:** applicable. Paddock ships client-only shells (`<HomeContent>`/`<FilteredSessions>`) — directly addresses B9 and the LCP/TBT problem.
**Feeds:** B-perf, B9, B7.

#### javascript/fix-search-javascript
**Source:** https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript
**Purpose:** Debugging Googlebot rendering issues.

- Rich Results Test and URL Inspection are canonical diagnostics — see rendered HTML and console errors.
- SPAs that respond 200 with error content cause soft 404s; redirect or emit `noindex`.
- Don't gate content behind permissions (camera/geolocation).
- AJAX `#!` crawling scheme is deprecated; use History API.
- localStorage / sessionStorage / cookies are cleared between Googlebot page loads.
- Feature-detect + provide fallbacks for WebGL/WebSockets/WebRTC.
- Web components must use `<slot>` so light DOM flattens into rendered HTML.

**Paddock relevance:** applicable. Paddock's `?tab=` SPA-ish behaviour should be URL-Inspected before B11.
**Feeds:** B9, B11, B-perf.

#### javascript/lazy-loading
**Source:** https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading
**Purpose:** Lazy-loading patterns that don't hide content from Googlebot.

- Content must load when in viewport — Googlebot does not scroll or click.
- IntersectionObserver, native `loading="lazy"`, and viewport-aware libraries are recommended.
- Don't lazy-load above-the-fold content (LCP hit).
- Infinite scroll needs persistent paginated URLs (`?page=12`) with sequential discovery and absolute identifiers.
- Validate via URL Inspection — confirm `src` attributes present.

**Paddock relevance:** applicable. Any future calendar/sessions lazy-loading must be IntersectionObserver-based.
**Feeds:** B-perf, B9.

#### valid-page-metadata
**Source:** https://developers.google.com/search/docs/crawling-indexing/valid-page-metadata
**Purpose:** Use valid HTML in `<head>` so Google can read all metadata.

- Only 8 elements valid inside `<head>`: title, meta, link, script, style, base, noscript, template.
- An invalid element (e.g. `<iframe>` or `<img>` in head) makes Google stop reading further `<head>` content.
- Google attempts to interpret malformed HTML but valid markup is the only reliable path.
- If you must inject an invalid element, place it after all critical metadata.
- Frequent silent cause of missing titles/descriptions in Search results.

**Paddock relevance:** applicable. Next.js Metadata API generally outputs valid heads, but worth auditing during B7 and B8.
**Feeds:** B7, B8.

#### special-tags
**Source:** https://developers.google.com/search/docs/crawling-indexing/special-tags
**Purpose:** Catalogue of meta tags Google understands.

- `description` meta is used in snippets, not a ranking factor.
- `<meta name="robots">` and `<meta name="googlebot">` control crawl/index; restrictive rule wins.
- `http-equiv` content-type / charset must be properly quoted.
- `notranslate` prevents Google offering translation.
- Viewport meta signals mobile-friendliness.
- Ignored / no-op tags: `keywords`, `rel=next/prev`, `nositelinkssearchbox`.
- Inject meta tags via JavaScript with caution — test in URL Inspection.

**Paddock relevance:** applicable. Confirms what's worth setting in B7 (description, viewport, robots per-route) and what to drop (no `keywords`).
**Feeds:** B7.

#### robots-meta-tag
**Source:** https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
**Purpose:** Full reference for robots meta tag and `X-Robots-Tag`.

- Robots meta in `<head>`; `X-Robots-Tag` is HTTP-header equivalent (for PDFs, images, non-HTML).
- Target specific bots with user-agent tokens (`googlebot`, `googlebot-news`) or `robots`.
- `noindex` removes from Search but doesn't block other crawlers — needs separate rules.
- `nofollow` stops link-following on that page; doesn't prevent that page from being indexed.
- Conflicting rules: more restrictive wins (`nosnippet` overrides `max-snippet:50`).
- Pages blocked by robots.txt are never crawled, so any `noindex` inside is never seen.

**Paddock relevance:** applicable. Pattern for staging routes, draft content, future `/api/*` exclusions.
**Feeds:** B2 (noindex auth pages), B1 supporting.

#### block-indexing
**Source:** https://developers.google.com/search/docs/crawling-indexing/block-indexing
**Purpose:** Practical guide to keeping pages out of Search.

- Two implementations: `<meta name="robots" content="noindex">` or `X-Robots-Tag: noindex` header — same effect.
- The page **must not** be blocked by robots.txt; Googlebot must crawl to see the directive.
- CMSes typically expose this as a "discourage search engines" toggle.
- Recrawl latency: months for low-priority pages, so plan ahead.
- Verify via Search Console URL Inspection + Page Indexing report.
- Combine with `nofollow` when you want neither indexing nor link-graph credit.

**Paddock relevance:** applicable. Pattern for placeholder pages (14 history + 15 rules tabs are stubs) and 404'd `/drivers/*`, `/teams/*` — consider `noindex` until curated.
**Feeds:** B-content placeholder hygiene; B2.

#### qualify-outbound-links
**Source:** https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links
**Purpose:** Use `rel` attributes to qualify outbound links.

- Three values: `rel="sponsored"` (paid/ads), `rel="ugc"` (user-generated), `rel="nofollow"` (general catch-all).
- `sponsored` preferred over `nofollow` for paid placements.
- `ugc` for comments/forum posts; can be removed for trusted contributors.
- Multiple values OK: `rel="ugc nofollow"`.
- Qualified links generally not followed but pages can still be discovered other ways.
- For internal links you want hidden from Google, use robots.txt disallow.

**Paddock relevance:** partial. Blog (currently empty) and future official-source citations should mark sponsored/affiliate properly. B3 ships nofollow on outbound news.
**Feeds:** B3.

#### control-what-you-share
**Source:** https://developers.google.com/search/docs/crawling-indexing/control-what-you-share
**Purpose:** Methods to limit what Google indexes.

- Options: delete content, password-protect, `noindex`, robots.txt, opt out of specific Google properties.
- Removing content from the site is the most reliable approach.
- Password protection blocks both crawling and existing-result presence.
- `noindex` stops Search inclusion but page is still link-reachable.
- Images/videos: block via robots.txt (Google only indexes media it can crawl).
- Can opt out of properties (Shopping, Hotels) without blocking general Search.

**Paddock relevance:** partial. Useful reference for future admin/diagnostic routes.
**Feeds:** —.

#### remove-information
**Source:** https://developers.google.com/search/docs/crawling-indexing/remove-information
**Purpose:** Process for removing content already in Google's index.

- Search Console Removals tool clears a URL from results in ~1 day.
- Removals are temporary (~6 months) — pair with a permanent fix (delete / password / noindex).
- robots.txt alone is unreliable for removal — Google can keep a stub indexed.
- Block all URL variants (trailing slash, query params, etc.) or content survives.
- Image removals follow a separate procedure.
- Shopping, Business Profile, Knowledge Panel removals each have their own flows.

**Paddock relevance:** partial. Reference if 404'd `/drivers/*` ever gets indexed.
**Feeds:** B-monitor.

#### prevent-images-on-your-page
**Source:** https://developers.google.com/search/docs/crawling-indexing/prevent-images-on-your-page
**Purpose:** Block specific images from Google Images.

- Use `User-agent: Googlebot-Image` + `Disallow` in robots.txt to exclude from Google Images only.
- `Googlebot` user-agent disallow removes images from all of Google Search.
- `X-Robots-Tag: noindex` on image responses also works.
- Wildcards supported: `Disallow: /*.gif$` blocks GIFs only.
- Page-level `noimageindex` blocks images on that page only — duplicates elsewhere may still appear.
- Removals tool for emergency takedown; image reappears if not also blocked.

**Paddock relevance:** not applicable. Minimal imagery.
**Feeds:** —.

#### keep-redacted-information-out
**Source:** https://developers.google.com/search/docs/crawling-indexing/keep-redacted-information-out
**Purpose:** Properly redact sensitive info so it doesn't leak via Search.

- Tiny fonts, white-on-white, image-overlay don't hide text from indexing.
- Crop images before embedding, not after.
- OCR can extract text from images, so visual redaction is unreliable.
- Document metadata persists (change history, embedded image originals).
- Use real redaction tools.
- Strip sensitive content before format conversion.

**Paddock relevance:** not applicable. No sensitive data.
**Feeds:** —.

#### 301-redirects
**Source:** https://developers.google.com/search/docs/crawling-indexing/301-redirects
**Purpose:** How Google handles permanent (301/308) redirects.

- 301 and 308 are treated as permanent; signal that target should become canonical.
- Use only when sure the redirect won't be reverted.
- Server-side 301 has the highest chance of correct interpretation (vs JS or meta refresh).
- Source URL may still appear as an "alternate name" in results occasionally.
- Signals consolidate to target.
- Recommended for domain migrations.

**Paddock relevance:** applicable. Directly relevant to B11 — must 301 `?tab=` query URLs to new path URLs to preserve any existing index entries.
**Feeds:** B11.

#### site-move-no-url-changes
**Source:** https://developers.google.com/search/docs/crawling-indexing/site-move-no-url-changes
**Purpose:** Migrating hosting/infrastructure while keeping URLs identical.

- Four phases: prepare new infra → flip DNS → monitor → retire old infra.
- Pre-test the new host fully before DNS switch.
- Verify Googlebot can reach new infra (URL Inspection, firewall check).
- Lower DNS TTL a week before the move.
- Keep Search Console verification active across the move.
- Watch logs on both servers during cutover.
- Expect a temporary crawl-rate dip post-migration.

**Paddock relevance:** not applicable. No infra move planned.
**Feeds:** —.

#### site-move-with-url-changes
**Source:** https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
**Purpose:** Migrating to new URL structure.

- Server-side 301/308 from old URLs to new URLs.
- Small/medium sites: move all at once. Larger sites: move in sections.
- Expect ranking fluctuations during recrawl; medium sites take "a few weeks".
- Keep redirects active for at least 1 year so external links and ranking signals transfer.
- Change of Address tool in Search Console (not required for HTTP→HTTPS).
- Update all internal links immediately.
- Monitor with sitemaps + Index Coverage report.

**Paddock relevance:** applicable. B11 (`?tab=foo` → `/series/x/foo/`) is a URL-structure change at micro scale — 301s, keep ≥1 year, update internal links.
**Feeds:** B11.

#### website-testing
**Source:** https://developers.google.com/search/docs/crawling-indexing/website-testing
**Purpose:** Run A/B tests without harming SEO.

- Never cloak — same content to Googlebot and users.
- Variation URLs should set `rel="canonical"` to the original.
- Use 302 (temporary) redirects for split tests, not 301.
- Time-bound the test.
- Googlebot doesn't carry cookies — sees the non-cookie default state.
- Small UI changes typically don't affect ranking or snippet.
- JS-injected variations are fine and avoid extra URLs.

**Paddock relevance:** partial. Rules to remember if PostHog experiments ship later.
**Feeds:** —.

#### pause-online-business
**Source:** https://developers.google.com/search/docs/crawling-indexing/pause-online-business
**Purpose:** Best practices for temporarily reducing or pausing a site.

- Prefer keeping site online with reduced functionality over going fully offline.
- For commerce: disable cart only; leave product info reachable.
- Show banners/popups about closure but follow banner guidelines.
- Update structured data (Product availability, Event status, LocalBusiness hours).
- Full removal has long, unpredictable recovery.
- If you must go dark: HTTP 503 for 1–2 days max, keep robots.txt reachable; don't geo-block.
- Don't use Removals tool for out-of-stock items.

**Paddock relevance:** not applicable.
**Feeds:** —.

### Section C — Search Appearance: General + Ranking

#### appearance (overview)
**Source:** https://developers.google.com/search/docs/appearance
**Purpose:** Index of Search-appearance features.

- Structured data is how Google understands page content; pick the right schema per page.
- Core Web Vitals influence ranking.
- Mobile-first indexing is default.
- Title links + meta descriptions are primary snippet inputs.
- Breadcrumbs, FAQ, carousel structured data unlock rich-result eligibility.
- Canonicalization + redirect hygiene avoid duplicate-content fragmentation.

**Paddock relevance:** applicable. Index card for the whole batch.
**Feeds:** B7, B8, B-perf.

#### ai-features
**Source:** https://developers.google.com/search/docs/appearance/ai-features
**Purpose:** How AI Overviews / AI Mode pick content.

- "No special optimization" — standard SEO eligibility is the gate.
- Query fan-out lets AI surface a wider set of sources than 10-blue-links.
- Pages must be indexed and snippet-eligible.
- AI traffic is reported under the existing Performance "Web" search type.
- Control tools: `nosnippet`, `data-nosnippet`, `max-snippet`, `noindex`.
- Crawlability, text-based content, internal linking, page experience, structured data remain the levers.

**Paddock relevance:** applicable. Confirms GEO = solid SEO + JSON-LD + text-first SSR.
**Feeds:** B8, B9.

#### publication-dates
**Source:** https://developers.google.com/search/docs/appearance/publication-dates
**Purpose:** How to mark publication / modification dates.

- Provide `datePublished` and/or `dateModified` in JSON-LD on Article/BlogPosting/VideoObject.
- Pair with a visible "Posted/Published/Last updated" label on the page.
- Dates required; times + timezones optional.
- Visible date must match the structured value.
- Don't conflate event dates with page dates; use `Event` for race weekend dates.
- News publishers have additional byline date rules.

**Paddock relevance:** applicable. Blog posts and F1 history tab carry curated dates; race weekend pages reference event dates that must NOT be modelled as `datePublished`.
**Feeds:** B8 (BlogPosting + Article date hygiene).

#### favicon-in-search
**Source:** https://developers.google.com/search/docs/appearance/favicon-in-search
**Purpose:** Requirements for Google to pick up your favicon.

- Min size 8×8; recommend 48×48 or larger multiples of 48.
- Any valid favicon format works (ICO, PNG, SVG).
- Hosted anywhere; referenced from home page `<head>`.
- Supported `rel` values: `icon`, `shortcut icon`, `apple-touch-icon`, `apple-touch-icon-precomposed`.
- One favicon per hostname.
- Googlebot + Googlebot-Image must be able to fetch favicon + home page.
- URL should be stable.

**Paddock relevance:** applicable. Current `/icon.png` is 192×192 — verify chequered-flag motif renders at 16/32/48 and URL stays static under Next 16 fingerprinting.
**Feeds:** B2–B6 verification.

#### featured-snippets
**Source:** https://developers.google.com/search/docs/appearance/featured-snippets
**Purpose:** How Google picks Position 0 snippets.

- You cannot self-nominate; Google selects automatically.
- `max-snippet` shorter limits reduce featured-snippet eligibility.
- `nosnippet` blocks all snippets including featured.
- Minimum length varies by query/language/platform.
- Clicks deep-link to the relevant section when Google can identify it.
- `nosnippet` outranks `data-nosnippet` when both present.

**Paddock relevance:** partial. F1 history tab is the closest candidate; others rarely answer fact-style queries.
**Feeds:** B9, B7.

#### flexible-sampling
**Source:** https://developers.google.com/search/docs/appearance/flexible-sampling
**Purpose:** Paywall / metering guidance.

- Two patterns: metering (N articles/month free) and lead-in (excerpt above paywall).
- Monthly metering preferred over daily.
- 6–10 articles/month is the typical sweet spot for news.
- Paywall shown >10% of visits significantly hurts satisfaction.
- Paywalled content must be marked with structured data to avoid cloaking.

**Paddock relevance:** not applicable. Free, public-with-account.
**Feeds:** —.

#### google-discover
**Source:** https://developers.google.com/search/docs/appearance/google-discover
**Purpose:** Eligibility and optimization for Discover feed.

- Auto-eligible once indexed + policy-compliant; no opt-in needed.
- Large images materially boost Discover — min 1200px wide, ≥300k total pixels.
- Opt in via `max-image-preview:large`.
- 16:9 aspect ratio preferred.
- Avoid clickbait titles / withholding info.
- Discover traffic is volatile — supplemental.
- Use Search Console Discover report once impressions register.
- Page experience guidelines apply.

**Paddock relevance:** applicable. Motorsport is timely + visual, fits Discover. Need `<meta name="robots" content="max-image-preview:large">` and proper OG images.
**Feeds:** B-discover (NEW), B10, B8 (Article.image).

#### google-images
**Source:** https://developers.google.com/search/docs/appearance/google-images
**Purpose:** Image SEO essentials.

- Alt text: descriptive, info-rich, in context, no keyword stuffing.
- Descriptive filenames.
- Schema markup unlocks badges + richer image search.
- Image sitemap helps when assets live on CDNs.
- Use `primaryImageOfPage` schema or `og:image` to influence preview selection.
- Responsive `<picture>` / `srcset` with fallback `src`.
- Optimize file size for CWV.
- Surrounding page text + title affect image ranking.

**Paddock relevance:** partial. Few editorial images today — mostly UI icons. Becomes critical once blog hero images ship.
**Feeds:** B10, future image sitemap.

#### establish-business-details
**Source:** https://developers.google.com/search/docs/appearance/establish-business-details
**Purpose:** How to authoritatively describe your org to Google.

- Verify ownership in Search Console first.
- Add `Organization` schema with preferred logo + corporate identity.
- Add `Breadcrumb` schema to surface hierarchy.
- Knowledge-panel overrides only available after verification.
- Local Business Profile is separate from `Organization` schema.
- Rich Results Test validates markup; allow ~1 week for crawl pickup.

**Paddock relevance:** applicable. Paddock is digital-only — `Organization` + `WebSite` JSON-LD is the entire scope.
**Feeds:** B8.

#### top-places-list
**Source:** https://developers.google.com/search/docs/appearance/top-places-list
**Purpose:** Rich result for curated "best X" lists of physical businesses.

- Only for businesses with physical locations.
- Lists must be human-curated, genuine, independent, unsponsored.
- Templated/auto-generated lists ineligible.
- Editorial sites hosting such lists get rich-result lift.
- Domain owners can opt out via Search Console.

**Paddock relevance:** not applicable. Paddock covers series/teams/drivers, not physical venues.
**Feeds:** —.

#### opt-out (support article 3035947)
**Source:** https://support.google.com/webmasters/answer/3035947
**Purpose:** Opting domain out of Shopping, Flights, Hotels, Local Search.

- Opt-out is domain-level only.
- Content disappears from chosen surfaces within 30 days.
- Multi-domain owners must opt each out separately.
- Local opt-out is global; Shopping/Flights/Hotels opt-out is google.com-only.
- Managed through Search Console settings.

**Paddock relevance:** not applicable. No Shopping/Flights/Hotels presence.
**Feeds:** —.

#### page-experience
**Source:** https://developers.google.com/search/docs/appearance/page-experience
**Purpose:** Holistic page-experience signal envelope.

- No single PE metric — Google uses a bundle of signals.
- Good CWV doesn't guarantee #1; bad CWV doesn't bury great content.
- HTTPS required.
- Mobile-friendly required (page-level, not site-level).
- No intrusive interstitials.
- Don't drown content in ads.
- Relevance still trumps experience.

**Paddock relevance:** applicable. Mobile PageSpeed 39/100 is a direct page-experience drag.
**Feeds:** B-perf.

#### core-web-vitals
**Source:** https://developers.google.com/search/docs/appearance/core-web-vitals
**Purpose:** Definitions + thresholds for LCP, INP, CLS.

- LCP target ≤2.5s (Paddock currently 5.2s — fail).
- INP target <200ms (current TBT 5340ms implies likely INP failure).
- CLS target <0.1.
- Monitored via Search Console Core Web Vitals report.
- Measured via PageSpeed Insights + web.dev field data.
- Aligned with ranking systems but only one input.

**Paddock relevance:** applicable. Failing LCP and likely INP — the spec B-perf is racing against.
**Feeds:** B-perf (top priority).

#### avoid-intrusive-interstitials
**Source:** https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials
**Purpose:** What overlays hurt ranking.

- Intrusive = content-obstructing pop-ups, esp. promotional.
- Search systems can mis-read intrusive overlays, hurting indexing.
- Replace with unobtrusive banners (top/bottom strips).
- Mandatory age/legal gates exempt — prefer overlay-not-redirect so other URLs stay indexable.
- Redirecting every URL to one consent page strips the rest from SERPs.
- Allow Googlebot to bypass age gates via verified-crawler logic.

**Paddock relevance:** partial. Paddock uses Clerk sign-in but content is public-with-account; audit that the sign-in flow isn't full-page-blocking unauthenticated readers or Googlebot.
**Feeds:** B2 (audit Clerk auth + cookie banner).

#### signed-exchange
**Source:** https://developers.google.com/search/docs/appearance/signed-exchange
**Purpose:** SXG = privacy-preserving prefetch.

- Lets Google prefetch HTML/CSS/JS/images/fonts without leaking user identity.
- Lower LCP on click from SERP.
- Cache expiry must be ≤ HTTP cache header AND ≤ 1 day for JS.
- Personalized content must lazy-load post-load.
- Niche adoption; complex to operate.

**Paddock relevance:** not applicable yet. Vercel doesn't natively emit SXG; complexity outweighs gain vs. fixing CWV directly.
**Feeds:** —.

#### preferred-sources
**Source:** https://developers.google.com/search/docs/appearance/preferred-sources
**Purpose:** Users mark a publisher as "preferred" → more frequent Top Stories surfacing.

- Domain or subdomain level only.
- Must already appear in Google's source preferences UI to participate.
- Global feature across all Search regions/languages.
- Publishers can deep-link `https://google.com/preferences/source?q=domain.com`.
- Localized "Make us a preferred source" assets provided.
- Promotional adoption optional.

**Paddock relevance:** partial. Too new (4–5 days) for Top Stories eligibility.
**Feeds:** Future, defer.

#### ranking-systems-guide
**Source:** https://developers.google.com/search/docs/appearance/ranking-systems-guide
**Purpose:** Catalog of named ranking systems.

- AI stack: BERT, RankBrain, neural matching, passage ranking.
- Page-level focus, but site-wide reputation contributes.
- Original content + reviews systems reward depth.
- PageRank/link analysis still in the mix.
- Query-deserves-freshness boosts trending topics — relevant to live race weekends.
- Site diversity cap: typically ≤2 listings from same site in top results.
- Removal-request volume (copyright/defamation) → algorithmic demotion.

**Paddock relevance:** applicable. Freshness + originality drive content tabs; site-diversity cap argues for distinct URL paths per series (motivates B11).
**Feeds:** B11, B9, B8.

#### reviews-system
**Source:** https://developers.google.com/search/docs/appearance/reviews-system
**Purpose:** How Google evaluates reviewer-style content.

- Applies to first-party recommendation / opinion / analysis content.
- Rewards in-depth research over thin summaries.
- Formats: single-item review, head-to-head, ranked list.
- Product structured data optional — content quality decides.
- Expert/enthusiast voice favored.
- 11 languages currently active (English yes, Greek NO — relevant for B12).
- Page-by-page evaluation for small review sets; site-wide for large.

**Paddock relevance:** partial. Future "best helmets / 2025 season review" posts would qualify.
**Feeds:** Future B-content blog guidance.

#### core-updates
**Source:** https://developers.google.com/search/docs/appearance/core-updates
**Purpose:** What Google's broad core updates do.

- Several broad updates per year; not site-targeted.
- They reassess content quality web-wide.
- Most sites are unaffected.
- After a drop: check Search Status Dashboard for timing, wait ≥1 week of Search Console data.
- Small drops → no change. Large drops → audit whole site for "helpful, people-first" quality.
- Recovery takes days to months.
- Continuous smaller adjustments happen between named updates.

**Paddock relevance:** applicable (operational). Too new for meaningful core-update history; the "people-first" framing drives content decisions.
**Feeds:** Process; informs content QA.

#### spam-updates
**Source:** https://developers.google.com/search/docs/appearance/spam-updates
**Purpose:** What spam updates target.

- Continuous detection; named "spam updates" are notable improvements.
- SpamBrain (AI) drives detection.
- Recovery after policy fix: typically months once compliance is verified.
- Link spam updates: ranking benefit from spam links is unrecoverable.
- Compliance with Google's spam policies is the only durable strategy.

**Paddock relevance:** applicable (defensive). Confirms priority of B9 + filling 14 placeholder tabs before they trip thin-content heuristics.
**Feeds:** B-content, B9.

### Section D — Search Appearance: SERP Features + Visual + Web Stories + SD Overview

#### site-names
**Source:** https://developers.google.com/search/docs/appearance/site-names
**Purpose:** How Google picks and displays the site name in the SERP.

- Use `WebSite` JSON-LD with `name` and `url` (canonical home URL) — most important signal.
- Structured data must live on home page of domain/subdomain only, not in `/news`.
- One site name per domain/subdomain; `www` and `m` variants treated equivalently.
- Subdomain home pages without their own `WebSite` data fall back to domain-level name.
- Won't appear if home page is blocked from crawl, name is generic, or policy violation.
- Use `alternateName` to suggest acronyms/short forms.

**Paddock relevance:** applicable. Zero JSON-LD currently; adding `WebSite` to home page is a quick brand-visibility win.
**Feeds:** B8.

#### sitelinks
**Source:** https://developers.google.com/search/docs/appearance/sitelinks
**Purpose:** How Google chooses sitelinks under the main SERP result.

- 100% algorithmic; no markup, no Search Console toggle, no manual control mechanism.
- Triggered only when Google decides they benefit users.
- Informative/concise page titles and headings improve eligibility.
- Concise, descriptive anchor text on internal links is the strongest controllable signal.
- Logical, intuitive site structure enables Google to identify natural shortcuts.
- Duplicate or near-duplicate content confuses selection.
- Only way to remove a bad sitelink is `noindex` or deleting the page.

**Paddock relevance:** partial. Can't directly mark up; influence via internal-link anchor text and avoiding duplicate tab titles (B7 directly helps).
**Feeds:** B7, B2–B6.

#### snippet
**Source:** https://developers.google.com/search/docs/appearance/snippet
**Purpose:** How Google generates the descriptive snippet under the title link.

- Google primarily extracts from on-page content; meta description used only when more accurate.
- Control via `<meta name="robots" content="nosnippet">`, `max-snippet:[number]`, `data-nosnippet` attribute.
- Identical meta descriptions across pages are not helpful.
- Avoid keyword strings; clarity wins.
- Programmatic descriptions are fine on large database-driven sites — keep human-readable and varied.
- Descriptions can be longer than displayed; Google truncates as needed.

**Paddock relevance:** applicable. Tabs currently share identical `<title>` and likely identical/absent meta description.
**Feeds:** B7, B9.

#### title-link
**Source:** https://developers.google.com/search/docs/appearance/title-link
**Purpose:** How Google composes the blue clickable title.

- Google synthesizes from `<title>`, visible h1/headings, Open Graph, prominent styled text, anchor text, `WebSite` structured data.
- No hard length limit, but truncated to device width — informative content early.
- Google rewrites titles when half-empty, obsolete-dated, inaccurate, or boilerplate.
- Duplicate titles across pages trigger Google to inject distinguishing text.
- `<title>` language must match content language.
- Put brand at start or end with a delimiter; not on every page redundantly.

**Paddock relevance:** applicable. All 9 tabs on each series page share an identical `<title>` — exactly the antipattern this doc warns against.
**Feeds:** B7.

#### translated-results
**Source:** https://developers.google.com/search/docs/appearance/translated-results
**Purpose:** Google's auto-translated SERP feature.

- Automatic opt-in; opt out per page/site via `<meta name="googlebot" content="notranslate">` or `X-Robots-Tag: notranslate` header.
- 21 target languages today.
- Google doesn't host translated content — machine translation via Google's translate proxy.
- Users always get a link back to the original.
- Ad networks need URL-decoding work to function on translated pages.
- Track performance via Search Console "Search Appearance" filter.

**Paddock relevance:** partial. Once Greek `/el/` ships (B12), keep the English version open to translation as a discovery channel.
**Feeds:** B12 (informational).

#### ad-network-and-translation
**Source:** https://developers.google.com/search/docs/appearance/ad-network-and-translation
**Purpose:** Guidance for ad networks running on Google-translated pages.

- Ad networks must convert `*.translate.goog` URLs back to original.
- 8-step algorithmic hostname-decode sequence documented.
- IDN/punycode handling for hostnames with '0' in encoding list.
- Purely URL reconstruction guidance — no cookie or JS-execution help.

**Paddock relevance:** not applicable. Paddock runs no third-party ad networks (AdSense is Google's own).
**Feeds:** —.

#### video
**Source:** https://developers.google.com/search/docs/appearance/video
**Purpose:** Video best practices and `VideoObject` structured data.

- `VideoObject` requires unique `thumbnailUrl`, `name`, `description` per video.
- Thumbnails ≥60×30 px, stable URLs, ≥80% opacity, JPEG/PNG/WebP/AVIF.
- Each video needs a dedicated watch page where the video is the primary content.
- Key moments via `Clip` or `SeekToAction`; YouTube videos auto-detect timestamps.
- Don't block streaming-file URLs via robots.txt or noindex.
- Use `expires` property or sitemap to signal removal/expiration.

**Paddock relevance:** not applicable today. Revisit if onboard-lap / highlight embeds ship.
**Feeds:** Future.

#### visual-elements-gallery
**Source:** https://developers.google.com/search/docs/appearance/visual-elements-gallery
**Purpose:** Reference catalog of every visual element Google shows in SERP results.

- Five main families: text results, rich results, image results, video results, exploration features.
- Text results require no markup.
- Rich results = anything beyond a plain blue link → requires structured data.
- Attribution block = favicon + site name + visible URL + breadcrumb.
- "Rich attributes" (review stars, recipe info) come from structured data.
- People-Also-Ask / Related Searches are 100% automatic — uncontrollable but content-gap indicators.

**Paddock relevance:** applicable. Cross-reference index when deciding which rich-result types to chase first.
**Feeds:** B8 meta-reference.

#### enable-web-stories, web-stories-creation-best-practices, web-stories-content-policy
**Sources:** https://developers.google.com/search/docs/appearance/enable-web-stories , https://developers.google.com/search/docs/appearance/web-stories-creation-best-practices , https://developers.google.com/search/docs/appearance/web-stories-content-policy
**Purpose:** Web Stories format setup, authoring best practices, content policy.

- Web Stories are AMP-validated tap/swipe content.
- Required: `publisher-logo-src`, `poster-portrait-src`, `title`, `publisher`.
- Self-referential `<link rel="canonical">`; multilingual via `hreflang`.
- ~280 char text cap per page; video-first; sub-60s video preferred.
- Poster image ≥640×853 px (3:4); publisher logo ≥96×96 px.
- Must be original, themed, narrative-bound, not solely promotional.

**Paddock relevance:** not applicable across all three. AMP-only format; Paddock is Next.js 16 PWA.
**Feeds:** —.

#### package-tracking
**Source:** https://developers.google.com/search/docs/appearance/package-tracking
**Purpose:** Early-adopter program for delivery carriers.

- Only carriers in India, Japan, Brazil (or sole authorized provider) qualify.
- RESTful JSON API, POST-only, <700ms avg / <1000ms p95.
- Required `CurrentStatus` field; optional delivery date, tracking number, transit events, support phone.
- No personal data about sender/recipient permitted.

**Paddock relevance:** not applicable. Paddock ships no parcels.
**Feeds:** —.

#### intro-structured-data
**Source:** https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
**Purpose:** The canonical "how to do structured data" overview.

- JSON-LD is Google's recommended format.
- All three formats (JSON-LD, Microdata, RDFa) are equally valid; mixing not recommended.
- Structured data must describe content actually visible on the page.
- Schema.org is the vocabulary; Google's Search Central docs are definitive for Search behavior.
- Validate during dev with Rich Results Test; monitor post-launch with Search Console reports.
- All required properties must be present for eligibility; partial recommended properties hurt quality.
- A/B impact measurable via Search Console Performance report filtered by URL.

**Paddock relevance:** applicable. Foundational doc for the entire JSON-LD rollout.
**Feeds:** B8 (primary reference).

#### sd-policies
**Source:** https://developers.google.com/search/docs/appearance/structured-data/sd-policies
**Purpose:** Content/quality policies for structured data.

- Manual-action penalty = loss of rich-result eligibility.
- Structured data must mirror visible page content; no marked-up-but-hidden info.
- Relevance/accuracy: don't mislabel content.
- Required properties non-negotiable.
- Image URLs in structured data must be crawlable and indexable.
- Don't block structured-data pages via robots.txt, noindex, or access control.
- Google never guarantees display even with valid markup.

**Paddock relevance:** applicable. Compliance baseline before any JSON-LD ships.
**Feeds:** B8 guardrails.

#### enriched-search-results
**Source:** https://developers.google.com/search/docs/appearance/enriched-search-results
**Purpose:** "Enriched" subset of rich results.

- Enriched applies to three primary types: Job Posting, Recipe, Event.
- Same structured-data foundation as rich results.
- Lets users filter by structured-data properties.
- Applies to leaf pages only — never category/listing pages.
- Completeness of recommended properties is "one of the most important ranking signals".
- Mislabeling content disqualifies.
- Algorithm tolerates legitimate duplication (same job in many cities).

**Paddock relevance:** applicable. `Event` / `SportsEvent` markup on each round is the highest-value enriched-result opportunity for a motorsport site.
**Feeds:** B8 (SportsEvent rollout per round).

#### generate-structured-data-with-javascript
**Source:** https://developers.google.com/search/docs/appearance/structured-data/generate-structured-data-with-javascript
**Purpose:** How to emit JSON-LD via JS / GTM / SSR.

- Google Search reads structured data from the rendered DOM.
- SSR is preferred — puts JSON-LD in initial HTML with no JS dependency.
- GTM works but pulls page variables dynamically to avoid drift.
- Test client-injected markup using Rich Results Test URL input.
- Dynamic Product markup specifically can reduce Shopping crawl reliability.
- Common errors are syntax bugs or missing required properties.

**Paddock relevance:** applicable. Paddock is Next 16 SSR/RSC — emit JSON-LD server-rendered in the route segment.
**Feeds:** B8, B9.

#### search-gallery
**Source:** https://developers.google.com/search/docs/appearance/structured-data/search-gallery
**Purpose:** Master index of every structured-data type Google supports.

Relevant-to-Paddock types: Article, Breadcrumb (BreadcrumbList), Event (SportsEvent), Organization, Profile Page (Person/SportsTeam), Speakable (optional), Video (future). NOT applicable: FAQ, Q&A, Discussion Forum (no UGC), Recipe, Movie, Course, Math Solver, Local Business, Top Places, Software App (until rating), Product, Job Posting, Vacation Rental, Book, Carousel (Course/Movie/Recipe/Restaurant inner types only), Paywalled, Dataset.

**Paddock relevance:** applicable. Top-priority Paddock types: `WebSite`, `Organization`, `BreadcrumbList`, `Article`, `Event`/`SportsEvent`, `ProfilePage`/`Person`, `ItemList`.
**Feeds:** B8 primary type catalog.

### Section E — Search Appearance: Structured Data (per-type deep dive)

#### article
**Source:** https://developers.google.com/search/docs/appearance/structured-data/article
**Purpose:** Helps Google understand news/blog/sports articles for Search and Google News.
**Required fields:** None — Google says "add the properties that apply to your content."
**Recommended fields:** `headline`, `image` (multi-aspect 16:9/4:3/1:1, min 50K pixels), `datePublished` (ISO 8601 + timezone), `dateModified`, `author` (Person/Organization with `name` + `url`).

- Three valid types: `Article`, `NewsArticle`, `BlogPosting` — pick the closest.
- `author.url` must point to a real author profile/bio/social — not a generic homepage.
- Each visible author needs a separate `author` entry; never concatenate.
- `image` array should include multiple aspect ratios; minimum resolution gates snippet image.
- `dateModified` feeds the "Updated" timestamp in News-style snippets — keep honest.
- Re-crawl after publish takes "several days".

**Paddock relevance:** applicable. F1 history tab is already a curated article with byline + last-updated; blog posts will follow.
**Feeds:** B8 (history tabs `Article`); B-content / blog (`BlogPosting`).

#### breadcrumb
**Source:** https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
**Purpose:** Position in site hierarchy → navigable trail in result snippet.
**Required fields:** `BreadcrumbList.itemListElement` (≥2 `ListItem`); each with `position`, `name`, `item` (URL, optional only on last item).

- Minimum two list items, position-indexed from 1.
- Represent a typical USER path, not URL structure.
- Multiple breadcrumb trails per page allowed.
- Last item's `item` URL is optional but `name` + `position` still required.
- `data-vocabulary.org` no longer eligible — schema.org JSON-LD only.

**Paddock relevance:** applicable. Every nested route (`/series/[slug]`, `/series/[slug]/weekend/[round]`, future `/drivers/[slug]`, `/teams/[slug]`, `/blog/[slug]`) has a clear hierarchy.
**Feeds:** B8 (layout-level helper).

#### carousel
**Source:** https://developers.google.com/search/docs/appearance/structured-data/carousel
**Purpose:** List-style rich results users swipe through on mobile.
**Required fields:** `ItemList.itemListElement` (≥2 items, all same type); each `ListItem` needs `position` + `url` (summary pattern) OR `position` + `item` (all-in-one).

- Supported content types: **Course, Movie, Recipe, Restaurant.** Closed set.
- All items in the list must be the same type; URLs must share a domain.
- Two architectures: summary page linking to detail pages, or all-in-one page.
- Visible text must align with marked-up structured data.
- No display guarantee.

**Paddock relevance:** not applicable. Paddock's entities don't match the four supported types. The race-weekend "carousel" pattern we want is `ItemList` of `Event`, NOT this doc.
**Feeds:** — (do not use).

#### event
**Source:** https://developers.google.com/search/docs/appearance/structured-data/event
**Purpose:** Makes events discoverable in Google's event experience with logos, descriptions, ticket links.
**Required fields:** `name`, `startDate` (ISO 8601 + timezone offset), `location.name`, `location.address` (PostalAddress with streetAddress, addressLocality, postalCode, addressRegion, addressCountry).
**Recommended fields:** `description`, `endDate`, `image` (multi-aspect, ≥720px), `eventStatus`, `offers` (price/currency/availability/url/validFrom), `organizer`, `performer`, `previousStartDate`.

- **Single event per URL** is a hard eligibility gate.
- **Physical location required** — virtual-only events are ineligible.
- Public accessibility required (no membership/invitation).
- `SportsEvent` is schema.org-valid and Google accepts subtype usage — verify with Rich Results Test.
- Timezone precision: include UTC offset (`2026-05-24T14:00:00+02:00`).
- Rescheduled/cancelled: keep original `startDate`, change `eventStatus` + add `previousStartDate`.
- Multi-day events: `startDate` + `endDate`. Separate performances on different days = individual Event entries — maps to Practice 1 / Qualifying / Race being distinct sessions.
- Regional availability: AU/BR/CA/DE/IN/LATAM/ES/UK/US confirmed.

**Paddock relevance:** **applicable — highest-impact type on the site.** Open question: one `SportsEvent` per weekend, OR one per session (Practice/Qualifying/Race) with `superEvent` linking back to the weekend.
**Feeds:** B8 (`SportsEvent` on `/series/[slug]/weekend/[round]`; optionally one per session with `superEvent`; emit `ItemList` of sessions on the weekend page for a swipeable carousel).

#### organization
**Source:** https://developers.google.com/search/docs/appearance/structured-data/organization
**Purpose:** Identify the organization behind a site; pick the right logo.
**Required fields:** None — Google explicitly says no required properties.
**Recommended fields:** `logo` (URL or ImageObject, ≥112×112, crawlable/indexable), `sameAs` (social profiles), `contactPoint` (email + telephone), plus `name`, `url`, `address`, `description`.

- Place markup **only on home page or About page** — emitting on every page is anti-pattern.
- Use the most specific subtype (`LocalBusiness`, `OnlineStore`, `OnlineBusiness`, or generic `Organization`).
- Logo is the single most user-visible payoff.
- `sameAs` is the primary signal for knowledge-panel reconciliation.
- No standalone rich result — plumbing for other features.

**Paddock relevance:** applicable. Single-emission, low-cost, high-leverage. Generic `Organization` is correct.
**Feeds:** B8 (Organization from root layout on `/` only; reused by `WebSite`, `Article`, `SportsEvent.organizer` as `@id` reference).

#### profile-page
**Source:** https://developers.google.com/search/docs/appearance/structured-data/profile-page
**Purpose:** Helps Google understand creator profile pages.
**Required fields:** `mainEntity` (Person or Organization), `mainEntity.name`.
**Recommended fields:** `dateCreated`, `dateModified`, `alternateName`, `description`, `identifier`, `image`, `interactionStatistic`, `agentInteractionStatistic`, `sameAs`.

- "Primary focus must be a single person or organization affiliated with the website".
- Valid examples: forum profiles, author pages, About Me, employee pages.
- `mainEntity` type defaults to `Person` if unspecified.
- `sameAs` lets Google reconcile a driver's Wikipedia/Wikidata/official entries.
- `agentInteractionStatistic` covers "posts by this person", `interactionStatistic` covers "engagement on this profile".

**Paddock relevance:** applicable for `/drivers/[slug]` and `/teams/[slug]` once curated bios exist. Gated on `drivers.json` curation across 15 series.
**Feeds:** B8 for driver/team pages (after data work).

#### discussion-forum
**Source:** https://developers.google.com/search/docs/appearance/structured-data/discussion-forum
**Purpose:** UGC forum/community posts for the Discussions feature.
**Required fields:** `author`, `author.name`, `datePublished`, plus at least one of `text`/`image`/`video`.

- Strictly for **user-generated content** — publisher-authored articles ineligible.
- Q&A sites should use `QAPage` markup instead.
- `digitalSourceType` flag for AI-generated content.

**Paddock relevance:** not applicable. No UGC.
**Feeds:** —.

#### factcheck
**Source:** https://developers.google.com/search/docs/appearance/structured-data/factcheck
**Purpose:** Fact-checking sites surface verdicts.
**Required fields:** `claimReviewed` (≤75 chars), `reviewRating`, `url`.

- Must be deployed across **multiple pages**.
- Site must publish a corrections policy.
- One ClaimReview per page.
- Political-entity sites ineligible.
- Google is **phasing out ClaimReview support in Search** but keeps it in Fact Check Explorer.

**Paddock relevance:** not applicable.
**Feeds:** —.

#### qapage
**Source:** https://developers.google.com/search/docs/appearance/structured-data/qapage
**Purpose:** User-generated Q&A pages.
**Required fields:** `QAPage.mainEntity` (one `Question`); Question needs `name`, `answerCount`, at least one of `acceptedAnswer`/`suggestedAnswer`; Answer needs `text`.

- Eligibility hinges on **users being able to submit answers**.
- Static publisher-written Q&A → use `FAQPage` instead. (Note: FAQPage rich result was deprecated by Google in 2023 except for authoritative gov/health sites.)
- Education Q&A pages may use expert-selected single answer.

**Paddock relevance:** not applicable. No user-submittable Q&A.
**Feeds:** —.

#### review-snippet
**Source:** https://developers.google.com/search/docs/appearance/structured-data/review-snippet
**Purpose:** Excerpts/star ratings from reviews in Search snippets.
**Required fields:** `author`, `itemReviewed` (with `name`), `reviewRating.ratingValue`.

- Supported content types: Book, Course, Event, LocalBusiness, Movie, Product, Recipe, SoftwareApp, plus schema.org-broader (Game, MediaObject, Organization).
- "Self-serving" reviews disallowed.
- Reviews must be visible on the marked-up page.
- Aggregating reviews from other sites is not allowed.

**Paddock relevance:** not applicable. No review content.
**Feeds:** —.

#### speakable
**Source:** https://developers.google.com/search/docs/appearance/structured-data/speakable
**Purpose:** Marks article sections for text-to-speech playback.
**Required fields:** Exactly one of `cssSelector` or `xPath`.

- **Beta + US-English only on Google Home** — extremely narrow.
- 20–30 seconds of audio per section.
- Avoid voice-confusing elements.
- Returns up to 3 articles to news-query voice answers.

**Paddock relevance:** not applicable. Beta US-only, English-only.
**Feeds:** —.

#### video (structured data)
**Source:** https://developers.google.com/search/docs/appearance/structured-data/video
**Purpose:** `VideoObject` for Video search, key moments, LIVE badge, Discover.
**Required fields:** `name`, `thumbnailUrl`, `uploadDate` (ISO 8601).
**Recommended fields:** `contentUrl` (preferred over `embedUrl`), `description`, `duration` (e.g. `PT1M54S`), `embedUrl`, `expires`, `interactionStatistic`, `regionsAllowed`/`ineligibleRegion`.

- Feature unlocks: **LIVE Badge** via `BroadcastEvent`; **Key Moments** via `Clip` or `SeekToAction`.
- `contentUrl` materially more effective than `embedUrl`.
- Indexing API recommended for livestreams.
- Unique name/description per video.

**Paddock relevance:** not applicable today. Park.
**Feeds:** —.

#### image-license-metadata
**Source:** https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata
**Purpose:** Licensing info in Google Images.
**Required fields:** `contentUrl`, plus at least one of `creator`/`creditText`/`copyrightNotice`/`license`.

- Licensable badge requires `license` property specifically.
- Two paths: JSON-LD/RDFa/Microdata or IPTC photo metadata in the image.
- Add metadata to **every page** the image appears on.

**Paddock relevance:** not applicable. Minimal imagery; Paddock isn't typically the licensor.
**Feeds:** —.

#### carousels-beta
**Source:** https://developers.google.com/search/docs/appearance/structured-data/carousels-beta
**Purpose:** Horizontal-scrolling SERP carousel.
**Required fields:** `itemListElement` (≥3 items), `item` of LocalBusiness-subtype/Product/Event, `position`, `image`, `name`, `url`.

- **Beta + geographically limited** — EEA, Turkey, South Africa only.
- Minimum **three** items.
- Supported inner types: LocalBusiness subtypes (Restaurant/Hotel/VacationRental), Product, Event.
- Summary/listing page pattern only.
- All detail URLs must share the same domain.

**Paddock relevance:** partial. Paddock has Event-list pages (`/series/[slug]?tab=calendar`) which technically match. Beta status + ranking uncertainty = exploratory.
**Feeds:** Optional B10/B11 follow-on once base `SportsEvent` markup is in place.

#### dataset
**Source:** https://developers.google.com/search/docs/appearance/structured-data/dataset
**Purpose:** Helps datasets get indexed in Google Dataset Search.
**Required fields:** `name`, `description` (50–5000 chars).

- Targets life-sciences / social-sciences / government open data.
- Pages must be crawlable, not noindex'd.

**Paddock relevance:** partial — speculative. Curated `champions.json` for 15 series + historical results data could plausibly qualify. Low priority.
**Feeds:** Optional speculative B-dataset (deferred).

#### education-qa
**Source:** https://developers.google.com/search/docs/appearance/structured-data/education-qa
**Purpose:** Flashcard pages in Google's Q&A carousel.

- Eligible only for **education-related** queries.
- Flashcard pages with multiple Q&A pairs.
- Content must be visible.

**Paddock relevance:** not applicable.
**Feeds:** —.

#### movie
**Source:** https://developers.google.com/search/docs/appearance/structured-data/movie
**Purpose:** Movie-list carousel.
**Required fields:** `name`, `image` (crawlable, jpg/png/gif, 6:9 aspect ratio, high res).

- Mobile-only feature.
- Strict image format gate.

**Paddock relevance:** not applicable.
**Feeds:** —.

#### recipe
**Source:** https://developers.google.com/search/docs/appearance/structured-data/recipe
**Purpose:** Recipe rich results / carousel.
**Required fields:** `name`, `image` (multi-aspect, high res).

- JSON-LD preferred.
- `HowToStep` strongly preferred for `recipeInstructions`.

**Paddock relevance:** not applicable.
**Feeds:** —.

#### book
**Source:** https://developers.google.com/search/docs/appearance/structured-data/book
**Purpose:** Books for retailers/libraries with purchase/borrow actions.

- Hosted-feed model with Google approval gate.
- ReadAction (purchase) and BorrowAction (library).
- ISBN-13 preferred for matching.

**Paddock relevance:** not applicable.
**Feeds:** —.

#### course
**Source:** https://developers.google.com/search/docs/appearance/structured-data/course
**Purpose:** Course-list markup.

- Minimum 3 courses with `name` + `provider`.
- Restricted to formal curriculum (lectures/lessons/modules).
- No promotional language or pricing in title.

**Paddock relevance:** not applicable.
**Feeds:** —.

#### employer-rating
**Source:** https://developers.google.com/search/docs/appearance/structured-data/employer-rating
**Purpose:** `EmployerAggregateRating` for employer-review platforms.

- Only for ratings of individual hiring organizations.
- Requires user-generated ratings.

**Paddock relevance:** not applicable.
**Feeds:** —.

#### job-posting
**Source:** https://developers.google.com/search/docs/appearance/structured-data/job-posting
**Purpose:** `JobPosting` for job boards.

- Required: `title`, `description`, `datePosted`, `hiringOrganization`, `jobLocation`, `validThrough`.
- Strict content quality.

**Paddock relevance:** not applicable.
**Feeds:** —.

#### local-business
**Source:** https://developers.google.com/search/docs/appearance/structured-data/local-business
**Purpose:** Physical-business markup.

- Covers address, phone, hours, cuisine type, price range.
- `openingHoursSpecification` handles weekly, 24h, seasonal.
- Allows aggregate ratings + reviews.

**Paddock relevance:** not applicable. No physical location.
**Feeds:** —.

#### math-solvers
**Source:** https://developers.google.com/search/docs/appearance/structured-data/math-solvers
**Purpose:** `MathSolver` markup on home page.

- Implemented on the site home page only.
- 60+ supported problem types.

**Paddock relevance:** not applicable.
**Feeds:** —.

#### product, product-snippet, merchant-listing, product-variants
**Sources:** https://developers.google.com/search/docs/appearance/structured-data/product , `/product-snippet` , `/merchant-listing` , `/product-variants`
**Purpose:** Product markup family — snippets (editorial), merchant listings (purchasable), variants.

- Splits into "product snippets" (editorial) and "merchant listings" (purchasable).
- Enables ratings, price, availability, shipping, returns, variants in SERP.
- `ProductGroup` with `variesBy`, `hasVariant`, `productGroupID`.

**Paddock relevance:** not applicable across all four. No products sold.
**Feeds:** —.

#### loyalty-program
**Source:** https://developers.google.com/search/docs/appearance/structured-data/loyalty-program
**Purpose:** `MemberProgram` for tiered loyalty.

- Tier-based with loyalty points and member pricing.
- Live in 8 countries.

**Paddock relevance:** not applicable.
**Feeds:** —.

#### return-policy, shipping-policy
**Sources:** https://developers.google.com/search/docs/appearance/structured-data/return-policy , `/shipping-policy`
**Purpose:** Returns + shipping markup.

- Org-wide or per-offer levels.

**Paddock relevance:** not applicable.
**Feeds:** —.

#### software-app
**Source:** https://developers.google.com/search/docs/appearance/structured-data/software-app
**Purpose:** `SoftwareApplication` markup.
**Required fields:** `name`, pricing (use `"0"` for free), `aggregateRating` OR `review`.

- Subtypes: `MobileApplication`, `WebApplication`.
- `applicationCategory` enum with 25+ values (incl. `SportsApplication`).
- Rating/review requirement is the practical gate.

**Paddock relevance:** partial. Paddock is a free PWA — `WebApplication` + `applicationCategory: "SportsApplication"` is a clean fit, BUT `aggregateRating`/`review` is a hard blocker until reviews exist.
**Feeds:** **B8b (deferred bundle)** — do not emit until rating data exists, otherwise markup is invalid.

#### paywalled-content
**Source:** https://developers.google.com/search/docs/appearance/structured-data/paywalled-content
**Purpose:** Distinguish paywalls from cloaking.

- `"isAccessibleForFree": false` at article level.
- `hasPart.cssSelector` identifies gated sections.

**Paddock relevance:** not applicable. All Paddock content is free.
**Feeds:** —.

#### vacation-rental
**Source:** https://developers.google.com/search/docs/appearance/structured-data/vacation-rental
**Purpose:** Vacation rental listings.

- Gated — Early Adopters Program approval required.
- Required: lat/long, unique identifier, ≥8 images.

**Paddock relevance:** not applicable.
**Feeds:** —.

### Section F — Monitoring & Debugging

#### debugging-search-traffic-drops
**Source:** https://developers.google.com/search/docs/monitor-debug/debugging-search-traffic-drops
**Purpose:** Diagnosing organic traffic regressions.

- Start with Search Console Performance Report — impressions vs clicks drop.
- Compare against ranking-updates page for algorithmic causes.
- Small position drops (2→4) often self-correct; large drops (top 10→29) need content review.
- Site-wide technical issues (robots.txt, 5xx, 404 spike) hit broadly.
- Use 16-month range to spot yearly seasonality.
- Cross-reference with Google Trends.
- Check Security Issues + Manual Actions reports.

**Paddock relevance:** partial — no traffic to drop yet. Future runbook.
**Feeds:** B-monitor.

#### search-console-start
**Source:** https://developers.google.com/search/docs/monitor-debug/search-console-start
**Purpose:** GSC onboarding.

- Verify site ownership to unlock all reports.
- Index Coverage report shows what's indexed, excluded, errored.
- Submitting a sitemap accelerates discovery.
- Performance report tracks impressions, clicks, queries, countries.
- Email alerts on new issues — no need to poll daily.
- Review monthly or after meaningful changes.
- Security Issues report covers hacking/malware alerts.

**Paddock relevance:** applicable. Paddock is already verified — confirm sitemap submitted (B1 just landed) and email alerts enabled.
**Feeds:** B-monitor.

#### bubble-chart-analysis
**Source:** https://developers.google.com/search/docs/monitor-debug/bubble-chart-analysis
**Purpose:** Quadrant analysis of GSC query data.

- Visualizes CTR, position, clicks together.
- Four quadrants: high-pos/high-CTR (maintain), low-pos/high-CTR (biggest opportunity), low-pos/low-CTR (relevance?), high-pos/low-CTR (rich-results gap).
- Bubble size = traffic volume.
- Log-scale both axes.
- Quadrant 2 (low pos, high CTR) is the biggest lever.
- High-pos low-CTR signals competitors have rich results you don't.

**Paddock relevance:** partial — no GSC data yet. High-pos low-CTR quadrant is the case for B8.
**Feeds:** B-monitor; reinforces B8.

#### google-analytics-search-console
**Source:** https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console
**Purpose:** Combining GA + GSC.

- GSC = pre-arrival; GA = post-arrival.
- Clicks ≠ sessions — different methodologies.
- Use Looker Studio templates to combine.
- Small discrepancies from timezone (GSC = Pacific), canonical handling, bot filtering — normal.
- Big gaps usually: missing GA tag, consent opt-outs, attribution differences.
- Apply identical filters across both.

**Paddock relevance:** partial. Paddock has GA4 (`G-DDMJ2NMBWC` in `app/layout.tsx`); integration is straightforward via Search Console linking.
**Feeds:** B-monitor.

#### search-operators
**Source:** https://developers.google.com/search/docs/monitor-debug/search-operators
**Purpose:** Operators for SEO debugging.

- Four main operators: `site:`, `filetype:`, `imagesize:`, `src:`.
- Bound by indexing limits — incomplete by design.
- URL Inspection tool is more reliable for indexing checks.

**Paddock relevance:** applicable as a manual-debug tool. Use `site:paddock-tracker.com` to track indexing progress.
**Feeds:** B-monitor.

#### search-operators/all-search-site
**Source:** https://developers.google.com/search/docs/monitor-debug/search-operators/all-search-site
**Purpose:** Deep dive on `site:` operator.

- Filters to domain/subdomain/prefix.
- Does NOT return all indexed URLs.
- Useful for monitoring spam, checking ranking for given terms.
- URL precision matters.
- URL Inspection more reliable for "is this URL indexed?".

**Paddock relevance:** applicable. Track `site:paddock-tracker.com` weekly.
**Feeds:** B-monitor.

#### search-operators/image-search
**Source:** https://developers.google.com/search/docs/monitor-debug/search-operators/image-search
**Purpose:** Image-specific operators.

- `src:` finds pages hot-linking a specified image URL.
- `imagesize:WxH` filters by exact dimensions.
- Combine `src:` + `imagesize:` + `site:` for precision.

**Paddock relevance:** partial. Useful once Paddock publishes branded images.
**Feeds:** B10 verification.

#### security (overview)
**Source:** https://developers.google.com/search/docs/monitor-debug/security
**Purpose:** Overview of security issues and reports.

- UGC spam, malware, phishing, social engineering are the four categories.
- Open comment forms are a common attack vector.
- Repeat offenders face reduced visibility.
- Proactive monitoring beats post-incident cleanup.

**Paddock relevance:** partial — Paddock has no UGC surfaces. HSTS already shipped (Track A). Low immediate risk.
**Feeds:** B-monitor (monthly review).

#### prevent-abuse
**Source:** https://developers.google.com/search/docs/monitor-debug/prevent-abuse
**Purpose:** Hardening against UGC spam.

- Publish abuse policies at signup.
- Detect spam patterns: form-fill time, IPs, user agents.
- `noindex` new-user content until reputation is established.
- `rel="nofollow"` or `rel="ugc"` on UGC links.
- IP blocklists + account-creation throttling.
- CAPTCHA / reCAPTCHA on signup.

**Paddock relevance:** not applicable yet.
**Feeds:** —.

#### security/malware
**Source:** https://developers.google.com/search/docs/monitor-debug/security/malware
**Purpose:** Malware/unwanted-software policy.

- Software downloads must accurately disclose purpose.
- No misrepresenting urgency or fake security threats.
- Data collection needs informed consent + encrypted transmission.
- Uninstall must be easy and complete.
- No interference with OS/browser security alerts; no ad injection; no TLS degradation.

**Paddock relevance:** not applicable. PWA install ≠ software download.
**Feeds:** —.

#### security/prevent-malware
**Source:** https://developers.google.com/search/docs/monitor-debug/security/prevent-malware
**Purpose:** Preventing site compromise.

- Use `site:` to scan for injected pages.
- Strong passwords; vet third-party scripts and ads.
- Patch software, hosting OS, plugins regularly.
- SSH/SFTP only — no plain-text protocols.
- Watch for XSS / SQL injection.
- Subscribe to Google Security Blog.

**Paddock relevance:** partial. Vercel-hosted; many items N/A. Useful: third-party script vetting (Clerk + Vercel KV + Open-Meteo + node-ical).
**Feeds:** B-monitor — maintain dependency hygiene + periodic `npm audit` / Dependabot.

#### security/social-engineering
**Source:** https://developers.google.com/search/docs/monitor-debug/security/social-engineering
**Purpose:** Phishing/deceptive content policy.

- Phishing = impersonating trusted entity.
- Safe Browsing flags sites with "Deceptive site ahead" warnings.
- Sites responsible for third-party ads/embeds.
- Remediation: remove content, audit third-party resources, then request review.
- Third-party services must clearly brand themselves on every page.

**Paddock relevance:** partial. Clerk is third-party — confirm Clerk branding is visible on sign-in/sign-up pages.
**Feeds:** B2 audit item.

#### security/safe-browsing-repeat-offenders
**Source:** https://developers.google.com/search/docs/monitor-debug/security/safe-browsing-repeat-offenders
**Purpose:** Penalty for sites that toggle in/out of compliance.

- Repeated compliance-then-violation cycles trigger "repeat offender" status.
- 30-day lockout from requesting additional reviews.

**Paddock relevance:** not applicable. No security incidents.
**Feeds:** —.

#### trends-start
**Source:** https://developers.google.com/search/docs/monitor-debug/trends-start
**Purpose:** Using Google Trends for SEO.

- Explore tool + Trending Now feed.
- Pursue trends only when aligned with expertise + audience.
- Track seasonal patterns — publish before peak.
- Compare up to 5 related terms.
- Benchmark traffic changes vs. industry-wide trend.
- Related-topics surface misspellings + variations.

**Paddock relevance:** applicable. Motorsport is seasonal — race weekends = traffic spikes. Useful for choosing blog topics, OG image priorities, B-content publication order.
**Feeds:** B-content, B10.

### Section G — Site-specific Guides (Ecommerce, International, Explicit)

#### ecommerce (overview)
**Source:** https://developers.google.com/search/docs/specialty/ecommerce
**Purpose:** Index of Google's ecommerce SEO hub.

- Share data and structure with Google.
- Thoughtful URL design prevents crawl/index problems specific to large content sites.
- Internal-linking hierarchy signals priority.
- Structured data is the explicit machine-readable layer.
- Pagination/incremental loading impacts crawlability.
- Content quality functions as a ranking signal.
- Launch timing and Search Console registration affect crawl velocity.

**Paddock relevance:** applicable. Principles transfer despite Paddock not being ecommerce.
**Feeds:** B-perf, B7, B8, B11.

#### where-ecommerce-data-can-appear
**Source:** https://developers.google.com/search/docs/specialty/ecommerce/where-ecommerce-data-can-appear-on-google
**Purpose:** Surfaces where commerce data shows up.

- Multiple Google surfaces (Search, Images, Lens, Knowledge Panel) consume structured data differently.
- Merchant Center is the central hub (not Paddock).
- Beyond the product, "company story," reviews, and educational content rank for journey-stage queries.
- Image optimization deserves its own strategy.
- Refer to the rich-results gallery to identify which schema types maximize visibility.

**Paddock relevance:** partial. Surface diversity framing applies; Merchant Center does not.
**Feeds:** B8, B10.

#### share-your-product-data-with-google
**Source:** https://developers.google.com/search/docs/specialty/ecommerce/share-your-product-data-with-google
**Purpose:** How to send product data via structured data + feeds.

- Combine on-page structured data with off-page feeds for full coverage.
- Feeds give timing control; crawling alone offers no such guarantees.
- Sync issues are common — automate updates.

**Paddock relevance:** partial. The "structured data on page + supplementary feed" pattern transfers conceptually: SportsEvent JSON-LD on weekend pages, plus ICS/sitemap acting as the "feed".
**Feeds:** B8 (loosely).

#### include-structured-data-relevant-to-ecommerce
**Source:** https://developers.google.com/search/docs/specialty/ecommerce/include-structured-data-relevant-to-ecommerce
**Purpose:** Which schema types to use.

- Structured data is the standardized machine-readable format.
- schema.org is the reference vocabulary; Google supports a subset.
- BreadcrumbList establishes page-hierarchy relationships.
- Different content types need tailored schemas.
- Look for framework-level helpers before hand-rolling.

**Paddock relevance:** applicable. Direct map: SportsEvent / SportsTeam / Person / BreadcrumbList / Article / WebSite.
**Feeds:** B8.

#### how-to-launch-an-ecommerce-website
**Source:** https://developers.google.com/search/docs/specialty/ecommerce/how-to-launch-an-ecommerce-website
**Purpose:** Launch checklist.

- Verify site ownership with Google before launch.
- For large URL counts, submit a sitemap rather than individual URLs.
- Use the Page Indexing report to monitor crawl/index progress.
- Four launch strategies (grand reveal, home-only, soft launch, full launch with unavailable inventory) each affect visibility timeline.
- Don't artificially block crawling of key signals.
- Merchant Center and Business Profile setup unlock features beyond core Search.

**Paddock relevance:** applicable. Site 4–5 days old — Search Console verification, sitemap submission, and Page Indexing monitoring are immediate.
**Feeds:** B-monitor, B2–B6.

#### write-high-quality-reviews
**Source:** https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews
**Purpose:** Content quality for review content.

- Demonstrate expertise.
- Substantiate with firsthand evidence (visuals, audio, hands-on).
- Compare against alternatives.
- Ground recommendations in original research, not vendor claims; cover pros and cons.
- Center decision-relevant factors.
- Ranked lists need self-supporting content for each item.
- Substance over length.

**Paddock relevance:** applicable. Transferable to history tab, weekend significance, future race-recap posts.
**Feeds:** B-content (NEW) quality bar.

#### designing-a-url-structure-for-ecommerce-sites
**Source:** https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites
**Purpose:** URL-structure best practices.

- Minimize URL variants returning the same content; consolidate with canonicals.
- Use structured `?key=value` query parameters, not positional ones.
- Avoid linking internally to session IDs, tracking codes, or time-based params.
- Standardize URL casing site-wide.
- Use descriptive path segments (slugs) over numeric IDs.
- Each paginated page needs its own URL.
- Use self-referencing canonicals on indexable pages.
- Link via `<a href>`, not JavaScript handlers.

**Paddock relevance:** applicable. Paddock's calendar `?month=YYYY-MM` and per-series tabs (hash fragments today) hit this doc directly.
**Feeds:** B7, B11.

#### help-google-understand-your-ecommerce-site-structure
**Source:** https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure
**Purpose:** Internal linking, navigation, hub pages, sitemap supplementation.

- Link count to a page is a relative-importance signal.
- Use `<a href>` for navigation, not JS event handlers.
- Build a hierarchical path: home → category → subcategory → item.
- Use a sitemap to supplement discovery.
- Promote high-value content from multiple locations.
- Google analyzes inter-page link relationships, not URL patterns.

**Paddock relevance:** applicable. Hub structure (home → series → weekend) exists but underlinks; weekend pages don't cross-link to history/standings/circuit hubs deliberately.
**Feeds:** B11, B7 cross-links.

#### pagination-and-incremental-page-loading
**Source:** https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
**Purpose:** Pagination patterns and crawlability.

- `rel="next"` / `rel="prev"` is **deprecated**.
- Three UX patterns: pagination, load-more button, infinite scroll — each has crawl/UX tradeoffs.
- Google crawls `href` attributes; it generally does NOT trigger JS event handlers.
- Each paginated page must have a **unique URL** (e.g. `?page=2`) and its own canonical.
- Don't collapse all paginated URLs to a page-1 canonical.
- Use sitemaps or feeds to ensure discovery.
- Block sort/filter parameter variations with `noindex` or robots.txt.

**Paddock relevance:** applicable. `/calendar?month=YYYY-MM` navigator and per-series Calendar tab are pagination cases. Need real `<a href>` for prev/next month, self-canonical per month, sitemap inclusion.
**Feeds:** B7 (canonical per month), B-perf.

#### international (overview)
**Source:** https://developers.google.com/search/docs/specialty/international
**Purpose:** Index for international SEO.

- Multilingual ≠ multi-regional; identify which (or both) applies.
- hreflang is the explicit signal to declare localized variants.
- Locale-adaptive serving (different content at same URL by IP/Accept-Language) is risky for crawling.
- Three subtopics: managing multi-regional structure, declaring localized versions, locale-adaptive handling.
- Google doesn't prescribe ccTLD vs subdomain vs subdirectory.

**Paddock relevance:** applicable. Orienting doc for B12.
**Feeds:** B12 (orienting).

#### managing-multi-regional-sites
**Source:** https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
**Purpose:** URL structure choices and signals.

- URL options: ccTLD (clear geo, expensive), subdomain (easier, weaker signal), subdirectory (easier, weaker signal), query parameter (**not recommended**).
- hreflang annotations are essential.
- Avoid IP-based content adaptation.
- Page language determined by visible content, not the `lang` attribute.
- Don't auto-redirect users between language versions.
- Generic TLDs (.com, .org) need explicit targeting via hreflang.

**Paddock relevance:** applicable. `.com` → `/el/` subdirectory is the right pattern.
**Feeds:** B12 (URL structure confirmed).

#### localized-versions (hreflang)
**Source:** https://developers.google.com/search/docs/specialty/international/localized-versions
**Purpose:** How to implement hreflang correctly.

- Three methods: HTML `<link rel="alternate" hreflang="...">`, HTTP `Link` header, XML sitemap entry — all equivalent. Pick one.
- **Bidirectional reciprocity required** — EN links to EL, EL must link back.
- Language: ISO 639-1 (`en`, `el`). Region: optional ISO 3166-1 alpha-2.
- `hreflang="x-default"` for the fallback.
- Common mistakes: missing reciprocal links, wrong language codes, invalid region codes (e.g. `UK`, `EU`).
- Google detects actual page language algorithmically.

**Paddock relevance:** applicable. Implementation reference for B12. Will use `en` and `el` with `x-default` → English.
**Feeds:** B12 (primary implementation reference).

#### locale-adaptive-pages
**Source:** https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages
**Purpose:** Googlebot crawling of locale-adaptive pages.

- **Google recommends separate URLs + hreflang** instead of locale-adaptive content.
- Googlebot historically didn't send `Accept-Language`.
- Googlebot default IPs are USA-based; non-US locale-adaptive content can be under-crawled.
- Google now operates geo-distributed crawling IPs.
- Treat Googlebot like a regular user from its detected geo.
- robots.txt and meta-tag rules must be consistent across locales.

**Paddock relevance:** applicable. Locks the architectural decision: separate `/el/` URLs, no IP/Accept-Language redirects at root.
**Feeds:** B12.

#### explicit/guidelines
**Source:** https://developers.google.com/search/docs/specialty/explicit/guidelines
**Purpose:** Explicit-content classification rules.

- SafeSearch filters nudity, sexual material, violence, gore.
- Group explicit pages on a separate domain/subdomain to prevent whole-site flagging.
- Allow Googlebot to fetch video files.
- Don't block Googlebot with age gates.
- `<meta name="rating" content="adult">` for marking individual explicit pages.

**Paddock relevance:** not applicable. Zero explicit content.
**Feeds:** —.

#### explicit/troubleshooting
**Source:** https://developers.google.com/search/docs/specialty/explicit/troubleshooting
**Purpose:** Fixing accidental SafeSearch flagging.

- Remove adult-rating meta tags from non-explicit pages.
- Video sitemap `family_friendly=no` reserved for genuinely explicit material.
- Moderate user-generated content.
- Don't gate Googlebot with age verification.
- Allow 2–3 months for reclassification after fixes.

**Paddock relevance:** not applicable.
**Feeds:** —.

---

## Part 3 — Updated Track B bundle map

For each Track B bundle, the docs that directly feed it. Use this as the "what to read before shipping" index.

### B1 — Discoverability manifests (DONE)
- `crawling-indexing` (overview)
- `sitemaps/overview`, `sitemaps/build-sitemap`, `sitemaps/large-sitemaps`, `sitemaps/combine-sitemap-extensions`
- `robots/intro`, `robots-txt/robots-txt-spec`
- `ask-google-to-recrawl`

### B-perf — Mobile-perf pass
- `mobile-sites-mobile-first-indexing`
- `googlebot` (mobile-first variant primacy)
- `core-web-vitals`, `page-experience`
- `javascript-seo-basics`, `fix-search-javascript`, `lazy-loading`
- `avoid-intrusive-interstitials`
- `crawlers-fetchers/overview-google-crawlers` (Brotli, ETag, cache headers)

### B8 — JSON-LD
- `intro-structured-data`, `sd-policies`, `generate-structured-data-with-javascript`
- `enriched-search-results`
- `search-gallery` (master type catalog)
- `structured-data/organization` — emit on `/`
- `site-names` (WebSite emission rules)
- `structured-data/breadcrumb` — emit on every nested route
- `structured-data/event` — `SportsEvent` on `/series/[slug]/weekend/[round]`, possibly one per session
- `structured-data/article` — F1 history + future blog
- `structured-data/profile-page` — driver/team pages (gated on data)
- `establish-business-details`
- `valid-page-metadata`

### B7 — Tab-aware metadata + canonical
- `canonicalization`, `consolidate-duplicate-urls`, `canonicalization-troubleshooting`
- `title-link`, `snippet`
- `special-tags`
- `valid-page-metadata`
- `mobile-sites-mobile-first-indexing` (mobile/desktop title parity)

### B-content (NEW) — Fill placeholder history + rules tabs + initial blog posts
- `creating-helpful-content`
- `ai-optimization-guide`, `using-gen-ai-content`
- `reviews-system` (reviewer-style content quality bar)
- `write-high-quality-reviews` (ecommerce reviews doc — transferable)
- `publication-dates`
- `block-indexing` (`noindex` on placeholder tabs until filled)
- `core-updates`, `spam-updates` (defensive — thin content trips heuristics)

### B11 — Path-based tab routes
- `url-structure`
- `links-crawlable`
- `301-redirects`
- `site-move-with-url-changes`
- `canonicalization`
- `ranking-systems-guide` (site diversity cap argues for distinct URLs)
- `get-started-developers` (crawlable links principle)

### B2 — Noindex auth pages, B3 — `nofollow` outbound + excerpt cap, B4 — per-route descriptions, B5 — `<time dateTime>` markup, B6 — RSS hardening
- `robots-meta-tag`, `block-indexing`
- `qualify-outbound-links`
- `snippet`
- `special-tags`
- `favicon-in-search`
- `avoid-intrusive-interstitials` (audit Clerk auth, cookie banner)

### B-discover (NEW) — Discover + AI surfaces
- `google-discover`
- `google-images`
- `ai-features`
- `structured-data/article` (with `image` array)
- `publication-dates`

### B9 — Server-render bodies
- `javascript-seo-basics`, `fix-search-javascript`, `lazy-loading`
- `mobile-sites-mobile-first-indexing`
- `featured-snippets` (needs server-rendered fact answers)
- `generate-structured-data-with-javascript`

### B10 — Per-segment OG images
- `google-discover` (image size requirements)
- `google-images`
- `indexable-file-types` (image format confirmation)
- `sitemaps/image-sitemaps` (future)
- `appearance/video` (if video OG ever ships)

### B-monitor (NEW) — Operational runbook
- `search-console-start`
- `debugging-search-traffic-drops`
- `bubble-chart-analysis`
- `google-analytics-search-console`
- `search-operators`, `search-operators/all-search-site`, `search-operators/image-search`
- `ask-google-to-recrawl`
- `security` (overview), `security/social-engineering`, `security/prevent-malware`, `security/safe-browsing-repeat-offenders`
- `trends-start`
- `core-updates`, `spam-updates`

### B12 — Greek `/el/` route tree
- `international` (overview)
- `managing-multi-regional-sites`
- `localized-versions` (hreflang implementation)
- `locale-adaptive-pages`
- `url-structure` (multi-regional section)
- `sitemaps/combine-sitemap-extensions` (hreflang in sitemap)
- `canonicalization` (hreflang reciprocity strengthens canonical)
- `translated-results` (English variant remains translation-eligible)

### B8b (DEFERRED) — SoftwareApplication
- `structured-data/software-app` (blocked by `aggregateRating` requirement)
- `reviews-system` (prereq for legitimate ratings)

### Not in any bundle — informational reference only
- AMP cluster (5 docs)
- Web Stories cluster (3 docs)
- Ecommerce product / merchant / loyalty / shipping / return cluster
- Job Posting, Local Business, Employer Rating, Math Solver, Book, Course, Recipe, Movie, Vacation Rental, Paywalled, Speakable, Fact Check, Education Q&A
- Top Places, Flexible Sampling, Signed Exchange, Preferred Sources
- Package Tracking
- Carousel (closed inner-type list excludes our entities)
- News Sitemap, Video Sitemap
- Large Sitemap (deferred until ~30K URLs)
- Translate / Ad Network reconstruction
- Explicit Content cluster (Paddock has none)
- Site move docs (no migration planned)
- Pause Online Business (n/a)
- Website Testing (no A/B framework today)
- Prevent Abuse (no UGC)
- Crawl-rate reduction (no pressure)
- Verify Google requests (no bot filtering today)

---

## Part 4 — New bundles in detail

### B-content

**Goal:** Replace thin-content liabilities with curated, bylined, original prose.

**Scope:**
1. Fill 14 placeholder history tabs (MotoGP, WEC, WSBK, F2, F3, IMSA, DTM, GTWC, FE, IndyCar, NASCAR, WRC, NLS, ADAC Ravenol 24h). Follow F1 history pattern: ~500-word three-section structure, "Authored by Paris Paraskevas, Last updated YYYY-MM-DD" frontmatter byline, inline footnotes citing Tier-0/1/2 sources, no Wikipedia content dump.
2. Fill 15 placeholder rules tabs. Pattern: 200–400 words covering "what makes this series distinctive", lap/sprint/qualifying format, points system summary, key technical regulations. Link out to canonical rulebook with `rel="nofollow"`.
3. Ship 3–5 initial MDX blog posts in `content/posts/`. Topics could be race-weekend recaps (post-race), technical explainers (e.g. "How DRS works"), season previews. Each gets `Article` schema, hero image, byline, `datePublished`, `dateModified`.

**Doctrine sources:** `creating-helpful-content`, `ai-optimization-guide`, `using-gen-ai-content`, `reviews-system`, ecommerce `write-high-quality-reviews`, `publication-dates`.

**Effort:** 2–4 hours per article × ~33 articles ≈ 80–130 hours. Parallelizable. Dependent on operator/Fotis bandwidth for editorial; Claude can draft from authoritative sources but must be bylined as human-edited per `using-gen-ai-content` policy.

**Why now:** Mobile-first indexing means every URL is judged against Google's quality bar. Placeholder pages already submitted in `app/sitemap.ts` will be crawled and judged thin if not filled before significant indexing occurs. Either fill or temporarily `noindex` (block-indexing pattern).

### B-discover

**Goal:** Make Paddock eligible for Google Discover impressions, which are visual + timely + mobile.

**Scope:**
1. Add `<meta name="robots" content="max-image-preview:large">` to root metadata.
2. Verify the existing `/opengraph-image` route emits a ≥1200×675 16:9 PNG/JPEG/WebP.
3. Future blog posts (B-content) carry hero images at ≥1200×675 with multi-aspect renditions for `Article.image` array.
4. Per-series `opengraph-image.tsx` segments (overlaps with B10) so series detail pages get distinct, branded Discover candidates.

**Doctrine sources:** `google-discover`, `google-images`, `ai-features`, `structured-data/article`.

**Effort:** Meta tag is 5 minutes. Hero-image policy + per-segment OG is ~2–4 hours; pair with B10.

**Why now:** Motorsport is timely + visual + tribal — exactly Discover's wheelhouse. Eligibility costs almost nothing; the only blocker is the meta tag and image-size hygiene.

### B-monitor

**Goal:** A repeatable operational runbook so Paddock isn't running blind once GSC data starts flowing.

**Scope (no code; a doc and a set of habits):**

| Cadence | Action | Source |
|---|---|---|
| Every push to main | URL Inspect any new route segment; verify `/robots.txt`, `/sitemap.xml`, `/llms.txt` content after structural changes | `ask-google-to-recrawl`, `crawlers-fetchers/verify-google-requests` |
| Weekly | `site:paddock-tracker.com` on Google + Bing; export GSC Performance report; check Index Coverage delta | `search-operators`, `search-console-start`, `debugging-search-traffic-drops` |
| Monthly | GSC Security Issues + Manual Actions report; CWV report once field data accumulates; quarterly bubble-chart analysis | `security`, `core-web-vitals`, `bubble-chart-analysis` |
| Post-bundle ship | URL Inspect representative pages; Rich Results Test on new JSON-LD; note ship date in CHANGELOG for delta correlation | `ask-google-to-recrawl`, `intro-structured-data` |
| Annual | Re-read this playbook against current Google docs; diff for material changes | This document |

**Doctrine sources:** Entire Monitoring & Debugging section + Search Console docs.

**Effort:** ~30 min weekly, 1 hour monthly, ~2 hours quarterly, ~half-day annually. Mostly the operator's time; no code work.

**Why now:** The cheapest way to catch a Track B regression is to notice the metric move at week 2, not month 3. Sitemap was just submitted; indexing data starts populating within days.

### B8b (deferred) — SoftwareApplication

**Goal:** Mark up Paddock-the-PWA itself with `SoftwareApplication` JSON-LD so it can surface as an app in relevant SERP contexts.

**Why deferred:** `software-app` schema requires `aggregateRating` OR `review`. Paddock has neither today. Emitting without satisfies validators but signals zero rich-result eligibility to Google. Either:
1. Wait until Paddock has a "rate this app" surface generating real reviews — requires user trust infrastructure that isn't on the roadmap, OR
2. Cite an editorial review of Paddock — requires an editorial review to exist.

**Park until:** Track B is otherwise complete AND there's a credible review source to cite. Revisit annually.

---

## Part 5 — Source URL inventory

All 152 URLs scanned for this playbook, organized by category. The slug (after the last `/`) doubles as the section anchor in Part 2.

### SEO Fundamentals (8)
- seo-starter-guide
- how-search-works
- creating-helpful-content
- ai-optimization-guide
- using-gen-ai-content
- get-started
- get-started-developers
- do-i-need-seo

### Crawling and Indexing (44)
- crawling-indexing (overview)
- indexable-file-types
- url-structure
- links-crawlable
- sitemaps/overview, build-sitemap, large-sitemaps, image-sitemaps, news-sitemap, video-sitemaps, combine-sitemap-extensions
- ask-google-to-recrawl
- crawlers-fetchers/overview-google-crawlers, googlebot, reduce-crawl-rate, verify-google-requests
- robots/intro, robots-txt/robots-txt-spec
- canonicalization, consolidate-duplicate-urls, canonicalization-troubleshooting
- mobile/mobile-sites-mobile-first-indexing
- amp (overview), amp/about-amp, amp/enhance-amp, amp/validate-amp, amp/remove-amp
- javascript/javascript-seo-basics, javascript/fix-search-javascript, javascript/lazy-loading
- valid-page-metadata, special-tags, robots-meta-tag, block-indexing, qualify-outbound-links
- control-what-you-share, remove-information, prevent-images-on-your-page, keep-redacted-information-out
- 301-redirects, site-move-no-url-changes, site-move-with-url-changes
- website-testing, pause-online-business

### Search Appearance — General (20)
- appearance (overview)
- ai-features, publication-dates, favicon-in-search
- featured-snippets, flexible-sampling, google-discover, google-images
- establish-business-details, top-places-list
- support.google.com/webmasters/answer/3035947 (Shopping/Flights/Hotels/Local opt-out)
- page-experience, core-web-vitals, avoid-intrusive-interstitials
- signed-exchange, preferred-sources
- ranking-systems-guide, reviews-system, core-updates, spam-updates

### Search Appearance — SERP Features + Visual + Web Stories (12)
- site-names, sitelinks, snippet, title-link
- translated-results, ad-network-and-translation
- video, visual-elements-gallery
- enable-web-stories, web-stories-creation-best-practices, web-stories-content-policy
- package-tracking

### Search Appearance — Structured Data Overview (5)
- structured-data/intro-structured-data, sd-policies
- enriched-search-results, generate-structured-data-with-javascript
- structured-data/search-gallery

### Search Appearance — Structured Data per type (34)
- article, breadcrumb, carousel, event, organization, profile-page
- discussion-forum, factcheck, qapage, review-snippet, speakable, video
- image-license-metadata, carousels-beta
- dataset, education-qa, movie, recipe
- book, course, employer-rating, job-posting, local-business, math-solvers
- product, product-snippet, merchant-listing, product-variants
- loyalty-program, return-policy, shipping-policy
- software-app, paywalled-content, vacation-rental

### Monitoring & Debugging (14)
- debugging-search-traffic-drops
- search-console-start, bubble-chart-analysis, google-analytics-search-console
- search-operators (overview), search-operators/all-search-site, search-operators/image-search
- security (overview), prevent-abuse
- security/malware, security/prevent-malware, security/social-engineering, security/safe-browsing-repeat-offenders
- trends-start

### Site-specific Guides (15)
- specialty/ecommerce (overview)
- specialty/ecommerce/where-ecommerce-data-can-appear-on-google
- specialty/ecommerce/share-your-product-data-with-google
- specialty/ecommerce/include-structured-data-relevant-to-ecommerce
- specialty/ecommerce/how-to-launch-an-ecommerce-website
- specialty/ecommerce/write-high-quality-reviews
- specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites
- specialty/ecommerce/help-google-understand-your-ecommerce-site-structure
- specialty/ecommerce/pagination-and-incremental-page-loading
- specialty/international (overview)
- specialty/international/managing-multi-regional-sites
- specialty/international/localized-versions
- specialty/international/locale-adaptive-pages
- specialty/explicit/guidelines, specialty/explicit/troubleshooting

---

_End of playbook. Compile via 8 parallel research agents on 2026-05-19, each WebFetching its slice of URLs and synthesizing against Paddock's Track A + Track B state. Re-read annually._

