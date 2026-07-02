# Account gating — design + rollout (Arc 2)

**Date:** 2026-07-02 · **Status:** part 1 shipped (F1 analysis wall); rest specced, held for review.

## Context

Operator (2026-07-01) wants some of the app behind a **free account** (not a paywall — a paid tier is a separate Stripe/legal decision). The confirmed model, after scrutiny:

- **Public + indexable — all series:** schedule / standings / results / history / champions, weekend + session pages, drivers/teams, blog, changelog, calendar, news, about. (Walling non-F1 *content* was rejected — it would de-index ~14 series and starve the sign-up funnel the whole SEO program feeds.)
- **Account-walled — the interactive layer, every series:** F1 analysis/replays + head-to-head, all of `/social`, notifications, home customisation, following a series, thread posting, betting.

## Current auth state (mapped 2026-07-02)

`proxy.ts` route-protects only **user-scoped APIs** (`/api/user/*`, `/api/push/subscribe|unsubscribe|test|inspect`). Everything else is public-with-account: anon gets **device-local** prefs (followed series, home layout via `localStorage`) + sign-in CTAs; every identity write goes through a protected API.

So the interactive **writes are already gated** at the API layer:
- Notifications → `/api/push/*` protected. ✓
- Following / mute / home-layout / onboarded → `/api/user/*` protected. ✓ (anon still gets device-local follow + layout.)
- Threads submit → `/api/threads` checks `auth()` in-route. ✓
- Betting → `/api/bet/*` checks `auth()` + `isBettingConfigured()`. ✓
- `/social`, `/settings`, `/settings/customize` **pages** are public but render CTAs / device-local for anon (graceful, no data leak).

**The one genuinely un-gated interactive surface was the F1 analysis** (Decoder/Qualifying Analysis, Race Story, Practice Analysis, and the new head-to-head) — fully public. That's what part 1 walls.

## Mechanism — three tools

1. **Server gate (leak-free)** for server-rendered analysis: `const { userId } = await auth()`; render the real component only when signed in, else a teaser. A client `<SignedIn>` wrap is **not** enough — the server would still ship the payload in the HTML (view-source leak). Used for the F1 analysis.
2. **Route gate** (`proxy.ts` → sign-in redirect) for inherently-private, non-indexable areas (`/social/*`, `/settings/customize`). Standard Clerk pattern.
3. **CTA gate** for personal *actions* on otherwise-public pages (follow button, enable-notifications, thread submit) — already effectively in place via the protected APIs + anon CTAs.

## Shipped — part 1 (0.151.0)

`components/f1/AnalysisGate.tsx` (server teaser) + server gates on:
- Session page (`…/[session]/page.tsx`): Qualifying Analysis (+ Replay), Race Story, Practice Analysis → signed-in-only; Classification + speed-trap/pit/overtakes boards stay public. Page was already `force-dynamic` → no caching penalty.
- `/f1/compare`: comparison computed only when unlocked (no anon leak); picker stays public + indexable.

**Verified anon (leak-free):** teaser renders; Decoder/comparison payloads absent from anon HTML; `tsc` clean. **Owed:** signed-in visual pass (browser was locked overnight) — confirm the analysis renders for a signed-in user and the `/sign-in` link round-trips.

**SEO note (intended):** the gated analysis content leaves the anon/Googlebot view — that's the point. The indexable surface that remains = results/classification + the round lists + the public picker/teasers.

## Deferred — needs a product call + visual pass (NOT built)

Walling the rest of the interactive layer beyond what's already API-gated means one big reversal:

> **Open decision — the device-local guest model.** Today anon can follow series + customise the home via `localStorage` (a deliberate "public-with-account" design). "Wall following + home-customise" would remove that — anon gets a generic home + a sign-in wall. That's a UX/architecture reversal touching `HomeContent`, `lib/follow.ts`, `lib/homeLayout.ts` and the `/settings/customize` + `/social` pages. It should be an explicit operator call (and visually verified), not shipped blind.

Rollout once decided:
- **`/social/*`, `/settings/customize`:** prefer a **teaser landing** (render a marketing page for anon + real content for signed-in) over a hard `proxy.ts` redirect — better for conversion + keeps a public, indexable marketing surface. If a hard wall is wanted, add matchers to `proxy.ts` `isProtected` (page redirect).
- **Following / home-customise:** only if the operator wants to drop the device-local guest experience. If kept, no change (already syncs to account when signed in).
- **Nav treatment:** show a lock/CTA on walled nav items for anon (pairs with the IA restructure).

## Files

- `components/f1/AnalysisGate.tsx` — the teaser (new).
- `app/(app)/series/[slug]/weekend/[round]/[session]/page.tsx` — session analysis gates.
- `app/(app)/f1/compare/page.tsx` — compare gate.
