What's new in Paddock Tracker. Newest first. For per-commit engineering detail, see `CHANGELOG.md` in the repo.

## 0.38.1 — 2026-06-21

**Highlights open on YouTube.** Race and session highlight clips now open on YouTube when you tap them — Formula 1 and most series don't allow their videos to play on other sites — shown as a poster with a play button so it still reads as a video. Added the Le Mans 24 Hours and the Barcelona F3 weekend.

## 0.38.0 — 2026-06-21

**Race highlights, embedded.** Race-weekend pages now carry a highlights video and a "where to watch" link, and each session page (practice, qualifying, race) shows its own highlights clip where we've added one — starting with the full Barcelona-Catalunya Grand Prix weekend. Videos only load when you press play, so pages stay fast.

## 0.37.3 — 2026-06-21

**Faster race-weekend and driver/team pages.** Weekend pages and driver/team profiles now load from cache instead of being rebuilt on every visit — noticeably quicker, especially the first time you open one.

## 0.37.2 — 2026-06-21

**Browse past races on the calendar.** The calendar now lets you step back to previous months, not just upcoming ones — handy for catching up on a race you missed. It still opens on the current month.

## 0.37.1 — 2026-06-21

**A much faster home.** The home page now loads from cache instead of rebuilding on every visit — the "just missed" results block loads a moment after the page paints rather than holding everything up. First visits especially should feel dramatically quicker.

## 0.37.0 — 2026-06-19

**"Just missed" — your home now shows what just happened.** A new block at the top leads with the most recent race in the series you follow: who made the podium, a link to the latest story, and race highlights where we've added them. Series we don't yet carry full results for link straight to their results page. It sits above the "up next" countdown, so the home now covers both directions at a glance — the race you just missed and the one coming up.

## 0.36.6 — 2026-06-19

**Where to watch, right on the home page.** The "up next" and "live now" cards now carry a direct "Watch on …" link to each series' official stream or broadcast — F1 TV, MotoGP VideoPass, Rally.TV, FIAWEC+ and more — so you're one tap from tuning in.

## 0.36.5 — 2026-06-19

**Groundwork for the Android app.** Behind-the-scenes setup so Paddock can ship as an installable app on the Google Play Store. Nothing changes on the website itself yet.

## 0.36.4 — 2026-06-19

**Readability and a few honesty fixes.** Dimmed text — session times, captions, small labels — is now brighter and easier to read across the whole app (it was below the accessibility contrast standard). Live sessions on the calendar no longer show a confusing "past" tag next to their LIVE marker. The home news feed no longer repeats the same story twice when it's filed under two series. Plus a couple of tidied-up labels.

## 0.36.3 — 2026-06-13

**Clearer times, faster home.** Session times on calendars and weekend schedules now show their time zone ("15:00 EEST") so there's no guessing whose clock they're on — full automatic local-time conversion everywhere arrives with the upcoming home page redesign. And the home page got dramatically lighter: it loads about a third of the data it used to, with everything you see unchanged.

## 0.36.2 — 2026-06-13

**Race results on every class-racing weekend page.** IMSA and GT World Challenge race pages now show the full finishing order — every class and cup classified separately with crews, cars and gaps, exactly as on the Results tab. GT World results also link through to their race weekends now, and sprint weekends show Race 1 and Race 2 each on their own page.

## 0.36.1 — 2026-06-13

**A round of accuracy fixes from our full code review.** MotoGP's race-weekend pages now show the actual Grands Prix — pre-season tests had taken over the first three round pages, and they're now labelled as tests on the calendar instead. All six "missing" Formula E race pages (including the season finale) exist now — doubleheader weekends get one page per race. Formula 2 results carry the exact championship points including pole and fastest-lap bonuses. Where we can't yet guarantee exact points sums (Formula E, IndyCar), weekend pages link to the official standings rather than showing a table that could be slightly off. Plus: the standings chart lost a duplicate legend, MotoGP results open on the latest race, and the weekly digest no longer invents start times for sessions that haven't published one.

## 0.36.0 — 2026-06-12

**WEC race results, just in time for Le Mans.** The World Endurance Championship's Results tab now shows the full finishing order of every 2026 round — Hypercar and LMGT3 classified separately, with each car's crew, laps, gaps and race time. Race pages on WEC weekends carry the same classification, and result notifications now cover WEC too: when the 24 Hours of Le Mans finishes this weekend, the result lands here.

## 0.35.2 — 2026-06-12

