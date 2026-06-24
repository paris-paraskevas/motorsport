'use client';

import { useEffect, useState, type FormEvent } from 'react';

interface Item {
  id: string;
  authorId: string;
  authorName: string | null;
  kind: 'bug' | 'feature' | 'comment';
  title: string;
  body: string;
  status: 'open' | 'considered' | 'done' | 'closed';
  createdAt: string;
}

const KINDS: Item['kind'][] = ['bug', 'feature', 'comment'];
const STATUSES: Item['status'][] = ['open', 'considered', 'done', 'closed'];
const KIND_LABEL: Record<Item['kind'], string> = { bug: 'Bug', feature: 'Feature', comment: 'Comment' };
const STATUS_TONE: Record<Item['status'], string> = {
  open: 'text-brand',
  considered: 'text-amber-300',
  done: 'text-emerald-400',
  closed: 'text-text-faint',
};

// Staff feedback board: compose (bug / feature / comment) + the list. Admins can
// move an item's status. The page already gated this to staff; the API re-checks.
export function FeedbackBoard({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Item['kind']>('bug');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function reload() {
    const r = await fetch('/api/feedback');
    if (r.ok) {
      const d = (await r.json()) as { items?: Item[] };
      setItems(d.items ?? []);
    } else {
      setError(`load failed (${r.status})`);
    }
  }

  // Initial load — inline async IIFE so the setState lands asynchronously (the
  // codebase's lint-clean fetch-in-effect pattern).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/feedback');
        if (cancelled) return;
        if (!r.ok) {
          setError(`load failed (${r.status})`);
          return;
        }
        const d = (await r.json()) as { items?: Item[] };
        if (!cancelled) setItems(d.items ?? []);
      } catch {
        if (!cancelled) setError('load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, title, body }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok) {
        setError(d.error ?? 'Failed.');
        return;
      }
      setTitle('');
      setBody('');
      setKind('bug');
      await reload();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function move(id: string, status: Item['status']) {
    try {
      const r = await fetch(`/api/feedback/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (r.ok) await reload();
      else setError('Could not update status.');
    } catch {
      setError('Network error — try again.');
    }
  }

  const field = 'w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint';

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-2 rounded-lg border border-border bg-surface/40 p-3">
        <div className="flex flex-wrap gap-2">
          <select className={`${field} w-auto`} value={kind} onChange={e => setKind(e.target.value as Item['kind'])} aria-label="Kind">
            {KINDS.map(k => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <input className={`${field} flex-1`} value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" required maxLength={140} />
        </div>
        <textarea className={field} value={body} onChange={e => setBody(e.target.value)} placeholder="Details…" required rows={4} />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-brand px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg disabled:opacity-40"
          >
            {busy ? 'Posting…' : 'Post'}
          </button>
          {error && <span className="font-mono text-xs text-red-400">{error}</span>}
        </div>
      </form>

      {items === null ? (
        <p className="font-mono text-sm text-text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="font-mono text-sm text-text-muted">Nothing yet — post the first bug or idea above.</p>
      ) : (
        <ul className="space-y-3">
          {items.map(it => (
            <li key={it.id} className="rounded-lg border border-border p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                  {KIND_LABEL[it.kind]}
                </span>
                <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${STATUS_TONE[it.status]}`}>{it.status}</span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
                  {it.authorName ?? `Racer ${it.authorId.slice(-4)}`}
                </span>
              </div>
              <div className="font-semibold text-text">{it.title}</div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-text-muted">{it.body}</p>
              {canManage && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {STATUSES.filter(s => s !== it.status).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => move(it.id, s)}
                      className="rounded border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted hover:text-text"
                    >
                      → {s}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
