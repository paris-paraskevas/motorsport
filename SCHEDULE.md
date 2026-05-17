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

### Mon 2026-05-18

Pre-Fotis cutoff continues — Tier 1+2 carry-over from Sun. Begin Tier 3 if Tier 1+2 done.

Won't touch this session: anything kicked to post-Fotis carry-over.

Active:
_(awaiting [+Nm] prefixes)_

### Tue 2026-05-19 — Fotis sit-down day

**Tier 3 investigation docs:** data-sources research first (Ergast/jolpica, MotoGP web API, FIA feeds, aggregators), then Supabase scoping doc. JS-site XHR reverse-engineering + Champions JSON cleanup investigation if time remains.

**End-of-day:** pre-Fotis cutoff rule expires after the sit-down. Resume normal IDEAS.md triage. Delete `project-paddock-pre-fotis-cutoff` memory.

Won't touch this session: anything not Tier 1/2/3 unless explicitly pulled in during the sit-down.

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
