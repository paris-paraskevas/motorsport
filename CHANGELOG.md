# Changelog

All notable changes to Paddock are recorded here. Newest first. This file is the **engineering log** — detailed enough for a future contributor to retrace decisions. Public-facing release notes live in `RELEASES.md` and render at `/changelog`.

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
