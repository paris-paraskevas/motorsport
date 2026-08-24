'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import type { HomeBlock } from '@/lib/home-layout';

// Pick the post that leads /app, or hand the slot back to "newest published".
// Publishing POSTs a whole layout revision, not a patch: the API appends a row
// and the newest published row wins, so the client has to send the blocks it
// wants to be live. Everything else in the layout is passed straight through.
export function LeadPicker({
  pinnedSlug,
  blocks,
  posts,
}: {
  pinnedSlug: string | null;
  blocks: HomeBlock[];
  posts: { slug: string; title: string; publishedAt: string | null; seriesSlug: string | null }[];
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<string | null>(pinnedSlug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = choice !== pinnedSlug;

  async function publish() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    // Carry the rest of the layout through untouched; only the lead's pin moves.
    const next = blocks.map(b =>
      b.id === 'blog' ? { ...b, pinnedSlug: choice ?? undefined } : b,
    );
    try {
      const res = await fetch('/api/admin/page-layout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blocks: next }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `Failed (${res.status}).`);
        return;
      }
      setSaved(true);
      router.refresh(); // pinnedSlug comes back from the server; `dirty` settles
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const row =
    'flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors duration-(--duration-fast) hover:bg-surface';

  return (
    <div className="max-w-3xl">
      <div className="mb-4 border border-border">
        <button
          type="button"
          onClick={() => setChoice(null)}
          className={row}
          aria-pressed={choice === null}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-border-strong">
            {choice === null && <Check size={13} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-text">Newest published post</span>
            <span className="block text-xs text-text-faint">
              The automatic behaviour. The lead changes on its own as you publish.
            </span>
          </span>
        </button>
        {posts.map(p => (
          <button
            key={p.slug}
            type="button"
            onClick={() => setChoice(p.slug)}
            className={row}
            aria-pressed={choice === p.slug}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-border-strong">
              {choice === p.slug && <Check size={13} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-text">{p.title}</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                {[p.seriesSlug, p.publishedAt ? p.publishedAt.slice(0, 10) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={publish}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-2 border border-border-strong bg-surface px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text transition-colors duration-(--duration-fast) hover:border-text disabled:opacity-50"
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          {busy ? 'Publishing…' : dirty ? 'Publish to everyone' : 'Published'}
        </button>
        {saved && !dirty && (
          <span className="text-xs text-text-muted">
            Live. The home page can take a moment to pick it up.
          </span>
        )}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  );
}
