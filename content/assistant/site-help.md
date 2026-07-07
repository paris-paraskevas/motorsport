# Paddock Tracker — site help (assistant grounding corpus)

This file is the ONLY source the in-app assistant may use to answer "how do I use
the site / what is this / where do I find X" questions. It describes what Paddock
is and how to use it. It deliberately contains NO live data (results, standings,
points, schedules, odds) — those live on the pages and change constantly, so the
assistant must send people to the relevant page rather than quote a number.

## What Paddock is

Paddock Tracker (paddock-tracker.com) is a free motorsport companion that tracks
15 racing series in one place: Formula 1, Formula 2, Formula 3, MotoGP, WorldSBK,
IndyCar, NASCAR Cup, Formula E, WEC, IMSA, GT World Challenge, DTM, WRC, NLS, and
the ADAC Ravenol 24h. It shows schedules in your local time, standings, results,
champions, and news — plus a free play-money prediction game. It installs as an
app on your phone (a PWA) and works offline for the schedule. You can browse most
of it without an account; some features (personalisation, predictions, following)
need a free account.

## Getting around

The top navigation has [Home](/app), [Calendar](/calendar), [Series](/series), [News](/news), and [Social](/social). Always link users to these with markdown links, never bare paths.
- [Home](/app) — your personalised dashboard: what's live or up next, what
  you just missed, this week's sessions, and any widgets you've enabled.
- [Calendar](/calendar) — every series' sessions, with Month / Week / Day views.
- [Series](/series) — the 15 series, grouped by category (formula, motorcycle,
  endurance, oval, rally).
- [News](/news) — cross-series news; the menu also links [Blog](/blog) and [Threads](/threads).
- [Social](/social) — the prediction game, leagues, and friends.
There is also a search button (top bar) to jump to a driver, team, series, weekend,
or page.

## Series pages and their tabs

Each series has its own page (e.g. [Formula 1](/series/f1)) with tabs that vary by
series: Overview/About, Standings, Results, Champions (or "Past Winners" for
one-off events), Calendar, and — for F1 — Tracks. F1 and F2 also have a Bets tab on
weekend pages. Link to a specific tab by its path, e.g. [F1 standings](/series/f1/standings)
or [F1 results](/series/f1/results).
- **Standings** — the current championship table, with a season trend chart where
  the data supports it.
- **Results** — past races; click a race to open that weekend.
- **Champions** — past title winners.
To see a specific number, open the tab — the assistant will not quote it.

## Race-weekend pages

A weekend page (e.g. `/series/f1/weekend/9`) shows the session schedule in your
local time, the circuit, where to watch, weather, results once available, and —
for F1 — an Upgrades section listing the new parts each team declared to the FIA
that weekend. F1 and F2 weekends also have a Bets tab.

## Following series and notifications

Signed-in users can follow series to prioritise them on the home page and opt in
to push notifications (per session type — practice, qualifying, race). Manage
notifications from the bell icon and your Account settings.

## Personalising your home

Signed-in users can customise the home page at [Customise](/settings/customize): show/hide,
reorder, and fold home blocks, and enable extra widgets (e.g. standings snapshot,
championship leader, next-race weather, circuit map, F1 car upgrades, your bets,
your leagues). Changes save instantly.

## Predictions and social (play money — no cashout)

The Social area has a free prediction game. It uses **play-money credits only —
there is no real money and no cashout, ever.** You get credits periodically and
bet them on race outcomes for bragging rights. Market types include race winner,
podium (top 3), top-10 finish, exact finish, and forecast (several drivers'
exact positions). You place bets on a weekend's Bets tab (F1 and F2 today). You
can create or join leagues to play with friends, add friends, and compete on
leaderboards. Predictions need a free account.

## Blog, threads, news

- **Blog** (`/blog`) — long-reads, previews and recaps.
- **Threads** (`/threads`) — fan discussion; signed-in users can submit, and posts
  are approved before they appear.
- **News** (`/news`) — aggregated cross-series news.
- **Release notes** (`/changelog`) — what's new in the app.

## F1 analysis

F1 has an analysis hub (`/f1/analysis`) with qualifying analysis, lap replays, and
telemetry-based leaderboards (speed traps, pit stops, overtakes). Some analysis
features require a free account.

## Account, install, offline

- Create a free account to follow series, personalise the home page, get
  notifications, and play the prediction game. Account settings live at `/settings`.
- Install Paddock as an app: use your browser's "Add to Home Screen" / "Install".
- Offline: the schedule for the coming days is cached so it still works with no signal.

## Help and contact

Use the Contact button or the Feedback page (`/feedback`) to report a bug, request
a feature, or ask a question. Legal pages (privacy, terms, cookies, accessibility)
are linked in the footer.

## What the assistant can and cannot do

The assistant helps you *use the site* and answers general questions grounded in
this page. It does NOT report live results, standings, points, schedules, or odds
— those are on the pages and change constantly, so it will point you to the right
page instead. If something isn't covered here, it will say so rather than guess.
