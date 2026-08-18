# Paddock — ideas ledger

Single source of truth for **open work only**. Completed items are NOT kept here: they live in git history + `CHANGELOG.md` + `docs/HANDOFF.md`. Re-triaged 2026-07-24 (session 21): shipped items cleared, duplicates merged, stale counts fixed. Time-based plans live in `SCHEDULE.md`.

**Rules:** one line per item; group into batches; delete an item when it ships (history is the record); re-triage at session end.

---

## NEXT SESSION — priority order (refreshed 2026-08-06, session 27 close)

1. **Merge the combined offline+Turbopack+wrap PR**, then prod-verify the SW rollover: `/serwist/sw.js` serves 200 on prod, push still works on the phone after the worker updates (next-after-next launch, `skipWaiting:false`), airplane mode now shows the browser default (offline removed by design).
2. **Landing-LCP finisher (small):** first-slide fade skip + `sizes` on the carousel images — the operator's 2026-08-06 PSI run says these are the whole remaining tail (mobile LCP 4.9 s, target ~2.5-3 s; row + analysis in `docs/perf-baselines.md`).
3. **Two real bugs from the app-root audit** (below): feed.xml missing all DB posts; error.tsx not reporting to Sentry.
4. **Content to 1500+**: at **1,240** after the 126-bio day. Levers: remaining bio grids (needs an operator call — NASCAR 36 / DTM 21 / WRC 9 / F2 / F3 full waves, or Wikipedia-fallback stays fine?), all-time legends pages, more `/information` answers. RULE #1, no thin pages, solo waves only.
5. **Champions depth ×11** (IndyCar, WEC, WSBK, F2, F3, FE, NASCAR, DTM, GT-World, WRC, IMSA) — the proven two-source pipeline (official archive × Wikipedia rendered HTML, three-way name check; see 0.266.0). One-two series per session. ADAC 24h + NLS never.
6. **Indexing follow-through**: GSC "Validate fix" clicked 2026-08-06, awaiting Google's re-crawl verdict on the 45 noindex URLs.

## Inbox (2026-08-18 — overnight run close)

- **Cloudflare build pipeline dead since 14:25Z** — prod frozen at 0.274.0 with 0.275→0.286 merged; check Workers Builds in the dashboard (likely a failed build or paused GitHub connection) or run `npm run deploy` once. THE morning item.
- **Reimagining remainder:** landing 10a (deferred — perf-tuned front door, decide with the panel), predictions 10c (/social fresh operator work), session-page 11d cosmetic restyle (contract already live), blog POST reading column + embedded live classification (10b second half), Account sign-out/export rows.
- **The Paper default flip + Newsprint's fate** — everything is built token-agnostic; flip is a one-line ThemeScript/layout change + a picker copy pass, decide from screenshots.
- **Content gaps found:** no "how an F1 race weekend works" answer (13/15 series have one); F1 `rounds.json` carries no sprint markers (session data owns sprint structure).
- **NavPanel data-nav-row keyboard nav** could extend to Home/End; the panel could remember scroll position — polish, not correctness.

## Inbox (2026-08-18 — session 28)

- **Delete the four orphaned shell components** (`HeaderNavMenu.tsx`, `HeaderUtils.tsx`, `search/SearchTrigger.tsx`, `search/SearchOverlay.tsx`) once #679 is reviewed — zero imports remain; kept only for the deletion-approval rule.
- **Dev hydration-mismatch warning for stored non-default themes** — ThemeScript's pre-paint attribute correction vs SSR `class="dark"`; pre-existing (fires under carbon), consider `suppressHydrationWarning` on `<html>` in the three root layouts.
- **Reimagining §9 step 3 next**: the session-tab + classification generators from the series contract, before any results page.

## Inbox (2026-08-06 — session 27 close)

