# Paddock blog — editorial rollout plan

**Date:** 2026-06-27 · **Status:** Approved (brainstorming) → drafting. · **Approval:** the operator triple-checks + approves every post before publish (Rule #1).

## Goal & strategy (phased by audience size)

- **Phase 1 — now (pre-traffic): SEO-first.** Priority Discovery → Engagement → Authority. The blog's first job is to pull **new** visitors in from search.
- **Phase 2 — once there's an audience: Engagement-led.** Priority Engagement → Authority → SEO (maintenance). Recaps + push + reactive content retain users; SEO drops to upkeep.

The pivot is a checkpoint, not a date — see [Phase-2 trigger](#phase-2-pivot-trigger).

## Approach — coupled spine + themed evergreen (Approach C)

The F1 preview/recap **spine** runs continuously; each race week **also** ships one **evergreen** piece themed to that round (e.g. a circuit guide). Every piece either captures a race-search spike, builds the durable evergreen library, or both. Chosen over a timely-only spine (decays fast, no SEO compounding) and an evergreen-foundation-first build (misses imminent race spikes).

## Content types

| Type | Timely / evergreen | SEO target | Notes |
|---|---|---|---|
| F1 race **preview** | timely (per round) | "{GP} 2026 preview" | form, storylines, when/how to watch |
| F1 race **recap** | timely (per round) | "{GP} 2026 results / report" | what happened + standings shift; **push hook** |
| **Circuit guide** | evergreen | "{circuit} guide / layout" | ships the week of that round (double duty) |
| **Rules / explainer** | evergreen | "F1 2026 rules explained", "what is DRS" | 2026 is a big regs year = high demand |
| **How / where to watch** | evergreen | "how to watch F1 2026" | high commercial-intent search |
| **Driver / team guide** | evergreen | "F1 2026 grid" | long-tail |
| **Tentpole** (non-F1) | timely | Le Mans / Indy 500 / Bathurst | added as their dates land |
| **Authority / data** | occasional | the "honest data" angle | credibility; leans in during Phase 2 |

Every post deep-links into Paddock's own pages (`/series`, `/series/<slug>/weekend/<round>`, `/series/<slug>/standings`, the new circuit map) — that's SEO **and** the funnel from reader → app user.

## Weekly rhythm

- **F1 race week:** preview (≈Thu) → recap (≈Mon) + a round-themed **evergreen** midweek.
- **Off-weekend / summer break:** 1–2 evergreen backlog pieces.
- **Tentpole non-F1 events** (Le Mans, Indy 500, Bathurst, …): added as their dates approach; the immediate ones (Le Mans, Indy) have passed for 2026.

## Near-term slate (next ~6 weeks, 2026 F1 calendar)

1. **~Mon 6/29 — Austrian GP recap** (R8, racing 6/26–28). *Timely.* (The R8 preview already shipped — the first live post.)
2. **ASAP — "F1 2026 rules explained"** — cornerstone evergreen (massive search; the 2026 regs are past the model's knowledge cutoff, so **web-searched against FIA/F1 primary sources + cited**). *Evergreen.*
3. **Wk of 7/2 — British GP preview** (R9, Silverstone) + **Silverstone circuit guide**; **recap ~7/6.**
4. **Wk of 7/16 — Belgian GP preview** (R10, Spa) + **Spa-Francorchamps circuit guide**; **recap ~7/20.**
5. **Wk of 7/23 — Hungarian GP preview + recap** (R11, Hungaroring).
6. **Backlog (off-weeks / summer break):** the evergreen library below.

## Evergreen backlog (SEO library — ship on off-weeks)

- **F1 2026 rules explained** (cornerstone; web-searched + cited).
- **How to watch F1 2026** (+ per-region where it helps search).
- **F1 2026 grid: every driver & team.**
- **What is DRS / the sprint format / the points system.**
- **Circuit guides**, one per upcoming round (Silverstone, Spa, Hungaroring, Zandvoort, Monza, Madring …) — paired to that round's preview week.
- **Madring: F1's new Madrid circuit** (ahead of R14, 9/13 — new venue, high novelty search).

## Fact-checking (Rule #1 — non-negotiable)

- **Evergreen** history / circuit / rules-mechanics = stable + lower-risk — but anything **2026-specific is past the model's cutoff**, so the rules + grid + new-circuit pieces are **web-searched against primary sources (FIA, Formula1.com) and cited** (link, never paste).
- **Timely** previews/recaps = current-season specifics (results, grid, standings, penalties) → **web-searched + the operator triple-checks every fact before approve.** Never inferred. (The first live post shipped with a fact error before this discipline was enforced — see `feedback-paddock-scrutinise-drafts`.)

## SEO & pipeline mechanics (per post)

- **slug:** keyword-friendly (e.g. `british-gp-2026-preview`, `silverstone-circuit-guide`).
- **title:** ~60 chars, keyword-front.
- **summary:** ~150-char meta description.
- **body:** markdown; cited sources; deep-links to Paddock's own pages (SEO + funnel).
- **hero_image:** Wikimedia-attributed (per the free-imagery rule) or null.
- **series_slug:** `f1` for F1 posts; site-wide evergreen may stay `f1` or be null.
- **Flow:** Claude drafts → operator triple-checks → approve with `publish_at` → the `publish-posts` cron publishes + fires the dual push. Previews scheduled for race-week; recaps shortly after the race.

## Phase-2 pivot trigger

Revisit after ~6–8 weeks of data, or when GSC shows previews/guides ranking / sign-ups ticking up from blog traffic. Then: recaps get more reactive + opinionated, push is leaned on harder, engagement formats appear (head-to-heads, "biggest stories of the weekend"), and SEO drops to maintenance.

## Out of scope (now)

- **All-15-series weekly coverage** — revisit only if the F1-backbone + tentpole rhythm proves sustainable.
- The `/changelog` + existing-home-widget remasters (separate IDEAS items).
- The scheduled-drafting *automation* cadence (the `ScheduleWakeup`/cron trigger exists separately) — this plan defines **what** to draft, not the trigger mechanics.

## References

- Pipeline: `lib/blog.ts`, `app/(app)/blog`, `/api/cron/publish-posts` (#240 + admin composer #246).
- Editorial voice / principles / sources: `docs/content-authoring/README.md` + `SOURCES.md`.
- Rule #1: memory `feedback-paddock-scrutinise-drafts`.
- Existing posts: `content/posts/{le-mans-2026-preview,how-paddock-keeps-15-series-honest,2026-half-season-review}.mdx` + the live DB Austrian GP preview.
