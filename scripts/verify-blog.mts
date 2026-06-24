// Blog pipeline against the local Supabase stack:
//   npx tsx --env-file=.env.local scripts/verify-blog.mts
// (or pass SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY explicitly)
// draft (hidden) → approve with a PAST publish_at (still hidden) → publishDuePosts
// publishes it (and is idempotent on a second run) → reject path → validation guards.
import { ensureAppUser } from '@/lib/betting/credits';
import {
  createDraft,
  decidePost,
  publishDuePosts,
  publishedPosts,
  getPostById,
  getPostBySlug,
} from '@/lib/blog';

const author = 'verify_blog_author';
const admin = 'verify_blog_admin';
await ensureAppUser(author);

const errs: string[] = [];
const stamp = Date.now().toString(36);
const okSlug = `verify-blog-ok-${stamp}`;
const noSlug = `verify-blog-no-${stamp}`;

const okId = await createDraft(author, {
  slug: okSlug,
  title: 'Approved post',
  summary: 'Gets published.',
  body: '# Hello\n\nBody **markdown** with a [link](https://example.com).',
});
const noId = await createDraft(author, {
  slug: noSlug,
  title: 'Rejected post',
  summary: 'Gets rejected.',
  body: 'nope',
});

// Drafts are not public, and the publish cron must not touch them.
if ((await publishedPosts()).some(p => p.id === okId || p.id === noId)) errs.push('drafts must not be public');
if ((await publishDuePosts(new Date())).some(p => p.id === okId)) errs.push('publishDuePosts must not touch drafts');

// Approve with a publish_at in the PAST → approved, but still hidden from the public.
await decidePost(okId, admin, true, new Date(Date.now() - 60_000).toISOString());
if ((await getPostById(okId))?.status !== 'approved') errs.push('expected approved status after approve');
if ((await publishedPosts()).some(p => p.id === okId)) errs.push('approved (scheduled) must not be public yet');

// The publish cron flips it live.
const due = await publishDuePosts(new Date());
if (!due.some(p => p.id === okId)) errs.push('publishDuePosts should publish the due post');
const okNow = await getPostBySlug(okSlug);
if (okNow?.status !== 'published' || !okNow.publishedAt) errs.push('post should be published with published_at set');
if (!(await publishedPosts()).some(p => p.id === okId)) errs.push('published post should be in the public feed');

// Idempotency — a second run publishes nothing.
if ((await publishDuePosts(new Date())).length !== 0) errs.push('publishDuePosts should be idempotent');

// Reject path.
await decidePost(noId, admin, false);
if ((await getPostById(noId))?.status !== 'rejected') errs.push('expected rejected status after reject');
if ((await publishedPosts()).some(p => p.id === noId)) errs.push('rejected must never be public');

// Validation guards.
let emptyTitleRejected = false;
try {
  await createDraft(author, { slug: `verify-blog-x-${stamp}`, title: '', summary: 's', body: 'b' });
} catch {
  emptyTitleRejected = true;
}
if (!emptyTitleRejected) errs.push('empty title should be rejected');

let approveWithoutTimeRejected = false;
const tmpId = await createDraft(author, { slug: `verify-blog-t-${stamp}`, title: 'No time', summary: 's', body: 'b' });
try {
  await decidePost(tmpId, admin, true);
} catch {
  approveWithoutTimeRejected = true;
}
if (!approveWithoutTimeRejected) errs.push('approve without a publish_at should be rejected');
await decidePost(tmpId, admin, false);

console.log(JSON.stringify({ okId, noId, okStatus: okNow?.status, publishedAt: okNow?.publishedAt }, null, 2));
if (errs.length) {
  console.error('VERIFY FAILED:', errs);
  process.exit(1);
}
console.log('VERIFY OK — draft hidden; approve schedules; cron publishes once (idempotent); reject hides; guards hold.');
