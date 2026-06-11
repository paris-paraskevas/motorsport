# Onboarding tour — research & design, June 2026

Research-agent report (NN/g, Appcues/Userpilot practitioner literature, WCAG
2.2, 2026 library benchmarks, WebKit/Firebase persistence patterns) distilled
to what binds Paddock's spotlight tutorial. Full citations in the agent
transcript; this file keeps the rules, the verdict and the build plan.

Operator spec (2026-06-11): overlay highlighting aspects of the app, shown to
new visitors, "don't show again" checkbox persisted WITHOUT an account.

## The checklist (testable assertions)

| # | Assertion | State |
|---|-----------|-------|
| 1 | Skippable from step 1; ESC ends the whole tour from any step | planned |
| 2 | 3–5 steps hard cap; one element, one idea, ≤10s reading per step | planned — 4 stops below |
| 3 | Auto-show ONCE ever; replay only user-triggered (Account page link) | planned |
| 4 | Never re-show a dismissed tour; version bump (`v2`) may re-show exactly once after a redesign | planned |
| 5 | No step explains conventional chrome — every stop needs a Paddock-specific reason | ✅ by stop selection |
| 6 | Mobile: one coach mark at a time, never a multi-callout splash | planned |
| 7 | Popover is `role="dialog"` + `aria-labelledby/desc`; focus moves in, Tab cycles, dismissal restores focus | planned |
| 8 | Focused elements never fully obscured by scrim/popover (WCAG 2.4.11) | planned |
| 9 | Controls ≥24px hit areas (44px on the bottom-nav step); checkbox included | planned |
| 10 | Step text carries full meaning without the visual ("Step 2 of 4: …") — the spotlight is invisible to SR users | planned |
| 11 | `prefers-reduced-motion`: instant cuts, static markers — remove motion, not affordance | planned |
| 12 | Storage failure never blocks render; unparseable key ⇒ show (dismissible-twice beats never) | planned |
| 13 | Animate transform/opacity of the cutout, never the box-shadow value (repaint jank) | planned |
| 14 | Scrim keeps focus-indicator contrast ≥3:1 over dimmed content | planned |

## Library verdict

**Hand-roll (~200 lines).** One positioned div with
`box-shadow: 0 0 0 9999px rgba(0,0,0,.6)` as the spotlight cutout (inherits
target border-radius), popover on our existing portal pattern, own
focus/ESC/reduced-motion handling. Zero deps, full timing-screen design
control, and the a11y bar is OURS to meet — no library patches.

Rejected: Shepherd.js + Intro.js (AGPL/commercial — license-poisoned);
react-joyride (v2 broken on React 19; v3 is weeks old, 34KB, 3 axe
violations); onborda/nextstepjs (framer-motion dependency, stagnant/small);
driver.js is the only acceptable fallback (MIT, 5KB) but ships axe failures
and no focus trap — patching it costs most of the hand-roll.

## Tour stops (v1 — 4 steps, app surface only)

1. **Chyron** — "live takeover and next-session countdown" (the one element
   with non-obvious semantics; hotspot-pattern candidate if we ever split it).
2. **THIS WEEK rows** — times are device-local; tap a session → its page.
3. **Series rail** (on first series-page visit OR pointed at the bottom-bar
   Series tab) — 15 series, standings/results/rules per series.
4. **Account/follow** — "pick your series; saved on this device, everywhere
   with an account" + notifications exist. Do-style: invite the tap.

Landing page gets NO tour (marketing surface). PWA standalone and browser
share the same tour (same chrome since 2c-2).

## Persistence design

- Key `paddock:tour:main:v1` → `{ dismissedAt, completedStep, neverShow }`
  via one storage util (try/catch test-write — legacy Safari private mode
  throws on `setItem` despite existing; modern private windows wipe at
  session end = acceptable degradation).
- Read-failure ⇒ show. Version bump only on invalidating redesigns; delete
  prior-version keys on write.
- Signed-in mirror (phase 2): one field on the existing KV user-prefs,
  flushed once per sign-in, most-dismissive-wins. NOT in v1.

## Standing rules adopted

- Contextual beats upfront (NN/g): the tour stays minimal forever; new
  features get coach marks/checklists at the moment of encounter, not tour
  steps. The tour never grows past 5 stops.
- User-triggered replay lives on the Account page ("Replay the tour").
- The wizard already shipped (OnboardingWizard, 374 lines, reopen event,
  rethemed 0.24.0) handles SETUP (follow + notifications); the tour handles
  ORIENTATION. They stay separate; tour runs first-visit, wizard on demand —
  never stacked in one session (the install-banner prompt-stacking lesson).

## Deferred (tracked, deliberate)

- Account-prefs mirror of the dismissal flag (phase 2, one KV field).
- Checklist pattern for activation (follow ≥1 series → enable notifications →
  install PWA) — practitioner data says checklists beat tours for this; pairs
  with W8 launch metrics.
- Hotspot/beacon on newly shipped features (post-v1.0 pattern).

## Build estimate

One PR: `components/Tour.tsx` (~200 lines) + storage util + 4 stop configs +
Account "replay" link + tests for the storage util. Verify per checklist ##1,
7–14 with the battery (focus probes, reduced-motion emulation, 390/1440).
