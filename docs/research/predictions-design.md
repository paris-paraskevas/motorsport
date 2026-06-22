# Paddock Betting — design doc

**Status:** decisions locked by operator 2026-06-22 (two confirmations still open, §14) · **Author:** Claude · **Date:** 2026-06-22
**Trigger:** operator idea 2026-06-21/22 — Paddock credits, bet on podium / top-10 / exact positions, friend leagues, longshot multipliers, peer pools. This is the long-parked **S9** initiative finally specced. **No code until §14 is closed + legal review (for paid) is booked.**

> **One-line:** a virtual-credit **betting** game inside Paddock — monthly credits (optionally toppable with real money, **never cashable**), stake on race outcomes for multiplied returns, play solo-vs-house or in friend leagues, ranked by **win-rate**.

---

## 0. Risk acknowledgement (operator has chosen this knowingly)

The operator's decisions (call it "betting", paid credits, multiplied returns, a deliberately-lean bankroll) place this in the **"simulated / social-casino" app category**, not the safe "free fantasy/prediction" category. Consequences, accepted:

- **No cashout, ever — this is the one anchor** that keeps it out of *licensed real-money gambling*. Credits/winnings never convert to money, goods, or anything of value, and never transfer off-platform. If this ever breaks, Paddock becomes a licensed sportsbook (per-territory licences, KYC/AML) — a different company.
- **App stores treat it as simulated gambling:** 17+/18+ rating, mandatory "no real money gambling" disclosure, and **geo-restrictions** — several countries must be excluded. Apple/Google can still reject; expect review friction.
- **Paid credits + lean bankroll = monetisation pressure** that regulators scrutinise as gambling-adjacent. Legitimate, common (social casinos), but it raises the compliance bar and **requires legal review before the paid path goes live** (§9, §14).

---

## 1. Mechanics

- **Monthly grant:** a fixed credit allowance on a cycle (the 1st, or rolling from signup). Tuned **deliberately lean** — enough to stay engaged, not enough to feel rich (§8). Append-only ledger entry (§6).
- **Bet types**, per race weekend / session:
  - **Winner** and **Podium (exact P1/P2/P3)** — launch set (highest engagement, and the only markets a real odds API can price, §3).
  - **Top-10 (set)** and **exact positions** (call who finishes Pn) — follow-on; priced by model/pari-mutuel, not the API.
- **Stake → multiplied return:** the player stakes N credits; a winning bet returns `N × multiplier`, a losing bet forfeits the stake (to the house or the pool, §4). This multiplied-return mechanic is what makes it "betting" rather than a pick'em.
- **Lifecycle:** opens when the weekend publishes → **locks at session start** (server-side clock, never the client's) → **settles once** on the official final classification (§5).

---

## 2. Pricing the longshots — hybrid (operator wants a real odds API)

Bottas-to-win must pay more than Antonelli-to-win. Three priced surfaces, used where each actually works:

- **Real betting-odds API — solo-vs-house, winner/podium only.** Operator's choice. Candidates: **The Odds API** (`the-odds-api.com` — has F1 outright winner), **Betfair Exchange API** (richest F1 markets, but account/ToS gated). Multiplier = decimal odds (with a house margin). **Hard limit: books do NOT price exact positions** ("who finishes P7" doesn't exist as a market) — so the API can only cover winner + podium. Cost: paid tiers; **ToS of most odds APIs restrict use in betting-like products** — verify per provider before adopting.
- **Pari-mutuel — leagues / peer pools.** The crowd prices it: the operator's 10-vs-1 example *is* pari-mutuel and needs no API — few backers on Bottas ⇒ big payout if he wins. Better than API odds for a friend group (reflects *this* group).
- **Model — exact-position markets + any market the API can't cover.** Win/podium/position probability from standings + recent form + qualifying (Paddock already has this data), `multiplier ≈ 1/probability` + margin.

**Net:** wire the odds API for winner/podium (solo-vs-house); model for exact positions; pari-mutuel for league pools.

---

## 3. Modes

