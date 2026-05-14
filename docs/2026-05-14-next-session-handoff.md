# Paddock — handoff for the next session

> Paste this verbatim into the next Claude session as the kickoff prompt.
> Last updated: 2026-05-14 after shipping v0.7.0 (`99a058b`).

---

## 0. Quick context

- **Repo:** `paris-paraskevas/motorsport` (this working directory).
- **Branch:** `main`. Vercel auto-deploys on push.
- **Deploy URL:** https://motorsport-pi.vercel.app
- **Stack:**
  - Next.js 16 (App Router) — **note: middleware is now `proxy.ts` in v16, not `middleware.ts`**.
  - React 19, Tailwind v4, Geist font.
  - `@serwist/next` service worker (PWA).
  - Clerk for auth (Vercel Marketplace integration, **currently dev instance**).
  - Vercel KV (Upstash Redis) for prefs + push subs + dedup.
  - `@vercel/kv`, `web-push`, `node-ical`, `cheerio`, `fast-xml-parser`, `remark`, `@clerk/nextjs`.
  - GitHub Actions for cron (Vercel Hobby plan only allows daily schedules).
- **Current version:** `0.7.0` (see `CHANGELOG.md` for what landed when).

## 1. Critical config landmines — do not break these

1. **`next.config.ts` keeps BOTH `serverExternalPackages: ["node-ical"]` AND `outputFileTracingIncludes` for node-ical's transitive deps.** Removing either either fails the build (BigInt) or 500s every page at runtime (MODULE_NOT_FOUND: temporal-polyfill). Saved in user-memory `feedback-vercel-node-ical`.
2. **KV env vars must be unprefixed** (`KV_REST_API_URL`, `KV_REST_API_TOKEN`). The Upstash integration installer offers a "STORAGE" custom prefix — do not use it. `@vercel/kv` reads the unprefixed names by default and won't auto-pick a prefix.
3. **Clerk env vars must keep `NEXT_PUBLIC_` as the leading prefix** of the publishable key. If you let the Marketplace add "AUTHENTICATION" or any other prefix, the publishable key won't be exposed to the client.
4. **`proxy.ts` not `middleware.ts`** — Next 16 renamed the file convention. The clerkMiddleware function itself is unchanged.
5. **Anything you run as a cron must accept missing `CRON_SECRET`** as "allow" (single-user, low risk) OR require `Authorization: Bearer $CRON_SECRET` if it's set. Pattern is in `app/api/cron/notify/route.ts`.

## 2. What we shipped this session (0.2.0 → 0.7.0)

In rough order:

- **0.2.0** — Calendar uncapped, hero card respects followed series, venue-only location, `/changelog` + footer version, GDPR cookie banner, first-visit onboarding wizard.
- **0.3.0** — Mobile fixes (sticky header now `fixed`, card title overflow), home tabs (News / Upcoming), KV-aware notification state, `/api/push/status`.
- **0.4.0** — Clerk auth wired up, KV-backed followed-series for signed-in users (with one-time localStorage→KV migration), user-aware push subs, daily news cron `/api/cron/news`, GitHub Actions workflow.
- **0.5.0** — **Forced sign-in** (all routes protected via `proxy.ts` `auth.protect()` except sign-in/sign-up, PWA assets, `/api/cron/*`, `/api/push/status`, `/api/contact`, `manifest.json`, opengraph-image). UserButton in header (avatar + "Preferences" menu item that opens to a custom UserProfile page embedding `SettingsClient`). `/api/push/inspect` + user-scoped `/api/push/test`.
- **0.6.0** — Custom 404, layered warm/cool background with grain, notification preferences (sessions/news/raceWeek), `/api/cron/race-week` (Mon 8 UTC). Backfill logic in `/api/user/onboarded` so existing accounts don't see the wizard.
- **0.7.0** — Drivers tab scraper fix (skip "No." columns, filter numeric "names"), Wikipedia TOC stripping, mobile-scrollable Wikipedia tables with dark-themed cell styling, Champions table mobile-stacks constructor under driver, PWA install prompt (Android Chrome / iOS Safari / iOS non-Safari variants).

