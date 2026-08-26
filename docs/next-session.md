# The execution queue

Rewritten 2026-08-26 (session 37 close). `main` = **0.334.64**, prod verified, tree clean, zero open PRs, suite **1265**.

Every item states **what**, **why**, **where**, and **how prod is audited**. The ritual per item: branch → implement → `tsc` / `lint` / `vitest` / `build` → browser-verify → the trio → PR with a real body → squash-merge → poll `/changelog` → audit on prod.

---

## Read this before touching anything

- **`/` IS the home page.** The marketing landing was retired in 0.334.42; `/app` 301s to `/`. Do not reintroduce a `/` → `/app` redirect: with the 301 in place it is an **infinite loop**.
- **`npx vitest` skips `pretest`.** `CONTENT_BUNDLE` goes stale, so content assertions pass against old data. Validate content changes with **`npm test`**.
- **`JSON.parse` reorders integer-like keys at BOTH ends of a splice** — the target file *and* the entries file. So the insertion order must be **derived** (sort descending), never read from `Object.keys`, and the order guard must scan the file's **bytes** (`/^ {2}"(\d{4})": \{$/gm`), because a parsed-key check can never see textual order. Both guards fired in session 36 before anything was written. The working script is `splice-motogp-notes.mjs` in the session scratchpad; **it is not in the repo** — recreate it from the pattern above, it is ~60 lines.
- **A local production build cannot browser-verify client-rendered pages.** Prod Clerk keys reject localhost, hydration dies, and the page renders as an un-hydrated shell that looks like a broken change. Use `next dev`, or `npm run deploy:paris`.
- **Playwright may be blocked by stale agent-owned Chrome.** If it reports "Browser is already in use", find the PIDs whose command line contains `mcp-chrome-` and kill **those PIDs** (never by image name).
- **Browser-verify the FIRST page of a wave, not the last.** Every defect found in sessions 36 and 37 was found that way, before the wave shipped. Twice now the defect was **derived prose stating a count or a "first" that the source data cannot support** — Formula E's record line, then crew title counting. When a page states a count, check what it is counting.
- **A family's shape can differ from every other family's.** GT World's overall title combines Sprint and Endurance points and is regularly clinched away from the finale (Baku, Zandvoort, the Nürburgring, Valencia, Paul Ricard, Jeddah). Do not assume the last race.
- **Do not infer a race day from an article's publication date, and do not trust your own date arithmetic.** Probe it (`node -e` over the candidate dates) — that is how the 2018 IMSA "Monday finale" was caught.
- ~~A deploy leaves a stale-chunk window~~ — **closed 2026-08-26** by the Workers Builds deploy command now running `cf:populate`. TIER 1 item 1 records the exact dashboard config and the audit that proves it, because nothing in the repo enforces it.

---

## TIER 1 — one operator action left, then the programme

### 1. ~~Cloudflare build command~~ — FIXED by the operator, 2026-08-26
The stale-chunk window is closed. `Cache-Control: s-maxage=85, stale-while-revalidate=2592000` meant the R2 page cache could serve HTML from *before* a deploy, pointing at build-hashed chunks that no longer existed, so **the first visitor to any page after each deploy got a page whose JS 404s** — measured twice (`/calendar` as an empty grid, `/` with 40 console errors). Local `npm run deploy` always ran `cf:populate`; Workers Builds did not.

**The Workers Builds configuration is now, recorded here because it lives in the Cloudflare dashboard and nothing in the repo enforces it** (Workers & Pages → `motorsport` → Settings → Build → Build configuration):

| Field | Value |
|---|---|
| Build command | `npm run cf:build` |
| Deploy command | `npx wrangler deploy && (npm run cf:populate || echo "populate skipped, non-fatal")` |
| Root directory | `/` |

Three things about that deploy command worth not re-deriving:
- **No `-c` flag, deliberately.** The root `wrangler.jsonc` *is* production. The per-dev workers need `-c wrangler.<name>.jsonc`; this one must not have it.
- **The populate is guarded with `|| echo`, not chained with a bare `&&`.** If `cf:populate` ever fails in the build environment, a bare `&&` fails the whole deploy — and a red deploy is worse than a cold cache. This matches the existing `deploy:cf:testing` and `deploy:cf:paris` scripts; the repo's `deploy:cf` is the one place that still chains strictly.
- **The build command must stay the OpenNext build.** `worker.ts` imports `./.open-next/worker.js`, and a plain `next build` emits only `.next/`.

**Audit, and it is worth re-running after any dashboard change** — run it the moment prod flips version:

```bash
curl -s https://paddock-tracker.com/ -o /tmp/home.html
grep -oE '/_next/static/[A-Za-z0-9._/-]+' /tmp/home.html | sort -u | while read -r p; do
  out=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "https://paddock-tracker.com$p")
  case "$out" in 200*text/html*) echo "STALE: $p";; 200*) ;; *) echo "BAD: $out $p";; esac
done; echo done
```

Silence between the lines is a pass. A `STALE:` line means the HTML came from the cache but names a chunk that no longer exists, so the Worker served its 404 page as `text/html` instead. **Do not use a looser regex**: `/_next/static/[^"]+` also matches the escaped backslashes in inlined JSON and reports phantom 308s.

### 2. The 1.0 flip — needs copy sign-off, not code
Everything is built and **dark**. `LAUNCH_ANNOUNCEMENT` in `lib/site.ts` holds the modal: kicker, title, intro, six capability rows, three "what comes next" items.
- **The operator signs off the copy, `next` above all — anything named there is a public promise.** The three currently read: photography across the site; a page for each day of a race weekend; circuit maps and corner-by-corner tours.
- Then: flip `active` to `true` **in the same commit** that bumps `package.json` to `1.0.0`, per `docs/launch-checklist.md` §B, and run `npm run indexnow:submit` after.
- **Audit**: on prod, the modal appears once, dismisses permanently, and `/changelog` reports 1.0.0.

