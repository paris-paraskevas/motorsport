'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { BIO_MAX, BIO_MIN, LINKS_MAX, LINK_LABEL_MAX, SLUG_MAX, type AuthorLink } from '@/lib/author-profile';

// Form conventions (INPUT class, submit + error mapping, disabled-until-valid)
// mirror app/(app)/contribute/ContributeForm.tsx.
const INPUT =
  'w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-border-strong transition-colors duration-(--duration-fast)';

export interface AuthorPostRow {
  id: string;
  slug: string;
  title: string;
  publishedAt: string | null;
  hidden: boolean;
}

export interface AuthorFormInitial {
  slug: string;
  displayName: string;
  bio: string;
  links: AuthorLink[];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function AuthorProfileForm({
  initial,
  posts,
  suggestedName,
  suggestedSlug,
}: {
  initial: AuthorFormInitial | null;
  posts: AuthorPostRow[];
  suggestedName: string;
  suggestedSlug: string;
}) {
  const existingSlug = initial?.slug ?? null;
  const [displayName, setDisplayName] = useState(initial?.displayName ?? suggestedName);
  const [slug, setSlug] = useState(initial?.slug ?? suggestedSlug);
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [links, setLinks] = useState<AuthorLink[]>(initial?.links ?? []);
  const [hidden, setHidden] = useState<Set<string>>(new Set(posts.filter(p => p.hidden).map(p => p.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  const bioLength = bio.trim().length;
  const valid = displayName.trim().length >= 2 && slug.trim().length >= 3 && bioLength >= BIO_MIN && bioLength <= BIO_MAX;

  const setLink = (i: number, patch: Partial<AuthorLink>) =>
    setLinks(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const toggleHidden = (id: string) =>
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    setSavedSlug(null);
    try {
      const res = await fetch('/api/author', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, displayName, bio, links, hiddenPostIds: [...hidden] }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; slug?: string } | null;
      if (!res.ok) throw new Error(data?.error || `error (${res.status})`);
      setSavedSlug(data?.slug ?? slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs text-text-muted">
            Your name, as readers see it <span className="text-brand">*</span>
          </span>
          <input
            type="text"
            required
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={80}
            placeholder="Your byline"
            className={INPUT}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-text-muted">
            Your profile address <span className="text-brand">*</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-mono text-xs text-text-faint">/authors/</span>
            <input
              type="text"
              required
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase())}
              maxLength={SLUG_MAX}
              placeholder="your-name"
              className={`${INPUT} font-mono`}
            />
          </div>
          <span className="mt-1.5 block text-xs text-text-faint">
            Lowercase letters, numbers and hyphens.
            {existingSlug && slug.trim() !== existingSlug
              ? ' Changing this changes your public URL, and the old one stops working.'
              : ''}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-text-muted">
            Bio <span className="text-brand">*</span>
          </span>
          <textarea
            rows={5}
            required
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={BIO_MAX}
            placeholder="What you cover, and why a reader should trust you on it."
            className={`${INPUT} resize-none`}
          />
          <span
            className={`mt-1.5 block font-mono text-[11px] tabular-nums ${
              bioLength > 0 && bioLength < BIO_MIN ? 'text-amber-400' : 'text-text-faint'
            }`}
          >
            {bioLength}/{BIO_MAX}
            {bioLength < BIO_MIN ? ` · ${BIO_MIN - bioLength} more to go` : ''}
          </span>
        </label>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
            Where to find you
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint tabular-nums">
            {links.length}/{LINKS_MAX}
          </span>
        </div>
        <p className="mb-3 text-xs text-text-faint">
          Public links only, https, and never an email address. These are the only contact route on your page.
        </p>
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                type="text"
                value={l.label}
                onChange={e => setLink(i, { label: e.target.value })}
                maxLength={LINK_LABEL_MAX}
                placeholder="Label"
                className={`${INPUT} sm:w-40`}
              />
              <input
                type="url"
                value={l.url}
                onChange={e => setLink(i, { url: e.target.value })}
                maxLength={2048}
                placeholder="https://"
                className={INPUT}
              />
              <button
                type="button"
                onClick={() => setLinks(prev => prev.filter((_, idx) => idx !== i))}
                aria-label={`Remove link ${i + 1}`}
                className="mt-2 shrink-0 text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        {links.length < LINKS_MAX && (
          <button
            type="button"
            onClick={() => setLinks(prev => [...prev, { label: '', url: '' }])}
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:text-brand"
          >
            <Plus size={13} /> Add a link
          </button>
        )}
      </section>

      {posts.length > 0 && (
        <section>
          <h2 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
            Posts on your profile
          </h2>
          <p className="mb-3 text-xs text-text-faint">
            Unticking a post removes it from your profile only. It stays live on the blog.
          </p>
          <ul className="divide-y divide-border/60 border-y border-border/60">
            {posts.map(p => (
              <li key={p.id} className="flex items-start gap-3 py-3">
                <input
                  type="checkbox"
                  id={`post-${p.id}`}
                  checked={!hidden.has(p.id)}
                  onChange={() => toggleHidden(p.id)}
                  className="mt-1 h-4 w-4 shrink-0 accent-brand"
                />
                <label htmlFor={`post-${p.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block text-sm font-medium leading-snug text-text">{p.title}</span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint tabular-nums">
                    {formatDate(p.publishedAt)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <div className="text-sm text-amber-400">{error}</div>}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={!valid || saving}
          className="rounded-full bg-text px-5 py-2.5 text-sm font-semibold text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : existingSlug ? 'Save profile' : 'Create my profile'}
        </button>
        {savedSlug && (
          <span className="text-sm text-text-muted">
            Saved.{' '}
            <Link href={`/authors/${savedSlug}`} className="text-text underline decoration-border underline-offset-4 hover:text-brand">
              View your profile
            </Link>
          </span>
        )}
      </div>
    </form>
  );
}
