# The execution queue

Rewritten 2026-08-26 (session 36 close). `main` = **0.334.58**, prod verified, tree clean, zero open PRs, suite **1230**.

Every item states **what**, **why**, **where**, and **how prod is audited**. The ritual per item: branch → implement → `tsc` / `lint` / `vitest` / `build` → browser-verify → the trio → PR with a real body → squash-merge → poll `/changelog` → audit on prod.

---

## Read this before touching anything

- **`/` IS the home page.** The marketing landing was retired in 0.334.42; `/app` 301s to `/`. Do not reintroduce a `/` → `/app` redirect: with the 301 in place it is an **infinite loop**.
- **`npx vitest` skips `pretest`.** `CONTENT_BUNDLE` goes stale, so content assertions pass against old data. Validate content changes with **`npm test`**.
- **`JSON.parse` reorders integer-like keys at BOTH ends of a splice** — the target file *and* the entries file. So the insertion order must be **derived** (sort descending), never read from `Object.keys`, and the order guard must scan the file's **bytes** (`/^ {2}"(\d{4})": \{$/gm`), because a parsed-key check can never see textual order. Both guards fired in session 36 before anything was written. The working script is `splice-motogp-notes.mjs` in the session scratchpad; **it is not in the repo** — recreate it from the pattern above, it is ~60 lines.
- **A local production build cannot browser-verify client-rendered pages.** Prod Clerk keys reject localhost, hydration dies, and the page renders as an un-hydrated shell that looks like a broken change. Use `next dev`, or `npm run deploy:paris`.
- **Playwright may be blocked by stale agent-owned Chrome.** If it reports "Browser is already in use", find the PIDs whose command line contains `mcp-chrome-` and kill **those PIDs** (never by image name).
- **A deploy leaves a stale-chunk window** — see TIER 1 item 1.

---

## TIER 1 — two operator actions, then two operator decisions, then the programme

### 1. Cloudflare build command — still the only live defect
`Cache-Control: s-maxage=85, stale-while-revalidate=2592000`, so the R2 page cache can serve HTML from *before* a deploy that points at build-hashed chunks which no longer exist. **The first visitor to any page after each deploy gets a page whose JS 404s.** Measured twice.
- Local `npm run deploy` runs `cf:populate`. **Workers Builds has its own command in the Cloudflare dashboard** — if it is just `cf:build && wrangler deploy`, add `&& npm run cf:populate`.
- **Operator action** (dashboard access). **Audit**: deploy, then immediately fetch `/` and check every `/_next/static/*` reference returns 200 and not `text/html`.

### 2. The 1.0 flip — needs copy sign-off, not code
Everything is built and **dark**. `LAUNCH_ANNOUNCEMENT` in `lib/site.ts` holds the modal: kicker, title, intro, six capability rows, three "what comes next" items.
- **The operator signs off the copy, `next` above all — anything named there is a public promise.** The three currently read: photography across the site; a page for each day of a race weekend; circuit maps and corner-by-corner tours.
- Then: flip `active` to `true` **in the same commit** that bumps `package.json` to `1.0.0`, per `docs/launch-checklist.md` §B, and run `npm run indexnow:submit` after.
- **Audit**: on prod, the modal appears once, dismisses permanently, and `/changelog` reports 1.0.0.

### 3. DECISION — what a note says when no source states the deciding round
**This blocks ~36 MotoGP seasons and it is the same question as item 4.** Sourced clinch rounds thin out sharply before about 1990: everything from 1990 forward has been findable in a sentence, and below it the record is race results without championship context. Session 36 held back **1996, 1986, 1982 and 1981** rather than guess, and left everything from 1980 back untouched.

Three options, and the middle one is the recommendation:

**(a) Keep the clinch template, leave un-sourceable seasons un-enriched.** They stay `noindex` and thin. Families stay permanently partial — MotoGP would cap at about 45 of 77. Costs nothing, delivers nothing.