**Three finishing touches.** The Nürburgring 24h page now shows its star-car lineup; IndyCar and NLS join every other series with hand-checked champions lists (thirty years of IndyCar titles, the modern NLS era's winning crews); and GT World Challenge picked up a live news feed.

## 0.35.1 — 2026-06-12

**The blog is live.** Three reads to start: our Le Mans 2026 preview ahead of Saturday's start, the story of how Paddock keeps its data honest across 15 series, and a half-season review of the 2026 championships so far.

## 0.35.0 — 2026-06-11

**Race results on session pages, series by series.** Tap a race in the weekend schedule on Formula 2, Formula 3, Formula E, IndyCar, MotoGP, Superbikes or NASCAR and its session page now shows the full classification — sprint races and Superpole races included, each on their own page.

## 0.34.0 — 2026-06-11

**A quick tour for first-time visitors.** New to Paddock? A four-step spotlight now walks you through the essentials — the live ticker, your weekly schedule, the series pages and your follow settings. Skip it anytime, tick "don't show again" and it never returns (no account needed), or replay it whenever you like from the Account page.

## 0.33.0 — 2026-06-11

**Driver and team pages grew up.** Every driver page now shows the championship position, points and wins, plus the last five race results — and team pages show where the team stands with each driver's form on the lineup. All in the site's timing-screen style.

## 0.32.0 — 2026-06-11

**Full 2026 grids for every series.** The Drivers tab on all 15 series now shows the curated, current lineup — every team, car and crew, from F2's silly-season seats to WEC's full Hypercar and LMGT3 entry and NASCAR's chartered field — with driver and team pages to click into. Endurance entries are listed car by car with their full crews.

## 0.31.0 — 2026-06-11

**Every series now explains its own rulebook.** The About tab on all 15 series gained a "Rules essentials" section — how the weekend runs, exactly how points are scored this season, the sporting rules that actually decide results, and what titles are at stake. Written for fans, current for 2026.

## 0.30.0 — 2026-06-11

**Flick through a race weekend session by session.** Every session page now carries a strip of the whole weekend — FP1 through to the race — with one tap to jump anywhere, plus previous/next links at the bottom to follow the weekend in order.

## 0.29.2 — 2026-06-11

**A security hardening pass.** We audited every door into Paddock — sign-in-protected areas, the contact form, push notifications, scheduled jobs. The contact form now has sensible rate limits, push subscriptions are validated more strictly, and the audit confirmed the rest holds up. Internal: full findings documented for the next hardening round.

## 0.29.1 — 2026-06-11

**Landing-page navigation behaves now.** Jumping to a section from the top bar no longer hides the section's title behind the bar — every jump lands cleanly below it. And the menu is a proper side drawer: it slides in from the right over half the screen while the page behind dims, and closes from the dimmed area, the ✕ or Escape.

## 0.29.0 — 2026-06-11

**Every session gets its own page.** On Formula 1 weekends, tap any session in the schedule — practice, qualifying, sprint or race — and it opens its own page with the full classification: every lap time in qualifying's three segments, gaps and points in the race, best laps in practice. Other series' session pages are on the way.

**Frozen standings arrive on every series' weekend pages.** The as-it-stood championship table — introduced for F1 — now covers Formula 2, Formula 3, Formula E, IndyCar, MotoGP, Superbikes, NASCAR, WRC and DTM. Team tables appear where team points are really the sum of the drivers'; elsewhere the page honestly shows drivers only.

**The points chart now leads the Standings tab.** Progression first, tables right below.

## 0.28.0 — 2026-06-11

**Standings frozen in time on every F1 weekend page.** Each Grand Prix page now shows the full championship — every driver and every team — exactly as it stood at that race, not today's table.

## 0.27.0 — 2026-06-11

**Race-weekend pages match the rest of the site now.** The weekend view — schedule, weather, standings and news for each round — has been rebuilt in the same dark timing-screen style as everything else, with the event name in the house headline type. The back arrow at the top is gone too; the series name still takes you back.

## 0.26.0 — 2026-06-11

**The points chart lives in Standings now.** The drivers' season-progression chart moved from the Results tab to Standings — points over time next to points right now. It also gained a marker at every round, and hovering highlights the exact point you're on.

**Full classifications, easier to scan.** On bigger screens a race's classification splits into two columns — first half of the field on the left, second half on the right — instead of one long list.

**Two small touches.** The winner's name under each race now shows in full on phones, and on the Champions tab each title-winning team's name appears in that team's colour.

## 0.25.0 — 2026-06-11

**Race results, redesigned.** Every series' results tab now lists races in the site's timing-screen style — round number in the series colour, the race name in headline type, and the winner highlighted on every row.

**Races click through to their weekend.** Tap any race name to jump to that round's weekend page — schedule, weather, standings snapshot and news for that event. The arrow next to the name shows the way; the chevron still expands the full classification in place.

## 0.24.3 — 2026-06-11

**The landing-page menu works again.** Tapping the menu button on the landing page used to do nothing visible — the menu opened invisibly behind the scenes. It now opens properly as a full-screen menu, and the page behind it no longer scrolls while it's open.

## 0.24.2 — 2026-06-11

**Switching tabs takes you to the top.** Jumping from Results to Standings — or any series tab to any other — no longer leaves you stranded mid-page. Every tab now opens at its top.

**Full race classifications.** Race results no longer stop at the top ten — expand any race and the whole field is there, from the winner to the last classified finisher.

**A touch of breathing room.** On the Drivers tab, team names no longer crowd the team-colour marker.

## 0.24.1 — 2026-06-11

**Champions, corrected and completed.** WRC's champions list — which wrongly showed Thierry Neuville as a Toyota driver — is rebuilt with the right teams for every champion since 1979. NASCAR's champions tab, previously empty, now lists every Cup champion since 2000. And the Nürburgring 24h page finally celebrates this year's winners — the #80 Winward Mercedes-AMG crew.

**Superbike gaps make sense now.** Race results showed nonsense time gaps for everyone behind the winner — now they show the real interval.

**That completes the full data audit.** All 15 series have now been checked against official sources — standings and results verified accurate everywhere.

## 0.24.0 — 2026-06-11

**Account, properly.** The Account tab now opens a real account page — your profile and sign-out up top when signed in, followed series and notification preferences below. Not signed in? The page works anyway: pick your series and they're remembered on this device, with a one-tap sign-in when you want them everywhere.

**Everything matches the look now.** The account page, notification settings and the first-visit setup wizard were the last screens on the old design — they've joined the dark timing-screen style, and the notification descriptions now reflect the new 30-and-10-minute reminders.

## 0.23.1 — 2026-06-11

**Three record-book corrections.** Toyota — not Porsche — is credited with the 2024 WEC manufacturers' title; the 2024 GT World Challenge champions Auer and Engel are now correctly listed with Winward Racing; and IMSA's results gained the missing Detroit round, with the bug that hid it fixed for good.

**A junk table removed.** DTM's manufacturers' standings came from a broken upstream feed showing half the brands with wrong totals — it's gone until a trustworthy source exists. Drivers and teams tables are unaffected.

**The landing page got the wide-screen treatment too.** Same as the app a release earlier.

## 0.23.0 — 2026-06-11

**Desktop breathes now.** Pages finally use your screen — on a full-HD monitor the content area grew by a third. The home page also calms down: today's sessions show in full, while the rest of the week folds into one-line day summaries you can expand, and the news wire shows the ten freshest stories.

**Series news matches the house style.** The News tab on every series page now reads like the home wire — clean rows, timestamps, story excerpts.
## 0.22.0 — 2026-06-11

**Better race-day pings.** If you've enabled notifications, you now get two heads-ups — about 30 minutes and again 10 minutes before each session in your followed series. And when a race finishes, you'll get one more the moment its full results are up on Paddock, taking you straight to the classification. Your existing mute and follow settings apply to all of it.

## 0.21.0 — 2026-06-11

**The calendar joined the new look.** Both the main calendar and every series' calendar tab now read like a timing screen — flat session rows with series-colour markers, a cleaner month switcher, and race-weekend blocks with their NEXT and event tags in the house style.

## 0.20.2 — 2026-06-11

**The Indy 500 result is right again.** A quirk in our data source made the 500's top qualifiers disappear from the race classification — the winner included. Every position now reads correctly, points and all.

**Formula E's champions are in.** The Champions tab showed an error for Formula E — it now lists every drivers' and teams' champion from the 2014-15 opener to Oliver Rowland's 2024-25 title.

**Verified against the record.** A full audit of F1, F2 and F3 standings, results and champions against official sources came back clean.

## 0.20.1 — 2026-06-11

**The points chart works on phones now.** The season trend graph — previously a desktop-only view — renders properly on mobile, sized for the screen, in the same constructor colours.

## 0.20.0 — 2026-06-11

**Every series has its story now.** The History tab — previously only written for Formula 1 — is now authored for all 15 championships: MotoGP's 1949 origins, IndyCar's great split and reunification, Group B and Group C, the DTM's collapses and revivals, NASCAR's 1979 Daytona brawl, the Nordschleife's half-century of club racing, and more. Each essay is fully sourced, with the references listed at the end.

## 0.19.2 — 2026-06-11

**The landing page is reachable from the app again.** Tapping "Landing" in the footer of the installed app now actually takes you there — opening the app still drops you straight into your dashboard, as it should.

## 0.19.1 — 2026-06-11

**No more landing-page flash in the app.** Tapping the PADDOCK•TRACKER logo inside the installed app briefly showed the marketing page before returning home — it now goes straight to your dashboard. In the browser, the logo still takes you to the landing page.

## 0.19.0 — 2026-06-10

**Full F1 results, finally.** A data-feed bug was silently cutting the season short — Monaco was missing from the results and the points chart, and Canada showed only half the field. Fixed: every race now lists all 22 finishers and the chart runs to the latest round, with totals that match the standings.

**The chart speaks F1 now.** Trend lines wear constructor colors — Ferrari red, McLaren papaya, Mercedes teal, white for Cadillac — with teammates sharing a color, second car dashed, just like the broadcast graphics.

**Sharing looks right.** Posting paddock-tracker.com on Instagram or anywhere else now shows our crossed-flags mark, not a generic chequered square. (Apps cache previews — re-share once to refresh.)

**Leaner series pages.** Standings and results tables joined the dark timing-screen look, pages start rendering before slow data arrives, and the Rules tab — which never had real content — is gone, its links folded into About. The logo now takes you to the landing page.

## 0.18.0 — 2026-06-10

**Series pages joined the new look.** The big tile grid is gone — each series now opens with its name in racing type, a live countdown to its next session, and a slim tab bar that sticks to the top as you scroll. Content starts immediately instead of below a wall of buttons.

**The landing page's ticker and menu now stay with you when you scroll.** A long-standing layout bug kept them from sticking — fixed everywhere, for good.

**Season charts behave on phones.** The points-trend chart is now a desktop feature; on mobile you get the ranked driver chips instead of a squashed graph. Big fields (looking at you, NASCAR) collapse to the top twelve with a "+more" button.

## 0.17.0 — 2026-06-10

**One navigation, everywhere.** The slide-out menu and its burger button are gone. On phones, the bottom bar is your navigation; on desktop, the header now carries Home, Calendar, Series and Blog directly. Less furniture, more room for the racing.

## 0.16.0 — 2026-06-10

**A real home for the series.** The Series tab now opens a proper page — all 15 championships grouped by discipline, each showing its next session and date. No more menu popping over your screen.

**Settings is now Account.** Same place in the bottom bar, clearer name.

## 0.15.0 — 2026-06-10

**Your home page now works like a broadcast.** A live strip across the top shows what's on track right now — or the next session with a ticking countdown, venue and weather. Below it, THIS WEEK lists every session for the next seven days as a clean timetable, with the news wire alongside it on bigger screens. The News/Upcoming tabs are gone — everything is on one screen.

**Times are finally yours.** Session times now display in your device's timezone, labelled so you always know which clock you're reading.

## 0.14.0 — 2026-06-10

**The app now wears the landing page's colors.** The dashboard, menus and footer moved to the new dark racing-broadcast look — near-black surfaces, amber accents, and the PADDOCK•TRACKER wordmark in the header.

**One theme, no toggle.** Paddock is dark-only everywhere now; the light/dark switch is gone. A proper light theme may return later as its own project.

**Easier one-handed use on phones.** A new bottom bar puts Home, Calendar, Series and Settings within thumb's reach — especially handy in the installed app. The footer also gained a link back to the landing page.

**The install pop-up is gone.** The "Install Paddock Tracker as an app" banner no longer takes over the top of your dashboard. You can still install Paddock any time from your browser's menu.

## 0.13.3 — 2026-06-10

**Fixed: cut-off cards on phones.** During Le Mans week, the dashboard's Upcoming list could push its cards past the right edge of the screen on mobile — one extra-long session name dragged the whole day's cards with it. Long titles now truncate properly and every card fits the screen.

## 0.13.2 — 2026-06-10

**Now it actually moves.** The landing page's ticker, scrolling timetable and entrance animations shipped frozen in this morning's release — fixed. Phones no longer see cut-off series cards.

**Circuit photography, front and centre.** The famous-circuits gallery moved from the bottom of the page into the hero as a slideshow — Spa, Monaco, Le Mans, the Nordschleife, Indianapolis, Talladega and Rally Finland crossfade with their captions, photographer credit on every frame.

## 0.13.1 — 2026-06-10

**The landing page got its broadcast energy.** A live ticker now runs across the top with what's next on track, session times in GMT, the weather at the next venue, and the latest headlines. Below the hero, a marquee-event countdown ticks down to the biggest race on the calendar — right now, the 24 Hours of Le Mans.

**Real circuits, real photography.** A scrolling feed of famous venues — Spa's Raidillon, Monaco's hairpin, Le Mans at full stretch, the Nordschleife, Indianapolis, Talladega, Rally Finland — with photographer credits on every shot.

**More motion, more color.** The 15-series timetable now scrolls as three moving rows, discipline cards picked up their accent colors and series chips, and the sign-in pitch got its warm glow. A new menu button opens a full-screen map of everywhere you can go.

## 0.13.0 — 2026-06-10

**A new front door.** paddock-tracker.com now opens with a proper landing page — what Paddock covers, the next sessions on track live from the real calendar, and the season in numbers. The app you know didn't change: it now lives at `/app`, one tap behind the "Open the paddock" button, with every series, weekend, and article URL exactly where it was.

**Installed the app on your phone or desktop?** Nothing gets in your way — the installed app opens straight into your dashboard and skips the landing entirely.

**Dark mode now sticks.** A long-standing bug silently reset dark-mode users to light on every reload. Found and fixed at the root.

This is the first step of a larger redesign — the new racing-poster look debuts on the landing page, and the rest of the app follows in upcoming releases.

## 0.12.15 — 2026-05-22

**Live DTM standings, all three championships.** The DTM Standings tab now renders the 2026 Drivers', Teams', and Manufacturers' championships live from motorsport.com — refreshed after every round. After Red Bull Ring (R1): Maro Engel leads with 44 points ahead of Lucas Auer (37) and Marco Wittmann (31); Mercedes-AMG Team Landgraf tops the Teams table; Mercedes leads BMW, McLaren, and Aston Martin in the Manufacturers' fight. Eight more rounds to come — Zandvoort this weekend, then Lausitzring, Oschersleben, Nürburgring, Sachsenring, and Hockenheim through October.

The Results tab gets a live drivers' season-trend chart, showing every scoring driver's cumulative championship trajectory. With only Red Bull Ring run so far the chart is a single column, but it'll grow into a useful season-tracker once Zandvoort and beyond land.

A heads-up on what's not here yet: per-race classification accordions (who finished where at Red Bull Ring) — same shape as Formula 1's Results tab. That's the next DTM follow-up; the data source needs one more probe to confirm the per-event page layout.

## 0.12.14 — 2026-05-22

**Full WRC rally results — and the season-trend chart is back.** The WRC Results tab now shows the complete WRC Rally1 classification from every completed 2026 round — Rallye Monte-Carlo, Rally Sweden, Safari Rally Kenya, Croatia Rally, Rally Islas Canarias, and Rally de Portugal. Each accordion expands to the full top-10 plus any retired Rally1 entries, with driver, co-driver, team, car number, finishing time, and total points (event + Sunday + Power Stage bonus). The "Drivers' season trend" line chart sits at the top, plotting all 29 scoring drivers across the six rallies — Evans 123 leads, Katsuta 111, Solberg 92 at the latest snapshot.

Until today the Results tab listed just the rally winner per round and skipped points entirely. Class positions surface correctly even when a Rally1 driver crashes and finishes far down the overall order — at Croatia, Solberg shows as P8 in the Rally1 classification (his class position) rather than P42 overall (which counts lower-class WRC2 / Junior cars that finished ahead of him).

## 0.12.13 — 2026-05-22

**GT World Challenge Europe race results, every cup.** The GT World Challenge Results tab now shows the complete per-cup classification from every completed 2026 race so far — Paul Ricard 1000km and the Brands Hatch sprint double-header. Each (race, cup) card expands to the top 10 in that cup with car number, full driver crew (3-4 names at endurance, 2 at sprint), team, and car model. Pro Cup, Gold Cup, Silver Cup, Bronze Cup all surfaced where present; the Bronze Cup correctly skips Brands Hatch since they sit out that round of the season per the SRO 2026 calendar.

A heads-up on what's not here yet: there's no season-trend chart on this tab. SRO's points system is more layered than most series (top-10 base + pole bonus + 75% race-distance gate + Spa 24h's 3-stage scoring + Super Pole fractional bonuses + per-cup sub-scoring), and we want to get that right before plotting cumulative totals — otherwise the chart would silently disagree with the Standings tab on a few drivers. The classification is the headline win; the trend chart ships in a follow-up release.

