# Paddock — handoff

The running operational record. Read at session start. Update at session end.

This replaces the per-user memory handoff that lived at `~/.claude/projects/C--Dev-Personal-Motorsport/memory/project-paddock-handoff.md` until 2026-05-16. Memory file is now a redirect stub.

---

## Quick context

- **Repo:** `paris-paraskevas/motorsport` (private).
- **Live URL:** https://paddock-tracker.com. Vercel project name: `motorsport`.
- **Branch:** `main`. **Workflow:** branch → PR → review → squash-merge. See `CONTRIBUTING.md`.
- **Contributors:** Paris (paris-paraskevas) — deploy steward. Fotis — joining as contributor #2. Onboarding doc: `ONBOARDING.md`.
- **Stack:** Next.js 16 App Router (middleware in `proxy.ts`), React 19, Tailwind v4, `@serwist/next` PWA, Clerk Production auth, Vercel KV (Upstash Redis). Public-with-account auth model.
- **GitHub CLI authed** as `paris-paraskevas` with `repo` + `workflow` scopes. **Vercel CLI** previously installed; reinstall via `npm i -g vercel` if a session needs it.
- **Current version:** see `package.json`. Bump on every push (`feedback-paddock-release-notes` rule, `CONTRIBUTING.md` mandate).

## Critical landmines — do not break

Detailed in inline comments + memory rules. Quick reference:

1. `next.config.ts` keeps **both** `serverExternalPackages: ["node-ical"]` **and** `outputFileTracingIncludes` for node-ical transitive deps. Either one alone breaks production fetches. Memory: `feedback-vercel-node-ical`.
2. Middleware file is `proxy.ts` in Next 16, **not** `middleware.ts`. `clerkMiddleware()` itself unchanged.
3. KV env vars must be unprefixed: `KV_REST_API_URL`, `KV_REST_API_TOKEN`. Reject any "STORAGE" prefix from the Vercel Marketplace flow.
4. Clerk publishable key must keep `NEXT_PUBLIC_` prefix exactly. **Vercel Marketplace integration auto-creates env-var placeholders but leaves them EMPTY when promoted to Production.** Paste real `pk_live_*` / `sk_live_*` manually (Production scope), `pk_test_*` / `sk_test_*` for Preview + Development.
5. Notification badge must be monochrome (`public/icons/badge-96.png`). Regenerate via `scripts/gen-badge.py` if changed.
6. Crons **fail closed** when `CRON_SECRET` is unset — return 503, do not run. Pattern in `lib/cron-auth.ts` (`authorizeCronRequest` → `'ok' | 'missing-secret' | 'invalid'`). Reversed in `0.9.17` after the security review flagged the prior fail-open default — if CRON_SECRET ever got cleared, every cron route became an unauth'd spam gun. Now: missing secret → 503, wrong secret → 401, correct secret → run.
7. Open-Meteo lookups must use **venue-local** date, never UTC. Evening-session weather pulled the wrong day before the fix. Memory: `feedback-paddock-weather-venue-local`.
8. **Vercel CLI quirks:** `echo 'VALUE' | vercel env add NAME ENV` works for Production + Development. **Preview** needs `vercel env add NAME preview '' --value 'VALUE' --yes` — pass `''` as the git-branch positional. Single-quote values containing `$` (publishable keys end with `$`; bash will eat them).
9. **Date-only ICS entries** (`DTSTART;VALUE=DATE`) flow through `lib/ics.ts` with `Session.dateOnly: true`. UI must render "TBC", live-now must skip, notifications must never fire. Don't trust a Date that's anchored at UTC midnight.
10. **Round numbers are canonical, not array indices.** Source from `content/series/<slug>/rounds.json` via `lib/rounds.ts`. F1 is curated; other series fall back to array-index until curated.

## Authoring model — conversational, not admin UI

Every editable surface has a file home under `content/`. Renderers prefer curated/override files; external APIs are fallbacks. Edits to these are real commits that deploy to production (~90s).

| What to edit | File | Shape |
|---|---|---|
| Series metadata (color, URLs, season) | `content/series/<slug>/meta.json` | `SeriesMeta` in `lib/types.ts` |
| Drivers per series | `content/series/<slug>/drivers.json` | `CuratedDriversFile` |
| Champions per series | `content/series/<slug>/champions.json` | `Champion[]` |
| Significance flags (marquee / finale / weighted / note) | `content/series/<slug>/significance.json` | `SignificanceMap` |
| Series overview prose | `content/series/<slug>/overview.md` | plain markdown |
| Drivers prose (above the table) | `content/series/<slug>/drivers.md` | plain markdown |
| Significance prose | `content/series/<slug>/significance.md` | plain markdown |
| Standings corrections | `content/series/<slug>/standings-overrides.json` | `StandingsOverridesFile` |
| Race results corrections (DSQ / penalty) | `content/series/<slug>/results-overrides.json` | `ResultsOverridesFile` (keyed by round number) |
| **Timed-session overrides** (for date-only feeds) | `content/series/<slug>/sessions.json` | `SessionsOverridesFile` — replaces matching date-only entries with curated timed sessions |
| **Canonical FIA round numbers** | `content/series/<slug>/rounds.json` | `SeriesRoundsFile` — `{ season, rounds: [{ round, startDate, endDate, name }] }` |
| Calendar fallback (offline ICS) | `content/series/<slug>/fallback.ics` | iCalendar — used when live ICS fetch fails |
| Blog / news articles | `content/posts/<slug>.mdx` | gray-matter frontmatter: `title`, `summary`, `publishedAt`, `tags?`, `heroImage?`, `seriesSlug?`, `draft?` |

When a curated/override file is absent, renderers fall back to the live external source (jolpica, Wikipedia, scraped tables). Curation is fully opt-in.

## Where things live

- `app/` — Next.js App Router routes. `proxy.ts` is middleware.
- `components/` — React components. `components/weekend/*` is the race-weekend page.
- `lib/` — pure modules (parsing, grouping, types). Server-only helpers end in `*-loader.ts` to keep client bundles clean (the `lib/rounds.ts` + `lib/rounds-loader.ts` split is the canonical example — pure side imports from group.ts, loader side stays server-only).
- `content/series/<slug>/` — per-series curated data (see authoring-model table).
- `content/posts/*.mdx` — blog.
- `tests/fixtures/` — ICS + JSON test fixtures.
- `~/.claude/projects/C--Dev-Personal-Motorsport/memory/` — per-user memory (feedback rules + this file as a redirect stub).
- Root docs: `CLAUDE.md` (operating manual), `IDEAS.md` (idea ledger), `SCHEDULE.md` (time plan), `CONTRIBUTING.md` (PR rules), `ONBOARDING.md` (Fotis ramp), `CHANGELOG.md` (release notes), `docs/HANDOFF.md` (this file).

