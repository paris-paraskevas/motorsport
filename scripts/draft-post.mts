// Create a blog draft (status 'draft') on Supabase from a `.md` or `.json` file,
// then ping admins — so it lands in the /blog admin queue to read/edit/schedule/approve.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... BLOG_AUTHOR_ID=... \
//     npx tsx scripts/draft-post.mts drafts/<slug>.md
//   npx tsx --env-file=.env.local scripts/draft-post.mts post.json
//   npx tsx scripts/draft-post.mts drafts/<slug>.md --dry   # parse + print, NO DB write
//
// .md   → the weekend-post exemplar format, parsed by parseDraftMarkdown.
// .json → { authorId?, slug, title, summary, body, seriesSlug?, heroImage?, publishAt? }.
// authorId falls back to the BLOG_AUTHOR_ID env var (a .md carries no authorId).
// The admin push fires only when KV + Clerk + VAPID env are present (no-op
// otherwise) — so locally it just creates the draft; on prod env it also notifies.
import { readFileSync } from 'node:fs';
import { ensureAppUser } from '@/lib/betting/credits';
import { createDraft, type DraftInput } from '@/lib/blog';
import { parseDraftMarkdown } from '@/lib/blog-draft-md';
import { notifyAdminsDraftReady } from '@/lib/blog-notify';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const file = args.find(a => !a.startsWith('--'));
if (!file) {
  console.error('usage: tsx scripts/draft-post.mts <draft.md|post.json> [--dry]');
  process.exit(1);
}

let input: DraftInput & { authorId?: string };
try {
  if (file.endsWith('.md')) {
    input = parseDraftMarkdown(readFileSync(file, 'utf-8'));
  } else {
    input = JSON.parse(readFileSync(file, 'utf-8')) as DraftInput & { authorId?: string };
    if (!input.slug || !input.title || !input.summary || !input.body) {
      throw new Error('slug, title, summary and body are required');
    }
  }
} catch (e) {
  console.error(`draft parse failed (${file}): ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

if (dry) {
  console.log(`DRY RUN — parsed DraftInput from ${file} (no DB write):`);
  console.log(`  slug:       ${input.slug}`);
  console.log(`  title:      ${input.title.length}/140`);
  console.log(`  summary:    ${input.summary.length}/300`);
  console.log(`  body:       ${input.body.length}/50000`);
  console.log(`  seriesSlug: ${input.seriesSlug ?? '(none — site-wide)'}`);
  console.log(`  publishAt:  ${input.publishAt ?? '(null — operator sets at approval)'}`);
  process.exit(0);
}

const authorId = input.authorId ?? process.env.BLOG_AUTHOR_ID;
if (!authorId) {
  console.error('authorId required (in the JSON or the BLOG_AUTHOR_ID env var)');
  process.exit(1);
}

await ensureAppUser(authorId);
const id = await createDraft(authorId, {
  slug: input.slug,
  title: input.title,
  summary: input.summary,
  body: input.body,
  seriesSlug: input.seriesSlug ?? null,
  heroImage: input.heroImage ?? null,
  publishAt: input.publishAt ?? null,
});
console.log(`draft created: id=${id} slug=${input.slug}`);

try {
  await notifyAdminsDraftReady({ id, title: input.title });
  console.log('admin notify attempted (no-op without KV/Clerk/VAPID env)');
} catch (e) {
  console.error('admin notify failed (non-fatal):', e instanceof Error ? e.message : e);
}
