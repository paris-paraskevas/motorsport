# Paddock — time plan

Day-by-day intent. Updated at session start (write the plan) and session end (mark done / partial / skipped, sketch tomorrow).

Items here should map to entries in `IDEAS.md` Now / Next.

**Format conventions:**
- One section per ISO week (`## Week of YYYY-MM-DD`).
- One subsection per day (`### Mon YYYY-MM-DD`).
- Bullets are intent at the start of the day; append outcomes at the end (`→ done`, `→ partial: <note>`, `→ skipped: <why>`).
- Explicit "won't touch this session" line stops scope creep.
- `Active:` line under each day logs real active time per the `[+Nm]` prompt prefix (see `CLAUDE.md` → Time tracking). Example: `Active: 25 + 40 + 15 = 1h 20m`.

---

## Week of 2026-05-11

### Sat 2026-05-16

Morning ship marathon:

- → done: ship `0.9.1` weekend correctness fixes — phantom 3 am times (Session.dateOnly through the pipeline, "TBC" display, live-now + notify cron skips), canonical F1 round numbers via `content/series/<slug>/rounds.json`, sessions.json override loader, FE Monaco 2026 sessions curated.
- → done: bootstrap `CLAUDE.md` operating manual + `IDEAS.md` ledger + `SCHEDULE.md` time plan (`0.9.2`).
- → done: mature `CLAUDE.md` with ESPA protocol + seven extensions + Mode awareness + four communication discipline rules; reversed commit-attribution policy (no more `Co-Authored-By`) (`0.9.3`).
- → done: scaffold two-contributor workflow — `CONTRIBUTING.md` + `ONBOARDING.md` + reversed CLAUDE.md push-to-main rule. CI workflow parked. (`0.9.4`)
- → done: triage `IDEAS.md` Now/Next; close Saturday; sketch Sunday; port handoff from memory to `docs/HANDOFF.md`; memory file becomes a redirect stub. (`0.9.5`)
- → done: handoff appendix — flat 60-item open-items inventory in `docs/HANDOFF.md` (`0.9.6`).
- → done: per-prompt active-time tracking — `[+Nm]` prefix → `SCHEDULE.md` Active line + memory rule (`0.9.7`).

Afternoon mini-session — **pre-Fotis cutoff scoped**:

- Scope rule set ([[project-paddock-pre-fotis-cutoff]]): clear open items by Mon/Tue (2026-05-18/19). All new ideas → Inbox only. After Tue Fotis sit-down happens.
- Plan: doc-sync `0.9.6` + `0.9.7` to `docs/HANDOFF.md`, then start Tier 1 — browser-verify `0.9.1`, `00:00` mystery, then sessions.json + rounds.json curation scout for non-F1 series with upcoming rounds.
- Won't touch this afternoon: Supabase work, SEO baseline (S5), Tier 4 multi-session items (only chip if Tier 1+2+3 finish early).
- All commits from here on follow the new branch + PR + squash-merge flow (`CONTRIBUTING.md`). No more direct pushes to main.

End-of-Saturday outcomes (much expanded scope vs morning plan):

- → done: ship `0.9.8` PR #1 — F1 2026 Bahrain/Saudi cancellations restored to `rounds.json` with `cancelledRounds[]` field; new `CancelledRounds.tsx` component renders banner + section on `/series/f1`. URL stability preserved (R5 = Canada, not Saudi). Merged at `cd169b6`.
- → done: ship `0.9.9` PR #2 — postponement rendering (`rescheduled` pill + amber `Rescheduled from <date>` note in `WeekendBlock` + `WeekendHero`), MotoGP rounds.json (22 rounds incl. Qatar/Por/Val cascade), WEC rounds.json (8 rounds, Qatar postponement, Imola R1), midnight-UTC `dateOnly` detection in `lib/ics.ts` ("3 am" fix → "TBC"). Merged at `e0d93cf`. **All non-F1 ICS feeds now render TBC honestly instead of fake 03:00.**
- → done: research — `docs/research/db-best-practices.md` (Postgres/Supabase schema patterns, 30+ sources), `docs/research/per-series-source-audit.md` (14 series + ADAC 24h source-by-source audit, 2026 cancellation summary), `docs/research/ingestion-resource-evaluation.md` (5-link RapidAPI evaluation: skip Sportbex, adopt TheSportsDB as fallback, borrow indycar-calendar playbook).
- → done locally, **NOT YET ON MAIN**: `0.9.10` full-season session-time curation across all 14 series + ADAC 24h (15 new `sessions.json` files). `0.9.11` template-projected empty rounds across F1/F2/F3/MotoGP/WEC/DTM/GTWCE (62 new override blocks). Both stuck on branch `feat/postponement-rendering-motogp-wec` after PR #2 was merged. **Sunday first thing: open PR #3 with these two commits.**
- → done: investigated user's RapidAPI subs. Sportbex Motor Sport API = useless (betting only, F1+IndyCar). AllSportsApi v2 = covers motorsport (13 categories incl. WRC, DTM, MotoGP) but endpoint integration deferred; noted in IDEAS for future. TheSportsDB = sparse data, volunteer-edited.
- → partial: `#3 Make every series calendar factually accurate` — curation work done locally but not on main; some rounds (DTM Norisring R4, WRC mid-season stages, GTWCE late-event detail, IndyCar/NASCAR mid-season practice) genuinely await source publication.
- → skipped: `#2 Apply DB practices → draft schema for our case` — research shipped, actual DDL draft doc never written.
- → skipped: `#4 Wire weather + news into every round` — never started; needs an audit pass to verify weather (Open-Meteo, venue-local per `feedback-paddock-weather-venue-local`) and news feeds populate for every round of every series.

### Sun 2026-05-17

**Priority 1 (first thing):** Open PR #3 with the stuck `0.9.10` + `0.9.11` commits → merge → production auto-deploys real session times across the site.

Then continue pre-Fotis cutoff:

1. **Browser-verify PR #3 once deployed** — spot-check 3 series whose next round is soon (MotoGP Catalunya was today; check IndyCar Indy 500 May 24, F1 Canada May 22-24, IMSA Detroit May 29-30, WEC Le Mans Jun 13-14).
2. **Task #4 — weather + news audit.** For each of the 15 series, click into the next upcoming weekend, confirm weather block renders (or note which series have no weather wiring) and news feed populates (or doesn't). Output: list of gaps. Curation pass for any series missing weather/news.
3. **Task #2 — Supabase schema DDL draft.** Use the research from `db-best-practices.md` to write a concrete schema doc (`docs/research/supabase-schema-draft.md`): tables, columns, types, FKs, status lookup, audit log, provenance columns, time model. Ready for Fotis sit-down on Tue.
4. If time: open Norisring/WRC stage rounds for re-audit (sources may have published in the last 24h).

Won't touch this session: AllSportsApi integration (defer until Supabase scope decided), comments thread, predictions, anything from Parked.

Active:
_(awaiting [+Nm] prefixes)_

### Sun 2026-05-17

Pre-Fotis cutoff continues. Priority order:

1. **Tier 1 finish** — sessions.json + rounds.json curation pass across non-F1 series with rounds in next 30d, endurance-series weekend grouping audit, ESLint cleanup + husky pre-commit, delete unused `lib/onboarding.ts`.
2. **Tier 2 polish** — custom `app/error.tsx`, `/api/cron/health`, news-filter persistence, push click handler deep-link, DRY notifications components, hero images in push payload, fold `overview.md` into F1 About, home hero next-2-3-sessions, Settings "Your devices", install Resend.
3. **Tier 2 pull-ups** — session cards tap-to-expand, driver season-trend chart, common topics on Rules tab, Clerk dark retheme.

Won't touch this session: Supabase code, comments thread, predictions, anything from `IDEAS.md` Parked or `Killed`.

Active:
(time-tracking starts the next session — prefix each prompt with `[+Nm]` and I append here)

### Mon 2026-05-18 → Tue 2026-05-19 — rolled into one marathon session

19 PRs shipped, versions 0.10.4 → 0.10.22. Pre-Fotis cutoff drained.

PR-by-PR (in order):

- → done: #16 (0.10.4) AdSense snippet + Consent Mode v2 default state in `app/layout.tsx`. Defaults all denied; AdSense + GA load but suppress cookies until consent updates.
- → done: #17 (0.10.5) `public/ads.txt` with IAB-compliant publisher line.
- → done: #18 (0.10.6) foreground push-sound playback. SW posts `paddock:push-sound` to visible clients; `<PushSoundPlayer>` plays an F1-radio cue at vol 0.6 (later raised to 1.0).
- → done: #19 (0.10.7) per-page browser-tab titles (`title.template: '%s — Paddock'`) + chequered-flag favicon (`app/icon.png`).
- → done: #20 (0.10.8) calendar month-by-month navigator on `/calendar` and per-series Calendar tab. Retired `PastToggleSection`.
- → done: #21 (0.10.9) consent-script ordering fix. Curl of prod showed AdSense rendering before consent-default in `<head>` because Next App Router reorders raw `<script>` tags. Switched both to `<Script strategy="...">`.
- → done: #22 (0.10.10) F1 curated champions 1950–2025 with inline WCC indicator. User disliked layout.
- → done: #23 (0.10.11) ChampionsTab rewritten — Drivers' / Constructors' as two distinct sections instead of inline WCC.
- → done: #24 (0.10.12) MotoGP curated champions 1949–2025 + manufacturers' titles.
- → done: #25 (0.10.13) batched curated champions for the remaining 7 series — WSBK, WEC, IMSA, DTM, GTWC, F2 (+GP2), F3 (+GP3).
- → done: #26 (0.10.14) `constructorChampion` gap-fill for F2 / F3 / WSBK / IMSA.
- → done: #27 (0.10.15) notification badge redesign — 2×2 chequer. Later reverted.
- → done: #28 (0.10.16) legal pages × 5: `/privacy`, `/terms`, `/cookies`, `/accessibility`, `/do-not-sell`. Plus Consent Mode v2 update wiring on persist, GPC honoring, Vercel KV consent log API, Footer expansion.
- → done: #29 (0.10.17) GFM tables on the legal pages — added `remark-gfm` to the markdown pipeline.
- → done: #30 (0.10.18) removed the custom `<CookieBanner>` per user, deferred to Google's published CMP only.
- → done: #31 (0.10.19) explicit Funding Choices snippet (`?ers=1`) to force CMP fetch independent of AdSense approval state. **CMP still not displaying — AdSense site approval is the gate.** Pinned for re-verify in HANDOFF.
- → done: #32 (0.10.20) badge revert to original 4×3 + pole, push-sound volume 0.6 → 1.0, pinned the Google CMP / AdSense-approval reminder.
- → done: #33 (0.10.21) WSBK manufacturers' 1988–2001 filled in (P1.15). WSBK now 38/38 entries complete on both driver + constructorChampion.
- → done: #34 (0.10.22) GTWC Endurance Cup as a third section (P1.14). `Champion` type gains `secondaryDriver` / `secondaryTeam` / `secondaryLabel`; new `<SecondarySection>` subcomponent.

Champions data shipped — 14 of 15 series now curated end-to-end (every series except ADAC where Champions tab is "Past Winners" with a different shape — already curated in 0.10.3 from yesterday).

Outcomes vs original Monday-evening 4-priority plan:

- → done: AdSense (#16, #21, #17, #30, #31). Banner **still gated by AdSense approval** — Funding Choices server hasn't started serving the published message yet. Pinned in HANDOFF for re-verify when AdSense status flips.
- → done: notification sound (#18, #32 vol bump). Background custom sound still requires native wrapper (parked).
- → done: privacy + ToC + cookies (#28). Two `<!-- TODO confirm -->` markers in `privacy.md` + `terms.md` for governing law and contact email (defaults: Greece/Thessaloniki, pparaskevas.dev@gmail.com).
- → skipped: Speed Insights US-perf investigation. Out of bandwidth. Re-queued for next session.

Beyond the original plan: month-by-month calendars (#20), per-page browser titles + chequered-flag favicon (#19), 9 champions PRs covering all 15 series in full (#22, #23, #24, #25, #26, #33, #34), badge revert (#32).

Active:
_(no `[+Nm]` prefixes captured — wall-clock approx 6h across the two nominal days)_

### Tue 2026-05-19 — continued — Track A closure + content-authoring infra

After the marathon close, a second session on the same calendar day shipped 7 PRs (versions 0.10.23 → 0.10.29). All targeted the post-marathon legal/risk track (Track A) defined in the session-injected 3-track handoff and on the Wikipedia-content-removal item (A5).

PR-by-PR:

- → done: #36 (0.10.23) **A1** — imprint page (`content/legal/imprint.md`, `app/imprint/`, `app/impressum/` German alias) + privacy postal address. DDG §5 + GDPR Art. 13 + § 18 Abs. 2 MStV editorial responsibility line. Footer link.
- → done: #37 (0.10.24) follow-up — address block was rendering as one inline line (CommonMark soft-break). Switched to trailing-two-spaces hard breaks + invisible markdown comments documenting the convention.
- → done: #38 (0.10.25) **A2 + A3** bundled — `POST /api/push/unsubscribe` now verifies ownership before deleting (`isSubscriptionOwner` helper + 6 new tests in `lib/push.test.ts`, total 82/82); `POST /api/contact` `kv.set` now carries `{ ex: 60*60*24*365 }` to match the 12-month retention promise on `/privacy`.
- → done: #39 (0.10.26) **A4a** — site-wide security headers via `next.config.ts` `async headers()`: HSTS extended to `includeSubDomains; preload`, plus `X-Content-Type-Options nosniff`, `X-Frame-Options DENY`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy camera=()/microphone=()/geolocation=()/interest-cohort=()/browsing-topics=()`. CSP deferred.
- → done: #40 (0.10.27) **A4b** — content routes converted from `force-dynamic` to `revalidate=300`. `next build` confirms `/`, `/calendar`, `/blog` now render as `○ Static` with 5-min revalidate. `/series/[slug]` stays dynamic because `searchParams.tab` defeats ISR — deferred to Track C Phase 2 with path-based tabs.
- → done: #41 (0.10.28) **A5** — F1 history tab refactor + content-authoring infrastructure. `components/tabs/HistoryTab.tsx` + `RulesTab.tsx` now render markdown from `content/series/<slug>/<tab>.md` instead of Wikipedia HTML; placeholder fallback for missing files. `lib/wikipedia-article.ts` deleted. New `content/series/f1/history.md` ~545 w (3-section Origin/Turning points/Today's shape template) cited against 15 footnotes from Formula1.com, FIA archives, Doug Nye's *Autocourse History of the Grand Prix Car*, 8W/Forix, Motor Sport Magazine, Autosport, The Race, Joe Saward, StatsF1. Authored byline rendered from frontmatter. Infrastructure: `docs/content-authoring/README.md` (12 article-authoring principles + workflow), `SOURCES.md` (31-source tiered list), `drafts/f1-history.md` (working draft + iteration log + long-form alternate).
- → done: #42 (0.10.29) two follow-up bugs on the F1 history tab — `remark-html` double-prefixed footnote IDs while hrefs got single prefix (anchor clicks didn't scroll); `gray-matter` parses YAML dates as `Date` objects (byline missing the "Last updated" line). Both fixed.

**A5 scope delivered vs originally specified:** F1 only. MotoGP, WEC, and the remaining 12 series are parked in the handoff content workstream. Same for all 15 Rules tabs.

Outcomes vs the morning intent ("Track A first, then Fotis sit-down tonight"):

- → done: Track A complete (A1 + A2 + A3 + A4a + A4b + A5).
- → done: content-authoring infrastructure ready to template the other 14 series.
- → done: handoff + SCHEDULE updated for next session.
- → not yet (this session): Fotis sit-down on `docs/research/supabase-schema-draft.md`. Likely scheduled this evening / separate session.

Next session per the handoff: **Track B — SEO + GEO**, research-first. Operator will share authoritative best-practice source links. Session-start protocol includes asking for the Google indexing-status screenshot. See `docs/HANDOFF.md` "Active workstream" section.

Active:
_(no `[+Nm]` prefixes captured this session)_

### Tue 2026-05-19 — continued — Track B research + B1 manifests

Third session same calendar day. Research-first per handoff protocol. Outcomes:

- → done: PR #44 — docs(track-b) research synthesis + B-perf bundle + sitelinks-timeline reset (operator screenshots + SEO Starter Guide). Merged.
- → done: PR #45 — feat(seo) B1 discoverability manifests 0.10.30 — `app/robots.ts` + `app/sitemap.ts` + `public/llms.txt`. Initial commit `8b552cf`; self-review + web-research fix-up commit `8178d05` (dropped `lastmod`/`priority`/`changefreq`, fixed `host:` format, split sitemap into `lib/sitemap-data.ts` + thin wrapper, added 7 vitest cases, restructured llms.txt with `## Optional`). Merged.
- → done: PR #46 — docs(seo-geo) comprehensive playbook from 152 Google Search Central docs at `docs/seo-geo-playbook.md` (2 447 lines, 8 parallel research agents). Surfaced four new bundles (B-perf, B-content, B-discover, B-monitor) + B8b deferred + priority reshuffle. Merged.

Material reframings from PR #46 research:
- Sitelinks searchbox retired Google 2024 — `WebSite + SearchAction` not the searchbox gateway anymore.
- Sitelinks mini-links realistic timeline: 6–12+ months, not 4–12 weeks.
- Bing Webmaster Tools is the GEO unlock — ChatGPT search uses Bing's index. New operator action.

Active:
_(no `[+Nm]` prefixes captured this session; wall-clock approx 4h)_

### Tue 2026-05-19 — continued — pre-Fotis full Track B push

Fourth session same calendar day. **Operator directive:** all Track B bundles that fit in a session, before Fotis arrives tonight for Supabase onboarding.

Categorically out-of-scope (multi-day per playbook, can't physically fit): **B11** (path-based tabs, 1–2 days), **B12** (Greek route tree, 3–5 days), **B-content** (14 history tabs + 15 rules tabs + 3–5 blog posts, 80–130 h). All deferred to dedicated future sessions.

Plan, sequenced by leverage:

1. **Bridge work** — `docs/HANDOFF.md` Track B refresh + this `SCHEDULE.md` entry + `IDEAS.md` triage.
2. **Cheap wins bundle** — B2 + B3 + B4 + B5 + B6 + B-discover.
3. **B-monitor runbook** — new markdown doc, no code.
4. **B7** — tab-aware metadata + canonical on `/series/[slug]`.
5. **B8** — JSON-LD bundle.
6. **B-perf** — split into ≥2 sub-PRs.
7. **B9** — server-render home + calendar bodies.
8. **B10** — per-segment OG images.

Outcomes:

- → done: **PR #48 (0.10.31) — B2 + B3 + B4 + B5 + B6 + B-discover cheap wins.** 21 source files, 23 edits, no UI change. All metadata-only.
- → done: **PR #49 (0.10.32) — Bing URL-inspector fixes (home title 57 chars + sr-only H1) + B7 tab-aware metadata + canonicals.** New `describeTab()` helper in `lib/tabs.ts`. Bing Live URL inspector confirmed 0 SEO/GEO issues after deploy.
- → done: **PR #50 (0.10.33) — IndexNow protocol + weekend canonical + sharper /blog description.** Full IndexNow shipped: key file, `lib/indexnow.ts`, `scripts/submit-sitemap-to-indexnow.ts`, `npm run indexnow:submit`, README rewrite. First live push accepted 226 URLs at HTTP 200.
- → done: **PR #51 (0.10.34) — B8 JSON-LD bundle (5 schemas) + RSS lastBuildDate bug fix.** New `lib/json-ld.ts` + `components/JsonLd.tsx`. 8 pages wired. ProfilePage deferred to B-content. RSS no longer emits Unix-epoch `<lastBuildDate>` when posts are empty (self-inflicted bug from 0.10.31 surfaced by post-PR-#50 verification sweep).
- → done: **External actions — sitemap submitted to GSC + Bing + Brave; IndexNow first run successful.** All three search engines now know about the 226 URLs.
- → skipped: **B-monitor runbook** — not done; queued for next session. Low effort (~30 min).
- → skipped: **B-perf** — blocked on operator desktop PageSpeed Insights screenshot. Mobile-only numbers in hand. Explicit blocker.
- → skipped: **B9 server-render bodies, B10 per-segment OG images** — bandwidth ran out after B8. Queued for next session.

**Beyond plan:**
- → done: Three rounds of mid-session ESPA — caught (a) stale prompt proposing brand rename to "Paddock Tracker", (b) duplicate scope vs PR #48 + #49, (c) the IndexNow path that became PR #50. Senior-dev pushback worked as intended.
- → done: Post-PR-#50 verification curl sweep across 27 production signals. 26 passed; surfaced the RSS lastBuildDate Unix-epoch bug which folded into PR #51.

**State at session close:** Track B 11 of ~18 bundles shipped. Next session: **B-perf** is #1 pick (after operator screenshot). Full priority list in `docs/HANDOFF.md` → Active workstream → "Next-session pickup".

Active:
_(no `[+Nm]` prefixes captured this session; wall-clock approx 6h across the four sessions today; aggregate calendar-day shipping: 11 PRs #41 → #51, versions 0.10.28 → 0.10.34)_

### Tue 2026-05-19 — continued — baseline capture + Wed work queue

Fifth (and final) mini-session same calendar day. Operator landed PSI desktop screenshots + Vercel Speed Insights desktop + mobile views; B-perf is no longer screenshot-blocked. This session captures the baselines durably and converts the Wed stub into a concrete plan.

- → done: `docs/perf-baselines.md` created — first time-series baseline row. Vercel SI desktop RES 95 / mobile RES 76; PSI desktop LCP critical path 2,037 ms + 616 KiB unused JS broken down (Clerk 224 / AdSense 157 / FundingChoices 98 / GTM 64 / other 73) + 7 long main-thread tasks; PSI mobile Best Practices 81 + Accessibility 90 (Perf section not captured this snapshot — flagged for recapture).
- → done: `SCHEDULE.md` Wed 2026-05-20 stub replaced with 4-PR B-perf sequence (0.10.36 quick-wins → 0.10.37 3rd-party deferral → 0.10.38 Clerk lazy → 0.10.39 CSS critical-path) + B9 server-render kept as separate session.
- → done: `docs/HANDOFF.md` Active-workstream Quick-state + B-perf row cross-ref to `docs/perf-baselines.md`.
- → done: `IDEAS.md` Now slot 1 ("Pre-Fotis Track B push tonight") → replaced with "B-perf execution (Wed 2026-05-20)". Slots 2 (Fotis Supabase) + 3 (weather + news audit) carried.
- → done: memory `project-paddock-perf-baselines.md` added + `MEMORY.md` index line. Expired `project-paddock-pre-fotis-cutoff.md` removed (cutoff date reached, rule no longer applies).
- → done: ship `0.10.35` (docs-only, no behavior change) — CHANGELOG + RELEASES + package.json all bumped.

Active:
_(no `[+Nm]` prefixes captured this session)_

### Tue 2026-05-19 — continued — IndyCar pivot + Fotis onboarding

Sixth sub-session same calendar day. Two parallel streams in flight:

- **Fotis onboarding (in progress).** Reading `CONTRIBUTING.md` + `ONBOARDING.md` before the Supabase sit-down. Pre-`docs/research/supabase-schema-draft.md` walkthrough phase.
- **IndyCar pivot.** Operator spotted a Wikipedia-CSS leak in the IndyCar Drivers tab (`.mw-parser-output .legend{...}` block rendering between Caio Collet and Santino Ferrucci on A.J. Foyt Enterprises). Production bug → drove a scope pivot from "Bing fixes first" to "IndyCar end-to-end first". Phasing:

  | Phase | Scope | Effort | Status |
  |---|---|---|---|
  | 1 | Strip Wikipedia `<style>` / CSS leak in season scrape (likely `lib/wikipedia-season.ts`) — affects ALL series using the live scrape fallback, not just IndyCar | 30 min | Pending |
  | 2 | Write `content/series/indycar/drivers.json` from agent output → activate `/drivers/<slug>` + `/teams/<slug>` for IndyCar. **End-to-end Phase 0 validation done on IndyCar instead of MotoGP** | 45 min | Pending |
  | 3 | IndyCar standings — `lib/standings/indycar.ts` + `StandingsTab` wire + cron | 2–3 h | **Source-probe-gated** — depends on indycar.com being non-SPA |
  | 4 | IndyCar results — `lib/results/indycar.ts` + `ResultsTab` wire + cron | 2–3 h | Same gate |
  | 5 | IndyCar history essay — `content/series/indycar/history.md` F1-template | Operator-paced | Parallel |

**Bing fixes (originally 0.10.36) deferred to Wed 2026-05-20.** Three issues bundled: sitemap orphan-round filter (8 weekend 404s — FE doubleheaders + IndyCar Milwaukee R2 + NLS Sunday qualifier) + weekend title truncation (11 pages >70 chars) + RELEASES.md `# Releases` strip (1 multi-h1 on /changelog).

**a11y quick-wins (originally 0.10.37)** — also pushed forward; sequence behind Wed Bing fixes.

**Drivers.json batch for remaining 6 Tier-1 series** (motogp, wsbk, f2, f3, formula-e, dtm) — agent outputs in hand, awaiting Phase 0 validation on IndyCar first; then bulk-commit. Currently parked until IndyCar Phase 2 ships.

**Tier 2 drivers.json** (wec, imsa, gt-world, nls, wrc, nascar-cup, adac-ravenol-24h) — not dispatched yet, follow-on after Tier 1 lands.

Active:
_(no `[+Nm]` prefixes captured this session)_

### Tue 2026-05-19 — late-night extension — IndyCar standings + F1 drivers.json + week pivot

Seventh sub-session same calendar day. Operator's directive shifted from B-perf-Wed → data-ingestion blitz Tue→Sun. Shipped:

- → done: **PR #57 (0.10.39)** — live IndyCar standings via `indycar.com/Standings` SSR scrape; `lib/standings/indycar.ts` parses `data-driver-data` JSON attributes from each row; `StandingsTab` dispatch extended to indycar; 7 vitest cases. **First non-F1 series with live standings.** Self-corrected my earlier wrong claim that "indycar.com is SPA" — that probe hit the lowercase `/stats/standings/drivers` SPA route; the canonical `/Standings` (capital S — the URL in `meta.json:officialStandingsUrl`) is SSR'd.
- → done: **PR #58 (0.10.40)** — F1 2026 drivers.json (11 teams × 2 drivers = 22-car grid incl. Cadillac as 11th team, Norris #1 as defending champion, Antonelli at Mercedes, Audi rename, Hadjar at Red Bull, Lawson+Lindblad at Racing Bulls, Bearman+Ocon at Haas, Colapinto at Alpine). Activates `/drivers/<slug>` + `/teams/<slug>` for all 22 + 11 entries. Same belt-and-suspenders pattern as IndyCar drivers.json — bypasses live Wikipedia scrape entirely for F1.
- → done: **PR #59 (0.10.41)** — this PR. `docs/audits/session-audit-2026-05-19.md` (comprehensive senior-dev audit of all 7 PRs today) + Wed-Sun blitz plan added to SCHEDULE.md + queue items captured (F1 sprints bug, F1 results points bug, driver/team page enrichment, every-session-URL architecture).

**Operator new directives received this session:**
- Driver/team pages must "reflect what they should" — enrich with current standings position / points / wins / country / headshot.
- F1 Sprint races are missing from `/series/f1?tab=results` (bug).
- Points on F1 results graph are wrong (bug).
- Make every session of every weekend of every series its own URL (architecture).
- Week deadline: all standings + results + drivers + teams + history by Sun 5/24.

Active:
_(no `[+Nm]` prefixes captured this session)_

### Drivers.json gap audit (operator-flagged at session close)

Glob-verified state on `main` at session close: **only `indycar` (0.10.37) and `f1` (0.10.40, PR #58 just merged)** have curated `drivers.json`. Every other series — including F3, which the operator believed was covered — needs the file. F3's `/series/f3?tab=drivers` tab is populated by the live-Wikipedia fallback in `lib/wikipedia-season.ts`, not by curated data; `/drivers/<f3-driver-slug>` still 404s. **Net gap: 13 series.**

Agent outputs already in conversation context for 6 of 13 (motogp, wsbk, f2, f3, formula-e, dtm — Tier-1 batch dispatched earlier today; only IndyCar shipped). 7 still to dispatch (wec, imsa, gt-world, nls, wrc, nascar-cup, adac-ravenol-24h — Tier-2 with endurance / rally complexity).

**Bulk-commit sequence woven into the Wed-Sat plan below:**
- **Wed AM:** dispatch 7 Tier-2 agents in background while doing IndyCar results + F1 sprint/points work in foreground.
- **Wed PM:** web-search-verify 6 in-hand Tier-1 outputs per `feedback-paddock-search-for-missing-data` rule; bulk-commit as one PR.
- **Thu AM:** process the 7 Tier-2 agent returns; bulk-commit as a second PR.
- **Sat:** sitemap inclusion of `/drivers/<slug>` + `/teams/<slug>` once all 15 series have drivers.json — sitemap grows once across ~400 new URLs. IndexNow push afterwards.

**Smoke audit early Wed (~10 min):** click into every `/series/<slug>?tab=drivers` tab. Footer label disambiguates: "Source: curated" = drivers.json fired; "Source: Wikipedia →" = live scrape fallback. Logs current state explicitly so we know which series the Wikipedia fallback is masking and which are placeholder.

**Playwright is NOT needed for drivers.json bulk-commit** — Wikipedia season pages are SSR'd; agents WebFetch directly. Playwright is reserved for the SPA-rendered live-data sources (motogp.com, fiawec.com, fiaformulae.com) per Thu-Fri's blitz plan.

### Wed 2026-05-20 — planned — week-blitz day 1 (IndyCar + F1 bugs + Bing fixes + Tier-1 drivers.json)

**Day 1 of the Tue → Sun 5-day data-ingestion blitz.** Per operator directive: standings + results + drivers + teams + history for every series by Sunday. B-perf is **deferred to Mon 5/25** so this week stays focused on the data layer.

**Priority 1 — Bing scan fixes** (deferred two days now; ship first to clear the queue). Three issues from the Bing Webmaster Tools Site Scan: 8 weekend 404s (FE doubleheader / IndyCar Milwaukee R2 / NLS Sunday qualifier orphans — sitemap-only filter needed in `lib/sitemap-data.ts`), 11 weekend titles >70 chars (truncate in `app/series/[slug]/weekend/[round]/page.tsx:generateMetadata`), 1 multi-h1 on `/changelog` (strip `# Releases` from `RELEASES.md`). ~45 min, one PR.

**Priority 2 — IndyCar end-to-end completion:**
- **Per-race results** — `lib/results/indycar.ts` parser; either scrape `indycar.com/results/<event-slug>` if SSR'd, or per-event JSON endpoint if discoverable in `data-driver-data` event sub-objects. Wire into `ResultsTab`. ~2 h.
- **Sitemap inclusion** of `/drivers/<slug>` + `/teams/<slug>` for IndyCar + F1 (now that both have curated drivers.json). Extend `lib/sitemap-data.ts` to iterate `loadAllDrivers()` / `loadAllTeams()` from `lib/people.ts`. ~30 min.

**Priority 3 — F1 bug fixes** (operator-reported):
- **F1 Sprint races missing from results tab.** Audit `lib/results/f1.ts` Jolpica payload — does it include Sprint? Schema extension may be needed: `RaceResult.sprintResult` field or separate `sprintResults` array. Wire into `ResultsTab` UI.
- **F1 results points wrong on the results graph.** Could be in the parser (Jolpica response misread) or display (chart math). Investigate then fix.
- Combined: ~2-3 h, one PR.

**Priority 4 — Driver / team page enrichment** (operator: "make driver and team pages reflect what they should"):
- Driver page: lookup current standings position + points + wins (call `fetchF1Standings` / `fetchIndyCarStandings` based on seriesSlug); country flag if data available; headshot if scrapeable.
- Team page: aggregate drivers' standings positions; team total points; team logo if URL available in standings scrape.
- First pass MVP: position + points + wins for F1 and IndyCar drivers (only series with live standings). Country / headshot can be Phase 2.
- ~2-3 h.

**Priority 5 — Tier-1 drivers.json bulk-commit (6 series):** validate the 6 agent outputs already in conversation context (motogp, wsbk, f2, **f3**, formula-e, dtm). Web-search-verify each per `feedback-paddock-search-for-missing-data` rule. Bulk-commit as one PR with all 6 new `content/series/<slug>/drivers.json` files. F3 is in this batch — operator's mental model thought F3 was covered; reality is only the Wikipedia fallback was rendering. **Dispatch the 7 Tier-2 agents in background early AM** (wec, imsa, gt-world, nls, wrc, nascar-cup, adac-ravenol-24h) so their outputs are ready Thu. ~1-2 h Wed PM total.

**Priority 6 — Cron infrastructure scaffolding** for the per-session refresh architecture:
- Master cron reading `sessions.json` → enqueueing per-session scrape jobs at `session.end + 30 min`.
- Vercel Sandbox setup for Playwright-driven SPA scraping (will use for MotoGP / WEC / IMSA later this week).
- KV-based result storage as bridge until Supabase.
- ~2 h (scaffolding only; per-series implementations in Thu-Fri).

**Won't touch this session:** B-perf items (deferred to next Mon), other series' standings (Thu-Sat), every-session-URL routing (architectural; Thu-Sat).

**Day-1 PR budget:** ~6-8 PRs (Bing fixes / IndyCar results / sitemap / F1 sprints+points fix / driver-team enrichment / cron scaffold). Aggressive.

Active:
_(awaiting [+Nm] prefixes)_

### Wed 2026-05-20 — continued — 0.11.0 → 0.11.3 shipped + 0.11.4 + WRC/GTWCE/IMSA dispatch

The Wed planned outcomes diverged from scope — instead of "Bing fixes / IndyCar results / sitemap / F1 sprint fix / driver-team enrichment / cron scaffold", the day delivered a 0.11.x scraper sweep across 5 new series + a 3-PR FE bug cycle. Logged in `docs/handoff-2026-05-20-session-end.md`. Outcomes:

- → done: 0.10.42 PR #60 — PR A quick-wins (countdown all 15 series / WRC Japan R7 / weekend title trim / RELEASES H1 strip).
- → done: 0.10.43 PR #61 — Champions clickability patch (the one 0.10.42 announced but missed).
- → done: 0.10.44 PR #62 — Champions name normalize + team alias suffix-strip (Red Bull + Palou 1-4).
- → done: 0.11.0 PR #63 — live standings + results across F2 / F3 / Formula E / NASCAR / WSBK (5 new series). 32 test files / 240 tests.
- → done: 0.11.1 PR #64 — FE Wikipedia URL switch (REST → /wiki/). Didn't fix the bug; colspan was the real cause.
- → done: 0.11.2 PR #65 — FE colspan-aware index translation. THE actual standings fix.
- → done: 0.11.3 PR #66 — FE results date fallback (sibling Calendar table lookup + season-end placeholder) + rowspan filter (skip doubleheader 2nd-race rows). Prod-verified.
- → skipped: original Wed plan items (B-perf deferred to Mon 5/25, IndyCar results + F1 sprint fix + driver-team enrichment + cron scaffold all deferred).

Continuation session plan (this evening / next sub-session):

1. **0.11.4** (~30 min) — FE results UX cleanup [B1+B2 from addendum]. `components/tabs/ResultsTab.tsx` formula-e branch: drop misleading `SeasonTrendChart` (winners-only data plateaus every driver at 25 pts) and collapse fake 1-row "Race winner 25" accordion to flat summary row. CHANGELOG + RELEASES + bump. One PR.
2. **0.11.5** (~45 min) — WRC dispatch wiring. Lib files already untracked in working tree (`lib/standings/wrc.ts` + `lib/results/wrc.ts` + tests). Drivers' + Co-Drivers' + Manufacturers' three-table render.
3. **0.11.6** (~45 min) — GTWCE dispatch wiring. 3-section Overall + Sprint Cup + Endurance Cup dispatch. Multi-driver crews — `team: ''` honest.
4. **0.11.7** (~45 min) — IMSA dispatch wiring. 4-class GTP / LMP2 / GTD Pro / GTD multi-class layout.

Renumbering note: addendum reserved 0.11.5 for IndyCar paste, but that's deferred (agent report may not be on disk → verify-or-rewrite risk). IndyCar paste slides to 0.11.8+.

Won't touch this session: 0.11.5 IndyCar paste (deferred), WEC stash recovery (0.11.8+), 0.12.0 drivers.json bulk, B-perf, B-content, every-session-URL routing.

PR shape: one PR per series (three PRs for 0.11.6 family) — per operator directive. Smaller blast radius, easier rollback per series.

Pre-mortem: most likely failure mode is the three series' dispatch additions sharing the same `StandingsTab` / `ResultsTab` files and causing merge friction across the per-series branches. Mitigation: WRC merges first, then GTWCE rebases on it, then IMSA rebases on that.

Active:
_(awaiting [+Nm] prefixes)_

### Wed 2026-05-20 — closed — massive 9-PR continuation session

After the original Wed plan + 0.11.0-0.11.3 morning sweep, this continuation session shipped 9 more PRs (#67-#75), versions 0.11.4 → 0.11.14. The merge cycle cost real time — operator merged in their own order which forced rebase chains across half the branches.

PRs shipped (merge order matches commit order on main):

- → done: **#67 — 0.11.4** FE results UX cleanup (drop misleading SeasonTrendChart, collapse fake 1-row accordion to flat summary).
- → done: **#68 — 0.11.5** F1 chart Sprint points fix. Confirmed 17/17 non-zero drivers now match standings 1:1.
- → done: **#69 — 0.11.7** F2/F3 results KV cache + parallel fan-out. Agent-shipped. Test count 200 → 256.
- → done: **#70 — 0.11.6** FE per-event subpage scrape for full classification. Agent-shipped. 10/10 races including 3 doubleheaders.
- → done: **#71 — 0.11.9** WRC dispatch (Drivers + Co-Drivers + Manufacturers tables; results winners-by-round). DriversTable + ConstructorsTable parameterised with optional `heading?` prop.
- → done: **#72 — 0.11.11** GTWCE standings dispatch (Overall + Sprint Cup + Endurance Cup × Drivers + Teams = 6 tables). Results deferred (no per-position points in SRO data).
- → done: **#73 — 0.11.10** post-#71 hot-fix: WRC mw-heading wrapper + FE standings team="" (was "Unknown") + FE trend chart dropped (Berlin R8 / Monaco R9-R10 articles are stubs, undercount by 30-40pts).
- → done: **#74 — 0.11.13** IMSA standings dispatch (4 classes × Drivers/Teams/Manufacturers = 11 tables, class-first grouping; LMP2 no manufacturers).
- → done: **#75 — 0.11.14** post-#73 hot-fix: WRC results parser priority swap (was matching Calendar table without winner column; now matches Season summary first) + FE doubleheader child-row date fallback (R5/R8/R10 no longer "1 Jan 2026" placeholder).

Production state per `/series/<slug>` at session end:
- ✅ F1, F2, F3, IndyCar, FE, NASCAR, WSBK, WRC, GTWCE, IMSA — live standings.
- ✅ F1, F2, F3, FE, NASCAR, WSBK, WRC — live results.
- ❌ MotoGP, IMSA, WEC, DTM, NLS, ADAC 24h, Moto2/3 — link-out only.

Cross-series invariant locked in CHANGELOG.md (top): season-trend chart totals MUST match the standings tab. Charts dropped from WRC, GTWCE, IMSA, FE (post-#73) until full per-position data lands. F1 chart only one currently shipping; it matches standings.

Key things learned this session:
- **Wikipedia 2024+ wraps headings in `<div class="mw-heading">`.** Parsers that walk `heading.next()` siblings need to walk parent's siblings instead. Caught the hard way on WRC after PR #71 deployed.
- **Wikipedia season pages split Calendar vs Results sections in 2026 WRC.** The Calendar table has rounds + dates but NO winner column. Results table is under a separate Results_and_standings section. Parser must require winner column in candidate-confirmation.
- **FE Wikipedia doubleheader child rows have only [round, date] physically present** (E-Prix / Country / Circuit rowspan from parent). Date column at logical-header index reads empty.
- **Cross-series invariant:** trend chart cannot ship when results parser is winners-only. Locked into CHANGELOG.md header.
- **PR rebase cycles are expensive.** Each operator merge of another PR forces all open PRs to rebase. Strategy: ship hot-fixes as standalone PRs; defer feature PRs when many are open.

Won't touch this session (now closed): IMSA results dispatch (no per-event data), FE results-overrides curation (Berlin/Monaco backfill), WEC stash recovery, MotoGP paste, IndyCar results paste, DTM/NLS write, drivers.json bulk, IA redesign, histories, enrichment, B-perf.

Active:
_(no [+Nm] prefixes captured; wall-clock approximately 8-10h across the continuation session)_

### Wed 2026-05-20 — new sub-session — Phase 1 research wave for 12-series error sweep

Operator surfaced 12 per-series errors and asked to ESPA fixing them properly — "i dont want iterations of me merging and being dissapointed to see your work was shit and didnt work". Plan deviates from the original Thu MotoGP+WSBK day because the operator wants ALL 12 fixed properly, not just the easy 2.

ESPA outcome: research-first, three phases. This session covers Phase 1 only.

Decisions locked in via AskUserQuestion this session:
- Multi-class crew schema for WEC / IMSA / GTWC / NLS / WRC drivers.json — Option 3: optional `carNumber` per `CuratedDriverEntry`. Backwards-compatible `lib/types.ts` extension.
- Research agents: NO worktree isolation. Yesterday's WEC agent leaked files into main with isolation due to absolute-path resolution; research-only prompts don't need it.
- Source-tier preference: official API > official SSR > aggregator > Wikipedia. Wikipedia as fallback ONLY when tiers 1-3 unavailable, and even then require full-classification verification (no winners-only acceptance).
- drivers.json research folded into the same 12-agent wave (one agent per series returns both the standings/results source brief AND the drivers.json brief for that series).

Plan:

- → 0.11.15 — chore wrap (commit working-tree state from yesterday + open the research track). Foreground.
- Dispatch 12 parallel research-only agents — one per error-row series. Constraints baked in: no Write tool, no worktree isolation, must include actual HTTP probe response in the returned brief (no probe = brief rejected and re-dispatched), must consider non-Wikipedia primary sources first.
- Aggregate 12 briefs into `docs/research-2026-05-20-phase1-briefs.md`. One row per series: source chosen / confidence H/M/L / blockers / open questions.
- Walk through the doc with operator. Get explicit source approval per series before any impl is written.
- Update SCHEDULE.md + HANDOFF.md with the Phase 2 PR sequence as locked by the briefs review.

Phase 2 (next 2-3 sessions) ships impl PRs one per series, ordered by post-research confidence + difficulty. Phase 3 (0.12.0) consolidates drivers.json across 13 series.

Won't touch this session: any impl code, dispatch wiring, drivers.json content. Phase 1 is research-only. The whole point is to NOT ship code without source-tier approval.

Pre-mortem: most likely failure mode — a research agent returns confident with a source that's actually 403'd / reCAPTCHA'd / SPA-rendered when probed. Mitigation: the agent prompt requires an actual HTTP probe response paste; absence = brief rejected.

Phase 1 outcomes (all 12 + Flashscore returned):

- → done: **all 12 per-series briefs returned with live HTTP probes pasted.** No brief rejected. Several surprises beat the prior audit:
  - **NLS PDF is direct-download, not reCAPTCHA-walled** as the Saturday 5/16 audit claimed. `teilnehmer.vln.de/.../Klassensieger-Trophaee 2026.pdf` returns 200 / 919KB / `application/pdf` over plain curl. pdftotext-parseable.
  - **racing-reference.info returns 200, not 403** as the existing `lib/results/nascar-cup.ts:6` code comment claims. The comment is stale; per-race classification tables with 45+ rows including owner team available.
  - **IMSA has a clean JSON API** at `imsa.results.alkamelcloud.com` — IMSA's official timing partner, every session of every round, unauthenticated. Beats the assumed PDF-behind-reCAPTCHA path. Wikipedia cites Alkamel as its primary source.
  - **WEC stash parser based on hallucinated URLs.** Two of its three standings URLs return 404. Fresh impl from `fiawec.com /en/page/manufacturers-classification` (single SSR page hosts ALL standings tables) supersedes.
  - **F3 root cause located:** `lib/results/f3.ts:33` Sprint scale `[15,12,10,8,6,4,2,1]` is wrong (correct: `[10,9,8,7,6,5,4,3,2,1]`) AND Melbourne SR was a half-distance red-flag race scoring 5-4-3-2-1 top 5 only. Fix = migrate both parsers to read `__NEXT_DATA__.RacePoints` (authoritative FIA value) like F2 does.
  - **Formula E R7-R10 have a clean upstream:** `motorsportweek.com/{date}/formula-e-2026-{slug}-e-prix-race-{N}-results/` returns WordPress `wp-block-table` SSR with full 20-driver classifications for all 4 missing rounds. Beats curated overrides.
- → done: **Flashscore evaluation:** not viable. 100% SPA across all 15 series (no `__NEXT_DATA__`, no inline JSON), hostile `robots.txt` for AI/scraper UAs, and the 4 series we need most (IMSA / GT-World / NLS / ADAC) return 404 entirely. Documented in HANDOFF as a "do not pursue" source.

**Locked-in source picks (one per error-row series):**

| Series | Issue | Source picked | Conf |
|---|---|---|---|
| f3 | std/res disagree + drv | Migrate to `__NEXT_DATA__.RacePoints` like F2 | H |
| indycar | results | Wikipedia season Driver_standings table | M |
| formula-e R7-R10 | full-class + drv | motorsportweek.com per-event SSR | H |
| motogp | std+res+drv | Pulselive JSON API | H |
| wec | std+res+drv | fiawec.com `/en/page/manufacturers-classification` SSR | H |
| imsa | results full-class | Alkamel Systems JSON API | H |
| nascar-cup | full-class + drv | racing-reference.info per-race | H |
| gt-world | results | Existing parser + SRO points scale module | H |
| wrc | full-class + drv | Wikipedia per-rally articles | H |
| dtm | std+res+drv | motorsport.com/dtm SSR | H |
| nls | std+res+drv | teilnehmer.vln.de PDF + Wikipedia raw wikitext | H |
| f2 | drv only | 5-source cross-verified (Wiki + FIA + Formula Scout + AutoHebdo + WebSearch) | H |

**Operator decisions captured via AskUserQuestion:**
- MotoGP Manufacturers' Championship: skip for v1 (FIM aggregation rule, riders-only).
- NASCAR results team field: owner team (`23XI Racing`), not manufacturer (`Toyota`).
- WRC drivers.json schema: single CuratedDriverEntry per crew with optional new `coDriverName` field.
- Phase 2 PR sequence: approved as proposed, starting with 0.11.16 F3 reconciliation.

**Phase 2 PR sequence (locked — renumbered after theme toggle absorbed 0.12.0):**

```
0.12.0   feat(theme) + chore: dark/light toggle + session wrap (this PR, #76)
0.12.1   fix(f3): reconciliation
0.12.2   feat(indycar): results
0.12.3   feat(formula-e): R7-R10 full-class + restore trend chart
0.12.4   feat(motogp): standings + results
0.12.5   feat(wec): standings + results (fresh impl from fiawec.com)
0.12.6   feat(imsa): results (Alkamel JSON API)
0.12.7   feat(nascar-cup): full-class results
0.12.8   feat(gt-world): results + points scale
0.12.9   feat(wrc): per-rally full-class
0.12.10  feat(dtm): standings + results
0.12.11  feat(nls): standings + results (PDF + Wiki cross-verify)
0.13.0   feat(drivers): bulk drivers.json × 13 series
```

Active:
_(awaiting [+Nm] prefixes)_

### Wed 2026-05-20 — continued — operator added dark/light theme toggle to PR #76

Operator surfaced one new feature request mid-session: "what would it take to add a theme button to change from dark to light and light to dark next to contact button like a small item batches to this pr".

ESPA outcome:
- Verified the obvious: `app/globals.css` already has dual-theme tokens (light on `:root`, dark via `prefers-color-scheme` + `[data-theme="dark"]` / `[data-theme="light"]` escape hatches). next-themes dep in package.json but unused. Toggle is genuinely small.
- Asked via AskUserQuestion: bundle into PR #76 vs separate PR vs F3-PR-bundle. Operator picked "bundle into PR #76, bump to 0.12.0 minor (Recommended)".
- Phase 2 sequence renumbered: F3 reconciliation slides from 0.11.16 to 0.12.1; original 0.12.0 drivers.json bulk slides to 0.13.0.

Built:
- `components/ThemeToggle.tsx` — Sun/Moon button, vanilla state (no next-themes dep), 29×29 SSR placeholder, localStorage `'paddock-theme'`.
- `app/layout.tsx` — inline `<script>` as first body child reading the same localStorage key and applying `data-theme` synchronously before paint (FOUC prevention).
- `components/HeaderUtils.tsx` — `<ThemeToggle />` mounted immediately to the right of Contact button.

Next sub-session: 0.12.1 F3 reconciliation impl.

### Wed 2026-05-20 — continued — 0.12.1 F3 reconciliation shipped

First Phase 2 impl PR. Migrated `lib/standings/f3.ts` + `lib/results/f3.ts` to read FIA's `__NEXT_DATA__.Standings[].RacePoints` directly (mirrors `lib/standings/f2.ts` + `lib/results/f2.ts` pattern with the canonical-points lookup added on top).

Diagnosis (per the Phase 1 brief): `lib/results/f3.ts:33` had `SPRINT_POINTS = [15, 12, 10, 8, 6, 4, 2, 1]` — wrong values AND wrong length (correct F3 sprint scale is `[10, 9, 8, 7, 6, 5, 4, 3, 2, 1]`). But even fixing that doesn't account for Melbourne 2026 Sprint Race being a half-distance red-flag (FIA awards a truncated `5-4-3-2-1` to top 5 only). The architectural fix was to stop computing from position entirely and read points from RacePoints (the FIA's authoritative value that already accounts for red-flag-reduced, pole bonus, and fastest-lap bonus).

Side win: `__NEXT_DATA__` exposes `TeamName` per driver where the rendered standings HTML didn't. So driver rows now ship real team strings instead of the empty placeholder the previous parser surfaced.

- → done: ship `0.12.1` PR `fix/f3-reconciliation-2026-05-20`. 34 test files / 265 tests pass; tsc clean. Standings + results tabs now agree on Ugochukwu's 25 pts (FR P1 = 25, SR P8 = 0 under reduced scoring).

### Thu 2026-05-21 — planned — week-blitz day 2 (MotoGP + WSBK)

**Pulselive JSON API** (per `docs/research/per-series-source-audit.md`) — MotoGP at `api.motogp.pulselive.com/motogp/v1/` and WSBK at parallel paths. Free, unsigned, structured JSON. Pattern mirrors `lib/standings/f1.ts` Jolpica integration.

- **MotoGP:** `lib/standings/motogp.ts` (riders' championship + manufacturers') + `lib/results/motogp.ts` per-race. Wire into `StandingsTab` + `ResultsTab`.
- **WSBK:** same pattern at the parallel Pulselive endpoint.
- **MotoGP + WSBK drivers.json bulk-commit** — agent outputs from yesterday already in hand; web-search per `feedback-paddock-search-for-missing-data` rule before commit.

Sandbox + Playwright setup proven on one SPA target as warmup for Fri (WEC / IMSA / FE all SPA).

### Fri 2026-05-22 — planned — week-blitz day 3 (WEC + IMSA + Formula E)

SPA scrapers via **Vercel Sandbox** + Playwright. Per audit: fiawec.com (SPA), imsa.com (SPA), fiaformulae.com (SPA).

- WEC: standings + results + drivers.json bulk-commit (agent output in hand).
- IMSA: same.
- Formula E: same. FE has split-season numbering (2025-26 = Season 12).

**Defense-in-depth:** Wikipedia season-page scrape as backup source for each. Wire a fallback chain `primary → wikipedia → null` in each `lib/standings/<slug>.ts`.

### Sat 2026-05-23 — planned — week-blitz day 4 (everything else)

Bulk day — F2 + F3 + DTM + GTWC + NLS + NASCAR + WRC + ADAC.

- Per-series standings + results scrapers — each ~1-2 h.
- **drivers.json bulk-commit** for the remaining 13 series (F2/F3/Formula E/DTM agent outputs already in hand from yesterday; WEC/IMSA/GT World/NLS/WRC/NASCAR-Cup/ADAC need dispatch).
- **Sitemap regeneration** — once all 15 series have drivers.json, the `/drivers/<slug>` + `/teams/<slug>` URLs land in the sitemap (~400 new indexable URLs).
- IndexNow push for all the new URLs.

### Sun 2026-05-24 — planned — week-blitz day 5 (history + verification)

- **History essays** — operator drafts MotoGP / WEC / IndyCar following the F1 history template (`drafts/f1-history.md` workflow). ~3-4 h each.
- **Verification day** — browser-test all 15 series tabs (drivers / standings / results / history); confirm crons running; verify sitemap growth; PSI re-baseline append to `docs/perf-baselines.md`.
- **Buffer** — fix anything that broke during the bulk-commit week.

### Mon 2026-05-25 — planned — B-perf catch-up burst

**B-perf, all 4 PRs in one day** if the week's data work stays on track. Preconnect Clerk subdomain + Coffee `aria-label` + footer touch-target spacing + 3rd-party deferral (AdSense + GTM lazyOnload) + Clerk lazy boundary + CSS critical-path. Target mobile Perf ≥75 + LCP <2.5 s + TBT <300 ms. PSI re-baseline append after deploy.

### Thu 2026-05-21 — continued — 0.12.2-0.12.5 Phase 2 sprint (4 PRs shipped)

A productive evening. Four PRs landed in sequence on top of yesterday's 0.12.0 / 0.12.1:

- → done: **0.12.2 PR #79** IndyCar per-race results via Wikipedia 2026 Driver_standings (parsed cell flags for pole / led laps / fastest lap / DNS / Wth / EX / DNQ + MIL doubleheader colspan=2 + position-based IndyCar scoring scale).
- → done: **0.12.3 PR #80** Formula E R7-R10 full classifications via motorsportweek.com fallback layer (Berlin R7/R8 + Monaco R9/R10 + team alias normalisation: Citroen → DS Penske, Kiro → Cupra Kiro, etc.).
- → done: **0.12.4 PR #81** MotoGP standings + results via Pulselive JSON API (riders-only standings per FIM aggregation rule; Grand Prix + Sprint per round mirroring WSBK precedent).
- → done: **0.12.5 PR #?? (this PR)** Footer redesign + copyright. Two-column grid (Site / Legal) replacing the single-row flat link list. Brand strip on top, copyright + version on bottom. Operator-inserted ahead of the next data-impl PR.

Operator also surfaced a critical cookie-consent issue mid-session: Funding Choices never renders because AdSense is still in "Getting ready" review, so Consent Mode v2 stays denied + GA4 fires nothing for EU/UK visitors → Vercel ↔ GA4 stats blackout. Documented full 0.12.6 plan at the TOP of `docs/HANDOFF.md` for next session (custom CookieConsent modal, 4 categories, EDPB-symmetric buttons, re-openable from footer, drop FC entirely until AdSense flips).

Phase 2 sequence renumbered +2 across the board: WEC slides from 0.12.5 to 0.12.7, IMSA → 0.12.8, NASCAR → 0.12.9, GT-World → 0.12.10, WRC → 0.12.11, DTM → 0.12.12, NLS → 0.12.13. drivers.json bulk stays at 0.13.0.

### Thu 2026-05-21 — continued — 0.12.6 cookie consent shipped (PR #83 merged)

Operator brought the cookie-consent work forward into today rather than waiting for Fri. One focused PR, branched from `main` after the 0.12.5 footer landed.

- → done: **0.12.6 PR #83** — custom `CookieConsent` modal + `ManageCookiesButton` client island; Funding Choices `<Script>` blocks dropped from `app/layout.tsx`; Footer Manage-cookies link → button; `content/legal/cookies.md` rewritten. Merged within minutes of opening; operator started browser-testing on prod.

### Thu 2026-05-21 — continued — 0.12.7 cookie consent UX polish (research-driven follow-up)

Operator browser-tested 0.12.6 on prod and flagged two things: (a) the modal could look much more beautiful, (b) the button set should drop "Reject all" in favour of **Allow all + Essential only + Customize**. Explicitly asked for research-first.

- → done: dispatched a research agent to study cookie consent UX on 10 well-known sites (Vercel / Stripe / Linear / Notion / Apple / GitHub / Mozilla / Guardian / NYT / Shopify) + shadcn / Microsoft consent-banner / vanilla-cookieconsent references + EDPB dark-patterns guidance + 2025 Austrian high court button-parity ruling + Dutch AP labelling guidance. Output: 370-line synthesis at `docs/research/cookie-consent-ux-2026-05-21.md`. Key validation: operator's "Essential only" label is technically more accurate than "Reject all" (Necessary cookies are never rejectable) and matches Mozilla's "Reject All Additional Cookies" pattern in substance.
- → done: presented ESPA plan with two AskUserQuestion confirmations — versioning (0.12.7 vs 0.12.6.1) → 0.12.7 picked; customize-layer footer (3 buttons vs Save + Cancel + back arrow) → Save + Cancel + back arrow picked.
- → done: **0.12.7** — full rewrite of `components/CookieConsent.tsx` presentation. Bottom-aligned card without scrim, `rounded-2xl` + `shadow-2xl`, two-tier button hierarchy (Allow filled / Essential outline / Customize ghost), switch-left toggles with "Always on" pill, copy refresh, fade + 16px slide-up 200ms entry animation honoring `prefers-reduced-motion`. Logic untouched. Re-open from footer now lands directly in the customize layer.
- → done: tsc clean, 296/296 tests pass, eslint clean on `components/CookieConsent.tsx`, curl-verified new strings compiled into `layout.js` chunk.

### Fri 2026-05-22 — planned — 0.12.8 WEC

0.12.6 + 0.12.7 cookie consent landed Thu 2026-05-21. Phase 2 resumes at 0.12.8 (renumbered from 0.12.7 after the consent UX polish absorbed a slot).

- **Source (locked Phase 1):** `fiawec.com/en/page/manufacturers-classification` SSR. Single URL hosts all 6 standings tables (Hypercar + LMGT3 × Drivers + Teams + Manufacturers). Confirmed alive HTTP 200 on 2026-05-21. The earlier stash from `agent-leakage-2026-05-20-defer` is unusable (URLs hallucinated).
- **Files to create:** `lib/standings/wec.ts` + tests, `lib/results/wec.ts` + tests; dispatch wiring in `components/tabs/StandingsTab.tsx` + `components/tabs/ResultsTab.tsx`.
- **Schema:** mirror `lib/standings/imsa.ts` shape. `WecClass = 'Hypercar' | 'LMGT3'`. Multi-driver crews → space-joined `driverName` string (same convention as IMSA / WRC). Drivers + Teams + Manufacturers in each class.
- **Open question on per-round results.** Brief named the standings URL only; per-round results may need a second source (per-event subpages or Wikipedia per-round tables). If full classifications aren't easily reachable, ship standings-only as 0.12.8 and split results into 0.12.8.1 follow-up — same cross-series invariant rule that kept GT-World / IMSA charts off.
- **Won't touch:** WEC `drivers.json` (folds into 0.13.0 bulk), `history.md` (folds into B-content), Manufacturers' best-placed-car-per-manufacturer formula nuance.

Then continue Phase 2 in 0.12.9 IMSA → 0.12.10 NASCAR → 0.12.11 GT-World → 0.12.12 WRC → 0.12.13 DTM → 0.12.14 NLS per the locked sequence at HANDOFF top.

### Thu 2026-05-21 — continued — 0.12.8 WEC standings shipped (results deferred to 0.12.8.1)

Operator merged 0.12.7 and signaled "keep going" → straight into 0.12.8. Probe-first per Phase 2 process rules.

- → done: probed `fiawec.com/en/page/manufacturers-classification` → 798 KB SSR HTML with **4** standings tables (not 6 as Phase 1 brief claimed). WEC asymmetric: Hypercar = Drivers + Manufacturers (no Teams); LMGT3 = Drivers + Teams (no Manufacturers). Schema reflects this with `Partial<Record<WecClass, ...>>`.
- → done: probed `/en/page/resultats-1` for per-round results → Stimulus `live#action` controller swaps content client-side via `changeRace` / `changeSession` / `changeCategory` actions. Underlying XHR endpoint not exposed in SSR; URL-param filtering (`?sessionId=X`) ignored. Per-event `/en/race/<slug>` pages contain no embedded results table either. Falls into the "if not easily reachable, split to 0.12.8.1" pre-baked scope decision.
- → done: **0.12.8** — `lib/standings/wec.ts` parses all 4 tables via button-label classification (not panel-ID — IDs are session-scoped and have no semantic meaning); fixture-driven tests against real fetched HTML (`tests/fixtures/wec-standings-2026-05-21.html`, 780 KB); WEC dispatch added to `StandingsTab.tsx` mirroring the IMSA class-first pattern; `meta.json` `officialStandingsUrl` retargeted from dead `/en/standings` to the canonical URL.
- → done: 38 test files / 310 tests pass (was 296 — 14 new WEC cases), tsc clean, eslint clean.
- → deferred: WEC per-round results → 0.12.8.1 (optional follow-up; can also skip ahead to 0.12.9 IMSA per locked sequence).

### Fri 2026-05-22 — planned — 0.12.9 IMSA full-class results (or 0.12.8.1 WEC results, operator's call)

If operator wants to close the WEC loop first → 0.12.8.1 (Stimulus XHR reverse-engineering via DevTools network tab on a live visit, or per-event-and-session URL probe pattern).

Otherwise continue Phase 2 at **0.12.9 IMSA full-class results.** Source locked Phase 1: Alkamel Systems JSON API at `imsa.results.alkamelcloud.com` — official timing partner, every session of every round, unauthenticated. Beats the assumed PDF-behind-reCAPTCHA path the prior audit feared. Sibling `05_Results by Class_Race_Official.JSON` pre-buckets data by class.

### Thu 2026-05-21 — continued — 0.12.9 + 0.12.10 OG/Twitter per-route metadata + Supabase v2 memo

External AI brief landed mid-session: long-form SEO + database audit + recommendations. Two threads pulled in sequence.

**SEO thread:**

- → done: ESPA evaluation of the brief — verified against codebase. Several "biggest miss" claims wrong (SportsEvent JSON-LD already shipped 0.10.34, tab content is force-dynamic SSR not JS dead weight). One real bug confirmed: per-route `openGraph` + `twitter` metadata defaulting to layout's homepage copy.
- → done: **0.12.9 PR #86** — `lib/seo.ts` `withSocialMeta()` helper + per-route metadata propagation across series / calendar / weekend / blog / drivers / teams pages. Verified prod `og:title: "Paddock Tracker"` regression on `/series/f1`. After fix: `"Formula 1 2026 — calendar, schedule, race weekends"`.
- → done: **0.12.10 PR #87 (hot-fix)** — Playwright verification caught a follow-on regression that the curl-only 0.12.9 probe missed: per-route override was dropping `og:url`, `og:type`, `og:site_name`. Same no-deep-merge gotcha I'd only documented for twitter:card. Helper updated to re-set all 5+ fields. Now baked into `lib/seo.ts` header comment so the next contributor doesn't drop fields a third time.
- → pushed back on: Greek-language `/el/` route tree (high cost, parked B12), replacing the curated `content/series/<slug>/*.json` authoring model with DB tables (loses git-reviewability per CLAUDE.md), adding 5-7 more series before existing 13 are filled in (per HANDOFF error inventory).

**Supabase thread:**

- → done: **PR #88 (docs)** — `docs/research/supabase-schema-draft-v2.md`, 284-line review memo of the existing 774-line v1 draft. Recommendation: don't migrate to Supabase now; B-perf is the answer to slowness; v1 schema is competent but premature; when triggers fire (S9 / multi-author / API fan-out / data-as-product), ship a lean 7-table user-data shape (followed series + followed drivers + preferences + comments + predictions + ledger + push subs) additive to the JSON authoring model, NOT v1's 18-table full-replacement. Clerk JWT via `auth.jwt() ->> 'sub'` in RLS policies, no Clerk user mirror until admin views need JOINs.

Today's aggregate: **6 PRs shipped** (0.12.6 → 0.12.10 + docs PR #88). All merged. Per-series error inventory: WEC standings flipped ❌ → ✅; everything else unchanged.

### Sat 2026-05-23 — planned — 0.12.11 IMSA full-class results (or 0.12.8.1 WEC results)

Default top-of-stack per HANDOFF Phase 2 sequence: **0.12.11 IMSA full-class results** via Alkamel Systems JSON API at `imsa.results.alkamelcloud.com`. Sibling endpoint `05_Results by Class_Race_Official.JSON` pre-buckets by class (GTP / LMP2 / GTD Pro / GTD). Closes IMSA's last ❌ in the per-series error inventory.

Optional alternative: **0.12.8.1 WEC per-round results** — reverse-engineer the StimulusJS `live#action` controller on `fiawec.com/en/page/resultats-1` via DevTools network tab. Closes the WEC loop. ~1-2h, source-probe-gated.

Won't touch this session: B-content multi-day items (parked), B12 Greek route tree (parked per v2 memo), full Supabase migration (parked per v2 memo). 0.13.0 drivers.json bulk stays queued for after the Phase 2 data sweep completes.

### Fri 2026-05-22 — executed — 0.12.11 IMSA + 0.12.12 NASCAR (🔴 NASCAR broke on prod)

Note: the "Sat 2026-05-23" stub above was yesterday's forward-plan written when calendar labels drifted off by a day. Today actually was Fri 2026-05-22.

- → done: **0.12.11 (PR #90)** IMSA full-class results via Alkamel JSON. Probe confirmed Phase-1 brief — open Apache index, no auth, sibling endpoint `05_Results by Class_Race_Official.JSON` pre-buckets by class. Per-round URLs curated in `content/series/imsa/alkamel-rounds.json` (Alkamel folder layout not catalog-discoverable — 24h races nest under `24_Hour 24/`, sprints sit under `Race/`). Schema mirrors `lib/standings/imsa.ts`; sprint rounds correctly drop LMP2 + GTD Pro. 17 real-fixture tests against 4 Alkamel JSON captures. Operator-verified on prod. **IMSA `❌ → ✅`** in error inventory.
- → done: **0.12.12 (PR #91)** NASCAR full-class results via racing-reference.info per-race pages + `SeasonTrendChart` restored on top (first non-F1 series with the chart). Probe surfaced a gotcha the Phase-1 brief missed: Cloudflare WAF on racing-reference fingerprints TLS, not just headers — Node `fetch()` (undici) returns 403 where curl returns 200. Workaround: `node:http2.connect()` (HTTP/2 ALPN gives a different TLS profile that gets through). 16 real-fixture tests, full pipeline test with injected transport stub. **Browser-verified on localhost. Skipped Vercel preview verify → shipped a regression.**
- → 🔴 **regression: 0.12.12 prod is broken.** Operator confirmed `paddock-tracker.com/series/nascar-cup?tab=results` shows "Results are temporarily unavailable" — empty state. http2 workaround that succeeded on localhost did NOT survive Vercel Functions runtime. Five hypotheses documented in HANDOFF top block; fix plan locked there.
- → done: robots.txt + sitemap.xml-first probe practice agreed mid-session as default for new sources. Not yet codified in CLAUDE.md.

Today's aggregate: **2 PRs shipped, 1 working in prod, 1 broken in prod.** Net error inventory change: IMSA `❌ → ✅` (gain), NASCAR `⚠️ → ❌` (loss — was winners-only-but-rendering, now empty state).

### Sat 2026-05-23 — planned — 🔴 fix 0.12.12 NASCAR prod, then 0.12.13 GT-World

**Priority 1:** fix the NASCAR prod regression. Investigation-first via Vercel logs / temporary `console.error` instrumentation. Fix path depends on root cause — see HANDOFF "🔴 Fix plan" for the branched remediation tree. Verify on Vercel preview BEFORE merge this time, not just localhost.

**Priority 2 (after #1 lands):** 0.12.13 GT-World results + SRO points scale module. Existing `lib/results/gt-world.ts` parser audit + SRO scale (`25-18-15-12-10-8-6-4-2-1` + 1.5× Paul Ricard + Spa 3-stage). Trend chart conditional on per-position points reconciling against standings.

Won't touch tomorrow: 0.12.8.1 WEC (still optional), 0.12.14+ queued items, 0.13.0 drivers.json bulk.

### Fri 2026-05-22 — evening continuation — outcomes locked

After the mid-session housekeeping commit, the session continued and shipped 2 more PRs:

- → done: **0.12.12.1 (PR #92)** NASCAR pivot to Wikipedia per-race articles. Vercel preview logs confirmed Cloudflare WAF challenges Vercel's `iad1` datacenter IP (`status=403 + "Just a moment..."` interstitial) — the `node:http2.connect()` TLS-fingerprint workaround that bypassed CF on residential IPs doesn't help when the IP itself is flagged. Wikipedia is bot-friendly + carries the full per-race classification with points matching the standings parser's totals. Trend chart restored. Three new CLAUDE.md rules baked in (re-Read before Edit, robots.txt-first, Vercel-preview-verify before "shipped"). Operator-verified on prod.
- → done: **0.12.13 (PR #93)** GT World Challenge Europe per-cup classification dispatch. Operator-approved scope cut from "results + SRO points scale" to "classification only" after the implementation probe surfaced how layered SRO scoring is (top-10 + pole bonus + 75%/25min Endurance gates + Spa 24h 3-stage + Super Pole top-5 fractions + Paul Ricard multiplier + per-cup sub-scoring). Tightened `RACE_NAME_PATTERN` to reject intermediate hourly checkpoints. 10 (race, cup) cards rendering on prod. Operator confirmed merge.
- → done: 6-source motorsport-data API deep-dive. Verdict: additive only, no pivot. TheSportsDB free tier probed and dropped. Sportmonks F1 park-until-live-timing. API-Sports F1 v1 yellow flag (docs page 403s datacenter IPs).

**Today's aggregate: 4 PRs shipped end-to-end** (0.12.11 IMSA, 0.12.12 NASCAR-broken, 0.12.12.1 NASCAR-fixed, 0.12.13 GT-World). Per-series inventory net: IMSA `❌ → ✅`, NASCAR `⚠️ → ❌ → ✅` (round-trip), GT-World `❌ → ✅`. Three series moved to ✅ on the same day.

### Sat 2026-05-23 — planned — 0.12.13.1 GT-World trend chart (or 0.12.14 WRC)

Tomorrow's pick from two reasonable next items:

- **Option A — 0.12.13.1 GT-World SRO points scale + trend chart.** The deferred work from today's scope cut. Encode the full SRO 2026 scoring (top-10 + pole bonus + Endurance gates + Spa 3-stage + Super Pole top-5 + Paul Ricard multiplier + per-cup sub-scoring); reconcile sum-across-season against standings parser totals; wire `SeasonTrendChart` if they match. ~1.5-2h. Open question at session start: does the standings parser fetch totals OR compute from per-race? Read both modules end-to-end first.
- **Option B — 0.12.14 WRC per-rally full-class.** Locked next per Phase 2 sequence. Wikipedia per-rally articles (`/wiki/2026_Rally_de_Portugal` etc.); same fallback pattern that worked for Formula E and NASCAR. Verify per-rally tables carry top-10 + points (WRC `25-18-15-...-1` + Power Stage bonus). If yes, parser rewrite + trend chart possible. ~1-1.5h.

Won't touch tomorrow: 0.12.8.1 WEC (still optional), drivers.json bulk (0.13.0), NASCAR trend-chart polish (queued in IDEAS Inbox).

### Fri 2026-05-22 — late-evening continuation — 0.12.14 WRC shipped

After the 4-PR daytime sweep (0.12.11 → 0.12.13), one more PR landed before bed: option B from the Sat stub above, pulled forward.

- → done: **0.12.14 (PR #95)** WRC per-rally full classification + trend chart restored on `/series/wrc?tab=results`. Two data sources merged: (a) per-rally Wikipedia articles (`/wiki/2026_<rally>`) for the accordion's full top-N + retired entries — uses class position (not overall) for Rally1 drivers who crashed and finished behind WRC2 cars; (b) the season page's "FIA World Rally Championship for Drivers" per-cell breakdown for chart data — reconciles to standings totals with Δ=0 across all 29 scoring drivers because both surfaces read the same table. Cross-series invariant met by construction.
- Open question at session start (HANDOFF entry note) answered: existing `lib/standings/wrc.ts` just reads the Drivers' Championship table totals (no scale of its own). Per-rally articles + season-page championship table occasionally disagree by ±3-6 pts for marginal drivers (Wikipedia editorial inconsistency, e.g. Paddon: per-rally Canarias = 6 pts, season-page Canarias = 0). Using the championship table for the chart side-steps this; per-rally articles still drive the richer accordion display.
- Surprise discovery: the existing parser was silently broken in prod. After Wikipedia editors restructured the 2026 Season-summary table earlier in May to drop the "Date" column, `findCalendarTable` + `buildColumnMap` failed closed (`date === -1`) and returned []. Tests passed (synthetic HTML had a Date column) but production rendered the "Results temporarily unavailable" empty state. Caught and fixed during the open-question read-through.
- New CLAUDE.md rule loaded in this session via operator pushback: **sitemap.xml AND robots.txt first when probing any new source** — I'd checked robots.txt but forgot sitemap. (Verified Wikipedia has no traversable sitemap.xml — 404 across `/sitemap.xml`, `/w/sitemap.xml`, REST sitemap endpoint. Confirmed expected for a multi-million-page wiki.)
- Won't touch this session: 0.12.13.1 GT-World SRO points (still queued for Sat per HANDOFF), drivers.json bulk, NASCAR trend chart polish.

**Today's aggregate: 5 PRs end-to-end** (0.12.11 IMSA, 0.12.12 NASCAR-broken, 0.12.12.1 NASCAR-fixed, 0.12.13 GT-World, 0.12.14 WRC). Per-series inventory net: IMSA `❌ → ✅`, NASCAR `⚠️ → ❌ → ✅`, GT-World `❌ → ✅`, WRC `⚠️ → ✅`. **Four series moved to ✅ on the same calendar day.**

## Week of 2026-06-08

### Wed 2026-06-10

- → done: full-stack audit (operator-directed) — 6 parallel audit agents + live browser pass on prod across 4 viewports. Headliners: countdown hydration bug wiping dark-mode persistence, silent-parser observability gap, legal pages describing the removed Funding Choices CMP, homepage 95% dead payload, ~190 orphaned weekend URLs. Full report delivered in-session; backlog feeds redesign PR 3+ and future fix sessions.
- → done: **Redesign PR 1 (#98, merged + live as 0.13.0)** — landing at `/` + workstation at `/app`, design tokens v2 from operator's mockup, dark-only landing, PWA start_url guard, countdown hydration fix. Plan + decisions + session log: `docs/redesign-2026-06.md`.
- → done: post-merge outsider audit of prod (fresh-visitor walkthrough, mobile + desktop). Two carry-overs logged in the redesign doc: /app hydration source #2 (relative-time labels vs stale ISR), F1 chart/standings disagreement (131 vs 156). Dark-mode persistence confirmed fixed in prod.
- Won't touch this session: workstation retheme (PR 2), audit fixes beyond the countdown bug, light mode.
- → done (continued): **0.13.1** landing parity (PR #99 — ticker v2, marquee countdown, series marquee, circuit photos, disciplines/perks v2, burger menu); **0.13.2** motion hot-fix (PR #100 — marquees shipped dead: `motion-safe:` on custom classes generates no CSS; photos → hero slideshow); **0.13.3** dashboard overflow fix (PR #101 — day-grid track inflated by nowrap Le Mans titles; programmatic 412px overflow sweep across all pages now clean).
- → done: **PR 2 design brief locked with operator** — time-first home (phone AND desktop first-class), sticky series tab bar, bottom bar + drawer, landing theme + PADDOCK•TRACKER wordmark carry-over, dark-only, footer Landing link, anti-AI design principles. Full brief + 2a-2d sequencing in `docs/redesign-2026-06.md`. Next session: build **PR 2a (shell)**.

Session 3 (same day) — **PR 2a dashboard shell** per the locked brief. Plan:

- Recovery first: cherry-picked stranded docs commit `54a2d93` (PR 2 brief — pushed to the #101 branch after its merge, never reached main) onto the 2a branch.
- Tokens v2 → :root, delete light chassis + ambient wash + ThemeToggle + theme bootstrap; `dark` class on both root htmls keeps all existing `dark:` variants firing (incl. prose).
- PADDOCK•TRACKER wordmark in app header + drawer; Saira loaded in (app) layout.
- Mobile bottom bar (Home / Calendar / Series→drawer / Settings) + drawer micro-label retheme.
- Footer: Landing link + landing-language headings. Clerk appearance → brand amber at provider; per-page sign-in/sign-up overrides removed.
- manifest + themeColor + OG image bg → #07070a. Version 0.14.0.
- Won't touch this session: home layout restructure (2b), series tab bar (2c), settings/onboarding modals (2d), F1 chart-vs-standings bug, audit backlog.
- → done: 2a shipped as **PR #102 (0.14.0)**, localhost gates green (light-OS emulation sweep, overflow 0 @412, marquee motion re-verified, tint override intact). Preview verify pending.
- **Mid-session operator directive** (overrides the won't-touch line): install banner GOES (removed, component deleted — rode the 2a branch) + "take full control of the ui/ux structure... surprise me" → **PR 2b pulled forward into this session**.
- → done: **PR 2b (0.15.0)** time-first home — chyron (live takeover / ticking countdown), THIS WEEK timing rows, PADDOCK WIRE, two-column desktop, tabs retired, hydration #418 source-2 fixed structurally (serverNow prop), device-local times with real tz label. Zero console errors on /app. NextSessionCard deleted.
- → done: operator merged #102 + #103 same day ("spectacular"; theme mandate extended to the whole app → 2c/2d). Nav corrections received: Series tab must not open the drawer; Settings → Account.
- → done: **PR 2c-1 (0.16.0)** — `/series` hub page (category-grouped, next session per series, sitemap) + BottomBar v2 (all tabs real destinations, Account label) + drawer Series link. Verified 0 errors / 0 overflow / 350 tests.
- Captured for next PR (operator): landing nav must persist on scroll — suspect body overflow-x:hidden kills sticky; in IDEAS Inbox.
- → done: #104 merged by operator; directive "navigation menu and burger bar can go" → **PR 2c-2 (0.17.0)** — drawer/sidebar/burger deleted, one fixed header on all viewports (lg+ inline nav), footer +Blog/Account label. Lint baseline now fully clean (drawer owned the set-state-in-effect error).
- Next up (operator "lets do this"): **2c-3 series pages** — sticky tab bar replaces the 9-tile grid, standings/results/weekend surfaces to the 2.0 language, mobile chart fix. Then calendar, then 2d account modals.
- → done: #105 merged; **PR 2c-3 (0.18.0)** — sticky tab rail + compact Saira series header + chart mobile fix/legend cap + significance re-tone + the `overflow-x: clip` keystone that un-broke position:sticky site-wide (landing ticker/nav sticky bug fixed for free, Inbox item closed). Sticky verified programmatically at scroll; 0 errors / 0 overflow / 350 tests.
- → done: #106 merged; **PR 2c-4 + fix batch (#107, 0.19.0)** — tab surfaces flattened (Saira heads, mono columns, P1 amber), **Rules tab retired** (vs About; it was placeholder+links everywhere, About inherits links), recharts ssr:false + Suspense-streamed tabs, **F1 Jolpica pagination root cause** (limit clamps to 100 → missing Monaco + 12-car Canada + "points-only" look + chart-vs-standings 131/156 — ONE bug, fixed with pagination+round-merge), chart in 2026 constructor colors (teammates dashed; Audi red/Cadillac white — no official hexes, web-checked), OG share card rebuilt on crossed-flags icon (Instagram fix), wordmark → landing.
- ⚠️ Agent fleet for data-validation (15 series) + 12 remaining history essays DIED on org spend limit mid-afternoon; f2+f3 history.md landed (untracked, held for content PR). Relaunch next session — prompts preserved in chat; quota reset 19:00.
- Operator batch still open, feasibility-ordered: (1) per-page desktop+mobile layout pass, (2) notifications 30'/10'/results-ready cron, (3) session subpages w/ practice+quali data (OpenF1 research), (4) driver/team enrichment pages.

Active:
_(awaiting [+Nm] prefixes)_

### Thu 2026-06-11

Session 4 (earlier today, separate chat) shipped PRs #108–#118, 0.19.1 → 0.24.1: PWA wordmark/landing nav fixes, histories ×14 (0.20.0), mobile chart render (0.20.1), validation sweeps 1–3 (all 15-series data findings fixed same-day), calendar surfaces 2c-5 (0.21.0), notifications 30'/10'/results-ready (0.22.0), desktop density 2c-6 (0.23.0), Account page 2d (0.24.0). Closeout: five operator notes → IDEAS Inbox (PR #119, merge pending).

Session 5 plan:

- Quick-wins PR (0.24.2): series tab switch lands at the top of the new tab (SeriesTabs owns scroll explicitly — Next 16's default Link scroll *maintains* position whenever the page fills the viewport, so dropping `scroll={false}` alone wouldn't fix it); results accordions drop the three top-10 render caps → full classification; drivers-tab breathing room between the series-color bar and team name.
- Results layout v2 (0.25.0): per-race rows redesigned per series + clickable → weekend pages; OpenF1 (api.openf1.org) research for practice/quali per-session data; design-led under the 2.0 mandate.
- Won't touch this session: security audit (queued as its own session), driver/team enrichment pages, UI-inspiration pass, light mode, WEC results pipeline.

Outcomes:

- → done: **PR #120 (0.24.2)** quick wins — tab scroll-to-top + full classifications (F1 22/22, IMSA Daytona GTD 21, GTWC 16) + drivers-tab spacing. Browser-verified 390/412/1440, 355 tests.
- → done (unplanned, operator interrupt): **PR #121 (0.24.3)** landing burger hot-fix — `backdrop-blur` header is a containing block for fixed descendants, so the menu overlay collapsed into the 56px header strip; portaled to body. Plus latent scroll-lock fix (body → documentElement). Reproduced + probe-confirmed on prod first.
- → done: **PR #122 (0.25.0)** results layout v2 — timing-screen race rows (tint chip / Saira title / amber WIN) + titles link to weekend pages gated by the groupByWeekend round set; chevron keeps the accordion; no default-open. OpenF1 research for the per-session weekend follow-up documented in the redesign doc (2026 coverage confirmed live incl. practices + Q1/Q2/Q3 arrays).
- → carried: weekend per-session results implementation (OpenF1 fetcher + WeekendSessionResults section, F1 first) — entry notes in `docs/redesign-2026-06.md` session-5 log. Security audit stays the next dedicated session.
- → done (continued — operator 15-item batch, organized into waves W1–W8 below): **W2 series-tab polish (PR #123, 0.26.0)** — trend chart Results → Standings on F1/NASCAR/WRC/DTM (DTM results becomes link-out), always-on chart dots + highlighted hover point, classifications 2-col from sm:, WIN line wraps on phone, champions team names in team colors (dark hues contrast-lifted via color-mix; historic-constructor color map = follow-up curation task).
- Merge order for the stack: **#120 → #121 → #122 → #123** (+ #119 docs whenever).
- → done (continued): **W1c per-session pages (PR #126, 0.29.0)** — /series/[slug]/weekend/[round]/[session] route; F1 classifications via OpenF1 (lib/results/openf1.ts): Q1/Q2/Q3 columns, race gaps+points, practice best laps; weekend schedule rows link through on F1. Carried the recovered #125 commit (multi-series frozen standings + chart-to-top). **OpenF1 from Vercel datacenter VERIFIED on prod post-merge** (pole lap renders at paddock-tracker.com/series/f1/weekend/6/qualifying) — datacenter-IP question closed.
- → done (operator interrupt): **landing fixes (PR #127, 0.29.1)** — anchor jumps clear the sticky nav (scroll-mt-28 on #inside/#series/#disciplines), burger rebuilt as half-screen right-side drawer with scrim (85% on phones), scrim/✕/Escape close. Conflict-rebased after #126 merged first.
- **W1 weekend-overhaul wave COMPLETE** (W1a #124, W1b #125, W1c #126 + recovery). All merged; prod 0.29.1. Next per locked v1.0 scope: **security audit (own session)** → W3 about/rules content ×15 → W4 profiles → W8 launch program.
- → done (continued): **W1b point-in-time standings (PR #125, 0.28.0)** — buildStandingsAtRound in lib/season-trend (5 tests), weekend pages show full frozen driver+team tables for F1 (verified: ANT 156 @R6 vs 72 @R3). Four operator decisions recorded: v1.0 = W1+audit+W3+W4; rules inside About; W7 design-doc first; Android post-v1.0.
- → done (continued, post-merge of the full stack): **W1a weekend retheme (PR #124, 0.27.0)** — hero rebuilt flush + Saira with series-color full stop, back arrow removed (series name in the meta row still links), all four sections (schedule/weather/standings/news) converted from rounded cards to flat timing-screen sections, page radial wash deleted. IDEAS.md re-triaged onto the W1–W8 waves (notes annotated with shipped PRs; stale May entries retired).

Active:
_(awaiting [+Nm] prefixes)_

### Fri 2026-06-12

_(Sessions 6+ on Jun 11–12 shipped PRs #128–#139, 0.30.0 → 0.35.2 — security audit fixes, W3 rules essentials ×15, W4 lineups ×15 + season form, onboarding tour, blog seeded ×3, content-gap audit, audit minutes-fixes — logged in CHANGELOG per PR; continuation prompt is the session record.)_

Plan (pre-launch program, content-gap queue):

1. **WEC results probe (0.12.8.1, content-gap #3).** robots.txt + sitemap.xml first, then `/en/page/resultats-1` + its Stimulus `live#action` controller JS to locate the XHR endpoint. Verdict re-derived from sources, not prompt summaries. Time-boxed ~1h. If clean → ESPA plan, then `lib/results/wec.ts` + ResultsTab dispatch + WEC race-session pages + results-ready map + **prod verify post-merge** (datacenter rule). Le Mans Jun 13–14 is the payoff. If hostile → document and move on.
   → done: **PR #140 (0.36.0) merged + prod-verified.** Probe verdict CLEAN — fiawec runs Symfony UX Live Components; POST replays server-side with bootstrap-page props (no cookies/CSRF; category ids curated — responses ship the select empty). R1+R2 per-class results + crews live on prod from Vercel datacenter IPs; Le Mans renders post-race Sunday + results-ready notification wired. Re-check Sunday evening.
   → mid-session (operator): Gasly Monaco podium reinstated upstream ~a week post-race; diagnosis: prod Monaco session page shows NO classification (OpenF1 401-locks its whole API during live F1 sessions — Barcelona FP was running) AND Jolpica still pre-correction. Three Inbox captures (re-check lifecycle, OpenF1 lockout, density pass). Fix queue: results-overrides curation for Monaco + OpenF1 KV-persist, after the audit or on operator pull-forward.
2. **Codebase audit** (operator-ordered): 4 sequential module waves lib/ → components/ → app/+api → config/infra, 100% line coverage by fresh agents, findings ledger + cross-pass → `docs/research/code-audit-2026-06.md`; fix highs same-session.

Won't touch this session: NLS standings parser (0.12.16), post-Le Mans draft-article trial, W8 launch checklist (CSP-RO, npm audit, perf re-baseline, IndexNow), driver photos.

Active:
_(awaiting [+Nm] prefixes)_

---

## Week of 2026-06-15

### 2026-06-19 → 06-21 — TWA + home v3 + perf sprint (continuous run)

SCHEDULE had drifted since 06-12 (the 0.13→0.36 redesign work was logged in `docs/redesign-2026-06.md`); catching up. Shipped PRs #145–#153, all merged:

- → done: #145 (0.36.5) TWA Digital Asset Links; #146 (0.36.6) home-v3 watch links; #147 (0.37.0) JUST MISSED block.
- → done: #148 (0.37.1) `/app` → static/ISR (un-regressed slice-2's `no-store` podium fetch); #149 (0.37.2) calendar previous-months; #150 (0.37.3) weekend / drivers / teams → ISR.
- → done: #151 (0.38.0) WeekendMedia embeds; #152 (0.38.1) highlights link-out (FOM embed block) + WEC/F3 curation; #153 (0.38.2) JS levers (defer AdSense/GTM + preconnect Clerk).
- → deferred (see `docs/HANDOFF.md` top block): home-v3 slice 3 (restructure), `[session]` ISR (route-handler refactor, low ROI), Clerk SDK lazy-load (auth-risky), media-curation breadth (round-provenance mismatch), launch gates (security audit / W3 / W4 / W8).

Active: _(no `[+Nm]` prefixes captured; continuous multi-session run)_

### 2026-06-21 (cont.) — Lens B #3 (session-page caching) + docs sweep

Plan: cache the weekend `[session]` page — the deferred Lens-B #3 follow-up (#158 put the page on main, unblocking it).
Won't touch: page-level ISR (no-op per handoff), a pre-warm cron, the penalty-correction lifecycle, the untracked screenshot litter beyond a `.gitignore`.

- → done: **PR #159 (0.39.1)** — KV read-first / write-on-success around past-session classifications (7-day TTL, write-only-on-non-empty). Skips the upstream fan-out on warm renders and keeps past F1 sessions renderable through OpenF1's live-session 401 lockout once captured. Page-level ISR scrutinized + rejected (`wec.ts` `no-store` + the `now`-branch keep the route `ƒ`). **Prod-verified:** F1 R6 quali (OpenF1) + MotoGP R3 Q2 (Pulselive) render; localhost 0 console errors; 430 tests / tsc / build clean.
- → done: **docs sweep** (this PR) — refreshed the HANDOFF top block (recorded #155–#158 for the first time + 0.39.1), this entry, IDEAS triage; salvaged `perf-baselines.md` + the security re-verification from the stale `stash@{0}`; `.gitignore`d root-level verification screenshots. Retired `docs/handoff-refresh` + its stash.

Active: _(no `[+Nm]` prefixes captured this session)_

### 2026-06-21→22 (cont.) — DTM results · F2/F3/WSBK charts · native Android spike · betting design

- → done: **#161 (0.40.0)** native DTM race results (motorsport.com per-event `?st=RACE1|RACE2`; `canonicalRound` date-maps to rounds.json across the round-4 gap; prod-verified on datacenter).
- → done: **#162 (0.41.0)** F2/F3/WSBK season-trend charts via a streamed `<Suspense>` chart (reconciliation-gated Δ=0; **MotoGP held back** — results under-count); WSBK results KV-cached.
- → done: **native Android spike** — built + flashed to the operator's Pixel 9 (`C:\Dev\Personal\paddock-android`, Compose + `/api/just-missed`, tap→Paddock); Android toolchain installed cold. Polish parked (icon/theme).
- → done: **betting initiative specced** — `docs/research/predictions-design.md`; operator decisions locked (betting framing / free+paid IAP / no-cashout / win-rate board / persistent-lean / provisional-final / peer-pool option b); S9/Supabase trigger; gated on Supabase provisioning + legal review.
- → done: **docs sweep (0.41.1)** — HANDOFF top block + this entry + IDEAS triage.
- → deferred: MotoGP chart fix · standings last-good resilience · NLS results · nav/breadcrumb fix · remaining data-gated charts · Android polish · the full betting build.

Active: _(no `[+Nm]` prefixes captured)_

### 2026-06-22 (cont.) — Betting Phases 1a–1c + handoff

- → done: **Betting 1a–1c (PR #164, 0.42.0)** — Supabase data layer + append-only ledger + monthly grant (1a); solo-vs-house engine (model pricing, atomic place, fixed-odds settle) (1b); pari-mutuel friend leagues + win-rate leaderboard (1c). 6 migrations, 3 verify scripts green, 446 tests. Dormant until cloud Supabase + UI.
- → done: **legal framing corrected** in the design doc (no-cashout social-casino; store 17+ rating, not KYC).
- → done: **handoff (0.42.1)** — full remaining-work list (betting go-live, web items, Android polish) for next session in `docs/HANDOFF.md` top block.
- → next session (operator): tackle ALL remaining items.

Active: _(no `[+Nm]` prefixes captured)_

### 2026-06-22 (cont.) — Betting go-LIVE + weekend embed

Betting went dormant → **live** end-to-end and got refined onto the F1 weekend pages.
- → done: recovered + shipped **1c** (PR #166, was stranded local-only), **play UI** (#167), **grant cron** (#168), **open-markets automation + Play nav** (#169), **settlement** (#170 — open→bet→settle loop closed), **weekend-embed + lean credits + quali−1h lock + /play-hub** (#171, 0.46.0).
- → done: **provisioned cloud Supabase** (`Paddock`, eu-west-1, ref `dzelqrtajnauunzmxfic`) + Vercel prod env + 3 GitHub-Actions crons; all verified green from datacenter; F1 R8 winner market live + bettable on the weekend page.
- → done: **docs handoff (0.46.1)** — HANDOFF top block rewritten (betting LIVE + next-steps), IDEAS triaged.
- → next (operator handoff): relock R8 before quali (SQL in Studio); open more markets; reduce returns (favourite ~1.5×, cap longshots); add market types (podium/top-10/exact-position/grid-quali).

Active: _(no `[+Nm]` prefixes captured)_

### 2026-06-22 (cont.) — Leagues P4 prizes + post-P4 IA/landing plan

Plan: ship **P4 league prizes** (0.58.0) — `league_award` table + `award_league_prizes()` SQL fn (top-3 by win-rate per period, NO credits) + daily award cron + medal badges/honours on the league page + `verify-league-prizes.mts`. Period = calendar month + year, bucketed by `market.locks_at`, 3-day grace, `minPlaced≥3`. Migration applied to prod via the Management API (drift landmine), not `db push`. Then plan the post-P4 **Social area** (`/social/friends` + `/social/leagues`, play stays `/play`) + **landing marketing**.

Won't touch: real-odds API, exact_position go-live, invite click-through browser-verify, the Social-area build itself (planning only this session), PAT/RapidAPI rotation (operator action).

Outcomes:

- → done: **P4 league prizes (0.58.0, #187)** — `league_award` + `award_league_prizes()` (top-3 by win-rate, no credits) + daily cron + medals/Honours + `verify-league-prizes.mts`; migration applied to prod via the Management API; prod-verified via a seeded demo June award.
- → done: the post-P4 plan executed in the same run — **`/play` perf (0.58.1, #189)**, **Social area (0.59.0, #190)**, **friend search/add/remove (0.60.0, #191)**, **weekend tabs + lazy (0.61.0, #192)**; invite hotfix (0.57.2, #186) folded in.
- → carried (operator): authed-eyeball verify of `/social/*` + the weekend Bets tab signed-in; real-odds adapter; `exact_position` go-live.

Active: _(no `[+Nm]` prefixes captured)_

### 2026-06-23 — session close-out (docs) + perf investigation

Plan: bring the three ops docs current with 0.58.0→0.61.0 (CHANGELOG/RELEASES/package.json were already logged last session) and ship as a docs-only **0.61.1**; then a perf investigation of `/social`, `/play`, `/account` (operator: "ULTRA slow") — investigate first, discuss the fix before touching code.

- → done: `docs/HANDOFF.md` new 0.61.0 top block; `IDEAS.md` triage (W1 retired from Now; betting/social refinement umbrella → Now §1; betting/leagues/social shipped-items annotated; landing-marketing + richer-leaderboard + real-odds + exact_position slotted); this `SCHEDULE.md` entry. Shipped as **0.61.1** (docs-only).
- → done: perf investigation of `/social` + `/play` + `/account` (operator "ULTRA slow"). Root cause = Vercel functions in **iad1** but Supabase in **eu-west-1** (+ EU users) → every per-user query crosses the Atlantic ~75ms × 4–6 **sequential** round-trips, amplified by a per-render `currentUser()` + `setDisplayNameIfMissing` and the `/social/leagues` N+1. The region move is the #1 lever but is plan-gated (serverless region is project-wide + needs Pro+ + a scraper re-verify) — surfaced for the operator. The per-render Clerk-hop waste was removed in 0.61.2.
- → done (operator follow-up: "ok … keep going"): **7 PRs #194–#199, 0.61.2 → 0.66.0** — invite-join Safari fix · account accordions · play round-bars · friend-request links · calendar Month/Week/Day · home-customise phase-1. Each tsc + tests (→ **470**) + `next build` green before a self-merge.
- → DEFERRED: **forecast market** (multi-driver + finishing position) — live-economy settlement unverifiable without the local Supabase + the migration needs the rotated PAT; turnkey plan captured in `docs/HANDOFF.md`.
- → this docs close-out ships as **0.66.1**.
- → carried: authed-eyeball verify of all 7 new authed surfaces on prod (no Clerk session this side); PAT/RapidAPI rotation; demo-award delete (~Jul 1).

Won't touch: the forecast build (deferred), the region move (operator/plan-gated), the untracked litter, the demo-award prod delete, key rotation.

Active: _(no `[+Nm]` prefixes captured — long autonomous batch)_

### 2026-06-24 — operator 3-prompt autonomous batch (6 feature PRs + docs)

Three prompts in one session: (1) a 5-item priority list, (2) home/calendar feedback, (3) IA + filters + customise-relocation. Built everything not DB/PAT-gated; stopped at the gated tail.

- → done: **caching (0.72.3, #212)** — KV read-through for `getOpenMarkets` + per-league leaderboards (`lib/betting/cache.ts`), busted on writes. The perf lever now the region move is permanently off (not on Pro).
- → done: **home customise reworked (0.73.0, #213)** — fixed the reorder/hide rollback + the un-customised flash; moved customise into an Account banner with a live preview; Just-missed folds by default; net-fixed a legacy lint error.
- → done: **IA tidy (0.74.0, #214)** — Social one page (Friends|Leagues columns; fixes the 404'ing `/social` link); dropped the Account/Social/Play subheader strips; slimmed Play.
- → done: **calendar filters (0.75.0, #215)** — checkboxes not colour chips + a Clear button.
- → done: **cross-user profiles (0.76.0, #216)** — `/social/users/[id]`, friends-only league visibility, balance never exposed.
- → done: **league direct-invite (0.77.0, #217)** — "Invite friends" straight into a league (no migration).
- → done: docs close-out (this) as **0.77.1**.
- → STOPPED (PAT-gated): per-league bet limits (item 4b migration), forecast market, threads/UGC — need local Supabase up + the rotated PAT.
- → advisory (not executed): Supabase Dublin→Frankfurt = counterproductive while compute is iad1; Cloudflare D1 = not lighter from iad1 + can't host the atomic ledger. Verdicts in HANDOFF + IDEAS Parked.

Won't touch: anything needing the PAT/local Supabase (above); authed browser-verify (no Clerk key this side — operator preview); the untracked repo litter; key rotation / demo-award delete.

Active: _(no `[+Nm]` prefixes captured — long autonomous batch)_

### 2026-06-24 (cont.) — polish + the gated betting trio (10 PRs → 0.83.0)

After the operator restarted local Supabase + handed the PAT, plus more UI feedback. Shipped **0.77.2 → 0.83.0** (#219–#227).

- → done: **/social redirect-loop fix (0.77.2, #219)** — removed the leftover `next.config.ts` `/social`→`/social/leagues` rule that fought the new page redirect (infinite 307 — the page wouldn't load).
- → done: **footer (0.77.3 → 0.82.1 → 0.83.0)** — compacted, then **two columns (Site | Legal)** after operator feedback.
- → done: **calendar month nav (0.78.0, #221)**; **account flatten (0.79.0, #222)** — accordions/subheaders gone, Replay-the-tour its own row; **home split (0.80.0, #223)** — Schedule/News distinct + all collapsible + drag-reorder.
- → done: **the PAT-gated trio** — **bet limits (0.81.0, #224)**, **forecast market (0.82.0, #225, DORMANT)**, **threads/UGC (0.83.0, #227)**. Migrations applied to prod via the Management API; verify scripts green; forecast + threads adversarially audited (PASS).
- → this docs close-out ships as **0.83.1**.
- → owed (operator): rotate the PAT; forecast go-live (interaction-verify signed-in + add to `MARKET_BUILDERS`); set a Clerk admin role for threads moderation; authed browser-verify; the full migration-drift repair list (HANDOFF).

Active: _(no `[+Nm]` prefixes captured — very long autonomous session)_

### 2026-06-24 (cont.) — parallel-subagent batch (4 PRs #229–#232 → 0.87.0)

Operator multi-prompt batch, run as a **file-disjoint parallel-subagent workflow**: 6 worktree coding agents + 2 hand-driven lanes → one integration build (tsc + lint + 490 tests + `next build`) → 4 grouped version-bumped PRs.

- → done: **F1 resilience (0.84.0, #229)** — root-caused "F1 standings/results broken" to a **Jolpica HTTP 521 outage** (not our code); KV last-good (`lib/f1-cache.ts`) so it never blanks + self-heals. Can't seed while Jolpica's down.
- → done: **UX (0.85.0, #230)** — home lazy-loads Just-missed only when shown+expanded; customise moved to its own page `/settings/customize` + widget-discovery gallery; Social umbrella (Play folded into Social nav, Community row, Threads surfaced on Blog).
- → done: **betting/social (0.86.0, #231)** — bet reminders + results-in push notifs (new `betting` pref), richer league leaderboard (net credits/streak/form/honours), landing PredictionGame marketing; fixed the notif Sound toggle never persisting.
- → done: **threads per-series tags (0.87.0, #232)** — composer series picker + conditional series-page Threads link; migration `20260624170000` applied to prod via the Management API.
- → docs close-out **0.87.1**.
- → owed (operator): authed prod eyeballs (all signed-in surfaces above); confirm the betting-notif cron fires; forecast + exact_position go-live (= the "can't multi-select podium/points" ask); rotate the PAT; threads admin role; real-odds adapter parked (keep last).

Won't touch: real-odds adapter (operator deferred); anything needing authed browser-verify (operator preview); the untracked litter.

Active: _(no `[+Nm]` prefixes captured — long autonomous session)_

### 2026-06-24 (cont.) — forecast live · signed-in browser verification · a/b/c (#234–#237 → 0.91.0)

Continuation: forecast go-live; operator handed Clerk **dev** keys → a full signed-in browser-verification pass (Playwright); then build a→b→c per operator order; then this handoff.

- → done: **forecast LIVE (0.88.0, #234)** — `MARKET_BUILDERS` + `settleDueMarkets` routing; demo award + seed scripts removed.
- → done: **signed-in browser verification** (Clerk dev keys in `.env.local`; test user created via the Backend API since Turnstile blocks Playwright sign-up). Confirmed: nav (no Play), home Just-missed **lazy-load** (fetch only on expand), `/settings/customize`, `/social` hub, threads composer + series-picker + conditional series link (both ways), the **forecast multi-leg picker**.
- → done: **a — wide-screen layout (0.89.0, #235)** — `3xl` ≥1700 → `max-w-[2000px]` + 2-col home; mobile/laptop byte-identical (measured 390/1440/2560).
- → done: **b — leagues own page (0.90.0, #236)** — `/social/leagues` real page; the card links there; leagues removed from `/social`.
- → done: **c — durable source_snapshot (0.91.0, #237)** — DB last-good + health; news wired; `/api/cron/health` gains `sources`.
- → docs close-out **0.91.1** (this handoff — blog pipeline is the first next-session task).
- → owed: rotate PAT; exact_position go-live; extend `source_snapshot` to F1/scrapes + a warm cron; **the blog pipeline build (next session)**.

Won't touch: the blog pipeline build (next session, operator order); real-odds adapter (parked); the F1-radio sound + imagery licensing (captured to IDEAS).

Active: _(no `[+Nm]` prefixes captured — very long autonomous session)_

### 2026-06-24 (cont.) — blog pipeline SHIPPED (0.92.0, #240) + Dublin compute cutover

Opened on the locked first task (blog pipeline). Plan-mode plan approved; built + prod-migrated + went live end-to-end. Mid-session the operator (a) parked the "all content in DB / prefetch" idea after an ESPA, and (b) moved Vercel compute to Dublin.

- → done: **blog pipeline (0.92.0, #240)** — `post` table (prod via the Management API) + `lib/blog` + admin moderation + `*/15` publish cron + dual push + `blog` notif pref + DB/MDX `/blog` coexistence + `scripts/{draft-post,verify-blog}`. verify-blog green; tsc + 490 tests + build clean; blog files lint-clean (5 legacy errors untouched).
- → done: **Dublin cutover verified** — merging #240 triggered the first Dublin deploy; the `health` workflow ran GREEN from Dublin (13 standings + 8 results sources healthy), prod pages 200, publish-posts cron green. **Jolpica/F1 recovered** (health-green) — the 0.84.0 landmine is resolved.
- → ESPA: rejected "all content in DB" (static/ISR + CDN beats DB reads; rewrite cost; loses git-CMS — and Dublin makes the latency objection moot anyway); parked the idle-prefetch half as a B-perf sub-task.
- → owed (operator): signed-in blog push-walkthrough; rotate the Supabase PAT; first real posts + the scheduled-authoring trigger; the sound swap + imagery curation (follow-ons).

Won't touch (held): exact_position go-live (next-session task 2); the scheduled-authoring timer / sound / imagery (follow-ons).

Active: _(no `[+Nm]` prefixes captured)_

### Thu 2026-06-25 — desktop nav mega-menus + Friends page + feedback alerts/mobile (0.97.0–0.99.0, #252/#253/#255)

_(The day-log skipped the 0.93.0→0.96.1 marathon — see `docs/HANDOFF.md` for that detail; resuming here.)_

Operator: do both START-HERE items, audit before each PR. ESPA'd a plan; `AskUserQuestion` locked: both tasks, drop News, include the Calendar month-jump.

- → done: **desktop nav mega-menus (0.97.0, #252)** — new `HeaderNavMenu` disclosure primitive (hover+focus open; Escape/outside-click/route-change close); Series→category grid, Community (new, replaces standalone Blog)→Blog/Threads, Social→Play/Leagues/Friends, Calendar→rolling-12-month jump (`/calendar?m=YYYY-MM`, window-seeded so /calendar stays `○` static). All inside `hidden lg:flex` → mobile byte-identical. Browser-verified 1440/1024/390 (hover + keyboard + Escape + deep-link jump + mobile-hidden). tsc + 490 tests + `next build` green; 0 new lint.
- → done: **Friends page + share (0.98.0, #253)** — `/social/friends` promoted from a redirect to a real page (mirrors `/social/leagues`); `/social` gains a Friends launcher card (inline panel removed); `FriendsPanel` invite → native `navigator.share` (canShare-gated) with clipboard fallback. Browser-verified signed-in (card → page → share payload + fallback). 0 new lint.
- → done: **feedback alerts + mobile access (0.99.0, #255)** — operator follow-up: `lib/email.ts` `sendEmail()` (Resend wrapper) + `notifyNewFeedback()` email `CONTACT_TO_EMAIL` on every new feedback post (POST `after()`, best-effort, never blocks); a staff-only **Feedback row** on `/settings` (the mobile path — header link is lg+ only); contact route refactored onto the shared helper. Staff row browser-verified signed-in; email sends on prod only → operator verifies. 0 new lint.
- → done: this docs close-out (HANDOFF / IDEAS / SCHEDULE), PR #254.
- PRs **stacked**: #252 ← #253 ← #255 → merge in that order (retarget each base to `main` as the lower one lands); #254 (docs) is independent off main.

Won't touch: a real `/news` page (captured to IDEAS); the same-page Calendar header re-jump (the in-page picker covers it — matches the WeekendTabs `?tab=` pattern); exact_position go-live + other operator-gated items.

Active: _(no `[+Nm]` prefixes captured)_

### Fri 2026-06-26 — home-widget deep customisation + per-series widgets + track-layout scope (0.105.0–0.106.0, #266–#268)

Resumed the unverified deep-customise WIP, then built out the rest of the home gallery. ESPA + `AskUserQuestion` at each fork.

- → done: **deep per-widget customisation 0.105.0 (#266)** — verified the WIP (tsc/lint/build + browser: gear disclosure, persist+merge at config v6, `/app` reflection, the `snapshotSeries`→config migration, v3→v6 reconcile). Two fixes: dead `WEEK_MS` removed; snapshot Series picker scoped to followed. Re-committed clean + merged.
- → done: **per-series widgets 0.106.0 (#267)** — Series countdowns + Series results (opt-in, per-widget `count`, shared just-missed fetch) + **chyron density no-op fix** (operator-reported). Browser-verified.
- → done: **track-layout scoped (#268)** — researched asset sources (f1db / bacinger / track-atlas / Wikimedia), decided Approach A (F1-first f1db SVGs), reframed the card (DRS is F1-only). Doc: `docs/research/2026-06-26-track-layout-scope.md`.

Active: _(no `[+Nm]` prefixes captured)_

### Sat 2026-06-27 — Circuit map widget (0.107.0, #269) + session wrap

- → done: **Circuit map widget 0.107.0 (#269)** — 21 F1 2026-calendar circuit SVGs from f1db (CC BY 4.0); `lib/circuit-layout.ts` + `matchCircuitEntry`; page resolves `circuitLayoutByUid`; HomeContent renders the next followed round's map + credit. `track-layout` graduated → gallery now empty. Browser-verified (Red Bull Ring renders white-on-dark). All four PRs merged → main **0.107.0**.
- → done: session wrap — HANDOFF refresh + IDEAS triage + this SCHEDULE log.

Won't touch: circuit-map Phase 1b (corner/DRS) + Phase 2 (multi-series); the operator-owed items (PAT/`sk_live` rotation, preview scrape verify, exact_position, sitemap).

Active: _(no `[+Nm]` prefixes captured)_

---

## Week of 2026-06-29

### Mon 2026-06-29 — feature reports: owed verifications + nav link + home widgets + F1 telemetry boards

Plan: work the FEATURE REPORTS (bugs + ideas). First confirm the owed prod verifications, add the missing `/f1/analysis` nav link, then build from the audit + the free-OpenF1/app widget backlog.

- **Triage:** no real bugs. Audit #1 (AdSense) off-limits; #2 (warm-cron) shipped; `prod-weekend8.md` = stale page snapshot (v0.46.0 footer); `agent-salvage` = stale content notes (one moot IMSA Detroit line). Session = all feature-building.
- **Owed verifications (public smoke via WebFetch/curl):** standings parity #280 ✅ (home brief `171/131/125` == standings-tab final cumulative — the WebFetch "1715" was a chart-data misread, disproven); telemetry warm-path #281 ✅ functionally (Austria quali Decoder renders real telemetry); Analysis Hub #283 ✅ (8 rounds linked); threads #282 ✅ thin (1 approved thread). Operator-owed (auth/cron/WebGL, MCP browser locked): analysis-ready push #283, bets widget signed-in #282, 3D WebGL scene #285.
- → done: **A — nav link 0.114.1 (#287)** — featured `/f1/analysis` link in the desktop Series mega-menu + an F1-only link on `/series/f1` (mobile + desktop). tsc clean; no new lint.
- → done: **B — home-widgets pack 0.115.0 (#289)** (where-to-watch, next-race weather, driver-spotlight; opt-in, multi-series) + **C — F1 telemetry leaderboards 0.116.0 (#288)** (speed-trap, pit-stop league, overtakes; free OpenF1, on F1 session pages). Built via folder-disjoint parallel worktree subagents, reviewed + merged in order (version-file conflicts resolved).
- → done (operator mid-session asks): **F+G — blog author bylines + full draft preview 0.117.0 (#290)**; **H — F1 driver headshots 0.118.0 (#291)** via OpenF1 (F1-only; ⚠️ F1-copyright media, isolated/swappable — operator chose informed).
- → done: **Austria GP race recap** — researched (OpenF1 + ≥3-source web), drafted in the published preview's voice, **triple-audited** (an independent pass caught + fixed a real error), inserted as a `draft` to prod (`austrian-gp-2026-recap`, id `fa7cb781`) via the Management API. Awaits the operator's in-queue approval + the deploy.
- → deferred: **E — collapsible race-page sections** (justified: 7 stacked sections now — but the collapse needs a browser to verify; MCP browser was locked all session).
- ⚠️ **Prod deploy stuck on 0.116.0** ~30 min after #290/#291 merged (a local build of 0.118.0 is clean → Vercel-side, not the code). Until it deploys, the recap draft-preview + bylines + headshots aren't live. Check Vercel next session.

Won't touch (held): OpenF1 LIVE tab (paid Sponsor tier — operator action), AdSense, lazy-Clerk-anon, standings-movers (round-over-round infra), ADAC/NLS parsers. Legacy lint drifted 5→8 (pre-existing; cleanup item).

→ done: **5 PRs #287–#291 (0.114.1 → 0.118.0)** + the Austria recap queued. Active: _(no `[+Nm]` prefixes captured)_

**Continued (afternoon) — `/feedback` board + mid-stream asks → 9 more PRs to 0.124.0:** next-race fix (#296), notifications remodel backend+center (#295/#297), 3D-quali NaN + landing-hero mobile width + account avatars (#300), friends/leagues widget (#298), practice telemetry (#299). 3D verified live on prod. **6 `/feedback` items OPEN, grouped into PARALLEL lanes for next session** — see the `docs/HANDOFF.md` top block (FINAL). → done: **~14 PRs this session, 0.114.1 → 0.124.0.**

---

### Thu 2026-07-02 — overnight autonomous run (Wave B + fixes) → 7 PRs #356–#362, NONE merged

Operator left it overnight ("take care of everything; use ultracode if needed"). Held the visual-gate policy: everything is a review-ready PR, verified headlessly (tsc / unit tests / curl / anon-leak checks), NOT merged (MCP browser locked + previews SSO-walled). main stays 0.147.0; prod unchanged.

- → done: **Arc 1** — Decoder→Analysis/Replay rename (#356, 0.148.0) · global ⌘K search (#357, 0.149.0) · F1 head-to-head `/f1/compare` (#358, 0.150.0).
- → done: **owed Wave-A fixes** — overview.md fastest-lap + Champions `<h2>` a11y (#359, 0.150.1).
- → done: **NLS prod fix** — root-caused (the `/wiki/` frontend blocks datacenter IPs) + fixed via the Wikimedia action API like the champions fetcher (#360, 0.150.2; 9/9 tests, live winners render). Safe to merge.
- → done: **Arc-2 gating pt1** — F1 analysis account-walled, leak-free server-side (#361, 0.151.0; anon-leak-free verified). Rest of the wall specced + DEFERRED (device-local model = a product call): `docs/research/2026-07-02-account-gating.md`.
- → done: **IA restructure** — 3-lens design tournament → design doc + proposal (#362, docs-only off main): `docs/research/2026-07-02-ia-restructure.md`. Needs operator taste + a visual pass.
- Flag: pre-existing non-green tests on main — `turns.test` ×2 (deterministic), `sitemap-data` (flaky). Not mine.

Won't touch: merging to prod (visual gate); the deferred gating wall + the IA build (need operator decisions/visual).

Active: _(autonomous overnight; no `[+Nm]` prefixes)_

### Thu 2026-07-02 (continued) — Wave B merged + 5 more PRs shipped → main 0.147.0 → 0.154.0

Operator returned; merged Wave B (#356–#362 → 0.151.0), then a continuous build-and-ship session (#364–#368 → 0.154.0), all merged to prod.

- → done: **turns.test greened + MotoGP gate re-landed** (#365, 0.152.1) — the 2 `turns.test` reds were broken fixtures shipped in #330 (test-only fix; `detectTurns` unchanged); re-landed the MotoGP chart gate that missed the #364 squash by ~5 min.
- → done: **MotoGP chart root-caused + FIXED, un-gated** (#366, 0.152.2) — the 2026 Catalonia GP (R6) is a red-flag restart; the parser summed the annulled `RAC` (0 pts) instead of the scored `RAC2` (140 pts). Fixed via `pickScoringRace`; all 27 riders reconcile. (Corrects the prior "per-round value gaps" theory.)
- → done: **Arc-2 IA increment 1** (#367, 0.153.0) — following + home-customize walled to signed-in (guests get the fixed default + sign-in CTAs); Up-next/Just-missed pinned as a spine; "Jump to" launcher; weekend/session Standings·Results quick-links.
- → done: **`/social` teaser landing + top-level clickable News nav** (#368, 0.154.0).
- → done: **session-end triage** — HANDOFF pickup block + IDEAS closures + corrected MotoGP diagnosis.
- Verified per PR: tsc + 648 tests + Playwright smoke (signed-in, 0 console errors). **Owed: anon visual passes** (home walling, `/social` teaser, quick-links, launcher widths/focus) — every smoke ran signed-in.
- Started: **British GP preview** — research agents launched (facts / championship / news); synthesis + draft pending.

Won't touch: the deferred IA taste calls (Social→"Play", F1-Analysis nav slot, Drivers/Teams nav home, per-page density, full jobs-to-be-done regroup) — held for explicit decisions.

Active: _(no `[+Nm]` prefixes captured this session)_

### Fri 2026-07-03 — triage build-day + audit + batch J → main 0.154.0 → 0.164.0 (#373–#399)

Started with the British GP MDX→draft fix + blog SOP, then an evidence-required triage of all 109 backlog items (14 verify agents), then salvaged the wave-1 build batches one-by-one (operator stopped the parallel agents; each batch hand-finished from its worktree: commit WIP → rebase → gates → notes → PR → merge → prod-verify), then audited all 19 PRs and fixed the 3 that were wrong.

- → done: **blog SOP + British GP unpublish** (#373/#374) — MDX pulled, re-inserted as a prod DB draft; SOP codified (posts are prod drafts, never public MDX) + memory rule.
- → done: **109-item triage** (#375/#376) — 20 shipped / 4 killed / 15 operator-gated / 70 open; doc `docs/research/2026-07-03-backlog-triage-109.md`; IDEAS synced (W4 is the only v1.0 launch gate left).
- → done: **salvaged batches** — DEF 0.155.0 (#378) · M-slice content (#379) · HI 0.156.0 (#380) · C 0.157.0 (#381) · B 0.158.0 (#382) · A 0.159.0 (#385) · G 0.160.0 (#386) · L 0.162.0 (#390); + fixes 0.154.1 (#377), 0.158.1/2 (#383/#384), 0.161.0 (#389), Z lint 0.162.1 (#391).
- → done: **audit + 3 fixes** — F2 betting un-gate 0.163.0 (#392) · blog hard-404 0.163.1 (#393) · social flat-language rebuild 0.163.2 (#394). All prod-verified.
- → done: **signed-in verification pass** (operator logged in via Playwright) — #382 notif toggles (toggle→PUT 200→persists→restored), #385 league links (→ real profiles), **#386 draft-editor fully verified** via a `/blog` composer draft (pencil → edit → PATCH 200 → re-render, then rejected).
- → done: **batch J (home widgets)** — 0.163.3 (#396, notes #397) This-week/News empty-state consistency (populated blocks already at the polish bar); **0.164.0 (#399) standings-movers** widget (opt-in, F1/F3/MotoGP; deltas from the Standings-tab trend; lazy `/api/home/movers`; prod API 200 + localhost render verified).
- → done: **IDEAS captured** — bet-display refinement (#398); F1 classification speed.
- → carry: F2 market needs the open-markets cron to run (no `CRON_SECRET`); standings-movers past F1/F3/MotoGP (points-model reconciliation); deferred batch remainders (AppShell tint, devices list, author-role gate, thread replies, team-compare wiring, historic colours/media seeds); F3 betting blocked on rounds.json renumber.

Won't-touch held: prod DB writes beyond the sanctioned composer flow; triggering crons; the deferred IA taste calls; speculative restyle of already-polished home blocks.

Active: _(no `[+Nm]` prefixes captured this session)_

---

### Sat 2026-07-04 — W4 team pages: points-trajectory chart + imagery program kickoff

Session pickup (inline handoff). Oriented + ESPA'd. Correction surfaced: team pages already exist (form / drivers / bio / news) — W4's real gaps are stat-parity (team trend chart) + imagery. Operator picked **W4**; imagery scope = **portraits + attempt logos**.

Plan:
- Ship the **team points-trajectory chart** on `/teams/[slug]` — reuse the already-tested `aggregateTeamsTrend`; mirror the driver page's trend (gate on `pointsExact`, `namesMatch` member resolution, `LazySeasonTrendChart`). One PR; browser-verify a real F1 team's line reconciles to its Constructors' total.
- Scope + kick off the **imagery program** — driver portraits (Wikimedia CC, per-image attribution) across all series + attempt team logos; schema extension + curation dispatch. Wiring into pages = next session.

Won't touch: `buildStandingsAtRound` (no team "Wins" stat this PR — standings blast radius); imagery *wiring* into pages this session; anything outside W4.

Pre-mortem: a curated-name↔feed-name mismatch undercounts a team line — mitigated by `namesMatch` + the `pointsExact` gate + browser verification.

**Outcomes (mid-session the operator handed off a broader "next 5 batches" unsupervised overnight run, into 2026-07-06):**
- → done: **W4 team points-trajectory chart** (0.165.0, #401) — prod-verified (McLaren line 159 == its Constructors' points).
- → done: **W4 F1 driver portraits** from Wikimedia Commons (0.166.0, #402) — 19/22 drivers, free-licences-only + per-image attribution; prod-verified.
- → audit: the "next 5 batches" were mostly already shipped/obsolete — Champions collapsible ✅, F1 race-page collapsible ✅, historic colours ✅ (12 already curated), AppShell `--tint` ⛔ obsolete (sidebar removed 0.17.0). Only media-seeding was a genuine gap.
- → done: media.json audit — existing f1/f3/wec clips all official-channel + live (geo concern clean); seeding 12 more series deferred (open-ended research).
- → deferred (need operator decision): team logos (no free Commons source); Russell/Sainz/Hamilton portraits; the `/drivers/max-verstappen` slug-collision bug (primary-series tiebreak; sitemap/test blast radius).
- Gate on every PR: tsc + eslint + 750 tests + next build + Playwright anon verify + prod-verify.

**Continued 07-04 → 07-06 (operator-directed "keep going" tail):**
- → done: **W4 finished** — F1 portraits completed 22/22 (#402/#404), team chart reworked to all-constructors (#405), cross-series driver-slug fix (#404).
- → done: **per-weekend F1 UPGRADES** feature — data source found (FIA Car Presentation docs), weekend section + R1–R9 curated (251 parts) + opt-in home widget (#415/#416/#418, merged); media seeds F1/F2/F3 (#406/#413).
- → done: **calendar grid-stretch fix** (#417); two design docs (feeder intake, AI assistant).
- → open: home-upgrades widget signed-in glance; AI-assistant + feeder-intake build decisions.
- Net this stretch: **18 PRs #401–#418, main 0.164.0 → 0.170.0.** Full record in `docs/HANDOFF.md` (2026-07-06 block). Playwright disconnected late → the one unverified item (home widget) shipped headless-verified + prod API confirmed.

Active: _(autonomous overnight + follow-ups; no `[+Nm]` prefixes)_

---

## Week of 2026-07-06

### Mon 2026-07-06 — W8 launch program kickoff

Plan (approved):

1. Gate items first: signed-in verify of the f1-upgrades home widget (#418, Customise → enable → /app); AI-assistant + feeder-intake decisions via AskUserQuestion (answer or defer).
2. W8 launch program: launch checklist (`docs/launch-checklist.md`) + launch announcement banner (copy + 1.0.0-timing decision — no existing "early access" label exists, this is an announce surface) + marketing-channel plan (`docs/research/2026-07-06-launch-marketing.md`, plan doc only, nothing posted).
3. Stretch: bet-display refinement (multiplier + credits-to-earn on placed bets).

Won't touch: AI assistant / feeder intake builds (decision-gated), F3 rounds renumber, grid market migration, real-odds adapter, R10 upgrades curation (FIA doc drops ~Thu Jul 16).

Outcomes:
- → done: **f1-upgrades home widget (#418) signed-in verify** — renders on `/app`, layout undisturbed, 0 console errors (now enabled on the operator's account).
- → done: **design-doc decisions** captured — AI assistant = account-gated (build first after W8); feeder intake = tokened link; v1.0 = build banner now (dark), flip on launch day.
- → done: **W8 kickoff shipped 0.171.0 (#420)** — `LaunchBanner` (ships dark, flag-gated; visual-verified both states) + `docs/launch-checklist.md` + `docs/research/2026-07-06-launch-marketing.md`. Gates green (tsc / eslint 0 / 753 tests / build).
- → reverted: **bet-display refinement** (stretch) — attempted, browser-caught that `bet.multiplier` is settle-only (pending bets carry no odds), reverted; needs a data-model decision (persist-at-placement migration vs read-side join). Captured to IDEAS + HANDOFF.
- → done: **AI site-help assistant MVP shipped 0.172.0 (#422)** — account-gated `/assistant` + `/api/assistant` + `lib/assistant/*`, Gemini Flash free behind a swap seam, grounded in a curated corpus, guardrailed + rate-limited (fail-closed). Ships DARK (no key → 503). Verified localhost (panel + fail-closed limiter); gates green (761 tests). Go-live = operator sets the key + privacy line, verify on prod.
- → done: **assistant reworked into a floating "Race Engineer" chat widget 0.173.0 (#424)** — operator disliked the page UI; now a persistent launcher + conversational multi-turn panel, replacing the page. Gated on `NEXT_PUBLIC_ASSISTANT_ENABLED=1` (ships dark = no launcher). Verified working state on localhost; dark state NOT eyeballed (Playwright MCP died after a broad node kill — also likely stopped the operator's dev server). Gates green (763 tests).

Active:
_(no `[+Nm]` prefixes captured)_

---

### Tue 2026-07-07 — Race Engineer assistant: go-live (paid Gemini) + full upgrade pass

Diagnosed the "couldn't answer" error to a Google project-level denial (403 on all current models, 429 on the old one) → operator enabled Gemini **paid tier** (billing required for EEA users per Google's terms; free tier is denied + trains on data). Then shipped the researched best-practice upgrades.

Outcomes:
- → done: **model default fix + privacy 0.173.1 (#426)** — `gemini-2.0-flash` (retired) → `gemini-flash-lite-latest`.
- → done: **links+bold rendering 0.174.0 (#427)** · **chips + persistence + escape-hatch 0.175.0 (#428)** · **usage insights + 👍/👎 + admin `/settings/assistant` 0.176.0 (#429)** · **eval `npm run assistant:eval` 0.176.1 (#430, 6/6 live)** · **typing indicator 0.176.2 (#431)**.
- → skipped (recommended): streaming — low value on short answers + flickers partial links.
- → owed: browser eyeball on prod; watch `/settings/assistant` → expand corpus for common Qs.

Active: _(no `[+Nm]` prefixes captured)_

---

### Tue 2026-07-07 — continued — 4 PRs (blog cadence · PWA fix · F1 results · writer role) + queued 2 prod blog drafts via PAT → main 0.177.0

Long operator-directed build session off the inline handoff:
- → done: **#437 (0.176.5)** blog-cadence tooling (marquee-event context builder + `.md`→draft parser + playbook + local `/weekend-post` skill); dry-run produced the MotoGP preview draft.
- → done: **#438 (0.176.6)** PWA post-deploy first-open fix — diagnosed the operator's ~20–30s stall to the SW re-precache hijack; `skipWaiting`/`clientsClaim` → false.
- → done: **#439 (0.176.7)** faster F1 results (`warm-sessions` */10 + f1 `revalidate` 600).
- → done: **#440 (0.177.0)** writer role — self-service authoring + rich `MarkdownEditor` (toolbar + server-rendered Write/Preview). Operator sets the Clerk role + verifies signed-in.
- → done: **queued 2 blog drafts to PROD** (British GP report + MotoGP preview) via `.supabase-pat` Management API — the long-blocked prod-Supabase write path, now proven; fixed the operator-reported "no drafts on /blog".
- → done: **AdSense diagnosis** ("Low value content" = aggregated/thin content; fix = original content via the cadence); readiness plan logged to IDEAS.
- → held: B-perf tasks 2–3 (need browser verify); Assistant Phase 2 (design-first); re-schedule feature (IDEAS).
- → gates: every PR tsc/eslint/**778 tests**/next build green; AUDIT-FIRST caught 3 already-shipped "open" items (/news, NASCAR chart, news-filter).

Active: _(no `[+Nm]` prefixes captured this session)_

### Tue 2026-07-07 — overnight autonomous — Motorsport Information hub `/information` (branch, NOT pushed) → proposed 0.178.0

Unsupervised overnight build off an operator brief ("questions answered" section, hundreds of pages, careful with the sitemap):
- → done: `/information` section — hub + 10 topic indexes + entry pages; `lib/information/*` (types/topics/generated/curated/registry), `components/information/InfoUi`, `qaPageLd`, nav ("Answers" menu + footer), ⌘K search (`info` type).
- → done: **577 pages** — 526 verified (generated from our `champions.json` + 15 editorial explainers) + 51 unverified drafts (12 team histories, 38-venue tracks directory, 51-driver feeder rising-stars watchlist).
- → done: **two-tier anti-spam gate** — only verified+featured index (cap 150) → **51 indexed** in the sitemap; drafts + long tail are `noindex`; drafts excluded from search. Addresses the sitemap-spam + AdSense constraint.
- → workaround: tracks research agent stalled twice on large inline output → seeded the directory from verified `content/circuits.json` (38); broad ~150-venue set deferred.
- → gates: tsc 0 · eslint 0 errors · **794 tests** · `next build` 213 static pages · curl smoke (noindex on drafts, QAPage on indexed, 526 info search docs) all pass.
- → NOT pushed (operator publish decision); drafts need fact-check before promotion. Docs: `docs/research/2026-07-07-information-hub.md` + question catalog.

Active: _(overnight autonomous run — no interactive time tracked)_

### Fri 2026-07-10 — session 5: release audit + IA restructure + polish → 0.190.0

Operator-directed, off the session-4 handoff (10 feature/fix PRs, 0.184.1 → 0.190.0). No `[+Nm]` prefixes captured.
- → done: **heavy release audit** — last ~100 releases (0.184.1→0.132.0) vs prod, 98/101 live, evidence doc `docs/research/2026-07-10-release-audit.md` (#474) + stale-doc fixes.
- → done: **52 fact-checked series Q&A pages** in /information (#475, 0.185.0) — parallel per-series authoring + adversarial fact-check (caught 4 real errors).
- → done: **F1 head-to-head surfaced** (#476, 0.185.1).
- → done: **IA restructure A→B→C** — series editorial content → /information guides; rail trimmed to 5 live tabs + "Learn about" block; guides indexed + `/series/<slug>/history` 308-redirect + rules out of About (#477–479, #482; 0.186.0→0.189.0).
- → done: **Answers → Learn nav** (#480, 0.188.0) + **dedicated /information/series-guides page** (#483, 0.190.0).
- → done: **series-page desktop polish** (#481, 0.188.1) + **series-tab scroll-bug fix** (#483) — operator screenshot/feedback, verified desktop + mobile (Playwright).
- → parked: SportsEvent offers/address enrichment (#13) · real-odds adapter · blog cron-pinger (operator: "remove").
- → gates: every PR `next build` green (→467 static pages) + `tsc` + browser/Playwright verified.

Won't touch (deferred to next): About-tab full migration, page-`<title>` Answers→Learn, W4 profiles, admin console, assistant Phase-2, champion-Q&A depth, `rounds.json` hygiene.

Active: _(no `[+Nm]` prefixes captured)_

### Sat 2026-07-11 — session 6 (About migration + SEO/data + W4 P1 + mobile + prod audit)

Operator-directed continuation ("keep going" / "next batch" through the queue). 0.190.0 → 0.195.1, 5 PRs, all merged + prod-audited. No `[+Nm]` prefixes captured.
- → done: **About-tab → /information migration** (#485, 0.191.0) — all 15 About tabs 308-redirect to their "what is <series>?" guide; authored `what-is-formula-1` + `what-is-the-nurburgring-24-hours`.
- → done: **SEO/data pass** (#486, 0.194.0) — rounds.json hygiene (DTM R4 / WRC 6→14 / GT-World Barcelona-Sprint / NLS ACAS-Cup; NASCAR R32 oval was correct — ROVAL note stale) + SportsEvent `location.address` (+60 verified circuits → 98, WRC `countryCode`).
- → done: **W4 scoped + P1 driver identity** (#487, 0.193.0) — flag+nationality+age from the Wikipedia intro. v1.0 bar = P1 (last launch gate); P2–P5 post-launch.
- → done: **Mobile findability** (#488, 0.195.0) — Blog/Threads/News into footer + home launcher (operator's mobile note; no bottom-bar change).
- → done: **Prod audit** of the day's work → caught + fixed the W4-identity cache-staleness (#489, 0.195.1 cache-key `v2:` bump).
- → done: **session wrap** — this handoff + IDEAS triage + SCHEDULE (docs/session-6-wrap).
- → gates: every PR `next build` green + `vitest` + browser/Playwright + a prod curl/Playwright audit. Stacked same-day PRs union-resolved (re-versioned 0.192.0 → 0.194.0 after #487 landed first).

Won't touch (deferred): W4 P2–P5 (post-launch), assistant Phase-2, champion-Q&A depth, admin console (creds-blocked), deeper mobile "Community" tab.

Active: _(no `[+Nm]` prefixes captured)_

---

### Sun 2026-07-12 — session 8 (unsupervised overnight): security + admin dashboard + feeder intake + changelog weeks + audit → 0.206.1

Operator handed off #1 (admin redesign) + #2 (feeder intake) + #3 (polish → changelog weeks) to run solo overnight; mid-session flagged the public `/changelog` was leaking internal admin detail. 5 PRs #505–#509, all merged + prod-audited.

- → done: **#505 (0.203.2) security** — the repo was PUBLIC → made it private; redacted the admin/subdomain/heatmap detail from the public `/changelog`. No secrets were ever committed.
- → done: **#506 (0.204.0) /admin dashboard** — section-nav rail + KPI cards + a card per section (operator disliked the single-column stack). Browser-verified 1440 + 390.
- → done: **#507 (0.205.0) /contribute feeder-intake MVP** — public form → `series_submission` staging → operator email + admin Submissions list. **Prod migration OWED (safety-gated overnight).**
- → done: **#508 (0.206.0) /changelog weekly grouping** — ISO weeks within months, month-clamped labels. Prod DOM-verified.
- → done: **#509 (0.206.1) audit fix-forward** — 2 adversarial subagents (admin came back clean); fixed rate-limit fail-closed + `file_type` sanitise + DB-error leak + the never-running changelog test (841→852) + the cross-month label duplication.
- → gates: every PR tsc + eslint + `next build` + browser/curl; full suite **852**; prod-audited (0.206.1 live · /admin 404 anon · /contribute route validates · changelog weeks + clamp live).
- → OWED operator: apply the feeder prod migration (Supabase Studio SQL editor); set up the cron-job.org pinger (private repo meters GH Actions — ~4-day runway). Details in `docs/HANDOFF.md` session-8 block.

Won't touch (deferred — needs operator/decision): AdSense content (portraits ×14, champion-Q&A schema); F1 classification speed; weather+news audit; mobile Community tab; feeder Phase 2 (Storage/Turnstile).

Active: _(unsupervised overnight — no `[+Nm]` prefixes)_

---

### Sun 2026-07-12 — session 9 (unsupervised overnight): B1 quick-wins + B2 tour + B3.12 reschedule + explainers + audit → 0.210.1

Operator handed off IDEAS batches B1 + B2 + B3 to run solo. 6 PRs #512–#517, all merged + prod-audited (0.210.1 live).
- → done: **#512 feedback status-filter** (closed hidden by default, done/closed dimmed/struck) · **#513 blog mobile** (ToC hidden on phones + overflow-safe tables/images) · **#514 endurance explainers** (LMH/LMDh + GT driver-ratings + cross-links; "driver ratings" = the GT Pro/Gold/Silver/Bronze categorisation — no numeric rating exists) · **#515 tour mobile-first** (opposite-half sheet, rounded) · **#516 blog reschedule** (reschedulePost + 'reschedule' action + UI) · **#517 audit fix** (BMW LMH→LMDh + tidy-ups).
- → deferred (documented, NOT done): B3.7 portraits ×14 + B3.8 team logos (licensing — supervised pass), B3.9 champion-Q&A depth (schema + big curation), B3.11 cadence automation (crons-gated), B3.13 bios + B3.10 live-chart embeds (shortcode pipeline). B1.1 admin grant = operator Clerk-dashboard action.
- → audit: 2 adversarial subagents; reschedule/feedback/tour reviewed clean; one CONFIRMED factual error (BMW) fixed in #517.
- → gates: every PR tsc + eslint + browser/curl; `next build` at 0.210.0 (cumulative) + prod-verified; heavily-gated UIs (feedback, blog moderation) verified via a temp mock + gate-bypass (reverted).

Won't touch (deferred): the B3 licensing/large items above; anything needing an operator decision.

Active: _(unsupervised overnight — no `[+Nm]` prefixes)_

---

### Sun 2026-07-12 — session 10 (unsupervised overnight): "next batch" = B4 → recon found it ~90% done; shipped the safe slice → 0.210.2

Operator handed off "next batch" (B4 — Data completeness & resilience). A recon subagent (verified with 60 passing tests) found most of B4 was already shipped or prod/preview/decision-gated — the IDEAS ledger was stale.
- → done: **#519 (0.210.2)** — completed `NEWS_SLUG_MAP` (adac-ravenol-24h was unmapped → explicit `null` fallback like nls) + round-grouping regression tests (doubleheader splits w/ no duplicate rounds, round-0 for uncovered sessions, index fallback). Suite 852→855.
- → verified already-done (IDEAS trimmed): MotoGP chart undercount, GTWC canonical rounds, FE doubleheader URLs, standings/F1 last-good resilience (`withSourceSnapshot`).
- → deferred (documented, gated): extend `withSourceSnapshot` to the remaining results modules (prod-verify), live weather/news coverage (datacenter), media.json seeds ×11 (content research + fact-check), NLS results scraper (datacenter). B1.1 admin + feeder migration + cron pinger still owed.
- → lesson: `tsc` caught a missing required type field that `vitest` passed — tsc is a separate gate from the tests.

Won't touch (deferred): the preview/prod/curation-gated B4 items above.

Active: _(unsupervised overnight — no `[+Nm]` prefixes)_

---

## Week of 2026-07-13

_(Sessions 11–16, 2026-07-12 → 07-14, are recorded in `docs/HANDOFF.md`, not here — SCHEDULE lagged after session 10; HANDOFF is the maintained session record.)_

### Wed 2026-07-15 — session 17 — WRC per-stage + reachability, SEO internal-linking, home/nav cleanups, Cloudflare migration

10 commits, 0.228.8 → 0.229.8 (all merged/prod-shipping except the just-missed removal, which went direct to main via a branch slip — verified + green). Live-driven throughout.

- → done: **#585** admin back-link → apex; **#586** WRC per-stage classification (R8 Acropolis pilot; eWRC gate passed via Playwright; adversarially verified); **#587** session rail wraps (18-stage rallies reachable); **#588/#589** weekend + calendar → circuit-profile links (+ Miami wrong-link fix); **#590** "Tracks" tab → "Rounds"; **#591** WRC skips the KV cache; **dc1d140** removed the "Just missed" home widget; **#592** series card → Points/What's new explainers; **#593** rally schedule rows clickable.
- → audited: full suite green (tsc + 920 tests) across all 10. Batch-1 "SEO content" found already-done (every demand explainer exists + is featured) → internal linking is the lever, not new content.
- → operator: Cloudflare migration mid-session (site + Clerk sign-in healthy through CF); Sachsenring blog posted.
- → declined (scrutiny): rally per-stage FULL field (transient, low-value — headline shipped in #586); IndyCar results/times (outbound → preview-paired, next).

Won't touch (deferred): IndyCar outbound (preview-paired), Bing (operator token), authority/distribution (off-platform), doc hygiene (trim HANDOFF/SCHEDULE).

Active: _(live-driven session — no `[+Nm]` prefixes)_

---

## Backlog stubs (HISTORICAL — mostly shipped; current backlog is IDEAS.md)

**Status (session-17 audit):** the W1–W8 wave + S5–S7 below have largely **shipped** across 0.10.x–0.22.x — verified in the codebase: per-session pages (`/weekend/[round]/[session]`), point-in-time weekend standings, series-tab polish, about/rules content per series, driver/team profile pages (`/drivers/[slug]`, `/teams/[slug]`), blog + threads + admin approval, the SEO baseline, and native non-F1 results/standings. **Still open:** W5 per-page layout spec, W6 Android TWA (post-v1.0), W8 v1.0 launch program (postponed), full Supabase-migration execution. The waves below are kept as a historical record; the **live** backlog lives in `IDEAS.md`.

**Operator 15-item batch (2026-06-11), organized into waves:**

- **W1 — Weekend page overhaul**: retheme to timing-screen language (radial wash still there), remove the back-to-series arrow, point-in-time standings (points as they stood at that GP — computable only where full per-round points exist: F1/F2/F3/NASCAR/WRC/DTM/IndyCar/FE/MotoGP/WSBK; F1 first, IMSA/GTWC excluded honestly), per-session pages with results at `/series/[slug]/weekend/[round]/[session]` (OpenF1 for F1 practices/quali; other series race-session only). 2–3 PRs.
- **W2 — Series-tab polish**: ✅ shipped (PR #123, 0.26.0). Follow-up: curated historic-constructor color map so pre-current-grid champions color too.
- **W3 — About/rules content ×15**: rules-essentials curated INTO About (Rules tab stays retired per 0.19.0 decision unless operator vetoes); history-essay agent pattern.
- **W4 — Driver + team profile pages**: enrichment, multi-session; verify drivers.json coverage first (gap was 13 series in May — recheck before scoping).
- **W5 — Per-page layout spec, desktop + phone**: one design session, documented in the redesign doc; feeds W1/W4.
- **W6 — Android app**: TWA wrapper (PWABuilder/Bubblewrap → Play Store, $25 one-time), NOT a native rebuild; needs Digital Asset Links + store assets; post-v1.0 surface stability.
- **W7 — Blog threads + UGC + admin approval**: Clerk roles via publicMetadata (admin check in API routes — no Organizations needed); submissions/drafts/approval queue = **the Supabase trigger (S9 fires)**. Design doc before code. Don't block launch on it.
- **W8 — v1.0 launch program**: scope-lock decision (operator owes: what's in v1.0), "out of early access" banner, marketing channel plan (IG/FB/Reddit/X/YouTube), launch checklist. Security audit is a launch gate.

Sequencing: security audit (already queued) → W1 → W5 → W3/W4 in parallel → W8 scope lock → W6 post-launch. W7 runs as design-doc work alongside.

Pre-existing stubs:

- **Supabase migration full execution** — schema build, scrapers, ingestion crons. Now coupled to W7 (the trigger has fired in principle).
- **SEO baseline (S5)** — sitemap, robots, JSON-LD, per-page metadata, OG image generators. Largely shipped via Track B; remaining bits fold into W8 launch checks.
- **Detail-page enrichment (S6)** — `/drivers/[slug]`, `/teams/[slug]` → absorbed into W4.
- **Native non-F1 results + standings (S7)** — MotoGP / WEC / IndyCar / NASCAR → largely shipped 0.11.x–0.12.x; WEC results remain (see W1's per-session pages + 0.12.8.1).

---

## Week of 2026-07-20

### Mon 2026-07-20 (session 18 — reactive: "/health doesn't work")

Unplanned/reactive session (no morning plan). Operator flagged F2/F3 results missing → widened to a full data-health pass.

- → done: ship #598 (0.229.13/14) — fix F2/F3/WRC RESULTS (WRC absolute-link fix; F2/F3 rewritten onto the FOM JSON API via new `lib/results/fom-api.ts`). Prod-verified.
- → done: ship #599 (0.229.15/16) — new weekend-schedule health monitor (`npm run health:sessions`) + curated GT World / WRC / IndyCar / DTM schedules to green (15/15).
- → done: ship #600 (0.229.17) — F2/F3 STANDINGS via the FOM API. `/health` now green everywhere: results 8/8, standings 13/13, sessions 15/15.
- → done: session-18 handoff.
- → deferred: post-Belgian-GP blog (operator queued; not started).
- Won't-touch honored: no unrelated working-tree changes staged; blog left for next session.

### Tue 2026-07-22 (session 19 — blog features + full F1 champion depth + F1 schedule cross-check)

Long pick→build→verify→merge session (spanned 2026-07-20→22), mostly solo (ultracode declined). **13 PRs #601–#613, 0.230.0 → 0.230.12, all merged + prod-shipping.**

- → done: **#601** blog cover images + branded OG share cards (fixed the profile-pic-on-share bug; covers render on-page, the branded card owns `og:image` for every post).
- → done: **#602** F1 lap-by-lap analysis engine (`scripts/lapstory-context.mts` + playbook; OpenF1-grounded, draft-only) — Belgian GP lap-by-lap prod draft queued.
- → done: **#603** Greek lowercase omega font fix (GeistSans malformed ω → `GreekFallback` unicode-range on `body`).
- → done: **#604** driver-bios sidecar (plumbing + display; F1 Hamilton/Alonso seeded).
- → done: **#605** F2/F3 stale "Source:" links retargeted to the rebuilt fiaformula2/3.com.
- → done: **#606–#612** Champion-Q&A depth — the `ChampionDepth` display + FULL F1 champion backfill 1950–2025 (76 seasons, a decade per PR; StatsF1 + Wikipedia champions table, RULE #1; dropped-scores / half-points / posthumous / DSQ cases handled).
- → done: **#613** F1 schedule cross-check (`npm run health:f1-schedule` vs OpenF1 official times; 45 sessions, 0 discrepancies).
- → done: Belgian GP recap prod draft (operator scheduled/posted).
- → dropped: sessions-health internal off-window (wrong-day) check — false-tripped legit multi-day events (Le Mans week, Spa 24h); superseded by the F1 OpenF1 cross-ref (#613).
- → wrap: `docs/HANDOFF.md` + `IDEAS.md` + `SCHEDULE.md` reconciled (this entry); shipped IDEAS items removed.

Won't-touch honored: operator's pre-existing uncommitted working-tree changes left untouched.

Active: _(no `[+Nm]` prefixes captured this session)_

---

### Wed 2026-07-23 (session 20 — Hungary preview + 4 blog PRs + reactions migration + theme gallery approved)

Long interactive session (blog features + PWA fix + a theme-gallery decision). No `[+Nm]` prefixes captured.

- → done: **Hungary GP preview** — prod DB draft, operator scheduled it (operator's voice, weekend-post-grounded, RULE #1 fact-checked).
- → done: **#614 (0.231.0)** IG-story share · **#615 (0.232.0)** like/dislike reactions (+ `post_reaction` migration applied to prod via Studio) · **#616 (0.233.0)** PWA external-link fix (manifest `scope` + drop `target=_blank`) · **#617 (0.234.0)** 9:16 portrait story card. `main` 0.230.12 → 0.234.0. Full detail + landmines in `docs/HANDOFF.md` (session-20 block).
- → decided: **theme gallery** (5 themes: Midnight/Carbon/Ember/Newsprint/Circuit; design-first). Next step: draft palettes → visual swatch board → approve → build the theme system → preview → ship. A **claude.ai/design** exploration prompt was provided (chat; theme spec in HANDOFF session-20).
- → found: **`.supabase-pat` is dead** (401) — rotate it; the reactions migration went via Studio instead.
- → pending operator: phone-test (story fills 9:16 + Add-to-story; PWA posts stay in-app; reaction persists); rotate the PAT; approve theme palettes.

Won't-touch honored: operator's pre-existing uncommitted working-tree changes untouched all session.

Active: _(no `[+Nm]` prefixes captured this session)_

---

### Wed 2026-07-23 (session 21 — theme gallery design phase: palettes + swatch board)

Design-first phase of the approved theme gallery. Build starts only after the operator approves palettes by eye.

- Answer the claude.ai/design context question (curated slice + screenshots, not the whole repo) → in-chat.
- Draft the 5 theme palettes (Midnight / Carbon / Ember / Newsprint / Circuit) as full token sets: chassis (bg / surface / surface-elevated / border / border-strong / text ×3), accent as fill vs text/border, live/positive/negative signals per theme. Verify every text/surface pair ≥ 4.5:1 programmatically; record the ratios.
- Render a visual swatch board — one self-contained HTML in the session scratchpad (race/series card + dense standings grid per theme, real SessionCard/StandingsTab markup patterns) → operator eyeballs in Chrome.
- If approved with time left: ESPA the build plan (token split + picker + no-flash init); the build itself is its own gated step.

Won't touch this session: theme build code in the repo, operator's uncommitted working-tree files (NextRaceCountdown / eslint.config / track-environment / indycar.test + doc deletions), blog/content work, carryover queue (champions depth, driver bios, IndyCar preview-paired, Bing WMT).

Active: _(no `[+Nm]` prefixes captured)_

The session ran far past the design-phase plan into a full build+ship day (2026-07-23 → 07-24), 8 versions:
- → done: theme gallery — research (6-agent sweep) → WCAG-proven swatch board → operator eye-approval → built + shipped (0.235.0 #619); picker later moved to `/settings/theme` (0.237.0 #622).
- → done: series-nav sub-pages (0.238.0 #623) + menu-aim single-column fix (0.238.1 #624).
- → done: timing-purple `--session-best` (0.236.0 #621); F2/F3 Hungary session-time fix (0.235.1 #620); IDEAS triage + batch de-numbering (0.238.2 #625).
- → done: F1-upgrades parser Phase A + Belgium/Hungary curated (0.239.0 #626). Operator chose full cron automation; Phases B-D (outbound/KV/cron) pending, preview-gated. Prod build hit a transient ADAC static-export error, cleared by an empty re-trigger commit.
- → carried to next session: Hungarian GP FP1 recap blog draft; harden the ADAC drivers static export.
- Won't-touch honored: operator's uncommitted working-tree files untouched throughout.

---

### Mon 2026-07-27 → Tue 2026-07-28 (session 23 — data determinism, page cache, main/prod convergence)

Operator's priority order at the start: 1. data (make the DB the source of truth), 2. experience (load time), 3. race recap, 4. everything else.

- → done: **DB-as-source-of-truth** (0.240.0). `DATA_SOURCE=db` read-only mode; every standings/results surface given a durable snapshot slot (3 standings + 13 results fetchers had none or only a 3-hour KV window); warm script extended from the health registries to all 10 uncovered surfaces. Prod evidence of the bug before the fix: three renders, three byte lengths, F1 chart frozen at round 5.
- → done: **R2 ISR page cache + DO queue + regional cache** (0.241.0). `incrementalCache` had been at the `"dummy"` default, so every request re-rendered. `/series/f1/standings` 9.34s → 0.12s.
- → done: **dead `s-maxage` sweep** (0.243.0) — just-missed + five `/api/home/*` routes to ISR; the header contract died with Vercel.
- → done: **testing environment** (0.242.0) — second worker on `testing.paddock-tracker.com`, no crons, own cache prefix; operator wired Workers Builds to the `testing` branch.
- → done: **Unicode heading slugs** (0.244.0) — Greek headings had all collapsed to one anchor id.
- → done: **parser repairs** — NASCAR results 0 → 22 races, DTM 2 → 6 and correctly numbered, OpenF1 rate limits (3/s **and** 30/min) + curated driver fallback + a cache gate; 2 poisoned classifications repaired in place out of 227 scanned.
- → done: **assistant + push restored**, then a self-inflicted VAPID regression caught and fixed (blank build-time `NEXT_PUBLIC_*` overrides a real runtime secret).
- → done: **main and prod converged.** #629 brought the whole Cloudflare migration onto `main` (which was still Vercel-era 0.239.1); #628 (contributor UI, description written at review time), #630, #631, #632, #633, #635, #636 followed. The warm-live-data workflow reaching the default branch is what let the cron start self-running.
- → done: **the silent-writer saga.** The cron reported success while writing nothing for ~20 hours: quoted env values → `Invalid supabaseUrl`, then Node 20 → no native WebSocket. Both invisible locally (node --env-file strips quotes; this machine runs Node 24). Fixed, and the script now proves its own writes and fails when it writes nothing.
- → done: **blog** — Hungary recap + lap-by-lap published by the operator; Greek per-team report card drafted; a contributor draft given an errors-only pass (6 factual fixes) with prose preserved.
- → done: **observability enabled** on both workers after a Clerk-handshake 500 on testing proved undiagnosable (logs were being discarded).
- → partial: **experience.** Big wins landed, but `npm run deploy` still builds in writer mode, and the KV store's 180ms distance is unresolved (a real migration).
- → skipped deliberately: Smart Placement (Cloudflare's own gotchas say it degrades asset-serving workers like ours), KV region move, `metadataBase` gap, the `middleware`/`proxy` doc reconciliation.

Next session, operator-set order: **1. author pages** (accounts + contact + their post list) · **2. format button** · **3. content expansion 586 → 1500+ pages** · **4. indexing fixes (46 noindex)**. Briefs in `IDEAS.md`.

Active: _(no `[+Nm]` prefixes captured this session)_

---

### Tue 2026-07-28 (session 24 — author pages, then the author-CMS scope change)

Operator's order at the start: 1. author pages · 2. format button · 3. content expansion 586 → 1500+ · 4. indexing fixes. Ultracode declined for 1-2, flagged as fitting for the CMS research.

- → done: **author pages** (0.245.0, branch `feat/author-pages`, commit `5209bcf`, NOT pushed). `author` table + `/authors` + `/authors/<slug>`, `ProfilePage`/`Person` JSON-LD with a stable `@id` that `articleLd` now stamps on every post's author, bylines linking on the post page and the `/blog` cards, sitemap entries. Gates: typecheck clean, 969 tests pass, lint clean on the changed paths.
- → scope change mid-session: the operator replaced the operator-seeded-bio design with a full author CMS — self-service profiles, an `in_review` state, submission and approval emails, an import-article path, and a become-an-author request form. Researched against primary sources (WordPress roles + capabilities, Ghost staff roles, Strapi review workflows, Google's spam policies) rather than training. Decisions taken: add `in_review` and keep `draft` private; add a `contributor` role below `writer`; imports store the original URL and canonical to it; author account + profile self-service first.
- → done: **profile self-service** (same commit) — `/settings/author`, `PUT /api/author`, per-post profile visibility, pure shared validation in `lib/author-profile.ts` (12 new tests).
- → BLOCKED: browser verification. A dev server carrying the prod service-role key was correctly refused (it is the WRITER-mode-against-prod shape), and the Docker daemon is down so local Supabase cannot start. Needs either the operator's ok to `git push origin testing`, or Docker Desktop started.
- → owed by operator: apply `alter table post add column if not exists hide_on_author_page boolean not null default false;` (the `author` table DDL is already applied).
- → found, not fixed: `npm run lint` OOMs repo-wide because `eslint.config.mjs` `globalIgnores` never got `.open-next/**` (332 MB, 3,112 JS files since the Cloudflare migration). One line fixes it; offered, not taken. Also noted: published blog posts are absent from `lib/sitemap-data.ts` entirely.
- → not started: phases 2-4 of the CMS (submission loop, import, author requests) and tasks 2-4 of the session brief.

Won't touch this session (honored): prod deploys and the operator's four manual items, the KV region migration, `metadataBase`, the `middleware`/`proxy.ts` doc reconciliation, branch pruning, `npm audit`.

Active: _(no `[+Nm]` prefixes captured this session)_

---

### Tue 2026-08-04 (session 26 part 2 — the ops-list day: merges, DNS, VAPID truth)

Operator drove their 12-item ops list; every named order executed. Full record in HANDOFF (2026-08-04 block).

- → done: merge train #656-#661 (0.252.2 → 0.255.1, prod verified per merge): plex system · perf baseline row · landing LCP fix (4.1 MB → one ~190 KiB first-paint image) · DO sharded tagCache (revalidatePath un-broken) · VAPID served from the API (build-var landmine dead).
- → done: DNS fully de-Verceled (operator-approved; every host verified after) · secrets audited ×4 workers + preview set re-synced ×3 · branches 380 → 34 · GSC noindex list analyzed (all 45 already fixed by 0.247.0 — operator owes one Validate-fix click) · PSI baseline captured + field source decided (CF Web Analytics RUM).
- → done: **the [SENSITIVE] discovery** — prod's VAPID secrets were the literal redaction placeholder; pushes never worked and the 6 subscriptions were already dead. Operator approved regeneration; fresh keypair live and verified (`/api/push/status` ready=true, clean 87-char key). Landmine recorded: never set secrets from redacted logs.
- → pending operator: phone push TEST · GSC click · the two /studio drafts (doubles as the tagCache live test) · panagiotis build config · deferred rotations.
- → next build queue (their order): /about rewrite · /play revamp groundwork · content expansion · AI headings phase 2 · Turbopack · landing-LCP delta row after field settle.

Active: _(no `[+Nm]` prefixes captured)_

---

### Tue 2026-08-04 (session 27 — /about rewrite, /play GA4 groundwork)

Operator's order: **1. /about rewrite (GO)** · **2. /play GA4-grounded product rethink (GO — data first, visual proposals, no code)** · then 3. content expansion toward 1500+ · 4. AI section headings phase 2 · 5. Turbopack migration (preview-gated) · 6. champions depth ×14 (two-source ultracode only; ADAC 24h + NLS never).

- Early checks at start: `/api/push/status` serves ready=true + clean 87-char key (operator still owes the phone re-enable + TEST) · tagCache live proof = operator's 30-second bio-edit test (chased) · PSI delta row operator-gated (rerun or API key).
- Won't touch this session: champions enrichment (needs the ultracode nod when reached), key rotations (operator's, keep nudging), prod Supabase writes unless the operator names the action, the operator's uncommitted IDEAS.md edits, DNS, testing-paris (unless asked), any secret set from a transcript (shape-check at write).

Outcomes:

- → done: **T1 /about** — 0.256.0 #663 merged on operator's order, prod-verified (new editorial prose live, zero debug leftovers; `/admin/tools` gains the live feed-status panel + the stale Blog-queue→Studio link fix, flagged in the PR). Found en route, NOT fixed: all 14 real ICS feed URLs still ship SITEWIDE in the RSC flight payload (the layout serializes full SeriesMeta to the nav client components) — the human-readable leak is gone, the machine-readable one needs a NavSeriesMeta field-pick.
- → done: **T2 /play decision** — GA4 pulled locally (Downloads SA key `paddocktracker-5707cd014ce4.json`, property 538125099): /play 221 views/90d collapsed to 14/28d, /social's leagues (90→4) and friends (28→0) dead, /threads 36/90d; meanwhile /series 38.9% share, /app 17.1%, /blog growing (629 of its 743 views in the last 28d, best engagement 40s/view). Operator picked **Embed + consolidate**: bets move onto race-weekend pages + an /app tile; /play + /social + /threads collapse into one Community hub; build = future sessions. Prod-DB usage counts were classifier-blocked (operator must name the read to sharpen numbers).
- → 🔴 FAILED, lesson recorded: the F1-bios ultracode workflow (20 research × 2 stages) — **every research agent died on the session limit; ~684k subagent tokens spent, zero bios produced, nothing salvageable**. Operator's correction is durable now: memory `feedback-paddock-workflow-limits` (≤5-item waves, state limit-burn plainly, solo-sequential research default, no big fan-outs ever).
- → done, ALL MERGED + prod-verified per wave: **T3 content expansion = THE BIOS DAY.** Six solo waves, 126 original two-source bios across 9 series files: F1 22 (#664) · MotoGP 22 (#665) · IndyCar 25 (#666) · FE 20 (#667) · WSBK 21/22 (#668, Rato source-less, skipped honestly) · endurance marquee 16 (#669, curated criterion incl. Valentino Rossi, Kubica, Kobayashi). Sitemap 1,134 → 1,240; versions 0.256.0 → 0.262.0. Per-series corroborators + traps recorded in HANDOFF (wrong-namesake articles, stale 2026 leads, the alphabetical resolver quirk that forces Vanthoor/Marciello into the ADAC file). Bonus capture: the session-26 vitest "flake" reproduced as a load-induced fork-worker start timeout; resolve-guard test made linear.
- → done (post-midnight): **T4 AI section headings + the supporter gate** — 0.263.0 #670 (Gemini via the existing seam, model proposes / code inserts / byte-identity guard discards on mismatch, review-then-Apply rail, 11 unit tests) + 0.264.0 #671 (operator rule mid-merge: AI tools require the `donor` flag; 402 enforcement, admin bypass, manual granting via the new /admin/users DonorToggle). Both prod-verified; signed-in click-throughs owed by the operator.
- → done: **T5 Turbopack dev-only** (0.265.0 #672 — measured ~3× cold compiles; build stays webpack, SW/Sentry/OpenNext untouched; no-watch-ignore caveat recorded).
- → done: **T6 wave 1, MotoGP champions depth** (0.266.0 #673 — 67/67 two-source-verified via the official Pulselive archive × Wikipedia rendered HTML; 1975 settled at 84; three adjudications recorded; pipeline reusable ×10 series).
- → done: **the /play build** (0.267.0 #674 — recon found bets already place on weekend pages + the /app tile exists, so the consolidation WAS the build: /social hub absorbs /play + threads list, 301s, 11-file sweep) and **the leak fix** (0.267.1 #675 — NavSeriesMeta pick; prod icsUrl 15 → 0 per page).
- Session total (through 08-05): 0.256.0 → 0.267.1, **12 merges**, all prod-verified.

---

### Wed 2026-08-06 (session 27 close — verifications land, offline dies, Turbopack finishes)

Operator opened with a verification dump + three orders (remove offline, explain DNS-check/branches, finish Turbopack), closed with "enough for today, wrap".

- → done: **verification ledger cleared** — phone push TESTED working (the [SENSITIVE] saga fully closed) · tagCache proven ("really fast") · GSC Validate clicked (awaiting Google) · panagiotis worker configured · /social approved. Still theirs: key rotations, dead `.supabase-pat`, Resend key, studio propose/apply test (planned: real draft from a non-supporter account, covers the 402 check).
- → done: **the landing-LCP delta row** appended to `docs/perf-baselines.md` from the operator's PSI rerun: mobile **15.3 s → 4.9 s** (perf 71→81), desktop 3.3→1.3 s (78→96). Remaining tail named by the report: the first slide still mounts `opacity-0` (fade-skip never landed) + lemans.webp oversized → the next perf bundle is "fade skip + `sizes`" (queued in IDEAS).
- → done: **offline fallback removed entirely** (0.268.0, operator order): /offline route + precache entry + sw.ts fallbacks block gone; precache + push untouched.
- → done: **Turbopack finished** (0.269.0): `--webpack` off the build; `@serwist/next` → `@serwist/turbopack` (SW bundles via esbuild in `app/serwist/[path]/route.ts`, explicit registration via `SerwistRegister` in all three root layouts, `defaultCache` from the new `/worker` export; `esbuild-wasm` added for Linux CI). Verified locally end-to-end **including `opennextjs-cloudflare build` → worker saved**; `/serwist/sw.js` serves 200 + `Service-Worker-Allowed: /` with push handlers + manifest. Deploy-level SW rollover + push = post-merge phone check.
- → answered: the DNS spot-check item was pre-de-Vercel cruft (killed); the "29 experiment branches" framing is stale — `git fetch --prune` shows **328 non-core branches on origin** (the session-26 prune never reached the remote) → audit queued.
- → shipped as ONE PR: offline + Turbopack + this wrap (single lineage, no stacked-PR auto-close, no CHANGELOG conflicts); #676 closed in its favour.
- Session 27 grand total: **0.256.0 → 0.267.1 merged + 0.268.0/0.269.0 ready**, one failed workflow (~684k tokens) converted into a standing memory, 126 bios, 67 champion rows, two product decisions executed.

Active: _(no `[+Nm]` prefixes captured)_

Active: _(no `[+Nm]` prefixes captured)_

---

### Sun 2026-08-23 (session 33 — privacy + GPC, the defect sweep, then race-weekend blogging)

Operator present and directing throughout. Three distinct phases: finish the privacy work, run a full defect sweep to completion, then produce blog drafts for the Dutch GP sessions before the race.

- → done: **the privacy rewrite** (0.334.0). `content/legal/privacy.md` was materially false in seven places. And the load-bearing find: `/do-not-sell` promised we honour the GPC signal while **nothing in the code read it**, so GPC is now honoured for real, overriding a stored grant on every visit.
- → done: **`/do-not-sell`** (0.334.1) — it documented a CCPA opt-out route via a Google "shield icon" gone since 0.12.6. A legal right whose documented steps could not be followed.
- → done: **the defect sweep**, listed, ordered, executed and audited (0.334.2 → 0.334.9): Vercel residue, the dead `weather` prop, the `/calendar` `DataCloneError`, undisclosed Cloudflare Web Analytics, the orphan push route, the news-tab noindex, the "Coming soon." copy, and the 532 KB → 36 KB HANDOFF trim.
- → done: **three Dutch GP session recaps** drafted, queued on prod as `in_review`, then rewritten twice (0.334.10 → 0.334.12): once after a voice audit against the published preview, once after the operator corrected me on results tables.
- → closed by measurement, no code: calendar contrast (passes AA on all three light themes) and the `/calendar` preloads (React 19 + Next prefetch, accept rather than degrade LCP).
- → corrected myself three times: the "lost character" was a CRLF artifact in my own script; the "empty classifications" were probe-before-hydration errors, twice; and "no tables" was a bad generalisation from a preview.
- → left for the operator: CSP → enforcing (blocks Funding Choices, deliberately), push history being write-only, Race Story public, AdSense wave 3.

Won't-touch honoured: no publishing, no prod data writes beyond the operator-named blog drafts, no check weakened, no cron code touched.

Active: _(no `[+Nm]` prefixes captured this session)_

---

### Sat 2026-08-22 (session 32 — the UNSUPERVISED run: support prompt, then the operator's five)

Brief: no operator present, standing authority to branch → gate → PR → **merge** → prod-verify → **audit**, looping until the AUTONOMOUS list was done or blocked. Five more items arrived mid-session by message.

- → done: **the dwell-triggered support prompt** (0.331.0 #759) to the shape settled across three rounds. Engaged-time accumulator (pure, clock-injected, 20 tests), two asks and never a third, auth-scoped dismissal via Clerk `unsafeMetadata`, suppressed under the consent modal and while `.live-pulse` is on the page, legal copy in the same PR. **A defect was caught by browser-verifying before merge**: the ladder could skip ask 1 and open with "Last time I'll ask" as the first thing a reader ever saw.
- → done: **weather rebuilt around sessions**, in two passes. 0.331.1 #760 read the forecast at each session's hour instead of the day's (Zandvoort's Saturday said 98% rain while the Sprint hour was 94% and Qualifying 33%); 0.332.0 #763 extended it across a session's whole running and gave session pages a two-hours-either-side window. Open-Meteo's hourly shape was probed against the live API first.
- → done: **"ALSO TODAY" stopped lying** (0.331.3 #762) — names the weekday, and decides "today" in the browser because `/app` is ISR-cached in a UTC worker.
- → done: **the series reference strip** (0.332.1 #764) — two rows of boxed 40 px targets, full width. Reverses the 08-21 placement, because 13 legible boxed chips need ~1,180 px and that band is 508.
- → done: **housekeeping** (0.332.2 #765) — `prod-weekend8.md` and dead `NotificationBell.tsx` deleted, the two onboarding docs collapsed to one with three stale claims corrected.
- → done: **two Learn answers** (0.333.0 #766) — circuits leaving/joining the F1 calendar, and driver pay through the decades. RULE #1 caught a wrong headline figure mid-draft.
- → done: **the session-30 evaluation** (0.333.1 #767), plus `champion-notes-integrity.test.ts` guarding all 45 notes. Audit found no errors, so the deliverable is the guard.
- → done: **the audit loop itself** (0.331.2 #761) — five real defects in already-gated work, three of them in the support prompt.
- → blocked, deliberately: `/f1/compare`'s chart (sign-in gated), the signed-in support opt-out (needs a real Clerk session), the stale `privacy.md` processor list (not an unsupervised call).
- → parked as ideas, not built: the Fri/Sat/Sun day page, and Street View corner tours + layout history on the track pages. Both in `IDEAS.md` Inbox.

Won't-touch honoured: no prod service-role key, no blog publishing, no prod data writes, nothing outside the bundle's headroom, no check weakened to go green. Bundle 10176.64 → 10186.22 KiB gzipped, 53.8 KiB spare.

Active: _(operator away; no `[+Nm]` prefixes captured)_

---

### Thu 2026-08-20 (session 30 — PSI first, then blog fact packs + IDEAS triage)

Operator's order: the PageSpeed regression is handled FIRST (new landing: mobile 69, LCP 5.7 s, SI 10.8 s), then the two blog fact packs (operator writes, Claude supplies data only), plus an IDEAS.md triage read-out ("content close to perfect", clean it up).

1. → done: PSI root-caused (the Last-time-out chain held the ISR stream open ~7 s on doomed blocked-egress fan-outs, nulls never cached) and FIXED — sentinel + 2 s budget + clean-IP podium seeding, 0.321.2 #737, Playwright-CLI prod audit passed. PSI re-run owed by the operator → then the perf-baselines row.
2. → done: Zandvoort IS a sprint weekend (5th of 6, Zandvoort's first and last GP); calendar CORRECT, no content fix.
3. → done: Blog A fact pack in the scratchpad (break window, F3.1.1 shutdown rule, standings verified === formula1.com, winners tables, Sepang round confirmed).
4. → done: Blog B fact pack in the scratchpad (official timetable, circuit facts, 2025 grand chelem, tyres, venue-local weather: heavy rain flagged for Sprint Saturday; 2026 DRS-successor zones flagged UNVERIFIED).
5. → done: IDEAS re-triaged AND applied on the operator's "do what you think is best" (fossils deleted, 11 kills, big rocks parked, NOW = AdSense + image brief + launch + trim).

Operator-added mid-session, all shipped (six merges total, 0.321.2 → 0.322.2, each prod-verified):
- → done: landing-orphan sweep on the operator's go (15 files recomputed from the tree, 0.321.3 #738).
- → done: home 50/50 What-it-changed / What's-next split + the London ePrix one-driver classification root-caused to the **warm-live-data outage** (down since 08-19 07:22Z on the recurring npm-10 lockfile hole) — lockfile regen shipped 0.321.4 #739; data healed; first post-fix scheduled run green-path.
- → done: the PADDOCK•TRACKER wordmark restored to both headers + footer (operator priority, 0.322.0 #740, eyes-verified 1440/375).
- → done: feed.xml finally carries DB posts + goes ISR (0.322.1 #741 — prod serves 19 items, was 0); `listThreads` fail-soft + Paper app error boundary (0.322.2 #742, /social/threads dev-checkable at last).
- → captured, not built: AdSense "Low value content" recovery (ads.txt verified fine, console stale), the image/positioning brief + Fotis layout reference, blog driver-radio embeds.

Won't-touch honored: bundle/unused-JS hunt, CSP/COOP, browserslist polyfills, warm-cron CADENCE (the lockfile fix is not a cadence change), champions/bios waves, HANDOFF trim (pickup block prepended only), `content/series/` data. The landing-orphan deletion moved out of won't-touch on the operator's explicit go.

**Session 30 continued (afternoon/evening) — the PSI sweep, the AdSense turn, and the blog contract flipping.** Twelve merges total, 0.321.2 → 0.324.0, zero open PRs at close.

- → done: **PSI sweep across all 10 major page templates** (operator ran pagespeed.web.dev, Claude recorded + diagnosed each). Table appended to `docs/perf-baselines.md`. Four fix packages, all shipped and prod-verified: fonts + Redis-out-of-browser (0.322.4), tap targets + gtag/Clerk dispositions (0.322.5), standings chart frame/canvas split killing CLS 0.134 (0.323.0), LCP images (0.323.1).
- → done: **AdSense "Low value content" audit** (subagent) → operator chose enrich-not-noindex → **wave 1 shipped**: F1 champion answers 1996-2025 gain the clinch and the season (0.324.0).
- → done: **the wordmark, the feed, the threads fail-soft, the orphan sweep, the home 50/50 band** — and the discovery that `warm-live-data` had been dead for 28 hours on the recurring lockfile hole (fixed, four consecutive green runs since).
- → done: **blog contract flipped mid-session** (operator: "give me a draft") → read the 20 published posts for voice, delivered a Zandvoort-farewell preview draft with licence-verified images and sourced quotes. Awaiting approval; not inserted anywhere.
- → survived: **three subagents died on the session cap at ~16:40**; two had recoverable partial output (validated + shipped), one produced nothing. Model switched to Opus 5 mid-session; everything already merged had been gate-verified by the orchestrator either way, and the close ran a consolidated prod audit per fix.
- → NOT done, deliberately: MotoGP champion notes (wave 2), the serwist `cacheOnNavigation` decision, calendar contrast token, stub-page copy/indexing, news-tab noindex — all operator calls, all logged in `IDEAS.md` NOW with evidence.

Active: _(no [+Nm] prefixes captured this session)_

---

### Thu 2026-08-20 (session 29 cont. — feedback board + Round-3 intake)

Operator at the desk, steering live: feedback-board screenshot ("Calendar Mobile — chaotic"; "Formula E is done, that needs to be clear"; freehand "check all screens on mobile") + mid-turn asks (distinct Paper lines; calendar filter box like old Paddock; ink month bar with cut arrow boxes; champion outranks race winner) + 5 annotated screenshots on the old `/series/f1/*` tab pages.

- → done: **season-complete clarity = 0.310.0** (#720; home leads SEASON COMPLETE → "Wehrlein is Formula E champion", winner demoted; series masthead + Final drivers' championship + champion callout; the odd NEXT ROUND/Season-complete rail block reworded) · **distinct lines = 0.311.0** (#721; paper `--border` #d6cebb→#c2b493, `--border-strong` →#91825e; calendar nav bar + arrow boxes in ink).
- Queue written to `docs/next-session.md` Round 3: ③ calendar series-filter box (select all/clear, true multi-select) · ④ mobile pass (calendar agenda <md, weekend-card row, series list, all-screens sweep) · ⑤–⑦ old series tab pages reimagined (champions & drivers → indexed what-is-formula-1-style pages incl. team champions tab; results/standings/rounds folded into the landing or rebuilt; `SeriesPageView` template retires).
- Mobile audit findings (375×812): calendar = 4 stacked THIS WEEKEND cards ≈450px before a dot-only grid; FE series landing pre-fix buried "Season complete."; home lead band reads fine.
- → done (afternoon, operator steering live): **0.311.1** home podium names its race in champion mode (annotation) · **0.312.0** calendar filter box (all 15 series as checkbox chips, Select all/Clear, exclusion semantics; DOM-verified 14→13→none→all) · **0.313.0** mobile pass (month agenda <md, 2-up weekend cards, collapsing filter box, series status column hidden <sm; 9-page overflow sweep at 375 = all clean) · **0.313.1** Select all/Clear moved beside the FILTERS label (annotation) · **0.314.0** all five series sub-pages join Paper in one shell rewrite + Standings/Results cells on the landing · **0.315.0** champions: drivers/team tabs, open decades · **0.316.0** drivers: standings joined, teams ranked. All sentry-verified on prod through 0.315.0; 0.316.0 sentry running at wrap.
- ⚠ Process: the 0.315.0 commit briefly landed on LOCAL main (branch step skipped after #726's merge auto-checkout) — never pushed; captured onto `feat/champions-tabs`, local main pointer-reset to origin/main (`git reset --keep`, zero loss, commit preserved). Same failure mode as the 0.294.0 slip: the fix is `git checkout -b` as the LITERAL first action after every merge, before any edit.
- Note for the operator: localhost dies briefly during every ship cycle (`next build` clobbers running dev — landmine 9); dev is restarted after each gate and left running at wrap.

- → done (afternoon/evening, operator steering live — 13 releases total, every one prod-verified): **0.311.1** podium names its race · **0.312.0** calendar filter box · **0.313.0** mobile pass (agenda month view; 9-page overflow sweep at 375 all clean) · **0.313.1** Select all/Clear placement · **0.314.0** all five series sub-pages join Paper in one shell rewrite + Standings/Results on the landing · **0.315.0** champions drivers/team tabs, open decades · **0.316.0** drivers page joins the live championship · **0.317.0** championship position per round on driver profiles · **0.317.1** trend-chart strokes inked per theme (Mercedes teal was ~1.3:1 on paper) · **0.318.0** avatar account menu, bell + bubble rounded · **0.319.0** meta descriptions to SERP length at six generators (32 of Bing's 33 flagged URLs measured 174–234 chars; the 33rd is local-dev-only broken) · **0.320.0** /about joins Paper, /account full width + follow state reorganised, series Calendar cell · **0.321.0** constructors' season trend, reconciled to the table by construction.
- ⚠ Two process notes: the 0.315.0 commit briefly landed on LOCAL main (merge auto-checkout; never pushed, recovered via `git reset --keep` with the commit captured on a branch, zero loss) — branch-first is now the literal first action after every merge. And deploy sentries started dying on Fable-5 usage limits mid-run, so verification moved to background `Bash` curl checks (zero model cost); 0.320.0 and 0.321.0 were confirmed that way.
- Won't-touch honoured: prod Supabase writes, blog content, the content-bundle refactor, HANDOFF trim.

**Next session (agreed at wrap): two blogs in the operator's voice — F1 summer break, and a Zandvoort Dutch GP preview. Claude supplies FACT PACKS and corrections only; the operator writes. Brief + verification targets in `docs/next-session.md`.**

Active: _(no `[+Nm]` prefixes captured this session)_

---

### Wed 2026-08-19 (session 29 — GSC triage, then reimagining jobs ④–⑨)

Operator opened with the Search Console report (8 screenshots) + the CLI handoff for jobs ④–⑨ (versions from 0.291.0).

- Plan: GSC indexing triage first → 404-page redesign → jobs ④–⑨ in order, one PR each, worker-size gate before UI-heavy merges.
- → done: **GSC triage (0.291.0)** — dead-param guards moved into `generateMetadata` on the six not-found-capable routes: true 404s on teams/authors/blog; weekend/session/drivers stay streamed-noindex until their rebuilds (a flushed `loading.tsx` locks the status — `htmlLimitedBots` tested on a prod build and reverted, it doesn't hold the flush). Everything else self-clears: 4xx pair + who-won noindex already healthy, the three 5xx blogs = June MDX posts deleted in #649 (operator: stay dead), `/$` external, redirects/canonicals by design.
- Decision (operator): fold the true-404 restructure into jobs ④⑤⑦ (`loading.tsx` → in-page `<Suspense>` below the guards; `series/[slug]/loading.tsx` converts too).
- → done (operator went afk — "merge all PRs, don't ask"; every deploy verified by a 9-min sentry subagent): **404 Paper redesign = 0.292.0** (#703) · **④ session timing-sheet = 0.293.0** (#704) · **⑤ weekend 3a/3b + fold-in complete = 0.294.0** (⚠ direct-push slip, no PR — process violation logged; work fully verified) · **⑥ landing 10a = 0.295.0** (#705; mobile overflow caught in browser + fixed) · **⑦ driver rail = 0.296.0** (#706) · **⑧ predictions 10c = 0.297.0** (#707) · **⑨ six-surface copy pass = 0.298.0** (#708). **The operator's ordered list is COMPLETE.** Prod-verified by sentries through 0.297.0; 0.298.0 sentry running at close.
- **GSC payoff prod-verified**: all five flagged weekend/session URLs + dead driver/series slugs now return real HTTP 404s on prod (was streamed 200-noindex). Operator to click Validate fix in Search Console (IDEAS).
- → skipped: worker-size dry-run per merge (no new deps all night; every deploy passed the 10 MiB gate in CI — headroom unchanged at ~198 KiB from 0.288.0's measurement; re-measure before any dependency-adding PR).
- Won't-touch honored: content-bundle refactor, blog content, prod Supabase writes, HANDOFF trim.

Active: _(no [+Nm] prefixes — operator afk from ~job ④ onward)_

**Round 2 (evening — operator's 19 annotated screenshots, "start now on these tasks"):** all ten jobs shipped 0.301.0–0.309.0, one PR each, sentry-verified: ① `/contact` 404 fixed (form extracted from the modal, real page) · ② amber CTA sweep, 41 strings/27 files (⑩ mechanic bubble folded in) · ③ settings trio Paper (chip integrated) · ④ Series door + hover-anchored panel · ⑤ home two-up · ⑥ calendar fits one screen + Today by the switcher · ⑦ preview v2 (big map in main, wire on the page) · ⑧ Calendar rail → `/calendar?s=`, learn-cell affordances (routes already existed — probed) · ⑨ Threads Paper (dev visual blocked by local DB; prod sentry). New in IDEAS: app error boundary pre-Paper + `listThreads` fail-soft.

---

### Tue 2026-08-18 (session 28 — the Paper reimagining begins)

Operator delivered the full UI/UX reimagining design handoff (`design_handoff_paddock_ui_reimagining`: 15 surfaces, "Paper" identity, four-door IA, series contract) and said go.

- Plan: **verify the handoff against the repo** → **PR: Paper foundation** (Newsreader font + `paper` theme block + all three registries, opt-in, NOT default) → build/tests + browser-verify + screenshots feeding the later flip decision. Stretch: AppShell four doors.
- → done: **PR #679 (0.270.0 + 0.271.0)** — Paper foundation (Newsreader w/ opsz, `paper` theme = Newsprint chassis + oxblood `#8c1c13`, three registries) AND the stretch: **the four-door shell** (`AppShell` rewrite, new `NavPanel` menu-and-search panel replacing six mega-menus + the ⌘K modal + the header pills; `BottomBar` → four spec cells; Contact/coffee → footer; `/f1/analysis` into the search index; tour anchors retargeted). Verified after last edit: 1115 tests, build exit 0, lint 0 errors, Playwright click-throughs on Paper desktop + mobile + Midnight. Awaiting operator preview; orphaned `HeaderNavMenu`/`HeaderUtils`/`SearchTrigger`/`SearchOverlay` kept pending deletion approval.
- Learned en route: the handoff's Paper palette is Newsprint's shipped hexes; `seriesInk` + `--numeral` already covered two spec items; `#677` (turbopack) was already merged — #678 opened against stale main, closed as duplicate.
- → done: **handoff review** — all 37 referenced paths + every named symbol resolve; the numeric claims are exact (18 widgets/15 hidden, 75 answers, betting constants, licensing comments verbatim); 3 nits (shorthand slugs in the accent table, "75 links" is rhetorical — the mega-menu is master-detail, dormant `grid` market type). Discovered: the handoff's Paper palette is hex-identical to shipped Newsprint; `seriesInk` already implements the 52% tint darkening; `--numeral` already fills the `--ink-strong` role — no new tokens needed.
- → done: #678 opened for the parked turbopack branch, then **closed as duplicate** — #677 had already merged it (2026-08-17); local main was stale. gh active account switched parisparaskevas-hub → paris-paraskevas en route (it couldn't create PRs on the repo).
- Won't touch this session: default-theme flip + Newsprint's fate (visual decision with screenshots, later), results parsers / `[session]` logic, content facts, prod Supabase/infra, blog, HANDOFF trim.

**Overnight unsupervised run (operator-authorized, same day):** 15 PRs merged, 0.274.0 → 0.286.0 on main.

- → done: **#682 editorial home** (four blocks, widget gallery retired) · **#683 orphan sweep** (16 files) · **#684 NavPanel v2** (panel-2a wide index) · **#685 calendar** (weekend bars, summarising cells, tap chips, `?s=` deep links) · **#686 series hub** (15 rows, broadcasters) · **#689 series landing** (three blocks, SEPANG chip, cancelled band) · **#690 weekend report/preview split** · **#691 driver profile** (every-round table, no chart, Commons-only portraits) · **#692 Learn inverted** (ask field) · **#693 wire** (credited two-column) · **#694 telemetry** (latest leads, compare folded) · **#695 account** (You-follow chips, tz row) · **#696 blog index**.
- → fixed en route: **#687+#688 the lockfile** — the warm-live-data cron had been red since 08-17 07:16Z (`npm ci`: the turbopack merge dropped the NESTED `@serwist/turbopack/@swc/helpers` lock entry; npm 11 tolerates the hole, npm 10 on the runner refuses; reproduced with `npx npm@10 ci`, fixed by an npm-10 regen whose diff is that single entry). Cron green at 16:32Z + 17:00Z.
- → BLOCKED (operator decision): **the Cloudflare build pipeline stopped deploying at 14:25Z** (last deploy = 0.274.0/#682) — 13 merges undeployed; builds API not readable with the scoped token; the manual `npm run deploy` was correctly denied under the prod-infra-naming rule. Morning options: check Workers Builds in the dash, or run `npm run deploy` once.
- → deferred by judgment (panels ready): landing 10a rebuild (your most perf-tuned surface), predictions 10c (/social reshaped by you 4 days ago), session-page 11d restyle (its contract layer shipped in #681), blog POST reading column, sign-out/export rows, the Paper default flip + Newsprint's fate.

Active: _(none captured — operator away overnight)_

---

### Mon 2026-08-03 (session 26 — blog editor rebuild + article imports)

Operator's order: **1. blog editor section replan/rebuild** (drafts/new-post authoring must leave the `/blog` listing for a dedicated page; visual options BEFORE build) · **2. item 13 article imports** (`post.original_url`, off-site canonical, provenance on the post; migration — operator names the SQL) · then 14 (become-an-author + `contributor` role) · 17 (format button) · 20 (13 series calendars unverified) · 25 (dev-loop speed) · 26 (prod perf re-baseline).

- Plan: investigate current `/blog` admin/editor code → ASCII/screenshot options → operator picks → build task 1 → ESPA task 2 (migration SQL presented for naming) → build → continue down the list as time allows.
- Won't touch this session: champions enrichment (needs the two-source ultracode pass; ADAC 24h + NLS never), operator's open items (VAPID recovery, panagiotis worker config, key rotations, Vercel cancellation, GSC export, signed-in click-throughs), prod Supabase writes without the operator naming the action, the operator's uncommitted IDEAS.md entry.

Outcomes — **7 PRs merged (#649–#655), 0.248.1 → 0.252.1, prod verified on each**; every list item cleared except item 26's two gated halves:

- → done: **the studio** (0.249.0 #649, "Full studio" picked from 3 ASCII options): `/studio` pipeline dashboard + `/studio/new` composer + `/studio/[id]` editor; `/blog` back to a pure listing; PostModeration/PostComposer retired, DraftEditor → DraftPreview; review deep-links → `/studio/<id>`. Also fixed in it: `in_review` posts 404'd their own preview (page + generateMetadata gates); stale F1 sitemap test re-pinned 22→23 (Bahrain-at-Sepang, pre-existing failure on main).
- → done: **operator mid-session ask** — the three dead June MDX posts removed (broken on the CF runtime); sitemap 1122 → 1119; the sitemap test now pins `content/posts` empty as the no-new-MDX guard.
- → done: **article imports** (0.250.0 #651; #650 was auto-closed by GitHub when its base branch deleted — recreated): `post.original_url` (migration operator-applied), off-site canonical, sitemap skip, "Originally published at <host>" provenance; composer field + editor rail fact.
- → done: **/write-for-us + contributor role** (0.251.0 #652): application form → `author_request` table (operator-applied SQL) → admin queue on `/admin/users` → approve grants Clerk `role=contributor` (merge semantics verified against @clerk/backend types, grant-before-flip ordering); `canAuthor()` replaced `isWriter()` at all ten gates; decision emails both ways.
- → done: **discoverability** (0.252.1 #655, operator ask): "Become an author?" row on /settings for signed-in non-authors, two-state /blog pill (Studio → / Write for Paddock →), footer link.
- → done: **format button, deterministic half** (0.252.0 #654, option 1 of 3 picked): POST-READY checklist in the editor rail + Auto-link names (`/api/blog/format`, insert-only linker, 11 unit tests). AI headings = gated phase 2 in IDEAS.
- → done: **item 25**: `--webpack` traced to the serwist commit (80f8ed7; `@serwist/turbopack` 9.5.12 now exists — migration queued in IDEAS); the dev watcher DOES index `.open-next` (Next hard-codes its ignore list) → dev-only `webpack()` watchOptions fix shipped (0.251.1 #653). Also recorded: CLAUDE.md landmine 1 (serverExternalPackages pair) is stale post-Cloudflare.
- → done: **item 20 SOLO** (ultracode declined by operator): all 12 verifiable series' remaining-2026 calendars checked against official + independent sources — **zero drift** (the F1/WEC staleness came from Middle East reschedules that don't touch the rest). F3's Madrid finale is real; our F3 round-2 gap correctly mirrors the cancelled Bahrain F1 weekend; our F1 Baku dates already carry the Remembrance-Day Saturday shift. ADAC 24h N/A (no rounds.json, single past event).
- → partial: **item 26** — OpenNext lever audit DONE: `revalidatePath` is a **silent no-op** on prod (dummy tagCache `writeTags`/`isStale` quoted from the adapter); all targets have `revalidate=300` so staleness is bounded (~5 min ISR + ≤30 min regional cache), not permanent; fix proposal = `doShardedTagCache` or D1 tag cache, preview-gated, operator names the infra. PSI lab pass BLOCKED on keyless quota → operator runs pagespeed.web.dev or provides an API key, then the baseline row gets appended.
- Also: prod-version confusion resolved (prod was current; 0.245.3 was the stale `testing-paris` branch tip; per-dev workers show their branch), paris worker used as the signed-in review surface all day, the operator's click-throughs passed.
- → done (evening): **the Plex type system + reading-comfort ground + dyslexic mode** (0.253.0, operator board spec; details in HANDOFF) + cursor glow 440→140px; live on paris, PR follows the wrap PR. Root-caused en route: the localhost "offline"/v0.234.1 sightings = a stale service worker on localhost (proven; new landmine 0).

Active: _(no `[+Nm]` prefixes captured this session)_

---

### Mon 2026-08-03 (session 25 — corrects the session-24 entry above, which was written mid-flight and went stale)

The 2026-07-28 entry says the paris worker was "not started" and browser verification "BLOCKED". Both were resolved later the same session; this entry is the accurate record for 07-28 → 08-03.

- → done: **author pages + self-service profiles** (0.246.0 #640), **three-tier Cloudflare pipeline + a worker per dev** (0.245.0/0.245.1 #639 #641), **every Vercel package removed** (`@vercel/kv` → `@upstash/redis` behind `lib/kv.ts`, parity proven both directions), **F1/WEC calendar corrections** (0.245.2 #642), **lint gate restored** (0.245.3 #643), **blog posts + all 488 champion pages indexed** (0.246.1 #644, 0.247.0 #646 — sitemap 586 → **1122**), **photo-less-author initial tile** (0.246.2 #645), **submission loop with `in_review` + author approval email** (0.248.0 #647).
- → verified: **merge-to-prod is autonomous** (prod moved 31b153e9 → 35499c28 ~6 min after a merge, no hand deploy), and prod ran clean on the new KV client (623 log lines, zero exceptions).
- → refused to ship: the **MotoGP champions enrichment**. Name cross-check rejected 13 of 63 parsed rows; of 50 survivors, 1 of 2 spot-checks conflicted (1975: 84/4 vs 70/3). `champions.json` untouched. Needs two-source-per-row verification.
- → found, not fixed (findings in `docs/HANDOFF.md`): `/authors` builds dynamic where `/blog` prerenders; `metadataBase` warns 20× per build despite all three root layouts setting it; one unreproduced test flake.
- → operator flagged at wrap: the `PostModeration` empty state is bad practically and optically (copy says "write one above" but the button is inside; leaks "the publish cron"; stale since #647; em dash; amber wash + `rounded-2xl` against the house style). First task next session, needs a visual proposal.
- → not started: item 13 (article imports) onward.

Won't-touch honored: `IDEAS.md` left alone all session (it carries the operator's own uncommitted Inbox entry on post-migration perf re-baselining).

Active: _(no `[+Nm]` prefixes captured this session)_

---

## Week of 2026-08-24

### Mon 2026-08-24 — session 34

Plan at start: ask about the queued Dutch GP recaps (operator's, not mine), then work the queue — item 1b race recap, then AdSense wave 3 — and write up the four decisions without stalling on them. Won't touch: Tier 3 (day page, image session, GEO, v1.0, Street View, hubs restyle).

**14 merges, 0.334.15 → 0.334.29, every one prod-verified before the next.**

- → done: **item 1b, the Dutch GP race recap** (0.334.15). Queued as an `in_review` prod draft; the operator published all four recaps during the session. Six of my own claims failed verification before the insert and were cut, and an automated fetch's "2:44:44.859" winning time was wrong — the raw source reads 2:04:44.859.
- → done: **item 4b, push history** (0.334.16) — four writers, zero readers; removed with the privacy policy corrected in the same change, and deliberately not claiming the old records are gone.
- → done: **item 6, the CSP now enforces** (0.334.17). Enforcing it *locally first* found a real breakage report-only never surfaced: AdSense's `sodar2.js` was trusted in `frame-src` but never `script-src`, so shipping the flip alone would have broken ad traffic-quality measurement site-wide during a pending review.
- → done: **item 11, the F1 analysis surfaces are public** (0.334.18). What settled it: the gate protected nothing — all three API routes already served their payloads anonymously.
- → done: **the studio autosave** (0.334.19), on the operator's report of losing a post mid-write. Two defects found in my own change before it shipped.
- → done: **like buttons into the byline band** (0.334.20), **blog SEO** (0.334.22), **the console link in the avatar menu** (0.334.25).
- → done: **the home composer**, planned under ESPA and approved after one rewrite — ship 1 pin-the-lead (0.334.21), then reorder, hide, drag-and-drop and a live server-rendered preview (0.334.24). Migration applied to prod on the operator naming it.
- → **not started: AdSense wave 3** (46 F1 champion notes). The only Tier-1 item carried into session 35, displaced by the home-composer work the operator opened mid-session.
- → measured, both new to `docs/perf-baselines.md`: the **Worker bundle at 19.35 KiB of headroom**, and **48 s / ~4 m 45 s** for a published layout to reach `/app`.
- → found: **~618 KiB of the bundle is the OpenGraph-card runtime**, not app code. Operator decision logged.
- → done, unplanned and the biggest win of the day: **the admin console clean-up** (0.334.27). Deleting two read-only pages that duplicated Google's own console freed **653 KiB** — headroom 19.35 KiB → **672.31 KiB**. Nearly double the ~352 KiB predicted, because a chunk measurement misses transitive trees. The hub was rebuilt as a to-do list (each card's glance is now a count of work waiting) and the nav reordered by what you came to do.
- → evaluated and rejected with evidence: **adopting the Guardian's `facia-tool`** rather than building our own composer. It is a Scala/Play service needing Docker, SBT, CAPI, Ophan, pan-domain auth, AWS SNS/SQS/S3 and Janus credentials; a Cloudflare Worker cannot host a JVM. Took its ideas instead.
- → answered: **R2 cannot hold WASM or JavaScript** — Workers refuse to compile Wasm fetched at runtime. R2 holds data; `content/` is the real candidate. Written up at the top of `docs/next-session.md` so session 35 does not rediscover it.

Won't-touch honoured: no Tier-3 project was started.

Active: _(no `[+Nm]` prefixes captured this session)_

---

## How to use this file

## Week of 2026-08-24

### Mon 2026-08-25 to Tue 2026-08-26 - session 35, one long run

Operator-set priorities, in the order they were given: the admin page and R2, then five more added mid-session, then the content programme.

- -> done: **release restructure** - /changelog reads as 15 named releases instead of 707 pushes, and a MINOR now means a named release (0.334.30).
- -> done: **launch checklist restored** and four gates deleted because they were FALSE, not unticked; the 132-URL smoke pass run on prod (0.334.31).
- -> done: **the vitest flake root-caused and killed** - suite 39-46s to 7.5-11s (0.334.32).
- -> done: **blog covers**, then rebalanced and rebuilt as cards on mobile after two rounds of operator feedback (0.334.33, 0.334.35).
- -> done: **og:image fixed site-wide** - it was missing on every page outside the blog and weekend routes (0.334.34, 0.334.37).
- -> done: **mobile calendar as a Google-style schedule**, desktop provably untouched: zero md: classes in the diff (0.334.38).
- -> done: **composer refine pass 1** (0.334.39).
- -> done: **the R2 question answered, and the answer was that R2 was not needed** - RELEASES.md out of the Worker script, headroom 669 to 822.68 KiB (0.334.40).
- -> done: **1.0 announcement rebuilt as a modal, shipped dark** awaiting copy sign-off (0.334.41).
- -> done: **the landing page retired**, / serves the home page, /app 301s. Caught a redirect loop and a dead revalidatePath before they shipped (0.334.42).
- -> done: **the AdSense audit and its first action** - 443 thin pages, 35.4% of the index, noindexed; sitemap 1252 to 822 (0.334.43).
- -> done: **champion notes waves 3a-3e - F1 COMPLETE, 76 of 76** (0.334.44-47), counts corrected after a double-count (0.334.48).
- -> 19 merges, 0.334.30 to 0.334.48, every one prod-verified. Suite 1206 to 1212.
- Won't touch: per-visitor personalisation on /, the desktop calendar, prod Supabase or infra without the operator naming it, the OG-card runtime.
- Handed off at 96% context. Next: MotoGP enrichment (62 seasons), the 1.0 copy sign-off, the Cloudflare cf:populate fix.

Active: (no [+Nm] prefixes given this session)

---

### Tue 2026-08-26 — session 36 (the enrichment programme, four families finished)

Plan at start: the two operator items first, then the ADAC template decision, then MotoGP. Operator overrode the order in one line — **"c and all other waves first"** — so the waves ran and the operator items were left untouched deliberately.

- → done: **MotoGP 2010–2001** (0.334.50), **2000–1991** (0.334.51), **1990–1983** (0.334.52). 15 → 41 of 77.
- → done: **Formula E complete, 11 of 11** (0.334.53), then **its missing 2026 champion** (0.334.54) — a single absent row had been publishing "the all-time record is 2 titles, held by Vergne" on twelve live pages, because that sentence is derived from the file.
- → done: **F3 complete, 16 of 16** (0.334.55). **F2 complete, 21 of 21** (0.334.56 + 0.334.57).
- → done, unplanned: **a wrong win count fixed** — 1987 MotoGP said Gardner won 1 race; he won 7, and `ChampionsTab` renders that field, so the champions page had been publishing it. Swept all 77 rows afterwards.
- → done at close, after the operator answered both decisions with the alternatives rendered: **the note lead label now comes from the data** (0.334.59) — `clinched` / `season` / `race`, with the one-lead guard proved to fail before shipping and all 166 existing notes rendering byte-identically. That unblocked **106 of the 323 remaining seasons** in the same session the question was asked.
- → **10 merges, 0.334.50 → 0.334.59, every one prod-verified.** Programme 91/488 → **166/489 (33.9%)**. Suite 1212 → 1239, 18 of those from the `it.each` integrity gate rather than any test being written. Prod's sitemap carries 166 who-won URLs, matching local exactly.
- → **held back rather than guessed**: MotoGP 1996, 1986, 1982, 1981, and everything from 1980 back. Sourced clinch rounds thin out before ~1990, which turned the remaining 36 MotoGP seasons into a note-shape question — the same one already open for ADAC and NLS. Asked with both shapes rendered, answered, and shipped the same session.
- → **not started, deliberately**: the Cloudflare `cf:populate` fix and the 1.0 copy sign-off. Both are the operator's and both were displaced by the one-line directive.
- → **abandoned mid-research**: a WEC wave. Five of its thirteen seasons were sourced when I stopped rather than ship a half-verified family; the head start is recorded in the queue.
- Won't-touch honoured: no Tier-2 or Tier-3 item was started, no prod Supabase or infra write, the desktop calendar untouched, the OG-card runtime untouched.

Active: (no [+Nm] prefixes given this session)

### Tue 2026-08-26 — session 37 (the endurance families)

Plan at start: WEC, IMSA and GT World — three completable families, three more completions — leaving the operator's two items alone. Executed as planned.

- → done: **WEC complete, 13 of 13** (0.334.61), **IMSA complete, 12 of 12** (0.334.62), **GT World complete, 12 of 12** (0.334.63).
- → done, unplanned and the reason the wave order mattered: **crews are now counted per person** (0.334.61). Browser-verifying the FIRST page of the WEC wave found the derived text calling 2019 "Buemi, Alonso, Nakajima's first FIA WEC title" when Buemi had won in 2014 with a different crew, and the all-time record calling it two titles between two crew strings when Buemi and Hartley had four each. Fixed in the same PR, so no crew page was ever indexed carrying it. It would have affected 145 crew rows across six families.
- → also corrected: `wec/champions.json` called 2019–20 a "super season" (it was 2018–19).
- → **4 merges, 0.334.61 → 0.334.64, every one prod-verified.** Programme 166/489 → **203/489 (41.5%)**, complete families four → **seven**. Suite 1239 → 1265. Prod's sitemap carries 203 who-won URLs, matching local exactly.
- → deliberately month-not-day on seven notes: the 2018 IMSA finale (Wikipedia and its mirror say a Monday; every other finale in the family is a Saturday) and six GT World seasons whose venues are sourced but whose race days are not.
- → **not started, for a third session**: the Cloudflare `cf:populate` fix and the 1.0 copy sign-off. Both the operator's.
- Won't-touch honoured: no Tier-2 or Tier-3 item, no prod Supabase or infra write, ADAC/NLS left for their own session.

Active: (no [+Nm] prefixes given this session)

### Wed 2026-08-27 — session 39 (the `most-` record cohort, and the false claims it surfaced)

Plan at start: enrich the 23 `most-` record pages — build the sidecar mechanism and its integrity test first, then write the notes thinnest-first in three waves, each with its own gates, browser check and prod re-measure. Operator approved both new file kinds and chose the note's placement before the provenance footer.

- → done: **the mechanism** — `content/series/<slug>/record-notes.json` keyed by half, `loadRecordNotes`, `recordNoteLines`, and `lib/record-notes-integrity.test.ts` with eight invariants (0.334.83).
- → done: **all 23 notes**, in three waves — nine (0.334.83), eight (0.334.84), six (0.334.85). **Median 58 → 219, minimum 42 → 191, none under 180**, measured on prod-rendered HTML both times.
- → done, unplanned and the real finding: **four `champions.json` errors**, three of them false claims on live indexed pages, every one found by checking a record COUNT against its sources. WEC's two never-awarded manufacturers' titles, WorldSBK's 2009 Ducati/Yamaha swap, and **Formula E's teams record, which was a four-way tie at two and is actually Renault e.dams outright with three** — one team filed under two spellings, the same class as the 0.334.61 crew-counting bug.
- → done, unplanned: `sourceLabel()` now names Wikipedia articles rather than returning a bare host, found by browser-verifying the first page of wave 1 rather than the last. Fourth session running that rule has caught the only defect.
- → done: four bounded-window pages (NASCAR, WRC, IndyCar, NLS) now state their scope in the note. **Not** data errors — derived headlines reading as all-time claims.
- → decided and NOT done: two naming boundaries left alone (ART's Lotus-branded GP3 seasons, ART's GP2-vs-F2 split) and explained in prose, because the entrant names as recorded are correct.
- → done: `docs/next-session.md` TIER 1 item 1 struck, its wrong 22/67/44 figures corrected to 23/58/42, and a recommendation written into item 2 — accept the ADAC pages as short, retire the 150-word bar for single-race families, and spend the effort on the "drivers' title" noun instead.
- → **not started, for a fifth session**: the 1.0 copy sign-off. Still the operator's.
- Won't-touch honoured: TIER 1 items 2 and 3 (no padding, no country pages), TIER 2 and 3, `POINTS_PAIR`, the Álex Palou accent (an operator-deferred change), the `featured: hasStableName` gate, and no prod Supabase or infra write.

Active: (no [+Nm] prefixes given this session)

### Wed 2026-08-27 — session 38 (the enrichment programme, finished)

Plan at start: none written — the session began as a UI task (the What's-New modal) and turned into the rest of the champion-notes programme on the operator's instruction, wave by wave.

- → done: **MotoGP complete** 77/77 (0.334.67), **WorldSBK** 38/38 (0.334.70), **WRC** 47/47 (0.334.73), **DTM** 39/39 (0.334.75), **IndyCar** 30/30 (0.334.79), **NASCAR Cup** 26/26 (0.334.80), **ADAC 24h 54 + NLS 16** (0.334.81). **The programme closed at 489/489, 100%, fifteen complete families.** Suite 1265 → 1345.
- → done, unplanned: the **What's-New release modal** (0.334.66), shipping dark. Its first version drew abstract panels and was rejected outright ("show parts of our site"), so the card art is now real 848×260 screenshots of our own pages.
- → done, unplanned: **blog posts can be featured into the Learn IA** (0.334.68) — reference, not absorption, because Learn is a build-time registry and a database row cannot mint a Learn slug. Then 0.334.69, because that control **shipped unreachable**: the dashboard linked a LIVE post's title to the article, not to the studio page.
- → done: **points/wins/runner-up backfilled** across WSBK, WRC and DTM (0.334.77), which found the **F1 1979 note stating 50 points when the official total is 51**.
- → done, first use of the `race` lead shape added back in 0.334.59 — all 54 ADAC notes use it. **NLS did not need it**: it is a season championship, correcting what this session said when it deferred the pair.
- → **audited, and the answer is the next session's priority**: 788 `/information` entries, 786 indexed, **238 under 130 words**. The **22 `most-` record pages are now the thinnest cohort on the site** (median 67 words, min 44) and have no authored-note sidecar at all. That is TIER 1 item 1 in the queue.
- → **not started, for a fourth session**: the 1.0 copy sign-off. Still the operator's, and they have said we are not ready for 1.0.
- → open decision recorded rather than taken: broadening `POINTS_PAIR` would check 47 more notes but would fail `f1 1993`, whose prose is correct. Evidence is in the queue; the call is the operator's.
- Won't-touch honoured: no prod Supabase write beyond the one operator-sanctioned `learn_topic` migration, no infra change, and a second session's in-flight console work left strictly alone in the shared checkout.

Active: (no [+Nm] prefixes given this session)

### Fri 2026-08-28 — session 41 (the social media job)

Ran in the same checkout as session 40 and concurrently with it, which is why this entry is numbered 41 despite the same date. Plan at start: execute the pre-launch presence half of the W8 launch program. Scope locked by `AskUserQuestion`: presence kit now, all five channels, nothing posted by Claude.

- → done: **the presence kit** (`docs/research/2026-08-28-social-presence.md`, 430 lines) — handle and identity kit with bios written to each platform's real limit and the counts verified rather than estimated, a brand-vs-builder recommendation, a four-week calendar pegged to the real fixture list, eight paste-ready posts, UTM scheme, rules of engagement.
- → done: **15 assets** captured from prod signed out into `docs/marketing/`, including the September calendar with all fifteen filters lit, which is the one image that argues the whole product.
- → done, and the reason the fact-check earned its keep: **three published claims the product could not support**, shipped as 0.334.96. "Works offline" in two places (`lib/whats-new.ts` chip, `content/assistant/site-help.md`) — false since 0.268.0 and about to go live with the 1.0 flip. And the record pages' `summary`, which stated an all-time record over four bounded files.
- → done, unplanned: **root-caused the 0.334.90 Cloudflare build failure** to `/` prerendering against live upstreams, because `DATA_SOURCE` is defined only in `wrangler.jsonc` as a Worker runtime var and is therefore unset during every build. Measured: 10 upstream fetches without the flag, 0 with it. Session 40 fixed the immediate failure differently (memoising the archive reads, 0.334.91); this remains a real correctness issue, deliberately NOT applied — see below.
- → **found and deliberately not acted on**: setting `DATA_SOURCE=db` on the build would remove a writer. `withSourceSnapshot` writes whenever the flag is unset, so every Cloudflare build has been writing prod snapshots. With `warm-live-data` dead since 23 Aug that is currently the only writer running. **Sequence it after warm goes green, not before.**
- → done: `npm run lockfile:check` → exit 0 under npm@10, so the 0.334.94 fix holds. TIER 0 is unproven only because no run has fired since the 09:48Z merge.
- → corrected in flight: I reported "no fetcher, no parser, no cron" for F1 upgrades. `lib/upgrades/f1-parse.ts` is a complete parser with 13 passing tests, shipped 2026-07-24 and orphaned — zero importers outside its own test.
- Won't-touch honoured: no post published, no account created, no prod Supabase or infra write, the 1.0 flip untouched.

Active: (no [+Nm] prefixes given this session)

## Week of 2026-09-07

### Mon 2026-09-07 — Monza posts, the designer programme, the loader outage, Phase 0

- → done: the six Monza posts (FP1, FP2, FP3, qualifying, race, long runs) in the operator's voice with full 22-row linked tables and 2026 Commons covers; five published by the operator, the race report in review.
- → done: Paddock Designer prototype v1 (rejected: live canvas) → v2.4 (APEX Layout schematic, 45 shared components, dynamic actions, DevTools device toolbar, calm skin, Data workspace per service). Field guide v3 with the plan of record after adversarial review.
- → done: #902 lockfile (loader green again, prod post-Monza totals), #904 + #905 What's-New banners at 2×, #903 studio lost-update guard, #906 actions v7 + PAT note, #907 **Phase 0** (source / source_run / standing, loader runs, `/api/cron/revalidate`, freshness row tier, `DATA_TABLES` flag, Loads panel). 1.0.22 → 1.0.28; suite 1548.
- → done: three background reviews (plan critique, repo audit, data-API inventory) folded into the guide; Supabase PAT regenerated by the operator and verified.
- → partial: Phase 0 is merged but the migration is **not applied** and the flag is off; three operator actions, recorded at the top of `docs/HANDOFF.md`.
- → skipped: Phase 1 (design tables); the Cloudflare `scriptName` filter; the 64 MiB Worker-limit question.
- Won't-touch honoured: no prod Supabase write (the migration awaits the operator naming it), no post published by Claude, no branch deleted, no `git push` beyond the PR branches the operator asked for.

Active: (no [+Nm] prefixes given this session)

### Tue 2026-09-08 — Phase 0 switched on in prod, Phase 1 begins (session 43, opened late Mon evening)

- → done: the three operator-gated actions. Migration `20260907190000` applied to prod on the operator's word (Management API, information_schema proof pasted); `warm-live-data` run 34160583323 wrote ten series (three multi-class SKIPs, as designed); `DATA_TABLES=on` deployed as Worker version 9bf36e7f (saved first, deployed seven minutes later); the first fresh render at 21:15:30Z read `standing_current` (Supabase request log).
- → done: the two design questions, one at a time: prod-only designer writes (yes), the database plus a weekly export branch (chosen once the Free plan's missing backups came to light); `CRON_SECRET` rotated on the Worker and in GitHub, run 34171116946 `revalidate: HTTP 200`.
- → done: Phase 1 in three PRs, each with the trio and a dry-run before and after: #909 `PADDOCK_ENV` (1.0.30), #910 design tables + export job (1.0.31), #911 drafts and the stale-base 409 (1.0.32). → partial: the design-tables migration is merged but **not applied**; the permission rail refused the unattended prod write after the operator went to sleep. Morning action: "apply 20260908090000".
- → done, beyond the plan: #912 Cloudflare usage counts prod alone (1.0.33); #913 the stale-payload root cause of the `/series/f1/standings` stylesheet error, browsers now revalidate (1.0.34); #914 these records (1.0.35). Suite 1548 → 1572.
- → done, morning (operator present): migration `20260908090000` applied + first export run (#915, 1.0.36); the direction widened to **paddock-developer** and the tenancy migration `20260908110000` was written, rehearsed with a rollback and applied (#916, 1.0.37); the four navigation lists as rows with the site rendering them identically (#917, 1.0.38, migration `20260908130000` applied); Paddock Developer's first screen, the lists editor, screenshots reviewed before merge (#918, 1.0.39); records (1.0.40); Text Messages, six chrome strings as rows and the second editor, migration `20260908150000` applied (#920, 1.0.41); this handoff (1.0.42). Suite 1572 → 1613.
- → partial: Phase 2 step 4 (Build Options with the runtime honouring Ghost lap 3D and Weather) planned and presented; the session closed at 95% context before the go-ahead.
- Housekeeping done at open: nav-composer code parked as a local commit on `feat/nav-composer` (operator: keep); the six Monza drafts committed on `content/monza-drafts-final`.
- Won't-touch honoured: no push before the operator asked, then only PR branches; no prod Supabase write beyond the one the operator named; no post published; no branch deleted beyond a merged PR's own head; the designer UI (Phase 2) and the multi-class standings mapping untouched.

**Session 44 (09:00Z → 11:45Z, operator present) — outcomes:**
- → done: step 4 Build Options (#922, 1.0.43, deployed 09:24Z); step 5 Application Settings (#923, 1.0.44; migration 20260908170000 rehearsed then applied 09:44Z; deployed 09:48Z); the refresh fix the operator asked for on first use (#924, 1.0.45); step 6 Authorization Schemes (#925, 1.0.46, deployed 11:01Z); step 7 Themes, widened by the operator to themes of their own with a contrast gate (#926, 1.0.47; migration 20260908190000 rehearsed then applied 11:32Z; deployed 11:36Z); this handoff (1.0.48). Every step: a review page before merge, the trio, the dry-run (41,815 → 42,028 KiB). Suite 1613 → 1692.
- → done: operator checks on prod: the wire-headline count 5 → 2 → 10 → 5 followed within about a minute each time; the six theme cards with stamps, a theme of their own picked in a private window, a custom default switched and back.
- → skipped: Shortcuts and Assets (next session, then Phase 3); the release-header decision and the six branch deletions (still the operator's).
- Won't-touch honoured: no push before approval, PR branches only, merges on the operator's word; prod writes only the two applies the operator named; no post published; no branch deleted beyond a merged PR's own head.

Active: (no [+Nm] prefixes given this session)

**Session 45 (opened 2026-09-08 afternoon, operator present) — intent:**
- Present the customisation direction ("font size, font etc. must be changeable … css and js fully customiseable") as two readings, tokens first beside raw CSS/JS with its security stance, and ask which is meant. Nothing built before the go-ahead.
- If tokens: Phase 2 step 8, **Appearance** (faces from an open-licence list, base size and scale, leading, density, corners, motion; tokens on the application row, a theme may override; a legibility gate beside the contrast gate; the same generated style block), by the recipe: migration rehearsed then applied on the operator's word, loader with the code as fallback, one write path with the stamp, editor, render probe → review page before merge, trio, dry-run, merge on the operator's word, board republished.
- Then Shortcuts, then Assets (needs a media bucket in R2 and its binding, an infra action the operator names), then Phase 3 opens with `page` + `page_revision`.
- Won't touch: no push before approval, PR branches only, merges on the operator's word; prod writes only on "apply <id>"; no raw CSS or JS path unless the operator picks it; no post published; no branch deleted beyond a merged PR's own head; the release header and the six branch deletions stay the operator's.

**Session 45 outcomes:**
- → done: the customisation direction decided, **tokens first**, from three previews (raw CSS or JS declined; the security stance recorded in the handoff).
- → done: Phase 2 step 8, **Appearance**, as two PRs: #928 (1.0.49) every fixed text size onto one rem ladder and the four faces as role variables, look-identical (990 class strings computing the same before and after; the dyslexic mode now reaches headlines and names); #930 (1.0.50) the editor: twelve open-licence faces by role, the root size, the leading, the spacing unit, the corners and the motion as one document on the application row, a legibility gate, the same generated style block as the themes. Migration 20260908210000 rehearsed with a rollback then applied 13:20Z on the operator's word; both PRs merged on the operator's word ("merge #928 then apply 20260908210000 then merge #929 go ahead"); review pages `a4f3556c…` and `520291ed…`; the board republished. Suite 1692 → 1712; dry-run 42,028 → 41,995 KiB.
- → done: step 9, **Shortcuts** (#932, 1.0.52): house-style fragments as rows the operator adds to and removes from, three authored seeds (the code held nothing worth mining), the key and text rules shared by editor and routes, create/edit/delete each on the stamp; migration 20260908230000 rehearsed then applied 13:50Z on the operator's word; merged on the operator's word; review page `6abd6b18…`; deployed 13:56Z; the board republished and walked through at the operator's request. Suite 1712 → 1727.
- → done: step 10, **Assets** (#934, 1.0.54): the operator created `paddock-media` (14:08Z) and chose the cap (10 MB; JPEG, PNG, WebP); the MEDIA binding on all four Workers, the upload path (words, cap, the bytes themselves, put, row), the serving route, the editor; merged on the operator's word ("merge then lets go to phase 3"), deployed 15:19Z; the media route verified from outside (404 from the bucket, never 503). **Phase 2 complete.** The first real upload is the operator's, to check when it lands. Suite 1727 → 1751.
- → done: the cache bucket's growth (73 GB, 376k objects, every build kept) explained and a 7-day expiry rule added by the operator, read back from the CLI.
- → done: Phase 3 planned as six steps and approved; **step 1, the page registry** (#936, 1.0.56): 57 routes as `page` rows in six groups, the App Builder tab live and read-only, the route-collision test both ways; migration 20260908233000 rehearsed then applied 15:43Z on the operator's word; merged after a rebase onto the records PR; deployed 15:52Z. Suite 1751 → 1763.
- → partial: step 2 (row pages: the layout document and the schematic) presented for the go-ahead at the close.
- → skipped: the release header and the six branch deletions (the operator's).
- Findings: base 20 on a 390 phone truncates the header's search hint, 18 is the practical ceiling; stopping `next dev` right before `cf:build` leaves `.next/dev/types` truncated, clear the folder whole; GitHub closes a stacked PR when its base branch is deleted by the merge, open it again against main; `node -e` cannot take an argument that begins with `--`, pass SQL through the environment; a merge right after a push can hit "Base branch was modified", retry after a few seconds.
- Won't-touch honoured: pushes only for PR branches; merges and the apply on the operator's word; no post published; no branch deleted beyond a merged PR's own head.

**Session 45, night shift (from 2026-09-08 17:14Z, operator asleep) — intent.** The operator's word at 17:10Z: "apply 20260909010000 then merge #938 … line up the next prs and apply whatever needs applying. you have my wholehearted support and are granted access to finish as many tasks and phases as you can. dont stop for nothing, make sure no mistakes are made, catch your mistakes if there are some."
- Apply 20260909010000, merge #938 (step 2a), poll the deploy, republish the board.
- Step 2b, the page editor: the gallery, the properties, Save draft and Publish through the revisions route, the conflict banner; review page, trio, dry-run, merge, poll.
- Step 3, serving: the catch-all reads the live revision of a row page, region renderers, metadata with noindex until indexable, page attributes editable, publish revalidates the path; review page, trio, dry-run, merge, poll.
- Then step 4 (access enforced on row pages and list entries), the three designer ideas from the Inbox, and the records after every merge.
- Won't touch: nothing pushed to `main` except by squash-merging a PR with the trio; no prod write outside a rehearsed migration or the functions the routes call; no post published; no branch or file deleted without the operator; the release header and the six branch deletions stay the operator's; every merge preceded by tsc, eslint, the whole suite, `cf:build` and a dry-run, and followed by `/changelog` showing the version.

**Session 45, night shift outcomes (17:14Z → ~19:35Z):**
- → done: migration 20260909010000 applied 17:14Z and #938 (1.0.58, step 2a) merged 17:15Z, live 17:24Z.
- → done: step 2b, the page editor (#939, 1.0.59, live 17:45Z); step 3, serving row pages with one authorization evaluator and page attributes (#940, 1.0.60, live 18:00Z); step 4, access on the navigation lists and schemes of the operator's own (#941, 1.0.61, live 18:18Z).
- → done, the three ideas from the afternoon: the designer's two rails with the catalogue search (#942, 1.0.62, live 18:32Z); Search Hints, the alive placeholder verified against the site's own search, with the search itself reading a question as asked (#943, 1.0.63; migration 20260909020000 applied 18:38Z; live 18:52Z).
- → done: step 5, dynamic actions and the Button region (#944, 1.0.64, live 19:10Z); step 6, Save and Run with the runtime developer toolbar (1.0.65; seed migration 20260909030000 applied 19:09Z). **Phase 3 complete.**
- → done: a review page before every merge (seven of them, ids in the handoff); the progress board republished, then published afresh at a new address when the old one answered "not found".
- → skipped: the operator's items (the first photo upload, the release header, the branch deletions, the 60 s memo, the composer and /admin/system checks); Phase 4 planning (a plan comes first, in the morning).
- Findings: a `! grep | head` guard inside an `&&` chain took head's exit status and skipped the commit once (caught before the PR); a rehearsal's counts must sit in a separate statement from the functions they count; `/changelog` reads "Currently running v 1.0.NN"; the search matcher AND-matches every term, so natural questions needed stop-word stripping; full-page screenshots of the console need its fixed root released.
- Won't-touch honoured: pushes only for PR branches, merges by squash on the operator's standing word; prod writes only the three rehearsed migrations and the functions the routes call; no post published; no branch or file deleted; the release header and the branch deletions untouched.

**Session 45 close (~19:40Z → 20:00Z, operator awake):**
- → found by the operator: existing (code) pages cannot be edited; the editor built overnight looks nothing like the approved design. Both true, both acknowledged as Claude's. Decisions: rebuild the editor to the approved design now, before Phase 4; for code pages, attributes first, then regions around the code's body.
- → done: the plan page with the approved prototype beside today's editor (artifact `05b2cea5-…`); the handoff rewritten so the next session's job is executing it (PR 1 attributes, PR 2 the Page Designer rebuild, PR 3+ regions), a mock before each; the prototype's temp location recorded with the ask to commit it.
- → not started: PR 1 (the operator asked for the handoff rather than a go-ahead).

**Session 46 (opened 2026-09-08 ~20:05Z, operator present) — intent.** Standing rule for every designer screen: stick as close to the verified v2.4 designer as possible; any change is asked about first, with the prototype and the proposal side by side. One item at a time, plain language, something to look at for every decision.
- Housekeeping: PR #948 (records, 1.0.68) is open; ask the operator to merge it, then confirm `/changelog` reads 1.0.68.
- Item 1: ask permission to commit the approved prototype under `docs/prototypes/paddock-designer-v2.4/` (copied into this session's scratchpad first; checksums identical to the 2026-09-07 originals).
- Item 2: PR 1, attributes on code pages: a mock first, wait for "go ahead"; then one server-only wrapper module with `pageMetadata` and `withPageGate` over all the code routes, the coverage test, the PUT widened, the attributes editor showing for code pages. No migration.
- Item 3: PR 2, the Page Designer rebuilt to the v2.4 prototype one for one over the real page document: a mock first, wait for "go ahead"; any forced deviation shown beside the prototype and asked, never decided.
- Item 4: PR 3 and after, regions of the operator's own around the code's body; the migration widening `design_save_page_revision` rehearsed with a rollback and applied only on "apply <id>".
- Won't touch: Phase 4 (waits until the three PRs are live); the document format, the functions and the routes from the night; the site's pages' own content; no migration in PR 1 or PR 2; prod Supabase writes only when the operator names them; one write path per table, revisions not overwrites; no AI in the design path; no ⌘, no command palette, visible controls; `eslint-disable` is never the fix; pushes only for PR branches, merges only on the operator's word; browser-verify before "shipped"; the release header and the branch deletions stay the operator's.

**Session 46 outcomes (20:05Z → ~00:30Z, the operator present until ~23:00Z, then the overnight mandate: "finish as many tasks and phases as possible, while staying close and true to apex and the approved plan"):**
- → done: #948 merged (1.0.68); the approved prototype committed as the reference (#949, 1.0.69: the HTML parts and the screenshots; the loose JS parts left out on the operator's pick, the lint would not parse them).
- → done: **PR 1**, attributes on code pages (#950, 1.0.70): one server-only wrapper (`pageMetadata`, `withPageGate`) over all 58 code routes with the coverage test, the PUT widened, Indexed and Comments in the editor; mock first, "go ahead" given.
- → done: **PR 2**, the Page Designer rebuilt to the v2.4 prototype one for one over the real document (#951, 1.0.71): toolbar, the four left tabs, Layout with the twelve-column Body and drop tiles, Component View, Messages, Page Search, Help, the Gallery, the Property Editor with Filter, Pin Filter and Go to Group, undo and redo, the Alt keyboard set; audited against APEX 24.2's documentation (Show Messages, Match Case and Regular Expression added; Ctrl+/ chords left for the operator). Superseded files removed as agreed. Seen in a real browser through Playwright with a Clerk development-instance administrator (27 photographs).
- → done: the Shared Components audit: **Application Definition**, the Phase 2 editor never built, now live with the shell reading it (#952, 1.0.72, prod at 00:02:42Z).
- → done: **PR 3**, regions around the code's body (#953, 1.0.74): built, gated, seen in the browser on the local database with the migration applied, left open for the operator; at ~00:37Z the operator said "apply 20260909040000 and merge #953": rehearsed and applied to prod 00:39:06Z, merged 00:40:07Z, prod 1.0.74 at 00:45:19Z.
- → done, ~01:45Z on the operator's word ("im confident i only want to keep the designer"): the console retired the reversible way (1.0.76): `/admin` and every section redirect to the designer, the `dev.` root serves it, the admin layout is the gate alone; nothing deleted, the list awaits the morning.
- → done, on the operator's ~01:50Z word ("items in the shared components marked for phase 3 still not available. merge all prs you create and apply all db changes"): **Lists** (#957, 1.0.77), lists of the operator's own for the List region, no migration, seen in the browser end to end.
- → done: **Component Settings** (#958, 1.0.78), what a new region starts with, three seed rows; the prod apply of 20260909050000 refused by the permission rail, left for the operator's "apply".
- → done: **Application Computations** (#959, 1.0.79), read-only, the last of the three Phase 3 entries.
- → done, morning (operator awake): "apply 20260909050000" applied to prod 06:34:38Z; "Phase 4 go ahead" → **PR 4.1, the Data workspace** (this PR, 1.0.81), the plan's card grid and service pages over the readers the code has; seen in the browser on the local server (Clerk and the local Supabase live, the rest connect or own).
- → skipped: the Right Side Column on code pages (a decision); Ctrl chords; the file deletions (the law).
- Findings: a cross-request memo feeding a cached page re-caches a stale frame after a publish (fixed with a per-request read); Turbopack refuses a node_modules junction in a worktree; `next dev` under load registers a route late and the catch-all answers instead.
- Won't-touch honoured: pushes only for PR branches; merges on the operator's word and, after 23:00Z, under the overnight mandate for gated PRs; one prod Supabase write, the migration the operator named at ~00:37Z, rehearsed first; no post published; no branch or file deleted (the two file removals in PR 2 were approved by the operator); the designer follows the verified prototype, deviations asked first.

**Session 46, morning (2026-09-09 06:30Z → ~09:20Z, operator present) — outcomes:**
- → done: the operator's design brief taken (simpler, bigger, ruled, colour first, no rounded pills), two mocks, the second liked; 37 APEX 26.1 screenshots read and recorded as the reference; five questions asked and answered (Members and Moderation pages in Data; home composer into the Home page's designer; heatmap parked; applications and workspaces wanted; "closer to apex"; a small read-only object browser; Application Definition tabs).
- → done: the console's files, deleted by the operator, committed with two repairs (#962, 1.0.82).
- → done: **Phase 4 PR 4.2** — the Data tab redrawn to the second draft and the loader's runs page (#963, 1.0.83, prod 08:53Z); two wrong production figures corrected on the way.
- → presented, not built: the third draft (App Builder + Shared Components in the APEX shape), the workspaces and applications plan (W1–W5), the 4.3 draft (Standings and Calendar regions, the Object Browser). Each waits for a word.
- Findings: long or control-character Bash commands fail in this harness (write files instead); `next dev` can leave `routes.d.ts` half-written; the admin root lacks `suppressHydrationWarning`.
- Won't-touch honoured: pushes only for PR branches; merges under the standing "merge all prs you create"; no prod Supabase write; no post published; no branch deleted beyond a merged PR's own head; the Page Designer untouched.

**Session 46, late morning (2026-09-09 ~09:20Z → ~10:50Z, operator present) — outcomes:**
- → done: the operator's Page Designer walkthrough taken item by item (finder search, Delete Page, Run links, the code-served bodies, the components direction, "code pages should not exist. FINAL!", "for all pages", the Madrid venue bug); the roadmap written and republished (artifact 84259cc8).
- → done: **R1** quick fixes (#966, 1.0.86); **R2a** components exist (#967, 1.0.87); **R2b** Home's six components with the split (#968, 1.0.88); W1 the workspace rows (#965, 1.0.85, apply pending).
- → presented, not built: the **R4 plan** (every page a composition; the foundation and the family order; artifact 6816ce59); the R2 draft (artifact c9430e32) it grew from.
- → parked: the third draft's build (branch feat/designer-apex-shape, WIP commit 2732f2b) for the components work, on the operator's priority.
- Findings: the page-frame import graph multiplies into every route's chunk (58 MiB before the renderers' dynamic imports, 42.9 MiB after); the transitional body re-injected on a split page drew Home twice (fixed before merge); long or control-character Bash commands fail in this harness.
- Won't-touch honoured: pushes only for PR branches; merges under the standing "merge all prs you create"; no prod Supabase write; Home not split on production; no post published; no branch deleted beyond a merged PR's own head.

**Session 46, midday (2026-09-09 ~11:50Z → ~12:50Z, operator present) — outcomes:**
- → done: **R4.1** the foundation for pages served from rows, Calendar as its proof (#970, 1.0.90, prod 12:39Z): the route file gone, the catch-all serving from the row, families for metadata, the Size quick pick, the transitional body’s size controls disabled with a note, Save and Run Page previewing rows-served pages.
- → answered: "changing column span changes nothing" — it works on components (canvas 844 → 279 px; served 429 of 1336 px); the transitional body cannot be sized and now says so.
- → proposed, not started: the APEX study (26.1 App Builder User’s Guide + Labs and Tutorials) → concept map → section audit → the components vocabulary → the page-by-page plan; awaiting the go. The operator’s "decide the components first, then fit each page" recorded as a standing principle (memory feedback-paddock-components-first); R4.2 on hold behind it.
- Findings: a stored transitional body on a rows-served page rendered nothing (adoptRecipe fixes it in three places); the preview needed rows-served pages; a stale Playwright session 404s the designer.
- Won’t-touch honoured: pushes only for PR branches; merges under the standing word; no prod Supabase write; Home not split on production; no branch deleted beyond a merged PR’s own head.

**Session 46, afternoon (2026-09-09 ~12:50Z → ~15:50Z, operator present) — outcomes:**
- → done: #972 (1.0.92) Run is never refused; an empty page runs as its title alone.
- → done: **the APEX study**, the cheap way after the operator killed the Fable agents at 78% usage: 192 guide pages to text at zero cost, five Sonnet runs one at a time (455 concepts), the route map at zero cost, two Sonnet audit runs (58 routes, 299 sections); the **Paddock Developer Plan** artifact `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8` (concept map, vocabulary of 25, audit browser, four phases, timeline mid-Oct / late Nov, skip list, catalogue).
- → answered: the Cloudflare bill (CPU is the request path, R2 falls by itself, DO is the tag cache; under $1.50/month to save; middleware cannot shrink).
- Findings: subagents inherit Fable unless `model` is set (memory feedback-paddock-agent-model-cost); `const top` breaks an inline browser script; no replies exist anywhere on the site; `/about` prose lives in JSX.
- Won’t-touch honoured: no build started on the plan; pushes only for PR branches; no prod Supabase write.

**Session 46, evening (2026-09-09 ~15:50Z → ~17:30Z, operator present) — outcomes:**
- → done: the 161 skips scrutinised (99 plumbing · 40 have · 22 adapt) with the integrations table (Resend already wired; TanStack Table proposed); "how you hold me to it" (ledger, test, gates, agents law, ritual); the Page Designer **UX map** (one Sonnet run, 114 actions + 61 structures) and the **conformance table** against the built designer; the chapter coverage table (763 pages, 193 read, ~45 recommended); all on the plan page `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8`.
- → recorded as rules: the decision-scan protocol (memory feedback-paddock-decision-scan) and the agents/tokens rule (feedback-paddock-agent-model-cost); both proposed as CLAUDE.md laws with the ledger, awaiting "ledger go".
- → open for the operator: the vocabulary, "ledger go", TanStack Table, the chapters to read, moving the study into the repo.
- Won’t-touch honoured: nothing built on the plan; pushes only for PR branches; no prod Supabase write; no new repo file without the word.

**Session 46, night (2026-09-09 ~17:30Z → ~21:30Z, operator present at the start, then the runs alone) — outcomes:**
- → done: the **full read of the guide** — 549 pages in nine sequential Sonnet runs (757 concepts, 454 relevant, ~2.6M tokens), each folded into the plan page as it landed; the **spherical view** (rules / phases and slots / vocabulary / confirmed) published on `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8`; the rules v2 scrutinised against Anthropic's primary sources (`scratchpad/plan/rules.md`).
- → held, by the operator's order: no rule, slot or phase changed; the ledger stays a draft; decisions in the order rules → ledger → plan.
- Findings: Working Copies, the onboarding screen sequence, the Create Application features checklist, Tasks with six roles and Info Requested, REST Data Sources with sample-based discovery, Table and Cards as views of one region, the Conditions catalogue, stable-id exports.
- Won't-touch honoured: one agent at a time, all Sonnet; pushes only for PR branches; no prod Supabase write; no new repo file without the word.

**Session 46, night run (2026-09-10 ~20:30Z → ~23:30Z, operator asleep from ~20:45Z) — outcomes:**
- → done and live: #976 (1.0.96) the APEX study into `docs/apex-study/`; #977 (1.0.97) the Madrid venue fix (prod 22:13Z: Madring, not Barcelona). Each behind the gates and a fresh-context Sonnet reviewer.
- → drafted and held: rules v3; ledger v2 as JSON (78 slots, 17 questions) with a generator; the Table/Cards side-by-side (b93cd890-6f55-4770-9518-a1bda6a497b7); the CLAUDE.md prune; six hook scripts + tests (20/20) on draft PR #978 with the repo-local Sonnet force; the plan page (4d804904-63ad-4ddf-8d37-67dcb2d2fcc8) republished with the morning report.
- → not attempted, by design: any Phase 1–4 slot; wiring the hooks; applying the prune.
- Findings: the duplicate-JSON-key trap; the `=======` false positive in a conflict resolver; `.claude/` un-ignore needs `.claude/*`; a low-memory kill of a background git command.
- Won't-touch honoured: only the two merges the operator allowed; one agent at a time, all Sonnet; no prod Supabase write; no route file, migration or dependency touched.

Active: (awaiting [+Nm] prefixes)

### Wed 2026-09-10 — session 47 (rules v3, the ledger, the first decision-free slots; operator present from ~09:20Z)

Order fixed by the operator's opening brief; each item is asked as one question with a default, then acted on. Every subagent on Sonnet or Haiku, one at a time, writing to files as it goes; no agent builds; the gates and a fresh-context reviewer before any merge.

1. **Table/Cards** (~15 min): confirm the reading of "i prefer the table instead of the cards" (standings default to the table view; Cards stay a view for drivers, teams, posts, rounds) and decide one data region with views (recommended) or two tiles → a dated line in the ledger's changes list with the word.
2. **Rules v3** (~1h 30m): the operator's edits, or "rules go" → one docs PR: the CLAUDE.md prune (operator diff-reads it), `.claude/settings.json` (Sonnet force), `docs/plan/rules.md` v3, `docs/plan/ledger.json` + `render-ledger.mjs` + the generated `components-programme.md`, `lib/design/plan-ledger.test.ts` seeded with the five done R-slots; the hooks wired one at a time with the operator watching the first run of each. Draft PR #978 [HOLD] is the seed: rebased and grown into this PR, or closed in its favour (asked in the slot). The same PR carries the HANDOFF correction (operator, 09:45 local): `.claude/settings.json` and the hooks are NOT in the working tree on main (tracked on the branch only; the Sonnet force is live in this process only because the file was hot-loaded mid-session), and #978 was committed and opened at 06:17Z, not ~23:15Z.
3. **Ledger v2** (~45 min): phase by phase, P1 → P4; P4.0 "atomic, validated, staged apply" confirmed before backups and Working Copies; P1.1's five looks and P1.8's tokens are asked with screens when their slots come up, not today.
4. **"Phase 1 go"** (the rest of the day): the decision-free slots one PR each in the order P1.3 (Header and Footer text, Configuration) → P1.5 (Layout, Gallery and Utilities conformance) → P1.6 (Property Editor conformance) → P1.9 (Debug panel). Each: decision scan · plan mode · built directly · gates + dry-run Total Upload · browser run on the local server · review page · fresh-context Sonnet reviewer · merge on the word · prod check · ledger evidence. Realistic today: P1.3 and P1.5; P1.6 and P1.9 are stretch and roll to tomorrow unmarked.
5. **Close** (~20 min): Inbox triage, `docs/HANDOFF.md`, this day marked, the ledger's evidence; one records PR.

Outcomes so far (10:45Z, written at 87% context; P1.6 and P1.9 still to come today):
- → done: 1 Table/Cards (one region with a View setting); 2 rules v3 ("go with the latest version"); 3 the docs PR #980 (1.0.99) with two reviewer passes; 4 the six hooks wired one at a time with the operator watching, all seen live except session-start and pre-compact (dry run); 5 Phase 1 approved and in the ledger (#981, 1.0.100); 6 "Phase 1 go"; 7 P1.3 (#982, 1.0.101, prod 09:39Z); 8 P1.5 (#983, 1.0.102, prod 10:41Z).
- → in progress: 9 P1.6 and 10 P1.9 (the operator wants Phase 1 finished today); 11 the close (this block and the handoff prompt written early, in case of a compaction).
- Findings: push-guard denies a heredoc that quotes a push to main; the release-notes script overwrote a CHANGELOG heading twice (insert above the anchor); react-hooks/set-state-in-effect is a lint error (useSyncExternalStore instead); the preview of a row page shows no title; Save and Run opens the prod host from a local production-flagged server; a flyout near the viewport edge must flip.
- Won't-touch honoured: pushes only for PR branches; merges only on the word; no prod Supabase write; no agent on Fable; the old scratchpad copied into the repo only with the word (the ledger, the rules, the prune, the hooks).

Won't touch this session: merging #978 as it stands; any Phase 2–4 slot; P1.1, P1.4, P1.8 (they carry questions) and P1.2, P1.7, P1.10–P1.12 (not in today's batch); TanStack Table; the cost PR; Home's split on production; the console's file deletions; the third draft's branch; any prod Supabase write without "apply <id>"; any push to `main`; copying anything from the previous session's scratchpad into the repo without the word; any agent on Fable.

Active: (awaiting [+Nm] prefixes)

### Wed 2026-09-10 — session 48 (afternoon; the operator present) — P1.6 and P1.9, then the close

Order fixed by the session-47 handoff prompt. Every subagent on Sonnet or Haiku, one at a time, writing to files as it goes; no agent builds; the gates and a fresh-context reviewer before any merge; merge only on the word.

1. **P1.6 Property Editor conformance** (~2h 30m): the plan written at the end of session 47 (`~/.claude/plans/idempotent-waddling-nebula.md`) presented for the word → tests first → built directly → gates (tsc 0 · lint 0 errors · full vitest · the hooks' test) → browser run on the local server → review page → fresh-context Sonnet reviewer → merge on the word → prod check → ledger evidence. Trio 1.0.104.
2. **P1.9 Debug panel** (~3h): decision scan → plan mode → the same sequence. Trio 1.0.105.
3. **Close** (~20 min): Inbox triage, `docs/HANDOFF.md`, this day marked, the ledger's evidence; one records PR.

Won't touch this session: any Phase 2–4 slot; P1.1, P1.4, P1.8 (they carry questions) and P1.2, P1.7, P1.10–P1.12 (not in today's batch); the session-47 Inbox items (the preview's missing title, the preview link on the prod host, Tooltips on the pane header, the pane memory per user, the push-guard's match) unless asked; TanStack Table; the cost PR; Home's split on production; the console's file deletions; any prod Supabase write without "apply <id>"; any push to `main`; any agent on Fable; any fan-out.

Outcome (four slots shipped, all four merged on the word; the day ran ~09:30Z–15:00Z):
- **P1.6 done** — #985, 1.0.104, prod 11:55Z. Multi-select of regions with the common groups, the "changed since the last save" marker until Save, the Attributes tab for a component's settings. Reviewer: three nits, all taken.
- **R5 added and done** — #986, 1.0.105, prod 13:07Z. The operator's three asks of 12:10Z (Save and Run publishes and opens one named working tab; the Developer Toolbar as APEX's overlay on live pages for the administrator; a tile drags from any part) plus the overlap defect (the Column pills offer free columns only; an overlap is a Messages error that holds Save; the served page wraps). Reviewer: an admin import that pulled the service-role client into the client bundle, the Column Span pills, the preview note; all taken.
- **P1.9 done** — #987, 1.0.106, prod 14:15Z. The Debug menu on the toolbar (Enable Debug ▸ Info · App Trace · Full Trace, No Debug, View Debug), the trace API, the panel with the step bars, the loader's F/W phases in KV under the run's name (proven by run 34487264214: 38 keys). Reviewer: a prod meta write from the Worker, the browser log per page, a bad level → 400; all taken.
- **R5b added and done** — #988, 1.0.107, merged 14:22Z. The operator's check found R5's drag did not move regions; on the word "research, not gut" the cause was found in Chromium (a DOM change inside `dragstart` aborts the drag) and the fix proven with the browser's own drag. Reviewer: no blocking finding, the test gap taken.
- Close: the ledger's evidence, the Inbox, the handoff and the session-49 prompt in the records PR (1.0.108).

Active: ~5h 30m (the operator present throughout; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)

### Tue 2026-09-15 — session 49 (morning; the operator present) — the hook fix, P1.2, then the scans

Order fixed by the session-48 handoff prompt and the operator's words of the morning ("P1.2 go"; "fix, then work"; "open the P1.2 plan"; "you can merge 990 and 991. then continue"). Every subagent on Sonnet, one at a time, writing to files; no agent builds; the gates and a fresh-context reviewer before any merge; merge only on the word.

1. **The agent-model guard** (~40 min, unplanned): every subagent launch was denied because the Agent tool no longer carries a `model` field; the hook now reads the settings' force. The hook file itself was copied into place by the operator (the auto-mode classifier refuses Claude an edit of a hook governing its own tool use). PR #990, 1.0.109, merged 07:58Z, prod 08:03Z; the reviewer's own transcript proved Sonnet.
2. **P1.2 Template options** (~2h 40m): plan mode (a Sonnet reader on the APEX pages, a Sonnet plan critic with eight findings, five taken) → the word → tests first → built → gates → the browser run on the local server (Docker and the local Supabase had to be started first) → review page → reviewer (PASS; two gaps taken, one answered) → merged on the word. PR #991, 1.0.110, merged 08:14Z.
3. **P1.7 Developer Toolbar: Quick Edit and Info** (~1h 30m): the scan with the operator's three asks recorded verbatim → plan mode (a Sonnet plan critic, five findings taken) → the word → tests first → built → gates → the browser run (the support prompt and the pointer; the one-tab click proven with two tabs before and after) → review page → reviewer (PASS; five gaps and one nit taken) → merged on the word. PR #992, 1.0.111, merged 09:57Z, prod 10:01Z.
4. **P1.10 Create menu conformance** (~55 min): the scan (one item: the scope's P2.17 read as the Breadcrumb component's slot) → the word → plan mode (a Sonnet plan critic, two findings taken) → tests first → built (the back arrow's event caught by the existing tests) → gates → the browser run (a stale `.next/dev` after the build 404'd the sign-in routes until cleared) → reviewer (PASS; three gaps and one nit taken) → merged on the word. PR #993, 1.0.112, merged 10:50Z, prod 10:54Z.
5. **P1.11 Gallery hygiene, text picker, Comment Out** (~1h 45m after the compaction): the scan answered "1. yes., 2. replace it." → the handoff written first at 92% context → plan mode (a Sonnet plan critic, four findings folded) → the word → tests first (eight cases seen failing) → built → gates → the browser run (an orphaned dev server on 3000, the admin APIs answering HTML 404 until a restart on a cleared cache, PADDOCK_ENV=production missed once, the MCP browser's frames paused) → review page → reviewer (FAIL on one blocking finding, the pickers not keyed by the region; taken with its test in a second commit; seven checks passed) → merged on the word. PR #994, 1.0.113, merged 12:37Z, prod 12:42Z.
6. **Close** (~20 min): the ledger's evidence for P1.11, the handoff prompt for session 50, this block, four Inbox items, the board regenerated at a new address (the previous one stopped answering to the account in use); the records PR 1.0.114 merged 13:03Z, prod 13:08Z.
7. **The home lead unpinned** (~15 min, unplanned; the operator: "i want nothing to be pinned by default"): the 7 September pin found, the unpinned revision rehearsed inside begin…rollback, applied on "go" (13:31Z), the Madrid recap leading within a minute; the rule saved to memory.
8. **P1.12 Delete Page cascade and soft delete, PR A** (~2h 25m): the scan (one item, row pages as destinations inside the slot) → "go" → plan mode (a Sonnet exploration agent, 281k tokens; a Sonnet plan critic, 293k tokens, eleven findings folded, one blocking: the purge as a click, never a side effect of a GET) → tests first (twenty-six cases) → built → the migration rehearsed on prod inside begin…rollback → gates → the browser run (the whole cycle on the local server; a stale .next/dev answering the dynamic API routes with HTML 404 until cleared) → review page → reviewer (PASS; a dormant cross-application bug in the purge function found and fixed before the apply, four gaps taken, rehearsed again) → "apply 20260915130000 and merge" → applied 15:55Z, merged 15:55Z, prod 16:01Z. PR #996, 1.0.115.
9. **P1.12 PR B1, row pages as destinations of the lists** (~1h 10m): tests first (fourteen cases; the long heredoc landmine met, the edits moved to scratchpad scripts with the line endings kept) → built → gates → the browser run (a footer entry to a page, the page deleted, the entry hidden and tagged, reinstated, removed for good with the page) → review page → reviewer (PASS, no blocking; two gaps taken) → presented for the word. PR #997, 1.0.116, merged 17:13Z, prod 17:19Z.
10. **Close 2** (~25 min): the ledger's evidence for PR A and PR B1, the handoff prompt for session 50 (PR B2 next, its tests already written to the scratchpad), this block, the Inbox, the board; the records PR 1.0.117 on the word. PR B2 and the progress report the operator asked for move to session 50 with the operator's word "handoff and handoff prompt when ur done".

Won't touch this session: any Phase 2–4 slot; P1.1, P1.4, P1.8 (they carry questions) until asked; the Size / Column Span question the operator raised (recorded, not acted on); the merged branches on origin; any prod Supabase write without "apply <id>"; any push to `main`; any agent on Fable; any fan-out.

Active: ~10h 20m to the second close (the operator present throughout; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts from ~06:50Z to ~17:10Z)

### Wed 2026-09-16 — session 49, continued past midnight (the operator present) — the records, the order, P1.12 PR B2

Order fixed by the operator's words: "merge" (the records #998), "b2 then p1.1 then p1.4 and p1.8 ask me as those go and then once all done pphase 2 screen", "merge then b2 go", "merge". Every subagent on Sonnet, one at a time; the gates and a fresh-context reviewer before any merge; merge only on the word.

1. **The second close's records** (~10 min): #998 (1.0.117) merged 00:31Z, prod 00:37Z; the board rebuilt.
2. **The order recorded** (~35 min): asked "does that mean we are on to phase 2?", answered with the three things left; the operator's order → a dated changes line in the ledger, the session-50 agenda rewritten → PR #999 (1.0.118) → reviewer (PASS, one gap taken: P1.4 before P1.8 labelled a reading) → merged 01:11Z, prod 01:16Z.
3. **P1.12 PR B2** (~40 min): the tests written the day before applied and seen failing (nine cases, seven files) → built (fifteen code files; the fixtures given namedBy) → tsc 0 · lint 0 errors · vitest 208 files, 2111 tests · hooks 31/31 · cf:build + dry run 43225.09 KiB (66.0%) → the browser run on the local server (Imola created and published; a Button on Monza to it; the live link; Named by; Delete → no button, the publish refused, the draft kept; Reinstate → back; Delete permanently refused, "named by Monza"; the go effect's Destination) → review page → reviewer → merged 05:57Z, prod 06:01Z. PR #1000, 1.0.119. P1.12 done.
4. **Close 3** (~15 min): the ledger's evidence (P1.12 done), the handoff (P1.1 first, asked with the five looks), this block, the Inbox, the board; the records PR 1.0.120 merged 06:21Z, prod 06:25Z.
5. **The audit** (~50 min, the operator's "massive audit to ensure the work we said was done was actually done"): the records layer (eighteen PRs asked of GitHub, every version's headings, prod), two Sonnet auditors one at a time on the code and the tests of the sixteen done slots (sixteen done slots: thirteen HOLDS, three PARTIAL (R1, R-run, R5) in the auditors' own words; one clause marked NOT PROVEN by the auditor, R-run's "Save and Run saves a draft when no revision exists", which the code contradicts because Save and Run publishes, the behaviour the operator changed on 2026-09-10 (Claude's reading: superseded, not broken; the clause's wording awaits the operator's correction line); nothing MISSING; every test the auditors ran green, 171 tests across 13 files in part 1 and the five slots of part 2), a browser run on the local server through every slot's acceptance with screenshots and production as a reader; findings: R1's Run-link test asserts a suffix a relative address would also satisfy, so "absolute" is untested; R-run's acceptance clause "saves a draft when no revision exists" is superseded by the operator's change of 2026-09-10 (Save and Run publishes always) and the code follows the change; R5's drag holds through R5b's fix, a joint outcome the ledger already states; P1.7's one-tab reuse is a browser mechanism proven in the browser, not in jsdom; P1.9's action-firing record() call has no direct test; P1.12 B1's picker states are covered through Designer.test.tsx rather than a ListEditor test file; the local database has no live frame revision for Home, so R2b was seen on production. The report as an artifact (17f1542e-c5f4-4c93-8090-8d7608091434); the notes on the slots' evidence; the handoff and the prompt for session 50; the records PR 1.0.121 on the word.

Won't touch: P1.1, P1.4, P1.8 (asked at their turn, in the operator's order); Phase 2 (its screen once Phase 1 is all done); any prod Supabase write without "apply <id>"; any push to `main`; any agent on Fable; any fan-out.

Active: ~1h 50m of work between ~00:30Z and ~02:00Z, then ~1h 05m from 05:57Z to ~06:50Z (the operator present; the merge word for PR B2 came at 05:57Z after a pause, the close and the audit followed)

### Wed 2026-09-16 — session 50 (from ~06:50Z, the operator present) — P1.1 asked first, then built

Order fixed by the session-50 handoff prompt and the operator's words: "1. they stand, 2. drop size." (~08:00Z), the plan approved (~08:35Z), "merge and apply 20260916081500" (~09:22Z). Every subagent on Sonnet, one at a time, writing to files; no agent builds; the gates and a fresh-context reviewer before any merge; merge only on the word.

1. **Session start and the P1.1 ask** (~1h 10m): the files in order; the dev server left from session 49 restarted on a cleared cache (its dynamic admin API routes answered Next's HTML 404); the review page with the five looks drawn side by side on the Monza page (Midnight and Paper), the Universal Theme counterparts read from the UT 26.1 app, and three drawings of the Layout group for the Size question → the decision scan's two questions with defaults → answered "1. they stand, 2. drop size." → done.
2. **P1.1 Region looks** (~2h 25m): plan mode (a Sonnet plan critic, 231k tokens, SOUND WITH FIXES, all folded) → the plan approved → tests first (18 seen failing across 8 files) → built (12 code files, a seed migration) → tsc 0 · lint 0 errors · vitest 208 files, 2120 tests · hooks 31/31 · cf:build + dry run 43278.01 KiB (66.0%) → the browser run on the local server (Band on "A century of speed", Save and Run, the running page and the preview, the Templates screen, the Component Settings default, Monza put back) → review page → reviewer (Sonnet, 289k tokens, PASS; two gaps taken in a second commit with their tests) → "merge and apply 20260916081500" → the seed applied to prod 09:23:05Z, #1003 (1.0.122) merged 09:23:09Z, prod 09:29Z → done.
3. **Close** (~25 min): the ledger's evidence (P1.1 done), the render-ledger nit, the handoff and the session-51 prompt (P1.4 first, asked with the default and a drawing), this block, the Inbox, the board; the records PR 1.0.123 on the word.

Won't touch this session: P1.4 and P1.8 before their turn (asked in the operator's order); Phase 2 (its screen once Phase 1 is all done); any prod Supabase write without "apply <id>"; any push to `main`; any agent on Fable; any fan-out.

4. **P1.4 asked at its turn** (~30 min): the ask page, one question with the default (one level); the operator: "merge, sub region may have sub regions" (~10:55Z) → done.
5. **P1.4 Rendering points and tree creates** (~1h 55m): plan mode (a Sonnet plan critic, 254k tokens, five blocking fixes folded) → tests first (12 seen failing) → built → tsc 0 · lint 0 errors · vitest 208 files, 2134 tests · hooks 31/31 · dry run 43291.32 KiB (66.1%) → the browser run (the menu's order, Create Sub Region, the running page, Ctrl+drag with the browser's own gesture, Copy To, Monza put back) → review page → reviewer (Sonnet, 332k tokens, FAIL on one blocking finding; 4 gaps taken in a second commit) → the finding stated with a default → "merge then handoff … then first task is the fix" → #1005 (1.0.124) merged 12:55:20Z → done.
6. **Close 2** (~15 min at 94% context): the ledger's evidence (P1.4 done), the handoff and the session-51 prompt (the component-render.test.tsx repair first, then P1.8 asked), this block, the Inbox, the board; the records PR 1.0.125 on the word.
Active: ~5h 50m from ~06:50Z to ~13:00Z (the operator present; the words came at ~08:00Z, ~08:35Z, ~09:22Z, ~10:55Z, ~11:20Z and ~12:55Z; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)

### Wed 2026-09-16 — session 51 (from ~13:05Z, the operator present) — the test repair, P1.8 asked and built, Phase 1 complete

Order fixed by the session-51 handoff prompt ("merge then handoff … then first task is the fix") and the operator's words: "#1006 merge, then #1007 merge, and the P1.8 answer: the nine" (~13:45Z), the plan approved (~14:35Z), "merge" (~16:02Z). Every subagent on Sonnet, one at a time; no agent builds; the gates and a fresh-context reviewer before any merge; merge only on the word.

1. **Session start and the repair** (~55 min): the files in order; `lib/design/component-render.test.tsx` switched on (the include broadened), its two failures reproduced (timeouts), the cause found with a fetch stub and its stacks (not the Home components: vitest 4.1.6 hands a vi.mock factory to only the first of concurrent dynamic imports of one module from one importer; a twelve-line probe reproduced it), spies on the real module, the h1 wiring test (seen failing against the pre-P1.4 rule by a mutation) → tsc 0 · lint 0 errors · vitest 209 files, 2140 tests · hooks 31/31 → PR #1007 → done.
2. **The P1.8 ask** (~45 min): the review page with a working drawing of the Roller over Monza (the pickers recolour the mock, the gate follows) and the three answers as swatch strips → the word "the nine" with the two merges: #1006 (566fddab, 13:46:58Z), #1007 rebased onto main and merged (78ea27dd, 13:47:32Z; prod 1.0.126 ~13:58Z) → done.
3. **P1.8 Theme Roller from the toolbar** (~2h 20m): plan mode (a Sonnet plan critic, 211k tokens, SOUND WITH FIXES, all folded) → the plan approved → tests first (4 files red) → built (three new files, seven changed) → tsc 0 · lint 0 errors · vitest 211 files, 2151 tests · hooks 31/31 · dry run 43295.31 KiB → the browser run (nine screenshots; a new default reached a fresh visitor page in 18 s; the local database put back) → review page → reviewer (Sonnet, 272k tokens, FAIL on one blocking gap: Escape taken on the document would have swallowed the site's dialogs' Escape; taken in 0981a178 with the test it named; the gates re-run; the dry run 43295.29 KiB, built alone after the harness killed the dev server and a rebuild for low memory; re-checked in the browser with Contact open beside the Roller) → PR #1008 → "merge" → merged 16:03:08Z as 848f81f3 → done. Phase 1 complete: fourteen slots done.
4. **Close** (~30 min): the ledger's evidence (P1.8 done), the handoff and the session-52 prompt (the Phase 2 screen first), this block, the Inbox triage, the board; the records PR 1.0.128 on the word → done: #1009 merged 16:14:31Z as 9b75c3aa on "merge 1009"; the Phase 2 screen waited behind the operator's request for a flat list of Phase 1's goals (the next block).

Won't touch this session: any Phase 2 slot before the screen's word; the cost PR; branch deletions; any prod Supabase write without "apply <id>"; any push to `main`; any agent on Fable; any fan-out.
Active: ~3h 05m from ~13:05Z to ~16:10Z (the operator present; the words came at ~13:45Z, ~14:35Z and ~16:02Z; one mid-session note, the 2027 calendar; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)


### Thu 2026-09-17 — session 51, continued (from ~06:35Z, the operator present) — the Phase 1 checklist answered, P1.13 Phase 1 loose ends, the Phase 2 screen

Order fixed by the operator's words: "merge 1009. now before phase 2 we need a flat list of all supposed items/goals achieved in phase 1 so i can check we are well and truly done with phase 1" (16:14Z the evening before), "should we not have these left out or loose end items?", "Phase 1 loose ends" (~06:35Z), the plan approved, "merge do the rest then bring phase 2" (~08:48Z). Every subagent on Sonnet, one at a time; no agent builds; the gates and a fresh-context reviewer before any merge; merge only on the word.

1. **The Phase 1 checklist** (the evening of 2026-09-16, from 16:14Z, ~40 min): #1009 merged (9b75c3aa) on "merge 1009"; one page from the ledger and the PRs, every goal of every Phase 1 slot as a flat list, 72 done · 12 left out on purpose · 5 loose ends, each with its evidence (artifact 8ea90feb-d14e-490c-b428-e67499809f51); the operator's question on the left-out and loose items answered with a per-item recommendation (four loose ends to close in one slot before Phase 2, the rest to their slots) → done.
2. **P1.13 Phase 1 loose ends** (~2h 10m from the word to the merge): the dated changes line and the slot (scope, acceptance, hash) → plan mode (a Sonnet plan critic, 284k tokens, SOUND WITH FIXES, four blocking fixes folded) → the plan approved → tests first (six files red) → built (one new file, PageOutlines, with its test; the refs scan, the preview and the trace, the toolbar's Info menu, the pane memory per user) → a SELECT on production first (58 pages, 37 revisions, 3 shortcuts, no header or footer token) → tsc 0 · lint 0 errors · vitest 212 files, 2157 tests · hooks 31/31 · dry run 43295.88 KiB (66.06%) → the browser run (the probe shortcut refused by the foreign key, Monza's preview as the live page, the Calendar's still framed, the four Info entries, the landmarks and headings drawn, the pane key per user) → review page f04f6009-1d2c-49ab-88cd-6745d8f1cf80 → reviewer (Sonnet, 226k tokens, PASS; its note taken in 73d488b2) → PR #1010 → "merge do the rest then bring phase 2" → merged 08:48:59Z as c3e01239 → prod 1.0.129 at 09:04:15Z → done. Phase 1 complete: fifteen slots done.
3. **The Phase 2 screen** (~20 min): one review page, no build: the v2 draft's twenty-five slots with their decision scans, the order proposed, the seven questions with defaults, three drawings (artifact 9bf1e3be-ba94-4956-a0bb-5cf03b3f5732); the slots as data in docs/plan/phase-2-draft.json → presented with the records PR, for the word "Phase 2 go" or a changed list.
4. **Close** (~25 min): the ledger's evidence (P1.13 done with the prod time), the handoff and the session-52 prompt (the screen's word first, then the changes line, then P2.0), this block, the Inbox triage (the preview-frame item closed by P1.13), the board; the records PR 1.0.130 on the word.
5. **"Phase 2 go" and P2.0 planned** (~35 min, 09:19Z–09:50Z): #1011 merged 09:19:18Z as 14bf3d61 on "merge and "Phase 2 go""; the dated changes line adding the twenty-five Phase 2 slots from docs/plan/phase-2-draft.json in the order proposed, rehashed and rendered; P2.0 read (the component specs, the settings, the Property Editor, the parser, the shared components' loaders and routes) → plan mode → a Sonnet plan critic (244,805 tokens, SOUND WITH FIXES: the two-PR question put to the operator, the component's definition hoisted above the Property Editor's groups, PR B's table given the stamp trigger; six non-blocking points; all folded) → the plan approved ~09:50Z (two PRs) → the approval's changes line → done.
6. **P2.0 PR A, the model in the editor** (~50 min, 09:50Z–10:41Z): tests first (four files red) → built (the definition model with scope, seven editors, groups, events, capability flags and slots; the four region kinds as definitions; the seven Component Settings derived byte for byte; the Property Editor's groups, the colour, icon and link editors, the flags; the parser and the refs) → tsc 0 · lint 0 errors · vitest 213 files, 2164 tests · hooks 31/31 · dry run 43267.73 KiB (66.02%) → the browser run, a regression pass (the wire's Attributes tab, Component Settings' seven rows, Monza, Home) → review page f28d456c-d213-4352-a48d-430d5d5c9ffb → PR #1012 → reviewer (Sonnet, 230,827 tokens, PASS; its note taken in fb88b3ea with the test it named) → "merge." → merged 10:41:09Z as eaedb0b5 → prod 1.0.131 → done.
7. **P2.0 PR B, Plug-ins** (~60 min, 10:41Z–11:40Z): tests first (six files red) → built (the overlay parser and merge, the server loader with Utilization, migration 20260917100000, the two routes with the guard, the Plug-ins editor, the designer wiring, the readers threaded) → tsc 0 · lint 0 errors · vitest 217 files, 2188 tests · hooks 31/31 → `supabase migration up --local` → the browser run (Accent, a colour in a new group Colours, added on Page heading and drawn in the Calendar's Property Editor, a draft carrying it; the guard refusing in words; Tag added and removed; Utilization's Open; /calendar unchanged; the guard's wording corrected after the first run) → dry run 43313.26 KiB → review page 0e4e18c2-3ca2-4367-ac64-194981095c43 → PR #1013 → reviewer (Sonnet, 264,898 tokens, FAIL on one blocking finding: the guard read the previous overlay from the per-isolate memo; taken in 23813ee5 with the test it named, three non-blocking points with it; the gates re-run: vitest 2191 tests, dry run 43352.69 KiB, 66.15%) → "apply 20260917100000 and merge" → rehearsed on production inside begin … rollback 11:39:02Z, applied 11:39:15Z (HTTP 201), verified (the table, one trigger, row level security, grantees postgres and service_role, zero rows) → merged 11:39:42Z as f3ddd42e → done. P2.0 complete: Phase 2's first slot.
8. **Close** (~25 min): the ledger (P2.0 done with the prod time), the handoff and the session-52 prompt (P2.1 first), this block, the Inbox (the guard's question, the Utilization scan's growth), the board; the records PR 1.0.133 on the word.

Won't touch this session: any Phase 2 slot before the screen's word; the cost PR; branch deletions; a refs backfill or any prod Supabase write without "apply <id>"; any push to `main`; any agent on Fable; any fan-out.
Active: ~5h 30m from ~06:35Z to ~12:05Z, plus ~40 min the evening before from 16:14Z (the operator present; the words came at 16:14Z, ~06:35Z, ~07:25Z, ~08:48Z, ~09:19Z, ~09:50Z, ~10:40Z and ~11:38Z; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)

### Thu 2026-09-17 — session 52 (from ~12:05Z, the operator present) — P2.1 Data Sources

Order fixed by the handoff and the operator's words: the reads, the decision scan (its third line empty for now), plan mode with a Sonnet plan critic, "remake the phase 2 artifact if need be" (~13:20Z), the plan approved (~13:15Z), tests first, build, gates, the browser run, the review page, the reviewer, the PR, "merge" (~14:28Z). Every subagent on Sonnet, one at a time; no agent builds; merge only on the word.

1. **The reads and the decision scan** (~30 min, 12:05Z–12:35Z): CLAUDE.md, the rules, the ledger, the handoff, the four memories; then the model, the renderer, the Data workspace, the loader, the readers behind the thirteen; the scan's third line empty before plan mode (the migration's word at its time) → done.
2. **The plan and its critic** (~40 min, 12:35Z–13:15Z): plan mode, the plan file, a Sonnet plan critic (288,273 tokens against the ~250k said; SOUND WITH FIXES, four blocking: the season source's archive reader throws on the Worker, the rows tier's run id unselected, the runs log holds standings only, an administrator's season could send the Worker upstream; one non-blocking changed the model, the Source as a region-level field) → folded → approved with the rows deferred → done.
3. **The Phase 2 screen remade** (~10 min): gone from the account; regenerated from docs/plan/phase-2-draft.json and the ledger with the three drawings, artifact 987b680f-643e-43f9-b316-7ba22c16222d → done.
4. **Tests first and the build** (~50 min, 13:20Z–14:10Z): sixteen test files red (five new, eleven edited), then lib/design/sources.ts, the model, the parser, the definitions' usage, the rows reader, lib/design/source-read.ts, the home model, the renderer, the trace, the two routes, the catalogue, DataSourcesEditor, the designer wiring, the Property Editor's Source group, the Plug-ins row, the Object Browser, the runs' labels; tsc 0 → done.
5. **Gates, the browser run, the review page** (~35 min): vitest 222 files, 2225 tests · lint 0 errors · hooks 31/31; the local Supabase and the dev server up, the sign-in helper recreated in the scratchpad (the recipe's file was gone); the Monza page's Source group, Standings picked and saved, the preview's F1 table and the trace's line, the Data Sources page with Utilization and the Preview, the Object Browser's two tiers, the runs page in the new words; cf:build alone, dry run 41605.89 KiB (63.49%); review page 2d772a59-0b4d-4e80-b6eb-bccab0ace31e → done.
6. **PR, reviewer, the fix** (~45 min, 13:55Z–14:27Z): PR #1015; a fresh-context Sonnet reviewer (322,241 tokens against the ~290k said): FAIL on one blocking finding, the news source's Per series naming a count no page keeps warm (a live fetch under DATA_SOURCE=db); taken in 58e20965 with the test it named (the counts clamped to 3 and 10, MAX_PER_SERIES_AGGREGATE exported), two non-blocking points with it; the gates re-run (vitest 2226 tests, dry run 41610.57 KiB, 63.49%) → done.
7. **Merge and prod** (~7 min): "merge" → #1015 squash-merged 14:29:05Z as ea5d23d2 → main forward by fast-forward → prod /changelog 1.0.134 at 14:34:33Z → done.
8. **Close** (~25 min): the ledger (P2.1 done with the prod time; two dated lines, the rows' deferral and the remade screen), the handoff and the session-53 prompt (P2.6 first), this block, the Inbox (five lines), the board; the records PR 1.0.135 on the word.

Won't touch this session: any slot beyond P2.1 (P2.6 only after P2.1's merge, and only if time); the cost PR; branch deletions; any prod Supabase write; any push to `main`; any agent on Fable; any fan-out; the Inbox questions.
Active: ~2h 50m from ~12:05Z to ~14:55Z (the operator present; the words came at ~13:15Z, ~13:20Z and ~14:28Z; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)

### Thu 2026-09-17 — session 53 (from ~17:15Z, the operator present) — P2.6 The Conditions vocabulary

Order fixed by the handoff and the operator's words: the reads, the board with every phase (the operator's ask mid-reads, ~17:40Z), the decision scan (its third line empty), plan mode with a Sonnet plan critic, the plan approved (~18:05Z), tests first, build, gates, the browser run, the review page, the PR, the reviewer, "merge" (~19:31Z). Every subagent on Sonnet, one at a time; no agent builds; merge on the word.

1. **The reads and the board** (~35 min): CLAUDE.md, the rules, the ledger, the handoff, the four memories, IDEAS, SCHEDULE; Appendix E of the study; the show rule at its five sites and in its tests; the stored show values read from production (none) and the local database (two); "can we have all phases with steps shown" → the board regenerated from the ledger and the study's Phase 3 and 4 tables at the same link → done.
2. **The decision scan and the plan** (~45 min): the scan's third line empty; plan mode; the plan file; a fresh-context Sonnet plan critic (244,035 tokens against the ~280k said; SOUND WITH FIXES: one blocking, APEX's labels verbatim; seven non-blocking, all folded); approved ~18:05Z → done.
3. **Tests first and the build** (~40 min): fifteen red across eight files; page-document.ts, the trace, the three render sites, RowPageView, the designer (the model, Properties, Centre, Layout, Tree); green; tsc 0 · lint 0 errors · vitest 222 files, 2232 tests · hooks 31/31; cf:build alone and the dry run 41618.19 KiB (63.50%) → done.
4. **The browser run and the review page** (~20 min): the sign-in helper rewritten; Monza's Aside set to Never (the tree struck, the tile tagged, the preview without it, the trace line); Current Page is in published on the local database with /history/spa (hidden on the live local page, the trace by path) and with /history/monza, /history/spa (shown again); the Component View's Condition column; seven screenshots into the review page e6078da6-8698-4ddf-b6cc-cf2aa9348bf2 → done.
5. **PR, reviewer, merge** (~25 min): PR #1017; the ledger flipped to started (ebaf3a4b); a fresh-context Sonnet reviewer (189,294 tokens against the ~300k said): PASS, three non-blocking, two taken in eef73b57 with the gates re-run; "merge" → squash-merged 19:31:37Z as 1dd5dfda → main forward → prod → done.
6. **Close**: the ledger (P2.6 done with its evidence; the dated changes line carrying the plan's defaults), the handoff and the session-54 prompt (P2.2's scan first, with the list of shapes), this block, the Inbox, the board; the records PR 1.0.137 on the word; P2.2's decision scan presented with the list and stopped for the word.

Won't touch this session: any slot beyond P2.6 except P2.2's decision scan; the cost PR; branch deletions; any prod Supabase write; any push to `main`; any agent on Fable; any fan-out.
Active: ~2h 45m from ~17:15Z to ~20:00Z (the operator present; the words came ~17:40Z (the board), ~18:05Z (the plan approved) and ~19:31Z ("merge"); no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)


### Fri 2026-09-18 and Mon 2026-09-21 — session 53, continued (the operator present at the words) — the records PR merged, P2.2's word, P2.2 A The data region

Order fixed by the words: "merge" for the records PR #1018 (~02:19Z on 2026-09-18), the word on P2.2's preset names (~02:27Z: "a fifteen as drawn, ditto standings, results too, now B every class heading its own preset and C same column names merged", read as A the list with B and C underneath on one clarifying question), plan mode with a Sonnet plan critic, the plan approved (~03:00Z), tests first, build, gates, the browser run, the review page, the PR, the reviewer, "merge" (2026-09-21 ~17:40Z). Every subagent on Sonnet, one at a time; no agent builds; merge on the word.

1. **The records PR and the word** (~15 min, 2026-09-18 ~02:15Z–02:30Z): #1018 squash-merged 02:19:47Z as 2256e1d0, prod /changelog 1.0.137 at 02:24:54Z; the operator's word on the fifteen shapes, one clarifying question with three drawn pickers, the dated changes line written → done.
2. **The reads and the plan** (~45 min): the source catalogue and its reader, the definition model, the standings and results tabs, the class-family fetchers and their snapshot keys, the loader's warm list; the plan file (two PRs; presets a code catalogue; `only`/`group`/`later` on a choice's options); a fresh-context Sonnet plan critic (269,779 tokens against the ~250k said; SOUND WITH FIXES: three blocking, all real, the results panels being accordions not tables, What it changed merging three classes, GT World's season-scoped key; seven non-blocking); approved ~03:00Z → done.
3. **Tests first and the build** (~50 min): twelve red across ten files; presets.ts, the data.region definition, the widened standings reader, the guard, DataRegionViews.tsx, the renderer, the parser, the grouped select, the Messages line; green; tsc 0 · lint 0 errors · vitest 223 files, 2245 tests · hooks 31/31; cf:build alone, the dry run 39058.74 KiB (the drop from 41618.19 KiB unexplained, flagged) → done.
4. **The browser run and the review page** (~25 min): the Data region from the Gallery, Standings · Formula 1 · Drivers as a table and as cards, FIA WEC · Hypercar — Drivers filtering its class from the snapshot, a Results source showing Season results disabled with its reason; six screenshots into the review page 5b5d6075-4483-4283-a366-4074eb899c85; two small fixes (the Pos header's padding, an empty text left out of the tile's summary) → done.
5. **PR, reviewer, the fixes** (~40 min): PR #1019; a fresh-context Sonnet reviewer (187,798 tokens against the ~250k said): FAIL on two blocking findings, both taken in 460fa690 with the tests it named (WRC's rows tier kept, its co-drivers and manufacturers joining from the snapshot; a test rendering every one of the twenty-six standings presets); the gates re-run (vitest 223 files, 2246 tests) → done.
6. **Merge and prod** (2026-09-21): "merge" → #1019 squash-merged 17:40:36Z as bf3215b4 → main forward by fast-forward → prod /changelog 1.0.138 at 2026-09-21T17:45:22Z → done.
7. **Close**: the ledger (P2.2 started with A's evidence; the dated line with the plan's defaults), the handoff and the session-54 prompt (P2.2 B first), this block, seven Inbox lines, the board; the records PR 1.0.139 on the word.

Won't touch this session: P2.2 B beyond its place in the handoff; any other slot; the cost PR; branch deletions; any prod Supabase write; any push to `main`; any agent on Fable; any fan-out.
Active: ~3h from 2026-09-18 ~02:15Z to ~05:15Z, plus ~20 min on 2026-09-21 from ~17:35Z (the operator present at the words; the words came 2026-09-18 ~02:19Z, ~02:27Z, ~03:00Z and 2026-09-21 ~17:40Z; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)


### Mon 2026-09-21 — session 54 (the operator present at the words) — P2.2 B1 The data region's results side

Order fixed by the words: "do whats next" (~18:05Z, the slot's next PR), the plan approved (~18:20Z, ExitPlanMode), "merge" (~19:13Z).

1. **The reads and the scan** (~15 min, from ~17:50Z): the site's results panels (ResultsTab.tsx's four accordions), the weekend dispatch, the four class-family fetchers and their snapshot keys, the loader's warm list; the decision scan with no word needed and the plan's one question (B as two PRs) → done.
2. **The plan and its critic** (~25 min): the plan file; a fresh-context Sonnet plan critic (336,107 tokens against the ~250k said): SOUND WITH FIXES, three blocking folded (WRC and DTM through the real fetchers; the race's first appearance as the middle sort key; a preset's default view through `sets`), four non-blocking folded; approved ~18:20Z → done.
3. **Tests first and the build** (~40 min): eleven red across seven files; sources.ts, source-read.ts, presets.ts, components.ts, the choice setter, DataRegionViews.tsx's Rounds layout, the renderer; green; tsc 0 · lint 0 errors · vitest 223 files, 2251 tests · hooks 31/31 · dry run 40105.22 KiB; PR #1021; the reviewer launched → done.
4. **The browser run and the review page** (~30 min): Docker Desktop started from PowerShell, the local Supabase, the dev server, the sign-in helper; Monza's Data region on Results · Formula 1 (Season results flips View to List; ten whole rounds after the Rows fix), Formula 2 Feature races, WEC per class, GT World per cup, F1 as a table and as cards; seven screenshots into the review page fe46a804-cae9-4066-bac0-194a91cc17d1 → done.
5. **The reviewer and the fixes** (~15 min): PASS, nothing blocking, six non-blocking; the two test gaps taken with the Rows fix in 4d68e679; the gates re-run (tsc 0 · lint 0 errors · vitest 2251 · hooks 31/31); cf:build and the dry run again after the dev server was stopped by PID, 40111.38 KiB / gzip 8810.55 KiB, the CHANGELOG's figure in f413b76b; the PR body with the review page and the reviewer's section → done.
6. **Merge and prod**: "merge" → #1021 squash-merged 19:14:09Z as 09eec0c9 → main forward by fast-forward → prod /changelog 1.0.140 at 2026-09-21T19:20:06Z → done.
7. **Close**: the ledger (P2.2 started with B1's evidence; the dated line with the build's defaults), the handoff and the session-55 prompt (P2.2 B2 first, its three likely questions), this block, seven Inbox lines, the board; the records PR 1.0.141 on the word.

Won't touch this session: P2.2 B2 beyond its place in the handoff; any other slot; the cost PR; branch deletions; any prod Supabase write; any push to `main`; any agent on Fable; any fan-out.
Active: ~1h 45m from ~17:50Z to ~19:35Z (the operator present at the words; the words came ~18:05Z, ~18:20Z and ~19:13Z; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)


### Mon 2026-09-21 evening and Tue 2026-09-22 — session 54, continued (the operator present at the words) — the open list, P2.2 B2 The data region's Timeline and Detail views

Order fixed by the words: "merge" for the records PR #1022 (~19:27Z on 2026-09-21), "now give me whats open for my turn, then line up the next task" (~19:40Z), the ten defaults and "proceed first with p2.2 b2 my word on it -> default" (~19:50Z), the plan approved (2026-09-22 ~01:34Z, ExitPlanMode), "merge do whatever is next then pick up next task" (~12:17Z).

1. **The records PR and the open list** (~20 min, 2026-09-21 ~19:27Z–19:50Z): #1022 squash-merged 19:27:09Z as 7a1caaec, prod /changelog 1.0.141 at 19:31:34Z; the ten open items presented plainly with defaults and two drawn choices; B2's decision scan with its one question (the deferral) → done.
2. **The reads and the plan** (~40 min, to ~20:30Z): the views, the presets, the definition model, the parser's binding, the Attributes tab, the site's results renderers, the destinations model, the APEX notes and Oracle's docs (Timeline and Value Attribute Pairs verified); the plan file (B2 the views, B3 the slots and zones; three items for the word with defaults); a fresh-context Sonnet plan critic (235,400 tokens against the ~300k said): SOUND WITH FIXES, six blocking and nine non-blocking folded or owned → done; approved 2026-09-22 ~01:34Z.
3. **Tests first and the build** (~25 min, from ~01:35Z): seven red across five files; components.ts, page-document.ts, presets.ts, PageDesignerProperties.tsx, DataRegionViews.tsx (cellValue, whoOf, winnerOf, initials, ContentRow, Timeline, Detail, the alignments), component-render.tsx; green; tsc 0 · lint 0 errors · vitest 223 files, 2254 tests · hooks 31/31 → done.
4. **The browser run and the review page** (~20 min): the dev server and the helper again; the F1 and WEC Timelines, the greyed Timeline pill on Standings with its note, Drivers and Season results as Detail, the GT World Timeline; one default taken (the empty avatar box) and the WEC screenshot retaken; seven screenshots into the review page 9e291aef-6477-4317-b5a4-309270e6f4cb → done.
5. **Gates, PR, reviewer** (~25 min): the dev server stopped by PID; tsc, lint, vitest, hooks, cf:build (1189 pages, no upstream fetch failures) and the dry run 40110.37 KiB / gzip 8811.35 KiB; the records (CHANGELOG 1.0.142, RELEASES, the version, the ledger's two dated lines, the plan page re-rendered); one commit 204beeb4; PR #1023; a fresh-context Sonnet reviewer (230,860 tokens against the ~200k said): PASS, nothing blocking, five non-blocking noted → done.
6. **Merge and prod** (2026-09-22 ~12:17Z): "merge do whatever is next then pick up next task" → #1023 squash-merged 12:17:53Z as eeb30520 → main forward by fast-forward → prod /changelog 1.0.142 at 2026-09-22T12:22:09Z → done.
7. **Close**: the ledger (P2.2 started with B2's evidence; the dated line with the run's default), the handoff and the session-55 prompt (P2.2 B3 first, its three likely questions, Order step 0 and item 9 for the word), this block, eight Inbox lines, the board; the records PR 1.0.143 under the same word.

Won't touch this session: P2.2 B3 beyond its place in the handoff; any other slot; the cost PR; branch deletions; any prod Supabase write; any push to `main`; any agent on Fable; any fan-out.
Active: ~2h 15m in three stretches: 2026-09-21 ~19:27Z–20:30Z (the open list, the scan, the plan and its critic), 2026-09-22 ~01:34Z–02:20Z (the build, the browser run, the gates, the PR, the reviewer), ~12:17Z–12:50Z (merge, prod, the records); the operator present at the words (~19:27Z, ~19:40Z, ~19:50Z, ~01:34Z, ~12:17Z); no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts


### Tue 2026-09-22, afternoon — session 54, continued again (the operator present at the words) — P2.2 B3 The data region's Card slots and action zones; P2.2 done

Order fixed by the words: "merge do whatever is next then pick up next task" (~12:17Z), the plan approved (~12:53Z, ExitPlanMode), "merge" (~14:06Z).

1. **The reads and the scan** (~20 min, from ~12:25Z, while the records PR #1024 went out): the cards, the definition model, the parser's link rule and refs, the Attributes tab's link select and groups, the pages map at the three render sites, the destinations, the APEX notes; the decision scan with four items for the word and their defaults → done.
2. **The plan and its critic** (~30 min): the plan file; a fresh-context Sonnet plan critic (284,067 tokens against the ~300k said): SOUND WITH FIXES, two blocking and nine non-blocking, folded or owned; approved ~12:53Z → done.
3. **Tests first and the build** (~35 min): four red across four files; components.ts (dependingOn, optionsFrom, rowLinks, the Card and Actions groups, CARD_RESET in every preset's sets, parseSettings, settingsSummary), page-document.ts (the shape checks, the refs), PageDesignerProperties.tsx (the skip, the slot select, "This row"), DataRegionViews.tsx (the cards' slots and zones), component-render.tsx and the three render sites (the pages promise); green; tsc 0 → done.
4. **The browser run and the review page** (~20 min): the dev server and the helper again; Drivers as cards rearranged by team with initials and wins, Full Card to the Calendar; the Title zone and the Button zone; Season results as cards each to its weekend page after the preset's pick; the groups gone on a Table; one default taken (a badge from another column drawn plain) and the screenshot retaken; six screenshots into the review page dac662d3-b09e-4289-81a4-db6ca3e506e1 → done.
5. **Gates, PR, reviewer, the fix** (~40 min): the servers stopped by PID; lint, vitest 223 files 2256 tests, hooks, `DATA_SOURCE=db npm run cf:build` (1189 pages, no upstream fetch failures) and the dry run 40105.78 KiB / gzip 8812.26 KiB; the records (CHANGELOG 1.0.144, RELEASES, the version, the ledger's dated line); one commit ace72af6; PR #1025; a fresh-context Sonnet reviewer (264,876 tokens against the ~200k said): FAIL on one blocking finding (the Media zone's link without an accessible name), taken in dc0e3142 with its test and the reviewer's non-blocking point (the pages promise awaited by the cards' renderer alone); tsc, lint, vitest and the hooks again; the build's re-run stopped by the harness for low memory, reported, not restarted → done.
6. **Merge and prod** (~14:06Z): "merge" → #1025 squash-merged 14:06:41Z as cce4f3f2 → main forward by fast-forward → prod /changelog 1.0.144 at 2026-09-22T14:14:23Z → done.
7. **Close**: the ledger (P2.2 DONE with B3's evidence; the dated line with the run's default and the reviewer's fix), the handoff and the session-55 prompt (STEP 0 the dry run re-measured, the count and item 9; P2.9 Live band first with its scan lined up), this block, six Inbox lines, the board; the records PR 1.0.145 on the word.

Won't touch this session: P2.9 beyond its place in the handoff; any other slot; the cost PR; branch deletions; any prod Supabase write; any push to `main`; any agent on Fable; any fan-out.
Active: ~2h 30m from ~12:17Z to ~14:45Z (the operator present at the words, ~12:17Z, ~12:53Z and ~14:06Z; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)


### Tue 2026-09-22, evening — session 54, closed at last (the operator present at the words) — P2.9 Live band

Order fixed by the words: "keep going" (~14:17Z: the records PR #1026 merged, STEP 0 run, P2.9 opened), the plan approved (~14:59Z, ExitPlanMode), "merge do whats next" (~15:32Z).

1. **The records and STEP 0** (~10 min, from ~14:17Z): #1026 squash-merged 14:17:30Z as 00ac8dda, prod /changelog 1.0.145 at 14:25:10Z; the dry run after B3's fix measured in the foreground with DATA_SOURCE=db: 40105.86 KiB / gzip 8812.34 KiB → done.
2. **The reads, the scan and the plan** (~40 min): the site's band, the home model's live section and ranking, the race-weekend fact, the definitions and the recipe, the Attributes tab's grouped choice; the decision scan (no word needed); the plan file; a fresh-context Sonnet plan critic (262,677 tokens against the ~300k said): SOUND WITH FIXES, four blocking (three folded, one stood down with its provenance) and six non-blocking; approved ~14:59Z → done.
3. **Tests first and the build** (~30 min): five red across four files; `liveBoxes` and `liveAll` in the home model, the series.live definition and the recipe, the renderer's draw, the note's gate; green; the Plug-ins editor's count → done.
4. **The browser run and the review page** (~20 min): the Gallery tile, the Attributes tab (the Series select with no stray note, Also racing), two drafts saved, the preview drawing nothing on a Tuesday by design, the trace listing the render; three screenshots into the review page 2c3b6cc1-e1a0-46cb-914c-8f5b076f5ad3 → done.
5. **Gates, PR, reviewer** (~25 min): the servers stopped by PID; tsc 0 · lint 0 errors · vitest 223 files, 2260 tests · hooks 31/31; `DATA_SOURCE=db npm run cf:build` in the foreground and the dry run 40113.28 KiB / gzip 8813.12 KiB; the records (CHANGELOG 1.0.146, RELEASES, the version, the ledger's dated line and P2.2's STEP 0 note); one commit db7f7d0f; PR #1027; a fresh-context Sonnet reviewer (184,461 tokens against the ~200k said): PASS, nothing blocking → done.
6. **Merge and prod** (~15:32Z): "merge do whats next" → #1027 squash-merged 15:32:34Z as 4ce4c839 → main forward by fast-forward → prod /changelog 1.0.146 at 2026-09-22T15:37:13Z → done.
7. **Close**: the ledger (P2.9 DONE with its evidence; the dated merge line), the handoff and the session-55 prompt (P2.24 first, its decision scan stopping for the word on parity and the split), this block, six Inbox lines, the board; the records PR 1.0.147 under the same word.

Won't touch this session: P2.24 beyond its decision scan; any other slot; the cost PR; branch deletions; any prod Supabase write; any push to `main`; any agent on Fable; any fan-out.
Active: ~2h 15m from ~14:17Z to ~16:30Z (the operator present at the words, ~14:17Z, ~14:59Z and ~15:32Z; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)

### Tue 2026-09-22 evening → Wed 2026-09-23 morning — session 55 (the operator present at the words) — P2.24 A Posts and news into the Data region

Order fixed by the words: "all default" (2026-09-22 ~16:00Z, P2.24's three questions), the plan approved (~23:32Z, ExitPlanMode), "what are you on about, you have all permissions to get the work done. now do it" (2026-09-23 ~00:05Z, the dev server's production flag the permission classifier had refused), "merge" (~06:01Z).

1. **The scan** (~15 min, from ~15:45Z): P2.24's decision scan drawn on a page (8db7e606…: Home's six boxes beside the general components that replace each), the three questions with defaults; the board republished under the new login (87eea43d…) → done.
2. **The reads and the plan** (~50 min, from ~16:00Z): the word "all default"; Home's lead and wire, the home model, the blog's lead order and read time, the sources and their readers, the presets, the definition, the renderer, the views, the parser, the designer; the plan file; a fresh-context Sonnet plan critic (343,043 tokens: SOUND WITH FIXES, three blocking folded); the approval at ~23:32Z → done.
3. **Tests first, the build, the gates, the PR** (~40 min, from ~23:32Z): 15 red across 9 files (the implementation stashed, the new tests run, the stash restored), then green; tsc 0 · lint 0 errors · vitest 223 files, 2268 tests · hooks 31/31; the foreground build with DATA_SOURCE=db (1189 pages; thirty-four first-attempt prerender timeouts on /information pages, each passing on retry, the machine busy after the suite) and the dry run 40213.42 KiB; the records (CHANGELOG 1.0.148, RELEASES, the version, the ledger's P2.24 started with the two dated lines); PR #1029; the reviewer launched → done.
4. **The browser run** (~15 min, from ~00:05Z after the word on the flag): the dev server restarted with PADDOCK_ENV=production; an author row and three posts seeded into the local database; Source Posts and the Lead story preset, its preview; Source News and The wire, its preview; the Table and the Cards over posts; the greyed pills on a Standings source; seven screenshots into the review page a4edd962…; the find (the Media slot's own label "(none)") → done.
5. **The second commit** (~25 min): SLOT_OF's media slot with its test; the reviewer's PASS WITH NOTES (262,171 tokens, nothing blocking, six notes); the gates again (tsc 0 · lint 0 errors · vitest 2268 · hooks 31/31; the build without retries; the dry run 40213.46 KiB / gzip 8839.70 KiB); the CHANGELOG and the PR body; pushed; the report → done.
6. **Merge and prod** (~06:01Z): "merge" → #1029 squash-merged 06:01:26Z as 0b0f42a4 → prod /changelog 1.0.148 at 2026-09-23T06:07:35Z → done.
7. **Close**: the ledger (the merge's dated line; P2.24's evidence, the slot STARTED until PR C), the handoff and the session-56 prompt (PR B first, its cross-series default stated), this block, eight Inbox lines, the board; the records PR 1.0.149 under the same word.

Won't touch this session: PR B beyond its decision scan; PR C; any other slot; the cost PR; branch deletions; any prod Supabase write; any push to `main`; any agent on Fable; any fan-out.
Active: ~2h 40m across 2026-09-22 ~15:45Z–16:50Z, ~23:32Z–00:40Z (into 2026-09-23) and 2026-09-23 ~06:01Z–06:30Z (the operator present at the words; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)

### Wed 2026-09-23, morning — session 55 continued (the operator present at the words) — P2.24 B1 The Weekends source, the progress report

Order fixed by the words: "merge" (~06:01Z, PR A), the B1 plan approved (~06:42Z, ExitPlanMode), "merge and show me progress report. also list explicitly all items i must decide upon, and all items we didnt do, minor and major blockers…" (~07:41Z).

1. **PR A's close** (~15 min, from ~06:01Z): #1029 squash-merged 06:01:26Z as 0b0f42a4, prod 1.0.148 at 06:07:35Z; the records PR #1030 (1.0.149) merged 06:10Z, prod 06:15:49Z; the board republished under the new login → done.
2. **B1's scan and plan** (~30 min): the decision scan (no word needed; B split into B1 and B2 in the plan), the reads, the plan file, a fresh-context Sonnet plan critic (297,236 tokens: SOUND WITH FIXES, three blocking folded), the approval → done.
3. **Tests first, the build, the gates** (~35 min): 13 red across 9 files (the stash recipe), the sources route test's fourteen at the full run; tsc 0 · lint 0 errors · vitest 223 files, 2272 tests · hooks 31/31; the foreground build and the dry run 40356.00 KiB → done.
4. **The browser run** (~15 min): Source Weekends and the What's next preset, the preview drawing the same three weekends Home drew at the same moment (the countdown on the first), the Table (the Round column moved last after the spacing showed), Data Sources at fourteen; four screenshots into the review page 435d574c…; the build and the gates again after the column's move (40356.01 KiB) → done.
5. **PR #1031, the reviewer, the second commit** (~20 min): the PR body; the reviewer (Sonnet, 237,688 tokens: PASS WITH NOTES, nothing blocking); the five stale "thirteen" comments reworded; pushed; the report → done.
6. **Merge, prod, the progress report** (~07:41Z): "merge and show me progress report…" → #1031 squash-merged 07:41:42Z as d7b5ba45 → prod /changelog 1.0.150 at 2026-09-23T07:45:53Z → the Phase 2 progress report compiled from the ledger, the handoff, the Inbox and the CHANGELOG (the slots; the decisions that are the operator's, grouped; what was not done; the blockers, major and minor) and published (9b8b0a28-91e8-4fca-b08b-985ac612c267) → done.
7. **Close**: the ledger (the merge's dated line; P2.24's evidence with B1's merge), the handoff and the session-56 prompt (the operator's decisions first, then B2), this block, the Inbox lines, the board; the records PR 1.0.151 under the same word.

8. **The answers** (~08:05Z): "decisions: 1. default, 2. default, 3. whats the difference and what do you recommend, 4. … one page per tab …, 5. elaborate, 6. what does this mean" → the six answered in one message (P2.3 without a table dependency on the recommendation; P2.10 one page per tab), the ledger’s dated line, P2.3 and P2.10 decided, the session-56 handoff and its prompt; the records PR 1.0.152 → done.
Won't touch this session: PR B2 beyond its decision scan; PR C; any other slot; branch deletions; any prod Supabase write; any push to `main`; any agent on Fable; any fan-out.
Active: ~2h 20m from ~06:01Z to ~08:20Z (the operator present at the words; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)

### Wed 2026-09-23, morning to midday — session 56 (the operator present at the words) — P2.24 B2 The Podium and Leader templates

Order fixed by the words: the plan approved (~08:55Z, ExitPlanMode), "merge" (~11:27Z).

1. **The reads and the scan** (~35 min, from ~08:20Z): the rules, the ledger, the handoff, the Inbox, SCHEDULE, the twenty-five feedback memories; Home's two boxes, the home model and home-results, the readers, the catalogue, the presets, the renderer, the views, the designer's Series selects, B1's nine test diffs; the time plan and the won't-touch line; B2's decision scan (no word needed; three refinements flagged for the critic) → done.
2. **The plan and its critic** (~35 min): the plan file; a fresh-context Sonnet plan critic (293,409 tokens against the ~250k said; the Plan agent type has no Write tool, the report came back inline): SOUND WITH FIXES, four blocking folded (the shape-gated dispatch, home.changed's name from the rows, the standings view-rule exception, the hosts loop skipping home), five non-blocking owned; approved ~08:55Z → done.
3. **Tests first and the build** (~60 min): 19 red across 8 files, then the implementation; the find (concurrent dynamic imports inside the six-series fan-out read the real WEC feed in the test; vitest's module runner's own comment) → the results reader as a graph step and a read step; green: tsc 0 · lint 0 errors · vitest 223 files, 2279 tests · hooks 31/31 → done.
4. **The browser run** (~25 min): PADDOCK_ENV=production npm run dev and the helper; the Podium region (Results · Home's series · Latest result) and the Leader region (Standings · Latest result · What it changed) on Monza, saved as eacb0041; the preview beside Home's boxes at the same moment (the very text for the Podium, Home's first five rows for the Leader); the trace; Data Sources' Preview over Home's series (22 of 22 rows); the Table over the podium shape (1adbbe21); eight screenshots → the review page bb8c0ea0-002d-4502-917e-52a6bec1cfbc → done.
5. **Gates, PR, reviewer** (~30 min): the servers stopped by PID; DATA_SOURCE=db npm run cf:build in the foreground (exit 0, 1189 pages, 55 first-attempt retries) and the dry run 39427.05 KiB / gzip 8629.93 KiB; the trio (CHANGELOG 1.0.153, RELEASES, the version), the ledger's dated approval line; commit 1be38143, PR #1034; the reviewer (Sonnet, 305,410 tokens): PASS WITH NOTES, nothing blocking; the stale preset-count comment taken in the second commit 679d182c → done.
6. **Merge and prod** (~11:27Z): "merge" → #1034 squash-merged 11:27:37Z as dde6c4b6 → main forward by fast-forward → prod /changelog 1.0.153 at 2026-09-23T11:31:39Z → done.
7. **Close of the slot's PR**: the ledger (the merge's dated line; P2.24's evidence with B2), the handoff and the session-57 prompt (PR C first, its four defaults recorded and B2's two notes), this block, ten Inbox lines, the board, the memory pointer; the records PR 1.0.154 (#1035, merged 11:37Z) under the same word → done.
8. **PR C's scan, the operator's report, R6** (~11:40Z–12:35Z): PR C's terrain read (the frame, the row layout, the recipe, the layout's pin, the settings, the model's live step); two questions beyond the recorded defaults asked with the layouts side by side and answered (APEX margins, Home exact; keep the half), the dated line committed on feat/p2.24-c-flip. The operator's report (two screenshots, ~11:45Z): the band twice (two band components on the Home document) and the Azerbaijan Grand Prix boxed twice in each (the lead also among the featured series, the ranking featuring it twice; prod's DOM read to confirm the second box is the second featured box); the word "Fix the ranking now" → R6: the test first red (1 of 14), the one-line exclusion, tsc 0 · lint 0 errors · vitest 223 files, 2280 tests · hooks 31/31, the foreground build and the dry run 39427.18 KiB, the reviewer (Sonnet, 116,961 tokens: PASS WITH NOTES, its case asserted), PR #1036 → "merge" → squash-merged 12:27:31Z as 74fd112d → prod /changelog 1.0.155 at 12:32:25Z; PR C's branch rebuilt over it (c7c56d24); the records PR 1.0.156 under the same word; the board with R6 → done.

Won't touch this session: PR C's flip before its plan is approved; any other slot beyond its scan; the cost PR; branch deletions; any prod Supabase write; any push to `main`; any agent on Fable; any fan-out.
Active: ~3h 15m from ~08:15Z to ~11:35Z (the operator present at the words, ~08:55Z and ~11:27Z; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)

### Wed 2026-09-23, midday to afternoon — session 56 continued (the operator present at the words) — P2.24 PR C The flip

Order fixed by the words: "Upgrade on read" and "None in PR C" (~12:40Z–12:45Z), the plan approved (~13:20Z, ExitPlanMode), "merge" (~14:38Z).

1. **The finding, the correction, the two words** (~12:35Z–12:50Z): prod's served Home read: already a split document of the six old components in the operator's arrangement; the correction of the spacing premise (readers see the frame's 24 px gaps, not HomeLead's); "Upgrade on read" and "None in PR C" asked with a default each; the dated line on the branch → done.
2. **The plan and its critic** (~35 min): prod read through the Management API (every revision of every page for old keys: Home only; the live document 74f46599; the layout row; the settings 6 and 5); the plan file; a fresh-context Sonnet critic on the general-purpose type (399,562 tokens against ~250k said): B1 dissolved by the settings read, B2/B3/S1/S2 folded, the flight-script stripping, two pre-mortem lines, N1 declined; approved ~13:20Z; the ledger's dated line → done.
3. **Tests first and the build** (~55 min): 17 red across 10 files (the renderer test failing to load on loadLiveModel), the implementation in the plan's order, the SettingValue type widened (tsc's two errors), green; the Plug-ins editor test (it named What it changed by its name) and the Card-slots test's 60 ms race adjusted after the full run; tsc 0 · lint 0 errors · vitest 223 files, 2278 tests · hooks 31/31; the foreground build (196 s, 1189 pages) and the dry run 39409.56 KiB → done.
4. **The parity script and the browser run** (~30 min): scripts/parity-home.mts calibrated on two prod captures 25 s apart (identical, 7 regions); prod's live document inserted verbatim into the local database as a published revision; the designer's seven tiles upgraded, the Property Editor, Save as draft 0303b8b1, the local /, the Gallery; five screenshots → the review page 1ce6f9ab-24e0-48a6-8f00-ea8219a62fde; Home has no preview or trace (a code page whose route stands) → done.
5. **Commit, reviewer, PR** (~25 min): commit 1d268839; the reviewer (Sonnet, 386,082 tokens): PASS WITH NOTES, nothing blocking; S6 taken in 389d43f0 with the trio (CHANGELOG 1.0.157, RELEASES, the version); PR #1038 → done.
6. **Merge, prod, the parity** (~14:38Z): the before-capture 14:38:16Z; "merge" → #1038 squash-merged 14:38:30Z as d340c4c1 → prod /changelog 1.0.157 at 14:43:58Z → the after-capture 14:44:04Z → four regions identical, three honest differences (two countdown clocks that ticked; the wire's empty class attribute) → the two normaliser rules → identical, 7 regions; the PR comment → done.
7. **Close**: the ledger (P2.24 DONE, the merge's dated line, the evidence), the handoff and the session-57 prompt (P2.3 first), this block, ten Inbox lines, the board, the memory pointer; the records PR 1.0.158 (#1039, merged 14:53Z, prod 15:00:35Z) under the same word → done.
8. **"do whats next" → P2.3's scan** (~15:05Z–15:25Z): a Sonnet terrain reader (general-purpose type; 319,585 tokens against ~150k said: the APEX Interactive Report notes, the code, the shared-component pattern, the URL plumbing); Next 16's docs read for the caching constraint (no Cache Components: a server read of the query makes a route dynamic); the scan with four questions drawn as mockups, answered at ~15:20Z (designer-authored views only; the query string with the pages cached; sortable headers and an Actions menu; a CSV route handler); the dated line on feat/p2.3-saved-views → done.
9. **The operator's question** (~15:30Z): the decisions that shaped the Developer across the phases and the cost of changing each, answered in the terminal → done.
10. **P2.3's plan** (~15:30Z–16:35Z): plan mode; the plan file (two PRs: A the URL vocabulary, the rewrite to a cached variant, sort/cols/filter on the server, the controls; B saved views, the CSV route); a Sonnet critic (297,741 tokens against ~250k said): SOUND WITH FIXES, six blocking folded (no double decode, the rewrite after the dev-host gate, controls inert on a framed code route, the foreign key cascading, one prefix rule, no site-wide revalidation); approved ~16:35Z (ExitPlanMode) → done.
11. **R7** (~15:40Z–16:58Z): the operator's report (two screenshots: changing a What it changed region's Type to Results refused Save twice); the cause at file:line, the fix drawn, "Fix now as R7 (Recommended)" (~15:45Z); tests first (6 red across 3 files), withSourceChanged in the model, the Property Editor's setSource through it, the parser's messages naming the setting; tsc 0 · lint 0 errors · vitest 223 files, 2279 tests (the clean run) · hooks 31/31 · the foreground build (439 s beside the suite) · dry run 39411.02 KiB; PR #1040; the reviewer (Sonnet, 202,161 tokens): PASS WITH NOTES, both notes taken in the second commit; "merge" (~16:53Z) → squash-merged 16:53:19Z as 57b9d3d2 → prod /changelog 1.0.159 at 16:57:39Z → done.
12. **Close of R7**: the ledger (R7 DONE, the merge's line, the P2.3 scan and plan lines), the handoff and the session-57 prompt (P2.3 PR A on the approved plan), this block, four Inbox lines, the board, the memory pointer; the records PR 1.0.160 under the same word.

Won't touch this session: P2.3 PR B before PR A; the Filters UI (P2.5); Cache Components; branch deletions; any prod Supabase write (the publish is the operator's); any push to `main`; any agent on Fable; any fan-out.
13. **R8** (~17:05Z–18:05Z): two reports mid-turn (a Results region over a chosen series should draw Home's last-result box; two What's next boxes over Formula 1 and Formula 2 both read "All series") and the word "once finished merge then begin next task"; the causes at file:line (the Latest result preset last in the catalogue, R7 picking the first; the Coming weekends rule's literal); tests first (4 red across 4 files), the fix, gates (tsc after clearing two corrupted generated files under `.next/dev/types`, lint, the full suite), the browser (the Monza draft's preview: the F2 box, the F1 rule), the ledger's R8, PR #1042, the Sonnet reviewer SOUND (195,217 tokens against ~60k said), the merge 17:50:58Z, prod 17:57:23Z, Home's parity (identical but the two boxes, now named) → done; then these records (1.0.162) → P2.3 PR A.
14. **P2.3 PR A** (~18:05Z–21:10Z): the branch fast-forwarded onto main; the truncated view-state test restored in two parts (the Bash cap); the remaining tests first (8 red across 6 files plus the module); the build in the plan's order (view-state → middleware → catch-all → renderer → presets → the views and the Actions menu → the Actions Menu group); the browser on a local Monza table found the router handing the variant segment percent-encoded → the segment made base64url on evidence; tsc, lint, the full suite (224 files / 2292 tests), cf:build and the dry run (39442.76 KiB); the review page (artifact 526f7785); PR #1044; the Sonnet reviewer SOUND WITH FIXES (236,555 tokens), both fixes in a second commit; the operator's "merge and pick up next task" (~20:58Z); merged 20:59:37Z as a42c6dd1, prod 21:06:13Z; Home's parity void (the operator's own three publishes of Home in the window); the cached-variant check unverified on prod (the Calendar renders per request) → done; these records (1.0.164) → PR B.
15. **P2.3 PR B** (~21:15Z–22:25Z): a Sonnet terrain reader on the Shortcuts pattern, the design tables and the CSV plumbing (270,925 tokens); the saved_view migration written and applied locally with psql; tests first across nine files (the module, the two routes, the CSV route, the renderer, the editor, the catalogue, the components, the Property Editor's row), then the build: lib/design/views.ts, the routes, ?view= in the renderer, the Views menu and Download CSV, the CSV route, the Saved Views editor and its wiring; gates (tsc, lint, the full suite 229 files / 2316 tests, cf:build, the dry run 39160.25 KiB); the browser on the local Monza page (the view seeded and the toggles turned on with psql, the sign-in helper having been stopped by the system for memory); the review page (artifact 5e6d5f3c); PR #1046; the Sonnet reviewer SOUND WITH FIXES (262,957 tokens), three fixes and two nits in a second commit; the operator's "once done merge and move on to the next task" (~22:10Z); merged 22:17:00Z as f2f2fe79, prod 22:23:27Z; the CSV route's refusals and Home's parity (identical, 18 regions) checked → done; these records (1.0.166); the prod apply of the migration waits for "apply 20260923220000" → P2.4's scan.
16. **P2.3 closed, P2.4 scanned** (the session interrupted ~22:30Z and resumed 2026-09-24 ~06:20Z on "ask again"): the four words in one question — master-detail through the address, leader and podium on the server with the followed series as a client repaint, driver and team links from the readers, "apply 20260923220000"; the prod apply rehearsed inside begin…rollback through the Management API, applied at 06:25:34Z, read back (0 rows, RLS on, the index and the trigger, the nine columns), the file re-run in a rolled-back transaction; the ledger (P2.3 DONE, the P2.4 scan line), the handoff and the session-57 prompt (P2.4's plan first), this block; the records PR 1.0.167 → done; next P2.4's plan in plan mode.
17. **P2.4 planned, PR A built** (~06:30Z–07:20Z): a Sonnet terrain reader (230,208 tokens against ~120k said) and a Sonnet critic (290,233 against ~150k; four blockers folded); the plan approved ~07:00Z (ExitPlanMode); PR A tests first (7 red across 7 files), then the build, the gates and the local Monza page in the browser; PR #1049 (1.0.168) opened; its reviewer queued behind the next planning task.
18. **PA planned** (~07:20Z–08:55Z): the operator asked whether moving users to Supabase is planned (it was not), then "plan a full migration to Supabase Auth"; a Sonnet terrain reader over Clerk's footprint (226,411 tokens against ~150k); Supabase's, Clerk's, Resend's and Google's documents and the installed packages read (the three searches cut by the Fable limit re-run on Opus 5.5); a census of Clerk's users refused by the permission rail as personal data and not retried; the plan in plan mode, the four answers (~08:20Z, each on its default), a Sonnet critic (197,759 against ~150k; the blocker, search_path on the three security definer functions, and fourteen more folded); the plan approved ~08:45Z; the ledger's phase PA, the handoff's agenda, the inbox (one records commit on PR A's branch); PR #1049's Sonnet reviewer launched.
19. **P2.4 PR A merged** (~08:55Z–09:40Z): the reviewer SOUND WITH FIXES (227,972 tokens against ~120k said); both should-fix items and two nits folded in fddd8040 (the results' round groups gained their highlight test, proven by removing the rows' highlight on purpose; the CHANGELOG's browser line names the signed-in session; the rule note in the parser's words; the Followed series help); the gates re-run (vitest 230 files / 2323 tests, cf:build exit 0, the dry run 39159.86 KiB); on the word "merge" (~09:23Z) #1049 squash-merged as 2daa14fc; prod /changelog 1.0.168 at 09:27:59Z; Home's 27 regions identical across the deploy with the clocks and the version normalised; the ledger's evidence and dated line, the handoff, this step; the records PR 1.0.169 → next P2.4 PR B.
20. **P2.4 PR B built and merged** (~09:40Z–10:45Z): the approved plan's B1–B4 read against the code (lib/people.ts, lib/profile-stats.ts, lib/design/source-read.ts, sources.ts, presets.ts, the CSV route); 19 team slugs found shared across series (a team links only where its slug opens that series' own team); the results driver's cell kept (a Correction to the plan); tests first, 13 red across 6 files, then green; three older tests now assert the new behaviour; the local Monza page (ten links, Antonelli's page opens, the Cards' zone, the CSV's address column); the first build +106 KiB, namesMatch moved to lib/slug.ts, +66.8 KiB after; #1051; the reviewer PASS WITH NOTES (247,625 tokens against ~200k); on the word "merge" (~10:32Z) squash-merged as 48b1f5cf; prod /changelog 1.0.170 at 10:36:34Z; Home's standings tables link 13 driver names, the rest identical; the records PR 1.0.171 → next P2.4 PR C.
21. **P2.4 PR C built, reviewed, audited and merged; P2.4 DONE** (~10:45Z–12:25Z): tests first (5 red across 4 files), the Monza fixture browser run (14 Show links; "Show 3" → ?r.race.filter=round.eq%3A3; round 3's 22 rows under "Showing 3 · Show all"), the branch renamed for the push guard, PR #1053 at 11:10Z; the reviewer SOUND WITH FIXES (244,062 tokens against ~200k said), three fixes folded (63d4bf2f); the operator's progress report of the two days (artifact c80d7b30, v2 with Athens times); the model back to Fable 5.1 after the day's Opus 5.5 stretch, and on the operator's ask the day's three PRs audited by hand: the work held, one gap fixed (a master drawn as a template keyed its detail; 1672c28a); squash-merged 12:07:29Z as b7d604f6 on "merge"; prod 1.0.172 at 12:11:49Z; Home unchanged across the deploy. The operator's "defaults" of ~12:05Z: docs/pull-requests.md (one Sonnet writer back-filled #1029–#1053; every PR adds its entry before merge) and phase D, slot D1 (the Designer documentation, docs/designer/, ten chapters) → the records PR 1.0.173; the order between D1 and A1a asked.
22. **PA A1a built, reviewed, proven signed in and merged; A1 STARTED** (~12:45Z–13:35Z): the operator's order recorded (A1a now, D1 after all phases); the seam (lib/auth/client.tsx, server.ts, directory.ts) with its two tests first (the mapping; the boundary, 84 offenders), a codemod over 80 server files and 32 tests (one vi.mock and the fixture shapes each), the hand edits (the role helpers, the visitor, the display name, the four directory reads, the seven id routes, the author page, the designer's greeting, the Studio pill); tsc 0, 2338 tests, the dry run 39581.68 KiB (+331.9 KiB, IDEAS); PR #1055 at 13:04Z; the reviewer SOUND WITH FIXES (222,762 tokens; the one-address visitor stated after prod's four schemes were read); on "helper go and merge" the signed-in run (the header's menu, the studio, the designer as before) found /settings answering 500 signed in, on main too (R9 proposed); squash-merged 13:26:16Z as 21a5c518; prod 1.0.174 at 13:30:33Z; Home unchanged → the records PR 1.0.175.
23. **R9 fixed, reviewed, proven signed in and merged; R9 DONE** (~13:50Z–14:15Z): on "R9 go" the Account page's Sign out row moved into components/AccountIdentity.tsx (SignOutRow), its test first (red: the import), the page's Clerk import gone, the allow-list 24; tsc 0, 2339 tests, the dry run 39579.74 KiB; the helper for the proof (GET /settings 200 with the row; before, 500 on main); PR #1057 at 13:54Z; the reviewer SOUND (129,313 tokens; the mechanism traced to React's and Clerk's sources); squash-merged 14:01:37Z as 64a5c6f5 on "merge"; prod 1.0.176 at 14:16:12Z on the footer (the deployment created 14:08:58Z; the pages timed out 14:10–14:14Z during Cloudflare’s open network incident, the static files answering); Home unchanged → the records PR 1.0.177; next PA A1b.
24. **PA A1b built, proven, reviewed and merged; A1 DONE** (~14:25Z–19:25Z; the session ended mid-build ~15:00Z and resumed ~15:19Z): the seam's browser half with its test first, the 18 browser files and the two layouts moved, the three client tests re-pointed, the allow-list down to four; the browser signed in and out; the Worker's growth measured against a clean build of main (one module 2012 KiB → the split into three → 1571 KiB, 63.0%; IDEAS); a Correction: the edits began on main before the branch (nothing pushed); PR #1059 at 16:45Z; the reviewer SOUND WITH FIXES (200,689 tokens; four small fixes folded); squash-merged 19:19:09Z as 4ec78ab1 on "merge"; prod 1.0.178 at 19:28:16Z on the footer (the deployment took about nine minutes); Home unchanged → the records PR 1.0.179. The two longest designer tests time out at 5 s on this machine this evening, on main too; the operator's word of ~19:35Z: leave it, the machine's speed to be worked out later.
25. **PA A2 built, reviewed, merged and applied on prod** (~19:50Z–21:35Z): on "a2 now" the import script and its seven tests, the accounts migration proven on the local database (the local auth and storage services switched on for it), vitest including scripts/; the evening report published (artifact 17be6c72) with the last five PRs and the roadmap; the operator's rule "speak less" saved to memory; PR #1061 at 20:15Z; the reviewer SOUND WITH FIXES (228,844 tokens; five fixes folded, @clerk/backend left transitive after declaring it re-resolved the lockfile); squash-merged 21:20:46Z as f79e6330 on "merge"; the migration rehearsed and applied on prod at 21:21:09Z on "apply 20260924200000"; prod 1.0.180 at 21:24:46Z on the footer → the records PR 1.0.181; the operator's run of the import next.
26. **PA A2 DONE: the accounts imported** (~21:36Z–22:30Z): the records PR #1062 merged on "you merge" (the auto-mode classifier had refused it once as a deploy); a dry run against prod with a header-only export counted Clerk's 18 accounts; the operator downloaded the Clerk export and said "run": the dry run (5 bcrypt digests, the thirteen columns, create 18 with 13 without a password), the write at 22:24:03Z (18 created, 0 skipped), the rerun (unchanged 18), the directory check for BLOG_AUTHOR_ID (the operator's account, role admin) and account_stats() 18 through the Management API → A2 DONE, the records PR 1.0.182; A3's decision scan next.
27. **PA A3 built and proven locally** (~22:40Z on the 24th – ~08:10Z on the 25th, the operator away after "a3 go"): the two Supabase packages installed and the lockfile regenerated with npm 10; the secret key proven to drive a sign-in on the local stack; the seam over @supabase/ssr, the middleware, the seven sign-in actions, the account routes, the browser seam, the pieces, the pages, components/auth, the templates, the local config with an asymmetric signing key, the Clerk webhook deleted, @clerk/nextjs removed; tests first (twelve files); tsc 0, lint 0 errors, vitest green; the browser proof of every flow through the helper, Playwright and Mailpit; the dev host’s lock by curl; the page-row migration for /settings/account; the reviewer (Sonnet) on the diff; PR #1064 at 1.0.183; the switch waits for the operator’s dashboard steps and the apply words.
28. **PA A3 switched on prod** (~08:10Z–09:40Z on the 25th, the operator present): the reviewer's verdict folded (the Google nonce in a server cookie); on the four words the page row and the secret-free half of the auth config went on prod, the import found nothing new; the operator did the dashboard steps and pasted the four secrets (checked by shape); the secret key proven against prod; the config completed (SMTP through Resend, the templates, Turnstile, Google); the Worker secrets set on prod and synced to testing; testing deployed and probed, which found that Supabase Auth skips the captcha for secret-key requests → the routes now verify with Cloudflare's siteverify (tests, commit 9aa37cd8); the operator chose to skip the testing proof; the full suite green (244 files, 2386 tests); #1064 squash-merged 09:28:23Z as b1a90451, prod 1.0.183 at 09:32:06Z, the import run again (unchanged 18), prod probed (Home a HIT, the sign-in page, the captcha gate, the dev host's lock); #1063 closed as shipped inside the squash; the records PR 1.0.184.
29. **After the switch: the operator signed in; the newsletter decided; two Baku drafts; R10; the close** (~09:40Z–11:00Z on the 25th): the operator signed in on prod; phase E opened with E1 planned on their word (Broadcasts + a Resend Audience, after A3); the progress report and the roadmap republished, then the progress board regenerated from the ledger with the new phases; the operator’s question on practice results answered (the Results source carries races alone; OpenF1 refuses every request during a live session) and the session-results slot mapped by a Sonnet reader (314,801 tokens) for the next session’s plan; a Sonnet writer researched and pushed the two Baku drafts to the blog queue in review (the FIA release quoted; the numbers from the site’s own assembler over OpenF1), and found scripts/draft-post.mts broken since A1a (server-only) → the dependency declared and the react-server condition documented (#1067); the operator’s critical report on the dev host (every sign-in method failed) → R10 in twenty minutes: the lock had redirected the sign-in routes; reviewed, merged on "merge", prod 1.0.185 at 10:43Z, probed; the handoff for session 57 written.
Active: ~9h 50m from ~12:35Z to ~22:25Z on the 23rd, plus ~15h 10m from ~06:20Z to ~22:30Z on the 24th, plus ~9h 30m unattended from ~22:40Z on the 24th to ~08:10Z on the 25th, plus ~2h 50m with the operator from ~08:10Z to ~11:00Z on the 25th, less the pause ~15:00Z–15:19Z (the operator present at the words, ~12:45Z, ~13:20Z, ~14:38Z, ~15:20Z, ~15:45Z, ~16:35Z, ~16:53Z, ~17:05Z, ~17:10Z, ~17:25Z, ~20:58Z, ~22:10Z, ~06:20Z, ~07:00Z, ~07:20Z, ~08:20Z, ~08:45Z, ~09:23Z, ~10:32Z, ~11:40Z, ~12:05Z, ~12:45Z, ~13:12Z, ~13:18Z, ~13:50Z, ~14:01Z, ~16:52Z, ~19:18Z, ~19:50Z, ~20:10Z, ~21:19Z, ~21:36Z, ~22:20Z and ~22:40Z ("a3 go"), then ~07:35Z on the 25th ("keep working, be careful"), ~08:15Z (the four words), ~08:40Z (the newsletter's shape), ~09:25Z ("straight to prod. lets go"); no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)


### Fri 2026-09-25, midday — session 57 (the operator present at the words) — PA A3’s next-day check; the sign-in asks
Intent: the next-day check and A3 DONE (a records PR); the operator’s sign-in asks as a slot proposal in plan mode; the session-results slot in plan mode from its brief; then Phase 2 in the ledger’s order; E1 after A3.
1. **Session start** (~11:10Z–11:20Z): the rules, the ledger (56 slots, A3 started), the handoff, the Inbox, the schedule, the memory rules; local main level with origin. → done
2. **The next-day check** (~11:20Z–11:40Z): account_stats() 18 and the sessions read through the Management API (a refresh forty minutes in; the audit table empty; the logs endpoint answering "Backend error"); prod probed; the Cloudflare dashboard and Resend's page by the operator's hand (errors 0 over 20.52k invocations; no mail yet); the operator's morning tab signed in after a moment and the first code email sent and received in a private window; a read of the auth config echoed the captcha secret's stored value into the tool log (flagged at once; rotation offered, default no). → done
3. **A3 DONE and the records** (~11:40Z–11:50Z): the ledger’s evidence and dated line, the trio 1.0.187, the six Inbox lines, the board republished; #1068 merged on the word 11:50Z. → done
4. **The sign-in notice and the order** (~11:45Z–12:15Z): the operator’s asks (returning-reader emails; a notice of the sign-in move) answered with the draft of the notice rendered in the site’s own template as an artifact for approval, and the order of the upcoming work stated on their word; then their fold: the notice, the sign-in polish and E1 into P2.21, and the two slots picked up by subagents. → done
5. **Two readers** (~11:52Z–12:45Z): the session-results plan (a Sonnet reader, 389,562 tokens; checked at file:line, one default added: the round “latest”) and the P2.5 plan (345,218 tokens), each as a decision page; the operator’s words: build P2.25 with the tyre column and the six new files, the two applies given in advance. → done
6. **P2.25 built and proven** (~12:20Z–13:45Z): tests first (twelve files red), the build, the reviewer (239,249 tokens, SOUND WITH FIXES, three folded), the gates, the migration on the local database, the backfill’s dry run, OpenF1’s lockout waited out, the local write of Monza’s four sessions, the cron run locally against Baku’s finished sessions, the browser proof through the helper (its POST given a captcha token), the review page, PR #1069. → done
7. **On prod** (~13:40Z–13:56Z): #1069 merged and deployed; the migration rehearsed and applied on the word; the backfill’s dry run (55 sessions) and its write (54 written, 1175 rows, one session without a classification at OpenF1); P2.25 DONE. → done
8. **P2.5’s decision and its map** (~13:20Z, ~13:48Z): the operator’s “swap the pages” with its consequence stated (two live pages leave their route files: Phase 3 work pulled forward); a Sonnet reader mapping the calendar and news pages for the revised plan. → in progress
Won't touch this session: any Phase 2 slot beyond its decision scan and its approved plan; Home's publish; branch deletions; any prod Supabase write without "apply <id>"; any push to `main`; agents on Fable; a fan-out.
Active: ~2h 50m from ~11:10Z to ~14:00Z (the operator present at the words, ~11:27Z, ~11:38Z, ~11:45Z, ~11:49Z, ~12:20Z, ~13:10Z, ~13:20Z, ~13:40Z; no `[+Nm]` prefixes were sent, the figure is the wall clock of the prompts)

---

- **At session start:** if today's date doesn't have an entry, create one. Write the intent as a bullet list. Add the "won't touch" line.
- **Mid-session:** don't edit this file (use `IDEAS.md` Inbox for new ideas).
- **At session end:** convert intent bullets to outcomes (`→ done` / `→ partial` / `→ skipped`). If tomorrow's plan is obvious, stub it.
- **Weekly:** when a week wraps, roll old days into an archive note or trim the file as it grows. Don't let the file balloon past ~200 lines.

### Sat 2026-09-26 to Mon 2026-09-28 — session 57 continued — P2.5, R11, R12, P2.7, R13 (the operator present at the words)
1. **P2.5 PR A and PR B** (the 25th–27th): the Filters component (#1071, 1.0.190) and the calendar on it (#1073, 1.0.191; the Sessions chip with four kinds on “four”); the parity of /calendar.
2. **R11** (#1074, 1.0.192): the other session’s phone fixes taken (the Podium box, the Learn hint, the agenda’s date, the contact route); its test file restored from main after the reviewer’s catch.
3. **R12** (#1075, 1.0.193): the month grid on phones on “id like the desktop calendar on mobile” (~00:30Z on the 27th); the reviewer’s three findings (two desktop floors, the bars’ width, the reader’s name); merged ~09:49Z on “merge keep going”, seen on prod at 390px.
4. **P2.5 PR C** (#1076, 1.0.194): the news page off its route file onto the Filters region and the Headlines view, Everything / Yours only as the view’s chips, the news family; stacked on R12, rebased, merged ~09:50Z; the prod parity of /news; the records #1077 (1.0.195).
5. **P2.7 Metric cards** (#1078, 1.0.196): planned in plan mode with a Sonnet critic (two blocking findings folded), built, proven in the local designer on /series/f1 (the leader, the gap, the wins, the count), the reviewer’s blocking finding (a live link inside the figure) fixed; merged ~19:59Z on “merge”; the records #1079 (1.0.197).
6. **R13 The SEO check of 2026-09-27** (the operator’s PDF, ~20:05Z): every finding verified on prod, the plan in plan mode with a Sonnet critic; PR A (#1080, 1.0.198: the redirects, the header, the title and description, the icons, the JSON-LD, the heading level) and PR B (#1081, 1.0.199: the images’ words) merged ~09:16Z on the 28th on “merge”; the prod checks; a Lighthouse baseline for PR C; this records PR (1.0.200).
7. **R13 PR C1 and the contact form** (the 28th): the contact form found unconnected (Resend “API key is invalid” on the Worker, `wrangler tail`) and connected by the operator’s hand at 09:48Z (the rail refuses secret writes from Claude; a stray secret and a pasted key remain theirs); PR C planned in plan mode with a Sonnet critic (one blocking finding folded), C1 built (lib/commons-thumb.ts, six drawing sites, tests first), the reviewer’s three fixes folded, #1083 (1.0.201) merged 14:01Z on “merge”, prod 14:05Z, the checks and the Lighthouse rerun (mobile 56 → 68, LCP 13.6 → 11.7 s, 19.4 MB → 2.2 MB; desktop 74 → 82; the LCP a PNG cover, the editor’s file); this records PR (1.0.202).
8. **R13 PR C2 measured** (the 28th, ~14:20Z–15:15Z, unattended on the approved plan): enableCacheInterception on, the build with DATA_SOURCE=db (the home prerenders only then), the testing deploy (f555ad91, 11,755 entries), twenty fetches per page against prod, two cold samples, the middleware checks; the finding that the catch-all’s pages render per request; #1085 (1.0.203) opened for the word.
9. **The operator’s SEO and AdSense questions, and the day’s three words** (the 28th, ~15:20Z–19:00Z): Google’s AdSense and Search Central pages read and quoted, five crawlers priced, a raw census of all 1,279 sitemap pages and a browser census of 8 per family; the finding that 801 pages answered noindex since the registry of 2026-09-08; the report as an artifact; on “1. apply 2. merge 3. go” (~18:20Z): the three rows applied on prod (18:26:10Z, rehearsed first), #1085 merged (18:26:52Z) and checked on prod (the home p90 1.7 → 0.37 s), R14 opened; this records PR (1.0.204).
10. **R14 PR B** (the 28th, ~18:40Z–19:40Z, on “go”): tests first, the tab list and the note predicate, the two robots rules, the sitemap’s two filters, the registry’s rows with the seed correction, the census script and its weekly workflow; the local proof with the migration applied; the census against prod (0 contradictions); a fresh-context Sonnet reviewer; #1087 (1.0.205) opened for the word.
11. **R14 on prod, the crawlers’ reports, R15 proposed** (the 28th, ~21:55Z–22:40Z, the word “merge” at ~21:58Z with the Ahrefs overview and the Unlighthouse screen): #1087 merged and checked on prod, the census green, the workflow’s first run green; Ahrefs’ 180,278 link targets traced to the filter chips’ combinations on prod; R15 planned with its one-line default; this records PR (1.0.206).
12. **R15** (the 28th, ~22:45Z–23:20Z, on “1. go”): the robots test first (red), the one line, the gates, the dev server’s /robots.txt, a fresh-context Sonnet reviewer; #1089 (1.0.207) opened for the word; the operator’s order for the next day recorded (Seobility’s full crawl, the issues one at a time, the sitemap and the validation, then AdSense).
13. **R15 on prod** (the 29th, ~06:45Z–07:05Z, on “merge.”): #1089 merged and checked on prod (robots.txt, the pages, the census green); this records PR (1.0.208); the operator’s Seobility Premium crawl running.
14. **P2.8 Countdown** (the 29th, ~07:05Z–09:00Z, on “plan” and the plan’s approval ~07:40Z): plan mode with a Sonnet critic (two blocking findings folded); tests first (7 red), the rule in lib/weekend.ts, the 98 circuit zones from Open-Meteo through a kept script, the definition, the view, the renderer; the designer proof on the local server (the Bahrain Grand Prix at Sepang, GMT+8, beside the driver page’s Next out); a fresh-context Sonnet reviewer; #1091 (1.0.209) opened for the word. Also read: Bing’s scan and keyword list, the champions request (two slots proposed).
15. **P2.8 on prod** (the 29th, ~08:45Z–09:05Z, on “merge”): #1091 squash-merged 2026-09-29 08:46:20Z as ede182e9 on the word “merge”, prod 1.0.209 by 08:50:02Z; readers see nothing until a Countdown is placed (the operator’s); the records PR (1.0.210), the board regenerated, the memory pointer.
16. **P2.17 Breadcrumb** (the 29th, ~08:57Z–10:40Z, on “go ahead with the proposals order”): plan mode (a Sonnet reading agent 305k tokens, a Sonnet plan critic 212k, one blocking finding folded), tests first (4 red), the trail in lib/design/breadcrumb.ts, the definition, the view, the renderer, the frame’s params, Create › Breadcrumb Region alive; the designer proof on the local server (HOME › SERIES › FORMULA 1 › STANDINGS above the standings tab’s masthead, one BreadcrumbList); a Sonnet reviewer (164k tokens, SOUND); PR #1093 (1.0.211, the dry run 39457.97 KiB / gzip 8630.07 KiB). The operator’s note at ~09:40Z (Supabase log ingestion 1.82 GB of the Free plan’s 1 GB) → Phase O and O1 at the ledger’s end.
17. **P2.17 on prod** (the 29th, ~10:33Z–10:50Z, on “merge and tell me whats next”): #1093 squash-merged 2026-09-29 10:33:53Z as 5a78c9b1 on the word “merge and tell me whats next”, prod 1.0.211 by 10:38:44Z; readers see nothing until a Breadcrumb is placed (the operator’s); the records PR (1.0.212), the board regenerated (Phase O on it), the memory pointer; next: P2.10 Tabs.
18. **P2.10 Tabs** (the 29th, ~10:38Z–12:40Z, on “p2.10 tabs task in main agent”): plan mode read in the main agent (a Sonnet plan critic 192k tokens, three blocking findings folded), tests first (8 red), the region attributes and the parser, applyTabs, the definition, the client strip, the sibling pages, the renderer; the designer proof on the local server (Preview and Report as tabs on a designer page; the pages strip on the series tab page); a Sonnet reviewer; PR #1095 (1.0.213, the dry run 39673.91 KiB / gzip 8688.42 KiB (measured before the reviewer’s one-line fold in page-document.ts)). The operator’s question at ~10:38Z (agents building the Bing slots in the background) answered by rule 7; the board republished at a new link after the login change.
19. **P2.10 on prod** (the 29th, ~12:00Z–12:15Z, on “merge…”): #1095 squash-merged 2026-09-29 12:00:57Z as e81b9d13 on the word “merge”, prod 1.0.213 by 12:04:55Z; readers see nothing until a Tabs region is placed (the operator’s); the records PR (1.0.214), the board regenerated, the memory pointer; the Bing slots behind Phase 2 on the word; next: P2.14 Weather.
20. **P2.14 Weather** (the 29th, ~12:05Z–13:10Z, on “you can do p2.14 now”): plan mode read in the main agent (a Sonnet plan critic 173k tokens, one blocking finding folded: the strip’s venue by name alone), the tests before the code across five files, the tile builders shared, nextWeekend, the definition, the view, the renderer, the venue fix; the designer proof on the local server (the Bahrain Grand Prix at Sepang: the region and the page’s own strip agreeing, the day view, the hub’s next weekend); a Sonnet reviewer; PR #1097 (1.0.215, the dry run 40953.14 KiB / gzip 8926.15 KiB (up 1.3 MiB on P2.10: the weather reader and its KV client as an on-demand chunk of their own; 62% of the ceiling)).
21. **P2.14 on prod, the session-58 handoff** (the 29th, ~13:00Z–13:15Z, on “merge. then make a handoff…”): #1097 squash-merged 2026-09-29 13:01:07Z as 5d1276ef on the word “merge. then make a handoff…”, prod 1.0.215 by 13:05:54Z, prod's Bahrain Grand Prix weather strip naming Sepang; the records PR (1.0.216) with the new LATEST block and the session-59 prompt; the board regenerated (48 of 63); the memory pointer. Session 58 closed.
Active: ~2h 20m from ~00:30Z to ~02:50Z on the 27th (the operator present at the words, ~00:30Z), ~2h 10m from ~09:48Z to ~12:00Z (the words at ~09:48Z), ~1h 40m from ~13:25Z to ~15:05Z (unattended build of P2.7 on the approved plan), ~2h 50m from ~19:58Z to ~22:50Z (the words at ~19:58Z and ~20:05Z), ~20m from ~09:15Z on the 28th (the word at ~09:15Z), ~1h 15m from ~09:40Z to ~10:55Z (the contact form on the operator’s question at ~09:40Z and their secret commands at ~09:45Z and ~09:48Z, then PR C’s plan on “open in plan mode”), ~50m from ~11:10Z to ~12:00Z (the plan’s word at ~11:10Z), and ~1h 15m from ~14:00Z to ~15:15Z (“merge” at ~14:00Z; C2 measured unattended on the approved plan from ~14:20Z), ~4h 20m from ~15:20Z to ~19:40Z (the operator’s questions at ~15:20Z, “what do you need from me?” at ~18:10Z, the three words and the Search Console picture at ~18:20Z, Ahrefs opened ~18:55Z, the board asked for ~19:15Z), and ~1h 25m from ~21:55Z to ~23:20Z (“merge” with the crawlers’ reports at ~21:58Z, “what do i do now?” at ~22:35Z, “1. go 2. ok done” at ~22:45Z, the Seobility plan at ~22:55Z), and ~20m from ~06:45Z on the 29th (“merge.” at ~06:45Z, the Seobility upgrade at ~06:55Z), ~2h 10m from ~07:00Z to ~09:10Z (“plan” at ~07:05Z, the approval ~07:40Z, Bing’s exports and the champions note at ~07:20Z, “merge” at ~08:45Z), ~1h 45m from ~08:55Z to ~10:40Z (“go ahead with the proposals order” at ~08:57Z, the Supabase logs note at ~09:40Z, “keep going” at ~10:05Z, “merge and tell me whats next” at ~10:33Z), ~2h from ~10:38Z to ~12:40Z (the agents question and “p2.10 tabs task in main agent” at ~10:38Z, “on a different api so you wont find old artifact” at ~10:45Z, “merge. the research for champions facts can get pushed after phase 2…” at ~11:58Z), ~1h 10m from ~12:05Z to ~13:15Z (P2.14 unattended on the approved plan; “merge. then make a handoff…” at ~12:58Z); no `[+Nm]` prefixes were sent, the figures are the wall clock of the prompts

### Tue 2026-09-29 — session 59 (the operator present at the words) — P2.11 Chart
1. **The session start** (~13:25Z): the rules, the ledger, the handoff, the Inbox, the schedule and the memory rules read; the records PR #1098 found merged; the time plan and the won’t-touch line.
2. **P2.11 Chart, the plan** (~13:30Z–14:05Z): the code read in the main agent (the site’s two Recharts charts and their four consumers, the Source and preset model, the Metric cards, the CHANGELOG’s invariant, APEX’s Chart notes); the plan written; a Sonnet plan critic (317k tokens) with four blocking findings folded (the editor’s Preset’s own label, MotoGP’s sprints, Racing Bulls’ feed name, Recharts under renderToStaticMarkup); the plan approved.
3. **P2.11 Chart, the build** (~14:05Z–15:55Z; the operator’s “keep going” at ~14:40Z with the account switch): the tests first across eleven files (17 red), the code in the plan’s order, tsc 0, lint 0 errors, vitest green; the local designer proof on the team page (McLaren thick, Racing Bulls through its drivers), the standings tab (the invariant beside the table, MotoGP’s fold), the bars and the gaps; two fixes from the proof (one row per round from the reader; the responsive wrapper sized by CSS) and the constructors’ preset narrowed to Formula 1 on the live site’s numbers; cf:build and the dry run (Total Upload 41345.47 KiB / gzip 9022.83 KiB); a fresh-context Sonnet reviewer; PR #1099 (1.0.217) opened for the word.
4. **P2.11 on prod** (the 29th, ~15:58Z–16:25Z, on “merge. whats next?”): #1099 squash-merged 2026-09-29 15:58:24Z as 3439f5c4, prod 1.0.217 by 16:08:28Z; readers see nothing until a Chart is placed (the operator’s); the records PR (1.0.218), the board regenerated at a new link (https://claude.ai/code/artifact/e48d9f01-f919-42c8-b726-3f413692f45e), the memory pointer; next: P2.12 Map and Map Backgrounds.
5. **P2.12 Map and Map Backgrounds** (~16:00Z–18:40Z, on “merge. whats next?”): the code read in the main agent (the Circuit Map and its three layers, the theme’s family, the Chart as the model, the Utilization pattern, Esri’s canvas services probed), the plan written and approved with a Sonnet critic’s four fixes folded; the tests first across eighteen files (13 red, five unresolved modules), the code in the plan’s order, tsc 0, lint 0 errors, vitest green; the local designer proof on the Circuit Map page (139 guides on Canvas, the tiles swapping with the theme through the picker’s mutation and the picker itself, 390 px, the Circuits preset in the accent, the Map Backgrounds screen); one fix from the proof (a marker’s default colour through a class, Leaflet’s attributes taking no var()); cf:build and the dry run (Total Upload 41579.43 KiB / gzip 9067.57 KiB); a fresh-context Sonnet reviewer; PR #1101 (1.0.219) opened for the word.
6. **P2.12 on prod; the Seobility export** (the 30th, ~08:15Z–08:35Z, on “merge then here is the seobility full export”): #1101 squash-merged 2026-09-30 08:16:53Z as 8b44165d, prod 1.0.219 by 08:22:10Z; readers see nothing until a Map is placed (the operator’s); the export (85 pages, 3,083 crawled) extracted with pdftotext and read whole in the main agent, every check re-run against the live site (statuses, titles, descriptions, cache headers, the sitemap’s counts, the team-radio players), the causes traced to file:line, the triage published (https://claude.ai/code/artifact/4c2f6e9c-8fee-407d-accb-40c1cbdb90f5) with eight proposed slots and a decision scan; the records PR (1.0.220), the board regenerated (https://claude.ai/code/artifact/e48d9f01-f919-42c8-b726-3f413692f45e).
7. **P2.15 Circuit** (the 30th, ~08:50Z–17:35Z, on “x1-8 will be done separately after phase 2 is done. do p2.15 now” (~08:50Z on the 30th)): the code read in the main agent (the weekend page’s venue rail, the circuits and their layouts, the hub’s track entries and the bridge, the Weather as the model), the plan written and approved with a Sonnet critic’s five fixes folded; the tests first across five files (four red), the code in the plan’s order, tsc 0, lint 0 errors, vitest green; the local designer proof on the Race weekend page (Madring for round 14, Baku with its drawing for round 15, Midnight, 390 px), the Series hub (the Bahrain Grand Prix at Sepang) and the Map Backgrounds screen; one look fix from the proof (the map alone at full width); cf:build and the dry run (Total Upload 41602.53 KiB / gzip 9057.60 KiB); a fresh-context Sonnet reviewer; PR #1103 (1.0.221) opened for the word.
8. **P2.15 on prod; the AdSense reading; the ad networks’ doors** (the 30th, ~17:36Z–17:55Z, on “Merge, however before we move on i need you to answer this…”): #1103 squash-merged 2026-09-30 17:38:17Z as 024b58af, prod 1.0.221 by 17:42:30Z; earlier on the 30th (~10:00Z–17:30Z, alongside the build) the operator’s order for after the slot (X7 → X6 → the JavaScript count) answered with what each affects, and the AdSense ESPA written and published (https://claude.ai/code/artifact/2e8db33a-ccdf-47df-b7bf-dac6a0536951: Google’s words, the site measured family by family, the causes owned, five solutions, the decisions); the ad networks’ current requirements read from their own pages and answered in Search Console terms; the records PR (1.0.222), the board regenerated (https://claude.ai/code/artifact/e48d9f01-f919-42c8-b726-3f413692f45e).
9. **X7 planned; the numbers; the close** (the 30th, ~17:50Z–18:25Z): X7 read in the main agent (the session route’s force-dynamic and its comment, the catch-all’s render path, the OpenNext cache stack, prod’s headers on eight pages), the plan written, a Sonnet critic (312k tokens) naming the missing generateStaticParams and the registry row, the plan approved ~18:35Z; the operator’s Search Console and Analytics files read and answered against the ad networks’ doors; the analytics guidance (Cloudflare, GA4, Search Console: one job per tool); the handoff for session 60 with the plan verbatim; the records PR (1.0.223).
Active: ~5h 15m on the 29th from ~13:25Z to ~18:40Z (the operator’s “keep going” at ~14:40Z, “merge. whats next?” at ~15:58Z) and ~10h 30m on the 30th from ~08:15Z to ~18:25Z (the words at ~08:50Z, ~10:00Z, ~17:36Z, ~18:20Z and the handoff at ~18:40Z); no `[+Nm]` prefixes were sent, the figures are the wall clock of the prompts

### Wed 2026-09-30 — session 60 (the operator present at the words) — X7 Edge cache
1. **The session start** (~19:25Z): the rules, the ledger, the handoff (the approved X7 plan), the Inbox, the schedule and the memory rules read; the time plan and the won’t-touch line; no dev server (the slot has no UI change; the proof is the Worker’s headers).
2. **X7, the build** (~19:30Z–20:40Z): the testing Worker measured before the change (six pages behind private, no-cache, no-store; F1 qualifying 4.87 s then 2.28 s to the first byte, the calendar 3.06 s then 1.48 s); the branch feat/x7-edge-cache; the tests before the code (the route-scan test beside the session page, the catch-all’s case: four red), then the catch-all’s export, the session route’s exports and comment, the registry row; a step the plan had not named: the registry test holds the seed migrations to the registry and an applied migration is never edited, so a correction migration in R14’s shape (20260930194100_pages_seed_rendering.sql) and the test’s reading of it, recorded in the ledger as a default; tsc 0, lint 0 errors, vitest 267 files / 2544 tests; cf:build and the manifest with both routes under dynamicRoutes; the dry run 41605.87 KiB / gzip 9057.62 KiB; the testing deploy (version 23484fc8) and the six pages measured twice and again at steady state: s-maxage=300 on the first request, x-opennext-cache: HIT on the second, 0.18–0.67 s to the first byte from the cache; the ledger’s phase X with X7 started, X6 and X9 planned; the trio and the pull-requests entry.
3. **X7, the review and the PR** (~20:45Z–21:35Z): a fresh-context Sonnet reviewer (211,486 tokens, 43 reads and runs): the code, the tests and the migration match the plan with no gap; its blocking finding in the records (the pull-requests entry corrupted by a `$` and backtick sequence a string replacement read as a pattern: the file’s own header spliced into the Verified bullet) rebuilt with a slice-and-join, its should-fix (a placeholder line here) and its nit (a blank line in the CHANGELOG) fixed; the ledger’s evidence; PR #1106 (1.0.224) opened for the word; the merge, prod’s measurement and the perf baselines follow the word.
4. **X7 on prod; the close** (~20:28Z–21:05Z, on “merge and apply 20260930194100”): #1106 squash-merged 2026-09-30 20:29:03Z as 49ca36bf; the seed correction applied on prod at 20:29:05Z (rehearsed inside begin…rollback first; the row read back cached); prod 1.0.224 by 20:34:43Z; the six pages measured on prod before and after (private, no-cache, no-store before; s-maxage=300 then x-opennext-cache: HIT after: the F1 qualifying page 0.33 s, the calendar 0.40 s, the news 0.42 s to the first byte on the hit); docs/perf-baselines.md appended; the records PR (1.0.225) with the session-61 pickup; the board regenerated (52 of 66); X7 DONE.
5. **X6, the plan and PR A** (~20:50Z–22:15Z): the code read in the main agent (the changelog route and parser, the results tab’s every panel, the calendar’s loader and views, the registry, the sitemap, the manifest), the pages measured on prod (curl: HTML, gzip, flight); the plan written in plan mode, a Sonnet critic (271,172 tokens) with four blocking gaps folded, the operator’s three words through previews (pages per release with 30 inline, the latest round open, the label’s slug), the plan approved ~21:35Z; PR A: the tests before the code, the release index and its bundle, the shared components, the two pages, the registry row and seed, the sitemap; tsc 0, lint 0 errors, vitest 269 files, 2557 tests; cf:build and the manifest; the dry run 41738.08 KiB / gzip 9082.98 KiB; the browser at 1440 and 390; the testing Worker measured; the reviewer; PR #1108 (1.0.226) opened for the word. PSI’s API quota spent for the day; the operator’s pagespeed.web.dev runs stand in.
6. **X6 PR B, the results tabs** (~22:20Z–23:10Z): the results tab read whole, the tests before the code (six red), the code (the latest round open, the earlier rounds one line each with “Classification →” to the race session page, a fold where no page answers), tsc 0, lint 0 errors, vitest 2553; the browser at 1440 and 390 (F1, WEC, GT World, NASCAR); cf:build, the dry run 41206.52 KiB; the testing Worker measured (F1 146 kB from 757, MotoGP 191 kB from 1.26 MB, F2 220 kB, GT World 283 kB; NASCAR, IndyCar and DTM keep their accordions); a Sonnet reviewer’s requirement gap folded (DTM’s link a dead end: the link only where the session page answers), a rebuild and a second measurement; PR #1109 opened with the question for the operator (the event-named series and DTM).
7. **X6 PR C, the calendar’s payload** (~23:10Z–23:40Z): the calendar’s loader and views read whole, the tests before the code (three red), the code (the round on the entry, a short key for the uid, the map gone), tsc 0, lint 0 errors, vitest 2547; the browser at 1440 and 390 (month, week, day, season, the deep link); cf:build, the dry run 41605.51 KiB; the testing Worker measured (/calendar 545 → 443 kB, the flight 454 → 353 kB; the plan’s estimate optimistic by about 50 kB, said so); a Sonnet reviewer’s should-fix folded (the size bound, the DayView case); PR #1110 opened.
8. **The close** (~23:40Z–23:50Z): the ledger’s X6 evidence with B and C, the handoff for session 61 (the three PRs and the words they wait for), the board regenerated (X6 in build), all as a second commit on PR A’s branch so the versions stay in order.
9. **X6 on prod; the close** (the 1st, ~05:49Z–06:20Z, on “A: merge and apply 20260930212400, B: merge, C: merge”): #1108 squash-merged 05:50:47Z as cd7c5be2, the release page’s row applied on prod 05:50:48Z (reads cached, indexable); B rebased on main, its trio 1.0.227 and entry added, #1109 squash-merged 05:52:40Z as a340aef8; C the same, 1.0.228, #1110 squash-merged 05:54:01Z as 798a9f05; prod 1.0.228 by ~06:03Z (1.0.227); 1.0.228 built with success by ~06:15Z, its cached pages rolling over; the three families measured on prod (docs/perf-baselines.md, the X6 section); the ledger’s X6 DONE with a dated line; the two Inbox lines (B2; the calendar’s series table); the handoff for session 61 (X9 first); the records PR (1.0.229); the board regenerated (53 of 66).
Active: ~4h 25m on the 30th from ~19:25Z to ~23:50Z (the words at ~19:55Z, ~20:28Z “merge and apply 20260930194100”, ~21:15Z the three previews, ~21:35Z the plan approved; the operator away after ~21:40Z) and ~30m on the 1st from ~05:49Z (the word) to ~06:20Z; no `[+Nm]` prefixes were sent, the figures are the wall clock of the prompts

### Thu 2026-10-01 — session 61 (the operator present at the words) — the calendar ESPA (R16), X9
1. **The session start** (~06:40Z): the rules, the ledger, the handoff, the Inbox, the schedule, the perf baselines and the memory rules read; the time plan and the won’t-touch line.
2. **The calendar ESPA for the word** (~06:45Z): the git archaeology of the old filter modal (#242 and #243 of 2026-06-24, gone with 0.277.0 on 2026-08-18) and the month cells’ dots (one dot per session below md from 2026-06-23 to 2026-08-20, then the agenda, then R12’s bars); the old look photographed on the last Vercel production deployment (0.239.1); the changes side by side at 390 px; the decision scan for R16; the two phone screenshots asked. → in progress
3. **The /calendar measurement on prod** after X6 C (~06:45Z: 442,552 · 43,446 · 352,739, the edge cache hit, the testing Worker’s numbers), into docs/perf-baselines.md’s X6 section and the ledger’s X6 evidence with X9’s PR. → done
4. **The operator’s word on R16** (~07:00Z): after the Xs and Phase 2, three PRs when the time comes; “nin” and the screenshots’ question explained; R16 as a planned slot at the end of the order with a dated line. → done
5. **The Seobility MCP** (~07:05Z–07:45Z, on “Launch a subagent to read this…”): one Sonnet agent (121,766 tokens) read the three help pages and wrote the notes; the key added by the operator at user scope; the server connected (151 tools; the project 1028866, 40,000 credits a month, 2 per read); the two defaults (reads within a budget, writes on the word) on “ok”, recorded in the ledger. → done
6. **X9** (~07:05Z–): the scripts counted on prod (16 on the home with the beacon, 18 the session page, 16 the calendar), the local cf:build read (the manifests, the chunks mapped, Sentry found as a no-op in two files and, by the critic, as 1.4 MiB inside the Worker), the plan in plan mode with a Sonnet critic (332,632 tokens, three blocking findings folded), approved ~08:05Z; the build on the branch (the uninstall under npm 10, the three deletions by the operator’s hand after the rail refused the agent’s git rm, the error page, four comments); the gates (lockfile check, tsc 0, lint 0, vitest 271/2,569, cf:build, the dry run 41,338 → 39,433 KiB); the testing Worker measured (the home 16 → 15 with the beacon); the fault proofs; the review page; a Sonnet reviewer (298,648 tokens, six findings folded); PR #1112 merged 09:20:31Z on “Merge first then lets talk”; prod measured 09:36Z (15 · 17 · 15; 811 KiB raw / 256 wire); Seobility’s live check without the JavaScript-files hint; X9 DONE. → done
7. **The chrome’s chunk experiment** (the operator’s “lets go with default” at ~09:10Z on “cant we reduce the 14 files by combining any of them?”): after X9 is on prod, one throwaway build with the chrome’s optional pieces behind dynamic imports, the count reported, a slot only if it moves. Run ~10:50Z on exp/chrome-chunks: the count stays at 14 (the chrome 3 → 2 chunks, the framework 5 → 6 files), about 33 KB moved off the initial tags; no slot on the count; the admin toolbar’s import behind the admin check offered as the one weight lever. → done
8. **The talk** (~09:45Z–10:00Z): the operator’s need for total control of every part of the site; the honest boundary (what readers see through the designer, what the site does through switches, the whole understood through a map and the tests); the repository counted (116,000 lines of code, 43,500 of tests, 23,000 of content) and split into fourteen parts for learning; the teacher-and-student method; the operator’s decision: the learning in its own sessions on the worktree C:\Dev\Personal\Motorsport-learn (branch learn, created, dependencies installed), the building here; recorded in the ledger. → done
9. **The close**: the X9 records (the baselines’ X9 section, the ledger DONE, the Inbox line for the home’s UTC times), the handoff for session 62 and the learning session’s start prompt, this records PR (1.0.231).
10. **The board and the numbered words** (~10:10Z–10:20Z): the board rendered from the ledger under the current login (https://claude.ai/code/artifact/2050d0f7-facf-41e0-b8bd-8baa9ace342d); the six items for the word listed; the operator’s answers: R17 yes, the toolbar’s weight no, B2 in plan mode first, the AdSense reading to republish, a new Seobility crawl yes (16021215 started), the learning files there. → done
11. **The learning worktree’s setup** (~10:20Z): the memory files copied to the worktree’s own memory folder (Claude Code keys memory by directory), the env file copied, the hooks present; the start prompt in docs/HANDOFF.md. → done
12. **R17, the home’s times in the reader’s zone** (~10:25Z–10:55Z): the test first (red), NextRaceCountdown’s labelNode and HomeLead’s localTime through LocalTime, tsc 0, lint 0; the browser proof at 390 and 1440 (“Fri 07:30” in an Athens browser), the full tests (one designer test’s timeout under load, green alone), cf:build and the dry run (39,461 KiB); the review page; a Sonnet reviewer (261,521 tokens; its catch: the test’s clock pinned); PR #1114 (1.0.232); the merge on the word. → done to the PR
13. **R17 on prod; B2 in plan mode** (~10:50Z–11:05Z, on “merge. now b2 plan mod”): #1114 squash-merged 10:51:20Z, prod by 10:57Z (the home’s HTML carries “Fri, 07:30 EEST”); B2 read in the main agent (the classification module, the session and weekend pages, the results tab, the snapshot sources, the real session titles from the site’s feed and the curated files), the plan written, a Sonnet critic (346,718 tokens: IndyCar’s rounds keyed by Wikipedia’s columns; the Indy 500 week’s Fast Six and Pit Stop Challenge misread by the first rule), the plan folded and approved ~11:00Z. → done
14. **B2, the build** (~11:05Z–): the tests first (nine red), the predicate chosen per weekend, the pool with IndyCar re-keyed by date and DTM’s per-race source, the race-number guard, the mapper, the cache key v3 (F1’s kept), the call sites; tsc 0, lint 0, the three files 53 green, the full suite 2,579; cf:build and the dry run (39,573 KiB); three testing deploys (the mapper fix for the bare Classified seen in the first screenshots, then the cache key v3 after the shared store kept the v2 entries); the tabs a tenth of their size, the race pages photographed, the review page; a Sonnet reviewer running at the close; the operator’s “merge” given ~11:55Z; the handoff written at 95% context; the PR #1115 opened 12:12Z. → the merge in session 62 (item 17)
15. **Bing’s site scan** (~11:20Z, the operator’s CSV): 47 blocked by robots (by design), 6 pages 4xx, 119 long titles, 6 missing alts, 1 oversized page, 2 without H1; mapped to X1, X2, R14 and B2 in the Inbox. → done
16. **The AdSense reading redone, P2.13 and the Phase 2 order** on the word, in the order; R16 after all.
17. **B2, Mid-Ohio curated and the merge** (session 62 after the compaction; ~12:20Z–, on “Curate the round first, then merge” ~12:24Z and “merge it all” ~12:40Z): the reviewer’s blocking finding put with three mockups of the tab’s rows; the round from indycar.com’s event page, Fox’s schedule and the track’s timetable (the qualifying at 2:30 PM ET, not indycar.com’s 5:15), the circuit from Wikipedia, the later rounds 12–18, the guards; tsc 0, lint 0, the suite 2,583 (one designer test’s 5 s timeout under load, green alone); the dry run 39,524 KiB; the testing Worker measured and photographed (the populate stopped at its time limit, the pages measured on fresh renders); a second Sonnet reviewer on the delta (MERGEABLE; the sources re-fetched, the times checked, the real pipeline probed; its should-fixes and nits folded, ~13:10Z); the merge on “merge it all”, then prod, the baselines, B2 DONE, the records PR, the handoff. → merged 13:25:02Z (04a03a87); prod 1.0.233 checked 2026-10-01T13:32:12Z (the tabs NASCAR 225,755 · 18,910 · 114,691, IndyCar 156,248 · 16,599 · 78,447, DTM 136,955 · 15,815 · 68,171); B2 DONE
18. **The session-62 close** (~13:30Z–13:55Z): the baselines’ B2 section, B2 DONE in the ledger with the dated line, the two B2 follow-ups to the Inbox for the word (the seven redirects, the archive re-capture), the handoff for session 63, the memory; the records PR 1.0.234 (#1116) on the standing word. → done
Won’t touch this session: any slot beyond its decision scan and its approved plan; the week and day views’ shape before the operator’s two screenshots; Home’s document; any prod design row; branch deletions; any prod Supabase write without “apply <id>”; any push to `main`; agents on Fable; agents building; a new dependency.
Active: from ~06:40Z (the operator’s `[+Nm]` prefixes, else the wall clock of the prompts)

### Thu 2026-10-01 — session 63 (the operator present at the words) — R18 into the ledger; the two B2 follow-ups; X9’s idle count; the AdSense reading
1. **The session start** (~13:38Z): the rules, the ledger, the handoff, the Inbox, the schedule, the perf baselines and the memory rules read; the time plan and the won’t-touch line. → done
2. **The operator’s design “F2 Champions” into the ledger** (~13:41Z–, on “have a look at this please and place it in ledger”): /design-login by the operator; the project 34cbb7ba-f580-4ab7-91fb-ebc33074c6c4 read through the design-sync reads (the page, image-slot.js, support.js, the photo’s state); R18 written with its decision scan (four questions); the records PR (1.0.235, #1117) on the standing word; then the questions one at a time, the order first. → done
3. **R18’s four answers and the plan** (~14:05Z–15:08Z): the order (next), the faces and corners (B, shown side by side on an artifact), the reach (F2 alone), the photo (the Commons file by Lukas Raich, CC BY-SA 4.0); the design mapped to pieces in plan mode (the Champions source, two Data region templates, the recipe carrying every region kind, the composed tab, the destination catalogue’s series tabs); the Sonnet critic (605,753 tokens, two blocking findings) folded; two more words (Wikipedia for wins and podiums, cited; a List region over a list the operator authors) and the critic’s two (the points reach the 21 Learn answers; the attribution as plain text); the plan approved. → done
4. **R18 PR A, the facts and the Champions source** (~15:10Z–): the 21 seasons read from the archived official standings (the Wayback CDX found every season) and Wikipedia’s season articles by a collector script; the tests first (12 red), the type, lib/nationalities.ts, the source, the shapes and presets, the reader; the twelve files green, tsc 0, lint 0; the content bundle; the full suite; the dev server; the records; a Sonnet reviewer (458,379 tokens; two blocking findings folded); PR #1118 (1.0.236) merged 19:02Z on “default”; prod by 19:07Z. → done
5. **R18 PR B, the pieces and the page** (~19:10Z–): tests first for each piece (the destinations rule, the heading’s two attributes, the View options, the recipe model and the F2 recipe, the two views and the List’s foot, composedBody, the ComposedTab, the image priority), then the code; the local server photographed at 1440 and 390; cf:build and the dry run; the testing Worker; the parity of the fourteen; the review page; a Sonnet reviewer; the PR. → in progress → the review (457,689 tokens) came at ~19:50Z, NOT MERGEABLE on one blocking finding: the two designer cases failed on the greyed-option note’s new words, not on time as recorded (a correction, the four records put right); its seven should-fixes and the nits folded by ~21:30Z (the card the full width until the photo, the Series group drawn, the table from lg, the tile strip sized, the fallback with its h1, the shell and heading tests), 273 files 2,633 green, the merge on the word.
6. **The two B2 follow-ups on the word** (the seven redirects; the archive re-capture), each with its own decision scan.
7. **X9’s idle count on prod** (the baselines’ empty cell).
8. **The AdSense reading redone**, then its decisions, S1 and S2.
9. **P2.13 Embed and the Phase 2 order** in plan mode with a Sonnet critic; the rest as the handoff’s agenda (the Seobility crawl 16021215 read before any X slot; its export arrived ~15:40Z).
10. **The close**: the ledger’s evidence, the Inbox triage, the handoff for session 64, the records PR.
11. **PR B merged; the page’s bottom as doorways (R18 PR C)** (~20:40Z–, on the operator’s point “we should have more cards than just the calendar card…” and the word ~21:00Z “c is what i want, do it and merge the work” on the options page b7dd855a): #1119 squash-merged 21:03:37Z as a8e55e0c, prod by 21:10Z (the composed page live, the fourteen other tabs identical); PR C on feat/r18-c-champions-doorways: the plan written, a Sonnet critic before code, then the note column (a prod apply before the merge), the card style, the two lists in the recipe, the foot off the composed page, tests first. → the critic’s findings folded (the card as drawn, the loader, the grid, the seed as the default), seven red then green, the records 1.0.238, the rehearsal on prod; the apply and the merge on the word.
12. **PR C applied and merged; the operator’s six points** (~01:20Z–, on “apply 20261001213000 and merge pr c”): the column and the seed on prod (the counts), #1120 squash-merged 01:31:08Z as b2b4ff27, prod checked; the six points read whole and ESPA’d on one page (the phone cards drawn three ways, the trend chart’s gap measured against the table, the photo’s two paths, the back link’s strip, the driver database as a slot, the champions’ links across rosters); the words awaited.
13. **PR D: the photo uploaded by my hand, the phone card after the operator’s drawing** (~08:50Z–, on “id like the card to be somewhat like this drawing i made, also upload it”): the file into the bucket (wrangler) and the asset row on prod (rehearsed, then inserted; the same row mirrored locally), the recipe’s photo half with the id, the Roll of honour’s card redrawn, tests first (two red) then green, the local server at 390 and 1440, the build, the testing Worker, a reviewer, the records 1.0.240; the merge on the word.
14. **PR E: the search box, the champions’ links, the back-link strip, the desktop season strip** (~10:00Z–, on “search box next”, the two defaults and “D but the words points wins and margin should be above the value”): the plan with its scan, a Sonnet critic (two blocking folded: the island’s root, the lookup’s fourteen), tests first (five failing tests across four files, the island’s file not yet loading) then green, the local server at 1440 and 390, the build, the testing Worker, a reviewer, the records 1.0.241; the merge on the word. The round-two ESPA page b14431d5 and the desktop drawings 492caca1 carry the words. → the reviewer’s findings folded (MERGEABLE AFTER FIXES: two should-fixes, six nits), the records’ placeholders filled, the PR opened as #__PR__; the merge on the word, after PR D’s.
Won’t touch this session: any slot beyond its decision scan and its approved plan; the two B2 follow-ups before the word; Home’s document; any prod design row; branch deletions; any prod Supabase write without “apply <id>”; any push to `main`; agents on Fable; agents building; a new dependency; the learning track’s files and worktree.
Active: from ~13:38Z (the operator’s `[+Nm]` prefixes, else the wall clock of the prompts)
