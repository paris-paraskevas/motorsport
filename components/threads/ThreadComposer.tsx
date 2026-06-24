'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TITLE_MAX, BODY_MAX } from '@/lib/threads';

// Signed-in submit form. POSTs to /api/threads; the thread lands `pending` and is
// public only after a moderator approves. router.refresh() re-reads the page.
export function ThreadComposer() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
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
        body: JSON.stringify({ title, body }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(d.error ?? 'Could not post.');
        return;
      }
      setTitle('');
      setBody('');
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
