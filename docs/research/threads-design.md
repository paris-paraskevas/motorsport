# Threads — community UGC with admin approval (design)

The W7 "blog threads + UGC" ask; the long-planned Supabase user-writes trigger. Built 2026-06-24.

## Decisions (locked for v1)

- **One table, `thread`** — top-level posts (title + body). `status` pending → approved / rejected. **No replies in v1** — a `thread_reply` table is the obvious follow-on, deliberately out of scope to keep the first cut shippable.
- **Approve-before-public.** A submission lands `pending`; only an admin moves it to `approved` (public) or `rejected`. Nothing user-written is ever public until an admin approves it — the safe default for open UGC, and it doubles as spam control for v1.
- **Admin = Clerk `publicMetadata.role === 'admin'`** (no Clerk Organizations product, per the W7 note). Checked server-side via `currentUser()` in the admin API action + the moderation-queue render. The operator sets their own role in the Clerk dashboard; until then there are zero admins and the queue is inert (so the feature is safe to ship before anyone's an admin).
- **Access model = the rest of the betting schema:** RLS-on / no-policies / service-role-only; all access through `lib/threads.ts` (server) from API routes. Author identity = `app_user.clerk_user_id` (`ensureAppUser` on submit, satisfying the FK); display names resolved at read time (like the leaderboards), never stored.
- **Routes:** `/threads` (public list of approved + a signed-in submit form + an admin-only "pending review" queue) and `/threads/[id]` (one thread — approved is public; a pending thread is visible only to its author + admins, badged "pending review"). `POST /api/threads` (submit), `POST /api/threads/[id]` (admin approve/reject).
- **Body is plain text**, rendered with whitespace preserved (`whitespace-pre-wrap`). No markdown/HTML in v1 → no sanitisation surface.

## Deferred (follow-ons)
- Replies / comments on a thread.
- Markdown / rich text (would need sanitisation).
- Author edit / delete; report / flag.
- Per-user submit rate limit (v1 relies on approve-before-public).
- Nav placement — linked from `/blog` for now, not a primary nav tab.
