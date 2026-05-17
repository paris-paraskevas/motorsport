# Paddock 1.0 — visual system

Working spec for the cross-device restyle of paddock-tracker.com. Approved 2026-05-17. Live target: PR `feat/paddock-1.0-restyle` → `main`.

## Goals

1. Professional + aesthetic across Android phone, Android PWA, iPhone PWA, desktop / laptop.
2. Functionality-preserving — visual only. No loader, route, data-shape, auth, cron, or PWA-config changes.
3. Foundation for upcoming social features (comments, predictions) and live-data surfaces.

## POV — "Paddock"

Modern timing tower with editorial breathing room. Dark by default — race weekends happen in low light. Precise mono numerics for data. Neutral grayscale chassis. The active series's color is piped in as accent on series-scoped routes; global routes use neutral signal-amber that carries over from the existing wash.

**Anti-vibe.** AI-startup pastels, rainbow shadcn defaults, full-bleed hero photography, spring chaos, generic Bootstrap card stacks.

**One bold anchor:** series-accent theming via `--accent` CSS var. `meta.color` from `content/series/<slug>/meta.json` flows to active tab, focus rings, primary CTA, live indicator. Like Apple Music shifting UI to album art.

## Typography

- **Geist Sans** — prose, headings, UI labels (already loaded).
- **Geist Mono** — timing data (lap times, gaps, positions, race times, points). Numerics broadcast "this is data".
- Scale: `0.75 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 2 / 3rem`. Display weight only on hero.
- `.tnum` utility (already present) reinforced as the convention wherever a value can change.

## Color tokens

Neutral chassis = `zinc` family.

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | zinc-50 | zinc-950 |
| `--color-surface` | white | zinc-900 / 40% |
| `--color-surface-elevated` | white | zinc-900 |
| `--color-border` | zinc-200 | zinc-800 |
| `--color-border-strong` | zinc-300 | zinc-700 |
| `--color-text` | zinc-950 | zinc-100 |
| `--color-text-muted` | zinc-600 | zinc-400 |
| `--color-text-faint` | zinc-500 | zinc-500 |

**Accent** (overridable per-series via inline `style={{ '--accent': meta.color }}` on the series layout):

- Global default: `amber-500` `#f59e0b`.
- Per-series: `meta.color` from `content/series/<slug>/meta.json`.

**Signal** (semantic, never per-series):

- `--color-live`: amber-500 — live sessions, current weekend
- `--color-positive`: emerald-500 — go, positive deltas, wins
- `--color-negative`: red-500 — stop, negative deltas, DNFs

## Motion

- Default `--duration-fast: 150ms` ease-out.
- Layout shifts `--duration-base: 250ms`.
- Live pulse: 2s ease-in-out scale + opacity, only on actually-live elements.
- Respect `prefers-reduced-motion` — pulse becomes a static dot.

## Density

- **Mobile:** tight. Cards `p-3`, gap-2, body 14–15px.
- **Desktop:** comfortable. Cards `p-5`, gap-4, body 16px.
- Container: `max-w-xl` on mobile auth/forms, `max-w-6xl` on `/series` + weekend pages, full-bleed on `/calendar`.

## Surfaces

- Cards: 1px border (`--color-border`), `--color-surface` fill, `--radius-md` (8px), no heavy shadow.
- Hero: type-driven, no full-bleed photography. Optional small circuit silhouette / flag chip.
- Live-now strip: thin, top-positioned, sticky on mobile.
- Background wash preserved (evolved, not replaced) — warm amber top-left + cool blue bottom-right + grain. Light-mode variant gets a cream + sky-blue echo.

## Tooling

- Tailwind v4 (existing). No migration.
- shadcn/ui primitives initialized against **our** token names — not their defaults.
- Geist Sans (existing) + Geist Mono (new) via `geist/font/mono`.
- `@custom-variant dark (@media (prefers-color-scheme: dark))` swap in Stage 8 alongside Clerk re-tune.
- No `next-themes` for v1. System-driven only. Toggle deferred.

### shadcn primitives

`button`, `dialog`, `sheet` (mobile drawer), `tabs`, `popover`, `command`, `toast` (Sonner), `skeleton`, `tooltip`.

## Staging plan

| Stage | Scope | Est |
|---|---|---|
| 1 | Tokens in `globals.css` + Geist Mono import | 1.5h |
| 2 | shadcn init + 9 primitives | 0.5h |
| 3 | `AppShell` + nav + `Footer` + `HeaderUtils` + mobile drawer | 2.5h |
| 4 | Home: `HomeContent`, `NextSessionCard`, `FilteredSessions`, `SessionCard`, `WeekendBlock`, `DayHeader` | 3h |
| 5 | Series landing: accent piping, `SeriesTabs` → shadcn, all `tabs/*` | 3.5h |
| 6 | Weekend: `WeekendHero`, `WeekendSchedule`, `WeekendWeatherStrip`, `WeekendNews`, `WeekendStandingsSnapshot` | 3h |
| 7 | Detail pages: `/drivers/[slug]`, `/teams/[slug]`, `SeasonTrendChart` | 2h |
| 8 | Auth + settings + modals + tail surfaces + **lift forced-dark** + Clerk re-tune | 2h |
| 9 | Cross-device verify + Lighthouse + version bump + RELEASES + CHANGELOG + PR | 1.5h |

Total: ~19h of focused work across Mon–Thu.

## What this won't touch

- Loaders, data fetching, weather / news pipelines.
- Cron auth (`lib/cron-auth.ts`), KV keys, env vars.
- Clerk auth flow (only `appearance`).
- `proxy.ts`, `next.config.ts`, `node-ical` setup, `@serwist/next` PWA config.
- `package.json` version line (only bumped at Stage 9 PR time).
- The 76 backlog items.
- New routes, new pages, removed routes.

## Reference set

- **Linear** — type, density, dark-mode tokens.
- **Apple Sports** — sports density, mobile-first cards.
- **Vercel** — gradient subtlety, responsive system.
- **The Race** — motorsport editorial register.
- **Notion Calendar** — schedule view patterns.
- **Stripe** — long-form typography reference.

## Acceptance — restyle is "shipped" when

1. All 9 stages complete.
2. Cross-device verify on:
   - iPhone Safari + iPhone PWA installed
   - Android Chrome + Android PWA installed
   - Desktop Chrome at 1280, 1440, 1920
3. No regression in: navigation, auth, contact form, weather/news loaders, push notifications, PWA install, cron auth.
4. Lighthouse mobile score within 5 points of pre-restyle baseline (baseline taken at Stage 1).
5. WCAG 2.2 AA basics: focus visible everywhere, contrast 4.5:1 on text, motion respects reduced-motion.
6. PR opened against `main`, RELEASES.md user-facing entry, CHANGELOG.md engineering entry, `package.json` minor version bump (0.10.0 — new minor for a feature-level visual system, not a patch).
