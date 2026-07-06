# Paddock — v1.0 launch checklist

The pre-flight gate + launch-day runbook + rollback plan for taking Paddock out of "soft launch" and calling it **1.0.0**. Part of the **W8 launch program** (see `IDEAS.md` Next §4).

**Reframe worth knowing:** there is **no "beta"/"early access" badge in the app today** (grep-verified 2026-07-06 — nothing in `components/` or the wordmark says beta). So "out of early access" is an **announcement**, not a removal. The shippable unit is the `LaunchBanner` (ships dark behind a flag) + the `1.0.0` version bump, flipped together on the chosen launch day.

**How to use:** work top-to-bottom. Every box in **§A** must be ✅ before the **§B** flip. `[ ]` = to verify at launch time; `[x]` = already true as of the last edit (re-verify at launch — feeds move).

---

## §A — Pre-flight gates (all green before 1.0)

### A1 · Product & content completeness
- [x] **15 series live** (`content/series/*`): adac-ravenol-24h, dtm, f1, f2, f3, formula-e, gt-world, imsa, indycar, motogp, nascar-cup, nls, wec, wrc, wsbk.
- [x] **W1 weekend overhaul** — timing-screen language, per-session pages, point-in-time standings (shipped).
- [x] **W3 About/rules ×15** — rules essentials folded into About (shipped 0.31.0).
- [x] **W4 driver + team profiles** — team points-trajectory chart (all-constructors), F1 portraits 22/22, cross-series slug fix (shipped #401–#405, the last launch gate).
- [ ] **Smoke every series once** — open each `/series/<slug>`, confirm Overview/Standings/Results/Champions render or degrade honestly (no raw error, no Wikipedia CSS leak). Fast pass: the 4 charted-invariant series first (F1/F2/F3/MotoGP), then the rest.
- [ ] **No placeholder-only surfaces on the default home** — Up-next + Just-missed populate for a signed-out visitor.

### A2 · Correctness invariants
- [ ] **Chart == standings** for every series shipping a season-trend chart (locked invariant in `CHANGELOG.md`). Spot-check F1, F2, F3, MotoGP leaders against the Standings tab.
- [ ] **F1 upgrades** — latest curated round matches the most recent FIA "Car Presentation Submissions" doc (currently R1–R9; R10 Belgium doc drops ~Thu Jul 16).
- [ ] **Betting economy** — no market shows an impossible multiplier; house band (MIN 1.3 / MAX 30) holds.

### A3 · Infrastructure
- [ ] **Crons green** — check `/api/cron/health` (last-run timestamps) and the 12 GitHub Actions workflows (`.github/workflows/*.yml`): notify, race-week, health, grant-credits, open-markets, settle-markets, award-prizes, betting-notify, publish-posts, warm-results, recheck-results, warm-sessions. All **fail-closed** (need `CRON_SECRET`).
- [x] **`next.config.ts`** keeps BOTH `serverExternalPackages: ["node-ical"]` AND `outputFileTracingIncludes` (landmine — removing either breaks prod fetches).
- [x] **Middleware** is `proxy.ts` (Next 16), not `middleware.ts`.
- [ ] **Clerk production** — publishable key keeps `NEXT_PUBLIC_` prefix; prod instance live (not dev `pk_test`).
- [ ] **Vercel KV** — env vars unprefixed (`KV_REST_API_URL`, `KV_REST_API_TOKEN`); reachable from a datacenter (not just localhost).
- [ ] **Supabase prod** — blog/threads/betting tables on project `dzelqrtajnauunzmxfic` (not the local `127.0.0.1` DB); any pending migration applied (grid-market enum still NOT applied — fine, market is dormant).

### A4 · Discoverability / SEO
- [x] **`sitemap.ts` + `robots.ts` + `llms.txt`** shipped; sitemap submitted to GSC + Bing.
- [ ] **Fresh sitemap ping** — run `npm run indexnow:submit` after the 1.0 deploy so the new banner/OG state is re-crawled.
- [ ] **OG/Twitter cards** render for `/`, `/app`, a `/series/<slug>`, a `/blog/<slug>` (paste into the Twitter/FB debuggers or eyeball the meta).
- [ ] **GSC coverage** — no spike in "excluded / crawl error" since the last check.

### A5 · Performance
- [ ] **Perf snapshot vs baseline** — capture a fresh Vercel Speed Insights + PSI row, append to `docs/perf-baselines.md`, confirm no regression vs the last row (the redesign moved every page; re-baseline is expected).
- [ ] **No console errors** on `/`, `/app`, `/calendar`, a series page, a weekend page (anon + signed-in).

### A6 · Legal / compliance
- [x] **6 legal pages live** — `/privacy`, `/terms`, `/cookies`, `/accessibility`, `/do-not-sell`, `/imprint`.
- [x] **Cookie consent** — Consent Mode v2 defaults denied; custom `CookieConsent` flips on choice.
- [ ] **Betting disclaimers** — no-cashout / play-money framing present on `/social` + betting surfaces (marketing must not imply real gambling).
- [ ] **Contact path works** — `/feedback` + contact form deliver to `pparaskevas.dev@gmail.com`.
- [ ] **AI "Race Engineer" assistant (only when enabling it)** — ships dark (no launcher + API 503). To go live, set in Vercel: `NEXT_PUBLIC_ASSISTANT_ENABLED=1` (shows the launcher), `GOOGLE_GENERATIVE_AI_API_KEY` (+ current free Flash id in `ASSISTANT_MODEL`). Confirm Gemini free-tier data-use terms, add a privacy-policy line that assistant questions are sent to Google (Gemini), keep the in-UI "don't share sensitive info" note, then verify a real answer on prod. NB `NEXT_PUBLIC_*` inlines at build → setting it triggers a redeploy.

### A7 · Security
- [x] **Security audit done** (`docs/research/security-audit-2026-06-11.md`, re-verified 2026-06-21) — W8 gate satisfied.
- [x] **Crons fail-closed** (`lib/cron-auth.ts`) — missing secret → 503, wrong → 401.
- [ ] **CSP** — decide Report-Only → enforcing flip before or shortly after launch (residual, not a hard gate).
- [ ] **Rotate secrets** — `sk_live_*` Clerk keys + `.supabase-pat` (operator-owed carry-over).

### A8 · Monitoring
- [ ] **Sentry** — DSN still pending; either wire it before launch or accept launching without error monitoring (documented gap). At minimum, watch Vercel runtime logs for the first 48h.
- [x] **`/api/cron/health`** — summary endpoint exists.

---

## §B — Launch-day runbook (the flip)

1. **Confirm §A is all green.** Any red box → not launch day yet.
2. **One commit, on a branch → PR → squash-merge** (never push to main):
   - Flip `LAUNCH_ANNOUNCEMENT.active` → `true` in `lib/site.ts` (banner goes live).
   - Bump `package.json` `version` → `1.0.0`.
   - `CHANGELOG.md` + `RELEASES.md` — a `## 1.0.0 — <date>` section (RELEASES = fan-facing prose: "Paddock is officially out of early access").
3. **Verify on the Vercel preview** (not just localhost): banner renders, dismiss persists across reload, `/changelog` shows 1.0.0 as "currently running".
4. **Merge → prod deploys (~90s).** Re-verify on prod: banner + a clean anon home + a signed-in home.
5. **`npm run indexnow:submit`** to re-crawl.
6. **Fire the marketing posts** per `docs/research/2026-07-06-launch-marketing.md` (in the sequenced order there — don't blast all channels at once; stagger so you can react).

## §C — Rollback

- **Banner/version only:** revert the flip commit (or set `LAUNCH_ANNOUNCEMENT.active = false` + re-push). Banner is client-gated, so this is instant on next load.
- **A bad deploy:** Vercel dashboard → Deployments → promote the previous good build (instant, no rebuild). The 1.0.0 tag can stay; fix forward.
- **A marketing misfire:** posts are the only irreversible step (screenshots persist). This is why §B step 6 is **last** and **staggered** — nothing external goes out until prod is confirmed healthy.

## §D — First-48h watch

- [ ] Vercel runtime logs — no error spike.
- [ ] `/api/cron/health` — crons still firing on schedule (traffic doesn't change cron behaviour, but confirm).
- [ ] Sign-up funnel — new accounts arriving without errors (Clerk dashboard).
- [ ] Feedback board / contact — triage inbound within the day; a launch surfaces bugs the soft period didn't.
- [ ] Betting/credits crons (grant-credits, settle-markets) survive the traffic bump.
