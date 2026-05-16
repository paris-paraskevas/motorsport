# Paddock — Per-Series Data-Source Audit (2026)

> Research as of 2026-05-16. All claims sourced inline. Frozen at this date; refresh when sources or season change.

---

## 2026 cancellation / postponement summary

The single biggest theme of 2026 is the Middle East war disruption. Across all three Middle East rounds originally scheduled for April, the same pattern repeats: cancel or push later in the year.

| Series | Round | Original | Status | New date |
|---|---|---|---|---|
| F1 | Bahrain GP (R4) | 10–12 Apr | Cancelled (technically "will not take place in April"; rescheduling later in 2026 still under active discussion as of mid-May, no decision yet) | TBC |
| F1 | Saudi Arabian GP (R5) | 17–19 Apr | Same as Bahrain — "will not take place in April"; rescheduling discussed but undecided | TBC |
| F2 | Bahrain + Jeddah support rounds | 10–12 / 17–19 Apr | Cancelled with F1 | None |
| F3 | Bahrain support round | 10–12 Apr | Cancelled with F1 | None |
| MotoGP | Qatar GP (R4) | 10–12 Apr | **Postponed**, not cancelled | 6–8 Nov (slots into Phillip Island / Sepang / Lusail triple-header) |
| MotoGP | Portuguese GP (Portimão) | original Nov slot | Rescheduled to make room for Qatar | 20–22 Nov |
| MotoGP | Valencia GP (finale) | originally 20–22 Nov | Pushed back | 27–29 Nov |
| WEC | Qatar 1812 km (R1) | 28 Mar | **Postponed**, not cancelled. Imola (originally R2) becomes opener; Prologue moves to 14 Apr at Imola | 22–24 Oct (now penultimate round, before Bahrain finale) |
| WSBK | none | — | No cancellations reported | — |
| IndyCar | none in 2026 | — | Thermal Club and Iowa dropped before the season (scheduling decisions, not 2026 cancellations); calendar otherwise running cleanly | — |
| IMSA | none | — | Schedule running on plan | — |
| NASCAR | Chicago Street Race | dropped from 2026 schedule before season; Mexico City dropped due to FIFA World Cup conflict | Pre-season schedule decisions, not in-season cancellations | — |
| Formula E | none | — | Season 12 running on its 17-round schedule | — |
| WRC | none | — | — | — |
| DTM | none | — | — | — |
| GTWCE | none | — | — | — |
| NLS | NLS2 | originally 28 Mar | Moved one week earlier in Jan 2026 (slot between F1 China and Japan, allowing Verstappen + others to enter) | 21 Mar |
| 24h Nürburgring | none | — | Ran 14–17 May 2026, fatality during qualifying (Juha Miettinen) but race proceeded | — |

Key open question for F1: as of mid-May the decision on whether Bahrain and/or Saudi return later in the year is "in overtime". A late-season slot between Baku and Singapore (Sep) is the most-discussed option for Bahrain; Jeddah may go to a Dec quadruple-header. Until F1 announces officially, `content/series/f1/sessions.json` should show the season as 22 rounds with Bahrain/Saudi flagged "cancelled — possible reschedule".