## 0.12.12.1 — 2026-05-22

**NASCAR Cup race results restored.** The Results tab on `/series/nascar-cup` went briefly blank earlier today after the 0.12.12 release — the upstream data source we'd locked in worked locally but turned out to refuse our hosting platform's network. We've swapped to fetching the same per-race classification from Wikipedia, which is friendlier to server-side requests, and everything is back: full 38-41 car classification per race, trend chart, all 12 completed 2026 rounds. No change to what you see on the page versus what the earlier release intended to show; the round names, driver lineups, and points scale are identical (Wikipedia and the previous source pull from the same NASCAR timing feed).

## 0.12.12 — 2026-05-22

**Full NASCAR Cup race results — and the season-trend chart is back.** The NASCAR Cup Results tab now shows the complete classification from every completed 2026 race — the Daytona 500, every regular-season points race through the Würth 400 and Go Bowling at The Glen, with each accordion expanding to all 38–41 cars: driver, owner team, car number, status, and championship points. The "Drivers' season trend" line chart sits at the top, so you can scrub through the regular season and see where Tyler Reddick / Chase Elliott / Denny Hamlin pull away from the pack at each round.

Until today, the Results tab showed only the race winner per round and skipped points entirely (the upstream Wikipedia summary table doesn't carry per-position data). The new source is racing-reference.info, which exposes the full per-finisher classification for every Cup race going back decades — same source NASCAR fans use as the canonical statistics reference.

## 0.12.11 — 2026-05-22

**Full IMSA race results, every class.** The IMSA Results tab now shows the complete classification from every completed 2026 round — Rolex 24 at Daytona, the 12 Hours of Sebring, the Long Beach sprint, and Laguna Seca's Monterey SportsCar Championship — broken out by class. Open `/series/imsa` and tap **Results** to see one card per class per round: GTP, LMP2, GTD Pro, and GTD where they ran. Each card expands to the top-10 finishers with car number, driver line-up, team, car model, and gap-to-leader. Sprint rounds correctly drop the endurance-only classes (Long Beach shows GTP + GTD only; Laguna Seca shows three classes since LMP2 only races the four Michelin Endurance Cup rounds).

A heads-up on what's not here yet: there's no season-trend chart on the IMSA Results tab. The official IMSA timing exports cover lap times and finishing order but not championship points, and the points scale shifts between sprint and endurance rounds — so any trend chart we'd ship today would disagree with the Standings tab's totals. The Standings tab continues to be the authority for points; this Results tab is the race-by-race classification.

## 0.12.10 — 2026-05-21

**Better link previews — round 2.** Follow-up to 0.12.9. The previous fix corrected the title and description on shared link previews but quietly dropped three other fields — the canonical URL, the page type, and the site name. Those are restored now, so every social platform that parses Open Graph cards (Twitter, Facebook, Discord, Slack, LinkedIn, iMessage, WhatsApp) sees a complete card with all the fields filled in correctly per route. Same scope as 0.12.9: metadata only, no UI change.

## 0.12.9 — 2026-05-21

**Better link previews.** Until today, sharing any Paddock page on Twitter / Discord / WhatsApp / Slack / Reddit / iMessage showed the same generic "Paddock Tracker — personal motorsport companion" card no matter what page you'd linked to. Now the preview matches the page — share `/series/f1` and the card reads "Formula 1 2026 — calendar, schedule, race weekends"; share a specific race weekend and it carries the round name and date range; share `/calendar` and you get the calendar description. Large-image preview cards are restored on every route. Purely a metadata fix — no UI change anywhere.

## 0.12.8 — 2026-05-21

**FIA WEC live standings are now on `/series/wec`.** Open the **Standings** tab to see the Hypercar Drivers' Championship, the Hypercar Manufacturers' Championship, the LMGT3 Drivers' Championship, and the LMGT3 Teams' Championship — all four tables refreshed against fiawec.com after each round. Multi-driver crew names appear on a single line ("RENÉ RAST ROBIN FRIJNS") with the manufacturer + car number sitting underneath.

A note on what's missing: only standings landed in this release. Per-round results — who finished where at Imola, Spa, Le Mans, and so on — still link out to fiawec.com for now. The WEC site swaps that data client-side rather than rendering it into the page, so it needs a different parsing approach that's coming in a follow-up.

## 0.12.7 — 2026-05-21

**Refreshed cookie-consent modal.** Sharper layout (sits as a card at the bottom of the page now, not a full-screen overlay), clearer button labels — **Allow all** / **Essential only** / **Customize** — and a tidier per-category panel with a small "Always on" tag on the necessary line so you know which one can't be toggled. The substance is identical to the version that landed earlier today; this is purely a visual and copy pass driven by a research walk through how Vercel, Stripe, Linear, Notion, Apple, GitHub, Mozilla, Guardian, NYT, and Shopify handle the same moment.

A small detail: if you re-open the modal from the **Manage cookies** link in the footer, it now opens straight into the per-category panel — that's almost always where you're going if you re-opened it.

## 0.12.6 — 2026-05-21

**A new cookie-consent modal.** On your first visit, Paddock now shows a small modal with three equal options — **Accept all**, **Reject all**, or **Customize** (per-category toggles). Whatever you choose is applied right away: analytics and advertising cookies only run if you grant consent for them, otherwise the scripts fall back to cookieless pings. Necessary cookies (authentication, your preferences) are always on because the site can't work without them.

You can change your mind anytime from the **Manage cookies** link in the footer — it re-opens the same modal. Your decision is remembered locally for 12 months, after which Paddock will ask again.

Behind the scenes, this replaces the Google consent banner Paddock had been trying to use (it never actually rendered, because it requires AdSense site approval, which is still in review). The result of that gap was that visitor analytics weren't being recorded for most EU/UK visitors — that's now fixed.

## 0.12.5 — 2026-05-21

**Footer redesign.** The footer is no longer a single line of dot-separated links — it now reads as a real section with two columns (Site and Legal), a short brand line on top, and a copyright row at the bottom. Manage cookies has a dedicated link in the Site column so you can find it without hunting through the cookie policy page.

The link inventory itself is unchanged. This is purely a layout refresh.

## 0.12.4 — 2026-05-21

**MotoGP standings + per-event results are now live.** Open `/series/motogp?tab=standings` for the riders' championship table, and `?tab=results` for each completed round — both the Grand Prix and the Saturday Sprint render as their own race card, with positions, gaps, and points sourced from Dorna's official backend (the same data that drives motogp.com).

A small caveat on the standings tab: the Manufacturers' Championship is not shown. The FIM points rule for manufacturers (best-placed rider per race only) requires aggregating per-race results, and Pulselive doesn't publish a ready-made constructors table — deferring until a session can do the aggregation properly without estimating.

## 0.12.3 — 2026-05-21

**Formula E rounds 7-10 now show full per-position classifications.** Berlin R7/R8 (2 + 3 May) and Monaco R9/R10 (16 + 17 May) had been stuck on a flat "winner only" line because the Wikipedia per-event articles for those weekends are season-summary stubs. Each of those four race cards now expands to a full top-20-ish classification — driver, team, gap to the leader. Data source is motorsportweek.com's per-event results posts.

Two small caveats: per-finisher points come from the FIA position scale (25-18-15-12-10-8-6-4-2-1 for the top 10) but exclude the pole-position bonus (+3) and fastest-lap bonus (+1) because motorsportweek doesn't carry those flags. Until the bonuses are backfilled, the driver season-trend chart stays off the Formula E results tab. Both items are queued for a follow-up.

## 0.12.2 — 2026-05-21

**IndyCar per-race results are now live.** Open `/series/indycar?tab=results` for every 2026 round through Detroit (and onwards as the season progresses) — winner, podium, points-paying finishers, plus DNS/withdrawn/excluded markers where applicable. The Milwaukee doubleheader renders as two separate race cards. Pole and led-laps bonuses are included in the per-finisher points; "most laps led" (+2) is omitted for now because Wikipedia's table doesn't carry that flag.

What you'll see per finisher: position, driver, team, status, and points. Lap counts, finish times, and car numbers live only on indycar.com (which is JavaScript-rendered, can't be fetched cleanly) and will arrive in a later enrichment pass.

