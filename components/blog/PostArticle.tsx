import type { RenderedSegment } from '@/lib/blog-embeds';
import { BlogEmbed } from './embeds/BlogEmbed';

// Renders a post body's interleaved sanitised-HTML runs + live embeds, in order.
// Used by both the public /blog/[slug] path and DraftEditor's preview (rendered
// on the server, passed as a node into the client editor) so embeds appear
// wherever the article does. Sits inside the `prose` <article>; each HTML run is
// a sibling <div> (matching the pre-embed single-div structure) and each embed
// carries its own `not-prose` frame. Segment order is fixed per render, so the
// positional key is stable.
export function PostArticle({ segments }: { segments: RenderedSegment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === 'html' ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: seg.html }} />
        ) : (
          <BlogEmbed key={i} spec={seg.spec} />
        ),
      )}
    </>
  );
}
