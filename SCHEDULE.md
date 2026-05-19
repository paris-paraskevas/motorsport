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

1. **Bridge work** — `docs/HANDOFF.md` Track B refresh + this `SCHEDULE.md` entry + `IDEAS.md` triage. ~30 min, docs PR.
2. **Cheap wins bundle** — B2 noindex auth + B3 nofollow news + B4 per-route descriptions + B5 `<time dateTime>` + B6 RSS hardening + B-discover meta. ~90 min, feat PR (0.10.31).
3. **B-monitor runbook** — new markdown doc, no code. ~30 min, docs PR.
4. **B7** — tab-aware metadata + canonical on `/series/[slug]`. 1–2 h, feat PR (0.10.32).
5. **B8** — JSON-LD (Organization + WebSite + BreadcrumbList + SportsEvent + Article + ProfilePage). 3–4 h, feat PR (0.10.33).
6. **B-perf** — split into ≥2 sub-PRs (bundle/unused-JS reduction; lazy-load + button a11y names). 4–6 h, feat PRs (0.10.34 / 0.10.35).
7. **B9** — server-render home + calendar bodies. 2–3 h, feat PR (0.10.36).
8. **B10** — per-segment OG images (series + weekend variants), folds the rest of B-discover. ~2 h, feat PR (0.10.37).

**Won't touch this session:** B11, B12, B-content (all multi-day), B8b (gated on aggregateRating), any new infrastructure, any UI redesign beyond what bundles require.

**Pre-mortem (one line):** the most likely failure is sequencing fatigue — B8 + B-perf are the heaviest bundles in the middle of the queue; if they overrun, B9 and B10 slip to next session. That's acceptable.

Active:
_(awaiting [+Nm] prefixes)_

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
