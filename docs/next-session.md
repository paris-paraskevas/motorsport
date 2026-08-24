# The execution queue

Rewritten 2026-08-24 (session 34). `main` = **0.334.25**, prod verified, tree clean, zero open PRs, suite **1208**.

**Session 34 drained the old queue.** Items 1b, 4b, 6, 8-partial, 10, 11 all shipped, and the operator opened a new front: an editable home page. Everything below is what is actually left.

Every item states **what**, **why**, **where**, and **how prod is audited**. The ritual per item: branch → implement → `tsc` / `lint` / `vitest` / `build` → browser-verify → the trio → PR with a real body → squash-merge → poll `/changelog` → audit on prod.

---

## READ THIS BEFORE YOU ADD ANYTHING

**The Worker bundle has 672.31 KiB of headroom** as of 0.334.27 — 9567.69 KiB gzipped against a hard 10240 KiB ceiling (Workers Paid; there is no higher tier). That is a comfortable margin, and it was 19.35 KiB a few hours earlier: the admin clean-up freed **653 KiB**. Still measure with `wrangler deploy --dry-run` before adding a dependency, but the emergency is over.

**The lesson that bought it, worth keeping:** `@google-analytics/data` and `@googleapis/searchconsole` were *server* imports inside *server* components, so they landed in the Worker script. `three` (25 MB installed), `recharts` (8.3 MB) and `leaflet` are all client-side behind `next/dynamic` and cost the Worker **nothing**. When something looks expensive, check which side of that line it is on first. And a chunk measurement is a **floor**: the prediction was ~352 KiB, the reality 653 KiB, because transitive trees go with the package.

**The next lever, if it is ever needed:** ~618 KiB is the Satori / `ImageResponse` runtime for OpenGraph cards (`resvg.wasm` 531 KiB, an embedded font 59 KiB, `yoga.wasm` 28.5 KiB) across five routes. Pre-generating those cards would reclaim it, and it is an operator decision because the cards are what make posts shareable. **Not urgent now.**

---

## TIER 1 — executable now

### 1. The mobile calendar goes back to the simpler version
**Operator, 2026-08-24, and the constraint IS the item:** *"i am talking ONLY about mobile. desktop is easy. perfect. DO NOT CHANGE desktop calendar. just the mobile one is too complex & confusing."*

