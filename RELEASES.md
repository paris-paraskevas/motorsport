What's new in Paddock Tracker. Newest first. For per-commit engineering detail, see `CHANGELOG.md` in the repo.

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
