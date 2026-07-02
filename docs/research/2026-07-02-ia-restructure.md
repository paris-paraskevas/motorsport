# IA / navigation restructure — design + phased rollout

**Date:** 2026-07-02 · **Status:** design proposal (no code shipped — needs operator taste + a visual pass). Produced by a 3-lens design tournament + adversarial synthesis.

## Context

Operator ask (IDEAS, 2026-07-01): *"the site now holds a LOT of info — either restructure the IA, or make the important things reachable in ~1 click from the main pages, ESPECIALLY the home page."* Standing bias: ship **safe increments**, not a big-bang restructure.

Fixed constraints: content stays public + indexable; series tabs stay path-based (`/series/[slug]/[tab]`); gating shows walled items **with a lock + CTA** (never hidden); lean on the new ⌘K search to keep the bar lean; mobile bottom bar ≤ 5 items.

## The three proposals (tournament)

1. **One-click-from-home (discoverability-first).** Shrink the top bar to 4 labels; turn `/app` into a launcher hub so everything important is ~1 click from home; offload the long tail to ⌘K. *Best home spine + two low-risk label wins.*
2. **Task / jobs-to-be-done grouping** (Follow&Watch · Analyse · Play · Read). Nav labels map to verbs, not content types. *Cleanest mental model + the only one that gives Drivers/Teams a nav home — but highest blast radius; verb labels hide the literal words users scan for; a History→Champions merge would change an indexed URL.*
3. **Evolve-not-revolt (minimal disruption).** Keep the 0.97.0 shell byte-identical; earn "1-click" purely on Home + via ⌘K; reuse shipped primitives (`CollapsibleSectionHead`, `groupSeriesByCategory`, `HeaderNavMenu`, `SearchTrigger`). *Lowest risk; adds two ideas the others miss (a Standings▾/Results▾ home picker chip; a weekend/session breadcrumb).*

## Recommendation (synthesis)

Take **Proposal 3's evolve-not-revolt skeleton** as the safe spine (the shell was overhauled just 3 releases ago at 0.97.0 and ⌘K only just shipped — re-cutting taxonomy now discards verified work for near-zero near-term gain), then layer on **Proposal 1's home launcher + two label wins**, and defer **Proposal 2's one strong structural idea** (a nav home for Drivers/Teams) to a later increment. Depth reduction comes from the **home launcher + ⌘K**, never from burying content — so SEO + path-based tabs are untouched.

**Desktop nav (near-term):** `Home · Calendar · Series (mega-menu regrouped into the 5 categories: Formula/Motorcycle/Endurance/Oval/Rally; featured "F1 Analysis & Replays" link) · News (label now clickable → /news) · Social (betting-env-gated, lock CTA for anon) · [right] ⌘K · account cluster.`

**Mobile bottom bar:** `Home · Calendar · Series · Social (env-gated) · Account.`

**Home (the 1-click surface):**
- **Block 1 "Up next"** pinned at the very top — current/next weekend, countdown + official watch link + 1-click into the weekend; followed-first, cap ~3; expands to a Live-now strip when a session is live.
- **Block 2 "Just missed"** — latest results, each 1-click to the result + recap; followed-first, cap ~3.
- **Block 3 "Jump to" launcher** (single row, ≤6 chips) — Calendar · F1 Analysis & Replays (lock for anon) · Standings▾ · Results▾ · News · Social (lock for anon). The Standings▾/Results▾ chips open a small series-picker popover (reuse `groupSeriesByCategory`); series not in the popover fall through to ⌘K.
- **Block 4** — News demoted to a quiet secondary strip.
- The fixed Up-next / Just-missed / Jump-to blocks render **above** the customisable widget zone so the 1-click guarantee holds regardless of `HomeLayoutPrefs`; personalisation stays additive below.
- A ⌘K affordance in the hero ("Search drivers, teams, a GP…").

**Gating treatment:** exactly the shipped model — all content public/indexable; the interactive layer walled (F1 analysis/replays + H2H, all of `/social`, notifications, home-customise, following); walled entry points stay **visible with a lock + "Sign up" CTA**; badge **specific** walled sub-items, never a group header that mixes free + walled children (this is why the verb-group "Analyse" is not recommended for increment 1). Copy must read "content is free, account only for the interaction."

## Phased rollout

- **Increment 1 (safest, ship first — no taxonomy change, no SEO risk):** Home v3 spine (Up next → Just missed, above the customisable zone; News demoted) + the "Jump to" launcher with the Standings▾/Results▾ picker + the weekend/session breadcrumb + a ⌘K hero affordance. **The Decoder→Analysis/Replays copy sweep is already shipped (PR #356).** Reuses shipped primitives; blast radius = a page component. Browser-verify at 1440/1024/390 + anon/live states.
- **Increment 2 (low-risk nav polish, after 1 is verified):** make the top-level **News** label clickable → `/news` (route exists; label is menu-only today); regroup the Series mega-menu strictly into the 5 categories (verify all 15 map cleanly); optionally rename Social→"Play" (pure relabel, touches primary-nav strings → re-verify).
- **Increment 3 (structural, only if data/user-research justifies):** give **Drivers & Teams a real nav home** (today search/deep-link only) as pure addition. Only then, if the content-type taxonomy proves to be the friction, evaluate the fuller jobs-to-be-done regrouping — treating any tab-URL change (e.g. History→Champions) as a separate deliberate SEO task with 301s, never bundled silently.

## Open questions for the operator (taste / product calls)

1. Does **F1 Analysis & Replays** earn a top-level nav slot, or is the mega-menu featured link + a home chip enough? (Check its click-through before demoting — the assumption it doesn't need a slot is unverified.)
2. **Social vs "Play"** as the top-level label — keep the noun or use the verb? Decide *before* any string sweep so labels change once.
3. How aggressive should the **information-density / disclosure pass** be per page (esp. the 7-section F1 race page)? Which sections default open vs collapsed is a taste call.
4. Do **Drivers/Teams** warrant a top-level nav home now (pull increment 3 forward), or is ⌘K + contextual links enough for now?
5. Is a bigger **jobs-to-be-done regrouping** desired at all, or is evolve-not-revolt the intended end state?
6. Exact **lock/CTA copy** on walled items so it never reads as "this content is paywalled."
7. Cap + contents of the home **"Jump to"** launcher, and show it to signed-out users (recommended — content is public) or signed-in only?

## Notes

- Full per-lens proposals + the adversarial comparison are in the tournament transcript (`wf_bdfe1a86-402`). This doc is the synthesis + rollout.
- No implementation shipped here — the primary-nav + home changes are high-blast-radius and need the operator's taste + a browser pass. Increment 1 is the safe first build once approved.