**(b) A second note shape for these seasons — recommended.** The page stops claiming a deciding round and says what the season *was*. Needs one small change in `whoWonEntry` (`lib/information/generated.ts:139-142`): render the label from the note rather than hard-coding "Title clinched", so an entry can carry `season:` instead of `clinched:`. Rendered, for a season we cannot pin:

```
Kenny Roberts won the 1980 500cc riders' championship, racing for Yamaha,
clinching the title on 87 points.

It was Kenny Roberts's 3rd of 3 MotoGP titles (1978, 1979, 1980).

The season:  Eight rounds, three wins, and a third title in three years,
             taken by 15 points from Randy Mamola. Sources do not record
             which round settled it.
```

**(c) Bounded clinch — say only what is provable.** Keep one field, and where the round is unknown state the bound the arithmetic gives: "settled with at least a round to spare in 1980". Data-only, no code, but it reads like a hedge and it is weaker than (b) on every page.

### 4. DECISION — the shape for ADAC (54) and NLS (16)
Both are single races, not championships, so "where the title was settled" is meaningless. `champions.json` for them is a winners list of **crews** (ADAC 1970–2026, NLS 2010–2025). Same mechanism as item 3 — the field carries a different label. Rendered sketch:

```
Maro Engel, Maxime Martin, Fabian Schiller and Luca Stolz won the 2026
ADAC Ravenol 24h Nürburgring with Winward Team RAVENOL.

The race:  Their Mercedes-AMG GT3 led ... of 24 hours and ... laps,
           finishing ... ahead of ...; the race was interrupted for
           fog on the Saturday evening.
```

**70 seasons ride on this.** Deciding it before anyone researches it is the whole point of asking.

### 5. Champion-notes enrichment — 166 of 489 done, 323 left
The gate (0.334.43) makes a who-won page indexable **iff** its season has a note, so **a wave needs no code**: authoring notes re-indexes its pages by existing.

| series | pages | done | left |
|---|---:|---:|---:|
| **f1** | 76 | **76** | **0 ✅** |
| **f2** | 21 | **21** | **0 ✅** |
| **f3** | 16 | **16** | **0 ✅** |
| **formula-e** | 12 | **12** | **0 ✅** |
| motogp | 77 | 41 | **36** ⚠ blocked on item 3 |
| adac-ravenol-24h | 54 | 0 | 54 ⚠ blocked on item 4 |
| wrc | 47 | 0 | 47 |
| dtm | 39 | 0 | 39 |
| wsbk | 38 | 0 | 38 |
| indycar | 30 | 0 | 30 |
| nascar-cup | 26 | 0 | 26 |
| nls | 16 | 0 | 16 ⚠ blocked on item 4 |
| wec | 13 | 0 | 13 |
| gt-world / imsa | 12 each | 0 | 24 |

- **Next, and unblocked: WEC (13), IMSA (12), GT-World (12)** — three small families, three more completions, and all modern. Then **NASCAR (26)** and **IndyCar (30)**, both single-driver and well documented. **WSBK, DTM and WRC** are large and each has a pre-1990 tail that item 3 governs.
- **Head start on WEC**: in the hybrid era every drivers' title has been settled at the **Bahrain finale** (2021 #7 Toyota second behind the #8; 2022 #8 second under team orders; 2023 #8 won it lights-to-flag; 2024 #6 Porsche eleventh and still champion; 2025 #51 Ferrari fourth). The per-year *dates* still need confirming, and note that `champions.json` has **no 2018 row** — the super seasons are filed as 2019 and 2020.
- **Method, now proven over 75 seasons in one session**: **one targeted web search per season** (better than fetching the season article, which carries results tables but rarely the clinch sentence); the per-**race** Wikipedia article is the best single source because it usually gives the date, the round-of-total *and* an explicit clinch statement. Write the entries as JSON in the editor, splice as text, `npm test`, browser-verify one page, the trio, PR, merge, prod-audit.
- **Omit what two sources contest.** It cost four MotoGP seasons and a handful of individual claims this session and weakened nothing.
- **Watch for `wins`/`points` errors in `champions.json` while you are in there** — 1987 MotoGP said 1 win where the answer was 7, and it was rendering on the champions tab. The note contradicting the table is what caught it.
- **Audit**: sitemap who-won count rises by exactly the notes added (prod carried **166** at session-36 close, matching local exactly); a newly-noted page serves `robots: index, follow`; notes land 90–110 words.

