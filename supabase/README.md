# Paddock Betting — Supabase

Database for the Paddock Betting game (S9). Full design: `docs/research/predictions-design.md`.
**Free credits + optional paid (no cashout); virtual-credit betting; win-rate leaderboard.**

## What's here (Phase 1a)

- `migrations/` — schema (7 tables, enums, RLS-on-no-policies, append-only ledger trigger, `user_balance` view) + the grant functions (`grant_monthly`, `grant_monthly_all`) + service_role grants.
- Access model: **Clerk is the auth layer, not Supabase Auth.** RLS is enabled on every table with no policies; only `service_role` (the server-side client) can touch them — `anon`/`authenticated` get nothing. App access goes through `lib/betting/*` (server-only) from Next API routes / crons.
- `config.toml` is trimmed: `auth`, `storage`, `realtime`, `inbucket` are **disabled** (we use Clerk + only need Postgres/PostgREST/Studio locally).

## Local dev

```bash
# Docker must be running.
npx supabase start            # boots Postgres + PostgREST + Studio (Studio: http://127.0.0.1:54323)
npx supabase migration up     # apply any new migrations
```

For `next dev` (and the verify script) add to `.env.local`:

```
SUPABASE_URL=http://127.0.0.1:54321
# Local default service_role key (public, local-only — NOT a production secret):
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

Verify the data layer end-to-end against the local stack:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local key above> \
  npx tsx scripts/verify-betting.mts
```

## Production provisioning (operator — gated on the betting go + legal review for paid)

```bash
npx supabase login                          # interactive (browser)
npx supabase link --project-ref <ref>       # the Supabase project you created
npx supabase db push                        # applies migrations/ to the cloud DB
```

Then in **Vercel → Project → Environment Variables (Production)** set:
- `SUPABASE_URL` = your project URL
- `SUPABASE_SERVICE_ROLE_KEY` = your project's service_role key (server-only; never `NEXT_PUBLIC_`)

Finally, schedule the monthly grant: point a daily cron at `GET /api/cron/grant-credits` with
`Authorization: Bearer $CRON_SECRET` (GitHub Action like `.github/workflows/health.yml`, or a Vercel cron). It's idempotent per calendar month, so daily is safe.

> The route fails closed: 503 if `CRON_SECRET` is unset/wrong, and 503 "betting DB not configured" until the Supabase env vars are present — so it's safe in prod before provisioning.
