# The execution queue

Rewritten 2026-08-24 (session 34 close). `main` = **0.334.29**, prod verified, tree clean, zero open PRs, suite **1206**.

**Session 35's two priorities, operator-set:** the admin page, and moving what can be moved into R2.

Every item states **what**, **why**, **where**, and **how prod is audited**. The ritual per item: branch → implement → `tsc` / `lint` / `vitest` / `build` → browser-verify → the trio → PR with a real body → squash-merge → poll `/changelog` → audit on prod.

---

## The bundle, and what R2 can actually do — read before planning the R2 work

**Headroom is 672.31 KiB** (9567.69 / 10240 KiB gzipped) after the clean-up freed 653 KiB. The emergency is over; the discipline is not.

**The rule that governs all of it:** a **server** import in a **server** component lands in the Worker script. Anything client-side behind `next/dynamic` costs the Worker **nothing** — which is why `three` (25 MB installed), `recharts` (8.3 MB) and `leaflet` are free while a 6.8 MB analytics client was not. Check which side of that line something is on before assuming it is expensive.

**R2 holds DATA, not CODE. This is settled, not a matter of effort:**

- **WASM cannot be lazily loaded from R2.** Cloudflare Workers refuse to compile Wasm fetched at runtime — `WebAssembly.instantiate()` accepts only a pre-compiled module from a static `import x from './y.wasm'` that the bundler resolves at deploy. Attempting it raises **"Wasm code generation disallowed by embedder"**. So the ~560 KiB of `resvg.wasm` + `yoga.wasm` **cannot** move to R2. Do not spend a session discovering this.
- **JavaScript cannot either** — a Worker's script must be self-contained.
- **What CAN move is data the Worker reads at runtime**, and that is where the opportunity is.

### The real R2 candidate: `content/`

`content/` is **1.9 MB raw** and is read at runtime by `loadAllSeries()`, `loadAllSeriesMeta()` and the `/information` loaders, so output-file-tracing pulls it into the Worker.

| Path | Raw |
|---|---:|
| `content/information/tracks.json` | **306.5 KB** |
| `content/series/f1/upgrades.json` | 50.4 KB |
| `content/series/motogp/sessions.json` | 28.9 KB |
| `content/information/rising-stars.json` | 28.9 KB |
| `content/series/f1/champion-notes.json` | 28.0 KB |

**First job is a measurement, not a migration.** Confirm how much of `content/` actually lands in the Worker (compare `wrangler deploy --dry-run` before and after temporarily stubbing a big file), because JSON gzips extremely well and the raw number will overstate it. Only then decide.

**And weigh it against what `content/` is for.** It is the operator's curated data — the thing `CLAUDE.md` calls "conversational authoring IS the CMS", edited as commits that ship to prod. Moving it to R2 means edits stop being commits, which is a real loss of reviewability. A middle path exists: move only the largest **derived/reference** blobs (`tracks.json` is the obvious one) and leave the hand-curated per-series files where they are.

**If more room is ever needed after that**, the ~618 KiB OpenGraph-card runtime is the biggest remaining block. It cannot go to R2, but it can be split into its own Worker behind a service binding, or removed entirely by pre-generating the cards at build time. Operator decision — those cards are what make posts shareable.

---

## TIER 1 — the admin page

Continues the approved plan at `~/.claude/plans/clever-enchanting-summit.md`. Step 1 (the clean-up) shipped as 0.334.27.

### 1. Click what is already there, before building more
**Nothing in the console has ever been browser-verified** — `/admin` needs an admin session, which the dev machine does not have. Before adding features, the operator (or a session with a signed-in browser) should exercise: the composer's drag, hide, preview and Publish; the **Studio** link from the dev host (it is an absolute cross-host link because `middleware.ts:92-98` 404s relative paths there, and that nearly shipped broken); and the four autosave checks from PR #788. **Fix what that finds first.**

### 2. L1 — your own content in the home page
- **`link` band**: a free card — title, kicker, URL, optional image. Our article or anywhere else.
- **`note` on a weekend card**: `HomeLeadNextItem.note?` already exists and is unused (`HomeLead.tsx:40-49`).
- **Choose which result leads** and **which weekends show**, instead of newest / next-three.
- New block ids drop into `HOME_BLOCK_IDS`; `parseHomeLayout` already ignores ids it does not know, so **published revisions keep working** across the deploy and a rollback stays safe.
- **Audit**: publish a layout with a link card, confirm it appears on `/app` within ~5 minutes, then revert.

### 3. Evidence inside the composer
Show each band's click-through **next to that band**, from our own `heatmap_element_stats` — the Guardian's "Ophan in the tool" idea, using data we already collect and already pay for. Today `/admin/behaviour` is that table's only reader, which is the same write-only shape as the push history removed in 0.334.16.

### 4. L2 — per-band dials
Wire item count, standings top-N, weekends shown, preferred series. Each is a field on the block in the same `blocks` JSON.

---

## TIER 2 — the rest of the ladder

5. **L3 — scheduled and self-switching layouts.** A `publish_at` on a revision plus a cron that promotes it, mirroring `publishDuePosts`; and a conditional rule ("while a session is live, use this layout") evaluated server-side from data `lib/home-model.ts` already computes. **The composer must always show which layout is live and why.**
6. **L4 — named presets.** Falls out of L3 once revisions can be named.
7. **L5 — new band types.** Editorial note first: `renderMarkdown()` (`lib/content.ts:43`) already sanitises, so it costs no dependency. Then image card (`normalizeHeroImage`), then spotlight (`loadAllDrivers` / `loadDriverBios`). Poll last — the only one likely to need client interaction, so measure before writing.
8. **Finish `/admin/submissions`.** Its `new / reviewing / ingested / rejected` badge **can never change**: `lib/feeder.ts` exports no status-mutation function. Either give it one or drop the badge — right now the console is pretending.
9. **Auth inconsistency.** `/api/feedback/[id]` and `/api/threads/[id]` return **403** where every `api/admin` route returns **404**. The 403 leaks existence.

