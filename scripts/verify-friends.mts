// End-to-end friends flow against the local Supabase stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-friends.mts
// request -> accept (both see the friendship) -> reciprocal no-op -> decline removes.
// Run after applying the friendship migration to a DB.
import { betDb } from '@/lib/betting/client';
import { ensureAppUser } from '@/lib/betting/credits';
import {
  sendFriendRequest,
  respondToFriendRequest,
  listFriends,
  listIncomingRequests,
  searchUsers,
  removeFriend,
  setDisplayNameIfMissing,
} from '@/lib/betting/friends';

const a = 'verify_friend_a';
const b = 'verify_friend_b';
const c = 'verify_friend_c';
for (const u of [a, b, c]) await ensureAppUser(u);
await setDisplayNameIfMissing(a, 'Verify Alpha'); // names so search can find them
await setDisplayNameIfMissing(b, 'Verify Bravo');
await setDisplayNameIfMissing(c, 'Verify Charlie');
// re-runnable: clear any prior verify edges
await betDb().from('friendship').delete().or(`requester_id.in.(${a},${b},${c}),addressee_id.in.(${a},${b},${c})`);

const r1 = await sendFriendRequest(a, b); // A -> B
const bIncoming = await listIncomingRequests(b);
await respondToFriendRequest(b, a, true); // B accepts
const aFriends = await listFriends(a);
const bFriends = await listFriends(b);
const r2 = await sendFriendRequest(b, a); // reciprocal — already friends
await sendFriendRequest(c, a); // C -> A
await respondToFriendRequest(a, c, false); // A declines C
const aIncoming = await listIncomingRequests(a);

// search: C finds A by display name (excludes the searcher; needs a display_name)
const found = await searchUsers(c, 'Verify Alpha');
// remove: A unfriends B → neither lists the other
await removeFriend(a, b);
const aAfterRemove = await listFriends(a);
const bAfterRemove = await listFriends(b);

console.log(JSON.stringify({ r1, r2, bIncoming, aFriends, bFriends, aIncoming, found, aAfterRemove, bAfterRemove }, null, 2));

const errs: string[] = [];
if (r1 !== 'requested') errs.push(`expected 'requested', got '${r1}'`);
if (!bIncoming.some(x => x.requesterId === a)) errs.push('B should have an incoming request from A');
if (!aFriends.some(f => f.userId === b)) errs.push('A should be friends with B');
if (!bFriends.some(f => f.userId === a)) errs.push('B should be friends with A');
if (r2 !== 'already') errs.push(`reciprocal request should be 'already', got '${r2}'`);
if (aIncoming.some(x => x.requesterId === c)) errs.push('declined request from C should be gone');
if (!found.some(u => u.userId === a)) errs.push('search should find A by display name');
if (found.some(u => u.userId === c)) errs.push('search should exclude the searcher');
if (aAfterRemove.some(f => f.userId === b)) errs.push('removeFriend should unfriend B for A');
if (bAfterRemove.some(f => f.userId === a)) errs.push('removeFriend should be reciprocal for B');
if (errs.length) { console.error('VERIFY FAILED:', errs); process.exit(1); }
console.log('VERIFY OK — request/accept/reciprocal/decline; search finds by name; removeFriend unfriends both sides.');
