# Paddock — handoff

The running operational record. Read at session start. Update at session end.

This replaces the per-user memory handoff that lived at `~/.claude/projects/C--Dev-Personal-Motorsport/memory/project-paddock-handoff.md` until 2026-05-16. Memory file is now a redirect stub.

---

## ⚡ Next session pickup — 0.12.9 IMSA (or 0.12.8.1 WEC per-round results)

**0.12.6 + 0.12.7 + 0.12.8 shipped 2026-05-21.** Three back-to-back PRs:
- 0.12.6 (PR #83 merged) — custom `CookieConsent` modal, GA4 unblock for EU/UK visitors.
- 0.12.7 (PR #84 merged) — modal UX polish, research-driven (bottom card + Allow all / Essential only / Customize + "Always on" pill + entry animation).
- 0.12.8 (PR pending merge) — **live FIA WEC 2026 standings** on `/series/wec?tab=standings`. Source: `fiawec.com/en/page/manufacturers-classification` SSR. 4 tables shipped — Hypercar Drivers, Hypercar Manufacturers, LMGT3 Drivers, LMGT3 Teams.

**Phase 1 brief was slightly wrong about WEC structure.** The brief said 6 standings tables (Hypercar + LMGT3 × Drivers + Teams + Manufacturers). Reality is **4** — WEC asymmetric: Hypercar has Drivers + Manufacturers only (no Teams, manufacturer == team), LMGT3 has Drivers + Teams only (no Manufacturers, pro-am class). Schema reflects this with `Partial<Record<WecClass, ...>>` for the asymmetric championships.

**WEC per-round results deferred to 0.12.8.1.** The `/en/page/resultats-1` page hosts results but swaps client-side via a StimulusJS `live#action` controller (`changeRace` / `changeSession` / `changeCategory`). Underlying XHR endpoint isn't exposed. Two ways forward when it's time:
1. Reverse-engineer the StimulusJS endpoint (DevTools network tab on a real visit).
2. Probe per-event `/en/race/<slug>` pages for an embedded results table (today's probe showed they're event landing pages only — no results inline).

**Next session can either:**
- Pick up **0.12.8.1 WEC per-round results** if operator wants to close the WEC loop before moving on.
- Continue Phase 2 at **0.12.9 IMSA full-class results** (Alkamel JSON API, locked Phase 1 source).

The "WEC and everything downstream is renumbered +3 from the original locked plan" note from earlier still holds — total renumbering is now +3 (footer + consent + consent UX polish).

### 0.12.6 + 0.12.7 shipped detail — historical record

The previous session ran low on tokens after shipping 0.12.5 (footer redesign). 0.12.6 + 0.12.7 were both completed in this session.

### Why this jumped the queue

Operator flagged that the existing Google Funding Choices consent banner never renders — AdSense is still in "Getting ready" review, and Funding Choices's `?ers=1` "early renderable signal" doesn't actually summon a banner before AdSense approval (despite Google's docs claiming otherwise). As a result, Consent Mode v2 defaults to `denied` and GA4 fires nothing for EU/UK visitors. That's a Vercel-vs-GA4 stats blackout for most of Paddock's audience.

### 0.12.6 plan (locked via AskUserQuestion 2026-05-21)

**Replace Funding Choices with a custom modal-style CookieConsent component.** Four categories (Necessary / Analytics / Advertising / Functional) mapped 1:1 to Consent Mode v2 signals. Two-step UI: first layer = Accept all / Reject all / Customize (three symmetric buttons per EDPB symmetry rule). Second layer = per-category toggles. Modal blocks the page (with backdrop) until the user clicks. Re-prompt after 12 months. Re-openable via custom event from the existing footer "Manage cookies" link.

**Drop Funding Choices entirely.** When AdSense eventually approves, FC can be re-introduced as a swap (FC takes over consent UI; our modal becomes a fallback). Until then, two consent systems running concurrently would fight each other over `gtag('consent', 'update', ...)`.

### Files to create / edit

1. **NEW** `components/CookieConsent.tsx` — the modal. Reference implementation is in the session-end chat transcript (the other-AI session that researched this). **Critical: rewrite the reference using Paddock design tokens (`bg-bg / bg-surface / bg-surface-elevated / text-text / text-text-muted / border-border`), NOT the hardcoded `zinc-*` Tailwind classes in the reference.** Paddock now ships a dark/light theme toggle (since 0.12.0); a zinc-hardcoded modal would look broken in light mode.
2. **EDIT** `app/layout.tsx` — remove the two Funding Choices `<Script>` blocks (lines ~94-108 at session checkpoint: `id="funding-choices"` and `id="funding-choices-signal"`). Mount `<CookieConsent />` somewhere after `<AppShell>` and before `<Analytics />`. The existing `consent-default` script block (sets all signals to `denied`) STAYS — the new modal fires `gtag('consent', 'update', ...)` on user action.
3. **EDIT** `components/Footer.tsx` — change the "Manage cookies" `<Link href="/cookies">` (added in 0.12.5) to a `<button onClick={() => window.dispatchEvent(new Event('open-cookie-consent'))}>` so users can re-open the modal from the footer at any time. EDPB requirement: users must be able to change consent anytime.

### Consent Mode v2 signal mapping (locked)

```
Necessary  → security_storage: 'granted' always (essential, no toggle)
Analytics  → analytics_storage
Advertising → ad_storage + ad_user_data + ad_personalization (all three flip together)
Functional → functionality_storage + personalization_storage
```

### EDPB compliance non-negotiables

- **Reject All on first layer** equally visible to Accept All (not behind Customize)
- **Symmetric buttons** — same size, color, contrast across Accept / Reject / Customize
- **No pre-ticked boxes** for non-essential categories (everything except Necessary defaults off)
- **No cookie wall** — Reject must dismiss the modal and leave the site usable
- **Persistent re-open** path (the Footer button above)
- **Re-prompt after 12 months** (handled via `localStorage` timestamp + age check)

### Reference: the working code from the other-AI session

A complete `CookieConsent.tsx` exists in the session transcript with all the logic right (storage shape, consent-update wiring, modal scaffolding, re-open event listener). Two things to fix when porting:

1. **Replace every `zinc-*` Tailwind class with Paddock design tokens.** Mapping:
   - `bg-zinc-950` → `bg-surface-elevated` (the modal sheet background)
   - `bg-zinc-900` / `bg-zinc-900/50` → `bg-surface` (toggle rows + button bg)
   - `bg-zinc-700` → `bg-border` (off-state toggle track)
   - `bg-zinc-100` (toggle on-state) → `bg-text` (then the thumb flips to `bg-bg`)
   - `border-white/10` → `border-border`
   - `text-zinc-100` → `text-text`
   - `text-zinc-300` / `text-zinc-400` → `text-text-muted`
   - `bg-black/70` (backdrop) → keep as-is, modal backdrop is theme-neutral
2. **Verify the GA4 unblock works end-to-end** post-deploy: open paddock-tracker.com in incognito, accept all, check DevTools Application → Cookies for `_ga` / `_ga_*` cookies appearing within 30s. The reference component calls `window.gtag('consent', 'update', ...)` — make sure the `gtag` function is on `window` by the time the modal renders (it's loaded via `<Script src="googletagmanager.com/gtag/js" strategy="afterInteractive">` in layout.tsx, which should be ready when the modal first paints).

### Phase 2 sequence renumbered (footer absorbed 0.12.5, cookie banner absorbs 0.12.6)

| Ver | Scope | Source | Status |
|---|---|---|---|
| 0.12.0 | feat(theme) + chore | n/a | ✅ shipped |
| 0.12.1 | fix(f3) reconciliation | __NEXT_DATA__.RacePoints | ✅ shipped |
| 0.12.2 | feat(indycar) results | Wikipedia Driver_standings | ✅ shipped |
| 0.12.3 | feat(formula-e) R7-R10 | motorsportweek.com | ✅ shipped |
| 0.12.4 | feat(motogp) standings + results | Pulselive JSON | ✅ shipped |
| 0.12.5 | feat(footer) multi-column + copyright | n/a | ✅ shipped |
| 0.12.6 | feat(consent) custom modal, drop FC | n/a | ✅ shipped (PR #83) |
| 0.12.7 | feat(consent) UX polish, research-driven | n/a | ✅ shipped (PR #84) |
| 0.12.8 | feat(wec) standings (results deferred to 0.12.8.1) | fiawec.com SSR | ✅ shipped (PR pending) |
| 0.12.8.1 | feat(wec) per-round results | TBD (Stimulus XHR or per-event scrape) | optional follow-up |
| 0.12.9 | **feat(imsa) full-class results** | Alkamel JSON | **NEXT** |
| 0.12.10 | feat(nascar-cup) full-class results | racing-reference.info | |
| 0.12.11 | feat(gt-world) results + points | SRO regs | |
| 0.12.12 | feat(wrc) per-rally full-class | Wikipedia per-rally | |
| 0.12.13 | feat(dtm) standings + results | motorsport.com/dtm | |
| 0.12.14 | feat(nls) standings + results | teilnehmer.vln.de PDF | |
| 0.13.0 | feat(drivers) bulk × 13 series | per-series | unchanged |

---

## Quick context

- **Repo:** `paris-paraskevas/motorsport` (private).
- **Live URL:** https://paddock-tracker.com. Vercel project name: `motorsport`.
- **Branch:** `main`. **Workflow:** branch → PR → review → squash-merge. See `CONTRIBUTING.md`.
- **Contributors:** Paris (paris-paraskevas) — deploy steward. Fotis — joining as contributor #2. Onboarding doc: `ONBOARDING.md`.
- **Stack:** Next.js 16 App Router (middleware in `proxy.ts`), React 19, Tailwind v4, `@serwist/next` PWA, Clerk Production auth, Vercel KV (Upstash Redis). Public-with-account auth model.
- **GitHub CLI authed** as `paris-paraskevas` with `repo` + `workflow` scopes. **Vercel CLI** previously installed; reinstall via `npm i -g vercel` if a session needs it.
- **Current version:** see `package.json`. Bump on every push (`feedback-paddock-release-notes` rule, `CONTRIBUTING.md` mandate).

## Critical landmines — do not break

Detailed in inline comments + memory rules. Quick reference:

1. `next.config.ts` keeps **both** `serverExternalPackages: ["node-ical"]` **and** `outputFileTracingIncludes` for node-ical transitive deps. Either one alone breaks production fetches. Memory: `feedback-vercel-node-ical`.
2. Middleware file is `proxy.ts` in Next 16, **not** `middleware.ts`. `clerkMiddleware()` itself unchanged.
3. KV env vars must be unprefixed: `KV_REST_API_URL`, `KV_REST_API_TOKEN`. Reject any "STORAGE" prefix from the Vercel Marketplace flow.
4. Clerk publishable key must keep `NEXT_PUBLIC_` prefix exactly. **Vercel Marketplace integration auto-creates env-var placeholders but leaves them EMPTY when promoted to Production.** Paste real `pk_live_*` / `sk_live_*` manually (Production scope), `pk_test_*` / `sk_test_*` for Preview + Development.
5. Notification badge must be monochrome (`public/icons/badge-96.png`). Regenerate via `scripts/gen-badge.py` if changed.
6. Crons **fail closed** when `CRON_SECRET` is unset — return 503, do not run. Pattern in `lib/cron-auth.ts` (`authorizeCronRequest` → `'ok' | 'missing-secret' | 'invalid'`). Reversed in `0.9.17` after the security review flagged the prior fail-open default — if CRON_SECRET ever got cleared, every cron route became an unauth'd spam gun. Now: missing secret → 503, wrong secret → 401, correct secret → run.
7. Open-Meteo lookups must use **venue-local** date, never UTC. Evening-session weather pulled the wrong day before the fix. Memory: `feedback-paddock-weather-venue-local`.
8. **Vercel CLI quirks:** `echo 'VALUE' | vercel env add NAME ENV` works for Production + Development. **Preview** needs `vercel env add NAME preview '' --value 'VALUE' --yes` — pass `''` as the git-branch positional. Single-quote values containing `$` (publishable keys end with `$`; bash will eat them).
9. **Date-only ICS entries** (`DTSTART;VALUE=DATE`) flow through `lib/ics.ts` with `Session.dateOnly: true`. UI must render "TBC", live-now must skip, notifications must never fire. Don't trust a Date that's anchored at UTC midnight.
10. **Round numbers are canonical, not array indices.** Source from `content/series/<slug>/rounds.json` via `lib/rounds.ts`. F1 is curated; other series fall back to array-index until curated.

## Authoring model — conversational, not admin UI

Every editable surface has a file home under `content/`. Renderers prefer curated/override files; external APIs are fallbacks. Edits to these are real commits that deploy to production (~90s).

| What to edit | File | Shape |
|---|---|---|
| Series metadata (color, URLs, season) | `content/series/<slug>/meta.json` | `SeriesMeta` in `lib/types.ts` |
| Drivers per series | `content/series/<slug>/drivers.json` | `CuratedDriversFile` |
| Champions per series | `content/series/<slug>/champions.json` | `Champion[]` |
| Significance flags (marquee / finale / weighted / note) | `content/series/<slug>/significance.json` | `SignificanceMap` |
| Series overview prose | `content/series/<slug>/overview.md` | plain markdown |
| Drivers prose (above the table) | `content/series/<slug>/drivers.md` | plain markdown |
| Significance prose | `content/series/<slug>/significance.md` | plain markdown |
| Standings corrections | `content/series/<slug>/standings-overrides.json` | `StandingsOverridesFile` |
| Race results corrections (DSQ / penalty) | `content/series/<slug>/results-overrides.json` | `ResultsOverridesFile` (keyed by round number) |
| **Timed-session overrides** (for date-only feeds) | `content/series/<slug>/sessions.json` | `SessionsOverridesFile` — replaces matching date-only entries with curated timed sessions |
| **Canonical FIA round numbers** | `content/series/<slug>/rounds.json` | `SeriesRoundsFile` — `{ season, rounds: [{ round, startDate, endDate, name }] }` |
| Calendar fallback (offline ICS) | `content/series/<slug>/fallback.ics` | iCalendar — used when live ICS fetch fails |
| Blog / news articles | `content/posts/<slug>.mdx` | gray-matter frontmatter: `title`, `summary`, `publishedAt`, `tags?`, `heroImage?`, `seriesSlug?`, `draft?` |

When a curated/override file is absent, renderers fall back to the live external source (jolpica, Wikipedia, scraped tables). Curation is fully opt-in.

## Where things live

- `app/` — Next.js App Router routes. `proxy.ts` is middleware.
- `components/` — React components. `components/weekend/*` is the race-weekend page.
- `lib/` — pure modules (parsing, grouping, types). Server-only helpers end in `*-loader.ts` to keep client bundles clean (the `lib/rounds.ts` + `lib/rounds-loader.ts` split is the canonical example — pure side imports from group.ts, loader side stays server-only).
- `content/series/<slug>/` — per-series curated data (see authoring-model table).
- `content/posts/*.mdx` — blog.
- `tests/fixtures/` — ICS + JSON test fixtures.
- `~/.claude/projects/C--Dev-Personal-Motorsport/memory/` — per-user memory (feedback rules + this file as a redirect stub).
- Root docs: `CLAUDE.md` (operating manual), `IDEAS.md` (idea ledger), `SCHEDULE.md` (time plan), `CONTRIBUTING.md` (PR rules), `ONBOARDING.md` (Fotis ramp), `CHANGELOG.md` (release notes), `docs/HANDOFF.md` (this file).

## Sessions roadmap

| ID  | Theme                                | What's in it                                                                                                                                                                                                                                                                            |
|-----|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| S4  | **Supabase data layer + scheduled scrapes** (reframed 2026-05-16) | The "every series, real session times" + "live race data" ambitions need a real DB. Provision Supabase via Vercel Marketplace; schema for sessions / standings / results / news / weather snapshots / live in-race data; per-series scrape jobs via Vercel Cron + Sandbox/Playwright for JS-rendered sites (fiaformulae.com, motogp.com); decide what stays as curated files vs moves to DB. Live-data ambition: "everything reachable per series" — sector times, gaps, weather radar, tyre choices. Multi-session build, replaces the KV-data-watch design originally planned. Research first (existing public sources — Ergast/jolpica, MotoGP web API, FIA feeds, aggregators), then schema, then scaffold. |
| S5  | SEO baseline                         | `app/sitemap.ts`, `app/robots.ts`, JSON-LD (`SportsEvent` per session, `Organization` per series, `Person` per driver, `BreadcrumbList` on detail pages), per-page `generateMetadata`, OG image generators, canonicals via `metadataBase` + `alternates.canonical`. Layer in fan-intent keywords (schedule / programme / where to watch / live stream / timetable). |
| S6  | Detail-page enrichment               | `/drivers/[slug]` + `/teams/[slug]` — Wikipedia bio summary, current standings position, last 5 results, news mentions. F1 History tab redesign OR curated `content/series/<slug>/history.md`. Rules tab "common topics" surface + FIA PDF link. |
| S7  | Native non-F1 results + standings    | Per-series ingestion in `lib/results/<slug>.ts` and `lib/standings/<slug>.ts`. Order: MotoGP → WEC → IndyCar → NASCAR. Includes endurance-series weekend-grouping audit (WEC / IMSA / NLS / ADAC have 24h races and multi-day tests; `groupByWeekend`'s 4-day gap may split them oddly). |
| S8  | Quality + monitoring + infra polish  | Custom `app/error.tsx`, Sentry, `/api/cron/health` summarising last-run timestamps, performance audit (Lighthouse + Speed Insights), zero lint errors + husky pre-commit hook, component tests (vitest + Testing Library), Playwright E2E on previews. |
| S9  | Race-weekend Part 2                  | Comments thread (Clerk + KV or Supabase) + predictions (open → locked-at-session-start → resolved-after-race) + paddock-coins ledger + leaderboard. Depends on S3 (shipped) and pairs with S4. |
| S10 | Showcase / content / polish          | Public README with screenshots + Mermaid architecture diagram, first 2–3 MDX blog posts, news-filter persistence (active series chip across reloads). |

## Loose items (not bound to a session)

- **UI/UX craft pass** — mobile-first audit, WCAG 2.2 AA pass, motion / micro-interactions, focus states, dark-mode contrast.
- **User research** — short survey, talk to F1-fan friends, mine subreddits for pain points.
- **SEO keyword strategy** — fan-intent queries across every series / weekend / driver / team page.
- **Notification expansion** (Phase 2) — per-event-type pushes (qualifying topper / race winner / championship-decider), click-handler deep-links to the specific session or article (currently always `/`), Settings "Your devices" list with per-device test + remove, hero images in `payload.image`.
- **Champions data fragility** — F1 wrong points column, F3 all zero, MotoGP brittle redirects. Long-term: curated `content/series/<slug>/champions.json` per series.
- **Cleanup** — delete `lib/onboarding.ts` (only wizard-reopen consumer), DRY `EnableNotifications` + `OnboardingWizard`, retheme Clerk sign-in / sign-up to Paddock dark.
- **Weekend page media embeds** (S3 follow-up, pre-S9) — `WeekendMedia` section fed by `content/series/<slug>/media.json` keyed by round (YouTube highlight reels, curated blog cross-links, optionally official onboard / pole-lap clips). `<YouTube id="..." />` MDX component already exists.
- **Smaller polish parking lot** — series Tracks/Circuits tab with map, home hero shows next 2–3 sessions when all imminent, session-card tap-to-expand (broadcast info / streaming / track), per-driver season-trend on `/drivers/[slug]`, Champions tab era markers / sparklines.

## Open design questions

1. **Sessions-override architecture (S4 input).** `sessions.json` exists per series (0.9.1). For Supabase, do overrides live in DB or stay as files? Files = git-reviewable, DB = admin-UI-editable.
2. **JS-rendered official sites.** fiaformulae.com / motogp.com / nascar.com — SPA-rendered, `fetch` returns nav HTML only. Sandbox/Playwright periodic scrape into Supabase, third-party feeds, or stay curation-first.
3. **Admin authoring UI vs conversational edits.** Current model (Claude edits files in `content/`) works. Admin UI is optional until S4. Decide during the Supabase initiative.
4. **Embedded video provider.** YouTube iframe (free, fast) vs Mux / Cloudflare Stream (paid, control). YouTube likely wins for v1.
5. **Driver lookup source for `/drivers/[slug]`.** Wikipedia REST API + parse, or curated `drivers.json` per series. Curated is reliable; Wikipedia is autofill.
6. **`sk_live_*` Clerk key rotation.** Deferred indefinitely; revisit if blast radius changes.

## Infra ledger

- ✅ Clerk Production — DONE 2026-05-14
- ✅ `paddock-tracker.com` custom domain + Vercel DNS + Let's Encrypt SSL — DONE 2026-05-14
- ✅ `CRON_SECRET` (Vercel all scopes + GitHub Actions) — DONE 2026-05-15
- ✅ Preview / Development Clerk env vars — DONE 2026-05-15
- ✅ Public-with-account auth model — DONE 2026-05-15
- ✅ VAPID + KV — push works end-to-end on properly-installed PWAs
- ✅ Vercel Analytics + Speed Insights wired — DONE 2026-05-15
- ✅ Race-weekend pages skeleton — DONE 2026-05-16 (`0.8.x` / `0.9.0`)
- ✅ Weekend correctness fixes (3 am bug + canonical round numbers + sessions.json + rounds.json infra) — DONE 2026-05-16 (`0.9.1`)
- ✅ Repo operating docs (`CLAUDE.md` + `IDEAS.md` + `SCHEDULE.md`) — DONE 2026-05-16 (`0.9.2`)
- ✅ ESPA + extensions + Mode awareness + communication discipline + commit-attribution reversed — DONE 2026-05-16 (`0.9.3`)
- ✅ Two-contributor workflow (`CONTRIBUTING.md` + `ONBOARDING.md` + CLAUDE.md push-to-main reversal) — DONE 2026-05-16 (`0.9.4`)
- ✅ docs/HANDOFF.md created + memory redirect — DONE 2026-05-16 (`0.9.5`)
- ✅ docs/HANDOFF.md flat 60-item open-items appendix — DONE 2026-05-16 (`0.9.6`)
- ✅ Per-prompt active-time tracking (`[+Nm]` prefix → SCHEDULE.md `Active:` line) — DONE 2026-05-16 (`0.9.7`)
- ✅ F1 2026 Bahrain + Saudi cancellations restored with banner + section render — DONE 2026-05-16 (`0.9.8`, PR #1 at `cd169b6`)
- ✅ Postponement rendering UI + MotoGP/WEC `rounds.json` + midnight-UTC `dateOnly` detection ("3 am" fix) — DONE 2026-05-16 (`0.9.9`, PR #2 at `e0d93cf`)
- ✅ Full-season `sessions.json` curation across 14 series + ADAC 24h — DONE 2026-05-17 (`0.9.10`, commit `141de18`, merged via PR #3)
- ✅ Template-projected empty rounds across F1/F2/F3/MotoGP/WEC/DTM/GTWCE — DONE 2026-05-17 (`0.9.11`, commit `2778037`, merged via PR #3)
- ✅ Champions data curated end-to-end across all 15 series — DONE 2026-05-18/19 (Mon/Tue marathon, `0.10.4`–`0.10.22`)
- ✅ Track A · A1 — imprint page + privacy postal address — DONE 2026-05-19 (`0.10.23`, PR #36)
- ✅ Track A · A2 + A3 — push-unsubscribe ownership + contact 12-month TTL — DONE 2026-05-19 (`0.10.25`, PR #38)
- ✅ Track A · A4a — site-wide security headers — DONE 2026-05-19 (`0.10.26`, PR #39)
- ✅ Track A · A4b — ISR with 5-min revalidate on `/`, `/calendar`, `/blog` — DONE 2026-05-19 (`0.10.27`, PR #40)
- ✅ Track A · A5 — F1 history tab + content-authoring infrastructure (other 14 series + Rules tabs parked) — DONE 2026-05-19 (`0.10.28`, PR #41; markdown-render follow-up `0.10.29`, PR #42)
- ✅ Track B · B1 — robots.ts + sitemap.ts + llms.txt — DONE 2026-05-19 (`0.10.30`, PR #45 + fix-up `8178d05`)
- ✅ Track B · B2 + B3 + B4 + B5 + B6 + B-discover — cheap wins — DONE 2026-05-19 (`0.10.31`, PR #48)
- ✅ Track B · Bing fixes + B7 — home title/H1 + tab-aware metadata — DONE 2026-05-19 (`0.10.32`, PR #49)
- ✅ Track B · IndexNow + weekend canonical + /blog desc — DONE 2026-05-19 (`0.10.33`, PR #50)
- ✅ Track B · B8 JSON-LD + RSS lastBuildDate fix — DONE 2026-05-19 (`0.10.34`, PR #51)
- ✅ Google Search Console — sitemap.xml submitted + Success — DONE 2026-05-19
- ✅ Bing Webmaster Tools — sitemap.xml submitted + Processing → Success — DONE 2026-05-19
- ✅ Brave Search — home URL submitted via `search.brave.com/submit-url` — DONE 2026-05-19
- ✅ IndexNow — first push 226 URLs accepted HTTP 200 — DONE 2026-05-19
- ✅ Contact-form email delivery — Resend Marketplace installed + `RESEND_API_KEY` + `CONTACT_TO_EMAIL` wired — DONE 2026-05-19 (operator-confirmed)
- ❌ `sk_live_*` rotation — deferred
- ❌ Sentry integration — pending
- ❌ GitHub Actions CI workflow — parked (`IDEAS.md` Parked section)
- ❌ Vercel Pro upgrade — not needed yet; Paris remains sole steward on Hobby, Fotis works via GitHub previews

## ⚡ Active workstream (post-2026-05-20 — 0.11.x scraper sweep)

**Quick state:** Production at 0.11.14. Today shipped **9 PRs** (#67-#75) on top of the morning's 0.11.0-0.11.3 sweep. **Live standings now ship on F1, F2, F3, IndyCar, FE, NASCAR, WSBK, WRC, GTWCE, IMSA.** Live results ship on F1, F2, F3, FE, NASCAR, WSBK, WRC. Missing: MotoGP, WEC, DTM, NLS, ADAC 24h, Moto2/3, IMSA results, GTWCE results.

**Cross-cutting invariant locked-in (CHANGELOG.md top):** season-trend chart totals MUST match the standings tab. Drop the chart for any series whose results parser emits winners-only or partial data. Currently F1 is the only series shipping a chart. FE chart dropped because Berlin R8 / Monaco R9-R10 Wikipedia articles are stubs without full classification.

### Today's ship list (2026-05-20 continuation, 9 PRs)

| PR | Version | What | Notes |
|---|---|---|---|
| #67 | 0.11.4 | FE results UX cleanup | Drop misleading trend chart + collapse 1-row accordion |
| #68 | 0.11.5 | F1 chart sprint points fix | Fetches Jolpica `/current/sprint.json`; chart matches standings 17/17 |
| #69 | 0.11.7 | F2/F3 KV cache + parallel fan-out | Agent-shipped. Per-season 3h TTL |
| #70 | 0.11.6 | FE per-event subpage scrape | Agent-shipped. 10/10 races + DS Penske team alias |
| #71 | 0.11.9 | WRC dispatch | DriversTable + ConstructorsTable parameterised with `heading?` prop |
| #72 | 0.11.11 | GTWCE standings dispatch | 6 tables; results deferred (no points data) |
| #73 | 0.11.10 | post-#71 hot-fix | WRC mw-heading + FE team="" + FE chart drop |
| #74 | 0.11.13 | IMSA standings dispatch | 11 tables across 4 classes, class-first grouping |
| #75 | 0.11.14 | post-#73 hot-fix | WRC results section-priority + FE doubleheader child dates |

### Critical landmines added today (carry-forward)

- **Wikipedia 2024+ wraps `<h2>`/`<h3>` in `<div class="mw-heading">`.** Parsers that walk `heading.next()` siblings find only `.mw-editsection` chrome. Walk `parent.next()` instead when parent has class `mw-heading`. Bit WRC after PR #71.
- **Wikipedia season pages (WRC 2026+) split Calendar vs Results.** Calendar table has rounds + dates but NO winner column. Results table is under separate `Results_and_standings` → `Season_summary` heading. Parsers must require a winner column on the candidate table to avoid the Calendar.
- **FE doubleheader child rows have only [round, date] cells physically.** E-Prix / Country / Circuit are rowspanned from parent and absent from the row's `<td>` children. Reading date at logical-header index returns empty. Fallback: scan all cells right-to-left for the first parseable date.
- **Cross-series invariant** documented in CHANGELOG.md top header. Don't ship a trend chart without full per-driver per-round point data.

### Next-session pickup — priority order

| Priority | Bundle | Effort | Notes |
|---|---|---|---|
| **1** | **FE per-event classification curation** | ~3-4h | Hand-enter Berlin R7/R8 + Monaco R9-R10 classifications to `content/series/formula-e/results-overrides.json` via 5-source rule per `feedback-paddock-search-for-missing-data`. Then restore the FE trend chart. |
| **2** | **MotoGP results** (paste from BLOCKED agent report) | ~1.5h | Pulselive JSON API at `api.motogp.pulselive.com/motogp/v1/`. Full design in handoff (0.11.5/0.11.12 expected, will be 0.11.15+). |
| **3** | **IndyCar results** (paste from BLOCKED agent report) | ~30m | Wikipedia 2026 IndyCar Series page. Full parser design + 17-round abbrev list in handoff. |
| **4** | **WEC stash recovery** from `agent-leakage-2026-05-20-defer` | ~1h | Multi-class Hypercar + LMGT3 standings + results. |
| **5** | **DTM + NLS write-from-research** | ~3h | DTM from motorsport.com; NLS from Wikipedia 2026 NLS wikitables (Gesamtwertung + Klassensieger). |
| **6** | **0.12.0 drivers.json bulk-commit** | 5-10h multi-session | Curate 13 series (folds FE drivers.json — fixes the "Unknown" team line at the renderer source). |
| **7** | **IA redesign + path-based routing** | 2-3 days | `/series/[slug]/[tab]` URLs. Multi-day. |
| **8** | **0.14.0 histories + Moto2/3** | 50+h authoring | User-paced. |
| **9** | **0.15.0 enrichment** | 80+h | Photos + bios + past champions across drivers.json. |
| **10** | **B-perf catch-up** | 4-6h | Mobile-first perf audit, deferred since 2026-05-19. Targets in `docs/perf-baselines.md`. |
| **11** | **1.0.0 brand moment** | when ready | Reserve for feature-complete signal. |

### Per-series error inventory (operator-flagged at session close)

Status matrix as of 0.11.14 prod (operator browser-verified). "✅" = live + correct; "⚠️" = partial / data-quality issue; "❌" = not wired.

| Series | Standings | Results | Drivers (curated) | Notes |
|---|---|---|---|---|
| F1 | ✅ | ✅ | ✅ | All good. Sprint points fixed in 0.11.5. |
| F2 | ✅ | ✅ | ❌ | `content/series/f2/drivers.json` needed |
| F3 | ⚠️ | ⚠️ | ❌ | **Standings / results points DISAGREE** — addendum B4 had Ugochukwu 25 vs 26; needs deeper diagnosis. Also no drivers.json. |
| Formula E | ✅ (team line hidden) | ⚠️ | ❌ | R7-R10 (Berlin / Monaco) still winners-only — Wikipedia per-event articles are stubs. Curate `results-overrides.json` to backfill, then restore trend chart. No drivers.json. |
| IndyCar | ✅ | ❌ | ✅ | Results dispatch never landed — BLOCKED agent paste pending. |
| IMSA | ✅ | ❌ | ❌ | Results parser exists in `lib/results/imsa.ts` (winners-only per class) but dispatch not wired in 0.11.13 (would violate chart-vs-standings invariant). No drivers. |
| NLS | ❌ | ❌ | ❌ | DTM/NLS write-from-research bucket. NLS data thin upstream — see addendum 0.11.6 section. |
| DTM | ❌ | ❌ | ❌ | DTM/NLS write-from-research. Primary source: motorsport.com SSR. |
| GTWC | ✅ | ❌ | ❌ | Results parser exists in `lib/results/gt-world.ts` but emits no per-position points (SRO data limitation) — dispatch deferred per invariant. No drivers. |
| MotoGP | ❌ | ❌ | ❌ | BLOCKED agent had full Pulselive impl in report; paste pending. |
| WSBK | ✅ | ✅ | ❌ | All works. No drivers.json. |
| WRC | ✅ | ❌ (?) | ❌ | Operator reports results still unavailable — but PR #75 fix shipped. **Investigate first thing**: ISR cache stale OR fix incomplete. The fix swaps heading priority to `Results_and_standings` → `Season_summary`. Verified locally with cheerio against live HTML. No drivers.json. |
| NASCAR | ✅ | ⚠️ | ❌ | Results emit winners-only (no full classification). Same parser limitation as WRC + IMSA. No drivers.json. |
| FIA WEC | ✅ | ❌ | ❌ | Standings live as of 0.12.8 (PR pending). Results deferred to 0.12.8.1 — Stimulus XHR endpoint needs reverse engineering. Stash from `agent-leakage-2026-05-20-defer` was unusable (hallucinated URLs); fresh impl from fiawec.com SSR supersedes. |
| ADAC 24h | ❌ | ❌ | ❌ | Single-event series; future scope. |

**Patterns:**
- **drivers.json gap is 13 series** (everything except F1 + IndyCar). Folds into 0.12.0 bulk-commit.
- **Results "winners-only" pattern** affects NASCAR, FE (partial), and any future Wikipedia-season-page-only series. Each needs per-event scraping or curated overrides to satisfy the chart-vs-standings invariant.
- **WRC results post-#75** needs first-thing-tomorrow verification. If ISR cache stale, wait ≥1h or trigger a redeploy. If fix incomplete, debug with the node-script pattern used today.

### Working-tree state at session end

- Untracked: `docs/handoff-2026-05-20-session-end.md` (point-in-time snapshot from morning), `lib/results/gt-world.{ts,test.ts}` (orphan from agent — GTWCE results parser exists, dispatch deferred), `lib/results/imsa.{ts,test.ts}` (orphan — IMSA results parser exists, dispatch deferred).
- The two `lib/results/{gt-world,imsa}.{ts,test.ts}` files reference each series' standings file as a type import; they compile cleanly against current main. Safe to defer or commit as `chore: track GTWCE + IMSA results parsers (dispatch pending)`.

### Phase 1 research wave outcomes (2026-05-20 evening)

ESPA outcome from operator's "fix these 12 errors properly" directive: research-first, three phases. Phase 1 dispatched 12 parallel research-only agents (no Write, no worktree isolation) + a follow-up Flashscore evaluation. All briefs returned with live HTTP probes.

**Locked-in source picks per error-row series:**

| Series | Issue | Source | Conf |
|---|---|---|---|
| f3 | std/res disagree + drv | Migrate to `__NEXT_DATA__.RacePoints` like F2 | H |
| indycar | results | Wikipedia season Driver_standings table | M |
| formula-e R7-R10 | full-class + drv | motorsportweek.com per-event SSR | H |
| motogp | std+res+drv | Pulselive JSON API | H |
| wec | std+res+drv | fiawec.com `/en/page/manufacturers-classification` SSR | H |
| imsa | results full-class | **Alkamel Systems JSON API** at `imsa.results.alkamelcloud.com` | H |
| nascar-cup | full-class + drv | racing-reference.info per-race | H |
| gt-world | results | Existing parser + SRO points scale module (25-18-15-12-...-1 + 1.5× Paul Ricard + Spa 3-stage) | H |
| wrc | full-class + drv | Wikipedia per-rally articles (`/wiki/2026_Rally_de_Portugal` etc) | H |
| dtm | std+res+drv | motorsport.com/dtm SSR | H |
| nls | std+res+drv | **teilnehmer.vln.de PDF (no reCAPTCHA — prior audit wrong)** | H |
| f2 | drv only | 5-source cross-verified | H |

**Flashscore explicitly rejected as a source.** Probed `robots.txt` + `sitemap.xml` first. 100% SPA across 15 series — every standings/calendar/results URL returns 200 but zero data in initial HTML (no `__NEXT_DATA__`, no inline JSON, hydrated via undocumented `/x/feed/...` XHR). 4 series we need most (IMSA, GT-World, NLS, ADAC-24h) return 404 entirely. `robots.txt` bans CCBot/Bytespider/Diffbot/Meta/AI2Bot/cohere-ai/YouBot/etc. Stay away.

**Material findings that override prior assumptions:**

1. **NLS PDFs are direct-download.** Saturday 5/16 audit said reCAPTCHA-walled. False — `teilnehmer.vln.de/download.php?file=teilnehmer/Tabellenstaende/Klassensieger-Trophaee%202026.pdf` returns 200 + `application/pdf` over plain curl.
2. **racing-reference.info returns 200, not 403.** Stale code comment in `lib/results/nascar-cup.ts:6` is misleading. Full per-race classification with owner team available.
3. **IMSA has a clean official JSON API** at `imsa.results.alkamelcloud.com/Results/<season>/<event>/...JSON`. Beats the assumed PDF-behind-reCAPTCHA path. Wikipedia per-event articles cite Alkamel as their primary source. Sibling `05_Results by Class_Race_Official.JSON` pre-buckets data by class.
4. **WEC stash parser unusable.** Prior agent's stash@{0} used URLs invented from search snippets; 2/3 standings URLs are 404. Fresh impl from `fiawec.com /en/page/manufacturers-classification` (one SSR page hosts ALL standings) supersedes. Keep stash's types + race-ids + dispatch wiring; discard the parser code.
5. **F3 root cause:** `lib/results/f3.ts:33` Sprint scale `[15,12,10,8,6,4,2,1]` is wrong (correct: `[10,9,8,7,6,5,4,3,2,1]`) AND Melbourne SR was a half-distance red-flag race scoring 5-4-3-2-1 top 5 only. Fix = migrate both parsers to read `__NEXT_DATA__.RacePoints` (FIA-authoritative) like F2.
6. **Formula E R7-R10 have a clean upstream:** `motorsportweek.com/{YYYY}/{MM}/{DD}/formula-e-{YYYY}-{slug}-e-prix-race-{N}-results/` returns WP `wp-block-table` SSR with full 20-driver classifications. Beats both Wikipedia stubs AND curated overrides for these 4 rounds.

**Operator decisions locked via AskUserQuestion this session:**

- Multi-class crew schema: optional `carNumber` per `CuratedDriverEntry` (backwards-compatible).
- WRC schema: single entry per crew with new optional `coDriverName` field.
- MotoGP Manufacturers' Championship: skip for v1 (FIM aggregation rule out of scope).
- NASCAR results team field: owner team (`23XI Racing`), not manufacturer.

**Phase 2 PR sequence (locked — renumbered after theme toggle absorbed 0.12.0):**

| Ver | Scope | Source | Est |
|---|---|---|---|
| 0.12.0 | feat(theme) + chore: dark/light toggle + session wrap | n/a (CSS already dual) | shipped this PR |
| 0.12.1 | fix(f3) reconciliation | __NEXT_DATA__.RacePoints | ✅ shipped |
| 0.12.2 | feat(indycar) results | Wikipedia season Driver_standings | ✅ shipped |
| 0.12.3 | feat(formula-e) R7-R10 full-class via motorsportweek (chart restoration deferred) | motorsportweek.com | ✅ shipped |
| 0.12.4 | feat(motogp) standings + results | Pulselive JSON | ✅ shipped |
| 0.12.5 | feat(wec) standings + results | fiawec.com SSR | 2-3h |
| 0.12.6 | feat(imsa) full-class results | Alkamel JSON | 1.5-2h |
| 0.12.7 | feat(nascar-cup) full-class results | racing-reference.info | 1.5h |
| 0.12.8 | feat(gt-world) results + points module | SRO regs | 1-1.5h |
| 0.12.9 | feat(wrc) per-rally full-class | Wikipedia /wiki/2026_<Rally> | 2h |
| 0.12.10 | feat(dtm) standings + results | motorsport.com/dtm | 2h |
| 0.12.11 | feat(nls) standings + results | teilnehmer.vln.de PDF + Wikipedia | 2-3h |
| 0.13.0 | feat(drivers) bulk drivers.json × 13 series | per-series | multi-session |

**Process rules locked for Phase 2:**

- One PR per series. No bundling across series unless strictly necessary.
- Browser-verify on Vercel preview before merge (chart-vs-standings invariant gets explicit check).
- Tests against real fetched fixtures, not synthetic ones (yesterday's FE colspan bug shipped because fixtures didn't match real Wikipedia structure).
- No new abstractions until a real second consumer (per CLAUDE.md working agreement).

### Stale section retained for history — pre-2026-05-20 active workstream below

### Track A — legal/risk closure — DONE

All shipped today (2026-05-19) on top of the 19-PR Mon/Tue marathon. Versions 0.10.23 → 0.10.29 across 7 PRs.

| PR | Version | Item | Commit |
|---|---|---|---|
| #36 | 0.10.23 | **A1** — imprint + privacy postal address | `a5ddbfc` |
| #37 | 0.10.24 | imprint address line-break fix (markdown `<br>` rendering) | `fe73fb6` |
| #38 | 0.10.25 | **A2 + A3** — push-unsubscribe ownership + contact 12-month TTL | `db9e64b` |
| #39 | 0.10.26 | **A4a** — security headers (HSTS extend, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy) | `d414ef3` |
| #40 | 0.10.27 | **A4b** — ISR with 5-min revalidate on `/`, `/calendar`, `/blog` | `093f4bd` |
| #41 | 0.10.28 | **A5** — F1 history tab + content-authoring infrastructure | `29a965e` |
| #42 | 0.10.29 | markdown footnote anchor + byline date follow-up | `bcd4b39` |

**Scope delivered vs originally specified for A5:** the handoff envisioned A5 as Wikipedia-content removal + F1 / MotoGP / WEC content + infrastructure. Delivered: F1 only + infrastructure under `docs/content-authoring/`. MotoGP, WEC, and the remaining 12 series are parked under the content workstream below.

Two confirm-or-swap markers in legal markdown are RESOLVED (removed during A1, PR #36):
- Governing law / jurisdiction: Greece (Thessaloniki courts) — confirmed.
- Privacy contact email: `pparaskevas.dev@gmail.com` — confirmed.

### Active: Track B — SEO + GEO execution

Driven by `docs/audit-seo-geo-2026-05-19.md` (10-pillar discoverability audit, baseline `0.10.22`) + `docs/seo-geo-playbook.md` (152-doc Google Search Central synthesis, May 2026 source-truth reference). The audit + playbook are the strategy refs; this section is the **state of execution**.

#### ⏭ Next-session pickup — remaining Track B, in priority order

Pop into a new session and pick from the top:

| Priority | Bundle | Effort | Operator prerequisite | Notes |
|---|---|---|---|---|
| **1** | **B-perf** — mobile-perf pass | 4–6 h (multi-PR) | Baselines captured 2026-05-19 → `docs/perf-baselines.md`. | 4-PR sequenced plan in `SCHEDULE.md` Wed 2026-05-20 entry. Biggest levers (post-desktop-diagnostics): Clerk lazy ~225 KiB, 3rd-party deferral of AdSense+GTM+FundingChoices ~319 KiB, preconnect Clerk subdomain (90 ms LCP), CSS critical-path. Mobile-first indexing means this suppresses every other signal — load-bearing. Folds the pinned "Speed Insights US-perf" item. |
| **2** | **B-content** — fill 14 history + 15 rules tabs + 3–5 blog posts | 80–130 h (multi-session) | None | F1 history is the template (PR #41). Workflow + sources in `docs/content-authoring/README.md` + `SOURCES.md`. Suggested order: MotoGP → WEC → IndyCar histories first. |
| **3** | **B9** — server-render home + calendar bodies | 2–3 h | None | Helps both perf AND non-JS-aware LLM crawlers. Split `<HomeContent>` / `<FilteredSessions>` into server-side renderers. |
| **4** | **B10** — per-segment OG images | ~2 h | None | `app/series/[slug]/opengraph-image.tsx` + weekend variant. Folds B-discover's ≥1200×675 Discover-grade sizing. |
| **5** | **B-monitor** — operational runbook | ~30 min | None | Markdown only. New doc. |
| **6** | **B11** — path-based tab routes `/series/[slug]/[tab]` | 1–2 days | None | Deferred multi-day. When it lands, flip the canonical strategy from `?tab=X` to path with a one-line edit in `app/series/[slug]/page.tsx`. |
| **7** | **B12** — Greek `/el/` route tree | 3–5 days | None | Deferred multi-day. `next-intl`. |
| **8** | **B8b** — `SoftwareApplication` schema | parked | Real reviews exist (aggregateRating) | Builder intentionally not in `lib/json-ld.ts` yet. |

**Operator wait-and-watch** (no Claude work, just observe):
- **GSC Performance report** — populates ~24–72h after PR #51 deploy. Real queries Paddock matches, CTR, impressions, position.
- **Bing Webmaster Tools** — discovered-URL count should climb from 1 → 226 over the next few days as IndexNow + sitemap propagate.
- **Rich Results Test** on a deployed page — paste `/`, `/series/f1/weekend/9`, any blog post into [search.google.com/test/rich-results](https://search.google.com/test/rich-results). Expect Organization + WebSite + BreadcrumbList + SportsEvent + Article detected cleanly.
- **Bing Site Scan** results when complete (was "Queued" at last check; sitemap.xml-driven scan of all 226 URLs).

#### Research — DONE (three rounds)

1. **Session-start brief, 2026-05-19** — operator shared SEO Starter Guide + 15 GSC/AdSense/GA4 dashboards + PageSpeed mobile screenshots (Perf 39/100, LCP 5.2s, TBT 5340ms, 661 KiB unused JS). Fed into B1 priority decision.
2. **Self-review + targeted web search on PR #45** — covered llms.txt adoption reality, Google sitelinks playbook, GEO citation tactics, sitemap.xml best practices in 2026. Drove the B1 fix-up commit (`8178d05`) — dropped `lastmod`/`priority`/`changefreq`, fixed `host:` format, restructured llms.txt with `## Optional` section.
3. **Systematic 152-doc scan, PR #46** — 8 parallel research agents fed `docs/seo-geo-playbook.md`. Surfaced four new bundles + priority reshuffle + several "do not do" guardrails.

**Load-bearing findings carried forward:**

- **Sitelinks searchbox retired by Google 2024.** B8's `SearchAction` still helps site-name display but no longer drives the in-SERP search input. The audit's Appendix B framing of `WebSite + SearchAction` as the searchbox gateway is partially outdated.
- **Sitelinks mini-links realistic timeline: 6–12+ months**, not the 4–12 weeks cited in PR #44 docs. AI Overviews absorbing branded-search volume + algorithmic changes mean expect longer. Success metric for Track B is "**qualified** for sitelinks (structural prereqs shipped)", not "sitelinks displayed".
- **Bing Webmaster Tools submission is the GEO unlock** — ChatGPT search uses Bing's index, not Google's. New operator action item, not in any bundle.
- **`lastmod = new Date()` would train Google to ignore the field** — B1's omission decision is reaffirmed by Google's own `sitemaps/build-sitemap` doc. Do not add `lastmod` back until per-page change tracking is wired.
- **Mobile-first indexing means Perf 39/100 actively suppresses every other signal** — confirms B-perf precedence over B7/B8/B9.
- **Path-based tabs (B11) more urgent than originally positioned** — duplicate-title cannibalization across 9 `?tab=` variants is exactly the antipattern `title-link` doc warns against. Was bundle #11 in the audit; promoted to slot 6 in the post-playbook order.
- **`llms.txt` explicitly disclaimed by Google as "AEO hack"** but kept as a forward-compatible hedge for non-Google LLM crawlers (Cursor / IDE agents, OAI-SearchBot occasionally).

#### Shipped Track B (2026-05-19 — 7 PRs, versions 0.10.30 → 0.10.34)

| PR | Version | Bundle(s) | What |
|---|---|---|---|
| #44 | — | research | docs(track-b): research synthesis + B-perf bundle + sitelinks-timeline reset |
| #45 + fix-up `8178d05` | 0.10.30 | **B1** | `app/robots.ts` + `app/sitemap.ts` + `public/llms.txt`. Sitemap = 226 URLs. |
| #46 | — | research | docs(seo-geo): 152-doc Google Search Central playbook (`docs/seo-geo-playbook.md`) |
| #47 | — | research | docs(track-b): handoff refresh for execution phase |
| #48 | 0.10.31 | **B2 + B3 + B4 + B5 + B6 + B-discover** | noindex on /sign-in /sign-up /settings + nofollow on outbound news + per-route descriptions across 10 pages + `<time dateTime>` markup + RSS `<lastBuildDate>` / `<ttl>` / `<category>` / `<image>` + site-wide `googleBot.max-image-preview:large` |
| #49 | 0.10.32 | **Bing fixes + B7** | Home `<title>` lengthened to 57 chars + sr-only `<h1>` + tab-aware `generateMetadata` on `/series/[slug]` emitting per-tab title/description/canonical via new `describeTab()` helper |
| #50 | 0.10.33 | **IndexNow + canonicals** | Full IndexNow protocol implementation (`lib/indexnow.ts` + `scripts/submit-sitemap-to-indexnow.ts` + `npm run indexnow:submit` + key file at `public/<key>.txt`) + weekend page `alternates.canonical` + sharper `/blog` description. README.md rewritten from stub. |
| #51 | 0.10.34 | **B8 + RSS fix** | 5 Schema.org schemas (Organization + WebSite + BreadcrumbList + SportsEvent + Article) via new `lib/json-ld.ts` + `components/JsonLd.tsx` server component. RSS `<lastBuildDate>` no longer emits Unix epoch when posts empty. |

**External operator actions completed today:**

- ✅ Google Search Console — sitemap.xml submitted, Status: Success, 226 URLs discovered.
- ✅ Bing Webmaster Tools — sitemap.xml submitted, Status: Processing. Site Scan queued.
- ✅ Brave Search — home URL submitted via `search.brave.com/submit-url`. No further submission portal exists for Brave.
- ✅ IndexNow first push — 226 URLs accepted HTTP 200 (after the live key file went up post-PR-#50 deploy).
- ✅ Bing URL-inspector confirmed 0 SEO/GEO issues on `paddock-tracker.com/` after PR #49 deploy ("Live URL" tab).

**Still pending external:** GSC `metadata.verification` field in `app/layout.tsx` — 5-min add once DNS TXT lands externally.

**Audit items already covered by Track A — crossed off:**
- A4b shipped ISR on content routes (audit cheap-win 7).
- A4a shipped security headers (audit Pillar 1 partial).
- A5 shipped Wikipedia removal from History/Rules tabs for F1 (audit medium-lift 14 option (a) — F1 done; other 14 series + all Rules tabs are in B-content).

**Won't ever do (from playbook guardrails):** AMP (5 docs), Web Stories (3 docs, AMP-only), Carousel schema with closed inner-types, query-string locale variants, fake `lastmod`, JS-injected JSON-LD, `host:` in robots.txt, age gates blocking Googlebot.

### Parked: content workstream

F1 history shipped as the worked example of the per-series literacy-tab template. Workflow + sources documented in `docs/content-authoring/README.md` + `SOURCES.md` + `drafts/f1-history.md`. **All other content pages remain to be done.** Resume after Track B is largely landed:

- MotoGP, WEC, and the other 12 series History tabs (template + workflow are ready; each follows the F1 pattern).
- All 15 Rules tabs (`content/series/<slug>/rules.md` slot wired in `RulesTab.tsx`).
- `content/series/*/drivers.json` fill for all 15 series — currently absent, blocks `/drivers/[slug]` and `/teams/[slug]` (both 404 today; ~400 indexable URLs once filled).
- Driver / team page planning + content (shape, data sources, schema markup).
- 3+ blog posts under `content/posts/` to make `/blog` a real surface (currently empty state).

### Other pinned items carried over from the marathon close

- **AdSense approval still in progress.** Status was "Getting ready / Review requested" at the Mon/Tue close. When the AdSense console "Messages shown" counter goes 0 → ≥1, the CMP banner is live in production. If approval lands and the banner still doesn't fire, fallback is to reintroduce a custom in-app banner (git history under `feat/legal-pages` has the full `CookieBanner.tsx` from before 0.10.18).
- **Speed Insights US-perf investigation.** Skipped from the Mon/Tue plan. Dashboard at `https://vercel.com/<org>/motorsport/speed-insights` filtered by North America. Earlier suspicion: no US function region, `force-dynamic` everywhere, third-party fetch overhead. Note: `/`, `/calendar`, `/blog` are now ISR (post-A4b) — re-investigate against the new baseline. Standalone session when bandwidth allows.
- **Fotis sit-down on `docs/research/supabase-schema-draft.md`.** Was originally tonight's plan. May be in progress / done by next session — verify state before planning Track C work.

### Champions data is now complete end-to-end across all 15 series:

| Series | Driver coverage | Constructor coverage | Other sections |
|---|---|---|---|
| F1 | 1950–2025 | 1958–2025 | — |
| MotoGP | 1949–2025 | 1949–2025 (Manufacturers') | — |
| WSBK | 1988–2025 | 1988–2025 (Manufacturers') | — |
| WEC | 2012–2025 (no 2018) | 2012–2025 (Manufacturers') | — |
| IMSA | 2014–2025 (top class) | 2014–2025 (Manufacturers') | — |
| DTM | 1984–96 + 2000–25 | 1991–96 + 2000–25 (Manufacturers') | — |
| GTWC | 2014–2025 (Overall) | — | Endurance Cup 2014–2025 (3rd section) |
| F2 | 2005–2025 (GP2+F2) | 2005–2025 (Teams') | — |
| F3 | 2010–2025 (GP3+F3) | 2010–2025 (Teams') | — |
| ADAC | (Past Winners — singleEvent) | — | — |

No outstanding champions tasks. The 2-section / 3-section layout in `ChampionsTab` is the live shape.

## ⚓ Stale section retained for history — Sunday 2026-05-17 plan

**Priority 1 — Open PR #3 first thing.** Two commits are stuck on branch `feat/postponement-rendering-motogp-wec` and not yet on main. PR #2 was merged before these landed:

- `141de18` — `0.9.10` full-season session-time curation (15 new `sessions.json` files across all 14 series + ADAC 24h)
- `2778037` — `0.9.11` template-projected empty rounds (62 new override blocks across F1/F2/F3/MotoGP/WEC/DTM/GTWCE)
- `e94c13c` — `docs(schedule)` Saturday outcomes + Sunday plan (lighter, rides along)

Quick command:
```bash
gh pr create --base main --head feat/postponement-rendering-motogp-wec \
  --title "feat(series): full-season session times + template-projected empty rounds (0.9.10 + 0.9.11)"
```

Once merged, paddock-tracker.com auto-deploys real session times across all 15 series within ~90s. Then browser-verify with MotoGP Catalunya R6 (this weekend's race), IndyCar Indy 500 (May 24), F1 Canada (May 22-24), IMSA Detroit (May 29-30), WEC Le Mans (Jun 13-14).

**Priority 2 — Task #4 weather + news audit.** Never started on Saturday. For each of 15 series, click into the next upcoming weekend, confirm Open-Meteo weather block renders (venue-local date per `feedback-paddock-weather-venue-local`) and news feed populates. Output: list of gaps + curation pass for any series missing wiring.

**Priority 3 — Task #2 Supabase schema DDL draft.** Saturday produced the research (`docs/research/db-best-practices.md`) but not the actual DDL doc. Write `docs/research/supabase-schema-draft.md`: tables, columns, types, FKs, status lookup table, audit log, provenance columns (`source_id`/`fetched_at`/`verified_at`/`manual_override`/`content_hash`), time model (local + IANA tz + computed UTC instant). Ready for Tuesday Fotis sit-down.

**Pre-Fotis cutoff still active** ([[project-paddock-pre-fotis-cutoff]]): Mon/Tue 2026-05-18/19 is the deadline for the open-items push. New ideas → IDEAS.md Inbox only.

### Known data flags surfaced during Saturday curation (not yet fixed)

- **F1 Azerbaijan `rounds.json` `endDate: 2026-09-27`** but actual race is **Saturday Sep 26** (avoids Azerbaijan Remembrance Day). The PR #3 sessions.json correctly uses `matchDate: 2026-09-26` but rounds.json should be patched for consistency.
- **Miami F1 + F2 race times** in sessions.json reflect as-RUN (weather move) not as-scheduled. Acceptable.
- **DTM Norisring R4** intentionally TBC — its unique split-qualifying format (QF1A → Race 1; QF2B → Race 2) means session titles would be wrong with template times. Curate when ADAC publishes 2026 schedule (~3-4 weeks pre-event).
- **WRC stage detail** for Sweden, Safari Kenya, Japan, Greece, Estonia, Paraguay, Chile, Italy Sardegna, Saudi Arabia — official itineraries publish 4-6 weeks pre-rally.
- **GTWCE late-event detail, NASCAR + IndyCar mid-season practice/qualifying** — sources publish race-week, not annually. Stay TBC until then.

### Honest task state at end of Saturday

- ✅ #1 Per-series source audit (14 series) — done
- 🟡 #2 Apply DB practices → draft schema for our case — **research done, DDL doc skipped**, priority for Sunday
- 🟡 #3 Make every series calendar factually accurate — **work done locally on branch, awaiting PR #3 to reach main**; residual rounds intentionally TBC per above
- ⏳ #4 Wire weather + news into every round — **never started**, priority for Sunday
- ✅ #5 Research DB best practices — done (`docs/research/db-best-practices.md`)
- ✅ #6 Fix phantom Sat/Sun 03:00 — done (`0.9.9`)
- ✅ #7 Full-season session-time curation — done locally, awaiting PR #3
- ✅ #8 Template-projection fill for empty rounds — done locally, awaiting PR #3

---

## What shipped Saturday 2026-05-16 (massive session — 4 versions live + 2 versions stuck on branch)

**Morning (pre-cutoff sessions):**

- **`0.9.5`** (`110a378`) — `docs: triage + port handoff to docs/HANDOFF.md`. Created this file from per-user memory; memory file is now a redirect stub. IDEAS.md triaged.
- **`0.9.6`** (`a581bfa`) — `docs(0.9.6): handoff appendix — flat 60-item open-items inventory`. Added the appendix at the bottom of this file.
- **`0.9.7`** (`fa75ca3`) — `docs(0.9.7): per-prompt active-time tracking`. `[+Nm]` prefix protocol documented in `CLAUDE.md` Time tracking section + memory rule `feedback-paddock-time-tracking`.

**Afternoon + evening (the big Saturday push — pre-Fotis cutoff scoped):**

- **`0.9.8`** — PR #1 merged at `cd169b6`. **F1 cancellation render.** `content/series/f1/rounds.json` gains a `cancelledRounds[]` field; Bahrain (R4) + Saudi Arabian GP (R5) restored as cancelled entries with `originalRound`/`name`/`originalStartDate`/`originalEndDate`/`reason`/`rescheduleStatus`. New `components/CancelledRounds.tsx` exports `CancelledRoundsBanner` (compact strip near `/series/f1` page header) and `CancelledRoundsSection` (detailed cards at bottom of Calendar tab). URL stability preserved — `/series/f1/weekend/5` is still Canada, not shifted to Saudi. `SeriesRoundEntry` extended with `previousStartDate` / `previousEndDate` / `rescheduleNote` for rescheduled rounds.
- **`0.9.9`** — PR #2 merged at `e0d93cf`. **Three coherent layers in one PR.**
  1. **MotoGP `rounds.json`** (22 rounds incl. Qatar Apr→Nov 6-8 postponed, Portugal Nov 13→20-22 cascade, Valencia Nov 20→27-29 cascade). **WEC `rounds.json`** (8 rounds incl. Qatar 1812km Mar→Oct 22-24 postponed, Imola promoted to R1, Prologue moved to Imola Apr 14).
  2. **Postponement rendering UI** — `rescheduled` pill + amber `Rescheduled from <date> · <note>` line in `WeekendBlock` (calendar tab cards) + `WeekendHero` (weekend detail page). Pairs with the cancellation banner from `0.9.8`. `Weekend` type extended with `previousStartDate` / `previousEndDate` / `rescheduleNote`; `lib/rounds.ts` copies these onto matched weekends.
  3. **Midnight-UTC `dateOnly` detection** in `lib/ics.ts`. Many non-F1 ICS feeds (Google Calendar exports, ECAL, scraper-built) emit race weekends as `DTSTART:YYYYMMDDT000000Z` — midnight UTC with a time component — rather than `DTSTART;VALUE=DATE`. The `0.9.1` `dateOnly` fix only caught the explicit `VALUE=DATE` form. In Europe/Athens (UTC+3 in summer) midnight UTC rendered as "Sat 03:00" — gave the impression races started at 3 am. Parser now treats entries with both start + end at UTC midnight boundaries as effectively date-only → renders "TBC" honestly. 2 new test cases in `lib/ics.test.ts`. **Non-F1 ICS feeds now render TBC honestly across the site.**

**Stuck on branch `feat/postponement-rendering-motogp-wec` — needs PR #3 Sunday:**

- **`0.9.10`** (commit `141de18`) — **Full-season session-time curation across all 14 series + ADAC 24h.** Five parallel research agents produced 15 new `content/series/<slug>/sessions.json` files with venue-local→UTC datetimes for every published 2026 session. Sources cited inline in agent outputs (motogp.com, formula1.com, fiawec.com, worldsbk.com, imsa.com, indycar.com, jayski.com, fiaformulae.com, wrc.com, dtm.com, nuerburgring-langstrecken-serie.de, 24h-rennen.de + Wikipedia + motorsport.com cross-references). Coverage at commit time: F1 14 rounds; F2 4; F3 2; MotoGP 19; WSBK 12; WEC 9 matchDate blocks; IMSA 11; GTWCE 7; IndyCar ~12; NASCAR 36 + Clash + Duels + All-Star; ADAC 24h complete; FE 17; WRC Monte Carlo + Croatia + Portugal + Finland full per-stage; DTM 1; NLS all 10.
- **`0.9.11`** (commit `2778037`) — **Template-projected empty rounds** for series with rigid weekend formats (~95% confidence). F1 +8 rounds (Britain/Netherlands/Azerbaijan/Singapore/USA/Brazil/Qatar/Abu Dhabi); F2 +10; F3 +7; MotoGP +3 (post-postponement cascade); WEC +14 matchDate blocks (R4-R8); DTM +6 (R2-R8, R4 Norisring intentionally empty); GTWCE +14 blocks (R3/R6/R7/R9/R10). F1 R9 Britain now renders Fri/Sat/Sun real session times instead of TBC.

**Research docs shipped this session (live on main via PR #2):**

- `docs/research/db-best-practices.md` — Postgres/Supabase schema patterns synthesizing 30+ sources. Status lookup table vs ENUM, time model (local + IANA tz + computed UTC instant with CHECK), source provenance columns, audit log shape with `material` flag, RLS recommendations, anti-patterns. Sets up Tuesday Fotis sit-down.
- `docs/research/per-series-source-audit.md` — Source-by-source audit of all 14 series + ADAC 24h. Identifies **Jolpica F1 API** (`api.jolpi.ca/ergast/f1/`) + **Pulselive MotoGP/WSBK** (`api.motogp.pulselive.com/motogp/v1`) as the two free JSON-API upgrades to replace current ICS scraping. Everything else stays HTML scrape or curation. Includes 2026 cancellation/postponement summary across all series.
- `docs/research/ingestion-resource-evaluation.md` — 5-link RapidAPI evaluation. Verdicts: **skip Sportbex** (betting odds only), **adopt TheSportsDB as fallback** for niche series, **borrow `maxgubler/indycar-calendar` playbook heavily** (API-key harvest from SPA HTML, diff-before-write, cancellation handling), skip `armagantrs/race-calendar` (born-dead scaffold).

**RapidAPI probing (not in shipped docs, mid-session investigation):**

- **AllSportsApi v2** (`allsportsapi2.p.rapidapi.com`) — Sofascore-clone, **does cover motorsport** with 13 categories: F1 (uniqueStage 40), MotoGP (17), Moto2 (15), Moto3 (16), WSBK (28), Formula E (68), WRC/Rally (36), IndyCar (67), NASCAR (Sprint Cup 18 / Camping World 82 / Xfinity 81), DTM (10), Indy Lights, Bikes, International. Working endpoints: `/api/motorsport/categories`, `/api/motorsport/stage/scheduled/{date}`, `/api/motorsport/unique-stage/{id}/season`, `/api/motorsport/stage/{stageId}/substages`, `/api/motorsport/category/{id}/stages/all`. Schema integration **deferred** — promising lead for the future automated refresh cron once Supabase lands. OpenAPI spec at `github.com/lacassef/recodexapicodeexamples/blob/master/allsportsapi/openapi/motorsport_openapi.yaml`.

**Memory state at session end:**

- `project-paddock-pre-fotis-cutoff` — active, expires 2026-05-19 after Fotis sit-down
- `feedback-paddock-time-tracking` — `[+Nm]` prefix protocol (added `0.9.7`)
- All other feedback rules unchanged.

**Saturday commit count:** 4 merged to main (`f7f2aaa`, `cd169b6` merge, `a56c467`, `e0d93cf` merge) + 3 stuck on branch (`141de18`, `2778037`, `e94c13c`).

## How to use this file

- **Session start:** read this file first (after CLAUDE.md). Then `IDEAS.md` (Now / Next) and `SCHEDULE.md` (today's plan).
- **Mid-session:** don't edit. Use `IDEAS.md` Inbox for new ideas, `TaskList` for in-flight work.
- **Session end:** update the "what shipped last session" block + infra ledger. Bump the timestamp if you make non-trivial changes. Trim "loose items" or move them to `IDEAS.md` Inbox as they accumulate.
- **Never:** duplicate state across `IDEAS.md` and this file. IDEAS.md is the *queue*; this file is the *snapshot of where the project is now*.

---

## Appendix — flat open-items inventory (snapshot 2026-05-16)

Single flat enumeration of every open item known at the close of `0.9.5`. The sections above (Sessions roadmap / Loose items / Open design questions / Infra ledger) reorganise the same substance by lifecycle. The flat list exists so a contributor can scan the whole pile in one pass without jumping between sections.

Items marked **DONE** were shipped during the 2026-05-16 session and remain here for traceability — they will be pruned when the appendix is next refreshed.

1. Migrate sessions, standings, results, news, weather, drivers, and teams to a Supabase-backed data layer with scheduled scrapes per series.
2. Research existing public motorsport data sources (Ergast/jolpica for F1, MotoGP web API, FIA feeds, third-party aggregators) before building scrapers from scratch.
3. Curate `sessions.json` with real session hours for every non-F1 series (MotoGP, WEC, F2, F3, IndyCar, IMSA, WSBK, WRC, DTM, GT World, NASCAR Cup, NLS, ADAC Ravenol 24h).
4. Curate `rounds.json` per non-F1 series so FIA-canonical round numbers replace the array-index fallback.
5. Research and document live in-race data sources (sector times, leaderboard, gaps, tyre choices) for F1, MotoGP, WEC, FE, IndyCar.
6. Reverse-engineer fiaformulae.com, motogp.com, nascar.com XHR endpoints to see if unsigned JSON can substitute Playwright scraping.
7. Decide between Vercel Sandbox/Playwright, third-party aggregator, and curation-first for JS-rendered official sites.
8. Replace the planned KV data-watch framework with Supabase-backed watchers that drive an admin push channel and a Claude-curation queue.
9. Add `app/sitemap.ts`, `app/robots.ts`, JSON-LD (`SportsEvent`, `Organization`, `Person`, `BreadcrumbList`), per-page `generateMetadata`, OG image generators, and canonical URLs.
10. Implement a fan-intent keyword strategy across series, weekend, driver, and team pages (schedule, programme, where to watch, live stream, timetable).
11. Enrich `/drivers/[slug]` with Wikipedia bio, current standings position, last 5 results, and news mentions.
12. Enrich `/teams/[slug]` with the same shape.
13. Redesign F1 History tab or replace with curated `content/series/f1/history.md`.
14. Improve Rules tab with an FIA PDF link and a "common topics" surface.
15. Implement `lib/results/<slug>.ts` and `lib/standings/<slug>.ts` for MotoGP, WEC, IndyCar, NASCAR.
16. Audit endurance-series weekend grouping (WEC, IMSA, NLS, ADAC 24h, multi-day tests) for `groupByWeekend` mis-splits.
17. Add a custom `app/error.tsx` page.
18. Integrate Sentry for error monitoring.
19. Add `/api/cron/health` that summarises last-run timestamps for every cron job.
20. Run a Lighthouse and Speed Insights perf audit and act on findings.
21. Fix the nine legacy ESLint errors and add a husky pre-commit hook.
22. Add component tests with vitest + Testing Library.
23. Add Playwright E2E tests that run on Vercel preview deploys.
24. Build a comments thread (Clerk-gated) on race-weekend pages.
25. Build predictions with an open → locked-at-session-start → resolved-after-race state machine.
26. Build paddock-coins ledger and leaderboard.
27. Write a public README with screenshots and a Mermaid architecture diagram.
28. Write the first 2–3 MDX blog posts.
29. Persist active news-filter chip across page reloads.
30. Run a mobile-first UI/UX audit using the `tailwindcss-mobile-first` patterns.
31. Run a WCAG 2.2 AA accessibility audit and fix gaps.
32. Polish motion, focus states, and dark-mode contrast across the site.
33. Do another "Claude design" depth pass for background warmth and global theming.
34. Run user research via a site survey, conversations with fans, and subreddit pain-point mining.
35. Add per-event-type push notifications (qualifying topper via RSS filter, race winner, championship-deciding event).
36. Make the push click handler deep-link to a specific session or article instead of always opening `/`.
37. Build a Settings "Your devices" list with per-device test and remove buttons.
38. Send hero images in `payload.image`, sourced from curated circuit JPEGs or motorsport.com thumbnails.
39. Investigate per-series Champions JSON to fix the fragile parser (F1 wrong points column, F3 all zero, MotoGP brittle redirects).
40. Delete unused `lib/onboarding.ts` (only wizard-reopen consumer).
41. DRY the duplicated logic between `EnableNotifications` and `OnboardingWizard`.
42. Retheme the Clerk sign-in and sign-up pages to Paddock dark.
43. Add a `WeekendMedia` section to `/series/<slug>/weekend/<round>` fed by `content/series/<slug>/media.json` (YouTube highlight reels, blog cross-links, onboard clips).
44. Choose an embedded-video provider (YouTube iframe vs Mux vs Cloudflare Stream).
45. Add a Tracks/Circuits view per series with a map.
46. Make the home hero show the next 2–3 sessions when all are imminent.
47. Make session cards tap-to-expand to broadcast info, streaming, and track details.
48. Add a per-driver season-trend chart to `/drivers/[slug]`.
49. Add era markers and sparklines to the Champions tab.
50. Fold `overview.md` content fully into the F1 About tab.
51. Surface "common topics" on the Rules tab.
52. Install Resend Marketplace and wire `RESEND_API_KEY` + `CONTACT_TO_EMAIL` so contact-form submissions email out.
53. Rotate `sk_live_*` Clerk keys.
54. **DONE (`0.9.2` + `0.9.3`)** — Bootstrap a real `CLAUDE.md` operating manual.
55. **DONE (`0.9.2`)** — Scaffold `IDEAS.md` with Inbox / Now / Next / Parked / Killed sections seeded from this list.
56. **DONE (`0.9.3`)** — Encode the time-plan-at-start, capture-mid-session, triage-at-end workflow in `CLAUDE.md` as a best practice.
57. Investigate residual `00:00` string on `/series/f1/weekend/5` to confirm it is a legit time or remove a stale fake.
58. Visually verify the Canada round-5 page and FE Monaco weekend in a real browser (Playwright was locked during the 0.9.1 verification pass).
59. **DONE (`0.9.1`)** — Commit the bundled PR (3 am fix + sessions.json overrides + rounds.json infra + FE Monaco curation + F1 rounds curation + tests).
60. **DONE (`0.9.5`)** — Update the handoff with the Supabase initiative reframing S4 and the live-race-data ambition.
