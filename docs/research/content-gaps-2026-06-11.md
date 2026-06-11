# Content-gap audit — 2026-06-11

Operator-ordered pre-launch sweep: every series, every tab, file matrix +
live probes against a fresh dev server at v0.35.0-pending. Cold-compile
flakes were re-probed individually before being called gaps.

## Verified complete (the baseline)

- Content files: meta/rounds/sessions/drivers/overview/history/**rules** —
  15/15 (ADAC: no rounds.json by design, single event).
- Standings live 14/15 · results live 13/15 · champions rendering 15/15
  (13 curated + indycar/nls via the verified parser) · drivers curated 15/15
  · About = overview + rules essentials + wiki summary 15/15 · history 15/15.
- Weekend pages: frozen standings ×10 series, session pages F1-complete +
  race sessions ×7 series, session rail/pager everywhere.
- Profiles: season form + last-5 on drivers, team form + lineup form.

## Gaps, by launch impact

| # | Gap | Severity | Path |
|---|-----|----------|------|
| 1 | **/blog is empty** — zero posts on a public, linked surface | HIGH (launch) | W8 launch post + 2–3 seed posts (editorial time, no code) |
| 2 | **NLS standings = "Coming soon"** — the only dead primary tab in the app | MED | teilnehmer.vln.de PDF parser (0.12.16, source probed viable in May) — or accept + de-emphasize tab pre-launch |
| 3 | **WEC results = link-out** — also blocks WEC race-session pages and results-ready notifications (Le Mans!) | MED | 0.12.8.1 StimulusJS XHR reverse-engineer (~1-2h probe) |
| 4 | **DTM results = link-out** (chart moved to Standings; no per-race source) | LOW (documented) | motorsport.com per-event probe (0.12.15.1) |
| 5 | **Driver photos absent** on 600 driver pages | MED (polish) | Wikimedia + per-image attribution program, F1's 22 first (in IDEAS) |
| 6 | **ADAC curated lineup unreachable on its series page** — singleEvent tab set has no Drivers tab; data only surfaces via /drivers/* | LOW | one-line tabsFor decision: add Drivers to the slim set |
| 7 | **indycar + nls champions still parser-served** — the curation rule says curated is the law | LOW | two champions.json curations (agent task) |
| 8 | **Sessions.json rolling debt**: DTM Norisring R4 TBC, WRC mid-season stages, IMSA P1 R6–R11, FE Sanya R11, NASCAR/IndyCar race-week times | LOW (publishes upstream over time) | recurring curation pass when timetables drop |
| 9 | **NLS + GTWC news tabs look thin** — possibly missing NEWS_SLUG_MAP feeds | LOW | verify the two mappings (minutes) |
| 10 | Endurance class-shapes (IMSA/GTWC/WEC) have no frozen weekend standings or session classifications | accepted | per-class adapter pass, post-launch |

## Recommendation

Launch-gating from this list: **#1 only** (an empty blog reads as abandoned).
#2 and #3 are the two worth attempting pre-launch if cheap probes pan out —
both have known sources. Everything else ships as documented post-launch
work; #6/#7/#9 are minutes each and can ride any PR.
