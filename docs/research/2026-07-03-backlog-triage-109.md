# Backlog triage — all 109 open items vs the code (2026-07-03)

Method: 14 parallel verify agents (ultracode workflow `backlog-triage-109`), evidence required per verdict (file:line / CHANGELOG version / commit), riskiest DONE verdicts re-checked by hand (11/11 held). Item numbers = the flat list printed in-session 2026-07-03.

**Verdicts: 70 OPEN · 20 DONE · 4 MOOT · 15 OPERATOR-GATED.**

## Strike from the ledger (DONE — stop resurfacing)

| # | Item | Evidence |
|---|---|---|
| 1 | exact_position go-live | `lib/betting/automation.ts:39` in MARKET_BUILDERS; 0.95.0 |
| 4 | Security audit | `docs/research/security-audit-2026-06-11.md`; re-verified 2026-06-21; contact rate-limit live |
| 7 | W3 rules ×15 | 15/15 `content/series/*/rules.md`; 0.31.0 |
| 30 | B11 path-based tabs | `app/(app)/series/[slug]/[tab]/page.tsx`; 0.103.0 |
| 49 | Badge chequered motif | 0.139.1 = 4×4 chequered flag on pole |
| 50 | Push click deep-link | `app/sw.ts:107-144` opens `data.url`; senders set specific URLs |
| 52 | Push hero images | `lib/push.ts:31` + `app/sw.ts:85`; blog pushes carry them |
| 53 | Delete lib/onboarding.ts | removed in #318 (`c55cfe6`) |
| 55 | Clerk retheme | ClerkProvider appearance carries Paddock tokens (`app/(app)/layout.tsx:81-90`) |
| 56 | PWA modals → tokens | 0.24.0 retired the zinc surfaces; PWAInstallPrompt deleted |
| 62 | overview.md folded into F1 About | `AboutTab.tsx:49-63` renders it whole |
| 70 | Blog editorial direction | approved rollout plan `docs/superpowers/specs/2026-06-27-blog-rollout-plan-design.md` |
| 73 | "Past Winners" label | `ChampionsTab.tsx:522,602` for singleEvent |
| 80 | /api/just-missed TTFB | warm-results cron shipped (0.108.0) |
| 87 | Home collapse more blocks | 0.80.0 (This week + News); chyron deliberately show/hide-only |
| 92 | Champ-leader empty set | 0.139.0: empty = all-followed + pick-a-series empty state |
| 93 | Collapsible race sections | 0.120.0, `CollapsibleSection` on the session page |
| 100 | W1 point-in-time standings | `WeekendStandingsSnapshot.tsx` with honesty guards |
| 104 | First MDX posts | 0.35.1 seed posts; superseded by blog SOP (#374) |
| 107 | GDPR cookie banner | `CookieConsent.tsx` + Consent Mode v2 (0.12.6) |

**MOOT (kill):** 33 XHR reverse-engineering (all three sites ship JSON/HTML pipelines already) · 57 mdx-components tokens (file has no styling; real residual = the `prose-zinc` wrapper, folded into batch F) · 102 paddock-coins (superseded by betting credits) · 109 Supabase region / D1 moves (Dublin co-location realised it).

## Operator-gated (15) — need you, not code

| # | Item | What it needs |
|---|---|---|
| 2 | Real-odds adapter | provider choice + paid key (wiring ≈ half a day after) |
| 3 | First forecast settlement | check prod bet history for Austria, or watch Silverstone settle |
| 11 | dev.paddock-tracker.com | Vercel project/DNS + second Supabase/KV + Clerk dev keys |
| 12 | Anon visual passes (#367/#368/#371) | a browser session |
| 13 | Signed-in F1-analysis pass (#361) | a browser session (partially covered pre-merge 07-02 — see HANDOFF conflict note) |
| 14 | 5 IA taste calls | decisions (Social→Play · F1-Analysis slot · Drivers/Teams home · density · JTBD) |
| 17 | Paid tier | product/monetization decision (zero paid code exists) |
| 19 | Sentry | DSN (then wiring is M) |
| 23 | W6 TWA | Play Console account, .aab upload, closed test (assetlinks already hosted) |
| 34 | API-Sports fallback | trigger hasn't fired; needs key + preview test |
| 63 | Rotate sk_live + .supabase-pat | dashboard access |
| 89 | Admin analytics | GA4-vs-KV architecture decision + service account |
| 95 | /feedback lanes | which /series tab; signed-in /social screenshot; Loutris device |
| 101 | CI workflow | your zero-red-checks tolerance: pair-debug a throwaway branch |
| 105 | Design depth pass | parked until user-research findings exist |

## Wave 1 — today's parallel batches (file-disjoint, one worktree agent + one PR each)

Every build prompt inherits: PREPEND new CHANGELOG/RELEASES sections (never rename the top heading) · version bump per PR · no Claude attribution · browser-gated items ship headless with the visual pass owed · `git fetch` before each cascade merge, resolve version files `--ours`, eyeball CHANGELOG after.

| Batch | Items | Owner files | Notes |
|---|---|---|---|
| **A — Betting engine** | 85 multi-series markets (start F2/F3/MotoGP/WSBK) · 86 grid/quali market · 88 league profile links | `lib/betting/*`, `components/betting/*`, migration | 86 needs a prod `settle_market` migration (Management API — may prompt) |
| **B — Push / SW** | 47-v1 per-session-type rules (skip practice) · 48 sound variants (foreground-only, honest copy) · 21 CC0 sound swap · 51 devices list · 54 DRY push state hook · 71 offline fallback | `app/sw.ts`, `lib/userPrefs.ts`, `lib/push*`, notif components, `app/offline/` | sw.ts single-owner here; 48 constraint: background pushes can't use custom OS sounds |
| **C — Crons / resilience** | 18 `withSourceSnapshot` → F2/F3/IndyCar/GT-World standings · 77 warm-sessions cron · 76 recheck-results cron | `lib/standings/*`, `app/api/cron/*`, workflows | clone the 0.142.0 wrap pattern + warm-results cron skeleton |
| **D — Charts** | 84 ranked points list · 36 NASCAR Y-ticks/zoom | `components/SeasonTrendChart.tsx` | |
| **E — Session page** | 96 hover/interval/leader-gap · 60 broadcast + track info on session pages | session page, `ResultsTab`, `lib/results/openf1.ts` | interval from OpenF1 gap_to_leader deltas (F1 first, honest elsewhere) |
| **F — Champions tab** | 106 sparklines · 69 card-layout remainder (avatars blocked by imagery program) · 57-residual `prose-zinc` swap | `components/tabs/ChampionsTab.tsx`, blog article wrapper | |
| **G — Blog + threads** | draft in-page editor (approved spec 2026-07-03) · 16 local `/blog/[slug]` 500 · 25 author role · 24 replies/markdown/rate-limit · 41 weekend threads (stretch) | blog pages/api, `lib/threads.ts`, threads api/components | one agent — `lib/threads.ts` + blog page shared internally; spec at `docs/superpowers/specs/2026-07-03-draft-inline-edit-design.md` |
| **H — Chrome + segments** | 72 `--tint` on shell · 9 W8 banner (flag-gated dormant) + launch-checklist doc · 37 loading.tsx + segment error boundaries · 91 changelog polish | `AppShell`, new `loading.tsx` files, changelog page | |
| **I — Platform** | 75 ICS feeds · 59 Tracks tab · 15 vitest flaky guard · 39 component-test setup | `app/api/calendar/`, `lib/tabs.ts`, `SeriesPageView`, `vitest.config.ts` | ICS: dynamic segment can't carry literal `.ics` |
| **J — Home** | 90 remaster original widgets · 94-v1 standings-movers (derivable from season-trend for full-points series — no new infra) | `components/HomeContent.tsx`, `lib/homeLayout.ts` | shares `lib/season-trend.ts` with L → merge J before L, rebase |
| **K — 3D onboard** | 97 off-screen ghost indicator · 99a tyre darkening (+ pit/barrier polish if cheap) | `GhostLap3D.tsx`, `onboard/CarModel.tsx` | WebGL — heavy visual-pass debt |
| **L — Profiles + compare** | 35 Wikipedia bio + news mentions · 61 driver trend chart · 66 H2H constructors | drivers/teams pages, compare page, `lib/profile-stats.ts`, `lib/season-trend.ts` | bio via Wikimedia action API (the 0.150.2 datacenter lesson) |
| **M — Content curation** | 27 historic colours ×8 series · 29 IMSA/FE sessions backfill · 74 media.json seeds + 81 geo-clip audit | `content/series/**` only | web-search official sources per the missing-data rule |
| **N — Research docs** | 6 W5 layout spec · 10 weather+news audit · 22 UI inspiration · 45 subreddit/survey research · 46 psych research · 32 live-timing feeds · 28 endurance grouping audit · 103 README (screenshots owed) | `docs/**` only | pure parallel; no version bumps |
| **Z — serial closer** | 38 lint ×12 + husky | 10 files across batches | runs ALONE after all wave-1 merges |

## Wave 2 — dedicated sessions (L programs, not today)

5 B-perf (re-baseline → lazy-Clerk crux) · 8 W4 bios/photos program · 20 imagery program · 26 blog embeds pipeline · 31 Greek i18n · 40 preview E2E (needs bypass secret) · 42/43/44 mobile+WCAG+motion audits (browser-heavy) · 47-full notif matrix · 58 recap pages · 64 car upgrades (source crux) · 65 results lifecycle · 67 general admin UI · 68 Live Now expansion · 78 landing set-piece · 79 minigames (photo games blocked by 20) · 82 NLS PDF classifications · 83 charts ×5 (points-scale modules) · 98 broadcast cams + director · 99b real-geometry P2.

Full verdict JSON (evidence + notes + file guesses per item): workflow `wf_1a73c63d-a7d`, digest in the session transcript.
