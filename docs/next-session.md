# The execution queue

Rewritten 2026-08-26 (session 35 close). `main` = **0.334.48**, prod verified, tree clean, zero open PRs, suite **1212**.

Every item states **what**, **why**, **where**, and **how prod is audited**. The ritual per item: branch → implement → `tsc` / `lint` / `vitest` / `build` → browser-verify → the trio → PR with a real body → squash-merge → poll `/changelog` → audit on prod.

---

## Read this before touching anything

- **`/` IS the home page now.** The marketing landing was retired in 0.334.42; `/app` 301s to `/`. `app/(marketing)/` is gone. Do not reintroduce a `/` → `/app` redirect: `middleware.ts` used to carry one and with the 301 in place it becomes an **infinite loop**.
- **`npx vitest` skips `pretest`.** `CONTENT_BUNDLE` goes stale, so content assertions pass against old data. Validate content changes with **`npm test`**.
- **`JSON.stringify` cannot edit `champion-notes.json`** — integer-like keys serialise ascending and flip the file's newest-first order. Use the text-splice script pattern from 0.334.44 with byte-identical guards.
- **A local production build cannot browser-verify client-rendered pages.** Prod Clerk keys reject localhost, hydration dies, and the page renders as an un-hydrated shell that looks like a broken change. Use `next dev`, or `npm run deploy:paris`.
- **Worker headroom is 822.68 KiB** (9417.32 / 10240 KiB gzipped). Comfortable. `wrangler deploy --dry-run` before adding a dependency; a **component measurement is a floor, not the answer** (three times now).
- **A deploy leaves a stale-chunk window** — see TIER 1 item 1.

---

## TIER 1 — the two operator actions, then the programme

### 1. Cloudflare build command — the only live defect left
`Cache-Control: s-maxage=85, stale-while-revalidate=2592000`, so the R2 page cache can serve HTML from *before* a deploy that points at build-hashed chunks which no longer exist. **The first visitor to any page after each deploy gets a page whose JS 404s.** Measured twice: `/calendar` rendered as an empty grid, `/` logged 40 console errors, both self-healing on revalidate.
- Local `npm run deploy` runs `cf:populate`, which overwrites stale renders. **Workers Builds has its own command in the Cloudflare dashboard** — if it is just `cf:build && wrangler deploy`, add `&& npm run cf:populate`.
- **Operator action** (dashboard access). **Audit**: deploy, then immediately fetch `/` and check every `/_next/static/*` reference returns 200 and not `text/html`.

### 2. The 1.0 flip — needs copy sign-off, not code
Everything is built and **dark**. `LAUNCH_ANNOUNCEMENT` in `lib/site.ts` holds the whole modal's content: kicker, title, intro, six capability rows, three "what comes next" items.
- **The operator signs off the copy, `next` above all — anything named there is a public promise.**
- Then: flip `active` to `true` **in the same commit** that bumps `package.json` to `1.0.0`, per `docs/launch-checklist.md` §B, and run `npm run indexnow:submit` after.
- Remaining §A gates are mostly the operator's: crons green via `/api/cron/health`, Clerk prod key, KV reachable, Supabase prod, secret rotation, a real contact-form send, PSI re-measure, signed-in console check.
- **Audit**: on prod, the modal appears once, dismisses permanently, and `/changelog` reports 1.0.0.

### 3. Champion-notes enrichment — 91 of 488 done, 397 left
The gate (0.334.43) makes a who-won page indexable **iff** its season has a note, so **a wave needs no code**: authoring notes re-indexes its pages by existing.

| series | pages | done | left |
|---|---:|---:|---:|
| **f1** | 76 | **76** | **0 ✅** |
| motogp | 77 | 15 | **62** |
| adac-ravenol-24h | 54 | 0 | 54 |
| wrc | 47 | 0 | 47 |
| dtm | 39 | 0 | 39 |
| wsbk | 38 | 0 | 38 |
| indycar | 30 | 0 | 30 |
| nascar-cup | 26 | 0 | 26 |
| f2 (incl. GP2 era) | 21 | 0 | 21 |
| f3 (incl. GP3 era) | 16 | 0 | 16 |
| nls | 16 | 0 | 16 |
| wec | 13 | 0 | 13 |
| gt-world / imsa | 12 each | 0 | 24 |
| formula-e | 11 | 0 | 11 |

