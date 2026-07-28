import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAuthorBySlug, listAuthors, type AuthorProfile } from '@/lib/authors';
import { publishedPostsByAuthor } from '@/lib/blog';
import { resolveAuthorIdentity } from '@/lib/author-identity';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd, profilePageLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_READ } from '@/lib/site';

// ISR at the same cadence as /blog (revalidate 300): a profile changes about as
// often as the post list it fronts. Params come from the `author` table, and
// dynamicParams stays on (default) so a profile added between builds still
// resolves on first request instead of 404ing until the next deploy.
export const revalidate = 300;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const authors = await listAuthors();
  return authors.map(a => ({ slug: a.slug }));
}

// The bio doubles as the meta description — cut on a word boundary so the
// snippet never ends mid-word.
function metaDescription(bio: string): string {
  const flat = bio.replace(/\s+/g, ' ').trim();
  if (flat.length <= 155) return flat;
  return `${flat.slice(0, 155).replace(/\s+\S*$/, '')}…`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) return { title: 'Author', robots: { index: false, follow: false } };
  return {
    title: author.displayName,
    description: metaDescription(author.bio),
    alternates: { canonical: `/authors/${slug}` },
    openGraph: {
      type: 'profile',
      title: author.displayName,
      description: metaDescription(author.bio),
      url: `${SITE_URL}/authors/${slug}`,
    },
  };
}

function Links({ links }: { links: AuthorProfile['links'] }) {
  if (links.length === 0) return null;
  return (
    <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
      {links.map(l => (
        <li key={l.url}>
          {/* rel="me" is the identity claim that pairs with Person.sameAs in the
              page's JSON-LD; noopener/nofollow keep an editable outbound link
              from leaking window access or ranking signal. */}
          <a
            href={l.url}
            rel="me noopener nofollow"
            target="_blank"
            className="group inline-flex items-baseline gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:text-brand"
          >
            {l.label}
            <span aria-hidden="true" className="text-text-faint transition-colors duration-(--duration-fast) group-hover:text-brand">
              ↗
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  // The row's display_name wins: the author typed it into /settings/author, so it
  // must not be silently overridden by whatever their Clerk account happens to say.
  // Clerk is still the avatar source (same resolver the byline uses, KV-cached).
  const [identity, posts] = await Promise.all([
    resolveAuthorIdentity(author.clerkUserId, author.displayName),
    publishedPostsByAuthor(author.clerkUserId),
  ]);
  const name = author.displayName;
  const url = `${SITE_URL}/authors/${author.slug}`;
  const oldest = posts.at(-1);
  const since = oldest ? new Date(oldest.publishedAt ?? oldest.createdAt).getUTCFullYear() : null;

  return (
    <div className={PAGE_READ}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Authors', url: `${SITE_URL}/authors` },
          { name: name, url },
        ])}
      />
      <JsonLd
        data={profilePageLd({
          name,
          url,
          bio: author.bio,
          jobTitle: author.roleTitle,
          image: identity.image,
          sameAs: author.links.map(l => l.url),
        })}
      />

      <Link
        href="/authors"
        className="mb-6 inline-block font-mono text-[10px] uppercase tracking-[0.18em] text-text-faint transition-colors duration-(--duration-fast) hover:text-text-muted"
      >
        ← Authors
      </Link>

      <header className="border-b border-border pb-7">
        <div className="flex items-start gap-5">
          {identity.image && (
            /* Square, hairline-framed portrait: a masthead, not the round avatar
               chip the bylines use. eslint-disable — same raw <img> as every
               other Clerk-hosted avatar on the site (not a Next-optimised host). */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={identity.image}
              alt=""
              width={96}
              height={96}
              className="h-20 w-20 shrink-0 border border-border bg-surface object-cover md:h-24 md:w-24"
            />
          )}
          <div className="min-w-0">
            <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-faint">
              {author.roleTitle ?? 'Author'}
            </div>
            <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text md:text-4xl">
              {name}
              <span className="text-brand">.</span>
            </h1>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint tabular-nums">
              <span>
                {posts.length} {posts.length === 1 ? 'post' : 'posts'}
              </span>
              {since && <span>Writing since {since}</span>}
            </div>
          </div>
        </div>

        <p className="mt-6 text-base leading-relaxed text-text-muted">{author.bio}</p>
        <Links links={author.links} />
      </header>

      <section className="mt-8">
        <h2 className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
          Published work
        </h2>
        {posts.length === 0 ? (
          <p className="font-mono text-sm text-text-muted">Nothing published yet.</p>
        ) : (
          <ul className="divide-y divide-border/60 border-t border-border/60">
            {posts.map(p => (
              <li key={p.slug} className="py-4">
                <Link href={`/blog/${p.slug}`} className="group block">
                  <time className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint tabular-nums">
                    {formatDate(p.publishedAt ?? p.createdAt)}
                  </time>
                  <h3 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-text transition-colors duration-(--duration-fast) group-hover:text-brand">
                    {p.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{p.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
