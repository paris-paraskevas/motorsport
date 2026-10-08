# Paddock — v1.0 launch checklist

The pre-flight gate + launch-day runbook + rollback plan for taking Paddock out of "soft launch" and calling it **1.0.0**. Part of the **W8 launch program** (see `IDEAS.md` NOW §3).

**Reframe worth knowing:** there is **no "beta"/"early access" badge in the app today** (grep-verified 2026-07-06, still true 2026-08-24 — nothing in `components/` or the wordmark says beta). So "out of early access" is an **announcement**, not a removal. The shippable unit is `LAUNCH_ANNOUNCEMENT.active` in `lib/site.ts` (ships dark; `components/LaunchBanner.tsx` renders nothing while it is false) + the `1.0.0` bump, flipped together on the chosen launch day.

**How to use:** work top-to-bottom. Every box in **§A** must be ✅ before the **§B** flip. `[ ]` = to verify at launch time; `[x]` = verified true, with the evidence beside it (re-verify at launch — feeds move).

> **Restored and de-staled 2026-08-24.** This file was deleted by the Cloudflare migration commit (`243013a`) while `lib/site.ts:43` still pointed at it, so the banner's own instructions referenced a missing document for a month. It came back from `243013a^`.
>
> **Four gates were not merely unticked, they were FALSE** — they described Vercel, and a checklist that asserts wrong facts is worse than a missing one. Deleted rather than left to mislead:
> - ~~"`next.config.ts` keeps BOTH `serverExternalPackages: ["node-ical"]` AND `outputFileTracingIncludes`"~~ — **neither is in the file.** `serverExternalPackages` survives only in a comment (`next.config.ts:8`, describing what the Serwist wrapper adds); `outputFileTracingIncludes` appears nowhere, and prod is healthy. Output-file tracing stopped mattering when content moved to a build-time bundle (`scripts/bundle-content.mts`) because workerd has no `fs`. **`CLAUDE.md` landmine #1 still states this and is stale.**
> - ~~"Middleware is `proxy.ts` (Next 16), not `middleware.ts`"~~ — **backwards now.** The file is `middleware.ts`; there is no `proxy.ts`. The migration renamed it back because OpenNext needs the Edge runtime, which is why every build warns `The "middleware" file convention is deprecated` and why that warning must not be "fixed".
> - ~~"the 12 GitHub Actions workflows"~~ — `.github/workflows/` holds **one** file, `warm-live-data.yml`. The 13 cron jobs are **Cloudflare cron triggers** in `wrangler.jsonc`.
> - ~~"Vercel KV" / "Vercel Speed Insights" / "Vercel preview" / "Vercel dashboard → promote"~~ — none of these exist. Corrected in place below.

---

## §A — Pre-flight gates (all green before 1.0)

