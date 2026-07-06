# Per-weekend F1 upgrades — data-source hunt

**Status:** source found + verified. Author: session 2026-07-06. Task (operator `/feedback` "Show Upgrades brought to each GP Weekend" + "find the data source"): where do we get "what upgrades each team brought to each GP"?

## Verdict

**Primary source = the FIA "Car Presentation Submissions" document, one per Grand Prix.** Official, structured, free, and — verified this session — downloadable + machine-parseable.

## Candidates evaluated (with probes)

| Source | Verdict | Evidence |
|---|---|---|
| **FIA Car Presentation Submissions** (official) | ✅ **USE** | Portal `fia.com/documents/.../season-2026-2072` → 200, server-rendered, robots-permissive, lists the doc per GP. PDF at a clean pattern `fia.com/system/files/decision-document/2026_<gp>_-_car_presentation_submissions.pdf`. Downloaded the British-GP one: **200, 3.4 MB, application/pdf**; `pdftotext -layout` → clean per-team tables. |
| **F1.com per-race upgrade article** | ✅ secondary / cross-ref | `/en/latest/article/what-upgrades-...` is robots-**allowed** (only `/tags/*` disallowed), 200, Next SSR with `__NEXT_DATA__`. BUT mostly **prose** (weak table structure) — F1's editorial rendering of the FIA doc. Good human-readable link-out, poor parse target. Copyrighted editorial. |
| **PaddockIntel upgrade tracker** | ❌ skip | `/races` returns a **2.5 KB JS shell** (no data in server HTML → client-rendered SPA); also a **proprietary commercial tracker** (scraping their curated product is not OK). |
| **RapidAPI "F1 Technical Upgrades"** | ❌ dead — **corrects the IDEAS note** | No dedicated technical-upgrades endpoint exists on RapidAPI (API-Sports/Hyprace/etc. cover results/standings/schedules only; "chassis"/"technical_manager" are static team attributes, not per-race parts). The "SebastianL Formula 1 Technical Upgrades" candidate could not be found — treat as gone. |

## The FIA doc — shape (verified)

Document 13, published ~Thu/Fri of each GP (British GP one: dated 03 July 2026 09:54). Per team, a numbered table:

```
Updated       Primary reason        Geometric differences vs      Brief description on how the
component     for update            previous version              update works (20–100 words)
1 Front Corner  Performance -        New Front Brake Duct          A new front brake duct design is
                Flow Conditioning                                  introduced ... gain in aero load.
2 Floor Furniture Performance -      Revised Floor Board ...       The floor board and various ...
                Flow Conditioning
```

This is exactly the feature's data: per team, per component, with the reason class (Performance / Geometric / Circuit-specific) + a plain-English description.

## Recommendation: curation-first, automate later

1. **MVP — curation** (fits "conversational authoring is the CMS"): per GP, fetch the FIA PDF → `pdftotext -layout` → curate a sidecar **`content/series/f1/upgrades.json`** keyed by round → per-team component rows. Render a **"Upgrades" section on the F1 weekend page** (F1-only; the doc is an F1 thing). Attribution: "Source: FIA Car Presentation Submissions". This avoids the datacenter-scrape fragility + PDF-parser maintenance for v1, and uses the canonical source. It's a light per-GP curation task (like results/blog curation).
2. **Phase 2 — automate** (only if the cadence gets burdensome): `lib/upgrades/f1.ts` = scrape the season portal listing → resolve the Car-Presentation PDF link → download → parse → KV-cache + a per-GP warm cron. **Gate on a Vercel-preview datacenter-IP probe first** — my 200 was from here; `fia.com` may WAF/block datacenter IPs (the 0.12.12 NASCAR prod-regression lesson). PDF layout also varies GP-to-GP, so the parser needs to be defensive.

## Open decisions (operator)

1. **Curation vs live parser** for v1 (recommend curation).
2. **Render placement** — a section on the existing `/series/f1/weekend/[round]` page, or a new "Upgrades" tab? (Recommend a collapsible section on the weekend page.)
3. **Backfill depth** — just the latest GP, or backfill R1–R9? (Curation makes this a time question.)
4. **Scope** — F1-only for the foreseeable future (only F1 publishes this doc).

## Effort

- Curation MVP: schema + a weekend-page section + curate 1–2 GPs to prove it ≈ half a day (needs the dev browser back up for the render verify).
- Phase-2 parser + cron: multi-session; datacenter-probe-gated.