Sources: [Sky Sports F1 cancellation confirmation](https://www.skysports.com/f1/news/12433/13519453/f1-confirms-cancellation-of-bahrain-and-saudi-arabian-grands-prix-due-to-war-in-middle-east-as-2026-calendar-reduced-to-22-races), [Formula1.com official announcement](https://www.formula1.com/en/latest/article/bahrain-and-saudi-arabian-grands-prix-will-not-take-place-in-april.1hnqllVG85RSt8pbFc5Ivx), [GPFans reschedule speculation](https://www.gpfans.com/us/f1-news/1083447/bahrain-grand-prix-saudi-return-f1-2026-calendar-swap/), [PlanetF1 timeline](https://www.planetf1.com/news/f1-2026-calendar-decision-timeline-saudi-arabia-bahrain), [MotoGP Qatar postponement (motogp.com)](https://www.motogp.com/en/news/2026/03/15/motogp-confirms-new-date-for-the-qatar-grand-prix/1005668), [FIA WEC revised calendar (X/Twitter)](https://x.com/FIAWEC/status/2032471756158505166), [NLS calendar adjustment](https://www.nuerburgring-langstrecken-serie.de/language/en/2026/01/25/strategic-calendar-adjustment-for-the-nls-2026/).

---

## 1. Formula 1

- **Official URLs:** [formula1.com/en/racing/2026](https://www.formula1.com/en/racing/2026), [calendar.formula1.com](https://calendar.formula1.com/), and the official "sync calendar" article [download or sync the F1 race calendar to your device](https://www.formula1.com/en/latest/article/download-or-sync-the-f1-race-calendar-to-your-device.7mpETY062kafAl55qVnemu).
- **Formats:** Web HTML; official iCal subscription endpoint exists (via the "sync to calendar" flow on formula1.com — requires the user to follow the on-site link, not a documented public URL). No official REST API.
- **Robustness:** URLs `formula1.com/en/racing/{year}` and `formula1.com/en/racing/{year}/{slug}` have been stable for multiple seasons. The page format does drift (DOM changes once or twice a year). Updated in real time during race weekends. No rate limit visible.
- **Third-party aggregator:** **Jolpica F1 API** ([api.jolpi.ca/ergast/f1/](https://github.com/jolpica/jolpica-f1)) — drop-in replacement for the discontinued Ergast API, free, open-source, community-maintained. Confirmed funded through 2026. Endpoint `https://api.jolpi.ca/ergast/f1/2026.json` returns the season. Updates ~1× per race on Mondays now, targeting "few hours after each session" by 2026. **Better F1 Calendar** ([better-f1-calendar.vercel.app](https://better-f1-calendar.vercel.app/)) and **f1calendar.com** offer cleaner ICS feeds than F1's own.
- **Sample upcoming round (closest to 2026-05-16):** Round 5 — **Spanish GP, Barcelona, 22–24 May 2026**. Standard Friday FP1/FP2, Saturday FP3/Qualifying, Sunday race. (The Monaco GP follows on 5–7 June; Canada was 22–24 May in some sources but actual calendar shows Canada moved.) Reality check via formula1.com is the canonical source — paddock-tracker should auto-fetch session times from the Jolpica `2026/{round}.json` endpoint which exposes `time` per session.
- **2026 cancellations:** Bahrain (R4) + Saudi Arabia (R5) — see summary above. Season effectively 22 rounds.
- **Verdict:** **API (low effort)** via Jolpica. Already the obvious upstream. F1's own site can be used as a sanity-check / for session times that Jolpica may lag behind.

Sources: [Jolpica F1 GitHub](https://github.com/jolpica/jolpica-f1), [f1calendar.com](https://f1calendar.com/), [F1 2026 calendar article](https://www.formula1.com/en/latest/article/formula-1-reveals-calendar-for-2026-season.YctbMZWqBvrgyddrnauo8), [Wikipedia 2026 F1 season](https://en.wikipedia.org/wiki/2026_Formula_One_World_Championship).

---

## 2. FIA Formula 2

- **Official URLs:** [fiaformula2.com/Calendar](https://www.fiaformula2.com/Calendar), [calendar.fiaformula2.com](https://calendar.fiaformula2.com/), [2026 season overview article](https://www.fiaformula2.com/Latest/1FThPa9Dbn1yCx0A1UEXq9/2026-fia-formula-2-season-everything-you-need-to-know-about-calendar-drivers).
- **Formats:** HTML schedule, no documented public API or ICS endpoint advertised on official site.
- **Robustness:** URLs stable for the multi-year run of this domain. Site rebuild around 2023, format stable since. Calendar page is mostly static text + a calendar widget.
- **Third-party aggregator:** **f2calendar.com** mirrors the official schedule with ICS support. Motorsport.com [fia-f2/schedule/2026](https://www.motorsport.com/fia-f2/schedule/2026/) and 51gt3.com publish full breakdowns.
- **Sample upcoming round:** Round 4 — **Spain (Barcelona), 12–14 June 2026** (next F2 round after the long mid-season-gap caused by the cancelled Bahrain support round; Round 1 was Melbourne 6–8 March, Round 2 Miami 1–3 May, Round 3 Montréal 22–24 May). 14-round season aligned with F1.
- **2026 cancellations:** Bahrain and Saudi support rounds cancelled with F1 (no replacement).
- **Verdict:** **Scrape-able HTML (medium)**. No official ICS or API. f2calendar.com is the practical upstream until/unless an FIA digital feed appears.

Sources: [F2 2026 season article](https://www.fiaformula2.com/Latest/28OvYB98ektUm0D8vrUgYS/fia-formula-2-championship-2026-season-calendar-revealed), [FIA.com calendar announcement](https://api.fia.com/news/fia-formula-2-championship-2026-season-calendar-revealed).

---

## 3. FIA Formula 3

- **Official URLs:** [fiaformula3.com/Calendar](https://www.fiaformula3.com/Calendar), [calendar.fiaformula3.com](https://calendar.fiaformula3.com/).
- **Formats:** HTML same as F2 (same FIA template). No documented public API or ICS feed.
- **Robustness:** Same as F2 — stable domain, stable template.
- **Third-party aggregator:** Motorsport.com, 51gt3.com, motorsport-calendars.com, honda.racing.
- **Sample upcoming round:** Round 3 — **Monaco, 4–7 June 2026**. Subsequent rounds: Barcelona 12–14 Jun, Spielberg 26–28 Jun, Silverstone 3–5 Jul, Spa 17–19 Jul, Hungary 24–26 Jul, Monza 4–6 Sep, Madrid finale 11–13 Sep. 10 rounds total (down from typical 10 because Bahrain R2 was cancelled).
- **2026 cancellations:** Bahrain (Round 2, 10–12 Apr) cancelled with F1.
- **Verdict:** **Scrape-able HTML (medium)**. Identical to F2.

Sources: [F3 2026 calendar article](https://www.fiaformula3.com/Latest/16F8XBnz2PSr8Rn29WCsIs/fia-formula-3-championship-2026-season-calendar-revealed), [Wikipedia 2026 F3 season](https://en.wikipedia.org/wiki/2026_FIA_Formula_3_Championship).

---

## 4. MotoGP

- **Official URLs:** [motogp.com/en/calendar/2026](https://www.motogp.com/en/calendar/2026).
- **Formats:** Web HTML; an "official" ICS via ECAL (`motogp.com → Sync Calendar` red button) that requires email + ToS consent and produces multi-day "blob" events without session times — practically unusable. **Unofficial REST API**: `https://api.motogp.pulselive.com/motogp/v1/...` — documented community-style in [robschmitt/MotoGP-API](https://github.com/robschmitt/MotoGP-API). GET-only, JSON. This is the actual data source the official site itself uses.
- **Robustness:** Pulselive API has been stable for years (Dorna's backend provider). Real-time timing feed during sessions. No published rate limit but should be polite. URL pattern unchanged since at least 2021.
- **Third-party aggregator:** [Roman Zipp's MotoGP iCal generator](https://romanzipp.com/blog/motogp-2026-generate-ical-calendar) — actually-useful ICS with per-session events, configurable. [nixxo.github.io/calendars](https://nixxo.github.io/calendars/) — open-source ICS extracted from motogp.com. [fixtur.es/en/motogp](https://fixtur.es/en/motogp). Commercial: Sportradar.
- **Sample upcoming round:** **French GP at Le Mans, 8–10 May 2026** — already passed. Next is the **Catalan GP, Barcelona, 15–17 May 2026** (this weekend at time of writing). After that: **Italian GP at Mugello, 29–31 May 2026** with FP1/FP2 Fri, Q + Sprint Sat, Race Sun.
- **2026 cancellations:** Qatar GP postponed from April to **6–8 November 2026** (rescheduled, not cancelled). Cascade pushed Portimão to 20–22 Nov, Valencia finale to 27–29 Nov.
- **Verdict:** **API (low effort)** via the Pulselive backend (`api.motogp.pulselive.com/motogp/v1`). Free, JSON, includes session times. Single best non-F1 source in the audit.

Sources: [motogp.com 2026 calendar revealed](https://www.motogp.com/en/news/2026/01/01/2026-motogp-calendar-revealed/755478), [motogp.com Qatar postponement](https://www.motogp.com/en/news/2026/03/15/motogp-confirms-new-date-for-the-qatar-grand-prix/1005668), [Pulselive API docs](https://github.com/robschmitt/MotoGP-API), [Roman Zipp generator](https://romanzipp.com/blog/motogp-2026-generate-ical-calendar).

---

## 5. WSBK (Superbike World Championship)

- **Official URL:** [worldsbk.com/en/calendar](https://www.worldsbk.com/en/calendar).
- **Formats:** HTML only. No advertised official ICS or REST API. WorldSBK is also a Dorna property and likely shares the Pulselive backend (`api.worldsbk.pulselive.com/...`) — same architecture as MotoGP — but no community has published an explicit documentation of WSBK endpoints. Worth a network-tab investigation.
- **Robustness:** Calendar URL stable. Sportradar covers WSBK alongside MotoGP under "Superbike championship".
- **Third-party aggregator:** [toomuchracing.com](https://toomuchracing.com/calendar/) — ICS, dates only, free. [Rushsync WSBK 2026](https://rushsync.com/motorsport-calendars/world-superbike/2026) — ICS. Sportradar's MotoGP v2 API includes Superbike data.
- **Sample upcoming round:** **Italian Round at Misano, 12–14 June 2026** (closest from 16 May). Before that: Aragón just passed 29–31 May. 12 rounds total, Round 1 Phillip Island 20–22 Feb, finale Jerez 16–18 Oct (subject to contract). New 2026 standard race schedule has WSBK closing both race days after support classes.
- **2026 cancellations:** None.
- **Verdict:** **Scrape-able HTML (medium)** until Pulselive-style endpoint confirmed; if it works the same as MotoGP, upgrade to **API (low effort)**. Worth a DevTools spike before deciding.

Sources: [WorldSBK 2026 calendar](https://www.worldsbk.com/en/calendar), [provisional calendar announcement](https://www.worldsbk.com/en/news/2025/Provisional+2026+WorldSBK+calendar+unveiled), [new 2026 schedule format](https://www.worldsbk.com/en/news/2026/New+standard+schedule+unveiled+for+2026+WorldSBK+in+most+cases+to+be+final+race).

---

## 6. WEC (FIA World Endurance Championship)

- **Official URLs:** [fiawec.com](https://www.fiawec.com/), Le Mans-specific [24h-lemans.com/en/program](https://www.24h-lemans.com/en/program). Live timing: [fiawec.alkamelsystems.com](https://fiawec.alkamelsystems.com/).
- **Formats:** HTML schedule. No official ICS feed advertised. No public REST API. Live timing supplied by Al Kamel (also a private timing provider).
- **Robustness:** fiawec.com URL stable. Calendar pages updated with revisions (e.g. Qatar postponement) within days of FIA WMSC decisions.
- **Third-party aggregator:** [Rushsync FIA WEC 2026](https://rushsync.com/motorsport-calendars/fia-world-endurance-championship/2026), [motorsportradar.com/cal/wec/2026](https://motorsportradar.com/cal/wec/2026/) — both offer auto-updating ICS. [toomuchracing.com](https://toomuchracing.com/calendar/) covers WEC. No equivalent of Jolpica for endurance racing.
- **Sample upcoming round:** **24 Hours of Le Mans, 13–14 June 2026** at Circuit de la Sarthe. Pre-event "Great Week" 5–6 June (scrutineering in city centre); on-track Tuesday 10 June (FP1 14:00 local, LMP2/LMGT3 Qualifying 18:45, Hypercar Qualifying 19:30, FP2 22:00); Wednesday 11 June (FP3 14:45, Hyperpole rounds 20:00–21:40, FP4 23:00); Saturday 13 June (Warm-up 12:00, Race start 16:00 CEST). Following round: 6H São Paulo, 12 July 2026.
- **2026 cancellations:** Qatar 1812 km postponed from R1 (28 Mar) to **22–24 October** (penultimate round before Bahrain finale 7 Nov). Imola became opener; Prologue moved to Imola 14 Apr.
- **Verdict:** **Scrape-able HTML (medium)** for round headers + venue + date. Session times almost certainly require manual curation per round into a sidecar JSON (`content/series/wec/<round>.json`), at least until the relevant team page or race page on fiawec.com is in HTML.

Sources: [FIA WEC 2026 calendar article](https://www.fiawec.com/en/news/2026-fia-wec-calendar-builds-on-stability-of-recent-seasons/8356), [revised calendar X post](https://x.com/FIAWEC/status/2032471756158505166), [Le Mans 2026 program](https://www.24h-lemans.com/en/program), [Le Mans full timetable](https://www.fiawec.com/en/news/check-out-the-full-timetable-for-the-24-hours-of-le-mans/8329).

---

## 7. IndyCar

- **Official URL:** [indycar.com/Schedule](https://www.indycar.com/Schedule), per-event pages like [indycar.com/Schedule/2026/St-Petersburg](https://www.indycar.com/Schedule/2026/St-Petersburg).
- **Formats:** HTML schedule + a [PDF current-schedule PDF](https://www.indycar.com/-/media/Files/Current-Schedule.pdf). No public REST/JSON API. No advertised ICS feed.
- **Robustness:** URL pattern stable. Per-event pages exist with session times once published. Updates daily during race weekends.
- **Third-party aggregator:** **Sportradar IndyCar v2 API** (commercial, paid). [Goalserve](https://www.goalserve.com/en/sport-data-feeds/f1-api/prices), [Data Sports Group](https://datasportsgroup.com/coverage/motorsports/), [Sportbex](https://sportbex.com/motorsport-api/) — all commercial. No free open data equivalent of Jolpica exists for IndyCar.
- **Sample upcoming round:** **Indianapolis 500 (110th running), 24 May 2026** at Indianapolis Motor Speedway, green flag ~12:45 ET (broadcast 10:00 ET on FOX). Practice has been ongoing since mid-May; Carb Day is the Friday before. Following round: **Detroit GP, 31 May 2026**.
- **2026 cancellations:** None. (Thermal Club and Iowa Speedway were dropped before season; not in-season events.)
- **Verdict:** **Scrape-able HTML (medium)**. indycar.com per-event pages can be scraped for session times; the official "Current-Schedule.pdf" is also straightforward to parse. Alternatively, curate to a sidecar — IndyCar is only 17 races so manual curation is viable.

Sources: [IndyCar 2026 schedule announcement](https://www.indycar.com/news/2025/09/09-16-2026-sked), [2026 St Pete event page](https://www.indycar.com/Schedule/2026/St-Petersburg), [Sportradar IndyCar API](https://developer.sportradar.com/racing/reference/indycar-overview).

---

## 8. IMSA (WeatherTech SportsCar Championship)

- **Official URLs:** [imsa.com/weathertech/weathertech-2026-schedule/](https://www.imsa.com/weathertech/weathertech-2026-schedule/), per-event pages like [imsa.com/events/2026-weathertech-raceway-laguna-seca/](https://www.imsa.com/events/2026-weathertech-raceway-laguna-seca/).
- **Formats:** HTML schedule. **Official iCal/digital calendar via ECAL at [imsa.ecal.com](https://imsa.ecal.com/)** — IMSA was relatively early on the ECAL bandwagon, the integration is real and produces per-session events. No public REST API.
- **Robustness:** Stable. IMSA also publishes a detailed "Event Information" PDF for each season ([2026 event information page](https://www.imsa.com/competitors/2026-imsa-weathertech-sportscar-championship-event-information/)).
- **Third-party aggregator:** [toomuchracing.com](https://toomuchracing.com/calendar/), motorsport.com IMSA schedule. Sportradar covers IMSA under their motorsports tier.
- **Sample upcoming round:** **Detroit Grand Prix, 29–30 May 2026** on the Detroit Street Circuit (GTP + GTD classes, sprint format). After that: **Watkins Glen, 25–28 June 2026** (6-hour endurance, Michelin Endurance Cup). Closest passed round was **Laguna Seca, 1–3 May 2026** (2h40m).
- **2026 cancellations:** None. Road America extended to 6-hour endurance and is now the fourth Michelin Endurance Cup round (alongside Daytona, Sebring, Watkins Glen, Petit Le Mans).
- **Verdict:** **ICS feed** via imsa.ecal.com is the cleanest path — IMSA themselves treat ECAL as the canonical calendar export. Fall back to scrape per-event pages for session-level detail not exposed in ECAL.

Sources: [IMSA 2026 schedule](https://www.imsa.com/weathertech/weathertech-2026-schedule/), [IMSA reveals 2026 schedules](https://www.imsa.com/news/2025/03/13/imsa-reveals-2026-weathertech-championship-michelin-pilot-challenge-schedules/), [imsa.ecal.com](https://imsa.ecal.com/).

---

## 9. NASCAR Cup

- **Official URL:** [nascar.com/nascar-cup-series/2026/schedule](https://www.nascar.com/nascar-cup-series/2026/schedule/).
- **Formats:** HTML. NASCAR.com uses an internal feed but doesn't publish public API documentation. No advertised official ICS.
- **Robustness:** URL pattern `nascar.com/nascar-cup-series/{year}/schedule/` is stable since at least 2021. Per-race pages with start times. Updates frequent.
- **Third-party aggregator:** **[Jayski.com](https://www.jayski.com/nascar-cup-series/2026-nascar-cup-series-schedule/)** is the canonical fan-maintained source, very thorough, with TV times. **Sportradar NASCAR v3 API** (commercial). **SportsDataIO** NASCAR API (commercial, free dev tier). Racing-reference.info has historic data but not real-time schedule. No free open-data API.
- **Sample upcoming round:** **All-Star Race at Dover Motor Speedway, 17 May 2026** (3pm ET, FS1) — this is the non-points exhibition. Next points race: **Coca-Cola 600 at Charlotte, 24 May 2026** (6pm ET, Prime). Season opens Daytona 500 on 15 Feb 2026 at 2:30pm ET.
- **2026 cancellations:** None in-season. Chicago Street Race not on 2026 schedule (hopes to revive in 2027). Mexico City dropped due to FIFA World Cup conflict.
- **Verdict:** **Scrape-able HTML (medium)** — either nascar.com schedule page or Jayski. NASCAR's start times are reasonably stable and publicly listed.

Sources: [NASCAR.com 2026 Cup schedule](https://www.nascar.com/nascar-cup-series/2026/schedule/), [Jayski 2026 schedule](https://www.jayski.com/nascar-cup-series/2026-nascar-cup-series-schedule/), [Hendrick Motorsports 2026 TV schedule](https://www.hendrickmotorsports.com/news/articles/145758/2026-nascar-cup-series-tv-schedule-start-time-tv-broadcast-assignments).

---

## 10. Formula E

- **Official URL:** [fiaformulae.com/en/calendar](https://www.fiaformulae.com/en/calendar). Results portal [results.fiaformulae.com](https://results.fiaformulae.com/en/docs) is access-restricted.
- **Formats:** JS-rendered SPA. The site itself almost certainly fetches JSON from an internal API (not publicly documented) discoverable via DevTools. No advertised public ICS or REST API.
- **Robustness:** Very volatile rendering layer. SPA structure has changed across the last three seasons. Scraping rendered HTML is fragile and requires a headless browser. The internal JSON endpoints are stable enough to be the better target, but they're undocumented and may rotate.
- **Third-party aggregator:** [lauriejim/formula-e-api](https://github.com/lauriejim/formula-e-api) on GitHub — older but exists. [formulaecal.com](https://formulaecal.com/) — fan-maintained ICS. [Rushsync](https://rushsync.com/), [toomuchracing.com](https://toomuchracing.com/calendar/). Data Sports Group covers Formula E commercially. Note: 17-race Season 12 is the **longest in series history**.
- **Sample upcoming round:** **Berlin E-Prix double-header, dates in spring 2026** (the season splits across calendar years — Round 1 Sao Paulo 6 Dec 2025, R2 Mexico City 10 Jan 2026, R3 Miami 31 Jan 2026, then Jeddah double-header, Madrid debut March, Berlin double-header, Monaco double-header May, then Asia rounds Shanghai + Tokyo July, ending London 15–16 Aug 2026). The next round from 16 May 2026 is the **Monaco E-Prix double-header (early June 2026)** subject to confirmation against the official calendar.
- **2026 cancellations:** None. Jakarta dropped pre-season; Sanya added.
- **Verdict:** **JS-rendered SPA (needs Playwright/Sandbox)** for full session detail. For the headline calendar (round + date + venue), an ICS aggregator like formulaecal.com is fine. Likely a candidate for manual curation of session times since the site is the most painful in the audit.

Sources: [Formula E S12 calendar article](https://www.fiaformulae.com/en/news/751912/season-12-calendar-all-the-important-dates-for-the-2025-2026-formula-e-season), [Formula E S12 record-breaking 18-race article](https://fiaformulae.com/en/news/751909), [Wikipedia 2025-26 FE Championship](https://en.wikipedia.org/wiki/2025%E2%80%9326_Formula_E_World_Championship).

---

## 11. WRC (World Rally Championship)

- **Official URL:** [wrc.com/en/calendar](https://www.wrc.com/en/calendar).
- **Formats:** HTML schedule. No advertised official ICS or public REST API.
- **Robustness:** Stable URL. Per-rally pages include stage maps + schedules. Updated daily during rallies.
- **Third-party aggregator:** [toomuchracing.com](https://toomuchracing.com/calendar/) (WRC ICS), [Rushsync WRC](https://rushsync.com/). DirtFish and Motorsport.com publish full breakdowns.
- **Sample upcoming round:** **Rally Italia Sardegna, 4–7 June 2026** (closest after 16 May; Portugal just passed 7–10 May, Japan was 28–31 May... note search results showed some inconsistency between sources on the Italy/Japan swap — verify directly via wrc.com before shipping). 14-round season opens with Monte-Carlo 22–25 Jan, closes with Rally Saudi Arabia 11–14 Nov.
- **2026 cancellations:** None. Central European Rally dropped pre-season (lost its slot to Saudi); Rally Italia Sardegna and Rally Japan swapped slots.
- **Verdict:** **Scrape-able HTML (medium)**. Rally weekends are messy — stage times change daily based on conditions — so session-level detail is impractical to track upstream. Round + date + venue is achievable; per-stage times almost certainly stay as "TBC" or manual.

Sources: [WRC 2026 calendar announcement](https://www.wrc.com/en/news/2026-fia-world-rally-championship-calendar), [DirtFish 2026 confirmed](https://dirtfish.com/rally/wrc/wrc-2026-calendar-confirmed/), [Wikipedia 2026 WRC](https://en.wikipedia.org/wiki/2026_World_Rally_Championship).

---

## 12. DTM

- **Official URL:** [dtm.com](https://www.dtm.com/) and per-event pages. ADAC promoter site.
- **Formats:** HTML. No official ICS or public REST API surfaced in searches.
- **Robustness:** dtm.com URL stable since ADAC took over promotion in 2023. Per-event sub-pages exist.
- **Third-party aggregator:** [Rushsync DTM 2026](https://rushsync.com/motorsport-calendars/dtm/2026), [motorsport.com/dtm/schedule/2026](https://www.motorsport.com/dtm/schedule/2026/), motorsport-calendars.com, motorsportscalendar.com, racecountdown.com.
- **Sample upcoming round:** Just passed — **Red Bull Ring (R1), 24–26 April 2026** (season opener, first time outside Germany since 2022). Next: **Zandvoort, 22–24 May 2026**. 8 rounds total, finale at Hockenheim 9–11 Oct.
- **2026 cancellations:** None.
- **Verdict:** **Scrape-able HTML (medium)** — only 8 rounds so manual curation is also realistic. ADAC's per-event PDFs (similar to the 24h Nürburgring document) likely exist and offer session times for each weekend.

Sources: [Autosport DTM 2026 calendar](https://www.motorsport.com/dtm/news/dtm-unveils-2026-calendar-with-red-bull-ring-hosting-season-opener/10752268/), [Wikipedia 2026 DTM](https://en.wikipedia.org/wiki/2026_Deutsche_Tourenwagen_Masters), [51gt3.com 2026 DTM calendar](https://51gt3.com/en/article/100909/2026-dtm-race-calendar-official-season-schedule-revealed).

---

## 13. GT World Challenge Europe (Fanatec / SRO)

- **Official URL:** [gt-world-challenge-europe.com/calendar](https://www.gt-world-challenge-europe.com/calendar). Per-event pages like [event/246/circuit-paul-ricard](https://www.gt-world-challenge-europe.com/event/246/circuit-paul-ricard).
- **Formats:** HTML. No advertised ICS or public REST API. Per-event pages include detailed session timing schedules — these are scrape-able.
- **Robustness:** URL pattern stable. SRO has run this site consistently. Per-event entry list + session schedule + live timing all linked.
- **Third-party aggregator:** [racingcalendar.net](https://racingcalendar.net/championship/gt-world-challenge-europe-endurance-cup/), 51gt3.com (one of the better third-party GT3 data sources), Rushsync, motorsport-calendars.com.
- **Sample upcoming round:** **Monza (R3, Endurance Cup), 29–31 May 2026** — 3-hour race on Sunday 31 May. Before that: Brands Hatch Sprint Cup was 2–3 May. After Monza: 24 Hours of Spa (R4), **24–28 June 2026**, race start ~16:30 Saturday.
- **2026 cancellations:** None. Portimão returns as season finale (first appearance since 2015); Zandvoort moved May→September.
- **Verdict:** **Scrape-able HTML (medium)**. Per-event session schedule pages on gt-world-challenge-europe.com are detailed and structured well enough for parsing.

Sources: [GTWCE 2026 Paul Ricard event page](https://www.gt-world-challenge-europe.com/event/246/circuit-paul-ricard), [GTWCE 2026 Portimão return announcement](https://www.gt-world-challenge-europe.com/news/3033/gt-world-challenge-europe-powered-by-aws-returns-to-portim%C4%81o-for-2026-season-finale-), [Wikipedia 2026 GTWCE](https://en.wikipedia.org/wiki/2026_GT_World_Challenge_Europe).

---

## 14. NLS (Nürburgring Langstrecken-Serie)

- **Official URLs:** [nuerburgring-langstrecken-serie.de/language/en/calendar-nurburgring-langstrecken-serie-2026/](https://www.nuerburgring-langstrecken-serie.de/language/en/calendar-nurburgring-langstrecken-serie-2026/), [nuerburgring.de/events/categories/nurburgring-langstrecken-serie](https://nuerburgring.de/events/categories/nurburgring-langstrecken-serie?locale=en).
- **Formats:** HTML schedule. No official ICS or REST API. ADAC publishes per-race PDF supplementary regulations (Ausschreibung + Bulletins) that include session schedules — these are scrape-able but cumbersome.
- **Robustness:** URLs stable. Calendar gets adjusted mid-season (e.g. NLS2 moved 28 Mar → 21 Mar in January 2026 for the F1-Verstappen slot). Watch for changes.
- **Third-party aggregator:** [nls-schedule.vercel.app](https://nls-schedule.vercel.app/) — fan-built live countdown specifically for NLS 2026, surfaces session times. [51gt3.com NLS](https://51gt3.com/en/race/N%C3%BCrburgring-Langstrecken-Serie). [motorsportradar.com/cal/nls/2026](https://www.motorsportradar.com/cal/nls/2026/). [GT Report](https://www.gt-report.com/nls-entry-list/).
- **Sample upcoming round:** **NLS6, 20 June 2026** (next from 16 May after the 24h on 16–17 May which is co-located but is a separate ADAC event, not an NLS round). Already run: NLS1 14 Mar, NLS2 21 Mar, NLS3 10–11 Apr (57. Adenauer ADAC Rundstrecken-Trophy), NLS4 + NLS5 17–19 Apr (ADAC 24h Qualifiers). Season closes 10 Oct 2026.
- **2026 cancellations:** None. Calendar adjustment moved NLS2 forward one week (not a cancellation).
- **Verdict:** **Scrape-able HTML (medium)** + manual curation for session times via the per-event PDF schedules. The fan-built [nls-schedule.vercel.app](https://nls-schedule.vercel.app/) is a great structural model.

Sources: [NLS 2026 calendar](https://www.nuerburgring-langstrecken-serie.de/language/en/calendar-nurburgring-langstrecken-serie-2026/), [NLS adjustment article](https://nuerburgring.de/news/termine-2026-strategische-kalenderanpassung-fuer-die-nls-2026?locale=en), [Wikipedia 2026 NLS](https://en.wikipedia.org/wiki/2026_N%C3%BCrburgring_Langstrecken-Serie).

---

## Bonus: ADAC Ravenol 24h Nürburgring

- **Official URLs:** [24h-rennen.de](https://www.24h-rennen.de/en/), [nuerburgring.de/news/ring-guide-24h-nuerburgring-2026](https://nuerburgring.de/news/ring-guide-24h-nuerburgring-2026), Intercontinental GT Challenge [event page](https://www.intercontinentalgtchallenge.com/event/150/adac-ravenol-24h-nuerburgring).
- **Formats:** HTML + a downloadable [official schedule PDF](https://www.adac-sport.com/54_ADAC_RAVENOL_24h_Nuerburgring_15407/docs/55_LOG_B_015_Official_schedule_24h_race_2026_v3.pdf) ("Official_schedule_24h_race_2026_v3.pdf", revision-tracked).
- **Robustness:** ADAC publishes a clean PDF for the race schedule, revisioned (v3 as of last refresh). Excellent quality data, single annual event.
- **Third-party aggregator:** Intercontinental GT Challenge site (since the 24h is round 2 of IGTC 2026). 51gt3.com publishes livestream + full schedule. Wikipedia.
- **Sample data:** **14–17 May 2026** — administrative check Tue 12 May, Qualifying 1 Thu 14 May, Top Q1 & Q2 Fri 15 May 10:15–11:35, warm-up Sat morning, race start Sat afternoon, finish Sun afternoon. 161 cars entered (largest entry list since 2014). Note: the 2026 event was marred by Juha Miettinen's fatal crash during qualifying.
- **2026 status:** Race ran on schedule.
- **Verdict:** **Manual curation** is fine for a once-a-year event. The ADAC PDF is the canonical source; one curated `content/series/nurburgring-24h/2026.json` per year covers it.

Sources: [24h-rennen.de](https://www.24h-rennen.de/en/), [Official schedule PDF](https://www.adac-sport.com/54_ADAC_RAVENOL_24h_Nuerburgring_15407/docs/55_LOG_B_015_Official_schedule_24h_race_2026_v3.pdf), [Wikipedia 2026 24h Nürburgring](https://en.wikipedia.org/wiki/2026_24_Hours_of_N%C3%BCrburgring), [IGTC event page](https://www.intercontinentalgtchallenge.com/event/150/adac-ravenol-24h-nuerburgring).

---

## Recommended ingestion strategy

8 actionable bullets, prioritized by effort:weight ratio. The dominant pattern: F1 is solved, MotoGP is near-solved, and everything else is a curation pipeline.

1. **F1 — switch the canonical upstream to Jolpica `api.jolpi.ca/ergast/f1/{year}.json` and `api.jolpi.ca/ergast/f1/{year}/{round}.json` for session times.** Free, JSON, no auth, drop-in Ergast replacement. Already the obvious move. Keep an override layer (`content/series/f1/sessions.json`) for cases like the current Bahrain/Saudi limbo where the API may lag the news cycle.

2. **MotoGP — adopt the Pulselive backend `api.motogp.pulselive.com/motogp/v1`.** Same architecture F1 has with Jolpica. Free, JSON, no auth, used by the official site itself. Documentation at robschmitt/MotoGP-API. This is the highest-leverage upgrade in the audit — MotoGP gets full session times for free.

3. **WSBK — spike a DevTools network-tab investigation of worldsbk.com.** It's Dorna/Pulselive too. If the API is structured the same as MotoGP, ingestion is a 1-hour copy of the MotoGP loader. If not, fall back to scraping the calendar page and curating session times.

4. **IMSA — adopt ECAL feed at `imsa.ecal.com` as canonical for round + date + venue.** Per-event session times still need scraping from each `imsa.com/events/2026-{slug}/` page (or curation), but the ECAL backbone removes the brittle scrape on schedule changes.

5. **WEC, GTWCE, DTM, NLS — keep curation-first.** Each series has 8–12 rounds with a single annual schedule release plus targeted revisions. Per-round `content/series/<slug>/<round>.json` files are the right shape; scraping per-event pages on the official sites should serve as a fallback population step, but conversational curation per round will produce the most accurate session timings.

6. **WRC — calendar-level scrape from wrc.com, manual on stage times.** Stage schedules shift daily with weather; trying to ingest stage-by-stage timing is a losing battle. Treat WRC like an event-day series: ship rally dates + venue, leave per-stage times as "see wrc.com" with a deep link.

7. **NASCAR + IndyCar — scrape (or curate) HTML.** Both have ~17–36 rounds with single-date events; session times are published. NASCAR can use nascar.com or Jayski.com as source. IndyCar can use the per-event indycar.com pages or the master PDF. These two are the best candidates for "automated scrape with curation override" since the data structure is consistent.

8. **Formula E — manual curation only until SPA stabilizes.** Lowest priority for automation effort. The site is JS-rendered, internal endpoints undocumented, results portal access-restricted. Curate the 17-round Season 12 calendar once and refresh after each race weekend. If it must be automated, use Vercel Sandbox + Playwright on a daily cron — but the labour vs payoff is bad.

**Bonus rule for the cancellation/postponement reality check:** none of the above feeds will reliably express "round X cancelled" / "round Y postponed to new date Z" in a clean, structured way. The override-file pattern in `content/series/<slug>/sessions.json` is the right shape for this — fed by the conversational authoring workflow, not by the upstream feed. F1's Bahrain/Saudi situation, MotoGP's Qatar postponement, and WEC's Qatar postponement should each be one-line overrides today.
