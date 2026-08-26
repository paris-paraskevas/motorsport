# Paddock — ideas ledger

Single source of truth for **open work only**. Completed items are NOT kept here: they live in git history + `CHANGELOG.md` + `docs/HANDOFF.md`. Re-triaged 2026-08-20 (session 30; operator: "content close to perfect — clean it up", then "do what you think is best"): fossils deleted, polish killed, big rocks parked with explicit triggers, and the AdSense + image asks promoted to the active front. Time-based plans live in `SCHEDULE.md`.

**Rules:** one line per item; group into batches; delete an item when it ships (history is the record); re-triage at session end.

---

## NOW — the active front (2026-08-20, operator-set)

1. **AdSense "Low value content" recovery — IN PROGRESS, enrich-not-noindex (operator's call).** Audit done (`adsense-low-value-audit.md`, session-30 scratchpad): five triggers, the big one being the 488 who-won pages at 38.7% of the sitemap, flipped indexable 2026-07-31, five days before the Aug-5 verdict. `ads.txt` serves fine (console's "Not found" is a stale Aug-5 crawl, verified 08-20). **Wave 1 SHIPPED 0.324.0**: F1 champion answers 1996-2025 now carry the clinch + the season's story via `content/series/f1/champion-notes.json`, fail-soft so later waves need no code. Remaining, in order:
   - **Wave 2 SHIPPED 0.325.0**: MotoGP 2011-2025, authored inline after its subagent died. Next waves are data only (no code): **F1 pre-1996 completes that family** (recommended first — one complete family beats several partial ones), then MotoGP pre-2011, then IndyCar / WEC / WSBK and the rest.
   - **Non-bio driver pages (~524)**: the bios waves ARE this enrichment; keep them coming (see AdSense-readiness batch below).
   - ~~**Session pages (600-900)**~~ **DONE 0.334.18** — Race Story, Qualifying Analysis and Practice Analysis are public on every completed F1 session. What settled it: the gate protected nothing, since `/api/f1/racestory`, `/api/f1/decoder` and `/api/f1/decoder/trace` all served their payloads to anonymous callers already. **The ISR half is NOT done**: removing `auth()` was necessary but not sufficient, because a fetch in the OpenF1/Pulselive fan-out passes `no-store` and pins the route dynamic. The 665 ms TTFB stays open.
   - ~~**Indexed stub pages**~~ **DONE 0.334.8** — and the premise was wrong. `PlaceholderTab` is not a stub, it is the live empty state for seven working tabs, so "Coming soon." was wrong copy promising a launch that already happened. Now "Nothing here yet for this series." `StaleBanner` lost its em dash too.
   - ~~**News tabs**~~ **DONE 0.334.8** — **14, not 15** (one series has no news tab). `noindex, follow`, and removed from the sitemap in the same change, because submitting a noindex URL earns Search Console's "Submitted URL marked noindex".
   - THEN tick "I confirm" + Request review, once, when we believe it (reviews run weeks apart).
