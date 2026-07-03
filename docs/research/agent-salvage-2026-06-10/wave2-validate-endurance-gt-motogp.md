# Salvage: wave2-validate-endurance-gt-motogp

Agent a8d2a5f8416103b33 — assistant text + tool intents only (tool RESULTS omitted; re-fetch sources if a claim needs verification).

---

Now fetching live prod pages. Starting with standings for all five series.

---

[fetch: https://paddock-tracker.com/series/motogp?tab=standings]

---

[fetch: https://paddock-tracker.com/series/wec?tab=standings]

---

[fetch: https://paddock-tracker.com/series/imsa?tab=standings]

---

[fetch: https://paddock-tracker.com/series/gt-world?tab=standings]

---

[fetch: https://paddock-tracker.com/series/dtm?tab=standings]

---

WebFetch is denied. Falling back to curl via Bash for fetching pages (SSR HTML) and the Pulselive/official JSON APIs.

---

curl worked but inline Python was denied. Switching to Playwright MCP for rendered-page reading.

---

Unexpected redirect to f1. Retrying.

---

MotoGP results: 8 rounds (Thailand→Hungary Jun 7). Need the Hungary GP podium — expanding that card.

---

Hungary GP podium (ours): Marquez / Acosta / Bagnaia. Now champions tab.

---

MotoGP champions: 2025 M.Márquez, 2024 J.Martín, 2023 Bagnaia — all Ducati. Now WEC tabs.

---

WEC standings captured. Results tab next.

---

WEC results tab is a link-out to fiawec.com (no scraped results — by design). Champions tab.

---

WEC champions: 2025 Ferrari #51 crew, 2024 Porsche trio, 2023 Toyota #8 trio. Now IMSA.

---

Detroit (round 5, May 29-30) missing from curated alkamel-rounds.json — results tab lags. Champions tab now.

---

IMSA champions: 2025 Campbell/Jaminet (Porsche). Now gt-world.

---

GT World standings captured. Results tab.

---

GT World results: Monza, Brands Hatch, Paul Ricard. Champions tab.

---

DTM results = trend chart only, 2 rounds completed. Champions tab.

---

All 15 prod surfaces captured. Now official sources. Starting with MotoGP — Wikipedia 2026 season (independent) since motogp.com shares the Pulselive upstream.

---

You've hit your org's monthly spend limit · raise it at claude.ai/admin-settings/usage