Auto-memory entries the next session will see:
- `feedback-vercel-node-ical` — keep both `serverExternalPackages` + `outputFileTracingIncludes`.
- `project-paddock` — repo overview.

## 3. Things raised in this session that are NOT yet done

### Notifications
- **Qualifying-topper push** — user explicitly asked for it ("when someone tops the qualifying charts I wanna know it"). Not implemented because there's no live timing data source ingested. Options: poll motorsport.com RSS for "pole position" stories, scrape series sites (ToS-fragile), or buy a sportradar feed (expensive). **Recommendation:** start with RSS filter as a v1.
- **Session-result push** — "when X wins" type alerts. Same data-source problem as qualifying.
- **Championship-deciding alerts** — tied to standings calculations. Requires standings ingestion beyond F1.

### Data coverage gaps
- **Standings/Results for non-F1 series** are link-outs to official sites. User noted these feel "completely missing." Need real data ingestion for at least MotoGP, WEC, IndyCar, NASCAR. Each has its own data source (some scraped, some via Wikipedia, some paid).
- **Drivers/teams data** — Wikipedia scraping is brittle. For 2026, scraper now correctly rejects bad tables, but the fallback is a link card. Should curate `content/series/*/drivers.md` for popular series.
- **F2/F3/IndyCar/MotoGP session-level feeds** — nixxo URLs dead, no working public alternative. Documented in 0.4.0 CHANGELOG as a known limitation.

