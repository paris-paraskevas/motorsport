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
  /** Free-form tags (normalized kebab). A series slug here surfaces the post on
   *  that series' page too, beyond the single seriesSlug. */
  tags: string[];
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
export const TAGS_MAX = 12;
const TAG_MAX_LEN = 40;

/** Normalize a raw tag list to lowercase kebab slugs: trim, lowercase, collapse
 *  runs of non-alphanumerics to a hyphen, drop blanks/dupes, cap each tag's
 *  length and the total count. Exported for its own test — the per-series feed
 *  (PR4) matches a series slug against these, so the normalization must agree
 *  with the series-slug format. */
export function normalizeTags(raw: string[] | undefined | null): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (typeof t !== 'string') continue;
    const tag = t
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, TAG_MAX_LEN);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= TAGS_MAX) break;
  }
  return out;
}

const COLS =
  'id, slug, title, summary, body, series_slug, tags, status, author_id, publish_at, published_at, hero_image, created_at';

/** Normalize + shape-check a hero/cover image reference: null/blank → null;
 *  otherwise it must be an absolute https:// URL or a root-relative /path —
 *  the OG card and the post-page <img> embed it as-is, so anything else
 *  (javascript:, protocol-relative, bare filenames) is rejected here. */
function normalizeHeroImage(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (v.length > 2048 || !/^(https:\/\/|\/)/.test(v) || v.startsWith('//')) {
    throw new Error('hero image must be an https:// URL or a root-relative /path');
  }
  return v;
}

function toPost(r: Record<string, unknown>, name: string | null): BlogPost {
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    summary: r.summary as string,
    body: r.body as string,
    seriesSlug: (r.series_slug as string | null) ?? null,
    tags: (r.tags as string[] | null) ?? [],
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
  tags?: string[];
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
      tags: normalizeTags(input.tags),
      hero_image: normalizeHeroImage(input.heroImage),
      publish_at: input.publishAt ?? null,
      author_id: authorId,
    })
    .select('id')
    .single();
  if (error) throw new Error(`createDraft failed: ${error.message}`);
  return data.id as string;
}

/** Posts in a given status, newest first, author names resolved.
 *  `authorId` scopes the list to one author's posts — the blog API uses it so
 *  an `author`-role user sees only their own drafts/scheduled posts, while
 *  admins omit it and see everything. */
