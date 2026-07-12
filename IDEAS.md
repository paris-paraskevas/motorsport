# Paddock — ideas ledger

Single source of truth for **open work only**. Completed items are NOT kept here — they live in git history + `CHANGELOG.md` + `docs/HANDOFF.md`. This file was triaged 2026-07-12: every "→ SHIPPED / DONE" entry was removed, leaving ~55 uncompleted items grouped into batches. Time-based plans live in `SCHEDULE.md`.

**Rules:** one line per item; group into batches; delete an item when it ships (history is the record); re-triage at session end. Recommended near-term order: **B1 → B2 → B3**, then operator's call.

---

## B1 — Feedback-board quick wins

- **Admin Console access** (operator action, no code) — grant the PROD Clerk "Paris Dev" account `publicMetadata.role:"admin"` (Clerk dashboard → Users → Paris Dev → Metadata → Public) so `/admin` + the `dev.` subdomain open for it. _(The other B1 items — feedback filter, blog mobile, driver-ratings + WEC-rules explainers — and the B2 tour rebuild all SHIPPED 2026-07-12, #512–#515.)_

## B3 — AdSense-readiness content (business priority)

- **Driver portraits ×14 series** (W4 P2) — Wikimedia CC + per-image attribution; also swap the F1 OpenF1 headshots to a properly-licensed source (copyright follow-up).
- **Team logos ×15** — find a non-infringing source (no free Commons source yet — needs a licence decision; NO Getty).
- **Champion-Q&A depth** — runner-up / margin / wins on the champions Q&A; needs a `champions.json` schema extension (LARGE, own project).
- **Enrich blog posts with data visuals** — responsive tables/images SHIPPED (#513); embedding *live* charts in DB posts still needs a markdown-shortcode→component pipeline (DB bodies are plain markdown, not MDX).
- **Blog cadence automation** — scheduled authoring trigger (GH Actions headless `claude -p` emits the draft → deterministic prod insert, never holds the service key); gated on the cron pinger (GH Actions now metered).
- **Original driver bios** (W4 P5) — replace Wikipedia-derived bios with original write-ups.

## B4 — Data completeness & resilience

- **F1 classification speed** — event-driven session warming off `sessions.json` (poll from session-end, not a flat tick); evaluate Jolpica as a faster race-classification source.
- **Standings last-good resilience** — extend `withSourceSnapshot` to F1 standings/results + the motorsport.com scrapes + add a warm cron so the request path never hits upstream cold.
- **MotoGP standings-chart undercount** — a round/session drops under the finisher floor in `fetchMotoGPSeasonResults`.
- **NLS Nürburgring results** — teilnehmer.vln.de PDF scraper (DTM-shaped; datacenter-verify on a preview).
- **Remaining standings charts** — FE / IndyCar / GT-World / IMSA / WEC (data-gated: need a per-series points-scale module before a chart can reconcile).
- **Results re-check lifecycle** — late-penalty re-verify (+1w / +1m / season-end) via a KV snapshot + diff cron + curation alert (Gasly-Monaco precedent).
- **OpenF1 live-lockout residual** — a cold/expired session first opened *during* a live lockout still can't fetch; + a pre-warm cron for weekend session pages.
- **Weather + news 15-series audit** — Open-Meteo (venue-local date) + news feed per next-weekend of every series; output a gap list + curation pass.
- **rounds/URL hygiene** — GTWC results round numbers (no canonical round) + FE doubleheader second-race weekend URLs (8/10 link) + endurance weekend-grouping audit vs `groupByWeekend`.
- **media.json seeds** — official-channel highlight clips for the ~12 uncovered series; audit + replace geo-restricted clips.
- **Curation patches** when timetables drop (ongoing, e.g. IMSA practice, FE session times).

## B5 — Live / race-day data

- **Live in-race data feed** — lap-by-lap / telemetry / sector splits for the live-now view (RapidAPI live-timing candidate; Pulselive for MotoGP/WSBK; Jolpica live for F1).
- **Per-session results-fetch lifecycle** — Phase-1 positions/times at session end, Phase-2 media/reports days later; Formula E first (no results today).
- **Live Now section** — expand the thin pinned strip to current session / lap / leader / gaps when live.
- **Results table polish** — row hover-highlight (big screens) + an interval column + a leader-gap column (scope per-series data availability first).

## B6 — Onboard / F1 telemetry (next phase)

- **Broadcast cameras + all-driver roster** — lay every driver on the reconstructed track individually, pick any two; auto-director trackside cams (the director/cut logic is the real work).
- **3D track comparison + throttle/brake "did X lift"** (feedback lane, now unblocked).
- **Cockpit ghost indicator** — off-screen edge arrow + gap so the rival is locatable when out of the cockpit frame.
- **Onboard 3D follow-ups** — pit-lane/garage readability, the downhill-outside barrier reading as a retaining wall, darken team-coloured tyres; real-geometry P2 (TUMFTM/Umeyama) is the marquee-circuit roadmap.

## B7 — Betting & social

- **Real-odds adapter** — bookmaker odds for the F1 winner via the RapidAPI gateway, clamped through the house band (model stays fallback for podium/top10/exact); needs a provider + paid-key decision + name-matching + datacenter verify.
- **Bet-display refinement** — surface multiplier + potential return on PENDING bets; needs a data-model decision (A: persist the fixed multiplier at placement — a migration; B: read-side `odds_json`+`league_id` join). Settled-won bets can already show real credits won.
- **Open more series** — non-F1 markets (per-series winner-race disambiguation for sprint+feature + standings↔results name verify + datacenter check).
- **New market types** — grid / qualifying-position (quali-pace model + a `market_type` enum addition).
- **F2 market go-live** (open-markets cron w/ `CRON_SECRET`) + **F3 betting** (needs a `rounds.json` renumber).
- **Thread replies / markdown / submit rate-limit** (W7 deferred) + **comments thread** on race-weekend pages (Clerk-gated).
- **Minigames** — guess-the-driver / guess-the-track / guess-next-turn (engagement/retention).

## B8 — UX / IA / mobile polish

- **W5 per-page layout spec** (desktop + phone) — one design session; feeds density + home.
- **Information-density pass** — per-page "what does this answer in 5 seconds", the rest behind disclosure.
- **Remaster the old home widgets** (chyron / just-missed / this-week / news) up to the gallery-widget polish bar.
- **Home layout mode/columns** — the un-built `mode`/`columns` dimension (stacked vs side-by-side vs density) on `HomeLayoutPrefs`.
- **Deeper mobile "Community" tab** — a real-destination bottom-bar tab + a broader mobile IA/density pass.
- **Assistant Phase-2** — grounded Q&A over the `/information` hub (answer only from verified/indexed entries; `lib/assistant/corpus.ts` grounds only on `site-help.md` today).
- **Richer map overlays** — sector boundaries / start-finish / marshalling ("mom") zones + per-overlay filters (BLOCKED: needs a geometry/GeoJSON source).
- **Race-weekend track-map sector diagram** (per-circuit corners/sectors on the weekend page).
- **Season/month recap pages** — embedded season-highlight video + written recap + standings snapshot at that point.
- **Head-to-head** — wire the team-vs-team compare page; give the driver head-to-head a magazine-style treatment.
- **Champions tab visual redesign** — card layout / era groupings / avatars.
- **Session cards tap-to-expand** (broadcast/stream/track) + **home-collapse** for Schedule/chyron + **session→series-tab** back-path.
- **Offline mode** — service-worker cache the next 7 days of weekend data.
- **UI/CSS inspiration pass** (5 reference libraries) + **landing scroll-driven animation** (car approaches on scroll; reduced-motion fallback).
- **Mobile-first UI/UX audit.**

## B9 — Notifications

- **Per-event-type push** — qualifying topper (RSS filter) / race winner / championship-deciding event.
- **Custom per-user rules** — e.g. only F1 + MotoGP race day, skip practice.
- **Sound refinement** — per-series default sound + per-type variants (pre-race chime vs news ping).
- **Hero images in push payload** (`payload.image` from curated circuit JPEGs / thumbnails).
- **External cron pinger** — reliable blog/notify delivery on Hobby (cron-job.org every 15 min → `/api/cron/*` w/ `CRON_SECRET`); superseded if Vercel Pro. **NOTE: also now needed for ALL crons since the repo went private (GH Actions metered).**

## B10 — Quality, infra & launch

- **B-perf execution** — re-baseline first; Clerk lazy / 3rd-party deferral / CSS critical-path / idle-prefetch of hidden segments; + the `/api/just-missed` cold-on-cold TTFB (~13.8s).
- **WCAG 2.2 AA audit** + **motion / focus-state / dark-mode contrast** polish.
- **Component tests** (vitest + Testing Library) + **Playwright E2E on preview deploys** + **route best-practices** (error boundaries + Suspense + Next 16 segment configs).
- **Legacy lint cleanup** — 5 `react-hooks/set-state-in-effect` errors; **delete unused `lib/onboarding.ts`**; **DRY `EnableNotifications`/`OnboardingWizard`**; championship-leader all-deselected empty-state.
- **Admin content-authoring UI** — a lightweight page-authoring surface for when Claude isn't in the loop / Fotis edits.
- **W8 v1.0 launch program** (POSTPONED) — "out of early access" banner flip + marketing channel plan (IG/FB/Reddit/X/YouTube); checklist done.
- **Android app** — TWA/Bubblewrap → Play Store ($25), Digital Asset Links + store assets (post-v1.0).
- **B12 Greek `/el/` route tree** (next-intl).
- **Sentry** (`@sentry/nextjs` — needs the operator's DSN) · **rotate `sk_live_*` Clerk keys + `.supabase-pat`** · **dev/staging environment** (operator: maybe unneeded) · **feeder-intake Phase 2** (Supabase Storage + signed uploads >2 MB, Turnstile once Cloudflare keys exist, a normalize-then-approve admin step).
- **User + consumer research** — site survey + subreddit pain-point mining + consumer-psychology framing.

---

## Parked (might do — revisit trigger)

- **GitHub Actions CI** (typecheck + vitest on PRs) — pair-debug a known-green workflow on a throwaway branch first; operator has zero tolerance for red checks.
- **Public README + Mermaid architecture diagram** — post-v1.0 showcase.
- **Era markers / sparklines on Champions** — after a champions.json cleanup.
- **Another "Claude design" depth pass** (background warmth / theming) — after the next user-research pass.
- **GDPR / cookie-consent banner refinement** — revisit at ~500 visitors/day or a real complaint.
- **B8b SoftwareApplication JSON-LD on `/`** — blocked on real user reviews/ratings (invalid without `aggregateRating`).
- **Sportmonks F1 / API-Sports F1** — paid live-timing candidates; MUST test from a Vercel preview (datacenter-IP 403s) before adoption.

## Killed (won't do — one-line why)

- **Paddock-coins ledger** — superseded by the betting credits economy.
- **Supabase region move / Cloudflare D1** — Dublin compute co-location realised the latency win; D1 can't host the atomic ledger RPCs.
- **Reverse-engineer fiaformulae/motogp/nascar XHR endpoints** — resolved via Pulselive / Wikipedia / motorsport.com pipelines.
- **Migrate mdx-components to tokens** — the file carries no styling.
- **Notification badge chequered motif** — badge must stay monochrome (`badge-96.png` landmine).
- **AppShell `--tint` lift** — obsolete (the sidebar drawer was removed in 0.17.0).
