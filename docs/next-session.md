# Next session — the dwell-triggered support prompt

Written at the close of session 31 (2026-08-21). `main` = **0.330.1**, prod verified serving 0.330.0 at 13:40Z (merge → live in ~6 min). Previous handoff (blog upload + session-30 evaluation) is consumed; the parts of it never done are listed at the bottom.

**Priority for next session: the support prompt.** Everything below is research already done — do not re-derive it.

---

## 1. Can we do it? Yes. Here is the mechanism

**Detecting dwell.** Not `setTimeout` on mount: a tab left open in the background would "earn" ten minutes without a human present, and the prompt would fire at someone who walked away. Accumulate **engaged time** instead — tick a counter only while `document.visibilityState === 'visible'`, and reset the idle clock on `pointerdown` / `keydown` / `scroll`. `components/HeatmapTracker.tsx` already listens on `visibilitychange`; read it first for the house pattern.

**Surviving navigation.** Next's App Router keeps layout-level components mounted across client-side route changes, so a component mounted in `app/(app)/layout.tsx` (beside `CookieConsent` and `LaunchBanner`) keeps counting as the reader moves between pages. A **hard reload** remounts it, so persist the running total in `sessionStorage` — per-tab, cleared when the tab closes, which is the right lifetime for "this visit".

**Not asking twice.** `localStorage`, exactly as `components/LaunchBanner.tsx` does it: a versioned key, read in an effect rather than at SSR so dismissers never see a flash (its comment explains why). Note we **cannot know whether someone donated** — Buy Me a Coffee is external and there is no webhook — so "I already have" must be a self-declared dismissal that persists for a long time.

**Where it goes.** `app/(app)/layout.tsx`, next to `CookieConsent`. Client component. No ISR interaction, since nothing is server-rendered.

---

## 2. Decide this before writing code

**2, 5 and 10 minutes is three asks in one visit.** That is the operator's stated spec and it is recorded as such — but three interruptions in ten minutes is how a goodwill prompt turns into a nag, and the second and third have to be *more* intrusive to earn attention, which is the wrong direction. Two alternatives worth a moment:

- **One ask per visit, escalating across visits** — 2 min on a first long visit, then only on a later visit if ignored. Same funnel, a tenth of the annoyance.
- **One ask per visit, threshold by depth** — fire at 2 min only if they have also read a blog post or opened more than N pages, i.e. ask the engaged, not the merely present.

Operator's call. If the answer is "do what I said", implement 2/5/10 with a hard per-visit cap so a reload cannot restart the ladder.

---

## 3. Constraints specific to this repo

1. **Worker size is at the ceiling.** `wrangler deploy --dry-run` measured **10176.64 KiB gzipped** against Cloudflare's 10 MiB on 2026-08-21 — **63 KiB of headroom**. Measure before and after; a new dependency for this is out of the question. `npm run deploy:testing` rejects harmlessly if it will not fit.
2. **Legal copy must be updated in the same PR.** `content/legal/cookies.md` and `content/legal/privacy.md` enumerate what we store, and the site honours GPC and Consent Mode v2 with everything denied by default. New `localStorage` / `sessionStorage` keys are first-party and functional, not tracking — but they must still be listed, or those pages become false. This is not optional polish; it is the promise the pages make.
3. **Accessibility is a solved problem here — reuse it.** `lib/useFocusTrap.ts` plus `components/ContactModal.tsx` is the working example: Esc to close, backdrop click, focus trapped while open and returned on close, `role="dialog"` + `aria-modal`. "Easily escapable" means all of that, not just a small ✕.
4. **Motion.** `app/globals.css:438` already guards `.live-pulse` behind `prefers-reduced-motion`. Any entrance animation needs the same guard.
5. **Do not interrupt live sessions.** A reader on a weekend or session page while a session is running is watching timing. `weekendIsLive()` (`lib/weekend.ts:93`) is exactly the "a session is on track right now" predicate — suppress the prompt while it is true. This is the difference between charming and infuriating.
6. **Testing a 10-minute threshold by hand is not viable.** Make the thresholds overridable (a query param or a `window.__paddockSupportPromptMs` hook) so the flow can be exercised in seconds, and unit-test the accumulator with an injected clock rather than real timers.

---

## 4. Copy and tone