export async function listPosts(
  status: PostStatus,
  seriesSlug?: string,
  authorId?: string,
): Promise<BlogPost[]> {
  let q = betDb().from('post').select(COLS).eq('status', status);
  if (seriesSlug) q = q.eq('series_slug', seriesSlug);
  if (authorId) q = q.eq('author_id', authorId);
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

/** One author's published posts, newest first — the /authors/<slug> page. Posts the
 *  author has hidden from their own profile are excluded here and nowhere else
 *  (they stay live at /blog/<slug> and in the feed). Same fail-soft contract as
 *  publishedPosts(): an unreachable DB yields an empty list rather than a 500 on a
 *  public page. */
export async function publishedPostsByAuthor(clerkUserId: string): Promise<BlogPost[]> {
  if (!isBettingConfigured() || !clerkUserId) return [];
  try {
    const { data, error } = await betDb()
      .from('post')
      .select(COLS)
      .eq('status', 'published')
      .eq('author_id', clerkUserId)
      .eq('hide_on_author_page', false)
      .order('published_at', { ascending: false });
    if (error || !data) return [];
    return withNames(data);
  } catch {
    return [];
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuthorPostVisibility {
  id: string;
  slug: string;
  title: string;
  publishedAt: string | null;
  hidden: boolean;
}

/** The author's own published posts WITH their hide flags — the settings screen
 *  (which must show hidden ones, unlike the public page). */
export async function authorPostVisibility(clerkUserId: string): Promise<AuthorPostVisibility[]> {
  if (!isBettingConfigured() || !clerkUserId) return [];
  try {
    const { data, error } = await betDb()
      .from('post')
      .select('id, slug, title, published_at, hide_on_author_page')
      .eq('status', 'published')
      .eq('author_id', clerkUserId)
      .order('published_at', { ascending: false });
    if (error || !data) return [];
    return data.map(r => ({
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as string,
      publishedAt: (r.published_at as string | null) ?? null,
      hidden: Boolean(r.hide_on_author_page),
    }));
  } catch {
    return [];
  }
}

/** Set exactly which of the author's published posts are hidden from their
 *  profile. Two scoped UPDATEs rather than per-id writes, and both are filtered on
 *  `author_id = clerkUserId`, so a forged id in the list cannot touch a post the
 *  caller does not own. */
export async function setAuthorPostVisibility(clerkUserId: string, hiddenIds: string[]): Promise<void> {
  const db = betDb();
  const now = new Date().toISOString();
  // UUID-shaped only: the "show the rest" update below interpolates these ids into
  // a PostgREST `not.in.(…)` filter string, so anything carrying a comma or a
  // parenthesis would alter the query rather than just fail to match.
  const ids = [...new Set(hiddenIds.filter(id => typeof id === 'string' && UUID_RE.test(id)))];

  const hide = db
    .from('post')
    .update({ hide_on_author_page: true, updated_at: now })
    .eq('author_id', clerkUserId)
    .eq('status', 'published');
  const { error: hideError } = ids.length > 0 ? await hide.in('id', ids) : { error: null };
  if (hideError) throw new Error(`could not update visibility: ${hideError.message}`);

  const show = db
    .from('post')
    .update({ hide_on_author_page: false, updated_at: now })
    .eq('author_id', clerkUserId)
    .eq('status', 'published')
    .eq('hide_on_author_page', true);
  const { error: showError } = ids.length > 0 ? await show.not('id', 'in', `(${ids.join(',')})`) : await show;
  if (showError) throw new Error(`could not update visibility: ${showError.message}`);
}

/** Published posts for a series' page — matched by the primary series_slug OR a
 *  `tags` entry equal to the series slug (so a post tagged with a series surfaces
 *  there even when that series isn't its primary one). Newest first, capped.
 *  Fail-soft: this feeds a decorative block and must never 500 the series page. */
export async function publishedPostsForSeries(seriesSlug: string, limit = 4): Promise<BlogPost[]> {
  if (!isBettingConfigured() || !seriesSlug) return [];
  try {
    const { data, error } = await betDb()
      .from('post')
      .select(COLS)
      .eq('status', 'published')
      .or(`series_slug.eq.${seriesSlug},tags.cs.{${seriesSlug}}`)
      .order('published_at', { ascending: false })
      .limit(limit);
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

export interface PostContentPatch {
  title?: string;
  summary?: string;
  body?: string;
  /** Cover image (shown above the article body): an https:// URL or
   *  root-relative /path; null (or blank) clears it. */
  heroImage?: string | null;
}

/** Edit a post's text + cover in place (the /blog/[slug] admin-preview pencil —
 *  spec docs/superpowers/specs/2026-07-03-draft-inline-edit-design.md; hero image
 *  made editable 0.230.0 for social share cards). Slug, series and publish time
 *  stay immutable in this surface. Trims every provided field and enforces the
 *  same limits as createDraft. The UPDATE is status-guarded to 'draft' | 'approved'
 *  with an exact count, so a published or rejected post can never be silently
 *  rewritten — including the race where the publish cron takes an approved post
 *  live mid-edit (the caller maps that domain error to a 422). Returns the
 *  updated post id. */
export async function updatePostContent(id: string, patch: PostContentPatch): Promise<string> {
  const fields: Record<string, string | null> = {};
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title || title.length > TITLE_MAX) throw new Error(`title must be 1–${TITLE_MAX} characters`);
    fields.title = title;
  }
  if (patch.summary !== undefined) {
    const summary = patch.summary.trim();
    if (!summary || summary.length > SUMMARY_MAX) throw new Error(`summary must be 1–${SUMMARY_MAX} characters`);
    fields.summary = summary;
  }
  if (patch.body !== undefined) {
    const body = patch.body.trim();
    if (!body || body.length > BODY_MAX) throw new Error(`body must be 1–${BODY_MAX} characters`);
    fields.body = body;
  }
  if (patch.heroImage !== undefined) {
    fields.hero_image = normalizeHeroImage(patch.heroImage); // null clears
  }
  if (Object.keys(fields).length === 0) {
    throw new Error('at least one of title, summary, body, heroImage is required');
  }

  const { error, count } = await betDb()
    .from('post')
    .update({ ...fields, updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id)
    .in('status', ['draft', 'approved']);
  if (error) throw new Error(`updatePostContent failed: ${error.message}`);
  if (!count) throw new Error('post is not editable (only drafts and scheduled posts can be edited)');
  return id;
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

/** Move an already-approved (scheduled, not-yet-published) post to a new
 *  publish_at. Status-guarded to 'approved' so a published / draft / rejected
 *  post can't be moved — only something still waiting to go live. Caller
 *  pre-verified (admin or the owning writer, per the API's authorizePostActor). */
export async function reschedulePost(id: string, publishAt: string): Promise<void> {
  if (!publishAt || Number.isNaN(new Date(publishAt).getTime())) {
    throw new Error('publish_at required to reschedule');
  }
  const now = new Date().toISOString();
  const { error, count } = await betDb()
    .from('post')
    .update({ publish_at: publishAt, updated_at: now }, { count: 'exact' })
    .eq('id', id)
    .eq('status', 'approved');
  if (error) throw new Error(`reschedulePost failed: ${error.message}`);
  if (!count) throw new Error('post is not scheduled (only scheduled posts can be re-scheduled)');
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
