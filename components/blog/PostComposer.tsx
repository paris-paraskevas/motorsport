'use client';

import { useState, type FormEvent } from 'react';

// Admin-only draft composer on /blog. POSTs to /api/blog (admin-gated) which
// creates a `draft`; the parent refetches so it appears in the review queue,
// where it's approved with a publish_at. The headless scripts/draft-post path
// still exists — this is the in-app way to author one.
export function PostComposer({
  series,
  onCreated,
}: {
  series: { slug: string; name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [seriesSlug, setSeriesSlug] = useState('');
  const [heroImage, setHeroImage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTitle = (v: string) => {
    setTitle(v);
    // Auto-suggest a kebab slug from the title until the slug is edited by hand.
    if (!slugEdited) {
      setSlug(
        v
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
      );
    }
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/blog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          summary,
          body,
          seriesSlug: seriesSlug || undefined,
          heroImage: heroImage || undefined,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      setTitle('');
      setSlug('');
      setSlugEdited(false);
      setSummary('');
      setBody('');
      setSeriesSlug('');
      setHeroImage('');
      setOpen(false);
      onCreated();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-brand px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg transition-opacity hover:opacity-90"
      >
        + New post
      </button>
    );
  }

  const field = 'w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint';

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-border bg-surface/60 p-3">
      <input className={field} value={title} onChange={e => onTitle(e.target.value)} placeholder="Title" required maxLength={140} />
      <input
        className={`${field} font-mono text-xs`}
        value={slug}
        onChange={e => {
          setSlug(e.target.value);
          setSlugEdited(true);
        }}
        placeholder="slug-in-kebab-case"
        required
      />
      <input className={field} value={summary} onChange={e => setSummary(e.target.value)} placeholder="Summary (1–2 sentences)" required maxLength={300} />
      <textarea className={`${field} font-mono text-xs`} value={body} onChange={e => setBody(e.target.value)} placeholder="Body (markdown)" required rows={8} />
      <div className="flex flex-wrap gap-2">
        <select
          className={`${field} flex-1`}
          value={seriesSlug}
          onChange={e => setSeriesSlug(e.target.value)}
          aria-label="Tag a series (optional)"
        >
          <option value="">No series — site-wide</option>
          {series.map(s => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <input className={`${field} flex-1`} value={heroImage} onChange={e => setHeroImage(e.target.value)} placeholder="Hero image URL (optional)" />
      </div>
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-brand px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted hover:text-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
