import { betDb, isBettingConfigured } from './betting/client';
import { displayNames } from './betting/friends';
import { isTopicId } from './information/topics';

// Server-only. DB-backed blog pipeline. Complements the file-based MDX blog
// (content/posts, see lib/posts.ts): a post is drafted (by scripts/draft-post or
// an admin), an admin approves it with a publish_at, and the publish-posts cron
// flips it live at that time. RLS-on / no-policies / service_role-only like the
// rest of the schema; all access goes through here. Display names resolve at
// read time (never stored).

// draft      — the writer's private workspace. Notifies nobody.
// in_review  — submitted. Fires the admin notification; awaits a decision.
// approved   — scheduled, with a publish_at the cron acts on.
// published  — live.
// rejected   — terminal.
// `draft` used to do the first two jobs at once, so a half-written save pinged the
// operator and writers learned not to save (migration 20260803120000).
export type PostStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'rejected';

/** Statuses an admin can decide on. A writer submits `draft` → `in_review`; the
 *  operator can still approve straight from `draft`, which is what the headless
 *  scripts/draft-post path and their own hand-authored drafts rely on. */
export const DECIDABLE_STATUSES: PostStatus[] = ['draft', 'in_review'];

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
  /** Where an IMPORTED article was originally published (https:// URL), or null
   *  for an original Paddock piece. Set once at creation. When present, the post
   *  page's rel=canonical points HERE and the sitemap skips the post, so an
   *  import adds no indexable page; the page shows the provenance to readers. */
  originalUrl: string | null;
  status: PostStatus;
  authorId: string;
  authorName: string | null;
  publishAt: string | null;
  publishedAt: string | null;
  heroImage: string | null;
  /** An InfoTopic id (lib/information/topics.ts) when an admin has featured this
   *  post inside the Learn IA, else null. Featuring makes the post appear in a
   *  /information LIST — canonical stays /blog/<slug> and it never becomes an
   *  InfoEntry, so it adds nothing to the sitemap. Set only on `published` rows
   *  (setLearnTopic status-guards it). */
  learnTopic: string | null;
  createdAt: string;
  /** Last write of any kind to the row. Null on rows created before the column
   *  was populated; callers treating this as "content changed" must fall back. */
  updatedAt: string | null;
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

// `updated_at` is selected so the sitemap can advertise a REAL lastmod and the
// article's structured data a real dateModified. Every mutating helper in this
// file already stamps it; nothing read it until 0.334.22.
const COLS =
  'id, slug, title, summary, body, series_slug, tags, status, author_id, publish_at, published_at, hero_image, original_url, learn_topic, created_at, updated_at';

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

/** Normalize + shape-check an import's original URL: null/blank → null (an
 *  original piece); otherwise it must parse as an absolute https:// URL — it is
 *  emitted verbatim as rel=canonical and as the provenance link's href, so
 *  anything else (http:, javascript:, a bare domain, our own /path) is rejected
 *  here. Stricter than hero_image on purpose: an off-site canonical pointing at
 *  garbage de-indexes the post for nothing. */
