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

### Sun 2026-05-17 — massive ship day (7 versions live)

Plan-at-start was: open PR #3, browser-verify, weather+news audit, Supabase DDL draft. Scope expanded mid-session into a full calendar-correctness audit driven by user's per-series audit findings.

End-of-Sunday outcomes:

- → done: ship `0.9.10` + `0.9.11` via PR #3 — full-season sessions curation + template-projected empty rounds finally on main. Real session times across all 15 series.
- → done: ship `0.9.14` via PR #6 — **calendar correctness audit**. Season filter in `lib/series.ts` (Dec 1 prior-year → Feb 1 next-year window) kills 2025 leakage across every non-F1 series in one stroke. Side-effect: WEC R3/R4/R5 routing fixed (the 2025-09-07 COTA entry had been poisoning array-index assignments). `WeekendBlock` venue/race-name label upgrade — cards now lead with "Canadian Grand Prix" / "24 Hours of Le Mans" not just "Round X →". Open-Meteo `forecast_days` 7 → 16 + KV cache-bust guard (`daily.length >= 14`) — F1 R5 Canada Sunday weather restored.
- → done: ship `0.9.12` + `0.9.13` via PR #4 + PR #5 — **Paris's parallel contact-form work**. Resend Marketplace integration installed, sender swap to apex `paddock-tracker.com` after `send.` subdomain rejected 403. Contact form delivers end-to-end now.
- → done: ship `0.9.15` via PR #7 — **Google Analytics 4** wired via `next/script` `strategy="afterInteractive"` in `app/layout.tsx`. Coexists with Vercel Analytics + Speed Insights. EEA consent banner logged to IDEAS Next.
- → done: ship `0.9.16` via PR #8 — `rounds.json` curated for F2 / F3 / IMSA / IndyCar / WSBK. Five more series gain canonical round numbers + race names; weekend cards stop array-indexing.
- → done: ship `0.9.17` via PR #9 — **cron fail-closed** when `CRON_SECRET` is unset. Reverses the prior fail-open default that would have turned `/api/cron/notify` + `news` + `race-week` into unauth'd spam guns if the env var ever cleared. Auth logic extracted to `lib/cron-auth.ts` (single source of truth instead of triplicated). HANDOFF landmine #6 rewritten. Surfaced by a security review of `/changelog`.
- → done: ship `0.9.18` via PR #10 — **split CHANGELOG.md (engineering) from RELEASES.md (public)**. `/changelog` page now reads `RELEASES.md` only — user-facing prose, no file paths or library names. CLAUDE.md release-notes rule rewritten to mandate the two-file pattern. RELEASES.md backfilled to 0.8.0.
- → done: ship `0.9.19` via PR #11 — **`docs/research/supabase-schema-draft.md`** (~800 lines, 18 sections). Full v1 DDL ready to `psql -f` once the project is provisioned, plus 10 open questions for Tuesday Fotis. Closes Saturday's "Task #2 skipped — DDL doc never written".
- → done: triaged `IDEAS.md` Now / Next, closed Sunday in SCHEDULE.md, updated `docs/HANDOFF.md` for Monday, updated `feedback-paddock-release-notes` memory to reflect the two-file split.
- → partial: Task #4 weather + news audit. The *correctness* angle (round numbering, session times) is now solid post-PR #6 + #8. The *coverage* audit (does every series have weather wired? does every series have news?) is still pending — promoted to Now #2.
- → deferred to Monday: IMSA P1 missing on R6–R11, FE Sanya R11 missing session times, F1 Azerbaijan `endDate` Sep 27 vs actual Sep 26.

Won't touch this session: AllSportsApi integration, comments / predictions infra, anything from `Parked` or `Killed`, `rounds.json` for the bottom 8 series (deferred to Monday Now #1).

Active:
_(no [+Nm] prefixes received this session — flag if backfill needed)_

### Mon 2026-05-18

Pre-Fotis cutoff final day. Priority order:

1. **`rounds.json` for the bottom 8 series** — DTM, GTWCE, NLS, NASCAR Cup, WRC, IndyCar R11–R14 + R17 (Mid-Ohio / Music City / Portland / Markham / Laguna Seca), MotoGP postponement-cascade consistency check, FE (R11 Sanya gap + venue-named rounds.json). Closes Now #1.
2. **IMSA P1 + FE Sanya R11 + F1 Azerbaijan `endDate` curation patches.** Small Sunday-audit gaps. Closes Now #3.
3. **Weather + news coverage audit.** For each of 15 series, click into next upcoming weekend, list whether Open-Meteo + news populate. Output: per-series gap list. Closes Now #2 partially (audit only; fixes batched separately).

Won't touch this session: Supabase provisioning (Tuesday post-Fotis), SEO baseline, comments / predictions, distinct session pages, anything from `IDEAS.md Parked` or `Killed`.

Active:
_(awaiting [+Nm] prefixes)_

### Tue 2026-05-19 — Fotis sit-down day

**Sit-down agenda:** walk `docs/research/supabase-schema-draft.md` together — answer the 10 open questions in §17 (UUID v7 timing, service role split, status PK shape, JSONB scope, Schema.org generation location, audit retention, backfill noise, naming, comments/predictions launch order, Realtime). Decision per Q determines whether v1 schema goes in as drafted.

**If shape holds:** kick off Supabase provisioning — Vercel Marketplace install, link to project, write env vars. Then run `001_extensions.sql` through `008_rls.sql` (the 12-step order in §18 of the schema draft).

**If shape needs rework:** update `supabase-schema-draft.md` in place + re-PR. No code changes.

**End-of-day:** pre-Fotis cutoff rule expires after the sit-down. Resume normal IDEAS.md triage cadence. Delete `project-paddock-pre-fotis-cutoff` memory.

Won't touch this session: actual cron worker writing diff logs, JSON→table migration script (v1.5 work), live in-race data, anything from IDEAS.md Parked.

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
