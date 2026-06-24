'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PostComposer } from './PostComposer';

// Admin blog console on /blog: compose a draft, then work the review queue
// (approve with a publish_at / reject) and see what's scheduled. Self-hides for
// signed-out / non-admin users (GET /api/blog 401/403s them). Visible to admins
// even when the queue is empty, so the pipeline is actually discoverable.

interface PostRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  seriesSlug: string | null;
  status: string;
  publishAt: string | null;
}

// Default publish time ≈ now + 1h, formatted as LOCAL wall-clock for the
// <input type="datetime-local"> (which is local-time; converted to UTC on POST).
function defaultLocalDateTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function PostModeration({ series }: { series: { slug: string; name: string }[] }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<{ drafts: PostRow[]; scheduled: PostRow[] } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [when, setWhen] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/blog');
      if (res.status === 401 || res.status === 403) {
        setHidden(true);
        return;
      }
      if (!res.ok) {
        setError(`load failed (${res.status})`);
        return;
      }
      const d = (await res.json()) as { drafts?: PostRow[]; scheduled?: PostRow[] };
      setData({ drafts: d.drafts ?? [], scheduled: d.scheduled ?? [] });
    } catch {
      setError('load failed');
    }
  }, []);

  // Initial load on mount — inline async IIFE (not a direct load() call) so the
  // setState lands asynchronously: the codebase's lint-clean fetch-in-effect
  // pattern (cf. NotifPrefsSection). load() is reused for handler refetches.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/blog');
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setHidden(true);
          return;
        }
        if (!res.ok) {
          setError(`load failed (${res.status})`);
          return;
        }
        const d = (await res.json()) as { drafts?: PostRow[]; scheduled?: PostRow[] };
        if (!cancelled) setData({ drafts: d.drafts ?? [], scheduled: d.scheduled ?? [] });
      } catch {
        if (!cancelled) setError('load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(id);
    setError(null);
    try {
      const body: { action: string; publishAt?: string } = { action };
      if (action === 'approve') {
        const d = new Date(when[id] || defaultLocalDateTime());
        if (Number.isNaN(d.getTime())) {
          setError('Pick a valid publish time.');
          return;
        }
        body.publishAt = d.toISOString(); // local → UTC
      }
      const res = await fetch(`/api/blog/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(d.error ?? 'Failed.');
        return;
      }
      await load();
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(null);
    }
  }

  if (!isLoaded || !isSignedIn || hidden || !data) return null;

  const empty = data.drafts.length === 0 && data.scheduled.length === 0;

  return (
    <section className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h2 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400">
        Editor · blog
      </h2>

      <PostComposer series={series} onCreated={load} />

      {data.drafts.length > 0 && (
        <ul className="mt-4 space-y-3">
          {data.drafts.map(p => (
            <li key={p.id} className="rounded-lg border border-border bg-surface/60 p-3">
              <div className="font-semibold text-text">{p.title}</div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">
                {p.slug}
                {p.seriesSlug ? ` · ${p.seriesSlug}` : ' · site-wide'}
              </div>
              <p className="mb-2 text-sm text-text-muted">{p.summary}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  value={when[p.id] ?? defaultLocalDateTime()}
                  onChange={e => setWhen(w => ({ ...w, [p.id]: e.target.value }))}
                  className="rounded border border-border bg-bg px-2 py-1 font-mono text-xs text-text"
                  aria-label="Publish time"
                />
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => decide(p.id, 'approve')}
                  className="rounded bg-brand px-3 py-1 font-semibold text-bg disabled:opacity-40"
                >
                  Approve + schedule
                </button>
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => decide(p.id, 'reject')}
                  className="rounded border border-border px-3 py-1 font-mono text-sm text-text-muted disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data.scheduled.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            Scheduled
          </h3>
          <ul className="space-y-1">
            {data.scheduled.map(p => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 font-mono text-xs">
                <Link href={`/blog/${p.slug}`} className="truncate text-text hover:text-brand">
                  {p.title}
                </Link>
                <span className="shrink-0 text-text-faint">publishes {fmt(p.publishAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {empty && (
        <p className="mt-3 font-mono text-xs text-text-faint">
          No drafts yet — write one above. It lands here as a draft to approve + schedule; the publish cron makes it
          live at the time you pick.
        </p>
      )}

      {error && <p className="mt-2 font-mono text-xs text-red-400">{error}</p>}
    </section>
  );
}
