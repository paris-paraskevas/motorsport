# Paddock — ideas ledger

Single source of truth for **open work only**. Completed items are NOT kept here: they live in git history + `CHANGELOG.md` + `docs/HANDOFF.md`. Re-triaged 2026-08-20 (session 30; operator: "content close to perfect — clean it up", then "do what you think is best"): fossils deleted, polish killed, big rocks parked with explicit triggers, and the AdSense + image asks promoted to the active front. Time-based plans live in `SCHEDULE.md`.

**Rules:** one line per item; group into batches; delete an item when it ships (history is the record); re-triage at session end.

---

## NOW — the active front (2026-08-20, operator-set)

1. **AdSense "Low value content" recovery — IN PROGRESS, enrich-not-noindex (operator's call).** Audit done (`adsense-low-value-audit.md`, session-30 scratchpad): five triggers, the big one being the 488 who-won pages at 38.7% of the sitemap, flipped indexable 2026-07-31, five days before the Aug-5 verdict. `ads.txt` serves fine (console's "Not found" is a stale Aug-5 crawl, verified 08-20). **Wave 1 SHIPPED 0.324.0**: F1 champion answers 1996-2025 now carry the clinch + the season's story via `content/series/f1/champion-notes.json`, fail-soft so later waves need no code. Remaining, in order:
   - **Wave 2 SHIPPED 0.325.0**: MotoGP 2011-2025, authored inline after its subagent died. Next waves are data only (no code): **F1 pre-1996 completes that family** (recommended first — one complete family beats several partial ones), then MotoGP pre-2011, then IndyCar / WEC / WSBK and the rest.
   - **Non-bio driver pages (~524)**: the bios waves ARE this enrichment; keep them coming (see AdSense-readiness batch below).
   - **Session pages (600-900)**: the unique prose already exists and is sign-in-walled (Race Story). Making it public on completed sessions enriches hundreds of pages at zero authoring cost, and needs the parked SEO-Phase-2b force-dynamic→ISR unpark anyway (also the session page's TTFB-665 ms perf finding). Cheapest verdict-mover on the list — **operator decision on unlocking the perk.**
   - **Indexed stub pages**: the audit's two named strings live at `components/StaleBanner.tsx:11` ("No feed configured — placeholder data only.", also carries a house-style em dash) and `components/tabs/PlaceholderTab.tsx:9` ("Coming soon."). Both are shared components on several surfaces, so the copy is a design call and the real fix is keeping contentless tabs out of the index. **Operator decision.**
   - **News tabs (15 URLs)**: the one family enrichment cannot fix (motorsport.com aggregation by design) — recommend noindex, awaiting the operator's word.
   - THEN tick "I confirm" + Request review, once, when we believe it (reviews run weeks apart).
2. **The image/positioning brief** (operator: "be the choice a person chooses, the place a person feels safe to visit for motorsport"). AI engines currently describe Paddock as web-only, 4-series, no journalism, no notifications — all wrong (it is an installable 15-series PWA with push, a blog and 75 sourced answers). GEO surfaces to sharpen: `/about` + `llms.txt` as the canonical self-description, structured data, comparison-proof pages (broadcast/where-to-watch is the one real competitor edge named). Needs a dedicated session + operator taste.
3. **W8 v1.0 launch program** (promoted out of POSTPONED at this triage) — "out of early access" banner flip + marketing channel plan (IG/FB/Reddit/X/YouTube); checklist done. This is the distribution half of items 1–2.
4. **THE IMAGE SESSION** (operator, 2026-08-20: "the biggest job we have ever done… once all these prs are done") — evaluate, then slowly and surely flood the site with clear, distinct imagery: "humans understand visually" and the missing ingredient is clear visual subjects. Hard constraint from past kills: portraits ×14 and team logos died on LICENSING, so every image needs a licence-clean source (Wikimedia Commons already works for driver-profile portraits; evaluate official press pools / CC sources per series before any wave). Riding with it: **home page refined with clear images + boxes leading to series, calendar etc.** (operator: home is good, refine it), and **future blogs embed F1 driver radio** via the OpenF1 API we already integrate (team_radio per session; player UX + rights stance to design). Layout reference the operator likes (2026-08-20): **Fotis' testing build** — a big series image card beside the lead story, with an UP NEXT strip (session, venue, weather, countdown, watch-live) running under the pair.
5. **HANDOFF trim** (~480 KB; escalated 08-06, overdue) — keep the last 2-3 sessions, archive the rest to `docs/handoff-archive.md`.
6. **Three operator design/behaviour decisions left by the PSI sweep** (each has its evidence in `docs/perf-baselines.md`'s 2026-08-20 table):
   - **Calendar `DataCloneError`** (Best Practices 92 on /calendar, both form factors). NOT our bug: `@serwist/turbopack@9.5.12` `dist/index.react.mjs` forwards `history.pushState`'s third argument into `postMessage`, and Next's App Router sometimes passes a `URL` object, which is not structured-cloneable. Recommend dropping `cacheOnNavigation` in `components/SerwistRegister.tsx` — offline was deliberately removed in 0.268.0, so navigation caching is vestigial AND currently throwing; the alternative is waiting for upstream.
   - **Calendar contrast** (a11y 93/96): mono `text-text-faint` agenda times fall under 4.5:1 on Paper. Recommend a token nudge, sibling of the 0.311.0 legibility pass. Your palette, your call.
   - **Month-grid tap targets**: recommend ACCEPT as-is — density is the point and the 0.313.0 mobile agenda already solves phones.
7. **Information hubs are the last pre-Paper surface** (`font-display` extrabold caps masthead, seen on /information/formula-1 during the sweep). Queue the restyle with the image session.

## Blog contract (REVISED mid-session, operator 2026-08-20 evening)

Superseded the fact-packs-only contract: **"i want you to read my previous blogs. then give me a draft."** So Claude drafts in the operator's voice (learned from the 20 published posts), the operator approves. Still standing: fact packs back every number (`factpack-*.md`), RULE #1 on every claim, house style (no em dashes, no AI tells, always link out), **never public MDX, never a DB write** — the `.md` draft waits for approval, then `scripts/draft-post.mts` inserts it as a prod DB draft with `publish_at` null.
- **Awaiting operator review:** `draft-f1-dutch-grand-prix-2026-preview.md` (session-30 scratchpad) — Zandvoort farewell preview with hero + inline licence-verified Commons images and four sourced Verstappen quotes.
- Operator also wants, going forward: **images in every post** (Commons/CC with credit, eyeballed before use) and **driver-radio embeds** via OpenF1 `team_radio` (player UX + rights stance to design).

## Inbox (2026-08-20 — session 30)

- **error.tsx doesn't report to Sentry** — `global-error.tsx` captures, the route-level `error.tsx` only console.errors, and its comment still credits removed tooling. **Re-scope first:** the 0.288.0 worker-size diet removed server Sentry, so establish what is actually wired before building anything.
- **Remote-branch audit** — 328 non-core branches on origin (the session-26 "380 → 34" prune never reached the remote); split merged-safe (delete) vs unique-commits (operator's word per branch); one name collision already bit (`feat/champions-depth-motogp`).
- **What's-New modal** (operator's Gantt-app reference) — version-gated dialog (hero card + feature cards + "Got it") on first visit after a release, sourced from `RELEASES.md`; needs a seen-version localStorage gate and a card-worthy marker in the release format. Operator's call.
- **No "how an F1 race weekend works" answer** — 13 of 15 series have one; the one real content gap (also feeds the AdSense case).
- **Vitest under load** — fork-worker start timeouts reproduce when a dev server runs alongside (again 2026-08-20 in session 29's gate); pin `maxWorkers` or document "no suite under dev" in CONTRIBUTING.
- **Legacy lint cleanup** — re-audit `react-hooks/set-state-in-effect` (15 files; real errors vs suppressions — the charter bans silencing); DRY `EnableNotifications`/`OnboardingWizard`; championship-leader all-deselected empty state.
- **PSI sweep: DONE 2026-08-20** (10 pages, operator-run; table in `docs/perf-baselines.md`; four fix packages shipped as 0.322.4 / 0.322.5 / 0.323.0 / 0.323.1). Left to do: **re-measure root + standings + weekend** to capture the deltas. A free PageSpeed API key would let Claude script future sweeps instead of the operator clicking twenty times.
- **Operator-owed, carried** (2026-08-20 clears: avatar-menu eyeball ✓, GSC Validate-fix ✓, Bing re-validate ✓, the two `/feedback` DONE moves ✓, orphan-deletion approval ✓ shipped 0.321.3): key rotations (**`.supabase-pat` is NOT dead** — corrected 2026-08-21: it authenticated to the Management API on prod ref `dzelqrtajnauunzmxfic` and served the Dutch GP draft insert; the "dead" note was stale) · paste the root PSI re-run figures ("better on root" confirmed; the append-only `docs/perf-baselines.md` row needs the numbers).

- **A day page between the weekend and the session** (operator, 2026-08-22, flagged as an idea) — a Friday / Saturday / Sunday layout one level above the session pages and one below the weekend page: that day's forecast, the news that broke that day, blogs, and the day's sessions in one place.
- **Street View corner tours + layout history on `/tracks/<slug>`** (operator, 2026-08-22) — check which circuits have Street View coverage and offer a corner-by-corner and notable-straight walk (Kemmel, for instance) carrying each corner's or straight's name, why it is called that, and what happened there; plus previous layouts with the reason each one changed (Zandvoort's post-turn-7 rework around the holiday park, the Mulsanne chicanes for safety). Pairs with the circuit-map idea below.
- **Circuit map on the track pages** (operator, 2026-08-21) — an OpenStreetMap view of the circuit from above on each `/tracks/<slug>` page, or failing that a link out to the official circuit-map page. Check `feat/tracks-map` first: it already carries leaflet + react-leaflet and is paused, and a blind conflict resolution on leaflet broke prod once (2026-07-09).

## AdSense-readiness content (live again — the rejection makes it current)

- **Original driver bios, remaining grids** — NASCAR 36 / DTM 21 / WRC 9 / F2 / F3 via the proven solo-wave method (Wikipedia intro + per-series corroborator + style gate, waves of ≤5); RULE #1, no thin pages.
- **Champions depth ×11** (IndyCar, WEC, WSBK, F2, F3, FE, NASCAR, DTM, GT-World, WRC, IMSA) — the proven two-source pipeline (0.266.0), one-two series per session. ADAC 24h + NLS never.
- **More `/information` answers** only where real search demand exists — the session-17 no-duplicates kill rule stands.

## B-perf (remaining levers after the 0.321.2 landing-stream fix)

- Unused-JS treemap hunt (~100-130 KiB across three shared chunks on `/`) · render-blocking CSS (23 KiB / 820 ms on slow-4G) · 13 KiB legacy polyfills (browserslist) · CSP enforce + COOP (Best-Practices 96 on both PSI runs). Re-baseline in `docs/perf-baselines.md` after each change.

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

## Parked (might do — revisit trigger)

- **Results / standings / rounds body rework** — 0.314.0 kept their table bodies deliberately; **revisit only as a fresh operator ask**.
- **Blog `[[classification …]]` embed** — needs session picking, multi-class handling, a caching stance; **design first, revisit on the next blog-feature push**.
- **Session-page adapter extraction** (`[session]/page.tsx:87-314` → `lib/results/session-classification.ts` + tests for `pickRaceForSession`/`pickGtWorldRace`) — pure move, page 985→~650; **revisit next time that page is worked anyway**.
- **F2/F3 official-schedule parser** (the event pages' RSC payload carries the full timetable; ECAL widget has no raw ICS) — outbound → preview-paired; **revisit if F2/F3 times drift again** (calendars verified clean 08-03).
- **F1 schedule cross-check → prod cron** (`npm run health:f1-schedule` → `/api/cron/health`) — outbound, preview-paired; **revisit after the next schedule-drift incident**.
- **IndyCar session times + results parser** (motorsport.com/indycar) — preview-paired, never merge unverified outbound; **revisit if IndyCar gaps get flagged**.
- **TBC session times — WRC remaining rounds** — curate into `sessions.json` as itineraries publish (wrc.com/ewrc bot-blocked from datacenters); token-heavy, modest value.
- **Bahrain GP 2026** — NOT confirmed (operator confirmed the non-verification); parked until F1/FIA officially confirm.
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
- **GitHub Actions CI** (typecheck + vitest on PRs) — pair-debug a known-green workflow on a throwaway branch first; operator has zero tolerance for red checks.
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
