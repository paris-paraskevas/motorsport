# Paddock — handoff

The running operational record. Read at session start. Update at session end.

This replaces the per-user memory handoff that lived at `~/.claude/projects/C--Dev-Personal-Motorsport/memory/project-paddock-handoff.md` until 2026-05-16. Memory file is now a redirect stub.

---

## ⚡ Next session pickup — 2026-08-26 (LATEST, session 35 FINAL — the root moved, the index cleaned, F1 finished) — `main` = **0.334.48**, zero open PRs, every merge prod-verified

**Read `docs/next-session.md` next.** It is the ordered queue. This file records what happened.

### ✅ Shipped — 19 merges, 0.334.30 → 0.334.48

| Version | What |
|---|---|
| **0.334.30** | `/changelog` reads as **15 named releases** instead of 707 pushes; version scheme set: a MINOR is a named release |
| **0.334.31** | `docs/launch-checklist.md` restored from the commit that deleted it; **4 gates were FALSE, not unticked**; 132-URL smoke pass run |
| **0.334.32** | The "vitest under load" flake **root-caused and killed**: suite 39–46 s → **7.5–11 s** |
| **0.334.33** | `/blog` shows its cover images |
| **0.334.34** | Findings recorded, including the og:image fault |
| **0.334.35** | Blog list rebalanced; mobile rows rebuilt as cards |
| **0.334.36** | Home "More reading" carries its covers |
| **0.334.37** | **Every page emits an `og:image` again** (12 route types verified) |
| **0.334.38** | Mobile calendar rebuilt as a Google-style schedule, **desktop provably untouched** |
| **0.334.39** | Composer refine pass 1 (filterable lead picker, series+date, radio semantics) |
| **0.334.40** | **RELEASES.md out of the Worker script** — headroom 669 → **822.68 KiB** |
| **0.334.41** | 1.0 announcement rebuilt as a **modal, shipped DARK** |
| **0.334.42** | **The landing page is retired; `/` serves the home page**, `/app` 301s |
| **0.334.43** | **AdSense audit + the noindex gate**: 443 thin pages left the index |
| **0.334.44–47** | Champion notes waves 3a–3e: **F1 complete, 76 of 76** |
| **0.334.48** | Programme counts corrected (I had double-counted) |

### 🔴 The findings that matter most

1. **Your thinnest pages were on your most valuable URLs, twice over.** 443 who-won pages (67–101 words, **54–66% text shared with sibling years**) were **35.4% of the whole index**, and had been flipped indexable five days before the 5 Aug AdSense rejection. Now noindexed and out of the sitemap (1252 → 822 URLs), pages still live and linked. Separately the *landing page* was the thinnest page on the site sitting on `/` — retired.
2. **`og:image` was missing site-wide.** `app/opengraph-image.tsx` sits in the root segment while every page lives in a route group, so the card was generated, served, and referenced by nothing. Fixed via `SOCIAL_CARD` in `lib/seo.ts` + both group layouts. **An explicit `images` in metadata BEATS the file convention** — the opposite of what the comment in `app/(app)/blog/[slug]/page.tsx:77` claims, and it silently replaced the weekend page's own card until `ownCard` was added.
3. **A deploy leaves a stale-chunk window.** `Cache-Control: s-maxage=85, stale-while-revalidate=2592000`, so the R2 page cache serves HTML from before a deploy pointing at build-hashed chunks that no longer exist. The first visitor to any page after each deploy gets broken JS (that is why `/calendar` rendered as an empty grid and `/` logged 40 errors). Local `deploy` runs `cf:populate`; **Workers Builds' command is in the Cloudflare dashboard and probably does not** — operator action.
4. **Enrichment works, measurably**: 68 → 157–179 words, sibling overlap 55% → 18–20%. F1 is 76/76. **91 of 488 done, 397 left.**

### 🟡 Corrections I owe the record

- **"121 of 488 done, 367 remain"** in 0.334.47 — double-counted the 30 pre-existing F1 notes. It is **91 / 397**. Now script-derived so it cannot recur.
- **`LandingNav` / `LandingFooter` are NOT shared with `AppShell`.** I said they were, "correcting" a right first answer. `AppShell` renders `components/Footer.tsx` and only *mentions* those two in a comment, which is what `grep -l` matched. They are **orphaned** now, along with `LandingAuth`.
- **"All 24 blog posts have a cover"** — wrong; I had measured `og:image`, which comes from the generated card route. It is **5 of 24**.
- **The 404's localhost `og:image` is not a regression I introduced** — its URL carries Next's file-convention hash, so it comes from the root `opengraph-image.tsx` and always has.

### 🔵 Process learnings (durable, session 35)

1. **`JSON.stringify` cannot edit `champion-notes.json`.** Integer-like keys always serialise **ascending**, flipping the file's newest-first order and turning a 10-entry addition into a 439-line rewrite. Splice as **text**, with guards asserting every pre-existing entry is byte-identical.
2. **`npx vitest` skips `pretest`**, so `CONTENT_BUNDLE` is stale and content assertions pass against old data. A sitemap assertion passed in isolation minutes before `npm test` correctly failed it. **Content changes need `npm test`.**
3. **Aggregate tables lie.** One fetch offered all 46 F1 champions at once and was wrong in four places (Stewart as his own 1969 runner-up, Taylor for Clark in 1962, Senna for Mansell in 1986, 8 wins for 1994 vs 6). Source season by season; **omit where sources conflict** rather than pick.
4. **A local production build cannot browser-verify client-rendered pages.** `.env.production.local` carries real Clerk keys and Clerk rejects them off the live domain, killing hydration — the calendar rendered as an empty grid and looked like a broken change. Use `next dev` or a preview Worker on a real subdomain.
5. **`grep -l <ComponentName>` proves a mention, not a usage.** Search for the `import`.
6. A `content/**` or `RELEASES.md` edit is invisible to `next dev` until `scripts/bundle-content.mts` re-runs.
7. **A component measurement is a floor — third time confirmed.** Predicted 75.68 KiB, delivered 153.41 net.
8. Shell heredocs mangle escapes into real newlines. Write scripts in the editor.

### 🩹 Owed (operator)