export function normalizeOriginalUrl(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (v.length > 2048) throw new Error('original URL must be at most 2048 characters');
  let parsed: URL;
  try {
    parsed = new URL(v);
  } catch {
    throw new Error('original URL must be an absolute https:// URL');
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.includes('.')) {
    throw new Error('original URL must be an absolute https:// URL');
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
    originalUrl: (r.original_url as string | null) ?? null,
    status: r.status as PostStatus,
    authorId: r.author_id as string,
    authorName: name,
    publishAt: (r.publish_at as string | null) ?? null,
    publishedAt: (r.published_at as string | null) ?? null,
    heroImage: (r.hero_image as string | null) ?? null,
    learnTopic: (r.learn_topic as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: (r.updated_at as string | null) ?? null,
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
  /** Import provenance (https:// URL) — see BlogPost.originalUrl. Create-time
   *  only, like slug/series/tags. */
  originalUrl?: string | null;
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
      original_url: normalizeOriginalUrl(input.originalUrl),
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

/**
 * Every post regardless of status, newest first — the console's Content tab.
 *
 * Deliberately NOT five `listPosts(status)` calls: the whole point of that view
 * is one table you can scan for state, and five round trips to assemble one
 * table is three too many. Capped, because the console shows a working set and
 * not an archive.
 *
 * Fail-soft, unlike `listPosts`: this feeds a dashboard panel that must degrade
 * to empty rather than 500 the page around it.
 */
export async function listAllPosts(limit = 100): Promise<BlogPost[]> {
  if (!isBettingConfigured()) return [];
  try {
    const { data, error } = await betDb()
      .from('post')
      .select(COLS)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return withNames(data);
  } catch {
    return [];
  }
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
      // nullsFirst:false — Postgres sorts NULLs FIRST on DESC, and a post flipped
      // to published by hand keeps published_at null (only publishDuePosts stamps
      // it), which pinned undated posts to the top of the feed.
      .order('published_at', { ascending: false, nullsFirst: false });
    if (error || !data) return [];
    return withNames(data);
  } catch {
    return [];
  }
}

/** How many published posts a series has — or **null when we cannot tell**,
 *  which is emphatically not the same as zero.
 *
 *  `publishedPosts()` above swallows an unconfigured or unreachable Supabase
 *  into an empty list, which is right for a page that should still render. It
 *  is wrong for the caller this exists for: `seriesTabMetadata` noindexes a
 *  series blog tab that has nothing on it, and reading "empty" off a build that
 *  simply could not see the database would noindex all fourteen — including
 *  Formula 1's, which has posts. `.env.local` points at a local Supabase that
 *  is usually down, so that is the normal case locally, not an edge case.
 *
 *  Only a successful read returns a number. Anything else returns null and the
 *  caller leaves the page indexed. */
export async function seriesPublishedPostCount(slug: string): Promise<number | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb()
      .from('post')
      .select('series_slug, tags')
      .eq('status', 'published');
    if (error || !data) return null;
    // Same membership test the tab itself uses: the post's own series, or the
    // slug appearing as a tag on a cross-series piece.
    return data.filter(
      (r) => r.series_slug === slug || (Array.isArray(r.tags) ? r.tags.includes(slug) : false),
    ).length;
  } catch {
    return null;
  }
}

export type HomeBlogLead = {
  slug: string;
  title: string;
  summary: string;
  heroImage: string | null;
  seriesSlug: string | null;
  publishedAtIso: string;
  readMinutes: number;
};

/** Newest published post for the /app lead, or a SPECIFIC published post when
 *  the operator has pinned one in the home layout (lib/home-layout.ts).
 *
 *  A pinned slug that no longer resolves — unpublished, renamed, deleted —
 *  returns null exactly like an empty table does, and the caller falls back to
 *  the automatic lead. A pin must never leave a hole on the home page. */
