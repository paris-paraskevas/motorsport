# Release audit — last ~100 releases vs prod reality (2026-07-10)

**Ask (operator):** check the last ~100 releases against current prod reality — separate what actually stuck from what was announced but quietly reverted, regressed, shipped DARK-and-never-flipped, or never truly happened. Evidence required per item.

**Method:** 10 parallel Opus 4.8 audit agents (max effort), one per ~10-release batch, covering **0.184.1 → 0.132.0** (101 releases, 2026-06-30 → 2026-07-10) — each read the RELEASES.md claim + CHANGELOG.md engineering detail and verified the named files/functions/flags against current code, with prod curls for user-facing claims. Then **1 adversarial verifier** (Opus 4.8) tried to refute the clean result: pressure-tested every non-LIVE verdict, re-checked the code-only LIVE verdicts for dead/dark paths, and swept the codebase for feature-flag/env gates. Prod probes against https://paddock-tracker.com (public; only Vercel previews 401).

## Headline

**101 audited → 98 LIVE · 1 DARK-by-design · 2 superseded (KILL). Zero regressed, zero reverted-and-broken, zero never-happened.**

The release log is honest. Across ~10 days of very high cadence, everything announced shipped and stuck. The only "announced ≠ live" items are (a) one intentional dark flag that is documented and waiting on launch day, and (b) two same-day supersessions where a later patch replaced the announced behaviour — and the CHANGELOG already records both truthfully. The adversarial pass **could not refute** "essentially everything shipped and stuck"; its one correction (0.181.1) makes the tally *more* live, not less.

## Strike list — announced ≠ live (3)

| Version | Verdict | Evidence | Disposition |
|---|---|---|---|
| 0.171.0 | **DARK — by design** | `lib/site.ts:42` `LAUNCH_ANNOUNCEMENT active:false`; `components/LaunchBanner.tsx:20,33` returns null when inactive; `package.json` = 0.184.1 (1.0.0 not out); sole consumer | **KEEP dark.** v1.0 launch banner; flip `active:true` in the same commit that bumps to 1.0.0 (`docs/launch-checklist.md §B`). Not a forgotten flip — the release note honestly said "nothing visible yet." |
| 0.161.0 | **PARTIAL — superseded** | `CHANGELOG.md` 0.163.2 explicitly calls the 0.161.0 betting re-token "a near-no-op"; the real social/betting restyle (#389) shipped in **0.163.2** | **KILL.** The 0.161.0 note ("betting now matches the rest of the app") was oversold, but the end state is correct as of 0.163.2 (`app/(app)/social/page.tsx:85`, prod `/social` 200). Nothing to redo. |
| 0.152.1 | **REVERTED — intentional succession** | `CHANGELOG.md` 0.152.2 "re-enable… (reverts the 0.152.1 interim gate)"; `components/tabs/StandingsTab.tsx:698-736` renders the MotoGP trend chart now, no gate | **KILL.** 0.152.1 paused the MotoGP chart; **0.152.2 the same day** fixed the source under-count and un-paused it. Chart currently renders and reconciles. Correct evolution. |

**Overturned by the adversarial pass:** `0.181.1` was flagged PARTIAL by its batch agent (it cited a stale handoff note claiming the Race Engineer launcher was gated off). Prod `/calendar` + `/app` HTML both carry `aria-label="Open the Race Engineer help chat"` (only emitted past the `AssistantWidget.tsx:121` env gate) → **LIVE.** The widened layouts + larger helper button are both live.

## Operator-verify (2) — code complete, needs a signed-in human click

Both were LIVE on code evidence but sit behind auth, so not anonymously observable. Both are already on the handoff's owed-prod-passes list.

| Version | What to check |
|---|---|
| 0.184.0 | "Your devices" list — sign in on 2 devices, confirm both list, test-send to one, remove one. (`components/YourDevices.tsx`; `GET /api/push/devices` 401s anon; prod `/api/push/status` → `vapidConfigured:true, kvConfigured:true`.) |
| 0.160.0 | Blog draft in-place editor — as admin/writer, open a draft, edit, save. (`components/blog/DraftEditor.tsx`; `PATCH /api/blog/[id]:82-89` admin-or-writer authz.) |

## Feature-flag / env-gate ledger (reference — nothing hidden that was announced)

| Gate | Where | Default | Prod state |
|---|---|---|---|
| `NEXT_PUBLIC_ASSISTANT_ENABLED` | `AssistantWidget.tsx:121` (whole Race Engineer) | unset = dark | **ON** — launcher in prod HTML |
| `LAUNCH_ANNOUNCEMENT.active` | `lib/site.ts:42` + `LaunchBanner.tsx` | false | **false — dark by design** (pre-1.0) |
| `isBettingConfigured()` (`SUPABASE_URL`+`SUPABASE_SERVICE_ROLE_KEY`) | `lib/betting/client.ts:27`; gates betting UI + blog POST/PATCH | — | **TRUE** (social/play + blog drafts live) |
| `isPushConfigured()` (VAPID keys) | `lib/push.ts:96` | — | **TRUE** (`/api/push/status` vapidConfigured:true) |
| `isAssistantConfigured()` (`GOOGLE_GENERATIVE_AI_API_KEY`/`ASSISTANT_MODEL`) | `lib/assistant/model.ts:28`; gates `/api/assistant` answers | — | **UNKNOWN** — account-gated, not anon-probeable; launcher being ON implies set → OPERATOR-VERIFY a real answer |
| `NEXT_PUBLIC_ADSENSE_ENABLED` | proposed in `docs/audits/2026-06-27-audit.md` only | — | **not implemented** — AdSense loads unconditionally in layout; no code gate |
| Cron routes | `lib/cron-auth.ts` | fail-closed | **401 without `CRON_SECRET`** (verified) |
| Home opt-in widgets (movers, f1-upgrades, …) | per-user home registry, default-hidden | hidden | live but off-by-default **by design** (not dark) |

## Doc-hygiene drift found (harmless — no shipped feature is wrong)

Worth a cleanup commit; none of these are "announced ≠ live":

- **`docs/HANDOFF.md:352-356`** — stale: says the Race Engineer assistant "ships dark twice" and "confirm on prod: no launcher should appear." The flag is **ON** in prod; the launcher renders. The doc *under*-claims the live state. (IDEAS.md line 62 already records it as live — the handoff block is the stale one.)
- **CHANGELOG 0.157.0** — says warm-sessions cron is "30-min"; the workflow runs every 10 min (`*/10`).
- **CHANGELOG 0.156.0** — names 7 skeleton/loading segments; 6 exist (blog has none).
- **CHANGELOG 0.141.0** — body duplicates the `/news` prose that actually shipped as 0.146.0.
- **`lib/media.ts:7-9`** — comment says "weekend pages can reuse later"; already consumed at `weekend/[round]/page.tsx:115`.
- News nav label drift — now a top-level "News & community" trigger vs the CHANGELOG's "Community" wording.

## Bottom line

No re-dos required. The audit's actionable output is small: **1** dark flag to flip on launch day (already planned), **2** signed-in surfaces to eyeball (already owed), **1** stale handoff block + a handful of CHANGELOG typos to tidy. The "quietly reverted / regressed / dark-and-forgotten / never-happened" categories the operator was worried about came back **empty**.
