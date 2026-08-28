# Paddock — pre-launch social presence kit

**Status:** ready to execute. Nothing here has been posted, and no account has been created by Claude.
**Owner of execution:** operator. **Written:** 2026-08-28, session 40.
**Scope, as locked by the operator:** the presence half of the W8 launch program — accounts, identity, a four-week calendar and the copy to fill it. All five channels. The 1.0 launch posts are staged, not fired.

**Relationship to `docs/research/2026-07-06-launch-marketing.md`:** that document stays as the *launch-day* plan (§4 sequence, §B step 6 of the checklist). This one covers the eight weeks before it. Where the two disagree on a fact about the product, **this one is current** — every claim below was checked against prod on 2026-08-28. The screenshots were captured at **v0.334.89**; the claims were re-checked at **v0.334.95**, after nine merges landed the same day. Three of that document's claims are now wrong and are listed in §2c.

---

## 1. Why presence before launch, and not on the day

The launch plan assumes a standing start: accounts created on day 0, five channels posted at once, an audience arriving from nothing. That is the weakest possible version of the same effort.

- **Reddit filters new accounts.** A day-old account whose first post is "I built this" is the exact shape of spam that automod and most motorsport subs remove on sight. Karma and account age are not vanity numbers there, they are the entry requirement.
- **An empty profile converts badly.** Someone who taps through from a good post lands on a grid with one item. Four weeks of real posts makes the same tap land somewhere that looks alive.
- **The calendar is doing the work for free right now.** September has four dense race weekends in a row (§5). That is four weeks of natural, non-promotional content that also happens to demonstrate the product. After the season ends, it costs real effort to manufacture the same thing.
- **1.0 is not signed off** and has not been for five sessions. Waiting for it to start building an audience means the launch lands to nobody.

---

## 2. The claim inventory — what may be said, and what may not

RULE #1 applies to marketing copy exactly as it applies to a blog post. Everything in §2a was read off prod on 2026-08-28.

### 2a. Verified true — safe to say

| Claim | Where it is verifiable |
|---|---|
| Fifteen championships in one calendar | Site footer, verbatim: *"Independent motorsport companion, built in the open. Fifteen championships, every session in your own time zone. No account needed to browse."* |
| Every session in the reader's own time zone | `/calendar`, `/series/<slug>/weekend/<round>` |
| No account needed to browse | Footer, and every page above loads signed out |
| Calendar subscription by `.ics` | `/calendar` → "Subscribe to this calendar → .ics"; also per weekend, "Add to calendar" |
| Installs as an app | Footer button "Install as an app" |
| Weather hour by hour, per session | Monza weekend page: "Weather by session", FP1 through the race, temperature and conditions per hour |
| Where to watch | Weekend page, "Where to watch" → broadcaster link |
| A countdown to the next session | Weekend page, "First session · Practice 1 · 7d 03:04:25" |
| Season trend charts that match the standings table | `/series/f1/standings` — chart and table on one page |
| Champions year by year, with the race that settled it | `/series/<slug>/champions`, all fifteen series. **Do not put a season count in a caption without counting it on prod first** — the internal record says 489, which was not re-checked on the live pages |
| 619 sourced answers, linked into the live data | `/information` masthead, verbatim: *"619 answers, all sourced · linked into the live data"* |
| 138 venues on one map | `/information` rail: "All 138 venues on one map" |
| F1 qualifying analysis and race story, per round | `/f1/analysis` — "pole laps side by side, corner by corner", "stints, tyre calls, pit windows", plus head-to-head driver comparison |
| Predictions with virtual credits | `/social`, verbatim: *"Virtual credits only — nothing to buy, nothing to cash out."* and *"No cash, no catch — just bragging rights."* |
| Private leagues with friends, win-rate leaderboard | `/social` |
| Written by a person, with a byline | `/blog` — 24 posts, 22 F1 and 2 MotoGP, bylined |
| Open to contributors | `/blog` → "Write for Paddock — pitch a piece, the data is already here" |
| A browsable archive of the finished season | `/archive` — 200 on prod, added 0.334.90, fixed 0.334.91 |
| How each race was won, in writing | Weekend pages for completed rounds carry a "How it was won" account, checked against two independent reports (0.334.92). **F1 only so far** — do not generalise it to the other fourteen championships |

