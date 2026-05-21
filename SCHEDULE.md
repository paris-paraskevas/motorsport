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

---

## Backlog stubs (next 1–2 weeks, no firm date yet)

- **Supabase migration full execution** — schema build, scrapers, ingestion crons. Scoping doc ships pre-Fotis (Tue); execution post-Fotis.
- **SEO baseline (S5)** — sitemap, robots, JSON-LD, per-page metadata, OG image generators. Multi-day; deferred to post-Fotis.
- **Detail-page enrichment (S6)** — `/drivers/[slug]`, `/teams/[slug]`, F1 History, Rules tab. Post-Fotis.
- **Native non-F1 results + standings (S7)** — MotoGP / WEC / IndyCar / NASCAR. Post-Fotis.

---

## How to use this file

- **At session start:** if today's date doesn't have an entry, create one. Write the intent as a bullet list. Add the "won't touch" line.
- **Mid-session:** don't edit this file (use `IDEAS.md` Inbox for new ideas).
- **At session end:** convert intent bullets to outcomes (`→ done` / `→ partial` / `→ skipped`). If tomorrow's plan is obvious, stub it.
- **Weekly:** when a week wraps, roll old days into an archive note or trim the file as it grows. Don't let the file balloon past ~200 lines.