- **Next: MotoGP (62).** Biggest family, already 19% done, second-biggest series — finishing it gives a **second complete family** rather than a second partial one.
- **⚠ ADAC (54) and NLS (16) need a DIFFERENT note template.** They are single 24-hour races, not championships, so "where the title was settled" is meaningless. Decide the shape ("who won the race, and how") before anyone researches 54 seasons into the wrong one.
- **Method, proven over 46 seasons**: ~1.2 targeted web lookups per season; write the entries as a JSON file in the editor; splice with the text-splice script; `npm test` (integrity + sitemap gates); trio; PR; merge. **Omit any fact the sources disagree on** — that discipline caught four errors in an aggregate table and two genuinely-contested clinch dates.
- **Audit**: sitemap who-won count rises by exactly the notes added; a newly-noted page serves `robots: index, follow`; measured words land 150–180 at ~20% sibling overlap.

### 4. AdSense resubmission
The index is already clean — this is a waiting game, not work. Give Google time to drop the 443 noindexed pages; Search Console will show them as **"Excluded by 'noindex' tag"**, which is the expected state and not a fault. Then tick "I confirm" and request review, **once**.

---

## TIER 2 — decisions the operator owes, each small once decided

5. **Empty tab advertising data it hasn't got.** `/series/nls/standings` renders the honest "Nothing here yet for this series." under a `describeTab` description (`lib/tabs.ts`) promising full championship tables and a trend chart. The page is honest; the SERP entry is not. Reduced metadata, or `noindex` as the news tabs took in 0.334.8.
6. **The home page shows ONE post on mobile.** "More reading" is `hidden xl:block`, so below 1280 px the covers added in 0.334.36 are invisible. The existing comment gives the reason (the text column is already full under xl). Fix is a layout decision: a compact treatment under the CTA, or the separate movable band that was option 1.
7. **19 of 24 blog posts have no cover.** The 0.334.33 mechanism renders one wherever it exists; the rest need licence-clean sources. A slice of the image session.
8. **Composer, round 2** — three refinements left as taste calls: the band rows' hidden/shown affordance (an eye icon with no at-a-glance state), whether `Published` reads as state or action, and whether the preview should scroll with the band being dragged.
9. **`/social/leagues` carries no play-money framing** where `/social` does ("no cash", "virtual"). Launch gate A6 wants it on every betting surface.

---

## TIER 3 — carried

10. **Orphan sweep.** `LandingNav`, `LandingFooter` and `LandingAuth` have **zero importers** after the landing retirement. Deliberately not deleted in 0.334.42 because the approved deletion list said keep them. Nothing imports them, so they cost nothing at runtime.
11. **`/series/f1/champions` preloads four Wikimedia portraits it never paints** ("preloaded using link preload but not used"). Wasted bandwidth, not a blocker. For the image session.
12. **`app/error.tsx` reports to nothing** — server-side errors surface only in Cloudflare's logs since the Sentry server SDK came off in 0.288.0. Accept as a documented gap or wire something.
13. **The OG-card runtime is ~618 KiB** of the Worker (resvg.wasm 531, Geist 59, yoga.wasm 28.5). Only reclaimable by pre-generating the cards or a separate Worker behind a service binding. Not urgent at 822 KiB headroom, and the cards now actually work everywhere.
14. **`content/information/tracks.json` (87.45 KiB gzipped) stays in the Worker.** The RELEASES.md trick does not transfer: `/information` carries a 1h revalidate, so it re-renders on the Worker where there is no filesystem. Moving it needs the ASSETS-binding work, which means a new runtime path in `lib/content-fs.ts` for 0.9% of the budget.
15. **Tier-3 projects**: the image session · the day page · GEO/positioning · v1.0 marketing · Street View corner tours · information-hub restyle · AdSense content waves beyond who-won.

---

## Standing facts

- **Deploys are ~5–8 minutes**, no GitHub Actions run to watch — poll `/changelog`. 19 for 19 this session.
- **`/` must stay `○ (Static)` with a 5m revalidate.** That one line in the build output is the proof the ISR contract survived; it survived the root move.
- **`/changelog` must stay build-time only.** It is `force-static` with no revalidate, which is *why* RELEASES.md could leave the Worker. Give it a `revalidate` and the page fail-softs to "Nothing here yet" — quietly.
- **`/admin` and `/studio` cannot be verified from the dev machine.** Say so plainly. The operator's screenshot proved the console renders.
- **Lint is 0 errors + 2 known `_encoding` warnings** in `lib/content-fs.ts`. Load-bearing. Leave them.
- **`npm test` is 1212.**
- **Write changelog prose in the editor**, never a shell-quoted heredoc or `node -e`.
- **Prod Supabase writes and migrations need the operator to name the action.**
