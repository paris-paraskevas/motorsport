import Link from 'next/link';
import { loadAllPosts } from '@/lib/posts';
import { publishedPosts } from '@/lib/blog';
import { listAuthors } from '@/lib/authors';
import { loadAllSeriesMeta } from '@/lib/series';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { StudioLink } from '@/components/blog/StudioLink';
import { pageMetadata, withPageGate } from '@/lib/design/page-frame';
import { commonsSrcSet, commonsThumb } from '@/lib/commons-thumb';

export const revalidate = 300;

const BASE_METADATA = {
  title: 'Blog',
  description:
    'Original analysis, race recaps, championship deep-dives, and commentary across F1, MotoGP, WEC, IndyCar, NASCAR and more motorsport categories.',
};
export const generateMetadata = pageMetadata('/blog', BASE_METADATA);

// Cards from two sources: DB-backed posts (lib/blog) + file-based MDX posts
// (lib/posts). DB wins on a slug collision; the merged list is newest-first.
interface Card {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  tags?: string[];
  /** Series identity for the row's tint bar + the "By series" rail. */
  seriesSlug?: string;
  seriesName?: string;
  seriesColor?: string;
  /** Only set for authors with a public profile — the card byline IS the link to
   *  it, so a writer with no profile row (and every legacy MDX post) shows no
   *  byline here, exactly as before. Name comes from the profile row rather than
   *  Clerk: it's curated, and it keeps the list off the Clerk Backend API. */
  author?: { name: string; slug: string };
  /** The post's cover. Optional on purpose: a post without one must collapse to
   *  the text-only row rather than reserve an empty slot (all 24 live posts
   *  carry one as of 2026-08-24, so the fallback is a guard, not the norm). */
  heroImage?: string;
}

/** One listing row. Two call sites — the lead and the rest — which is what earns
 *  it a name; it stays in this file rather than becoming a component nobody else
 *  imports. `lead` promotes the cover to full width above the headline, the
 *  newspaper shape, instead of the right-hand thumbnail the other rows take. */
