// Shared /blog/[slug] post header: date + tags row, title, byline, summary.
// Two real consumers (the extraction rule's bar): the public server path in
// app/(app)/blog/[slug]/page.tsx and DraftEditor's view mode (spec
// docs/superpowers/specs/2026-07-03-draft-inline-edit-design.md). Presentational
// and hook-free so it renders identically from the RSC tree and the client
// editor.

export interface PostAuthor {
  name: string | null;
  image: string | null;
}

/** Article body wrapper classes — single-sourced so the public path and the
 *  editor's view mode can't drift apart. */
export const POST_ARTICLE_CLASS =
  `prose dark:prose-invert prose-zinc max-w-none
   prose-headings:tracking-tight prose-headings:scroll-mt-24
   prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
   prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
   prose-p:leading-relaxed
   prose-strong:text-text
   prose-a:text-text prose-a:underline-offset-4
   prose-pre:overflow-x-auto prose-img:rounded-lg prose-img:mx-auto prose-img:max-w-full
   prose-table:block prose-table:overflow-x-auto prose-table:max-w-full`;

/** Cover image between the header and the body. Same two consumers as
 *  PostHeader (public page + DraftEditor view mode). Fixed 1200×630 box
 *  with object-cover, so odd source dimensions crop instead of reflowing
 *  the page; eager-loaded — when present it's the LCP. */
export function PostHero({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={1200}
      height={630}
      className="mb-8 aspect-[1200/630] w-full rounded-xl border border-border bg-surface object-cover"
    />
  );
}

export function PostHeader({
  dateLabel,
  tags,
  title,
  summary,
  author,
}: {
  dateLabel: string;
  tags?: string[];
  title: string;
  summary: string;
  author: PostAuthor;
}) {
  return (
    <header className="mb-8">
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <time className="text-[11px] uppercase tracking-[0.16em] text-text-faint font-semibold tabular-nums font-mono">
          {dateLabel}
        </time>
        {tags?.map(tag => (
          <span
            key={tag}
            className="text-[10px] uppercase tracking-[0.12em] font-semibold text-text-muted bg-surface border border-border rounded-full px-2 py-0.5"
          >
            {tag}
          </span>
        ))}
      </div>
      <h1 className="text-text text-3xl md:text-4xl font-bold tracking-tight leading-tight">
        {title}
      </h1>
      {author.name && (
        <div className="mt-3 flex items-center gap-2">
          {author.image && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={author.image}
                alt=""
                width={28}
                height={28}
                loading="lazy"
                className="h-7 w-7 rounded-full object-cover border border-border bg-surface"
              />
            </>
          )}
          <span className="text-sm font-medium text-text-muted">By {author.name}</span>
        </div>
      )}
      <p className="mt-4 text-base text-text-muted leading-relaxed">
        {summary}
      </p>
    </header>
  );
}
