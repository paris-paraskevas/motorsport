// End-to-end league invite flow against the local Supabase stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-invite.mts
// owner creates a league -> generates a (stable) invite -> joiner joins by token
// (added as member, inviter returned) -> getInvite resolves. Friend wiring is
// covered by verify-friends; this covers the invite/join lib + token stability.
import { betDb } from '@/lib/betting/client';
import { ensureAppUser, ensureBettingUser } from '@/lib/betting/credits';
import { sendFriendRequest } from '@/lib/betting/friends';
import { createLeague, getOrCreateInvite, getInvite, joinLeagueByToken } from '@/lib/betting/leagues';

const owner = 'verify_inv_owner';
const joiner = 'verify_inv_joiner';
for (const u of [owner, joiner]) await ensureAppUser(u);

const { id: leagueId } = await createLeague(owner, 'Verify Invite League');
const token = await getOrCreateInvite(leagueId, owner);
const token2 = await getOrCreateInvite(leagueId, owner); // must be stable
const info = await getInvite(token);
const res = await joinLeagueByToken(joiner, token);
const { data: membership } = await betDb()
  .from('league_member')
  .select('user_id')
  .eq('league_id', leagueId)
  .eq('user_id', joiner)
  .maybeSingle();

console.log(JSON.stringify({ leagueId, token, tokenStable: token === token2, info, res, joinerIsMember: !!membership }, null, 2));

const errs: string[] = [];
if (!token) errs.push('no token generated');
if (token !== token2) errs.push('invite token should be stable per (league, inviter)');
if (!info || info.leagueId !== leagueId || info.inviterId !== owner) errs.push('getInvite did not resolve');
if (res.leagueId !== leagueId || res.inviterId !== owner) errs.push('joinLeagueByToken returned wrong league/inviter');
if (!membership) errs.push('joiner was not added as a member');

// Regression (invite sign-up onboarding): a brand-new account arriving via the
// invite link WITHOUT ever visiting /play. The join page raises the inviter→viewer
// friend request server-side; friendship.addressee_id FK-requires the viewer's
// app_user row. Before the fix the page ensured only the inviter, so a never-
// onboarded viewer 500'd. Control proves the FK genuinely fails when the row is
// missing; the fix path proves onboarding-first makes the whole flow work.
const control = 'verify_inv_never'; // never onboarded → the friend-request FK should fail
let fkFailsWithoutRow = false;
try {
  await sendFriendRequest(owner, control);
} catch {
  fkFailsWithoutRow = true;
}
if (!fkFailsWithoutRow) errs.push('control: friend request to a never-onboarded user should FK-fail');

const fresh = 'verify_inv_fresh';
await ensureBettingUser(fresh); // what the join page now does first
await sendFriendRequest(owner, fresh); // inviter → viewer (the page's server-side raise)
const freshJoin = await joinLeagueByToken(fresh, token);
const { data: freshReq } = await betDb()
  .from('friendship')
  .select('status')
  .or(`and(requester_id.eq.${owner},addressee_id.eq.${fresh}),and(requester_id.eq.${fresh},addressee_id.eq.${owner})`)
  .maybeSingle();
const { data: freshMember } = await betDb()
  .from('league_member')
  .select('user_id')
  .eq('league_id', leagueId)
  .eq('user_id', fresh)
  .maybeSingle();
console.log(JSON.stringify({ fkFailsWithoutRow, freshJoin, freshReq, freshMember: !!freshMember }, null, 2));
if (!freshReq) errs.push('fix: friend request to the fresh (just-onboarded) user was not created');
if (!freshMember) errs.push('fix: fresh user was not added as a member');

if (errs.length) { console.error('VERIFY FAILED:', errs); process.exit(1); }
console.log(
  'VERIFY OK — invite stable + resolves + join works; a never-onboarded viewer FK-fails without onboarding and fully joins with it (invite sign-up fix).',
);