---

## TIER 3 — carried, not started

10. **The mobile calendar goes back to the simpler version.** Operator, verbatim, and the constraint IS the item: *"i am talking ONLY about mobile. desktop is easy. perfect. DO NOT CHANGE desktop calendar."* Archaeology first (0.313.0's mobile agenda is the likely turning point), diff provably scoped to the mobile breakpoint, desktop screenshotted at 1440 before and after to prove it did not move.
11. **`/blog` needs its cover images.** Every post has a `hero_image` the post page and `/app` lead already use. The listing's card shape is inline at `app/(app)/blog/page.tsx:22-35` — extract it. Posts with no cover must not leave a hole.
12. **AdSense wave 3** — 46 F1 pre-1996 champion notes, data only, guarded by `champion-notes-integrity`. Two sources per clinch, small waves. Carried from session 33, still not started.
13. **Tier-3 projects**: the day page · the image session · GEO/positioning · v1.0 launch · Street View corner tours · information-hub restyle.

---

## Standing facts

- **Deploys are ~5-6 minutes**, no GitHub Actions run to watch — poll `/changelog`. 14 for 14 this session.
- **A published home layout reaches `/app` in 48 s to ~4 m 45 s** without `revalidatePath` — the ISR window, not the 30-minute regional cache.
- **`/admin` and `/studio` cannot be verified from the dev machine.** Say so plainly rather than implying otherwise.
- **Local Supabase is down**, so every blog-backed surface renders empty locally. That is the fail-soft path working.
- **Lint is 0 errors + 2 known `_encoding` warnings** in `lib/content-fs.ts`. Load-bearing. Leave them.
- **`npm test` is 1206.**
- **Write changelog prose in the editor**, never a shell-quoted `node -e` — bash expands backticks and eats identifiers.
- **A chunk measurement is a floor**: predicted ~352 KiB, actual 653 KiB.
- **Prod Supabase writes and migrations need the operator to name the action.**

---

## Handoff prompt for session 35

> Paddock — session 35. `main` = **0.334.29**, prod verified, tree clean, zero open PRs, suite **1206**. Read in order: `CLAUDE.md` · `docs/HANDOFF.md` top block · **`docs/next-session.md` (this file — it is what to do)** · `CONTRIBUTING.md` · `IDEAS.md` · `SCHEDULE.md` · memory `feedback-paddock-*`. The approved multi-step plan is at `~/.claude/plans/clever-enchanting-summit.md`.
>
> **Two priorities, operator-set: the admin page, and moving what can be moved into R2.**
>
> **On R2, read the section at the top of this file before planning anything.** The short version: **R2 holds data, not code.** WASM cannot be lazily loaded — Workers refuse to compile Wasm fetched at runtime ("Wasm code generation disallowed by embedder"), so the ~560 KiB of `resvg.wasm` + `yoga.wasm` **cannot** move there, and neither can JavaScript. The real candidate is `content/` (1.9 MB raw, `tracks.json` alone 306 KB), read at runtime and traced into the Worker. **Measure before migrating** — JSON gzips well and the raw figure overstates it — and weigh it against the fact that `content/` is the operator's curated CMS, where an edit is a reviewable commit.
>
> **On the admin page: click what exists before building more.** Nothing in the console has ever been browser-verified, because `/admin` needs a session the dev machine has not got. The composer's drag/hide/preview/Publish, the Studio cross-host link, and the four autosave checks in PR #788 all want a real browser. Fix what that finds, then take L1 (your own link cards, a note on a weekend, choosing which result and weekends show).
>
> **Five traps from session 34, none guessable.**
>
> 1. **Write changelog prose in the editor, never a shell-quoted `node -e`.** Bash expands every backtick and silently eats identifiers out of finished prose. It happened despite the warning already being written down.
> 2. **Read the structure before a multi-boundary refactor.** Four visually identical `)}` lines are not interchangeable — the one matched belonged to a sibling block and the refactor broke mid-flight. Relatedly: `changed` and `next` are **siblings** of the result section (`HomeLead.tsx` closes it at `:479`, the grid opens at `:488`), not nested inside it, whatever older notes say.
> 3. **A chunk measurement is a floor, not the answer.** Removing two pages was predicted at ~352 KiB and delivered 653 KiB, because transitive dependency trees go with the package.
> 4. **A test that passes vacuously is not coverage.** The sitemap's "no entry carries lastModified" assertion passed only because Supabase is unconfigured under vitest.
> 5. **Deleting a route leaves stale generated types** that fail `tsc` until `.next` is cleared — and check the port first, because clearing it under a live dev server 500s it.
>
> Usual rules: branch from `main` as the literal first action after every merge · full gate chain before any "done" · the trio on every push · no Claude attribution · browser-verify and screenshot · a merge is the deploy, ~5-6 min, no Actions run, poll `/changelog`, never stack merges · `wrangler deploy --dry-run` before adding a dependency (672 KiB of headroom, comfortable but not infinite) · **prod Supabase writes and migrations need the operator to name the action**.
>
> End of session: update `docs/HANDOFF.md`, mark the day in `SCHEDULE.md`, triage `IDEAS.md`, rewrite this file's queue and a fresh prompt.
