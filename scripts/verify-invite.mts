// End-to-end league invite flow against the local Supabase stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-invite.mts
// owner creates a league -> generates a (stable) invite -> joiner joins by token
// (added as member, inviter returned) -> getInvite resolves. Friend wiring is
// covered by verify-friends; this covers the invite/join lib + token stability.
import { betDb } from '@/lib/betting/client';
import { ensureAppUser } from '@/lib/betting/credits';
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
if (errs.length) { console.error('VERIFY FAILED:', errs); process.exit(1); }
console.log('VERIFY OK — invite generated (stable), resolves, join adds the member + returns the inviter.');