## Sessions roadmap

| ID  | Theme                                | What's in it                                                                                                                                                                                                                                                                            |
|-----|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| S4  | **Supabase data layer + scheduled scrapes** (reframed 2026-05-16) | The "every series, real session times" + "live race data" ambitions need a real DB. Provision Supabase via Vercel Marketplace; schema for sessions / standings / results / news / weather snapshots / live in-race data; per-series scrape jobs via Vercel Cron + Sandbox/Playwright for JS-rendered sites (fiaformulae.com, motogp.com); decide what stays as curated files vs moves to DB. Live-data ambition: "everything reachable per series" — sector times, gaps, weather radar, tyre choices. Multi-session build, replaces the KV-data-watch design originally planned. Research first (existing public sources — Ergast/jolpica, MotoGP web API, FIA feeds, aggregators), then schema, then scaffold. |
| S5  | SEO baseline                         | `app/sitemap.ts`, `app/robots.ts`, JSON-LD (`SportsEvent` per session, `Organization` per series, `Person` per driver, `BreadcrumbList` on detail pages), per-page `generateMetadata`, OG image generators, canonicals via `metadataBase` + `alternates.canonical`. Layer in fan-intent keywords (schedule / programme / where to watch / live stream / timetable). |
| S6  | Detail-page enrichment               | `/drivers/[slug]` + `/teams/[slug]` — Wikipedia bio summary, current standings position, last 5 results, news mentions. F1 History tab redesign OR curated `content/series/<slug>/history.md`. Rules tab "common topics" surface + FIA PDF link. |
| S7  | Native non-F1 results + standings    | Per-series ingestion in `lib/results/<slug>.ts` and `lib/standings/<slug>.ts`. Order: MotoGP → WEC → IndyCar → NASCAR. Includes endurance-series weekend-grouping audit (WEC / IMSA / NLS / ADAC have 24h races and multi-day tests; `groupByWeekend`'s 4-day gap may split them oddly). |
| S8  | Quality + monitoring + infra polish  | Custom `app/error.tsx`, Sentry, `/api/cron/health` summarising last-run timestamps, performance audit (Lighthouse + Speed Insights), zero lint errors + husky pre-commit hook, component tests (vitest + Testing Library), Playwright E2E on previews. |
| S9  | Race-weekend Part 2                  | Comments thread (Clerk + KV or Supabase) + predictions (open → locked-at-session-start → resolved-after-race) + paddock-coins ledger + leaderboard. Depends on S3 (shipped) and pairs with S4. |
| S10 | Showcase / content / polish          | Public README with screenshots + Mermaid architecture diagram, first 2–3 MDX blog posts, news-filter persistence (active series chip across reloads). |

## Loose items (not bound to a session)

- **UI/UX craft pass** — mobile-first audit, WCAG 2.2 AA pass, motion / micro-interactions, focus states, dark-mode contrast.
- **User research** — short survey, talk to F1-fan friends, mine subreddits for pain points.
- **SEO keyword strategy** — fan-intent queries across every series / weekend / driver / team page.
- **Notification expansion** (Phase 2) — per-event-type pushes (qualifying topper / race winner / championship-decider), click-handler deep-links to the specific session or article (currently always `/`), Settings "Your devices" list with per-device test + remove, hero images in `payload.image`.
- **Champions data fragility** — F1 wrong points column, F3 all zero, MotoGP brittle redirects. Long-term: curated `content/series/<slug>/champions.json` per series.
- **Cleanup** — delete `lib/onboarding.ts` (only wizard-reopen consumer), DRY `EnableNotifications` + `OnboardingWizard`, retheme Clerk sign-in / sign-up to Paddock dark.
- **Weekend page media embeds** (S3 follow-up, pre-S9) — `WeekendMedia` section fed by `content/series/<slug>/media.json` keyed by round (YouTube highlight reels, curated blog cross-links, optionally official onboard / pole-lap clips). `<YouTube id="..." />` MDX component already exists.
- **Smaller polish parking lot** — series Tracks/Circuits tab with map, home hero shows next 2–3 sessions when all imminent, session-card tap-to-expand (broadcast info / streaming / track), per-driver season-trend on `/drivers/[slug]`, Champions tab era markers / sparklines.

## Open design questions

1. **Sessions-override architecture (S4 input).** `sessions.json` exists per series (0.9.1). For Supabase, do overrides live in DB or stay as files? Files = git-reviewable, DB = admin-UI-editable.
2. **JS-rendered official sites.** fiaformulae.com / motogp.com / nascar.com — SPA-rendered, `fetch` returns nav HTML only. Sandbox/Playwright periodic scrape into Supabase, third-party feeds, or stay curation-first.
3. **Admin authoring UI vs conversational edits.** Current model (Claude edits files in `content/`) works. Admin UI is optional until S4. Decide during the Supabase initiative.
4. **Embedded video provider.** YouTube iframe (free, fast) vs Mux / Cloudflare Stream (paid, control). YouTube likely wins for v1.
5. **Driver lookup source for `/drivers/[slug]`.** Wikipedia REST API + parse, or curated `drivers.json` per series. Curated is reliable; Wikipedia is autofill.
6. **`sk_live_*` Clerk key rotation.** Deferred indefinitely; revisit if blast radius changes.

## Infra ledger

- ✅ Clerk Production — DONE 2026-05-14
- ✅ `paddock-tracker.com` custom domain + Vercel DNS + Let's Encrypt SSL — DONE 2026-05-14
- ✅ `CRON_SECRET` (Vercel all scopes + GitHub Actions) — DONE 2026-05-15
- ✅ Preview / Development Clerk env vars — DONE 2026-05-15
- ✅ Public-with-account auth model — DONE 2026-05-15
- ✅ VAPID + KV — push works end-to-end on properly-installed PWAs
- ✅ Vercel Analytics + Speed Insights wired — DONE 2026-05-15
- ✅ Race-weekend pages skeleton — DONE 2026-05-16 (`0.8.x` / `0.9.0`)
- ✅ Weekend correctness fixes (3 am bug + canonical round numbers + sessions.json + rounds.json infra) — DONE 2026-05-16 (`0.9.1`)
- ✅ Repo operating docs (`CLAUDE.md` + `IDEAS.md` + `SCHEDULE.md`) — DONE 2026-05-16 (`0.9.2`)
- ✅ ESPA + extensions + Mode awareness + communication discipline + commit-attribution reversed — DONE 2026-05-16 (`0.9.3`)
- ✅ Two-contributor workflow (`CONTRIBUTING.md` + `ONBOARDING.md` + CLAUDE.md push-to-main reversal) — DONE 2026-05-16 (`0.9.4`)
- ✅ docs/HANDOFF.md created + memory redirect — DONE 2026-05-16 (`0.9.5`)
- ✅ docs/HANDOFF.md flat 60-item open-items appendix — DONE 2026-05-16 (`0.9.6`)
- ✅ Per-prompt active-time tracking (`[+Nm]` prefix → SCHEDULE.md `Active:` line) — DONE 2026-05-16 (`0.9.7`)
- ✅ F1 2026 Bahrain + Saudi cancellations restored with banner + section render — DONE 2026-05-16 (`0.9.8`, PR #1 at `cd169b6`)
- ✅ Postponement rendering UI + MotoGP/WEC `rounds.json` + midnight-UTC `dateOnly` detection ("3 am" fix) — DONE 2026-05-16 (`0.9.9`, PR #2 at `e0d93cf`)
- ✅ Full-season `sessions.json` curation across 14 series + ADAC 24h — DONE 2026-05-17 (`0.9.10`, commit `141de18`, merged via PR #3)
- ✅ Template-projected empty rounds across F1/F2/F3/MotoGP/WEC/DTM/GTWCE — DONE 2026-05-17 (`0.9.11`, commit `2778037`, merged via PR #3)
- ✅ Champions data curated end-to-end across all 15 series — DONE 2026-05-18/19 (Mon/Tue marathon, `0.10.4`–`0.10.22`)
- ✅ Track A · A1 — imprint page + privacy postal address — DONE 2026-05-19 (`0.10.23`, PR #36)
- ✅ Track A · A2 + A3 — push-unsubscribe ownership + contact 12-month TTL — DONE 2026-05-19 (`0.10.25`, PR #38)
- ✅ Track A · A4a — site-wide security headers — DONE 2026-05-19 (`0.10.26`, PR #39)
- ✅ Track A · A4b — ISR with 5-min revalidate on `/`, `/calendar`, `/blog` — DONE 2026-05-19 (`0.10.27`, PR #40)
- ✅ Track A · A5 — F1 history tab + content-authoring infrastructure (other 14 series + Rules tabs parked) — DONE 2026-05-19 (`0.10.28`, PR #41; markdown-render follow-up `0.10.29`, PR #42)
- ✅ Track B · B1 — robots.ts + sitemap.ts + llms.txt — DONE 2026-05-19 (`0.10.30`, PR #45 + fix-up `8178d05`)
- ✅ Track B · B2 + B3 + B4 + B5 + B6 + B-discover — cheap wins — DONE 2026-05-19 (`0.10.31`, PR #48)
- ✅ Track B · Bing fixes + B7 — home title/H1 + tab-aware metadata — DONE 2026-05-19 (`0.10.32`, PR #49)
- ✅ Track B · IndexNow + weekend canonical + /blog desc — DONE 2026-05-19 (`0.10.33`, PR #50)
- ✅ Track B · B8 JSON-LD + RSS lastBuildDate fix — DONE 2026-05-19 (`0.10.34`, PR #51)
- ✅ Google Search Console — sitemap.xml submitted + Success — DONE 2026-05-19
- ✅ Bing Webmaster Tools — sitemap.xml submitted + Processing → Success — DONE 2026-05-19
- ✅ Brave Search — home URL submitted via `search.brave.com/submit-url` — DONE 2026-05-19
- ✅ IndexNow — first push 226 URLs accepted HTTP 200 — DONE 2026-05-19
- ✅ Contact-form email delivery — Resend Marketplace installed + `RESEND_API_KEY` + `CONTACT_TO_EMAIL` wired — DONE 2026-05-19 (operator-confirmed)
- ❌ `sk_live_*` rotation — deferred
- ❌ Sentry integration — pending
- ❌ GitHub Actions CI workflow — parked (`IDEAS.md` Parked section)
- ❌ Vercel Pro upgrade — not needed yet; Paris remains sole steward on Hobby, Fotis works via GitHub previews

## ⚡ Active workstream (post-2026-05-19 — Track A + most of Track B complete)

**Quick state:** Track A shipped (versions 0.10.23 → 0.10.29, 7 PRs). Track B shipped 11 of ~18 bundles today (0.10.30 → 0.10.34, 7 PRs). Site is sitemap-submitted to Google + Bing + Brave + IndexNow. Baselines captured 2026-05-19 → `docs/perf-baselines.md` (Vercel SI mobile RES 76 / LCP 3.67 s / TTFB 3.17 s; PSI desktop 616 KiB unused JS broken down by bucket). Mobile is the load-bearing problem — **B-perf is the next session's #1 pick**, 4-PR plan sequenced in `SCHEDULE.md` Wed 2026-05-20 entry.

### Track A — legal/risk closure — DONE

All shipped today (2026-05-19) on top of the 19-PR Mon/Tue marathon. Versions 0.10.23 → 0.10.29 across 7 PRs.

| PR | Version | Item | Commit |
|---|---|---|---|
| #36 | 0.10.23 | **A1** — imprint + privacy postal address | `a5ddbfc` |
| #37 | 0.10.24 | imprint address line-break fix (markdown `<br>` rendering) | `fe73fb6` |
| #38 | 0.10.25 | **A2 + A3** — push-unsubscribe ownership + contact 12-month TTL | `db9e64b` |
| #39 | 0.10.26 | **A4a** — security headers (HSTS extend, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy) | `d414ef3` |
| #40 | 0.10.27 | **A4b** — ISR with 5-min revalidate on `/`, `/calendar`, `/blog` | `093f4bd` |
| #41 | 0.10.28 | **A5** — F1 history tab + content-authoring infrastructure | `29a965e` |
| #42 | 0.10.29 | markdown footnote anchor + byline date follow-up | `bcd4b39` |

**Scope delivered vs originally specified for A5:** the handoff envisioned A5 as Wikipedia-content removal + F1 / MotoGP / WEC content + infrastructure. Delivered: F1 only + infrastructure under `docs/content-authoring/`. MotoGP, WEC, and the remaining 12 series are parked under the content workstream below.

Two confirm-or-swap markers in legal markdown are RESOLVED (removed during A1, PR #36):
- Governing law / jurisdiction: Greece (Thessaloniki courts) — confirmed.
- Privacy contact email: `pparaskevas.dev@gmail.com` — confirmed.

### Active: Track B — SEO + GEO execution

Driven by `docs/audit-seo-geo-2026-05-19.md` (10-pillar discoverability audit, baseline `0.10.22`) + `docs/seo-geo-playbook.md` (152-doc Google Search Central synthesis, May 2026 source-truth reference). The audit + playbook are the strategy refs; this section is the **state of execution**.

#### ⏭ Next-session pickup — remaining Track B, in priority order

Pop into a new session and pick from the top:

| Priority | Bundle | Effort | Operator prerequisite | Notes |
|---|---|---|---|---|
| **1** | **B-perf** — mobile-perf pass | 4–6 h (multi-PR) | Baselines captured 2026-05-19 → `docs/perf-baselines.md`. | 4-PR sequenced plan in `SCHEDULE.md` Wed 2026-05-20 entry. Biggest levers (post-desktop-diagnostics): Clerk lazy ~225 KiB, 3rd-party deferral of AdSense+GTM+FundingChoices ~319 KiB, preconnect Clerk subdomain (90 ms LCP), CSS critical-path. Mobile-first indexing means this suppresses every other signal — load-bearing. Folds the pinned "Speed Insights US-perf" item. |
| **2** | **B-content** — fill 14 history + 15 rules tabs + 3–5 blog posts | 80–130 h (multi-session) | None | F1 history is the template (PR #41). Workflow + sources in `docs/content-authoring/README.md` + `SOURCES.md`. Suggested order: MotoGP → WEC → IndyCar histories first. |
| **3** | **B9** — server-render home + calendar bodies | 2–3 h | None | Helps both perf AND non-JS-aware LLM crawlers. Split `<HomeContent>` / `<FilteredSessions>` into server-side renderers. |
| **4** | **B10** — per-segment OG images | ~2 h | None | `app/series/[slug]/opengraph-image.tsx` + weekend variant. Folds B-discover's ≥1200×675 Discover-grade sizing. |
| **5** | **B-monitor** — operational runbook | ~30 min | None | Markdown only. New doc. |
| **6** | **B11** — path-based tab routes `/series/[slug]/[tab]` | 1–2 days | None | Deferred multi-day. When it lands, flip the canonical strategy from `?tab=X` to path with a one-line edit in `app/series/[slug]/page.tsx`. |
| **7** | **B12** — Greek `/el/` route tree | 3–5 days | None | Deferred multi-day. `next-intl`. |
| **8** | **B8b** — `SoftwareApplication` schema | parked | Real reviews exist (aggregateRating) | Builder intentionally not in `lib/json-ld.ts` yet. |

**Operator wait-and-watch** (no Claude work, just observe):
- **GSC Performance report** — populates ~24–72h after PR #51 deploy. Real queries Paddock matches, CTR, impressions, position.
- **Bing Webmaster Tools** — discovered-URL count should climb from 1 → 226 over the next few days as IndexNow + sitemap propagate.
- **Rich Results Test** on a deployed page — paste `/`, `/series/f1/weekend/9`, any blog post into [search.google.com/test/rich-results](https://search.google.com/test/rich-results). Expect Organization + WebSite + BreadcrumbList + SportsEvent + Article detected cleanly.
- **Bing Site Scan** results when complete (was "Queued" at last check; sitemap.xml-driven scan of all 226 URLs).

#### Research — DONE (three rounds)

1. **Session-start brief, 2026-05-19** — operator shared SEO Starter Guide + 15 GSC/AdSense/GA4 dashboards + PageSpeed mobile screenshots (Perf 39/100, LCP 5.2s, TBT 5340ms, 661 KiB unused JS). Fed into B1 priority decision.
2. **Self-review + targeted web search on PR #45** — covered llms.txt adoption reality, Google sitelinks playbook, GEO citation tactics, sitemap.xml best practices in 2026. Drove the B1 fix-up commit (`8178d05`) — dropped `lastmod`/`priority`/`changefreq`, fixed `host:` format, restructured llms.txt with `## Optional` section.
3. **Systematic 152-doc scan, PR #46** — 8 parallel research agents fed `docs/seo-geo-playbook.md`. Surfaced four new bundles + priority reshuffle + several "do not do" guardrails.

**Load-bearing findings carried forward:**

- **Sitelinks searchbox retired by Google 2024.** B8's `SearchAction` still helps site-name display but no longer drives the in-SERP search input. The audit's Appendix B framing of `WebSite + SearchAction` as the searchbox gateway is partially outdated.
- **Sitelinks mini-links realistic timeline: 6–12+ months**, not the 4–12 weeks cited in PR #44 docs. AI Overviews absorbing branded-search volume + algorithmic changes mean expect longer. Success metric for Track B is "**qualified** for sitelinks (structural prereqs shipped)", not "sitelinks displayed".
- **Bing Webmaster Tools submission is the GEO unlock** — ChatGPT search uses Bing's index, not Google's. New operator action item, not in any bundle.
- **`lastmod = new Date()` would train Google to ignore the field** — B1's omission decision is reaffirmed by Google's own `sitemaps/build-sitemap` doc. Do not add `lastmod` back until per-page change tracking is wired.
- **Mobile-first indexing means Perf 39/100 actively suppresses every other signal** — confirms B-perf precedence over B7/B8/B9.
- **Path-based tabs (B11) more urgent than originally positioned** — duplicate-title cannibalization across 9 `?tab=` variants is exactly the antipattern `title-link` doc warns against. Was bundle #11 in the audit; promoted to slot 6 in the post-playbook order.
- **`llms.txt` explicitly disclaimed by Google as "AEO hack"** but kept as a forward-compatible hedge for non-Google LLM crawlers (Cursor / IDE agents, OAI-SearchBot occasionally).

#### Shipped Track B (2026-05-19 — 7 PRs, versions 0.10.30 → 0.10.34)

| PR | Version | Bundle(s) | What |
|---|---|---|---|
| #44 | — | research | docs(track-b): research synthesis + B-perf bundle + sitelinks-timeline reset |
| #45 + fix-up `8178d05` | 0.10.30 | **B1** | `app/robots.ts` + `app/sitemap.ts` + `public/llms.txt`. Sitemap = 226 URLs. |
| #46 | — | research | docs(seo-geo): 152-doc Google Search Central playbook (`docs/seo-geo-playbook.md`) |
| #47 | — | research | docs(track-b): handoff refresh for execution phase |
| #48 | 0.10.31 | **B2 + B3 + B4 + B5 + B6 + B-discover** | noindex on /sign-in /sign-up /settings + nofollow on outbound news + per-route descriptions across 10 pages + `<time dateTime>` markup + RSS `<lastBuildDate>` / `<ttl>` / `<category>` / `<image>` + site-wide `googleBot.max-image-preview:large` |
| #49 | 0.10.32 | **Bing fixes + B7** | Home `<title>` lengthened to 57 chars + sr-only `<h1>` + tab-aware `generateMetadata` on `/series/[slug]` emitting per-tab title/description/canonical via new `describeTab()` helper |
| #50 | 0.10.33 | **IndexNow + canonicals** | Full IndexNow protocol implementation (`lib/indexnow.ts` + `scripts/submit-sitemap-to-indexnow.ts` + `npm run indexnow:submit` + key file at `public/<key>.txt`) + weekend page `alternates.canonical` + sharper `/blog` description. README.md rewritten from stub. |
| #51 | 0.10.34 | **B8 + RSS fix** | 5 Schema.org schemas (Organization + WebSite + BreadcrumbList + SportsEvent + Article) via new `lib/json-ld.ts` + `components/JsonLd.tsx` server component. RSS `<lastBuildDate>` no longer emits Unix epoch when posts empty. |

**External operator actions completed today:**

- ✅ Google Search Console — sitemap.xml submitted, Status: Success, 226 URLs discovered.
- ✅ Bing Webmaster Tools — sitemap.xml submitted, Status: Processing. Site Scan queued.
- ✅ Brave Search — home URL submitted via `search.brave.com/submit-url`. No further submission portal exists for Brave.
- ✅ IndexNow first push — 226 URLs accepted HTTP 200 (after the live key file went up post-PR-#50 deploy).
- ✅ Bing URL-inspector confirmed 0 SEO/GEO issues on `paddock-tracker.com/` after PR #49 deploy ("Live URL" tab).

**Still pending external:** GSC `metadata.verification` field in `app/layout.tsx` — 5-min add once DNS TXT lands externally.

**Audit items already covered by Track A — crossed off:**
- A4b shipped ISR on content routes (audit cheap-win 7).
- A4a shipped security headers (audit Pillar 1 partial).
- A5 shipped Wikipedia removal from History/Rules tabs for F1 (audit medium-lift 14 option (a) — F1 done; other 14 series + all Rules tabs are in B-content).

**Won't ever do (from playbook guardrails):** AMP (5 docs), Web Stories (3 docs, AMP-only), Carousel schema with closed inner-types, query-string locale variants, fake `lastmod`, JS-injected JSON-LD, `host:` in robots.txt, age gates blocking Googlebot.

### Parked: content workstream

F1 history shipped as the worked example of the per-series literacy-tab template. Workflow + sources documented in `docs/content-authoring/README.md` + `SOURCES.md` + `drafts/f1-history.md`. **All other content pages remain to be done.** Resume after Track B is largely landed:

- MotoGP, WEC, and the other 12 series History tabs (template + workflow are ready; each follows the F1 pattern).
- All 15 Rules tabs (`content/series/<slug>/rules.md` slot wired in `RulesTab.tsx`).
- `content/series/*/drivers.json` fill for all 15 series — currently absent, blocks `/drivers/[slug]` and `/teams/[slug]` (both 404 today; ~400 indexable URLs once filled).
- Driver / team page planning + content (shape, data sources, schema markup).
- 3+ blog posts under `content/posts/` to make `/blog` a real surface (currently empty state).

### Other pinned items carried over from the marathon close

- **AdSense approval still in progress.** Status was "Getting ready / Review requested" at the Mon/Tue close. When the AdSense console "Messages shown" counter goes 0 → ≥1, the CMP banner is live in production. If approval lands and the banner still doesn't fire, fallback is to reintroduce a custom in-app banner (git history under `feat/legal-pages` has the full `CookieBanner.tsx` from before 0.10.18).
- **Speed Insights US-perf investigation.** Skipped from the Mon/Tue plan. Dashboard at `https://vercel.com/<org>/motorsport/speed-insights` filtered by North America. Earlier suspicion: no US function region, `force-dynamic` everywhere, third-party fetch overhead. Note: `/`, `/calendar`, `/blog` are now ISR (post-A4b) — re-investigate against the new baseline. Standalone session when bandwidth allows.
- **Fotis sit-down on `docs/research/supabase-schema-draft.md`.** Was originally tonight's plan. May be in progress / done by next session — verify state before planning Track C work.

### Champions data is now complete end-to-end across all 15 series:

| Series | Driver coverage | Constructor coverage | Other sections |
|---|---|---|---|
| F1 | 1950–2025 | 1958–2025 | — |
| MotoGP | 1949–2025 | 1949–2025 (Manufacturers') | — |
| WSBK | 1988–2025 | 1988–2025 (Manufacturers') | — |
| WEC | 2012–2025 (no 2018) | 2012–2025 (Manufacturers') | — |
| IMSA | 2014–2025 (top class) | 2014–2025 (Manufacturers') | — |
| DTM | 1984–96 + 2000–25 | 1991–96 + 2000–25 (Manufacturers') | — |
| GTWC | 2014–2025 (Overall) | — | Endurance Cup 2014–2025 (3rd section) |
| F2 | 2005–2025 (GP2+F2) | 2005–2025 (Teams') | — |
| F3 | 2010–2025 (GP3+F3) | 2010–2025 (Teams') | — |
| ADAC | (Past Winners — singleEvent) | — | — |

No outstanding champions tasks. The 2-section / 3-section layout in `ChampionsTab` is the live shape.

## ⚓ Stale section retained for history — Sunday 2026-05-17 plan

**Priority 1 — Open PR #3 first thing.** Two commits are stuck on branch `feat/postponement-rendering-motogp-wec` and not yet on main. PR #2 was merged before these landed:

- `141de18` — `0.9.10` full-season session-time curation (15 new `sessions.json` files across all 14 series + ADAC 24h)
- `2778037` — `0.9.11` template-projected empty rounds (62 new override blocks across F1/F2/F3/MotoGP/WEC/DTM/GTWCE)
- `e94c13c` — `docs(schedule)` Saturday outcomes + Sunday plan (lighter, rides along)

Quick command:
```bash
gh pr create --base main --head feat/postponement-rendering-motogp-wec \
  --title "feat(series): full-season session times + template-projected empty rounds (0.9.10 + 0.9.11)"
```

Once merged, paddock-tracker.com auto-deploys real session times across all 15 series within ~90s. Then browser-verify with MotoGP Catalunya R6 (this weekend's race), IndyCar Indy 500 (May 24), F1 Canada (May 22-24), IMSA Detroit (May 29-30), WEC Le Mans (Jun 13-14).

**Priority 2 — Task #4 weather + news audit.** Never started on Saturday. For each of 15 series, click into the next upcoming weekend, confirm Open-Meteo weather block renders (venue-local date per `feedback-paddock-weather-venue-local`) and news feed populates. Output: list of gaps + curation pass for any series missing wiring.

**Priority 3 — Task #2 Supabase schema DDL draft.** Saturday produced the research (`docs/research/db-best-practices.md`) but not the actual DDL doc. Write `docs/research/supabase-schema-draft.md`: tables, columns, types, FKs, status lookup table, audit log, provenance columns (`source_id`/`fetched_at`/`verified_at`/`manual_override`/`content_hash`), time model (local + IANA tz + computed UTC instant). Ready for Tuesday Fotis sit-down.

**Pre-Fotis cutoff still active** ([[project-paddock-pre-fotis-cutoff]]): Mon/Tue 2026-05-18/19 is the deadline for the open-items push. New ideas → IDEAS.md Inbox only.

### Known data flags surfaced during Saturday curation (not yet fixed)

- **F1 Azerbaijan `rounds.json` `endDate: 2026-09-27`** but actual race is **Saturday Sep 26** (avoids Azerbaijan Remembrance Day). The PR #3 sessions.json correctly uses `matchDate: 2026-09-26` but rounds.json should be patched for consistency.
- **Miami F1 + F2 race times** in sessions.json reflect as-RUN (weather move) not as-scheduled. Acceptable.
- **DTM Norisring R4** intentionally TBC — its unique split-qualifying format (QF1A → Race 1; QF2B → Race 2) means session titles would be wrong with template times. Curate when ADAC publishes 2026 schedule (~3-4 weeks pre-event).
- **WRC stage detail** for Sweden, Safari Kenya, Japan, Greece, Estonia, Paraguay, Chile, Italy Sardegna, Saudi Arabia — official itineraries publish 4-6 weeks pre-rally.
- **GTWCE late-event detail, NASCAR + IndyCar mid-season practice/qualifying** — sources publish race-week, not annually. Stay TBC until then.

### Honest task state at end of Saturday

- ✅ #1 Per-series source audit (14 series) — done
- 🟡 #2 Apply DB practices → draft schema for our case — **research done, DDL doc skipped**, priority for Sunday
- 🟡 #3 Make every series calendar factually accurate — **work done locally on branch, awaiting PR #3 to reach main**; residual rounds intentionally TBC per above
- ⏳ #4 Wire weather + news into every round — **never started**, priority for Sunday
- ✅ #5 Research DB best practices — done (`docs/research/db-best-practices.md`)
- ✅ #6 Fix phantom Sat/Sun 03:00 — done (`0.9.9`)
- ✅ #7 Full-season session-time curation — done locally, awaiting PR #3
- ✅ #8 Template-projection fill for empty rounds — done locally, awaiting PR #3

---

## What shipped Saturday 2026-05-16 (massive session — 4 versions live + 2 versions stuck on branch)

**Morning (pre-cutoff sessions):**

- **`0.9.5`** (`110a378`) — `docs: triage + port handoff to docs/HANDOFF.md`. Created this file from per-user memory; memory file is now a redirect stub. IDEAS.md triaged.
- **`0.9.6`** (`a581bfa`) — `docs(0.9.6): handoff appendix — flat 60-item open-items inventory`. Added the appendix at the bottom of this file.
- **`0.9.7`** (`fa75ca3`) — `docs(0.9.7): per-prompt active-time tracking`. `[+Nm]` prefix protocol documented in `CLAUDE.md` Time tracking section + memory rule `feedback-paddock-time-tracking`.

**Afternoon + evening (the big Saturday push — pre-Fotis cutoff scoped):**

- **`0.9.8`** — PR #1 merged at `cd169b6`. **F1 cancellation render.** `content/series/f1/rounds.json` gains a `cancelledRounds[]` field; Bahrain (R4) + Saudi Arabian GP (R5) restored as cancelled entries with `originalRound`/`name`/`originalStartDate`/`originalEndDate`/`reason`/`rescheduleStatus`. New `components/CancelledRounds.tsx` exports `CancelledRoundsBanner` (compact strip near `/series/f1` page header) and `CancelledRoundsSection` (detailed cards at bottom of Calendar tab). URL stability preserved — `/series/f1/weekend/5` is still Canada, not shifted to Saudi. `SeriesRoundEntry` extended with `previousStartDate` / `previousEndDate` / `rescheduleNote` for rescheduled rounds.
- **`0.9.9`** — PR #2 merged at `e0d93cf`. **Three coherent layers in one PR.**
  1. **MotoGP `rounds.json`** (22 rounds incl. Qatar Apr→Nov 6-8 postponed, Portugal Nov 13→20-22 cascade, Valencia Nov 20→27-29 cascade). **WEC `rounds.json`** (8 rounds incl. Qatar 1812km Mar→Oct 22-24 postponed, Imola promoted to R1, Prologue moved to Imola Apr 14).
  2. **Postponement rendering UI** — `rescheduled` pill + amber `Rescheduled from <date> · <note>` line in `WeekendBlock` (calendar tab cards) + `WeekendHero` (weekend detail page). Pairs with the cancellation banner from `0.9.8`. `Weekend` type extended with `previousStartDate` / `previousEndDate` / `rescheduleNote`; `lib/rounds.ts` copies these onto matched weekends.
  3. **Midnight-UTC `dateOnly` detection** in `lib/ics.ts`. Many non-F1 ICS feeds (Google Calendar exports, ECAL, scraper-built) emit race weekends as `DTSTART:YYYYMMDDT000000Z` — midnight UTC with a time component — rather than `DTSTART;VALUE=DATE`. The `0.9.1` `dateOnly` fix only caught the explicit `VALUE=DATE` form. In Europe/Athens (UTC+3 in summer) midnight UTC rendered as "Sat 03:00" — gave the impression races started at 3 am. Parser now treats entries with both start + end at UTC midnight boundaries as effectively date-only → renders "TBC" honestly. 2 new test cases in `lib/ics.test.ts`. **Non-F1 ICS feeds now render TBC honestly across the site.**

**Stuck on branch `feat/postponement-rendering-motogp-wec` — needs PR #3 Sunday:**

- **`0.9.10`** (commit `141de18`) — **Full-season session-time curation across all 14 series + ADAC 24h.** Five parallel research agents produced 15 new `content/series/<slug>/sessions.json` files with venue-local→UTC datetimes for every published 2026 session. Sources cited inline in agent outputs (motogp.com, formula1.com, fiawec.com, worldsbk.com, imsa.com, indycar.com, jayski.com, fiaformulae.com, wrc.com, dtm.com, nuerburgring-langstrecken-serie.de, 24h-rennen.de + Wikipedia + motorsport.com cross-references). Coverage at commit time: F1 14 rounds; F2 4; F3 2; MotoGP 19; WSBK 12; WEC 9 matchDate blocks; IMSA 11; GTWCE 7; IndyCar ~12; NASCAR 36 + Clash + Duels + All-Star; ADAC 24h complete; FE 17; WRC Monte Carlo + Croatia + Portugal + Finland full per-stage; DTM 1; NLS all 10.
- **`0.9.11`** (commit `2778037`) — **Template-projected empty rounds** for series with rigid weekend formats (~95% confidence). F1 +8 rounds (Britain/Netherlands/Azerbaijan/Singapore/USA/Brazil/Qatar/Abu Dhabi); F2 +10; F3 +7; MotoGP +3 (post-postponement cascade); WEC +14 matchDate blocks (R4-R8); DTM +6 (R2-R8, R4 Norisring intentionally empty); GTWCE +14 blocks (R3/R6/R7/R9/R10). F1 R9 Britain now renders Fri/Sat/Sun real session times instead of TBC.

**Research docs shipped this session (live on main via PR #2):**

- `docs/research/db-best-practices.md` — Postgres/Supabase schema patterns synthesizing 30+ sources. Status lookup table vs ENUM, time model (local + IANA tz + computed UTC instant with CHECK), source provenance columns, audit log shape with `material` flag, RLS recommendations, anti-patterns. Sets up Tuesday Fotis sit-down.
- `docs/research/per-series-source-audit.md` — Source-by-source audit of all 14 series + ADAC 24h. Identifies **Jolpica F1 API** (`api.jolpi.ca/ergast/f1/`) + **Pulselive MotoGP/WSBK** (`api.motogp.pulselive.com/motogp/v1`) as the two free JSON-API upgrades to replace current ICS scraping. Everything else stays HTML scrape or curation. Includes 2026 cancellation/postponement summary across all series.
- `docs/research/ingestion-resource-evaluation.md` — 5-link RapidAPI evaluation. Verdicts: **skip Sportbex** (betting odds only), **adopt TheSportsDB as fallback** for niche series, **borrow `maxgubler/indycar-calendar` playbook heavily** (API-key harvest from SPA HTML, diff-before-write, cancellation handling), skip `armagantrs/race-calendar` (born-dead scaffold).

**RapidAPI probing (not in shipped docs, mid-session investigation):**

- **AllSportsApi v2** (`allsportsapi2.p.rapidapi.com`) — Sofascore-clone, **does cover motorsport** with 13 categories: F1 (uniqueStage 40), MotoGP (17), Moto2 (15), Moto3 (16), WSBK (28), Formula E (68), WRC/Rally (36), IndyCar (67), NASCAR (Sprint Cup 18 / Camping World 82 / Xfinity 81), DTM (10), Indy Lights, Bikes, International. Working endpoints: `/api/motorsport/categories`, `/api/motorsport/stage/scheduled/{date}`, `/api/motorsport/unique-stage/{id}/season`, `/api/motorsport/stage/{stageId}/substages`, `/api/motorsport/category/{id}/stages/all`. Schema integration **deferred** — promising lead for the future automated refresh cron once Supabase lands. OpenAPI spec at `github.com/lacassef/recodexapicodeexamples/blob/master/allsportsapi/openapi/motorsport_openapi.yaml`.

**Memory state at session end:**

- `project-paddock-pre-fotis-cutoff` — active, expires 2026-05-19 after Fotis sit-down
- `feedback-paddock-time-tracking` — `[+Nm]` prefix protocol (added `0.9.7`)
- All other feedback rules unchanged.

**Saturday commit count:** 4 merged to main (`f7f2aaa`, `cd169b6` merge, `a56c467`, `e0d93cf` merge) + 3 stuck on branch (`141de18`, `2778037`, `e94c13c`).

## How to use this file

- **Session start:** read this file first (after CLAUDE.md). Then `IDEAS.md` (Now / Next) and `SCHEDULE.md` (today's plan).
- **Mid-session:** don't edit. Use `IDEAS.md` Inbox for new ideas, `TaskList` for in-flight work.
- **Session end:** update the "what shipped last session" block + infra ledger. Bump the timestamp if you make non-trivial changes. Trim "loose items" or move them to `IDEAS.md` Inbox as they accumulate.
- **Never:** duplicate state across `IDEAS.md` and this file. IDEAS.md is the *queue*; this file is the *snapshot of where the project is now*.

---

## Appendix — flat open-items inventory (snapshot 2026-05-16)

Single flat enumeration of every open item known at the close of `0.9.5`. The sections above (Sessions roadmap / Loose items / Open design questions / Infra ledger) reorganise the same substance by lifecycle. The flat list exists so a contributor can scan the whole pile in one pass without jumping between sections.

Items marked **DONE** were shipped during the 2026-05-16 session and remain here for traceability — they will be pruned when the appendix is next refreshed.

1. Migrate sessions, standings, results, news, weather, drivers, and teams to a Supabase-backed data layer with scheduled scrapes per series.
2. Research existing public motorsport data sources (Ergast/jolpica for F1, MotoGP web API, FIA feeds, third-party aggregators) before building scrapers from scratch.
3. Curate `sessions.json` with real session hours for every non-F1 series (MotoGP, WEC, F2, F3, IndyCar, IMSA, WSBK, WRC, DTM, GT World, NASCAR Cup, NLS, ADAC Ravenol 24h).
4. Curate `rounds.json` per non-F1 series so FIA-canonical round numbers replace the array-index fallback.
5. Research and document live in-race data sources (sector times, leaderboard, gaps, tyre choices) for F1, MotoGP, WEC, FE, IndyCar.
6. Reverse-engineer fiaformulae.com, motogp.com, nascar.com XHR endpoints to see if unsigned JSON can substitute Playwright scraping.
7. Decide between Vercel Sandbox/Playwright, third-party aggregator, and curation-first for JS-rendered official sites.
8. Replace the planned KV data-watch framework with Supabase-backed watchers that drive an admin push channel and a Claude-curation queue.
9. Add `app/sitemap.ts`, `app/robots.ts`, JSON-LD (`SportsEvent`, `Organization`, `Person`, `BreadcrumbList`), per-page `generateMetadata`, OG image generators, and canonical URLs.
10. Implement a fan-intent keyword strategy across series, weekend, driver, and team pages (schedule, programme, where to watch, live stream, timetable).
11. Enrich `/drivers/[slug]` with Wikipedia bio, current standings position, last 5 results, and news mentions.
12. Enrich `/teams/[slug]` with the same shape.
13. Redesign F1 History tab or replace with curated `content/series/f1/history.md`.
14. Improve Rules tab with an FIA PDF link and a "common topics" surface.
15. Implement `lib/results/<slug>.ts` and `lib/standings/<slug>.ts` for MotoGP, WEC, IndyCar, NASCAR.
16. Audit endurance-series weekend grouping (WEC, IMSA, NLS, ADAC 24h, multi-day tests) for `groupByWeekend` mis-splits.
17. Add a custom `app/error.tsx` page.
18. Integrate Sentry for error monitoring.
19. Add `/api/cron/health` that summarises last-run timestamps for every cron job.
20. Run a Lighthouse and Speed Insights perf audit and act on findings.
21. Fix the nine legacy ESLint errors and add a husky pre-commit hook.
22. Add component tests with vitest + Testing Library.
23. Add Playwright E2E tests that run on Vercel preview deploys.
24. Build a comments thread (Clerk-gated) on race-weekend pages.
25. Build predictions with an open → locked-at-session-start → resolved-after-race state machine.
26. Build paddock-coins ledger and leaderboard.
27. Write a public README with screenshots and a Mermaid architecture diagram.
28. Write the first 2–3 MDX blog posts.
29. Persist active news-filter chip across page reloads.
30. Run a mobile-first UI/UX audit using the `tailwindcss-mobile-first` patterns.
31. Run a WCAG 2.2 AA accessibility audit and fix gaps.
32. Polish motion, focus states, and dark-mode contrast across the site.
33. Do another "Claude design" depth pass for background warmth and global theming.
34. Run user research via a site survey, conversations with fans, and subreddit pain-point mining.
35. Add per-event-type push notifications (qualifying topper via RSS filter, race winner, championship-deciding event).
36. Make the push click handler deep-link to a specific session or article instead of always opening `/`.
37. Build a Settings "Your devices" list with per-device test and remove buttons.
38. Send hero images in `payload.image`, sourced from curated circuit JPEGs or motorsport.com thumbnails.
39. Investigate per-series Champions JSON to fix the fragile parser (F1 wrong points column, F3 all zero, MotoGP brittle redirects).
40. Delete unused `lib/onboarding.ts` (only wizard-reopen consumer).
41. DRY the duplicated logic between `EnableNotifications` and `OnboardingWizard`.
42. Retheme the Clerk sign-in and sign-up pages to Paddock dark.
43. Add a `WeekendMedia` section to `/series/<slug>/weekend/<round>` fed by `content/series/<slug>/media.json` (YouTube highlight reels, blog cross-links, onboard clips).
44. Choose an embedded-video provider (YouTube iframe vs Mux vs Cloudflare Stream).
45. Add a Tracks/Circuits view per series with a map.
46. Make the home hero show the next 2–3 sessions when all are imminent.
47. Make session cards tap-to-expand to broadcast info, streaming, and track details.
48. Add a per-driver season-trend chart to `/drivers/[slug]`.
49. Add era markers and sparklines to the Champions tab.
50. Fold `overview.md` content fully into the F1 About tab.
51. Surface "common topics" on the Rules tab.
52. Install Resend Marketplace and wire `RESEND_API_KEY` + `CONTACT_TO_EMAIL` so contact-form submissions email out.
53. Rotate `sk_live_*` Clerk keys.
54. **DONE (`0.9.2` + `0.9.3`)** — Bootstrap a real `CLAUDE.md` operating manual.
55. **DONE (`0.9.2`)** — Scaffold `IDEAS.md` with Inbox / Now / Next / Parked / Killed sections seeded from this list.
56. **DONE (`0.9.3`)** — Encode the time-plan-at-start, capture-mid-session, triage-at-end workflow in `CLAUDE.md` as a best practice.
57. Investigate residual `00:00` string on `/series/f1/weekend/5` to confirm it is a legit time or remove a stale fake.
58. Visually verify the Canada round-5 page and FE Monaco weekend in a real browser (Playwright was locked during the 0.9.1 verification pass).
59. **DONE (`0.9.1`)** — Commit the bundled PR (3 am fix + sessions.json overrides + rounds.json infra + FE Monaco curation + F1 rounds curation + tests).
60. **DONE (`0.9.5`)** — Update the handoff with the Supabase initiative reframing S4 and the live-race-data ambition.
