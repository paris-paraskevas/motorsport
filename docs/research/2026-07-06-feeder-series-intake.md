# Feeder-series self-serve data intake — design doc

**Status:** proposal (design-before-code, per the W7 UGC rule). Author: overnight session 2026-07-06. Source idea: operator `/feedback` "Contact feeder series" + the 2026-07-06 refinement ("send them a page/link to upload their data in any form they choose").

## Goal

Let a feeder championship (karting, junior open-wheel, regional series, …) **hand us their schedule/results data with minimal friction**, so we can add them as a series on the site. The operator's framing: send each series a link; they upload in **any format they choose**.

## The load-bearing insight

"Any format" is frictionless for *them* and shifts all the cost to *us*: every series will send a different CSV / Excel / PDF / emailed table / Google Sheet. So this is not "an upload widget" — it is an **intake → normalize → approve** pipeline, where the flexible bit is only the first hop:

```
series submitter → upload (any file)  →  staging (raw, untouched)
                                          →  normalization (map → our schema)
                                          →  operator approve
                                          →  live: content/series/<slug>/*  (git-versioned CMS)
```

This mirrors patterns Paddock already runs, so it is not greenfield:
- **threads / blog** = submit → admin-approve-before-public (Clerk `publicMetadata.role`, `lib/threads.ts` `isStaff`, `lib/blog.ts` draft→approve→cron).
- **feedback board** = `betDb()` service-role table + `notifyNewFeedback()` email to `CONTACT_TO_EMAIL` (`lib/feedback.ts`, `lib/email.ts`).
- **"conversational authoring is the CMS"** = curated data lives in `content/series/<slug>/` (git-versioned, PR-reviewable). The pipeline's *output* should land there, not in a live-served DB table — keeps the CMS model + the accuracy invariants intact.

## MVP (smallest shippable slice)

A single intake surface + notification, **no auto-ingest**:

1. **`/contribute/[token]`** (or reuse a generic `/contribute`) — a public page behind a per-series opaque token we email out. Fields: series name, contact email, season, a free-text note, and a **file upload** (accept `.csv,.xlsx,.pdf,.json,.txt`, size-capped).
2. **Store the raw file** in a Supabase Storage bucket (`series-submissions/`, private) + insert a `series_submission` row (service-role, RLS-on/no-policies like `feedback`): `id, token, series_name, contact_email, season, note, file_path, status('new'|'reviewing'|'ingested'|'rejected'), created_at`.
3. **Notify the operator** via the existing `sendEmail()` / branded-email helper (best-effort in `after()`, same as `notifyNewFeedback`).
4. **Operator reviews** the file, and we curate it into `content/series/<new-slug>/` the normal (conversational) way. Status flips to `ingested`.

That's genuinely small — it's the contact/feedback form + a file field + a Storage put + a table row. No new auth product, no parser, no per-series schema work in v1.

## Phase 2+ (after MVP proves demand)

- **Normalization assist:** a staff-only admin view listing submissions; open a file → a Claude-assisted mapping step proposes `sessions.json` / `rounds.json` / `drivers.json` in our schema for operator approval (curation, not blind auto-ingest — the chart==standings accuracy bar means no unreviewed data goes live).
- **Structured templates:** offer an optional CSV/Sheet template so willing series submit already-close-to-schema data (cuts our mapping cost) while "any format" stays the fallback.
- **Submitter accounts / status:** if series want to see "received / published", promote the token link to a Clerk-gated portal with a submissions history.

## Open decisions (operator)

1. **Auth for the link** — opaque per-series token (frictionless, emailable, no account) vs Clerk sign-in (accountable, heavier). Recommend **tokened + no account for v1**; add accounts only if abuse or status-tracking demands it.
2. **Accepted formats + caps** — confirm the allow-list + max file size (proposed: 25 MB).
3. **Legal / data rights** — we need the series' permission to publish their data; add a one-line consent checkbox ("I have the right to share this and grant Paddock permission to display it"). Worth a quick check given the licensing discipline elsewhere.
4. **Storage** — confirm Supabase Storage is provisioned (the driver portraits use external Commons URLs, not Storage, so this would be the first Storage use). Alternatively stash small files as base64 in the row (simpler, capped low) — but Storage is the right home.
5. **Spam/abuse** — a public upload endpoint needs a bound (Turnstile like the sign-up flow, or rate-limit + the token gate).

## Won't-do / non-goals (v1)

- No automatic parsing/ingestion to live data — everything is reviewed before it ships (accuracy invariant).
- No new public "series directory of contributors" surface.
- Not a general UGC platform — scoped to series-data intake.

## Pre-mortem (most likely failure)

We build the upload widget, a few series actually use it, and the raw files pile up **un-normalized** because the mapping step (Phase 2) never gets built — so "self-serve upload" delivers files nobody turns into a live series. Mitigation: treat the **normalization/curation step as the real deliverable**, not the upload form; only send the link to series once we can commit to turning a submission around.

## Effort estimate

- MVP: ~half a day (page + Storage put + table + email + Turnstile). Needs the 5 decisions above + a Supabase migration (prod, PAT-gated — operator/sanctioned flow).
- Phase 2 normalization admin: multi-session; design its own doc when demand is proven.
