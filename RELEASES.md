# Releases

What's new in Paddock. Newest first. For per-commit engineering detail, see `CHANGELOG.md` in the repo.

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
