# Track-layout home widget — scope & source decision

**Scoped:** 2026-06-26 · **Status:** Decided — Approach A (F1-first, f1db static SVGs), v1 outline-first. Build unblocked (#267 merged → main 0.106.0). · **Decision by:** operator, via scoping session.

The "Upcoming track layout" gallery card (`AVAILABLE_WIDGETS` — the last remaining "coming soon" after the per-series widgets graduated in 0.106.0) promised _"the circuit map for the next round, with corner and DRS detail."_ This records the asset-source research and the build decision.

## Promise vs. reality

- **Circuit map (outline)** — broadly available under permissive licenses.
- **Corner detail** — available (track-atlas corner names+coords; baked into many Wikimedia SVGs).
- **DRS detail** — **not in any dataset.** DRS is an F1-only concept published in FIA event documents → manual curation, and it's meaningless for the other 14 series. → **The card is reframed to "the circuit map for the next round"; DRS becomes an F1-only extra (Phase 1b).**

## Sources evaluated (all verified 2026-06-26)

| Source | License | Coverage | Corners | DRS | Form |
|---|---|---|---|---|---|
| **f1db** | **CC BY 4.0** | F1 (all layouts) | ✗ | ✗ | SVG ×4 styles — drop-in |
| **bacinger/f1-circuits** | **MIT** | 43 F1 circuits | ✗ | ✗ | GeoJSON outline |
| **tobi/track-atlas** | ODbL (OSM) + sim attr | multi-series, growing | ✅ names+coords+sectors | ✗ | GeoJSON + SVG posters |
| **Wikimedia Commons** | mostly CC BY-SA | broad, per-circuit | some (baked in) | ✗ | per-file SVG |
| **Map tile** (lat/lon→static) | OSM/Mapbox terms | every circuit | ✗ | ✗ | photo-map, not a schematic |

Links: [f1db](https://github.com/f1db/f1db) · [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) · [tobi/track-atlas](https://github.com/tobi/track-atlas) · [Wikimedia circuit maps](https://commons.wikimedia.org/wiki/Category:Racetrack_maps).

## Decision — Approach A: F1-first, static f1db SVGs

- v1 uses f1db circuit SVGs (CC BY 4.0, `white-outline` for the dark UI) for the 2026 F1 calendar.
- Why: cleanest license (attribution-only, no ShareAlike), real schematics, no renderer to build, flagship series.
- Matches the project's F1-first-then-expand pattern (betting markets, standings widgets).
- **Rejected for v1:** programmatic GeoJSON render (more build — revisit for multi-series in Phase 2); map-tile (not a schematic); Wikimedia per-circuit (ShareAlike + long-tail curation).

## Data model

- **round → circuit:** existing alias match against `content/circuits.json` (38 circuits: name/lat/lon/aliases) — the same mechanism the weather lookup uses. No new linkage.
- **circuit → layout:** new `content/circuits-layout.json` — per slug `{ svg, source: 'f1db', license: 'CC BY 4.0', sourceUrl }`, rendered as a visible credit (the `content/landing/circuits.json` attribution pattern).
- **assets:** `public/circuits/<slug>.svg`.
- **corner/DRS overlay (Phase 1b):** a curated F1 sidecar (corner numbers + DRS zones from FIA event docs).

## Build plan

1. ✅ #267 merged → main 0.106.0; the build branches from main (track-layout touches `homeLayout.ts` / `HomeContent.tsx` / `HomeCustomizeBanner.tsx`, the same files as #266/#267).
2. Download f1db `white-outline` SVGs for the 2026 F1 circuits → `public/circuits/<slug>.svg`; map f1db ids → our `circuits.json` slugs (one light curation step).
3. `content/circuits-layout.json` with attribution; reuse the landing-credit rendering.
4. Graduate `track-layout`: add to `HOME_ELEMENTS` + `DEFAULT_HIDDEN`, remove from `AVAILABLE_WIDGETS` (gallery now empty → collapse "More widgets" to a one-line "more coming"). Render the next round's circuit map (alias match) + name/location + credit; static asset, no fetch; density setting; non-F1 next round → graceful "map coming for this series."
5. Reframe the gallery card → "the circuit map for the next round."
6. Browser-verify + release notes (0.107.0) + PR.

**Phase 1b:** curated F1 corner-number + DRS overlay. **Phase 2:** multi-series outlines via track-atlas (ODbL) / Wikimedia fallback (no DRS).

## Effort

Asset curation (~24 circuits: map ids → slugs, download, attribute) is the bulk; the widget shell is the now-proven opt-in pattern. ~1 focused session for v1 (outline-first).
