import Link from 'next/link';
import { publishedPosts } from '@/lib/blog';
import type { Series } from '@/lib/types';

// Paddock's own writing for one series (operator, 2026-08-21: "add blog in one
// of these tabs and filter blogs to whatever series we are on"). Deliberately
// separate from the News tab, which is the aggregated wire and links off-site;
// everything here is ours and stays on the site.
//
// Filtered on BOTH `seriesSlug` and `tags`, because lib/blog.ts:33-35 already
// documents that contract: "A series slug here [in tags] surfaces the post on
// that series' page too, beyond the single seriesSlug". Filtering in memory
// rather than adding another DB reader — publishedPosts() is already the warm
// path for /blog and the feed, and the whole table is a couple of dozen rows.
export async function BlogTab({ series }: { series: Series }) {
  const slug = series.meta.slug;
  const posts = (await publishedPosts()).filter(
    p => p.seriesSlug === slug || p.tags.includes(slug),
  );

  if (posts.length === 0) {
    return (
      <div className="border-[1.5px] border-text bg-surface-elevated p-5 shadow-lg">
        <p className="font-serif text-[17px] leading-snug text-text-muted">
          No {series.meta.name} pieces published yet. Race weekend previews, reports and
          lap-by-lap chronologies land here as they go out.
        </p>
        <Link
          href="/blog"
          className="mt-4 inline-block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand hover:underline"
        >
          Everything on the blog →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <ul>
        {posts.map(p => {
          const stamp = p.publishedAt ?? p.publishAt;
          const date = stamp ? new Date(stamp) : null;
          const dateLabel =
            date && !Number.isNaN(date.getTime())
              ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : null;
          return (
            <li key={p.slug}>
              <Link
                href={`/blog/${p.slug}`}
                className="flex items-start gap-4 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface"
              >
                {p.heroImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.heroImage}
                    alt=""
                    width={160}
                    height={100}
                    loading="lazy"
                    className="hidden aspect-[8/5] w-40 shrink-0 border border-border object-cover sm:block"
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[19px] font-semibold leading-snug text-text">
                    {p.title}
                  </span>
                  <span className="mt-1 block line-clamp-2 font-serif text-[15px] leading-snug text-text-muted">
                    {p.summary}
                  </span>
                  {dateLabel && (
                    <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                      {dateLabel}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href="/blog"
        className="mt-5 inline-block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand hover:underline"
      >
        Everything on the blog →
      </Link>
    </div>
  );
}
