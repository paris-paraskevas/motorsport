import Link from 'next/link';
import type { BlogPost } from '@/lib/blog';
import { getTopic } from '@/lib/information/topics';

/** The "From our contributors" band on /information and /information/[topic].
 *
 *  Why blog posts appear in Learn at all: writers author in /studio, which
 *  produces `post` rows, but Learn is a build-time registry (content/** bundled at
 *  build, /information/[topic]/[slug] SSG with dynamicParams = false), so a
 *  database row can never mint a Learn slug. An admin instead files a published
 *  post under a Learn topic (`post.learn_topic`) and it is REFERENCED here.
 *  Canonical stays /blog/<slug>: nothing new enters the sitemap and nothing counts
 *  against INFORMATION_MAX_INDEXED.
 *
 *  Why this band carries a byline when the answer rows do not: `InfoEntry.author`
 *  exists and is documented as an E-E-A-T signal, but the generated champion
 *  entries are data-derived and deliberately unsigned. These are written by a
 *  person, so the name is the point — it is what separates the band from the
 *  templated answers above it.
 *
 *  Two consumers (the hub and every topic page), which is what justifies a shared
 *  component rather than the markup twice. The section chrome copies the hub's
 *  existing "Most asked" band rather than inventing a third list style. */
export function ContributorPosts({
  posts,
  /** Omitted on a topic page, where the heading would restate the page title. */
  showTopic = false,
  className = '',
}: {
  posts: BlogPost[];
  showTopic?: boolean;
  className?: string;
}) {
  if (posts.length === 0) return null;
  return (
    <section aria-label="From our contributors" className={className}>
      <div className="mb-3 flex items-baseline justify-between border-b border-text pb-1">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          From our contributors
        </span>
        <span className="font-mono text-[10px] tabular-nums text-text-faint">{posts.length}</span>
      </div>
      <div className="grid gap-x-10 md:grid-cols-2">
        {posts.map(p => (
          <Link key={p.id} href={`/blog/${p.slug}`} className="group block border-b border-border py-2.5">
            <span className="block font-serif text-[17px] font-semibold leading-snug text-text group-hover:underline">
              {p.title}
            </span>
            {p.summary && (
              <span className="mt-0.5 line-clamp-1 block text-sm text-text-muted">{p.summary}</span>
            )}
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
              {[
                p.authorName,
                showTopic && p.learnTopic ? getTopic(p.learnTopic)?.label : null,
                p.publishedAt ? formatDate(p.publishedAt) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Fixed en-GB, never the visitor's locale: this renders inside a page that
 *  prerenders and revalidates hourly, so a locale-dependent string would differ
 *  between the cached HTML and a client re-render. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
