# Draft in-page editing — design

**Date:** 2026-07-03 · **Status:** approved (operator, this session) · **Branch:** `feat/blog-draft-inline-edit`

Admins get a pencil on blog draft/scheduled preview pages that turns the post text editable in place, so a draft can be hand-corrected during review — before approving + scheduling it in the /blog queue.

## Decisions (operator-locked)

1. **Edit scope:** body + title + summary. Slug, series, hero image, publish time stay immutable in this surface.
2. **Editor style:** markdown textarea swapped into the page (the stored source of truth is markdown). Rejected: contentEditable WYSIWYG (HTML→markdown round-trip is lossy); split-pane live preview (duplicates the server render pipeline client-side — sanitization drift).
3. **Where it shows:** `draft` **and** `approved` (scheduled) posts — the two admin-preview states on `/blog/[slug]`. Published/rejected posts are not editable here.

## Architecture

### UI — `components/blog/DraftEditor.tsx` (new, client)

- Rendered by `app/(app)/blog/[slug]/page.tsx` **only in the admin-preview branch** (where the amber banner shows today). The public/published path is untouched.
- Owns the amber banner + post header + article for that branch. Props: `{ id, title, summary, body, bodyHtml, dateLabel, banner: { kind: 'draft' } | { kind: 'scheduled'; label: string }, author: { name, image } | null }`.
- **View mode** renders what ships today (banner, header, `bodyHtml` via `dangerouslySetInnerHTML`) plus a pencil icon button (lucide `Pencil`, `aria-label="Edit draft"`) right-aligned in the banner row.
- **Edit mode** swaps header + article for a form seeded from props: title input, summary textarea, full-height body markdown textarea, Save / Cancel. Cancel with unsaved changes → `confirm()`.
- Shared header JSX (date, title, byline, summary) is extracted to a small presentational `PostHeader` used by both the public server path and DraftEditor view mode — two real consumers.

### API — `PATCH` on `app/api/blog/[id]/route.ts` (existing file)

- Same guards as `POST`: `isBettingConfigured()` 503 → Clerk auth 401 → `isAdmin` 403.
- Body: `{ title?, summary?, body? }` — at least one field present, each non-empty after trim; else 400.
- Delegates to new `updatePostContent(id, fields)` in `lib/blog.ts`:
  - trims; enforces existing `TITLE_MAX` / `SUMMARY_MAX` / `BODY_MAX`;
  - updates only rows with `status IN ('draft','approved')` — anything else is a domain error → 422 (mirrors `decidePost`'s error mapping);
  - returns the updated row id or throws.
- `POST` (approve/reject) is unchanged.

### Data flow

Pencil → form → `PATCH /api/blog/[id]` → 200 → `router.refresh()` → RSC re-renders (`getPostBySlug` → `renderMarkdown`) → fresh `bodyHtml` prop → component drops to view mode. No client-side markdown rendering.

## Error handling

- Inline error line in the form (the `PostModeration` pattern): 422 shows the validation/domain message (e.g. body over 50 000 chars, "post is not editable"), network errors say so, other statuses show the API `error` string.
- Race: if the publish cron takes an `approved` post live mid-edit, the PATCH hits a `published` row → 422 "not editable" → the admin sees the error; refresh shows the live post. Accepted (rare, self-explaining).

## Testing + ship gates

- Vitest: `updatePostContent` — status gating (draft ✓, approved ✓, published/rejected ✗), field validation (limits, empty, no-fields), trimming.
- `tsc` clean; no new lint.
- **Visual gate:** browser-verify signed-in by editing the real British GP draft (`d0c0af61`) — pencil renders, edit → save → re-rendered markdown, cancel-confirm works. Known blocker: `/blog/[slug]` 500s on **localhost** (pre-existing local-env issue) — fix that first or verify on prod post-merge (admin-only surface, low blast radius).
- Release: minor bump + `CHANGELOG.md` + `RELEASES.md`.

## Out of scope

Published-post editing · slug/series/heroImage/publish-time editing · `PostComposer` changes · MDX posts (no DB row → no pencil) · live preview pane.