- **First job is archaeology, not design.** Find what the mobile calendar was before (0.313.0's "mobile agenda" is the likely turning point) and restore that, rather than inventing a third version.
- **Desktop must come out byte-identical.** Screenshot it at 1440 before and after and prove it did not move. Any diff must be provably scoped to the mobile breakpoint.
- **Audit**: `/calendar` at 390 px reads simply; at 1440 px it is unchanged.

### 2. `/blog` needs its cover images
It is a text list today. Every post already has a `hero_image` that both the post page and the `/app` lead band use. The listing's card shape is built inline at `app/(app)/blog/page.tsx:22-35` rather than extracted — that is the moment to pull it out. **Posts with no cover must not leave a hole.**

### 3. AdSense wave 3 — F1 pre-1996 champion notes
46 seasons into `content/series/f1/champion-notes.json`. **Data only, no code.** `lib/champion-notes-integrity.test.ts` guards every note (names its own champion, carries its season, agrees with the points pair, cites two sources), so a malformed wave cannot land. The proven two-source pipeline, RULE #1 on every clinch, small waves rather than a fan-out. **The only Tier-1 item carried over from session 33, still not started.**
- **Audit**: an enriched year shows the clinch on `/information/formula-1/who-won-the-1976-formula-1-championship`; an un-enriched one is untouched.

---

## TIER 2 — the home composer, ships 3 and 4

Ships 1 and 2 are live (0.334.21, 0.334.24): pin the lead post, reorder, hide, live preview, drag and drop. The approved plan is at `~/.claude/plans/clever-enchanting-summit.md`.

### 4. Ship 3 — your own cards
- **`link`**: a free card (title, kicker, URL, optional image) pointing at our article, motorsport.com, anywhere.
- **`note` on a weekend card**: `HomeLeadNextItem.note?` already exists and is unused (`HomeLead.tsx:40-49`).
- Both are new block ids in `HOME_BLOCK_IDS`; the parser already drops ids it does not know, so **older published revisions keep working** across the deploy.

### 5. Ship 4 — the console rethink
The operator's verdict on the current one: *"a pile of pages that do little, it just isn't helpful."* The composer is the first tool there that changes the site rather than reporting on it; the front page should be organised around doing. **Deleting any existing admin page needs the operator's word, with the list in front of them.**

---

## TIER 3 — projects, each its own session

6. **A day page** between the weekend and the session (Friday/Saturday/Sunday: forecast, that day's news, blogs, sessions). `forecastWindow()` + `HourlyForecastRows` drop straight in. Needs a layout decision, not research.
7. **THE IMAGE SESSION** — licence-clean imagery at scale. Every source licence-checked (portraits ×14 and team logos both died on licensing).
8. **The GEO / positioning brief** — AI engines describe Paddock as web-only, 4-series, no journalism, all wrong.
9. **v1.0 launch program.**
10. **Street View corner tours + layout history** on `/tracks/<slug>`. Pairs with the paused `feat/tracks-map` branch (leaflet already on it; a blind conflict resolution there broke prod once, 2026-07-09).
11. **Information hubs restyle** — the last pre-Paper surface.

---

## Standing facts, so nobody rediscovers them

- **Deploys are ~5-6 minutes** and there is **no GitHub Actions run to watch** — poll `/changelog` until the version flips. 11 for 11 this session.
- **A published home layout reaches `/app` in 48 s to ~4 m 45 s** without `revalidatePath` — the ISR window, not the 30-minute regional cache. Numbers in `docs/perf-baselines.md`.
- **Local Supabase is down**, so every blog-backed surface renders empty locally. That is the fail-soft path working.
- **`/admin` and `/studio` cannot be verified from this machine** — no admin session exists. Anything built there is compile-verified only and needs the operator to click it. Say so plainly rather than implying otherwise.
- **Lint is 0 errors + 2 known `_encoding` warnings** in `lib/content-fs.ts`. Those parameters are load-bearing. **Leave them.**
- **`npm test` is 1208.**
- **Write changelog prose in the editor, never a shell-quoted `node -e`** — bash expands the backticks and silently eats identifiers.
- **Browser verification is not the gate chain.** Screenshot it; DOM assertions have passed on defects a picture caught.

---

## Handoff prompt for session 35

> Paddock — session 35. `main` = **0.334.25**, prod verified, tree clean, zero open PRs, suite **1208**. Read in order: `CLAUDE.md` · `docs/HANDOFF.md` top block · **`docs/next-session.md` (this file — it is what to do)** · `CONTRIBUTING.md` · `IDEAS.md` · `SCHEDULE.md` · memory `feedback-paddock-*`.
>
> **The Worker bundle has 672.31 KiB of headroom** (9567.69 / 10240 KiB), after the admin clean-up freed 653 KiB. Comfortable, but still measure with `wrangler deploy --dry-run` before adding a dependency — and know the rule that made it expensive in the first place: a *server* import in a *server* component lands in the Worker, while anything client-side behind `next/dynamic` costs it nothing.
>
> **Work the queue from the top.** Item 1, the **mobile calendar**, carries a verbatim constraint that is the whole item: *only* mobile, **do not change desktop**, prove it with before/after screenshots at 1440. Then item 2, **cover images on `/blog`**. Then item 3, **AdSense wave 3** — 46 F1 seasons, data only, guarded by `champion-notes-integrity`, small waves and two sources per clinch.
>
> **Four things the operator owes, do not stall on them:** clicking the home composer at `/admin/home` (drag, hide, preview, Publish — never browser-verified, `/admin` needs a session this machine has not got), the four autosave checks in PR #788, the month-grid word, and the OG-image bundle decision.
>
> **Five traps from session 34, none guessable.**
>
> 1. **Write changelog prose in the editor, never through a shell-quoted `node -e`.** Bash expands every backtick and silently eats identifiers out of finished prose. It happened despite the warning already being written down.
> 2. **Read the structure before a multi-boundary refactor.** Four visually identical `)}` lines are not interchangeable — the one matched belonged to a sibling block, and the refactor broke mid-flight. Relatedly: `changed` and `next` are **siblings** of the result section (`HomeLead.tsx:479` closes it, `:488` opens the grid), not nested inside it, whatever older notes say.
> 3. **A test that passes vacuously is not coverage.** The sitemap's "no entry carries lastModified" assertion passed only because Supabase is unconfigured under vitest, so no blog entry ever got one.
> 4. **Zero `lastmod` in the sitemap is a deliberate decision, not a defect** (`lib/sitemap-data.ts:13-19`). Only blog posts have a verifiable change stamp, so only they got one.
> 5. **A dependency with zero importers costs no bundle until it has one.** `@dnd-kit` sat in `package.json` for weeks outside the bundle; wiring it in cost ~34 KiB of headroom.
>
> Usual rules: branch from `main` as the literal first action after every merge · full gate chain before any "done" · the trio on every push · no Claude attribution · browser-verify and screenshot · a merge is the deploy, ~5-6 min, no Actions run, poll `/changelog`, never stack merges · **prod Supabase writes and migrations need the operator to name the action**.
>
> End of session: update `docs/HANDOFF.md`, mark the day in `SCHEDULE.md`, triage `IDEAS.md`, rewrite this file's queue and a fresh prompt.