2. **The image/positioning brief** (operator: "be the choice a person chooses, the place a person feels safe to visit for motorsport"). AI engines currently describe Paddock as web-only, 4-series, no journalism, no notifications — all wrong (it is an installable 15-series PWA with push, a blog and 75 sourced answers). GEO surfaces to sharpen: `/about` + `llms.txt` as the canonical self-description, structured data, comparison-proof pages (broadcast/where-to-watch is the one real competitor edge named). Needs a dedicated session + operator taste.
3. **W8 v1.0 launch program** (promoted out of POSTPONED at this triage) — "out of early access" banner flip + marketing channel plan (IG/FB/Reddit/X/YouTube); checklist done. This is the distribution half of items 1–2.
4. **THE IMAGE SESSION** (operator, 2026-08-20: "the biggest job we have ever done… once all these prs are done") — evaluate, then slowly and surely flood the site with clear, distinct imagery: "humans understand visually" and the missing ingredient is clear visual subjects. Hard constraint from past kills: portraits ×14 and team logos died on LICENSING, so every image needs a licence-clean source (Wikimedia Commons already works for driver-profile portraits; evaluate official press pools / CC sources per series before any wave). Riding with it: **home page refined with clear images + boxes leading to series, calendar etc.** (operator: home is good, refine it), and **future blogs embed F1 driver radio** via the OpenF1 API we already integrate (team_radio per session; player UX + rights stance to design). Layout reference the operator likes (2026-08-20): **Fotis' testing build** — a big series image card beside the lead story, with an UP NEXT strip (session, venue, weather, countdown, watch-live) running under the pair.
5. ~~**HANDOFF trim**~~ — **DONE 0.334.9**: 532 KB → 36 KB, sessions 29 and earlier archived to `docs/handoff-archive.md`, and the rotted reference tail deleted rather than archived (it named Vercel as host and stated the `proxy.ts` landmine backwards).
6. **Three operator design/behaviour decisions left by the PSI sweep** (each has its evidence in `docs/perf-baselines.md`'s 2026-08-20 table):
   - ~~**Calendar `DataCloneError`**~~ **DONE 0.334.5**. Note for the record: the recommendation as written here ("drop `cacheOnNavigation`") **would have been a no-op** — the prop defaults to `true` inside the package, so it had to be set explicitly `false`.
   - ~~**Calendar contrast**~~ **CLOSED 0.334.8, premise stale.** Measured on prod instead of nudged: `--text-faint` is 5.07:1 on paper and newsprint, 6.59:1 on circuit. All pass AA; the 0.311.0 pass had already fixed it. No token touched. What the measurement did surface is that those elements render at **9 px** — a type-size question, not a contrast one.
   - **Month-grid tap targets**: recommend ACCEPT as-is — density is the point and the 0.313.0 mobile agenda already solves phones. **Still needs one word from the operator to retire it** (asked again 2026-08-24, still unanswered).
7. **Information hubs are the last pre-Paper surface** (`font-display` extrabold caps masthead, seen on /information/formula-1 during the sweep). Queue the restyle with the image session.

## Blog contract (REVISED mid-session, operator 2026-08-20 evening)

Superseded the fact-packs-only contract: **"i want you to read my previous blogs. then give me a draft."** So Claude drafts in the operator's voice (learned from the 20 published posts), the operator approves. Still standing: fact packs back every number (`factpack-*.md`), RULE #1 on every claim, house style (no em dashes, no AI tells, always link out), **never public MDX, never a DB write** — the `.md` draft waits for approval, then `scripts/draft-post.mts` inserts it as a prod DB draft with `publish_at` null.
- **The whole Dutch GP set is PUBLISHED** (operator, 2026-08-24): Friday, sprint, qualifying and the race recap drafted in session 34. The qualifying post's forward-looking "Race day" section shipped stale and was **re-tensed on the live row** with the operator naming the action, and now closes by paying off its own prediction and linking the race recap.
- **The lesson to carry:** a session recap written before the next session runs will go stale the moment it is published late. Write the closing section so it reads correctly whenever it ships, or flag it at the top of the draft rather than in a comment nobody reads at publish time.
- Voice reference, established quantitatively 2026-08-23 by profiling the published preview: **results tables beside the prose** (not instead of it), ~9 outbound links, 20+ internal, three-sentence paragraphs, opinion stated plainly, a verdict section, a bold "For the books" list, an italic photo credit, zero em or en dashes.
- Operator also wants, going forward: **images in every post** (Commons/CC with credit, eyeballed before use) and **driver-radio embeds** via OpenF1 `team_radio` (player UX + rights stance to design).

## Triage — session 35 close (2026-08-26)

**Closed this session**, so they are gone from the front: the changelog restructure · the og:image fault (was the headline inbox item, fixed in 0.334.37) · the vitest-under-load flake (root-caused, not worked around) · the blog cover images · the mobile calendar · the landing page (retired entirely rather than reimagined) · the R2 question (answered: R2 was not needed) · the AdSense low-value-content audit **and** its first action · F1 champion notes **complete at 76/76**.

**Promoted to NOW, in order** — full detail in `docs/next-session.md`:
1. **The Cloudflare build command** (`&& npm run cf:populate`) — the only live defect left; the first visitor after every deploy gets a page whose JS 404s.
2. **The 1.0 copy sign-off**, then flip `active` with the `1.0.0` bump. Everything else is built and dark.
3. **Champion notes: MotoGP (62)** — biggest remaining family, already 19% done, gives a second complete family. **ADAC (54) and NLS (16) need a different note template first**: they are single 24-hour races, not championships.
4. **AdSense resubmission** — a waiting game now, not work. Let Google drop the 443 first.

**Killed:** ~~"enrich-not-noindex"~~ as a strategy — reversed by the operator on 2026-08-25 once the measurement existed (443 pages at 67–101 words with 54–66% sibling overlap, 35.4% of the index). Enrichment continues, but it now earns pages *back* into the index rather than being the only lever.

**Still parked, unchanged:** the image session · the day page · GEO/positioning · v1.0 marketing · Street View corner tours · information-hub restyle · remote-branch audit · What's-New modal · error.tsx reporting to nothing.

## Triage — session 37 close (2026-08-26)

**Closed this session**: WEC, IMSA and GT World are all complete, taking the programme from 166/489 to **203/489 (41.5%)** and complete families from four to **seven**. The crew-counting defect is closed. The WEC "super season" mislabel is closed.

**Promoted to NOW, in order:**
1. **The Cloudflare build command** and **the 1.0 copy sign-off** — the operator's, and untouched for three sessions now.
2. **ADAC (54) + NLS (16)** — 70 of the 286 remaining seasons, the single biggest block, unblocked since 0.334.59 with the `race:` shape. Worth its own session.
3. **NASCAR (26) and IndyCar (30)** — both single-driver and well documented, so both should run like F2/F3 did.
4. **MotoGP's remaining 36**, using `season:` wherever the deciding round cannot be sourced.

**New to the inbox this session:**
- **`gt-world` has no era-name handling.** `seriesNameForYear` special-cases F2 and F3 so their pre-rebrand seasons read "GP2 Series"/"GP3 Series", but 2014–2019 GT World pages say "GT World Challenge" when the series was the **Blancpain GT Series** — a name `constructor` already carries for exactly those rows. One `if` in the same shape as the existing two.
- **A second instance of the same bug class**: derived prose stating a count or a "first" that its source data cannot support. Formula E's record line (0.334.54) and now crew title counting (0.334.61). Worth one sweep of the other derived sentences — the "different drivers crowned" count, the secondary-championship line — for the same shape.
- **The splice/writer script still is not in the repo.** It has now been recreated twice, from the queue's description, and it carries real invariants (derived order, byte-scanning order guard, one-lead check). Consider `scripts/` as its home.

## Triage — session 36 close (2026-08-26)

**Closed this session**: the champion-notes programme's F1-only status — **four more families are finished** (Formula E 12, F3 16, F2 21, plus MotoGP to 41 of 77), taking the programme from 91/488 to **166/489**. Formula E's missing 2026 champion is closed. The 1987 MotoGP win count is closed.

**Promoted to NOW, in order** — full detail in `docs/next-session.md`:
1. **The Cloudflare build command** and **the 1.0 copy sign-off** — both still the operator's, both untouched this session because the directive was "waves first".
2. **Two note-shape decisions, now blocking ~106 seasons**: what a note says when no source records the deciding round (pre-1990, ~36 MotoGP plus the pre-1990 tails of WRC/DTM/WSBK), and the shape for ADAC (54) + NLS (16), which are single races rather than championships. Rendered examples are in the queue.
3. **Enrichment, unblocked next**: WEC (13), IMSA (12), GT-World (12) — three small modern families, three more completions — then NASCAR (26) and IndyCar (30).

**New to the inbox this session:**
- **The era suffix in `constructor` reads as noise now that those pages are indexed**: 9 of 16 F3 rows and 12 of 21 F2 rows carry names like "ART Grand Prix (GP3 Series)", so a page titled "Who won the 2016 GP3 Series championship?" says "…with ART Grand Prix (GP3 Series)". Cosmetic, two families.
- **MotoGP 2009 has no `wins` value** — a gap rather than an error, found while sweeping all 77 rows after the 1987 fix, and deliberately not guessed at.
- **The footer's first link is labelled "Landing"** and points at `/`, which since 0.334.42 *is* the home page. One word, but a copy call.
- **A WEC wave was abandoned mid-research** — five of thirteen seasons sourced. Rather than ship a half-verified family the head start went into the queue: in the hybrid era every WEC drivers' title has been settled at the Bahrain finale, and `champions.json` has no 2018 row because the super seasons are filed as 2019 and 2020.

## Inbox (2026-08-26 — session 35 close)

- **Orphan sweep**: `LandingNav`, `LandingFooter`, `LandingAuth` have **zero importers** after the landing retirement. Not deleted in 0.334.42 because the approved deletion list said keep them; nothing imports them so they cost nothing at runtime.
- **The home page shows one post on mobile.** "More reading" is `hidden xl:block`, so the covers added in 0.334.36 are invisible below 1280 px. A layout decision, not a class change.
- **An empty series tab still advertises rich data.** `/series/nls/standings` renders "Nothing here yet for this series." under a description promising full championship tables and a trend chart. Reduced metadata, or `noindex` as the news tabs took.
- **19 of 24 blog posts have no cover** — the mechanism ships, the pictures do not exist. A slice of the image session.
- **Composer round 2**: the eye icon with no at-a-glance state, whether `Published` reads as state or action, whether the preview should scroll with the dragged band.
- **`/social/leagues` has no play-money framing** where `/social` does.
- **`/series/f1/champions` preloads four Wikimedia portraits it never paints.**
- **`content/information/tracks.json` (87.45 KiB gzipped) stays in the Worker** — the RELEASES.md trick does not transfer because `/information` revalidates hourly, so it re-renders where there is no filesystem.

## Inbox (2026-08-24 — session 35 start)

- **🔴 NO OG IMAGE on `/`, `/app`, `/calendar` or any series page — verified on prod 2026-08-24.** Sharing the landing page or the app home produces a link **with no picture**, while the site carries **~618 KiB of Worker bundle (6% of the ceiling)** for the OG-card runtime that generates them. Cause found by comparison, not guesswork: only routes with a **colocated** `opengraph-image.tsx` emit the tag (`/blog/<slug>` → 1, `/series/f1/weekend/12` → 1; `/`, `/app`, `/calendar` → **0**). `app/opengraph-image.tsx` sits in the **root** segment, but every real page lives inside a route group (`(marketing)` / `(app)`), so no page's own segment carries it — the file serves fine at `/opengraph-image` and is referenced by nothing. The installed docs (`node_modules/next/dist/docs/…/opengraph-image.md`) only ever say "for a route segment" and never promise inheritance. **Likely fix: put the file in `app/(marketing)/` and `app/(app)/`.** Cheap, high value, and it changes the return on that 618 KiB. **Promote to NOW.**
- **1.0 needs an announcement surface before it can be flipped** (operator, verbatim): *"if we go to version 1, we will need a banner with animations and clear explanation of everything in version 1 and what to expect in later versions."* Gated as **§A9** in `docs/launch-checklist.md`. Three pieces: an animated banner (CSS-authored, Paper idiom, `prefers-reduced-motion` honoured — no library, no generic fade-on-scroll); a "what 1.0 is" page grouped **by capability, not by release** (the 15 named releases are the raw material, the page is the edited version); and an honest "what to expect later" roadmap where each item needs sign-off, because naming it makes it a promise. Route needs approval before building.
- **The home composer needs refining** (operator, 2026-08-24, with a screenshot of `/admin/home` signed in — so the console **does** render and the "never browser-verified" gate is now partly closed by the operator's own click). Their words: *"this will need refining and improving too."* Specific refinements not yet named; ask before designing. This is the L1/L2 ladder in `docs/next-session.md` meeting real use.
- **19 of 24 blog posts have no cover image.** The listing mechanism shipped in 0.334.33 and renders one wherever it exists, but only the four Dutch GP posts plus one carry a `hero_image`. Filling the rest needs licence-clean sources per post subject — **this is a slice of the image session**, and it is now visible on a public page rather than hypothetical. (Correction for the record: I earlier reported "all 24 have a cover" from an `og:image` check, which tested the generated card route rather than the field.)
- **An empty series tab still advertises rich data in its metadata.** `/series/nls/standings` renders the honest *"Nothing here yet for this series."* under a `describeTab` description (`lib/tabs.ts`) promising "the full drivers' and constructors' championship tables … plus a season trend chart". The page is honest; the SERP entry is not, and this feeds the open AdSense "low value content" case (item 1). Decide: reduced metadata for an empty tab, or `noindex` as the news tabs took in 0.334.8.
- **`/social/leagues` carries no play-money framing.** `/social` does (verified: "no cash", "virtual"); the leagues page has none of the phrases checked for. Launch gate A6 asks for it on "every betting surface". Confirm by eye, then add a line if it is genuinely absent.
- **`/series/f1/champions` preloads four Wikimedia portraits it never paints** ("preloaded using link preload but not used within a few seconds"). Warnings only, but four ~500 KB images fetched for nothing. For the image session.
- **A deterministic loader called once per test is pure cost** — the lesson from the 0.334.32 vitest fix. Worth one sweep of the other test files for the same shape.

## Inbox (2026-08-20 — session 30)

- **THE WORKER BUNDLE IS AT 19.35 KiB OF HEADROOM, and the biggest lever is the OG-card runtime** (measured 2026-08-24, recorded in `docs/perf-baselines.md`). 10220.65 KiB gzipped against a hard 10240 KiB ceiling — Workers Paid is the top tier, there is nothing to upgrade to. A bundle breakdown shows **~618 KiB, 6% of the entire budget, is Satori/`ImageResponse`**: `resvg.wasm` 531 KiB, the embedded Geist font 59 KiB, `yoga.wasm` 28.5 KiB, used by five routes (`app/opengraph-image.tsx`, the blog / weekend / session cards, `blog/[slug]/story-image`). Static assets are already offloaded to Workers Assets (`wrangler.jsonc:98`) so that lever is spent, and the other suggested routes (splitting across service-bound Workers) are large. **Pre-generating the cards at build time and serving them as static assets is the one change that buys back real room — operator decision, because those cards are what make posts shareable.** Cheaper partial: drop the embedded font (59 KiB) if a system stack is acceptable on the cards. **Promote to NOW.**
- **MOBILE calendar is too complex — go back to the old one** (operator, 2026-08-24). Verbatim constraint, and it is the whole point of the item: **"i am talking ONLY about mobile. desktop is easy. perfect. DO NOT CHANGE desktop calendar. just the mobile one is too complex & confusing."** So this is a mobile-viewport-only revert; the desktop month grid is explicitly off limits and must come out of the change byte-identical. First job is archaeology, not design: find what the mobile calendar looked like before (the 0.313.0 "mobile agenda" is the likely turning point) and put the older, simpler behaviour back rather than inventing a third version. Any diff must be provably scoped to the mobile breakpoint, and verified by screenshotting desktop before and after to prove it did not move. **Promote to NOW.**
- **`/blog` is a boring list — it needs the cover images** (operator, 2026-08-24). The listing renders title, summary, series and date as text rows; every post already has a `hero_image`, and the post page and the `/app` lead band both use it. The cards should show it. Note the listing's `Card` shape is built inline on `app/(app)/blog/page.tsx:22-35` rather than extracted into a component, so this is the moment to pull it out. Watch the ones with no cover: the layout has to hold without a hole.
- ~~**Blog post metadata / SEO pass**~~ **DONE 0.334.22.** The audit found title, description, `og:type=article`, `publishedTime`, the Twitter card and the `Article` JSON-LD already correct, so only three things were actually missing: a **self-referencing canonical** on original posts (only imported ones had one, leaving every URL variant free to be indexed separately), a real **`lastmod`** on blog sitemap entries — the single exception to the deliberate no-lastmod rule, now that `updated_at` gives a verifiable per-page change stamp — and a real **`dateModified` / `og:modifiedTime`** instead of one hard-coded to the publication date. Verified on prod: 24/24 blog URLs carry `lastmod`, 0 non-blog URLs do.
- **BLOG EDITOR LOSES WORK — needs autosave** (operator, 2026-08-24, reported as actual data loss: "blog writing needs autosave, i lost progress"). This is a bug, not a feature request. The draft editor (`components/blog/MarkdownEditor.tsx` / `DraftPreview.tsx`, the `/studio` surface) keeps the body in component state with no periodic persistence, so a navigation, a crash or a closed tab discards everything since the last manual save. Wants: a debounced local draft (so recovery survives a reload even signed out), a visible "saved / saving" state so the writer can trust it, and a decision on whether autosave writes to the DB row or only to local storage until an explicit save. **Promote to NOW** — losing written work is the worst class of bug in an authoring tool.
- **error.tsx reports to nothing** — re-scoped and confirmed in 0.334.2: `@vercel/*` went with the Cloudflare migration and server Sentry went in 0.288.0, so a route-level error surfaces in the browser console and Cloudflare's logs and **nowhere else**. The misleading comment claiming Vercel Analytics caught them is fixed; whether to reintroduce reporting (and with whose DSN) is still open.
- **Remote-branch audit** — 328 non-core branches on origin (the session-26 "380 → 34" prune never reached the remote); split merged-safe (delete) vs unique-commits (operator's word per branch); one name collision already bit (`feat/champions-depth-motogp`).
- **What's-New modal** (operator's Gantt-app reference) — version-gated dialog (hero card + feature cards + "Got it") on first visit after a release, sourced from `RELEASES.md`; needs a seen-version localStorage gate and a card-worthy marker in the release format. Operator's call.
- **No "how an F1 race weekend works" answer** — 13 of 15 series have one; the one real content gap (also feeds the AdSense case).
- **Vitest under load** — fork-worker start timeouts reproduce when a dev server runs alongside (again 2026-08-20 in session 29's gate); pin `maxWorkers` or document "no suite under dev" in CONTRIBUTING.
- **Legacy lint cleanup** — re-audit `react-hooks/set-state-in-effect` (15 files; real errors vs suppressions — the charter bans silencing); DRY `EnableNotifications`/`OnboardingWizard`; championship-leader all-deselected empty state.
- **PSI sweep: DONE 2026-08-20** (10 pages, operator-run; table in `docs/perf-baselines.md`; four fix packages shipped as 0.322.4 / 0.322.5 / 0.323.0 / 0.323.1). Left to do: **re-measure root + standings + weekend** to capture the deltas. A free PageSpeed API key would let Claude script future sweeps instead of the operator clicking twenty times.
- **Operator-owed, carried** (2026-08-20 clears: avatar-menu eyeball ✓, GSC Validate-fix ✓, Bing re-validate ✓, the two `/feedback` DONE moves ✓, orphan-deletion approval ✓ shipped 0.321.3): key rotations (**`.supabase-pat` is NOT dead** — corrected 2026-08-21: it authenticated to the Management API on prod ref `dzelqrtajnauunzmxfic` and served the Dutch GP draft insert; the "dead" note was stale) · paste the root PSI re-run figures ("better on root" confirmed; the append-only `docs/perf-baselines.md` row needs the numbers).

- **A day page between the weekend and the session** (operator, 2026-08-22, flagged as an idea) — a Friday / Saturday / Sunday layout one level above the session pages and one below the weekend page: that day's forecast, the news that broke that day, blogs, and the day's sessions in one place. **Promote first when the operator is back**: `forecastWindow()` + `HourlyForecastRows` (0.332.0) drop straight in, the weekend page already groups by day, and it is a new indexable surface. Needs a layout decision, not research.
- **Street View corner tours + layout history on `/tracks/<slug>`** (operator, 2026-08-22) — check which circuits have Street View coverage and offer a corner-by-corner and notable-straight walk (Kemmel, for instance) carrying each corner's or straight's name, why it is called that, and what happened there; plus previous layouts with the reason each one changed (Zandvoort's post-turn-7 rework around the holiday park, the Mulsanne chicanes for safety). Pairs with the circuit-map idea below.
- **Circuit map on the track pages** (operator, 2026-08-21) — an OpenStreetMap view of the circuit from above on each `/tracks/<slug>` page, or failing that a link out to the official circuit-map page. Check `feat/tracks-map` first: it already carries leaflet + react-leaflet and is paused, and a blind conflict resolution on leaflet broke prod once (2026-07-09).

## A "connection is secure" interstitial — operator ask, 2026-08-22, RECOMMEND AGAINST as asked

**The ask:** the Cloudflare page some sites show on click-through that says your connection is being checked or is secure, "it shows that we are legit".

**What that screen actually is:** a Cloudflare **Managed Challenge / Under Attack Mode** interstitial. It is not a trust badge, it is security *friction* — Cloudflare shows it when it wants to test whether a visitor is a bot. Turning it on for everyone costs:

- **Several seconds on every first page view.** We spent session 30 killing a 7 s document stall and got the landing to a 0.63 s TTFB; this would hand that back and then some, on the one metric Google ranks.
- **Crawlers get challenged too.** Googlebot and Bingbot hitting an interstitial is an indexing risk, and the AdSense review is still pending — a reviewer meeting a challenge page is the worst possible first impression.
- **It reads as "this site has a security problem"** to a fair number of people, which is the opposite of the intended signal.
- It is a **prod infra change** (Cloudflare dashboard, Security → Settings, or a WAF rule), so it needs the operator to name the action regardless.

**What actually signals legitimacy, and what we already have** (measured on prod 2026-08-22): `Strict-Transport-Security` with `includeSubDomains; preload`, a Content Security Policy, `Permissions-Policy` locking camera/mic/geolocation and denying FLoC and Topics, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`. That is a stronger security posture than most sites showing that interstitial.

**Sharper versions of the same goal, if the operator still wants the signal:**
1. ~~**Move the CSP from `report-only` to enforcing.**~~ **DONE 0.334.17.** The stale `va.vercel-scripts.com` entry went in 0.334.2, `static.cloudflareinsights.com` was added in 0.334.6, and the operator took the baked-in decision on 2026-08-24: `fundingchoicesmessages.google.com` stays **off** the allow-list, so Google's Funding Choices consent UI is now genuinely blocked. Our own modal has owned consent since 0.12.6.
2. **Turnstile on the contact and write-for-us forms** — a visible Cloudflare widget exactly where a visitor expects a check, costing nothing on page load. There is a `turnstile-spin` skill in the toolchain for it.
3. **Say it in words on `/about`**: one honest line about how the site is hosted and secured, which is what a visitor deciding whether to trust it actually reads.

## Dead code + copy — session 32's audit list, CLEARED in session 33

All four shipped or resolved on 2026-08-23: the `SessionCard` weather prop deleted (0.334.3), `/api/push/history` deleted (0.334.7), `ChartEmbed` squared (0.334.8), and `privacy.md` rewritten (0.334.0) along with `do-not-sell.md` (0.334.1) and `cookies.md`. The "Vercel KV" comment sweep went with 0.334.2, and the CSP's stale `va.vercel-scripts.com` entry with it.

**What replaced them, and is still open:** push history is now **write-only** (four writers, zero readers) — rebuild the notification centre or stop writing the records; that is queue item 4b in `docs/next-session.md`. And promoting the CSP to enforcing is queue item 6, with one decision baked in (it blocks Google's Funding Choices).

## Original session-32 list, kept for the record

- **`SessionCard`'s `weather?: DailyWeather` prop has zero callers** repo-wide (checked `DayView`, `FilteredSessions`, `SessionList`) and is now the only daily-shaped weather surface left after 0.332.0. Delete it, or point it at `HourlyWeather`.
- **`app/(app)/api/push/history/route.ts` is a reader with no UI** since `NotificationBell` was deleted in 0.332.2. `lib/push-history.ts` is still written by the notify crons, so nothing else is orphaned; removing a public endpoint is the operator's call.
- **`ChartEmbed` uses `rounded-xl` / `rounded-lg`**, against the standing sharp-corners principle. One class change, but a visual one.
- ~~`content/legal/privacy.md` is materially stale~~ — **FIXED 0.334.0**, along with `cookies.md` and `do-not-sell.md`.
- **"Vercel KV" survives in six code comments** (`lib/f1-cache.ts`, `lib/source-snapshot.ts`, `lib/useFollowedSeries.ts`, `lib/userPrefs.ts`, `lib/weather.ts`, `lib/assistant/log.ts`) after the two human-facing strings were fixed in 0.334.1. Zero behaviour, but it is the same stale-naming defect that put Vercel in the privacy policy and `proxy.ts` in both onboarding docs — a one-word sweep whenever those files are next opened. The comment in `app/(app)/layout.tsx` naming Funding Choices is **correct history** and should stay.
- ~~**The CSP still allow-lists `va.vercel-scripts.com`** and runs `report-only`.~~ Both resolved: the dead entry went in 0.334.2, and the header **enforces** as of 0.334.17.

## AdSense-readiness content (live again — the rejection makes it current)

- **Original driver bios, remaining grids** — NASCAR 36 / DTM 21 / WRC 9 / F2 / F3 via the proven solo-wave method (Wikipedia intro + per-series corroborator + style gate, waves of ≤5); RULE #1, no thin pages.
- **Champions depth ×11** (IndyCar, WEC, WSBK, F2, F3, FE, NASCAR, DTM, GT-World, WRC, IMSA) — the proven two-source pipeline (0.266.0), one-two series per session. ADAC 24h + NLS never.
- **More `/information` answers** only where real search demand exists — the session-17 no-duplicates kill rule stands.

## B-perf (remaining levers after the 0.321.2 landing-stream fix)

- Unused-JS treemap hunt (~100-130 KiB across three shared chunks on `/`) · render-blocking CSS (23 KiB / 820 ms on slow-4G) · 13 KiB legacy polyfills (browserslist) · CSP enforce + COOP (Best-Practices 96 on both PSI runs). Re-baseline in `docs/perf-baselines.md` after each change.

---

## DREAM — the operator's console (operator, 2026-08-21)

Not scheduled. Recorded because it is the direction, and because three pieces of it have already been built once.

**The ask, in the operator's words:** be on an "admin" Paddock Tracker that controls what is shown *globally* on the home page — which blog leads, which series has priority — with drag and drop to move the boxes around, sideline and archive them, and slots that can link our own articles, motorsport.com's, or anything else. Then the same idea on the Learn pages: a small pencil visible only to me, to edit the text, add images, or anything else.

**Two halves, and they are not equally hard.**

1. **Home-page composition.** A logged-in editor mode over `/app` where the bands are draggable, hideable and archivable, and each slot can be pinned to a chosen post, a series, or an external link.
2. **Inline editing on Learn.** A pencil on `/information/<topic>/<slug>` that turns prose into an editable field, accepts images, and saves.

**Prior art in this repo — start by reading these, not from scratch:**
- **`#495` `feat(home): 'Make your own home' in-place editor button`** — a home in-place editor already existed. It was almost certainly removed in the 2026-08-18 editorial-home cutover ("full cutover, no survivors"), so the first job is `git show` on that PR to see what it did and why it went.
- **`#386` `feat(blog): in-page draft editing (0.160.0)`** plus `docs/superpowers/specs/2026-07-03-draft-inline-edit-design.md` — **the pencil already exists for blog drafts.** `components/blog/DraftPreview.tsx` and `MarkdownEditor.tsx` are the working pattern; the Learn half is mostly a matter of pointing it at a different content source.
- **`#649` `feat(blog): the studio`** — the dedicated admin surface already exists, so this does not need a new home.

**The two real obstacles, so nobody rediscovers them the hard way:**
- **ISR.** `/app` is `revalidate = 300` and deliberately identical for every visitor — `app/(app)/app/page.tsx` says so, and that sameness is what makes it cacheable. Operator-chosen ordering has to come from a config the *server* reads at render (KV or a Supabase row), never from per-user state, or the page stops being cacheable and the landing-stall class of bug returns.
- **Learn content lives in files, not a database.** `content/` markdown is the source of truth and `/information` **memoises its registry per process**, so an edit needs a deliberate invalidation path (a CLAUDE.md landmine: a content edit currently needs a dev restart to surface). Editing live means either committing to the repo from the UI or moving that content into Supabase. That is the fork in the road and it should be decided before any code.

## Parked (might do — revisit trigger)

- **Results / standings / rounds body rework** — 0.314.0 kept their table bodies deliberately; **revisit only as a fresh operator ask**.
- **Blog `[[classification …]]` embed** — needs session picking, multi-class handling, a caching stance; **design first, revisit on the next blog-feature push**.
- **Session-page adapter extraction** (`[session]/page.tsx:87-314` → `lib/results/session-classification.ts` + tests for `pickRaceForSession`/`pickGtWorldRace`) — pure move, page 985→~650; **revisit next time that page is worked anyway**.
- **F2/F3 official-schedule parser** (the event pages' RSC payload carries the full timetable; ECAL widget has no raw ICS) — outbound → preview-paired; **revisit if F2/F3 times drift again** (calendars verified clean 08-03).
- **F1 schedule cross-check → prod cron** (`npm run health:f1-schedule` → `/api/cron/health`) — outbound, preview-paired; **revisit after the next schedule-drift incident**.
- **IndyCar session times + results parser** (motorsport.com/indycar) — preview-paired, never merge unverified outbound; **revisit if IndyCar gaps get flagged**.
- **TBC session times — WRC remaining rounds** — curate into `sessions.json` as itineraries publish (wrc.com/ewrc bot-blocked from datacenters); token-heavy, modest value.
- **Bahrain GP 2026** — NOT confirmed (operator confirmed the non-verification); parked until F1/FIA officially confirm.
- **BMC donor webhook** (phase 2 of the 0.264.0 supporter gate) — auto-flag `publicMetadata.donor` with email matching; **revisit when donations outpace the manual toggle**.
- **Blog reactions polish + likes-based "suggested posts"** (schema already stores `user_id`) — **revisit on blog engagement growth**.
- **Data completeness batch** — F1 classification speed (event-driven warming off `sessions.json`, Jolpica eval) · `withSourceSnapshot` extension to the ~11 remaining `lib/results/*` modules · remaining standings charts (FE / IndyCar / GT-World / IMSA / WEC — points-scale-gated) · results re-check lifecycle (late penalties; Gasly-Monaco precedent) · OpenF1 live-lockout residual + weekend pre-warm · weather lat/lon gap-fill for venues missing from `circuits.json`. **Revisit per item when its gap actually bites**; curation patches as timetables drop remain standing work.
- **Live / race-day batch** — live in-race data feed · per-session results-fetch lifecycle · Live Now expansion · results-table hover + interval + leader-gap columns. **Revisit as a product-direction pick.**
- **Onboard / F1 telemetry phase 2** — broadcast cameras + all-driver roster · 3D track comparison + "did X lift" · cockpit ghost indicator · pit-lane/garage readability + real-geometry P2. **Revisit as a product-direction pick.**
- **Betting & social batch** — real-odds adapter (RapidAPI, house-band clamp, datacenter verify) · multiplier/potential-return on pending bets (data-model decision) · non-F1 markets · grid/quali market types · F2 market go-live + F3 renumber · thread replies/markdown/rate-limit + weekend comments · minigames. **Revisit as a product-direction pick.**
- **UX / IA / mobile batch** — W5 per-page layout spec · information-density pass · old-home-widget remaster · home layout modes/columns · deeper mobile Community tab · assistant phase-2 (grounded Q&A over `/information`) · richer map overlays (geometry-blocked) · weekend sector diagram · season/month recap pages · head-to-head beyond F1 · champions-tab visual redesign · session cards tap-to-expand + home-collapse + back-path · UI/CSS inspiration pass + scroll-driven landing animation · mobile-first audit. **Revisit as a product-direction pick.**
- **Notifications batch** — per-event-type push · custom per-user rules · per-series/per-type sounds · hero images in payloads. **Revisit on notification-engagement signal.**
- **Quality / launch batch** — WCAG 2.2 AA audit + motion/focus/contrast polish · component tests (Testing Library) + Playwright E2E on previews · route best-practices (error boundaries, Suspense, segment configs) · admin content-authoring UI (**trigger: Fotis actually editing**) · Android TWA → Play Store (post-v1.0) · Greek `/el/` route tree · dev/staging environment (operator: maybe unneeded) · feeder-intake Phase 2 (signed uploads >2 MB, Turnstile) · user + consumer research. **Post-v1.0 or on-signal.**
- **Sentry server-side re-introduction** — decide together with the error.tsx re-scope (0.288.0 removed it for worker size; needs the operator's DSN).
- **SEO Phase 2b** — session `force-dynamic`→ISR (F1 `auth()`-gate refactor) + `LocalTime` Athens-SSR canonical time + selective session sitemap. **Revisit only if session pages become an indexing priority**, and not unsupervised.
- **Trending content** — MORE venues + race-weekend "what time" landing content (the ~138 track profiles are already deep). **Revisit when adding venues or on a landing-content push.**
- **GitHub Actions CI** (typecheck + vitest on PRs) — pair-debug a known-green workflow on a throwaway branch first; operator has zero tolerance for red checks.
- **Public README + Mermaid architecture diagram** — post-v1.0 showcase.
- **Era markers / sparklines on Champions** — after a champions.json cleanup.
- **Another "Claude design" depth pass** (background warmth / theming) — after the next user-research pass.
- **GDPR / cookie-consent banner refinement** — revisit at ~500 visitors/day or a real complaint.
- **SoftwareApplication JSON-LD on `/`** — blocked on real user reviews/ratings (invalid without `aggregateRating`).
- **Sportmonks F1 / API-Sports F1** — paid live-timing candidates; MUST test from a preview (datacenter-IP 403s) before adoption.

## Killed (won't do — one-line why)

- **Duplicate zero-click explainers** — every high-demand explainer (DRS/2026, points systems, what-is/whats-new/weekend ×series, differences, rally, most-titles) already exists in `content/information/answers/` + `featured: true`; the gap is authority/indexing (backlinks, Bing/GEO), NOT content, and internal linking shipped session 17. Don't write duplicates. (session-17 audit)
- **Driver portraits ×14 series** (killed 2026-07-12, operator) — long-tail licensing curation, not worth it.
- **Team logos ×15** (killed 2026-07-12, operator) — no free / non-infringing source; keeping copyrighted logos would be a violation.
- **Paddock-coins ledger** — superseded by the betting credits economy.
- **Supabase region move / Cloudflare D1** — Dublin compute co-location realised the latency win; D1 can't host the atomic ledger RPCs.
- **Reverse-engineer fiaformulae/motogp/nascar XHR endpoints** — resolved via Pulselive / Wikipedia / motorsport.com pipelines.
- **Migrate mdx-components to tokens** — the file carries no styling.
- **Notification badge chequered motif** — badge must stay monochrome (`badge-96.png` landmine).
- **AppShell `--tint` lift** — obsolete (the sidebar drawer was removed in 0.17.0).
- **F1 `rounds.json` sprint markers** (killed 2026-08-20) — `sessions.json` already owns sprint structure, and RULE #1 verifies weekend format against the official calendar anyway; a second in-repo copy can only drift. (Zandvoort checked 08-20: our calendar was right.)
- **Blog cadence automation + session-report variants** (killed 2026-08-20) — the operator writes all posts now (the session-30 contract); auto-drafting contradicts it.
- **All-time legends pages** (killed 2026-08-20) — operator: content is close to perfect; long-tail authoring outweighs value.
- **media.json seeds ×11** (killed 2026-08-20) — same call; geo-restriction-audited YouTube curation is heavy for a nice-to-have.
- **Theme-gallery follow-ups** (killed 2026-08-20) — the flagged surfaces are gone (DisciplinesGrid orphaned by the 0.295.0 landing) or fixed (0.317.1 `seriesInk`); the rest was unrequested polish.
- **Blog Share auto-copy** (killed 2026-08-20) — offered once, never asked for again.
- **Heatmap overlay blob customisation** (killed 2026-08-20) — admin cosmetic, no demand.
- **NavPanel Home/End keys + scroll memory** (killed 2026-08-20) — polish without a user signal.
- **Dev hydration-mismatch warning for stored themes** (killed 2026-08-20) — dev-only noise; `suppressHydrationWarning` on `<html>` is a shotgun; revive only if it ever masks a real bug.
- **External cron pinger** (killed 2026-08-20) — crons run in-worker via Cloudflare triggers (`worker.ts` CRON_JOBS); the one GitHub-Actions job left (warm-live-data, */20) is deliberate — it exists for clean egress IPs, which a pinger cannot provide.
- **Offline mode, 7-day SW cache** (killed 2026-08-20) — offline was removed entirely on operator order (0.268.0); this line contradicted that decision.
- _Deleted as fossils at the 2026-08-20 triage (already done or superseded, per HANDOFF 08-04/08-06): the Cloudflare-DNS spot-check `[you]` item · the Bing verification-token item · the "set GA4/GSC/Bing env in Vercel" operator item · the duplicate doc-hygiene line (lives in NOW #6) · the duplicate champions-depth line (lives in AdSense-readiness)._
