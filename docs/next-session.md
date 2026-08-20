# Next session — the blog approval, AdSense wave 2, then the image session

Written at the 2026-08-20 session-30 close. `main` = **0.324.0**, twelve merges today, zero open PRs, every merge prod-verified. Full record: `docs/HANDOFF.md` (top block) + `CHANGELOG.md` 0.321.2 → 0.324.0.

## 1. The blog draft is waiting on you (time-sensitive)

The contract changed mid-session: you asked for drafts, not fact packs only. A finished **Zandvoort farewell preview** sits in the session-30 scratchpad as `draft-f1-dutch-grand-prix-2026-preview.md`, written in your voice from the 20 published posts, with:
- a licence-verified hero (Verstappen at Zandvoort, CC BY 2.0, Danny Tax) and an inline 1975 podium shot (Anefo, CC BY-SA 3.0 NL), both eyeballed;
- four Verstappen quotes, each sourced and linked ("It's a shame, but… the track's still there", "No one can take that away from us anymore", the "Dankjewel Zandvoort" helmet);
- standings verbatim from `scripts/weekend-post-context.mts`, everything else fact-packed.

On your yes: move it to `drafts/`, convert, then `draft-post.mts` inserts it as a **prod DB draft with `publish_at` null** for you to schedule in `/blog`. The race is Sunday 23 August, so this expires fast. Three things I flagged inside for your judgment: the "roughly one hundred thousand" crowd line (colour, not a verified 2026 figure), one voice bet ("which is its own kind of strange"), and an alternate second image if you want two.

Going forward you also want **images in every post** and **driver-radio embeds** (OpenF1 `team_radio`; player UX + rights stance still to design).

## 2. AdSense: wave 2 and four decisions

Wave 1 shipped (F1 champion answers 1996-2025, `content/series/f1/champion-notes.json`, fail-soft so each new wave is data-only). Next:
- **MotoGP champion notes** — its researcher died on the cap producing nothing; when redone, note it had already caught that season-page table extraction fails arithmetic there (sums 337/241 vs actual 309/245), so that source is unreliable.
- **Your decisions** (all in `IDEAS.md` NOW #1): making Race Story public on completed sessions (the cheapest verdict-mover — hundreds of pages enriched at zero authoring cost, and it needs the SEO-Phase-2b ISR unpark that the sweep independently asked for); the two stub components' copy and whether contentless tabs stay indexed; noindex on the 15 news tabs (the one family enrichment can't fix).
- Then Request review **once**, when we believe it.

## 3. PSI: re-measure the deltas

Four packages shipped against the sweep. Re-run `/`, `/series/f1/standings` and a weekend page, paste them, and I'll append the delta row. Expect: standings CLS 0.134 → ~0, mobile LCP down across the board from the font fix, driver/weekend LCP down from the image fix. A free PageSpeed API key would let me script future sweeps instead of you clicking twenty times.

## 4. Three design/behaviour decisions

- **Serwist `cacheOnNavigation`**: the /calendar `DataCloneError` is upstream (`@serwist/turbopack@9.5.12` forwards a `URL` into `postMessage`). Recommend dropping the flag — offline was removed in 0.268.0, so it is vestigial and currently throwing.
- **Calendar contrast**: mono agenda times under 4.5:1 on Paper; recommend a token nudge.
- **Month-grid tap targets**: recommend accept as-is.

## 5. Then the big one

**THE IMAGE SESSION** — your words, "the biggest job we have ever done". Licence-clean imagery at scale (Commons works; portraits/logos died on licensing before, so every source gets checked), the Fotis testing-build layout as reference, home refined with image boxes to series/calendar. Information hubs are also the last pre-Paper surface and should be restyled in the same pass.

## Ritual per PR (unchanged, hard-won)

`git checkout -b <branch> main` as the **literal first action after every merge** → edits → `rm -rf .next/dev` (kill dev FIRST — deleting it under a live server 500s the server) → `npx tsc --noEmit` → `npm run lint` (0 errors; 2 known `_encoding` warnings) → `npm test` (1125) → `npm run build` exit-checked → browser-verify on dev (Playwright MCP or `npx playwright screenshot`) → trio (`package.json` + `CHANGELOG.md` + `RELEASES.md`) → commit with no Claude attribution → PR with what/why/verified → squash-merge → prod-verify ~9 min later with a background curl. Kill processes by PID via the port, never by image name. Prod data writes only through the scheduled GitHub pathway, or when you name the action.

**Subagent rule, re-learned the hard way today:** one research agent at a time. Three in parallel hit your session cap; two left recoverable partial work (validated and shipped), one left nothing. Always check for partial output before redoing an interrupted agent's job, and never merge an interrupted branch without re-running the whole gate chain.
