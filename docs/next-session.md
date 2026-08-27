# The execution queue

Rewritten 2026-08-27 (session 38 close). `main` = **0.334.81**, prod verified, zero open PRs of mine, suite **1345**.

**The champion-notes programme is finished: 489 of 489, all fifteen series.** It is not the end of the thin-content work, and this queue is ordered by what is thinnest now, measured rather than assumed.

Every item states **what**, **why**, **where**, and **how prod is audited**. The ritual per item: branch → implement → `tsc` / `lint` / `npm test` / `build` → browser-verify → the trio (`CHANGELOG` + `RELEASES` + version) → PR with a real body → squash-merge → poll `/changelog` → audit on prod.

---

## Read this before touching anything

- **`/` IS the home page.** `/app` 301s to `/`. Reintroducing a `/` → `/app` redirect is an **infinite loop**.
- **`npx vitest` skips `pretest`**, so `CONTENT_BUNDLE` goes stale and content assertions pass against old data. Validate content changes with **`npm test`**.
- **`JSON.parse` reorders integer-like keys**, and so does assigning them to a plain object — V8 stores integer-like keys in ascending numeric order regardless of insertion order. So `out[year] = …` then `JSON.stringify` **silently inverts the file**. Build the JSON **text** directly from a derived `sort((a,b) => Number(b) - Number(a))` list, and verify by scanning the written **bytes** (`/^ {2}"(\d{4})": \{$/gm`). This guard fired for real in session 38 (`order broken at 1949 -> 1950`) and the file was restored from a backup taken in the same command.
- **A second session may be working in this same checkout.** In session 38 its branch was checked out underneath mid-wave and its unpushed commit already claimed the version this session was about to use. If `git branch --show-current` is not yours: **do not switch branches under it.** Use `git worktree add` with a real `npm ci`, and park your own tracked edits with `git stash push -- <paths>` so its files are untouched.
- **A `git worktree` with a junctioned `node_modules` runs vitest fine but Turbopack refuses it** — `Symlink [project]/node_modules is invalid, it points out of the filesystem root`. Run a real `npm ci` in the worktree rather than skipping `next build`.
- **After merging someone else's route renames, clear `.next`** or `tsc` fails on stale `.next/dev/types` for routes that no longer exist.
- **A local production build cannot browser-verify client-rendered pages** (prod Clerk keys reject localhost). Use `next dev`, or `npm run deploy:paris`.
- **Browser-verify the FIRST page of a wave, not the last.** Every defect in sessions 36, 37 and 38 was found that way.
- **Check a source's claim against `champions.json` before writing it.** Session 38 rejected four source framings that way: Ekström was not the first Swedish DTM champion (Stureson, 1985), Larini was not the first Italian (Ravaglia, 1989), and two Wikipedia driver pages contradict each other on IndyCar's 2012 runner-up so it is stated nowhere.
- **A family's shape can differ from every other family's.** NASCAR spans three championship formats under one name; the ADAC 24h is a single race, not a season; NLS scores on group positions, not overall.

---

## TIER 1 — the thin pages, in measured order

The audit that sets this order (session 38, over the live registry): **788 `/information` entries, 786 indexed, 238 of them under 130 words.** Median words by cohort — who-won 140, track profiles 274, editorial answers 169, series guides 750, `most-` record pages **58**. The old AdSense audit's benchmark for "enriched" was 150–160 rendered words.

**Correction to the session-38 figures, session 39.** This section said the record cohort was **22 pages, median 67, minimum 44**. Re-measured on prod-rendered HTML — fetch each URL, take the `<article>`, strip tags, count words — it was **23 pages, median 58, minimum 42**. The min page was named correctly (`endurance/most-successful-dtm-team`); the count and both statistics were not. **Only a rendered word count means anything here** — a source-character or registry-side estimate will drift from what a reviewer sees.

### 1. ~~The 23 `most-` record pages~~ — DONE, 0.334.83 → 0.334.85 (session 39)

**Complete: 23 of 23, median 58 → 221, minimum 42 → 191, maximum 263, none under 180** — both numbers measured on prod-rendered HTML, the after figure taken once 0.334.85 was serving. The mechanism and the first nine landed in 0.334.83, eight more in 0.334.84, the last six in 0.334.85. The thinnest page on the site went 42 → 203. Robots tags are unchanged: 21 `index, follow`, and the two F2/F3 team pages still `noindex, follow` because `featured: hasStableName(meta)` is a factual guard against mixing rebranded eras, not an indexing decision.

