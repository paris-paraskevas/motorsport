# Releases

What's new in Paddock. Newest first. For per-commit engineering detail, see `CHANGELOG.md` in the repo.

## 0.10.13 — 2026-05-18

Champions tabs are now correct on every series.

- **WorldSBK Champions tab** now lists every riders' champion 1988–2025 with the bike manufacturer for each year.
- **WEC** now lists the top-class drivers and Manufacturers' Champions 2012–2025 (Audi → Toyota → Porsche → Ferrari, with the 2018–19 super season counted under 2019).
- **IMSA** top-class champions (Prototype/DPi/GTP era) 2014–2025 with driver crew, team, and chassis.
- **DTM** champions covering the original 1984–1996 era and the modern 2000–2025 era (1997–1999 not held). Both drivers and manufacturers as two sections.
- **GT World Challenge Europe** overall drivers' champions 2014–2025 including the Blancpain GT Series era through 2019.
- **F2** drivers + teams continuously from GP2 in 2005 to F2 in 2025.
- **F3** drivers + teams continuously from GP3 in 2010 to F3 in 2025.

Previously these tabs were either empty or showed broken Wikipedia-scrape output; all are now curated. Where a series has separately-named Constructors'/Manufacturers'/Teams' Championships, they get their own labelled section. Single-class series show just the drivers' list.

## 0.10.12 — 2026-05-18

MotoGP champions are now live.

- **MotoGP Champions tab shows the full premier-class history** from 1949 to 2025 — 77 years of riders' champions plus their bike manufacturer, and the separate Manufacturers' Championship in its own section. Covers the 500cc era (1949–2001) and MotoGP era (2002–present) as one continuous list. Same layout as the F1 tab: Drivers' Championship and Constructors' Championship are two distinct, decade-grouped sections.

## 0.10.11 — 2026-05-18

F1 Champions tab — clearer layout.

- **Drivers' Championship and Constructors' Championship are now two separate, clearly labelled sections.** Each is decade-grouped exactly like before. Replaces the inline `WCC: <team>` indicator from 0.10.10. The Drivers' section covers 1950–2025; the Constructors' section covers 1958 (its inception) to 2025.

## 0.10.10 — 2026-05-18

F1 champions are now correct and include constructors.

- **F1 Champions tab now shows both drivers and constructors.** Every year from 1950 to 2025 is listed with the World Drivers' Champion and (from 1958 onward) the World Constructors' Champion. When the driver and the constructor are from different teams — like 1981 (Piquet/Brabham, Williams WCC), 2008 (Hamilton/McLaren, Ferrari WCC), or 2024 (Verstappen/Red Bull, McLaren WCC) — the constructors' champion is surfaced as a small inline indicator. (Replaced in 0.10.11 by a cleaner two-section layout.)
- **Source is now curated**, replacing the previous live scrape from Wikipedia that returned drivers only.

## 0.10.9 — 2026-05-18

Internal: fixed a script-ordering bug in the consent and ad-tracking setup so the "deny by default" signal is now guaranteed to fire before any ad or analytics script loads. Visible behaviour unchanged for users; only relevant if you were already inspecting the cookies/consent state in DevTools.

## 0.10.8 — 2026-05-18

Calendars are now month-by-month.

- **Both calendars** — the global one at `/calendar` and the Calendar tab on every series page — now show **one month at a time**. Pick a month from the dropdown, or step through with the arrows on either side. Defaults to the current month if there's anything in it, otherwise jumps to the nearest month that does.
- **Past weekends are browseable.** Previously a "+ show past" toggle revealed earlier rounds in one big block. Now you just hit the back arrow to land on whichever past month you want — same place all past content lives, no extra toggle.
- **Empty months don't show up.** If a series has nothing in November, November isn't in the dropdown — arrow navigation skips it too.

## 0.10.7 — 2026-05-18

Browser-tab polish: real favicon and page-specific titles.

- **Tab icon is now the Paddock chequered flag.** The previous favicon was a stale generic icon that read as a dark triangle on most tab backgrounds. Same Paddock logo as the app's home-screen icon, now in every browser tab.
- **Each page has its own browser-tab title.** Open the calendar and the tab reads "Calendar — Paddock"; open an F1 weekend page and you get "Formula 1 · Bahrain GP · Round 1 — Paddock". Easier to find the right Paddock tab when you have several open.

## 0.10.6 — 2026-05-18