### 2b. Use the product's own words for the predictions framing

Not "play money, no cashout" (the 2026-07-06 doc's phrasing, which appears nowhere in the product) but the site's actual line:

> **Virtual credits only. Nothing to buy, nothing to cash out.**

Every post that mentions predictions carries it. Launch-checklist §A6 requires it, and a screenshot that reads as gambling gets a post removed from a subreddit and does not come back.

### 2c. Banned claims — verified false or unusable today

- **"Works offline."** There is no offline fallback. `app/sw.ts:14` says so in terms, and `components/SerwistRegister.tsx:30` records that offline was removed deliberately in 0.268.0. The 2026-07-06 Reddit draft says *"installs on your phone, works offline for the schedule"*. **Delete that clause.** Say "installs on your phone" and stop.
- **"Per-weekend F1 car upgrades from the FIA documents."** The feature is built and renders, but `content/series/f1/upgrades.json` carries rounds 1 to 11 only. Round 12 has run and shows nothing; the word "upgrade" appears nowhere on the completed Dutch GP weekend page on prod. The 2026-07-06 plan makes this the r/F1Technical wedge in three separate places. **It cannot carry a post until the curation catches up.** `/f1/analysis` is the better answer for that audience and it is live and current.
- ~~**"Browse the season archive."**~~ **RESOLVED the same day.** It 404'd because the 0.334.90 build failed on Cloudflare; 0.334.91 fixed it and `/archive` now returns **200** on prod. It is a good week-3 or week-4 post and is listed as usable in §2a.

### 2d. Say this instead of "an F1 app"

The wedge is not F1. Dozens of apps do F1 and do it with more money. The wedge is the person who follows **more than one** series and has no single home. Every post should be legible to that person first.

---

## 3. The account shape — one decision, with a recommendation

**Recommendation: split it. Brand on Instagram, X, YouTube and Facebook. Person on Reddit.**

- **Instagram / X / YouTube / Facebook → @paddocktracker, a brand account.** These platforms expect a product to have a product account. A brand handle is searchable, linkable from the site footer later, and survives being handed to someone else.
- **Reddit → your existing personal account.** Reddit is the one place where a brand account is a liability rather than an asset. The post that works there is "I built this and I want your feedback", and that sentence has to come from a person with a post history. If your account is thin, the fix is to spend the four weeks commenting in the motorsport subs like a normal reader, which is also the best research you will get.
- **Do not create a Reddit account named after the product.** It converts a "someone made a thing" post into an advert, and most motorsport subs remove adverts.

If you would rather keep everything under one identity, the workable version is a personal-brand account everywhere ("Paris, building Paddock") — weaker on Instagram, stronger on Reddit and X. It is a taste call and it is yours.

---

## 4. Identity kit

### 4a. Handles

Preferred: **`paddocktracker`** on all four brand channels, so the name is the same everywhere and matches `paddock-tracker.com`. Hyphens are unavailable or ugly on most platforms, so drop it.

Fallbacks in order, if taken: `paddocktrackerapp`, `paddock_tracker`, `paddocktrackerhq`, `thepaddocktracker`.

**Availability is unverified and I could not verify it from here.** Reddit blocks this environment's fetcher outright, YouTube redirects to a regional consent wall, and Instagram, X and Facebook block automated profile checks. A web search surfaced no existing account under either spelling, which is weak evidence and not proof. **Check all five in one sitting before claiming any of them**, so you do not end up as `@paddocktracker` on two platforms and something else on the rest. Consistency across the five is worth more than the perfect name on one.

One naming hazard: **"Paddock Club" is Formula 1's official hospitality brand.** Avoid any handle built on it.

### 4b. Display names

| Platform | Display name |
|---|---|
| Instagram | Paddock Tracker |
| X | Paddock Tracker |
| YouTube | Paddock Tracker |
| Facebook | Paddock Tracker |

### 4c. Bios, written to each platform's real limit

Character limits below are from third-party reference sites current to 2026, not platform documentation. **The field will reject an overlong bio when you paste it** — that is the real check, and each of these is written with room to spare.

**X — 160 character limit. Draft is 147.**

> Fifteen championships, one calendar. Every session in your own time zone, plus standings, results and the story of each weekend. Built in the open.

**Instagram — 150 character limit. Draft is 108, line breaks included.** Line breaks are supported and worth using.

> Fifteen championships. One calendar.
> Every session in your own time zone.
> Free. No account needed to browse.

**Facebook page — short bio, 101 characters on the page intro field. Draft is 92.**

> Fifteen motorsport championships in one calendar, every session in your own time zone. Free.

**YouTube — description field is long, but only the first ~150 characters surface in search. The draft's first line is 121, so it survives the truncation whole.**

> Fifteen motorsport championships in one calendar, every session in your own time zone. Free to browse, no account needed.
>
> Paddock Tracker follows Formula 1, MotoGP, WEC, IndyCar, NASCAR, Formula E, WRC, IMSA, DTM, F2, F3, WorldSBK, GT World Challenge, NLS and the ADAC Ravenol 24h. Schedules in your own time zone, live standings and results, season trend charts, circuit guides for 138 venues, and 619 sourced answers to the questions people actually ask about motorsport.
>
> Built and written by one person, in the open. https://paddock-tracker.com

**Reddit — your personal profile.** No product bio. If anything, one line saying what you build, so a curious reader can find it without you linking it in a comment.

### 4d. Link in bio

Point every profile at `https://paddock-tracker.com` with a UTM (§7). Resist a link-in-bio aggregator: it costs a click and gains nothing while there is one destination.

### 4e. Avatar

Source: `public/icons/icon-512.png` — the crossed chequered flags on near-black. It reads at small sizes, which is the only thing that matters for an avatar, and it matches the icon on the home screen of anyone who installs the app.

| Platform | Upload at | Notes |
|---|---|---|
| Instagram | 1080×1080 | Displayed as a circle; the flags are centred and survive the crop |
| X | 400×400 | Circle crop |
| YouTube | 800×800 | Circle crop |
| Facebook | 320×320 minimum | Displayed small, stored larger |

### 4f. Banners — these do not exist yet and need making

There is no banner asset in the repo. Both need the same treatment: the wordmark, the one-line positioning, and nothing else. Text must sit inside the safe area or it gets cropped on mobile.

| Platform | Canvas | Safe area |
|---|---|---|
| X header | 1500×500 | Keep text out of the lower left, where the avatar overlaps |
| YouTube banner | 2560×1440 upload | **1546×423 centred** is all that shows on mobile. Everything legible goes there. Leave the bottom centre clear for channel links |
| Facebook cover | 851×315 | |

Suggested banner content, in the site's own idiom: `PADDOCK•TRACKER` in the condensed caps wordmark, and beneath it *"Fifteen championships. One calendar."* on the paper background. Do not use a photograph you do not have a licence for — the same rule that killed portraits ×14 and team logos.

---

## 5. The four-week calendar

Pegged to the real fixture list, read from `content/series/*/rounds.json` and cross-checked against the rendered calendar on prod. **Weeks run Monday to Sunday.**

### The fixtures that drive it

| Weekend | What is on |
|---|---|
| **Fri 4 – Sun 6 Sep** | **F1 Italian GP (Monza) R13 · F2 R10 · F3 R9 · WorldSBK Magny-Cours R9 · WEC Lone Star Le Mans R5 · IndyCar season finale, Laguna Seca R17 · NASCAR Southern 500, Darlington R27** |
| **Fri 11 – Sun 13 Sep** | F1 Spanish GP, Madrid R14 · F2 R11 · F3 R10 · MotoGP San Marino R14 · DTM Sachsenring R7 · WRC Rally Chile R12 · NLS · NASCAR WWT Raceway |
| **Fri 18 – Sun 20 Sep** | MotoGP Austria R15 · IMSA Battle on the Bricks R10 · GT World Zandvoort R8 · NASCAR Bristol night race. **No F1** |
| **Thu 24 – Sun 27 Sep** | F1 Azerbaijan GP, Baku R15 · F2 R12 · WEC 6 Hours of Fuji R6 · WorldSBK Cremona R10 · NASCAR Kansas |

**On the number seven.** Seven championships hold a race between Friday 4 and Sunday 6 September. But the September calendar screenshot renders **five** weekend bands — F1, F2, F3, WorldSBK and WEC — because IndyCar's finale and NASCAR's Southern 500 are single-date entries without session-level data, so they appear as races on the grid rather than as banded weekends. **If a post says seven, the picture beside it shows five, and someone will count.** Either say five and let the picture carry it, or show the picture and say "and that is not counting IndyCar's title decider or the Southern 500 on the same days". The second is truer and more interesting.

### Week 1 · Mon 31 Aug – Sun 6 Sep — *the weekend that makes the argument*

| When | Channel | Post |
|---|---|---|
| Tue 1 Sep | X | Post 1 (§6a) — the September grid, the multi-series pitch |
| Wed 2 Sep | Instagram + Facebook | Post 2 (§6b) — carousel, the same grid then three detail shots |
| Fri 4 Sep | X | Post 3 (§6c) — Monza weekend page, times and weather, the day it starts |
| Sun 6 Sep evening | X | One line on the IndyCar title and the Southern 500 finishing hours apart. Reactive, write it on the day |

### Week 2 · Mon 7 – Sun 13 Sep — *Madrid, and the density repeats*

| When | Channel | Post |
|---|---|---|
| Tue 8 Sep | Instagram + Facebook | Post 4 (§6d) — the Learn hub, 619 answers, one answer as the card |
| Thu 10 Sep | X | Post 5 (§6e) — Madrid's round, the weekend page, "where to watch" |
| Sat 12 Sep | X | Reactive: MotoGP Misano and F1 Madrid qualifying on the same afternoon |

### Week 3 · Mon 14 – Sun 20 Sep — *no F1, so talk about the craft*

The quiet weekend is the right one for the "I built this" post: no race noise competing for attention in the subs, and a week of prior posts behind you.

| When | Channel | Post |
|---|---|---|
| Tue 15 Sep | **Reddit** — r/SideProject | Post 6 (§6f) — the build story. Read the sub's rules the morning you post |
| Wed 16 Sep | YouTube | Post 7 (§6g) — the 60 to 90 second Short. Also cross-post to IG Reels and FB |
| Fri 18 Sep | Instagram | The Short, as a Reel |
| Sun 20 Sep | X | Reactive: three championships settled something this weekend and F1 was not one of them |

### Week 4 · Mon 21 – Sun 27 Sep — *Baku, and the 1.0 pack goes on the shelf*

| When | Channel | Post |
|---|---|---|
| Tue 22 Sep | Instagram + Facebook | Post 8 (§6h) — the F1 analysis pages, qualifying corner by corner |
| Thu 24 Sep | X | Baku weekend page, same shape as post 3 |
| Fri 25 Sep | **Reddit** — one motorsport sub, chosen from what week 3 taught you | The tailored version of post 6, not a copy of it |
| Sun 27 Sep | — | **Review, do not post.** §7. Then decide whether the 1.0 sequence in the launch plan fires in October |

### Cadence after week 4

Two or three X posts a week anchored to race weekends, two Instagram posts a week, one YouTube Short a fortnight, Facebook mirroring Instagram, and Reddit no more than once a fortnight and only when there is something genuinely worth a stranger's time. **Anything more than that is not sustainable solo, and an abandoned account reads worse than no account.**

---

## 6. The posts

House style, as with the blog: no em dashes, no "revolutionise", no growth-hack sludge, link out, say the honest thing. Fill any bracket before posting. Every link carries its UTM from §7.

### 6a. X — post 1, week 1 Tuesday

> September, if you follow more than one championship:
>
> Monza on the 4th. F2 and F3 with it. WorldSBK at Magny-Cours. WEC at Lone Star Le Mans. IndyCar's title decider at Laguna Seca. The Southern 500.
>
> All of it. One calendar. Your own time zone.
>
> [link]

**Asset:** `docs/marketing/calendar-september-1440.png`.
**Note:** this wording names seven and shows five bands, which is honest because it names the two that are single-date entries rather than banded weekends. Do not compress it to "seven championships" over the same picture.

### 6b. Instagram + Facebook — post 2, week 1 Wednesday, carousel

Card 1: `calendar-september-1440.png` (crop to 4:5). Card 2: `f1-weekend-monza-1440.png`. Card 3: `f1-standings-1440.png`. Card 4: `calendar-390.png`.

Caption:

> Fifteen championships. One calendar.
>
> September has four race weekends stacked back to back, and if you follow more than one series there has not been a single place to see them together. So we built one.
>
> Every session in your own time zone. Standings and results that reconcile to the official tables. The weather hour by hour. Where to watch.
>
> Free, and you do not need an account to look.
>
> paddock-tracker.com
>
> #F1 #MotoGP #WEC #IndyCar #NASCAR #FormulaE #WRC #WorldSBK #IMSA #DTM #motorsport #ItalianGP #Monza

Facebook takes the same text with the hashtags cut to three.

### 6c. X — post 3, week 1 Friday

> Monza starts today.
>
> Practice at [time], and the forecast for every session is on the page. Qualifying tomorrow at [time]. Race Sunday at [time]. All in your own time zone, not mine.
>
> [link to /series/f1/weekend/13]

**Asset:** `f1-weekend-monza-1440.png`. **Check the times against the page on the morning you post.**

### 6d. Instagram + Facebook — post 4, week 2 Tuesday

Card 1: a clean crop of one answer from `/information`. Card 2: `learn-hub-1440.png`.

Caption:

> "What is the difference between MotoGP, Moto2 and Moto3?"
>
> We have written 619 answers like this one, every one sourced, and every one linked into the live data so the answer sits next to this year's actual standings.
>
> No sign-up, no paywall, no video you have to sit through.
>
> paddock-tracker.com/information
>
> #MotoGP #motorsport #F1 #WEC #learnmotorsport

### 6e. X — post 5, week 2 Thursday

> Two Spanish rounds on one calendar this year: Barcelona in June, Madrid this weekend.
>
> Session times in your own zone, the forecast by the hour, the standings going in, and where to watch it.
>
> [link to /series/f1/weekend/14]

**Verify before posting:** whether this is Madrid's first Formula 1 race. `rounds.json` has both a Barcelona-Catalunya round and a Madrid round in 2026, which is what the post above says and is safe. **Do not write "the first Madrid Grand Prix" without checking a primary source.**

### 6f. Reddit — post 6, week 3 Tuesday, r/SideProject

**Title:** I got tired of juggling four apps to follow four championships, so I built one calendar for fifteen

**Body:**

> I follow F1, MotoGP and WEC, and every season I end up with three apps, a browser tab and session times in the wrong time zone. Nothing covered all of it, so I spent [duration] building Paddock.
>
> It tracks fifteen championships: F1, MotoGP, WEC, IndyCar, NASCAR, Formula E, WRC, IMSA, DTM, F2, F3, WorldSBK, GT World Challenge, NLS and the ADAC Ravenol 24h. One calendar, every session in your own time zone, subscribable as an .ics feed.
>
> The parts I am most pleased with:
>
> - **The weekend pages.** One page per round with the schedule, the forecast hour by hour for each session, where to watch, the standings going in, and the circuit.
> - **Season trend charts** that reconcile exactly to the official standings tables. Getting that to hold across fifteen series with fifteen different points systems took longer than everything else combined.
> - **619 written answers** about how the sport works, all sourced, linked into the live data rather than sitting in a separate wiki.
> - **F1 qualifying analysis** comparing pole laps corner by corner, and a race story with the stints and pit windows.
>
> There is also a predictions game with virtual credits and private leagues. Nothing to buy and nothing to cash out, it is for bragging rights.
>
> It is free, it installs as an app, and you do not need an account to browse. I am the only person working on it.
>
> What I would like feedback on: if you follow a series I have covered, is anything obviously missing or wrong for it? That is the thing I cannot check on my own across fifteen championships.
>
> [link] · [2-3 screenshots]

**Before posting:** read r/SideProject's current rules the same morning. Reply to every comment for the first six hours. Do not post the same body to a second sub.

### 6g. YouTube — post 7, week 3 Wednesday, 60 to 90 second Short

Screen capture, phone in hand, no voiceover needed if the captions carry it.

1. **0-3s hook.** "Every motorsport app does one series. This one does fifteen." — over the September calendar with all fifteen filters lit.
2. **3-15s.** Scroll September. Let the density speak. Tap into the Monza weekend.
3. **15-30s.** The weekend page: session times, then the weather strip, then where to watch.
4. **30-45s.** Standings, and the trend chart drawing in.
5. **45-55s.** `/f1/analysis`: pole laps side by side.
6. **55-70s.** Predictions and a friend league. Caption on screen: *"Virtual credits. Nothing to buy, nothing to cash out."*
7. **70-80s.** Install to home screen. "Free. No account needed to browse."

**Title:** Fifteen motorsport championships in one calendar
**Description:** first line is the pitch and the link, then the series list from §4c.

### 6h. Instagram + Facebook — post 8, week 4 Tuesday

Card 1: `f1-analysis-1440.png`. Card 2: a qualifying analysis page for a completed round.

Caption:

> Once a Grand Prix weekend has run, the timing data unlocks two breakdowns: how pole was taken, corner by corner, and how the race was won, stint by stint.
>
> Both free, both for every round of the season, and you can put two drivers side by side across the whole year.
>
> paddock-tracker.com/f1/analysis
>
> #F1 #Formula1 #F1Tech #motorsport #AzerbaijanGP

---

## 7. Measurement

Every link in every post carries a UTM, or week 5 is guesswork.

```
https://paddock-tracker.com/?utm_source=<x|instagram|facebook|youtube|reddit>
                            &utm_medium=social
                            &utm_campaign=prelaunch-2026-09
                            &utm_content=<w1-x-september-grid>
```

`utm_content` is the post, and it is the field that tells you which *post* worked rather than which channel. Name it `w<week>-<channel>-<slug>`.

**Review on Sunday 27 September, five things only:**

1. Sessions by source and medium in GA4, week over week.
2. Which `utm_content` values actually delivered. Expect one or two to carry everything.
3. New accounts in the Clerk dashboard, day by day, against the post dates.
4. Which series pages the arriving traffic looked at. If it is all F1, the multi-series thesis is not landing yet and the copy needs to lead harder on the second series.
5. Followers, last and least. It is the number that feels like progress and predicts the least.

---

## 8. Rules of engagement

- **Never post the same text to two subreddits.** It is the fastest route to a sitewide shadowban, and it gets the domain blacklisted from subs permanently.
- **Read the sub's rules the morning you post**, not once when this document was written. They change, and mods enforce the current version.
- **Answer every comment for the first six hours** on a Reddit post. Drop-and-run is the behaviour the culture exists to punish.
- **Never imply gambling.** Virtual credits, nothing to buy, nothing to cash out. Every time.
- **Be honest about thin coverage.** Some series are schedule-only. Saying so pre-empts the "X does not work" comment and reads as confidence rather than weakness.
- **No fake accounts, no vote manipulation, no engagement pods.** Aside from being against every platform's terms, the audience is small and technical enough to notice.
- **Do not claim a number you have not just checked.** 619 answers, 138 venues and fifteen championships were true on 2026-08-28. Numbers grow, and a stale number in a caption is a small lie that is easy to avoid.

---

## 9. The asset pack

Captured from prod on 2026-08-28 at v0.334.89, signed out, in the site's default paper theme. **The 2026-07-06 plan's "dark theme" asset spec was stale** — the site is light, and the editorial look is a differentiator rather than something to hide.

| File | What it shows | Best for |
|---|---|---|
| `calendar-september-1440.png` | **The hero.** All fifteen series, September, full page. Colour-banded weekends stacked four deep | The multi-series pitch, everywhere |
| `calendar-september-390.png` | The same month on a phone | IG story, Reel end card |
| `calendar-390.png` | The mobile agenda view with This Weekend cards | Phone-in-hand shots |
| `home-1440.png` | The editorial front page with the lead story | "It looks like a paper, not a dashboard" |
| `home-390.png` | The same on a phone | IG carousel card |
| `f1-weekend-monza-1440.png` | Schedule, countdown, circuit, weather by session, where to watch, standings going in | The single best "what does it actually do" card |
| `f1-weekend-monza-390.png` | The same on a phone | Reels, stories |
| `f1-standings-1440.png` | Season trend chart plus the table | The stats audience |
| `f1-analysis-1440.png` | Qualifying analysis and race story, every round | r/F1Technical, X tech accounts |
| `f1-champions-1440.png` | Champions year by year | The history posts |
| `learn-hub-1440.png` | 619 sourced answers, 138 venues | The Learn post |
| `blog-1440.png` | 24 bylined posts, contributor pitch | "There is writing here too" |
| `predictions-1440.png` | Predictions, leagues, and the virtual-credits framing on screen | Only ever with the no-cashout line |
| `f1-weekend-dutch-howitwaswon-1440.png` | A **completed** round: the finishing order plus the written "How it was won" account | The strongest single card. Pair it with the Monza shot to show before and after a race |
| `archive-1440.png` | The season archive, all fifteen championships with their round counts | The "we keep the season after the feeds drop it" post |

**Still to make, and not blocking week 1:** the X header, the YouTube banner, the Facebook cover (§4f), and the screen recording behind the Short (§6g).

---

## 10. What I could not verify, and what is open

1. **Handle availability on all five platforms.** Reddit blocks this environment, YouTube consent-walls it, Instagram, X and Facebook block automated checks. Check them yourself, in one sitting, before claiming any.
2. **Bio character limits** come from third-party reference sites, not platform documentation. The paste is the real test and every draft has room to spare.
3. **Whether 2026 is Madrid's first F1 race.** Not checked. §6e is written so it does not depend on the answer.
4. ~~**`/archive` is 404 on prod**~~ — **closed.** The 0.334.90 Cloudflare build failed on the 60-second per-page export budget for `/`; 0.334.91 fixed it by memoising the season-archive reads, and `/archive` now returns 200.
5. **The F1 upgrades curation stopped at round 11.** Launch-checklist §A2 asks for exactly this and it is currently red. Catching it up would give back a strong r/F1Technical angle that is unusable today.
6. **The operator's Reddit account history.** §3 assumes there is one to post from. If not, week 3's post moves to week 5 and the four intervening weeks are spent reading and commenting.

---

## 11. Not in scope, deliberately

- **No account was created and no post was published** in producing this.
- **No app code was touched.** The in-app half — footer social icons, `Organization.sameAs` in the JSON-LD, `twitter:site` — is a separate job and is blocked until the handles exist, which is exactly why 0.12.3 cut footer social icons in the first place: *"Paddock doesn't have official social channels yet; would just be dead links."*
- **The 1.0 flip is untouched.** When it happens, the launch-day sequence in `docs/research/2026-07-06-launch-marketing.md` §4 takes over, corrected by §2c above.
