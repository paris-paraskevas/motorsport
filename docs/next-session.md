# Next session — the operator's drafts, the AdSense audit, the image session

Written at the 2026-08-20 session-30 wrap. `main` = 0.322.2, six merges today, all prod-verified. The full session record is `docs/HANDOFF.md` (top block) + `CHANGELOG.md` 0.321.2 → 0.322.2.

## 1. Blog corrections (the standing contract)

The operator writes both blogs from the delivered fact packs; Claude returns **corrections only** — factual errors, stale numbers, house-style breaches (no em dashes, no AI phrases, always link out). No drafting, no DB rows.

- Fact packs (session-30 scratchpad, every claim sourced + retrieval-dated, UNVERIFIED lists at the end): `factpack-a-f1-summer-break.md` · `factpack-b-dutch-gp-zandvoort.md`.
- Sprint question resolved: Zandvoort IS a sprint weekend (5th of 6 in 2026, its first and last GP); the calendar was right.
- Re-pull the weather on writing day (venue-local dates; the exact Open-Meteo call is in pack B). Current model: cool, windy, heavy rain for Sprint Saturday.
- Two traps already flagged in the packs: do NOT present "two DRS zones" as a 2026 fact (active-aero/Manual Override era — zone config UNVERIFIED), and the FIA shutdown citation is Article F3.1.1 of the restructured 2026 regs (not the old 21.8).

## 2. AdSense "Low value content" recovery (IDEAS NOW #1)

- `ads.txt` serves correctly on prod; the console's "Not found" is a stale Aug-5 crawl. The real gate is the policy verdict, which predates the 126-bio day, the Paper reimagining and the meta-description sweep.
- Work: audit the weakest indexed URL families against Google's minimum-content / thin-content docs, strengthen or noindex, THEN the operator ticks "I confirm" + Request review — once, when we believe it.

## 3. THE IMAGE SESSION (operator: "the biggest job we have ever done")

- Evaluate then steadily add licence-clean imagery ("humans understand visually"). Hard constraint: portraits ×14 and team logos were killed on licensing — every image needs a clean source (Commons already works for driver profiles; survey official press pools per series first).
- Layout reference the operator likes: **Fotis' testing build** — big series image card beside the lead story, UP NEXT strip (session, venue, weather, countdown, watch-live) under the pair.
- Riding along: home image boxes leading to series/calendar; blog driver-radio embeds (OpenF1 `team_radio`); and the now-orphaned `content/landing/circuits.json` + `public/landing/circuits/*` (dead since the orphan sweep — reuse or delete here).

## 4. Small standing items

- **PSI re-run owed (operator)** → Claude appends the 0.321.2 delta row to `docs/perf-baselines.md` (expect the 7 s document stream gone, mobile LCP toward ~1.5-2 s, SI collapsing from 10.8 s).
- Confirm the warm-live-data scheduled runs stay green (first post-fix run was mid-flight at the wrap; the lockfile disease is 2-for-2 after dependency merges — consider an `npx npm@10 ci --dry-run` gate or a failure alert, logged in HANDOFF).
- HANDOFF trim (~480 KB) remains overdue (IDEAS NOW).
- Operator dashboard clicks: GSC Validate-fix + noindex re-validate · Bing meta re-validate · avatar-menu signed-in eyeball · the two `/feedback` DONE moves.

## Ritual per PR (unchanged, hard-won)

`git checkout -b <branch> main` as the **literal first action after every merge** → edits → `rm -rf .next/dev` → `npx tsc --noEmit` → `npm run lint` → `npm test` (1125; a lone red under load is the documented flake — rerun, never weaken) → `npm run build` and CHECK the exit → dev browser verify (stop dev before any build; kill by PID via port, never by image name) → trio (`package.json` + `CHANGELOG.md` + `RELEASES.md`) → commit, no Claude attribution → push → PR with what/why/verified → squash-merge → verify prod ~9 min later with a background `Bash` curl (Playwright MCP died 2026-08-20; `npx playwright screenshot` is the working browser check). Prod data writes only through the scheduled GitHub pathway, or when the operator names the action.
