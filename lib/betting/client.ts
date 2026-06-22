import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// SERVER-ONLY. Clerk is Paddock's auth layer; the betting tables have RLS on
// with no policies, so only the service role (this client, server-side) can
// touch them. Never import this from a client component — it carries the
// service-role key. All betting DB access goes through server code (API
// routes, crons, scripts) that imports from here.

let cached: SupabaseClient | null = null;

/** Lazily-built service-role Supabase client. Throws if env isn't configured. */
export function betDb(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Betting DB not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        '(local: from `supabase status`; prod: the provisioned project).',
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

/** True when the betting DB env is present — lets callers no-op cleanly when it isn't. */
export function isBettingConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