export async function fetchHomeBlogLead(pinnedSlug?: string | null): Promise<HomeBlogLead | null> {
  if (!isBettingConfigured()) return null;
  try {
    let q = betDb().from('post').select(COLS).eq('status', 'published');
    q = pinnedSlug
      ? q.eq('slug', pinnedSlug)
      : // Same nullsFirst:false guard as publishedPosts — a post flipped to
        // published by hand keeps published_at null and would otherwise win the
        // DESC sort. created_at breaks ties, so two posts stamped in the same cron
        // tick (publishDuePosts writes one `iso` for the whole batch) still pick a
        // stable lead rather than whatever order Postgres returns.
        q
          .order('published_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });
    const { data, error } = await q.limit(1).maybeSingle();
    if (error || !data) return null;

    // published_at is null on a hand-flipped post (only publishDuePosts stamps
    // it), so created_at is the fallback stamp; a row with neither, or an
    // unparseable one, yields no lead rather than an Invalid Date on the page.
    const stamp = (data.published_at as string | null) ?? (data.created_at as string | null);
    const when = stamp ? new Date(stamp) : null;
    if (!when || Number.isNaN(when.getTime())) return null;

    // 220 words/minute, matching the post page's own eyebrow verbatim
    // (app/(app)/blog/[slug]/page.tsx:252). It must be the same divisor: at 200
    // the Dutch GP preview reads "10 min" in this card and "9 min" on the post
    // itself, for the same body. Change one, change both.
    const words = ((data.body as string | null) ?? '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0).length;

    return {
      slug: data.slug as string,
      title: data.title as string,
      summary: data.summary as string,
      heroImage: (data.hero_image as string | null) ?? null,
      seriesSlug: (data.series_slug as string | null) ?? null,
      publishedAtIso: when.toISOString(),
      readMinutes: Math.max(1, Math.round(words / 220)),
    };
  } catch {
    return null;
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
      // nullsFirst:false because Postgres sorts NULLs FIRST on a DESC order, and a
      // post published by hand keeps published_at null (decidePost only approves;
      // publishDuePosts is what stamps the date). Without this, an undated post
      // pins itself to the top of the author's page — seen live: a 13 Jul recap
      // sitting above two 27 Jul races.
      .order('published_at', { ascending: false, nullsFirst: false });
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
      // Same NULL-ordering guard as publishedPostsByAuthor, so the author's own
      // list matches the order readers see.
      .order('published_at', { ascending: false, nullsFirst: false });
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
      // Same NULL-ordering guard as publishedPosts — and it matters more here,
      // where the list is capped: an undated post would consume a slot at the top.
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error || !data) return [];
    return withNames(data);
  } catch {
    return [];
  }
}

/** Published posts an admin has featured in the Learn IA, newest first, capped.
 *  Pass a topic to scope it to one /information/[topic] page; omit it for the hub.
 *
 *  Same NULL-ordering guard and fail-soft contract as publishedPostsForSeries
 *  above, and for the same reason twice over: this feeds a decorative block, and
 *  the block sits on /information — the most-indexed section of the site. It must
 *  never 500 the hub, and an undated post must never consume a capped slot.
 *
 *  A topic is validated against isTopicId rather than trusted: `learn_topic` has
 *  no CHECK constraint (see the migration), so a value written by hand straight
 *  into the table must render nothing rather than an orphan section. */
export async function learnFeaturedPosts(topic?: string, limit = 6): Promise<BlogPost[]> {
  if (!isBettingConfigured()) return [];
  if (topic !== undefined && !isTopicId(topic)) return [];
  try {
    let q = betDb().from('post').select(COLS).eq('status', 'published');
    q = topic === undefined ? q.not('learn_topic', 'is', null) : q.eq('learn_topic', topic);
    const { data, error } = await q
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error || !data) return [];
    // Drop rows whose stored topic is no longer a real InfoTopic — a topic can be
    // renamed or retired in topics.ts without a migration, and the unfiltered hub
    // query would otherwise surface a post with nowhere to belong.
    return (await withNames(data)).filter(p => p.learnTopic && isTopicId(p.learnTopic));
  } catch {
    return [];
  }
}

/** Feature a published post under a Learn topic, or clear it with null.
 *
 *  Status-guarded to 'published' with an exact count, so "you can only feature a
 *  post that is live" is a database invariant rather than a UI convention — a
 *  draft can never be filed into Learn, and the editorial order (publish, then
 *  feature) holds even if a caller gets it wrong. Same guard shape as
 *  reschedulePost. Caller must have proved admin (the API route's gate). */