- **Remote-branch audit**: `git fetch --prune` shows **328 non-core branches on origin** — the session-26 "380 → 34" prune never reached the remote. Audit into merged-safe (delete) vs unique-commits (operator's word per branch); one name collision already bit (feat/champions-depth-motogp).
- **BMC donor webhook (phase 2 of the 0.264.0 supporter gate)** — auto-flag `publicMetadata.donor` from Buy Me a Coffee webhooks with email matching; manual /admin/users toggling is fine until donations outpace it.
- **Carousel dot touch-targets** (a11y 96 both PSI runs) + the two non-composited `width` dot animations — cosmetic a11y/perf pair on the landing carousel.
- **Vitest under load**: fork-worker start timeouts reproduce the old "flake" when a dev server runs alongside — consider pinning `maxWorkers` or documenting "no suite under dev" in CONTRIBUTING.
- **Doc hygiene ESCALATED**: `docs/HANDOFF.md` is ~480KB; trim to the last 2-3 sessions + archive the rest (the parked item, now genuinely overdue).

## Inbox (2026-08-03)

- **Session-page adapter extraction.** `[session]/page.tsx` is 985 lines because ~250 of them (`:87-314`) are per-series classification adapters (WEC/IMSA/GTWC class tables, F2/F3, MotoGP/WSBK, the token-scoring race pickers) inlined in the page — promote to `lib/results/session-classification.ts` with tests for `pickRaceForSession`/`pickGtWorldRace` (a wrong pick silently renders the wrong race's result); pure move, no behavior change, page drops to ~650.

## Inbox (2026-08-03 — app-root specials audit)

- **feed.xml omits every DB-published post** — it reads only legacy MDX (`loadAllPosts` from `lib/posts`), the exact bug the sitemap had until 0.246.1 fixed it *for the sitemap only*; RSS subscribers have seen nothing since the MDX era. Merge both sources like `lib/sitemap-data` does (DB `publishedPosts` + MDX, dedupe by slug, DB wins) — and drop the dead `s-maxage` header / go ISR while in there (`force-dynamic` + `s-maxage` caches nowhere on Workers).
- **error.tsx doesn't report to Sentry** — `global-error.tsx` calls `Sentry.captureException`; the route-level `error.tsx` only console.errors, and React error boundaries swallow errors before `window.onerror`, so uncaught client render errors in any route plausibly never reach Sentry (verify against @sentry/nextjs App-Router auto-instrumentation first). Its comment also still credits the removed "Vercel Analytics + Speed Insights" with error capture — fossil either way.

## Inbox (2026-07-24 — session 21)

- **F2/F3 official-schedule cross-check.** The Hungary times drift (fixed 0.234.2) came from May's template-projected `sessions.json`; the official sites' "Add Calendar" button is an ECAL sync widget (no raw ICS to ingest), BUT the event pages' RSC payload carries the full timetable → build a fiaformula2/3.com schedule parser as the F2/F3 analogue of the F1 OpenF1 cross-check (#613). Outbound → preview-paired. Remaining projected rounds (Monza onward) need curation as itineraries publish regardless.
- **Per-weekend "add to calendar" affordance** on our weekend pages (own ICS export or link-out to the official ECAL button) — operator idea, race morning.

## Inbox (2026-07-23 — session 20)

- **Theme gallery follow-ups.** The 5-theme system SHIPPED (0.235.0 #619: Midnight/Carbon/Ember/Newsprint/Circuit + picker + System-follow + no-flash init); picker moved to `/settings/theme` (0.237.0 #622); `--session-best` timing purple wired into practice + speed-trap boards (0.236.0 #621). Remaining polish: landing decorative accents (DisciplinesGrid cyan/acid/plasma) wash out on the light themes; recharts series palette on paper backgrounds; `--session-best` adoption in the other fastest-value surfaces (qualifying decoder, race story).
- **Rotate `.supabase-pat`** — it's DEAD (verified 401 from Supabase's Management API). Regenerate so migrations run via API again (the session-20 reactions migration went via Studio).
- **Blog Share: auto-copy post link on Share** (offered, not built) — makes the IG Link-sticker paste one tap (IG can't attach a clickable link to a shared Story image — that's an IG limitation).
- **Blog follow-ups** (reactions #615, story card #617, IG share #614, PWA fix #616 all shipped): reaction UI polish and a likes-based "suggested posts" list (the schema stores `user_id` for it).

## Inbox (2026-07-22 — session 19)

- **Champions depth — other 14 series.** F1 fully backfilled 1950–2025 (#606–#612) + the `ChampionDepth` display shipped. Continue points/wins/runner-up+margin into MotoGP / IndyCar / WEC / WSBK / F2 / F3 / FE / NASCAR / DTM / GT-World / WRC / NLS / ADAC (StatsF1 + official + Wikipedia champions table, RULE #1). Pure fact-checked data, a series/decade per PR.
- **F1 schedule cross-check → prod cron.** `npm run health:f1-schedule` (#613) is a LOCAL diagnostic; fold it into `/api/cron/health` so wrong-day/time F1 schedule errors alert automatically. Outbound (OpenF1 from Vercel) → **preview-paired** (operator runs the datacenter check).
- **sessions-health wrong-day (non-F1)** — the other 14 series have no machine-readable official timetable to diff (SPA/bot-blocked), so they stay on the count-based monitor; revisit per-series if/when an official source becomes reachable.
- **Session-report variants (idea):** beyond the Sunday digest + the shipped lap-by-lap, add a Saturday qualifying-report post and (future) Friday free-practice write-ups for marquee weekends; extends the `weekend-post` cadence.

- **[you] Cloudflare DNS spot-check** (operator task, ~5 min in the Cloudflare dashboard; nothing is known-broken). The site + sign-in already work through Cloudflare (verified session 17) — this is just confirming the DNS is set the safe way. Check: the Clerk email/auth records (`clerk.`, `accounts.`, `clkmail.` + the two DKIM CNAMEs) are **DNS-only** (grey cloud, not the orange proxy); SSL/TLS mode = **Full (strict)**; the `dev.` subdomain loads; Vercel → Domains shows every domain "Valid". Optional: install the Cloudflare Claude plugin so I can read/edit DNS directly next time (`claude plugin marketplace add cloudflare/skills`, then `install cloudflare@cloudflare`).
- **IndyCar session times + results — PREVIEW-PAIRED** — outbound (motorsport.com/indycar). Build + local-verify the parser, open a PR **held UNMERGED** for the operator's Vercel preview pass (datacenter-IP check — the 0.12.12 NASCAR-regression rule). Never merge unverified outbound.
- **Bing Webmaster Tools** — operator claims the domain + hands over a verification token → add the verification file (IndexNow already pings Bing each deploy).
- **⏳ Operator env/infra to light up analytics + heatmap** (details in HANDOFF session-14): apply the 2 heatmap migrations; set GA4/GSC/Bing env in Vercel (keys in operator's Downloads). All verified live locally; prod is env-gated.
- **Bahrain GP 2026** — NOT verified (operator confirmed). Reschedule parked until F1/FIA officially confirm; draft the marquee blog then.
- **Doc hygiene (parked)** — trim `docs/HANDOFF.md` + `SCHEDULE.md` to the last ~2–3 sessions; archive older to `docs/handoff-archive.md`.
- **Heatmap overlay blob customisable**: make the yellow colour / shadow around the mouse (click-heatmap overlay) user-adjustable; fits `/admin/behaviour` in the `/admin` redesign.
- **All-time legends pages per series**: dedicated pages for the greats (Schumacher, Prost, Senna, Agostini, Rossi, ...), one set per series. Content, RULE #1, fact-checked.
- **TBC session times — WRC remaining rounds.** R9 Estonia curated (session 16). Remaining WRC date-only rounds are curatable into `content/series/wrc/sessions.json` (Wikipedia-assisted; wrc.com/ewrc bot-blocked from Vercel) as their itineraries publish — token-heavy, modest value. (IndyCar moved to the preview-paired Inbox item above.)

## AdSense-readiness content (business priority) — operator 2026-07-12: DO these, don't defer (portraits + team logos KILLED)

- **Original driver bios** (W4 P5) — sidecar plumbing + display DONE (#604; `bios.json` preferred over the Wikipedia intro, Hamilton/Alonso seeded). Remaining = author the rest of the F1 grid + other series (RULE #1, evergreen). Ultracode-shaped (parallel per-driver research + adversarial fact-check).
- **Blog cadence automation** — a scheduled trigger that auto-DRAFTS the weekly marquee preview (Thu) + digest (Mon) as a prod DB draft for operator approval; infra shipped Phase-0 (#437), needs the headless `claude -p` GH Action trigger (pairs with the cron pinger).

## Data completeness & resilience

_(Most of this batch was already done — verified 2026-07-12. SHIPPED: MotoGP chart undercount fix, GTWC canonical rounds, FE doubleheader weekend URLs + round-grouping regression guards, news-map completion (#519). **Operator 2026-07-12: BUILD all the below next — don't defer.** Several are outbound/server code that fails first on Vercel datacenter IPs → verify on a Vercel preview, not localhost; previews are SSO-walled, so the operator does the preview review (or provides a bypass secret). Build + local-verify what's possible, then flag the preview/prod check.)_

- **F1 classification speed** — event-driven session warming off `sessions.json` (poll from session-end, not a flat tick); evaluate Jolpica as a faster race-classification source. _(datacenter-verify on a preview.)_
- **Standings/results last-good resilience** — `withSourceSnapshot` already wraps the 9 standings modules + news + F1; extend it to the ~11 remaining `lib/results/*` modules. Fail-soft (can't regress) but resilience only PROVES on prod during an outage → preview/prod-gated.
- **Remaining standings charts** — FE / IndyCar / GT-World / IMSA / WEC (data-gated: need a per-series points-scale module before a chart can reconcile).
- **Results re-check lifecycle** — late-penalty re-verify (+1w / +1m / season-end) via a KV snapshot + diff cron + curation alert (Gasly-Monaco precedent).
- **OpenF1 live-lockout residual** — a cold/expired session first opened *during* a live lockout still can't fetch; + a pre-warm cron for weekend session pages.
- **Weather coverage gap-fill** — venues not in `content/circuits.json` (matched via `matchCircuit`) get no weather; add primary-sourced lat/lon (verification-heavy).
- **media.json seeds** — 11 of 15 series lack `content/series/<slug>/media.json` (have: wec/f1/f2/f3); populating needs fact-checked official-channel YouTube IDs (draft-scrutiny) + a geo-restriction audit.
- **Curation patches** when timetables drop (ongoing, e.g. IMSA practice, FE session times).

## Live / race-day data

- **Live in-race data feed** — lap-by-lap / telemetry / sector splits for the live-now view (RapidAPI live-timing candidate; Pulselive for MotoGP/WSBK; Jolpica live for F1).
- **Per-session results-fetch lifecycle** — Phase-1 positions/times at session end, Phase-2 media/reports days later; Formula E first (no results today).
- **Live Now section** — expand the thin pinned strip to current session / lap / leader / gaps when live.
- **Results table polish** — row hover-highlight (big screens) + an interval column + a leader-gap column (scope per-series data availability first).

## Onboard / F1 telemetry (next phase)

- **Broadcast cameras + all-driver roster** — lay every driver on the reconstructed track individually, pick any two; auto-director trackside cams (the director/cut logic is the real work).
- **3D track comparison + throttle/brake "did X lift"** (feedback lane, now unblocked).
- **Cockpit ghost indicator** — off-screen edge arrow + gap so the rival is locatable when out of the cockpit frame.
- **Onboard 3D follow-ups** — pit-lane/garage readability, the downhill-outside barrier reading as a retaining wall, darken team-coloured tyres; real-geometry P2 (TUMFTM/Umeyama) is the marquee-circuit roadmap.

## Betting & social

- **Real-odds adapter** — bookmaker odds for the F1 winner via the RapidAPI gateway, clamped through the house band (model stays fallback for podium/top10/exact); needs a provider + paid-key decision + name-matching + datacenter verify.
- **Bet-display refinement** — surface multiplier + potential return on PENDING bets; needs a data-model decision (A: persist the fixed multiplier at placement — a migration; B: read-side `odds_json`+`league_id` join). Settled-won bets can already show real credits won.
- **Open more series** — non-F1 markets (per-series winner-race disambiguation for sprint+feature + standings↔results name verify + datacenter check).
- **New market types** — grid / qualifying-position (quali-pace model + a `market_type` enum addition).
- **F2 market go-live** (open-markets cron w/ `CRON_SECRET`) + **F3 betting** (needs a `rounds.json` renumber).
- **Thread replies / markdown / submit rate-limit** (W7 deferred) + **comments thread** on race-weekend pages (Clerk-gated).
- **Minigames** — guess-the-driver / guess-the-track / guess-next-turn (engagement/retention).

## UX / IA / mobile polish

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

## Notifications

- **Per-event-type push** — qualifying topper (RSS filter) / race winner / championship-deciding event.
- **Custom per-user rules** — e.g. only F1 + MotoGP race day, skip practice.
- **Sound refinement** — per-series default sound + per-type variants (pre-race chime vs news ping).
- **Hero images in push payload** (`payload.image` from curated circuit JPEGs / thumbnails).
- **External cron pinger** — reliable blog/notify delivery on Hobby (cron-job.org every 15 min → `/api/cron/*` w/ `CRON_SECRET`); superseded if Vercel Pro. **NOTE: also now needed for ALL crons since the repo went private (GH Actions metered).**

## Quality, infra & launch

- **B-perf execution** — re-baseline first; Clerk lazy / 3rd-party deferral / CSS critical-path / idle-prefetch of hidden segments; + the `/api/just-missed` cold-on-cold TTFB (~13.8s — mitigated by the warm-results cron but not eliminated; the route still powers the home series-countdown/results widgets, so keep it on the perf list).
- **WCAG 2.2 AA audit** + **motion / focus-state / dark-mode contrast** polish.
- **Component tests** (vitest + Testing Library) + **Playwright E2E on preview deploys** + **route best-practices** (error boundaries + Suspense + Next 16 segment configs).
- **Legacy lint cleanup** — re-audit `react-hooks/set-state-in-effect` (15 files reference the rule as of session 21; confirm real errors vs suppressions — the charter bans silencing checks); **DRY `EnableNotifications`/`OnboardingWizard`**; championship-leader all-deselected empty-state. _(unused `lib/onboarding.ts` already deleted.)_
- **Admin content-authoring UI** — a lightweight page-authoring surface for when Claude isn't in the loop / Fotis edits.
- **W8 v1.0 launch program** (POSTPONED) — "out of early access" banner flip + marketing channel plan (IG/FB/Reddit/X/YouTube); checklist done.
- **Android app** — TWA/Bubblewrap → Play Store ($25), Digital Asset Links + store assets (post-v1.0).
- **Greek `/el/` route tree** (next-intl).
- **Sentry** (`@sentry/nextjs` — needs the operator's DSN) · **rotate `sk_live_*` Clerk keys** (`.supabase-pat` rotation tracked in the s20 Inbox) · **dev/staging environment** (operator: maybe unneeded) · **feeder-intake Phase 2** (Supabase Storage + signed uploads >2 MB, Turnstile once Cloudflare keys exist, a normalize-then-approve admin step).
- **User + consumer research** — site survey + subreddit pain-point mining + consumer-psychology framing.

---

## Parked (might do — revisit trigger)

- **SEO Phase 2b** — session `force-dynamic`→ISR (F1 `auth()`-gate refactor) + `LocalTime` Athens-SSR canonical time + selective session sitemap. Low value now; **revisit only if session pages become an indexing priority**, and not unsupervised.
- **Trending content** — MORE venues + race-weekend "what time" landing content (the ~138 existing track profiles are already deep). **Revisit when adding new venues or on a landing-content push.**
- **GitHub Actions CI** (typecheck + vitest on PRs) — pair-debug a known-green workflow on a throwaway branch first; operator has zero tolerance for red checks.
- **Public README + Mermaid architecture diagram** — post-v1.0 showcase.
- **Era markers / sparklines on Champions** — after a champions.json cleanup.
- **Another "Claude design" depth pass** (background warmth / theming) — after the next user-research pass.
- **GDPR / cookie-consent banner refinement** — revisit at ~500 visitors/day or a real complaint.
- **SoftwareApplication JSON-LD on `/`** — blocked on real user reviews/ratings (invalid without `aggregateRating`).
- **Sportmonks F1 / API-Sports F1** — paid live-timing candidates; MUST test from a Vercel preview (datacenter-IP 403s) before adoption.

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
