# Paddock Predictions — design doc

**Status:** draft for operator review · **Author:** Claude · **Date:** 2026-06-22
**Trigger:** operator idea 2026-06-21/22 ("Paddock credits + predict podium/top-10 + friend leagues + longshot multipliers + peer pools"). This is the long-parked **S9** initiative ("paddock-coins ledger + leaderboard", "predictions: open → locked → resolved") finally specced. **No code until this is approved.**

> **One-line:** a free-to-play motorsport **prediction** game inside Paddock — monthly credits, predict the podium / top-10 / exact finishing order, play solo-vs-house or in friend leagues, climb a leaderboard. Optional paid credits later, **with a hard no-cashout rule.**

---

## 1. The legal framing (read this first — it shapes every other decision)

What was described is, mechanically, betting (stakes, odds, pools that move value between users on an outcome). Whether this is a **prediction game** (broadly legal; allowed on Play/App Store like F1 Fantasy, ESPN pick'em, Superbru) or **regulated gambling** (per-territory licences, KYC/age, geo-gating, AML, app-store operator status) is decided by three levers: **purchase, chance, cashout.**

**The bright line we will not cross: no cashout. Ever.** Credits and winnings never convert to money, goods, crypto, or anything of real-world value, and there is no secondary/market transfer out. The moment a payout can become money, Paddock becomes a licensed sportsbook in every territory it operates — a different company, and it would sink the Android-store ambition.

Two phases against that line:

- **Phase 1 — free credits only.** 1000 credits granted monthly, non-purchasable, non-cashable. This is unambiguously a prediction game in almost all jurisdictions. Ship this first.
- **Phase 2 — optional paid credits (operator wants this later).** Buying credits via **in-app purchase** (Google Play Billing / Apple StoreKit) for **non-cashable** virtual currency is the standard free-to-play-with-IAP model (Candy Crush coins, etc.) — allowed, not gambling, **provided no cashout.** BUT see §9: paid credits inside the **peer-pool** mode is the genuinely risky combination and is treated separately.

**Vocabulary rule:** in product copy and code, these are **predictions / picks**, never "bets"; **credits / points**, never "money" or "stake winnings." This is not cosmetic — "betting" framing invites the regulatory read we're avoiding.

**Always-earnable rule (anti-pay-to-win-money):** a free player must always be able to earn enough credits to play fully. Paid credits buy *convenience / more entries / cosmetics*, never exclusive money-making power. This keeps it F2P, not a casino.

---

## 2. Game mechanics

- **Monthly grant:** 1000 credits on the 1st (or on signup, then monthly). Append-only ledger entry, not a mutable balance field (§6).
- **Prediction markets**, per race weekend / session:
  - **Podium (exact):** name P1, P2, P3 in order.
  - **Top-10 (set):** name the 10 finishers (order-independent), or order-sensitive variant.
  - **Exact positions:** call who finishes Pn for chosen positions in the top-10.
  - Start with **podium-exact** + **winner** (simplest, highest engagement); add the rest after.
- **Lifecycle:** a market opens when the weekend is published, **locks at session start** (server-side — never trust the client clock), **resolves** from official results after the race, **settles** credits, and **finalises** after a penalty window (§5, §7).
- **Stake:** the player commits N credits to a prediction. Payout = stake × multiplier on success, or stake lost on failure (to house or pool per mode, §4).

---

## 3. Pricing the longshots (and the "betting API" question)

Goal: Bottas-to-win must pay more than Antonelli-to-win, because it's less likely. **We do not need a betting-odds API** — and I recommend against one (The Odds API / Betfair / Pinnacle are paid, F1 *per-position* markets are thin, and importing live sportsbook odds muddies the "we are not a sportsbook" line and adds ToS risk). Two self-pricing options, both free:

- **Pari-mutuel (crowd-priced) — for leagues/peer mode.** The distribution of picks sets the odds: if 10 pick Hamilton and 1 picks Antonelli, the Antonelli backer wins the pool if Antonelli wins; few backers → big multiplier. **This is exactly the operator's 10-vs-1 example, and it needs no external data at all.** Longshots pay more automatically.
- **Model-priced — for solo-vs-house mode.** Derive a win/podium probability per driver from data Paddock already has (championship standings + recent form + qualifying position), then `multiplier ≈ 1 / probability` with a house margin. No API; uses `lib/standings/*` + `lib/results/*`.

**Recommendation:** pari-mutuel for peer/league pools, model for solo-vs-house. Revisit a paid odds feed only if a future "official odds" feature is ever wanted — not for this.

---

## 4. Modes

- **Solo vs house.** Player predicts; house pays model-priced multipliers from the player's own balance. Self-contained, no other players needed. Good default + onboarding.
- **Leagues (the social hook).** A user creates a league, invites friends (link/code), and the group plays **race by race**. A **leaderboard** ranks members by credits won / accuracy over the season ("championship").
- **Peer pool (the operator's redistribution idea).** Within a league market, everyone's staked credits form a pool; winners split the pool pari-mutuel. The 10-vs-1 example: Antonelli's lone backer takes the pool if Antonelli wins; if Hamilton wins, the Antonelli backer's stake is divided among the Hamilton backers. **Phase-1 constraint: peer pools use FREE credits only** (see §9 for why paid credits here are the high-risk case).

Edge cases to define: nobody predicts the winner (pool rolls over or refunds), all-pick-the-same (no pool movement / void), ties on the leaderboard (tiebreak by accuracy then earliest correct pick), a market with <2 participants (void / solo-vs-house fallback).

---

## 5. State machine

```
OPEN ──(session start, server time)──▶ LOCKED ──(results parsed)──▶ RESOLVED(provisional)
                                                                          │
                                              (penalty/appeal window, e.g. +72h or season-end)
                                                                          ▼
                                                                      SETTLED(final)
```

- **OPEN → LOCKED** fires off `Session.start_instant` (already in the data model). No edits/new entries after lock.
- **LOCKED → RESOLVED** consumes the existing results pipeline (`lib/results/*`, the just-missed/results-ready feed). Credits are paid **provisionally** so the leaderboard updates promptly.
- **RESOLVED → SETTLED** handles **late results changes** — the Gasly-Monaco reinstatement problem (already tracked in IDEAS: penalties overturned days later). Provisional payouts are reversible until the result is final; ties to `results-overrides.json` + the results re-check lifecycle. **This is the single most important correctness mechanism** — paying out on a result that later flips, with no claw-back, breaks trust and the economy.

---

## 6. Data model (Supabase — the new dependency)

This is the first Paddock surface that **cannot** live in the conversational-CMS / KV model — it's relational user-write data. It's the **Supabase trigger** the handoff anticipated (`docs/research/supabase-schema-draft-v2.md` recommended a lean additive shape exactly for this). Sketch:

| Table | Purpose | Key columns |
|---|---|---|
| `app_user` | mirror of Clerk identity | `clerk_user_id` (pk), `display_name`, `created_at` |
| `credit_ledger` | **append-only** source of truth for balance | `id`, `user_id`, `delta`, `reason` (grant/stake/payout/refund/reversal), `ref_id`, `created_at` |
| `market` | a predictable event | `id`, `series_slug`, `round`, `session_uid`, `type` (podium/winner/top10), `opens_at`, `locks_at`, `status`, `result_json`, `finalized_at` |
| `prediction` | one user's pick on a market | `id`, `market_id`, `user_id`, `league_id?`, `selection_json`, `stake`, `multiplier?`, `outcome` (pending/won/lost/void), `created_at` |
| `league` | a friend group / championship | `id`, `owner_id`, `name`, `join_code`, `mode` (solo/peer-pool), `created_at` |
| `league_member` | membership + standing cache | `league_id`, `user_id`, `joined_at`, `points_cache` |
| `settlement` | audit of a market's payout run | `id`, `market_id`, `provisional_at`, `final_at`, `payout_json` |

**Balance is `SUM(credit_ledger.delta)`** (optionally a cached column refreshed on write), never a directly-mutated number — this gives a full audit trail, makes reversals (§5) clean, and is essential the moment real money buys credits (§9).

---

## 7. Settlement engine

- A **Vercel cron** sweeps markets whose `locks_at` (lock) or session-end has passed; mirrors the existing `results-ready` cron pattern.
- On results available: compute outcomes, write `payout` ledger entries (provisional), update `league_member.points_cache`.
- On a later `results-overrides` change for that round: **reverse** the provisional payouts (compensating ledger entries) and re-run settlement → `SETTLED`.
- Pari-mutuel math is a pure function over the set of `prediction` rows for a market — unit-testable in isolation (like the existing parsers).

---

## 8. Economy design

- **Inflation:** 1000/mo + winnings will balloon balances. Needs **sinks** (entry costs, premium leagues, cosmetics) and/or **monthly or per-season leaderboard resets** (carry status/badges, reset spendable credits). Decide: persistent bankroll vs seasonal reset. *Recommendation: seasonal reset for competitive integrity + a separate all-time "trophies" record.*
- **Free vs paid credits must be tracked separately in the ledger** (`reason`/`source`) so Phase 2 can keep paid credits out of contexts where they'd create legal/fairness problems (§9).

---

## 9. Phase 2 — paid credits (operator wants this; here's the careful version)

Buying credits is fine **as in-app purchase of non-cashable currency** — *with constraints*:

- **Mechanism:** Google Play Billing / Apple StoreKit only (their 15–30% cut; you cannot bypass for digital goods). Server-verified receipts → `credit_ledger` grant with `reason=purchase`.
- **The bright line still holds: no cashout.** Paid credits are spendable in-game only. This keeps it IAP, not gambling.
- **Solo-vs-house with paid credits = low risk** (standard F2P IAP; you buy coins, play vs the house, can't cash out).
- **Peer pools with PAID credits = the high-risk case, treat separately.** Paying real money for credits that then transfer to *other players* on a chance outcome is the most gambling-like reading even without cashout, and several jurisdictions (and the loot-box/social-casino regulatory trend) may treat it as such. **Options, pick per legal advice:**
  1. Peer pools stay **free-credits-only** forever (cleanest; paid credits only ever used solo-vs-house or for cosmetics/entries).
  2. Peer pools with paid credits **geo-gated** to territories where counsel confirms it's permissible, behind an 18+ gate.
  3. Peer "pools" become a **non-transfer scoring contest** (everyone scores points vs a model; no stake moves between users) — removes the money-transfer-on-chance element entirely.
- **Age-gating:** paid + chance → almost certainly 18+ (or per-territory), with the attendant store declarations.
- **Hard gate:** **do not enable Phase 2 without jurisdiction-specific legal review.** Phase 1 (free) ships and proves the game; Phase 2 is a business/legal decision, not just an engineering one. Document the territories you'll allow before flipping it on.

---

## 10. Anti-abuse

- **Server-side lock** at session start (authoritative clock); reject/ignore any prediction write after lock.
- **Multi-account / collusion:** especially relevant for peer pools and leaderboards (sock-puppets feeding a pool to one account). Mitigations: Clerk identity, rate limits, per-league member caps, anomaly flags on suspicious pool patterns; harder if paid credits ever enter pools (another reason for §9 option 1/3).
- **Result-flip exploitation:** the provisional→final window (§5) must be authoritative; no withdrawals/leaderboard-finalisation until SETTLED.

---

## 11. What Paddock already has vs what's new

- ✅ **Have:** Clerk auth (accounts + the `publicMetadata` role pattern), the results pipeline (`lib/results/*`, results-ready), session start/end instants, `results-overrides.json` for late corrections, the just-missed feed.
- 🆕 **New:** Supabase (provisioning + schema), the credit ledger + settlement engine + crons, leagues/leaderboards, the prediction UI, and (Phase 2) IAP + receipt verification + territory/age gating.

---

## 12. Phasing & rough effort

| Phase | Scope | Effort |
|---|---|---|
| **0 — this doc + operator decisions** (§14) | framing, territories, Supabase go | done on approval |
| **1a — foundation** | Supabase provision, schema, credit ledger, monthly grant, Clerk↔user mirror | ~1 wk |
| **1b — solo predictions** | winner/podium markets, lock cron, model pricing, settlement (provisional→final), basic UI | ~1–2 wk |
| **1c — leagues + leaderboard + peer pools** | invites, pari-mutuel, standings | ~1–2 wk |
| **2 — paid credits** | IAP, receipt verify, age/geo gating | gated on **legal review**; ~1 wk eng |

Multi-week, and it should **not block the v1.0 launch** (handoff rule). It runs as its own track after the launch gates.

---

## 13. Risks / open questions

1. **Late results** (§5) — the make-or-break correctness mechanism.
2. **Economy balance** (§8) — persistent vs seasonal reset.
3. **Paid-credits-in-peer-pools** (§9) — the legal crux of the operator's "pay later" ask; needs counsel.
4. **Territory strategy** — which countries for Phase 1 (free is broad) and Phase 2 (narrow, legal-reviewed).
5. **Supabase vs alternatives** — the v2 memo favoured a lean additive Supabase shape; confirm before provisioning.

---

## 14. Decisions needed from operator

1. **Confirm Phase-1 framing:** free, non-cashable, "predictions" not "betting." (Assumed yes.)
2. **Confirm the no-cashout bright line is permanent** — even in Phase 2. (Required for the whole thing to stay non-gambling.)
3. **Phase-2 peer-pool stance:** which of §9 options 1/2/3 (free-only pools / geo-gated paid / non-transfer scoring).
4. **Economy:** seasonal reset vs persistent bankroll.
5. **Green-light Supabase provisioning** to start Phase 1a.
6. **Legal review** booked before any Phase-2 paid work.