Race notifications now play a short F1 radio cue when the app is open.

- **Notifications get a sound** when you have Paddock open in a tab. Quick F1 team-radio chirp so you don't miss a session start while reading something else. Notifications that arrive while the app is closed or in the background continue to use your system's default notification sound — adding a custom one there requires a native app wrapper, which stays on the roadmap.
- **iOS heads-up:** browser restrictions on iOS Safari still mute custom audio for installed web apps. Android and desktop Chrome/Edge are the platforms that benefit today.

## 0.10.5 — 2026-05-18

Internal: authorized-seller declaration added at `/ads.txt`, required by the advertising industry standard for ads to serve once AdSense approves the site.

## 0.10.4 — 2026-05-18

Cookie & ad-tracking groundwork.

- **Ad and analytics cookies are now suppressed by default** for every visitor — fresh and returning — until explicit consent. Internally, Paddock now signals "deny" for ad storage, ad personalization, and analytics storage at page load. The cookie banner UI that lets you update this choice gets wired into these signals in the next release.
- **Google AdSense verification snippet added.** No ads are displayed yet — this is the inclusion step Google requires before reviewing the site for ad serving.

## 0.10.3 — 2026-05-18

ADAC 24h Nürburgring Past Winners — full history.

- **53 editions of the 24 Hours of Nürburgring** (1970 through 2025) now live on the ADAC Past Winners tab — winning teams, full driver lineups, and chassis for every year the race was run. Skipped years (1974, 1975, 1983 — race not held) are correctly absent. Previous version of this list covered only the last 10 editions.

## 0.10.2 — 2026-05-18

Polish wave — small wins across notifications, errors, contact form, and ADAC content.

- **Notification icon is now a chequered flag.** When you get a push notification on Android, the status-bar icon reads as motorsport-coded instead of a generic shape.
- **Friendlier error page.** If something breaks while loading a page, you'll see a Paddock "Yellow flag" screen with a Try Again button instead of a raw stack trace.
- **Contact form gets categories.** Pick "Bug report", "Feature request", "Suggested change", or "General" — submissions self-sort in the inbox.
- **ADAC 24h Past Winners filled in.** Ten years of winning teams + driver lineups (2015–2024). The tab is also renamed from "Champions" to "Past Winners" since ADAC is one annual race, not a championship.

## 0.10.1 — 2026-05-18

Calendar accuracy pass + ADAC page cleanup.

- **Real race names everywhere.** DTM, NLS, GT World Challenge, Formula E, NASCAR Cup, WRC, and IndyCar weekend cards now show the actual race name above each date — "68th Daytona 500", "CrowdStrike 24 Hours of Spa", "São Paulo E-Prix", "Rallye Monte-Carlo", and so on. Previously these series showed a generic round number.
- **F1 Azerbaijan corrected.** The Baku race runs Saturday Sep 26 (Remembrance Day), not Sunday Sep 27. Calendar card date range now reflects this.
- **ADAC 24h page is no longer pretending to be a championship.** The Standings, Results, Drivers, News, and Rules tabs are hidden — only Calendar, About, History, and Champions (past winners) remain. NLS still shows the full tab set since it's a real 10-round series.

## 0.10.0 — 2026-05-17

Cross-device visual refresh — Paddock 1.0.

- **The site now follows your system theme.** Light during the day, dark at night — switches automatically with your phone or laptop. Race weekends in low light feel right; daytime checks no longer blind you.
- **Each series page takes on its championship's color.** Open F1 and the active tab glows red. MotoGP turns orange. IMSA blue. WSBK red. Series identity is visible everywhere — round labels, focus rings, the next-up card.
- **Sharper numbers everywhere they matter.** Session times, weather temperatures, lap counts, points, version strings — all set in a monospaced font with fixed-width digits. Easier to scan, harder to misread.
- **Tighter cards, calmer chrome.** Refreshed surfaces across the home page, calendar, weekend pages, series tabs, driver and team pages, and the changelog. Nothing about how the site works has changed.

## 0.9.19 — 2026-05-17

Internal: drafted the database schema that will eventually back the calendar / results / standings data. No visible change yet — this is groundwork for the proper data layer that lands over the next few weeks.

## 0.9.18 — 2026-05-17

Internal: the release-notes page you're reading now is its own file, separate from the engineering log. Should make these notes easier to skim for actual changes.

## 0.9.17 — 2026-05-17