### A1 · Product & content completeness
- [x] **15 series live** (`content/series/*`): adac-ravenol-24h, dtm, f1, f2, f3, formula-e, gt-world, imsa, indycar, motogp, nascar-cup, nls, wec, wrc, wsbk.
- [x] **W1 weekend overhaul** — timing-screen language, per-session pages, point-in-time standings (shipped).
- [x] **W3 About/rules ×15** — rules essentials folded into About (shipped 0.31.0).
- [x] **W4 driver + team profiles** — team points-trajectory chart, F1 portraits 22/22, cross-series slug fix (#401–#405).
- [x] **Every driver has a biography** across F1, MotoGP, IndyCar, Formula E, WSBK and endurance (0.257.0–0.262.0).
- [x] **Smoke every series once — RUN ON PROD 2026-08-24.** All **132** series URLs (15 series × their real tab sets, generated from the app's own `tabsFor()` so the single-event trim and the F1-only Rounds gate cannot drift): **every one HTTP 200**, and none contained an error boundary, `Application error`, a Wikipedia CSS leak (`mw-parser-output` / `infobox-`), `temporarily unavailable`, the retired `Coming soon`, `[object Object]`, a literal `undefined`, or `NaN`.
  - **Two outliers were checked in a real browser rather than trusted from HTML**, because the record already carries two false "renders empty on prod" reports that were probe-before-hydration errors. `f1/champions` renders in full (76 champions, decade groups back to 1950) — the raw-HTML "no table cells, no list items" signal was a fault in the *detector*, since these pages are div-based. `nls/standings` degrades honestly with *"Nothing here yet for this series."*, the copy 0.334.8 shipped.
  - Re-run before launch only if a series' data source has changed since; the pass is cheap and scriptable.
- [ ] **No placeholder-only surfaces on the default home** — Up-next and Just-missed populate for a signed-out visitor.

### A2 · Correctness invariants
- [ ] **Chart == standings** for every series shipping a season-trend chart (locked invariant at the top of `CHANGELOG.md`). Spot-check the F1, F2, F3 and MotoGP leaders against the Standings tab.
- [ ] **F1 upgrades** — the latest curated round in `content/series/f1/upgrades.json` matches the most recent FIA "Car Presentation Submissions" document. (The original note here named R10/Belgium and a July date; check the current round rather than trusting any figure written in this file.)
- [ ] **Predictions economy** — no market shows an impossible multiplier; the house band (MIN 1.3 / MAX 30) holds. Play-money only.

### A3 · Infrastructure — Cloudflare, not Vercel
- [ ] **Crons green** — 13 **Cloudflare cron triggers** (`wrangler.jsonc` → `triggers.crons`) fan out to `/api/cron/*` via `scheduled()` in `worker.ts`. Check `/api/cron/health` for last-run timestamps. All **fail-closed** (`lib/cron-auth.ts`: missing `CRON_SECRET` → 503, wrong → 401). **Only production carries triggers** — previews deliberately have none, because the crons must fire exactly once.
- [ ] **The data warmer has run with the current parsers** — `scripts/warm-live-data.mts` is the ONLY writer of the site's series data (`warm-live-data.yml`, GitHub Actions, clean IP). The Worker runs `DATA_SOURCE=db` and never calls those upstreams, so a parser change is unproven until the warmer has run with it.
- [ ] **Worker bundle under the ceiling** — `wrangler deploy --dry-run`, against Cloudflare's hard 10240 KiB gzipped limit. Last measured **9567.69 KiB, 672.31 KiB of headroom** (2026-08-24). A deploy that exceeds it is rejected outright, which would be a launch-day outage.
- [ ] **Clerk production** — publishable key keeps its `NEXT_PUBLIC_` prefix; the prod instance is live (not a dev `pk_test`).
- [ ] **KV reachable** — env vars are unprefixed (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) and the store is Upstash. Reject any provisioning flow that prefixes them; the code reads those exact names.
- [ ] **Supabase prod** — blog/threads/predictions tables on project `dzelqrtajnauunzmxfic`, not the local `127.0.0.1` DB. Any pending migration applied. **Previews share this database**, so a preview mutation writes prod data.

### A4 · Discoverability / SEO
- [x] **`sitemap.ts` + `robots.ts` + `llms.txt`** shipped; sitemap submitted to GSC and Bing (Bing re-validated 2026-08-20).
- [x] **Blog SEO** — self-referencing canonicals, real `lastmod` and a real `dateModified` (0.334.22); verified on prod, 24/24 blog URLs carry `lastmod`.
- [ ] **Fresh sitemap ping** — `npm run indexnow:submit` after the 1.0 deploy so the new banner/OG state is re-crawled.
- [ ] **OG/Twitter cards** render for `/`, `/app`, a `/series/<slug>` and a `/blog/<slug>`. Note these are generated at request time by the OpenGraph runtime, which is ~618 KiB of the Worker bundle — if that ever gets pre-generated or split out, re-check this gate.
- [ ] **GSC coverage** — no spike in "excluded / crawl error" since the last check.
- [ ] **A tab with no data still promises data in its metadata**, which feeds the open AdSense "low value content" case. `/series/nls/standings` renders the honest *"Nothing here yet for this series."* but its `<title>` and description (from `describeTab` in `lib/tabs.ts`) still advertise "the full drivers' and constructors' championship tables with points, wins and gaps, plus a season trend chart". The page is honest; the SERP entry is not. Decide before launch whether an empty tab should carry reduced metadata or `noindex`, the way the news tabs went in 0.334.8.

### A5 · Performance
- [x] **PSI sweep done 2026-08-20** — 10 pages, operator-run, table in `docs/perf-baselines.md`; four fix packages shipped from it (0.322.4, 0.322.5, 0.323.0, 0.323.1).
- [ ] **Re-measure root + standings + weekend** to capture the deltas from those fixes (the one piece of the sweep still owed).
- [ ] **No console errors _other than the one deliberate block_** on `/`, `/app`, `/calendar`, a series page and a weekend page, anonymous and signed-in. **Measured 2026-08-24: every ad-bearing page logs exactly one error**, and it is on purpose — `fundingchoicesmessages.google.com` is blocked by the CSP because our own modal owns consent. `next.config.ts:32-39` says in terms not to "fix" it by allow-listing the origin, so as originally written this gate could never go green. Treat one Funding Choices CSP error as the expected baseline and look for anything *else*.
- [ ] **Preloaded-but-unused images** — `/series/f1/champions` warns four times that Wikimedia portraits were `link preload`ed and then not used within seconds of load. Warnings, not errors, and not a launch blocker, but it is wasted bandwidth on a page that preloads four ~500 KB images it may not paint. Worth a look with the image session.

### A6 · Legal / compliance
- [x] **6 legal pages live** — `/privacy`, `/terms`, `/cookies`, `/accessibility`, `/do-not-sell`, `/imprint`.
- [x] **The legal pages are TRUE**, which they were not until recently: the privacy policy was false in seven places and `/do-not-sell` documented a CCPA route that had not existed since 0.12.6 (both rewritten, 0.334.0 / 0.334.1). Cloudflare Web Analytics was undisclosed until 0.334.6.
- [x] **Cookie consent** — Consent Mode v2 defaults denied; our own modal owns consent (Google's Funding Choices is deliberately blocked by the CSP). **GPC is honoured** as of 0.334.0, which was a published promise with no code behind it before.
- [ ] **Predictions disclaimers** — no-cashout / play-money framing present on `/social` and every betting surface. Marketing must not imply real gambling.
- [ ] **Contact path works** — `/feedback` and the contact form deliver to `pparaskevas.dev@gmail.com` (`CONTACT_TO_EMAIL`). Previews cannot send: no `RESEND_API_KEY` by design, so test on prod.
- [ ] **AI "Race Engineer" assistant — currently OFF, and turning it on is a two-file change.** Verified 2026-08-24: no launcher in prod HTML, and `components/assistant/AssistantWidget.tsx:218` returns null unless `NEXT_PUBLIC_ASSISTANT_ENABLED === '1'`. **The trap:** `content/legal/privacy.md:62` now states *"The in-app assistant is currently switched off and is not reachable from any page"*. Flipping the env var alone makes the privacy policy false the moment it deploys, so the policy line and the flag must move in the same change. Going live also needs `GOOGLE_GENERATIVE_AI_API_KEY` + `ASSISTANT_MODEL` as **Cloudflare Worker secrets**, and `NEXT_PUBLIC_*` inlines at build, so setting it requires a redeploy.

### A7 · Security
- [x] **Security audit done** (`docs/research/security-audit-2026-06-11.md`, re-verified 2026-06-21).
- [x] **Crons fail-closed** (`lib/cron-auth.ts`) — missing secret → 503, wrong → 401. Never "restore" fail-open; that was the pre-0.9.17 vulnerability.
- [x] **CSP ENFORCES** as of 0.334.17, after the report stream came back clean. A wrong directive now breaks pages rather than logging, so treat `next.config.ts`'s CSP as production code.
- [x] **Response headers** — HSTS with `includeSubDomains; preload`, `Permissions-Policy` denying camera/mic/geolocation/FLoC/Topics, `Referrer-Policy`, `nosniff`, `X-Frame-Options: SAMEORIGIN`.
- [ ] **Rotate secrets** — Clerk `sk_live_*` and `.supabase-pat` (operator-owed carry-over; the PAT is live and was last used 2026-08-21).

### A8 · Monitoring
- [x] **Cloudflare Worker observability enabled** (`wrangler.jsonc` → `observability`, `head_sampling_rate: 1`). Without it a production 500 leaves no trace at all, so this is the log path for the first 48h.
- [x] **`/api/cron/health`** — summary endpoint exists.
- [ ] **Server-side error reporting is a KNOWN GAP, accept it or close it before launch.** The Sentry build wrapper and server SDK came off in 0.288.0 for Worker size, and the browser SDK in 1.0.230 (X9: it had no DSN and reported nothing); an exception surfaces only in Cloudflare's logs and the browser console. `app/(app)/error.tsx` and `app/global-error.tsx` report to nothing. Decide: reintroduce reporting, or launch knowing this and watch the logs.

---

## §A9 · The 1.0 announcement surface — OPERATOR REQUIREMENT, 2026-08-24

**Verbatim:** *"if we go to version 1, we will need a banner with animations and clear explanation of everything in version 1 and what to expect in later versions."*

This is a **blocking prerequisite**, not launch-day polish. What exists today is `LAUNCH_ANNOUNCEMENT` in `lib/site.ts` + `components/LaunchBanner.tsx`: a single dismissible line reading *"Paddock is out of early access — welcome to 1.0."* with a CTA to `/changelog`. That is not an explanation of anything, and `/changelog` is an audit trail, not a pitch. So:

- [ ] **An animated announcement banner.** Motion must be **CSS, authored, and in the Paper/telemetry idiom** — no generic fade-in-on-scroll, no gradients, no library. A JS animation library is not needed and a client-side one still costs the browser bundle. **`prefers-reduced-motion` must be honoured**, or it undoes the accessibility work of 0.226–0.227.
- [ ] **A "what 1.0 is" page** — everything the site does now, grouped by capability rather than by release, because a reader does not care that biographies landed in 0.257.0. The 15 named releases from 0.334.30 are the raw material; the page is the edited version of them.
- [ ] **"What to expect later"** — a stated, honest roadmap. Anything named here becomes a promise, so it takes the operator's sign-off per item; better three things that ship than ten that rot. Nothing on it may depend on per-visitor personalisation of `/app`, which the ISR cache contract rules out.
- [ ] **The banner's dismissal is keyed by `LAUNCH_ANNOUNCEMENT.id`** — keep `'v1.0'` for this one and bump it for any later announcement, or people who dismissed 1.0 never see the next.
- [ ] **Decide where the page lives.** `/changelog` already renders releases and would fight it; a new route is cleaner and is a new indexable surface. **Needs the operator's file/route approval before it is built.**

---

## §B — Launch-day runbook (the flip)

1. **Confirm §A is all green, §A9 included.** Any red box → not launch day yet. The banner and the "what 1.0 is" page ship and get verified on a real Worker *before* the version bump, so the flip is one small commit rather than a launch and a build at once.
2. **One commit, on a branch → PR → squash-merge** (never push to `main`):
   - Flip `LAUNCH_ANNOUNCEMENT.active` → `true` in `lib/site.ts` (banner goes live). Keep `id: 'v1.0'` — dismissal is keyed by it.
   - Bump `package.json` `version` → **`1.0.0`**.
   - `CHANGELOG.md` + `RELEASES.md`. Under the release scheme adopted in 0.334.30, 1.0 opens a **new release header** in `RELEASES.md`: `# 1.0 · <Name>` with a 1–3 sentence story, then the `## 1.0.0 — <date>` entry beneath it. Do not author the date range or version span into the prose; both are derived.
3. **Verify on a real Worker, not localhost.** There is no per-PR preview URL (a Worker implementing Durable Objects gets none), and the preview copies were deleted on 2026-10-07, so check on the live site after the daily deploy: banner renders, dismiss persists across reload, `/changelog` shows 1.0.0 as "currently running".
4. **Merge → prod deploys in ~5–7 minutes.** Merging *is* the deploy; there is no separate step and **no GitHub Actions run to watch**, so poll `/changelog` until it reports 1.0.0. Then re-verify on prod: banner, a clean anonymous home, a signed-in home.
5. **`npm run indexnow:submit`** to re-crawl.
6. **Fire the marketing posts** per `docs/research/2026-07-06-launch-marketing.md`, in the sequenced order there. Don't blast every channel at once; stagger so you can react.

## §C — Rollback

- **Banner/version only:** revert the flip commit, or set `LAUNCH_ANNOUNCEMENT.active = false` and ship that. The banner is client-gated, so it clears on the next load.
- **A bad deploy:** the authoritative path is a **revert PR** — `CONTRIBUTING.md` states there is no undo beyond one, and it deploys like any other merge (~5–7 min). Cloudflare's own deployment rollback may also be available from the dashboard or `wrangler rollback`, but **that has never been exercised on this project**, so do not plan around it on launch day without testing it first.
- **A marketing misfire:** the posts are the only irreversible step (screenshots persist). That is why §B step 6 is **last** and **staggered** — nothing external goes out until prod is confirmed healthy.

## §D — First-48h watch

- [ ] **Cloudflare Worker logs** — no error spike (this is the only server-side signal; see A8).
- [ ] `/api/cron/health` — crons still firing on schedule.
- [ ] Sign-up funnel — new accounts arriving without errors (Clerk dashboard).
- [ ] Feedback board and contact — triage inbound within the day; a launch surfaces bugs the soft period didn't.
- [ ] Credits/settlement crons survive the traffic bump.
- [ ] **Worker bundle** — if a hotfix adds a dependency, `wrangler deploy --dry-run` before merging it. A rejected deploy during a launch window is the worst time to discover the ceiling.
