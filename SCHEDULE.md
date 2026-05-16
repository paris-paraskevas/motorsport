# Paddock — time plan

Day-by-day intent. Updated at session start (write the plan) and session end (mark done / partial / skipped, sketch tomorrow).

Items here should map to entries in `IDEAS.md` Now / Next.

**Format conventions:**
- One section per ISO week (`## Week of YYYY-MM-DD`).
- One subsection per day (`### Mon YYYY-MM-DD`).
- Bullets are intent at the start of the day; append outcomes at the end (`→ done`, `→ partial: <note>`, `→ skipped: <why>`).
- Explicit "won't touch this session" line stops scope creep.

---

## Week of 2026-05-11

### Sat 2026-05-16

- → done: ship `0.9.1` weekend correctness fixes — phantom 3 am times (Session.dateOnly through the pipeline, "TBC" display, live-now + notify cron skips), canonical F1 round numbers via `content/series/<slug>/rounds.json`, sessions.json override loader, FE Monaco 2026 sessions curated.
- → done: bootstrap `CLAUDE.md` operating manual + `IDEAS.md` ledger + `SCHEDULE.md` time plan (`0.9.2`).
- → done: mature `CLAUDE.md` with ESPA protocol + seven extensions + Mode awareness + four communication discipline rules; reversed commit-attribution policy (no more `Co-Authored-By`) (`0.9.3`).
- → done: scaffold two-contributor workflow — `CONTRIBUTING.md` + `ONBOARDING.md` + reversed CLAUDE.md push-to-main rule. CI workflow parked. (`0.9.4`)
- → done: triage `IDEAS.md` Now/Next; close Saturday; sketch Sunday; port handoff from memory to `docs/HANDOFF.md`; memory file becomes a redirect stub. (`0.9.5`)
- Won't touch this session: Supabase migration, curating non-F1 sessions.json files, SEO baseline, anything from the Parked list.

### Sun 2026-05-17

Plan (in priority order):

1. **Browser-verify yesterday's fixes** on a real laptop with Chrome — `/series/f1/weekend/5` (Canada → Round 5), `/series/formula-e/weekend/12` (FE Monaco R9+R10 timings), home Live-now and Upcoming for any 3 am leakage. Take screenshots for the changelog.
2. **Resolve the `00:00` mystery** on `/series/f1/weekend/5`.
3. **Curate one more non-F1 `sessions.json`** — pick the series whose next race is closest (likely MotoGP or IMSA). Same pattern as FE Monaco.
4. **First PR-flow rehearsal.** Branch + PR + self-merge for one of the items above. Tests the workflow before Fotis arrives.

Won't touch this session: Supabase work, rounds.json non-F1 curation, SEO baseline, anything from the Parked list.

---

## Backlog stubs (next 1–2 weeks, no firm date yet)

- **Supabase migration scoping** — decide schema + scrape boundaries + what stays as files. Plan first; code in a later session.
- **Non-F1 `sessions.json` curation pass** — MotoGP, WEC, IMSA, FE remaining rounds. Likely 2–3 sessions of curation work.
- **Non-F1 `rounds.json` curation pass** — same set of series.
- **SEO baseline (S5)** — sitemap, robots, JSON-LD, per-page metadata, OG image generators.

---

## How to use this file

- **At session start:** if today's date doesn't have an entry, create one. Write the intent as a bullet list. Add the "won't touch" line.
- **Mid-session:** don't edit this file (use `IDEAS.md` Inbox for new ideas).
- **At session end:** convert intent bullets to outcomes (`→ done` / `→ partial` / `→ skipped`). If tomorrow's plan is obvious, stub it.
- **Weekly:** when a week wraps, roll old days into an archive note or trim the file as it grows. Don't let the file balloon past ~200 lines.