Internal: hardened the cron-job authorization so a misconfigured server can't accidentally fire push notifications to every subscriber. No user-facing change.

## 0.9.16 — 2026-05-17

F2, F3, IMSA, IndyCar, and WSBK weekend cards now show the real race name above the date — e.g. "Rolex 24 At Daytona", "Acura Grand Prix of Long Beach", "Phillip Island Round", "110th Indianapolis 500". Previously these series only showed a generic "Round 6 →" footer because we hadn't curated the canonical names yet.

## 0.9.15 — 2026-05-17

Added Google Analytics so we can see how the site's actually being used and prioritise the next improvements.

## 0.9.14 — 2026-05-17

Calendar correctness pass for every series outside F1.

- **No more phantom races from last season.** Non-F1 calendars (MotoGP, WEC, F2, F3, IndyCar, etc.) were leaking 2025 events into the current view — 2025 Silverstone showed up as "next race" because the date label didn't include the year. Now only the current season's calendar shows.
- **WEC Le Mans link fixed.** Clicking Round 3 on the WEC calendar took you to a Circuit of the Americas page instead of Le Mans. Round 4 went to Fuji instead of São Paulo, Round 5 to Bahrain instead of COTA. All fixed.
- **F1 Canada Sunday weather restored.** Race weekends one week out previously showed only Friday + Saturday weather — Sunday's forecast was just past the lookup horizon. Now race-week weather lands two weeks ahead.
- **Calendar cards lead with the race name.** Each weekend card now shows the destination ("Catalan Grand Prix", "24 Hours of Le Mans") prominently above the date and session list. The destination matters more than the round number for most fans.

## 0.9.13 — 2026-05-17

Contact form deliverability fix — emails now actually arrive.

## 0.9.12 — 2026-05-17

Wired up the contact form properly. Submissions were getting stored but no email was being sent — silently lost feedback. Now every submission goes to the team inbox.

## 0.9.11 — 2026-05-16

Filled in real session times for races where the official source hadn't published a per-event timetable yet — applied the series' standard weekend template (Practice / Qualifying / Race) with venue-local time conversion. Eight more F1 rounds, ten F2, seven F3, plus most of MotoGP / WEC / DTM / GT World Challenge Europe's upcoming events now have real session times instead of "TBC".

## 0.9.10 — 2026-05-16

Massive session-time curation across all 14 series. Every published 2026 race weekend now has venue-local-converted UTC times for every session, sourced from official series sites and cross-referenced against Wikipedia + motorsport.com. Replaces the "TBC" placeholders from 0.9.9 with real factual data.

## 0.9.9 — 2026-05-16

Fixed the "3 am Sunday" bug on non-F1 race weekends. Calendar feeds for MotoGP, WEC, IMSA, etc. only publish the day a race happens — not the start time. In your local timezone that became "Sat 03:00" or "Sun 03:00", suggesting the race started at 3 am. Now those entries render "TBC" honestly until session-level times are filled in. Also added postponement rendering — when MotoGP Qatar moved from April to November, the weekend card now shows the original date with a "rescheduled" pill.

## 0.9.8 — 2026-05-16

F1's two cancelled 2026 rounds (Bahrain and Saudi Arabia, cancelled due to the Middle East conflict) now render explicitly on the F1 series page — a banner near the top + detailed cards on the Calendar tab. Previously they were just silently removed from the schedule.

## 0.9.0–0.9.7 — 2026-05-16

Race-weekend pages launched. Every round on every series gets its own page: hero with countdown / live / past badge, multi-day weather, schedule grouped by day, standings snapshot, and news filtered to the weekend window. Plus the underlying calendar correctness fixes — phantom 3 am session times eliminated, canonical FIA round numbers wired up (Canada was showing as "Round 3" when it's actually Round 5).

## 0.8.0 — 2026-05-15

Paddock goes live on `paddock-tracker.com`. Custom domain, sign-in with Google, Vercel Analytics, Live-now pinned strip when any followed-series session is in progress, MDX blog at /blog, driver and team detail pages, full season results on F1, season trend charts, expanded standings, branded notifications with mute-series action, weather forecast on the next-session card, and an unlocked auth model (everything is browseable signed-out — accounts only unlock personalisation like push and follow lists).

## Pre-0.8.0

Internal development. PWA shell, multi-series calendar ingestion, settings page, sign-in, push notifications.
