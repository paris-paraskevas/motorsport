// Threads moderation flow against the local Supabase stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-threads.mts
// submit two → both pending → approve one, reject the other → only the approved
// shows in the public feed; pending/rejected stay hidden. Plus a validation check.
import { ensureAppUser } from '@/lib/betting/credits';
import { createThread, listThreads, decideThread, getThread } from '@/lib/threads';

const author = 'verify_thread_author';
const admin = 'verify_thread_admin';
await ensureAppUser(author);

const okId = await createThread(author, 'Approved thread', 'This one gets approved.');
const noId = await createThread(author, 'Rejected thread', 'This one gets rejected.');

const errs: string[] = [];

const pending = await listThreads('pending');
if (!pending.find(t => t.id === okId) || !pending.find(t => t.id === noId)) errs.push('both should start pending');
if ((await listThreads('approved')).some(t => t.id === okId || t.id === noId)) {
  errs.push('nothing should be public before approval');
}

await decideThread(okId, admin, true);
await decideThread(noId, admin, false);

const approved = await listThreads('approved');
if (!approved.find(t => t.id === okId)) errs.push('approved thread should be in the public feed');
if (approved.find(t => t.id === noId)) errs.push('rejected thread must NOT be public');
if ((await getThread(okId))?.status !== 'approved') errs.push('getThread should reflect approved');
if ((await getThread(noId))?.status !== 'rejected') errs.push('getThread should reflect rejected');

let emptyRejected = false;
try {
  await createThread(author, '', 'no title');
} catch {
  emptyRejected = true;
}
if (!emptyRejected) errs.push('an empty title should be rejected');

console.log(JSON.stringify({ okId, noId, approvedHasOk: !!approved.find(t => t.id === okId) }, null, 2));
if (errs.length) {
  console.error('VERIFY FAILED:', errs);
  process.exit(1);
}
console.log('VERIFY OK — submissions are pending; approve publishes, reject hides; empty title rejected.');
