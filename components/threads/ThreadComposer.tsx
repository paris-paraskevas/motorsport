'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TITLE_MAX, BODY_MAX } from '@/lib/threads';

// One series option for the optional tag picker (slug + display name).
export interface SeriesOption {
  slug: string;
  name: string;
}

// Signed-in submit form. POSTs to /api/threads; the thread lands `pending` and is
// public only after a moderator approves. router.refresh() re-reads the page.
// `series` (optional) populates a "tag a series" picker; `defaultSeries`
// pre-selects one (e.g. when the composer is reached from a series context).
export function ThreadComposer({
  series = [],
  defaultSeries = '',
}: {
  series?: SeriesOption[];
  defaultSeries?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [seriesSlug, setSeriesSlug] = useState(defaultSeries);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, body, seriesSlug: seriesSlug || undefined }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(d.error ?? 'Could not post.');
        return;
      }
      setTitle('');
      setBody('');
      setSeriesSlug(defaultSeries);
      setMsg('Submitted — a moderator will review it shortly.');
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded border border-border p-3">
      <h2 className="font-display uppercase tracking-wide text-text">Start a thread</h2>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        maxLength={TITLE_MAX}
        placeholder="Title"
        className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text"
        aria-label="Thread title"
      />
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        maxLength={BODY_MAX}
        placeholder="What's on your mind?"
        rows={4}
        className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text"
        aria-label="Thread body"
      />
      {series.length > 0 && (
        <select
          value={seriesSlug}
          onChange={e => setSeriesSlug(e.target.value)}
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text"
          aria-label="Tag a series (optional)"
        >
          <option value="">No series — general discussion</option>
          {series.map(s => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !title.trim() || !body.trim()}
          className="rounded bg-brand px-4 py-2 font-semibold text-bg disabled:opacity-40"
        >
          {busy ? 'Posting…' : 'Post for review'}
        </button>
        {msg && <span className="font-mono text-xs text-emerald-400">{msg}</span>}
        {error && <span className="font-mono text-xs text-red-400">{error}</span>}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        Threads are public once a moderator approves them.
      </p>
    </form>
  );
}
