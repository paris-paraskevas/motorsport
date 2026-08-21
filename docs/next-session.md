# Next session — upload the blog, then evaluate session 30

Written at the session-30 close (2026-08-20 late, updated 2026-08-21 early). `main` = **0.325.1**, fifteen merges (#737-#751), zero open PRs, clean tree, every release prod-verified. Full detail: `docs/HANDOFF.md` top block + `CHANGELOG.md` 0.321.2 → 0.325.1.

Two jobs come first: **get the blog live** (it expires this weekend) and **audit what session 30 shipped** (a stranger's checklist is below, so you can verify rather than trust).

---

## 1. UPLOAD THE BLOG — runbook

The draft is committed at **`drafts/f1-dutch-grand-prix-2026-preview.md`** (moved out of the scratchpad so it is not lost). It is a Zandvoort-farewell preview in your voice, with a licence-verified hero image, one inline image, and four sourced Verstappen quotes.

**It already parses.** Dry-run on 2026-08-21 (no DB write, no secrets needed):

```
npx tsx scripts/draft-post.mts drafts/f1-dutch-grand-prix-2026-preview.md --dry
  slug: f1-dutch-grand-prix-2026-preview · title 84/140 · summary 263/300
  body 6428/50000 · seriesSlug f1 · publishAt (null — operator sets at approval)
```

**Read it first** (five minutes). Three things I flagged for your judgment, all easy to delete:
1. "roughly one hundred thousand people dressed in orange" — colour, not a verified 2026 attendance figure.
2. "which is its own kind of strange" — a voice bet; cut it if it is not you.
3. An alternate second image (Andretti's 1978 trophy, Anefo, licence-checked) is available if you want two inline pictures instead of one.

**Then insert it** (you run this — it needs the PROD service-role key, which I never hold; `.env.local` points at LOCAL Supabase, so a default-env run would silently go nowhere):

```
SUPABASE_URL=<prod> SUPABASE_SERVICE_ROLE_KEY=<prod> BLOG_AUTHOR_ID=<id> \
  npx tsx scripts/draft-post.mts drafts/f1-dutch-grand-prix-2026-preview.md
```

Then confirm, per the SOP: a `status='draft'` row exists on PROD, the post does **not** appear on public `/blog`, and you set `publish_at` when you approve it in the `/blog` admin queue. The publish cron takes it live and fires the push.

**Timing, because this one rots.** It is a preview of a race weekend that starts Friday 21 August (FP1 12:30 local, sprint qualifying 16:30) and ends Sunday. Publishing Friday morning still works. If it slips past Saturday, do not publish it as-is: pivot to a sprint-and-qualifying report on Saturday evening or a race report on Sunday, and I can turn either around fast because the fact packs are already built (`factpack-a-f1-summer-break.md`, `factpack-b-dutch-gp-zandvoort.md`, both in the session-30 scratchpad).

**One freshness note already applied:** the weather sentence was rewritten on 21 August after a re-pull. Friday now reads dry in the model, Saturday is the wet day (3.9 mm, 45 km/h gusts) and Sunday the driest. The prose deliberately quotes no millimetres, because the run-to-run swing has been large all week. Re-pull before publishing if you want to tighten it:
`https://api.open-meteo.com/v1/forecast?latitude=52.3888&longitude=4.5409&daily=weather_code,temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max&timezone=auto&start_date=2026-08-21&end_date=2026-08-23`

**The contract now**, since it changed mid-session ("i want you to read my previous blogs. then give me a draft"): I draft in your voice, you approve. Fact packs still back every number, house style still applies (no em dashes, no AI tells, always link out), and nothing ever reaches the DB or `content/posts/*.mdx` without your yes. You also asked for images in every post going forward, and for OpenF1 `team_radio` embeds to be designed.

---

## 2. EVALUATE SESSION 30 — verify, don't trust

Fifteen merges landed in one session, several written by subagents that then died on your session cap. Here is how to check each claim yourself. Every command is read-only.

### Quick global check

```
git log --oneline eb4f5e7 -15          # the session's merges, #737-#751
gh pr list --state merged --limit 15   # each PR body states what was verified
npx tsc --noEmit && npm run lint && npm test && npm run build
   # expect: clean · 0 errors + 2 known _encoding warnings · 1125/1125 · exit 0
curl -s https://paddock-tracker.com/changelog | grep -o "0\.325\.[0-9]" | head -1
```

### Claim-by-claim

| What I claimed | Check it yourself |
|---|---|
| Landing stall fixed (0.321.2) | `curl -s -o /dev/null -w "%{time_starttransfer}\n" https://paddock-tracker.com/` — was ~7 s in PSI, expect well under 1 s |
| Font preloads 19 → 5 (0.322.4) | `curl -s https://paddock-tracker.com/ \| grep -o 'as="font"' \| wc -l` → 5 |
| Redis SDK out of browser JS (0.322.4) | `grep -rn "import { kv }" lib/weather.ts` → none at top level; the import is inside `fetchWeather` |
| Tap targets 24 px (0.322.5) | `curl -s https://paddock-tracker.com/app \| grep -o 'py-1 text-text-muted' \| wc -l` → 17 |
| Standings CLS fixed (0.323.0) | Open `/series/f1/standings` on a phone, watch the table as the chart appears: it must not move. Then click **Constructors** and confirm that chart appears too |
| LCP images (0.323.1) | `curl -s https://paddock-tracker.com/drivers/kimi-antonelli \| grep -o "thumb/[^\"]*500px"` and check the weekend map has `width="500" height="500" fetchPriority="high"` |
| feed.xml carries DB posts (0.322.1) | `curl -s https://paddock-tracker.com/feed.xml \| grep -c "<item>"` → 19 |
| Champion notes live, fail-soft (0.324.0 / 0.325.0) | An enriched year shows "Title clinched": `/information/formula-1/who-won-the-2008-formula-1-championship`. An un-enriched one is untouched: `/information/formula-1/who-won-the-1985-formula-1-championship` |
| warm-live-data outage fixed (0.321.4) | `gh run list --workflow=warm-live-data.yml --limit 6` → all success |

### Where I would audit hardest (my own risk list, honestly)

1. **The trend-chart refactor (0.323.0) is the largest code change of the session and was started by a subagent that died mid-run.** I re-ran the whole gate chain and caught a real lint error in it, and I measured the reserved box against the mounted canvas at two widths plus the hidden-tab case. But I only clicked through **/series/f1/standings**. The same component also renders on **team pages, `/f1/compare`, and blog chart embeds** — worth eyeballing those three before you trust it everywhere.
2. **22 of the 30 F1 champion notes were not independently re-verified by me.** I checked 8 seasons against primary sources (2012, 2008, 2007, 2003, 2021, 2016, 1997, 1996) and cross-checked 24 numeric claims against `champions.json` with zero discrepancies; the other 22 rest on the two-plus sources cited inside `content/series/f1/champion-notes.json`, the same standard the 126-bio waves used. All 15 MotoGP notes I wrote and verified myself. If you want a tighter bar, spot-check a handful of the unchecked F1 years.
3. **`commonsThumb()` has an untested edge**: it always requests the 500 px bucket. Every one of the 22 portraits we ship was HEAD-checked at that width, but a future portrait whose original is narrower than 500 px could 404. Cheap guard if it ever bites: fall back to the original URL.
4. **`preload: false` on Plex Condensed and Plex Mono** removed 14 preloads. Every face still loads; nobody has watched a data-heavy page (standings, results) on a throttled connection for a flash of fallback text. Worth 30 seconds in DevTools on Slow 4G.
5. **The blog draft is mine, not yours.** Read it for voice before it ships, which is the point of the approval step.

---

## 3. AdSense: two waves shipped, four decisions waiting

Waves 1 and 2 are live: **F1 1996-2025** (`content/series/f1/champion-notes.json`) and **MotoGP 2011-2025** (`content/series/motogp/champion-notes.json`). The sidecar pattern means every further wave is data only, no code.

- **Wave 3 recommendation: F1 pre-1996 (46 seasons)** — completing one family reads better to a reviewer than half-finishing several. Then MotoGP pre-2011, then the other series.
- **Your calls** (all in `IDEAS.md` NOW #1, with evidence): making Race Story public on completed sessions (the cheapest remaining win — it enriches hundreds of session pages at zero authoring cost, and needs the SEO-Phase-2b ISR unpark that the PSI sweep independently asked for); the two stub components' copy and whether contentless tabs stay indexed; noindex on the 15 news tabs (the one family enrichment cannot fix).
- Then Request review **once**, when we believe it. Reviews run weeks apart.

## 4. Three design/behaviour decisions from the sweep

- **Serwist `cacheOnNavigation`**: the /calendar `DataCloneError` is upstream (`@serwist/turbopack@9.5.12` forwards a `URL` into `postMessage`). Recommend dropping the flag, since offline was removed in 0.268.0 and the feature is both vestigial and currently throwing.
- **Calendar contrast**: mono agenda times under 4.5:1 on Paper. Recommend a token nudge.
- **Month-grid tap targets**: recommend accept as-is.

## 5. Then the big one

**THE IMAGE SESSION** — your words, "the biggest job we have ever done". Licence-clean imagery at scale (Commons works; portraits and logos died on licensing before, so every source gets checked), the Fotis testing-build layout as the reference, home refined with image boxes to series and calendar. Information hubs are also the last pre-Paper surface and should be restyled in the same pass. Also owed: the PSI re-measure of `/`, standings and a weekend page so the four packages' deltas land in `docs/perf-baselines.md`.

---

## Ritual per PR (unchanged, hard-won)

`git checkout -b <branch> main` as the **literal first action after every merge** → edits → kill any dev server by PID first, then `rm -rf .next/dev` (deleting it under a live server 500s the server) → `npx tsc --noEmit` → `npm run lint` (0 errors; 2 known `_encoding` warnings) → `npm test` (1125) → `npm run build` exit-checked → browser-verify → trio (`package.json` + `CHANGELOG.md` + `RELEASES.md`) → commit with no Claude attribution → PR with what/why/verified → squash-merge → prod-verify ~9 min later with a background curl. Never kill processes by image name. Prod data writes only through the scheduled GitHub pathway, or when you name the action.

**Subagent rule, re-learned the hard way:** one research agent at a time. Three in parallel hit your cap; two left recoverable partial work (validated and shipped), one left nothing. Always look for partial output before redoing an interrupted agent's job, and never merge an interrupted branch without re-running the entire gate chain.