### 6. AdSense resubmission
Still a waiting game, not work — and the index is now better than it was: **75 pages earned their way back in** this session. Let Google drop the remaining noindexed thin pages; Search Console showing "Excluded by 'noindex' tag" is the expected state, not a fault. Then tick "I confirm" and request review, **once**.

---

## TIER 2 — decisions the operator owes, each small once decided

7. **Empty tab advertising data it hasn't got.** `/series/nls/standings` renders "Nothing here yet for this series." under a `describeTab` description promising full championship tables and a trend chart. Reduced metadata, or `noindex` as the news tabs took in 0.334.8.
8. **The home page shows ONE post on mobile.** "More reading" is `hidden xl:block`, so below 1280 px the covers added in 0.334.36 are invisible. A layout decision.
9. **19 of 24 blog posts have no cover.** Needs licence-clean sources. A slice of the image session.
10. **Composer, round 2** — the band rows' hidden/shown affordance, whether `Published` reads as state or action, whether the preview should scroll with the dragged band.
11. **`/social/leagues` carries no play-money framing** where `/social` does. Launch gate A6.

---

## TIER 3 — carried

12. **The era suffix in `constructor` now reads as noise** (new, session 36): 9 of 16 F3 rows and 12 of 21 F2 rows carry team names like "ART Grand Prix (GP3 Series)". On a page titled "Who won the 2016 GP3 Series championship?" the summary reads "…with ART Grand Prix (GP3 Series)", which looks like a mistake. Cosmetic, two families, and now on indexed pages.
13. **MotoGP 2009 has no `wins` value** (new, session 36) — a gap, not an error; found during the 1987 sweep and deliberately not guessed.
14. **The footer's first link is labelled "Landing"** (new, session 36) and points at `/`, which since 0.334.42 *is* the home page. One word, but a copy decision.
15. **Orphan sweep.** `LandingNav`, `LandingFooter`, `LandingAuth` have zero importers. Nothing imports them, so they cost nothing at runtime.
16. **`/series/f1/champions` preloads four Wikimedia portraits it never paints.** For the image session.
17. **`app/error.tsx` reports to nothing** — server-side errors surface only in Cloudflare's logs since the Sentry server SDK came off in 0.288.0.
18. **The OG-card runtime is ~618 KiB** of the Worker. Only reclaimable by pre-generating the cards or a separate Worker behind a service binding. Not urgent at 822 KiB headroom.
19. **`content/information/tracks.json` (87.45 KiB gzipped) stays in the Worker** — `/information` revalidates hourly, so it re-renders where there is no filesystem.
20. **Tier-3 projects**: the image session · the day page · GEO/positioning · v1.0 marketing · Street View corner tours · information-hub restyle.

---

## Standing facts

- **Deploys are ~4–8 minutes**, no GitHub Actions run to watch — poll `/changelog`. 8 for 8 this session.
- **`/` must stay `○ (Static)` with a 5m revalidate**, and **`/changelog` must stay build-time only** (`force-static`, no revalidate — that is *why* RELEASES.md could leave the Worker).
- **The build log carries six standing `error|failed` lines** — four fiawec `no-store` notices on a dynamic route, two Wikipedia payloads over the 2 MB data-cache limit. A seventh-to-ninth line of `api.jolpi.ca` timeouts appeared once and did not recur; transient upstream, and prod never calls it (`DATA_SOURCE=db`).
- **Lint is 0 errors + 2 known `_encoding` warnings** in `lib/content-fs.ts`. Load-bearing. Leave them.
- **`npm test` is 1230.** A new `champion-notes.json` for a series adds **+6** via the `it.each` gate without a test being written.
- **Write changelog prose in the editor**, never a shell-quoted heredoc or `node -e`.
- **Prod Supabase writes and migrations need the operator to name the action.**
