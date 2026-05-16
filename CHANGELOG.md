# Changelog

All notable changes to Paddock are recorded here. Newest first.

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
