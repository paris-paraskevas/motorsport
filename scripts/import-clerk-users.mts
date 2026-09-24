// PA A2: import Clerk's accounts into Supabase Auth, before the switch (A3). Ids never change: each account keeps its
// Clerk id in app_metadata.legacy_id, so no table, column, function or env var moves.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... CLERK_SECRET_KEY=... \
//     npx tsx scripts/import-clerk-users.mts --csv <the export from Clerk Dashboard › Settings › User exports>
//   ... --write            writes (the default is a dry run: the plan's counts alone)
//   ... --only <address>   one account
//
// Clerk's user list (GET /v1/users, 500 a page) gives everything but the password digests; the export's CSV gives those,
// read by column name (id, password_digest, password_hasher; the other columns it writes are listed for the record). A
// bcrypt digest carries over as password_hash; another digest imports the account without a password. What Supabase
// already holds is read once (listUsers) and matched by legacy_id first, by address second: a match by address with no
// legacy id is adopted, one with another legacy id is skipped. The password hash is written only while the account has
// never signed in on Supabase, so a rerun never undoes a new password; a rerun on the same export changes nothing.
// A Clerk photo (hasImage) is copied into the avatars bucket under a random name once; a photo already copied stays.
// The output is counts and column names alone: never an address, never an id. This script handles personal data and
// runs by the operator's hand.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';

export interface ClerkUserLike {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  username?: string | null;
  hasImage?: boolean;
  imageUrl?: string | null;
  primaryEmailAddressId?: string | null;
  emailAddresses?: { id?: string; emailAddress: string; verification?: { status?: string } | null }[];
  publicMetadata?: { role?: unknown; donor?: unknown } | null;
  createdAt?: number;
}
export interface ClerkAccount { id: string; email: string; name: string | null; username: string | null; imageUrl: string | null; role: string | null; donor: boolean; createdAt: number }
export interface Digest { hasher: string; digest: string }
export interface ExistingAccount { id: string; email: string | null; legacyId: string | null; signedIn: boolean; appMetadata: Record<string, unknown>; userMetadata: Record<string, unknown> }
export type Action =
  | { kind: 'create'; account: ClerkAccount; passwordHash: string | null }
  | { kind: 'update'; existing: ExistingAccount; account: ClerkAccount; passwordHash: string | null }
  | { kind: 'unchanged'; account: ClerkAccount }
  | { kind: 'skip'; reason: 'no-verified-email' | 'email-held-by-another'; id: string };
export interface Counts { created: number; updated: number; unchanged: number; withoutPassword: number; skippedNoEmail: number; skippedClash: number }

/** The columns Clerk's export writes (read 2026-09-24); the script needs id, password_digest and password_hasher. */
export const EXPECTED_COLUMNS = ['id', 'first_name', 'last_name', 'username', 'primary_email_address', 'primary_phone_number', 'verified_email_addresses', 'unverified_email_addresses', 'verified_phone_numbers', 'unverified_phone_numbers', 'totp_secret', 'password_digest', 'password_hasher'];

/** RFC 4180 rows: quoted fields may hold commas, newlines and doubled quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

/** The digests by Clerk id, from the columns the export holds; the expected columns it lacks are named for the record. */
export function parseExport(csv: string): { digests: Map<string, Digest>; columns: { found: string[]; missing: string[] } } {
  const [header = [], ...rows] = parseCsv(csv);
  const at = (name: string) => header.indexOf(name);
  const found = EXPECTED_COLUMNS.filter(c => at(c) >= 0);
  const missing = EXPECTED_COLUMNS.filter(c => at(c) < 0);
  const digests = new Map<string, Digest>();
  const id = at('id'), digest = at('password_digest'), hasher = at('password_hasher');
  if (id >= 0 && digest >= 0) {
    for (const r of rows) {
      if (r[id] && r[digest]) digests.set(r[id], { hasher: hasher >= 0 ? (r[hasher] ?? '') : '', digest: r[digest] });
    }
  }
  return { digests, columns: { found, missing } };
}

