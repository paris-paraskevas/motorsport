# Security audit — 2026-06-11

Scope: full attack-surface sweep of paddock-tracker.com at v0.29.1 — all 13 API
routes, middleware auth matrix, security headers, HTML-injection inventory,
cron auth, secrets handling. Operator-ordered (session-4 note); a v1.0 launch
gate. Fixes shipped same-session in 0.29.2.

## Fixed in 0.29.2

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | **High** | `/api/contact` — the only unauthenticated write — had **no rate limit**: a loop could pump spam through Resend (cost + sender reputation) and flood KV with 12-month-TTL records. Long-standing carry-over. | Fixed-window KV limiter (`lib/rate-limit.ts`): 5/15min per IP + 60/h global, checked before any work. 429 on breach. |
| 2 | Medium | `/api/push/subscribe` accepted any string as a push endpoint. The notify cron web-pushes to every stored endpoint, so a signed-in attacker could seed the store with junk/attacker URLs (outbound-POST misuse + cron fan-out waste). | Endpoint must parse as `https:` URL ≤1024 chars; keys type-checked and ≤512 chars. Shape-validation over host allowlist — push hosts vary by browser vendor. |
| 3 | Low | `/api/contact` email check allowed whitespace/control characters into Resend's `reply_to` + mail subject. JSON transport already defuses classic header injection; tightened anyway. | Reject any `\s` in the address. |
| 4 | Low | `/api/user/prefs` accepted an unbounded `followed` array (KV bloat per user); `/api/user/mute-series` accepted unbounded slug strings. | `followed` ≤100 entries, slug-shaped (`/^[a-z0-9-]{1,64}$/`); mute slug same shape. |

## Verified sound (no action)

- **Auth matrix** (`proxy.ts`): public-with-account model — `/api/user/*`,
  `/api/push/{subscribe,unsubscribe,test,inspect}` behind `auth.protect()`;
  everything else public by design. `/settings` page public since 0.24.0 with
  writes still API-protected — confirmed.
- **Crons fail closed** (`lib/cron-auth.ts`, reversed in 0.9.17): missing
  `CRON_SECRET` → 503, wrong → 401. All three cron routes use it.
- **Push ownership**: `/api/push/unsubscribe` verifies subscription ownership
  (0.10.25); `/api/push/test` + `/inspect` filter to the caller's own
  subscriptions; `/inspect` returns sanitized tails only.
- **XSS inventory**: every `dangerouslySetInnerHTML` site renders
  repo-authored content (markdown via `loadMarkdownAsHtml` from `content/`,
  JSON-LD via `JSON.stringify`). The Wikipedia scrape path returns structured
  TEXT rendered as React children (escaped); scraped HTML never reaches
  `dangerouslySetInnerHTML`. No injection path found.
- **`/api/push/status`**: env-presence booleans only — no secret material.
- **Headers** (0.10.26): HSTS `includeSubDomains; preload`, nosniff,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  restrictive Permissions-Policy.
- **Notif-prefs route**: boolean-allowlisted patch — clean.
- **No user-controlled URLs** reach any server-side fetcher (scrape targets
  are hardcoded/curated) — no SSRF surface beyond finding #2.

## Known gaps / accepted risks (documented, not fixed here)

1. **No CSP** — deferred since 0.10.26. The header set is solid but a
   Content-Security-Policy is the missing layer. Non-trivial: Next inline
   chunks + Clerk + GTM/AdSense + Vercel scripts need nonces or a long
   allowlist. **Recommendation:** ship `Content-Security-Policy-Report-Only`
   first, collect violations for a week, then enforce. Queue as its own
   small project pre-launch.
2. **Rate limiter fails open** when KV is down/unconfigured — availability
   over strictness for a contact form. Accepted.
3. **Fixed-window boundary bursts** can briefly reach 2× the limit. Accepted
   at these thresholds.
4. **Muted-series list growth**: an authed user can mute many invented
   (slug-shaped) series. Bounded per-call now; list growth accepted (authed,
   self-harm only).
5. **No Sentry/alerting** — abuse of any kind is currently invisible unless
   it surfaces in Vercel logs. Already in IDEAS (infra parked); raises in
   priority at launch.
6. **Clerk `sk_live` rotation** — deferred indefinitely (HANDOFF ledger).

## Out of scope

Dependency audit (`npm audit` is CI-adjacent — run at launch checklist),
Vercel WAF/Attack-Mode configuration (platform-level, operator console),
DDoS economics (Vercel absorbs; spend caps are the operator's console
setting).

---

## 2026-06-21 re-verification — v0.38.3 (read-only, pre-launch)

Re-ran the surface sweep against current `main`/prod. **All 0.29.2 fixes hold; no regressions.** New surface since 0.29.1 audited:

- **`/api/cron/health`** (new) — calls `authorizeCronRequest` → fail-closed (503 missing-secret / 401 wrong) ✓; returns per-parser status counts, no secret material. Cron coverage now **4/4** (health + news + notify + race-week), all fail-closed.
- **`/(app)/api/just-missed`** (new, public, read-only) — emits series/race metadata + top-3 podium + curated highlight id only; no user data, no secrets. CDN-cached. No leak. (Perf: 13.8 s cold-on-cold tail — see `perf-baselines.md`, not a security issue.)
- **Contact rate-limit (the long-standing carry-over): confirmed RESOLVED on prod** — IP 5/15 min + global 60/h + email/length/category validation + `\s` header-injection guard all live.
- **Auth boundary** (`proxy.ts`), **security headers** (`next.config.ts`: HSTS/nosniff/`X-Frame-Options: DENY`/Referrer/Permissions), **push-subscribe validation** (https-only endpoint, length caps), **push-unsubscribe ownership**, **node-ical landmine config** (#1) — all re-verified intact.

**Open gap unchanged — still no CSP.** This is now the single most material pre-launch security item. Recommendation stands: ship `Content-Security-Policy-Report-Only` (the W8 checklist's "CSP-RO"), collect a week of violations, then enforce. All other "known gaps / accepted risks" above remain as documented.

**Verdict: the security launch-gate is essentially met.** Residual pre-launch work = CSP-RO + the `npm audit` fix below + Sentry/alerting (already queued).

### npm audit snapshot (2026-06-21)

`npm audit --omit=dev` (production deps): **9 vulnerabilities (4 high, 4 moderate, 1 low).**

- **`undici` (HIGH — 7 advisories; transitive via Next's fetch):** TLS cert-validation bypass via SOCKS5 ProxyAgent, cross-user info-disclosure via shared-cache whitespace bypass, Set-Cookie header injection, WebSocket DoS, cross-origin request routing, response-queue poisoning, SameSite downgrade. **Fixable non-breaking via `npm audit fix`.** Real-world exploitability for our usage (server-side fetch to fixed/curated scrape targets, no SOCKS proxy, no cookie forwarding) is low — but the advisories are legitimate; bump it. **Top dependency action.**
- `next` → `postcss`: build/dev-time only. **Ignore** the audit's bogus "downgrade to next@9.3.3" suggestion (we're on 16).

`npm audit` (incl. dev): 11 total. The extra 2 are **dev-only** — `esbuild` (dev-server arbitrary file-read on Windows) and `hono` (Set-Cookie injection; verify it isn't on a prod path — likely tooling). Lower priority than undici.

**Action:** run `npm audit fix` (non-breaking) in its own PR pre-launch, re-run at launch checklist.
