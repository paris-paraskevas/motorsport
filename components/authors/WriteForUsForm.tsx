'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { SignInButton, useAuth, useUser } from '@clerk/nextjs';

// The application form on /write-for-us. Client-side so the page itself stays
// cacheable: signed-out visitors get a sign-in CTA, existing authors get sent
// to the studio, everyone else gets the three fields. POSTs /api/author-request.

const FIELD =
  'w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint';

function Label({ text }: { text: string }) {
  return (
    <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
      {text}
    </span>
  );
}

export function WriteForUsForm() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [pitch, setPitch] = useState('');
  const [links, setLinks] = useState('');
  const [sample, setSample] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = user?.publicMetadata?.role;
  const alreadyAuthor = role === 'contributor' || role === 'writer' || role === 'admin';

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <div className="border-t border-border pt-6">
        <p className="text-sm text-text-muted">
          Applications are tied to an account, so sign in first. It takes a minute and it is free.
        </p>
        <SignInButton mode="modal">
          <button
            type="button"
            className="mt-3 bg-text px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted"
          >
            Sign in to apply
          </button>
        </SignInButton>
      </div>
    );
  }

  if (alreadyAuthor) {
    return (
      <div className="border-t border-border pt-6">
        <p className="text-sm text-text-muted">
          Your account can already write.{' '}
          <Link href="/studio" className="font-medium text-tint hover:underline underline-offset-2">
            Open the studio →
          </Link>
        </p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="border-t border-border pt-6">
        <p className="text-sm text-text">
          Application received. We read everything and reply by email either way.
        </p>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/author-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pitch, links, sample }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      setSent(true);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-border pt-6">
      <label className="block">
        <Label text="Why you" />
        <textarea
          className={FIELD}
          value={pitch}
          onChange={e => setPitch(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="What you follow, what you'd write about, why readers should hear it from you."
          required
        />
      </label>
      <label className="block">
        <Label text="Links (optional)" />
        <input
          className={`${FIELD} font-mono text-xs`}
          value={links}
          onChange={e => setLinks(e.target.value)}
          maxLength={1000}
          placeholder="Portfolio, socials, published work."
        />
      </label>
      <label className="block">
        <Label text="Writing sample (optional)" />
        <textarea
          className={`${FIELD} font-mono text-xs`}
          value={sample}
          onChange={e => setSample(e.target.value)}
          rows={8}
          maxLength={8000}
          placeholder="Paste a sample, or put a link to one in the field above."
        />
      </label>
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="bg-text px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted disabled:opacity-40"
      >
        {busy ? 'Sending…' : 'Send application'}
      </button>
    </form>
  );
}
