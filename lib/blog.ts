import { betDb, isBettingConfigured } from './betting/client';
import { displayNames } from './betting/friends';

// Server-only. DB-backed blog pipeline. Complements the file-based MDX blog
// (content/posts, see lib/posts.ts): a post is drafted (by scripts/draft-post or
// an admin), an admin approves it with a publish_at, and the publish-posts cron
// flips it live at that time. RLS-on / no-policies / service_role-only like the
// rest of the schema; all access goes through here. Display names resolve at
// read time (never stored).

export type PostStatus = 'draft' | 'approved' | 'published' | 'rejected';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  /** Optional series tag (a slug from content/series/<slug>). null = site-wide. */
  seriesSlug: string | null;
  status: PostStatus;
  authorId: string;
  authorName: string | null;
  publishAt: string | null;
  publishedAt: string | null;
  heroImage: string | null;
  createdAt: string;
}

export const TITLE_MAX = 140;
export const SUMMARY_MAX = 300;
export const BODY_MAX = 50000;

const COLS =
  'id, slug, title, summary, body, series_slug, status, author_id, publish_at, published_at, hero_image, created_at';

function toPost(r: Record<string, unknown>, name: string | null): BlogPost {
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    summary: r.summary as string,
    body: r.body as string,
    seriesSlug: (r.series_slug as string | null) ?? null,
    status: r.status as PostStatus,
    authorId: r.author_id as string,
    authorName: name,
    publishAt: (r.publish_at as string | null) ?? null,
    publishedAt: (r.published_at as string | null) ?? null,
    heroImage: (r.hero_image as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

async function withNames(rows: Record<string, unknown>[]): Promise<BlogPost[]> {
  const names = await displayNames([...new Set(rows.map(r => r.author_id as string))]);
  return rows.map(r => toPost(r, names.get(r.author_id as string) ?? null));
}

export interface DraftInput {
  slug: string;
  title: string;
  summary: string;
  body: string;
  seriesSlug?: string | null;
  heroImage?: string | null;
  publishAt?: string | null;
}

/** Create a draft post (status 'draft'). Author must be an onboarded app_user.
 *  Enforces a kebab-case unique slug. publishAt is optional at draft time — an
 *  admin sets/confirms it on approval. Returns the new post id. */
export async function createDraft(authorId: string, input: DraftInput): Promise<string> {
  const slug = input.slug.trim().toLowerCase();
  const title = input.title.trim();
  const summary = input.summary.trim();
  const body = input.body.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('slug must be kebab-case (a–z, 0–9, hyphens)');
  if (!title || title.length > TITLE_MAX) throw new Error(`title must be 1–${TITLE_MAX} characters`);
  if (!summary || summary.length > SUMMARY_MAX) throw new Error(`summary must be 1–${SUMMARY_MAX} characters`);
  if (!body || body.length > BODY_MAX) throw new Error(`body must be 1–${BODY_MAX} characters`);

  const db = betDb();
  const { data: clash } = await db.from('post').select('id').eq('slug', slug).maybeSingle();
  if (clash) throw new Error(`slug already exists: ${slug}`);

  const { data, error } = await db
    .from('post')
    .insert({
      slug,
      title,
      summary,
      body,
      series_slug: input.seriesSlug?.trim() || null,
      hero_image: input.heroImage?.trim() || null,
      publish_at: input.publishAt ?? null,
      author_id: authorId,
    })
    .select('id')
    .single();
  if (error) throw new Error(`createDraft failed: ${error.message}`);
  return data.id as string;
}

/** Posts in a given status, newest first, author names resolved. */
export async function listPosts(status: PostStatus, seriesSlug?: string): Promise<BlogPost[]> {
  let q = betDb().from('post').select(COLS).eq('status', status);
  if (seriesSlug) q = q.eq('series_slug', seriesSlug);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw new Error(`listPosts failed: ${error.message}`);
  return withNames(data ?? []);
}

/** Published posts for the public feed, newest published first. Fail-soft so the
 *  /blog page never breaks on a DB hiccup or an unprovisioned Supabase. */
export async function publishedPosts(): Promise<BlogPost[]> {
  if (!isBettingConfigured()) return [];
  try {
    const { data, error } = await betDb()
      .from('post')
      .select(COLS)
      .eq('status', 'published')
      .order('published_at', { ascending: false });
    if (error || !data) return [];
    return withNames(data);
  } catch {
    return [];
  }
}

/** One post by slug (any status), or null. The page gates non-published visibility. */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb().from('post').select(COLS).eq('slug', slug).maybeSingle();
    if (error || !data) return null;
    const names = await displayNames([data.author_id as string]);
    return toPost(data, names.get(data.author_id as string) ?? null);
  } catch {
    return null;
  }
}

