# Changelog

All notable changes to Paddock are recorded here. Newest first.

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