### 3. DECIDED, and the mechanism has shipped — the two extra note shapes
**Operator decision, 2026-08-26**, taken with both alternatives rendered. Shipped as **0.334.59**, so the waves this unblocks need no code:

- **`season:`** — for a championship whose deciding round **no source records**. The page stops claiming a round and says what the season was, ending with the fact that the deciding round is not recorded. This is what the pre-1990 seasons use. (`clinched` was option (a)-only; the "bounded clinch" hedge was rejected.)
- **`race:`** — for **ADAC 24h and NLS**, which are single races rather than championships: who won, by how much, and the one thing that decided it. Short and factual by choice; the fuller race-story option was rejected as roughly double the research for 70 seasons.
- **`clinched:`** stays the default; all 203 notes written so far use it, and the single-driver rendering is byte-identical to what it was before the change.

**How it works**: a note carries **exactly one** lead field, and `noteLead()` (`lib/information/generated.ts`) turns whichever one it is into the label — "Title clinched", "The season", "The race". The integrity gate enforces one-and-only-one and that the lead carries its own year; the two-leads case was **proved to fail** before shipping, not assumed to.

So: **MotoGP's remaining 36 seasons are unblocked** (1996, 1986, 1982, 1981 and everything from 1980 back — use `season:` wherever the round cannot be sourced, `clinched:` where it can), and so are **ADAC's 54 and NLS's 16** with `race:`.

### 4. ADAC (54) and NLS (16) — the biggest single block left, and the obvious next session
`champions.json` for both is a winners list of **crews** (ADAC 1970–2026, NLS 2010–2025), and together they are **70 of the 286 remaining seasons**. The shape is item 3's `race:` field. One sourced sentence per year: the crew, the car, the margin, and what decided it.

Two things that will save time, both learned the hard way in session 37:
- The integrity gate takes the **last** name in the `driver` string as the surname the note must contain, so name the whole crew and the last-listed driver is covered automatically.
- Crew title counting is now **per person** (0.334.61), so ADAC's and NLS's derived lines will already read correctly — "a first title for X, and Y's 3rd of 4" — rather than treating each crew as one entrant. That fix exists *because* WEC exposed it; do not undo it.

### 5. Champion-notes enrichment — 203 of 489 done, 286 left
The gate (0.334.43) makes a who-won page indexable **iff** its season has a note, so **a wave needs no code**: authoring notes re-indexes its pages by existing.

| series | pages | done | left |
|---|---:|---:|---:|
| **f1** | 76 | **76** | **0 ✅** |
| **f2** | 21 | **21** | **0 ✅** |
| **f3** | 16 | **16** | **0 ✅** |
| **formula-e** | 12 | **12** | **0 ✅** |
| **wec** | 13 | **13** | **0 ✅** |
| **imsa** | 12 | **12** | **0 ✅** |
| **gt-world** | 12 | **12** | **0 ✅** |
| motogp | 77 | 41 | **36** (`season:` unblocks it) |
| adac-ravenol-24h | 54 | 0 | **54** (`race:` unblocks it) |
| wrc | 47 | 0 | 47 |
| dtm | 39 | 0 | 39 |
| wsbk | 38 | 0 | 38 |
| indycar | 30 | 0 | 30 |
| nascar-cup | 26 | 0 | 26 |
| nls | 16 | 0 | **16** (`race:` unblocks it) |

- **Next: ADAC (54) + NLS (16)** — 70 of the 286 remaining, the single biggest block, unblocked since 0.334.59 with the `race:` shape, and worth its own session. Then **NASCAR (26)** and **IndyCar (30)**, both single-driver and well documented, which should run like F2 and F3 did. **WSBK (38), DTM (39) and WRC (47)** are large and each has a pre-1990 tail, which the `season:` shape now covers. **MotoGP's 36** are unblocked the same way.
- **The endurance families are done** (WEC, IMSA, GT World), so the remaining work is stock cars, single-seaters, bikes, rallying and the two 24-hour races.
- **Method, now proven over 112 seasons across two sessions**: **one targeted web search per season** (better than fetching the season article, which carries results tables but rarely the clinch sentence); the per-**race** Wikipedia article is the best single source because it usually gives the date, the round-of-total *and* an explicit clinch statement. Write the entries as JSON in the editor, splice as text, `npm test`, **browser-verify the FIRST page rather than the last**, the trio, PR, merge, prod-audit.
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

- **Deploys are ~4–8 minutes**, no GitHub Actions run to watch — poll `/changelog`. 12 for 12 across sessions 36 and 37.
- **`/` must stay `○ (Static)` with a 5m revalidate**, and **`/changelog` must stay build-time only** (`force-static`, no revalidate — that is *why* RELEASES.md could leave the Worker).
- **The build log carries six standing `error|failed` lines** (a seventh-to-ninth `api.jolpi.ca` timeout line appears intermittently — transient upstream, and prod never calls it) — four fiawec `no-store` notices on a dynamic route, two Wikipedia payloads over the 2 MB data-cache limit. A seventh-to-ninth line of `api.jolpi.ca` timeouts appeared once and did not recur; transient upstream, and prod never calls it (`DATA_SOURCE=db`).
- **Lint is 0 errors + 2 known `_encoding` warnings** in `lib/content-fs.ts`. Load-bearing. Leave them.
- **`npm test` is 1265.** A new `champion-notes.json` for a series adds **+6** via the `it.each` gate without a test being written.
- **Write changelog prose in the editor**, never a shell-quoted heredoc or `node -e`.
- **Prod Supabase writes and migrations need the operator to name the action.**
