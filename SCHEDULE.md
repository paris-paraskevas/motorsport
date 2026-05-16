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
- → done: release notes (`CHANGELOG.md` 0.9.1) + `package.json` bump pushed in `d655bab`.
- → in progress: bootstrap `CLAUDE.md` operating manual, `IDEAS.md` ledger, `SCHEDULE.md` time plan. Encode session workflow + release-notes rule.
- Won't touch this session: Supabase migration, curating non-F1 sessions.json files, SEO baseline, anything from the Parked list.

### Sun 2026-05-17

_(plan TBD — propose at session start)_

Candidate work, in priority order:
1. Visually verify yesterday's fixes in a real browser (Canada round 5, FE Monaco timed sessions, no 3 am leakage on home / calendar). Capture screenshots for the changelog.
2. Resolve residual `00:00` mystery string on /series/f1/weekend/5.
3. Start curating `sessions.json` for the next non-F1 series — pick the one with a live race this weekend or next.

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