export async function setLearnTopic(id: string, topic: string | null): Promise<void> {
  if (topic !== null && !isTopicId(topic)) throw new Error('unknown Learn topic');
  const now = new Date().toISOString();
  const { error, count } = await betDb()
    .from('post')
    .update({ learn_topic: topic, updated_at: now }, { count: 'exact' })
    .eq('id', id)
    .eq('status', 'published');
  if (error) throw new Error(`setLearnTopic failed: ${error.message}`);
  if (!count) throw new Error('only a published post can be featured in Learn');
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

/** Edit a post's text + cover in place (the /studio/[id] editor — spec
 *  docs/superpowers/specs/2026-07-03-draft-inline-edit-design.md; hero image
 *  made editable 0.230.0 for social share cards). Slug, series and publish time
 *  stay immutable in this surface. Trims every provided field and enforces the
 *  same limits as createDraft. The UPDATE is status-guarded to
 *  'draft' | 'in_review' | 'approved' with an exact count, so a published or
 *  rejected post can never be silently rewritten — including the race where the
 *  publish cron takes an approved post live mid-edit (the caller maps that
 *  domain error to a 422).
 *
 *  `expectedUpdatedAt` is the row's `updated_at` as the editor loaded it. When
 *  given, the UPDATE is filtered on it too, so a save from an editor that opened
 *  the post BEFORE someone else (or a script) saved it fails with a "changed
 *  since" error instead of silently reverting their work — which is what
 *  happened to the Monza FP3 draft on 2026-09-07 at 07:48:53Z. Omit it to
 *  overwrite deliberately (the editor's "Save anyway").
 *
 *  Returns the id and the new `updated_at`, which the editor sends back on its
 *  next save. */
export async function updatePostContent(
  id: string,
  patch: PostContentPatch,
  expectedUpdatedAt?: string | null,
): Promise<{ id: string; updatedAt: string }> {
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

  const updatedAt = new Date().toISOString();
  let q = betDb()
    .from('post')
    .update({ ...fields, updated_at: updatedAt }, { count: 'exact' })
    .eq('id', id);
  if (expectedUpdatedAt) q = q.eq('updated_at', expectedUpdatedAt);
  const { error, count } = await q
    // in_review included: a submitted piece stays editable while it waits for a
    // decision, which is the whole point of submitting rather than publishing.
    .in('status', ['draft', 'in_review', 'approved']);
  if (error) throw new Error(`updatePostContent failed: ${error.message}`);
  if (!count) {
    // Zero rows matched. With the version filter on, a newer save is the likely
    // cause rather than a locked status; the caller tells the two apart with a
    // read and answers 409 or 422 accordingly.
    if (expectedUpdatedAt) throw new Error('post changed since it was opened; reload to see the newer copy');
    throw new Error('post is not editable (only drafts, submissions and scheduled posts can be edited)');
  }
  return { id, updatedAt };
}

/** Submit a draft for review: 'draft' → 'in_review' (the owning writer, or an
 *  admin — caller pre-verified). Status-guarded so a double-submit is a no-op
 *  rather than a second notification, and so an already-decided post cannot be
 *  dragged back into the queue. Returns the submitted post for the notifier. */
export async function submitPost(id: string): Promise<BlogPost> {
  const now = new Date().toISOString();
  const { data, error, count } = await betDb()
    .from('post')
    .update({ status: 'in_review', updated_at: now }, { count: 'exact' })
    .eq('id', id)
    .eq('status', 'draft')
    .select(COLS);
  if (error) throw new Error(`submitPost failed: ${error.message}`);
  if (!count || !data?.[0]) throw new Error('post is not a draft (already submitted or decided?)');
  const [post] = await withNames(data);
  return post;
}

/** Approve (schedule) or reject a submitted post (admin only — caller
 *  pre-verified). Approve REQUIRES a publish_at (param overrides the draft-time
 *  value); the post stays hidden until the publish cron flips it at that time.
 *  Status-guarded to DECIDABLE_STATUSES so a double-submit / race can't re-decide
 *  an already-decided post, while still letting the operator approve straight from
 *  'draft' — which their own hand-authored drafts and scripts/draft-post rely on. */
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
      .in('status', DECIDABLE_STATUSES);
    if (error) throw new Error(`decidePost failed: ${error.message}`);
    if (!count) throw new Error('post is not awaiting a decision (already decided?)');
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
    .in('status', DECIDABLE_STATUSES);
  if (error) throw new Error(`decidePost failed: ${error.message}`);
  if (!count) throw new Error('post is not awaiting a decision (already decided?)');
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