Operator's words: "minimal, heartwarming". It should read like a person, not a fundraising banner — one line about the site being made by one person and free, one line asking, two buttons (support / not now). No guilt, no counters, no "only 2% of readers donate". `SUPPORT_URL` is already in `lib/site.ts:17` and already used by the header button and the account menu, so link it from there rather than adding a second copy.

---

## 5. Acceptance criteria

- Prompt appears only after the configured **engaged** minutes, not wall-clock; a backgrounded tab does not accrue time.
- Dismissal persists across reloads and later visits; "I already have" persists for a long time.
- Esc, backdrop click and the dismiss control all close it; focus returns to where it was.
- Nothing renders while a session is live on the current series.
- `cookies.md` and `privacy.md` list every new key, in the same PR.
- Bundle measured before and after, with the numbers in the PR body.
- Browser-verified with the threshold override, in both a light and a dark theme.

---

## 6. Carried over, not done in session 31

- **The session-30 evaluation never happened.** It was the second item in the session-31 brief and the day went to the blog and eleven rounds of UI review instead. The claim-by-claim table is in git history (`docs/next-session.md` at `5af5094`) if it is still wanted; the three unclicked trend-chart consumers and the 22 unverified F1 champion notes are the substance.
- **`prod-weekend8.md`** at the repo root is a 424-line Playwright accessibility dump committed by accident. Needs an operator OK to delete.
- **Two onboarding docs** (`ONBOARDING.md`, `docs/ONBOARDING.md`) cover the same ground and have already drifted — both were separately wrong about `proxy.ts`. Worth collapsing to one.
- **`NotificationBell.tsx`** is dead code: unmounted in 0.328.0, not deleted.
- **`PreviewNews`** still renders inside the weekend Schedule content; only the News *tab* was removed.
- **Fact pack B** (session-30 scratchpad) records Norris' 2025 Dutch GP retirement as a "power-unit failure". It was a broken oil line McLaren took the blame for. Corrected in the published post, still wrong at source.
- **The published Dutch GP preview** carries the operator's title, which reads "Verstappen's hunt for a first win of 2026" only if the title fix was applied — verify the live title before reusing it as a template.

---

## Handoff prompt for the next session

> Paddock — session 32. Read in order: `CLAUDE.md` · `docs/next-session.md` (this file, written for you) · `CONTRIBUTING.md` (it is the authority on the three-Worker deploy topology, and more current than anything else) · `IDEAS.md` · `SCHEDULE.md` · memory `feedback-paddock-*`. `main` = 0.330.1, prod verified, tree clean.
>
> **Priority: the dwell-triggered support prompt.** A reader who stays engaged for a couple of minutes gets a minimal, heartwarming, easily escapable prompt asking whether they would like to support the site, linking `SUPPORT_URL`. Section 1 of `docs/next-session.md` has the mechanism already researched — engaged time rather than wall clock, mounted in `app/(app)/layout.tsx`, `sessionStorage` for the visit total and `localStorage` for "do not ask again", reusing `lib/useFocusTrap.ts` and the `LaunchBanner` dismissal pattern. Do not re-derive it.
>
> **Answer section 2 before you write anything**: I asked for prompts at 2, 5 and 10 minutes. That is three interruptions in one visit. Tell me plainly whether you think one ask per visit escalating across visits is better, then do whichever I confirm.
>
> **Hard constraints**: the Worker bundle has 63 KiB of headroom against a 10 MiB ceiling, so measure with `wrangler deploy --dry-run` before and after and add no dependency · `content/legal/cookies.md` and `privacy.md` must list every new storage key in the same PR, or those pages become false · suppress the prompt entirely while a session is live (`weekendIsLive()`) · Esc, backdrop and dismiss must all work with focus returned · guard any animation behind `prefers-reduced-motion` · make the thresholds overridable so a 10-minute path can be tested in seconds, and unit-test the accumulator with an injected clock.
>
> **Then, only if that is done and merged**: the session-30 evaluation that never happened (section 6), and the four small carried-over items.
>
> Usual rules: branch from `main` as the literal first action, full gate chain before any "done" (tsc → lint 0 errors → vitest → `next build`, exit checked), trio on every push, no Claude attribution, browser-verify before claiming it works, and remember a merge to `main` is what deploys prod — about six minutes, with no GitHub Actions run to watch.
