'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { MarkdownEditor } from '@/components/blog/MarkdownEditor';

// Full-page create form on /studio/new — the successor to the cramped inline
// composer that used to sit on the public /blog page. POSTs to /api/blog
// (writer-gated) which creates a private `draft`, then routes to the new
// draft's editor page. Slug, series and tags are set HERE, at creation — the
// editor keeps them immutable (matching the PATCH contract).

const FIELD =
  'w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

export function StudioComposer({ series }: { series: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [seriesSlug, setSeriesSlug] = useState('');
  const [tags, setTags] = useState('');
  const [heroImage, setHeroImage] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
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
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          heroImage: heroImage || undefined,
          originalUrl: originalUrl || undefined,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !d.id) {
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      router.push(`/studio/${d.id}`);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-10 lg:items-start">
      <div className="min-w-0 space-y-4">
        <Field label="Title">
          <input
            className={`${FIELD} text-lg font-semibold`}
            value={title}
            onChange={e => onTitle(e.target.value)}
            placeholder="Title"
            required
            maxLength={140}
          />
        </Field>
        <Field label="Summary">
          <textarea
            className={FIELD}
            value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder="1–2 sentences. The card + share text."
            rows={2}
            required
            maxLength={300}
          />
        </Field>
        <div>
          <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
            Body
          </span>
          <MarkdownEditor value={body} onChange={setBody} minHeightClass="min-h-[55vh]" />
        </div>
      </div>

      <aside className="mt-8 space-y-4 border-t border-border pt-6 lg:mt-0 lg:border-t-0 lg:pt-0">
        <Field label="Slug">
          <input
            className={`${FIELD} font-mono text-xs`}
            value={slug}
            onChange={e => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            placeholder="kebab-case-url"
            required
          />
        </Field>
        <Field label="Series">
          <select
            className={FIELD}
            value={seriesSlug}
            onChange={e => setSeriesSlug(e.target.value)}
          >
            <option value="">No series (site-wide)</option>
            {series.map(s => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tags">
          <input
            className={`${FIELD} font-mono text-xs`}
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="f1, monaco, preview"
          />
        </Field>
        <Field label="Cover image URL">
          <input
            className={`${FIELD} font-mono text-xs`}
            value={heroImage}
            onChange={e => setHeroImage(e.target.value)}
            placeholder="https://… (optional)"
          />
        </Field>
        <Field label="Imported from (original URL)">
          <input
            className={`${FIELD} font-mono text-xs`}
            value={originalUrl}
            onChange={e => setOriginalUrl(e.target.value)}
            placeholder="https://… (imports only)"
          />
        </Field>
        {originalUrl.trim() && (
          <p className="font-mono text-[10px] leading-relaxed text-text-faint">
            Import: the post will credit and canonically point to this URL, so search engines index
            the original, not our copy. Leave blank for original writing.
          </p>
        )}
        <p className="font-mono text-[10px] leading-relaxed text-text-faint">
          A series-slug tag (e.g. f1) also surfaces the post on that series&apos; page. Cover
          sources: Wikimedia Commons / Flickr (CC filter, credit in the body) · Unsplash · Pexels ·
          Pixabay. Landscape, ≥1200×630.
        </p>
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-brand-fill px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save draft'}
        </button>
        <p className="font-mono text-[10px] leading-relaxed text-text-faint">
          Saving keeps it private. Submit it for review from the draft&apos;s page when it&apos;s
          ready.
        </p>
      </aside>
    </form>
  );
}
