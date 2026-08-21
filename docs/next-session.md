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

## 2. DECIDED — two asks, the second announcing itself as the last

Operator, 2026-08-21, after the three-ask objection: **two asks, never a third.** The 10-minute prompt is dropped.

**Ask 1 — at 2 minutes of engaged time.** Three ways out, and the distinction between them is the whole design:

| Action | Effect |
|---|---|
| Support | opens `SUPPORT_URL`, silent for the rest of the visit |
| **"Don't show this again"** — an explicit, clearly-labelled button, not a small ✕ | silent for the rest of the visit (see the scope rule below) |
| Soft dismiss — Esc, backdrop click, "Not now" | **this visit continues to ask 2** |

**Ask 2 — at 5 minutes of engaged time**, and only if ask 1 was actually shown and soft-dismissed. The copy **says out loud that this is the last time**, e.g. "Last time I'll ask, promise." Every exit from ask 2 ends it for the visit. There is no third ask under any path.

### The scope of "don't show again" — operator, 2026-08-21

**For a guest, dismissal lasts the visit. Only an account can silence it for good.**

| | Where the flag lives | Lifetime |
|---|---|---|
| Guest | `sessionStorage` | this visit; asked again next visit |
| Signed in | Clerk **`unsafeMetadata`** on the user | permanent, every device, no further asks anywhere |

And the prompt **says so**, so a returning guest understands why it is back and what ends it.

**Use Clerk `unsafeMetadata`, not a new table.** It is readable client-side through `useUser()` with no extra request and no server involvement, so **ISR is untouched** — which matters, because `app/(app)/app/page.tsx` notes that follows stay device-local precisely to keep that page cacheable. Clerk metadata is already used in this repo (`app/(admin)/admin/users/`, several `app/api/admin/*` routes), so it is a known pattern rather than a new dependency. The alternative — a column on `app_user` plus an API route — costs a fetch on mount and puts a UI preference in a betting-adjacent mirror table.

**Two things to get right, because this is the line between an incentive and a dark pattern:**

1. **Do not phrase it as a threat.** "We'll keep asking until you sign up" is coercive. State it as fact: an account is where preferences live, and this is one of them. The guest dismissal must genuinely hold for the *whole* visit, including navigation — if it reappears mid-visit the copy becomes a lie and the mechanic backfires.
2. **We cannot detect a donation.** A guest who donates still gets asked on their next visit, because Buy Me a Coffee is external with no webhook. That is a real wart and the account is also its fix — so the signed-in flag should read as "I've supported / don't ask again", one control covering both.

Three implementation subtleties, easy to get quietly wrong:

- **5 minutes is total engaged time, not five minutes after ask 1.** The gap between asks is about three minutes.
- **Ask 2 requires ask 1 to have happened.** Someone landing with 5 minutes already banked (restored tab, late mount) gets ask 1, not "last time I'll ask" out of nowhere.
- **The signed-in flag wants a version marker** in the metadata value (not a bare `true`), so a deliberate future campaign can reset it while nothing accidental can.

A reload must not restart the ladder: the visit total and the guest dismissal both live in `sessionStorage`, so both survive it and both end with the tab.

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

- Ask 1 fires at **2 minutes of engaged** time, not wall-clock; a backgrounded tab accrues nothing.
- Ask 2 fires at **5 minutes of total engaged** time, **only** after ask 1 was shown and soft-dismissed, and its copy states it is the last ask.
- **No third ask exists on any path**, in either the guest or the signed-in case.
- **Guest**: every dismissal is visit-scoped (`sessionStorage`) and the reader is asked again on a later visit. It must not reappear within the same visit, including across navigation.
- **Signed in**: "don't show again" writes a versioned flag to Clerk `unsafeMetadata` and the prompt never appears again, on any device.
- The prompt **states** that an account is what makes it permanent, phrased as fact rather than as a threat.
- A reload restarts neither the ladder nor the clock.
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

## Handoff prompt for the next session — UNSUPERVISED RUN

