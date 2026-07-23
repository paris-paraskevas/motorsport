'use client';

import { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

type Reaction = 'like' | 'dislike';
interface Summary {
  likes: number;
  dislikes: number;
  mine: Reaction | null;
}

// End-of-post like/dislike. Anonymous readers can react once (deduped server-side
// by a salted IP hash); signed-in readers dedup by account. Counts + the caller's
// own reaction load from /api/blog/reactions; clicking the active reaction again
// removes it. Fail-soft: if the API is unavailable the widget just shows zeros.
export function BlogReactions({ slug }: { slug: string }) {
  const [state, setState] = useState<Summary>({ likes: 0, dislikes: 0, mine: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/blog/reactions?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (live && d && typeof d.likes === 'number') setState(d);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slug]);

  const react = async (reaction: Reaction) => {
    if (busy) return;
    setBusy(true);
    const removing = state.mine === reaction;
    try {
      const res = removing
        ? await fetch(`/api/blog/reactions?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' })
        : await fetch('/api/blog/reactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, reaction }),
          });
      if (res.ok) {
        const d = await res.json();
        if (d && typeof d.likes === 'number') setState(d);
      }
    } catch {
      // leave the current counts as-is
    } finally {
      setBusy(false);
    }
  };

  const pill = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-(--duration-fast) disabled:opacity-60 ${
      active
        ? 'border-brand text-brand'
        : 'border-border text-text-muted hover:border-border-strong hover:text-text'
    }`;

  return (
    <section className="mt-10 border-t border-border pt-4">
      <h2 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
        Did you like this?
      </h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => react('like')}
          disabled={busy}
          aria-pressed={state.mine === 'like'}
          aria-label="Like this post"
          className={pill(state.mine === 'like')}
        >
          <ThumbsUp size={15} />
          {state.likes}
        </button>
        <button
          type="button"
          onClick={() => react('dislike')}
          disabled={busy}
          aria-pressed={state.mine === 'dislike'}
          aria-label="Dislike this post"
          className={pill(state.mine === 'dislike')}
        >
          <ThumbsDown size={15} />
          {state.dislikes}
        </button>
      </div>
    </section>
  );
}
