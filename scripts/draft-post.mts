// Draft a blog post into the DB (status 'draft') from a JSON file, then ping
// admins that a draft is ready to review:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/draft-post.mts post.json
// or:  npx tsx --env-file=.env.local scripts/draft-post.mts post.json
//
// post.json: { authorId?, slug, title, summary, body, seriesSlug?, heroImage?, publishAt? }
// authorId falls back to the BLOG_AUTHOR_ID env var. The admin push fires only
// when KV + Clerk + VAPID env are present (it no-ops cleanly otherwise) — so
// locally it just creates the draft; on prod env it also notifies admins.
import { readFileSync } from 'node:fs';
import { ensureAppUser } from '@/lib/betting/credits';
import { createDraft } from '@/lib/blog';
import { notifyAdminsDraftReady } from '@/lib/blog-notify';

const file = process.argv[2];
if (!file) {
  console.error('usage: tsx scripts/draft-post.mts <post.json>');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(file, 'utf-8')) as {
  authorId?: string;
  slug?: string;
  title?: string;
  summary?: string;
  body?: string;
  seriesSlug?: string | null;
  heroImage?: string | null;
  publishAt?: string | null;
};

const authorId = raw.authorId ?? process.env.BLOG_AUTHOR_ID;
if (!authorId) {
  console.error('authorId required (in the JSON or the BLOG_AUTHOR_ID env var)');
  process.exit(1);
}
if (!raw.slug || !raw.title || !raw.summary || !raw.body) {
  console.error('slug, title, summary and body are required');
  process.exit(1);
}

await ensureAppUser(authorId);
const id = await createDraft(authorId, {
  slug: raw.slug,
  title: raw.title,
  summary: raw.summary,
  body: raw.body,
  seriesSlug: raw.seriesSlug ?? null,
  heroImage: raw.heroImage ?? null,
  publishAt: raw.publishAt ?? null,
});
console.log(`draft created: id=${id} slug=${raw.slug}`);

try {
  await notifyAdminsDraftReady({ id, title: raw.title });
  console.log('admin notify attempted (no-op without KV/Clerk/VAPID env)');
} catch (e) {
  console.error('admin notify failed (non-fatal):', e instanceof Error ? e.message : e);
}
