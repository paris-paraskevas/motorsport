import { describe, expect, it, vi } from 'vitest';
import { accountFromClerk, applyPlan, countsOf, parseExport, planImport, type ExistingAccount } from './import-clerk-users.mjs';

// PA A2: the import of Clerk's accounts into Supabase Auth, planned from Clerk's user list and the export's password
// digests against what Supabase already holds, and applied through the admin API. Ids never change: each account keeps
// its Clerk id in app_metadata.legacy_id. Nothing personal reaches the output: counts and column names alone.
const verified = (address: string) => ({ emailAddress: address, verification: { status: 'verified' } });
const clerk = (over: Record<string, unknown> = {}) => ({
  id: 'user_1', firstName: 'Alex', lastName: 'Driver', fullName: 'Alex Driver', username: 'alexd', hasImage: true, imageUrl: 'https://img.clerk.com/a',
  primaryEmailAddressId: 'e1', emailAddresses: [{ id: 'e1', ...verified('alex@example.com') }], publicMetadata: { role: 'admin', donor: true }, createdAt: 1700000000000, ...over,
});
const CSV = 'id,first_name,last_name,username,primary_email_address,primary_phone_number,verified_email_addresses,unverified_email_addresses,verified_phone_numbers,unverified_phone_numbers,totp_secret,password_digest,password_hasher\n' +
  'user_1,Alex,Driver,alexd,alex@example.com,,alex@example.com,,,,,"$2a$10$abcdefghijklmnopqrstuv",bcrypt\n' +
  'user_2,Bo,Rider,,bo@example.com,,bo@example.com,,,,,"$argon2id$v=19$m=65536",argon2id\n';
const BCRYPT = '$2a$10$abcdefghijklmnopqrstuv';

describe('the export', () => {
  it('reads the digests by id from the columns it finds, and names the columns it expected but did not find', () => {
    const { digests, columns } = parseExport(CSV);
    expect(digests.get('user_1')).toEqual({ hasher: 'bcrypt', digest: BCRYPT });
    expect(digests.get('user_2')?.hasher).toBe('argon2id');
    expect(columns.missing).toEqual([]);
    expect(parseExport('id,password_digest\nuser_9,"x, y"\n').digests.get('user_9')).toEqual({ hasher: '', digest: 'x, y' });
    expect(parseExport('id\nuser_9\n').columns.missing).toContain('password_hasher');
    expect(parseExport('id,password_digest\nuser_8,"a""b"\n').digests.get('user_8')).toEqual({ hasher: '', digest: 'a"b' });
  });
});

describe('the mapping', () => {
  it('takes the primary address when verified, and none when it is not, whatever another address holds', () => {
    expect(accountFromClerk(clerk())).toMatchObject({ id: 'user_1', email: 'alex@example.com', name: 'Alex Driver', username: 'alexd', imageUrl: 'https://img.clerk.com/a', role: 'admin', donor: true });
    expect(accountFromClerk(clerk({ primaryEmailAddressId: 'e2', emailAddresses: [{ id: 'e2', emailAddress: 'un@example.com', verification: { status: 'unverified' } }, { id: 'e3', ...verified('second@example.com') }] }))).toBeNull();
    expect(accountFromClerk(clerk({ emailAddresses: [{ id: 'e1', emailAddress: 'un@example.com', verification: null }] }))).toBeNull();
    expect(accountFromClerk(clerk({ hasImage: false, publicMetadata: {} }))).toMatchObject({ imageUrl: null, role: null, donor: false });
  });
});

