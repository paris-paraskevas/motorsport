// Which Worker is this? Until now nothing in the code could tell production from
// a preview: the three Workers (paddock-tracker.com, testing., paris.) share one
// Supabase database, one KV store and one R2 bucket, so a design write made on a
// preview lands on the live site. PADDOCK_ENV is set to "production" in
// wrangler.jsonc ONLY. The preview configs never carry it, and a dashboard edit
// cannot add it durably because `wrangler deploy` replaces dashboard vars on the
// next merge.
//
// This is the gate on every route that writes design rows: the home-page layout
// today, the designer's tables from Phase 1 on. Exact match on purpose: "prod",
// "1" or a trailing space must not unlock writes.
export function isProductionWorker(): boolean {
  return process.env.PADDOCK_ENV === 'production';
}
