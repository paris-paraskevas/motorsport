# Ingestion Resource Evaluation — alternative motorsport data sources

> Research as of 2026-05-16. Five external resources evaluated for either direct consumption or pattern-borrowing as Paddock migrates toward Supabase Postgres + change-detection cron.

---

## 1. F2 Data Pipeline — `Alarchemn/F2-Data-Pipeline`

- **Coverage.** FIA Formula 2 only, seasons 2017–2023. Per-race data: Free Practice, Qualifying, Sprint Race(s), Feature Race. Driver name, team, car number, position, schedule, circuit. Race-results-only — no calendar, no standings, no live timing.
- **Source.** Scrapes `http://www.fiaformula2.com/Results?raceid={ID}` using BeautifulSoup + pandas `read_html`. Race IDs are hand-curated as Python lists per season (see `dags/utils/utils.py`).
- **Format.** Per-race CSVs in S3, concatenated into season CSVs (`DATA/season/season_YYYY.csv`) + `full_data.csv`. Published as Kaggle dataset.
- **Architecture.** Python + Apache Airflow (Docker on EC2) → S3 → AWS Lambda transform → second Lambda + EventBridge → Kaggle API upload. AWS Glue + Athena as optional analytics layer. Heavyweight infra for a small data volume.
- **Update cadence.** Manual trigger — Airflow DAG with `schedule_interval=None`. New race IDs must be added by hand.
- **License / cost.** MIT. Free. No API.
- **Robustness.** Stars: 11. Forks: 0. **Last commit 2023-08-15 (README-only).** Last code change July 2023. Dead/abandoned. Race-ID list stops at 2023. The 2024–2026 seasons are absent. Dataset on Kaggle similarly stale.
- **Verdict: Skip — but borrow one idea.** The pipeline itself is dead and over-engineered (EC2 + Airflow + 2× Lambda + S3 + Glue for a per-race CSV that updates ~22 times a year). The single useful pattern: **scrape-by-stable-event-ID + checkpoint each event as a flat file before transforming**. That makes re-runs cheap and gives an audit trail per event. We'd implement it as a single cron + Supabase insert, not Airflow + Lambda chains.

---

## 2. Motor Sport API on RapidAPI — `sportbex-api-default-api/motor-sport-api`

- **Coverage.** F1, MotoGP, NASCAR, Formula E, IndyCar, WRC, WEC, Supercars, "and more". Schedules, live timing (lap times / positions / sector), drivers, teams, lap-by-lap, odds, historical results. Broad on paper but **specific series coverage is unverified** — Sportbex's own docs say "availability may vary by competition".
- **Source.** Closed. Sportbex doesn't disclose where they aggregate from — almost certainly a mix of scrape + commercial feeds. Black box.
- **Format.** JSON or XML, documented on RapidAPI.
- **Update cadence.** Claims live timing. No SLA visible without subscribing.
- **License / cost.** Commercial. Free tier "automatically activated" with hard daily quota; paid plans billed monthly/yearly via RapidAPI marketplace. **No pricing visible on RapidAPI listing in search index** — would need to subscribe to see tiers. Plans are non-refundable.
- **Robustness signal.** Sportbex is a B2B sports-betting data vendor — they sell the same product across many sports. Their incentive is uptime. But the RapidAPI listing has no public review count or usage stats in indexed search results, which is itself a signal of low adoption.
- **Verdict: Skip.** Three reasons: (1) commercial dependency for an indie public-with-account project — recurring cost with no refund window. (2) Series coverage breadth is suspicious; "and more" usually means F1 well-covered, IndyCar/WEC patchy, niche series (TCR / DTM / WRX / GT World Challenge / IMSA) absent — exactly the 11 series where Paddock currently has no JSON API. (3) Vendor lock-in: if Sportbex deprecates or hikes pricing, we lose the entire coverage at once. **Closed-source aggregators are the wrong shape for Paddock** — we should be the aggregator.

---

## 3. TheSportsDB Formula 3 — league ID 4487