- **Solo vs house.** Stake from your balance against API/model odds. Self-contained; onboarding default.
- **Leagues.** Create a league, invite friends (code/link), play **race by race**, ranked on a **leaderboard** (§4).
- **Peer pool (operator's redistribution).** Within a league market, stakes form a pool; winners split it pari-mutuel (the 10-vs-1 example). **Paid credits in peer pools is the open legal question — §9 / §14.**

Edge cases to define: nobody hits the winner (roll over / refund), everyone picks the same (void / no movement), <2 participants (void → solo fallback), leaderboard ties (§4 tiebreak).

---

## 4. Leaderboard — by win-rate, not bankroll (operator decision)

Ranking is **accuracy, not credit balance** — so a whale can't buy the top spot. Operator's spec: **win-rate (% of bets won) with head-to-head**, e.g. *1/2 (50%) beats 3/15 (20%)*.

- Primary metric: **wins ÷ bets placed.** Head-to-head record within a league also tracked ("I picked HAM, you picked ANT, ANT won → you 1, me 0").
- **Refinement to stop trivial gaming** (1 safe bet at 100% topping the board): require a **minimum N bets to qualify**, and/or weight wins by **difficulty** (a longshot win counts more than a favourite) — this also ties the leaderboard to the multiplier system. *Recommend: min-N qualification + multiplier-weighted win score.* Operator to confirm weighting.
- Credit balance is a secondary/cosmetic stat, not the rank.

---

## 5. Settlement — "provisional is final" (operator decision, with the safe definition)

Operator wants **settle once, no claw-back.** Done safely, that means:

```
OPEN ──(session start, server time)──▶ LOCKED ──(OFFICIAL final classification)──▶ SETTLED (final, no reversal)
```

- Settlement fires on the **official final classification** — the post-stewards result our sources show a few **hours** after the flag — **not** the live / first-parsed result. Penalties (DSQ, time penalties) are common and land in that official classification; settling before it would pay out **false wins and corrupt the win-rate leaderboard** (§4). So the engine waits for the result to stabilise, then settles **once and permanently**.
- The rare **week-later appeal reversal** (e.g. Gasly-Monaco reinstatement) is **accepted as standing** — no claw-back. This is the simplification the operator chose; it's fine because such reversals are rare and the alternative (reopening settled pools/leaderboards days later) is worse UX.
- **CONFIRMED (operator 2026-06-22):** final = official classification (hours post-race, post-stewards), **not** the live/first-parsed result.

---

## 6. Data model (Supabase — greenlit, §14)

First Paddock surface that can't live in the file-CMS/KV model — relational user-write data (the **Supabase/S9 trigger**; the lean additive shape from `supabase-schema-draft-v2.md`). Sketch:

| Table | Purpose | Key columns |
|---|---|---|
| `app_user` | mirror of Clerk identity | `clerk_user_id` (pk), `display_name`, `created_at`, `dob`/`age_ok` (gating, §0) |
| `credit_ledger` | **append-only** balance source of truth | `id`, `user_id`, `delta`, `reason` (grant/purchase/stake/payout/refund), `source` (free/paid), `ref_id`, `created_at` |
| `market` | a bettable event | `id`, `series_slug`, `round`, `session_uid`, `type`, `opens_at`, `locks_at`, `status`, `result_json`, `settled_at` |
| `bet` | one user's stake on a market | `id`, `market_id`, `user_id`, `league_id?`, `selection_json`, `stake`, `source` (free/paid), `multiplier?`, `outcome`, `created_at` |
| `league` | friend group / championship | `id`, `owner_id`, `name`, `join_code`, `mode`, `created_at` |
| `league_member` | membership + standing cache | `league_id`, `user_id`, `joined_at`, `wins`, `placed`, `winrate_cache` |
| `settlement` | audit of a market's payout run | `id`, `market_id`, `settled_at`, `payout_json` |

**Balance = `SUM(credit_ledger.delta)`** (append-only) — full audit trail, essential once real money buys credits. **`source` (free vs paid)** is tracked per ledger row + per bet so paid credits can be kept out of contexts that create legal/fairness problems (§9).

---

## 7. Settlement engine

- Vercel **cron** sweeps markets past lock/session-end (mirrors the `results-ready` pattern), waits for the **official classification**, computes outcomes, writes payout ledger rows, updates `league_member` win-rate caches. One pass, permanent (§5).
- Pari-mutuel / odds math is a pure function over a market's `bet` rows — unit-testable like the parsers.

---

## 8. Economy — persistent + deliberately lean (operator decision)

- **Persistent bankroll** (no seasonal reset of credits). The monthly grant is tuned to **keep players engaged but a little short** — "not rich, not poor; if it leans, lean poor." This is the deliberate retention/monetisation lever (and, paired with paid credits, the social-casino pattern flagged in §0).
- **Sinks** matter more with a persistent bankroll (entry costs, premium leagues, cosmetics) to stop runaway balances on lucky streaks.
- **Leaderboard is win-rate (§4), so bankroll size doesn't confer rank** — this is what keeps "lean bankroll + paid credits" from being pay-to-win-*status* (you can buy more *plays*, not a higher rank).

---

## 9. Paid credits (operator wants this; legal-gated)

- **Mechanism:** Google Play Billing / Apple StoreKit only (their cut; cannot bypass for digital goods). Server-verified receipts → `credit_ledger` grant `reason=purchase, source=paid`.
- **No cashout (§0).** Paid credits are spendable in-game only.
- **Solo-vs-house with paid credits:** low risk (standard simulated-gambling IAP).
- **Paid credits in PEER POOLS — DECIDED: option (b)** (operator 2026-06-22): paid peer pools are **geo-gated + 18+** with per-territory legal sign-off. This is the highest-compliance path of the three (alternatives were free-credits-only pools, or non-transfer scoring) — it explicitly hard-gates on the legal review (§14.6) and a confirmed territory allow-list before any paid peer pool goes live.
- **Age + territory gating** required; **legal review before the paid path ships** (operator agreed, §14.6).

---

## 10. Anti-abuse

- **Server-side lock** at session start; reject any bet write after lock.
- **Multi-account / collusion** (sock-puppets feeding a pool/leaderboard) — Clerk identity, rate limits, per-league caps, anomaly flags; sharper risk once paid credits enter pools (another reason for §9 option 1/3).
- **Win-rate gaming** — the min-N + difficulty-weighting in §4.

---

## 11. Paddock has vs new

- ✅ Clerk auth + roles, results pipeline (`lib/results/*`, results-ready), session start/end instants, the just-missed feed.
- 🆕 Supabase (provision + schema), credit ledger + settlement engine + crons, the odds-API integration, leagues/leaderboards, the betting UI, and (paid) IAP + receipt verification + age/geo gating.

---

## 12. Phasing & effort

| Phase | Scope | Effort |
|---|---|---|
| **0 — this doc + §14 closed** | decisions + legal booking | on approval |
| **1a — foundation** | Supabase, schema, ledger, monthly grant, Clerk↔user, age gate | ~1 wk |
| **1b — solo betting** | winner/podium markets, odds-API integration, lock cron, settlement, UI | ~1.5–2 wk |
| **1c — leagues + win-rate leaderboard + peer pools** | invites, pari-mutuel, standings | ~1.5–2 wk |
| **1d — paid credits** | IAP, receipt verify, geo/age gating | gated on **legal review**; ~1 wk |

Multi-week; **does not block v1.0 launch** (own track after the launch gates).

---

## 13. Risks / open questions

1. **Settlement timing** (§5) — confirm "final = official classification, not live result."
2. **Odds-API ToS + cost + exact-position gap** (§2) — verify the chosen provider permits this use.
3. **Paid-credits-in-peer-pools** (§9) — the legal crux; pick option 1/2/3.
4. **Territory strategy** — which countries are in (paid + simulated-gambling rules vary widely).
5. **Win-rate gaming** (§4) — confirm min-N + difficulty weighting.

---

## 14. Operator decisions

| # | Decision | Status |
|---|---|---|
| 1 | Free credits **+ optional paid** (IAP); framed as **betting** (multiplied returns) | ✅ locked |
| 2 | **No cashout** — permanent, the anchor | ✅ locked |
| 3 | Leaderboard by **win-rate / head-to-head**, not bankroll | ✅ locked (confirm difficulty-weighting, §4) |
| 4 | **Persistent** bankroll, monthly grant tuned **lean** | ✅ locked |
| 5 | **Green-light Supabase** (Phase 1a) | ✅ locked |
| 6 | **Legal review** before paid path | ✅ agreed |
| 7 | **"Provisional is final" = official classification** (not live result) | ✅ locked |
| 8 | **Paid-in-peer-pools** = **option (b)**: geo-gated + 18+, per-territory legal sign-off | ✅ locked |
