import type { Metadata } from 'next';
import Link from 'next/link';
import { listAuthors } from '@/lib/authors';
import { publishedPosts } from '@/lib/blog';
import { resolveAuthorIdentity } from '@/lib/author-identity';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_READ } from '@/lib/site';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Authors',
  description:
    'The people writing Paddock Tracker: race reports, championship analysis and motorsport commentary across F1, MotoGP, WEC and more.',
  alternates: { canonical: '/authors' },
};

// One bio line for the index. Cut on a word boundary; the full bio lives on the
// profile page.
function excerpt(bio: string, max = 190): string {
  const flat = bio.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

export default async function AuthorsPage() {
  const [authors, posts] = await Promise.all([listAuthors(), publishedPosts()]);

  // One query for every count instead of one per author; ids with no profile
  // (a writer whose bio nobody has written yet) simply never get looked up.
  const counts = new Map<string, number>();
  for (const p of posts) counts.set(p.authorId, (counts.get(p.authorId) ?? 0) + 1);

  // Clerk supplies the avatar only; the row's display_name is what renders (the
  // author set it here, so it outranks their Clerk account name).
  const rows = await Promise.all(
    authors.map(async a => ({
      profile: a,
      identity: await resolveAuthorIdentity(a.clerkUserId, a.displayName),
      count: counts.get(a.clerkUserId) ?? 0,
    })),
  );

  return (
    <div className={PAGE_READ}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Authors', url: `${SITE_URL}/authors` },
        ])}
      />

      <header className="mb-8 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand-fill" />
        <div>
          <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-faint">
            Writing
          </div>
          <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text md:text-4xl">
            Authors<span className="text-brand">.</span>
          </h1>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="font-mono text-sm text-text-muted">No author profiles yet.</p>
      ) : (
        <ul className="divide-y divide-border/60 border-y border-border/60">
          {rows.map(({ profile, identity, count }) => (
            <li key={profile.slug}>
              <Link href={`/authors/${profile.slug}`} className="group flex items-start gap-4 py-5">
                {identity.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={identity.image}
                    alt=""
                    width={56}
                    height={56}
                    loading="lazy"
                    className="h-14 w-14 shrink-0 border border-border bg-surface object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-14 w-14 shrink-0 items-center justify-center border border-border bg-surface font-display text-xl font-extrabold text-text-faint"
                  >
                    {profile.displayName.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-xl font-extrabold uppercase tracking-wide text-text transition-colors duration-(--duration-fast) group-hover:text-brand">
                      {profile.displayName}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint tabular-nums">
                      {profile.roleTitle ? `${profile.roleTitle} · ` : ''}
                      {count} {count === 1 ? 'post' : 'posts'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{excerpt(profile.bio)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
