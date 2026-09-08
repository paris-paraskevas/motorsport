# Paddock — ideas ledger

Single source of truth for **open work only**. Completed items are NOT kept here: they live in git history + `CHANGELOG.md` + `docs/HANDOFF.md`. Time-based plans live in `SCHEDULE.md`.

**Re-triaged 2026-08-28 (session 41), 240 lines → 182.** Three stacked session-close blocks and two "cleared / kept for the record" lists were deleted rather than archived, and three overlapping Inboxes were merged into one. Everything removed was **verified closed against prod first**, not assumed: `/social/leagues` framing, the site-wide og:image fault, the "Vercel KV" comment sweep, the CSP promotion to enforcing, and `/api/push/history`. Two figures were corrected in the opposite direction from the one they were recorded in — the Worker bundle has **553.5 KiB** of headroom, not 19.35, and `.supabase-pat` is **dead**, not alive.

**Rules:** one line per item; group into batches; delete an item when it ships (history is the record); re-triage at session end.

---

## NOW — the active front (re-triaged 2026-08-28, session 41)

1. **1.0 is one commit away and waiting on a machine.** Copy signed off, §A9 complete, name chosen: **`# 1.0 · Lights out`**. The flip is `active: true` in `lib/whats-new.ts` + `package.json` → `1.0.0` in ONE commit, then `npm run indexnow:submit`. **Blocked only on `warm-live-data` going green on a SCHEDULED run** (operator's TIER 0 gate, chosen over flipping early). The fix is proven three ways — `lockfile:check` under npm 10, and two successful manual runs — so this is GitHub's scheduler, not a defect. **Then, and only then**, set `DATA_SOURCE=db` on the Cloudflare build: it is correct (10 upstream fetches → 0, build 89 s) but it REMOVES a writer, and builds are currently the only one running.
2. **THE IMAGE SESSION** — still the biggest rock, unchanged (operator, 2026-08-20: "the biggest job we have ever done"). Flood the site with clear, distinct visual subjects. Hard constraint from past kills: portraits ×14 and team logos died on LICENSING, so every image needs a licence-clean source. Riding with it: the home page refined with images + boxes to series/calendar, driver-radio embeds via OpenF1 `team_radio`, the 19 blog posts with no cover, and the `/series/f1/champions` preload waste.
3. **The image/positioning brief (GEO)** — AI engines describe Paddock as web-only, 4-series, no journalism, no notifications. All wrong. Sharpen `/about` + `llms.txt` as the canonical self-description, structured data, and comparison-proof pages. Needs a dedicated session + operator taste.
4. **AdSense thin-content, what is left.** The record cohort is DONE (23/23, median 58 → 221 words). Remaining: **~215 who-won pages under 130 words**, almost all the ADAC 24h family — the session-39 recommendation is to **accept them short and fix the noun instead**, because `driversTitleWord` calls a one-race win a "drivers' title" on 70 pages plus 2 record pages, which is a correctness bug rather than a length one. Plus ten generated country pages, and the driver-bio waves.
5. **Social presence is live and needs feeding.** Accounts created on all five with a first post each. The four-week calendar, per-post copy and asset pack are in `docs/research/2026-08-28-social-presence.md`; the launch-day sequence stays in `docs/research/2026-07-06-launch-marketing.md`. Operator chose the BRAND account on Reddit against the recommendation — worth watching for how the subs react.
6. **Information hubs are the last pre-Paper surface.** Queue the restyle with the image session.

**Accepted rather than fixed — server errors surface ONLY in Cloudflare's logs (operator, 2026-09-04).** `app/error.tsx` reports nowhere else. Weighed against Sentry (affordable again, 553.5 KiB of headroom) and a self-hosted sink, and both declined. This is §A8 of the launch checklist, shipped in 1.0 as a knowing risk. It gets worse the moment traffic is not low, because a route-level error is invisible unless someone opens the Cloudflare dashboard.

**Accepted rather than fixed (operator, 2026-08-28):** everyone is signed out every **7 days** — Clerk's Maximum lifetime at its default, Inactivity timeout off. Raising it is Pro-gated and the operator will not pay, so this is now a known property of the product, not a bug. Browser storage limits can end a session earlier still, which is why the installed Android app feels worse.

## Blog contract (REVISED mid-session, operator 2026-08-20 evening)

Superseded the fact-packs-only contract: **"i want you to read my previous blogs. then give me a draft."** So Claude drafts in the operator's voice (learned from the 20 published posts), the operator approves. Still standing: fact packs back every number (`factpack-*.md`), RULE #1 on every claim, house style (no em dashes, no AI tells, always link out), **never public MDX, never a DB write** — the `.md` draft waits for approval, then `scripts/draft-post.mts` inserts it as a prod DB draft with `publish_at` null.
- **The whole Dutch GP set is PUBLISHED** (operator, 2026-08-24): Friday, sprint, qualifying and the race recap drafted in session 34. The qualifying post's forward-looking "Race day" section shipped stale and was **re-tensed on the live row** with the operator naming the action, and now closes by paying off its own prediction and linking the race recap.
- **The lesson to carry:** a session recap written before the next session runs will go stale the moment it is published late. Write the closing section so it reads correctly whenever it ships, or flag it at the top of the draft rather than in a comment nobody reads at publish time.
- Voice reference, established quantitatively 2026-08-23 by profiling the published preview: **results tables beside the prose** (not instead of it), ~9 outbound links, 20+ internal, three-sentence paragraphs, opinion stated plainly, a verdict section, a bold "For the books" list, an italic photo credit, zero em or en dashes.
- Operator also wants, going forward: **images in every post** (Commons/CC with credit, eyeballed before use) and **driver-radio embeds** via OpenF1 `team_radio` (player UX + rights stance to design).

## Triage history

Sessions 35-37 closed the champion-notes programme (489/489, fifteen families), the changelog restructure, the og:image fault, the mobile calendar, the blog covers, the landing retirement and the AdSense audit. **Those blocks are deleted rather than archived — git, `CHANGELOG.md` and `docs/HANDOFF.md` are the record**, and this file is for open work only. The items they raised that are STILL open have been folded into the Inbox below.

## Inbox — merged and deduped 2026-08-28 (session 41)

Three overlapping inboxes (2026-08-20, 08-24, 08-26) collapsed into one. Items verified shipped were deleted, not struck through: `/social/leagues` play-money framing (0.334.93, confirmed on prod), the site-wide og:image fault (0.334.37, confirmed — ten route types all emit absolute URLs), the mobile calendar, the `/blog` cover listing, the blog SEO pass, the What's-New modal (0.334.66) and the §A9 announcement surface.

**Bugs and defects**

_(Removed 2026-09-04: blog editor autosave. **Already built** — `components/studio/useDraftBackup.ts`, wired into BOTH writing surfaces with a "Unsaved draft found / Restore it / Discard" banner. localStorage only, deliberately: a debounced PATCH would keep rewriting a row that may be sitting in the review queue. Claude asserted twice that this did not exist, having searched `components/blog/` and `app/(app)/studio/` but not `components/studio/`; the operator was right both times.)_
- **`useDraftBackup` has no test**, and it carries subtle invariants: the frozen `useSyncExternalStore` read (so the banner does not reappear while typing), and the `if (!recovered) dropSnapshot(key)` guard that stops the hook deleting the very snapshot it just offered. Both are exactly what a refactor breaks silently. Testing it properly needs Testing Library, which is itself a parked decision.
_(Removed 2026-08-28, operator-confirmed: "the home page shows one post on mobile" is not a defect. `HomeLead.tsx:287` is `hidden … xl:block` DELIBERATELY, and the comment records the reasoning from 2026-08-21 — below xl the column is already full and the band would grow taller than its own picture.)_
_(Removed 2026-09-04: the empty-tab metadata item. **Already fixed in 0.334.88** — `tabIsEmpty()` in `components/SeriesPageView.tsx:60` covers both empty states, and prod confirms it: `/series/nls/standings` serves `noindex, follow` and is out of the sitemap, while `/series/f1/standings` serves `index, follow`.)_
- **`gt-world` has no era-name handling.** `seriesNameForYear` special-cases F2 and F3 so their pre-rebrand seasons read "GP2 Series" / "GP3 Series", but 2014-2019 GT World pages say "GT World Challenge" when the series was the **Blancpain GT Series** — a name `constructor` already carries for exactly those rows. One `if` in the shape of the existing two.
- **The footer's first link is labelled "Landing"** and points at `/`, which since 0.334.42 *is* the home page. One word, but a copy call.
_(Fixed 2026-09-08 in 1.0.34: the `/series/f1/standings` stylesheet-served-as-HTML error. Not a missing file: the page's HTML, its 22 script chunks and the current build never named `0ej-ohiw8omjz.css`. The browser's own request list showed the failing fetch right after a burst of `/blog?_rsc=` prefetches answered from the browser cache, and those payloads carry OpenNext's hard-coded `s-maxage=N, stale-while-revalidate=2592000` with no max-age, so a browser reuses a month-old payload from a previous build, chunk names and content included. `worker.ts` now rewrites HTML and RSC responses to `s-maxage=N, max-age=0, must-revalidate`, Vercel's default for the same pages; `lib/cache-headers.ts`.)_

**Content gaps**

- **No "how an F1 race weekend works" answer.** 13 of 15 series have one. **Re-verified 2026-08-28: still a 404.** The one real content gap, and it feeds the AdSense case.
_(Removed 2026-08-28: "19 of 24 blog posts have no cover". The count is accurate but the operator does not consider it an issue, so it is not open work.)_
_(Removed 2026-09-04: MotoGP 2009 `wins`. Filled with **6** — corroborated by Wikipedia’s race table counted round by round (Spain, Catalonia, Netherlands, Germany, Czech Republic, San Marino) and by the season summary, and consistent with our own champion note. All 77 rows now carry a value.)_
- **The era suffix in `constructor` reads as noise** now those pages are indexed: 9 of 16 F3 rows and 12 of 21 F2 rows carry "ART Grand Prix (GP3 Series)", so a page titled "Who won the 2016 GP3 Series championship?" says "…with ART Grand Prix (GP3 Series)". Cosmetic, two families.
- **A derived-prose sweep is owed.** Twice now a generated sentence has stated a count or a "first" its source data cannot support (Formula E's record line 0.334.54, crew title counting 0.334.61, and the four `champions.json` errors found in session 39). Worth one pass over the other derived sentences — "different drivers crowned", the secondary-championship line — for the same shape.

**Debt and housekeeping**

_(Superseded 2026-09-08: the Worker-size item. **Cloudflare removed the compressed limit on 2026-09-04**; only uncompressed size counts now, 64 MiB on every plan. Our dry-run reads Total Upload **41704 KiB** against **65536 KiB**, so the bundle has about a third of the ceiling free and the OG-card runtime is no longer a lever worth a session. CLAUDE.md's "at the ceiling" law is corrected in the first Phase 1 PR.)_
_(Removed 2026-09-08: "`.supabase-pat` is DEAD". The operator regenerated it on 2026-09-07 ("paddock-september", expires 2027-08-31); it applied migration 20260907190000 to prod the same evening. Live.)_
- **Orphan sweep**: `LandingNav`, `LandingFooter`, `LandingAuth` have zero importers since the landing retirement. Nothing imports them so they cost nothing at runtime.
- **`content/information/tracks.json` (87.45 KiB gzipped) stays in the Worker** — the RELEASES.md trick does not transfer, because `/information` revalidates hourly and so re-renders where there is no filesystem.
- **`/series/f1/champions` preloads four Wikimedia portraits it never paints.** Warnings only, but four ~500 KB images fetched for nothing. For the image session.
- **Remote-branch audit** — 328 non-core branches on origin; the session-26 prune never reached the remote. Split merged-safe (delete) from unique-commits (operator's word per branch).
- **The splice/writer script is still not in the repo.** Recreated twice now from the queue's description, and it carries real invariants (derived order, byte-scanning order guard, one-lead check). `scripts/` is its home.
- **Vitest under load** — fork-worker start timeouts reproduce when a dev server runs alongside. Pin `maxWorkers`, or document "no suite under dev" in CONTRIBUTING.
- **Legacy lint cleanup** — re-audit `react-hooks/set-state-in-effect` (15 files; real errors vs suppressions, and the charter bans silencing); DRY `EnableNotifications` / `OnboardingWizard`; the championship-leader all-deselected empty state.
- **A deterministic loader called once per test is pure cost** — the lesson from the 0.334.32 vitest fix. Worth one sweep of the other test files for the same shape.
- **PSI re-measure owed** — root, standings and weekend, to capture the deltas from the four fix packages. A free PageSpeed API key would let this be scripted instead of clicked twenty times.

**Product asks, not yet scheduled**

- **A support centre, not just a feedback tab** — fold `/feedback` triage (API exists, no UI), contact messages (`/api/contact` → KV) and thread moderation into one console surface, then add transactional email on top: a welcome email on sign-up, and replies to feedback from the console. `app/api/webhooks/clerk` and `lib/email.ts` are the seams. Decide the provider before any code.
- **The home composer needs refining** (operator, with a screenshot of `/admin/home` signed in — so the console does render). Specific refinements not named; ask before designing.
- **Composer round 2**: the eye icon with no at-a-glance state, whether `Published` reads as state or action, whether the preview should scroll with the dragged band.
- **A day page between the weekend and the session** — a Friday / Saturday / Sunday layout carrying that day's forecast, the news that broke, blogs and sessions. `forecastWindow()` + `HourlyForecastRows` drop straight in and the weekend page already groups by day. A layout decision, not research.
- **Street View corner tours + layout history on `/tracks/<slug>`** — a corner-by-corner walk carrying each corner's name, why it is called that, and what happened there; plus previous layouts and why each changed. Pairs with the circuit map.
- **Circuit map on the track pages** — an OpenStreetMap view from above, or a link out to the official map. Check `feat/tracks-map` first: it already carries leaflet, and a blind conflict resolution on leaflet broke prod once (2026-07-09).

**F1 upgrades — now a habit rather than a project**

The ingest exists as of 0.334.103: `npm run upgrades:draft` does discovery, fetch, extraction and emission, and the review is the git diff. **Deliberately not in CI** (operator, 2026-08-28) — the parser is welded to Xpdf 4.00 and the human review step does not go away, so automating the one command that is already easy buys nothing. Round 13's FIA document publishes **Friday 4 September**; the cadence is one draft per Grand Prix, checked against the PDF.

## A "connection is secure" interstitial — operator ask, 2026-08-22, RECOMMEND AGAINST as asked

**The ask:** the Cloudflare page some sites show on click-through that says your connection is being checked or is secure, "it shows that we are legit".

**What that screen actually is:** a Cloudflare **Managed Challenge / Under Attack Mode** interstitial. It is not a trust badge, it is security *friction* — Cloudflare shows it when it wants to test whether a visitor is a bot. Turning it on for everyone costs:

- **Several seconds on every first page view.** We spent session 30 killing a 7 s document stall and got the landing to a 0.63 s TTFB; this would hand that back and then some, on the one metric Google ranks.
- **Crawlers get challenged too.** Googlebot and Bingbot hitting an interstitial is an indexing risk, and the AdSense review is still pending — a reviewer meeting a challenge page is the worst possible first impression.
- **It reads as "this site has a security problem"** to a fair number of people, which is the opposite of the intended signal.
- It is a **prod infra change** (Cloudflare dashboard, Security → Settings, or a WAF rule), so it needs the operator to name the action regardless.

**What actually signals legitimacy, and what we already have** (measured on prod 2026-08-22): `Strict-Transport-Security` with `includeSubDomains; preload`, a Content Security Policy, `Permissions-Policy` locking camera/mic/geolocation and denying FLoC and Topics, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`. That is a stronger security posture than most sites showing that interstitial.

**Sharper versions of the same goal, if the operator still wants the signal:**
1. ~~**Move the CSP from `report-only` to enforcing.**~~ **DONE 0.334.17.** The stale `va.vercel-scripts.com` entry went in 0.334.2, `static.cloudflareinsights.com` was added in 0.334.6, and the operator took the baked-in decision on 2026-08-24: `fundingchoicesmessages.google.com` stays **off** the allow-list, so Google's Funding Choices consent UI is now genuinely blocked. Our own modal has owned consent since 0.12.6.
2. ~~**Turnstile on the contact and write-for-us forms**~~ — **DECLINED 2026-09-04.** There is no spam problem, and the ask behind this was "show that we are legit", not "stop bots". A captcha with nothing to stop is pure friction on the two highest-intent forms on the site. Option 3 below does the same job for nothing. Revisit only if spam actually arrives.
3. **Say it in words on `/about`**: one honest line about how the site is hosted and secured, which is what a visitor deciding whether to trust it actually reads.

## AdSense-readiness content (live again — the rejection makes it current)

- **Original driver bios, remaining grids** — NASCAR 36 / DTM 21 / WRC 9 / F2 / F3 via the proven solo-wave method (Wikipedia intro + per-series corroborator + style gate, waves of ≤5); RULE #1, no thin pages. **Re-verified 2026-08-28: none of those five has a `bios.json` at all, so the whole item stands.**
- **More `/information` answers** only where real search demand exists — the session-17 no-duplicates kill rule stands.

~~Champions depth ×11~~ — **deleted 2026-08-28, complete.** Verified: **489 champion notes across all 15 families**, and the points/wins/runner-up backfill went with it (0.334.77). The line also said "ADAC 24h + NLS never", which 0.334.81 disproved by writing all 70.

## B-perf (remaining levers after the 0.321.2 landing-stream fix)

- Unused-JS treemap hunt (~100-130 KiB across three shared chunks on `/`) · render-blocking CSS (23 KiB / 820 ms on slow-4G) · 13 KiB legacy polyfills (browserslist) · COOP. Re-baseline in `docs/perf-baselines.md` after each change.
- **CSP enforce is DONE** and removed from the list — verified 2026-08-28, prod sends zero `Content-Security-Policy-Report-Only` headers.

---

## DREAM — the operator's console (operator, 2026-08-21)

Not scheduled. Recorded because it is the direction, and because three pieces of it have already been built once.

**The ask, in the operator's words:** be on an "admin" Paddock Tracker that controls what is shown *globally* on the home page — which blog leads, which series has priority — with drag and drop to move the boxes around, sideline and archive them, and slots that can link our own articles, motorsport.com's, or anything else. Then the same idea on the Learn pages: a small pencil visible only to me, to edit the text, add images, or anything else.

**Two halves, and they are not equally hard.**

1. **Home-page composition.** A logged-in editor mode over `/app` where the bands are draggable, hideable and archivable, and each slot can be pinned to a chosen post, a series, or an external link.
2. **Inline editing on Learn.** A pencil on `/information/<topic>/<slug>` that turns prose into an editable field, accepts images, and saves.

**Prior art in this repo — start by reading these, not from scratch:**
- **`#495` `feat(home): 'Make your own home' in-place editor button`** — a home in-place editor already existed. It was almost certainly removed in the 2026-08-18 editorial-home cutover ("full cutover, no survivors"), so the first job is `git show` on that PR to see what it did and why it went.
- **`#386` `feat(blog): in-page draft editing (0.160.0)`** plus `docs/superpowers/specs/2026-07-03-draft-inline-edit-design.md` — **the pencil already exists for blog drafts.** `components/blog/DraftPreview.tsx` and `MarkdownEditor.tsx` are the working pattern; the Learn half is mostly a matter of pointing it at a different content source.
- **`#649` `feat(blog): the studio`** — the dedicated admin surface already exists, so this does not need a new home.

**The two real obstacles, so nobody rediscovers them the hard way:**
- **ISR.** `/app` is `revalidate = 300` and deliberately identical for every visitor — `app/(app)/app/page.tsx` says so, and that sameness is what makes it cacheable. Operator-chosen ordering has to come from a config the *server* reads at render (KV or a Supabase row), never from per-user state, or the page stops being cacheable and the landing-stall class of bug returns.
- **Learn content lives in files, not a database.** `content/` markdown is the source of truth and `/information` **memoises its registry per process**, so an edit needs a deliberate invalidation path (a CLAUDE.md landmine: a content edit currently needs a dev restart to surface). Editing live means either committing to the repo from the UI or moving that content into Supabase. That is the fork in the road and it should be decided before any code.

**Update 2026-09-07 — the DREAM became a programme, and the fork was taken: Supabase.** The operator's direction is an Oracle-APEX-style Page Designer that edits Paddock from database rows, with no AI in the design path ("I'll use AI for research for articles but not for site design"). Plan of record: the **Paddock Designer Field Guide** artifact (`6fb2f726-1b9d-4226-bfc4-5cb594b6b124`), sections 03–07: one enforced write path per table (updated_at checks for design rows, run-id swap for data rows), revisions not overwrites, provenance on every load, ISR plus a `/api/cron/revalidate` nudge, `PADDOCK_ENV` so previews cannot write, the database as the audit trail. Prototype: artifact `cf8ff9e2-bc1c-4dcc-8239-2e6d3f8da713` (v2.4). **Phase 0 shipped in #907 (1.0.28)**: `source` · `source_run` · `standing` · view `standing_current`; the loader writes one run per series; the F1 standings tab reads rows behind `DATA_TABLES=on`; the migration awaits the operator naming it. Phase 1 (design tables, the environment gate, draft/publish with a version check) is next.

Follow-ups the reviews surfaced, none started:
- `lib/analytics/cloudflare.ts:76` sums every Worker on the account (prod plus three previews): add `scriptName: "motorsport"`. The Traffic tab's Cloudflare panel (`app/(admin)/admin/traffic/page.tsx:218-220`) is a placeholder with no fetcher. The `billable-usage` endpoint is marked deprecated; re-verify the replacement.
- The store the code calls KV is Upstash Redis; its developer API (new key) gives throughput, latency and monthly totals.
- Tables nothing records today: `push_send` (per-send status), `indexnow_submission`, `upstream_request` (per-request outcome and latency from the loader), Clerk daily snapshots or `session.created` webhooks for sign-in history.
- `www.wrc.com` answers 403 to GitHub's runners (the WRC standings fallback is in use); `motorsportweek.com` 404s twice per run.
- Cloudflare's limits page now states a 64 MiB uncompressed Worker size with no compressed limit; verify against the 10 MiB gzipped ceiling before either is trusted.
- The two in-Worker data crons (`warm-results`, `warm-sessions`) and the render-time ICS fetches move into the loader in Phase 5.

Fixed today, from the 2026-09-07 bug list: the loader lockfile outage (#902), the What's-New banner quality (#904, #905), the studio lost update (#903), the deprecated Actions runtimes (#906).

## Parked (might do — revisit trigger)

- **Results / standings / rounds body rework** — 0.314.0 kept their table bodies deliberately; **revisit only as a fresh operator ask**.
- **Blog `[[classification …]]` embed** — needs session picking, multi-class handling, a caching stance; **design first, revisit on the next blog-feature push**.
- **Session-page adapter extraction** → `lib/results/session-classification.ts` + tests for `pickRaceForSession` / `pickGtWorldRace` — a pure move. Path corrected 2026-08-28: it is `app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx`, and it is **952 lines**, not the 985 recorded. **Revisit next time that page is worked anyway.**
- **F2/F3 official-schedule parser** (the event pages' RSC payload carries the full timetable; ECAL widget has no raw ICS) — outbound → preview-paired; **revisit if F2/F3 times drift again** (calendars verified clean 08-03).
- **F1 schedule cross-check → prod cron** (`npm run health:f1-schedule` → `/api/cron/health`) — outbound, preview-paired; **revisit after the next schedule-drift incident**.
- **IndyCar session times + results parser** (motorsport.com/indycar) — preview-paired, never merge unverified outbound; **revisit if IndyCar gaps get flagged**.
- **TBC session times — WRC remaining rounds** — curate into `sessions.json` as itineraries publish (wrc.com/ewrc bot-blocked from datacenters); token-heavy, modest value.
_(Removed 2026-08-28: Bahrain GP 2026. It was parked as "NOT confirmed"; it is in fact curated as round 16, live on prod, relocated to Sepang with `rescheduleNote` and both names shown to readers. **Operator confirmed the name is correct as published**, so there is nothing open.)_
- **BMC donor webhook** (phase 2 of the 0.264.0 supporter gate) — auto-flag `publicMetadata.donor` with email matching; **revisit when donations outpace the manual toggle**.
- **Blog reactions polish + likes-based "suggested posts"** (schema already stores `user_id`) — **revisit on blog engagement growth**.
- **Data completeness batch** — F1 classification speed (event-driven warming off `sessions.json`, Jolpica eval) · `withSourceSnapshot` extension to the ~11 remaining `lib/results/*` modules · remaining standings charts (FE / IndyCar / GT-World / IMSA / WEC — points-scale-gated) · results re-check lifecycle (late penalties; Gasly-Monaco precedent) · OpenF1 live-lockout residual + weekend pre-warm · weather lat/lon gap-fill for venues missing from `circuits.json`. **Revisit per item when its gap actually bites**; curation patches as timetables drop remain standing work.
- **Live / race-day batch** — live in-race data feed · per-session results-fetch lifecycle · Live Now expansion · results-table hover + interval + leader-gap columns. **Revisit as a product-direction pick.**
- **Onboard / F1 telemetry phase 2** — broadcast cameras + all-driver roster · 3D track comparison + "did X lift" · cockpit ghost indicator · pit-lane/garage readability + real-geometry P2. **Revisit as a product-direction pick.**
- **Betting & social batch** — real-odds adapter (RapidAPI, house-band clamp, datacenter verify) · multiplier/potential-return on pending bets (data-model decision) · non-F1 markets · grid/quali market types · F2 market go-live + F3 renumber · thread replies/markdown/rate-limit + weekend comments · minigames. **Revisit as a product-direction pick.**
- **UX / IA / mobile batch** — W5 per-page layout spec · information-density pass · old-home-widget remaster · home layout modes/columns · deeper mobile Community tab · assistant phase-2 (grounded Q&A over `/information`) · richer map overlays (geometry-blocked) · weekend sector diagram · season/month recap pages · head-to-head beyond F1 · champions-tab visual redesign · session cards tap-to-expand + home-collapse + back-path · UI/CSS inspiration pass + scroll-driven landing animation · mobile-first audit. **Revisit as a product-direction pick.**
- **Notifications batch** — per-event-type push · custom per-user rules · per-series/per-type sounds · hero images in payloads. **Revisit on notification-engagement signal.**
- **Quality / launch batch** — WCAG 2.2 AA audit + motion/focus/contrast polish · component tests (Testing Library) + Playwright E2E on previews · route best-practices (error boundaries, Suspense, segment configs) · admin content-authoring UI (**trigger: Fotis actually editing**) · Android TWA → Play Store (post-v1.0) · Greek `/el/` route tree · dev/staging environment (operator: maybe unneeded) · feeder-intake Phase 2 (signed uploads >2 MB, Turnstile) · user + consumer research. **Post-v1.0 or on-signal.**
- **Sentry server-side re-introduction** — decide together with the error.tsx re-scope (0.288.0 removed it for worker size; needs the operator's DSN).
- **SEO Phase 2b** — session `force-dynamic`→ISR (F1 `auth()`-gate refactor) + `LocalTime` Athens-SSR canonical time + selective session sitemap. **Revisit only if session pages become an indexing priority**, and not unsupervised.
- **Trending content** — MORE venues + race-weekend "what time" landing content (the ~138 track profiles are already deep). **Revisit when adding venues or on a landing-content push.**
- **GitHub Actions CI** (typecheck + vitest **on PRs**) — still unbuilt; `.github/workflows/` holds only `warm-live-data.yml` and `data-freshness.yml`. Pair-debug a known-green workflow on a throwaway branch first; the operator has zero tolerance for red checks. **Not the same decision as the upgrades pipeline**, which the operator declined to automate on 2026-08-28 for its own reasons.
- **Public README + Mermaid architecture diagram** — post-v1.0 showcase.
- **Era markers / sparklines on Champions** — after a champions.json cleanup.
- **Another "Claude design" depth pass** (background warmth / theming) — after the next user-research pass.
- **GDPR / cookie-consent banner refinement** — revisit at ~500 visitors/day or a real complaint.
- **SoftwareApplication JSON-LD on `/`** — blocked on real user reviews/ratings (invalid without `aggregateRating`).
- **Sportmonks F1 / API-Sports F1** — paid live-timing candidates; MUST test from a preview (datacenter-IP 403s) before adoption.

## Killed (won't do — one-line why)

- **Duplicate zero-click explainers** — every high-demand explainer (DRS/2026, points systems, what-is/whats-new/weekend ×series, differences, rally, most-titles) already exists in `content/information/answers/` + `featured: true`; the gap is authority/indexing (backlinks, Bing/GEO), NOT content, and internal linking shipped session 17. Don't write duplicates. (session-17 audit)
- **Driver portraits ×14 series** (killed 2026-07-12, operator) — long-tail licensing curation, not worth it.
- **Team logos ×15** (killed 2026-07-12, operator) — no free / non-infringing source; keeping copyrighted logos would be a violation.
- **Paddock-coins ledger** — superseded by the betting credits economy.
- **Supabase region move / Cloudflare D1** — Dublin compute co-location realised the latency win; D1 can't host the atomic ledger RPCs.
- **Reverse-engineer fiaformulae/motogp/nascar XHR endpoints** — resolved via Pulselive / Wikipedia / motorsport.com pipelines.
- **Migrate mdx-components to tokens** — the file carries no styling.
- **Notification badge chequered motif** — badge must stay monochrome (`badge-96.png` landmine).
- **AppShell `--tint` lift** — obsolete (the sidebar drawer was removed in 0.17.0).
- **F1 `rounds.json` sprint markers** (killed 2026-08-20) — `sessions.json` already owns sprint structure, and RULE #1 verifies weekend format against the official calendar anyway; a second in-repo copy can only drift. (Zandvoort checked 08-20: our calendar was right.)
- **Blog cadence automation + session-report variants** (killed 2026-08-20) — the operator writes all posts now (the session-30 contract); auto-drafting contradicts it.
- **All-time legends pages** (killed 2026-08-20) — operator: content is close to perfect; long-tail authoring outweighs value.
- **media.json seeds ×11** (killed 2026-08-20) — same call; geo-restriction-audited YouTube curation is heavy for a nice-to-have.
- **Theme-gallery follow-ups** (killed 2026-08-20) — the flagged surfaces are gone (DisciplinesGrid orphaned by the 0.295.0 landing) or fixed (0.317.1 `seriesInk`); the rest was unrequested polish.
- **Blog Share auto-copy** (killed 2026-08-20) — offered once, never asked for again.
- **Heatmap overlay blob customisation** (killed 2026-08-20) — admin cosmetic, no demand.
- **NavPanel Home/End keys + scroll memory** (killed 2026-08-20) — polish without a user signal.
- **Dev hydration-mismatch warning for stored themes** (killed 2026-08-20) — dev-only noise; `suppressHydrationWarning` on `<html>` is a shotgun; revive only if it ever masks a real bug.
- **External cron pinger** (killed 2026-08-20) — crons run in-worker via Cloudflare triggers (`worker.ts` CRON_JOBS); the one GitHub-Actions job left (warm-live-data, */20) is deliberate — it exists for clean egress IPs, which a pinger cannot provide.
- **Offline mode, 7-day SW cache** (killed 2026-08-20) — offline was removed entirely on operator order (0.268.0); this line contradicted that decision.
- _Deleted as fossils at the 2026-08-20 triage (already done or superseded, per HANDOFF 08-04/08-06): the Cloudflare-DNS spot-check `[you]` item · the Bing verification-token item · the "set GA4/GSC/Bing env in Vercel" operator item · the duplicate doc-hygiene line (lives in NOW #6) · the duplicate champions-depth line (lives in AdSense-readiness)._