> Paddock — session 32. **I will not be here. There is nobody to approve anything, so do not wait for approval and do not stop to ask a question the repo can answer.** Read in order: `CLAUDE.md` · `docs/HANDOFF.md` top block (it opens with the unsupervised rules — the authoritative list of what you may and may not do) · `docs/next-session.md` (this file) · `CONTRIBUTING.md` (the authority on the three-Worker deploy topology, and the most accurate doc in the repo) · `IDEAS.md` · `SCHEDULE.md` · memory `feedback-paddock-*`. `main` = 0.330.4, prod verified, tree clean, zero open PRs.
>
> **You have standing authority to ship.** For every item on the AUTONOMOUS list in `docs/HANDOFF.md`: branch from `main`, implement, run the full gate chain, open a PR with a real body, **merge it yourself**, verify prod, then **audit your own merged work** — and if the audit finds problems, fix them on a further branch, PR and merge that too. Loop until the list is done or genuinely blocked. Do not leave finished, gated work sitting unmerged waiting for me.
>
> **The audit is not optional and not a formality.** After each merge, go back and check the thing you just shipped the way a stranger would: click it in a browser, read the diff again, and look specifically for what your own implementation assumed. Every round of review I did this session found real defects in work that had already passed the gates — a live pill that could never fire, a session listed as upcoming after it had run, read-time that disagreed with itself across two surfaces, a tab that rendered with nothing linking to it. Assume yours has the same class of bug and go find it.
>
> **Where to stop.** The FORBIDDEN list in `docs/HANDOFF.md` is hard: no prod service-role key, no publishing blog content, no prod data writes, nothing that will not fit the Worker's 63 KiB of headroom, no weakening a check to go green, and none of the taste calls I have not made. When you hit one, leave the work on a branch with a PR explaining exactly what is blocked, write it into `docs/HANDOFF.md`, and move to the next item. A clear blocked item is a good outcome; a guess merged to prod is not.
>
> **Priority: the dwell-triggered support prompt.** A reader who stays engaged for a couple of minutes gets a minimal, heartwarming, easily escapable prompt asking whether they would like to support the site, linking `SUPPORT_URL`. Section 1 of `docs/next-session.md` has the mechanism already researched — engaged time rather than wall clock, mounted in `app/(app)/layout.tsx`, `sessionStorage` for the visit total and `localStorage` for "do not ask again", reusing `lib/useFocusTrap.ts` and the `LaunchBanner` dismissal pattern. Do not re-derive it.
>
> **The shape is already decided — section 2, do not reopen it.** Two asks, never a third: one at 2 minutes of engaged time carrying an explicit "Don't show this again" button, and — only if that one was soft-dismissed — one at 5 minutes of total engaged time whose copy says out loud that it is the last time. **Scope differs by auth state**: for a guest every dismissal lasts only the visit (`sessionStorage`), and only a signed-in reader can silence it for good, via a versioned flag in Clerk `unsafeMetadata` — which keeps ISR untouched because it reads client-side through `useUser()`. The prompt must say that plainly, as a fact about where preferences live, never as "we'll keep asking until you sign up".
>
> **Hard constraints**: the Worker bundle has 63 KiB of headroom against a 10 MiB ceiling, so measure with `wrangler deploy --dry-run` before and after and add no dependency · `content/legal/cookies.md` and `privacy.md` must list every new storage key in the same PR, or those pages become false · suppress the prompt entirely while a session is live (`weekendIsLive()`) · Esc, backdrop and dismiss must all work with focus returned · guard any animation behind `prefers-reduced-motion` · make the thresholds overridable so a 10-minute path can be tested in seconds, and unit-test the accumulator with an injected clock.
>
> **Then, in this order**: the session-30 evaluation that never happened (section 6 — the claim table is in git history at `docs/next-session.md@5af5094`; the trend chart's three unclicked consumers and the 22 unverified F1 champion notes are the substance), then delete `prod-weekend8.md`, delete the now-dead `components/NotificationBell.tsx`, collapse the two onboarding docs into one, and fix the "classification not available" copy so it does not read as broken half an hour after a session.
>
> Usual rules: branch from `main` as the literal first action after every merge, full gate chain before any "done" (tsc → lint 0 errors → vitest 1133 → `next build`, exit checked), the trio on every push, no Claude attribution, browser-verify before claiming anything works. A merge to `main` **is** the deploy — about six minutes, and **no GitHub Actions run exists to watch**, so poll `/changelog` with a background curl until the version flips, and never stack a second merge before the first is confirmed live.
>
> Three traps that cost me time today, so they do not cost you any: **local Supabase is down**, so every blog-backed surface renders empty locally and that is the fail-soft path working, not a bug (OpenF1 *is* reachable, so session pages test fine); **verify third-party API assumptions against the installed package**, because four of six Clerk appearance variables we were passing simply do not exist in Clerk 7 and that is why sign-in was unreadable; and **never put backticks inside a shell-quoted `node -e`** — bash eats every identifier and it silently corrupted a changelog entry twice.
>
> End of session: update `docs/HANDOFF.md` with what you shipped, what you audited and what you found, what you left blocked and why, and rewrite this file for whoever comes next.
