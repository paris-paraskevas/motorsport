# "Ask Paddock anything" — AI assistant design doc

**Status:** proposal (design-before-code). Author: overnight session 2026-07-06. Source: operator `/feedback` "Agent AI" — *"an agent who knows everything; a user can ask about motorsport or about the website and get help instantly."*

## Goal

An in-app assistant that answers two kinds of questions instantly:
1. **Site help** — "how do I add a home widget?", "where are the standings?", "what's the betting game?"
2. **Motorsport Q&A grounded in Paddock's own data** — "how's Norris doing this season?", "when's the next MotoGP race?", "who won in Austria?"

## The one risk that dominates the design

Paddock's whole credibility rests on a hard invariant (CHANGELOG, top): **the data must be correct — the season-trend chart total must match the standings tab, every series.** An assistant that *confidently states a wrong race fact* erodes that trust faster than any feature builds it. So the non-negotiable design rule:

> **The assistant answers ONLY from retrieved Paddock content / live data, links to the authoritative page, and says "I don't have that" rather than guessing. No open-domain motorsport trivia from model memory.**

This is retrieval-grounded (RAG), not a free-form chatbot. It turns "an agent who knows everything" into "an agent that can find and explain everything *we* publish" — which is the honest, defensible version.

## Architecture

```
user question
  → retrieve: (a) static index over our content + (b) live data loaders as needed
  → LLM answers STRICTLY from retrieved context (Vercel AI Gateway → latest Claude)
  → response cites + deep-links the real page(s); refuses when uncovered
```

- **Retrieval index (a):** a prebuilt static index over everything that is a page — drivers, teams, rounds/weekends, series + tabs, blog posts, about/history/rules, legal, changelog. **This is the same index the "global search" IDEA needs** — build once, share. Ship it in the bundle for instant client-side fuzzy match / or a light edge route. Keeps the assistant's grounding cheap + current-at-build.
- **Live data (b):** for "current standings / next race / latest result", call the existing loaders (`lib/standings/*`, `lib/results/*`, `lib/season-trend`, weekend/session helpers, OpenF1) — the same reconciled sources the pages use, so the assistant can't disagree with the site. Stamp answers "as of <round/date>" since data is ISR-cached.
- **LLM:** Vercel **AI Gateway** with a plain `provider/model` string (per the platform default), latest Claude tier. Server API route (`app/(app)/api/assistant/`), streamed. System prompt hard-scopes to retrieved context + refusal behavior + link-out.
- **Surface:** a chat panel — reuse an existing modal/route pattern; entry from the header (near Search) or a floating affordance. Pairs with ⌘K search (search finds a page; assistant explains / answers across pages).

## Two modes, phased by risk

- **Phase 1 — Site-help assistant (low risk, build first):** grounded in a curated help/FAQ corpus + the about/changelog/settings copy. It explains features and deep-links ("Customise → add the Standings-movers widget"). No live race-data surface → almost no hallucination exposure. High utility, safe MVP.
- **Phase 2 — Grounded motorsport Q&A:** add retrieval over series data + live loaders. Higher value, higher risk — gated on Phase 1 proving the grounding + refusal behavior holds.

## Decisions (RESOLVED 2026-07-06) + status

**MVP BUILT 2026-07-06 — ships DARK until the API key lands (0.172.0).** Site-help assistant: account-gated `/assistant` + `/api/assistant` + `lib/assistant/*` grounded in `content/assistant/site-help.md`, model behind a swappable seam (`lib/assistant/model.ts`).

1. **Scope for v1** — ✅ site-help MVP first (curated-corpus grounding; Phase-2 grounded Q&A later).
2. **Free vs account-gated vs paid** — ✅ account-gated (free with a Paddock account), Gemini Flash free tier. Escalation if capacity bites: gate to donors — but that needs a donor-identity flag first (Buy-me-a-coffee is external; deferred per operator).
3. **Provider/model + budget** — ✅ Gemini Flash (free), called direct to stay on the free tier, behind a one-file swap seam; env-configurable model id (`ASSISTANT_MODEL`). Cost control = per-user daily cap (20/day) + global per-minute guard (12/min, under the ~15 RPM ceiling), both **fail-closed**.
4. **"Answer only" vs "can act"** — ✅ answer-only, single-turn for v1.
5. **Guardrail acceptance** — ✅ retrieve-or-refuse; NEVER state live data (results/standings/points/times/odds) from memory — point to the page. Locked in `lib/assistant/prompt.ts` + unit-tested.

**Open before go-live:** operator sets `GOOGLE_GENERATIVE_AI_API_KEY` (+ confirm the current free Flash id in `ASSISTANT_MODEL`) in Vercel; confirm Gemini free-tier data terms + add a privacy-policy line (assistant queries are sent to Google); then verify a real answer on prod. Tracked in `docs/launch-checklist.md`.

## Won't-do / non-goals (v1)

- No open-domain trivia from model memory (the hallucination trap).
- No writing to user data / placing bets / changing settings on the user's behalf (answer-only).
- Not a replacement for search — complementary.

## Pre-mortem (most likely failure)

The assistant answers a "who won / how many points" question from **model memory** instead of our data, gets it subtly wrong, and a user screenshots Paddock stating a false result — directly contradicting the standings page two clicks away. Mitigation: Phase-1 site-help-only first; for any data question, retrieve-or-refuse and render the live number *with* a link to the page it came from; evals on a fixed Q set before Phase 2 ships.

## Overlap / sequencing

- **Global search static index** — shared dependency; build the index once and both features use it. Consider doing the index first (it unblocks both).
- **Feeder-series intake** (`2026-07-06-feeder-series-intake.md`) — unrelated feature but same "new AI/data surface" wave; don't build both cold at once.

## Effort estimate

- Phase 1 (site-help MVP): ~1–2 days after the decisions land — API route + AI Gateway wiring + a curated help corpus + a chat panel + rate-limit. No new DB.
- Shared search index: ~1–2 days (also delivers global search).
- Phase 2 (grounded Q&A): multi-session; its own eval harness.
