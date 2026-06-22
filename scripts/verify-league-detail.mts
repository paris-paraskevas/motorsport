// End-to-end league detail / profile flow against the local Supabase stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-league-detail.mts
// owner creates a league + a member joins -> a member sets the owner's
// nickname/colour (anyone-sets-anyone) -> owner renames -> getLeagueDetail
// reflects all of it.
import { ensureAppUser } from '@/lib/betting/credits';
import {
  createLeague,
  getOrCreateInvite,
  joinLeagueByToken,
  setMemberProfile,
  renameLeague,
  getLeagueDetail,
  kickMember,
  disbandLeague,
} from '@/lib/betting/leagues';

const owner = 'verify_ld_owner';
const member = 'verify_ld_member';
for (const u of [owner, member]) await ensureAppUser(u);

const { id: leagueId } = await createLeague(owner, 'LD League');
const token = await getOrCreateInvite(leagueId, owner);
await joinLeagueByToken(member, token);
await setMemberProfile(leagueId, member, owner, { nickname: 'The Boss', color: '#ff8800' }); // member edits owner
await renameLeague(leagueId, owner, 'LD League Renamed');
const detail = await getLeagueDetail(leagueId, owner);
await kickMember(leagueId, owner, member); // owner removes the member
const afterKick = await getLeagueDetail(leagueId, owner);
await disbandLeague(leagueId, owner); // owner disbands
const afterDisband = await getLeagueDetail(leagueId, owner);

console.log(
  JSON.stringify({ detail, kickedStillMember: afterKick?.members.some(m => m.userId === member) ?? false, afterDisband }, null, 2),
);

const errs: string[] = [];
if (!detail) errs.push('no detail');
if (detail && detail.name !== 'LD League Renamed') errs.push('rename did not take');
const ownerRow = detail?.members.find(m => m.userId === owner);
if (!ownerRow || ownerRow.nickname !== 'The Boss' || ownerRow.color !== '#ff8800') errs.push('member profile not set');
if (!detail?.members.some(m => m.userId === member)) errs.push('joined member missing from detail');
if (detail && !detail.isOwner) errs.push('owner should be isOwner');
if (afterKick?.members.some(m => m.userId === member)) errs.push('kicked member still present');
if (afterDisband !== null) errs.push('disbanded league should be gone');
if (errs.length) { console.error('VERIFY FAILED:', errs); process.exit(1); }
console.log('VERIFY OK — profile (anyone-sets-anyone), rename, kick removes member, disband deletes the league.');
