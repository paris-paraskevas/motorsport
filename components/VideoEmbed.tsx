'use client';
import { useState } from 'react';
import { PlayCircle } from 'lucide-react';

/**
 * Click-to-play YouTube facade. Shows the video's poster (a thumbnail image —
 * no cookies) with a play overlay; only on click does it mount the actual
 * `youtube-nocookie` iframe (autoplay). This is how we put "an embedded video
 * on every session" without N live iframes per page: zero iframes (and zero
 * YouTube cookies / consent surface) until the user actually presses play —
 * the one "minimize iframes" rule that applies to us.
 */
export function VideoEmbed({ id, title }: { id: string; title?: string }) {
  const [play, setPlay] = useState(false);
  return (
    <div className="my-4 aspect-video w-full overflow-hidden border border-border bg-surface">
      {play ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title={title ?? 'Highlights'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlay(true)}
          aria-label={title ? `Play ${title}` : 'Play video'}
          className="group relative flex h-full w-full items-center justify-center bg-cover bg-center"
          style={{ backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` }}
        >
          <span className="absolute inset-0 bg-black/45 transition-colors duration-(--duration-fast) group-hover:bg-black/25" />
          <PlayCircle
            size={56}
            strokeWidth={1.5}
            className="relative text-white/90 drop-shadow-lg transition-transform duration-(--duration-fast) group-hover:scale-110"
          />
        </button>
      )}
    </div>
  );
}
