'use client';

import { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

type Reaction = 'like' | 'dislike';
interface Summary {
  likes: number;
  dislikes: number;
  mine: Reaction | null;
}

// Like/dislike on a post. Anonymous readers can react once (deduped server-side
// by a salted IP hash); signed-in readers dedup by account. Counts + the caller's
// own reaction load from /api/blog/reactions; clicking the active reaction again
// removes it. Fail-soft: if the API is unavailable the widget just shows zeros.
//
// `compact` is the byline-band form (0.334.20, operator ask): the same two
// buttons, smaller and without the heading or the rule above them, so they sit in
// the author row where they are visible without scrolling. The full form used to
// live at the foot of the article, where most readers never reached it.
export function BlogReactions({ slug, compact = false }: { slug: string; compact?: boolean }) {
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

  // 32px tall compact / 40px full. The compact pills stay above 32px in both
  // dimensions and keep a 6px gap, so they remain separate tap targets in the
  // byline row rather than one ambiguous blob.
  const pill = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors duration-(--duration-fast) disabled:opacity-60 ${
      compact ? 'px-2.5 py-1.5 text-[13px] tabular-nums' : 'gap-2 px-3 py-2 text-sm'
    } ${
      active
        ? 'border-brand text-brand'
        : 'border-border text-text-muted hover:border-border-strong hover:text-text'
    }`;

  const size = compact ? 14 : 15;
  const buttons = (
    <div className={compact ? 'flex items-center gap-1.5' : 'flex flex-wrap gap-2'}>
      <button
        type="button"
        onClick={() => react('like')}
        disabled={busy}
        aria-pressed={state.mine === 'like'}
        aria-label="Like this post"
        className={pill(state.mine === 'like')}
      >
        <ThumbsUp size={size} />
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
        <ThumbsDown size={size} />
        {state.dislikes}
      </button>
    </div>
  );

  // Compact drops the heading, so the buttons carry the naming themselves via
  // their aria-labels plus a group label for screen readers.
  if (compact) {
    return (
      <div role="group" aria-label="Did you like this post?">
        {buttons}
      </div>
    );
  }

  return (
    <section className="mt-10 border-t border-border pt-4">
      <h2 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
        Did you like this?
      </h2>
      {buttons}
    </section>
  );
}