- **The 1.0 modal copy**, especially the three roadmap items in `LAUNCH_ANNOUNCEMENT.next` — anything named there is a public promise. Flip `active` in the same commit as the `1.0.0` bump.
- **Cloudflare build command**: add `&& npm run cf:populate` to close the stale-chunk window.
- **AdSense**: wait for Google to drop the 443 (Search Console will show "Excluded by 'noindex' tag" — expected, not a fault), then resubmit.
- **The ADAC note template**: 54 seasons of a 24-hour *race*, not a championship, so the clinch template does not apply. Decide the shape before anyone researches it.
- Launch-checklist §A gates that are yours: crons green, Clerk prod key, KV reachable, Supabase prod, secret rotation, a real contact-form send, PSI re-measure, signed-in console check.
- Empty-tab metadata (`/series/nls/standings` advertises tables it hasn't got) · `/social/leagues` play-money framing · month-grid tap targets (still unanswered).

---

## ⚡ Session 34 — 2026-08-24 (session 34 FINAL — the queue drained, the home composer, the console clean-up) — `main` = **0.334.28**, zero open PRs, every merge prod-verified

**Read `docs/next-session.md` next.** It is the ordered queue. This file records what happened.

### ✅ Shipped — 14 merges, 0.334.15 → 0.334.28

| Version | What |
|---|---|
| **0.334.15** | Dutch GP **race recap** drafted and queued; the operator published all four recaps |
| **0.334.16** | Push history **stopped being written** (4 writers, 0 readers); privacy policy corrected with it |
| **0.334.17** | **CSP now ENFORCES**, Funding Choices deliberately blocked |
| **0.334.18** | F1 **analysis surfaces public** (Race Story, Qualifying, Practice) |
| **0.334.19** | **Studio autosave** — the editor no longer loses written work |
| **0.334.20** | Like buttons moved into the byline band |
| **0.334.21** | Home composer **ship 1** — pin the lead post |
| **0.334.22** | Blog SEO: self-canonical, real `lastmod`, real `dateModified` |
| **0.334.23** | Two operator asks logged (mobile calendar, blog covers) |
| **0.334.24** | Home composer — **reorder, hide, live preview, drag and drop** |
| **0.334.25** | The **Console** link in the avatar menu |
| **0.334.26** | Session-34 records |
| **0.334.27** | **The admin clean-up: 653 KiB of Worker budget reclaimed**, the hub rebuilt as a to-do list |
| **0.334.28** | Bundle figures corrected across the docs |

Suite 1193 → **1206** (1208 at its peak, less the 2 tests in the deleted `bing.test.ts`).

### 🔴 The two findings that change what the next session can do

1. **The Worker bundle ended the session with 672.31 KiB of headroom, after starting it with 53.8 and dipping to 19.35.** The composer's drag-to-reorder gave `@dnd-kit` its first importer since the orphan sweep and took the margin to 19.35 KiB; the admin clean-up then freed **653 KiB** by deleting two read-only pages, landing at 9567.69 / 10240 KiB.
   - **The rule that explains both**: `@google-analytics/data` and `@googleapis/searchconsole` were *server* imports in *server* components, so they landed in the Worker script. `three` (25 MB installed), `recharts` (8.3 MB) and `leaflet` are all client-side behind `next/dynamic` and cost the Worker **nothing**. Check which side of that line something is on before assuming it is expensive.
   - **A chunk measurement is a floor, not the answer.** The prediction from measuring built chunks was ~352 KiB; the reality was 653 KiB, because the transitive `google-gax` / `@grpc` / `google-auth-library` trees went too.
   - **And the biggest lever is not application code.** A bundle breakdown (`wrangler deploy --outdir … --dry-run`) shows `resvg.wasm` **531 KiB**, `Geist-Regular.ttf.bin` **59 KiB** and `yoga.wasm` **28.5 KiB** gzipped — **~618 KiB, 6% of the whole budget** — which is the **Satori/`ImageResponse` runtime for OpenGraph cards**, used by five routes (`app/opengraph-image.tsx`, the blog / weekend / session cards, and `blog/[slug]/story-image`). Static assets are already offloaded to Workers Assets (`wrangler.jsonc:98`), so that lever is spent. Pre-generating those cards is the one change that would buy back real room. **Operator decision — the cards are what make posts shareable.**
2. **A published home layout appears inside the ISR window, not the 30-minute regional-cache window.** Measured on prod: **48 s** for one change, **~4 m 45 s** for the next, both *without* `revalidatePath`. The `revalidate = 60` fallback held in reserve by the plan is **not needed**. Both numbers are in `docs/perf-baselines.md`.

### 🟡 Corrections I owe the record

- **`changed` and `next` are NOT nested inside the result section's grid.** I asserted this in the approved plan and in two PR descriptions. The result `<section>` closes at `HomeLead.tsx:479`; the championship/next-up grid is a **sibling** opening at `:488`. Acting on the wrong version broke the refactor mid-flight. They are still one movable band, now by choice.
- **"48 seconds" was reported as the publish latency before the second measurement existed.** The revert took ~4 m 45 s. The honest reading is "bounded by the 5-minute ISR window, with regional-cache variance".
- **The sitemap's zero `lastmod` was very nearly reported as a defect.** It is a deliberate, documented decision (`lib/sitemap-data.ts:13-19`). Only blog posts got one, because only they have a verifiable change stamp.

### 🔵 Process learnings (durable, session 34)

1. **Write changelog prose in the editor, never through a shell-quoted `node -e`.** Bash expanded the backticks and silently ate four identifiers out of a finished entry. This file already warned about it; I did it anyway.
2. **Read the structure before a multi-boundary refactor.** Four "identical" `)}` lines are not interchangeable; the one I matched belonged to a sibling block.
3. **A vacuous test is not coverage.** The sitemap's "no entry carries lastModified" assertion passed because Supabase is unconfigured under vitest, so no blog entry ever got one. It would never have caught a regression.
4. **A test caught a UX bug no click would have**: `DEFAULT_HOME_LAYOUT` omitted `hidden: false` while the parser emits it, so the composer offered to publish a layout identical to the one already live.
5. **A dependency with zero importers costs nothing until it has one.** `@dnd-kit` sat in `package.json` for weeks outside the bundle.

### 🎯 Session 35 is operator-set: the admin page, and R2

**On R2 — settled, do not re-derive it.** R2 holds **data, not code**. Cloudflare Workers refuse to compile Wasm fetched at runtime ("Wasm code generation disallowed by embedder"), so the ~560 KiB of `resvg.wasm` + `yoga.wasm` **cannot** move there, and neither can JavaScript — a Worker script must be self-contained. The genuine candidate is **`content/`** (1.9 MB raw; `content/information/tracks.json` alone is 306.5 KB), read at runtime by `loadAllSeries` and the `/information` loaders and traced into the Worker. **Measure before migrating** — JSON gzips hard and the raw figure overstates it — and weigh it against `content/` being the operator's curated CMS, where an edit is a reviewable commit. Full write-up at the top of `docs/next-session.md`.

**On the admin page — click what exists before building more.** Nothing in the console has ever been browser-verified.

### 🩹 Owed (operator)

- **Click the composer**: `/admin/home` — drag, hide, preview, Publish. Never browser-verified; `/admin` needs a session this machine has not got.
- **Click the Studio link from the dev host.** It is an absolute cross-host link because `middleware.ts:92-98` 404s relative paths there — that one nearly shipped broken.
- **The four autosave checks** in PR #788, same reason.
- **Month-grid tap targets** — one word retires it.
- **The OG-image decision**: ~618 KiB, and the only ways to reclaim it are a separate Worker behind a service binding or pre-generating the cards. Not urgent at 672 KiB of headroom.
- Two `page_layout` revisions are stamped `measurement:session-34`; live state is automatic (no pin). Say the word and I clear them.

---

## ⚡ Session 33 — 2026-08-23 (privacy + GPC, the defect sweep, the queue, three blog drafts) — `main` = **0.334.12**, zero open PRs, every merge prod-verified

**Read `docs/next-session.md` next.** It is the ordered, one-item-per-PR queue. This file records what happened; that one says what to do.

### ✅ Shipped — 13 merges, 0.334.0 → 0.334.12

| Version | What |
|---|---|
| **0.334.0** | Privacy policy **false in 7 places**, rewritten. **GPC honoured** for the first time, a published promise with no code behind it |
| **0.334.1** | `/do-not-sell` documented **a statutory opt-out route that did not exist** |
| **0.334.2** | Cloudflare-migration residue: 9 stale Vercel references, 2 of them user-facing, 1 a false claim about error handling |
| **0.334.3** | `SessionCard`'s zero-caller `weather` prop deleted |
| **0.334.4** | Sweep audited; `next-session.md` rewritten as an ordered queue |
| **0.334.5** | `/calendar`'s `DataCloneError`, thrown on **every visit** |
| **0.334.6** | **Cloudflare Web Analytics was undisclosed** — edge-injected, so no grep found it |
| **0.334.7** | Orphan `/api/push/history` deleted; exposed that push history is **write-only** |
| **0.334.8** | 14 news tabs `noindex` + out of the sitemap; "Coming soon." was wrong copy on 7 working tabs |
| **0.334.9** | `HANDOFF.md` **532 KB → 36 KB**, rest archived |
| **0.334.10** | Three Dutch GP session recaps drafted, queued on prod |
| **0.334.11** | Recaps rewritten after a voice audit; grid confirmed; a source caught being wrong |
| **0.334.12** | Results tables restored to the recaps (operator correction) |

Suite **1193**. Queue items 1, 3, 4, 5, 9, 10 shipped; **7 and 11b closed by measurement with no code changed**.

### 🔴 What the audits found that the gates could not

1. **`/do-not-sell` told California residents to exercise a CCPA right by clicking a Google "shield icon" that has not existed since 0.12.6.** A documented legal route that could not be followed. That is the worst defect of the day.
2. **`/do-not-sell` and the privacy policy both promised we honour the GPC signal, and nothing in the code read it.** Grep for `globalPrivacyControl` returned nothing. Made true rather than deleted.
3. **Cloudflare Web Analytics runs on every page and was undisclosed.** Found in the CSP report stream, not the repo: Cloudflare injects it at the edge, so `grep -rn cloudflareinsights` returns zero and I had read that as "not running". Collecting since 0.253.1.
4. **`/calendar` threw `DataCloneError` on every visit.** The recorded fix ("drop `cacheOnNavigation`") **would have been a no-op** — the prop defaults to `true` in the package, so deleting the line changes nothing. It had to be explicitly `false`.
5. **A defect in my own GPC fix, caught by screenshotting it after the DOM assertions passed**: clamping only on save let the Advertising row render switch-on with an "ALWAYS ON" badge while gtag had it denied.

### 🟡 Three corrections I owe the record

Each was asserted to the operator and each was wrong.

- **"A character was lost inserting the blog title."** It was a CRLF artifact in my own insert script's field regex. The pipeline was fine; local now matches stored exactly on all nine fields.
- **"Our qualifying and sprint classifications render empty on prod."** Said twice. Both were **probe-before-hydration errors** — I queried the DOM before the Suspense boundary resolved. Both pages render the full sheet and match formula1.com.
- **"The approved voice uses no tables."** Measured off the published *preview*, which has no results to tabulate, and generalised into a house rule. Operator corrected it: tables are right for session results. The real defect in the first drafts was tables *instead of* prose.

### 📝 Blog drafts waiting in `/blog`

Three Dutch GP session recaps, `status='in_review'`, `publish_at` NULL, covers set, each with a flag block. Verified not public four ways (listing, direct URL 404, feed, and `publish_at`).

- **The qualifying post carries a time-sensitive "Race day" section.** Cut it or change its tense if publishing after the chequered flag.
- Facts: every classification from formula1.com's own tables; grid confirmed (no reordering, Pérez from the pit lane, reason unstated anywhere so not asserted); Sainz and Alonso's sprint pit-lane starts were a **parc fermé breach**.
- **RacingNews365's qualifying page is wrong about teams** (Antonelli as Ferrari, Hamilton as Mercedes) and is quarantined in the flags.

### 🔵 Process learnings (durable, session 33)

1. **Probe after hydration, or you will invent defects.** Two false alarms today came from reading the DOM before Suspense resolved. Wait, or assert on the streamed text.
2. **Check the installed package before trusting a recorded fix.** `cacheOnNavigation` defaults to true; the recommendation as written was a no-op.
3. **A grep that returns nothing is not proof of absence.** Cloudflare Web Analytics is injected at the edge and exists in no file here.
4. **Don't generalise a rule from one document type.** "No tables" came from a preview that had no results.
5. **A check that fires on correct data is worse than no check** — the 2001 champion-note win count, dropped rather than special-cased.
6. Deploys ran ~6 minutes, 13 for 13.

### 🩹 Owed (operator)

- **Queue item 6, the CSP → enforcing.** One decision is baked in: `fundingchoicesmessages.google.com` is deliberately **not** allow-listed, so enforcing blocks Google's Funding Choices. Arguably right, still your call.
- **Queue item 4b**: push history is write-only (4 writers, 0 readers). Rebuild the bell, or stop writing.
- **Queue item 11**: Race Story public on completed sessions, which needs the parked ISR unpark.
- **AdSense wave 3** (F1 pre-1996 champion notes) is the only tier-1 item left.
- The image session, and the PSI re-measure.

---

## ⚡ Session 32 — 2026-08-22 (the unsupervised run: support prompt shipped, weather rebuilt around sessions, nine merges) — `main` was **0.333.1**

### ✅ Shipped — 9 merges, 0.330.5 → 0.333.1, each one prod-verified before the next was pushed

| Version | PR | What |
|---|---|---|
| **0.331.0** | #759 | **The dwell-triggered support prompt.** Two asks, engaged-time accumulator, auth-scoped dismissal via Clerk `unsafeMetadata`, legal copy in the same PR. |
| **0.331.1** | #760 | **Weather per session, not per day.** Open-Meteo `hourly` added; Zandvoort's Saturday read 98% rain while the Sprint hour was 94% and Qualifying 33%. |
| **0.331.2** | #761 | **Audit of #759 + #760** — four defects in the prompt, one in the weather footer. |
| **0.331.3** | #762 | **"ALSO TODAY" was a lie from Friday evening on.** Names the weekday; "today" decided in the browser. |
| **0.332.0** | #763 | **Forecast across a session's running**, plus a two-hours-either-side window on session pages. Also the "classification not available" copy (item 6). |
| **0.332.1** | #764 | **Series reference strip: two rows of boxed 40 px targets**, full width. |
| **0.332.2** | #765 | **Items 3, 4, 5**: `prod-weekend8.md` and `NotificationBell.tsx` deleted, onboarding docs collapsed to one. |
| **0.333.0** | #766 | **Two Learn answers** (operator-asked): circuits leaving/joining the calendar, and driver pay through the decades. |
| **0.333.1** | #767 | **Item 2: the session-30 evaluation**, plus `champion-notes-integrity.test.ts` guarding all 45 notes. |

Suite 1133 → **1188**. Bundle 10176.64 → **10186.22 KiB gzipped** (+9.6 KiB across the whole session, **53.8 KiB** of headroom left).

### 🔴 The audit found five real defects in work that had already passed every gate

This is the part worth reading. All five were invisible to tsc, lint, vitest and `next build`.

1. **The support prompt could skip ask 1 entirely.** `setStage` only lands on the next render, so on a busy page the 1 s interval fired again, read the freshly-raised `shown`, and promoted straight to ask 2 — **reproduced live, showing "Last time I'll ask" as the first thing a reader ever saw.** Fixed with a synchronous `stageRef` guard. Caught *before* merge, by browser-verifying rather than trusting the gates.
2. **It could open over a sign-in form or a half-typed message.** `/sign-in`, `/sign-up`, `/studio`, `/contact`, `/settings`, `/write-for-us` all live in `(app)`, so a layout-level prompt reached every one. And at `z-[70]` it sits *above* `ContactModal`'s `z-[65]`. Now refused per tick on both counts.
3. **Its timer never stopped.** After a permanent dismissal the interval kept writing `sessionStorage` once a second for the tab's life — **measured on prod, the total climbed 79 s → 92 s after the visit was already over.**
4. **The weather footer shipped a missing space.** React's SSR ate the whitespace after `{circuit.name}`, so prod served `Circuit Zandvoort· forecast`. Same class as grepping across a JSX interpolation; the line is one template string now.
5. **The prompt's backdrop snapped in** at full opacity while the panel animated, because its `data-state` attribute had no consumer.

### ✅ All four blocked items CLOSED by the operator, 2026-08-22 (after the session-close merge)

- **`/f1/compare`'s trend chart — VERIFIED by the operator, signed in.** Screenshot shows the Points Trajectory rendering (Albon vs Lindblad, two lines, ranked legend 23 / 5). That closes **all three** previously-unclicked consumers of the 0.323.0 refactor: standings tab (session 30), team pages (this session, 6 lines, 686×320, zero height shift), `/f1/compare` (operator).
- **The signed-in support dismissal — confirmed by the operator.** The footnote reads correctly when signed in ("Signed in, so that sticks on every device you use").
- **The series reference strip keeps its new placement — APPROVED** ("i like this"). The two-row boxed strip stands; the 08-21 header-band placement is retired.
- **`content/legal/privacy.md` — REWRITTEN on the operator's word** (0.334.0, see below).

### 🟢 0.334.0 — the privacy rewrite, and a published promise that had no code behind it

**`content/legal/privacy.md` was materially false in seven places**, all corrected against the repo rather than from memory: Vercel named as host and log processor (it is **Cloudflare**), Vercel KV for push subscriptions and contact records (**Upstash Redis**), consent credited to **"Google's Consent Management Platform (Funding Choices)"** with a "shield icon" that does not exist (it is our own modal writing `paddock:consent` to `localStorage`, reachable from **Manage cookies** in the footer), the transfers and retention tables, and "Vercel's platform-level security". Two genuine **disclosure gaps** were also filled: the anonymous interaction/heatmap capture (consent-gated, DNT-honouring, stored in Supabase) and the signed-in sent-notification list. The in-app assistant clause now says out loud that the assistant **is currently switched off**, which it has been since 0.330.0 unmounted it.

**Then the load-bearing find: `/do-not-sell` told visitors we honour "the GPC signal", and nothing in the code read it.** A published compliance promise with no implementation. Rather than delete the claim, it is now true — `applyPrivacySignals()` in `CookieConsent` forces analytics and advertising off whenever `navigator.globalPrivacyControl` is set, **overriding a stored grant on every visit**, and `HeatmapTracker` stops entirely. Functional and Necessary are untouched, because GPC speaks to selling and sharing, not to remembering a theme.

**And a defect in that very change, caught by screenshotting it:** clamping only on save let the Advertising row render **switch-on with an "ALWAYS ON" badge** under GPC while gtag had it denied — the UI disagreeing with the behaviour, the exact class the operator keeps finding. Fixed by clamping at the **render** boundary, and the locked badge now reads "Off — your browser" instead of "Always on" for a locked-off row. 5 new tests pin the matrix.

### 🟡 Left noted, deliberately

- **The "connection is secure" interstitial is RECOMMENDED AGAINST as asked** (operator, 2026-08-22). That screen is a Cloudflare *Managed Challenge*, not a trust badge: it adds seconds to every first view against a 0.63 s TTFB, challenges Googlebot and any AdSense reviewer, and reads to many people as "this site has a problem". Three sharper routes to the same goal are written up in `IDEAS.md`, the best being **enforcing the CSP that is currently `report-only`**.
- `NOTED at the time, ALL FIXED in session 33`: the CSP's `va.vercel-scripts.com` leftover (0.334.2), `SessionCard`'s zero-caller `weather` prop (0.334.3), the orphan `/api/push/history` (0.334.7) and `ChartEmbed`'s rounded corners (0.334.8).

### 🔵 Process learnings (durable, session 32)

1. **Browser verification is not a formality and it is not the gate chain.** Two of the five defects were found by clicking, one by *measuring on prod after the merge*. The operator's prediction that gated work would still be broken was correct, five times.
2. **A one-second interval plus React state is a race.** Anything an interval reads and writes needs a ref, not state — state is a next-render promise.
3. **Verify the API shape against the live API, not a search summary.** Open-Meteo's hourly block was probed before the call was written (384 rows, ~15 KB, all six variables). And a search summary put Senna's million-a-race deal at **Williams 1994, $20m**; fetching the source showed **McLaren 1993, $16m over sixteen races**. RULE #1 earned its keep on a featured page.
4. **A check that fires on correct data is worse than no check.** A win-count guard flagged the 2001 champion note for "51 wins" — Prost's *career* record, correctly cited. Keeping it meant special-casing the prose, so it was dropped and the reasoning recorded.
5. **Clear a race with a route without a writer.** Verifying `sessionStorage` behaviour was impossible while the old page's interval kept rewriting it; navigating to `/` (marketing, no `SupportPrompt`) first made every test deterministic.
6. **Deploys ran 6 minutes, nine times out of nine.** Merge → `/changelog` flip, polled by background curl. No GitHub Actions run exists to watch.

### 🩹 Owed (operator) — carried forward

- **Decide**: retheme `/app` dark, `PreviewNews` on the weekend page, box depth beyond `/app`, and whether the series strip keeps its new placement.
- **Click through**: `/f1/compare` signed in (the chart), and the support prompt's "Don't show this again" signed in (the Clerk write).
- **The image session** — still the biggest outstanding job. **PSI re-measure** of `/`, standings and a weekend page.
- **Fact pack B** still records Norris' 2025 Dutch GP retirement as a "power-unit failure"; it was a broken oil line. Wrong at source, and it will re-infect the next post that reads it.
- Long-carried: key rotations.

---

## ⚡ Session 31 pickup — 2026-08-21 (session 31 FINAL — Dutch GP preview published, /app rebuilt around the blog, sign-in fixed, docs de-staled) — `main` = **0.330.4**, zero open PRs, prod verified

### 🚨 SESSION 32 RUNS UNSUPERVISED — read this before anything else

**The operator will not be present.** No approvals will arrive. Do not wait for one, and do not stop work to ask a question that the repo can answer.

**Standing authority granted for session 32, by the operator on 2026-08-21:** for every item on the AUTONOMOUS list below, you may branch, implement, gate, open a PR, **merge it yourself**, then audit your own merged work, and if the audit finds problems, fix them on a further branch, PR and merge that too. Loop until the list is genuinely done or genuinely blocked.

**A merge deploys production.** ~6 minutes, and **no GitHub Actions run exists to watch** — verify with a background curl of `/changelog` until the version flips. Never merge two PRs back to back without confirming the first reached prod.

#### AUTONOMOUS — do these without asking

1. **The dwell-triggered support prompt.** Fully specified in `docs/next-session.md` §1-§4: two asks, auth-scoped dismissal, Clerk `unsafeMetadata`, the copy guardrails. **Do not redesign it** — the operator settled the shape across three rounds.
2. **The session-30 evaluation that never happened.** The claim-by-claim table is in git history at `docs/next-session.md@5af5094`. Highest value: the three unclicked consumers of the refactored trend chart (team pages, `/f1/compare`, blog chart embeds) and a spot-check of the 22 F1 champion notes never independently re-verified. Fix what is broken; report what is fine.
3. **Delete `prod-weekend8.md`** — a 424-line Playwright accessibility dump committed to the repo root by accident. Provably junk, recoverable from git history.
4. **Delete `components/NotificationBell.tsx`** — dead since 0.328.0 unmounted it. Confirm zero importers first (`grep -rn NotificationBell app components lib`).
5. **Collapse the two onboarding docs** into one. `ONBOARDING.md` and `docs/ONBOARDING.md` cover the same ground and have already drifted — that is how both ended up wrong about `proxy.ts` in different words. Keep one, make the other a one-line redirect, and update every reference to it.
6. **Fix the copy on the "classification not available" state.** It is accurate but reads as broken thirty minutes after a session, which is exactly what happened on Dutch GP Friday. Say that timing data usually lands a little after a session ends.

#### FORBIDDEN — leave these on a branch with a PR and say so in `HANDOFF.md`

- **Anything requiring the prod Supabase service-role key.** You do not hold it and must not ask for it.
- **Publishing or scheduling blog content.** The SOP is absolute: DB draft, `publish_at` NULL, operator approves. Drafting is fine; going live is not.
- **Prod data writes.** Today's `.supabase-pat` writes were operator-named, one post at a time. That authority does not carry over.
- **Anything the Worker bundle cannot fit.** There were **63 KiB of headroom** at 10176.64 KiB gzipped against 10 MiB. Measure with `wrangler deploy --dry-run` before and after; if a change will not fit, **stop and report** rather than deploying a failure. `npm run deploy:testing` rejects harmlessly.
- **Weakening any check to go green.** No skips, no loosened asserts, no `as any`, no lint-disables. Quote the failure in the PR and leave it red.
- **Taste calls the operator has not made**: whether to retheme `/app` dark to match the testing build, whether `PreviewNews` should follow the News tab off the weekend page, box depth beyond `/app`, and the image session.
- **Force-pushing `main`, deleting remote branches, rotating secrets.**

#### Ground truth you will otherwise waste an hour rediscovering

- **Local Supabase is down** (Docker not running), so `.env.local` points at `127.0.0.1:54321` and **every blog-backed surface renders empty locally** — the `/app` lead band, `/series/*/blog`, `/blog/*`. That is the fail-soft path working, **not a bug**. OpenF1 *is* reachable from a laptop IP, so session pages and classifications do test locally.
- **The auto-mode classifier may block calls that read `.supabase-pat` and send it outbound.** It blocked twice today and allowed the same shape in between. Do not fight it; report and move on.
- `npm run lint` → 0 errors and **2 known `_encoding` warnings** in `lib/content-fs.ts`. `npm test` → **1133**. CRLF warnings on commit are normal.
- **Never put backticks inside a shell-quoted `node -e`.** Bash expands them and silently eats every identifier — it corrupted a changelog entry twice today. Use the editor for prose.
- `CONTRIBUTING.md` is the most accurate doc in the repo and the authority on the three-Worker topology (`testing.` is Fotis's, `paris.` is the operator's; **previews share prod's Supabase, KV and R2**, so a mutation on a preview writes prod data).

### ✅ Shipped this session (6 merges, 0.325.3 → 0.330.4, prod verified at 0.330.0 and 0.330.4)

- **#753 `0.327.0`** — `/app` leads with the latest blog post and its cover, plus the weekend in progress. Root cause fixed: the lead was "newest race with a podium" with no concept of a weekend being underway, so on Dutch GP Friday the page opened with a Formula E season that had ended five days earlier. Precedence is temporal, never editorial.
- **#754 `0.330.0`** — eleven review items: fluid `clamp()` type so the lead fills its box (measured fill 27% → 72-80%), live pill on a running session (client-tick only, because ISR bakes `isLive` stale), Blog in the nav, contact button replacing the notification bell, ten-row classifications with column rules, "Next session" instead of "First session", session names linking through, assistant widget unmounted.
- **#755 `0.330.2`** — doc staleness audit + the support-prompt handoff.
- **#756 / #757 `0.330.3` / `0.330.4`** — the support prompt's shape settled, then its dismissal scoped to the visit unless signed in.
- **The Dutch GP preview is live** at `/blog/f1-dutch-grand-prix-2026-preview`, inserted via the Management API (no prod service-role key on this machine), operator-approved and published.

### 🔴 Process learnings (durable, session 31)

- **The Worker bundle cleared 10 MiB by 63 KiB and the deploy succeeded**, which settles Cloudflare's "10 MB" as the *binary* reading. Treat the bundle as full regardless.
- **`CLAUDE.md` was materially stale** and cost real time: it claimed Vercel and ~90s deploys, `next dev --webpack`, 1125 tests, a `.clerk` file that does not exist, and a Blog SOP step verifying `status='draft'` when the script produces `in_review`. All corrected in 0.330.1. **Both onboarding docs claimed middleware lives in `proxy.ts`** — backwards, and precisely the rename that breaks the deploy.
- **Verify third-party API assumptions against the installed package, not memory.** The sign-in modal was unreadable because four of the six Clerk `appearance.variables` we passed do not exist in Clerk 7 — proven by reading `--cl-color-*` at runtime and finding them unset while the heading still computed white.
- **Measure layout bugs in the live DOM before writing CSS.** The lead's dead space was fixed by applying candidate values to prod's DOM and measuring fill at four widths, which is the only way to size it with no local blog data.
- **Two subagents on genuinely separate files worked.** Both reported honestly, one flagged a spec conflict rather than silently resolving it, and one caught the `dateOnly` landmine unprompted. Reviewing their work still found three defects — read-time divergence, an already-run session listed as upcoming, and opaque `FP1`/`SQ` labels in a hero.

### 🩹 Owed (operator) — carried

- **Decide**: retheme `/app` dark to match the testing build (a whole-page job, not a band), `PreviewNews` on the weekend page, box depth beyond `/app`.
- **The image session** — still the biggest outstanding job.
- **PSI re-measure** of `/`, standings and a weekend page, so the four fix packages' deltas land in `docs/perf-baselines.md`.
- **Fact pack B** (session-30 scratchpad) records Norris' 2025 Dutch GP retirement as a "power-unit failure". It was a broken oil line McLaren took the blame for, lap 65 of 72. Corrected in the published post; wrong at source, and it will re-infect the next post that reads it.

---

## ⚡ Next session pickup — 2026-08-20 (session 30 FINAL — 14 merges, PSI swept + all four packages shipped, AdSense enrichment waves 1 and 2, blog contract flipped) — `main` = **0.325.0**, zero open PRs, every merge prod-verified

### 📌 NEXT SESSION — start here
1. **The operator's blog approval.** The contract CHANGED mid-session: they asked for drafts, not just fact packs ("i want you to read my previous blogs. then give me a draft"). A finished Zandvoort-farewell preview is waiting in the session-30 scratchpad (`draft-f1-dutch-grand-prix-2026-preview.md`) with hero + inline licence-verified Commons images and four sourced Verstappen quotes. On their yes: move to `drafts/`, convert, `draft-post.mts` → prod DB draft, `publish_at` null. **Time-sensitive: the race is Sunday 23 Aug.** Going forward every post gets images, and they want OpenF1 `team_radio` embeds designed.
2. **AdSense wave 2** — MotoGP champion notes (wave 1 shipped for F1 1996-2025 as 0.324.0; the pattern is `content/series/<slug>/champion-notes.json`, fail-soft, no code change needed per wave). Then the four decisions in IDEAS NOW #1: public Race Story on completed sessions (the cheapest verdict-mover, needs the SEO-Phase-2b ISR unpark), the two stub components' copy/indexing, and noindex on the 15 news tabs. Request review ONCE, when we believe it.
3. **PSI re-measure** root + standings + weekend to capture the four packages' deltas, then append to `docs/perf-baselines.md`.
4. **Three design/behaviour decisions** waiting (IDEAS NOW #6): the serwist `cacheOnNavigation` drop, the calendar contrast token, month-grid tap targets (recommend accept).
5. Then **THE IMAGE SESSION** (operator: "the biggest job we have ever done"), with the Fotis testing-build layout as the reference.

### ✅ Shipped this session (12 merges, 0.321.2 → 0.324.0, each prod-verified after deploy)
- **0.321.2 #737 — the landing's ~7 s document stall.** `LastTimeOut` streams behind Suspense, which holds the ISR document open; a cold podium candidate fell through to a doomed upstream fan-out (worker egress is blocked) and **a null was never cached**, so every render re-paid it. Fix: 15-min negative-cache sentinel + a hard 2 s budget (`fetchFirstPodiumWithin`) + clean-IP podium seeding in the warm job.
- **0.321.3 #738** landing-orphan sweep (operator go): 15 zero-import files, 1,487 lines. Set recomputed from the tree, not the stale 17-name list.
- **0.321.4 #739 — home 50/50 band + THE 28-HOUR OUTAGE.** `warm-live-data`, the site's ONLY data writer, had failed every run since 08-19 07:22Z on the npm-10-vs-11 nested-lockfile hole (`Missing: @swc/helpers@0.5.23`) — the #687/#688 disease, reintroduced by a session-29 merge. **Now 2-for-2 after dependency merges: add an `npx npm@10 ci --dry-run` gate and a failure alert.** Four consecutive green runs since.
- **0.322.0 #740** the PADDOCK•TRACKER wordmark returns (header/nav/footer; condensed caps + brand dot).
- **0.322.1 #741** feed.xml finally carries DB posts + goes ISR (prod: 19 items, was 0 since the MDX era).
- **0.322.2 #742** `listThreads` fail-soft + Paper app error boundary (/social/threads dev-checkable at last).
- **0.322.3 #743** session docs.
- **0.322.4 #744 — fonts: 19 preloads / 660 KiB → 5 / 353 KiB on every page.** The mobile-LCP anomaly (metric 6.3 s vs its own 2.3 s breakdown) was preload contention, not a missing preload. Same PR: **the Upstash Redis SDK was shipping in browser JS** via `SessionCard` → `lib/weather.ts` top-level `import { kv }` (calendar chunk 128,560 → 34,972 bytes).
- **0.322.5 #745** tap targets 20 → 24 px sitewide (17 footer rows + the series/weekend feet). Same PR dispositioned two levers permanently: **gtag is already `lazyOnload`** (no regression, cost inherent) and **Clerk-for-anonymous is a NO-GO as a patch** — v7's provider hotloads `ui.browser.js` at init regardless of component mounts, so the May baseline's "lazy-load UserButton" idea moves ZERO bytes; the real path is custom flows + `prefetchUI:false` (~150-200 KiB), a project not a patch.
- **0.323.0 #746 — the trend chart splits into eager frame + lazy canvas**, killing the standings CLS 0.134. Frame owns the fixed box, ranked rail, chip legend and all state; only recharts is lazy, IO-gated. Measured 256/256 px at 390 and 320/320 at 1440, and **the hidden Constructors tab mounts its chart on switch** (verified by clicking it).
- **0.323.1 #747** the two lazy-loaded LCP images: driver portrait eager + `fetchPriority` + Commons 500px bucket (186 → 91 KiB), circuit SVGs get intrinsic 500×500 and the desktop one gets priority.
- **0.324.0 #748 — AdSense enrichment wave 1**: F1 champion answers 1996-2025 gain the clinch and the season's story (`content/series/f1/champion-notes.json`, 30 seasons), fail-soft so later waves need no code.
- **0.324.1 #749** session docs. **0.325.0 #750 — enrichment wave 2**: MotoGP 2011-2025 (15 seasons), authored inline after that researcher died on the cap; every clinch two-source verified, all 15 cross-checked against `champions.json`, and a source claiming 2017's margin was 36 was overruled by our reconciled 37.

### 🔴 Process learnings (durable, session 30)
1. **Three parallel research subagents died on the operator's session cap** (~16:40 EEST), exactly as `feedback-paddock-workflow-limits` warns. One had written its JSON (recovered, validated, shipped as 0.324.0), one had uncommitted perf work (recovered, gate-fixed, shipped as 0.323.0), one produced nothing. **Lesson: one research agent at a time, and check for recoverable partial output before redoing work.**
2. **A dead agent's work is unverified by definition.** Agent #3's 317-line chart refactor was sound but had a real lint error (`setState` synchronously inside an effect); the orchestrator's gate chain caught it. Never merge an interrupted agent's branch without re-running the full chain.
3. **`rm -rf .next/dev` under a live dev server 500s the server.** Cost a confusing minute; kill dev first (by PID via the port, never by image name).
4. **Wikimedia serves only bucketed thumbnail widths** — 352/360/400 return a 400 error page regardless of UA; 500 is the smallest usable bucket. Verified against all 22 shipped portraits before shipping.
5. **A comment inserted between `eslint-disable-next-line` and its target silently detaches the suppression.** Lint caught it; comment order matters.

### 🩹 Owed (operator)
- **Approve/edit the Zandvoort blog draft** (time-sensitive).
- Paste the PSI re-run figures once the four packages settle.
- The four AdSense decisions + three design decisions listed above.
- Long-carried: key rotations, dead `.supabase-pat`.

---

## ⚡ Session-30 mid-point pickup (superseded by the block above) — `main` was 0.322.2

### 📌 NEXT SESSION — start here
1. **The operator writes the two blogs** from the fact packs (scratchpad: `factpack-a-f1-summer-break.md`, `factpack-b-dutch-gp-zandvoort.md` — every claim sourced + dated, UNVERIFIED lists at the end). Claude returns **corrections only** (facts, stale numbers, house style). Zandvoort sprint question RESOLVED: it IS a sprint weekend (5th of 6, Zandvoort's first and last GP) — our calendar was right. Weather: re-pull Open-Meteo by venue-local date on writing day (the API line is in pack B; current model: heavy rain Sprint Saturday).
2. **AdSense "Low value content" recovery** (operator: "i want ads") — IDEAS NOW #1. `ads.txt` serves fine on prod (the console's "Not found" is a stale Aug-5 crawl); the Aug-5 policy verdict predates the bios day + Paper + meta sweep. Work: audit the weakest indexed URL families vs Google's thin-content bar, strengthen/noindex, then ONE Request review.
3. **THE IMAGE SESSION** (operator: "the biggest job we have ever done") — flood the site with licence-clean imagery; reference the operator likes: Fotis' testing build (big series image card beside the lead story, UP NEXT strip under). Riding along: home image boxes to series/calendar, blog driver-radio embeds (OpenF1 team_radio), and the now-orphaned `content/landing/circuits.json` + `public/landing/circuits/*` (dead weight since the orphan sweep — delete or reuse there).
4. **PSI re-run owed (operator)** → then append the 0.321.2 delta row to `docs/perf-baselines.md` (expect the ~7 s doc stream gone, mobile LCP toward the ~1.5-2 s FCP line, SI collapsing from 10.8 s).

### ✅ Shipped this session (six merges, 0.321.2 → 0.322.2, each prod-verified)
- **0.321.2 #737 — the landing PSI stall killed.** Root cause chain: `LastTimeOut` streams behind Suspense → holds the ISR document open → cold podium candidate falls through `withSourceSnapshot`'s db-read-only miss path into a doomed upstream fan-out from BLOCKED worker egress → null result never cached → every render re-paid ~7 s (PSI doc 7.1-7.4 s both form factors, mobile 69). Three legs: 15-min `NO_PODIUM_SENTINEL` negative cache (`force` bypasses), a hard 2 s budget on the block (`fetchFirstPodiumWithin`), and clean-IP podium seeding added to `scripts/warm-live-data.mts`. 9 new tests (suite 1125). Playwright-CLI prod audit ~14 min post-merge: wordmark page fine, Last-time-out present, `/changelog` current.
- **0.321.3 #738 — landing-orphan sweep** (operator go): 15 zero-import files, recomputed from the tree (stale 17-list had 4 already gone via #683; +CountUp/CircuitSlideshow transitive; WeekendHero's one ref was its own export). 1,487 lines deleted.
- **0.321.4 #739 — home 50/50 + THE LOCKFILE OUTAGE.** What-it-changed / What's-next became equal halves (operator: what's next is why users come). And **warm-live-data — the site's ONLY data writer — had been failing every run since 08-19 07:22Z** on the recurring npm-10 nested-lockfile hole (`Missing: @swc/helpers@0.5.23`, the #687/#688 disease reintroduced by a session-29 merge). npm-10 regen, single-entry diff, both npm generations verified. **The 11:45Z scheduled run is the first green-path proof** (survived npm ci; check its conclusion). The operator-reported one-driver London ePrix classification was this outage's symptom.
- **0.322.0 #740 — the PADDOCK•TRACKER wordmark returns** (operator priority: "we have lost our logo"): one condensed-caps + brand-dot treatment at AppShell header, LandingNav and LandingFooter (mobile: PADDOCK). Eyes-verified dev 1440/375.
- **0.322.1 #741 — feed.xml carries DB posts at last** (the sitemap's 0.246.1 bug, fixed for RSS): DB+MDX merge, DB wins, imports excluded, `force-dynamic`+dead `s-maxage` → `revalidate=300` (`○ 5m`). **Prod now serves 19 items** (was 0 since the MDX era).
- **0.322.2 #742 — `listThreads` fail-soft + Paper app error boundary.** A DB hiccup renders the threads empty state instead of a 500; `/social/threads` is finally dev-checkable (eyes-verified at HTTP 200, DB down). The last pre-Paper user-reachable surface restyled.

### 🔴 Incident + process notes (durable)
1. **The lockfile disease is now 2-for-2 after dependency-touching merges** — npm 11 locally tolerates nested-entry holes, the runner's npm 10 refuses, and the only writer dies silently. Detection gap: nothing alerts on the workflow failing (28 h unnoticed). Consider: a CI guard (`npx npm@10 ci --dry-run` in the gate chain after any lockfile change) or pinning runner npm; and a failure alert on the workflow.
2. **Prod writes require the operator to NAME the action — the auto-mode classifier now enforces it.** It denied both an ad-hoc local `warm-live-data.mts` run against prod (which had already launched in the background and completed: 13/13 standings, 8/8 results, 10/10 extras, 6/6 podiums, write-proof passed — that run is what healed the London classification and all stale data; recorded transparently in 0.321.4's CHANGELOG) and a `gh workflow run` dispatch. Standing conclusion: data refreshes go through the scheduled GitHub pathway; ad-hoc runs only when the operator names them.
3. **The Playwright MCP server died mid-session** (disconnected with google-drive after a dev-server PID kill). Replacement that works: `npx playwright screenshot --browser=chromium --viewport-size=WxH --wait-for-timeout=N URL out.png` (one-time `npx playwright install chromium`, ~115 MB). Used for every browser verification after the death.
4. **The stale-list lesson repeats**: the "17 orphans" list was 4 stale + 2 short; the real set came from re-grepping the tree. Recompute deletion sets at execution time, never trust carried counts.

### 🩹 Owed (operator) — carried + new
- **Paste the root PSI re-run figures** — the operator re-ran same-day and reports "better on root"; the append-only `docs/perf-baselines.md` row needs the actual numbers (mobile+desktop scores, LCP, SI).
- CLEARED same-day (operator, 2026-08-20 late): avatar-menu signed-in eyeball ✓ · GSC Validate-fix + noindex re-validate ✓ · Bing meta re-validate ✓ · the two `/feedback` DONE moves ✓.
- Key rotations + dead `.supabase-pat` (long-carried).
- AdSense: after the content audit lands, tick "I confirm" + Request review (one shot).
- Decide the PSI-sweep mechanics: a PageSpeed API key (Claude scripts ~20 runs) or manual pagespeed.web.dev clicks per page (new session logged in IDEAS NOW).

### 📎 Session artifacts
Fact packs + all verification screenshots live in the session scratchpad (`factpack-a-f1-summer-break.md`, `factpack-b-dutch-gp-zandvoort.md`, `prod-audit-landing.png`, `dev-home-5050.png`, `wordmark-landing.png`, `wordmark-app-mobile.png`, `threads-failsoft.png`). IDEAS.md was re-triaged end to end (fossils deleted, 11 dated kills, big rocks parked with triggers, NOW = AdSense recovery · image/positioning · v1.0 launch · HANDOFF trim).

---

---

## How to use this file

- **Session start:** read this file first (after `CLAUDE.md`), then `IDEAS.md` and `docs/next-session.md` for the execution queue.
- **Mid-session:** don't edit it. New ideas go to `IDEAS.md` Inbox.
- **Session end:** replace the top block with this session's, and let the previous two stay below it. When a fourth accumulates, move the oldest into `docs/handoff-archive.md`.
- **Never duplicate state.** `IDEAS.md` is the idea ledger, `docs/next-session.md` is the ordered queue, and this file is the record of what happened. The stack, the landmines and where things live belong to **`CLAUDE.md`** and **`CONTRIBUTING.md`**, which are the authorities — this file used to carry its own copies and they rotted, to the point of stating the `middleware.ts` / `proxy.ts` landmine backwards. They are gone; do not reintroduce them.

## Older sessions

Everything before session 30 lives in **[`docs/handoff-archive.md`](handoff-archive.md)**, frozen as it was written.
