'use client';
import { useState } from 'react';
import { PlayCircle, ExternalLink } from 'lucide-react';

/**
 * A highlight clip shown as its YouTube poster (a thumbnail image — no
 * cookies, no iframe) with a play overlay.
 *
 * Default behaviour is **link-out**: clicking opens the video on YouTube in a
 * new tab. Official motorsport channels — F1/F2/F3 (FOM) confirmed, and most
 * others to protect their own traffic — disable third-party embedding, so an
 * in-place iframe would render a broken "Watch on YouTube" player. Link-out
 * keeps the embedded-video *look* while respecting that policy and never
 * showing a dead frame.
 *
 * `embeddable` opts a clip into true in-place playback (the `youtube-nocookie`
 * iframe mounts on click) — only set it for channels we've verified actually
 * allow embedding.
 */
export function VideoEmbed({
  id,
  title,
  embeddable = false,
}: {
  id: string;
  title?: string;
  embeddable?: boolean;
}) {
  const [play, setPlay] = useState(false);
  const frame =
    'my-4 aspect-video w-full overflow-hidden border border-border bg-surface';

  if (embeddable && play) {
    return (
      <div className={frame}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title={title ?? 'Highlights'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  const poster = { backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` };
  const surface =
    'group relative flex h-full w-full items-center justify-center bg-cover bg-center';
  const inner = (
    <>
      <span className="absolute inset-0 bg-black/45 transition-colors duration-(--duration-fast) group-hover:bg-black/25" />
      <PlayCircle
        size={56}
        strokeWidth={1.5}
        className="relative text-white/90 drop-shadow-lg transition-transform duration-(--duration-fast) group-hover:scale-110"
      />
      {!embeddable && (
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/85">
          YouTube
          <ExternalLink size={11} />
        </span>
      )}
    </>
  );

  return (
    <div className={frame}>
      {embeddable ? (
        <button
          type="button"
          onClick={() => setPlay(true)}
          aria-label={title ? `Play ${title}` : 'Play video'}
          className={surface}
          style={poster}
        >
          {inner}
        </button>
      ) : (
        <a
          href={`https://www.youtube.com/watch?v=${id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={title ? `Watch ${title} on YouTube` : 'Watch on YouTube'}
          className={surface}
          style={poster}
        >
          {inner}
        </a>
      )}
    </div>
  );
}