- **Coverage.** FIA Formula 3 (the F1 feeder, launched 2019). First recorded event 2019-05-11, current season 2025/26, current round 10 at time of writing. Fixtures, results, league/event metadata, artwork (logos, banners, fanart, posters). No live timing. No lap-by-lap. No drivers/teams beyond league-level.
- **Source.** **Crowdsourced.** Volunteer editors hand-enter events and metadata, like a sports-focused Wikipedia. 2.58M edits across 256K players, 20K teams, 500+ leagues.
- **Format.** JSON REST. Endpoint pattern: `https://www.thesportsdb.com/api/v1/json/{API_KEY}/eventspastleague.php?id=4487` (and `eventsnextleague`, `eventsseason`, `lookupleague`). Test key `3` works for development; personal key via $1/mo Patreon.
- **Update cadence.** Whenever an editor updates — no SLA. Major series stay current; long tail can lag.
- **License / cost.** Free for non-commercial. Free-tier rate limits: 100 req/min total, **`eventsseason` capped at 15 calls** (premium 3000). Premium $9/mo for production key + V2 API (livescores, video). Test key works but watermarks images.
- **Robustness signal.** Site is alive, actively maintained, F3 ID 4487 confirmed populated through 2025. Crowdsourced model means quality varies by series popularity.
- **Verdict: Adopt directly as a *fallback* for the 11 niche series.** TheSportsDB sits exactly in Paddock's gap — broad coverage of motorsport series with no official JSON API. Specifically worth testing for F3, F1 Academy, WRC, WEC, IMSA, FormulaE, NASCAR, IndyCar. Use as supplementary/fallback alongside hand-curation in `content/series/<slug>/`. The 15-req cap on `eventsseason` is fine for our use case (we hit it once per series per refresh). $9/mo premium tier is the right shape if free tier proves insufficient. **Don't replace primary scrapes — augment them.**

---

## 4. IndyCar calendar — `maxgubler/indycar-calendar`

