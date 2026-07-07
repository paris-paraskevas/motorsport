# Weekly preview / digest blog cadence — design

**Status:** proposal (design-before-code). Author: session 2026-07-07. Source: operator — *"can't the drafted blogs be automated for Thursday 3pm and Monday 3pm for preview and digest respectively?"*

## Goal

A standing weekly rhythm of two posts for the **marquee motorsport event of the week**:
- **Preview** — published **Thursday 15:00 (Greece)**, ahead of the weekend.
- **Digest** — published **Monday 15:00 (Greece)**, the post-race recap.

…produced with the same research + fact-check rigour as the hand-drafted British GP report (`drafts/2026-british-gp-report.md`, #435), on a repeatable schedule, **without removing the human approval gate.**

## The rule that dominates the design (same as the assistant)

Paddock's credibility rests on data correctness. A generated race report that states a wrong winner/gap/points would publish site-wide **and push to every follower** before anyone reads it — the exact failure that already bit us (the unsigned British GP preview auto-published via MDX, reverted in #373). So the non-negotiable:

> **Nothing publishes unread. Every post lands as a `status='draft'` on prod Supabase and the operator approves it in `/blog`. The automation covers drafting + scheduling, never the publish decision.** (Operator decision, 2026-07-07: "keep approval".)

## What already exists (verified — no new build)

The entire draft → approve → publish pipeline is in place; this feature only adds a scheduled *drafter* on top.

| Stage | Mechanism |
|---|---|
| Create draft | `createDraft(authorId, DraftInput)` → `status='draft'`, unique kebab slug enforced — `lib/blog.ts:73` (input type `:60`) |
| CLI entry | `scripts/draft-post.mts <post.json>` — reads a JSON file, calls `createDraft`, then `notifyAdminsDraftReady`. Needs env `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `BLOG_AUTHOR_ID` (`draft-post.mts:1-9,32,43`) |
| Notify operator | `notifyAdminsDraftReady({id,title})` pushes admins "draft ready" (`lib/blog-notify.ts`; no-ops without KV/Clerk/VAPID) |
| Approve | operator sets/confirms `publish_at` in `/blog` → `status='approved'`. **Approval requires a `publish_at`** — `lib/blog.ts:236` |
| Auto-publish | `publishDuePosts(now)` flips every `approved` post whose `publish_at` has passed → `published` + follower push. Idempotent (status-guarded flip + KV ledger) — `lib/blog.ts:255`, `app/api/cron/publish-posts/route.ts` |
| Publish schedule | GH Actions `*/15 * * * *` pings the cron; a post goes live within ~15 min of `publish_at` — `.github/workflows/publish-posts.yml:8` |

**Consequence:** "publish the preview at Thu 3pm / the digest at Mon 3pm" is a solved problem — set `publish_at` to that instant at draft time; the operator confirms it on approval; the existing cron does the rest. `publish_at` is a UTC timestamp, so the drafter computes it with the correct Greece offset for the target date (EEST = UTC+3 in summer → 15:00 local = `12:00Z`; EET = UTC+2 in winter → `13:00Z`).

## Architecture — a drafting routine, not a content-cron

```
[schedule trigger]  →  drafting skill (research + fact-check + draft)  →  post.json
                                                                            │
                    deterministic step: tsx scripts/draft-post.mts post.json (prod env)
                                                                            │
                              status='draft' on prod Supabase  →  admin push
                                                                            │
                                    operator approves in /blog (sets publish_at)
                                                                            │
                                    publish-posts cron publishes at 15:00
```

The valuable, reusable core is **a drafting skill** — run identically by the operator in a session *or* by the scheduled trigger:

1. **Pick the marquee event of the week.** Rank the series racing in the target window by a curated prominence order — F1 > MotoGP > IndyCar > NASCAR Cup > WEC > Formula E > WSBK > F2 > F3 > DTM > GT World > IMSA > WRC > NLS > ADAC 24h — with a **crown-jewel override** for events that outrank a normal F1 weekend (Le Mans, Indy 500, Daytona 500, Monaco GP, ADAC Ravenol 24h). Preview looks at the **upcoming** weekend; digest at the **just-finished** one. **No race in the window → skip** (no post that cycle).
   - Schedule source: `loadSeries(slug)` → `groupByWeekend(sessions, now, rounds)` → the first `!isPast` weekend (preview) / most recent `isPast` weekend (digest) — `lib/group.ts:13`, labels via `weekendLabel` (`lib/weekend.ts:8`). Series registry: `listSeriesSlugs()` (`lib/series.ts:95`).
2. **Ground the numbers from our own loaders** so the post can't contradict the site (the CHANGELOG cross-series invariant): standings via `fetchStandingsBrief(slug, season)` (`lib/standings/brief.ts`); results/podium via `fetchLatestPodium(slug)` (`lib/home-results.ts`) or the per-series `lib/results/*` loaders. Coverage is uneven (see the loader map, `docs/` scout 2026-07-07): a single "winner"/"leader" is clean for f1, f3, formula-e, indycar, motogp (+ wec Hypercar); multi-class series (wec/imsa/gt-world) have no single winner — the digest focuses on the headline class. `null`/`[]` from a loader = "can't ground → omit, don't invent."
3. **Narrative from web research + primary-source fact-check** (RULE #1 / `feedback-paddock-scrutinise-drafts`): storylines, penalties, quotes, championship context — triple-checked against official sources (F1.com, series sites, The Race, etc.), exactly as the British GP report was.
4. **Emit `post.json`** — `{ slug, title, summary, body, seriesSlug, heroImage, publishAt }`, matching `DraftInput`. Deterministic slug (`f1-british-gp-2026-preview` / `-recap`) → the unique-slug guard makes re-runs idempotent. `heroImage` reuses existing curated circuit/series imagery (nullable). `publishAt` = Thu/Mon `15:00` Greece as an ISO instant.

### Content shape
- **Preview (Thu):** the weekend's storylines, session schedule (device-local on the page), what's at stake in the title fights, standings context, weather if available, where to watch → link the weekend page.
- **Digest (Mon):** result + podium, championship impact (standings shift), key moments / penalties / notable quotes, what's next → link results + the weekend page. Flagged **provisional** where results can still change on appeal (cf. the results-recheck lifecycle; a Monday recap can precede a Tuesday penalty reversal).

## Runner — the scheduling trigger

| Option | Verdict for an unattended weekly production cadence |
|---|---|
| **ScheduleWakeup / `/loop`** | **Rejected.** Session-bound: needs Claude Code open + machine on, 7-day expiry. Fine for intra-session polling, not a weeks-long cadence. |
| **Windows Task Scheduler → `claude -p`** | Viable fallback, but machine-must-be-on (no catch-up if asleep). |
| **Cloud Routines** | Works cloud-side, but fresh-clones per run + plan-gated; unnecessary here. |
| **GitHub Actions headless `claude -p` on `schedule:`** | **Recommended.** Machine-independent, matches our all-GH-Actions cron infra, cheap, secure. |

**Security boundary (key design choice):** the model **never holds the prod service-role key.** The headless Claude step is tool-allowlisted to `WebSearch,WebFetch,Read` and only *emits `post.json`*. A **separate deterministic workflow step** runs `tsx scripts/draft-post.mts post.json` with `SUPABASE_SERVICE_ROLE_KEY` in its env. Worst case is a bad *draft*, caught by the approval gate. (GH Actions cron is UTC-only and drifts an hour across DST — harmless, because `publish_at` carries the exact 15:00 target; the trigger only needs lead time, e.g. run ~06:00Z Thu/Mon.)

## Phased rollout (front-loads the un-blocked work)

- **Phase 0 — now, NOT Supabase-blocked.** Build the drafting skill's logic through "emit `post.json`" (marquee pick + grounded data pack + draft). Fully testable locally via a dry-run; the only step it can't exercise is the prod insert.
- **Phase 1 — Supabase-gated.** Point `draft-post.mts` at prod (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `BLOG_AUTHOR_ID`); **operator runs the skill manually** each Thu/Mon and approves in `/blog`. In-the-loop; proves the pipeline.
- **Phase 2 — secrets-gated.** Add the GH Actions workflow (mirrors `publish-posts.yml`) with `ANTHROPIC_API_KEY` + the Supabase secrets, two-step model→JSON→insert, for full autonomy once Phase 1 is trusted.

## Dependencies

1. **Prod Supabase creds** — the deferred Supabase issue (`.env.local` points at local 127.0.0.1). Blocks Phase 1+ and is the *same* blocker as queuing the British GP report.
2. **`publish-posts` cron live on prod** — very likely (the betting crons run, so `CRON_SECRET` is set), but confirm.
3. **`ANTHROPIC_API_KEY`** as a repo secret (Phase 2 only).
4. **`BLOG_AUTHOR_ID`** for the byline (already used by `draft-post.mts`).

## Won't-do / non-goals

- No auto-approve / auto-publish (operator rejected it; violates the Blog SOP).
- No touching the live assistant or any prod-Supabase write until the Supabase issue is resolved.
- Not MDX (`content/posts/*.mdx` auto-publishes on merge — Blog SOP forbids it).

## Pre-mortem (most likely failures)

- **A headless run's fact-check is less scrutinised than an in-session one** and a subtle error slips past a rubber-stamp approval. Mitigation: fact-check discipline baked into the skill (primary-source cross-check, RULE #1); start operator-triggered (Phase 1) and only graduate to headless once trusted; digest flags provisional results.
- **Marquee-selection picks the wrong or no event.** Mitigation: curated priority + crown-jewel overrides + explicit skip-when-no-race; the operator sees the draft before it publishes.
- **Duplicate drafts on a re-run.** Mitigation: deterministic slug + the `createDraft` unique-slug guard.

## Overlap / synergy

- **Assistant Phase 2** (`2026-07-06-ai-assistant.md`) is the same "our data → LLM, grounded, refuse-when-uncertain" problem — but the blog digest is a **safer place to prove grounded generation first**, because a human approves every post. Sequence the blog cadence ahead of, or alongside, the live-data assistant.
- **Per-weekend preview/recap cadence** the handoff already wants — this operationalises it.

## Effort estimate

- Phase 0 (skill logic + local dry-run): ~half a day.
- Phase 1 (prod insert wiring — `draft-post.mts` already exists — + operator run): ~1–2 h once Supabase is unblocked.
- Phase 2 (GH Actions workflow + secrets): ~half a day, after Phase 1 is trusted.
