# Changelog

All notable changes to Paddock are recorded here. Newest first. This file is the **engineering log** — detailed enough for a future contributor to retrace decisions. Public-facing release notes live in `RELEASES.md` and render at `/changelog`.

## 0.10.28 — 2026-05-19

### Added
- **F1 History tab now renders curated content** from `content/series/f1/history.md` instead of dumping Wikipedia article HTML via `dangerouslySetInnerHTML`. The new content is a ~545-word three-section piece (Origin / Turning points / Today's shape) cited against Tier-0 / Tier-1 / Tier-3 / Tier-4 sources (15 footnotes: Formula1.com, FIA archives, Doug Nye's *Autocourse History of the Grand Prix Car*, 8W/Forix "Defining moments," Motor Sport Magazine, Autosport, The Race, Joe Saward, StatsF1). Renders an "Authored by Paris Paraskevas. Last updated 19 May 2026." byline at the bottom of the tab, sourced from the markdown frontmatter.
- **`docs/content-authoring/`** infrastructure for prose-content authoring across the per-series literacy tabs:
  - `README.md` — the canonical drafting protocol + 12 article-authoring principles (Wikipedia MoS, Nielsen Norman Group, GOV.UK content design, WCAG 2.2 §3.1.5).
  - `SOURCES.md` — 31-source tiered list (Tier 0 print canon / Tier 1 governing / Tier 2 specialist journalism / Tier 3 statistical / Tier 4 specialist deep history / Tier 5 community / Tier 6 video).
  - `drafts/f1-history.md` — the working draft + iteration log (drafts 1 → 4) + long-form decade-by-decade alternate (~1000 w) preserved for future driver / team / season-recap pages.
- **`loadMarkdownWithFrontmatter`** function in `lib/content.ts` — returns `{ html, frontmatter }` for any markdown file. Used by `HistoryTab` / `RulesTab` to read the `author` and `last-updated` frontmatter fields for the byline. `loadMarkdownAsHtml` is preserved unchanged for backwards compatibility with the legal pages and `/changelog`.

### Changed
- **`components/tabs/HistoryTab.tsx`** rewritten as a markdown-content renderer. Reads `content/series/<slug>/history.md`; falls back to `PlaceholderTab` when the file is missing or empty. All 14 series other than F1 currently show the placeholder.
- **`components/tabs/RulesTab.tsx`** rewritten on the same pattern. Reads `content/series/<slug>/rules.md`; falls back to `PlaceholderTab` (all 15 series, until Rules content lands). The "Further reading" external-sources card (official site + standings URL) is preserved and renders independently of the markdown content.

### Removed
- **`lib/wikipedia-article.ts`** — the `fetchWikipediaSection(page, headings)` helper is dead code after the `HistoryTab` and `RulesTab` refactors. Closes the four problems the Wikipedia-dump pattern caused on those tabs: CC BY-SA licence-attribution drift, duplicate-content SEO drag, outbound-link authority leakage to en.wikipedia.org, and the Wikimedia image hot-link policy violation.
- The `Wikipedia` source badge in the tab footer is also gone — the new tabs cite their sources inline via markdown footnotes.

### Notes
- Closes Track A, PR A5 (the original Wikipedia-content removal item from the post-marathon legal/risk closure track), albeit through a different route than the handoff originally envisioned: the handoff proposed deleting the Wikipedia path + shipping infra + 3 series (F1, MotoGP, WEC) filled. This PR delivers infra + F1 only; MotoGP and WEC come as per-series follow-ups under the same template established here. The other 12 series ship as separate PRs once their content is drafted under the workflow in `docs/content-authoring/README.md`.
- `lib/wikipedia.ts` (general summary fetcher, still used by `AboutTab`), `lib/wikipedia-season.ts` (live driver-lineup scrape until per-series `drivers.json` files exist), and `lib/wikipedia-champions.ts` (still referenced by `ChampionsTab` though champions are curated end-to-end now) are unchanged. They have legitimate consumers and will be retired individually as those consumers transition.
- `series.meta.wikipediaPage` field unchanged — still referenced by `AboutTab`, `ChampionsTab`, and `DriversTab`.
- F1 history content is ~545 words across three H2 sections (Origin / Turning points / Today's shape), with the Turning points block subdivided into H3 (Technical revolutions / Safety reform / Contested championships). Followed all 12 article-authoring principles in `docs/content-authoring/README.md`; the principle-by-principle audit lives in the iteration log in `docs/content-authoring/drafts/f1-history.md`.

## 0.10.27 — 2026-05-19

### Changed
- **`/`, `/calendar`, `/blog` are now ISR-rendered** with a 5-minute revalidate window instead of `force-dynamic`. The build report confirms the conversion — all three now show as `○ Static` with `Revalidate: 5m` in `next build` output, where they were previously dynamic and re-rendered server-side on every request. Vercel will now cache the SSR HTML at the edge for 300 s, serve stale-while-revalidate on cache miss, and trigger a background re-render on next request after expiry. Concrete saving: every request to `/` was previously a fresh `loadAllSeries()` (15 ICS fetches + weather forecasts + news RSS aggregation) — now amortised across 5-minute windows.

### Notes
- Closes Track A, PR A4b of the post-marathon legal/risk closure track — but only partially. The handoff also asked for `/series/[slug]` to be cached. That route reads `searchParams.tab` server-side, which **forces Next.js to keep the route dynamic regardless of any `revalidate` directive**. ISR for `/series/[slug]` is deferred to Track C Phase 2 (path-based tab routing — replacing `?tab=foo` with `/series/[slug]/[tab]`), which is also SEO audit item #18. Once tabs are paths, the same `revalidate = 300` change applies.
- **Personalization safety verified:** `app/page.tsx`, `app/calendar/page.tsx`, `app/blog/page.tsx` do not call server-side `auth()`, `cookies()`, or `headers()`. The auth UI (`<UserButton>` / `<SignInButton>`) lives in `components/HeaderUtils.tsx` which is `'use client'` and hydrates auth state from cookies on the browser. SSR HTML is the same for every visitor, so caching it `public` at the CDN does not leak signed-in state.
- **Race-day staleness tradeoff:** the home and calendar pages filter sessions by `session.end >= now` where `now = new Date()`. With a 5-minute revalidate, that `now` is up to 5 minutes stale. A session that ended in the last 5 minutes will still appear in the "upcoming" list briefly; a session that started in the last 5 minutes will not yet show as "Live now". Acceptable in exchange for the perf+cost win and aligned with how the original audit framed it.
- **The handoff's `next.config.ts headers()` + `proxy.ts` middleware override plan turned out unnecessary.** Empirical investigation showed that `clerkMiddleware()` does **not** rewrite Cache-Control headers — the `private, no-cache, no-store` seen on production `/` was set by Next.js's `force-dynamic` directive itself (verified by comparing routes: force-static / revalidate-set routes get `public, max-age=0, must-revalidate`, force-dynamic gets `private, no-store`). The page-level `revalidate` directive is therefore the right lever, and the middleware acrobatics are not required.

## 0.10.26 — 2026-05-19

### Added
- **Site-wide security headers** via a new `async headers()` block in `next.config.ts`. Applied to every route (`source: "/:path*"`):
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — extends the previous platform default (`max-age=63072000` only) to include subdomain coverage and signal preload-list readiness. Browser-level preloading still requires a separate submission to `hstspreload.org`; this directive is the prerequisite.
  - `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing on script / stylesheet responses.
  - `X-Frame-Options: DENY` — blocks any embedding of paddock-tracker.com in an iframe. Clerk's hosted-component iframe lives on the `clerk.paddock-tracker.com` subdomain (embeds INTO our pages, not out), so this doesn't affect the sign-in flow. The modern equivalent is CSP `frame-ancestors`, deferred to a later CSP PR.
  - `Referrer-Policy: strict-origin-when-cross-origin` — same-origin requests carry the full URL, cross-origin carries only the origin, downgraded requests carry nothing.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()` — denies all four listed sensors / advertising signals. `interest-cohort` is the FLoC opt-out; `browsing-topics` is FLoC's successor (the Topics API).

### Notes
- Closes Track A, PR A4a of the post-marathon legal/risk closure track. **A4b — `Cache-Control` override on content routes** (`/`, `/calendar`, `/series/*`, `/blog`, `/about`, `/changelog` → `public, s-maxage=300, stale-while-revalidate=86400`) — is deferred to its own PR because `clerkMiddleware()` in `proxy.ts` re-sets `Cache-Control: private, no-cache, no-store` on every protected response, overriding anything `next.config.ts headers()` would emit. A4b will need a `proxy.ts` modification to override Clerk's cache header for the content route list, plus its own pre-mortem for stale race-weekend data risk.
- CSP is intentionally not included in this PR — it's a separate workstream (multiple iterations to allow AdSense / GA / Clerk / Funding Choices / Vercel Analytics / Speed Insights all the right `script-src` / `connect-src` / `frame-src` entries without breaking).

## 0.10.25 — 2026-05-19

### Fixed
- **`POST /api/push/unsubscribe` now verifies ownership** before deleting the stored subscription. Previously the route called `deleteSubscription(body.endpoint)` with zero auth check, so any caller in possession of an endpoint string could unsubscribe any browser's push subscription — including signed-in users' subscriptions from a different account. Now: the route reads the caller's Clerk session, fetches the stored subscription via the new `getSubscription(endpoint)` helper, and returns 403 unless `subscription.userId === auth().userId` (both null is the anonymous–anonymous match case, both sides string is the normal signed-in case). If the subscription doesn't exist the route returns 200 (idempotent — already gone, nothing to refuse). Edge case noted in an inline comment: users who subscribed while signed-out and then signed in will get 403 on server-side unsub; they can still unsubscribe browser-side via `pushManager.unsubscribe()` and the next push send prunes the stale entry via the 404/410 cleanup path in `lib/push.ts`.
- **`POST /api/contact` now stores submissions with a 12-month TTL** (`{ ex: 60 * 60 * 24 * 365 }`) to match the retention table in `/privacy`. Previously `kv.set(key, record)` was unbounded — submissions accumulated indefinitely while the privacy policy promised 12 months. Both a compliance drift and an unbounded-KV-growth risk in one line.

### Added
- **`lib/push-store.ts`** — new `getSubscription(endpoint)` (lookup by `endpointHash` key) + `isSubscriptionOwner(sub, callerId)` pure helper for ownership comparison. The ownership predicate is split out so it can be unit-tested without mocking Clerk or KV.
- **`lib/push.test.ts`** — six new tests exercising the four ownership outcomes (matched userIds → allow, mismatched userIds → deny, both null → allow, mixed null/string in either direction → deny) plus the missing-subscription case. Test suite now 82 / 82.

### Notes
- Closes Track A, PR A2 + A3 of the post-marathon legal/risk closure track per `docs/HANDOFF.md`. A2 (ownership) and A3 (TTL) were bundled as the handoff suggested — both small fixes, both in `app/api/`, both straightforward audit-driven.

## 0.10.24 — 2026-05-19

### Fixed
- **Postal-address blocks now render as multi-line** on `/imprint`, `/impressum`, and `/privacy` §1. The 0.10.23 PR wrote the address blocks as raw newline-separated lines inside a paragraph; CommonMark treats those as soft breaks (= spaces), so the rendered output collapsed to `Paris Paraskevas Andrea Papandreou 23, Melissokhori 41500 Larissa Greece` on a single inline line. Switched the address lines to use the markdown native hard-break convention (two trailing spaces at end of each line → `<br>` in the rendered HTML) across the two affected files (`content/legal/imprint.md` — Service provider + § 18 Abs. 2 MStV blocks; `content/legal/privacy.md` — §1 controller block). Each block is preceded by an HTML-comment note documenting the convention so a future contributor doesn't strip the trailing spaces by accident.

### Notes
- Initially tried switching the `loadMarkdownAsHtml` pipeline in `lib/content.ts` to `{ sanitize: false }` so raw `<br />` tags would survive — that broke an existing test in `lib/series.test.ts` that depends on HTML comments (the `<!-- TODO: author -->` placeholder pattern) being sanitised away from placeholder series-overview / drivers / significance markdown. Reverted and took the trailing-two-spaces path, which is also the markdown-native answer and keeps the pipeline behaviour identical for the other 12 consumers of `loadMarkdownAsHtml`.
- Caught on production by the operator within minutes of merging 0.10.23. Root cause was a missed browser-verify before requesting the merge — the test suite + lint + typecheck all passed (markdown is not type-checked or linted), so the bug only surfaces in the rendered output. A render-pipeline regression test was considered and rejected as over-engineering for a one-line markdown convention.

## 0.10.23 — 2026-05-19

### Added
- **Imprint page** at `/imprint` (English entry) and `/impressum` (German alias). Both routes render the same source markdown via `loadMarkdownAsHtml` from `content/legal/imprint.md`. Sections: service provider (Paris Paraskevas, Andrea Papandreou 23, Melissokhori, 41500 Larissa, Greece), contact email, VAT-ID stated as "None" (operator is not VAT-registered), § 18 Abs. 2 MStV editorial responsibility block (named operator with the same postal address, covering blog content at `/blog`), § 7–10 DDG liability-for-content language, liability-for-links, copyright, EU ODR platform link. Both routes mirror the existing `app/privacy/page.tsx` shape (`force-static`, `loadMarkdownAsHtml`, same prose typography classes). Linked from `components/Footer.tsx` after the Do Not Sell entry. Closes Track A, PR A1 of the post-marathon legal/risk track.

### Changed
- **`content/legal/privacy.md` §1** — controller block now lists the full postal address (Paris Paraskevas, Andrea Papandreou 23, Melissokhori, 41500 Larissa, Greece) plus contact email, and cross-links the new Imprint page. GDPR Art. 13 requires controller identity + contact details to be available to data subjects; with a publicly-served EU-targeted Site and AdSense loading, the postal address is the load-bearing piece that was missing.
- **`content/legal/privacy.md` §12** — removed the `<!-- TODO confirm -->` placeholder marker; jurisdiction (Greece / Thessaloniki courts) and contact email (pparaskevas.dev@gmail.com) are now confirmed defaults rather than placeholders.
- **`content/legal/terms.md` §9** — removed the matching `<!-- TODO confirm -->` placeholder marker.

### Notes
- The address rendered on `/imprint` and `/privacy` is the operator's residence. DDG §5 strictly requires a real street address, not a P.O. box. Phone is deliberately omitted (email satisfies the "rapid electronic contact" requirement). VAT-ID line states "None" rather than being omitted, to make the absence explicit rather than implied.
- `/impressum` exists as a German-language entry-point URL only — German visitors expect this URL by convention. Page content remains in English (consistent with the rest of the site); the legal substance is identical either way.
- §18 Abs. 2 MStV editorial responsibility is included even though `/blog` currently has no published posts. The route is shipped and reachable, and the obligation attaches to the offering of journalistic-editorial content, not to the existence of specific posts.

## 0.10.21 — 2026-05-19

### Added
- **`content/series/wsbk/champions.json`** filled in the remaining `constructorChampion` entries for 1988–2001 — the last gap from the 0.10.13 batch. Sourced from each per-season Wikipedia page (`19XX_Superbike_World_Championship`) via parallel WebFetch, then verified against the per-season manufacturers' standings tables. WSBK is now complete end-to-end: 38 of 38 entries carry both `driver` + `constructor` + `constructorChampion`. The Champions tab's two-section layout now covers the full 1988–2025 span on both sides.

### Notes
- **Notable split years in the new data** (rider's bike ≠ manufacturers' winner):
  - 1990: Roche (Ducati) but **Honda** WMC
  - 1993: Russell (Kawasaki) but **Ducati** WMC
  - 2000: Edwards (Honda) but **Ducati** WMC

## 0.10.20 — 2026-05-19

### Reverted
- **`public/icons/badge-96.png` and `scripts/gen-badge.py`** restored to the pre-0.10.15 4×3 chequer + pole design. The 2×2 redesign was visually too sparse and the user's status-bar test still wasn't satisfying. Keeping the original silhouette.

### Changed
- **`components/PushSoundPlayer.tsx`** — `audio.volume` raised from `0.6` to `1.0`. The 0.6 cap added in 0.10.6 made the F1-radio cue too quiet to notice; running at the asset's native volume now.

## 0.10.19 — 2026-05-19

### Fixed
- **Google CMP consent banner did not display** despite the "European regulations message" being Published in the AdSense console. Diagnosed via DevTools: `window.googlefc` resolved as an object (FC bootstrapped via `adsbygoogle.js`) but no `fundingchoicesmessages.google.com` fetch fired, so no banner. Root cause: the AdSense account is still under review ("Getting ready" / "Review requested"). For accounts pre-approval, the `adsbygoogle.js` base tag bootstraps the FC object but **does not** fetch the message body until the site is approved. The explicit Funding Choices snippet with `?ers=1` (eager mode) bypasses this gating.

### Added
- **Explicit Funding Choices snippet** in `app/layout.tsx`: `<Script src="https://fundingchoicesmessages.google.com/i/pub-3573600995951624?ers=1" strategy="afterInteractive" />` plus the standard `googlefcPresent` iframe-signal helper inline. With this snippet, the CMP fetches the message body and displays the consent banner regardless of approval state.

### Notes
- The publisher ID for the Funding Choices URL is derived from `ADSENSE_CLIENT_ID` by stripping the `ca-` prefix (`ca-pub-3573600995951624` → `pub-3573600995951624`). Single source of truth.
- Consent Mode v2 defaults (`denied` for everything) remain in place as a safety net for the case where Funding Choices fails to load (ad blocker, network error). GA + AdSense stay in deny state until the CMP explicitly updates via `gtag('consent', 'update', ...)`.

## 0.10.18 — 2026-05-19

### Removed
- **Custom `<CookieBanner>` component** (`components/CookieBanner.tsx`) and its supporting bits: `components/ReopenConsentButton.tsx`, `lib/consent.ts`, `app/api/consent/route.ts`, the "Cookie preferences" buttons in `Footer.tsx` and `SettingsClient.tsx`, the `ReopenConsentButton` mounts on `/cookies` and `/do-not-sell`. AdSense's published Google CMP (Funding Choices, "European regulations message") is now the single source of consent UI. Verified Published in the AdSense console Privacy & messaging screen before this PR was opened.

### Changed
- **`content/legal/cookies.md`, `do-not-sell.md`, `privacy.md`** updated to describe Google's CMP as the consent surface (banner appears in EEA/UK/Swiss regions; re-open via Google's injected "Consent"/shield icon). Removed references to our deprecated server-side consent record; consent is now stored by Google (e.g. `FCCDCF` cookie on `paddock-tracker.com`).
- **`app/layout.tsx`** consent-default `<Script>` left in place. Google's CMP integrates with Consent Mode v2 and will issue `gtag('consent', 'update', ...)` directly when the user makes a choice, so removing our own update path is intentional.