- **Coverage.** IndyCar series only. Schedule with per-session timestamps (practice 1/2/3, qualifying, warmup, race). Race name, slug, sessions, TBC flag, lat/long stubs. Output schema matches `sportstimes/f1` repo format.
- **Source.** Started scraping `indycar.com` HTML. **In 2025 migrated to Fox Sports Bifrost API** (`api.foxsports.com/bifrost/v1/nascar/league/scores`) — same backend Fox uses for its own sports pages. API key is extracted from the Fox Sports website HTML (base64-encoded in a `data-hid="fs-settings"` script tag), then used to fetch month-by-month event listings, then per-event matchup/data URLs.
- **Format.** JSON output, written into the `sportstimes/f1` repo as a PR.
- **Architecture.** Python. Three-file pipeline: `indycar_schedule.py` (fetch + parse + build sessions object), `update.py` (diff against existing file), `sportstimes.py` (clone fork, commit, open PR via PyGithub). Recurring task. ~3 dependencies (requests, BeautifulSoup, dateparser, PyGithub, GitPython).
- **Update cadence.** Run as a recurring job/cron by the author. Only commits if diff exists.
- **License / cost.** No license file (effectively all-rights-reserved, though the README invites use). Free. Fox Sports API key is harvested, not paid for.
- **Robustness signal.** Last commit **2026-02-19** — *actively maintained*. Continuous history: Mar 2023 → today, ~25 commits, including 2024/2025/2026 season prep, FoxSports migration, error handling for cancelled sessions, parse-fix for specific races, "Freedom GP dataUrl" handling. **Single contributor**, 0 stars. Quietly excellent.
- **Verdict: Borrow approach — heavily.** This is the closest match to what Paddock needs to build. Specifically borrow:
  1. **API-key harvesting pattern** — `foxsports.com/motor/indycar/events` exposes the Bifrost API key in a base64'd script tag; the scraper extracts it once and reuses it across all subsequent JSON calls. The same pattern likely applies to many official series sites that have a SPA backend (we should test on `imsa.com`, `wec.com`, `nascar.com`).
  2. **Diff-then-commit pattern** — only update output when content actually changed. Maps directly onto Paddock's planned change-detection cron + Supabase.
  3. **Per-session normalisation with key disambiguation** — `build_sessions()` handles "practice 1/2/3", "qualifying" (with `qualifying2` for Indy500's two qualifying days), warmup, race, plus a graceful general fallback. Worth porting verbatim.
  4. **Session-cancellation handling** — explicit filter for items where subtitle contains "cancelled". Paddock currently has no equivalent and would silently render zombie sessions.

---

## 5. Multi-series race calendar — `armagantrs/race-calendar`

- **Coverage.** F1, MotoGP, NASCAR, WEC, Rally, IndyCar, Formula E, "Other". Calendar events with title/date/time/location/category. No standings, no results, no drivers, no live timing.
- **Source.** **None.** This repo seeds a MongoDB database with 8 categories and provides empty CRUD endpoints (`POST /events`, `PATCH /events/:id`). No scraper. No importer. No data file. Events have to be created by hand through the API. It's a CMS shell, not a data source.
- **Format.** REST JSON, MongoDB document storage, optional Postgres alternative.
- **Architecture.** Next.js 14 frontend (App Router, TS, Tailwind, shadcn/ui) + Express/TS backend + MongoDB 7 (events + categories) + optional Postgres 16 + Socket.IO for real-time + Docker Compose. Heavy stack for what's essentially Trello-for-races.
- **Update cadence.** N/A — no ingestion. Everything is user-entered.
- **License / cost.** MIT. Free.
- **Robustness signal.** Created 2025-11-03. **Single commit ("Fresh start"), 0 stars, 0 forks, single contributor.** Born dead — pushed once and abandoned within hours.
- **Verdict: Skip entirely.** This is a scaffold someone generated (likely AI-assisted given the polished-but-empty README, lack of any actual ingestion logic, "Built for Motorsports Enthusiasts!" tagline). Provides no data, no working scraper, no useful pattern. The Mongo schema is the only interesting bit and it's trivial (events with categoryId FK to categories). Paddock's existing file-based curation is already more sophisticated than this.

---

## Synthesis

### Patterns worth borrowing (in priority order)

**1. The `indycar-calendar` playbook (top priority).** Three reusable techniques for Paddock's 11 non-API series:

- **Harvest official-site API keys from HTML.** Most official series sites are SPAs with a documented (or undocumented) JSON backend that the page itself consumes. Extract the key once per scrape, fetch JSON. This is dramatically more robust than HTML scraping because the JSON schema is stable; the marketing site can be redesigned without breaking us. *Test targets: IMSA, WEC, NASCAR, SuperGT, DTM, WRC.*
- **Diff-before-write.** Only write/commit when content has changed. Maps directly onto a Supabase row-update trigger or a Postgres `MD5(serialized_payload)` column. Pairs perfectly with the planned change-detection cron.
- **Cancellation/TBC handling baked into the session builder.** Filter explicitly for cancelled sessions and surface a `tbc: true` flag on the race object.

**2. The F2 pipeline's checkpoint pattern (use a stripped-down version).** Cache the raw scrape per event as a flat file (or a Supabase `raw_payloads` table keyed by `{series, event_id, scraped_at}`) **before** parsing/transforming. Lets us re-run transforms when we discover parsing bugs, without re-hitting upstream. *Skip everything else about that project — Airflow, EC2, Lambdas, S3, Glue, Kaggle uploads. Drop-in equivalent: one cron + one Postgres table.*

**3. Per-series ID curation as a first-class concept.** Both indycar-calendar (`SESSION_ID_MAP`) and F2-Data-Pipeline (per-season race ID lists) demonstrate the same pattern: upstream IDs are messy/inconsistent, so curate a small mapping file per series. Paddock's `content/series/<slug>/` already does this for sessions; extend it to hold upstream event/round IDs once we start scraping JSON backends.

### Consume directly

**TheSportsDB** as a fallback layer for the 11 non-API series. Specifically wire it in for F3, F1 Academy, IMSA, WRC, WEC where the official sources are thin. Use the free tier behind our own cache layer (so the 100 req/min global limit and 15-call `eventsseason` cap never bite). Budget $9/mo for the premium key if usage outgrows free tier — that's still ~one TheSportsDB seat vs. building 11 bespoke scrapers.

### Skip

**Sportbex RapidAPI** (commercial black box, wrong incentive shape for an indie project) and **armagantrs/race-calendar** (empty scaffold, born-dead repo).

### Owner's specific question — "could we make something ourselves?"

Yes, and the IndyCar-calendar repo is essentially a working blueprint for one series, written in ~200 lines of Python and quietly maintained for three years by one person. Replicate that pattern per series, write the output into Supabase instead of a JSON file, and you have Paddock's ingestion layer. Estimated effort: 1–2 days per series for the JSON-backend ones (IMSA, NASCAR, WEC, FormulaE likely), ~half a day each for series where TheSportsDB has reasonable coverage and we use it as a fallback.

---

## Sources

- [Alarchemn/F2-Data-Pipeline](https://github.com/Alarchemn/F2-Data-Pipeline)
- [maxgubler/indycar-calendar](https://github.com/maxgubler/indycar-calendar)
- [armagantrs/race-calendar](https://github.com/armagantrs/race-calendar)
- [Motor Sport API on RapidAPI](https://rapidapi.com/sportbex-api-default-api/api/motor-sport-api)
- [Sportbex Motorsport API docs](https://sportbex.com/motorsport-api/)
- [TheSportsDB Formula 3 (league 4487)](https://www.thesportsdb.com/league/4487-formula-3)
- [TheSportsDB API documentation](https://www.thesportsdb.com/documentation)
