# Paddock — ideas ledger

Single source of truth for **open work only**. Completed items are NOT kept here — they live in git history + `CHANGELOG.md` + `docs/HANDOFF.md`. This file was triaged 2026-07-12: every "→ SHIPPED / DONE" entry was removed, leaving ~55 uncompleted items grouped into batches. Time-based plans live in `SCHEDULE.md`.

**Rules:** one line per item; group into batches; delete an item when it ships (history is the record); re-triage at session end. Recommended near-term order: **B1 → B2 → B3**, then operator's call.

---

## Inbox (2026-07-23 — session 20)

- **Theme gallery (APPROVED, design-first) — the big Next.** Extensible theme system (picker + System-follow + localStorage + no-flash init) on the shared token layer (`globals.css` `:root` + `@theme inline`). 5 themes v1: **Midnight** (dark, current), **Carbon** (cool graphite dark), **Ember** (warm amber dark), **Newsprint** (warm light: paper/ink/warm-gray), **Circuit** (high-contrast light). Each WCAG AA; flat-hairline character kept; bright accents = fills, accent-text/signal darken per theme. Arch: split "dark-promoted-`:root`" into light/dark + per-theme blocks; keep `.dark` for the `dark:` variant. Patch the handful of hardcoded leaks (`GhostLap3D`, `HomeContent`, `NewsPageContent`, layout `themeColor`); OG/story cards + `global-error` stay dark by design. Design-first: palettes → visual swatch board → operator approves → build → Vercel preview → ship. A claude.ai/design exploration prompt was provided (session-20 chat; theme spec in `docs/HANDOFF.md` session-20).
- **Rotate `.supabase-pat`** — it's DEAD (verified 401 from Supabase's Management API). Regenerate so migrations run via API again (the session-20 reactions migration went via Studio).
- **Blog Share: auto-copy post link on Share** (offered, not built) — makes the IG Link-sticker paste one tap (IG can't attach a clickable link to a shared Story image — that's an IG limitation).
- Blog **like/dislike reactions** shipped (#615) + **9:16 story card** (#617) + **IG-story share** (#614) + **PWA external-link fix** (#616). Follow-ups: reaction UI polish / a likes-based "suggested posts" list (the schema stores `user_id` for it).

## Inbox (2026-07-22 — session 19)

- **Champions depth — other 14 series.** F1 fully backfilled 1950–2025 (#606–#612) + the `ChampionDepth` display shipped. Continue points/wins/runner-up+margin into MotoGP / IndyCar / WEC / WSBK / F2 / F3 / FE / NASCAR / DTM / GT-World / WRC / NLS / ADAC (StatsF1 + official + Wikipedia champions table, RULE #1). Pure fact-checked data, a series/decade per PR.
- **F1 schedule cross-check → prod cron.** `npm run health:f1-schedule` (#613) is a LOCAL diagnostic; fold it into `/api/cron/health` so wrong-day/time F1 schedule errors alert automatically. Outbound (OpenF1 from Vercel) → **preview-paired** (operator runs the datacenter check).
- **sessions-health wrong-day (non-F1)** — the other 14 series have no machine-readable official timetable to diff (SPA/bot-blocked), so they stay on the count-based monitor; revisit per-series if/when an official source becomes reachable.
- **Session-report variants (idea):** beyond the Sunday digest + the shipped lap-by-lap, add a Saturday qualifying-report post and (future) Friday free-practice write-ups for marquee weekends; extends the `weekend-post` cadence.

- **[you] Cloudflare post-migration checks** — in the CF dashboard: Clerk records (`clerk.`/`accounts.`/`clkmail.` + the two DKIM CNAMEs) must be **DNS-only (grey cloud), NOT proxied**; SSL/TLS = **Full (strict)**; `dev.*` resolves; Vercel → Domains shows "Valid". Then install the CF Claude plugin (`claude plugin marketplace add cloudflare/skills` + `install cloudflare@cloudflare`) for agent DNS access. Site + Clerk sign-in confirmed healthy through CF as of session 17.
- **IndyCar session times + results — PREVIEW-PAIRED** — outbound (motorsport.com/indycar). Build + local-verify the parser, open a PR **held UNMERGED** for the operator's Vercel preview pass (datacenter-IP check — the 0.12.12 NASCAR-regression rule). Never merge unverified outbound.
- **Bing Webmaster Tools** — operator claims the domain + hands over a verification token → add the verification file (IndexNow already pings Bing each deploy).
- **⏳ Operator env/infra to light up analytics + heatmap** (details in HANDOFF session-14): apply the 2 heatmap migrations; set GA4/GSC/Bing env in Vercel (keys in operator's Downloads). All verified live locally; prod is env-gated.
- **Bahrain GP 2026** — NOT verified (operator confirmed). Reschedule parked until F1/FIA officially confirm; draft the marquee blog then.
- **Trending content (ongoing)** — the existing ~138 `tracks.json` profiles are already content-deep (verified session 17: 133/138 rich articles), so this is about MORE venues + race-weekend "what time" landable content, not enriching the current set.
- **SEO Phase 2b (deferred)** — session `force-dynamic`→ISR (F1 `auth()`-gate refactor) + `LocalTime` Athens-SSR canonical time + selective session sitemap. Low SEO value now; recommend not doing unsupervised.
- **Doc hygiene (parked)** — trim `docs/HANDOFF.md` + `SCHEDULE.md` to the last ~2–3 sessions; archive older to `docs/handoff-archive.md`.
- **Heatmap overlay blob customisable**: make the yellow colour / shadow around the mouse (click-heatmap overlay) user-adjustable; fits `/admin/behaviour` in the `/admin` redesign.
- **All-time legends pages per series**: dedicated pages for the greats (Schumacher, Prost, Senna, Agostini, Rossi, ...), one set per series. Content, RULE #1, fact-checked.
- **Better AI-assistant training**: improve the assistant's grounding + answer quality; relates to B8 Assistant Phase-2 (grounded Q&A over the `/information` hub).
- **GSC zero-click clusters — content EXISTS, don't rewrite (session-17 audit).** Every high-demand explainer (DRS + 2026 replacement, all points systems, what-is/whats-new/weekend ×series, differences, rally, most-titles) is already in `content/information/answers/` AND `featured: true`. They're "crawled, currently not indexed" — an authority/time + internal-linking problem, not a content gap. Internal linking shipped session 17 (#588/#589/#592). Remaining lever = authority (backlinks/traffic) + Bing/GEO. Do NOT write duplicate explainers.
- **TBC session times — WRC remaining rounds.** R9 Estonia curated (session 16). Remaining WRC date-only rounds are curatable into `content/series/wrc/sessions.json` (Wikipedia-assisted; wrc.com/ewrc bot-blocked from Vercel) as their itineraries publish — token-heavy, modest value. (IndyCar moved to the preview-paired Inbox item above.)

## B1 — Feedback-board quick wins

- **Admin Console access** (operator action, no code) — grant the PROD Clerk "Paris Dev" account `publicMetadata.role:"admin"` (Clerk dashboard → Users → Paris Dev → Metadata → Public) so `/admin` + the `dev.` subdomain open for it. _(The other B1 items — feedback filter, blog mobile, driver-ratings + WEC-rules explainers — and the B2 tour rebuild all SHIPPED 2026-07-12, #512–#515.)_

## B3 — AdSense-readiness content (business priority) — operator 2026-07-12: DO these, don't defer (portraits + team logos KILLED)

- **Champion-Q&A depth** — schema + `ChampionDepth` display DONE; **F1 fully backfilled 1950–2025** (#606–#612). Remaining = the other 14 series (promoted to the Inbox above).
- **Original driver bios** (W4 P5) — sidecar plumbing + display DONE (#604; `bios.json` preferred over the Wikipedia intro, Hamilton/Alonso seeded). Remaining = author the rest of the F1 grid + other series (RULE #1, evergreen). Ultracode-shaped (parallel per-driver research + adversarial fact-check).
- **Blog cadence automation** — a scheduled trigger that auto-DRAFTS the weekly marquee preview (Thu) + digest (Mon) as a prod DB draft for operator approval; infra shipped Phase-0 (#437), needs the headless `claude -p` GH Action trigger (pairs with the cron pinger).

## B4 — Data completeness & resilience

_(Most of B4 was already done — verified 2026-07-12. SHIPPED: MotoGP chart undercount fix, GTWC canonical rounds, FE doubleheader weekend URLs + round-grouping regression guards, news-map completion (#519). **Operator 2026-07-12: BUILD all the below next — don't defer.** Several are outbound/server code that fails first on Vercel datacenter IPs → verify on a Vercel preview, not localhost; previews are SSO-walled, so the operator does the preview review (or provides a bypass secret). Build + local-verify what's possible, then flag the preview/prod check.)_

- **F1 classification speed** — event-driven session warming off `sessions.json` (poll from session-end, not a flat tick); evaluate Jolpica as a faster race-classification source. _(datacenter-verify on a preview.)_
- **Standings/results last-good resilience** — `withSourceSnapshot` already wraps the 9 standings modules + news + F1; extend it to the ~11 remaining `lib/results/*` modules. Fail-soft (can't regress) but resilience only PROVES on prod during an outage → preview/prod-gated.
- **Remaining standings charts** — FE / IndyCar / GT-World / IMSA / WEC (data-gated: need a per-series points-scale module before a chart can reconcile).
- **Results re-check lifecycle** — late-penalty re-verify (+1w / +1m / season-end) via a KV snapshot + diff cron + curation alert (Gasly-Monaco precedent).
- **OpenF1 live-lockout residual** — a cold/expired session first opened *during* a live lockout still can't fetch; + a pre-warm cron for weekend session pages.
- **Weather coverage gap-fill** — venues not in `content/circuits.json` (matched via `matchCircuit`) get no weather; add primary-sourced lat/lon (verification-heavy).
- **media.json seeds** — 11 of 15 series lack `content/series/<slug>/media.json` (have: wec/f1/f2/f3); populating needs fact-checked official-channel YouTube IDs (draft-scrutiny) + a geo-restriction audit.
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
- **Head-to-head polish** — `/f1/compare` is shipped; remaining is extending it beyond F1 + a magazine-style driver head-to-head treatment.
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
- **Legacy lint cleanup** — 5 `react-hooks/set-state-in-effect` errors; **DRY `EnableNotifications`/`OnboardingWizard`**; championship-leader all-deselected empty-state. _(unused `lib/onboarding.ts` already deleted.)_
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

- **Driver portraits ×14 series** (killed 2026-07-12, operator) — long-tail licensing curation, not worth it.
- **Team logos ×15** (killed 2026-07-12, operator) — no free / non-infringing source; keeping copyrighted logos would be a violation.
- **Paddock-coins ledger** — superseded by the betting credits economy.
- **Supabase region move / Cloudflare D1** — Dublin compute co-location realised the latency win; D1 can't host the atomic ledger RPCs.
- **Reverse-engineer fiaformulae/motogp/nascar XHR endpoints** — resolved via Pulselive / Wikipedia / motorsport.com pipelines.
- **Migrate mdx-components to tokens** — the file carries no styling.
- **Notification badge chequered motif** — badge must stay monochrome (`badge-96.png` landmine).
- **AppShell `--tint` lift** — obsolete (the sidebar drawer was removed in 0.17.0).