function PostRow({ post, lead = false, lazy = false }: { post: Card; lead?: boolean; lazy?: boolean }) {
  const meta = (
    <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-10 uppercase tracking-[0.14em]">
      {post.seriesName && <span className="font-semibold text-text-muted">{post.seriesName}</span>}
      <time className="tabular-nums text-text-faint">{formatDate(post.publishedAt)}</time>
      {post.author && (
        <Link
          href={`/authors/${post.author.slug}`}
          className="text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
        >
          {post.author.name}
        </Link>
      )}
    </div>
  );

  const words = (
    <Link href={`/blog/${post.slug}`} className="group block">
      <h2
        className={
          'font-serif font-semibold leading-snug text-text group-hover:underline ' +
          (lead ? 'text-26 md:text-30' : 'text-22')
        }
      >
        {post.title}
      </h2>
      {/* The measure is capped so the summary actually WRAPS and therefore
          actually clamps. On the fluid PAGE_WIDE column a row summary ran to a
          single 1600px line at ultrawide, so the clamp never bit and the reader
          got the whole thing — the opposite of the "cut it off so they click"
          intent. Capping the prose, not the page, keeps the fluid layout. */}
      <p
        className={
          'mt-1.5 leading-relaxed text-text-muted ' +
          (lead ? 'max-w-[60ch] text-15 line-clamp-3' : 'line-clamp-2 max-w-[95ch] text-sm')
        }
      >
        {post.summary}
      </p>
    </Link>
  );

  if (lead) {
    return (
      <li className="border-b border-border py-5">
        {/* Cover BESIDE the headline, not above it. Full width at this aspect is
            ~570px tall on a desktop column, which pushed the headline clean off
            the first screen. This is also the shape the /app lead band already
            uses, so the two surfaces agree. Stacks on narrow viewports. */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          {/* The lead image is capped, not just proportional. A bare percentage
              kept growing with the fluid PAGE_WIDE column — at ~2000px it hit
              ~900px while the row thumbnails stayed at their fixed 168px, so the
              hierarchy inverted into one giant picture above a list of stamps.
              The cap holds the lead at roughly 2x a row image: still clearly the
              largest, no longer the whole screen. */}
          {post.heroImage && (
            <Link href={`/blog/${post.slug}`} className="block md:w-[42%] md:max-w-[520px] md:shrink-0">
              {/* Plain <img>: next/image is configured unoptimized on this
                  runtime, so it would add markup and buy nothing. The
                  eslint-disable matches PostHero, which renders this same asset
                  on the post page itself. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={commonsThumb(post.heroImage, 960)}
                srcSet={commonsSrcSet(post.heroImage, [500, 960, 1280]) || undefined}
                sizes={commonsSrcSet(post.heroImage, [500]) ? '(min-width: 1582px) 520px, (min-width: 1024px) calc(42vw - 145px), (min-width: 768px) 42vw, 100vw' : undefined}
                alt={post.title}
                width={1200}
                height={630}
                className="aspect-[1200/630] w-full border border-border bg-surface object-cover"
              />
            </Link>
          )}
          <div className="flex min-w-0 flex-1 gap-3">
            <span
              aria-hidden="true"
              className="mt-1 h-5 w-[3px] shrink-0"
              style={{ backgroundColor: post.seriesColor ?? 'var(--border-strong)' }}
            />
            <div className="min-w-0 flex-1">
              {meta}
              {words}
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row">
      {/* On a phone the picture LEADS the card, the same way the main post does.
          A right-hand thumbnail at this width squeezed the headline into four or
          five lines beside a stamp, which is the layout the operator called
          dreadful. Declared first so the mobile column needs no order rule;
          `sm:order-2` puts it back on the right once there is room.
          A shorter aspect than the lead's 1200/630 keeps the hierarchy visible
          on mobile, where both images are otherwise full-bleed and equal.
          No cover → this element is absent entirely and the text spans the full
          width; nothing reserves space for a picture that isn't there. */}
      {post.heroImage && (
        <Link href={`/blog/${post.slug}`} className="block sm:order-2 sm:w-[220px] sm:shrink-0 lg:w-[260px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={commonsThumb(post.heroImage, 500)}
            alt={post.title}
            width={1200}
            height={630}
            loading={lazy ? 'lazy' : undefined}
            className="aspect-[21/9] w-full border border-border bg-surface object-cover sm:aspect-[1200/630]"
          />
        </Link>
      )}
      <div className="flex min-w-0 flex-1 gap-3 sm:order-1">
        <span
          aria-hidden="true"
          className="mt-1 h-4 w-[3px] shrink-0"
          style={{ backgroundColor: post.seriesColor ?? 'var(--border-strong)' }}
        />
        <div className="min-w-0 flex-1">
          {meta}
          {words}
        </div>
      </div>
    </li>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

async function BlogIndexPage() {
  const [dbPosts, mdxPosts, seriesMetas, authors] = await Promise.all([
    publishedPosts(),
    loadAllPosts(),
    loadAllSeriesMeta(),
    listAuthors(),
  ]);
  const nameBySlug = new Map(seriesMetas.map(m => [m.slug, m.name] as const));
  const colorBySlug = new Map(seriesMetas.map(m => [m.slug, m.color] as const));
  const profileByAuthorId = new Map(
    authors.map(a => [a.clerkUserId, { name: a.displayName, slug: a.slug }] as const),
  );

  const mdxCards: Card[] = mdxPosts.map(p => ({
    slug: p.slug,
    title: p.frontmatter.title,
    summary: p.frontmatter.summary,
    publishedAt: p.frontmatter.publishedAt,
    tags: p.frontmatter.tags,
    heroImage: p.frontmatter.heroImage,
  }));

  const dbCards: Card[] = dbPosts.map(p => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    publishedAt: p.publishedAt ?? p.createdAt,
    tags: p.seriesSlug ? [nameBySlug.get(p.seriesSlug) ?? p.seriesSlug] : undefined,
    seriesSlug: p.seriesSlug ?? undefined,
    seriesName: p.seriesSlug ? nameBySlug.get(p.seriesSlug) : undefined,
    seriesColor: p.seriesSlug ? colorBySlug.get(p.seriesSlug) : undefined,
    author: profileByAuthorId.get(p.authorId),
    heroImage: p.heroImage ?? undefined,
  }));

  const bySlug = new Map<string, Card>();
  for (const c of mdxCards) bySlug.set(c.slug, c);
  for (const c of dbCards) bySlug.set(c.slug, c); // DB wins on slug collision
  const posts = [...bySlug.values()].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  // "By series" rail counts.
  //
  // §4.11's "no thumbnails — there is no licensed photography for most rounds"
  // was the reasoning here, and it is retired on the operator's instruction
  // (2026-08-24: "/blog is a boring list — it needs the cover images"). The
  // premise had also expired: every post carries a curated `hero_image` that the
  // post page and the /app lead band already render, so the pictures exist and
  // were simply not being used on the one page that lists the writing. All 24
  // live posts have one; a post without still renders, text-only.
  const bySeries = new Map<string, { name: string; color: string; count: number }>();
  for (const p of posts) {
    if (!p.seriesSlug || !p.seriesName || !p.seriesColor) continue;
    const cur = bySeries.get(p.seriesSlug);
    if (cur) cur.count += 1;
    else bySeries.set(p.seriesSlug, { name: p.seriesName, color: p.seriesColor, count: 1 });
  }

  return (
    <div className={PAGE_WIDE}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Blog', url: `${SITE_URL}/blog` },
        ])}
      />
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-11 uppercase tracking-[0.18em] text-text-faint font-semibold mb-2">
            Writing
          </div>
          <h1 className="text-text text-3xl md:text-4xl font-bold tracking-tight leading-tight">
            Blog
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            Analysis, recaps, and opinion across motorsport championships.
          </p>
        </div>
        {/* Authoring + moderation live at /studio now; this pill (writers only,
            null for readers) is the only editor-facing element on the page. */}
        <StudioLink />
      </header>

      <Link
        href="/social/threads"
        className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface/40 px-5 py-4 transition-colors duration-(--duration-fast) hover:border-brand/50"
      >
        <div>
          <div className="font-mono text-11 uppercase tracking-[0.16em] text-brand font-semibold">
            Community
          </div>
          <div className="mt-1 text-text font-semibold">
            Threads — fan discussion across the grid
          </div>
        </div>
        <span aria-hidden="true" className="text-text-faint">→</span>
      </Link>

      {posts.length === 0 ? (
        <div className="border border-border bg-surface/40 p-8 text-center">
          <div className="text-text text-base font-medium mb-1">
            Nothing here yet
          </div>
          <div className="text-text-faint text-sm">
            First posts are on the way.
          </div>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
          {/* The newest post leads with its cover at full width; the rest run as
              rows with a thumbnail. Series bar, mono meta, serif headline and
              the standfirst are unchanged — the pictures are the addition. */}
          <ul className="border-t border-text">
            {posts.map((post, i) => (
              <PostRow key={post.slug} post={post} lead={i === 0} lazy={i >= 3} />
            ))}
          </ul>

          {/* The rail: by series + the write-for-us pitch (§4.11). */}
          <aside>
            {bySeries.size > 0 && (
              <>
                <div className="mb-1 border-b border-text pb-1">
                  <span className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">
                    By series
                  </span>
                </div>
                {[...bySeries.entries()]
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([slug, x]) => (
                    <div key={slug} className="flex items-center gap-2.5 border-b border-border py-2">
                      <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: x.color }} />
                      <span className="min-w-0 flex-1 truncate text-sm text-text">{x.name}</span>
                      <span className="shrink-0 font-mono text-10 tabular-nums text-text-faint">{x.count}</span>
                    </div>
                  ))}
              </>
            )}
            <Link
              href="/write-for-us"
              className="mt-4 block border border-border-strong p-3 transition-colors duration-(--duration-fast) hover:border-text"
            >
              <span className="block font-mono text-10 font-semibold uppercase tracking-[0.16em] text-brand">
                Write for Paddock
              </span>
              <span className="mt-1 block font-serif text-15 font-semibold leading-snug text-text">
                Pitch a piece — the data is already here
              </span>
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

export default withPageGate('/blog', BlogIndexPage);