### Notes
- **If Google's CMP does not display** on the deployed site for EU visitors, check AdSense console → Privacy & messaging → European regulations → Status. The message must read "Published" and the Publish toggle must be ON. Confirmed in the user's AdSense screenshot prior to this PR.
- **Consent Mode v2 defaults** (everything `denied` until updated) stay in `app/layout.tsx`. If Google's CMP fails to load or is suppressed by an ad blocker, GA and AdSense remain in deny state — no silent tracking.

## 0.10.17 — 2026-05-19

### Fixed
- **Markdown tables now render** on `/privacy`, `/cookies`, and any other markdown-driven page. `lib/content.ts` chained `remark-gfm` into the pipeline before `remark-html`. CommonMark (which `remark` parses by default) has no concept of pipe-table syntax, so the GFM tables we wrote in the legal markdown files rendered as raw `| Column | Column |` text in 0.10.16 — visible in user screenshots from `/privacy` and `/cookies` shortly after merge. Adding `remark-gfm` enables GFM tables, strikethrough, autolinks, and task lists across the existing `loadMarkdownAsHtml` consumers (`/changelog` is unchanged in shape — its content doesn't currently use tables, but the pipeline will now handle them if added).

## 0.10.16 — 2026-05-19

### Added
- **Five new legal/policy pages** rendered from markdown via the existing `loadMarkdownAsHtml` pipeline (same pattern as `/changelog`):
  - `/privacy` — Privacy Policy covering GDPR/ePrivacy disclosures: data we collect (Clerk auth, push subs, localStorage prefs, contact form, server logs, consent record), purposes per lawful basis, processors (Clerk, Vercel, Google Analytics, AdSense, Cloudflare via Clerk, Resend, Open-Meteo, Wikipedia, jolpica), retention table, user rights, GPC honouring, children policy, contact, supervisory authority (HDPA for Greece).
  - `/terms` — Terms of Service: service description ("best-effort, AS IS"), accounts, acceptable use, IP, liability disclaimer with consumer-protection carve-out, modifications, governing law = Greece (Thessaloniki).
  - `/cookies` — Cookie Policy: category table, cookie inventory (strictly necessary / functional / analytics / marketing), withdraw mechanism, GPC note, consent record retention.
  - `/accessibility` — Accessibility Statement: WCAG 2.2 AA target, known limitations, reporting channel.
  - `/do-not-sell` — CCPA "Do Not Sell or Share My Personal Information" — confirms no sale, treats AdSense sharing as CCPA-defined sharing, three opt-out paths, full CCPA rights.
  - Source markdown lives under `content/legal/*.md`. Each page route is `force-static`. Two pages (`/cookies`, `/do-not-sell`) embed a `<ReopenConsentButton>` that dispatches `paddock:reopen-consent` to re-open the banner.
- **`<ReopenConsentButton>`** — small client component that fires the existing `paddock:reopen-consent` event the cookie banner already listens for. Mounted on `/cookies` and `/do-not-sell`.
- **`POST /api/consent`** (`app/api/consent/route.ts`) — server-side consent log to satisfy GDPR Article 7(1). Persists each consent change to Vercel KV at key `consent:<timestamp>:<anonId>` with 24-month TTL. Includes `userId` when authed (via Clerk's `auth()`), null otherwise. Best-effort: returns `{ ok: true, persisted: false }` if KV is misconfigured so the UX doesn't block.
- **Footer expanded** with Privacy / Terms / Cookies / Accessibility / Do Not Sell or Share / Cookie preferences entries. The "Cookie preferences" entry is a button (not a link) that dispatches `paddock:reopen-consent`.

### Changed
- **`components/CookieBanner.tsx`** now wires the missing pieces from PR #16:
  - On every persist (`Accept all` / `Reject non-essential` / custom save), calls `gtag('consent', 'update', { ad_storage, ad_user_data, ad_personalization, analytics_storage })` mapping each banner category to Consent Mode v2 keys. GA and AdSense react immediately — no page refresh needed.
  - On every persist, POSTs the chosen categories + anonymous identifier + version to `/api/consent` via `fetch` with `keepalive: true`. Errors are swallowed; localStorage remains the authoritative record.
  - On mount, if the user has **not** yet decided AND `navigator.globalPrivacyControl === true`, the banner auto-persists `REJECT_ALL`, calls `gtag('consent', 'update', { all denied })`, logs the GPC-derived decision to the server, and never renders. The user can still re-open from the Cookie Policy page or footer to override.

### Notes
- **Two `<!-- TODO confirm -->` markers** left in `privacy.md` and `terms.md` for governing law (Greece / Thessaloniki) and contact email (`pparaskevas.dev@gmail.com`). Swap if you want a different jurisdiction or email.
- **Page versioning.** Material changes to any legal page should bump a release-notes entry mentioning the page name. The `_Last updated: YYYY-MM-DD_` line in each markdown is the authoritative date users see.

## 0.10.15 — 2026-05-18

### Changed
- **`public/icons/badge-96.png` redesigned** to read at Android status-bar scale (~24px). The previous 4×3 chequer + pole collapsed into an unrecognisable small white rectangle once Android applied its silhouette mask + downscale (user-reported with screenshot). Replaced with a **2×2 chequered grid, no pole, generous 4px transparent gutter** — only two diagonally-opposite cells are opaque, the other two stay transparent. At 24px the alternating pattern now actually reads as a chequered motif rather than a solid blob. `scripts/gen-badge.py` updated accordingly; running `python scripts/gen-badge.py` regenerates the asset deterministically.

## 0.10.14 — 2026-05-18

### Added
- **F2, F3, WSBK, and IMSA `champions.json` gap-fill for `constructorChampion`.** Every Champions tab on these four series now renders the two-section layout (Drivers' Championship + Constructors'/Teams'/Manufacturers' Championship) end-to-end:
  - **F2**: Teams' Champion added for the FIA F2 era (2017–2025) — was previously only set for the GP2 predecessor era. Sourced from Wikipedia FIA F2 article Teams' Champions table via WebFetch.
  - **F3**: Teams' Champion added for the FIA F3 era (2019–2025) — same gap, same fix.
  - **WSBK**: Manufacturers' Champion added for 2002–2025 (24 years). 1988–2001 still without manufacturers' data — that span isn't on the WSBK Wikipedia article as a clean table; deferred to a separate task (per-season pages).
  - **IMSA**: Manufacturers' Champion (top class — Prototype → DPi → GTP era) added for 2014–2025 (12 years). Sourced from the IMSA SportsCar Championship Wikipedia article "Manufacturers" table.

### Notes
- **GTWC Endurance Cup deferred.** The user also asked for the Endurance Cup champions to be surfaced. The Endurance Cup is a parallel drivers' championship — not a constructor/manufacturer column — so it doesn't fit cleanly into the existing `{driver, constructor, constructorChampion}` schema. Tracked as a follow-up: extend `Champion` with secondary-championship fields, then curate Endurance Cup data 2011–2025.

## 0.10.13 — 2026-05-18

### Added
- **Curated `champions.json` files for the remaining seven series** that were previously falling back to the broken Wikipedia scraper. All sourced via WebFetch from per-series Wikipedia pages (parallel fetch), then hand-curated into the standard `{year, driver, constructor, constructorChampion?}` shape. `ChampionsTab` picks the curated file up automatically and renders the two-section layout for series that supply `constructorChampion`, single-section otherwise.
  - **`content/series/wsbk/champions.json`** — WorldSBK riders' champions 1988–2025 (38 entries). Single section (rider + bike). Manufacturers' Championship is not surfaced in this PR because Wikipedia doesn't publish it as a clean year-by-year table; can be added later if the user wants.
  - **`content/series/wec/champions.json`** — FIA WEC top-class drivers + Manufacturers' Champions 2012–2025 (13 entries; no 2018 row because the 2018–19 super season is counted under 2019). Two sections.
  - **`content/series/imsa/champions.json`** — IMSA SportsCar Championship top-class (Prototype → DPi → GTP) drivers + team 2014–2025 (12 entries). Single section. Note: the championship in its current form started in 2014; pre-2014 was American Le Mans Series + Grand-Am Rolex (separate championships) and is intentionally not back-filled.
  - **`content/series/dtm/champions.json`** — DTM drivers + Manufacturers' Champions, original era 1984–1996 (no manufacturers' title 1984–90) + modern era 2000–2025. 1997–1999 not held (series re-launched in 2000). Two sections.
  - **`content/series/gt-world/champions.json`** — GT World Challenge Europe (formerly Blancpain GT Series) overall drivers' champions 2014–2025 (12 entries). Single section.
  - **`content/series/f2/champions.json`** — FIA Formula 2 (2017–2025) + predecessor GP2 Series (2005–2016) drivers + teams. GP2 era entries carry Teams' Champion as `constructorChampion`; F2 era doesn't (Wikipedia article didn't list it cleanly, can add later). Two sections.
  - **`content/series/f3/champions.json`** — FIA Formula 3 (2019–2025) + predecessor GP3 Series (2010–2018) drivers + teams. GP3 era entries carry Teams' Champion as `constructorChampion`. Two sections.

## 0.10.12 — 2026-05-18

### Added
- **`content/series/motogp/champions.json`** — full curated 500cc / MotoGP premier-class champions from inception (1949) through 2025 (77 entries). Each year carries the riders' champion, their bike manufacturer (`constructor` field), and the separate Manufacturers' Champion (`constructorChampion` field). Sourced via WebFetch from Wikipedia's "List of 500cc/MotoGP World Riders' Champions" and "List of Grand Prix motorcycle racing World Constructors' Champions". The MotoGP Champions tab now renders the two-section layout (Drivers' Championship + Constructors' Championship) introduced in 0.10.11, replacing the previously-failing Wikipedia scraper output.

## 0.10.11 — 2026-05-18

### Changed
- **`components/tabs/ChampionsTab.tsx`** rewritten to render **two clearly distinct labelled sections** — `Drivers' Championship` and `Constructors' Championship` — when the curated data contains any `constructorChampion` entries. Replaces the inline `WCC: <team>` indicator shipped in 0.10.10, which the user disliked as visually cluttered. Each section keeps the decade-grouped collapsible layout. For series with no constructor data (everything except F1 right now), the component still renders the single drivers-only list as before. Extracted `DriversSection` and `ConstructorsSection` subcomponents to keep `ChampionsTab` itself focused on data loading and layout. `groupByDecade` is now generic over `{year: number}` so both sections share it.

## 0.10.10 — 2026-05-18

### Added
- **`content/series/f1/champions.json`** — full curated F1 World Drivers' Champions 1950–2025 (76 entries) including the World Constructors' Champion for each year from 1958 (inception of the WCC) onward. Sourced from Wikipedia's "List of Formula One World Drivers' Champions" and "List of Formula One World Constructors' Champions" via WebFetch. ChampionsTab will now bypass the Wikipedia scraper for F1 and use this curated file (the scraper was returning drivers only — no WCC data).
- **`Champion.constructorChampion?: string`** added to `lib/types.ts`. Holds the WCC team for that season when distinct from `constructor` (the driver champion's team). Used to surface F1's "split" years (e.g. 1981 Piquet/Brabham + Williams WCC; 2024 Verstappen/Red Bull + McLaren WCC).

### Changed
- **`components/tabs/ChampionsTab.tsx`** — when `constructorChampion` is set AND differs from `constructor`, append a small `WCC: <team>` indicator beside the driver's team. Same-team years stay clean (no clutter on 80%+ of F1 rows where the driver's team also won the WCC). (Superseded by 0.10.11.)

## 0.10.9 — 2026-05-18

### Fixed
- **Consent Mode v2 default state was firing AFTER AdSense, not before** (PR #16 regression). The raw inline `<script>` tags in `<head>` were being reordered by Next 16 App Router — confirmed via `curl https://paddock-tracker.com/` byte positions: `pagead2.googlesyndication.com` script at byte 1620, `id="consent-default"` script at byte 3811. AdSense's async fetch was racing the consent default. Switched the consent-default script to `<Script strategy="beforeInteractive">` (deterministically injected into initial HTML *before* any module per Next 16 docs) and moved AdSense to `<Script strategy="afterInteractive">` (runs post-hydration, well after consent default). Order is now strategy-driven, not JSX-position-driven. GA scripts remain `afterInteractive` and still reuse the head-defined `gtag`/`dataLayer`.

### Notes
- **Existing cookies persist until expiry.** Visitors who hit paddock-tracker.com before 2026-05-18 18:42 UTC (when PR #16 originally deployed) have `_ga`, `_gcl_au`, etc. from before consent default existed. To verify the fix takes effect, clear cookies and reload in an incognito window.

## 0.10.8 — 2026-05-18

### Added
- **`components/MonthNavigator.tsx`** — shared month-by-month navigator (`←` / month-label dropdown / `→`). Renders only months that have content. Prev/next skip empty months by virtue of the input list being pre-filtered.
- **`lib/months.ts`** — month-key helpers: `monthKey(Date) → 'YYYY-MM'` (user-local), `monthLabel('YYYY-MM') → 'Mar 2026'`, `currentMonthKey()`, and `pickDefaultMonth(months[])` (prefers current month → nearest upcoming → most recent past).
- **`components/MonthScopedWeekends.tsx`** — new client wrapper used by `CalendarTab`. Owns the selected-month state, filters the weekend list, renders the navigator + the existing `<WeekendBlock>` grid. Replaces the past-toggle behaviour.

### Changed
- **`components/FilteredSessions.tsx`** (`/calendar`) — now month-scoped. Defaults to current month if the followed-series filter has content there, otherwise nearest upcoming. When the `followed` set changes and the selected month becomes empty, the effective selected month auto-resolves to a valid one (derived on render, no `useEffect` thrash).
- **`components/tabs/CalendarTab.tsx`** — rewritten as a thin wrapper that hands the weekend list to `<MonthScopedWeekends>`. No more `PastToggleSection` import.

### Removed
- **`components/PastToggleSection.tsx`** — past weekends are now naturally browseable via the month navigator's `←` arrow. The `+ show past` toggle is gone; the file's only consumer was `CalendarTab`, so the file is deleted outright.

## 0.10.7 — 2026-05-18

### Added
- **`title.template: '%s — Paddock'`** in `app/layout.tsx` root `metadata`. The root now exposes a `default` title for the home page ("Paddock — Personal motorsport companion") and a `template` for every child page. A page that exports `title: '<page>'` resolves to "<page> — Paddock" in the browser tab.
- **Per-page `metadata` exports** on the 7 routes that previously fell back to the root title: `/about` → "About", `/calendar` → "Calendar", `/changelog` → "Changelog", `/settings` → "Settings", `/sign-in` → "Sign in", `/sign-up` → "Sign up". `/series/[slug]` now has its own `generateMetadata` that reads `loadSeriesMeta(slug)` and returns the series name (e.g. "Formula 1 — Paddock").
- **`app/icon.png`** — copy of `public/icons/icon-192.png` (the Paddock chequered-flag logo, 1.5 KB). Next 16 auto-generates the `<link rel="icon">` and `<link rel="apple-touch-icon">` tags from this file. Replaces the stale generic favicon that was reading as a dark triangle on most browser tabs.

### Changed
- **Stripped ` · Paddock` suffix** from 4 existing metadata files (`app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `app/drivers/[slug]/page.tsx`, `app/teams/[slug]/page.tsx`). The new title template appends `— Paddock` automatically; the hardcoded mid-dot suffix would have caused "X · Paddock — Paddock" doubling.

### Removed
- **`app/favicon.ico`** — replaced by `app/icon.png`. Next 16's icon precedence prefers `app/icon.*` so keeping both files would have left two competing favicon sources; deleting the stale `.ico` keeps a single source of truth.

## 0.10.6 — 2026-05-18

### Added
- **Foreground push-sound playback.** When a web push arrives while a Paddock window is visible, `app/sw.ts` now suppresses the OS notification sound and posts a `paddock:push-sound` message to every visible client. The new `<PushSoundPlayer>` client component (mounted via `AppShell`) listens for that message and plays `public/sounds/f1-radio-notification.mp3` via the `Audio` API at volume 0.6. Autoplay rejections are swallowed silently — if a recent user gesture is missing (mobile lockscreen, idle tab), the audio fails quietly while the visible notification still shows.
- **`public/sounds/f1-radio-notification.mp3`** — 22.8 KB, 128 kbps stereo MP3, ~1s F1 team-radio cue. User-supplied asset.
- **`components/PushSoundPlayer.tsx`** — client-only `useEffect` listener on `navigator.serviceWorker.message`. Type-guards the message via `isPushSoundMessage` so unrelated SW messages are ignored.

### Changed
- **`app/sw.ts` push handler** rewrapped in `event.waitUntil(async () => …)` so it can `clients.matchAll` before deciding the notification's `silent`/`vibrate` options. Logic: `suppressSystemSound = hasVisibleClient || callerMuted`. When suppressed, vibrate is also `undefined`. Background notifications (no visible client) behave exactly as before — same OS-default sound + vibrate pattern.

### Notes
- **Background notifications unchanged.** Web Push API still does not expose custom audio for background notifications in any PWA browser. Native wrapper (TWA on Android, Capacitor on iOS) is the only real fix and stays parked behind "Split Web app from Play Store / App Store" in `IDEAS.md`.
- **iOS Safari foreground:** `Audio.play()` without a user gesture is reliably blocked on iOS Safari PWAs. Expected behaviour is no sound on iOS — handled silently by the `.catch(() => {})` swallow. Visible notification still renders. Android Chrome and desktop Chrome/Edge are where this feature actually plays audio.

## 0.10.5 — 2026-05-18

### Added
- **`public/ads.txt`** — IAB-compliant authorized-seller declaration for AdSense. Single line: `google.com, pub-3573600995951624, DIRECT, f08c47fec0942fa0`. Required for ad serving; without it AdSense will not show ads even after site approval. Vercel serves files in `public/` from the domain root, so this resolves at `https://paddock-tracker.com/ads.txt`. Closes the "Ads.txt status: Not found" warning in the AdSense console.

## 0.10.4 — 2026-05-18

### Added
- **Google AdSense verification snippet** in `app/layout.tsx` `<head>`. Native `<script async crossorigin>` per Google's exact snippet for client `ca-pub-3573600995951624`. Placed in `<head>` so the AdSense crawler reads it from the initial HTML on first crawl.
- **Google Consent Mode v2 default state** as a synchronous inline `<script id="consent-default">` in `<head>`, ahead of both AdSense and GA. Sets `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage` to `denied` with `wait_for_update: 500`. Every visitor (fresh or returning) loads AdSense + GA with ad/analytics cookies suppressed until consent updates. Cookie banner → `gtag('consent', 'update', …)` wiring lands in a follow-up PR.

### Changed
- **`ga-init` script slimmed.** The shared `window.dataLayer` and `gtag` function are now defined in the head-injected `consent-default` script (runs synchronously before any other script). `ga-init` is reduced to `gtag('js', new Date()); gtag('config', GA_ID);` — both calls reuse the head-defined `gtag`.

## 0.10.3 — 2026-05-18

### Fixed
- **ADAC `champions.json` was incomplete.** 0.10.2 shipped with only 10 entries (2015–2024). The 24h Nürburgring has been run since 1970 — 53 actual editions through 2025 (race not held in 1974, 1975, 1983). Expanded to the full historical record sourced from the 24 Hours of Nürburgring Wikipedia article + the per-year race articles (2024, 2025) via WebFetch. Each entry now has the winning team, full driver lineup, and chassis. The prior 2024 entry had the team and car right but partially wrong drivers — corrected to Ricardo Feller / Dennis Marschall / Christopher Mies / Frank Stippler (Scherer Sport PHX, Audi R8 LMS Evo II).

### Notes
- 2025 winner added: Rowe Racing BMW M4 GT3 Evo — Augusto Farfus, Jesse Krohn, Raffaele Marciello, Kelvin van der Linde (classified as winner after a late penalty for race-long leader Manthey Racing).

## 0.10.2 — 2026-05-18

### Added
- **Custom `app/error.tsx`** — token-driven Paddock "Yellow flag" page replaces Next.js's default error screen for render-time errors. Includes a Try Again button (`reset()`) and a Home link. Logs to console; production telemetry continues to flow through Vercel Analytics + Speed Insights. Mirrors the not-found.tsx layout for visual consistency.
- **Chequered-flag notification badge** at `public/icons/badge-96.png`. `scripts/gen-badge.py` now draws a 4×3 alternating-square grid inside the flag area (white-on-transparent so Android's silhouette mask still renders correctly). Service-worker config unchanged — same path.
- **Contact form category dropdown** in `ContactModal`. Four options — Bug report / Feature request / Suggested change / General. Posted with the request body in `/api/contact`; `route.ts` validates against the enum, defaults unknown values to `general`. Resend subject reads `[<category>] Paddock contact from …` so the inbox self-sorts. KV record gains a `category` field.
- **ADAC Ravenol 24h `champions.json`** — 10 years of winners (2015–2024) with full 4-driver lineups + team and chassis. Sourced from Wikipedia's 24 Hours of Nürburgring article via WebFetch. 2024 entry is best-effort; verify with official ADAC records when curated.

### Changed
- **`SeriesTabs` renames the 'Champions' tab label → 'Past Winners'** when `singleEvent` is true. Internal tab key stays `champions` so `?tab=champions` URLs and `ChampionsTab` rendering are unchanged; only the visible nav label flips. NLS keeps 'Champions'.

### Notes
- **Notification sound — researched, deferred.** Web Push Notification API does not expose a `sound` parameter for custom audio in PWAs across browsers. Android: respects the OS-level notification channel default; iOS PWA: no custom sounds at all. Path forward requires native wrapping (TWA on Android, Capacitor/native shell on iOS), which is parked behind the "Split Web app from Play Store / App Store" IDEAS item. No code change shipped; entry stays in IDEAS Inbox.

## 0.10.1 — 2026-05-18

### Added
- **`rounds.json` for the bottom 8 series.** DTM (7 rounds, R4 Norisring intentionally absent — split-quali format awaits ADAC schedule), NLS (10 rounds with full ADAC race titles), GT World Challenge Europe (10 rounds — Paul Ricard/Brands Hatch/Monza/Spa/Misano/Magny-Cours/Nürburgring/Zandvoort/Barcelona/Portimão), Formula E Season 12 (17 rounds including the Sanya R11 placeholder at 2026-06-20), NASCAR Cup (36 points races with full sponsor titles), WRC (4 confirmed rallies — Monte-Carlo, Croatia, Portugal, Finland; mid-season stays TBC), IndyCar gap fill (R11 Music City Nashville Superspeedway, R12 Portland, R13 Markham, R14 Washington D.C., R17 Laguna Seca finale — verified against indycar.com Schedule via WebFetch since the earlier handoff had the venue order wrong). After this, array-index fallback is fully retired for matched weekends across all 15 series.
- **`SeriesMeta.singleEvent?: boolean`** in `lib/types.ts`. Distinguishes series that are a single annual race (ADAC Ravenol 24h) from real championships (everything else). Drives a slimmer tab set.
- **`tabsFor(singleEvent)` + `SINGLE_EVENT_TAB_KEYS`** in `lib/tabs.ts`. Returns the filtered TABS array — Calendar, About, History, Champions only — when the flag is set. `resolveTab()` also respects the flag so a stale `?tab=results` URL on a singleEvent series falls back to Calendar.

### Fixed
- **F1 Azerbaijan 2026 `endDate` Sep 27 → Sep 26** in `content/series/f1/rounds.json`. Race runs Saturday (Remembrance Day). `sessions.json` already had `matchDate: 2026-09-26`; rounds.json was the lone outlier still showing Sep 27 in the calendar card date range.

### Changed
- **`SeriesTabs` accepts a `singleEvent?` prop.** When true, renders the filtered tab list at 2-col mobile / 4-col md+ instead of the standard 3-col×3-row grid. `app/series/[slug]/page.tsx` passes `series.meta.singleEvent`.
- **`content/series/adac-ravenol-24h/meta.json`** gains `"singleEvent": true`.

### Notes / known v1.1 follow-ups
- **IMSA Practice 1 sessions still missing on R6–R11.** Per-race timetables publish race-week, not annually. Deferred until each race week.
- **FE Sanya R11 session times still pending.** Round date is in rounds.json (2026-06-20); session block in `content/series/formula-e/sessions.json` still missing. Adds when FIA Formula E publishes the timetable.
- **WRC R2/R3/R5/R7-R9/R11-R13** stay as array-index fallback. Stage data publishes 4-6 weeks pre-rally per organiser convention.
- **"Champions" tab label** stays as-is for ADAC even though it functionally lists past 24h winners. Renaming to "Past Winners" for singleEvent series is a small future polish.

## 0.10.0 — 2026-05-17

### Added
- **Paddock 1.0 design system.** Semantic CSS variable tokens (`--bg`, `--surface{,-elevated}`, `--border{,-strong}`, `--text{,-muted,-faint}`, `--tint{,-contrast}`, `--live`, `--positive`, `--negative`, `--duration-{fast,base}`, `--ease-out`, `--radius-card`) live on `:root`, with dark overrides under `.dark` / `[data-theme="dark"]` and a `@media (prefers-color-scheme: dark)` block for system-driven dark. shadcn token names (`--background`, `--primary`, `--ring`, etc.) are bridged via `var()` so primitives inherit Paddock's palette without rewriting their classes. All exposed as Tailwind utilities (`bg-bg`, `text-text`, `border-border`, `bg-tint`, `text-tint-contrast`, etc.) through `@theme inline`. Spec: `docs/design/paddock-1.0.md`.
- **shadcn/ui (`base-nova` preset on Tailwind v4 + Base UI primitives).** `button`, `dialog`, `sheet`, `tabs`, `popover`, `command`, `sonner`, `skeleton`, `tooltip`, plus `input` / `textarea` / `input-group` as transitives. `lib/utils.ts` `cn()` helper. `components.json` configured to use our token names. `Toaster` mounted in `AppShell`; `TooltipProvider` wraps the shell with `delay={300}`.
- **Geist Mono.** `geist/font/mono` loaded as a CSS variable in `app/layout.tsx`; `--font-mono` exposed in `@theme inline` so the Tailwind `font-mono` utility uses it. Applied to every numeric/time surface (session times, weekend date ranges, weather temps, standings positions/points, relative timestamps, year labels, version string) while prose stays Geist Sans.
- **Per-series accent system.** `app/series/[slug]/page.tsx`, `app/series/[slug]/weekend/[round]/page.tsx`, `app/drivers/[slug]/page.tsx`, `app/teams/[slug]/page.tsx` set `style={{ '--tint': meta.color }}` on the page wrapper. Series tint flows through every descendant via `text-tint`, `bg-tint`, `border-tint`, `ring-tint`. SeriesTabs active state composes the Tailwind tint with an inline `boxShadow` ring in the literal color.
- **Live-pulse keyframe** (`.live-pulse`, 2s ease-in-out scale + opacity) respecting `prefers-reduced-motion`.

### Changed
- **Lifted forced `dark` class from `<html>`.** `app/layout.tsx` now renders `<html className={`${GeistSans.className} ${GeistMono.variable}`}>` without a forced dark class, and `<body>` uses `bg-bg text-text`. `html { color-scheme: light dark; }` tells the UA to render form controls per active mode. `@custom-variant dark` now fires on `.dark` / `[data-theme="dark"]` **OR** `@media (prefers-color-scheme: dark)`, so the Tailwind `dark:` modifier works in either path.
- **Body wash now has both light + dark variants.** Light: amber + sky tints with darker-on-light alphas. Dark: original warm amber + cool sky over `#0a0a0d`. Both fixed-attached, both with subtle grain noise SVG. Targeted via `@media (prefers-color-scheme: dark)` plus explicit `.dark body` / `[data-theme="dark"] body` overrides.
- **All visible surfaces migrated zinc-hardcoded → tokens.** `AppShell`, `Footer`, `HeaderUtils`, `HomeContent`, `NextSessionCard`, `FilteredSessions`, `SessionCard`, `WeekendBlock`, `DayHeader`, `WeekendHero`, `WeekendSchedule`, `WeekendWeatherStrip`, `WeekendNews`, `WeekendStandingsSnapshot`, `SeriesTabs`, all `components/tabs/*`, `PastToggleSection`, `SeasonTrendChart` (recharts grid/axis/tooltip now use `var(--border)` / `var(--text-muted)` / `var(--surface-elevated)`), `ContactModal`, `CookieBanner`, `StaleBanner`, `CancelledRoundsSection`, `/about`, `/blog` index, `/blog/[slug]`, `/calendar`, `/changelog`, `/not-found`, `/series/[slug]`, `/series/[slug]/weekend/[round]`, `/drivers/[slug]`, `/teams/[slug]`.
- **`prose-invert` → `dark:prose-invert`** in `app/changelog/page.tsx`, `app/blog/[slug]/page.tsx`, `components/tabs/{HistoryTab,RulesTab,DriversTab,AboutTab}.tsx`. Without this, MDX/HTML prose rendered as white text on light backgrounds.
- **Live-state badges intentionally keep literal red** (`bg-red-500/15 text-red-300`) — motorsport convention: red flags, red lights, red broadcast indicator. The `--live` token (amber) is reserved for non-broadcast "active" states.
- **Sonner Toaster shed its `next-themes` dep.** `components/ui/sonner.tsx` now uses `theme="system"` directly; we don't ship `next-themes`.
- **`wiki-table` styling** in `globals.css` now references `--border` / `--surface` / `--text` / `--text-muted` so Rules / History tables re-skin in light mode automatically. Even-row stripe uses `color-mix(in srgb, var(--surface) 50%, transparent)`.

### Notes / known v1.1 follow-ups
- **Clerk `appearance`** in `app/layout.tsx` is still dark-tuned (hardcoded `colorBackground: '#0a0a0a'` etc.). Sign-in / Sign-up modal renders dark even when the rest of the site is in light mode. Clerk variables don't appear to accept `var()` references; fix likely via `@clerk/themes`'s `dark` / `system` baseTheme.
- **PWA-only modals still zinc-hardcoded:** `OnboardingWizard`, `EnableNotifications`, `PWAInstallPrompt`, `NotifPrefsSection`, `SettingsClient`. Low-visibility surfaces — show on first install / from inside the Clerk user button — so the light-mode mismatch is rare in practice.
- **`components/mdx/mdx-components.tsx`** untouched; blog detail prose styles will lean on Tailwind typography defaults under both modes. Acceptable until we have more than a handful of MDX posts.
- **Sidebar `--tint` flow.** On a series route, the page wrapper sets `--tint` but the persistent left sidebar lives outside that scope. Drawer's active-series link still shows the global signal-amber rather than the series color. Lifting `--tint` to `<html>` requires a server-side route lookup per request; deferred.

## 0.9.19 — 2026-05-17

### Added
- **`docs/research/supabase-schema-draft.md` — full v1 schema draft for the Supabase migration.** 18 sections covering: extensions setup, status lookup (vs ENUM), source registry with provenance columns, the 8 core schedule tables (series / season / venue / circuit_layout / driver / team / season_entry / round / session / result), audit log via shadow-table + trigger + material flag, standings snapshot, six user-facing additive tables (comment / prediction / ledger_entry / push_subscription / user_preferences / contact_submission), RLS policies (public-read schedule, per-user user tables, app-role insert-only on audit), the canonical index set, JSON-file → table migration mapping, out-of-scope items, 10 open questions for the Tuesday Fotis sit-down, and the 12-step implementation order. Builds directly on `db-best-practices.md` + `per-series-source-audit.md`. Ready to `psql -f` once we provision the project.

## 0.9.18 — 2026-05-17

### Changed
- **Split `CHANGELOG.md` (this file, engineering log) from `RELEASES.md` (public-facing prose).** A security/style pass on `/changelog` flagged that the rendered changelog was reading like commit messages — entries like "Added a season window (Dec 1 prior-year → Feb 1 next-year) in `lib/series.ts`" leak the implementation map for free and signal immaturity to anyone evaluating Paddock (sponsors, contributors, recruiters). Engineering detail now stays here in `CHANGELOG.md`; `/changelog` page reads from a new `RELEASES.md` which carries the same version structure but with user-facing prose only (no file paths, no library names, no commit SHAs, 1–3 sentences per bullet). Updated `CLAUDE.md` release-notes rule to mandate updating both files on every push. Backfilled `RELEASES.md` with public-facing copy for every version back to 0.8.0.

## 0.9.17 — 2026-05-17

### Fixed
- **Cron auth no longer fails open when `CRON_SECRET` is unset.** Previously, `authorizeCronRequest` returned `true` if the secret wasn't configured — meaning if the env var ever got cleared (which we've seen happen in this stack), `/api/cron/notify`, `/api/cron/news`, and `/api/cron/race-week` would have become unauth'd spam guns: anyone hitting them could trigger pushes to every subscriber and news emails on demand. Reversed to fail-closed: missing secret → 503, wrong secret → 401, correct secret → run. Pulled the auth logic into a single shared helper `lib/cron-auth.ts` so the security pattern lives in one place instead of triplicated across routes. Landmine #6 in `docs/HANDOFF.md` updated to reflect the new behaviour.

## 0.9.16 — 2026-05-17

### Added
- **`rounds.json` curated for F2, F3, IMSA, IndyCar, WSBK.** Five more series now have canonical round numbers + race names instead of the array-index fallback. After PR #6's calendar venue-label change, weekend cards on these series finally show the actual race name (e.g. "Phillip Island Round", "Rolex 24 At Daytona", "110th Indianapolis 500", "Acura Grand Prix of Long Beach") above the date label.
  - **F2** — 14 rounds, names mapped from F1 venues (F2 supports the F1 weekends).
  - **F3** — 9 rounds (R1, R3–R10), same mapping.
  - **IMSA** — 11 rounds with full official race names (Rolex 24, Twelve Hours of Sebring, Acura Grand Prix of Long Beach, Sahlen's Six Hours of The Glen, Motul Petit Le Mans, etc.) and weekend date ranges from the curated `sessions.json`.
  - **WSBK** — 12 rounds named by venue (Phillip Island, Portimão, Assen, Balaton Park, Most, Aragón, Misano, Donington Park, Magny-Cours, Cremona, Estoril, Jerez).
  - **IndyCar** — 12 rounds with full names (R1–R10 + R15–R16 Milwaukee doubleheader). R11–R14 (Mid-Ohio, Music City, Portland, Markham) and R17 (Laguna Seca finale) left out for now — they fall through to array-index numbering until `sessions.json` curation lands for those events.

### Notes
- For F3, R2 is intentionally absent from `rounds.json` because its session data isn't curated yet. URL `/series/f3/weekend/2` will 404 until that round's `sessions.json` block is filled. All other F3 rounds resolve correctly.
- Partial `rounds.json` (e.g. IndyCar R11–R14 gap) coexists fine with `assignRoundsToWeekends`: matched weekends get canonical numbers from rounds.json, unmatched fall through to array-index. Provided the chronological order matches the canonical numbering — which it does post-season-filter — gap rounds end up with the right number anyway.

## 0.9.15 — 2026-05-17

### Added
- **Google Analytics 4 (`G-DDMJ2NMBWC`).** Wired into `app/layout.tsx` via `next/script` with `strategy="afterInteractive"` so the tracker loads after the page is interactive and doesn't block initial render. Coexists with the existing Vercel Analytics + Speed Insights — they measure different things (Vercel = visits + Web Vitals + edge performance; GA = behaviour, attribution, audience). Measurement ID is a public identifier (visible in browser source), no env-var indirection needed. **Open follow-up:** GDPR cookie-consent banner — GA4 sets cookies and EU receivers technically require explicit opt-in. Logged to `IDEAS.md` Inbox.

## 0.9.14 — 2026-05-17

### Fixed
- **Calendar no longer mixes prior-season ICS entries into the current view.** Non-F1 ICS feeds (Google Calendar exports especially) ship multi-year archives — MotoGP's feed alone has 451 entries dating back to 2010, WEC has 142. Without a year filter, 2025 rounds leaked into the 2026 calendar, and because the date label has no year ("24-25 MAY"), 2025 Silverstone was indistinguishable from a fresh 2026 entry. Added a season window (Dec 1 prior-year → Feb 1 next-year) in `lib/series.ts` so only the declared season's sessions pass through. Kills the "phantom Round 1 Silverstone in May", "F2 19 rounds with no robust data", and similar across every non-F1 series in one stroke.
- **WEC weekend routing fixed (`/weekend/3` now resolves to Le Mans, not COTA).** Same root cause as above: the WEC ICS feed includes a 2025-09-07 Lone Star Le Mans entry, which fell within the 365-day past window and pushed array-index round assignments out of alignment for R3-R5. With the season filter applied, the 2026 weekends correctly map: R3→Le Mans, R4→São Paulo, R5→COTA, R6→Fuji, R7→Qatar, R8→Bahrain.
- **F1 Round 5 Canada Sunday weather restored.** Open-Meteo forecast horizon was set to 7 days; today (May 17) → only May 17-23 covered. The race is Sunday May 24, one day past the window. Bumped `forecast_days` to 16 (Open-Meteo's max) so race-week weather lands well ahead of time. Added a KV cache-bust check (`daily.length >= 14`) so existing 7-day cache entries refresh on next request instead of waiting out their 3-hour TTL.

### Changed
- **Calendar weekend cards now surface the race / venue name prominently.** Previously each card showed just the date range and a "Round X →" footer — fine on a 22-round F1 grid where everyone knows what Round 5 is, but for non-F1 series where round numbers are rolling, the destination is the primary identifier. Card structure is now: date range + tags row → bold race name (e.g. "Catalan Grand Prix", "24 Hours of Le Mans") → optional venue subtitle → session list → Round footer. Falls back to a parsed title hint when no `rounds.json` name is curated for the series.

## 0.9.13 — 2026-05-17

### Fixed
- **Contact form sender domain corrected.** `0.9.12` shipped with the sender set to `contact@send.paddock-tracker.com`, but the Resend-verified domain is the apex `paddock-tracker.com` (the `send.` subdomain only hosts the SMTP infrastructure records, not the addressable sending identity). Resend rejected every send with `403: This API key is not authorized to send emails from send.paddock-tracker.com`, so submissions kept landing in KV with `emailed: false` and no mail left the system. Sender now reads `contact@paddock-tracker.com`. Confirmed by direct Resend API probe pre-merge.

## 0.9.12 — 2026-05-17

### Fixed
- **Contact form now actually delivers email.** Submissions previously persisted to KV (`paddock:contact:*`) but no email was sent because Resend was unconfigured — silently lost feedback. Resend Marketplace integration installed with `paddock-tracker.com` as a verified sending domain (MX/SPF/DKIM on `send.` subdomain). `RESEND_API_KEY` + `CONTACT_TO_EMAIL` wired across Production / Preview / Development. Sender swapped from Resend's sandbox (`onboarding@resend.dev`) to the verified `contact@send.paddock-tracker.com`. Replies still route to the visitor's address via the `reply_to` header.

## 0.9.11 — 2026-05-16

### Added
- **Template-projected session times for empty rounds across 6 series.** Where official sources hadn't published per-event timetables but the series' weekend format is rigid and predictable, applied the standard template with venue-local→UTC conversion (~95% confidence). Specific fills:
  - **F1** — 8 rounds added (Britain R9 sprint, Netherlands R12 sprint, Azerbaijan R15 Saturday-race, Singapore R16 sprint night, USA R17, Brazil R19, Qatar R21 night, Abu Dhabi R22 dusk-race). All ICS-feed-only rounds now have real session times.
  - **F2** — 10 rounds added (R5 Barcelona through R14 Abu Dhabi). Full FIA F2 weekend template applied (Practice / Qualifying / Sprint Race / Feature Race).
  - **F3** — 7 rounds added (R4 Barcelona through R10 Madrid). Full FIA F3 weekend template (Practice / Group A+B Quali / Sprint / Feature).
  - **MotoGP** — 3 rounds added (R20 Qatar night-race, R21 Portugal post-DST, R22 Valencia post-DST). All three are the post-postponement cascade dates confirmed in `0.9.9`'s `rounds.json`.
  - **WEC** — 14 matchDate blocks across rounds 4-8 (São Paulo, COTA, Fuji, Qatar 1812km, Bahrain 8h). Standard FP1/FP2/FP3/multi-class-Quali/Hyperpole/Race format.
  - **DTM** — 6 rounds added (R2 Zandvoort, R3 Lausitzring, R5 Oschersleben, R6 Nürburgring, R7 Sachsenring, R8 Hockenheim). Standard 3-FP/2-Quali/2-Race template. R4 Norisring intentionally left empty — its unique split-qualifying format means session titles would be wrong even with right times; awaits ADAC official schedule.
  - **GTWCE** — 14 matchDate blocks across rounds 3, 6, 7, 9, 10 (Monza Endurance, Magny-Cours Sprint, Nürburgring Endurance, Barcelona Endurance, Portimão Endurance finale).
- **`IDEAS.md` inbox** — two RapidAPI references for future feature work:
  - **F1 Technical Upgrades API** (SebastianL on RapidAPI) — schema reference for the inbox item "Surface per-weekend car upgrades on the F1 weekend page".
  - **F1 Live Timing - Telemetry and GPS API** (Content Net on RapidAPI) — candidate source for the long-term "live in-race data" ambition (telemetry, lap-by-lap).
- **Investigated RapidAPI alternatives.** Confirmed via direct probe + OpenAPI spec inspection:
  - **Sportbex Motor Sport API** — useless for schedules (betting odds only, F1 + IndyCar only).
  - **AllSportsApi v2** (Sofascore-clone) — **does** cover motorsport with 13 categories (F1, MotoGP, Moto2, Moto3, WSBK, FE, WRC, IndyCar, NASCAR, DTM + 3 others). Endpoints `/api/motorsport/categories` and `/api/motorsport/stage/scheduled/{date}` work. **Not wired in this PR** — endpoint discovery completed but schema integration deferred. Verdict: parked for future "automated refresh" cron once Supabase lands.
  - **TheSportsDB** — right shape (per-session times for F1) but only F1 rounds 1-2 populated; volunteer-edited and lags reality.

### Notes
- All template-projected times carry the ~95% confidence flag from the source agent. As official timetables publish (typically 4-6 weeks pre-event), the curated values can be refreshed. The agent's full caveat list (Norisring split-quali, F2 Baku Saturday format, WEC Qatar 1812km race start, COTA WEC race time) is preserved in the conversation context for follow-up.
- F1 Azerbaijan `matchDate` correctly anchors to Saturday Sep 26 (Race day, not Sunday Sep 27 in current `rounds.json`). The `rounds.json` `endDate` mismatch flagged in `0.9.10` notes still stands.

## 0.9.10 — 2026-05-16

### Added
- **Full-season session-time curation across all 14 racing series + ADAC Ravenol 24h.** Every series now has a `content/series/<slug>/sessions.json` override file with venue-local-converted UTC datetimes for every published session of the 2026 season. Replaces the TBC placeholders introduced in `0.9.9` with real factual data sourced from official series sites, Wikipedia season pages, and reputable aggregators. Five parallel research agents fanned out across F1/F2/F3, MotoGP/WSBK, WEC/IMSA/GTWCE, IndyCar/NASCAR/ADAC-24h, and FE/WRC/DTM/NLS — every datetime cited and cross-referenced.
- **Per-series coverage notes:**
  - **F1** — 14 rounds fully timed (Australia → Las Vegas), including Sprint weekends (Shanghai, Miami, Montreal). Race-as-run times used for past events where weather forced reschedules (Miami race ran 13:00 EDT, not scheduled 16:00).
  - **F2 / F3** — Melbourne + Monaco fully timed; remaining FIA support-rounds curate as the FIA releases them ~6 weeks pre-event.
  - **MotoGP** — 19 rounds fully timed including Brazil's non-standard 60-min FP1 / 75-min Practice. Postponed Qatar (R20), Portugal (R21), Valencia (R22) await session times from motogp.com.
  - **WSBK** — All 12 rounds with the new 2026 format (Race 1 / Race 2 at 15:30 local, was 14:00 in 2025).
  - **WEC** — Imola, Spa, Le Mans (full Test Day + FP1-4 + multi-class Hyperpole + Warm-up + Race) detailed; Le Mans Race start 16:00 CEST 2026-06-13.
  - **IMSA** — All 11 WeatherTech rounds: Rolex 24 At Daytona, 12h Sebring, Long Beach, Laguna Seca, Detroit, Watkins Glen 6h, CTMP, Road America 6h, VIR, Indianapolis, Petit Le Mans.
  - **GTWCE** — Paul Ricard 6h, Brands Hatch Sprint, 24h Spa race-start (16:30 CEST Saturday 27 June); other rounds publish per-event timetables closer to date.
  - **IndyCar** — 17 rounds anchored by FOX-published race-start times; full Indy 500 schedule with new 2026 qualifying format (no bumping, Top 12 + Last Chance + Firestone Fast Six).
  - **NASCAR Cup** — All 36 points races + Clash + Duels + All-Star Race with FOX/USA-published Eastern start times converted to UTC.
  - **ADAC Ravenol 24h Nürburgring** — Complete schedule: admin check, scrutineering, qualifying 1/2, Top Qualifying 1/2/3, Q3, pit walk, warm-up, grid formation, race start (13:00 UTC Saturday 16 May, finish Sunday 17 May).
  - **Formula E** — All 17 rounds of Season 12, São Paulo R1 through London R17 (16 August finale). Replaces the previous Monaco-only curation.
  - **WRC** — Monte Carlo, Croatia, Portugal, Finland with full per-stage timetables (Power Stages, Shakedown, all SS times); remaining rallies publish stage itineraries 4-6 weeks pre-event.
  - **DTM** — Red Bull Ring season opener fully timed; other 7 rounds publish per-event timetables 3-6 weeks ahead.
  - **NLS** — All 10 races at Nürburgring with standard format (Free Training, Qualifying, 4h race; NLS7 6h Ruhr-Pokal-Rennen at 6h; NLS4 + NLS5 24h Qualifiers weekend with two 4h races).
- **`docs/research/ingestion-resource-evaluation.md`** — 5-link external-resource audit. Verdicts: adopt TheSportsDB as fallback API for niche series; borrow the `maxgubler/indycar-calendar` playbook (API-key harvest from SPA HTML, diff-before-write, cancellation handling) for our own ingestion pipeline; skip Sportbex (commercial black box) and `armagantrs/race-calendar` (born-dead scaffold).

### Notes
- Late-season rounds where the official timetable hasn't been published yet (Aug-Nov) are intentionally left with empty `sessions` arrays — they render TBC honestly rather than fabricated times. Curate when each source publishes.
- F1 Bahrain (R4) and Saudi Arabian GP (R5) remain in `cancelledRounds` per the `0.9.8` design — not present in this sessions.json (cancelled events have no sessions).
- Two pre-existing data-integrity issues surfaced by the curation work (track for separate follow-up): F1 Azerbaijan `rounds.json` has `endDate: 2026-09-27` but actual race is **Saturday Sep 26** to avoid Remembrance Day; Miami F1 + F2 race times were as-RUN not as-scheduled (weather move).

## 0.9.9 — 2026-05-16

### Fixed
- **Phantom "Sat 03:00" / "Sun 03:00" on non-F1 weekends.** Non-F1 ICS feeds (Google Calendar, ECAL, scrape-built) emit race weekends as `DTSTART:YYYYMMDDT000000Z` (midnight UTC with a time component) rather than `DTSTART;VALUE=DATE`, so the `0.9.1` dateOnly fix missed them. In Europe/Athens (UTC+3 in summer), midnight UTC rendered as "Sat 03:00", giving the impression that the race started at 3 am. The ICS parser now treats entries where both start and end fall on UTC midnight boundaries as effectively date-only — they render "TBC" honestly until session-level times are curated or pulled from a proper API (Pulselive for MotoGP/WSBK, Jolpica for F1).

### Added
- **MotoGP 2026 `rounds.json`** — full 22-round championship calendar with the Qatar postponement cascade: R20 Qatar moved from April to **6–8 November** (Middle East conflict), R21 Portuguese GP and R22 Valencian GP each shifted one week later as cascade. All three rescheduled rounds carry `previousStartDate` / `previousEndDate` / `rescheduleNote` so the UI shows what they were originally scheduled for.
- **WEC 2026 `rounds.json`** — full 8-round championship calendar. R7 Qatar 1812km **postponed from R1 opener to penultimate round** (Oct 22–24); Imola promoted to R1, Prologue moved to Imola on Apr 14. Le Mans is intentionally 2-day (13–14 June race window).
- **Postponement rendering UI** — weekend cards (`WeekendBlock`) and weekend hero (`WeekendHero`) both render a "rescheduled" pill and an amber `Rescheduled from <date> · <note>` line when a round's `previousStartDate` is set. Pairs with the F1 cancellation banner shipped in `0.9.8`.
- **`previousStartDate` / `previousEndDate` / `rescheduleNote` fields on `Weekend`** (extending the same shape from `SeriesRoundEntry` in `0.9.8`). `lib/rounds.ts` copies the fields onto matched weekends.
- **`docs/research/ingestion-resource-evaluation.md`** — synthesis of 5 alternative motorsport-data resources (F2 Data Pipeline, Sportbex on RapidAPI, TheSportsDB F3, IndyCar calendar repo, multi-series race-calendar repo). Verdicts: **adopt TheSportsDB as fallback** for the 11 non-API series, **borrow the IndyCar-calendar playbook heavily** (API-key harvest from SPA HTML, diff-before-write, cancellation handling), skip the rest.
- **2 new `lib/ics.test.ts` cases** covering the midnight-UTC detection (flag when both start + end are UTC midnight; don't flag when end is a real off-midnight time).

### Changed
- **`IDEAS.md` Inbox additions** — surface per-weekend car upgrades on the F1 weekend page; embed YouTube highlights / extended highlights on past weekend pages plus season/month recap pages with season-highlight videos + blog text + standings snapshots.

## 0.9.8 — 2026-05-16

### Fixed
- **F1 2026 Bahrain + Saudi Arabia cancellations now render explicitly.** Both rounds were cancelled mid-season due to the Middle East conflict; previously they were silently removed from the schedule with no user-facing indication. `/series/f1` now shows a compact banner ("2 rounds cancelled this season — Bahrain, Saudi Arabian") near the page header, and the Calendar tab gains a "Cancelled this season" section with per-round cards showing the original date, reason, and reschedule status ("under discussion"). Stable round numbers and URLs for the remaining 22 rounds are preserved.

### Added
- **`cancelledRounds` field on `SeriesRoundsFile`** (`lib/types.ts`) — tracks cancelled-but-recorded rounds separately from the active calendar. Preserves stable round numbers / URLs while making cancellations explicit and queryable. Foundation for the same treatment of MotoGP and WEC postponements in upcoming sessions.
- **`previousStartDate` / `previousEndDate` / `rescheduleNote` fields on `SeriesRoundEntry`** — for rescheduled (not cancelled) rounds where the date moved mid-season (MotoGP Qatar, WEC Qatar).
- **`components/CancelledRounds.tsx`** — `CancelledRoundsBanner` (compact header strip) and `CancelledRoundsSection` (detailed card list).
- **`docs/research/db-best-practices.md`** — Postgres/Supabase schema research synthesizing recommendations from 30+ sources. Covers entity shape, status modelling (lookup table vs ENUM), source provenance, audit log, time handling (local + IANA tz + UTC instant), JSONB hybrid model, change-detection patterns, and Supabase RLS best practices.
- **`docs/research/per-series-source-audit.md`** — data-source audit for all 14 series Paddock tracks (F1, F2, F3, MotoGP, WSBK, WEC, IndyCar, IMSA, NASCAR Cup, Formula E, WRC, DTM, GT World Challenge, NLS, plus ADAC Ravenol 24h). Includes 2026 cancellation/postponement summary, recommended ingestion strategy per series, and identification of the F1 (Jolpica) and MotoGP (Pulselive) JSON APIs as the two highest-leverage upstream upgrades.

### Changed
- **`SCHEDULE.md`** — adds the pre-Fotis cutoff framing (Sat 2026-05-16 afternoon through Tue 2026-05-19 sit-down with Fotis). All new ideas during this window route to `IDEAS.md` Inbox; backlog clearing prioritised over scope expansion.

## 0.9.7 — 2026-05-16

### Added
- **Per-prompt active-time tracking.** Prefix any prompt with `[+Nm]` (e.g. `[+15m] curate IMSA sessions.json`) to log N active minutes since the previous prompt. Claude appends each value to today's section in `SCHEDULE.md` under an `Active:` line and maintains a running total. Wall-clock gaps between prompts no longer overstate throughput — only declared active time counts. Rule documented in `CLAUDE.md` → Time tracking; format reference in `SCHEDULE.md` conventions.

## 0.9.6 — 2026-05-16

### Added
- **`docs/HANDOFF.md` appendix** — the flat 60-item open-items inventory now sits at the bottom of the handoff. The sections above still reorganise the same substance by lifecycle (Sessions roadmap / Loose items / Open design questions / Infra ledger); the appendix exists so a contributor can scan everything in one pass without jumping sections. Items already shipped during 2026-05-16 are marked **DONE** for traceability and will be pruned on the next refresh.

## 0.9.5 — 2026-05-16

### Added
- **`docs/HANDOFF.md`** — running operational record (critical landmines, authoring model, sessions roadmap, infra ledger, open design questions, what shipped recently). Ported from the per-user memory file so both contributors and Claude across machines share one source of truth.

### Changed
- **CLAUDE.md session-start reading list** is now explicit and ordered: CLAUDE.md → `docs/HANDOFF.md` → `IDEAS.md` → `SCHEDULE.md` → `AGENTS.md` → memory feedback files. Previous version listed the memory handoff; that file is now a one-line redirect to `docs/HANDOFF.md`.
- **`IDEAS.md` Now/Next refreshed** after the four `0.9.x` ships. Now: browser-verify, the `00:00` mystery, one more non-F1 `sessions.json`. Next: Supabase scoping, public-data research, non-F1 `rounds.json`, endurance grouping audit, SEO baseline.
- **`SCHEDULE.md` Saturday closed** (five ships logged); Sunday plan now concrete (verification, mystery resolution, one curation pass, first PR-flow rehearsal).

## 0.9.4 — 2026-05-16

### Added
- **`CONTRIBUTING.md`** — branch / PR / review / commit / hot-fix / conflict rules for a two-person codebase. Trust-based discipline (no enforced branch protection yet).
- **`ONBOARDING.md`** — walkthrough for Paddock contributor #2 (stack, code layout, non-obvious conventions, local setup, first-contribution suggestions).

### Changed
- **CLAUDE.md commit & branch conventions** reversed: Paddock is now a two-person project, default flow is feature-branch → PR → preview review → squash-merge. The prior "push directly to main, no PR review" line was correct for solo work and is no longer accurate.

## 0.9.3 — 2026-05-16

### Changed
- **CLAUDE.md operating manual matured.** Imported the ESPA protocol (Evaluate / Scrutinize / Present / Await before every non-trivial action) from sibling projects, plus seven extensions (mid-failure recovery, senior-engineer self-check, pre-mortem one-liner, verify-the-obvious, plan-level negative space, memory drift check, realistic-scope-and-single-plan-focus). Added a Mode awareness section (plan-mode triggers vs execute-mode), four communication discipline rules (mistake-flagging, source-citation, file-creation gate, formatting discipline), and reversed the previous commit-attribution policy — commits no longer include `Co-Authored-By: Claude` lines. Non-runtime; affects how future sessions execute work.

## 0.9.2 — 2026-05-16

### Added
- **Repo operating docs.** `CLAUDE.md` is now a real operating manual (replaces the one-line `@AGENTS.md` shim), `IDEAS.md` is the project-wide idea ledger with Now / Next / Inbox / Parked / Killed sections, and `SCHEDULE.md` holds the day-by-day time plan. Non-runtime files — no user-visible change — but establishes the working agreement and triage cadence for every future session.

## 0.9.1 — 2026-05-16

### Fixed
- **Phantom "3 am" session times** on every non-F1 series (MotoGP, WEC, F2, F3, IndyCar, IMSA, WSBK, WRC, DTM, GT World, NASCAR Cup, NLS, Formula E). Their upstream calendars only publish a date — no hour — so node-ical was anchoring those events at UTC midnight, which Europe/Athens then rendered as 02:00–03:00. Sessions now carry a `dateOnly` flag from the parser; UI renders **"TBC"** instead of a made-up time, live-now and the notification cron both ignore them so no false "starts in 30 min" pushes fire.
- **Wrong F1 round numbers.** The Canada page was titled "Round 3" when Canada is actually round 5 of the 2026 championship. Round numbers were the array index in our windowed sessions list; with Bahrain + Saudi cancelled and Australia + China already in the past, the index had drifted from the FIA-canonical number. Weekend pages now use canonical round numbers sourced from `content/series/<slug>/rounds.json` (F1 2026 seeded with the full 22-round calendar), with a graceful fallback to index+1 for series that haven't been curated yet.

### Added
- **Session overrides** at `content/series/<slug>/sessions.json` — when an upstream feed only ships a date-only weekend marker, a sidecar file fills in the real timed sessions. Seeded with **Formula E Monaco E-Prix 2026** (rounds 9 & 10 double-header, real CEST timings from fiaformulae.com).
- **Round metadata** at `content/series/<slug>/rounds.json` — canonical FIA round numbers + race-weekend date ranges, used to keep the weekend page's "Round N" label honest even when upstream feeds skip cancellations or trim past races.

## 0.9.0 — 2026-05-16

### Added
- **Race-weekend pages** at `/series/[slug]/weekend/[round]`. Each weekend gets its own first-class page: hero with countdown / live / past badge, multi-day weather strip (one tile per session day), schedule grouped by day, standings snapshot ("Going into round N" for F1; link-out for other series), and news filtered to the weekend window. The home hero, Live-now cards, and Calendar weekend blocks all click through here.
- **Weather chip on home Upcoming session cards.** Previously only the hero showed forecast; the day-grouped list now does too. Lookup widened from the next 5 to the next 12 sessions (still de-duped per circuit).

### Fixed
- **Weather forecast pulled the wrong day** for evening sessions whose UTC date differed from venue-local date (e.g. anything in the Americas). Open-Meteo returns daily entries in venue-local timezone; lookup now respects that.
- **Round numbers on non-F1 weekend pages** appearing in the hundreds (Formula E /121, MotoGP /323, WSBK /193). The weekend-grouping algorithm was iterating over years of historical ICS data; it now clamps to roughly the current season.

## 0.8.0 — 2026-05-15

### Added
- **`paddock-tracker.com`** — custom domain via Vercel registrar, Clerk Production active with Google OAuth, public-with-account auth (everything is browseable signed-out; only prefs/push/settings need sign-in).
- **Vercel Analytics + Speed Insights** wired site-wide. Visitor counts + Core Web Vitals collection live.
- **Live now home section** — pinned red strip above the hero whenever any followed-series session is in progress.
- **MDX blog at `/blog`** — file-based posts under `content/posts/*.mdx`, RSS feed at `/feed.xml`, `<YouTube id="…" />` component available in posts.
- **Drivers + Teams detail pages** at `/drivers/[slug]` and `/teams/[slug]` (foundation; full enrichment still to come). Names in F1 Drivers tab are clickable when rendered from curated data.
- **Full F1 season results panel.** Race-by-race, native `<details>` per round, top-10 finishers per race, most recent round open by default.
- **Drivers' season trend chart** on F1 Results — Recharts line chart with toggleable drivers; top 6 by points enabled by default.
- **Full standings grid** (drivers + constructors) — no more top-10 slice. F1 now shows all 20–22 drivers.
- **Champions tab grouped by decade**, all entries shown (cap raised 50 → 200). Points hidden until parser can disambiguate columns reliably.
- **Notifications: per-series accent colour, action buttons, mute-series flow.** Tap "Mute series" on a push and that series stops paging you. Brand-coloured chip on every notification.
- **Per-user notification sound toggle** in Settings. When off, pushes are silent + no vibration.
- **ADAC Ravenol 24h Nürburgring** added (yellow accent; calendar feed still TBD).
- **Weather forecast chip on the next-session hero** — temp range + condition emoji + rain chance.
- **Curated content layer.** Every editable surface (drivers, champions, results overrides, standings overrides, series meta, overview, significance, fallback ICS) has a file home under `content/series/<slug>/`. Renderers prefer curated files; external APIs are fallbacks.
- **News series filter chips** on the home feed when multiple series have stories.

### Changed
- **Sign-in is no longer required to browse.** Drop the force-sign-in gate from `0.5.0` — site is public; account only needed for prefs/push.
- **About tab** now folds in `content/series/<slug>/overview.md` when present. Real F1 overview content written.
- **Drop Teams tab** as a top-level series tab — it was redundant with Drivers (already groups by team).

### Fixed
- **Wikipedia "Cite error" paragraphs and COinS metadata** stripped from Rules / History tabs.
- **Points-system tables transpose vertically on narrow screens** instead of horizontal-scroll. Handles tables with a "Point system for X" caption row above the position labels (F3 / Formula E shape).
- **Drivers parser rejects junk-table lineups** — `<= 3` char teams, ":"-containing teams, column-header leakage ("No.", "Source", "Chassis", etc.), and requires ≥ 4 credible teams.
- **F1 2026 entries table** with multi-row header (`Race drivers` colspan=3 + sub-header) now parses; broadened bracket-annotation stripping (`[a]`, `[N 1]`, `[lower-alpha 2]`).
- **Drivers parser merges same-team rows** when source table omits rowspan grouping.
- **F1 Champions** points column hidden as workaround for Wikipedia disambiguation page rename; lookup updated to `List_of_Formula_One_World_Drivers'_Champions`.
- **Onboarding wizard** no longer shows a misleading "Browser asks for permission once you tap Enable" cue when push permission is already denied.

## 0.7.0 — 2026-05-14

### Fixed
- **F1 Drivers tab showing driver numbers instead of names.** Wikipedia season-table scraper picked the "No." column as Driver because the substring match was too loose. Now skips numeric headers and filters numeric-only "names" from results. Added a sanity check that rejects a parsed table if most rows end up empty.
- **History/Rules sections rendering Wikipedia's table of contents** as a list of underlined non-links. Strip `.toc`, related TOC classes, and unwrap dead `href="#anchor"` links.
- **Wikipedia tables overflowing the viewport on mobile** (points-system grid, regulations tables). Each `<table>` now wraps in a horizontally-scrollable container with sane dark-themed cell styling.
- **Wikipedia inline cell colors** (medal-position golds/silvers) stripped — they didn't belong in our dark theme.
- **Champions table truncating constructor names** to "T…", "M-…", "Vol…". Mobile now stacks constructor under the driver line so the full team name is always visible.

### Added
- **PWA install prompt.** Auto-detects:
  - Android Chrome / desktop Chrome → real install button via `beforeinstallprompt`
  - iOS Safari → instructions to "Add to Home Screen"
  - iOS non-Safari (Chrome, Firefox, Edge) → explains push only works after installing via Safari
  Dismissible (persisted in localStorage). Hidden when the PWA is already installed.
- **Drivers tab fallback** when no parseable lineup exists — clean card with Wikipedia + official-site links instead of "Coming soon".

## 0.6.0 — 2026-05-14

### Added
- **Custom 404 page** with the dark theme + warm/cool accent corners and quick links home / calendar.
- **Layered background.** Warm amber wash top-left, cool blue wash bottom-right, faint grain over everything — escape the flat black.
- **"Preferences" item directly in the avatar dropdown.** Click avatar → Preferences (opens the profile modal to the right page in one tap).
- **Notification preferences.** New section in Preferences with per-type toggles: Session reminders, News articles, Race week summary. Stored in KV.
- **`/api/cron/race-week`.** Runs every Monday morning (`0 8 * * 1` UTC = 11:00 Athens). For each user, finds followed-series races in the next 7 days and sends one summary push per series, deduped by ISO week.
- **`/api/user/notif-prefs`** GET/PUT endpoint.

### Fixed
- **Existing users seeing onboarding wizard.** Wizard checked a server flag that didn't exist for accounts created before 0.5.0. `/api/user/onboarded` now backfills the flag if the user already has followed-series in KV.
- **Onboarding waiting on cookie banner.** Wizard no longer gates on cookie consent decision — both can show independently.

## 0.5.0 — 2026-05-14

### Changed
- **Sign-in is now required.** First visit redirects to `/sign-in`. Users either log in or sign up — onboarding wizard auto-triggers after sign-up only.
- **Onboarded flag moved to server (KV).** No more device-bound localStorage flag — your onboarding state lives with your account.
- **Profile avatar moved into the header**, right of the Coffee button. Same on mobile and desktop.
- **Preferences live inside your account.** Click avatar → Manage Account → "Preferences" tab. The standalone `/settings` URL still works as a fallback.
- **Drawer cleanup.** Settings link removed (it's in the profile now). Account section removed (avatar is in the header).

### Added
- **Header utility bar.** Contact + Buy me a coffee + Avatar — sticky on every page.
- **Contact form modal.** Click "Contact" → modal with email + message. Submissions saved to KV (`paddock:contact:*`), optionally emailed via Resend when `RESEND_API_KEY` + `CONTACT_TO_EMAIL` are set.
- **`/api/push/inspect`** — lists your registered push devices (provider, endpoint tail, createdAt) so you can debug which device a "1 delivered" went to.
- **`/api/push/test` is now user-scoped** — sends only to your subscriptions and returns per-device results.

## 0.4.0 — 2026-05-14

### Added
- **Sign in via Clerk.** Optional account for cross-device sync. Drawer → Account → Sign in. Email + Google etc.
- **Followed-series sync.** Signed-in users have their followed list saved in Vercel KV and synced across devices. Signed-out users stay on localStorage.
  - One-time migration on first sign-in: local prefs (if any) are pushed to KV when KV is empty.
- **User-aware push notifications.** Subscriptions now associate to a Clerk user when authed. Cron filters per-user followed series so you only get pings for what you follow.
- **Daily news push (`/api/cron/news`).** Polls every series' motorsport.com RSS, sends a push when there's a brand-new top story. KV stores `lastLink` per series to dedup. First run for each series is a silent cold-start.
- **GitHub Actions cron (`.github/workflows/notify.yml`).** Hits `/api/cron/notify` and `/api/cron/news` every 15 min. Uses repo secret `CRON_SECRET` if set.
- **Sign-in / Sign-up pages** at `/sign-in` and `/sign-up` using Clerk components with dark theme.

### Changed
- **EnableNotifications on /settings** uses the same `/api/push/status` check as the onboarding wizard — no more false "Enabled" when KV is missing.

### Known limitations
- **Session-level feeds for F2 / F3 / IndyCar / MotoGP** are not currently available. The nixxo public URLs that used to expose these returned 404 since the source moved. No working public alternative found yet. Round-level data (championship calendar) is still ingested.

## 0.3.0 — 2026-05-14

### Added
- **Home tabs.** Hero stays at top; tabs below switch between **News** (default, top 8 across followed series) and **Upcoming** (next 24 sessions grouped by day). Preference remembered in localStorage.
- **Footer: Contact & Buy me a coffee.** Configurable via `NEXT_PUBLIC_CONTACT_URL` / `NEXT_PUBLIC_COFFEE_URL` env vars.
- **`/api/push/status` endpoint.** Reports VAPID + KV configuration so the client can tell when the server isn't ready.

### Fixed
- **Mobile sticky header.** `overflow-x: hidden` on body was killing `position: sticky`; switched to `fixed` with content-area top padding so the Paddock bar stays put while scrolling.
- **Long session titles overflowing cards on phone.** Title span lacked `min-w-0` inside its flex parent, so its nowrap intrinsic width pushed the card past the viewport. Now truncates as designed.
- **Onboarding "Enabled" lie.** Wizard now checks server push readiness before reading the local subscription. When Vercel KV isn't connected, you see a clear "storage isn't connected yet" message instead of a false ✓ Enabled.

### Removed
- **"Replay onboarding" from Settings.** Redundant — the same series picker lives on `/settings` already.

## 0.2.0 — 2026-05-14

### Added
- **Full season on Calendar.** Calendar no longer caps at 100 sessions; shows every upcoming session through the end of the season for each followed series.
- **Versioning + Changelog page.** Footer now shows the app version, links to this changelog.

### Fixed
- **Hero card respects followed series.** The "Up next" card on Home previously ignored your followed-series preference and showed the soonest session across every championship. It now respects your `/settings` selection.
- **Long-location truncation.** Session cards used to truncate full street addresses (e.g. "Circuit de Spa-Francorchamps, Route du Circuit 55, 4970 Stavelot, Belgium"). Now show only the venue name.

### Infra
- Web push notifications back online (VAPID + Vercel KV + cron). KV must be connected in the Vercel dashboard for subscriptions to persist.

## 0.1.0 — Initial

- PWA shell, multi-series ICS ingest, session grouping by day/weekend, series detail pages, followed-series filter (localStorage), settings page.
