// Sync the PREVIEW secret set onto a preview Worker.
//
//   npm run secrets:sync -- paris
//   npm run secrets:sync -- testing
//
// Or directly:
//   npx tsx --env-file=.env.production.local scripts/sync-worker-secrets.mts paris
//
// Why this exists: creating a preview Worker otherwise means hand-copying ten
// secrets. Cloudflare's Secrets Store would centralise them, but its bindings are
// async-only (`await env.X.get()`) while this codebase — and the Clerk and Supabase
// SDKs inside it — read `process.env.*` synchronously, so adopting it would mean an
// async hydration shim in worker.ts running before any SDK initialises, on every
// cold start, whose failure mode is silent (everything reads as unconfigured and
// the fail-soft layers serve empty pages). Not worth it to avoid one command.
//
// The env file MUST be loaded with `--env-file`: values in .env.production.local are
// quoted, Node's parser strips the quotes, and naive readers do not. An unstripped
// value is what fed Supabase `"https://…"` and failed every warm-cron write for ~20
// hours while reporting success.
//
// Values are never printed — names and lengths only.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The preview set: deliberately NOT prod's 23. A preview must not be able to email
// (no RESEND_API_KEY), push to real subscribers (no VAPID_PRIVATE_KEY) or touch
// analytics (no GA4/GSC/Bing keys).
const PREVIEW_KEYS = [
  'CLERK_SECRET_KEY',
  'CONTACT_TO_EMAIL',
  'CRON_SECRET',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'KV_REST_API_READ_ONLY_TOKEN',
  'KV_REST_API_TOKEN',
  'KV_REST_API_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_URL',
] as const;

// CONTACT_TO_EMAIL is not in the env file; this is the operator-set default.
const DEFAULTS: Record<string, string> = { CONTACT_TO_EMAIL: 'pparaskevas.dev@gmail.com' };

const TARGETS: Record<string, { worker: string; config: string }> = {
  paris: { worker: 'motorsport-paris', config: 'wrangler.paris.jsonc' },
  panagiotis: { worker: 'motorsport-panagiotis', config: 'wrangler.panagiotis.jsonc' },
  testing: { worker: 'motorsport-testing', config: 'wrangler.testing.jsonc' },
};

function die(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) die(`no target. Usage: npm run secrets:sync -- <${Object.keys(TARGETS).join('|')}>`);

// Refuse production outright. The env file holds only these 10 of prod's 23, so a
// "sync" there would be a partial overwrite dressed up as a full one.
if (/^(prod|production|motorsport)$/i.test(arg)) {
  die('production is not a valid target: .env.production.local holds 10 of its 23 secrets, so this would be a partial overwrite. Set prod secrets deliberately, one at a time.');
}

const target = TARGETS[arg];
if (!target) die(`unknown target "${arg}". Valid: ${Object.keys(TARGETS).join(', ')}`);

const payload: Record<string, string> = {};
const missing: string[] = [];
for (const key of PREVIEW_KEYS) {
  const value = process.env[key] ?? DEFAULTS[key];
  if (!value) {
    missing.push(key);
    continue;
  }
  // Defence in depth: if a quote survived, the loader was wrong and the value would
  // be written with the quotes baked in.
  if (/^["']|["']$/.test(value)) {
    die(`${key} still carries surrounding quotes — run with \`--env-file=.env.production.local\` so Node strips them.`);
  }
  payload[key] = value;
}
if (missing.length > 0) {
  die(`missing ${missing.length} value(s): ${missing.join(', ')}. Did you pass --env-file=.env.production.local?`);
}

console.log(`→ ${target.worker}  (${target.config})`);
for (const [key, value] of Object.entries(payload)) {
  console.log(`   ${key.padEnd(34)} ${String(value.length).padStart(4)} chars`);
}

const dir = mkdtempSync(join(tmpdir(), 'paddock-secrets-'));
const file = join(dir, 'secrets.json');
try {
  writeFileSync(file, JSON.stringify(payload), { mode: 0o600 });
  const run = spawnSync('npx', ['wrangler', 'secret', 'bulk', file, '-c', target.config], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (run.status !== 0) die(`wrangler exited ${run.status}`);
} finally {
  // Always remove the payload, including on failure — it holds real secrets.
  rmSync(dir, { recursive: true, force: true });
}

console.log(`✓ ${Object.keys(payload).length} secrets synced to ${target.worker}`);
