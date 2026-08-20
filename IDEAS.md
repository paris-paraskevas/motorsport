# Paddock — ideas ledger

Single source of truth for **open work only**. Completed items are NOT kept here: they live in git history + `CHANGELOG.md` + `docs/HANDOFF.md`. Re-triaged 2026-08-20 (session 30; operator: "content close to perfect — clean it up", then "do what you think is best"): fossils deleted, polish killed, big rocks parked with explicit triggers, and the AdSense + image asks promoted to the active front. Time-based plans live in `SCHEDULE.md`.

**Rules:** one line per item; group into batches; delete an item when it ships (history is the record); re-triage at session end.

---

## NOW — the active front (2026-08-20, operator-set)

1. **AdSense "Low value content" recovery** (operator: "i want ads on my site and dont understand why i cant get them"). The Aug-5 verdict predates the 126-bio day, the Paper reimagining (0.270.0→0.321.0) and the SERP-length meta sweep; `ads.txt` serves correctly on prod (the console's "Not found" is a stale Aug-5 crawl, verified 08-20). Work: audit the weakest indexed URL families against Google's minimum-content / thin-content docs, strengthen or noindex them, THEN tick "I confirm" + Request review — reviews run weeks apart, so fire once, when we believe it.
2. **The image/positioning brief** (operator: "be the choice a person chooses, the place a person feels safe to visit for motorsport"). AI engines currently describe Paddock as web-only, 4-series, no journalism, no notifications — all wrong (it is an installable 15-series PWA with push, a blog and 75 sourced answers). GEO surfaces to sharpen: `/about` + `llms.txt` as the canonical self-description, structured data, comparison-proof pages (broadcast/where-to-watch is the one real competitor edge named). Needs a dedicated session + operator taste.
3. **W8 v1.0 launch program** (promoted out of POSTPONED at this triage) — "out of early access" banner flip + marketing channel plan (IG/FB/Reddit/X/YouTube); checklist done. This is the distribution half of items 1–2.
4. **THE IMAGE SESSION** (operator, 2026-08-20: "the biggest job we have ever done… once all these prs are done") — evaluate, then slowly and surely flood the site with clear, distinct imagery: "humans understand visually" and the missing ingredient is clear visual subjects. Hard constraint from past kills: portraits ×14 and team logos died on LICENSING, so every image needs a licence-clean source (Wikimedia Commons already works for driver-profile portraits; evaluate official press pools / CC sources per series before any wave). Riding with it: **home page refined with clear images + boxes leading to series, calendar etc.** (operator: home is good, refine it), and **future blogs embed F1 driver radio** via the OpenF1 API we already integrate (team_radio per session; player UX + rights stance to design).
5. **feed.xml omits every DB-published post** — it reads only legacy MDX (`loadAllPosts`), the same bug the sitemap had until 0.246.1 fixed it for the sitemap only; RSS subscribers have seen nothing since the MDX era. Merge both sources like `lib/sitemap-data` does (DB `publishedPosts` + MDX, dedupe by slug, DB wins) and drop the dead `s-maxage` header / go ISR while in there.
6. **App error boundary is pre-Paper + `lib/threads.ts` `listThreads` has no fail-soft** — restyle `app/(app)/error.tsx` to Paper; a DB hiccup 500s the whole threads page (why `/social/threads` cannot be dev-checked). One small PR pair.
7. **HANDOFF trim** (~480 KB; escalated 08-06, overdue) — keep the last 2-3 sessions, archive the rest to `docs/handoff-archive.md`.

## Blog contract (standing, operator 2026-08-20)

The operator writes every post; Claude supplies **fact packs** (scratchpad, per-claim source URLs + retrieval dates, explicit UNVERIFIED list) and returns corrections on the operator's draft. RULE #1 on every number. No drafts, no MDX, no DB rows.

## Inbox (2026-08-20 — session 30)

- **error.tsx doesn't report to Sentry** — `global-error.tsx` captures, the route-level `error.tsx` only console.errors, and its comment still credits removed tooling. **Re-scope first:** the 0.288.0 worker-size diet removed server Sentry, so establish what is actually wired before building anything.
- **Remote-branch audit** — 328 non-core branches on origin (the session-26 "380 → 34" prune never reached the remote); split merged-safe (delete) vs unique-commits (operator's word per branch); one name collision already bit (`feat/champions-depth-motogp`).
- **What's-New modal** (operator's Gantt-app reference) — version-gated dialog (hero card + feature cards + "Got it") on first visit after a release, sourced from `RELEASES.md`; needs a seen-version localStorage gate and a card-worthy marker in the release format. Operator's call.
- **No "how an F1 race weekend works" answer** — 13 of 15 series have one; the one real content gap (also feeds the AdSense case).
- **Vitest under load** — fork-worker start timeouts reproduce when a dev server runs alongside (again 2026-08-20 in session 29's gate); pin `maxWorkers` or document "no suite under dev" in CONTRIBUTING.
- **Legacy lint cleanup** — re-audit `react-hooks/set-state-in-effect` (15 files; real errors vs suppressions — the charter bans silencing); DRY `EnableNotifications`/`OnboardingWizard`; championship-leader all-deselected empty state.
- **Operator-owed, carried:** signed-in eyeball of the avatar menu on prod (0.318.0) · Search Console Validate-fix + noindex re-validate · Bing re-validate on meta descriptions once 0.319.0 recrawls · **landing-orphan deletion approval** (17 zero-import components, one PR on your word) · move the two `/feedback` items (Calendar Mobile, Formula E screen) to DONE · key rotations + dead `.supabase-pat`.

## AdSense-readiness content (live again — the rejection makes it current)

- **Original driver bios, remaining grids** — NASCAR 36 / DTM 21 / WRC 9 / F2 / F3 via the proven solo-wave method (Wikipedia intro + per-series corroborator + style gate, waves of ≤5); RULE #1, no thin pages.
- **Champions depth ×11** (IndyCar, WEC, WSBK, F2, F3, FE, NASCAR, DTM, GT-World, WRC, IMSA) — the proven two-source pipeline (0.266.0), one-two series per session. ADAC 24h + NLS never.
- **More `/information` answers** only where real search demand exists — the session-17 no-duplicates kill rule stands.

## B-perf (remaining levers after the 0.321.2 landing-stream fix)

- Unused-JS treemap hunt (~100-130 KiB across three shared chunks on `/`) · render-blocking CSS (23 KiB / 820 ms on slow-4G) · 13 KiB legacy polyfills (browserslist) · CSP enforce + COOP (Best-Practices 96 on both PSI runs). Re-baseline in `docs/perf-baselines.md` after each change.

---

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