/** The account Clerk's user becomes: the verified primary address, else the first verified one; none for none. */
export function accountFromClerk(u: ClerkUserLike): ClerkAccount | null {
  const verified = (u.emailAddresses ?? []).filter(e => e.verification?.status === 'verified');
  const email = verified.find(e => e.id && e.id === u.primaryEmailAddressId)?.emailAddress ?? verified[0]?.emailAddress ?? null;
  if (!email) return null;
  const meta = u.publicMetadata ?? null;
  return {
    id: u.id,
    email,
    name: u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || null,
    username: u.username || null,
    imageUrl: u.hasImage ? u.imageUrl || null : null,
    role: typeof meta?.role === 'string' ? meta.role : null,
    donor: meta?.donor === true,
    createdAt: u.createdAt ?? 0,
  };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const appOf = (a: ClerkAccount) => ({ legacy_id: a.id, role: a.role, donor: a.donor });
const userOf = (a: ClerkAccount, avatar: string | null) => ({ full_name: a.name, username: a.username, ...(avatar ? { avatar_url: avatar } : {}) });
/** Whether Supabase already holds this account as Clerk has it (a rerun on the same export changes nothing). */
const sameAs = (e: ExistingAccount, a: ClerkAccount): boolean =>
  str(e.appMetadata.legacy_id) === a.id && str(e.appMetadata.role) === a.role && (e.appMetadata.donor === true) === a.donor &&
  str(e.userMetadata.full_name) === a.name && str(e.userMetadata.username) === a.username &&
  (!a.imageUrl || str(e.userMetadata.avatar_url) !== null) && (e.email ?? '').toLowerCase() === a.email.toLowerCase();

/** The plan: each Clerk account against what Supabase holds, matched by legacy id first and by address second. */
export function planImport(users: ClerkUserLike[], digests: Map<string, Digest>, existing: ExistingAccount[]): Action[] {
  const byLegacy = new Map(existing.filter(e => e.legacyId).map(e => [e.legacyId as string, e]));
  const byEmail = new Map(existing.filter(e => e.email).map(e => [(e.email as string).toLowerCase(), e]));
  const actions: Action[] = [];
  for (const u of users) {
    const account = accountFromClerk(u);
    if (!account) { actions.push({ kind: 'skip', reason: 'no-verified-email', id: u.id }); continue; }
    const d = digests.get(account.id);
    const hash = d && d.hasher === 'bcrypt' ? d.digest : null;
    let match = byLegacy.get(account.id) ?? null;
    if (!match) {
      const byAddress = byEmail.get(account.email.toLowerCase()) ?? null;
      if (byAddress && byAddress.legacyId && byAddress.legacyId !== account.id) { actions.push({ kind: 'skip', reason: 'email-held-by-another', id: account.id }); continue; }
      match = byAddress;
    }
    if (!match) actions.push({ kind: 'create', account, passwordHash: hash });
    else if (sameAs(match, account)) actions.push({ kind: 'unchanged', account });
    else actions.push({ kind: 'update', existing: match, account, passwordHash: match.signedIn ? null : hash });
  }
  return actions;
}

export function countsOf(actions: Action[]): Counts {
  const c: Counts = { created: 0, updated: 0, unchanged: 0, withoutPassword: 0, skippedNoEmail: 0, skippedClash: 0 };
  for (const a of actions) {
    if (a.kind === 'create') { c.created++; if (!a.passwordHash) c.withoutPassword++; }
    else if (a.kind === 'update') c.updated++;
    else if (a.kind === 'unchanged') c.unchanged++;
    else if (a.reason === 'no-verified-email') c.skippedNoEmail++;
    else c.skippedClash++;
  }
  return c;
}

/** Addresses and ids never reach the output, a provider's error message included. */
const redact = (s: string) => s.replace(/\S+@\S+/g, '[address]').replace(/user_[A-Za-z0-9]+/g, '[id]');
export const planLine = (c: Counts) => `plan: create ${c.created} (${c.withoutPassword} without a password) · update ${c.updated} · unchanged ${c.unchanged} · skipped: no verified address ${c.skippedNoEmail}, address held by another ${c.skippedClash}`;

interface AdminLike {
  createUser(attributes: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  updateUserById(uid: string, attributes: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
}

/** Writes the plan through the admin API, in order; the first failure stops the run (a rerun picks up where it left). */
export async function applyPlan(actions: Action[], admin: AdminLike, copyPhoto: (src: string) => Promise<string | null>, log: (line: string) => void): Promise<Counts> {
  let done = 0;
  for (const a of actions) {
    if (a.kind === 'create') {
      const avatar = a.account.imageUrl ? await copyPhoto(a.account.imageUrl) : null;
      const { error } = await admin.createUser({ email: a.account.email, email_confirm: true, ...(a.passwordHash ? { password_hash: a.passwordHash } : {}), app_metadata: appOf(a.account), user_metadata: userOf(a.account, avatar) });
      if (error) throw new Error(`create ${done + 1} failed: ${redact(error.message)}`);
    } else if (a.kind === 'update') {
      const avatar = str(a.existing.userMetadata.avatar_url) ?? (a.account.imageUrl ? await copyPhoto(a.account.imageUrl) : null);
      const moved = a.account.email.toLowerCase() !== (a.existing.email ?? '').toLowerCase();
      const { error } = await admin.updateUserById(a.existing.id, { ...(moved ? { email: a.account.email, email_confirm: true } : {}), ...(a.passwordHash ? { password_hash: a.passwordHash } : {}), app_metadata: appOf(a.account), user_metadata: userOf(a.account, avatar) });
      if (error) throw new Error(`update ${done + 1} failed: ${redact(error.message)}`);
    }
    done++;
  }
  const counts = countsOf(actions);
  log(`written: ${planLine(counts)}`);
  return counts;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const csvPath = opt('--csv');
  const only = opt('--only')?.toLowerCase();
  const write = args.includes('--write');
  if (!csvPath) {
    console.error('usage: tsx scripts/import-clerk-users.mts --csv <export.csv> [--write] [--only <address>]');
    process.exit(1);
  }
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, secret = process.env.CLERK_SECRET_KEY;
  if (!url || !key || !secret) {
    console.error('set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and CLERK_SECRET_KEY (the names alone are printed here)');
    process.exit(1);
  }
  const { digests, columns } = parseExport(readFileSync(csvPath, 'utf8'));
  console.log(`export: ${digests.size} digests · columns found: ${columns.found.join(', ') || 'none'}${columns.missing.length ? ` · not found: ${columns.missing.join(', ')}` : ''}`);
  const clerk = createClerkClient({ secretKey: secret });
  const users: ClerkUserLike[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data } = await clerk.users.getUserList({ limit: 500, offset, orderBy: '+created_at' });
    users.push(...data);
    if (data.length < 500) break;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const existing: ExistingAccount[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${redact(error.message)}`);
    existing.push(...data.users.map(u => ({ id: u.id, email: u.email ?? null, legacyId: str(u.app_metadata?.legacy_id), signedIn: Boolean(u.last_sign_in_at), appMetadata: u.app_metadata ?? {}, userMetadata: u.user_metadata ?? {} })));
    if (data.users.length < 1000) break;
  }
  const selected = only ? users.filter(u => accountFromClerk(u)?.email.toLowerCase() === only) : users;
  console.log(`clerk: ${users.length} accounts${only ? ` · ${selected.length} selected` : ''} · supabase: ${existing.length} already there`);
  const actions = planImport(selected, digests, existing);
  console.log(planLine(countsOf(actions)));
  if (!write) {
    console.log('dry run: nothing written (add --write)');
    return;
  }
  // A Clerk photo into the avatars bucket under a random name: png, jpeg or webp, at most 2 MB; anything else stays out.
  const copyPhoto = async (src: string): Promise<string | null> => {
    const res = await fetch(src);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('jpeg') || type.includes('jpg') ? 'jpg' : null;
    if (!ext) return null;
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > 2 * 1024 * 1024) return null;
    const path = `${randomBytes(12).toString('hex')}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`, upsert: false });
    if (error) return null;
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  };
  await applyPlan(actions, supabase.auth.admin, copyPhoto, line => console.log(line));
}

if (process.argv[1] && basename(process.argv[1]) === 'import-clerk-users.mts') await main();