- **The mechanism, for the next cohort that needs one**: `content/series/<slug>/record-notes.json`, keyed by **half** (`drivers` / `teams`) rather than by year, so the V8 integer-key reordering that governs `champion-notes.json` does not apply and plain `JSON.stringify` is safe. `loadRecordNotes(slug)` in `lib/series-content.ts` on the same `readJsonIfExists` fail-soft gate; appended by `recordNoteLines()` in `lib/information/generated.ts` **after the derived lines but before the "Based on our curated…" provenance footer** (operator decision — that footer reads as the end of the page, so "append last" is not the same position as it is on the who-won entry). Guarded by `lib/record-notes-integrity.test.ts`. **Both new files were approved by the operator, 2026-08-27** — nothing here is pending a nod.
- **Four `champions.json` errors surfaced by checking record counts against sources**, three of them false claims on live indexed pages: WEC credited Toyota with two manufacturers' titles that were never awarded (the FIA replaced the top-class award with a teams' title for 2018-19 and 2019-20; Toyota's total is 5, not 7); WorldSBK had Yamaha as the 2009 manufacturers' champion when it was Ducati (which is why our Ducati total read 20 against Wikipedia's 21 — corrected, they agree across all 38 seasons); and **Formula E's teams record was published as a four-way tie at two when Renault e.dams holds it outright with three**, because season 1 was filed as `e.dams-Renault` and seasons 2-3 as `Renault e.dams`, so `rankTitles` counted one team as two. The fourth was a duplicate source on the gt-world 2014 note.
- **Four pages carry a bounded window and now say so in the note**: NASCAR (file starts 2000; Petty and Earnhardt also won seven, so it is a three-way tie), WRC (manufacturers' title dates from 1973, file from 1979, so Lancia's all-time ten beats Toyota's nine), IndyCar (file starts 1996; Foyt's seven leads all-time), NLS (file starts 2010; the series runs from 1977 and two drivers have five). **None is a data error** — each is a derived headline reading as an all-time claim.
- **Still open, and the operator's call:** the `summary` line — the meta description and hub teaser — makes its claim unqualified on all 23 pages, including those four. Fixing it means changing both record generators' summary text for every record page.

### 2. The ~204 who-won pages still under 130 words

Concentrated in the **ADAC 24h family** written in 0.334.81, and unavoidably so: a season yields a title fight, a margin and a decider; a single race yields laps, a crew and the weather. About forty of the fifty-four have no individual drama recorded in English-language sources.

- **The honest options are two:** find German-language sources per edition (the German Wikipedia has no per-edition articles either — checked, all 404 — so this means period press, not Wikipedia), or accept them as short and stop treating 150 words as the bar for a single race.
- **Do not pad them.** Padding a race report with generic circuit description is the scaled-content problem in a different costume, which is the thing this whole programme exists to avoid.

**RECOMMENDATION, session 39 — take the second option, and spend the effort on the noun instead.** Asked to bring back a recommendation rather than manufacture words, and having just written 23 notes over the same families:

1. **Accept them short, and retire the 150-word bar for single-race families.** That number came from *championship-season* pages, where a title fight, a margin and a decider supply the material by definition. A single race yields the crew, the car, the laps, the margin and the weather — the existing notes already carry all five. There is no sixth thing to say that is both true and specific, and every candidate for a sixth (circuit description, era context, marque history) is identical across the 54 pages, which is precisely the signal the programme exists to remove. Padding here would make the cohort *worse*, not longer.
2. **German period press is real but the return is poor.** Roughly forty editions, none digitised, one archive request each, for pages that would still be about laps and weather. Set against the record cohort — 23 pages, one day, and the thinnest content on the site — it is the wrong next spend.
3. **The cheap fix that IS worth doing is the wording, not the length.** The generator calls an ADAC or NLS win a "drivers' title" and titles the page "championships", because `driversTitleWord` and the question templates in `lib/information/generated.ts` have no concept of a one-race family. That is wrong on **70 who-won pages plus their two record pages**, it is a correctness problem rather than a length one, and it is one change rather than 204 research tasks. Do that instead.
4. **Re-measure before believing any of this.** After the record cohort the under-130 count is roughly 215, not 238. Nothing in the queue should quote a word count it has not re-measured on prod.

### 3. Ten generated country pages and three track profiles

`tracks/racing-tracks-in-austria` (89w), `-brazil` (99w), `-czech-republic` (101w), `-netherlands` (97w), `-portugal` (126w), `-sweden` (104w), plus `how-a-motogp-race-weekend-works` (124w), `how-a-worldsbk-race-weekend-works` (122w), `whats-new-in-dtm-2026` (127w), `whats-new-in-worldsbk-2026` (124w); and the track profiles `adria-karting-raceway` (125w), `circuito-internazionale-napoli-sarno` (125w), `circuito-internacional-de-zuera` (120w).

The country pages are generated from `content/information/tracks.json` in `lib/information/curated.ts` and get thin wherever a country has few venues. Cheapest real fix: give the sparse countries a sentence of curated context each in the tracks sidecar.

---

## TIER 2 — decisions the operator owes, each small once decided

### 1. Broaden `POINTS_PAIR`, or leave it — evidence gathered, decision not taken

`lib/champion-notes-integrity.test.ts`'s points-pair assertion only fires when the two numbers sit adjacent around "points to". `489 points to 361` matches; `498 points to Sykes's 447` does not, because good prose names the rival. So it currently checks **75** of 489 notes.

Broadening it to tolerate a short non-digit run after "to" would newly check **47 notes**, including 20 MotoGP and 5 F1 that escape today. Probed read-only across all twelve families in session 38. It is **not safe as a drop-in**:

- **`f1 1993` would fail while being correct** — "Ayrton Senna finished runner-up on 73 points to Prost's 99" is accurate prose that states the runner-up first, which a champion-first pattern reads as 73/99 against data of 99/73.
- **`motogp 2001` would false-positive** on "1973 to hold titles in the 125". Excluding the 1900–2099 band fixes that cleanly; no championship total lands there.
- Making the comparison **order-insensitive** fixes 1993 and keeps all 75 currently-passing matches passing, at the cost of no longer catching a transposed pair.

That last trade is a deliberate loosening of one dimension in exchange for 47 more value checks. **It needs a word from the operator**, per the standing rule against changing a test's strictness unilaterally. Worth knowing what it already earned: this line of work found the **F1 1979 note saying 50 points when the official total is 51** — an error the narrow regex would never have caught, before or after the fix.

### 2. The What's-New modal is still dark, and 1.0 is still not signed off

`lib/whats-new.ts` has `active: false`; `currentWhatsNew()` returns null so it renders nothing. The copy needs sign-off and the operator has said we are **not** ready for 1.0. Flip `active` in the same commit that bumps `package.json` to the matching version — `/changelog` reports the running version, and announcing 1.0 while running 0.334.x lies.

### 3. `champions.json` spells the IndyCar champion "Alex Palou" without the accent

He is **Álex Palou**. Left alone deliberately: renaming a driver touches the `driversOf` matching used for per-person title counts, so it deserves its own change rather than riding inside a content wave.

### 4. Month-grid tap targets — recommend ACCEPT as-is

Density is the point and the 0.313.0 mobile agenda already solves phones. Asked 2026-08-24 and 2026-08-26, still unanswered. One word retires it.

---

## TIER 3 — carried, and one thing to confirm on prod

### 1. Confirm the Learn-featuring flow end to end — needs an admin, so it is the operator's

0.334.68 added it and 0.334.69 made it reachable. Nothing on prod is featured yet, so the band has never been seen populated. **`/studio` → click a LIVE post's title → "Feature in Learn" at the foot → toggle on, pick a topic → Save.** It should appear on `/information` under "From our contributors" with the byline, and on that topic's page, immediately (the `feature` action calls `revalidatePath` for the hub and for both the old and new topic page). Toggling off removes it.

Two things to expect: it renders empty in `next dev` unless local Supabase is running, and the twelve What's-New crops sit in the Serwist precache (125 → 137 entries, 176 KB) for a modal that currently shows nothing — a measured, accepted cost recorded in 0.334.66.

### 2. Housekeeping left behind by session 38

- **`stash@{0}` in the main checkout** — "wsbk-wave: my CHANGELOG/RELEASES/version/2007-fix, parked off the console branch". Redundant now (all of it shipped in 0.334.70) and safe to drop.
- **The squash subject for #841 reads `(0.334.71)` while its entry and `package.json` say `0.334.73`.** The PR was renumbered after `main` moved and the squash took the original commit subject. The contract that matters — `package.json` and what `/changelog` reports — is correct. **Do not read the git log as the version authority.**
- The session-38 worktree under the scratchpad has been removed; `git worktree list` should show only the repo and `Motorsport-testing`.
