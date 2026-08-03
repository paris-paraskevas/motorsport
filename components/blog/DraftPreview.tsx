import type { ReactNode } from 'react';
import Link from 'next/link';
import { PencilLine } from 'lucide-react';
import { PostHeader, PostHero, POST_ARTICLE_CLASS, type PostAuthor } from './PostHeader';

// Preview branch of /blog/[slug] for a not-yet-published post (draft, submitted,
// or scheduled): a status rule above the exact article the reader would see.
// Successor to DraftEditor — the in-place pencil editor moved to /studio/[id],
// so this is a server component again and the preview page carries no form. The
// banner links to the studio editor; the rendered body is the server pipeline's
// (`bodyNode`), byte-identical to what publishes.

export interface DraftPreviewProps {
  id: string;
  title: string;
  summary: string;
  heroImage: string | null;
  /** Import provenance — previews render the same line readers will see. */
  originalUrl?: string | null;
  bodyNode: ReactNode;
  dateLabel: string;
  banner: { kind: 'draft' } | { kind: 'in_review' } | { kind: 'scheduled'; label: string };
  author: PostAuthor | null;
}

export function DraftPreview({ id, title, summary, heroImage, originalUrl, bodyNode, dateLabel, banner, author }: DraftPreviewProps) {
  const bannerText =
    banner.kind === 'draft'
      ? 'Draft preview · not yet submitted · only you and editors can see this'
      : banner.kind === 'in_review'
        ? 'In review · awaiting an editor decision · only you and editors can see this'
        : `Scheduled preview · publishes ${banner.label} UTC · only you and editors can see this`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-l-2 border-amber-400 pl-3 font-mono text-xs text-amber-700 dark:text-amber-300">
        <span>{bannerText}</span>
        <Link
          href={`/studio/${id}`}
          className="inline-flex shrink-0 items-center gap-1.5 font-semibold uppercase tracking-[0.12em] transition-colors duration-(--duration-fast) hover:text-amber-800 dark:hover:text-amber-200"
        >
          <PencilLine size={13} /> Edit in studio
        </Link>
      </div>

      <PostHeader
        dateLabel={dateLabel}
        title={title}
        summary={summary}
        author={author ?? { name: null, image: null }}
        originalUrl={originalUrl}
      />
      {heroImage && <PostHero src={heroImage} alt={title} />}
      <article className={POST_ARTICLE_CLASS}>{bodyNode}</article>
    </>
  );
}