/** One post by id (any status), or null. */
export async function getPostById(id: string): Promise<BlogPost | null> {
  const { data, error } = await betDb().from('post').select(COLS).eq('id', id).maybeSingle();
  if (error || !data) return null;
  const names = await displayNames([data.author_id as string]);
  return toPost(data, names.get(data.author_id as string) ?? null);
}

/** Approve (schedule) or reject a draft (admin only — caller pre-verified).
 *  Approve REQUIRES a publish_at (param overrides the draft-time value); the post
 *  stays hidden until the publish cron flips it at that time. Status-guarded to
 *  'draft' so a double-submit / race can't re-decide an already-decided post. */
export async function decidePost(
  id: string,
  adminId: string,
  approve: boolean,
  publishAt?: string | null,
): Promise<void> {
  const db = betDb();
  const now = new Date().toISOString();

  if (!approve) {
    const { error, count } = await db
      .from('post')
      .update({ status: 'rejected', updated_at: now }, { count: 'exact' })
      .eq('id', id)
      .eq('status', 'draft');
    if (error) throw new Error(`decidePost failed: ${error.message}`);
    if (!count) throw new Error('post is not a draft (already decided?)');
    return;
  }

  // Resolve the publish time: explicit param wins, else the value set at draft time.
  let when = publishAt ?? null;
  if (!when) {
    const { data } = await db.from('post').select('publish_at').eq('id', id).maybeSingle();
    when = (data?.publish_at as string | null) ?? null;
  }
  if (!when || Number.isNaN(new Date(when).getTime())) throw new Error('publish_at required to approve');

  const { error, count } = await db
    .from('post')
    .update(
      { status: 'approved', approved_by: adminId, approved_at: now, publish_at: when, updated_at: now },
      { count: 'exact' },
    )
    .eq('id', id)
    .eq('status', 'draft');
  if (error) throw new Error(`decidePost failed: ${error.message}`);
  if (!count) throw new Error('post is not a draft (already decided?)');
}

/** The publish-cron worker: flip every approved post whose publish_at has passed
 *  to 'published'. Each UPDATE is status-guarded with an exact count, so only the
 *  rows THIS call actually flips are returned — overlapping ticks / a redeploy
 *  mid-run can't double-publish. Returns the newly-published posts (names
 *  resolved) for the cron to fan a push out on. */
export async function publishDuePosts(now: Date): Promise<BlogPost[]> {
  const db = betDb();
  const iso = now.toISOString();
  const { data: due, error } = await db
    .from('post')
    .select('id')
    .eq('status', 'approved')
    .lte('publish_at', iso);
  if (error) throw new Error(`publishDuePosts query failed: ${error.message}`);

  const flipped: Record<string, unknown>[] = [];
  for (const row of due ?? []) {
    const { data, count } = await db
      .from('post')
      .update({ status: 'published', published_at: iso, updated_at: iso }, { count: 'exact' })
      .eq('id', row.id as string)
      .eq('status', 'approved')
      .select(COLS);
    // A single row's failure (or a lost race) must not abort the batch.
    if (count && data && data[0]) flipped.push(data[0]);
  }
  return flipped.length ? withNames(flipped) : [];
}
