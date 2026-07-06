# Paddock v1.0 — launch marketing plan

**Status:** plan only. Nothing is posted. No channel accounts are touched by this doc. Part of the **W8 launch program**.
**Author:** session 2026-07-06. **Owner of execution:** operator.
**Companion docs:** `docs/launch-checklist.md` (the go/no-go gate), `RELEASES.md` (the fan-facing changelog the posts can link).

---

## 1. Positioning — one sentence, and what we are NOT

**Paddock is the motorsport companion that tracks 15 series in one place — schedules, standings, results, and a free play-money prediction game with friends.**

- **The hook that's actually differentiated:** *15 series, one app.* Not "an F1 app" (there are dozens). The person who follows F1 **and** MotoGP **and** WEC has no single home today — that's the wedge.
- **Secondary hooks, per audience:** point-in-time standings & trend charts (the stats crowd); per-weekend F1 car upgrades from the official FIA docs (the technical crowd); friend leagues + play-money predictions (the social/engagement crowd); calendar sync + push notifications (the "don't-make-me-miss-a-session" crowd).
- **We are NOT:** a gambling app (play-money, **no cashout, ever** — this is the anchor and must be stated plainly wherever betting is mentioned, or it reads as a casino and gets pulled from subreddits/stores); a live-timing/telemetry product (we're schedule + results + light analysis, not F1 TV); a news aggregator first (news is a supporting surface).

**Tone:** built-by-a-fan, honest, no growth-hack sludge. The soft-launch audience and r/formula1 will smell astroturf instantly — lead with "I built this because nothing tracked all the series I follow," not "revolutionize your race weekend."

---

## 2. Channel plan

Ordered by expected ROI for a solo, no-ad-budget launch. **Reddit and YouTube are where motorsport fans actually congregate; IG/FB/X are reach + retargeting.** Do NOT post everywhere day one — stagger (see §4) so you can react to the first channel's feedback before the next.

| Channel | Primary role | Cadence | Format that works |
|---|---|---|---|
| **Reddit** | Discovery + credibility. Highest-value, highest-risk. | 1 launch post per relevant sub, spaced days apart; then answer every comment. | Text/self-post, screenshots, "I built" story. NO link-only drops. |
| **YouTube** | Evergreen demo + SEO. | 1 launch walkthrough (60–90s Short + one 3–5min full demo); then per-milestone. | Screen-capture demo, phone-in-hand PWA install. |
| **Instagram** | Visual proof + reach. | 3 launch-week posts, then 2–3/week. | Reels (session countdown, upgrades widget, chart animation), carousels. |
| **X / Twitter** | Real-time, race-weekend relevance. | Launch thread, then react to live race weekends. | Thread (build story), reply-guy on race-weekend hashtags. |
| **Facebook** | Older/casual fan groups; series-specific groups. | Launch post in owned page + a handful of relevant groups (read each group's rules). | Same asset as IG, longer caption. |

### 2a. Reddit — the make-or-break channel
- **Read each sub's self-promo rules first.** Most motorsport subs allow "I made a thing" if it's genuinely useful, non-commercial-feeling, and you engage. r/formula1 has strict self-promo rules — likely needs the smaller subs first + mod DM.
- **Shortlist (verify each is active + check rules before posting):**
  - Broad: r/motorsports, r/formula1 (strict — approach last, maybe via r/F1Technical angle), r/WEC, r/MotoGP, r/INDYCAR, r/NASCAR, r/FormulaE, r/wrc, r/DTM, r/endurance_racing
  - Fit-specific: r/F1Technical (the **upgrades-from-FIA-docs** feature is tailor-made here), r/formula1technical, r/webdev / r/nextjs / r/SideProject / r/InternetIsBeautiful (the "I built" angle — a different audience that rewards the craft).
- **Play:** lead with the multi-series problem, drop 2–3 screenshots, be upfront it's free + play-money-only, ask for feedback (not sign-ups). The feedback ask converts better and survives mod scrutiny.

### 2b. The feature → channel matching (use the strongest asset per audience)
- **15-series calendar + push** → r/motorsports, IG Reel, the general "I built" post.
- **F1 car upgrades from FIA docs** → r/F1Technical, X (F1 tech accounts), a dedicated Short.
- **Trend charts / point-in-time standings** → r/formula1technical, stats-Twitter.
- **Friend leagues / play-money predictions** → r/fantasyf1-style communities, IG (social proof), but ALWAYS with the no-cashout line.

---

## 3. First-post drafts (fill the brackets; do not post verbatim without a final read)

### 3a. Reddit — r/SideProject or r/motorsports ("I built" story)
> **I built a free app that tracks 15 motorsport series in one place — schedules, standings, results, and a play-money prediction game**
>
> I follow F1, MotoGP and WEC and got tired of juggling three apps and a spreadsheet of session times in the wrong timezone. So I built Paddock: one calendar for 15 series (F1, MotoGP, WEC, IndyCar, NASCAR, Formula E, WRC, IMSA, DTM, F2, F3, WSBK, GT World, NLS, and the ADAC 24h), live standings + results, season trend charts, and per-weekend F1 car upgrades pulled from the official FIA documents.
>
> There's also a free prediction game — pick race outcomes with play money, run leagues with friends. **No real money, no cashout — it's for bragging rights.**
>
> It's a PWA (installs on your phone, works offline for the schedule), free, no account needed to browse. I'm the only dev — would love feedback on what's missing for your series.
>
> [link] · [2–3 screenshots: multi-series calendar, a trend chart, the upgrades widget]

### 3b. X / Twitter — launch thread (5 posts)
1. I built Paddock — one app for **15 motorsport series**. Schedules, standings, results, trend charts, and a free play-money prediction game with friends. No cashout, just bragging rights. 🧵
2. The problem: if you follow more than one series, there's no single home. F1 apps ignore MotoGP. MotoGP apps ignore WEC. I wanted one calendar in my timezone that covers all of it. [calendar screenshot]
3. Per-weekend **F1 car upgrades**, pulled from the official FIA Car Presentation docs — what each team actually brought, by round. [upgrades screenshot]
4. Point-in-time standings + season trend charts that reconcile exactly to the official tables. Stats without the spreadsheet. [chart screenshot]
5. It's a free PWA, installs on your phone, browse without an account. Built solo. Try it → [link]. Tell me what your series is missing.

### 3c. Instagram / Facebook — launch caption
> 15 series. One app. 🏁
> Paddock tracks F1, MotoGP, WEC, IndyCar, NASCAR, Formula E, WRC and more — schedules in your timezone, live standings, results, and a free prediction game with friends (play money, no cashout).
> Free. Installs on your phone. Link in bio.
> #F1 #MotoGP #WEC #IndyCar #NASCAR #FormulaE #WRC #motorsport

### 3d. YouTube — demo script beats (60–90s Short)
1. Hook (0–3s): "Every motorsport app only does one series. This one does fifteen."
2. Calendar in your timezone → tap a weekend → session times + weather.
3. Standings + a trend chart animating.
4. F1 upgrades widget → "what each team brought, from the FIA docs."
5. Predictions + a friend league (say "play money, no cashout").
6. "Free, installs on your phone. Link below." → install-to-homescreen shot.

---

## 4. Launch-week sequence (stagger, don't blast)

- **Day 0 (launch day):** flip §B of the checklist. Post the **owned** channels first — your X thread + IG/FB (lowest risk, your audience). Watch prod health for a few hours.
- **Day 1:** one or two **niche-fit** subreddits (r/SideProject, r/F1Technical) — the friendliest to "I built." Engage every comment.
- **Day 2–3:** the **series subreddits** you have the best feature match for, one per day, each with its tailored screenshot. Space them so you're not spread thin on comments.
- **Day 4+:** the big/strict sub (r/formula1) only after you've got testimonials/feedback to reference and have DM'd mods if required.
- **Ongoing:** react to live race weekends on X (the highest-intent moments); ship the YouTube full demo; per-milestone IG Reels.

**Why staggered:** a solo dev can't monitor 10 threads at once, and Reddit punishes drop-and-run. Each channel's early feedback also improves the next post.

---

## 5. Assets to prepare before day 0 (checklist)
- [ ] 4–5 clean screenshots (multi-series calendar, trend chart, upgrades widget, a weekend page, a friend league) — dark theme, phone + desktop.
- [ ] 1 short screen-capture demo (for the Short + as a GIF in posts).
- [ ] OG image sanity-check (the link preview is the first impression on every channel).
- [ ] The `/changelog` 1.0.0 entry written (posts can link "see what shipped").
- [ ] A one-paragraph "about the dev" ready for the inevitable "who made this" comment.

## 6. Measurement (free tools only)
- GA4 (already wired) — traffic by source/medium; tag the launch links with UTMs.
- Sign-up count (Clerk dashboard) day-over-day.
- Which series pages get traffic (validates the multi-series thesis; informs which sub to hit next).
- Reddit/HN referral spikes → double down on what landed.

## 7. Risks / do-not
- **Don't imply gambling.** Every betting mention carries "play money, no cashout." One screenshot that looks like a casino → removed + reputation hit.
- **Don't astroturf.** No fake accounts, no vote manipulation, no posting the same text to 10 subs the same hour. It's the fastest way to a sitewide shadowban.
- **Don't over-promise coverage.** Be honest where a series is schedule-only vs full results (the honesty is on-brand and pre-empts "X doesn't work" comments).
- **Respect each community's self-promo rules** — a single rule-break can get the domain blacklisted from a sub permanently.

---

## Appendix — launch banner copy drafts (for the `LaunchBanner` component)

The in-app banner (ships dark, flipped on launch day). Keep it to one line + a link; dismissible. Options:

- **A (plain):** "Paddock is out of early access — welcome to 1.0. See what's new →" (→ `/changelog`)
- **B (warmer):** "🏁 Paddock 1.0 is here — 15 series, one app. What's new →"
- **C (minimal):** "Paddock 1.0 is live. Read the notes →"

Recommend **A** — states the milestone plainly, links the changelog, no emoji-reliance. Final copy is the operator's call at flip time.