### Cleanup / polish
- **EnableNotifications duplicates wizard logic** — reasonably refactored in 0.4.0 to use `/api/push/status`, but could share more with `OnboardingWizard`. Worth another DRY pass.
- **Removed but kept around:** `lib/onboarding.ts` (localStorage version) — only used by the wizard's reopen event now. Could be deleted entirely.
- **`/settings` page** still exists as a fallback URL even though the drawer no longer links to it (it's in the profile menu now). Decide: keep as deep-link target or redirect to the profile modal.

### Infra
- **Clerk is in dev mode.** Marketplace installs a dev instance by default. Promotion plan:
  1. Clerk dashboard → switch to Production instance
  2. Configure allowed domain (whatever final domain we land on)
  3. Replace env vars in Vercel with production keys
  4. Redeploy
- **`CRON_SECRET` is not set** — current state is "allow all" on cron endpoints. For prod, generate one, set in both Vercel env and GitHub repo secrets.
- **Contact form email delivery** — currently stores submissions in KV (`paddock:contact:*`), only emails via Resend if `RESEND_API_KEY` + `CONTACT_TO_EMAIL` are set. Resend isn't installed yet; install via Marketplace if email delivery matters.
- **VAPID env vars** are already set. **KV is connected** (Upstash). **Push works** end-to-end on properly-installed PWAs.

### Design / UX
- **Sign-in/sign-up pages** use Clerk default components with a partial dark theme. Could match Paddock styling more tightly.
- **Background depth** improved in 0.6.0 but the user said "Claude design" — Claude.ai has more warmth and texture than our current dark theme. Worth another pass.

## 4. The "LinkedIn-grade" audit — explicit list

User said: _"this needs to be a robust web page... something I'm proud to put on LinkedIn."_ Treat this as the **definition of done** for v1.0.

| Area | Today | v1.0 target |
|------|-------|-------------|
| Live standings/results | F1 only via jolpica | At least F1 + MotoGP + IndyCar + WEC with real data |
| Drivers/teams | Wiki scrape (brittle) | Curated `drivers.md` per series, refreshed each season |
| Notifications | Sessions + news + race-week | + qualifying topper, + race winner, + championship-deciding |
| Push reliability | Subscribe + cron working | Server-side delivery monitoring + retry, per-device diagnostics page |
| Auth | Clerk dev | Clerk production instance with custom domain |
| Performance | Unmeasured | Lighthouse > 90 across all pages, CWV in green |
| Accessibility | Decent (semantic markup, contrast) | WCAG 2.2 AA audit pass, keyboard nav verified, prefers-reduced-motion respected |
| Analytics | None | Vercel Analytics + Speed Insights enabled |
| Testing | Single vitest file in `lib/` | Component tests (vitest + @testing-library), API route tests, E2E with Playwright on preview deployments |
| SEO | OG image + meta on layout | Sitemap, robots.txt, structured data (Event schema for sessions, Person for drivers, SportsEvent for races), per-page metadata |
| Domain | Vercel preview domain | Custom domain (see §6) |
| README | Empty / minimal | Public showcase README with screenshots, architecture diagram, deployment instructions |
| Error handling | Default Next error boundaries | Custom error.tsx with theme, useful messages, error tracking (Sentry?) |
| Monitoring | None | Sentry for errors, Vercel Speed Insights for performance, optional uptime check on cron health |
| Code quality | Typecheck clean, 9 pre-existing lint errors | Zero lint errors, stricter ESLint config, prettier, husky pre-commit |

## 5. Content / motorsport.com ambition

User raised: _"we might even be able to turn this into a site like motorsport.com, I could maybe even write the articles. Or see if it's legal to show them in my site if they're from other people I give credit to."_

### Legal reality for republished content
- **RSS summaries (title + ~200 char description + link back)** is fair-use-adjacent and standard practice (Google News, Feedly, Inoreader, NewsBlur all do it). Currently fine.
- **Full-article republication** — different beast. Requires a license. Reuters, AP, motorsport.com, Autosport all charge for syndication. Don't copy full articles without a deal.
- **Embedding (iframe/AMP)** — generally legal if the source allows it. motorsport.com does NOT publish an embed widget AFAIK.
- **Original content (user-written articles)** — fully fine. Hosting your own thoughts/analysis/race recaps is the cleanest path.

### Suggested editorial direction
Don't try to compete with motorsport.com on news velocity. Compete on:

1. **Personal angle / opinion / analysis** — paddock-paris.com-style "here's what mattered about this weekend" with your voice. Sustainable, distinctive, no legal risk.
2. **Aggregation done well** — Paddock already does this; lean into it. The Latest News tab already aggregates 14 RSS feeds. Add:
   - "This weekend at a glance" auto-generated card
   - Cross-series weekend summary (one source of truth for all motorsport)
   - Filtering / muting per source
3. **Data journalism / charts** — championship trajectory graphs, head-to-head stats, "what would happen if X retires for the rest of season" simulations. Differentiated, uses data we already have.
4. **Long-form posts you write** — `/blog/[slug]` with MDX, you author in repo, ship via PR.

### What to scaffold in code
- `content/posts/*.mdx` + a `/blog` index + `/blog/[slug]` page rendering MDX.
- `next-mdx-remote` or `@next/mdx` for MDX support.
- A simple "Article" type with frontmatter (title, summary, hero image, tags, publishedAt).
- RSS feed at `/feed.xml` for the blog.
- Tags pages: `/blog/tag/[tag]`.

## 6. Domain + SEO — user explicitly asked

### Domain
- Buy via **Namecheap** or **Cloudflare Registrar** (at-cost pricing, no upsells). Avoid GoDaddy.
- Suggested candidates (verify availability):
  - `paddock.app`
  - `paddockhq.com`
  - `racingpaddock.com`
  - `seasonpaddock.com`
  - `pitwall.app` / `pitwall.io`
- Once bought:
  1. Vercel project → Settings → Domains → add the domain.
  2. Cloudflare/Namecheap → DNS → add the records Vercel shows (typically a CNAME for www + an A or ALIAS for apex).
  3. Vercel handles TLS automatically.
  4. Update `SITE_URL` in `app/layout.tsx` to the new domain (currently hardcoded to `motorsport-pi.vercel.app`).
  5. Update Clerk production instance allowed domains.
  6. Update `CONTACT_TO_EMAIL` if you want hosting-based forwarding.
  7. Update the cron workflows that hardcode the URL.

### SEO baseline (do this even before custom domain)
- **`app/sitemap.ts`** — generate sitemap of `/`, `/calendar`, `/changelog`, `/about`, `/series/*`. Next.js native support via the file convention.
- **`app/robots.ts`** — currently using meta robots noindex (Clerk-protected). Decide: keep noindex for auth-gated pages, allow indexing for `/about`, `/changelog`, and any blog posts.
- **Structured data (JSON-LD)**:
  - `SportsEvent` schema for each session in `/series/[slug]`
  - `Organization` schema for each series
  - `BreadcrumbList` schema on detail pages
- **Per-page metadata** — currently the layout sets one title/description for everything. Each `series/[slug]/page.tsx` and content page should export `generateMetadata` with specific title/description/OG image.
- **OG image generator** — `app/series/[slug]/opengraph-image.tsx` rendering a series-specific OG image with name + color.
- **Canonical URLs** — Next handles via metadataBase + alternates.canonical.

### SEO tension with forced sign-in
Right now `proxy.ts` gates everything except sign-in/sign-up/PWA assets. Search engines can't crawl anything. Decisions:
1. **Open `/about`, `/changelog`, blog posts** publicly — add to the public matcher in `proxy.ts`.
2. **Keep `/` and `/calendar` gated** — but consider a public marketing landing at `/welcome` describing the product.
3. **Or flip the model entirely** — make the whole site public, only gate `/settings`, push subscription, and user-prefs APIs. This is what motorsport.com does. Discuss with user before pivoting.

## 7. Suggested order of operations for the next session

1. **Audit checkpoint** (~30 min). Walk the deployment with the user. Capture every gap on screen. Update this doc.
2. **Decide the auth model** — gated app vs. public-with-account. SEO depends on this. Don't ship more SEO work before this is settled.
3. **Domain.** Buy + wire up. Low effort, unblocks Clerk production promotion and proper OG/SEO.
4. **Clerk → production instance.**
5. **SEO baseline** (sitemap, robots, structured data, per-page metadata, OG generators).
6. **Performance audit** — Lighthouse + Speed Insights. Fix anything below 90.
7. **Accessibility audit** — keyboard nav, screen reader, contrast, motion.
8. **Standings/results for top 4 non-F1 series** — pick the highest-value sources and ingest.
9. **Notification expansion** — qualifying topper via RSS filter as v1.
10. **Blog scaffolding** — MDX, `/blog`, `/feed.xml`.
11. **Testing infrastructure** — vitest config for components, Playwright E2E on preview deploys.
12. **Public showcase README + architecture diagram.**
13. **Sentry or equivalent error tracking.**

## 8. Smaller polish items (parking lot)

- Series page: tabs to add — Teams (separate from Drivers), Standings (already exists, expand), Tracks/Circuits with map.
- Hero card on home — consider showing the next 2-3 sessions instead of just one when they're all imminent.
- Session card: tap to expand → broadcast info / streaming links / track details.
- Push notification click handler → deep-link to the relevant session page instead of just `/`.
- Cron observability — a `/api/cron/health` endpoint summarizing last-run timestamps for each cron.
- Settings: "Your devices" section listing subscribed push endpoints with per-device test + remove buttons.

## 9. What to ask the user at the start of the next session

1. **"Audit run-through on the deployed site, or jump into the highest-priority item?"** — let them choose.
2. **"Auth model: stay gated or flip to public-with-account?"** — critical decision blocking SEO + content strategy.
3. **"Custom domain — bought yet? Or want help picking one?"**
4. **"Blog content path: write in repo as MDX, or use a headless CMS (Sanity/Contentful)?"** — affects content workflow.
5. **"Sentry budget tolerance?"** — free tier is enough until ~5K errors/month.

---

End of handoff. Good luck.
