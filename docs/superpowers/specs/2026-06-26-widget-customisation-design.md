# In-depth home-widget customisation — design

**Date:** 2026-06-26 · **Status:** approved, implementing.

Extends per-widget customisation on the home (`/app`) beyond order / show-hide / fold
(collapse) to **content settings + a density toggle**, for every widget. Builds on the
`HomeLayoutPrefs.config` field introduced for the standings-snapshot series picker (0.104.0).

## Scope (operator-chosen)

- **Content** per widget — what each shows.
- **Presentation** = a per-widget **density** toggle only (comfortable / compact). No
  card/list, columns, or per-widget accent this pass.

## Per-widget settings

| Widget | Content setting | Density |
|---|---|---|
| chyron | — (a single live/next strip) | ✓ |
| just-missed | `count` 1–5 (default 3) | ✓ |
| schedule (this week) | `days` 3 / 7 (default 7) | ✓ |
| news | `count` 5 / 10 / 20 (default 10) | ✓ |
| from-the-blog | `count` 2 / 4 / 6 (default 4) | ✓ |
| championship-leader | `seriesSet` — all followed (default) or a chosen subset | ✓ |
| standings-snapshot | `series` (existing) + `rows` 3 / 5 / 10 (default 5) | ✓ |

`days` is capped at 7: the `/app` page only ships this-week + the first-beyond-week session
per series, so a 14-day window would need a larger payload — out of scope.

## Config schema

Generalize `HomeLayoutPrefs.config` from `{ snapshotSeries?: string }` to a per-widget map:

```ts
interface WidgetSettings {
  density?: 'comfortable' | 'compact';
  count?: number;        // just-missed, news, from-the-blog
  days?: number;         // schedule
  series?: string;       // standings-snapshot (the chosen series)
  rows?: number;         // standings-snapshot top-N
  seriesSet?: string[];  // championship-leader subset (absent = all followed)
}
type HomeWidgetConfig = Partial<Record<HomeElementId, WidgetSettings>>;
```

- `reconcileHomeLayout` **migrates** the old `config.snapshotSeries` →
  `config['standings-snapshot'].series` (no loss for existing users), validates types, and
  clamps numbers to each widget's allowed range. Unknown widget keys + bad fields dropped.
- `HOME_LAYOUT_VERSION` → 6. `parseHomeLayout` accepts the object (rejects non-objects).
- `useHomeLayout` gains `setWidgetSetting(id, patch)` (merges a partial into that widget's
  settings), replacing the single-purpose `setSnapshotSeries`.

## Density

`comfortable` (default — current look) | `compact` (tighter vertical padding on the
widget's rows). Implemented as a class the widget applies to its row container; no layout
restructure.

## Customise UI

Each widget row in `/settings/customize` (`BlockControls`) gains an expandable **settings
disclosure** — a gear/cog toggle that reveals that widget's controls inline:
- a density segmented toggle (comfortable / compact), and
- its content control (a number stepper for counts/rows/days; the existing series `<select>`
  for snapshot; a followed-series multiselect for the leader subset).

This replaces the standalone snapshot picker (folded into the snapshot widget's disclosure).
Eligible-series data is already threaded from the page for the snapshot picker.

## Data / feasibility

Counts, rows, series, density, and the leader subset are **client-side slices/filters of
already-fetched data** — cheap, no new fetches. Two trivial bumps:
- `from-the-blog` route returns up to 6 (was 4); client slices to `count`.
- `standings/brief` returns top-10 (was top-5); client slices to `rows`.

## Risk / pre-mortem

The schema migration is the one risk: `reconcile` must carry an existing user's
`snapshotSeries` into the new map shape without loss. Covered by reconcile tests
(old-shape → new-shape migration, range clamping, junk-dropping).

## Out of scope

Card/list + columns + per-widget accent (deferred); 14-day schedule window; standings
drivers-vs-teams view; chyron content settings.
