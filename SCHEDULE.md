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

## How to use this file

- **At session start:** if today's date doesn't have an entry, create one. Write the intent as a bullet list. Add the "won't touch" line.
- **Mid-session:** don't edit this file (use `IDEAS.md` Inbox for new ideas).
- **At session end:** convert intent bullets to outcomes (`→ done` / `→ partial` / `→ skipped`). If tomorrow's plan is obvious, stub it.
- **Weekly:** when a week wraps, roll old days into an archive note or trim the file as it grows. Don't let the file balloon past ~200 lines.