## 0.12.1 — 2026-05-20

**F3 standings + results now agree on every driver's points total.** Ugochukwu was showing 25 on `/series/f3?tab=standings` but 26 on `/series/f3?tab=results` — Melbourne's Sprint Race was a half-distance red-flag, and Paddock was awarding him 1 point for P8 from a generic scale instead of the 0 the FIA records under the reduced-distance rule.

Both tabs now read their per-race points from the same FIA-published source. As a small side win, the F3 drivers tab also picks up a real team name for every driver (the rendered HTML the prior parser scraped didn't expose it).

No other changes.

## 0.12.0 — 2026-05-20

**Dark / light theme toggle.** A small Sun/Moon button now sits next to the Contact button in the header. Tap it to flip Paddock between dark and light themes — your choice is remembered locally so it stays put the next time you open the app, on any device. If you never tap it, the site continues to follow your operating system's preference like before.

The light/dark CSS was already in place under the hood; this release wires the user-controllable switch on top of it. No layout jumps, no flash of the wrong theme on refresh.

Internal: also bundles end-of-day housekeeping (session notes + two parser modules tracked for an upcoming release). Up next: a research-first sweep across 12 series with thin live-data coverage — Formula E doubleheaders, IndyCar results, MotoGP everything, IMSA per-event, NLS / DTM / WEC standings, plus driver / team curation across every series that doesn't have it yet.

## 0.11.14 — 2026-05-20

Two post-#73 fixes:

**WRC results no longer says "temporarily unavailable".** The page was showing the placeholder because Wikipedia's 2026 WRC article splits into a Calendar section (no winner data) and a separate Results and standings section (the actual winners table) — and the parser was finding the wrong one. Now the round-by-round winning crew + manufacturer renders properly: Monte Carlo Oliver Solberg, Sweden Elfyn Evans, Kenya Takamoto Katsuta, Croatia Adrien Fourmaux, Canarias Sami Pajari, Portugal Sébastien Ogier through Round 7.

**Formula E doubleheader dates now correct.** The second race of each doubleheader weekend (Jeddah R5, Berlin R8, Monaco R10) was showing "1 January 2026" — a placeholder used when the parser couldn't find a real date. Wikipedia's calendar table lists those rounds in compact 2-cell rows (just round + date) because the venue cells above span both rows, and the parser was reading the wrong column. Now those rounds show their real dates (14 Feb, 3 May, 17 May respectively), and the results panel orders most-recent-first like the other series. Berlin and Monaco still show only the winning driver because the per-race Wikipedia articles haven't been written up with full classifications yet — but the dates and order are now honest.

## 0.11.13 — 2026-05-20

**IMSA SportsCar Championship standings now live.** Open `/series/imsa?tab=standings` for the full picture across all four classes — GTP (the headline hybrid prototypes), LMP2 (the spec privateer prototypes), GTD Pro (the pro GT3 class), and GTD (pro-am GT3). Each class shows Drivers, Teams, and where applicable Manufacturers (LMP2 doesn't have a manufacturers' title since every car is the same Oreca chassis).

Per-event results — who finished where in each race — still link out to imsa.com. The Wikipedia season page only carries the winning crew per round, not full classifications.

## 0.11.12 — 2026-05-20

**Three post-#71 fixes**:

- **WRC standings + results are back.** The page was showing "temporarily unavailable" across the board because Wikipedia's recent HTML structure changed how it wraps section headings, and the parser walked past the actual standings tables without seeing them. Both the standings and the results parsers now detect the new wrapper.
- **Formula E driver rows no longer show "Unknown" team.** Wikipedia's FE Drivers' Championship table doesn't carry a team column — points-per-round cells take that slot — so the rows just hide the team line entirely until per-driver teams are curated.
- **Formula E drivers' season-trend chart removed (again).** Restoring the chart in 0.11.6 assumed every completed round had a full classification table on its per-event Wikipedia article. Berlin R8, Monaco R9 and Monaco R10 don't yet — their articles are season-summary stubs — so the chart was undercounting Evans by ~40 points vs the standings. Dropping the chart until either Wikipedia catches up on those rounds OR Paddock backfills them via curated overrides. The race-by-race winner list remains, expandable where full data exists.

## 0.11.11 — 2026-05-20

**GT World Challenge Europe standings now live.** Open `/series/gt-world?tab=standings` for the Overall championship plus the two sub-championships, Sprint Cup and Endurance Cup, each with Drivers' and Teams' tables. No more click-out to gt-world-challenge-europe.com for the championship picture.

Per-event results — who finished where in each race — still link out to the official site for now. SRO doesn't publish per-position points the way the FIA does for F1 / F2 / F3, so a season-trend chart wouldn't tell the truth yet.

## 0.11.9 — 2026-05-20

**WRC standings + results now live.** Open `/series/wrc?tab=standings` for Drivers / Co-Drivers / Manufacturers championship tables, and `/series/wrc?tab=results` for the round-by-round winning crew + manufacturer through Round 7 (Rally Japan). No more click-out to wrc.com for the championship picture.

A round listing shows the winning crew (driver + co-driver + manufacturer) only — Wikipedia's season-table is winners-only, and per-rally top-10 classification needs a follow-up parser against the per-rally pages. As with Formula E before 0.11.8, the season-trend chart is deliberately omitted until full per-position points are available.

## 0.11.8 — 2026-05-20

**Formula E results now show the full classification per race, just like Formula 1.** Open `/series/formula-e?tab=results` and click any round to expand the top 10 — full positions, gaps, points, and retirement reasons for every classified driver, not just the winner. Doubleheader weekends (Jeddah, Berlin, Monaco) now ship both races independently instead of dropping the Sunday race.

**The drivers' season-trend chart is back.** With real per-position points for every driver across every round, the chart finally tells the same story as the standings tab — Evans, Rowland, Mortara curves now diverge round-by-round instead of plateauing at 25pts after each driver's first win.

**Mexico City team correction.** The Wikipedia source repeatedly lists Cassidy and Vergne under "Citroën Racing", which is editorially incorrect — both drive for DS Penske, Stellantis's Formula E team. Paddock now normalises this name across all rounds.

If a per-race Wikipedia article hasn't been written up yet, that round still shows the winner as a flat summary row (same as before). No round is dropped because of a missing article.

## 0.11.7 — 2026-05-20

**Formula 2 and Formula 3 results tabs are fast now.** Both pages were taking 2-3 seconds to load — every visit was re-doing about a dozen separate requests to the official FIA sites in the background just to render the season. Now the season's results are kept in a short-lived shared cache for three hours, so the second visitor onwards gets an instant page. Cold loads, when the cache is empty, are also faster because Formula 3 used to fetch each round one-after-another and now fetches them in parallel like Formula 2 already did.

If a round has just finished and you want to see the freshest possible results, the cache refreshes at most every three hours; in practice that's well within the window the FIA themselves take to publish.

## 0.11.5 — 2026-05-20

**The F1 season-trend chart now matches the standings.** Sprint-race points were missing from the per-round point accumulation, so every driver who scored sprint points appeared in the chart with a lower total than what the F1 standings showed (e.g. Antonelli 93 in the chart vs 100 in the standings — exactly the 7 sprint points he scored in China). The two completed 2026 sprints (China and Miami) now feed into the same x-axis round as their parent Grand Prix, so the chart tells the truth. The season-results listing below the chart still shows Grands Prix only — adding sprint cards there would double up race weekends, and the headline bug was the chart math, not what's listed below it.

## 0.11.4 — 2026-05-20

**Formula E results tab now reads honestly.** Two small but actively-misleading bits of UI cleared up:

- The drivers' season-trend chart is gone from the Formula E results tab. The chart was showing every winning driver's line plateauing at 25 points right after their race win, while the standings tab said Evans had 128, Rowland 109, Mortara 103 — total mismatch. Until we have full per-race finishing positions on Formula E (not just race winners), the chart can't tell the truth, so it's better not to show it. F1 still has its trend chart unchanged.
- Each Formula E race card no longer expands into a fake 1-row "Race winner 25 points" classification. The card itself already names the winner and team — the misleading expand has been removed. F1, NASCAR, WSBK and others keep their full expandable race-by-race rankings.

## 0.11.3 — 2026-05-20

**Formula E results now actually load.** 0.11.2 fixed standings but results still showed "temporarily unavailable" — different table on Wikipedia, different bug. The results table has no Date column at all and the parser was throwing every row away for missing a date. Now it derives dates from the sibling Calendar table and falls back to a season-end placeholder if neither has them. Seven Season 12 races (São Paulo, Mexico City, Miami, Jeddah, Madrid, Berlin, Monaco) should populate. Three doubleheader second-races (Jeddah-2, Berlin-2, Monaco-2) currently get dropped due to a rowspan-inheritance edge case — follow-up to recover them.

A data-quality note: this data comes from the public Wikipedia season page, which has occasional community-edit errors. The Mexico City winning team currently reads "Citroën Racing" (it's actually DS Penske). Curated corrections will follow.

## 0.11.2 — 2026-05-20

**Formula E standings + results actually load now** (real fix). 0.11.1's URL change wasn't enough — Wikipedia's FE Drivers' Championship table uses merged-cell headers for doubleheader weekends (Jeddah, Berlin, Monaco, Shanghai, Tokyo, London each span 2 columns of race results). The parser was reading the wrong cell for the season-points total and silently failing. 0.11.2 teaches the parser about merged-cell headers.

## 0.11.1 — 2026-05-20

**Formula E standings + results now actually load.** 0.11.0 shipped the Formula E scraper but the production fetch hit a Wikipedia endpoint variant that the parser couldn't handle, so the page silently showed "temporarily unavailable" even though tests passed locally. Switched to the same Wikipedia endpoint the working NASCAR and WRC scrapers use.

## 0.11.0 — 2026-05-20

**Live standings and results across five more series.** Before today, only F1 and IndyCar had live championship tables — every other series clicked you out to its official site. As of 0.11.0, the following five join the live-data club:

- **Formula 2** — Drivers' + Teams' standings, plus Feature and Sprint race results per round
- **Formula 3** — same shape (drivers / teams / Feature / Sprint)
- **Formula E** — Drivers' + Teams' standings, race winners per round, season-trend chart
- **NASCAR Cup Series** — Drivers' + Manufacturers' standings, race-by-race winners
- **WORLDSBK** — Riders' + Manufacturers' standings, Race 1 / Superpole Race / Race 2 results per round

Open `/series/f2?tab=standings`, `/series/f3?tab=results`, `/series/formula-e?tab=standings`, `/series/nascar-cup?tab=results`, `/series/wsbk?tab=results` — they should all populate without clicking out. All data refreshes hourly, with manual-override slots wired (so we can correct DSQs and penalties without a code deploy).

**This is batch 1 of the 0.11.x scraper sweep.** Remaining series (WRC, GTWCE, IMSA, WEC, MotoGP, DTM, NLS, IndyCar race-by-race) follow in subsequent 0.11.x releases.

## 0.10.44 — 2026-05-20

**Two Champions-tab clickability fixes**:

- **Red Bull's constructor entries now link.** Until today the Champions tab listed Red Bull as a championship-winning team but the name stayed as plain text — even though the current Red Bull team page already exists. The mismatch was a small naming difference ("Red Bull" on the champion row, "Red Bull Racing" on the team page); both now resolve to the same page.
- **Repeat champions like Álex Palou now link on every title row, not just one.** The IndyCar champions table marks successive titles with `(1)`, `(2)`, `(3)`, `(4)` after the name; only the first row was matching the driver page. All four now route through to `/drivers/alex-palou`.

## 0.10.43 — 2026-05-20

**Champion names now actually link to driver and team pages.** 0.10.42 announced this feature but the code change was missed — the names still rendered as plain text. 0.10.43 ships the patch. Open any series' Champions tab and click a current-grid name (Norris, Hamilton, Piastri on F1; Palou on IndyCar) — it opens their driver page. Past champions whose pages we don't have yet (Schumacher, Senna, Fangio) stay as plain text, since linking to a 404 would be worse than no link.

## 0.10.42 — 2026-05-20

**Per-series countdown to the next session.** Open any series page (e.g. `/series/f1`, `/series/motogp`) — there's now a ticking countdown to the next upcoming session in that series.

**Champion names now link to their driver and team pages.** Open the Champions tab on any series and click a champion or constructor name — if we have a curated page for them (currently F1 and IndyCar drivers/teams), it opens. Past champions without curated pages stay as plain text.

**Rally Japan now shows on the WRC calendar correctly.** Round 7 of the 2026 WRC, May 28-31, was previously listed without canonical round-number data; the official entry is now in place. Stage-by-stage start times will fill in as the organisers publish the detailed itinerary.

**A.J. Foyt Enterprises kept as the canonical team name** for the 1996 and 1998 IndyCar championship entries — verified against IndyCar.com, Wikipedia, OpenWheelWorld and two further references.

Internal: search-engine fixes — long weekend-page titles now truncate at ~60 characters so they fit Google's display window without ellipsis; the duplicate top-level heading on the releases page was removed so search engines see a single document title.

## 0.10.41 — 2026-05-19

Internal: session-end audit + plan for the rest of the week. No visible change.

## 0.10.40 — 2026-05-19

**Every 2026 F1 driver and team now has their own page.** Open `/drivers/lando-norris`, `/drivers/lewis-hamilton`, `/teams/mclaren`, `/teams/cadillac` — all 22 drivers and 11 teams on the 2026 F1 grid are reachable directly. Previously these URLs returned "Driver not found" / "Team not found"; the data is now curated. The Drivers tab on the F1 series page also reads from this curated list instead of scraping Wikipedia, so the rendering issue fixed in 0.10.36 can't ever fire on F1 again.

## 0.10.39 — 2026-05-19

**IndyCar standings are now live on the site.** Open `/series/indycar?tab=standings` to see the full 2026 drivers' championship — position, name, team, points, wins. Refreshed hourly from the official IndyCar source (`indycar.com/Standings`), with manual overrides supported for DSQ / penalty corrections.

This is the first non-F1 series with a live standings table — the rest of the championships will follow this week.

## 0.10.38 — 2026-05-19

**Renamed: "Paddock" → "Paddock Tracker"** everywhere on the site. Same product, more specific name — aligned with the `paddock-tracker.com` domain. The rename touches the browser tab title, the PWA app name, sidebar brand label, footer version line, RSS feed title, push notification titles, OG image, contact form email subject, and all legal pages.

- The home-screen icon label still reads "Paddock" — icon labels need short text and "Paddock Tracker" is too long for that surface.
- **No data or settings affected** — your followed series, push subscriptions, sign-in account, and consent choices are unchanged.
- **Search engines need time to catch up.** Google can take ~1-2 weeks to reflect the new name in search results; Bing typically refreshes within 1-3 days. We've pushed an explicit re-index request for both.

## 0.10.37 — 2026-05-19

- **IndyCar 2026 drivers and teams pages are now live.** Every IndyCar driver on the 2026 grid — all 26 across 10 teams — has their own page at `/drivers/<name>`, with team affiliation and car number. Every team has a page at `/teams/<name>` listing its full driver lineup. Previously these URLs returned "Driver not found" / "Team not found"; the data is now curated end-to-end.
- The **Drivers tab on the IndyCar series page** now reads from this curated list rather than scraping Wikipedia, so the rendering issue fixed in 0.10.36 can't ever fire on IndyCar again.

## 0.10.36 — 2026-05-19

Fixed a rendering bug on per-series Drivers tabs where Wikipedia CSS markup was leaking into the driver list — most visible on **IndyCar**, where the A. J. Foyt Enterprises entry showed a wall of `.mw-parser-output .legend{...}` style declarations between Caio Collet and Santino Ferrucci. Now strips those decorations cleanly. Affected any series relying on the live Wikipedia driver-list fallback.

## 0.10.35 — 2026-05-19

Internal: captured the first performance baseline (desktop + mobile field + lab data) and queued tomorrow's mobile-performance work. No visible change.

## 0.10.34 — 2026-05-19

Internal: structured-data markup so search engines and AI assistants understand what each page is, plus a one-line follow-up fix on the RSS feed.

- **Pages now carry Schema.org structured data.** Every weekend page declares itself as a sports event with start time, end time, location, and championship organizer. Every blog post declares its author, publish date, and headline. The home page declares the site identity. Every nested page declares its breadcrumb hierarchy (home → section → page). Search engines and LLM assistants use this markup to surface richer results and to disambiguate what each URL is about. No visible change.
- **RSS feed no longer emits a 1970 "last updated" date** when the blog is empty. RSS aggregators that respect that field would have either ignored it or treated the feed as dead. Now it's simply omitted until the first post is published.

## 0.10.33 — 2026-05-19

Internal: faster Bing / DuckDuckGo / ChatGPT Search indexing, plus two small polish edits on blog and weekend pages.

- **Paddock Tracker now uses IndexNow** — a free push protocol Microsoft built so search engines learn about new pages without waiting to crawl them. Effective immediately for **Bing**, **DuckDuckGo** (uses Bing), **Yahoo**, **Ecosia**, **Qwant**, **ChatGPT Search**, **Copilot**, **Yandex**, and **Seznam**. No effect on Google (different protocol) or Brave (no protocol; relies on organic crawling).
- **The blog index page now has a more specific description** for search engine snippets — naming the series we cover rather than the generic site-wide tagline.
- **Weekend pages now declare their canonical URL explicitly** — closes a small SEO gap where Google had to infer the canonical form from context. No visible change.

## 0.10.32 — 2026-05-19

Search-engine quality fixes flagged by Bing the moment the sitemap landed there, plus a follow-up pass on the per-series pages. Internal — no visible UI change.

- **Each tab on a series page now has its own search-engine title and description.** Until today, every tab on `/series/f1` — Calendar, History, Champions, Standings, News, Drivers, Rules, About, Results — shared the same `<title>` and meta description. Google sees that as nine copies of the same page and only ranks one. Each tab now has a distinct title (e.g. "F1 champions — full list, year by year") and a description that fits what the tab actually shows.
- **The home page now has a richer page title and a hidden top-level heading,** both flagged by Bing's URL inspector as quality gaps after we submitted the sitemap there. The visible page is unchanged; the underlying signals search engines and screen readers see are now correct.
- **Canonical URLs across `/series/[slug]` are now explicit.** The bare series URL and the default-tab URL both point to the same canonical, so Google doesn't see them as competing duplicates. Tabs that are real distinct content (history, champions, etc.) get their own canonical.

## 0.10.31 — 2026-05-19

A second pass of search-engine-and-AI-crawler improvements. Internal — no visible UI change.

- **Sign-in, sign-up, and settings pages now ask search engines not to index them.** Those pages have no public content to rank, so they shouldn't show up in Google results when someone searches the site by name. The Calendar, About, Changelog, and the five legal pages each now also have their own short description, so Google can show something useful and specific in the search snippet instead of repeating the site-wide tagline.
- **Race-weekend and session dates are now marked up in a machine-readable format.** Search engines, calendar tools, and AI assistants can now extract the exact start time of any session on the site directly from the page — not just the human-readable "Sat 12:30" string. Same content on screen; richer signal underneath.
- **Outbound news links no longer pass ranking authority off-site.** When Paddock Tracker links out to a motorsport.com article or an official series site, those links now carry the standard `nofollow` hint search engines use to mark "this is a discovery link, not an endorsement". The on-screen behaviour is unchanged.
- **The RSS feed is more polite to aggregators.** It now tells subscribers when it last actually changed (rather than re-claiming "fresh" on every poll), what category it belongs to, and where to find the Paddock Tracker logo for display in their reader.
- **Google can now show larger images** from Paddock Tracker in Search and Discover. Until today the platform default was a small thumbnail; the new setting allows the full image.

## 0.10.30 — 2026-05-19

Search engines and AI crawlers can now find every page on the site.

- **Paddock Tracker now publishes a `robots.txt` and a `sitemap.xml`.** Until today, Google and other search engines had to guess which pages exist on paddock-tracker.com — they could only discover pages they happened to follow links into. Now they get a full list of every public URL: the home page, calendar, blog, about, changelog, all 15 series pages, every race-weekend page, and the legal pages. Search Console can ingest the sitemap directly; indexing should accelerate from "1 page found" toward full coverage over the next few weeks.
- **A new `llms.txt` file** at the site root gives AI assistants (ChatGPT, Claude, Perplexity, Gemini and others) the same kind of map. Where `sitemap.xml` is the machine format Google reads, `llms.txt` is the markdown format LLM crawlers prefer.
- No visible UI change.

## 0.10.29 — 2026-05-19

Two small follow-up fixes for the F1 History tab introduced yesterday.

- **Clicking the citation superscript now scrolls to the footnote** (and the `↩` backref scrolls back up). In 0.10.28 the link target IDs had an extra prefix that no anchor matched, so clicks updated the URL but the page stayed put.
- **The byline at the bottom of the History tab now shows the "Last updated" date** alongside the author, as intended.

## 0.10.28 — 2026-05-19

The F1 History tab now reads as Paddock Tracker, not Wikipedia.

- **Original F1 history content** at [/series/f1?tab=history](/series/f1?tab=history). About 545 words across three sections — Origin, Turning points, Today's shape — with all the things you'd expect (Fangio, the rear-engine revolution, Lauda 1976, Imola 1994) plus the title-decider controversies (Suzuka 1989 and 1990, Adelaide 1994, Jerez 1997, Crashgate 2008, Abu Dhabi 2021). Cited inline against authoritative motorsport sources — Formula1.com, FIA archives, Doug Nye's *Autocourse History of the Grand Prix Car*, 8W/Forix, Motor Sport Magazine, Autosport, The Race, Joe Saward, StatsF1. No more Wikipedia article dump on the tab.
- **An authored byline at the bottom** of the History tab. Will appear on every series's History tab as their content lands.
- **The other 14 series and all Rules tabs** show a "Coming soon" placeholder for now. MotoGP and WEC History come in follow-up releases; the other 12 series and the Rules tabs after that.

## 0.10.27 — 2026-05-19

The home page, calendar, and blog now load from CDN cache instead of running server-side on every visit.

- **Faster repeat visits.** The Home page, Calendar, and Blog are now cached at Vercel's edge for 5 minutes, then refreshed in the background. The first visitor in each 5-minute window pays the rendering cost; everyone else in that window gets the page near-instantly. No user-visible change to what's on the page beyond the speed difference, except: race-day "next session" countdowns may lag by up to 5 minutes.
- **Series pages and live-data routes are unchanged.** The per-series page still re-renders on every visit, so its data is always fresh — that's deliberate while the live-now strip on those pages is the source of truth for race weekends.

## 0.10.26 — 2026-05-19

Internal: site-wide security headers.

- **Hardened the default browser security policy** for paddock-tracker.com. HTTPS is now enforced for all subdomains, the site is no longer embeddable in third-party iframes, MIME-type sniffing is disabled, the referrer policy is tightened on cross-origin requests, and several sensor APIs (camera, microphone, geolocation) plus the Topics / FLoC advertising signals are explicitly denied. No user-visible behaviour change.

## 0.10.25 — 2026-05-19

Internal: push-unsubscribe is ownership-checked; contact-form submissions auto-expire after 12 months.

- **Push-notification unsubscribe now verifies ownership.** The "turn off notifications for this browser" endpoint previously trusted any caller that knew the browser's push endpoint string. It now confirms the caller is the same signed-in user who originally subscribed (or that both are anonymous). No user-visible behaviour change for the common path.
- **Contact-form submissions are now kept for 12 months and then automatically removed,** matching the retention promise on the privacy page. Previously they were stored indefinitely.

## 0.10.24 — 2026-05-19

Postal-address blocks on the legal pages now render properly across multiple lines.

- **Imprint and privacy pages** were rendering the operator's address as one long inline line directly after the version-0.10.23 release. The address is now formatted as the four-line block it was always meant to be.

## 0.10.23 — 2026-05-19

Imprint page added; privacy policy now lists the operator's full postal address.

- **Paddock Tracker now has an Imprint page** at [/imprint](/imprint), also reachable at [/impressum](/impressum). It sets out who runs the Site, where they are, how to reach them, and who is editorially responsible for the blog content. German and other EEA visitors expect this as a matter of course; it is now linked from the footer.
- **Privacy policy controller section** now lists the operator's full postal address alongside the email, satisfying GDPR's identity-and-contact disclosure requirements for an EU-served audience.

## 0.10.22 — 2026-05-19

GT World Challenge Champions tab — Endurance Cup section added.

- **The GT World Challenge Europe Champions tab now has three sections.** The existing Overall (Drivers') section stays at the top, and a new **Endurance Cup** section sits below it with year-by-year winners back to 2014 — Pier Guidi/Rovera (AF Corse) 2024, Marciello's three-peat era at AKKodis ASP, Garage 59 in 2016, and so on. Split years where the Overall and Endurance winners are different teams are now visible side-by-side.

## 0.10.21 — 2026-05-19

WorldSBK Champions tab — end-to-end manufacturers' history.

- **WSBK's Manufacturers' Championship section now covers 1988 through 2025 in full** — the 1988–2001 gap from earlier in the day is filled in. The Ducati-on-Ducati dominance era (1991–1996, 1998–2001) is now visible, plus the three "split" years where the riders' champion's bike wasn't the manufacturers' winner: 1990 (Roche/Ducati vs Honda), 1993 (Russell/Kawasaki vs Ducati), 2000 (Edwards/Honda vs Ducati).

## 0.10.20 — 2026-05-19

Notification badge restored, push sound louder.

- **Notification badge icon back to the original 4×3 chequered-flag-with-pole design.** The 2×2 redesign was too sparse — going back to what worked.
- **Push notification sound runs at full volume** now. The previous 0.6 cap made it too quiet to notice — restored to the asset's native level.

## 0.10.19 — 2026-05-19

The EU cookie banner now actually shows up.

- **Google's consent banner now displays** on first visit for EEA/UK/Swiss visitors. The previous release wired Google's CMP as the consent surface, but it was held back by AdSense's pre-approval review gating — the banner didn't fetch its message. Adding the explicit "eager mode" Funding Choices snippet bypasses that gating.
- Confirmed working independently of AdSense site approval — the banner displays during review, not only after.

## 0.10.18 — 2026-05-19

One cookie banner, not two.

- **Paddock Tracker now uses Google's certified Consent Management Platform** (Funding Choices) for the EU cookie banner. The custom in-app banner has been removed so there's a single consent UI to interact with. You can re-open Google's banner at any time via the small "Consent" / shield icon Google injects on the page.
- **Privacy / Cookies / Do Not Sell pages updated** to describe how to manage preferences through Google's CMP rather than the old custom banner.
- **No-banner fallback:** if Google's CMP ever fails to display, ad and analytics cookies remain denied by default — there's no silent tracking gap.

## 0.10.17 — 2026-05-19

Tables on the policy pages now actually render.

- **Privacy Policy and Cookie Policy tables** are now formatted as proper tables instead of raw `| Column | Column |` text. Affects only the appearance of `/privacy` and `/cookies` that shipped a few minutes ago in 0.10.16.

## 0.10.16 — 2026-05-19

Legal pages + real cookie consent.

- **Five new policy pages**: `/privacy`, `/terms`, `/cookies`, `/accessibility`, and `/do-not-sell`. All linked from the footer. Covers what data we collect, who we share it with, your rights under GDPR/ePrivacy and (for California visitors) CCPA, the full cookie inventory, our accessibility target, and a dedicated opt-out path for CCPA "sharing" of personal information for advertising.
- **The cookie banner now actually controls what fires.** Accepting or rejecting a category instantly updates Google's consent signals on the page — no refresh needed. Analytics and ad cookies remain suppressed unless you've opted in. Previously the banner only stored your choice locally without telling Google.
- **Global Privacy Control respected.** If your browser sends the GPC signal (Firefox setting, the Privacy Badger extension, others), Paddock Tracker automatically treats it as a "reject non-essential" choice and skips the banner.
- **Cookie preferences are always reachable.** A "Cookie preferences" button now lives in the footer, and `/cookies` and `/do-not-sell` both have a button that re-opens the banner so you can change your mind any time.
- **Consent record kept for 24 months** on Paddock Tracker's server so we can prove the choice was yours. Stored anonymously (no IP, no email) unless you're signed in, in which case your account is tagged so we can honour deletion requests.

## 0.10.15 — 2026-05-18

Notification badge — readable again on Android.

- **The push-notification icon in your status bar is no longer a tiny white blob.** Redrawn as a bolder 2×2 chequered pattern that actually reads at the size Android shrinks it to. Same motorsport-coded chequered-flag motif, just with fewer/larger cells so it survives the downscale to ~24px.

## 0.10.14 — 2026-05-18

More champions, fewer gaps.

- **F2 Champions tab** now shows the Teams' Champion alongside the Drivers' Champion for every year — was previously only for the GP2 predecessor era (2005–2016). The split years where the title-winning driver wasn't on the title-winning team are now surfaced (2017 Leclerc/Prema → Russian Time, 2018 Russell/ART → Carlin, 2019 de Vries/ART → DAMS).
- **F3 Champions tab** same treatment for the FIA F3 era (2019–2025). Splits like 2021 Hauger/Prema → Trident, 2022–24 ART/Trident drivers → Prema Racing teams are now visible.
- **WorldSBK Champions tab** now has a Manufacturers' Championship section for 2002–2025. Rea's Kawasaki dynasty 2015–2020 plus the recent Ducati manufacturers' stranglehold are surfaced.
- **IMSA Champions tab** now has a Manufacturers' Championship section. The 2014–2016 Chevrolet → 2017–2018 Cadillac → 2019–2020 Acura → 2021 Cadillac → 2022 Acura → 2023 Cadillac → 2024–2025 Porsche story is now visible alongside the winning crews.

GTWC Endurance Cup champions are coming in a follow-up — they need a small schema change because Endurance is a parallel drivers' championship, not a constructor column.

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

- **Tab icon is now the Paddock Tracker chequered flag.** The previous favicon was a stale generic icon that read as a dark triangle on most tab backgrounds. Same Paddock Tracker logo as the app's home-screen icon, now in every browser tab.
- **Each page has its own browser-tab title.** Open the calendar and the tab reads "Calendar — Paddock Tracker"; open an F1 weekend page and you get "Formula 1 · Bahrain GP · Round 1 — Paddock Tracker". Easier to find the right Paddock Tracker tab when you have several open.

## 0.10.6 — 2026-05-18

Race notifications now play a short F1 radio cue when the app is open.

- **Notifications get a sound** when you have Paddock Tracker open in a tab. Quick F1 team-radio chirp so you don't miss a session start while reading something else. Notifications that arrive while the app is closed or in the background continue to use your system's default notification sound — adding a custom one there requires a native app wrapper, which stays on the roadmap.
- **iOS heads-up:** browser restrictions on iOS Safari still mute custom audio for installed web apps. Android and desktop Chrome/Edge are the platforms that benefit today.

## 0.10.5 — 2026-05-18

Internal: authorized-seller declaration added at `/ads.txt`, required by the advertising industry standard for ads to serve once AdSense approves the site.

## 0.10.4 — 2026-05-18

Cookie & ad-tracking groundwork.

- **Ad and analytics cookies are now suppressed by default** for every visitor — fresh and returning — until explicit consent. Internally, Paddock Tracker now signals "deny" for ad storage, ad personalization, and analytics storage at page load. The cookie banner UI that lets you update this choice gets wired into these signals in the next release.
- **Google AdSense verification snippet added.** No ads are displayed yet — this is the inclusion step Google requires before reviewing the site for ad serving.

## 0.10.3 — 2026-05-18

ADAC 24h Nürburgring Past Winners — full history.

- **53 editions of the 24 Hours of Nürburgring** (1970 through 2025) now live on the ADAC Past Winners tab — winning teams, full driver lineups, and chassis for every year the race was run. Skipped years (1974, 1975, 1983 — race not held) are correctly absent. Previous version of this list covered only the last 10 editions.

## 0.10.2 — 2026-05-18

Polish wave — small wins across notifications, errors, contact form, and ADAC content.

- **Notification icon is now a chequered flag.** When you get a push notification on Android, the status-bar icon reads as motorsport-coded instead of a generic shape.
- **Friendlier error page.** If something breaks while loading a page, you'll see a Paddock Tracker "Yellow flag" screen with a Try Again button instead of a raw stack trace.
- **Contact form gets categories.** Pick "Bug report", "Feature request", "Suggested change", or "General" — submissions self-sort in the inbox.
- **ADAC 24h Past Winners filled in.** Ten years of winning teams + driver lineups (2015–2024). The tab is also renamed from "Champions" to "Past Winners" since ADAC is one annual race, not a championship.

## 0.10.1 — 2026-05-18

Calendar accuracy pass + ADAC page cleanup.

- **Real race names everywhere.** DTM, NLS, GT World Challenge, Formula E, NASCAR Cup, WRC, and IndyCar weekend cards now show the actual race name above each date — "68th Daytona 500", "CrowdStrike 24 Hours of Spa", "São Paulo E-Prix", "Rallye Monte-Carlo", and so on. Previously these series showed a generic round number.
- **F1 Azerbaijan corrected.** The Baku race runs Saturday Sep 26 (Remembrance Day), not Sunday Sep 27. Calendar card date range now reflects this.
- **ADAC 24h page is no longer pretending to be a championship.** The Standings, Results, Drivers, News, and Rules tabs are hidden — only Calendar, About, History, and Champions (past winners) remain. NLS still shows the full tab set since it's a real 10-round series.

## 0.10.0 — 2026-05-17

Cross-device visual refresh — Paddock Tracker 1.0.

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

Paddock Tracker goes live on `paddock-tracker.com`. Custom domain, sign-in with Google, Vercel Analytics, Live-now pinned strip when any followed-series session is in progress, MDX blog at /blog, driver and team detail pages, full season results on F1, season trend charts, expanded standings, branded notifications with mute-series action, weather forecast on the next-session card, and an unlocked auth model (everything is browseable signed-out — accounts only unlock personalisation like push and follow lists).

## Pre-0.8.0

Internal development. PWA shell, multi-series calendar ingestion, settings page, sign-in, push notifications.