describe('the plan', () => {
  const { digests } = parseExport(CSV);
  const existingOf = (over: Partial<ExistingAccount> = {}): ExistingAccount => ({ id: '00000000-0000-4000-8000-000000000001', email: 'alex@example.com', legacyId: 'user_1', signedIn: false, appMetadata: { legacy_id: 'user_1', role: 'admin', donor: true }, userMetadata: { full_name: 'Alex Driver', username: 'alexd', avatar_url: 'https://x/avatars/k.png' }, ...over });

  it('creates a bcrypt account with its hash and metadata, and one with another digest without a password, counted', () => {
    const actions = planImport([clerk(), clerk({ id: 'user_2', firstName: 'Bo', lastName: 'Rider', fullName: 'Bo Rider', username: null, hasImage: false, emailAddresses: [{ id: 'e2', ...verified('bo@example.com') }], primaryEmailAddressId: 'e2', publicMetadata: {} })], digests, []);
    expect(actions).toEqual([
      { kind: 'create', account: expect.objectContaining({ id: 'user_1' }), passwordHash: BCRYPT },
      { kind: 'create', account: expect.objectContaining({ id: 'user_2', name: 'Bo Rider' }), passwordHash: null },
    ]);
    expect(countsOf(actions)).toEqual({ created: 2, updated: 0, unchanged: 0, withoutPassword: 1, skippedNoEmail: 0, skippedClash: 0 });
  });

  it('a second run on the same export changes nothing; a changed role updates; a signed-in account keeps its own password', () => {
    expect(planImport([clerk()], digests, [existingOf()])).toEqual([{ kind: 'unchanged', account: expect.objectContaining({ id: 'user_1' }) }]);
    const roleChanged = planImport([clerk({ publicMetadata: { role: 'writer' } })], digests, [existingOf()]);
    expect(roleChanged).toEqual([{ kind: 'update', existing: expect.objectContaining({ legacyId: 'user_1' }), account: expect.objectContaining({ role: 'writer' }), passwordHash: BCRYPT }]);
    const signedIn = planImport([clerk({ publicMetadata: { role: 'writer' } })], digests, [existingOf({ signedIn: true })]);
    expect(signedIn[0]).toMatchObject({ kind: 'update', passwordHash: null });
  });

  it('finds the one already there by its legacy id before its address, adopts one held by no legacy id, and skips an address held by another', () => {
    const moved = planImport([clerk({ emailAddresses: [{ id: 'e9', ...verified('new@example.com') }], primaryEmailAddressId: 'e9' })], digests, [existingOf()]);
    expect(moved[0]).toMatchObject({ kind: 'update', existing: { legacyId: 'user_1' } });
    const adopted = planImport([clerk()], digests, [existingOf({ legacyId: null, appMetadata: {} })]);
    expect(adopted[0]).toMatchObject({ kind: 'update', existing: { legacyId: null } });
    const clash = planImport([clerk()], digests, [existingOf({ legacyId: 'user_7', appMetadata: { legacy_id: 'user_7' } })]);
    expect(clash).toEqual([{ kind: 'skip', reason: 'email-held-by-another', id: 'user_1' }]);
    expect(planImport([clerk({ emailAddresses: [] })], digests, [])).toEqual([{ kind: 'skip', reason: 'no-verified-email', id: 'user_1' }]);
  });
});

describe('applying the plan', () => {
  it('creates and updates through the admin API with the legacy id in app_metadata, copies a photo once, and logs counts alone', async () => {
    const createUser = vi.fn(async () => ({ data: { user: { id: 'new' } }, error: null }));
    const updateUserById = vi.fn(async () => ({ data: { user: { id: 'old' } }, error: null }));
    const copyPhoto = vi.fn(async () => 'https://x/avatars/r.png');
    const lines: string[] = [];
    const { digests } = parseExport(CSV);
    const actions = planImport([clerk(), clerk({ id: 'user_3', emailAddresses: [{ id: 'e3', ...verified('c@example.com') }], primaryEmailAddressId: 'e3', publicMetadata: { role: 'writer' } })], digests, [{ id: 'old', email: 'c@example.com', legacyId: 'user_3', signedIn: true, appMetadata: { legacy_id: 'user_3', role: 'reader' }, userMetadata: { full_name: 'Alex Driver', username: 'alexd', avatar_url: 'https://x/avatars/k.png' } }]);
    const counts = await applyPlan(actions, { createUser, updateUserById }, copyPhoto, l => lines.push(l));
    expect(createUser).toHaveBeenCalledWith({ email: 'alex@example.com', email_confirm: true, password_hash: BCRYPT, app_metadata: { legacy_id: 'user_1', role: 'admin', donor: true }, user_metadata: { full_name: 'Alex Driver', username: 'alexd', avatar_url: 'https://x/avatars/r.png' } });
    expect(copyPhoto).toHaveBeenCalledTimes(1);
    expect(updateUserById).toHaveBeenCalledWith('old', { app_metadata: { legacy_id: 'user_3', role: 'writer', donor: false }, user_metadata: { full_name: 'Alex Driver', username: 'alexd', avatar_url: 'https://x/avatars/k.png' } });
    expect(counts).toEqual({ created: 1, updated: 1, unchanged: 0, withoutPassword: 0, skippedNoEmail: 0, skippedClash: 0 });
    for (const l of lines) expect(l).not.toMatch(/@|user_/);
  });

  it('a provider’s failure stops the run with its address and ids redacted', async () => {
    const failing = vi.fn(async () => ({ data: { user: null }, error: { message: 'user 00000000-0000-4000-8000-000000000001 with alex@example.com and user_1 already registered' } }));
    const { digests } = parseExport(CSV);
    const actions = planImport([clerk()], digests, []);
    await expect(applyPlan(actions, { createUser: failing, updateUserById: vi.fn() }, async () => null, () => {})).rejects.toThrow('create 1 failed: user [id] with [address] and [id] already registered');
  });
});
